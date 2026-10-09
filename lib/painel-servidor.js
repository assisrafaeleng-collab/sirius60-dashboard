// Painel do custo direto no SERVIDOR (pedido 13): lê orçamento, vínculo material ↔ serviço, medições, custos
// pagos e contas a pagar, e calcula o valor agregado linha a linha (lib/valor-agregado.js). Usado por /api/painel
// (Visão geral, avanço físico, custos diretos) e /api/contas-a-pagar.
import { OBRA, dataParaSemana } from './constants'
import { calendario, datasDaSemana } from './calendario'
import { carregarMedicoes, carregarVinculos, carregarOrcamentoDireto, naoExiste } from './medicao-servidor'
import { calcularValorAgregado, ratear } from './valor-agregado'
import { fechamentoDaSemana, entraNoCustoDireto, resumirContas } from './contas-a-pagar'

if (typeof window !== 'undefined') {
  throw new Error('lib/painel-servidor.js é só para o servidor (pages/api).')
}

export const TABELA_CONTAS = 'contas_a_pagar'

// Contas a pagar de um fechamento. Sem a tabela: disponivel = false (o resto segue com a pagar zerado).
export async function carregarContas(supabase, dataFimSemana) {
  const f = await supabase.from(TABELA_CONTAS).select('competencia_fechamento').eq('obra_id', OBRA.id).limit(10000)
  if (f.error) {
    if (naoExiste(f.error)) return { disponivel: false, motivo: 'tabela contas_a_pagar ainda não criada', linhas: [] }
    throw new Error(`${TABELA_CONTAS}: ${f.error.message}`)
  }
  const fechamentos = Array.from(new Set((f.data || []).map((x) => x.competencia_fechamento))).sort()
  const alvo = fechamentoDaSemana(fechamentos, dataFimSemana)
  if (!alvo) return { disponivel: true, fechamento: null, fechamentos, linhas: [] }
  const r = await supabase.from(TABELA_CONTAS).select('*').eq('obra_id', OBRA.id)
    .eq('competencia_fechamento', alvo).order('data_vencimento').limit(10000)
  if (r.error) throw new Error(`${TABELA_CONTAS}: ${r.error.message}`)
  return { disponivel: true, fechamento: alvo, fechamentos, linhas: r.data || [] }
}

// Custos pagos (custos_lancamentos), semana pela data de pagamento (data_emissao; sem ela, a competência)
export async function carregarPagos(supabase) {
  const out = []
  for (let de = 0; ; de += 1000) {
    const r = await supabase.from('custos_lancamentos')
      .select('id, codigo_eap, pavimento, valor, status, data_emissao, competencia, fornecedor, historico, num_documento')
      .eq('obra_id', OBRA.id).order('id').range(de, de + 999)
    if (r.error) throw new Error(`custos_lancamentos: ${r.error.message}`)
    out.push(...(r.data || []))
    if (!r.data || r.data.length < 1000) break
  }
  return out.filter((l) => {
    const s = String(l.status || '').toLowerCase()
    return s !== 'cancelado' && s !== 'previsto'
  }).map((l) => ({ ...l, semana: dataParaSemana(l.data_emissao) ?? dataParaSemana(l.competencia) }))
}

// Lançamentos de cada linha (pedido 13C, nível 3 do quadro por grupo): pagos até a semana e títulos a pagar do
// fechamento, com a MESMA regra de rateio do custo da linha (pavimento informado → a linha dele; senão, entre as
// linhas da EAP pelo orçado), para o subtotal bater com as colunas pago e a pagar. Sem CPF/CNPJ.
function detalharLinhas(linhas, pagos, aPagar) {
  const porEap = {}
  linhas.forEach((l) => (porEap[l.codigo_eap] = porEap[l.codigo_eap] || []).push({ ...l, preco_total: l.orcado }))
  const det = {}
  const juntar = (lista, montar) => lista.forEach((x) => {
    const partes = ratear(porEap, x.codigo_eap || '(sem EAP)', x.pavimento, Number(x.valor) || 0)
    if (!partes) return
    partes.forEach((p) => (det[p.id] = det[p.id] || []).push({ ...montar(x), valor: Math.round(p.valor * 100) / 100,
      rateado: partes.length > 1 }))
  })
  juntar(pagos, (l) => ({ tipo: 'pago', data: String(l.data_emissao || l.competencia || '').slice(0, 10), semana: l.semana,
    fornecedor: l.fornecedor || '', descricao: l.historico || '', documento: l.num_documento || '' }))
  juntar(aPagar, (c) => ({ tipo: 'a_pagar', data: String(c.data_vencimento || '').slice(0, 10), semana: null,
    fornecedor: c.fornecedor || '', descricao: c.historico || '', documento: c.num_documento || '', parcela: c.parcela || '' }))
  // o mesmo título a pagar dividido em itens (seq) vira uma linha só por linha do orçamento
  Object.keys(det).forEach((id) => {
    const out = []
    const visto = {}
    det[id].forEach((x) => {
      if (x.tipo !== 'a_pagar') return out.push(x)
      const k = `${x.fornecedor}|${x.documento}|${x.parcela}|${x.data}`
      if (visto[k]) { visto[k].valor = Math.round((visto[k].valor + x.valor) * 100) / 100; visto[k].rateado = visto[k].rateado || x.rateado; return }
      visto[k] = { ...x }
      out.push(visto[k])
    })
    det[id] = out.sort((a, b) => a.data.localeCompare(b.data))
  })
  return det
}

