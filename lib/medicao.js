// Medição de avanço físico por LINHA do orçamento (código + pavimento), no modelo do Flats
// (lib/medicao-linha.js e lib/avanco-historico.js de lá): cada retrato guarda o percentual ACUMULADO
// ("a linha está em X%"); vale o ÚLTIMO retrato da linha até a semana, mesmo que revise para baixo.
// Ordem dos retratos: semana, data do lançamento, id.
//
// Material ("Apenas Material", e_material) não é medido: herda o avanço do(s) serviço(s) a que está vinculado
// (orcamento_material_servico), ponderado pelo peso do vínculo (CLAUDE.md, 08/10/2026).
// Este arquivo não acessa o banco: serve ao servidor e ao navegador.

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export const chaveLinha = (codigo, pavimento) => `${codigo}|${pavimento || ''}`

// Retratos em ordem (semana, data, id)
export function ordenarRetratos(retratos) {
  return (retratos || [])
    .filter((r) => r && r.codigo_eap && Number.isFinite(parseInt(r.semana_numero, 10)))
    .map((r) => ({ ...r, semana_numero: parseInt(r.semana_numero, 10), percentual: num(r.percentual) }))
    .sort((a, b) => a.semana_numero - b.semana_numero
      || String(a.data_lancamento || '').localeCompare(String(b.data_lancamento || ''))
      || num(a.id) - num(b.id))
}

// Último retrato de cada linha até a semana: { 'eap|pav': { percentual, semana, data, retrato } }
export function percentuaisAte(retratosOrd, semana) {
  const out = {}
  for (const r of retratosOrd) {
    if (r.semana_numero > semana) break
    out[chaveLinha(r.codigo_eap, r.pavimento)] = {
      percentual: r.percentual, semana: r.semana_numero, data: r.data_lancamento, medido_por: r.medido_por || null,
    }
  }
  return out
}

// Percentual herdado por linha de material: Σ peso × percentual do serviço (por id da linha de serviço).
// vinculos: [{ material_id, servico_id, peso }]; percPorId: id da linha de serviço -> percentual
export function heranca(vinculos, percPorId) {
  const out = {}
  ;(vinculos || []).forEach((v) => {
    out[v.material_id] = (out[v.material_id] || 0) + num(v.peso) * (percPorId[v.servico_id] || 0)
  })
  return out
}
