// ferramentas/semana/atualizar.js — ROTINA SEMANAL de custos + contas a pagar, sem duplicidade (pedido 15, Rafael 09/10/2026)
//
//   node ferramentas/semana/atualizar.js                     PRÉVIA (nada gravado) do relatório mais novo de cada fonte
//   node ferramentas/semana/atualizar.js --confirmar         grava (cada mês pelo importar.js, com backup e id de carga)
//   node ferramentas/semana/atualizar.js --desfazer <id>     prévia do desfazer; com --confirmar, desfaz
//   node ferramentas/semana/atualizar.js --ultima            só mostra a última carga gravada no banco (só leitura)
//   --pasta <dir>  usa outra pasta de entrada (testes), com as subpastas dinamica\ e fonseca\
//
// Entrada (Rafael 19/10/2026): pastas FIXAS, uma por fonte — automacao/entrada/dinamica/ ("Relatório de Custo DINAMICA -
// Até DD-MM-AA") e automacao/entrada/fonseca/ ("Relatório de Custo FONSECA - Até DD-MM-AA"). Vale o relatório mais novo
// de cada pasta (pela data do nome = DATA DE CORTE); os antigos ficam como histórico. Datas de corte diferentes = PARA.
//
// Só orquestra o que já existe (não repete a lógica): automacao/classificador.py (--completo --corte), automacao/
// contas_a_pagar.py (--corte), automacao/semana_info.py (leitura dos relatórios e NF ↔ OC) e ferramentas/fechamento/
// importar.js (gravação, backup e desfazer de cada mês e do contas a pagar).
//
// Regra anti-duplicidade (CLAUDE.md, pedido 15):
//   - CHAVE DO TÍTULO = fonte + CNPJ + documento (com a parcela) + data de baixa (ferramentas/semana/chave.js).
//   - Os relatórios são ACUMULADOS: a carga substitui os meses cobertos (importar.js), nunca soma por cima. Relatório
//     que parece só da semana BLOQUEIA (Rafael 19/10/2026; o modo --apenas do importar.js não é mais usado aqui).
//   - Histórico manual protegido (lancado_por = 'Rafael') nunca é tocado (o importar.js só tira linhas de carga).
//   - BLOQUEIAM a carga: mesma chave nas duas fontes; título já gravado que entraria de novo com outra chave (outra
//     fonte ou outra data de baixa); Dinâmica com valor cheio da nota em vez do rateio do Sirius; título pago que sumiu
//     do relatório novo; valor de título já pago que mudou; mês fechado cujo total mudou mais de R$ 0,01 sem
//     explicação; trava do importar.js (✗).
//   - Contas a pagar: fechamento = DATA DE CORTE; a lista é refeita inteira a cada corte; pago depois do corte fica no
//     a pagar e entra no custo da próxima carga — nunca nos dois. Fonte com relatório SÓ DE PAGOS (nenhuma linha em
//     aberto): a lista dela NÃO é refeita; fica a do corte anterior menos os títulos que agora aparecem pagos.
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { createClient } = require('@supabase/supabase-js')
const { chaveCsv, chaveBanco, chaveTitulo, baixaDoBanco, fonteNorm } = require('./chave')

const OBRA = 'sirius60'
const RAIZ = path.join(__dirname, '..', '..')
const AUTOMACAO = path.join(RAIZ, 'automacao')
const ENTRADA = path.join(AUTOMACAO, 'entrada')
const SAIDA_BASE = 'saida_semana'
const IMPORTAR = path.join(RAIZ, 'ferramentas', 'fechamento', 'importar.js')
const PROTEGIDO = 'Rafael'
const DE_CARGA = new Set(['importacao', 'carga planilha'])
const DIAS_SEMANAL = 10 // relatório cujos pagamentos cabem nos últimos 10 dias até o corte = "só da semana" (bloqueia)

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null }
const CONFIRMAR = args.includes('--confirmar')
const DESFAZER = arg('--desfazer')
const ULTIMA = args.includes('--ultima')
const PASTA = arg('--pasta')

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100
const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const br = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—')
const txt = (v) => (v == null ? '' : String(v).trim())
const soma = (ls, c = 'valor') => r2(ls.reduce((t, l) => t + Number(l[c] || 0), 0))
const addDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

function lerEnv() {
  // o próprio script lê o .env.local; nada dele é impresso
  const f = path.join(RAIZ, '.env.local'), env = {}
  if (fs.existsSync(f)) fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  })
  return { ...env, ...process.env }
}
function lerCsv(arquivo) {
  if (!fs.existsSync(arquivo)) return []
  const s = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '')
  const linhas = []; let campo = '', linha = [], aspas = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (aspas) { if (c === '"' && s[i + 1] === '"') { campo += '"'; i++ } else if (c === '"') aspas = false; else campo += c }
    else if (c === '"') aspas = true
    else if (c === ',') { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some((x) => x !== '')) linhas.push(linha)
      linha = []
    } else campo += c
  }
  if (campo !== '' || linha.length) { linha.push(campo); if (linha.some((x) => x !== '')) linhas.push(linha) }
  if (!linhas.length) return []
  const cab = linhas[0].map((c) => c.trim())
  return linhas.slice(1).map((l) => Object.fromEntries(cab.map((c, j) => [c, l[j] == null ? '' : l[j]])))
}
async function todos(q) {
  const out = []
  for (let de = 0; ; de += 1000) {
    const r = await q().range(de, de + 999)
    if (r.error) throw new Error(r.error.message)
    out.push(...r.data)
    if (r.data.length < 1000) return out
  }
}
function rodar(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { cwd: opts.cwd || RAIZ, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 64 * 1024 * 1024 })
  return { ok: r.status === 0, saida: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '' }
}
const py = (argv) => rodar('py', argv, { cwd: AUTOMACAO })
const importar = (argv) => rodar(process.execPath, [IMPORTAR, ...argv])

