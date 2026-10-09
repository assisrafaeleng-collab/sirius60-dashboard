import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { senhaOk } from '../../lib/senha-servidor'
import { OBRA, dataParaSemana, hojeSaoPaulo } from '../../lib/constants'
import { competenciaDaSemana } from '../../lib/calendario'
import { carregarMedicoes, carregarVinculos, TABELA_HISTORICO, TABELA_INCREMENTOS } from '../../lib/medicao-servidor'
import { chaveLinha } from '../../lib/medicao'

// Medição de avanço físico por LINHA de serviço (código + pavimento). Tudo exige a senha no cabeçalho
// x-dashboard-senha (a lista só aparece na aba Medição semanal, que é protegida).
//
// Dois modos (pedido 13), decididos pelo banco:
//   'acumulado'  tabela avanco_fisico_historico (supabase/avanco/1-medicao-acumulada.sql): cada lançamento é o
//                PERCENTUAL ACUMULADO da linha ("está em X%"), como no Flats; vale o último (pode revisar para baixo).
//   'incremento' enquanto a tabela nova não existir: avanco_fisico_realizado, "quanto avançou" (como antes).
// Linha de material (vinculada a um serviço) não recebe medição: herda o avanço do serviço.
// GET    -> lançamentos por linha + acumulado · POST { ... } -> um lançamento · DELETE ?id=N -> remove
// PUT { id, percentual, data, observacao, medido_por } -> edita (só no modo acumulado; guarda editado_por/em)
// No modo acumulado o DELETE não apaga: marca excluido_em/excluido_por (?quem=) e o lançamento deixa de valer.
// Validações (pedido 13D): total entre 0 e 100%; data dentro do calendário; sem data futura (fuso de São Paulo).
export default async function handler(req, res) {
  const obra_id = OBRA.id
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!senhaOk(req, res)) return
  if (!supabasePronto(res)) return
  await carregarCalendario(supabase)   // semanas do calendário novo (ou o cálculo antigo, sem a tabela)

  let med, vinc
  try {
    ;[med, vinc] = await Promise.all([carregarMedicoes(supabase), carregarVinculos(supabase)])
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao ler medições', message: e.message })
  }
  const acumulado = med.modo === 'acumulado'

  if (req.method === 'GET') {
    const servicos = {}
    med.retratos.forEach(r => {
      const k = chaveLinha(r.codigo_eap, r.pavimento)
      if (!servicos[k]) servicos[k] = { lancamentos: [], acumulado: 0, hh: 0, qtd: 0 }
      const s = servicos[k]
      s.lancamentos.push({
        id: r.id, data_lancamento: r.data_lancamento, semana_numero: r.semana_numero,
        percentual: r.percentual, incremento_pct: acumulado ? null : r.incremento,
        hh_semana: r.hh_semana ?? null, qtd_semana: r.qtd_semana ?? null,
        medido_por: r.medido_por || null, observacao: r.observacao || null, transferido_de: r.transferido_de || null,
      })
      s.acumulado = Math.min(r.percentual, 100)          // retratos já vêm em ordem: o último vale
      s.hh += parseFloat(r.hh_semana || 0)
      s.qtd += parseFloat(r.qtd_semana || 0)
    })
    Object.values(servicos).forEach(s => {
      s.acumulado = +s.acumulado.toFixed(2)
      s.coef_real = s.qtd > 0 ? +(s.hh / s.qtd).toFixed(4) : null
    })
    return res.status(200).json({ modo: med.modo, servicos, total: med.retratos.length,
                                  materiais: vinc.vinculos.map(v => chaveLinha(v.material_codigo, v.material_pavimento)) })
  }

  if (req.method === 'PUT') {
    if (!acumulado) return res.status(409).json({ error: 'Lançamento liberado depois da conversão da medição acumulada' })
    const b = req.body || {}
    const id = parseInt(b.id)
    const data = String(b.data || '').slice(0, 10)
    const semana = /^\d{4}-\d{2}-\d{2}$/.test(data) ? dataParaSemana(data) : null
    if (!id) return res.status(400).json({ error: 'Lançamento não identificado' })
    if (!semana || semana > OBRA.prazo_semanas) return res.status(400).json({ error: 'Data fora do calendário da obra' })
    if (data > hojeSaoPaulo()) return res.status(400).json({ error: 'Data no futuro' })
    const perc = parseFloat(b.percentual)
    if (!Number.isFinite(perc) || perc < 0 || perc > 100) {
      return res.status(400).json({ error: 'O total acumulado deve estar entre 0 e 100%' })
    }
    try {
      const { data: atual, error: e1 } = await supabase.from(TABELA_HISTORICO).select('id, hh_planejado')
        .eq('obra_id', obra_id).eq('id', id).is('excluido_em', null).single()
      if (e1 || !atual) return res.status(404).json({ error: 'Lançamento não encontrado' })
      const hh = parseFloat(atual.hh_planejado) || 0
      const { error } = await supabase.from(TABELA_HISTORICO).update({
        percentual_realizado: perc, data_lancamento: data, semana_numero: semana, competencia: competenciaDaSemana(semana),
        hh_realizado: hh ? +(hh * perc / 100).toFixed(2) : null, observacao: b.observacao || null,
        editado_por: b.medido_por || null, editado_em: new Date().toISOString(),
      }).eq('obra_id', obra_id).eq('id', id)
      if (error) throw new Error(error.message)
      return res.status(200).json({ ok: true, id, semana })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao editar', message: e.message })
    }
  }

  if (req.method === 'POST') {
    const b = req.body || {}
    const data = String(b.data || '').slice(0, 10)
    const semana = /^\d{4}-\d{2}-\d{2}$/.test(data) ? dataParaSemana(data) : null
    if (!semana || semana > OBRA.prazo_semanas) {
      return res.status(400).json({ error: 'Data fora do prazo da obra' })
    }
    if (data > hojeSaoPaulo()) return res.status(400).json({ error: 'Data no futuro' })
    if (!b.codigo_eap || !b.pavimento) {
      return res.status(400).json({ error: 'Serviço não identificado' })
    }
    // a linha tem de existir no orçamento e não pode ser material
    const { data: linhas, error: eLin } = await supabase.from('orcamento_planejado')
      .select('id, descricao, grupo_num, hh').eq('obra_id', obra_id)
      .eq('codigo_eap', b.codigo_eap).eq('pavimento', b.pavimento)
    if (eLin) return res.status(500).json({ error: 'Erro ao conferir a linha', message: eLin.message })
    if (!linhas || linhas.length !== 1) {
      return res.status(400).json({ error: `O código ${b.codigo_eap} não tem uma linha no pavimento ${b.pavimento}` })
    }
    const item = linhas[0]
    if (vinc.vinculos.some(v => v.material_id === item.id)) {
      return res.status(400).json({ error: 'Linha de material não recebe medição: ela segue o serviço vinculado' })
    }

    try {
      if (acumulado) {
        const perc = parseFloat(b.percentual)
        if (!Number.isFinite(perc) || perc < 0 || perc > 100) {
          return res.status(400).json({ error: 'O total acumulado deve estar entre 0 e 100%' })
        }
        const hh = parseFloat(item.hh) || 0
        const { data: d, error } = await supabase.from(TABELA_HISTORICO).insert({
          obra_id, codigo_eap: b.codigo_eap, pavimento: b.pavimento,
          percentual_realizado: perc, data_lancamento: data, semana_numero: semana,
          competencia: competenciaDaSemana(semana), atividade_nome: item.descricao, grupo_num: item.grupo_num,
          hh_planejado: hh || null, hh_realizado: hh ? +(hh * perc / 100).toFixed(2) : null,
          medido_por: b.medido_por || null, observacao: b.observacao || null, origem: 'tela',
        }).select('id').single()
        if (error) throw new Error(error.message)
        return res.status(200).json({ ok: true, id: d?.id, semana, modo: 'acumulado' })
      }

      const inc = parseFloat(b.incremento)
      if (isNaN(inc) || inc === 0) {
        return res.status(400).json({ error: 'Informe quanto o serviço avançou' })
      }
      const { data: d, error } = await supabase.from(TABELA_INCREMENTOS).insert({
        obra_id,
        data_lancamento: data,
        semana_numero: semana,
        competencia: data,
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
      return res.status(200).json({ ok: true, id: d?.id, semana, modo: 'incremento' })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao gravar', message: e.message })
    }
  }

  if (req.method === 'DELETE') {
    try {
      // modo acumulado: não apaga; marca quem excluiu e quando (o lançamento deixa de valer)
      const { error } = acumulado
        ? await supabase.from(TABELA_HISTORICO)
            .update({ excluido_em: new Date().toISOString(), excluido_por: String(req.query.quem || '') || null })
            .eq('obra_id', obra_id).eq('id', parseInt(req.query.id)).is('excluido_em', null)
        : await supabase.from(TABELA_INCREMENTOS).delete().eq('obra_id', obra_id).eq('id', parseInt(req.query.id))
      if (error) throw new Error(error.message)
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao excluir', message: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
