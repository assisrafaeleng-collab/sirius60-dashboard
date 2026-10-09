import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { OBRA, dataParaSemana } from '../../lib/constants'
import { datasDaSemana, fracaoPorDias } from '../../lib/calendario'
import { carregarContas } from '../../lib/painel-servidor'

// Custos indiretos: planejado × realizado (pedido 13D).
// Planejado: cada categoria espalhada pelos DIAS das suas semanas (recorrentes de S01 ao fim da obra; pontuais nas
// semanas do mês previsto) — fracaoPorDias, a MESMA conta da Visão geral (lib/calendario.js planejadoDoCalendario).
// Realizado = pago (lançamentos 19.x até o fim da semana) + a pagar (contas a pagar de classe indireto do último
// fechamento cujo último dia já passou). Desvio = planejado − realizado: positivo = economia, negativo = estouro.
// Sem CPF/CNPJ na lista de lançamentos (pedido 13E): mascara números de documento pessoal que vierem no histórico
const semDocPessoal = (t) => String(t || '')
  .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '***')
  .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '***')

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabasePronto(res)) return
  await carregarCalendario(supabase)   // semanas do calendário novo (ou o cálculo antigo, sem a tabela)
  const semana = Math.min(Math.max(parseInt(req.query.semana) || OBRA.prazo_semanas, 1),
                          OBRA.prazo_semanas)
  const detalhe = req.query.detalhe === '1'
  try {
    const [planRes, lancRes, contas] = await Promise.all([
      supabase.from('custos_indiretos_planejados')
        .select('id, categoria, codigo_eap, valor_total, semana_desembolso, semana_fim, recorrente')
        .eq('obra_id', OBRA.id),
      supabase.from('custos_lancamentos')
        .select('codigo_eap, valor, status, data_emissao, competencia, fornecedor, historico, num_documento')
        .eq('obra_id', OBRA.id).like('codigo_eap', '19.%'),
      carregarContas(supabase, datasDaSemana(semana).data_fim),
    ])
    if (planRes.error) throw new Error(planRes.error.message)
    if (lancRes.error) throw new Error(lancRes.error.message)

    const plan = planRes.data || []
    const conta = s => s !== 'previsto' && s !== 'cancelado'
    const lanc = (lancRes.data || []).filter(l => conta((l.status || '').toLowerCase()))

    // pago por EAP, até a semana
    const pagoPorEap = {}
    const detPorEap = {}   // ?detalhe=1: lançamentos pagos e títulos a pagar de cada linha (igual ao nível 3 do direto)
    const det = (eap, x) => (detPorEap[eap] = detPorEap[eap] || []).push(x)
    let pagoTotal = 0, qtdLanc = 0
    lanc.forEach(l => {
      const sem = dataParaSemana(l.data_emissao) ?? dataParaSemana(l.competencia)
      if (!sem || sem > semana) return
      const v = parseFloat(l.valor || 0)
      pagoPorEap[l.codigo_eap] = (pagoPorEap[l.codigo_eap] || 0) + v
      pagoTotal += v; qtdLanc++
      if (detalhe) det(l.codigo_eap, { tipo: 'pago', data: String(l.data_emissao || l.competencia || '').slice(0, 10),
        semana: sem, fornecedor: l.fornecedor || '', descricao: semDocPessoal(l.historico), documento: l.num_documento || '',
        valor: +v.toFixed(2) })
    })
    // a pagar indireto por EAP (último fechamento até a semana)
    const aPagarPorEap = {}
    let aPagarTotal = 0
    contas.linhas.filter(c => c.classe === 'indireto').forEach(c => {
      const v = parseFloat(c.valor || 0)
      aPagarPorEap[c.codigo_eap] = (aPagarPorEap[c.codigo_eap] || 0) + v
      aPagarTotal += v
      if (detalhe) det(c.codigo_eap, { tipo: 'a_pagar', data: String(c.data_vencimento || '').slice(0, 10), semana: null,
        fornecedor: c.fornecedor || '', descricao: semDocPessoal(c.historico), documento: c.num_documento || '',
        parcela: c.parcela || '', valor: +v.toFixed(2) })
    })
    // o mesmo título a pagar dividido em itens vira uma linha só; tudo em ordem de data
    Object.keys(detPorEap).forEach(eap => {
      const out = [], visto = {}
      detPorEap[eap].forEach(x => {
        if (x.tipo !== 'a_pagar') return out.push(x)
        const k = `${x.fornecedor}|${x.documento}|${x.parcela}|${x.data}`
        if (visto[k]) { visto[k].valor = +(visto[k].valor + x.valor).toFixed(2); return }
        out.push((visto[k] = { ...x }))
      })
      detPorEap[eap] = out.sort((a, b) => a.data.localeCompare(b.data))
    })

    const total = plan.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0)
    const linha = (base) => {
      const realizado = base.pago + base.a_pagar
      const desvio = base.acumulado - realizado
      return {
        ...base,
        pago: +base.pago.toFixed(2), a_pagar: +base.a_pagar.toFixed(2), realizado: +realizado.toFixed(2),
        desvio: +desvio.toFixed(2),
        desvio_pct: base.acumulado > 0 ? +(100 * desvio / base.acumulado).toFixed(1) : (realizado > 0 ? -100 : null),
      }
    }
    const categorias = plan.map(i => {
      const v = parseFloat(i.valor_total || 0)
      const ini = i.semana_desembolso
      const fim = i.semana_fim || i.semana_desembolso
      const planAte = v * fracaoPorDias(ini, fim, semana)
      const naSemana = v * (fracaoPorDias(ini, fim, semana) - fracaoPorDias(ini, fim, semana - 1))
      return linha({
        id: i.id, categoria: i.categoria, codigo_eap: i.codigo_eap,
        valor_total: +v.toFixed(2), semana_inicio: ini, semana_fim: fim,
        recorrente: i.recorrente,
        na_semana: +naSemana.toFixed(2),
        acumulado: +planAte.toFixed(2),
        pago: pagoPorEap[i.codigo_eap] || 0,
        a_pagar: aPagarPorEap[i.codigo_eap] || 0,
        pct_do_total: total > 0 ? +(100 * v / total).toFixed(2) : 0,
        pct_desembolsado: v > 0 ? +(100 * planAte / v).toFixed(1) : 0,
        ...(detalhe ? { lancamentos: detPorEap[i.codigo_eap] || [] } : {}),
      })
    })

    // custo de indireto (19.x) sem categoria correspondente
    const conhecidas = new Set(plan.map(p => p.codigo_eap))
    new Set([...Object.keys(pagoPorEap), ...Object.keys(aPagarPorEap)]).forEach(eap => {
      if (conhecidas.has(eap)) return
      categorias.push(linha({
        id: 'x' + eap, categoria: 'Fora do orçamento', codigo_eap: eap,
        valor_total: 0, semana_inicio: null, semana_fim: null, recorrente: false,
        na_semana: 0, acumulado: 0, pago: pagoPorEap[eap] || 0, a_pagar: aPagarPorEap[eap] || 0,
        pct_do_total: 0, pct_desembolsado: 0,
        ...(detalhe ? { lancamentos: detPorEap[eap] || [] } : {}),
      }))
    })

    const planAteTotal = categorias.reduce((s, c) => s + c.acumulado, 0)
    const realizadoTotal = pagoTotal + aPagarTotal
    const desvioTotal = planAteTotal - realizadoTotal

    return res.status(200).json({
      semana,
      total_projeto: +total.toFixed(2),
      qtd_categorias: plan.length,
      programado_semana: +categorias.reduce((s, c) => s + c.na_semana, 0).toFixed(2),
      acumulado_ate: +planAteTotal.toFixed(2),
      pago_ate: +pagoTotal.toFixed(2),
      a_pagar: +aPagarTotal.toFixed(2),
      realizado_ate: +realizadoTotal.toFixed(2),
      desvio: +desvioTotal.toFixed(2),
      desvio_pct: planAteTotal > 0 ? +(100 * desvioTotal / planAteTotal).toFixed(1) : null,
      fechamento: contas.fechamento || null,
      qtd_lancamentos: qtdLanc,
      categorias,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar indiretos', message: e.message })
  }
}
