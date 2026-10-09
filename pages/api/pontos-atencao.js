import { supabase, supabasePronto } from '../../lib/supabase'
import { carregarCalendario } from '../../lib/calendario-servidor'
import { calendario } from '../../lib/calendario'
import { OBRA } from '../../lib/constants'
import { montarPainel } from '../../lib/painel-servidor'
import { naoExiste } from '../../lib/medicao-servidor'
import { senhaOk } from '../../lib/senha-servidor'
import { montarPontosAtencao, JORNADA_PADRAO, FERIADOS_NACIONAIS } from '../../lib/pontos-atencao'

// Painel "Pontos de atenção" (pedidos 14B e 14C).
// GET ?semana=N — só leitura. Tabelas: supabase/planejamento/1-tabelas-pontos-atencao.sql (índices, equipes, prazos,
//   jornada, feriados) e 2-edicao-no-site.sql (equipes escolhidas, equipe por linha, histórico). Sem elas o painel
//   funciona com a jornada padrão e mostra "configure as tabelas".
// POST { orcamento_id, campo: 'indice' | 'equipes' | 'equipe', valor, quem } — grava a edição feita na tela. Exige a
//   senha da obra (x-dashboard-senha = SENHA_MEDICAO); chave secreta só aqui no servidor. Toda alteração vai para
//   planejamento_historico (valor anterior e novo, quem e quando).
const BASE_IX = 'orcamento_id, codigo_eap, pavimento, regra, hh_por_unidade, horas_total, origem, hh_cronograma, conferir, tipo_equipe, observacao'
const EDICAO_IX = ', equipes_definidas, equipe_oficiais, equipe_ajudantes, equipe_funcao, editado_por, editado_em'

async function ler(tabela, campos) {
  const r = await supabase.from(tabela).select(campos).eq('obra_id', OBRA.id)
  if (r.error) {
    if (naoExiste(r.error)) return null
    throw new Error(`${tabela}: ${r.error.message}`)
  }
  return r.data || []
}

