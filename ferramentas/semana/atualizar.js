// ferramentas/semana/atualizar.js — ROTINA SEMANAL de custos + contas a pagar, sem duplicidade (pedido 15, Rafael 09/10/2026)
//
//   node ferramentas/semana/atualizar.js                     PRÉVIA (nada gravado) da pasta mais nova de automacao/entrada/AAAA-MM-DD
//   node ferramentas/semana/atualizar.js --confirmar         grava (cada mês pelo importar.js, com backup e id de carga)
//   node ferramentas/semana/atualizar.js --desfazer <id>     prévia do desfazer; com --confirmar, desfaz
//   --pasta <dir>  usa outra pasta de entrada (testes); o nome da pasta é a DATA DE CORTE (AAAA-MM-DD)
//
// Só orquestra o que já existe (não repete a lógica): automacao/classificador.py (--completo --corte), automacao/
// contas_a_pagar.py (--corte), automacao/semana_info.py (leitura dos relatórios e NF ↔ OC) e ferramentas/fechamento/
// importar.js (gravação, backup e desfazer de cada mês e do contas a pagar).
//
// Regra anti-duplicidade (CLAUDE.md, pedido 15):
//   - CHAVE DO TÍTULO = fonte + CNPJ + documento (com a parcela) + data de baixa (ferramentas/semana/chave.js).
//   - Relatório ACUMULADO: a carga substitui os meses cobertos (importar.js), nunca soma por cima. Relatório SÓ DA
//     SEMANA: entra pela chave (importar.js --apenas: insere o que é novo, ignora o que já existe, nada sai).
//   - Histórico manual protegido (lancado_por = 'Rafael') nunca é tocado (o importar.js só tira linhas de carga).
//   - BLOQUEIAM a carga: mesma chave nas duas fontes; título pago que sumiu do relatório novo; valor de título já
//     pago que mudou; mês fechado cujo total mudou mais de R$ 0,01 sem explicação; trava do importar.js (✗).
//   - Contas a pagar: fechamento = DATA DE CORTE; a lista é refeita inteira a cada corte; pago depois do corte fica no
//     a pagar e entra no custo da próxima carga — nunca nos dois.
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { createClient } = require('@supabase/supabase-js')
const { chaveCsv, chaveBanco, chaveTitulo, baixaDoBanco } = require('./chave')

const OBRA = 'sirius60'
const RAIZ = path.join(__dirname, '..', '..')
const AUTOMACAO = path.join(RAIZ, 'automacao')
const ENTRADA = path.join(AUTOMACAO, 'entrada')
const SAIDA_BASE = 'saida_semana'
const IMPORTAR = path.join(RAIZ, 'ferramentas', 'fechamento', 'importar.js')
const PROTEGIDO = 'Rafael'
const DE_CARGA = new Set(['importacao', 'carga planilha'])
const DIAS_SEMANAL = 10 // relatório cujos pagamentos cabem nos últimos 10 dias até o corte = "só da semana"

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null }
const CONFIRMAR = args.includes('--confirmar')
const DESFAZER = arg('--desfazer')
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

