import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { carregarMedicoes, carregarVinculos } from '../../lib/medicao-servidor'

// Retratos de medição (percentual ACUMULADO por linha, código + pavimento), só leitura.
// modo 'acumulado' = tabela avanco_fisico_historico; 'incremento' = cálculo a partir dos incrementos antigos.
// Sem observação nem horas: o detalhe com quem mediu fica na /api/medicao (com senha).
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabasePronto(res)) return
  await carregarCalendario(supabase)
  try {
    const [m, v] = await Promise.all([carregarMedicoes(supabase), carregarVinculos(supabase)])
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      modo: m.modo,
      retratos: m.retratos.map((r) => ({
        id: r.id, codigo_eap: r.codigo_eap, pavimento: r.pavimento, data_lancamento: r.data_lancamento,
        semana_numero: r.semana_numero, percentual: r.percentual, incremento: r.incremento ?? null,
        transferido_de: r.transferido_de ?? null,
      })),
      vinculos: v.vinculos,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar medições', message: e.message })
  }
}
