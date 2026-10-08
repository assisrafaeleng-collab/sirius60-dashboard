import { supabase, supabasePronto } from '../../lib/supabase'
import { OBRA } from '../../lib/constants'

// Orçamento da obra lido do banco (fonte única), no MESMO formato do antigo public/dados.json,
// para as telas trocarem só o endereço:
//   g grupo · n nome do grupo · p pavimento · i código EAP · d descrição · q quantidade · u unidade
//   c custo orçado · h horas (Hh) · a semana de início · b semana de fim · k Hh por unidade
// Diretos (grupos 1–18): orcamento_planejado, na ordem do id (a mesma do dados.json).
// Indiretos (grupo 19): custos_indiretos_planejados.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabasePronto(res)) return

  try {
    const [dirRes, indRes] = await Promise.all([
      supabase.from('orcamento_planejado')
        .select('id, codigo_eap, pavimento, descricao, quantidade, unidade, preco_total, hh, semana_inicio, semana_fim, grupo_num, grupo_nome')
        .eq('obra_id', OBRA.id).order('id'),
      supabase.from('custos_indiretos_planejados')
        .select('id, codigo_eap, categoria, valor_total, semana_desembolso, semana_fim')
        .eq('obra_id', OBRA.id).order('id'),
    ])
    if (dirRes.error) throw new Error(dirRes.error.message)
    if (indRes.error) throw new Error(indRes.error.message)

    const num = v => (v == null ? 0 : parseFloat(v))
    const diretos = (dirRes.data || []).map(o => {
      const q = num(o.quantidade), h = num(o.hh)
      return {
        g: o.grupo_num, n: o.grupo_nome, p: o.pavimento, i: o.codigo_eap, d: o.descricao,
        q, c: num(o.preco_total), h, a: o.semana_inicio, b: o.semana_fim, u: o.unidade || '',
        k: q > 0 ? Math.round((h / q) * 1e4) / 1e4 : 0,
      }
    })
    const indiretos = (indRes.data || []).map(o => ({
      g: 19, n: 'Custos Indiretos', p: 'Edifício', i: o.codigo_eap, d: o.categoria,
      q: null, c: num(o.valor_total), h: 0, a: o.semana_desembolso, b: o.semana_fim ?? o.semana_desembolso, u: '', k: 0,
    }))
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json([...diretos, ...indiretos])
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar o orçamento', message: e.message })
  }
}