// ── relatórios de entrada: uma pasta fixa por fonte (Rafael 19/10/2026) ─────────────────────────────────────────────
// data de corte pelo nome: "Até DD-MM-AA" (ou "Até MM-AA" dos relatórios antigos = último dia do mês)
function corteDoNome(f) {
  const m = f.match(/At[eé]\s*(\d{2})-(\d{2})(?:-(\d{2}))?(?!\d)/i)
  if (!m) return null
  return m[3] ? `20${m[3]}-${m[2]}-${m[1]}`
    : new Date(Date.UTC(2000 + Number(m[2]), Number(m[1]), 0)).toISOString().slice(0, 10)
}
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
function maisNovo(dir, fonte, nomeFonte) {
  if (!fs.existsSync(dir)) throw new Error(`pasta ${dir} não existe (salve ali o "Relatório de Custo ${nomeFonte} - Até DD-MM-AA")`)
  const arqs = fs.readdirSync(dir).filter((f) => /\.xlsx?$/i.test(f) && !f.startsWith('~$'))
  const rel = arqs.filter((f) => semAcento(f).includes('relatorio de custo') && semAcento(f).includes(fonte) && corteDoNome(f))
    .map((f) => ({ arq: path.join(dir, f), nome: f, corte: corteDoNome(f) })).sort((a, b) => a.corte.localeCompare(b.corte))
  if (!rel.length) throw new Error(`nenhum "Relatório de Custo ${nomeFonte} - Até DD-MM-AA" em ${dir}`)
  const novo = rel[rel.length - 1]
  const empate = rel.filter((r) => r.corte === novo.corte)
  if (empate.length > 1) throw new Error(`${dir}: ${empate.length} relatórios com a mesma data de corte ${br(novo.corte)} (${empate.map((r) => r.nome).join(', ')}); deixe só um`)
  return { ...novo, historico: rel.length - 1, ignorados: arqs.filter((f) => !rel.some((r) => r.nome === f)) }
}
function acharPasta() {
  const base = PASTA ? path.resolve(PASTA) : ENTRADA
  const din = maisNovo(path.join(base, 'dinamica'), 'dinamica', 'DINAMICA')
  const fon = maisNovo(path.join(base, 'fonseca'), 'fonseca', 'FONSECA')
  // a fonte é conferida também pelo CONTEÚDO (cabeçalho): arquivo na pasta errada para aqui
  // Dinâmica = layout da consulta (VALOR_RATEIO + CENTROCUSTO_RATEIO); Fonseca = TOTVS (Nome + Valor Baixado + CNPJ/CPF)
  const cab = rodar('py', ['-I', '-c', 'import sys,json,openpyxl\nout={}\nfor f in sys.argv[1:]:\n wb=openpyxl.load_workbook(f,read_only=True)\n out[f]=[str(c).strip() for c in next(wb.worksheets[0].iter_rows(max_row=1,values_only=True)) if c is not None]\nprint(json.dumps(out))',
    din.arq, fon.arq])
  if (!cab.ok) throw new Error(`não consegui ler o cabeçalho dos relatórios:\n${cab.saida}`)
  const cols = JSON.parse(cab.stdout.trim().split(/\r?\n/).pop())
  const tipo = (f) => {
    const c = new Set((cols[f] || []).map(semAcento))
    if (c.has('valor_rateio') && c.has('centrocusto_rateio')) return 'dinamica'
    if (c.has('nome') && c.has('valor baixado') && c.has('cnpj/cpf')) return 'fonseca'
    return null
  }
  if (tipo(din.arq) !== 'dinamica') throw new Error(`${din.nome}: o cabeçalho não é o do relatório da Dinâmica (VALOR_RATEIO, CENTROCUSTO_RATEIO)`)
  if (tipo(fon.arq) !== 'fonseca') throw new Error(`${fon.nome}: o cabeçalho não é o do relatório da Fonseca (Nome, Valor Baixado, CNPJ/CPF)`)
  const avisos = [din, fon].filter((r) => r.ignorados.length).map((r) => `${path.basename(path.dirname(r.arq))}/: ignorados (fora do padrão "Relatório de Custo … - Até DD-MM-AA"): ${r.ignorados.join(', ')}`)
  return { base, corte: din.corte === fon.corte ? din.corte : null, din, fon, fonseca: fon.arq, dinamica: din.arq, ocs: [], avisos }
}

// pasta de OCs da semana: as de automacao/oc + as que vieram na pasta da semana (por último = mais recentes)
function montarOcs(ent, saida) {
  const dir = path.join(saida, 'oc')
  fs.mkdirSync(dir, { recursive: true })
  fs.readdirSync(dir).forEach((f) => fs.unlinkSync(path.join(dir, f)))
  fs.readdirSync(path.join(AUTOMACAO, 'oc')).filter((f) => /\.xlsx?$/i.test(f))
    .forEach((f) => fs.copyFileSync(path.join(AUTOMACAO, 'oc', f), path.join(dir, f)))
  ent.ocs.forEach((f) => fs.copyFileSync(f, path.join(dir, `zz_${ent.corte}_${path.basename(f)}`)))
  return dir
}

// ── última carga gravada (só leitura): manifestos carga_<id>.json + conferência no banco ────────────────────────────
async function ultimaCarga(db) {
  const base = path.join(AUTOMACAO, SAIDA_BASE)
  const mans = (fs.existsSync(base) ? fs.readdirSync(base) : []).flatMap((d) => {
    const dir = path.join(base, d)
    if (!fs.statSync(dir).isDirectory()) return []
    return fs.readdirSync(dir).filter((f) => /^carga_[0-9a-f-]{36}\.json$/.test(f)).map((f) => ({ ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), dir }))
  }).sort((a, b) => txt(a.criado_em).localeCompare(txt(b.criado_em)))
  const imps = await todos(() => db.from('importacoes').select('id, competencia, origem, arquivos, total, status, criado_em').eq('obra_id', OBRA).order('criado_em'))
  const contas = await db.from('contas_a_pagar').select('competencia_fechamento, carga_id').eq('obra_id', OBRA).limit(10000)
  const cargasContas = new Set((contas.data || []).map((c) => c.carga_id))
  const L = []
  const okImp = imps.filter((i) => i.status === 'ok')
  const ult = okImp[okImp.length - 1]
  L.push(ult ? `Última importação de custo no banco: ${ult.id} · competência ${ult.competencia} · ${fmt(ult.total)} · gravada em ${br(ult.criado_em)} · ${txt(ult.arquivos)}`
    : 'Nenhuma importação de custo com status ok no banco.')
  const fechs = [...new Set((contas.data || []).map((c) => c.competencia_fechamento))].sort()
  L.push(`Contas a pagar no banco: fechamentos ${fechs.join(', ') || '—'}`)
  const m = mans.filter((x) => x.status !== 'desfeita').pop()
  if (m) {
    // fontes: as do manifesto (desde 19/10/2026) ou a linha "relatórios:" da prévia daquela carga
    const pv = path.join(m.dir, 'previa.md')
    const fontes = m.arquivos ? `${m.arquivos.fonseca} | ${m.arquivos.dinamica}`
      : (fs.existsSync(pv) ? (fs.readFileSync(pv, 'utf8').match(/relatórios: ([^\n]*?)(?: \| (?:OC:|sem relatório de OC)|\n)/) || [])[1] : null) || '—'
    const noBanco = m.passos.map((p) => p.tipo === 'contas' ? cargasContas.has(p.carga_id) : imps.some((i) => i.id === p.importacao_id && i.status === 'ok'))
    L.push(`Última carga semanal: ${m.id} · corte ${br(m.corte)} · ${m.tipo} · ${m.status === 'ok' ? 'CONFIRMADA' : `status ${m.status || 'incompleto'}`} em ${br(m.criado_em)} · fontes: ${fontes}`)
    L.push(`  passos no banco: ${m.passos.map((p, i) => `${p.tipo} ${p.competencia || p.fechamento} ${noBanco[i] ? 'presente' : 'NÃO ENCONTRADO'}`).join(' · ') || 'nenhum'}`)
  } else L.push('Nenhuma carga semanal (carga_<id>.json) encontrada em automacao/saida_semana/.')
  return L
}

