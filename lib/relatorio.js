// Relatório gerencial por período (pedido 16). Conta pura: não acessa o banco e NÃO cria número novo — organiza o
// que as rotas do site já devolvem (/api/painel, /api/dashboard-integrado, /api/indiretos, /api/pontos-atencao,
// /api/curva-s) para a página pages/relatorio.js. Valor agregado, custo, índices, projeções, caixa e pontos de
// atenção vêm dos mesmos cálculos dos cards (lib/valor-agregado.js, lib/projecoes.js, lib/pontos-atencao.js).
//
// Período → semanas do calendário da obra (lib/calendario.js): semana inicial = a da data inicial (antes da S01
// conta desde a S01); semana final = a da data final. Os números "até a data final" são os do fim da semana final
// (é como o site corta: pagos até o fim da semana). As semanas fecham no último dia do mês, então mês fechado bate.
// "No período" = valor no fim da semana final − valor no fim da semana anterior à inicial.
import { semanaDaData, datasDaSemana, diasEntre, addDias } from './calendario'

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
const r2 = (v) => Math.round(num(v) * 100) / 100

// Semáforo
export const SEMAFORO = { verde: 'verde', amarelo: 'amarelo', vermelho: 'vermelho', cinza: 'cinza' }

// Faixas do semáforo (pedido 16): rendimento do custo (valor do que foi feito ÷ gasto) verde ≥ 1,00, amarelo
// 0,95–1,00, vermelho < 0,95 (Rafael). As outras faixas são do relatório (ficam escritas no rodapé de cada bloco).
export const corRendimento = (x) => (x == null ? 'cinza' : x >= 1 ? 'verde' : x >= 0.95 ? 'amarelo' : 'vermelho')
// prazo pelo adiantamento (semanas): em dia ou adiantada verde; até 2 semanas de atraso amarelo; mais, vermelho
export const corPrazo = (semanas) => (semanas == null ? 'cinza' : semanas >= -0.05 ? 'verde' : semanas >= -2 ? 'amarelo' : 'vermelho')
// saldo sobre a base (indireto: planejado; projeção: orçamento): ≥ 0 verde; estouro até 5% amarelo; mais, vermelho
export const corSaldoPct = (pct) => (pct == null ? 'cinza' : pct >= 0 ? 'verde' : pct >= -5 ? 'amarelo' : 'vermelho')

export function periodoEmSemanas(de, ate, totalSemanas) {
  const ini1 = datasDaSemana(1).data_inicio
  const sFim = ate < ini1 ? null : Math.min(semanaDaData(ate) || 1, totalSemanas)
  const sIni = de < ini1 ? 1 : Math.min(semanaDaData(de) || 1, totalSemanas)
  if (sFim == null || sIni > sFim) return null
  const fimReal = datasDaSemana(sFim).data_fim
  const iniReal = datasDaSemana(sIni).data_inicio
  return { de, ate, sIni, sFim, sAntes: sIni - 1, iniReal, fimReal,
    ajusteFim: fimReal !== ate, ajusteIni: iniReal !== de && de >= ini1 }
}

// Última semana com medição até a semana S (pelas linhas do painel: semana da medição de cada serviço)
export const ultimaMedicaoAte = (painel) => {
  let s = 0, data = null
  ;(painel.linhas || []).forEach((l) => {
    if ((l.semana_medida || 0) > s || ((l.semana_medida || 0) === s && l.data_medida && (!data || l.data_medida > data))) {
      s = l.semana_medida || 0; data = l.data_medida || data
    }
  })
  return s ? { semana: s, data } : null
}