async function gravar(req, res) {
  if (!senhaOk(req, res)) return
  const b = req.body || {}
  const id = parseInt(b.orcamento_id, 10)
  const quem = String(b.quem || '').trim() || null
  if (!id || !['indice', 'equipes', 'equipe'].includes(b.campo)) return res.status(400).json({ error: 'Pedido inválido.' })
  const atual = await supabase.from('indice_produtividade').select(BASE_IX + EDICAO_IX).eq('obra_id', OBRA.id).eq('orcamento_id', id).maybeSingle()
  if (atual.error) {
    return res.status(409).json({ error: naoExiste(atual.error)
      ? 'Rode antes os SQL supabase/planejamento/1-tabelas-pontos-atencao.sql e 2-edicao-no-site.sql.' : atual.error.message })
  }
  if (!atual.data) return res.status(404).json({ error: 'Linha sem cadastro em indice_produtividade.' })
  const a = atual.data
  let mudar, antes, depois
  if (b.campo === 'indice') {
    const v = Number(String(b.valor).replace(',', '.'))
    if (!(v > 0)) return res.status(400).json({ error: 'Índice deve ser maior que zero (Hh por unidade).' })
    antes = a.regra === 'duracao' ? `duração ${a.horas_total} Hh` : a.hh_por_unidade
    depois = v
    mudar = { hh_por_unidade: v, regra: 'indice', horas_total: null, origem: 'rafael-site' }
  } else if (b.campo === 'equipes') {
    const v = b.valor == null || b.valor === '' ? null : parseInt(b.valor, 10)
    if (v != null && !(v > 0)) return res.status(400).json({ error: 'Número de equipes deve ser maior que zero.' })
    antes = a.equipes_definidas; depois = v
    mudar = { equipes_definidas: v }
  } else {
    const of = parseInt(b.valor && b.valor.oficiais, 10), aj = parseInt(b.valor && b.valor.ajudantes, 10)
    const fn = String((b.valor && b.valor.funcao) || '').trim()
    if (!(of >= 0) || !(aj >= 0) || of + aj <= 0) return res.status(400).json({ error: 'Informe oficiais e ajudantes (pelo menos 1 pessoa).' })
    antes = a.equipe_oficiais == null && a.equipe_ajudantes == null ? (a.tipo_equipe || 'sem equipe')
      : `${a.equipe_oficiais} ${a.equipe_funcao || 'oficial'} + ${a.equipe_ajudantes} ajudante(s)`
    depois = `${of} ${fn || 'oficial'} + ${aj} ajudante(s)`
    mudar = { equipe_oficiais: of, equipe_ajudantes: aj, equipe_funcao: fn || null }
  }
  const agora = new Date().toISOString()
  const up = await supabase.from('indice_produtividade').update({ ...mudar, editado_por: quem, editado_em: agora, atualizado_em: agora })
    .eq('obra_id', OBRA.id).eq('orcamento_id', id)
  if (up.error) return res.status(500).json({ error: up.error.message })
  const h = await supabase.from('planejamento_historico').insert({
    obra_id: OBRA.id, orcamento_id: id, codigo_eap: a.codigo_eap, pavimento: a.pavimento, campo: b.campo,
    valor_anterior: antes == null ? null : String(antes), valor_novo: depois == null ? null : String(depois), editado_por: quem, editado_em: agora,
  })
  if (h.error) return res.status(500).json({ error: 'Gravado, mas o histórico falhou: ' + h.error.message })
  return res.status(200).json({ ok: true })
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })
  if (!supabasePronto(res)) return
  if (req.method === 'POST') {
    try { return await gravar(req, res) } catch (e) { return res.status(500).json({ error: e.message }) }
  }
  await carregarCalendario(supabase)
  const cal = calendario()
  const S = Math.min(Math.max(parseInt(req.query.semana) || 1, 1), cal.semanas.length)
  try {
    const lerIndices = async () => {
      const com = await supabase.from('indice_produtividade').select(BASE_IX + EDICAO_IX).eq('obra_id', OBRA.id)
      if (!com.error) return { linhas: com.data || [], edicao: true }
      if (!naoExiste(com.error)) throw new Error(`indice_produtividade: ${com.error.message}`)
      const sem = await ler('indice_produtividade', BASE_IX)        // tabela sem as colunas do passo 2 (ou sem tabela)
      return { linhas: sem, edicao: false }
    }
    const [painel, ind, eqs, prz, jor, fer, hist] = await Promise.all([
      montarPainel(supabase, S),
      lerIndices(),
      ler('equipe_padrao', 'tipo, nome, composicao, pessoas'),
      ler('insumo_prazo_entrega', 'orcamento_id, codigo_eap, pavimento, categoria, regra, antecedencia_dias, observacao'),
      ler('obra_jornada', 'horas_dia, dias_semana'),
      ler('obra_feriados', 'data, descricao'),
      ler('planejamento_historico', 'orcamento_id, campo, valor_anterior, valor_novo, editado_por, editado_em'),
    ])
    const indices = {}
    ;(ind.linhas || []).forEach((i) => { indices[Number(i.orcamento_id)] = i })
    const equipes = {}
    ;(eqs || []).forEach((e) => { equipes[e.tipo] = { ...e, pessoas: Number(e.pessoas) } })
    const jornada = jor && jor.length
      ? { horas_dia: Number(jor[0].horas_dia), dias_semana: (jor[0].dias_semana || []).map(Number) } : JORNADA_PADRAO
    const feriados = fer && fer.length ? fer.map((f) => String(f.data).slice(0, 10)) : FERIADOS_NACIONAIS
    const configurado = { indices: ind.linhas != null, equipes: eqs != null, prazos: prz != null, jornada: !!(jor && jor.length),
      feriados: !!(fer && fer.length), edicao: ind.edicao && hist != null }
    const out = montarPontosAtencao({
      linhas: painel.linhas, semanas: cal.semanas, semana: S, indices, equipes, prazos: prz || [], jornada, feriados,
      curva: cal.curva, configurado,
      // adiantamento (compras pela data projetada): realizado na medição e a semana da última medição
      avanco: { realizado: painel.avanco.realizado,
        semana_medida: painel.linhas.reduce((m, l) => Math.max(m, l.semana_medida || 0), 0) || null },
    })
    // histórico das edições por linha (mais recente primeiro)
    const porLinha = {}
    ;(hist || []).sort((a, b) => String(b.editado_em).localeCompare(String(a.editado_em)))
      .forEach((h) => (porLinha[Number(h.orcamento_id)] = porLinha[Number(h.orcamento_id)] || []).push(h))
    out.atividades.forEach((a) => { a.historico = porLinha[a.id] || [] })
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(out)
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao montar os pontos de atenção', message: e.message })
  }
}
