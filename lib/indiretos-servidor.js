// Custos indiretos planejados no SERVIDOR (pages/api), com o tipo "reserva" (pedido 14A, Rafael 09/10/2026).
//
// RESERVA: verba que talvez nem seja usada (ex.: 19.1.25 "Mão de obra de apoio (se houver necessidade)", que veio
// do grupo 18). O planejado NÃO é diluído: planejado = realizado (pago + a pagar), limitado à verba. Fica neutra
// ("reserva · N% da verba usada") e só gera estouro quando o realizado passa da verba.
// A coluna custos_indiretos_planejados.reserva vem do supabase/orcamento/6-grupo18-para-indireto.sql; sem ela
// (antes do SQL), nenhuma linha é reserva e tudo funciona como antes.
import { OBRA } from './constants'
import { naoExiste } from './medicao-servidor'

if (typeof window !== 'undefined') {
  throw new Error('lib/indiretos-servidor.js é só para o servidor (pages/api).')
}

export async function lerIndiretosPlanejados(supabase, campos) {
  let r = await supabase.from('custos_indiretos_planejados').select(campos + ', reserva').eq('obra_id', OBRA.id).order('id')
  if (r.error && naoExiste(r.error)) {
    r = await supabase.from('custos_indiretos_planejados').select(campos).eq('obra_id', OBRA.id).order('id')
  }
  if (r.error) throw new Error(`custos_indiretos_planejados: ${r.error.message}`)
  return (r.data || []).map((i) => ({ ...i, reserva: i.reserva === true }))
}

// planejado de uma reserva = realizado (pago + a pagar) limitado à verba
export const planejadoReserva = (verba, realizado) => Math.min(Math.max(realizado, 0), Math.max(verba, 0))