// Curva S financeira semana a semana (pedido 13D, igual ao Flats): valor agregado, custo pago e custo comprometido
// (pago + a pagar do fechamento que vale na semana) do custo direto, com a MESMA conta dos cards
// (calcularValorAgregado), de S01 até a semana pedida. O valor agregado vai até a última medição (como no Flats);
// pago e comprometido até a semana pedida.
export async function montarCurva(supabase, semana) {
  const S = semana
  const cal = calendario()
  const [orcamento, vinc, med, pagosTodos, todasContas] = await Promise.all([
    carregarOrcamentoDireto(supabase), carregarVinculos(supabase), carregarMedicoes(supabase), carregarPagos(supabase),
    supabase.from(TABELA_CONTAS).select('*').eq('obra_id', OBRA.id).limit(10000),
  ])
  let contasLinhas = []
  if (todasContas.error) {
    if (!naoExiste(todasContas.error)) throw new Error(`${TABELA_CONTAS}: ${todasContas.error.message}`)
  } else contasLinhas = todasContas.data || []
  const fechamentos = Array.from(new Set(contasLinhas.map((c) => c.competencia_fechamento))).sort()
  const ultMed = med.retratos.filter((r) => r.semana_numero <= S).reduce((m, r) => Math.max(m, r.semana_numero), 0)
  const pontos = []
  let semFech = null, mesFech = null, aPagarFech = 0
  for (let w = 1; w <= S; w++) {
    const fimW = datasDaSemana(w).data_fim
    const f = fechamentoDaSemana(fechamentos, fimW)
    const aPagar = f ? contasLinhas.filter((c) => c.competencia_fechamento === f && entraNoCustoDireto(c)) : []
    const pagos = pagosTodos.filter((l) => l.semana != null && l.semana <= w)
    const pagoDireto = pagos.filter((l) => !String(l.codigo_eap || '').startsWith('19.')).reduce((t, l) => t + (Number(l.valor) || 0), 0)
    const ap = aPagar.reduce((t, c) => t + (Number(c.valor) || 0), 0)
    if (f && semFech == null) { semFech = w; mesFech = f; aPagarFech = ap }
    let va = null
    if (w <= ultMed) {
      const ponto = cal.curva ? cal.curva.find((c) => parseInt(c.semana_numero, 10) === w) : null
      va = calcularValorAgregado({ orcamento, vinculos: vinc.vinculos, retratos: med.retratos, pagos, aPagar, semana: w,
        semanas: cal.semanas, curvaPerc: ponto ? parseFloat(ponto.perc_hh_acum) : null }).totais.agregado
    }
    pontos.push({ semana: w, data_inicio: datasDaSemana(w).data_inicio, data_fim: fimW,
      va, cr: Math.round(pagoDireto * 100) / 100, cc: f ? Math.round((pagoDireto + ap) * 100) / 100 : null })
  }
  return { semana: S, ultima_medicao: ultMed || null, semana_fechamento: semFech, mes_fechamento: mesFech,
    a_pagar_fechamento: Math.round(aPagarFech * 100) / 100, pontos }
}

export async function montarPainel(supabase, semana, { retratos: retratosForcados = null, detalhe = false } = {}) {
  const S = semana
  const fimS = datasDaSemana(S).data_fim
  const [orcamento, vinc, med, pagosTodos, contas] = await Promise.all([
    carregarOrcamentoDireto(supabase), carregarVinculos(supabase), carregarMedicoes(supabase),
    carregarPagos(supabase), carregarContas(supabase, fimS),
  ])
  const pagos = pagosTodos.filter((l) => l.semana != null && l.semana <= S)
  const aPagar = contas.linhas.filter(entraNoCustoDireto)
  const cal = calendario()
  const ponto = cal.curva ? cal.curva.find((c) => parseInt(c.semana_numero, 10) === S) : null
  const va = calcularValorAgregado({
    orcamento, vinculos: vinc.vinculos, retratos: retratosForcados || med.retratos, pagos, aPagar, semana: S,
    semanas: cal.semanas, curvaPerc: ponto ? parseFloat(ponto.perc_hh_acum) : null,
  })
  const resumo = resumirContas(contas.linhas)
  if (detalhe) {
    const det = detalharLinhas(va.linhas, pagos, aPagar)
    va.linhas.forEach((l) => { l.lancamentos = det[l.id] || [] })
  }
  return {
    ...va,
    data_fim: fimS,
    medicao: { modo: med.modo, retratos: med.retratos.length, vinculos: vinc.disponivel ? vinc.vinculos.length : null },
    contas: {
      disponivel: contas.disponivel, fechamento: contas.fechamento || null, motivo: contas.motivo || null,
      totais: resumo.totais, por_mes: resumo.por_mes, n_titulos: resumo.n_titulos,
      vencimentos_a_partir: resumo.por_mes.length ? resumo.por_mes[0].mes : null,
    },
    calendario: cal.fonte,
  }
}
