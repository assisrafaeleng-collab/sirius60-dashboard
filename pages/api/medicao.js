import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { senhaOk } from '../../lib/senha-servidor'
import { OBRA, dataParaSemana } from '../../lib/constants'

// Memória de cálculo do avanço físico.
// Tudo exige a senha no cabeçalho x-dashboard-senha (a lista só aparece na
// aba Medição semanal, que é protegida).
// GET    ?ate=6 -> lançamentos até a semana 6, agrupados por serviço
// POST   { ... } -> adiciona UM lançamento
// DELETE ?id=N  -> remove um lançamento
export default async function handler(req, res) {
  const obra_id = OBRA.id
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!senhaOk(req, res)) return
  if (!supabasePronto(res)) return
  await carregarCalendario(supabase)   // semanas do calendário novo (ou o cálculo antigo, sem a tabela)

  if (req.method === 'GET') {
    const ate = parseInt(req.query.ate) || OBRA.prazo_semanas
    try {
      const { data, error } = await supabase
        .from('avanco_fisico_realizado')
        .select('id, data_lancamento, semana_numero, codigo_eap, pavimento, incremento_pct, hh_semana, qtd_semana, medido_por, observacao')
        .eq('obra_id', obra_id).lte('semana_numero', ate)
        .order('data_lancamento')
      if (error) throw new Error(error.message)

      // agrupa por serviço: lista de lançamentos + acumulados
      const servicos = {}
      ;(data || []).forEach(l => {
        const k = `${l.codigo_eap}|${l.pavimento}`
        if (!servicos[k]) servicos[k] = { lancamentos: [], acumulado: 0, hh: 0, qtd: 0 }
        servicos[k].lancamentos.push(l)
        servicos[k].acumulado += parseFloat(l.incremento_pct || 0)
        servicos[k].hh += parseFloat(l.hh_semana || 0)
        servicos[k].qtd += parseFloat(l.qtd_semana || 0)
      })
      Object.values(servicos).forEach(s => {
        s.acumulado = Math.min(+s.acumulado.toFixed(2), 100)
        s.coef_real = s.qtd > 0 ? +(s.hh / s.qtd).toFixed(4) : null
      })

      return res.status(200).json({ ate, servicos, total: (data || []).length })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao buscar medições', message: e.message })
    }
  }

  if (req.method === 'POST') {
    const b = req.body || {}
    const semana = dataParaSemana(b.data)
    if (!semana || semana > OBRA.prazo_semanas) {
      return res.status(400).json({ error: 'Data fora do prazo da obra' })
    }
    const inc = parseFloat(b.incremento)
    if (isNaN(inc) || inc === 0) {
      return res.status(400).json({ error: 'Informe quanto o serviço avançou' })
    }
    if (!b.codigo_eap || !b.pavimento) {
      return res.status(400).json({ error: 'Serviço não identificado' })
    }

    try {
      const { data, error } = await supabase.from('avanco_fisico_realizado').insert({
        obra_id,
        data_lancamento: b.data,
        semana_numero: semana,
        competencia: b.data,
        codigo_eap: b.codigo_eap,
        pavimento: b.pavimento,
        incremento_pct: Math.max(-100, Math.min(100, inc)),
        hh_semana: b.hh !== '' && b.hh != null ? Math.max(0, parseFloat(b.hh)) : null,
        qtd_semana: b.qtd !== '' && b.qtd != null ? Math.max(0, parseFloat(b.qtd)) : null,
        medido_por: b.medido_por || null,
        observacao: b.observacao || null,
        atualizado_em: new Date().toISOString(),
      }).select('id').single()
      if (error) throw new Error(error.message)
      return res.status(200).json({ ok: true, id: data?.id, semana })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao gravar', message: e.message })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase.from('avanco_fisico_realizado')
        .delete().eq('obra_id', obra_id).eq('id', parseInt(req.query.id))
      if (error) throw new Error(error.message)
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao excluir', message: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