// ── vales da Sericita do mês do corte: rateio PROVISÓRIO pela medição (Rafael 19/10/2026) ───────────────────────────
// Os vales de um mês são abatidos no BM do FIM do mês (não no anterior). Até o BM sair, cada vale do mês é rateado entre
// as linhas do contrato pelo avanço MEDIDO no mês (Δ% desde o fim do mês anterior × orçado da linha); sem medição no
// mês, pelo cronograma (parte da duração de cada linha que cai no mês × orçado). Saiu o BM: refazer TODOS os vales do
// mês pela composição do BM (decisoes_pontuais.csv). Aqui só se calcula a proposta (vales_<mês>.csv); quem aplica no
// decisoes_pontuais.csv é o Rafael (ou com o ok dele).
const SERICITA = '23668984'
const LINHAS_SERICITA = ['2.1.2', '2.1.6', '2.1.7', '2.1.8']
async function propostaVales(db, corte, titulos) {
  const mes = corte.slice(0, 7), base = addDias(`${mes}-01`, -1)
  const fimMes = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).toISOString().slice(0, 10)
  const vales = titulos.filter((t) => t.cnpj === SERICITA && /ADIANT/i.test(t.documento) && t.baixa.slice(0, 7) === mes && t.baixa <= corte)
  const orc = await todos(() => db.from('orcamento_planejado').select('codigo_eap, pavimento, preco_total').eq('obra_id', OBRA).in('codigo_eap', LINHAS_SERICITA))
  const med = await todos(() => db.from('avanco_fisico_historico').select('id, codigo_eap, pavimento, percentual_realizado, data_lancamento, semana_numero, excluido_em')
    .eq('obra_id', OBRA).in('codigo_eap', LINHAS_SERICITA))
  const valida = med.filter((m) => !m.excluido_em).sort((a, b) => a.semana_numero - b.semana_numero || txt(a.data_lancamento).localeCompare(txt(b.data_lancamento)) || a.id - b.id)
  const pct = (o, ate) => { const ms = valida.filter((m) => m.codigo_eap === o.codigo_eap && m.pavimento === o.pavimento && txt(m.data_lancamento) <= ate); return ms.length ? Number(ms[ms.length - 1].percentual_realizado) : 0 }
  const linhas = orc.map((o) => ({ ...o, de: pct(o, base), ate: pct(o, corte), orcado: Number(o.preco_total) || 0 }))
  linhas.forEach((l) => (l.peso = Math.max(0, (l.ate - l.de) / 100 * l.orcado)))
  let origem = `medição de ${br(addDias(base, 1))} a ${br(corte)}`
  if (!(linhas.reduce((t, l) => t + l.peso, 0) > 0)) {
    // sem medição no mês: parte da duração de cada linha (datas do cronograma) que cai no mês
    origem = `sem medição no mês: cronograma de ${br(addDias(base, 1))} a ${br(fimMes)}`
    const corr = lerCsv(path.join(AUTOMACAO, 'cronograma', 'correspondencia_cronograma_eap.csv'))
    const dias = (a, b) => Math.max(0, (Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5 + 1)
    linhas.forEach((l) => {
      const c = corr.find((x) => x.codigo_eap === l.codigo_eap && x.pavimento === l.pavimento)
      if (!c) return (l.peso = 0)
      const ini = c.data_inicio > `${mes}-01` ? c.data_inicio : `${mes}-01`, fim = c.data_fim < fimMes ? c.data_fim : fimMes
      l.peso = dias(c.data_inicio, c.data_fim) ? dias(ini, fim) / dias(c.data_inicio, c.data_fim) * l.orcado : 0
    })
  }
  const tot = linhas.reduce((t, l) => t + l.peso, 0)
  linhas.forEach((l) => (l.proporcao = tot > 0 ? l.peso / tot : 0))
  const usadas = linhas.filter((l) => l.proporcao > 0)
  const csv = [['cnpj', 'documento', 'eap', 'proporcao', 'obs', 'alerta', 'classificacao', 'pavimento'].join(',')]
  vales.forEach((v) => usadas.forEach((l) => csv.push([SERICITA, v.documento, l.codigo_eap, l.proporcao.toFixed(10),
    `"Sericita vale ${br(v.baixa)}: PROVISÓRIO pela ${origem} (regra do Rafael 19/10/2026); REFAZER pela composição do BM do fim do mês"`,
    'provisório: refazer pelo BM do mês', '', l.pavimento].join(','))))
  return { mes, origem, vales, linhas, csv: csv.join('\n') + '\n' }
}

