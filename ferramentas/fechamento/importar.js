// ferramentas/fechamento/importar.js  (Sirius 60; adaptado do Flats BH)
//
// Grava no Supabase a saída do classificador (automacao/saida/AAAA-MM/lancamentos.csv),
// uma competência por vez. Sem --confirmar é só PRÉVIA: lê o banco e não grava nada.
//
//   node ferramentas/fechamento/importar.js --competencia 2026-07              (prévia)
//   node ferramentas/fechamento/importar.js --competencia 2026-07 --confirmar  (grava)
//   node ferramentas/fechamento/importar.js --desfazer <id da importação> [--confirmar]
//   --saida saida_v2  lê automacao/saida_v2/AAAA-MM (classificador --completo); padrão: automacao/saida
//
// Regras (CLAUDE.md e pedido 5A, 08/10/2026):
//   SAI    só linhas da obra nessa competência com importacao_id preenchido OU
//          lancado_por = 'carga planilha' (seed 05). Cópia delas vai para
//          importacoes.substituidos antes de apagar (é o que o --desfazer devolve).
//   FICA   todo o resto ("mantido"): lancado_por = 'Rafael', lançamentos feitos
//          pela tela etc. A prévia avisa quando um mantido parece repetir uma
//          linha nova (mesmo fornecedor/CNPJ e mesmo valor ou documento).
//   ENTRA  lancamentos.csv: status 'pago', lancado_por 'importacao'. A data de
//          pagamento (baixa) vai para data_emissao, que é a coluna que o site usa
//          para a semana; antes de 03/08/2026 (S01) vai para 03/08/2026, mantendo a
//          competência (regra do seed 05), e o histórico guarda a data real.
//   RECUSA soma do CSV diferente do resumo.json do classificador; competência
//          futura; pendência no pendencias.csv do mês; EAP fora do orçamento.
// Ordem de gravação: registra a importação → insere as novas → apaga as que saem.
// Se a inserção falhar, as novas são retiradas e nada antigo é apagado.
//
// Chaves: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY, lidas do .env.local do
// repositório (nunca a chave anon; nunca mostrar os valores).
'use strict'
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const OBRA = 'sirius60'
const S01 = '2026-08-03' // início da obra (lib/constants.js); data menor que esta não tem semana
const RAIZ = path.join(__dirname, '..', '..')
const AUTOMACAO = path.join(RAIZ, 'automacao')
const LANCADO_POR = 'importacao'
const SAI_LANCADO_POR = 'carga planilha'
const FONTES = { fonseca: 'fonseca', 'dinâmica': 'dinamica', dinamica: 'dinamica', rateio: 'rateio' }

const args = process.argv.slice(2)
const arg = (n) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null
}
const CONFIRMAR = args.includes('--confirmar')
const COMPETENCIA = arg('--competencia')
const DESFAZER = arg('--desfazer')
// pasta da saída do classificador dentro de automacao/ (saida_v2 = relatórios completos, classificador --completo)
const SAIDA = arg('--saida') || 'saida'
if (!/^[\w-]+$/.test(SAIDA)) throw new Error('--saida: só o nome da pasta dentro de automacao/ (ex.: saida_v2)')

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (v) => Math.round(v * 100) / 100
const txt = (v) => (v == null ? '' : String(v).trim())
const soma = (ls) => r2(ls.reduce((t, l) => t + Number(l.valor || 0), 0))
const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
// Hoje no fuso de São Paulo (nunca toISOString para data)
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const proxMes = (c) => {
  const [a, m] = c.split('-').map(Number)
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
}
const semAcento = (s) => txt(s).normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const chaveForn = (s) => semAcento(s).slice(0, 12)
const chaveDoc = (doc) => txt(doc).replace(/\s/g, '').replace(/^0+/, '').toUpperCase()

function lerEnv() {
  // O próprio script lê o .env.local; nada dele é impresso.
  const f = path.join(RAIZ, '.env.local')
  const env = {}
  if (fs.existsSync(f))
    fs.readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .forEach((l) => {
        const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      })
  return { ...env, ...process.env }
}

