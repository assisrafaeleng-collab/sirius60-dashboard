// Painel do custo direto no SERVIDOR (pedido 13): lê orçamento, vínculo material ↔ serviço, medições, custos
// pagos e contas a pagar, e calcula o valor agregado linha a linha (lib/valor-agregado.js). Usado por /api/painel
// (Visão geral, avanço físico, custos diretos) e /api/contas-a-pagar.
import { OBRA, dataParaSemana } from './constants'
import { calendario, datasDaSemana } from './calendario'
import { carregarMedicoes, carregarVinculos, carregarOrcamentoDireto, naoExiste } from './medicao-servidor'
import { calcularValorAgregado } from './valor-agregado'
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
      .select('codigo_eap, pavimento, valor, status, data_emissao, competencia')
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

export async function montarPainel(supabase, semana, { retratos: retratosForcados = null } = {}) {
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
