import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { calendario } from '../../lib/calendario'
import { OBRA } from '../../lib/constants'
import { montarPainel } from '../../lib/painel-servidor'
import { naoExiste } from '../../lib/medicao-servidor'
import { montarPontosAtencao, JORNADA_PADRAO, FERIADOS_NACIONAIS } from '../../lib/pontos-atencao'

// Painel "Pontos de atenção" (pedido 14B). GET ?semana=N — só leitura.
// Tabelas (supabase/planejamento/1-tabelas-pontos-atencao.sql): indice_produtividade, equipe_padrao,
// insumo_prazo_entrega, obra_jornada, obra_feriados. Sem elas o painel funciona com a jornada padrão (8 h, seg–sex,
// feriados nacionais) e mostra "configure as tabelas"; índices, equipes e prazos ficam "dado pendente".
async function ler(tabela, campos) {
  const r = await supabase.from(tabela).select(campos).eq('obra_id', OBRA.id)
  if (r.error) {
    if (naoExiste(r.error)) return null
    throw new Error(`${tabela}: ${r.error.message}`)
  }
  return r.data || []
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabasePronto(res)) return
  await carregarCalendario(supabase)
  const cal = calendario()
  const S = Math.min(Math.max(parseInt(req.query.semana) || 1, 1), cal.semanas.length)
  try {
    const [painel, ind, eqs, prz, jor, fer] = await Promise.all([
      montarPainel(supabase, S),
      ler('indice_produtividade', 'orcamento_id, regra, hh_por_unidade, horas_total, origem, hh_cronograma, conferir, tipo_equipe, observacao'),
      ler('equipe_padrao', 'tipo, nome, composicao, pessoas'),
      ler('insumo_prazo_entrega', 'orcamento_id, codigo_eap, pavimento, categoria, regra, antecedencia_dias, observacao'),
      ler('obra_jornada', 'horas_dia, dias_semana'),
      ler('obra_feriados', 'data, descricao'),
    ])
    const indices = {}
    ;(ind || []).forEach((i) => { indices[Number(i.orcamento_id)] = i })
    const equipes = {}
    ;(eqs || []).forEach((e) => { equipes[e.tipo] = { ...e, pessoas: Number(e.pessoas) } })
    const jornada = jor && jor.length
      ? { horas_dia: Number(jor[0].horas_dia), dias_semana: (jor[0].dias_semana || []).map(Number) } : JORNADA_PADRAO
    const feriados = fer && fer.length ? fer.map((f) => String(f.data).slice(0, 10)) : FERIADOS_NACIONAIS
    const configurado = { indices: ind != null, equipes: eqs != null, prazos: prz != null, jornada: !!(jor && jor.length), feriados: !!(fer && fer.length) }
    const out = montarPontosAtencao({
      linhas: painel.linhas, semanas: cal.semanas, semana: S, indices, equipes, prazos: prz || [], jornada, feriados,
      curva: cal.curva, configurado,
      // adiantamento (compras pela data projetada): realizado na medição e a semana da última medição
      avanco: { realizado: painel.avanco.realizado,
        semana_medida: painel.linhas.reduce((m, l) => Math.max(m, l.semana_medida || 0), 0) || null },
    })
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(out)
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao montar os pontos de atenção', message: e.message })
  }
}
