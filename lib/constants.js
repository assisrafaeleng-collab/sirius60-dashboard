// ============================================================
// CONSTANTES DA OBRA — Residencial Sirius 60 (Mariana/MG)
// BASE SEMANAL: o cronograma nasce em semanas (96), então o
// acompanhamento é em semanas. S01 = segunda 03/08/2026.
// Alterou orçamento ou cronograma? Mexa AQUI, não nos componentes.
// ============================================================

export const OBRA = {
  id: 'sirius60',
  nome: 'Residencial Sirius 60',
  cidade: 'Mariana/MG',
  area_total: 2622,
  unidades: 13,
  prazo_semanas: 96,
  s1: '2026-08-03',        // segunda-feira da S01
  fim_planejado: '2028-06-04',   // domingo da S96
}

// ---- ORÇAMENTO (fonte: Orçamento 03-08-26) ----
export const CUSTO = {
  direto_servico: 6212060.00,   // grupos 1-16 — BASE DO EVM
  direto_apoio: 1186575.20,     // grupos 17-18 — custo de TEMPO, não de produção
  direto_total: 7398635.20,     // 1-18
  indireto: 2446376.88,         // grupo 19
  total: 9845012.08,
}

// Grupos 17 e 18 correm com o calendário, não com a produção.
// Se entrassem no BCWS, a obra "agregaria valor" só por passar a semana.
export const GRUPO_MAX_EVM = 16

// Itens que correm com o calendário, não com a produção, e por isso
// ficam fora da base de avanço físico — mesmo critério dos grupos 17 e 18.
// 1.1.6 = limpeza periódica + EPI, 24 meses de serviço contínuo.
export const EAP_CUSTO_DE_TEMPO = ['1.1.6']

// true quando o item NÃO deve pesar no avanço físico
export function ehCustoDeTempo(item) {
  const g = item.g ?? item.grupo_num
  const eap = item.i ?? item.codigo_eap
  return g > GRUPO_MAX_EVM || EAP_CUSTO_DE_TEMPO.includes(eap)
}

// Fora do ACWP: desembolso de pré-obra, não é custo de produção.
export const PREFIXOS_PRE_OBRA = ['19.1.20', '19.1.13', '19.1.12', '19.1.10', '19.1.14', '19.1.22']

export const PAVIMENTOS = [
  'Fundação', 'Subsolo', 'Pilotis', 'Térreo',
  '1º Pav', '2º Pav', '3º Pav', 'Terraço', 'Reservatório',
  'Edifício', 'Externo', 'Canteiro',
]

export const CORES = {
  verde: '#4D9B6A', amarelo: '#C8860A', vermelho: '#B03030',
  azul: '#5B9BD5', rosa: '#E91E8C', roxo: '#9B59B6',
}

// ---- FORMATADORES ----
export function fmtMoeda(v) {
  if (v == null || isNaN(v)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v)
}

export function fmtMoedaK(v) {
  if (v == null || isNaN(v)) return '—'
  if (Math.abs(v) >= 1e6) return 'R$\u00a0' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'M'
  return 'R$\u00a0' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + 'k'
}

export function fmtPct(v, casas = 1) {
  if (v == null || isNaN(v)) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%'
}

export function fmtDate(s) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR')
}

// ---- CALENDÁRIO SEMANAL ----
const MS_DIA = 86400000

// Segunda-feira da semana N (Date)
export function inicioSemana(n) {
  const d = new Date(OBRA.s1 + 'T12:00:00')
  d.setDate(d.getDate() + (n - 1) * 7)
  return d
}

export function fimSemana(n) {
  const d = inicioSemana(n)
  d.setDate(d.getDate() + 6)
  return d
}

const dm = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')

// "S07 · 14/09 a 20/09"
export function semanaLabel(n) {
  return `S${String(n).padStart(2, '0')} · ${dm(inicioSemana(n))} a ${dm(fimSemana(n))}`
}

// "S07" curto, para eixo de gráfico
export function semanaCurta(n) { return 'S' + n }

// Mês a que a semana pertence — usado para agrupar o seletor
export function mesDaSemana(n) {
  return inicioSemana(n).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

// Data (YYYY-MM-DD) -> número da semana da obra. Fora do intervalo devolve null.
export function dataParaSemana(iso) {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00')
  const base = new Date(OBRA.s1 + 'T12:00:00')
  const n = Math.floor((d - base) / (7 * MS_DIA)) + 1
  return n >= 1 ? n : null
}

// Semana corrente da obra (1..prazo). Antes da S01 devolve 1.
export function semanaAtualObra() {
  const n = dataParaSemana(new Date().toISOString().slice(0, 10)) || 1
  return Math.max(1, Math.min(n, OBRA.prazo_semanas))
}