// ── pasta da semana ─────────────────────────────────────────────────────────────────────────────────────────────────
function acharPasta() {
  let dir = PASTA ? path.resolve(PASTA) : null
  if (!dir) {
    const ds = fs.existsSync(ENTRADA) ? fs.readdirSync(ENTRADA).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : []
    if (!ds.length) throw new Error('nenhuma pasta automacao/entrada/AAAA-MM-DD (salve ali os 2 relatórios da semana)')
    dir = path.join(ENTRADA, ds[ds.length - 1])
  }
  const corte = path.basename(dir)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corte)) throw new Error(`o nome da pasta tem de ser a data de corte AAAA-MM-DD (${dir})`)
  const arqs = fs.readdirSync(dir).filter((f) => /\.xlsx?$/i.test(f) && !f.startsWith('~$'))
  // fonte pelo CONTEÚDO (cabeçalho), não pelo nome (13/10: "Fonseca pago acumulado até …", "Dinamica pago …"):
  // Dinâmica = layout da consulta (VALOR_RATEIO + CENTROCUSTO_RATEIO); Fonseca = TOTVS (Nome + Valor Baixado + CNPJ/CPF)
  const ocs = arqs.filter((f) => /ordem de compra/i.test(f)).map((f) => path.join(dir, f))
  const cand = arqs.filter((f) => !/ordem de compra/i.test(f))
  const cab = rodar('py', ['-I', '-c', 'import sys,json,openpyxl\nout={}\nfor f in sys.argv[1:]:\n wb=openpyxl.load_workbook(f,read_only=True)\n out[f]=[str(c).strip() for c in next(wb.worksheets[0].iter_rows(max_row=1,values_only=True)) if c is not None]\nprint(json.dumps(out))',
    ...cand.map((f) => path.join(dir, f))])
  if (!cab.ok) throw new Error(`não consegui ler o cabeçalho dos relatórios:\n${cab.saida}`)
  const cols = JSON.parse(cab.stdout.trim().split(/\r?\n/).pop())
  const tipo = (f) => {
    const c = new Set((cols[path.join(dir, f)] || []).map((x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()))
    if (c.has('valor_rateio') && c.has('centrocusto_rateio')) return 'dinamica'
    if (c.has('nome') && c.has('valor baixado') && c.has('cnpj/cpf')) return 'fonseca'
    return null
  }
  const um = (t, nome) => {
    const xs = cand.filter((f) => tipo(f) === t)
    if (xs.length !== 1) throw new Error(`${nome}: esperado 1 arquivo em ${dir} (pelo cabeçalho), achei ${xs.length} (${xs.join(', ') || 'nenhum'})`)
    return path.join(dir, xs[0])
  }
  const fonseca = um('fonseca', 'Relatório da Fonseca e Lage (Nome, Valor Baixado, CNPJ/CPF)')
  const dinamica = um('dinamica', 'Relatório da Dinâmica (VALOR_RATEIO, CENTROCUSTO_RATEIO)')
  // "Até DD-MM-AA" (ou "Até MM-AA" = último dia do mês) no nome do arquivo x nome da pasta
  const avisos = []
  for (const f of [fonseca, dinamica]) {
    const m = path.basename(f).match(/At[eé]\s*(\d{2})-(\d{2})(?:-(\d{2}))?/i)
    if (!m) { avisos.push(`${path.basename(f)}: sem "Até ..." no nome`); continue }
    const data = m[3] ? `20${m[3]}-${m[2]}-${m[1]}`
      : (() => { const a = 2000 + Number(m[2]), mm = Number(m[1]); return new Date(Date.UTC(a, mm, 0)).toISOString().slice(0, 10) })()
    if (data !== corte) avisos.push(`${path.basename(f)} diz "Até ${br(data)}", a pasta diz ${br(corte)} (vale a pasta)`)
  }
  return { dir, corte, fonseca, dinamica, ocs, avisos }
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

// ── prévia ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function previa(db) {
  const ent = acharPasta()
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
  const semanal = baixaMin != null && baixaMin > addDias(corte, -DIAS_SEMANAL)
  const meses = [...new Set(pagosAte.map((t) => t.mes))].filter((m) => m <= mesCorte).sort()
  info.duas_fontes.forEach((d) => bloqueios.push(`mesma chave nas duas fontes: ${d.fornecedor} ${d.documento} — ` +
    d.fontes.map((f) => `${f.fonte} ${fmt(f.valor)} em ${br(f.baixa)}`).join(' x ')))

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
  const gBanco = agrupa(semanal ? deCarga : bancoCoberto, chaveBanco, mesDe)
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
  if (!semanal) gBanco.forEach((b, k) => { if (!gNovo.has(k)) sumiu.push({ ...b, nao_custo: naoPorChave.get(k) || null }) })
  novos.filter((x) => x.linhas.some((l) => !txt(l.codigo_eap))).forEach((x) => (x.pendente = true))
  sumiu.forEach((b) => bloqueios.push(`título pago que sumiu do relatório novo: ${b.fornecedor} ${b.documento} ${fmt(b.valor)} (${b.mes})` +
    (b.nao_custo ? ` — no relatório novo ele é não custo: ${txt(b.nao_custo.tipo)}` : '')))
  mudou.forEach(({ novo, banco: b }) => bloqueios.push(`valor de título já pago mudou: ${novo.fornecedor} ${novo.documento} ${fmt(b.valor)} → ${fmt(novo.valor)}`))

  // mês fechado (antes do mês do corte): total do banco x total novo, explicado título a título
  const porMes = {}
  const mesesBanco = [...new Set([...meses, ...(semanal ? [] : bancoCoberto.map(mesDe))])].sort()
  mesesBanco.forEach((m) => {
    const tb = soma(bancoCoberto.filter((l) => mesDe(l) === m)), tn = soma(novas.filter((l) => l.mes === m))
    const expl = r2(soma(novos.filter((x) => x.mes === m && !x.pendente)) - soma(sumiu.filter((x) => x.mes === m))
      + mudou.filter((x) => x.novo.mes === m).reduce((t, x) => t + x.novo.valor - x.banco.valor, 0))
    porMes[m] = { banco: tb, novo: tn, explicado: expl }
    if (!semanal && m < mesCorte && Math.abs(tn - tb - expl) > 0.01)
      bloqueios.push(`mês fechado ${m}: total mudou ${fmt(tb)} → ${fmt(tn)} e ${fmt(r2(tn - tb - expl))} não se explicam título a título`)
    else if (m < mesCorte && Math.abs(tn - tb) > 0.01)
      avisos.push(`mês fechado ${m}: total muda ${fmt(tb)} → ${fmt(tn)} (explicado pelos títulos listados)`)
  })
  // histórico manual e lançamentos da tela: avisa se um título novo parece repetir um deles
  ;[...protegidos, ...outros].forEach((p) => novos.forEach((x) => {
    const l = x.linhas[0]
    if (chaveTitulo(p.cnpj, p.fornecedor, p.num_documento) === chaveTitulo(l.cnpj, l.fornecedor, l.documento) && txt(p.num_documento))
      avisos.push(`título novo ${x.documento} ${fmt(x.valor)} tem o mesmo documento de um lançamento ${txt(p.lancado_por) === PROTEGIDO ? 'do histórico manual (protegido)' : 'da tela'} id ${p.id}`)
  }))

  // 5. contas a pagar na data de corte
  const cp = py(['contas_a_pagar.py', '--corte', corte, '--fonseca', ent.fonseca, '--dinamica', ent.dinamica, '--oc', ocDir, '--saida', saidaRel])
  fs.writeFileSync(path.join(saida, 'contas_a_pagar.log'), cp.saida)
  if (!cp.ok) throw new Error(`contas_a_pagar.py falhou (log em automacao/${saidaRel}/contas_a_pagar.log):\n${cp.saida.slice(-1500)}`)
  const contas = lerCsv(path.join(saida, `contas_${corte}.csv`))
  const titulosContas = (ls, doc) => {
    const g = new Map()
    ls.forEach((l) => { const k = chaveTitulo(l.cnpj, l.fornecedor, l[doc]); const x = g.get(k) || { k, fornecedor: l.fornecedor, documento: l[doc], vencimento: l.vencimento || l.data_vencimento, valor: 0 }; x.valor = r2(x.valor + Number(l.valor)); g.set(k, x) })
    return g
  }
  const cNovo = titulosContas(contas, 'documento')
  let cAnt = new Map(), fechAnt = null
  const tab = await db.from('contas_a_pagar').select('competencia_fechamento').eq('obra_id', OBRA).limit(10000)
  if (!tab.error) {
    const fimDe = (f) => (f.length === 10 ? f : new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7), 0)).toISOString().slice(0, 10))
    const fs_ = [...new Set((tab.data || []).map((x) => x.competencia_fechamento))].filter((f) => fimDe(f) <= corte).sort((a, b) => fimDe(a).localeCompare(fimDe(b)))
    fechAnt = fs_.length ? fs_[fs_.length - 1] : null
    if (fechAnt) cAnt = titulosContas(await todos(() => db.from('contas_a_pagar').select('*').eq('obra_id', OBRA).eq('competencia_fechamento', fechAnt)), 'num_documento')
  } else avisos.push('tabela contas_a_pagar não lida: ' + tab.error.message)
  const pagoTit = new Set([...gNovo.values()].map((x) => chaveTitulo(x.linhas[0].cnpj, x.linhas[0].fornecedor, x.linhas[0].documento)))
  deCarga.concat(protegidos, outros).forEach((l) => pagoTit.add(chaveTitulo(l.cnpj, l.fornecedor, l.num_documento)))
  const cEntram = [...cNovo.values()].filter((x) => !cAnt.has(x.k))
  const cContinuam = [...cNovo.values()].filter((x) => cAnt.has(x.k))
  const cSaem = [...cAnt.values()].filter((x) => !cNovo.has(x.k)).map((x) => ({ ...x, pago: pagoTit.has(x.k) }))
  ;[...cNovo.values()].filter((x) => pagoTit.has(x.k) && pagosAte.some((t) => chaveTitulo(t.cnpj, t.fornecedor, t.documento) === x.k))
    .forEach((x) => bloqueios.push(`título no a pagar E no custo até o corte: ${x.fornecedor} ${x.documento} ${fmt(x.valor)}`))

  // 6. trava do importar.js nos meses que vão ser gravados (prévia dele: só lê o banco)
  const mesesGravar = semanal ? [...new Set(novos.map((x) => x.mes))].sort()
    : [...new Set([...novos.map((x) => x.mes), ...mudou.map((x) => x.novo.mes), ...reclass.map((x) => x.novo.mes), ...sumiu.map((x) => x.mes)])].sort()
  const chavesNovas = novos.filter((x) => !x.pendente).map((x) => x.chave)
  fs.writeFileSync(path.join(saida, 'chaves_novas.json'), JSON.stringify(chavesNovas))
  const travasImportar = []
  for (const m of mesesGravar) {
    const a = ['--competencia', m, '--saida', saidaRel, ...(semanal ? ['--apenas', path.join(saida, 'chaves_novas.json')] : [])]
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

  const est = { corte, semanal, meses, mesesGravar, chavesNovas: chavesNovas.length, bloqueios: [...bloqueios], travasImportar,
    pendencias: pend.length, novos: novos.length, gerado: new Date().toISOString() }
  fs.writeFileSync(path.join(saida, 'estado.json'), JSON.stringify(est, null, 1))

  // 8. relatório
  const L = []
  const p = (s = '') => L.push(s)
  p(`# Prévia da rotina semanal · corte ${br(corte)}`)
  p()
  p(`- Pasta: ${ent.dir.startsWith(ENTRADA) ? 'automacao/entrada/' + path.basename(ent.dir) : ent.dir} · relatórios: ${path.basename(ent.fonseca)} | ${path.basename(ent.dinamica)}` +
    (ent.ocs.length ? ` | OC: ${ent.ocs.map((f) => path.basename(f)).join(', ')}` : ' | sem relatório de OC na pasta (usa automacao/oc)'))
  p(`- Tipo: ${semanal ? `SÓ DA SEMANA (pagamentos de ${br(baixaMin)} a ${br(corte)}): entra pela chave, nada sai` : `ACUMULADO desde ${minMes} (pagamentos de ${br(baixaMin)} a ${br(corte)}): substitui os meses com diferença`}`)
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
    p(); p(`## Mesmo título, EAP diferente da carga anterior (${reclass.length}; ${semanal ? 'NÃO é aplicado no modo semanal' : 'o mês é recarregado'})`)
    reclass.forEach(({ novo, banco: b }) => p(`- ${novo.fornecedor} ${novo.documento} ${fmt(novo.valor)}: ${Object.keys(b.eaps).join(' + ')} → ${Object.keys(novo.eaps).join(' + ')}`))
  }
  p(); p('## Total por mês (banco → novo)')
  Object.entries(porMes).forEach(([m, x]) => p(`- ${m}: ${fmt(x.banco)} → ${fmt(x.novo)}${m < mesCorte ? ' (mês fechado)' : ''}`))
  p(); p(`## Contas a pagar no corte ${br(corte)}: ${fmt(soma([...cNovo.values()]))} (${cNovo.size} título(s); antes: fechamento ${fechAnt || '—'}, ${fmt(soma([...cAnt.values()]))})`)
  p(`- Novas: ${cEntram.length ? cEntram.map((x) => `${x.fornecedor} ${x.documento} ${fmt(x.valor)} venc. ${br(x.vencimento)}`).join('; ') : 'nenhuma'}`)
  p(`- Saíram: ${cSaem.length ? cSaem.map((x) => `${x.fornecedor} ${x.documento} ${fmt(x.valor)} (${x.pago ? 'paga: entra no custo' : 'sem pagamento: conferir'})`).join('; ') : 'nenhuma'}`)
  p(`- Continuam: ${cContinuam.length ? cContinuam.map((x) => `${x.fornecedor} ${x.documento} ${fmt(x.valor)}`).join('; ') : 'nenhuma'}`)
  p(); p(`## NF ↔ ordem de compra (material da Dinâmica)`)
  p(`- Ligado a OC: ${fmt(ligado)} de ${fmt(totMat)} (${totMat > 0 ? (100 * ligado / totMat).toFixed(1).replace('.', ',') : '0'}%) · chave: nº da NF + CNPJ da OC (ou nº da OC no documento)`)
  p(`- NFs pagas sem OC: ${mat.filter((x) => !x.oc).map((x) => `${x.fornecedor} ${x.documento} ${fmt(x.valor)}`).join('; ') || 'nenhuma'}`)
  p(`- OCs sem NF (compras não faturadas; NÃO são custo nem a pagar): ${info.oc.oc_sem_nf.filter((x) => !['1787', '1849'].includes(String(x.oc))).map((x) => `OC ${x.oc} ${x.fornecedor} ${fmt(x.total)}`).join('; ') || 'nenhuma'}`)
  p(); p(`## PENDÊNCIAS de classificação (${pend.length})`)
  pend.forEach((l) => p(`- ${l.mes} · ${l.fornecedor} ${l.documento} ${fmt(l.valor)} · ${txt(l.regra)}`))
  if (!pend.length) p('- nenhuma')
  p(); p(`## BLOQUEIOS (${bloqueios.length + travasImportar.length})`)
  ;[...bloqueios, ...travasImportar.map((t) => `trava do importar.js — ${t}`)].forEach((b) => p(`- ✗ ${b}`))
  if (!bloqueios.length && !travasImportar.length) p('- nenhum')
  if (avisos.length) { p(); p('## Avisos'); avisos.forEach((a) => p(`- ${a}`)) }
  p(); p(`## O que o --confirmar faria`)
  if (!mesesGravar.length) p('- custo: nada (nenhum título novo, mudado ou reclassificado)')
  else p(`- custo: ${semanal ? 'insere só as chaves novas' : 'recarrega'} ${mesesGravar.join(', ')} (importar.js, com backup e id de carga)`)
  p(`- contas a pagar: grava o fechamento ${corte} (${cNovo.size} título(s)); o site passa a usar este corte nas semanas que terminam a partir de ${br(corte)}`)
  p()
  p('Nada foi gravado. Logs e arquivos da prévia nesta pasta.')
  fs.writeFileSync(path.join(saida, 'previa.md'), L.join('\n'))

  // resumo curto no terminal
  console.log(`\nRotina semanal · corte ${br(corte)} · ${semanal ? 'relatório SÓ DA SEMANA' : `relatório ACUMULADO desde ${minMes}`}`)
  console.log(`  lidas: Fonseca ${info.linhas.Fonseca} · Dinâmica ${info.linhas['Dinâmica']} · pagos até o corte ${pagosAte.length}${depoisCorte.length ? ` · ${depoisCorte.length} pago(s) depois do corte (próxima carga)` : ''}`)
  console.log(`  custo NOVO: ${fmt(soma(novos.filter((x) => !x.pendente)))} (${novos.filter((x) => !x.pendente).length} título(s))${reclass.length ? ` · ${reclass.length} reclassificado(s)` : ''}`)
  console.log(`  contas a pagar: ${fmt(soma([...cNovo.values()]))} · novas ${cEntram.length} · saíram ${cSaem.length} (${cSaem.filter((x) => x.pago).length} pagas) · continuam ${cContinuam.length}`)
  console.log(`  NF ↔ OC: ${totMat > 0 ? (100 * ligado / totMat).toFixed(1).replace('.', ',') : '0'}% do material ligado a OC`)
  console.log(`  pendências: ${pend.length} · bloqueios: ${bloqueios.length + travasImportar.length}`)
  ;[...bloqueios, ...travasImportar].forEach((b) => console.log(`    ✗ ${b}`))
  console.log(`  prévia completa: automacao/${saidaRel}/previa.md`)
  return { est, saidaRel, saida, mesesGravar, semanal, corte, pend, bloqueios, travasImportar }
}