// CSV simples (aspas, vírgula ou ponto e vírgula, BOM, CRLF); tudo como texto
function lerCsv(arquivo, sep = ',') {
  const s = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '')
  const linhas = []
  let campo = '', linha = [], aspas = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (aspas) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = '' }
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

// Estrutura dos SQLs de supabase/custos (1-importacoes e 2-colunas-custos)
async function estrutura(db) {
  const t = await db.from('importacoes').select('id').limit(1)
  const c = await db.from('custos_lancamentos').select('importacao_id, cnpj, fonte').limit(1)
  return { importacoes: !t.error, colunas: !c.error }
}

async function main() {
  if (!COMPETENCIA && !DESFAZER) {
    console.error('Uso: --competencia AAAA-MM [--confirmar]  |  --desfazer ID [--confirmar]')
    process.exit(1)
  }
  const env = lerEnv()
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY)
    throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SECRET_KEY no .env.local')
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
  if (DESFAZER) return desfazer(db)
  return importar(db)
}

async function orcamento(db) {
  const orc = await todos(() => db.from('orcamento_planejado').select('codigo_eap, pavimento, grupo_num, grupo_nome').eq('obra_id', OBRA))
  const ind = await todos(() => db.from('custos_indiretos_planejados').select('codigo_eap').eq('obra_id', OBRA))
  const pavs = {}, grupoNome = {}, nomeDoGrupo = {}
  orc.forEach((o) => {
    ;(pavs[o.codigo_eap] = pavs[o.codigo_eap] || []).push(o.pavimento || '')
    if (!grupoNome[o.codigo_eap]) grupoNome[o.codigo_eap] = o.grupo_nome || null
    if (o.grupo_num && !nomeDoGrupo[o.grupo_num]) nomeDoGrupo[o.grupo_num] = o.grupo_nome
  })
  const indiretos = new Set(ind.map((i) => i.codigo_eap).filter(Boolean))
  // Linhas decididas pelo Rafael que ainda não estão no orçamento oficial (dados.json + banco)
  const ajustes = {}
  const fa = path.join(AUTOMACAO, 'ajustes_orcamento.csv')
  if (fs.existsSync(fa)) lerCsv(fa, ';').forEach((a) => (ajustes[txt(a.codigo_eap)] = a))
  return { pavs, grupoNome, nomeDoGrupo, indiretos, ajustes }
}