// % planejado de uma linha numa DATA (mesma regra do lib/valor-agregado.js: linear pelos dias da janela da linha,
// mais as horas que ficaram em outra janela — orcamento_horas_janela). No fim de cada semana dá o perc_plan do painel.
function fracJanela(w, dia) {
  const a = parseInt(w.semana_inicio, 10), b = parseInt(w.semana_fim, 10)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  const ini = datasDaSemana(a).data_inicio, fim = datasDaSemana(b).data_fim
  if (dia < ini) return 0
  if (dia >= fim) return 1
  return diasEntre(ini, dia) / diasEntre(ini, fim)
}
export function planejadoNaData(l, dia) {
  const extra = l.janelas_extra || []
  const hh = num(l.hh)
  if (!extra.length || !(hh > 0)) return 100 * fracJanela(l, dia)
  const hhExtra = extra.reduce((t, x) => t + num(x.hh), 0)
  return 100 * ((hh - hhExtra) * fracJanela(l, dia) + extra.reduce((t, x) => t + num(x.hh) * fracJanela(x, dia), 0)) / hh
}
// Primeiro dia em que o planejado da linha alcança o % realizado (para "atrasada N dias" / "adiantada N dias")
function diaEquivalente(l, real) {
  const janelas = [l, ...(l.janelas_extra || [])].filter((w) => parseInt(w.semana_inicio, 10) > 0)
  if (!janelas.length) return null
  let lo = janelas.map((w) => datasDaSemana(parseInt(w.semana_inicio, 10)).data_inicio).sort()[0]
  let hi = janelas.map((w) => datasDaSemana(parseInt(w.semana_fim, 10)).data_fim).sort().slice(-1)[0]
  if (planejadoNaData(l, hi) < real - 1e-6) return hi
  let n = diasEntre(lo, hi) - 1
  let a = 0, b = n
  while (a < b) {
    const m = (a + b) >> 1
    if (planejadoNaData(l, addDias(lo, m)) >= real - 1e-6) b = m
    else a = m + 1
  }
  return addDias(lo, a)
}
export const inicioPlanejado = (l) => {
  const ws = [l, ...(l.janelas_extra || [])].filter((w) => parseInt(w.semana_inicio, 10) > 0)
  return ws.length ? ws.map((w) => datasDaSemana(parseInt(w.semana_inicio, 10)).data_inicio).sort()[0] : null
}

// Situação de uma atividade (linha de serviço) no fim do período, em palavras. Mesma regra do painel "Pontos de
// atenção" (lib/pontos-atencao.js): atrasada se o feito está abaixo do previsto (tolerância 0,05 p.p.), adiantada se
// acima. Os dias dizem quanto: data em que o cronograma previa chegar ao % feito × fim do período.
// Semáforo: atrasada até 7 dias amarelo, mais que isso (ou não iniciada) vermelho.
export function situacaoAtividade(l, dataFim) {
  const plan = num(l.perc_plan), real = num(l.perc_real)
  if (real >= 99.95) return { texto: 'concluída', cor: 'verde', dias: 0 }
  if (!(real > 0)) {
    if (!(plan > 0.05)) return { texto: 'não iniciada (ainda não previsto)', cor: 'cinza', dias: 0 }
    const ini = inicioPlanejado(l)
    const atraso = ini ? diasEntre(ini, dataFim) - 1 : null
    return { texto: `não iniciada — deveria ter começado em ${dmy(ini)}`, cor: atraso != null && atraso <= 7 ? 'amarelo' : 'vermelho', dias: atraso }
  }
  const eq = diaEquivalente(l, real)
  const dias = eq ? diasEntre(eq, dataFim) - 1 : 0          // > 0 atrasada, < 0 adiantada
  const n = (x) => (x <= 1 ? '1 dia' : `${x} dias`)
  if (real < plan - 0.05) return { texto: `atrasada ${n(Math.max(dias, 1))}`, cor: dias > 7 ? 'vermelho' : 'amarelo', dias: Math.max(dias, 1) }
  if (real > plan + 0.05) return { texto: `adiantada ${n(Math.max(-dias, 1))}`, cor: 'verde', dias }
  return { texto: 'em dia', cor: 'verde', dias: 0 }
}

