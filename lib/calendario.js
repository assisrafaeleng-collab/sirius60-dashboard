// Calendário de semanas da obra, num lugar só (igual ao Flats, lib/calendario.js).
//
// Calendário ATIVO:
//   - 'tabela'    : calendario_semanas do banco (semanas reais, segunda a domingo, cortadas no fim do mês;
//                   CLAUDE.md, 08/10/2026) e o planejado de curva_s_semanal_planejada;
//   - 'calculado' : enquanto a tabela não existir, o cálculo antigo (semanas corridas de 7 dias a partir de S01,
//                   96 semanas). É o fallback: com ele o site fica exatamente como antes.
// O servidor carrega com lib/calendario-servidor.js; o navegador recebe pela /api/calendario (pages/_app.js).
// Este arquivo não acessa o banco: serve ao servidor e ao navegador.

const S1 = '2026-08-03'
const PRAZO_ANTIGO = 96
const MS_DIA = 86400000

const iso10 = (v) => String(v || '').slice(0, 10)
export const addDias = (iso, n) => {
  const [y, m, d] = iso10(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  // Date.UTC na entrada e na saída: sem passar pelo fuso local
  return new Date(Date.UTC(y, m - 1, d) + n * MS_DIA).toISOString().slice(0, 10)
}
export const diasEntre = (a, b) => Math.round((Date.parse(iso10(b)) - Date.parse(iso10(a))) / MS_DIA) + 1

export function calendarioAntigo() {
  const semanas = []
  for (let n = 1; n <= PRAZO_ANTIGO; n++) {
    const data_inicio = addDias(S1, 7 * (n - 1))
    semanas.push({ semana: n, data_inicio, data_fim: addDias(data_inicio, 6), dias: 7, competencia: data_inicio.slice(0, 7) })
  }
  return { fonte: 'calculado', semanas, curva: null }
}

let ativo = calendarioAntigo()

// Troca o calendário ativo (ex.: o que veio da /api/calendario). Dado inválido mantém o atual.
export function usarCalendario(c) {
  if (!c || !Array.isArray(c.semanas) || !c.semanas.length) return ativo
  const semanas = c.semanas
    .map((x) => ({ ...x, semana: parseInt(x.semana ?? x.semana_numero, 10), data_inicio: iso10(x.data_inicio), data_fim: iso10(x.data_fim) }))
    .filter((x) => Number.isFinite(x.semana) && x.data_inicio && x.data_fim)
    .sort((a, b) => a.semana - b.semana)
  semanas.forEach((x) => {
    x.dias = parseInt(x.dias, 10) || diasEntre(x.data_inicio, x.data_fim)   // número sempre (texto somaria errado)
    x.competencia = x.competencia || x.data_inicio.slice(0, 7)
  })
  ativo = { fonte: c.fonte || 'tabela', semanas, curva: Array.isArray(c.curva) && c.curva.length ? c.curva : null }
  return ativo
}
export const calendario = () => ativo
export const totalSemanas = () => ativo.semanas.length

// Datas da semana n ('AAAA-MM-DD'). Fora do calendário estende de 7 em 7 dias (como o cálculo antigo).
export function datasDaSemana(n) {
  const s = ativo.semanas
  const x = s[n - 1] && s[n - 1].semana === n ? s[n - 1] : s.find((y) => y.semana === n)
  if (x) return { data_inicio: x.data_inicio, data_fim: x.data_fim }
  const ult = s[s.length - 1]
  if (n > ult.semana) {
    const ini = addDias(ult.data_fim, 1 + 7 * (n - ult.semana - 1))
    return { data_inicio: ini, data_fim: addDias(ini, 6) }
  }
  const ini = addDias(s[0].data_inicio, -7 * (s[0].semana - n))
  return { data_inicio: ini, data_fim: addDias(ini, 6) }
}

// Data -> número da semana. Antes da S01: null. Depois do fim: continua contando de 7 em 7 dias.
export function semanaDaData(iso) {
  const d = iso10(iso)
  if (!d) return null
  const s = ativo.semanas
  if (ativo.fonte === 'calculado') {
    // exatamente o cálculo antigo (lib/constants.js antes do calendário)
    const n = Math.floor((Date.parse(d) - Date.parse(S1)) / (7 * MS_DIA)) + 1
    return n >= 1 ? n : null
  }
  if (d < s[0].data_inicio) return null
  const x = s.find((y) => y.data_inicio <= d && d <= y.data_fim)
  if (x) return x.semana
  const ult = s[s.length - 1]
  // dias depois do fim do calendário (diasEntre conta o próprio data_fim): 1–7 → +1, 8–14 → +2...
  return ult.semana + Math.ceil((diasEntre(ult.data_fim, d) - 1) / 7)
}

// Competência ('AAAA-MM') da semana: no calendário real é a do mês a que a semana pertence.
export const competenciaDaSemana = (n) => {
  const x = ativo.semanas.find((y) => y.semana === n)
  return x ? x.competencia : datasDaSemana(n).data_inicio.slice(0, 7)
}

// Planejado semanal a partir do calendário real (só quando há curva_s_semanal_planejada):
//   físico     = horas do cronograma (perc_hh_semanal / perc_hh_acum), regra do avanço físico (horas);
//   financeiro = valor da curva (linhas de serviço ligadas ao cronograma) + custo de tempo direto (1.1.6, grupos
//                17 e 18) e indiretos, cada um espalhado pelos DIAS das suas semanas (regra do Flats).
// Devolve as linhas no mesmo formato das views v_curva_s_fisica_planejada e v_curva_s_financeira_planejada.
export function planejadoDoCalendario(diretos, indiretos, ehCustoDeTempo) {
  const cal = ativo
  if (!cal.curva) return null
  const N = cal.semanas.length
  const dias = cal.semanas.map((x) => x.dias)
  const dir = new Array(N).fill(0), ind = new Array(N).fill(0)
  const espalhar = (alvo, valor, a, b) => {
    a = Math.max(1, a | 0); b = Math.min(N, b | 0)
    if (!(valor > 0) || b < a) return
    let tot = 0
    for (let k = a; k <= b; k++) tot += dias[k - 1]
    for (let k = a; k <= b; k++) alvo[k - 1] += valor * dias[k - 1] / tot
  }
  diretos.filter((i) => ehCustoDeTempo(i)).forEach((i) => espalhar(dir, parseFloat(i.preco_total || 0), i.semana_inicio, i.semana_fim))
  indiretos.forEach((i) => espalhar(ind, parseFloat(i.valor_total || 0), i.semana_desembolso, i.semana_fim ?? i.semana_desembolso))
  const porSemana = new Map(cal.curva.map((c) => [parseInt(c.semana_numero, 10), c]))
  const r2 = (v) => Math.round(v * 100) / 100
  const finPlan = [], fisPlan = []
  let aT = 0, aD = 0
  for (let k = 1; k <= N; k++) {
    const c = porSemana.get(k)
    const d = dir[k - 1] + (c ? parseFloat(c.valor_semanal || 0) : 0)
    const t = d + ind[k - 1]
    aT += t; aD += d
    finPlan.push({ semana_numero: k, valor_semanal: r2(t), valor_direto: r2(d), valor_acumulado: r2(aT), valor_direto_acumulado: r2(aD) })
    fisPlan.push({ semana_numero: k, percentual_semanal: c ? parseFloat(c.perc_hh_semanal || 0) : 0,
                   percentual_acumulado: c ? parseFloat(c.perc_hh_acum || 0) : (fisPlan.length ? fisPlan[fisPlan.length - 1].percentual_acumulado : 0) })
  }
  return { finPlan, fisPlan }
}