async function importar(db) {
  const comp = COMPETENCIA
  if (!/^\d{4}-\d{2}$/.test(comp || '')) throw new Error('--competencia AAAA-MM')
  const pasta = path.join(AUTOMACAO, SAIDA, comp)
  const arqL = path.join(pasta, 'lancamentos.csv')
  const arqP = path.join(pasta, 'pendencias.csv')
  const arqR = path.join(pasta, 'resumo.json')
  if (!fs.existsSync(arqL)) throw new Error(`${path.relative(RAIZ, arqL)} não existe: rode o classificador`)

  const travas = []
  const avisos = []
  if (comp > hojeSP().slice(0, 7)) travas.push(`competência ${comp} é futura (hoje ${br(hojeSP())})`)

  const brutas = lerCsv(arqL)
  const pend = fs.existsSync(arqP) ? lerCsv(arqP) : []
  if (pend.length) travas.push(`${pend.length} pendência(s) em pendencias.csv (${fmt(soma(pend))}): decida antes de gravar`)
  const faltando = ['documento', 'fornecedor', 'item', 'competencia', 'valor', 'codigo_eap', 'data_emissao', 'cnpj', 'fonte', 'pavimento']
    .filter((c) => brutas.length && !(c in brutas[0]))
  if (faltando.length) throw new Error(`lancamentos.csv sem as colunas: ${faltando.join(', ')}`)

  // Soma do CSV x total que o classificador registrou
  const totalCsv = soma(brutas)
  let resumo = null
  if (!fs.existsSync(arqR)) travas.push('resumo.json do classificador não existe: rode o classificador de novo')
  else {
    resumo = JSON.parse(fs.readFileSync(arqR, 'utf8'))
    if (resumo.competencia !== comp) travas.push(`resumo.json é de ${resumo.competencia}, não de ${comp}`)
    if (Math.abs(resumo.total - totalCsv) >= 0.005 || resumo.lancamentos !== brutas.length)
      travas.push(`lancamentos.csv (${brutas.length} · ${fmt(totalCsv)}) não fecha com o resumo do classificador (${resumo.lancamentos} · ${fmt(resumo.total)})`)
  }

  const orc = await orcamento(db)
  const est = await estrutura(db)

  // Mesma nota, fornecedor e EAP em várias linhas (nota aberta por item da OC, ou com duas naturezas no
  // rateio): o índice único aceita uma linha por nota + EAP numa carga. Agrupa somando; o total não muda.
  const grupos = new Map()
  brutas.forEach((b, i) => {
    const k = txt(b.documento) ? `${txt(b.documento)}|${txt(b.fornecedor)}|${txt(b.codigo_eap)}` : `#${i}`
    if (!grupos.has(k)) grupos.set(k, { ...b, valor: 0, __n: 0, __itens: [] })
    const g = grupos.get(k)
    g.valor = r2(g.valor + Number(b.valor))
    g.__n++
    if (txt(b.item) && !g.__itens.includes(txt(b.item))) g.__itens.push(txt(b.item))
  })
  const agrupadas = [...grupos.values()].filter((g) => g.__n > 1)
  agrupadas.forEach((g) => (g.item = g.__itens.join(' + ').slice(0, 300)))
  const unicas = [...grupos.values()]
  if (Math.abs(soma(unicas) - totalCsv) >= 0.005) throw new Error('agrupar mudou o total: nada foi feito')

  // Linhas novas no formato do site (pages/api/lancamentos.js)
  let movidas = 0
  const linhas = unicas.map((b, i) => {
    const eap = txt(b.codigo_eap)
    const pago = txt(b.competencia).slice(0, 10) // data de baixa (pagamento)
    const data = pago < S01 ? S01 : pago
    if (pago < S01) movidas++
    const nota = pago < S01 ? ` [pago em ${br(pago)}]` : ''
    const pavsEap = orc.pavs[eap] || []
    const pavCsv = txt(b.pavimento)
    let pavimento = pavsEap.includes(pavCsv) ? pavCsv : pavsEap.length === 1 ? pavsEap[0] : null
    if (!pavimento && orc.ajustes[eap]) pavimento = txt(orc.ajustes[eap].pavimento) || null
    if (!pavimento && !pavsEap.length) pavimento = pavCsv || 'Edifício' // indireto: como o seed 05
    const g = Number(eap.split('.')[0])
    const grupo_custo = g === 19 ? 'Custos Indiretos' : orc.grupoNome[eap] || orc.nomeDoGrupo[g] || null
    return {
      __linha: i + 2,
      obra_id: OBRA,
      competencia: `${comp}-01`,
      data_emissao: data,
      codigo_eap: eap,
      valor: r2(Number(b.valor)),
      status: 'pago',
      fornecedor: txt(b.fornecedor) || null,
      historico: (txt(b.item) || txt(b.fornecedor)) + nota,
      pavimento,
      num_documento: txt(b.documento) || null,
      classificacao: txt(b.classificacao) || null,
      grupo_custo,
      lancado_por: LANCADO_POR,
      cnpj: txt(b.cnpj) || null,
      fonte: FONTES[txt(b.fonte).toLowerCase()] || null,
      atualizado_em: new Date().toISOString(), // instante (timestamptz), não data
      __pago: pago,
    }
  })

  // Conferências das linhas
  linhas.forEach((l) => {
    if (!l.codigo_eap) travas.push(`linha ${l.__linha}: sem EAP`)
    else if (!orc.pavs[l.codigo_eap] && !orc.indiretos.has(l.codigo_eap)) {
      if (orc.ajustes[l.codigo_eap])
        avisos.push(`${l.codigo_eap} (${l.fornecedor}, ${fmt(l.valor)}): linha de ajustes_orcamento.csv, ainda fora do orçamento do banco`)
      else if (l.codigo_eap.startsWith('19.'))
        avisos.push(`${l.codigo_eap} (${l.fornecedor}, ${fmt(l.valor)}): indireto fora da tabela de indiretos`)
      else travas.push(`linha ${l.__linha}: EAP ${l.codigo_eap} fora do orçamento`)
    }
    if (!Number.isFinite(l.valor) || l.valor <= 0) travas.push(`linha ${l.__linha}: valor inválido`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.__pago)) travas.push(`linha ${l.__linha}: data de pagamento inválida`)
    else if (l.__pago.slice(0, 7) !== comp) travas.push(`linha ${l.__linha}: pago em ${br(l.__pago)}, fora de ${comp}`)
    if (!l.fonte) travas.push(`linha ${l.__linha}: fonte desconhecida`)
    if (!l.pavimento) avisos.push(`${l.codigo_eap} (${l.fornecedor}): sem pavimento definido`)
  })
  const chaves = {}
  linhas.forEach((l) => {
    if (!l.num_documento) return
    const k = `${l.num_documento}|${l.fornecedor}|${l.codigo_eap}`
    if (chaves[k]) travas.push(`linhas ${chaves[k]} e ${l.__linha}: mesma nota, fornecedor e EAP (o índice único recusaria)`)
    chaves[k] = l.__linha
  })

  // Banco: o que está hoje na competência
  const existentes = await todos(() =>
    db.from('custos_lancamentos').select('*').eq('obra_id', OBRA).gte('competencia', `${comp}-01`).lt('competencia', `${proxMes(comp)}-01`).order('id'))
  const sai = existentes.filter((e) => e.importacao_id || txt(e.lancado_por) === SAI_LANCADO_POR)
  const mantido = existentes.filter((e) => !sai.includes(e))

  // Mantido que parece repetir uma linha nova
  const alertas = []
  mantido.forEach((m) => {
    linhas.forEach((l) => {
      const mesmoForn = (m.cnpj && l.cnpj && txt(m.cnpj).slice(0, 8) === l.cnpj.slice(0, 8)) || chaveForn(m.fornecedor) === chaveForn(l.fornecedor)
      if (!mesmoForn) return
      const mesmoValor = Math.abs(Number(m.valor) - l.valor) < 0.005
      const mesmoDoc = m.num_documento && chaveDoc(m.num_documento) === chaveDoc(l.num_documento)
      if (mesmoValor || mesmoDoc)
        alertas.push(`mantido id ${m.id} (${m.lancado_por || 'sem lancado_por'}) ${m.fornecedor} ${m.num_documento || '—'} ${fmt(m.valor)} ` +
          `x nova ${l.num_documento} ${fmt(l.valor)} [${[mesmoDoc && 'documento', mesmoValor && 'valor'].filter(Boolean).join(' + ')}]`)
    })
  })
  // Linha nova com a mesma nota do mesmo fornecedor já lançada em OUTRA competência
  const outras = await todos(() =>
    db.from('custos_lancamentos').select('id, competencia, num_documento, fornecedor, valor, lancado_por').eq('obra_id', OBRA)
      .or(`competencia.lt.${comp}-01,competencia.gte.${proxMes(comp)}-01`))
  const vistos = new Set()
  linhas.forEach((l) => {
    outras
      .filter((o) => o.num_documento && chaveDoc(o.num_documento) === chaveDoc(l.num_documento) && chaveForn(o.fornecedor) === chaveForn(l.fornecedor))
      .forEach((o) => {
        if (vistos.has(o.id)) return
        vistos.add(o.id)
        alertas.push(`outra competência: id ${o.id} ${txt(o.competencia).slice(0, 7)} (${o.lancado_por || '—'}) ${o.fornecedor} ${o.num_documento} ${fmt(o.valor)} = nota nova ${l.num_documento}`)
      })
  })

  const totalEntra = soma(linhas)
  const depois = r2(soma(existentes) - soma(sai) + totalEntra)
  const quem = {}
  mantido.forEach((m) => {
    const k = m.lancado_por || '(vazio)'
    quem[k] = quem[k] || { n: 0, v: 0 }
    quem[k].n++
    quem[k].v = r2(quem[k].v + Number(m.valor))
  })

  console.log(`\nSirius 60 · competência ${comp} · ${path.relative(RAIZ, arqL)}${resumo ? ` (classificador ${resumo.gerado_em})` : ''}`)
  console.log(`  banco hoje: ${existentes.length} lançamento(s) · ${fmt(soma(existentes))}`)
  console.log(`  SAI     ${String(sai.length).padStart(3)} · ${fmt(soma(sai)).padStart(14)}  (importacao_id preenchido ou lancado_por = '${SAI_LANCADO_POR}')`)
  sai.forEach((e) => console.log(`          - id ${e.id} ${txt(e.data_emissao)} ${e.codigo_eap} ${fmt(e.valor)} ${e.fornecedor} ${e.num_documento || ''}`))
  console.log(`  ENTRA   ${String(linhas.length).padStart(3)} · ${fmt(totalEntra).padStart(14)}  (lancamentos.csv; status 'pago', lancado_por '${LANCADO_POR}')`)
  const porFonte = {}
  linhas.forEach((l) => (porFonte[l.fonte] = r2((porFonte[l.fonte] || 0) + l.valor)))
  console.log(`          por fonte: ${Object.entries(porFonte).map(([f, v]) => `${f} ${fmt(v)}`).join(' · ')}`)
  if (agrupadas.length)
    console.log(`          agrupadas (mesma nota + EAP, ${brutas.length} linhas do CSV → ${unicas.length}): ` +
      agrupadas.map((g) => `${g.documento} ${txt(g.fornecedor).slice(0, 20)} ${g.codigo_eap} (${g.__n}× = ${fmt(g.valor)})`).join('; '))
  console.log(`  MANTIDO ${String(mantido.length).padStart(3)} · ${fmt(soma(mantido)).padStart(14)}  ${Object.entries(quem).map(([k, q]) => `${k}: ${q.n} · ${fmt(q.v)}`).join(' | ')}`)
  mantido.forEach((m) => console.log(`          = id ${m.id} ${txt(m.data_emissao)} ${m.codigo_eap} ${fmt(m.valor)} ${m.fornecedor} ${m.num_documento || ''} (${m.lancado_por || '—'})`))
  console.log(`  TOTAL DO MÊS DEPOIS: ${fmt(depois)}`)
  console.log(`  Data: a data de pagamento (baixa) vai para data_emissao (a coluna da semana no site);` +
    ` competencia = ${comp}-01.${movidas ? ` ${movidas} linha(s) pagas antes de ${br(S01)} vão para ${br(S01)} (data real no histórico).` : ''}`)

  if (!est.importacoes || !est.colunas)
    console.log(`  ! estrutura ainda não existe no banco (${[!est.importacoes && 'tabela importacoes', !est.colunas && 'colunas importacao_id/cnpj/fonte'].filter(Boolean).join(', ')}):` +
      ` rode supabase/custos/1-importacoes.sql e 2-colunas-custos.sql antes do --confirmar`)
  avisos.forEach((a) => console.log(`  ! ${a}`))
  alertas.forEach((a) => console.log(`  ⚠ possível duplicidade: ${a}`))
  travas.forEach((t) => console.log(`  ✗ ${t}`))

  const pode = !travas.length && est.importacoes && est.colunas
  if (!CONFIRMAR) return console.log(`\n  PRÉVIA: nada foi gravado.${pode ? ' Para gravar, rode de novo com --confirmar' : ' Resolva os itens acima antes de gravar.'}\n`)
  if (travas.length) throw new Error('há itens marcados com ✗: nada foi gravado')
  if (!pode) throw new Error('rode antes os SQLs de supabase/custos (1 e 2): nada foi gravado')

  const arquivos = [path.relative(RAIZ, arqL), ...(resumo ? [`classificador ${resumo.gerado_em}`] : [])].join(' | ')
  const imp = await db.from('importacoes').insert({
    obra_id: OBRA, competencia: comp, origem: 'classificador', arquivos,
    linhas: linhas.length, total: totalEntra, linhas_substituidas: sai.length, total_substituido: soma(sai),
    substituidos: sai, observacao: alertas.length ? `${alertas.length} alerta(s) de possível duplicidade na prévia` : null,
  }).select('id').single()
  if (imp.error) throw new Error(`não consegui registrar a importação: ${imp.error.message}. Nada foi gravado.`)
  const importacao_id = imp.data.id

  const novas = linhas.map(({ __linha, __pago, ...l }) => ({ ...l, importacao_id }))
  const r = await db.from('custos_lancamentos').insert(novas)
  if (r.error) {
    await db.from('custos_lancamentos').delete().eq('importacao_id', importacao_id)
    await db.from('importacoes').delete().eq('id', importacao_id)
    throw new Error(`inserção falhou (nada antigo foi apagado): ${r.error.message}`)
  }
  // Volta o mês ao estado de antes: devolve as linhas do backup (as que já
  // tinham saído) e só então tira as novas e o registro da importação.
  const voltarAoAnterior = async (motivo) => {
    const v = sai.length ? await db.from('custos_lancamentos').upsert(sai) : { error: null }
    if (v.error)
      throw new Error(`${motivo}; devolver o backup também falhou (${v.error.message}). As novas continuam com importacao_id ${importacao_id}; ` +
        `o backup está em importacoes.substituidos. Rode --desfazer ${importacao_id} (prévia primeiro).`)
    await db.from('custos_lancamentos').delete().eq('importacao_id', importacao_id)
    await db.from('importacoes').delete().eq('id', importacao_id)
    throw new Error(`${motivo}. O mês voltou ao estado anterior: nada foi gravado.`)
  }
  const ids = sai.map((e) => e.id)
  if (ids.length) {
    const d = await db.from('custos_lancamentos').delete().in('id', ids).select('id')
    if (d.error) await voltarAoAnterior(`apagar as linhas antigas falhou: ${d.error.message}`)
    if ((d.data || []).length !== ids.length)
      await voltarAoAnterior(`apagar as antigas removeu ${(d.data || []).length} de ${ids.length} linha(s)`)
  }
  const ok = await db.from('importacoes').update({ status: 'ok' }).eq('id', importacao_id)
  if (ok.error) console.log(`  ! gravado, mas marcar a importação como 'ok' falhou: ${ok.error.message}`)
  console.log(`\n  ✓ ${novas.length} lançamento(s) gravados em ${comp}; ${ids.length} substituído(s); ${mantido.length} mantido(s).`)
  console.log(`  importação: ${importacao_id}  (para desfazer: --desfazer ${importacao_id})\n`)
}

