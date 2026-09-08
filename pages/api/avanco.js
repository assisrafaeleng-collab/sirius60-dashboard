import { supabase } from '../../lib/supabase'
import { OBRA } from '../../lib/constants'

// Avanço físico medido, acumulado até a semana pedida.
// Para cada serviço (EAP + pavimento) devolve o percentual da medição
// mais recente até ali — medição é acumulada, não incremental.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const semana = Math.min(Math.max(parseInt(req.query.semana) || OBRA.prazo_semanas, 1),
                          OBRA.prazo_semanas)
  try {
    const { data, error } = await supabase
      .from('avanco_fisico_realizado')
      .select('semana_numero, codigo_eap, pavimento, incremento_pct, hh_semana, qtd_semana, medido_por')
      .eq('obra_id', OBRA.id).lte('semana_numero', semana)
      .order('semana_numero')
    if (error) throw new Error(error.message)

    const medido = {}
    ;(data || []).forEach(m => {
      const k = `${m.codigo_eap}|${m.pavimento}`
      const ant = medido[k] || { hh: 0, qtd: 0, percentual: 0 }
      // agora tudo soma: o avanço vem de lançamentos incrementais
      medido[k] = {
        percentual: Math.min((ant.percentual || 0) + parseFloat(m.incremento_pct || 0), 100),
        semana: m.semana_numero,
        medido_por: m.medido_por,
        hh: ant.hh + parseFloat(m.hh_semana || 0),
        qtd: ant.qtd + parseFloat(m.qtd_semana || 0),
      }
    })
    Object.values(medido).forEach(m => {
      m.coef_real = m.qtd > 0 ? +(m.hh / m.qtd).toFixed(4) : null
    })

    const semanasMedidas = [...new Set((data || []).map(m => m.semana_numero))]

    return res.status(200).json({
      semana,
      medido,
      qtd_medicoes: (data || []).length,
      qtd_servicos: Object.keys(medido).length,
      ultima_semana_medida: semanasMedidas.length ? Math.max(...semanasMedidas) : null,
      semanas_medidas: semanasMedidas.sort((a, b) => a - b),
    })
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar avanço', message: e.message })
  }
}
