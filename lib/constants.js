// ============================================================
// CONSTANTES DA OBRA — Residencial Sirius 60 (Mariana/MG)
// BASE SEMANAL: S01 = segunda 03/08/2026. As semanas vêm do calendário
// ativo (lib/calendario.js): a tabela calendario_semanas (semanas reais,
// cortadas no fim do mês) ou, enquanto ela não existir, o cálculo antigo
// (96 semanas de 7 dias). Alterou orçamento ou cronograma? Mexa AQUI.
// ============================================================
import { calendario, totalSemanas, datasDaSemana, semanaDaData, competenciaDaSemana } from './calendario'

export const OBRA = {
  id: 'sirius60',
  nome: 'Residencial Sirius 60',
  cidade: 'Mariana/MG',
  area_total: 2622,
  unidades: 13,
  s1: '2026-08-03',        // segunda-feira da S01
  // número de semanas e fim da obra pelo calendário ativo (antes: 96 semanas, 04/06/2028)
  get prazo_semanas() { return totalSemanas() },
  get fim_planejado() { const s = calendario().semanas; return s[s.length - 1].data_fim },
}

// ---- ORÇAMENTO ----
// Os totais de custo NÃO ficam fixos aqui: vêm do banco (orcamento_planejado e
// custos_indiretos_planejados), pela /api/orcamento e pela /api/dashboard-integrado.
// (O antigo CUSTO fixo, do Orçamento 03-08-26, não era usado por nenhuma tela.)

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

// Valores cheios com 2 casas (R$ 538.876,08) e percentual com 1 casa (34,2%): cópia do fmtMoeda e do fmtP do
// Flats (lib/constants.js e pages/valor-agregado.js de lá). Usados no valor agregado / custos diretos e nos cards.
export function fmtMoeda2(v) {
  if (v == null || isNaN(v)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}
export const fmtP1 = (v) => (v == null || isNaN(v) ? '—' : `${Number(v).toFixed(1).replace('.', ',')}%`)

// Cores da tela de valor agregado do Flats (pages/valor-agregado.js de lá)
export const CORES_VA = {
  agregado: '#6e8ba8',   // valor agregado (e a regra de linha que não é medição própria)
  economia: '#7fb08a',   // verde
  estouro: '#c77b74',    // vermelho (estouro, % do orçado acima de 100, saldo negativo)
  aPagar: '#c9a45c',     // âmbar: valor a pagar
}

// Abreviado: R$ 2,16M · R$ 98k · abaixo de R$ 1.000 em reais inteiros (R$ 394), nunca "R$ 0k"
export function fmtMoedaK(v) {
  if (v == null || isNaN(v)) return '—'
  if (Math.abs(v) >= 1e6) return 'R$\u00a0' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'M'
  // 999,60 arredonda para "R$ 1.000": a partir daí vale o "k"
  if (Math.abs(Math.round(v)) < 1000) return 'R$\u00a0' + Math.round(v).toLocaleString('pt-BR')
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

// Primeiro e último dia da semana N (Date ao meio-dia, para não virar o dia em nenhum fuso)
export function inicioSemana(n) {
  return new Date(datasDaSemana(n).data_inicio + 'T12:00:00')
}

export function fimSemana(n) {
  return new Date(datasDaSemana(n).data_fim + 'T12:00:00')
}

const dm = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')

// "S07 · 14/09 a 20/09"
export function semanaLabel(n) {
  return `S${String(n).padStart(2, '0')} · ${dm(inicioSemana(n))} a ${dm(fimSemana(n))}`
}

// "S07" curto, para eixo de gráfico
export function semanaCurta(n) { return 'S' + n }

// Mês a que a semana pertence — usado para agrupar o seletor. No calendário real é a competência da semana.
export function mesDaSemana(n) {
  return new Date(competenciaDaSemana(n) + '-15T12:00:00')
    .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
}

// Semanas agrupadas por mês, para os seletores: [{ mes: 'out de 26', semanas: [10, 11, ...] }]
export function semanasPorMes() {
  const grupos = []
  for (let s = 1; s <= OBRA.prazo_semanas; s++) {
    const m = mesDaSemana(s)
    if (!grupos.length || grupos[grupos.length - 1].mes !== m) grupos.push({ mes: m, semanas: [] })
    grupos[grupos.length - 1].semanas.push(s)
  }
  return grupos
}

// Data (YYYY-MM-DD) -> número da semana da obra pelo calendário ativo. Antes da S01 devolve null.
export function dataParaSemana(iso) {
  return semanaDaData(iso)
}

// Data de hoje (YYYY-MM-DD) no fuso da obra. toISOString() usa UTC: das 21h
// à meia-noite de Brasília ele já devolve o dia seguinte (e na Vercel o
// servidor roda em UTC). 'en-CA' formata direto como AAAA-MM-DD.
export function hojeSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// Semana corrente da obra (1..prazo). Antes da S01 devolve 1.
export function semanaAtualObra() {
  const n = dataParaSemana(hojeSaoPaulo()) || 1
  return Math.max(1, Math.min(n, OBRA.prazo_semanas))
}
