import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { OBRA, semanaAtualObra } from '../../lib/constants'
import { montarPainel } from '../../lib/painel-servidor'

// Valor agregado, custo comprometido e avanço físico do custo direto, linha a linha, até a semana pedida.
// ?semana=N (padrão: semana atual) · ?linhas=0 devolve só os totais (cards da Visão geral).
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabasePronto(res)) return
  await carregarCalendario(supabase)
  const S = Math.min(Math.max(parseInt(req.query.semana) || semanaAtualObra(), 1), OBRA.prazo_semanas)
  try {
    // ?detalhe=1: cada linha leva os lançamentos pagos e os títulos a pagar (quadro "custo direto por grupo")
    const p = await montarPainel(supabase, S, { detalhe: req.query.detalhe === '1' })
    res.setHeader('Cache-Control', 'no-store')
    if (req.query.linhas === '0') delete p.linhas
    return res.status(200).json(p)
  } catch (e) {
    console.error('painel:', e)
    return res.status(500).json({ error: 'Erro ao montar o painel', message: e.message })
  }
}