// ── prévia ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function previa(db) {
  const ent = acharPasta()
  const ultima = await ultimaCarga(db)
  console.log('\n' + ultima.join('\n'))
  if (!ent.corte) {
    // datas de corte diferentes: escreve a prévia só com isso e PARA (Rafael 19/10/2026)
    const maior = [ent.din.corte, ent.fon.corte].sort()[1]
    const saida = path.join(AUTOMACAO, SAIDA_BASE, maior)
    fs.mkdirSync(saida, { recursive: true })
    const msg = `datas de corte diferentes: Dinâmica ${br(ent.din.corte)} (${ent.din.nome}) x Fonseca ${br(ent.fon.corte)} (${ent.fon.nome})`
    fs.writeFileSync(path.join(saida, 'previa.md'), [`# Prévia da rotina semanal · PARADA`, '', ...ultima.map((l) => `- ${l}`), '', `## BLOQUEIOS (1)`, `- ✗ ${msg}`, '',
      'Peça ao financeiro os dois relatórios com a mesma data de corte. Nada foi lido nem gravado.'].join('\n'))
    throw new Error(`${msg}. Nada foi gravado (prévia em automacao/${SAIDA_BASE}/${maior}/previa.md).`)
  }
  const corte = ent.corte, mesCorte = corte.slice(0, 7)
  const saidaRel = `${SAIDA_BASE}/${corte}`
  const saida = path.join(AUTOMACAO, saidaRel)
  fs.mkdirSync(saida, { recursive: true })
  const ocDir = montarOcs(ent, saida)
  const bloqueios = [], avisos = [...ent.avisos]

  // 1. leitura dos relatórios (semana_info.py)
  const inf = py(['semana_info.py', '--fonseca', ent.fonseca, '--dinamica', ent.dinamica, '--oc', ocDir])
  if (!inf.ok) throw new Error(`semana_info.py falhou:\n${inf.saida}`)
  const info = JSON.parse(inf.stdout.trim().split(/\r?\n/).pop())
  const pagosAte = info.titulos.filter((t) => t.baixa <= corte)
  const depoisCorte = info.titulos.filter((t) => t.baixa > corte)
  const baixaMin = pagosAte.length ? pagosAte.map((t) => t.baixa).sort()[0] : null
  // os relatórios são ACUMULADOS (Rafael 19/10/2026): um que parece só da semana não entra
  if (baixaMin != null && baixaMin > addDias(corte, -DIAS_SEMANAL))
    bloqueios.push(`o relatório parece SÓ DA SEMANA (1º pagamento em ${br(baixaMin)}); a regra é relatório ACUMULADO — peça o acumulado ao financeiro`)
  const meses = [...new Set(pagosAte.map((t) => t.mes))].filter((m) => m <= mesCorte).sort()
  info.duas_fontes.forEach((d) => bloqueios.push(`mesma chave nas duas fontes: ${d.fornecedor} ${d.documento} — ` +
    d.fontes.map((f) => `${f.fonte} ${fmt(f.valor)} em ${br(f.baixa)}`).join(' x ')))
  // Dinâmica: só o rateio do Sirius; valor cheio da nota PARA (Rafael 19/10/2026)
  info.rateio_cheio.forEach((x) => bloqueios.push(`Dinâmica com VALOR CHEIO, não o rateio do Sirius: ${x.fornecedor} ${x.documento} (ref ${x.ref}) — Sirius ${fmt(x.sirius)}, outras obras ${fmt(x.outras_obras)}, valor do título ${fmt(x.valor_titulo)}`))
  if (!info.outras_obras_no_relatorio) avisos.push('o relatório da Dinâmica só tem linhas do Sirius: não dá para conferir o rateio contra as outras obras (confira se a coluna usada é VALOR_RATEIO)')
  // relatório só de pagos (nenhuma linha em aberto): o contas a pagar dessa fonte não é refeito por ele
  const soPagos = ['Fonseca', 'Dinâmica'].filter((f) => info.linhas[f] > 0 && info.abertos[f] === 0)

  // 2. classificador por mês, com a data de corte
  const novas = [], pend = [], nao = []
  for (const m of meses) {
    const dirM = path.join(saida, m)
    const c = py(['classificador.py', '--competencia', m, '--completo', '--fonseca', ent.fonseca, '--dinamica', ent.dinamica,
      '--oc', ocDir, '--saida', dirM, '--corte', corte])
    fs.writeFileSync(path.join(saida, `classificador_${m}.log`), c.saida)
    if (!c.ok) throw new Error(`classificador ${m} falhou (log em automacao/${saidaRel}/classificador_${m}.log):\n${c.saida.slice(-1500)}`)
    novas.push(...lerCsv(path.join(dirM, 'lancamentos.csv')).map((l) => ({ ...l, mes: m })))
    pend.push(...lerCsv(path.join(dirM, 'pendencias.csv')).map((l) => ({ ...l, mes: m })))
    nao.push(...lerCsv(path.join(dirM, 'nao_custo.csv')).map((l) => ({ ...l, mes: m })))
  }

  // 3. banco (só leitura)
  const banco = await todos(() => db.from('custos_lancamentos').select('*').eq('obra_id', OBRA).order('id'))
  const orc = await todos(() => db.from('orcamento_planejado').select('codigo_eap, grupo_num, grupo_nome').eq('obra_id', OBRA))
  const nomeGrupo = { 19: 'Custos indiretos' }
  orc.forEach((o) => { if (o.grupo_num && !nomeGrupo[o.grupo_num]) nomeGrupo[o.grupo_num] = o.grupo_nome })
  const mesDe = (l) => txt(l.competencia).slice(0, 7)
  const deCarga = banco.filter((l) => l.importacao_id || DE_CARGA.has(txt(l.lancado_por)))
  const protegidos = banco.filter((l) => txt(l.lancado_por) === PROTEGIDO)
  const outros = banco.filter((l) => !deCarga.includes(l) && !protegidos.includes(l))

  // 4. comparação pela chave do título
  const agrupa = (ls, chaveDe, mesDeLinha) => {
    const g = new Map()
    ls.forEach((l) => {
      const k = chaveDe(l)
      if (!g.has(k)) g.set(k, { chave: k, valor: 0, eaps: {}, linhas: [], mes: mesDeLinha(l), fornecedor: txt(l.fornecedor), documento: txt(l.documento || l.num_documento) })
      const x = g.get(k)
      x.valor = r2(x.valor + Number(l.valor))
      const e = txt(l.codigo_eap) || '(pendente)'
      x.eaps[e] = r2((x.eaps[e] || 0) + Number(l.valor))
      x.linhas.push(l)
    })
    return g
  }
  const gNovo = agrupa([...novas, ...pend], chaveCsv, (l) => l.mes)
  const minMes = meses[0] || mesCorte
  // acumulado: compara os meses cobertos pelo relatório (do 1º mês com pagamento até o mês do corte)
  const bancoCoberto = deCarga.filter((l) => mesDe(l) >= minMes && mesDe(l) <= mesCorte)
  const gBanco = agrupa(bancoCoberto, chaveBanco, mesDe)
  const gBancoTodo = agrupa(deCarga, chaveBanco, mesDe)
  const naoPorChave = new Map(nao.map((l) => [chaveCsv(l), l]))
  const novos = [], mudou = [], reclass = [], sumiu = []
  gNovo.forEach((x, k) => {
    const b = gBanco.get(k) || gBancoTodo.get(k)
    if (!b) return novos.push(x)
    if (Math.abs(b.valor - x.valor) >= 0.005) return mudou.push({ novo: x, banco: b })
    const ea = JSON.stringify(Object.entries(b.eaps).sort()), eb = JSON.stringify(Object.entries(x.eaps).sort())
    if (ea !== eb) reclass.push({ novo: x, banco: b })
  })
  gBanco.forEach((b, k) => { if (!gNovo.has(k)) sumiu.push({ ...b, nao_custo: naoPorChave.get(k) || null }) })
  novos.filter((x) => x.linhas.some((l) => !txt(l.codigo_eap))).forEach((x) => (x.pendente = true))
  sumiu.forEach((b) => bloqueios.push(`título pago que sumiu do relatório novo: ${b.fornecedor} ${b.documento} ${fmt(b.valor)} (${b.mes})` +
    (b.nao_custo ? ` — no relatório novo ele é não custo: ${txt(b.nao_custo.tipo)}` : '')))
  mudou.forEach(({ novo, banco: b }) => bloqueios.push(`valor de título já pago mudou: ${novo.fornecedor} ${novo.documento} ${fmt(b.valor)} → ${fmt(novo.valor)}`))

  // mês fechado (antes do mês do corte): total do banco x total novo, explicado título a título
  const porMes = {}
  const mesesBanco = [...new Set([...meses, ...bancoCoberto.map(mesDe)])].sort()
  mesesBanco.forEach((m) => {
    const tb = soma(bancoCoberto.filter((l) => mesDe(l) === m)), tn = soma(novas.filter((l) => l.mes === m))
    const expl = r2(soma(novos.filter((x) => x.mes === m && !x.pendente)) - soma(sumiu.filter((x) => x.mes === m))
      + mudou.filter((x) => x.novo.mes === m).reduce((t, x) => t + x.novo.valor - x.banco.valor, 0))
    porMes[m] = { banco: tb, novo: tn, explicado: expl }
    if (m < mesCorte && Math.abs(tn - tb - expl) > 0.01)
      bloqueios.push(`mês fechado ${m}: total mudou ${fmt(tb)} → ${fmt(tn)} e ${fmt(r2(tn - tb - expl))} não se explicam título a título`)
    else if (m < mesCorte && Math.abs(tn - tb) > 0.01)
      avisos.push(`mês fechado ${m}: total muda ${fmt(tb)} → ${fmt(tn)} (explicado pelos títulos listados)`)
  })
  // título JÁ GRAVADO (carga, histórico manual ou tela) que entraria de novo com OUTRA chave (outra fonte ou outra data
  // de baixa): mesmo CNPJ + documento com a parcela = BLOQUEIO (Rafael 19/10/2026)
  const gravadoPorTitulo = new Map()
  banco.filter((p) => txt(p.num_documento)).forEach((p) => {
    const k = chaveTitulo(p.cnpj, p.fornecedor, p.num_documento)
    gravadoPorTitulo.set(k, [...(gravadoPorTitulo.get(k) || []), p])
  })
  novos.forEach((x) => {
    const l = x.linhas[0]
    if (!txt(l.documento)) return
    const ps = gravadoPorTitulo.get(chaveTitulo(l.cnpj, l.fornecedor, l.documento)) || []
    const ids = [...new Set(ps.map((p) => p.id))]
    if (ids.length) bloqueios.push(`título já gravado entraria de novo com outra chave: ${x.fornecedor} ${x.documento} ${fmt(x.valor)} (${l.fonte}, baixa ${br(l.competencia)}) — no banco: ` +
      [...new Set(ps.map((p) => `${txt(p.fonte) || '—'} baixa ${br(baixaDoBanco(p))}${txt(p.lancado_por) === PROTEGIDO ? ' (histórico manual)' : ''}`))].join('; ') + ` (id ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '…' : ''})`)
  })

  // 5. contas a pagar na data de corte
  const cp = py(['contas_a_pagar.py', '--corte', corte, '--fonseca', ent.fonseca, '--dinamica', ent.dinamica, '--oc', ocDir, '--saida', saidaRel])
  fs.writeFileSync(path.join(saida, 'contas_a_pagar.log'), cp.saida)
  if (!cp.ok) throw new Error(`contas_a_pagar.py falhou (log em automacao/${saidaRel}/contas_a_pagar.log):\n${cp.saida.slice(-1500)}`)
  const arqContas = path.join(saida, `contas_${corte}.csv`)
  let contas = lerCsv(arqContas)
  const titulosContas = (ls, doc) => {
    const g = new Map()
    ls.forEach((l) => { const k = chaveTitulo(l.cnpj, l.fornecedor, l[doc]); const x = g.get(k) || { k, fornecedor: l.fornecedor, documento: l[doc], vencimento: l.vencimento || l.data_vencimento, valor: 0 }; x.valor = r2(x.valor + Number(l.valor)); g.set(k, x) })
    return g
  }
  let cAnt = new Map(), fechAnt = null, linhasAnt = []
  const tab = await db.from('contas_a_pagar').select('competencia_fechamento').eq('obra_id', OBRA).limit(10000)
  if (!tab.error) {
    const fimDe = (f) => (f.length === 10 ? f : new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7), 0)).toISOString().slice(0, 10))
    const fs_ = [...new Set((tab.data || []).map((x) => x.competencia_fechamento))].filter((f) => fimDe(f) <= corte).sort((a, b) => fimDe(a).localeCompare(fimDe(b)))
    fechAnt = fs_.length ? fs_[fs_.length - 1] : null
    if (fechAnt) linhasAnt = await todos(() => db.from('contas_a_pagar').select('*').eq('obra_id', OBRA).eq('competencia_fechamento', fechAnt).order('id'))
    cAnt = titulosContas(linhasAnt, 'num_documento')
  } else avisos.push('tabela contas_a_pagar não lida: ' + tab.error.message)
  const pagoTit = new Set([...gNovo.values()].map((x) => chaveTitulo(x.linhas[0].cnpj, x.linhas[0].fornecedor, x.linhas[0].documento)))
  deCarga.concat(protegidos, outros).forEach((l) => pagoTit.add(chaveTitulo(l.cnpj, l.fornecedor, l.num_documento)))
  // fonte com relatório SÓ DE PAGOS: o a pagar dela NÃO é refeito por ele (Rafael 19/10/2026) — fica a lista do corte
  // anterior menos os títulos que agora aparecem pagos até o corte
  const tiradosPagos = []
  if (soPagos.length) {
    const fontesSo = new Set(soPagos.map(fonteNorm))
    if (!fechAnt) bloqueios.push(`relatório só de pagos (${soPagos.join(', ')}) e nenhum contas a pagar anterior no banco para manter`)
    const herdadas = linhasAnt.filter((l) => fontesSo.has(fonteNorm(l.fonte))).filter((l) => {
      const pago = pagoTit.has(chaveTitulo(l.cnpj, l.fornecedor, l.num_documento))
      if (pago) tiradosPagos.push(l)
      return !pago
    }).map((l) => ({
      competencia_fechamento: corte, competencia_vencimento: l.competencia_vencimento, fonte: l.fonte, cnpj: l.cnpj || '',
      fornecedor: l.fornecedor, documento: l.num_documento, parcela: l.parcela || '', seq: l.seq, historico: l.historico || '',
      item: l.item || '', oc: l.oc || '', emissao: l.data_emissao || '', vencimento: l.data_vencimento || '', valor_titulo: l.valor_titulo,
      valor: l.valor, eap: l.codigo_eap || '', classe: l.classe, natureza: l.natureza, recorrente: l.recorrente ? 'sim' : '',
      vinculo_oc: l.vinculo_oc || '', regra: l.regra || '', alertas: (l.alertas || []).join(' | '), pavimento: l.pavimento || '',
    }))
    contas = [...contas.filter((l) => !fontesSo.has(fonteNorm(l.fonte))), ...herdadas]
    const cols = ['competencia_fechamento', 'competencia_vencimento', 'fonte', 'cnpj', 'fornecedor', 'documento', 'parcela', 'seq',
      'historico', 'item', 'oc', 'emissao', 'vencimento', 'valor_titulo', 'valor', 'eap', 'classe', 'natureza',
      'recorrente', 'vinculo_oc', 'regra', 'alertas', 'pavimento']
    const q = (v) => { const t = v == null ? '' : String(v); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
    fs.writeFileSync(arqContas, '﻿' + [cols.join(','), ...contas.map((l) => cols.map((c) => q(l[c])).join(','))].join('\n') + '\n')
    fs.writeFileSync(path.join(saida, `contas_${corte}_resumo.json`), JSON.stringify({ fechamento: corte, linhas: contas.length,
      titulos: new Set(contas.map((l) => chaveTitulo(l.cnpj, l.fornecedor, l.documento))).size, total: soma(contas), so_pagos: soPagos, de: fechAnt }))
  }
  const cNovo = titulosContas(contas, 'documento')
  const cEntram = [...cNovo.values()].filter((x) => !cAnt.has(x.k))
  const cContinuam = [...cNovo.values()].filter((x) => cAnt.has(x.k))
  const cSaem = [...cAnt.values()].filter((x) => !cNovo.has(x.k)).map((x) => ({ ...x, pago: pagoTit.has(x.k) }))
  ;[...cNovo.values()].filter((x) => pagoTit.has(x.k) && pagosAte.some((t) => chaveTitulo(t.cnpj, t.fornecedor, t.documento) === x.k))
    .forEach((x) => bloqueios.push(`título no a pagar E no custo até o corte: ${x.fornecedor} ${x.documento} ${fmt(x.valor)}`))

  // 6. trava do importar.js nos meses que vão ser gravados (prévia dele: só lê o banco)
  const mesesGravar = [...new Set([...novos.map((x) => x.mes), ...mudou.map((x) => x.novo.mes), ...reclass.map((x) => x.novo.mes), ...sumiu.map((x) => x.mes)])].sort()
  const chavesNovas = novos.filter((x) => !x.pendente).map((x) => x.chave)
  fs.writeFileSync(path.join(saida, 'chaves_novas.json'), JSON.stringify(chavesNovas))
  const travasImportar = []
  for (const m of mesesGravar) {
    const a = ['--competencia', m, '--saida', saidaRel]
    const r = importar(a)
    fs.writeFileSync(path.join(saida, `importar_${m}.log`), r.saida)
    r.saida.split(/\r?\n/).filter((l) => /✗/.test(l)).forEach((l) => travasImportar.push(`${m}: ${l.replace(/^\s*✗\s*/, '')}`))
    if (!r.ok && !/✗/.test(r.saida)) travasImportar.push(`${m}: importar.js falhou — ${r.saida.trim().split(/\r?\n/).pop()}`)
  }
  const rc = importar(['--contas', '--fechamento', corte, '--saida', saidaRel])
  fs.writeFileSync(path.join(saida, 'importar_contas.log'), rc.saida)
  rc.saida.split(/\r?\n/).filter((l) => /✗/.test(l)).forEach((l) => travasImportar.push(`contas: ${l.replace(/^\s*✗\s*/, '')}`))

  // 7. NF ↔ OC
  const mat = info.oc.vinculos.filter((x) => x.fonte === 'Dinâmica' && x.baixa <= corte)
  const ligado = soma(mat.filter((x) => x.oc)), totMat = soma(mat)

  // 7b. vales da Sericita do mês: proposta provisória pela medição x o que está no decisoes_pontuais.csv
  const pv = await propostaVales(db, corte, info.titulos)
  fs.writeFileSync(path.join(saida, `vales_${pv.mes}.csv`), '﻿' + pv.csv)
  const dec = lerCsv(path.join(AUTOMACAO, 'decisoes_pontuais.csv'))
  pv.vales.forEach((v) => {
    const atual = dec.filter((d) => d.cnpj === SERICITA && d.documento === v.documento)
    const igual = atual.length === pv.linhas.filter((l) => l.proporcao > 0).length &&
      pv.linhas.filter((l) => l.proporcao > 0).every((l) => atual.some((d) => d.eap === l.codigo_eap && Math.abs(Number(d.proporcao) - l.proporcao) < 1e-6))
    v.situacao = !atual.length ? 'sem rateio no decisoes_pontuais.csv' : igual ? 'igual à proposta' : 'DIFERENTE da proposta (atualizar o decisoes_pontuais.csv)'
    if (!igual) avisos.push(`vale da Sericita ${v.documento} ${fmt(v.valor)}: ${v.situacao} — proposta em automacao/${saidaRel}/vales_${pv.mes}.csv`)
  })

  const est = { corte, soPagos, meses, mesesGravar, chavesNovas: chavesNovas.length, bloqueios: [...bloqueios], travasImportar,
    pendencias: pend.length, novos: novos.length, gerado: new Date().toISOString() }
  fs.writeFileSync(path.join(saida, 'estado.json'), JSON.stringify(est, null, 1))

  // 8. relatório
  const L = []
  const p = (s = '') => L.push(s)
  p(`# Prévia da rotina semanal · corte ${br(corte)}`)
  p()
  p('## Última carga gravada (antes desta prévia)')
  ultima.forEach((l) => p(`- ${l}`))
  p()
  p(`- Pastas: ${ent.base === ENTRADA ? 'automacao/entrada/' : ent.base} dinamica/ e fonseca/ · relatórios (os mais novos): ${path.basename(ent.fonseca)} | ${path.basename(ent.dinamica)}` +
    ` · ${ent.fon.historico + ent.din.historico} antigo(s) mantido(s) como histórico | OC: automacao/oc`)
  p(`- Tipo: ACUMULADO desde ${minMes} (pagamentos de ${br(baixaMin)} a ${br(corte)}): substitui os meses com diferença`)
  p(`- Linhas lidas: Fonseca ${info.linhas.Fonseca} (${info.pagos.Fonseca} pagas) · Dinâmica ${info.linhas['Dinâmica']} (${info.pagos['Dinâmica']} pagas) · títulos pagos até o corte: ${pagosAte.length}`)
  if (depoisCorte.length) p(`- Pagos DEPOIS do corte (ficam para a próxima carga; no a pagar deste corte): ${depoisCorte.map((t) => `${t.fornecedor} ${t.documento} ${fmt(t.valor)} em ${br(t.baixa)}`).join('; ')}`)
  p()
  p(`## Custo NOVO desde a última carga: ${fmt(soma(novos.filter((x) => !x.pendente)))} (${novos.filter((x) => !x.pendente).length} título(s))`)
  const porMesGrupo = {}
  novos.filter((x) => !x.pendente).forEach((x) => x.linhas.forEach((l) => {
    const g = Number(String(l.codigo_eap).split('.')[0]); const k = `${x.mes} · ${g} ${nomeGrupo[g] || ''}`.trim()
    porMesGrupo[k] = r2((porMesGrupo[k] || 0) + Number(l.valor))
  }))
  Object.entries(porMesGrupo).sort().forEach(([k, val]) => p(`- ${k}: ${fmt(val)}`))
  novos.filter((x) => !x.pendente).forEach((x) => p(`  - ${x.mes} · ${x.fornecedor} ${x.documento} ${fmt(x.valor)} → ${Object.entries(x.eaps).map(([e, val]) => `${e} ${fmt(val)}`).join(' + ')}`))
  if (reclass.length) {
    p(); p(`## Mesmo título, EAP diferente da carga anterior (${reclass.length}; o mês é recarregado)`)
    reclass.forEach(({ novo, banco: b }) => p(`- ${novo.fornecedor} ${novo.documento} ${fmt(novo.valor)}: ${Object.keys(b.eaps).join(' + ')} → ${Object.keys(novo.eaps).join(' + ')}`))
  }
  p(); p('## Total por mês (banco → novo)')
  Object.entries(porMes).forEach(([m, x]) => p(`- ${m}: ${fmt(x.banco)} → ${fmt(x.novo)}${m < mesCorte ? ' (mês fechado)' : ''}`))
  p(); p(`## Contas a pagar no corte ${br(corte)}: ${fmt(soma([...cNovo.values()]))} (${cNovo.size} título(s); antes: fechamento ${fechAnt || '—'}, ${fmt(soma([...cAnt.values()]))})`)
  p(`- Novas: ${cEntram.length ? cEntram.map((x) => `${x.fornecedor} ${x.documento} ${fmt(x.valor)} venc. ${br(x.vencimento)}`).join('; ') : 'nenhuma'}`)
  p(`- Saíram: ${cSaem.length ? cSaem.map((x) => `${x.fornecedor} ${x.documento} ${fmt(x.valor)} (${x.pago ? 'paga: entra no custo' : 'sem pagamento: conferir'})`).join('; ') : 'nenhuma'}`)
  p(`- Continuam: ${cContinuam.length ? cContinuam.map((x) => `${x.fornecedor} ${x.documento} ${fmt(x.valor)}`).join('; ') : 'nenhuma'}`)
  if (soPagos.length) p(`- Relatório SÓ DE PAGOS (${soPagos.join(', ')}): o a pagar dessa fonte NÃO foi refeito; ficou o do fechamento ${fechAnt || '—'} menos ${tiradosPagos.length} linha(s) que agora aparecem pagas${tiradosPagos.length ? ': ' + tiradosPagos.map((l) => `${l.fornecedor} ${l.num_documento} ${fmt(l.valor)}`).join('; ') : ''}`)
  p(); p(`## NF ↔ ordem de compra (material da Dinâmica)`)
  p(`- Ligado a OC: ${fmt(ligado)} de ${fmt(totMat)} (${totMat > 0 ? (100 * ligado / totMat).toFixed(1).replace('.', ',') : '0'}%) · chave: nº da NF + CNPJ da OC (ou nº da OC no documento)`)
  p(`- NFs pagas sem OC: ${mat.filter((x) => !x.oc).map((x) => `${x.fornecedor} ${x.documento} ${fmt(x.valor)}`).join('; ') || 'nenhuma'}`)
  p(`- OCs sem NF (compras não faturadas; NÃO são custo nem a pagar): ${info.oc.oc_sem_nf.filter((x) => !['1787', '1849'].includes(String(x.oc))).map((x) => `OC ${x.oc} ${x.fornecedor} ${fmt(x.total)}`).join('; ') || 'nenhuma'}`)
  p(); p(`## Vales da Sericita de ${pv.mes} — rateio PROVISÓRIO até o BM do fim do mês (${pv.origem})`)
  pv.linhas.forEach((l) => p(`- ${l.codigo_eap} ${l.pavimento}: ${l.de.toFixed(2).replace('.', ',')}% → ${l.ate.toFixed(2).replace('.', ',')}% · orçado ${fmt(l.orcado)} · peso ${(100 * l.proporcao).toFixed(2).replace('.', ',')}%`))
  pv.vales.forEach((v) => p(`- vale ${v.documento} ${fmt(v.valor)} (${br(v.baixa)}): ${v.situacao}`))
  if (!pv.vales.length) p('- nenhum vale no mês até o corte')
  p(`- Saiu o BM do mês: refazer TODOS os vales do mês pela composição do BM (CLAUDE.md, seção Sericita).`)
  p(); p(`## PENDÊNCIAS de classificação (${pend.length})`)
  pend.forEach((l) => p(`- ${l.mes} · ${l.fornecedor} ${l.documento} ${fmt(l.valor)} · ${txt(l.regra)}`))
  if (!pend.length) p('- nenhuma')
  p(); p(`## BLOQUEIOS (${bloqueios.length + travasImportar.length})`)
  ;[...bloqueios, ...travasImportar.map((t) => `trava do importar.js — ${t}`)].forEach((b) => p(`- ✗ ${b}`))
  if (!bloqueios.length && !travasImportar.length) p('- nenhum')
  if (avisos.length) { p(); p('## Avisos'); avisos.forEach((a) => p(`- ${a}`)) }
  p(); p(`## O que o --confirmar faria`)
  if (!mesesGravar.length) p('- custo: nada (nenhum título novo, mudado ou reclassificado)')
  else p(`- custo: recarrega ${mesesGravar.join(', ')} (importar.js, com backup e id de carga)`)
  p(`- contas a pagar: grava o fechamento ${corte} (${cNovo.size} título(s)); o site passa a usar este corte nas semanas que terminam a partir de ${br(corte)}`)
  p()
  p('Nada foi gravado. Logs e arquivos da prévia nesta pasta.')
  fs.writeFileSync(path.join(saida, 'previa.md'), L.join('\n'))

  // resumo curto no terminal
  console.log(`\nRotina semanal · corte ${br(corte)} · relatório ACUMULADO desde ${minMes}`)
  console.log(`  lidas: Fonseca ${info.linhas.Fonseca} · Dinâmica ${info.linhas['Dinâmica']} · pagos até o corte ${pagosAte.length}${depoisCorte.length ? ` · ${depoisCorte.length} pago(s) depois do corte (próxima carga)` : ''}`)
  console.log(`  custo NOVO: ${fmt(soma(novos.filter((x) => !x.pendente)))} (${novos.filter((x) => !x.pendente).length} título(s))${reclass.length ? ` · ${reclass.length} reclassificado(s)` : ''}`)
  console.log(`  contas a pagar: ${fmt(soma([...cNovo.values()]))} · novas ${cEntram.length} · saíram ${cSaem.length} (${cSaem.filter((x) => x.pago).length} pagas) · continuam ${cContinuam.length}`)
  console.log(`  NF ↔ OC: ${totMat > 0 ? (100 * ligado / totMat).toFixed(1).replace('.', ',') : '0'}% do material ligado a OC`)
  console.log(`  pendências: ${pend.length} · bloqueios: ${bloqueios.length + travasImportar.length}`)
  ;[...bloqueios, ...travasImportar].forEach((b) => console.log(`    ✗ ${b}`))
  console.log(`  prévia completa: automacao/${saidaRel}/previa.md`)
  return { est, ent, saidaRel, saida, mesesGravar, corte, pend, bloqueios, travasImportar }
}

