// IPC, IDP e projeções de custo final (pedido 14E; lógica do Flats: lib/painel-semanal.js §5a e pages/semanal.js
// de lá, com os três cenários definidos pelo Rafael em 09/10/2026). Este arquivo não acessa o banco.
//
// Índices (custo DIRETO, semana do filtro):
//   IPC = valor agregado ÷ custo comprometido (pago + a pagar)          > 1 economia · < 1 estouro
//   IDP = avanço físico realizado ÷ avanço físico planejado (horas)     > 1 adiantado · < 1 atrasado
//         É o PRINCIPAL, como no Flats (lá: "IDP pelo avanço físico em Hh"; em reais, locação e custo de tempo
//         entrariam como avanço e distorceriam o prazo). O IDP em valor (valor agregado ÷ planejado da curva do
//         direto) fica como informação.
// IDP, projeções e término: SEMPRE na semana da ÚLTIMA MEDIÇÃO (Rafael 09/10; realizado e planejado da mesma semana);
// o card IPC usa o custo até a semana do filtro. Sem medição nova, a projeção não muda.
// Cenários do custo direto (falta = orçado − valor agregado; nomes na tela, Rafael 09/10):
//   otimista   "O restante sai pelo orçamento" = comprometido + falta
//   tendencia  "Mantém a eficiência atual"     = orçado ÷ IPC (é o "otimista" do Flats; pouco confiável com
//              menos de 15% de avanço físico)
//   pessimista "Pessimista (custo e prazo)"    = comprometido + falta ÷ (IPC × IDP), IDP limitado a 1
// Indireto (igual nos três): realizado (pago + a pagar) + planejado restante:
//   recorrente: verba − planejado até a semana (diluído pelos dias até o fim da obra); planejado passado e não pago
//               fica fora (PENDENTE no CLAUDE.md: recorrentes sem lançamento até 09/2026)
//   pontual   : verba − realizado, se positivo (não pago = verba inteira; pago em parte = o saldo ainda será pago)
//   reserva (19.1.25): à parte; só o usado entra na projeção, o resto aparece como "reserva, se houver necessidade"
// Término: pelo adiantamento (o do card "Adiantamento", que o Flats usa) e, como informação, pelo IDP
// (duração ÷ IDP a partir do início da obra).

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
const r2 = (v) => Math.round(num(v) * 100) / 100
const MS_DIA = 864e5
const diaDe = (iso) => Date.parse(String(iso).slice(0, 10) + 'T12:00:00Z') / MS_DIA
const isoDe = (dia) => new Date(Math.round(dia) * MS_DIA).toISOString().slice(0, 10)   // dia inteiro em UTC (sem fuso)

export function calcularIndices({ agregado, comprometido, planejadoDireto, avancoReal, avancoPlan }) {
  const ipc = agregado > 0 && comprometido > 0 ? agregado / comprometido : null
  const idp = avancoReal != null && avancoPlan > 0 && avancoReal > 0 ? avancoReal / avancoPlan : null
  const idpValor = agregado > 0 && planejadoDireto > 0 ? agregado / planejadoDireto : null
  return { ipc, idp, idp_valor: idpValor }
}

// categorias: linhas de /api/indiretos (valor_total, acumulado, pago, a_pagar, recorrente, reserva)
export function projetarIndireto(categorias) {
  const out = { realizado: 0, restante_recorrente: 0, restante_pontual: 0, reserva_verba: 0, reserva_usada: 0,
    verba_sem_reserva: 0, itens: [] }
  ;(categorias || []).forEach((c) => {
    const verba = num(c.valor_total), plan = num(c.acumulado), real = num(c.pago) + num(c.a_pagar)
    let restante = 0, regra
    if (c.reserva) {
      out.reserva_verba += verba
      out.reserva_usada += real
      regra = 'reserva: só o usado'
    } else if (c.recorrente) {
      restante = Math.max(verba - plan, 0)
      out.restante_recorrente += restante
      out.verba_sem_reserva += verba
      regra = 'recorrente: verba − planejado até a semana'
    } else {
      restante = Math.max(verba - real, 0)
      out.restante_pontual += restante
      out.verba_sem_reserva += verba
      regra = real > 0.005 ? (restante > 0.005 ? 'pontual pago em parte: saldo da verba' : 'pontual pago') : 'pontual não pago: verba inteira'
    }
    out.realizado += real
    out.itens.push({ codigo_eap: c.codigo_eap, categoria: c.categoria, verba: r2(verba), realizado: r2(real),
      restante: r2(restante), projecao: r2(real + restante), regra })
  })
  const projecao = out.realizado + out.restante_recorrente + out.restante_pontual
  return {
    ...out,
    realizado: r2(out.realizado), restante_recorrente: r2(out.restante_recorrente), restante_pontual: r2(out.restante_pontual),
    reserva_verba: r2(out.reserva_verba), reserva_usada: r2(out.reserva_usada), verba_sem_reserva: r2(out.verba_sem_reserva),
    reserva_livre: r2(Math.max(out.reserva_verba - out.reserva_usada, 0)),
    projecao: r2(projecao),
  }
}

export function calcularProjecoes({ orcadoDireto, agregado, comprometido, indices, indireto, orcamentoTotal }) {
  const { ipc, idp } = indices
  if (ipc == null || idp == null || !(orcadoDireto > 0)) return null
  const falta = orcadoDireto - agregado
  const idpPess = Math.min(idp, 1)
  const direto = {
    otimista: comprometido + falta,
    tendencia: orcadoDireto / ipc,
    pessimista: comprometido + falta / (ipc * idpPess),
  }
  const ind = indireto ? indireto.projecao : null
  const cenarios = {}
  Object.keys(direto).forEach((k) => {
    const d = direto[k]
    const total = ind == null ? null : d + ind
    cenarios[k] = {
      direto: r2(d), saldo_direto: r2(orcadoDireto - d),
      total: total == null ? null : r2(total),
      saldo_total: total == null ? null : r2(orcamentoTotal - total),
      saldo_total_pct: total == null || !(orcamentoTotal > 0) ? null : r2(100 * (orcamentoTotal - total) / orcamentoTotal),
    }
  })
  return { orcado_direto: r2(orcadoDireto), agregado: r2(agregado), comprometido: r2(comprometido), falta: r2(falta),
    ipc, idp, idp_pessimista: idpPess, indireto: ind, orcamento_total: r2(orcamentoTotal), cenarios }
}

// Término pelo IDP: a obra leva duração ÷ IDP dias, contados do início
export function terminoPorIdp(inicio, fim, idp) {
  if (!(idp > 0) || !inicio || !fim) return null
  const dur = diaDe(fim) - diaDe(inicio) + 1
  const novo = dur / idp
  return { duracao_dias: dur, duracao_projetada: Math.round(novo), dias: Math.round(novo - dur),
    termino: isoDe(diaDe(inicio) + novo - 1) }
}
