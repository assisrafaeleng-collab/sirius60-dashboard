import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'

// Calendário de semanas da obra para o navegador (pages/_app.js usa no início).
// fonte 'tabela'    = calendario_semanas + curva_s_semanal_planejada (supabase/semanas/1-calendario.sql)
// fonte 'calculado' = as tabelas ainda não existem: o cálculo antigo (96 semanas de 7 dias), igual a antes.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabasePronto(res)) return
  try {
    const cal = await carregarCalendario(supabase)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      fonte: cal.fonte,
      semanas: cal.semanas.map((s) => ({
        semana: s.semana, data_inicio: s.data_inicio, data_fim: s.data_fim, dias: s.dias, competencia: s.competencia,
        semana_do_mes: s.semana_do_mes ?? null, fechamento: s.fechamento ?? null,
      })),
      curva: cal.curva,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao ler o calendário', message: e.message })
  }
}
