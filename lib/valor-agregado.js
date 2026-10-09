// Valor agregado do custo direto, linha a linha (pedido 13; lógica copiada do Flats: lib/painel-semanal.js,
// lib/valor-agregado.js e lib/medicao-linha.js de lá). Este arquivo não acessa o banco.
//
// Tipos de linha (grupos 1 a 18; o 19 é indireto e não entra):
//   servico  grupos 1–16 com medição própria: agregado = orçado × último % medido da linha (código + pavimento)
//   material linha ligada a serviço(s) em orcamento_material_servico (e_material): sem medição própria; herda o %
//            do(s) serviço(s) pelo peso. Agregado = o MAIOR entre (a) % herdado × orçado e (b) custo comprometido
//            (pago + a pagar) limitado ao orçado. Material comprado antes da execução fica neutro; o que passa do
//            orçado aparece como estouro. Concreto usinado segue a concretagem (decisão do Rafael, 08/10/2026).
//   locacao  grupo 17: agregado = gasto (pago) limitado à verba ("neutro · XX% da verba")
//   tempo    1.1.6 e grupo 18: agregado = verba × dias decorridos da obra ÷ dias totais (medição é ignorada)
// Avanço físico = horas executadas ÷ horas orçadas, nas linhas de produção (grupos 1–16, fora a 1.1.6); o
// material conta as horas dele pelo % herdado (CLAUDE.md: regra de horas, nunca ponderado por valor).
// Custo comprometido = pago (títulos pagos até o fim da semana) + a pagar do último fechamento até a semana.
//
// VERBA DE FORMA (pedido 14A, Rafael 09/10/2026): a madeira de forma é reaproveitada (até 3 usos) em toda a
// estrutura, então as 13 linhas de MATERIAL de forma (inclusive forma de escada) formam UMA verba:
//   custo: tudo que foi pago / a pagar em qualquer uma delas é o "gasto da verba"; cada linha mostra
//          gasto × (orçado da linha ÷ verba). Os lançamentos continuam gravados na linha original (só cálculo).
//   valor agregado: % do serviço vinculado × orçado da linha, SEM o crédito de compra antecipada.
// As linhas vão por ID (conferidas em 09/10 por e_material + vínculo com o serviço de forma/escada; não pelo texto).
// Linha da lista que não for material vinculado é ignorada (a regra só vale para material).
import { chaveLinha, ordenarRetratos, percentuaisAte, heranca } from './medicao'

export const VERBA_FORMA_IDS = [669, 677, 686, 689, 698, 701, 710, 712, 720, 723, 732, 739, 746]

const GRUPO_MAX_PRODUCAO = 16
const EAP_TEMPO = ['1.1.6']
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export function tipoDaLinha(o, ehMaterial) {
  const g = num(o.grupo_num)
  if (EAP_TEMPO.includes(o.codigo_eap) || g === 18) return 'tempo'
  if (g === 17) return 'locacao'
  if (ehMaterial) return 'material'
  return 'servico'
}
export const ehProducao = (o) => num(o.grupo_num) <= GRUPO_MAX_PRODUCAO && !EAP_TEMPO.includes(o.codigo_eap)

// dias de calendário até o fim da semana S, e fração planejada (linear pelos dias) de uma linha
function preparaDias(semanas) {
  const acum = [0]
  semanas.forEach((s) => acum.push(acum[acum.length - 1] + (num(s.dias) || 7)))
  const ate = (k) => acum[Math.max(0, Math.min(k, semanas.length))]
  return { ate, total: acum[acum.length - 1] }
}
function fracaoPlanejada(o, S, dias) {
  const a = parseInt(o.semana_inicio, 10), b = parseInt(o.semana_fim, 10)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  if (S >= b) return 1
  if (S < a) return 0
  const tot = dias.ate(b) - dias.ate(a - 1)
  return tot > 0 ? (dias.ate(S) - dias.ate(a - 1)) / tot : 0
}