// 3. Físico do período: linhas de serviço (produção) cujo planejado avança dentro do período, por grupo (e por
// pavimento na estrutura, grupo 3).
// semMedicao: sem medição dentro do período, a situação fica em cinza "sem medição no período" (não julga o que não
// foi medido); entre parênteses, o que daria pela última medição.
export function fisicoDoPeriodo(painelFim, painelAntes, dataFim, semMedicao = false, dataMedicao = null) {
  const antes = new Map((painelAntes ? painelAntes.linhas : []).map((l) => [l.id, l]))
  const lista = painelFim.linhas.filter((l) => l.tipo === 'servico' && l.producao && num(l.hh) > 0)
    .filter((l) => num(l.perc_plan) > num(antes.has(l.id) ? antes.get(l.id).perc_plan : 0) + 1e-6)
    .map((l) => {
      const sit = situacaoAtividade(l, dataFim)
      return { ...l, situacao: semMedicao
        ? { texto: `sem medição no período (pela de ${dm(dataMedicao)}: ${sit.texto})`, cor: 'cinza', dias: 0, base: sit }
        : sit }
    })
  const grupos = new Map()
  lista.forEach((l) => {
    const sub = l.grupo_num === 3 ? l.pavimento : ''
    const k = `${l.grupo_num}|${sub}`
    if (!grupos.has(k)) grupos.set(k, { grupo: l.grupo_num, nome: l.grupo_nome, pavimento: sub, itens: [] })
    grupos.get(k).itens.push(l)
  })
  const emDia = lista.filter((l) => l.situacao.cor === 'verde').length
  const preocupa = lista.filter((l) => l.situacao.cor === 'vermelho' || l.situacao.cor === 'amarelo')
    .sort((a, b) => (b.situacao.dias || 0) * num(b.hh) - (a.situacao.dias || 0) * num(a.hh))
  return { lista, grupos: Array.from(grupos.values()), emDia, total: lista.length, preocupa }
}

// 4. Financeiro do período por grupo e por linha: valor do que foi feito (valor agregado) e gasto (pago + a pagar),
// cada um como diferença entre o fim do período e o fim da semana anterior ao início. O gasto do período = pago no
// período + a pagar no fim − a pagar no início (o que estava a pagar no início e foi pago aparece uma vez só).
export function financeiroDoPeriodo(painelFim, painelAntes) {
  const antes = new Map((painelAntes ? painelAntes.linhas : []).map((l) => [l.id, l]))
  const linhas = painelFim.linhas.map((l) => {
    const a = antes.get(l.id) || {}
    const feito = num(l.agregado) - num(a.agregado)
    const gasto = num(l.comprometido) - num(a.comprometido)
    return { ...l, feito_periodo: r2(feito), gasto_periodo: r2(gasto), pago_periodo: r2(num(l.pago) - num(a.pago)),
      a_pagar_variacao: r2(num(l.a_pagar) - num(a.a_pagar)), saldo_periodo: r2(feito - gasto),
      saldo_acumulado: r2(num(l.agregado) - num(l.comprometido)) }
  })
  // por grupo: ACUMULADO até o fim (principal, Rafael 11/10) e período (secundário); pago e a pagar sempre separados
  const CAMPOS = ['orcado', 'feito', 'gasto', 'pago_p', 'ap_ini', 'ap_fim', 'feito_ac', 'pago_ac', 'ap_ac']
  const grupos = new Map()
  linhas.forEach((l) => {
    if (!grupos.has(l.grupo_num)) grupos.set(l.grupo_num, { grupo: l.grupo_num, nome: l.grupo_nome, ...Object.fromEntries(CAMPOS.map((c) => [c, 0])) })
    const g = grupos.get(l.grupo_num)
    const a = antes.get(l.id) || {}
    g.orcado += num(l.orcado); g.feito += l.feito_periodo; g.gasto += l.gasto_periodo
    g.pago_p += l.pago_periodo; g.ap_ini += num(a.a_pagar); g.ap_fim += num(l.a_pagar)
    g.feito_ac += num(l.agregado); g.pago_ac += num(l.pago); g.ap_ac += num(l.a_pagar)
  })
  const gs = Array.from(grupos.values()).sort((a, b) => a.grupo - b.grupo).map((g) => {
    const x = Object.fromEntries(CAMPOS.map((c) => [c, r2(g[c])]))
    return { ...g, ...x, saldo: r2(g.feito - g.gasto), custo_ac: r2(g.pago_ac + g.ap_ac), saldo_ac: r2(g.feito_ac - g.pago_ac - g.ap_ac),
      movimento: Math.abs(g.feito) > 0.005 || Math.abs(g.gasto) > 0.005,
      tem_ac: Math.abs(g.feito_ac) > 0.005 || Math.abs(g.pago_ac + g.ap_ac) > 0.005 }
  })
  // custo com EAP fora do orçamento (fica fora das linhas; entra no total do gasto como nos cards)
  const fora = (painelFim.fora_orcamento || []).reduce((t, f) => t + num(f.pago) + num(f.a_pagar), 0)
    - ((painelAntes && painelAntes.fora_orcamento) || []).reduce((t, f) => t + num(f.pago) + num(f.a_pagar), 0)
  const tot = gs.reduce((t, g) => ({ orcado: t.orcado + g.orcado, feito: t.feito + g.feito, gasto: t.gasto + g.gasto }), { orcado: 0, feito: 0, gasto: 0 })
  tot.gasto += fora
  // maiores economias e estouros pelo ACUMULADO (a resposta principal)
  const mov = linhas.filter((l) => Math.abs(l.saldo_acumulado) > 0.5)
  const economias = mov.filter((l) => l.saldo_acumulado > 0).sort((a, b) => b.saldo_acumulado - a.saldo_acumulado).slice(0, 5)
  const estouros = mov.filter((l) => l.saldo_acumulado < 0).sort((a, b) => a.saldo_acumulado - b.saldo_acumulado).slice(0, 5)
  const sum = (c) => r2(gs.reduce((t, g) => t + g[c], 0))
  return { grupos: gs, linhas, total: { orcado: r2(tot.orcado), feito: r2(tot.feito), gasto: r2(tot.gasto), saldo: r2(tot.feito - tot.gasto),
      pago_p: sum('pago_p'), ap_ini: sum('ap_ini'), ap_fim: sum('ap_fim') },
    fora: r2(fora), economias, estouros }
}