// ── confirmar ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function confirmar(db) {
  const r = await previa(db)
  if (r.bloqueios.length || r.travasImportar.length) throw new Error('há BLOQUEIOS (✗): nada foi gravado. Decida cada um e rode a prévia de novo.')
  if (r.pend.length && r.mesesGravar.some((m) => r.pend.some((p) => p.mes === m))) throw new Error('há PENDÊNCIAS nos meses a gravar: nada foi gravado.')
  const id = require('crypto').randomUUID()
  const manifesto = { id, corte: r.corte, tipo: r.semanal ? 'semanal' : 'acumulado', saida: r.saidaRel, criado_em: new Date().toISOString(), passos: [] }
  const arqM = path.join(r.saida, `carga_${id}.json`)
  const salvar = () => fs.writeFileSync(arqM, JSON.stringify(manifesto, null, 1))
  salvar()
  const falhou = (msg) => { throw new Error(`${msg}\n  Carga PARCIAL ${id}: o que já foi gravado está em ${path.relative(RAIZ, arqM)}. Desfaça com: node ferramentas/semana/atualizar.js --desfazer ${id} --confirmar`) }
  for (const m of r.mesesGravar) {
    const x = importar(['--competencia', m, '--saida', r.saidaRel, ...(r.semanal ? ['--apenas', path.join(r.saida, 'chaves_novas.json')] : []), '--confirmar'])
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
  if (CONFIRMAR) return confirmar(db)
  await previa(db)
  console.log('\n  PRÉVIA: nada foi gravado. Para gravar: node ferramentas/semana/atualizar.js --confirmar\n')
}

main().catch((e) => { console.error(`\nERRO: ${e.message}\n`); process.exit(1) })