// Rateio de um valor de uma EAP entre as linhas dela: pavimento informado e existente -> a linha daquele
// pavimento; senão, entre as linhas da EAP pelo orçado. Devolve [{ id, valor }] ou null (EAP fora do orçamento).
export function ratear(porEap, eap, pavimento, valor) {
  const linhas = porEap[eap]
  if (!linhas || !linhas.length) return null
  const daqui = pavimento ? linhas.filter((l) => l.pavimento === pavimento) : []
  const alvo = daqui.length ? daqui : linhas
  const peso = alvo.reduce((t, l) => t + l.preco_total, 0)
  return alvo.map((l) => ({ id: l.id, valor: peso > 0 ? valor * l.preco_total / peso : valor / alvo.length }))
}

// orcamento: linhas diretas (grupos 1–18) com id, codigo_eap, pavimento, descricao, preco_total, hh, grupo_num,
//   grupo_nome, semana_inicio, semana_fim, unidade, quantidade
// vinculos: [{ material_id, servico_id, peso }]; retratos: de lib/medicao-servidor (percentual acumulado)
// pagos: [{ codigo_eap, pavimento, valor }] já cortados até o fim da semana; aPagar: idem (direto, não recorrente)
// semanas: calendário ativo (dias por semana); curvaPerc: % de horas planejado acumulado na semana S (ou null)
export function calcularValorAgregado({ orcamento, vinculos = [], retratos = [], pagos = [], aPagar = [], semana: S,
  semanas, curvaPerc = null }) {
  const dias = preparaDias(semanas)
  const fracTempo = dias.total > 0 ? Math.min(dias.ate(S) / dias.total, 1) : 0
  const materiais = new Set(vinculos.map((v) => v.material_id))
  const linhas = orcamento.filter((o) => num(o.grupo_num) >= 1 && num(o.grupo_num) <= 18)
  const porId = new Map(linhas.map((o) => [o.id, o]))

  // medição: último % de cada linha até S; material herda por id do serviço
  const perc = percentuaisAte(ordenarRetratos(retratos), S)
  const percPorId = {}
  linhas.forEach((o) => {
    const m = perc[chaveLinha(o.codigo_eap, o.pavimento)]
    percPorId[o.id] = m ? Math.min(Math.max(m.percentual, 0), 100) : 0
  })
  const herdado = heranca(vinculos, percPorId)
  const herdaDe = {}
  vinculos.forEach((v) => {
    const s = porId.get(v.servico_id)
    ;(herdaDe[v.material_id] = herdaDe[v.material_id] || []).push({
      id: v.servico_id, codigo_eap: s ? s.codigo_eap : v.servico_codigo, pavimento: s ? s.pavimento : v.servico_pavimento, peso: v.peso,
      // memória (pedido 14E): % do serviço e de que medição veio
      percentual: r2(percPorId[v.servico_id] || 0), ...(() => {
        const ms = s ? perc[chaveLinha(s.codigo_eap, s.pavimento)] : null
        return { semana_medida: ms ? ms.semana : null, data_medida: ms && ms.data ? String(ms.data).slice(0, 10) : null }
      })(),
    })
  })

  // custo por linha
  const porEap = {}
  linhas.forEach((o) => (porEap[o.codigo_eap] = porEap[o.codigo_eap] || []).push(o))
  const pagoPorId = {}, aPagarPorId = {}
  const fora = {}
  const distribuir = (lista, alvo, campo) => lista.forEach((l) => {
    const eap = l.codigo_eap || '(sem EAP)'
    if (String(eap).startsWith('19.')) return            // indireto
    const partes = ratear(porEap, eap, l.pavimento, num(l.valor))
    if (!partes) {
      if (!fora[eap]) fora[eap] = { codigo_eap: eap, pago: 0, a_pagar: 0 }
      fora[eap][campo] += num(l.valor)
      return
    }
    partes.forEach((p) => (alvo[p.id] = (alvo[p.id] || 0) + p.valor))
  })
  distribuir(pagos, pagoPorId, 'pago')
  distribuir(aPagar, aPagarPorId, 'a_pagar')

  // verba de forma: junta o pago / a pagar das 13 linhas e reparte pelo orçado de cada uma
  const forma = VERBA_FORMA_IDS.filter((id) => porId.has(id) && materiais.has(id))
  const verbaForma = forma.reduce((t, id) => t + num(porId.get(id).preco_total), 0)
  const fatorForma = {}
  const gastoForma = { pago: 0, a_pagar: 0 }
  if (verbaForma > 0) {
    forma.forEach((id) => {
      gastoForma.pago += pagoPorId[id] || 0
      gastoForma.a_pagar += aPagarPorId[id] || 0
    })
    forma.forEach((id) => { fatorForma[id] = num(porId.get(id).preco_total) / verbaForma })
    // reparte em centavos e põe a sobra do arredondamento na maior linha: a soma fecha com o gasto da verba
    const repartir = (total, alvo) => {
      let resto = r2(total)
      forma.forEach((id) => { alvo[id] = r2(total * fatorForma[id]); resto = r2(resto - alvo[id]) })
      if (Math.abs(resto) > 0) {
        const maior = forma.reduce((m, id) => (fatorForma[id] > fatorForma[m] ? id : m), forma[0])
        alvo[maior] = r2(alvo[maior] + resto)
      }
    }
    repartir(gastoForma.pago, pagoPorId)
    repartir(gastoForma.a_pagar, aPagarPorId)
  }

  const out = linhas.map((o) => {
    const ehMat = materiais.has(o.id)
    const tipo = tipoDaLinha(o, ehMat)
    const orcado = num(o.preco_total), hh = num(o.hh)
    const producao = ehProducao(o)
    // planejado: horas da janela da linha + horas em outra janela (orcamento_horas_janela, SQL 7), pelos dias
    const janelasExtra = o.janelas_extra || []
    const hhExtra = janelasExtra.reduce((t, x) => t + num(x.hh), 0)
    const hhPlanLinha = (num(o.hh) - hhExtra) * fracaoPlanejada(o, S, dias)
      + janelasExtra.reduce((t, x) => t + num(x.hh) * fracaoPlanejada(x, S, dias), 0)
    const fPlan = janelasExtra.length && num(o.hh) > 0 ? hhPlanLinha / num(o.hh) : fracaoPlanejada(o, S, dias)
    const pago = pagoPorId[o.id] || 0, ap = aPagarPorId[o.id] || 0
    const comprometido = pago + ap
    const m = perc[chaveLinha(o.codigo_eap, o.pavimento)]
    let percReal, agregado, extra = {}
    if (tipo === 'tempo') {
      percReal = fracTempo * 100
      agregado = orcado * fracTempo
    } else if (tipo === 'locacao') {
      agregado = Math.min(pago, orcado)
      percReal = orcado > 0 ? 100 * pago / orcado : null          // % da verba gasto
      extra = { perc_verba: percReal == null ? null : r2(percReal) }
    } else if (tipo === 'material' && fatorForma[o.id] != null) {
      // verba de forma: só o % do serviço (sem compra antecipada); o custo já veio rateado da verba
      percReal = Math.min(herdado[o.id] || 0, 100)
      agregado = orcado * percReal / 100
      extra = { heranca: r2(agregado), material_comprado: false, herda_de: herdaDe[o.id] || [],
        verba_forma: true, verba_forma_pct: r2(100 * fatorForma[o.id]), verba_forma_fracao: fatorForma[o.id] }
    } else if (tipo === 'material') {
      percReal = Math.min(herdado[o.id] || 0, 100)
      const porHeranca = orcado * percReal / 100
      const porCusto = Math.min(comprometido, orcado)
      agregado = Math.max(porHeranca, porCusto)
      extra = { heranca: r2(porHeranca), material_comprado: porCusto > porHeranca + 0.005, herda_de: herdaDe[o.id] || [] }
    } else {
      percReal = percPorId[o.id]
      agregado = orcado * percReal / 100
    }
    const hhExec = producao && percReal != null && (tipo === 'servico' || tipo === 'material') ? hh * percReal / 100 : 0
    return {
      id: o.id, codigo_eap: o.codigo_eap, pavimento: o.pavimento, descricao: o.descricao, grupo_num: num(o.grupo_num),
      grupo_nome: o.grupo_nome, unidade: o.unidade || '', quantidade: num(o.quantidade),
      semana_inicio: o.semana_inicio, semana_fim: o.semana_fim, janelas_extra: janelasExtra, tipo, producao,
      orcado: r2(orcado), hh: r2(hh), perc_plan: r2(fPlan * 100), hh_plan: producao ? r2(hh * fPlan) : 0,
      perc_real: percReal == null ? null : r2(percReal), medido: tipo === 'servico' && !!m,
      semana_medida: tipo === 'servico' && m ? m.semana : null,
      data_medida: tipo === 'servico' && m && m.data ? String(m.data).slice(0, 10) : null,
      hh_exec: r2(hhExec), agregado: r2(agregado), pago: r2(pago), a_pagar: r2(ap), comprometido: r2(comprometido),
      perc_orcado: orcado > 0 ? r2(100 * comprometido / orcado) : null,
      desvio: r2(agregado - comprometido),                    // + economia / − estouro
      desvio_pct: agregado > 0 ? r2(100 * (agregado - comprometido) / agregado) : (comprometido > 0 ? -100 : null),
      saldo_verba: r2(orcado - comprometido), plan_valor: r2(orcado * fPlan),
      ...extra,
    }
  })

  const foraLista = Object.values(fora).map((f) => ({ ...f, pago: r2(f.pago), a_pagar: r2(f.a_pagar) }))
  const soma = (lista, campo) => lista.reduce((t, l) => t + num(l[campo]), 0)
  const prod = out.filter((l) => l.producao)
  const hhTotal = soma(prod, 'hh'), hhExec = soma(prod, 'hh_exec'), hhPlan = soma(prod, 'hh_plan')
  const pagoFora = soma(foraLista, 'pago'), apFora = soma(foraLista, 'a_pagar')
  const porTipo = {}
  ;['servico', 'material', 'locacao', 'tempo'].forEach((t) => {
    const ls = out.filter((l) => l.tipo === t)
    porTipo[t] = { linhas: ls.length, orcado: r2(soma(ls, 'orcado')), agregado: r2(soma(ls, 'agregado')), comprometido: r2(soma(ls, 'comprometido')) }
  })
  const agregadoTotal = soma(out, 'agregado')
  const pagoTotal = soma(out, 'pago') + pagoFora
  const apTotal = soma(out, 'a_pagar') + apFora
  return {
    semana: S,
    linhas: out,
    fora_orcamento: foraLista,
    totais: {
      orcado: r2(soma(out, 'orcado')), agregado: r2(agregadoTotal), pago: r2(pagoTotal), a_pagar: r2(apTotal),
      comprometido: r2(pagoTotal + apTotal), saldo: r2(agregadoTotal - pagoTotal - apTotal),
      plan_valor: r2(soma(out, 'plan_valor')), por_tipo: porTipo,
      // verba de forma (material): verba | gasto | valor agregado (soma das linhas da verba)
      verba_forma: (() => {
        const ls = out.filter((l) => l.verba_forma)
        const ag = soma(ls, 'agregado'), pg = gastoForma.pago, ap = gastoForma.a_pagar
        return { linhas: ls.length, ids: ls.map((l) => l.id), verba: r2(verbaForma), pago: r2(pg), a_pagar: r2(ap),
          gasto: r2(pg + ap), agregado: r2(ag), estouro: r2(pg + ap - ag), saldo: r2(verbaForma - pg - ap) }
      })(),
    },
    avanco: {
      hh_total: r2(hhTotal), hh_exec: r2(hhExec), hh_plan_linear: r2(hhPlan),
      realizado: hhTotal > 0 ? r2(100 * hhExec / hhTotal) : 0,
      planejado: curvaPerc != null ? r2(curvaPerc) : (hhTotal > 0 ? r2(100 * hhPlan / hhTotal) : 0),
      planejado_fonte: curvaPerc != null ? 'curva' : 'linear',
      fracao_tempo: r2(fracTempo * 100),
      dias_decorridos: dias.ate(S), dias_obra: dias.total,     // memória do custo de tempo (pedido 14E)
    },
  }
}