// Motivo em palavras para uma economia/estouro ACUMULADO (até a data final), só quando há regra conhecida do site
export function motivoDaDiferenca(l) {
  const saldo = l.saldo_acumulado, custo = num(l.pago) + num(l.a_pagar)
  if (l.verba_forma) return saldo < 0
    ? 'madeira de forma acima da verba inteira de forma'
    : 'madeira de forma comprada antes — vale para os próximos pavimentos (verba única de forma)'
  if (l.tipo === 'locacao') return 'aluguel e despesas da obra: conta o custo até a verba; acima disso é estouro'
  if (l.tipo === 'tempo') return 'custo que corre com o tempo da obra (vale pelos dias passados)'
  if (l.tipo === 'material' && l.material_comprado) return 'material comprado antes da execução'
  if (saldo > 0 && custo < 0.5) return 'serviço feito e ainda sem pagamento lançado (a conta pode chegar depois)'
  if (saldo < 0 && num(l.agregado) < 0.5) return 'pago sem avanço medido (adiantamento ou medição pendente)'
  if (saldo > 0) return 'custou menos que o orçado para o que foi feito'
  return 'custou mais que o orçado para o que foi feito'
}

// 2c / 6. Caixa dos próximos 30 dias: a MESMA soma do topo do painel "Pontos de atenção" (components/PontosAtencao.jsx
// caixaTopo('mes')): atividades dos próximos 30 dias (caixa_mes calculado no servidor) + contas a pagar com
// vencimento no período + indiretos do período.
export function caixa30(pa) {
  const ls = pa.atividades.filter((a) => a.em_30)
  const porGrupo = new Map()
  let servicos = 0
  ls.forEach((a) => {
    const x = a.caixa_mes || { total: 0 }
    if (!(x.total > 0.005)) return
    servicos += x.total
    if (!porGrupo.has(a.grupo_num)) porGrupo.set(a.grupo_num, { grupo: a.grupo_num, nome: a.grupo_nome, valor: 0 })
    porGrupo.get(a.grupo_num).valor += x.total
  })
  const contas = pa.caixa.mes.contas.reduce((s, c) => s + num(c.valor), 0)
  const indiretos = pa.caixa.mes.indiretos.reduce((s, c) => s + num(c.valor), 0)
  return { de: pa.periodos.mes.de, ate: pa.periodos.mes.ate, grupos: Array.from(porGrupo.values()).sort((a, b) => b.valor - a.valor),
    servicos: r2(servicos), contas: r2(contas), indiretos: r2(indiretos), total: r2(servicos + contas + indiretos),
    curva: r2(pa.caixa.mes.curva), n_contas: new Set(pa.caixa.mes.contas.map((c) => `${c.fornecedor}|${c.documento}|${c.parcela}`)).size }
}

export const dmy = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}/${String(s).slice(0, 4)}` : '—')
export const dm = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}` : '—')
