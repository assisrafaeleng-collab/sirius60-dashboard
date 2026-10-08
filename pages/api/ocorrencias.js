import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { senhaOk } from '../../lib/senha-servidor'
import { OBRA, dataParaSemana } from '../../lib/constants'

// Diário de ocorrências.
// GET               -> lista, mais recente primeiro (aberto: aparece na Visão geral)
// POST   { ... }    -> cria      | gravações exigem a senha no
// PUT    { id, ... } -> edita    | cabeçalho x-dashboard-senha
// DELETE ?id=N      -> exclui    |
export default async function handler(req, res) {
  const obra_id = OBRA.id
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.method !== 'GET' && !senhaOk(req, res)) return
  if (!supabasePronto(res)) return
  await carregarCalendario(supabase)   // semanas do calendário novo (ou o cálculo antigo, sem a tabela)

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('ocorrencias_obra')
        .select('*').eq('obra_id', obra_id).order('data_ocorrencia', { ascending: false })
      if (error) throw new Error(error.message)
      return res.status(200).json({ ocorrencias: data || [] })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao buscar', message: e.message })
    }
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const b = req.body || {}
    if (!b.data_ocorrencia) return res.status(400).json({ error: 'Informe a data' })
    if (!b.categoria) return res.status(400).json({ error: 'Escolha a categoria' })
    if (!b.descricao || !b.descricao.trim()) {
      return res.status(400).json({ error: 'Descreva o que aconteceu' })
    }

    const linha = {
      obra_id,
      data_ocorrencia: b.data_ocorrencia,
      semana_numero: dataParaSemana(b.data_ocorrencia),
      categoria: b.categoria,
      impacto: ['baixo', 'medio', 'alto'].includes(b.impacto) ? b.impacto : 'baixo',
      codigo_eap: b.codigo_eap || null,
      grupo: b.grupo || null,
      dias_atraso_estimado: parseInt(b.dias_atraso_estimado) || 0,
      descricao: b.descricao.trim(),
      registrado_por: b.registrado_por || null,
      atualizado_em: new Date().toISOString(),
    }

    try {
      if (req.method === 'PUT') {
        if (!b.id) return res.status(400).json({ error: 'Ocorrência não identificada' })
        const { error } = await supabase.from('ocorrencias_obra')
          .update(linha).eq('obra_id', obra_id).eq('id', b.id)
        if (error) throw new Error(error.message)
        return res.status(200).json({ ok: true, id: b.id })
      }
      const { data, error } = await supabase.from('ocorrencias_obra')
        .insert(linha).select('id').single()
      if (error) throw new Error(error.message)
      return res.status(200).json({ ok: true, id: data?.id })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao gravar', message: e.message })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase.from('ocorrencias_obra')
        .delete().eq('obra_id', obra_id).eq('id', parseInt(req.query.id))
      if (error) throw new Error(error.message)
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao excluir', message: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
