// Leitura das medições e do vínculo material ↔ serviço no SERVIDOR (rotas em pages/api).
//
// Medição (pedido 13): a tabela nova avanco_fisico_historico (supabase/avanco/1-medicao-acumulada.sql) guarda
// RETRATOS ACUMULADOS por linha (código + pavimento), como no Flats. Enquanto ela não existir, vale o modelo antigo:
// avanco_fisico_realizado guarda INCREMENTOS, e aqui eles viram retratos somando por linha, com teto de 100%, na
// mesma ordem do cálculo antigo (/api/avanco). Assim o código pode ser promovido ANTES do SQL e as telas mostram o
// mesmo número de antes.
import { OBRA, dataParaSemana } from './constants'
import { ordenarRetratos, chaveLinha } from './medicao'

if (typeof window !== 'undefined') {
  throw new Error('lib/medicao-servidor.js é só para o servidor (pages/api).')
}

export const TABELA_HISTORICO = 'avanco_fisico_historico'
export const TABELA_INCREMENTOS = 'avanco_fisico_realizado'
export const TABELA_VINCULO = 'orcamento_material_servico'

export const naoExiste = (e) => /does not exist|could not find the table|schema cache|column .* does not exist/i.test(String(e && e.message))

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

async function lerTudo(consulta) {
  const out = []
  for (let de = 0; ; de += 1000) {
    const r = await consulta().range(de, de + 999)
    if (r.error) return { error: r.error }
    out.push(...(r.data || []))
    if (!r.data || r.data.length < 1000) break
  }
  return { data: out }
}

// { modo: 'acumulado' | 'incremento', retratos: [...] em ordem, lancamentos: (modo incremento) os registros crus }
export async function carregarMedicoes(supabase) {
  const h = await lerTudo(() => supabase.from(TABELA_HISTORICO)
    .select('id, codigo_eap, pavimento, percentual_realizado, data_lancamento, semana_numero, medido_por, observacao, transferido_de')
    .eq('obra_id', OBRA.id).order('id'))
  if (!h.error) {
    const retratos = ordenarRetratos(h.data.map((r) => ({
      ...r, data_lancamento: String(r.data_lancamento || '').slice(0, 10), percentual: num(r.percentual_realizado),
      semana_numero: r.semana_numero ?? dataParaSemana(r.data_lancamento),
    })))
    return { modo: 'acumulado', tabela: TABELA_HISTORICO, retratos }
  }
  if (!naoExiste(h.error)) throw new Error(`${TABELA_HISTORICO}: ${h.error.message}`)

  const r = await lerTudo(() => supabase.from(TABELA_INCREMENTOS)
    .select('id, codigo_eap, pavimento, incremento_pct, data_lancamento, semana_numero, hh_semana, qtd_semana, medido_por, observacao')
    .eq('obra_id', OBRA.id).order('id'))
  if (r.error) throw new Error(`${TABELA_INCREMENTOS}: ${r.error.message}`)
  // incrementos -> retratos acumulados (soma por linha, teto 100%), na ordem semana, data, id
  const ord = ordenarRetratos(r.data.map((l) => ({
    ...l, data_lancamento: String(l.data_lancamento || '').slice(0, 10),
    semana_numero: l.semana_numero ?? dataParaSemana(l.data_lancamento), percentual: num(l.incremento_pct),
  })))
  const acum = {}
  const retratos = ord.map((l) => {
    const k = chaveLinha(l.codigo_eap, l.pavimento)
    acum[k] = Math.min((acum[k] || 0) + l.percentual, 100)
    return { ...l, incremento: l.percentual, percentual: acum[k] }
  })
  return { modo: 'incremento', tabela: TABELA_INCREMENTOS, retratos, lancamentos: r.data }
}

// Vínculo material -> serviço(s) com peso. Sem a tabela: lista vazia (nenhuma linha é tratada como material).
export async function carregarVinculos(supabase) {
  const r = await supabase.from(TABELA_VINCULO)
    .select('material_id, material_codigo, material_pavimento, servico_id, servico_codigo, servico_pavimento, peso')
    .eq('obra_id', OBRA.id)
  if (r.error) {
    if (naoExiste(r.error)) return { disponivel: false, vinculos: [] }
    throw new Error(`${TABELA_VINCULO}: ${r.error.message}`)
  }
  return { disponivel: true, vinculos: (r.data || []).map((v) => ({ ...v, peso: num(v.peso) })) }
}

// Orçamento direto (grupos 1–18), com e_material quando a coluna existe.
export async function carregarOrcamentoDireto(supabase) {
  const campos = 'id, codigo_eap, pavimento, descricao, quantidade, unidade, preco_total, hh, grupo_num, grupo_nome, semana_inicio, semana_fim'
  let r = await lerTudo(() => supabase.from('orcamento_planejado').select(campos + ', e_material').eq('obra_id', OBRA.id).order('id'))
  if (r.error && naoExiste(r.error)) {
    r = await lerTudo(() => supabase.from('orcamento_planejado').select(campos).eq('obra_id', OBRA.id).order('id'))
  }
  if (r.error) throw new Error(`orcamento_planejado: ${r.error.message}`)
  return r.data.map((o) => ({ ...o, preco_total: num(o.preco_total), hh: num(o.hh), quantidade: num(o.quantidade),
    grupo_num: parseInt(o.grupo_num, 10), e_material: o.e_material === true }))
}