// ── confirmar ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function confirmar(db) {
  const r = await previa(db)
  if (r.bloqueios.length || r.travasImportar.length) throw new Error('há BLOQUEIOS (✗): nada foi gravado. Decida cada um e rode a prévia de novo.')
  if (r.pend.length && r.mesesGravar.some((m) => r.pend.some((p) => p.mes === m))) throw new Error('há PENDÊNCIAS nos meses a gravar: nada foi gravado.')
  const id = require('crypto').randomUUID()
  const manifesto = { id, corte: r.corte, tipo: 'acumulado', saida: r.saidaRel,
    arquivos: { fonseca: path.basename(r.ent.fonseca), dinamica: path.basename(r.ent.dinamica) }, criado_em: new Date().toISOString(), passos: [] }
  const arqM = path.join(r.saida, `carga_${id}.json`)
  const salvar = () => fs.writeFileSync(arqM, JSON.stringify(manifesto, null, 1))
  salvar()
  const falhou = (msg) => { throw new Error(`${msg}\n  Carga PARCIAL ${id}: o que já foi gravado está em ${path.relative(RAIZ, arqM)}. Desfaça com: node ferramentas/semana/atualizar.js --desfazer ${id} --confirmar`) }
  for (const m of r.mesesGravar) {
    const x = importar(['--competencia', m, '--saida', r.saidaRel, '--confirmar'])
    fs.writeFileSync(path.join(r.saida, `importar_${m}_confirmar.log`), x.saida)
    const imp = (x.saida.match(/importação: ([0-9a-f-]{36})/) || [])[1]
    if (!x.ok || !imp) falhou(`gravar ${m} falhou:\n${x.saida.slice(-800)}`)
    manifesto.passos.push({ tipo: 'custo', competencia: m, importacao_id: imp }); salvar()
    console.log(`  ✓ custo ${m}: importação ${imp}`)
  }
  const c = importar(['--contas', '--fechamento', r.corte, '--saida', r.saidaRel, '--confirmar'])
  fs.writeFileSync(path.join(r.saida, 'importar_contas_confirmar.log'), c.saida)
  const carga = (c.saida.match(/carga ([0-9a-f-]{36})/) || [])[1]
  if (!c.ok || !carga) falhou(`gravar o contas a pagar falhou (rodou supabase/contas/2-fechamento-por-data.sql?):\n${c.saida.slice(-800)}`)
  manifesto.passos.push({ tipo: 'contas', fechamento: r.corte, carga_id: carga }); manifesto.status = 'ok'; salvar()
  console.log(`  ✓ contas a pagar ${r.corte}: carga ${carga}`)
  console.log(`\n  ✓ CARGA SEMANAL ${id} gravada. Os dados aparecem no site sem deploy.`)
  console.log(`  Para desfazer: node ferramentas/semana/atualizar.js --desfazer ${id} --confirmar\n`)
}

