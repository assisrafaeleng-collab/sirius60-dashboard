import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { OBRA } from '../../lib/constants'
import { carregarMedicoes, carregarVinculos, carregarOrcamentoDireto } from '../../lib/medicao-servidor'
import { ordenarRetratos, percentuaisAte, heranca, chaveLinha } from '../../lib/medicao'

// Avanço físico medido até a semana pedida, por linha (código + pavimento).
// Vale o ÚLTIMO percentual acumulado da linha (lib/medicao.js); antes do SQL da medição acumulada, os incrementos
// antigos somados (lib/medicao-servidor.js). Linha de material não tem medição: herda o % do serviço vinculado
// (herdado: true), para quem pondera por horas contar as horas dela.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabasePronto(res)) return
  await carregarCalendario(supabase)   // semanas do calendário novo (ou o cálculo antigo, sem a tabela)
  const semana = Math.min(Math.max(parseInt(req.query.semana) || OBRA.prazo_semanas, 1),
                          OBRA.prazo_semanas)
  try {
    const [med, vinc, orc] = await Promise.all([carregarMedicoes(supabase), carregarVinculos(supabase), carregarOrcamentoDireto(supabase)])
    const ret = ordenarRetratos(med.retratos).filter(r => r.semana_numero <= semana)
    const ult = percentuaisAte(ret, semana)

    // horas e quantidade apontadas (só existem nos incrementos antigos)
    const extra = {}
    if (med.modo === 'incremento') ret.forEach(r => {
      const k = chaveLinha(r.codigo_eap, r.pavimento)
      if (!extra[k]) extra[k] = { hh: 0, qtd: 0 }
      extra[k].hh += parseFloat(r.hh_semana || 0)
      extra[k].qtd += parseFloat(r.qtd_semana || 0)
    })

    const materiais = new Set(vinc.vinculos.map(v => v.material_id))
    const porId = {}
    orc.forEach(o => { const m = ult[chaveLinha(o.codigo_eap, o.pavimento)]; porId[o.id] = m ? Math.min(m.percentual, 100) : 0 })
    const her = heranca(vinc.vinculos, porId)

    const medido = {}
    orc.forEach(o => {
      const k = chaveLinha(o.codigo_eap, o.pavimento)
      if (materiais.has(o.id)) {
        const p = Math.min(her[o.id] || 0, 100)
        if (p > 0) medido[k] = { percentual: +p.toFixed(4), herdado: true, semana: null, medido_por: null, hh: 0, qtd: 0, coef_real: null }
        return
      }
      const m = ult[k]
      if (!m) return
      const e = extra[k] || { hh: 0, qtd: 0 }
      medido[k] = { percentual: Math.min(m.percentual, 100), herdado: false, semana: m.semana, medido_por: m.medido_por,
                    hh: e.hh, qtd: e.qtd, coef_real: e.qtd > 0 ? +(e.hh / e.qtd).toFixed(4) : null }
    })

    const semanasMedidas = [...new Set(ret.map(m => m.semana_numero))].sort((a, b) => a - b)
    return res.status(200).json({
      semana,
      modo: med.modo,
      medido,
      qtd_medicoes: ret.length,
      qtd_servicos: Object.values(medido).filter(m => !m.herdado).length,
      ultima_semana_medida: semanasMedidas.length ? semanasMedidas[semanasMedidas.length - 1] : null,
      semanas_medidas: semanasMedidas,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar avanço', message: e.message })
  }
}
