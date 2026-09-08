import { supabase } from '../../lib/supabase'
import { OBRA, dataParaSemana } from '../../lib/constants'

// Custos indiretos: planejado (desembolso na semana e acumulado) x realizado.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const semana = Math.min(Math.max(parseInt(req.query.semana) || OBRA.prazo_semanas, 1),
                          OBRA.prazo_semanas)
  try {
    const [planRes, lancRes] = await Promise.all([
      supabase.from('custos_indiretos_planejados')
        .select('id, categoria, codigo_eap, valor_total, semana_desembolso, semana_fim, recorrente')
        .eq('obra_id', OBRA.id),
      supabase.from('custos_lancamentos')
        .select('codigo_eap, valor, status, data_emissao, competencia, fornecedor, historico')
        .eq('obra_id', OBRA.id).like('codigo_eap', '19.%'),
    ])
    if (planRes.error) throw new Error(planRes.error.message)
    if (lancRes.error) throw new Error(lancRes.error.message)

    const plan = planRes.data || []
    const conta = s => s !== 'previsto' && s !== 'cancelado'
    const lanc = (lancRes.data || []).filter(l => conta((l.status || '').toLowerCase()))

    // realizado por EAP, até a semana
    const realPorEap = {}
    let realTotal = 0
    lanc.forEach(l => {
      const sem = dataParaSemana(l.data_emissao) ?? dataParaSemana(l.competencia)
      if (!sem || sem > semana) return
      const v = parseFloat(l.valor || 0)
      realPorEap[l.codigo_eap] = (realPorEap[l.codigo_eap] || 0) + v
      realTotal += v
    })

    const total = plan.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0)

    const categorias = plan.map(i => {
      const v = parseFloat(i.valor_total || 0)
      const ini = i.semana_desembolso
      const fim = i.semana_fim || i.semana_desembolso
      const dur = fim - ini + 1
      const porSemana = v / dur
      const naSemana = (semana >= ini && semana <= fim) ? porSemana : 0
      const planAte = semana < ini ? 0 : semana >= fim ? v : porSemana * (semana - ini + 1)
      const real = realPorEap[i.codigo_eap] || 0
      return {
        id: i.id, categoria: i.categoria, codigo_eap: i.codigo_eap,
        valor_total: +v.toFixed(2), semana_inicio: ini, semana_fim: fim,
        recorrente: i.recorrente,
        na_semana: +naSemana.toFixed(2),
        acumulado: +planAte.toFixed(2),
        realizado: +real.toFixed(2),
        desvio: +(real - planAte).toFixed(2),
        desvio_pct: planAte > 0 ? +(100 * (real - planAte) / planAte).toFixed(1)
                                : (real > 0 ? 100 : null),
        pct_do_total: total > 0 ? +(100 * v / total).toFixed(2) : 0,
        pct_desembolsado: v > 0 ? +(100 * planAte / v).toFixed(1) : 0,
      }
    })

    // lançamentos 19.x sem categoria correspondente
    const conhecidas = new Set(plan.map(p => p.codigo_eap))
    Object.entries(realPorEap).forEach(([eap, v]) => {
      if (!conhecidas.has(eap)) {
        categorias.push({
          id: 'x' + eap, categoria: 'Fora do orçamento', codigo_eap: eap,
          valor_total: 0, semana_inicio: null, semana_fim: null, recorrente: false,
          na_semana: 0, acumulado: 0, realizado: +v.toFixed(2),
          desvio: +v.toFixed(2), desvio_pct: 100, pct_do_total: 0, pct_desembolsado: 0,
        })
      }
    })

    const planAteTotal = categorias.reduce((s, c) => s + c.acumulado, 0)

    return res.status(200).json({
      semana,
      total_projeto: +total.toFixed(2),
      qtd_categorias: plan.length,
      programado_semana: +categorias.reduce((s, c) => s + c.na_semana, 0).toFixed(2),
      acumulado_ate: +planAteTotal.toFixed(2),
      realizado_ate: +realTotal.toFixed(2),
      desvio_pct: planAteTotal > 0
        ? +(100 * (realTotal - planAteTotal) / planAteTotal).toFixed(1) : null,
      qtd_lancamentos: lanc.length,
      categorias,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar indiretos', message: e.message })
  }
}