// ── desfazer ────────────────────────────────────────────────────────────────────────────────────────────────────────
function desfazer() {
  const base = path.join(AUTOMACAO, SAIDA_BASE)
  const achado = fs.existsSync(base) && fs.readdirSync(base).map((d) => path.join(base, d, `carga_${DESFAZER}.json`)).find((f) => fs.existsSync(f))
  if (!achado) throw new Error(`carga ${DESFAZER} não encontrada em automacao/${SAIDA_BASE}/*/`)
  const man = JSON.parse(fs.readFileSync(achado, 'utf8'))
  if (man.status === 'desfeita') throw new Error(`a carga ${DESFAZER} já foi desfeita em ${man.desfeita_em}`)
  console.log(`\nDesfazer carga semanal ${DESFAZER} · corte ${br(man.corte)} · ${man.passos.length} passo(s)`)
  for (const p of [...man.passos].reverse()) {
    const a = p.tipo === 'contas' ? ['--contas', '--fechamento', p.fechamento, '--saida', man.saida, '--desfazer', p.carga_id]
      : ['--desfazer', p.importacao_id]
    const x = importar([...a, ...(CONFIRMAR ? ['--confirmar'] : [])])
    console.log(x.saida.trim().split(/\r?\n/).filter((l) => l.trim()).map((l) => '  ' + l).join('\n'))
    if (!x.ok) throw new Error(`desfazer o passo ${p.tipo} ${p.competencia || p.fechamento} falhou; os passos seguintes não foram desfeitos`)
  }
  if (!CONFIRMAR) return console.log('\n  PRÉVIA: nada foi alterado. Para desfazer, rode de novo com --confirmar\n')
  man.status = 'desfeita'; man.desfeita_em = new Date().toISOString()
  fs.writeFileSync(achado, JSON.stringify(man, null, 1))
  console.log(`\n  ✓ carga ${DESFAZER} desfeita.\n`)
}

async function main() {
  if (DESFAZER) return desfazer()
  const env = lerEnv()
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SECRET_KEY no .env.local')
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
  if (ULTIMA) return console.log('\n' + (await ultimaCarga(db)).join('\n') + '\n\n  Só leitura: nada foi gravado.\n')
  if (CONFIRMAR) return confirmar(db)
  await previa(db)
  console.log('\n  PRÉVIA: nada foi gravado. Para gravar: node ferramentas/semana/atualizar.js --confirmar\n')
}

main().catch((e) => { console.error(`\nERRO: ${e.message}\n`); process.exit(1) })
