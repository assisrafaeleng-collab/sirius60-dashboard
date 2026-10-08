// Carrega o calendário da obra no SERVIDOR (rotas em pages/api), com a chave secreta.
// Tabelas novas (supabase/semanas/1-calendario.sql): calendario_semanas e curva_s_semanal_planejada.
// Enquanto não existirem, fica o cálculo antigo (lib/calendario.js) e o site funciona como antes: assim o
// código pode ser promovido ANTES de o SQL rodar.
import { usarCalendario, calendarioAntigo, calendario } from './calendario'
import { OBRA } from './constants'

if (typeof window !== 'undefined') {
  throw new Error('lib/calendario-servidor.js é só para o servidor (pages/api).')
}

const VALIDADE_MS = 5 * 60 * 1000     // o calendário quase nunca muda: lê de novo a cada 5 minutos
let lidoEm = 0

const naoExiste = (e) => /does not exist|could not find the table|schema cache/i.test(String(e && e.message))

export async function carregarCalendario(supabase, { forcar = false } = {}) {
  if (!forcar && Date.now() - lidoEm < VALIDADE_MS) return calendario()
  try {
    const cal = await supabase.from('calendario_semanas')
      .select('semana_numero, data_inicio, data_fim, dias, competencia, semana_do_mes, fechamento, label')
      .eq('obra_id', OBRA.id).order('semana_numero')
    if (cal.error) {
      if (!naoExiste(cal.error)) console.error('calendario_semanas:', cal.error.message)
      usarCalendario(calendarioAntigo())
    } else if (!cal.data || !cal.data.length) {
      usarCalendario(calendarioAntigo())
    } else {
      const cur = await supabase.from('curva_s_semanal_planejada')
        .select('semana_numero, competencia, hh_semanal, perc_hh_semanal, perc_hh_acum, valor_semanal, valor_acum, perc_valor_acum')
        .eq('obra_id', OBRA.id).order('semana_numero')
      if (cur.error && !naoExiste(cur.error)) console.error('curva_s_semanal_planejada:', cur.error.message)
      usarCalendario({ fonte: 'tabela', semanas: cal.data, curva: cur.error ? null : cur.data })
    }
  } catch (e) {
    console.error('calendário:', e.message)
    usarCalendario(calendarioAntigo())
  }
  lidoEm = Date.now()
  return calendario()
}
