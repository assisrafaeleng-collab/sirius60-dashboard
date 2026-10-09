import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { OBRA, semanaAtualObra } from '../../lib/constants'
import { montarCurva } from '../../lib/painel-servidor'

// Curva S financeira do custo direto, semana a semana (pedido 13D): valor agregado (até a última medição), custo
// pago e custo comprometido (pago + a pagar do fechamento), de S01 até ?semana=N. Só leitura.
// O físico (planejado e realizado) e o valor planejado vêm da /api/dashboard-integrado (semanas_alinhadas).
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabasePronto(res)) return
  await carregarCalendario(supabase)
  const S = Math.min(Math.max(parseInt(req.query.semana) || semanaAtualObra(), 1), OBRA.prazo_semanas)
  try {
    const c = await montarCurva(supabase, S)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(c)
  } catch (e) {
    console.error('curva-s:', e)
    return res.status(500).json({ error: 'Erro ao montar a curva S', message: e.message })
  }
}