async function desfazer(db) {
  const r = await db.from('importacoes').select('*').eq('id', DESFAZER).single()
  if (r.error || !r.data) throw new Error(`importação ${DESFAZER} não encontrada`)
  const imp = r.data
  if (imp.obra_id !== OBRA) throw new Error(`a importação ${DESFAZER} é de outra obra (${imp.obra_id})`)
  if (imp.status === 'desfeita') throw new Error(`a importação ${DESFAZER} já foi desfeita em ${imp.desfeita_em}`)
  const atuais = await todos(() => db.from('custos_lancamentos').select('id, valor').eq('importacao_id', DESFAZER))
  const voltam = imp.substituidos || []
  console.log(`\nDesfazer importação ${DESFAZER} · ${imp.competencia} · ${imp.arquivos || ''} · ${imp.criado_em}`)
  console.log(`  sai:   ${atuais.length} lançamento(s) desta carga · ${fmt(soma(atuais))}`)
  console.log(`  volta: ${voltam.length} lançamento(s) que ela substituiu · ${fmt(soma(voltam))}`)
  if (!CONFIRMAR) return console.log(`\n  PRÉVIA: nada foi alterado. Para desfazer, rode de novo com --confirmar\n`)

  if (voltam.length) {
    const x = await db.from('custos_lancamentos').upsert(voltam)
    if (x.error) throw new Error(`devolver as linhas antigas falhou (a carga continua no banco): ${x.error.message}`)
  }
  const d = await db.from('custos_lancamentos').delete().eq('importacao_id', DESFAZER)
  if (d.error) throw new Error(`as antigas voltaram, mas apagar a carga falhou: ${d.error.message}. Rode de novo.`)
  await db.from('importacoes').update({ status: 'desfeita', desfeita_em: new Date().toISOString() }).eq('id', DESFAZER)
  console.log(`\n  ✓ importação desfeita: ${atuais.length} saíram, ${voltam.length} voltaram.\n`)
}

main().catch((e) => {
  console.error(`\nERRO: ${e.message}\n`)
  process.exit(1)
})
