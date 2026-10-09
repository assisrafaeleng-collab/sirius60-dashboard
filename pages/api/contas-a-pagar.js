import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { OBRA, semanaAtualObra } from '../../lib/constants'
import { datasDaSemana } from '../../lib/calendario'
import { carregarContas } from '../../lib/painel-servidor'
import { resumirContas } from '../../lib/contas-a-pagar'

// Contas a pagar do fechamento que vale para a semana (?semana=N): totais, por mês de vencimento e um registro
// por título (fornecedor, documento, parcela, vencimento, valor, EAP, tipo, alerta). Só leitura, sem senha (igual
// ao Flats: o card da Visão geral abre a lista).
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabasePronto(res)) return
  await carregarCalendario(supabase)
  const S = Math.min(Math.max(parseInt(req.query.semana) || semanaAtualObra(), 1), OBRA.prazo_semanas)
  try {
    const c = await carregarContas(supabase, datasDaSemana(S).data_fim)
    const r = resumirContas(c.linhas)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ disponivel: c.disponivel, motivo: c.motivo || null, fechamento: c.fechamento || null, ...r })
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar contas a pagar', message: e.message })
  }
}
