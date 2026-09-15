import { supabase } from '../../lib/supabase'
import { OBRA, dataParaSemana } from '../../lib/constants'

// Lançamentos de custo.
// GET    ?semana=N       -> lançamentos até a semana N
// POST   { senha, ... }  -> cria
// DELETE ?id=N&senha=... -> exclui
export default async function handler(req, res) {
  const obra_id = OBRA.id

  if (req.method === 'GET') {
    const semana = parseInt(req.query.semana) || OBRA.prazo_semanas
    try {
      const { data, error } = await supabase
        .from('custos_lancamentos')
        .select('*').eq('obra_id', obra_id).order('data_emissao', { ascending: false })
      if (error) throw new Error(error.message)
      // devolve TUDO: esconder nota por causa do filtro faz parecer que
      // a gravação falhou. Quem decide o recorte é a tela.
      const lista = (data || []).map(l => {
        const sem = dataParaSemana(l.data_emissao)
        return { ...l, semana: sem, fora_do_filtro: sem != null && sem > semana }
      })
      return res.status(200).json({ lancamentos: lista, semana })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao buscar', message: e.message })
    }
  }

  if (req.method === 'POST') {
    const b = req.body || {}
    if (!process.env.SENHA_MEDICAO) {
      return res.status(500).json({ error: 'SENHA_MEDICAO não configurada no .env.local' })
    }
    if (b.senha !== process.env.SENHA_MEDICAO) {
      return res.status(401).json({ error: 'Senha incorreta' })
    }
    if (!b.data_emissao) return res.status(400).json({ error: 'Informe a data da nota' })
    if (!b.valor || parseFloat(b.valor) <= 0) {
      return res.status(400).json({ error: 'Informe um valor maior que zero' })
    }
    const sem = dataParaSemana(b.data_emissao)
    if (!sem) {
      return res.status(400).json({
        error: `Data anterior ao início da obra (${OBRA.s1.split('-').reverse().join('/')})`,
      })
    }

    const linha = {
      obra_id,
      data_emissao: b.data_emissao,
      competencia: b.competencia || b.data_emissao.slice(0, 7) + '-01',
      codigo_eap: b.codigo_eap || null,
      valor: parseFloat(b.valor),
      status: b.status || 'pago',
      fornecedor: b.fornecedor || null,
      historico: b.historico || null,
      pavimento: b.pavimento || null,
      num_documento: b.num_documento || null,
      grupo_custo: b.grupo_custo || null,
      lancado_por: b.lancado_por || null,
      atualizado_em: new Date().toISOString(),
    }

    try {
      const { error } = await supabase.from('custos_lancamentos').insert(linha)
      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({
            error: `A nota ${linha.num_documento} desse fornecedor já foi lançada.`,
          })
        }
        throw new Error(error.message)
      }
      return res.status(200).json({ ok: true, semana: sem })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao gravar', message: e.message })
    }
  }

  if (req.method === 'DELETE') {
    if (req.query.senha !== process.env.SENHA_MEDICAO) {
      return res.status(401).json({ error: 'Senha incorreta' })
    }
    try {
      const { error } = await supabase.from('custos_lancamentos')
        .delete().eq('obra_id', obra_id).eq('id', parseInt(req.query.id))
      if (error) throw new Error(error.message)
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao excluir', message: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
