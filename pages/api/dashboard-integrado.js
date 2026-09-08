import { supabase } from '../../lib/supabase'
import { OBRA, GRUPO_MAX_EVM, PREFIXOS_PRE_OBRA, EAP_CUSTO_DE_TEMPO, dataParaSemana, inicioSemana, fimSemana } from '../../lib/constants'

const PRAZO = OBRA.prazo_semanas   // 96

// Um lançamento vira semana pela data da nota (dd/mm/aaaa).
// Sem data_emissao, cai na competência.
function semanaDoLancamento(l) {
  return dataParaSemana(l.data_emissao) ?? dataParaSemana(l.competencia)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const obra_id = req.query.obra_id || OBRA.id
  const semLimite = Math.min(Math.max(parseInt(req.query.semana) || PRAZO, 1), PRAZO)

  try {
    const [finPlanRes, fisPlanRes, custosRes, horasRes, avancoRes, indPlanRes, dirPlanRes] =
      await Promise.all([
        supabase.from('v_curva_s_financeira_planejada').select('*').eq('obra_id', obra_id).order('semana_numero'),
        supabase.from('v_curva_s_fisica_planejada').select('*').eq('obra_id', obra_id).order('semana_numero'),
        supabase.from('custos_lancamentos').select('competencia, data_emissao, valor, status, grupo_custo, codigo_eap, pavimento, fornecedor, historico').eq('obra_id', obra_id).order('data_emissao'),
        supabase.from('cronograma_horas_planejado').select('grupo_nome, horas_totais').eq('obra_id', obra_id),
        supabase.from('avanco_fisico_realizado').select('semana_numero, codigo_eap, pavimento, incremento_pct, medido_por').eq('obra_id', obra_id).lte('semana_numero', semLimite).order('semana_numero'),
        supabase.from('custos_indiretos_planejados').select('valor_total, recorrente, semana_desembolso, semana_fim').eq('obra_id', obra_id),
        supabase.from('orcamento_planejado').select('codigo_eap, pavimento, descricao, preco_total, hh, grupo_num, semana_inicio, semana_fim').eq('obra_id', obra_id),
      ])

    for (const r of [finPlanRes, fisPlanRes, custosRes, horasRes, avancoRes, indPlanRes, dirPlanRes]) {
      if (r.error) throw new Error(r.error.message)
    }

    const finPlan = finPlanRes.data || []
    const fisPlan = fisPlanRes.data || []
    const lancamentos = custosRes.data || []
    const horas = horasRes.data || []
    const avanco = avancoRes.data || []
    const indiretosPlan = indPlanRes.data || []
    const diretosPlan = dirPlanRes.data || []

    // ---------- BASES ORÇAMENTÁRIAS ----------
    const totalDiretos = diretosPlan.reduce((s, i) => s + parseFloat(i.preco_total || 0), 0)
    // produção: fora os grupos de tempo e a limpeza periódica
    const ehProducao = i => i.grupo_num <= GRUPO_MAX_EVM
      && !EAP_CUSTO_DE_TEMPO.includes(i.codigo_eap)
    const baseEVM = diretosPlan.filter(ehProducao)
      .reduce((s, i) => s + parseFloat(i.preco_total || 0), 0)
    const totalIndiretos = indiretosPlan.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0)
    const orcamentoTotal = totalDiretos + totalIndiretos

    // custo que corre com o tempo: apoio (G17/18) + indiretos recorrentes
    const apoio = diretosPlan
      .filter(i => i.grupo_num > GRUPO_MAX_EVM
        || EAP_CUSTO_DE_TEMPO.includes(i.codigo_eap))
      .reduce((s, i) => s + parseFloat(i.preco_total || 0), 0)
    const indRecorrente = indiretosPlan
      .filter(i => i.recorrente)
      .reduce((s, i) => s + parseFloat(i.valor_total || 0), 0)
    const recorrenteSemanal = (apoio + indRecorrente) / PRAZO
    const recorrenteMensal = recorrenteSemanal * (52 / 12)

    // ---------- REALIZADO FINANCEIRO (semana da data da nota) ----------
    const pagos = lancamentos.filter(l => {
      const s = (l.status || '').toLowerCase()
      return s !== 'cancelado' && s !== 'previsto'
    })
    const porSem = {}
    pagos.forEach(l => {
      const sem = semanaDoLancamento(l)
      if (!sem || sem < 1 || sem > semLimite) return
      const eap = l.codigo_eap || ''
      const ind = eap.startsWith('19.')
      const preObra = PREFIXOS_PRE_OBRA.some(p => eap.startsWith(p))
      const v = parseFloat(l.valor || 0)
      if (!porSem[sem]) porSem[sem] = { total: 0, direto: 0, indireto: 0, producao: 0 }
      porSem[sem].total += v
      if (ind) porSem[sem].indireto += v
      else porSem[sem].direto += v
      if (!preObra) porSem[sem].producao += v      // ACWP: fora pré-obra
    })

    const finReal = []
    let aT = 0, aD = 0, aI = 0, aP = 0
    Object.keys(porSem).map(Number).sort((a, b) => a - b).forEach(s => {
      aT += porSem[s].total; aD += porSem[s].direto
      aI += porSem[s].indireto; aP += porSem[s].producao
      finReal.push({
        semana_numero: s,
        valor_semanal: porSem[s].total, valor_acumulado: aT,
        valor_direto: aD, valor_indireto: aI, valor_producao: aP,
      })
    })
    const ult = finReal.length ? finReal[finReal.length - 1] : null

    // ---------- REALIZADO FÍSICO ----------
    // Cada medição guarda o percentual ACUMULADO de um serviço num pavimento.
    // O avanço global pondera pelo CUSTO do item — a mesma régua da curva
    // planejada. Somar percentuais de semanas diferentes daria número errado.
    const chave = (eap, pav) => `${eap}|${pav}`
    const pesos = {}, pesosHH = {}
    let pesoTotal = 0, pesoHHTotal = 0
    diretosPlan.filter(ehProducao).forEach(i => {
      const k = chave(i.codigo_eap, i.pavimento)
      const v = parseFloat(i.preco_total || 0)
      const h = parseFloat(i.hh || 0)
      pesos[k] = (pesos[k] || 0) + v
      pesosHH[k] = (pesosHH[k] || 0) + h
      pesoTotal += v; pesoHHTotal += h
    })

    // fração do prazo já decorrida de um item na semana
    const fracPlan = (i, S) => {
      if (S >= i.semana_fim) return 1
      if (S < i.semana_inicio) return 0
      return (S - i.semana_inicio + 1) / (i.semana_fim - i.semana_inicio + 1)
    }
    // avanço PLANEJADO ponderado por horas (o por custo vem da view)
    const planHHate = S => {
      const feito = diretosPlan.filter(ehProducao)
        .reduce((acc, i) => acc + parseFloat(i.hh || 0) * fracPlan(i, S), 0)
      return pesoHHTotal > 0 ? 100 * feito / pesoHHTotal : 0
    }

    // por semana: qual o percentual mais recente de cada serviço até ali
    const semanasMedidas = [...new Set(avanco.map(a => a.semana_numero))].sort((a, b) => a - b)
    const ultimoPct = {}
    const fisReal = []
    semanasMedidas.forEach(sem => {
      // lançamentos são incrementais: somam ao que já havia, com teto de 100%
      avanco.filter(a => a.semana_numero === sem).forEach(a => {
        const k = chave(a.codigo_eap, a.pavimento)
        ultimoPct[k] = Math.min((ultimoPct[k] || 0) + parseFloat(a.incremento_pct || 0), 100)
      })
      let agregado = 0, agregadoHH = 0
      for (const k in ultimoPct) {
        agregado   += (pesos[k]   || 0) * ultimoPct[k] / 100
        agregadoHH += (pesosHH[k] || 0) * ultimoPct[k] / 100
      }
      fisReal.push({
        semana_numero: sem,
        percentual_acumulado: pesoTotal > 0 ? Math.min(100 * agregado / pesoTotal, 100) : 0,
        percentual_hh: pesoHHTotal > 0 ? Math.min(100 * agregadoHH / pesoHHTotal, 100) : 0,
      })
    })

    // avanço por pavimento na semana do filtro (alimenta o mapa de pavimentos)
    const porPav = {}
    for (const k in ultimoPct) {
      const pav = k.split('|')[1]
      if (!porPav[pav]) porPav[pav] = { feito: 0, total: 0 }
      porPav[pav].feito += (pesos[k] || 0) * ultimoPct[k] / 100
    }
    diretosPlan.filter(ehProducao).forEach(i => {
      const pav = i.pavimento
      if (!porPav[pav]) porPav[pav] = { feito: 0, total: 0 }
      porPav[pav].total += parseFloat(i.preco_total || 0)
    })
    const avancoPorPavimento = Object.entries(porPav).map(([pav, v]) => ({
      pavimento: pav,
      percentual: v.total > 0 ? +(100 * v.feito / v.total).toFixed(2) : 0,
      custo_total: +v.total.toFixed(2),
    })).sort((a, b) => b.custo_total - a.custo_total)

    // planejado acumulado até a semana selecionada
    const finPlanAte = finPlan.find(f => f.semana_numero === semLimite)
      || finPlan[finPlan.length - 1]
    const diretoPlanAte = finPlanAte ? parseFloat(finPlanAte.valor_direto_acumulado) : 0
    const indiretoPlanAte = finPlanAte
      ? parseFloat(finPlanAte.valor_acumulado) - diretoPlanAte : 0

    // ---------- EVM ----------
    // A referência é SEMPRE a semana do filtro (data de status do relatório),
    // não a da última medição. Semana sem medição significa progresso não
    // comprovado, e é assim que o EVM deve tratar: o SPI cai.
    const semRef = semLimite
    const fisPlanRef = fisPlan.find(f => f.semana_numero === semRef) || fisPlan[fisPlan.length - 1]
    const pctPlan = fisPlanRef ? parseFloat(fisPlanRef.percentual_acumulado) : 0
    const pctReal = fisReal.length ? fisReal[fisReal.length - 1].percentual_acumulado : 0

    const pctPlanHH = planHHate(semRef)
    const pctRealHH = fisReal.length ? fisReal[fisReal.length - 1].percentual_hh : 0

    const bcws = (pctPlan / 100) * baseEVM
    const bcwp = (pctReal / 100) * baseEVM
    const acwp = ult ? ult.valor_producao : 0

    // Índices só ganham sentido com massa de dados. Em base semanal o ruído
    // é maior no começo, por isso exigimos pelo menos 12 semanas medidas.
    const SEM_MIN_INDICE = 12
    const temDados = acwp > 0 && pctReal > 0 && semRef >= SEM_MIN_INDICE
    const cpi = temDados ? bcwp / acwp : null
    const spi = (temDados && bcws > 0) ? bcwp / bcws : null
    const cv = bcwp - acwp
    const sv = bcwp - bcws
    const eac = (cpi && cpi > 0) ? baseEVM / cpi : baseEVM
    const saldoReal = baseEVM - eac
    const saldoAparente = baseEVM - acwp

    // ---------- PROJEÇÃO DE PRAZO (cenário realista) ----------
    const spiRealista = spi ? (spi + 1) / 2 : 1
    const prazoRealista = Math.min((PRAZO / Math.min(spiRealista, 1)) * 1.15, 260)
    const atrasoSemanas = Math.max(0, prazoRealista - PRAZO)
    const custoAtraso = atrasoSemanas * recorrenteSemanal
    const eacTotal = eac + totalIndiretos + custoAtraso

    const dConcl = fimSemana(Math.min(Math.ceil(prazoRealista), 260))
    const dPlan = new Date(OBRA.fim_planejado + 'T12:00:00')
    const desvioDias = Math.round((dConcl - dPlan) / 86400000)

    const semAtual = Math.max(
      finReal.length ? finReal[finReal.length - 1].semana_numero : 0,
      fisReal.length ? fisReal[fisReal.length - 1].semana_numero : 0, 1)

    // ---------- COMPARATIVO PREVISTO x REALIZADO ----------
    // Previsto de um item até a semana S: se já terminou, o valor cheio;
    // se ainda não começou, zero; se está em curso, a fração proporcional
    // das semanas decorridas. É o mesmo rateio linear das views.
    function previstoAte(item, S) {
      const ini = item.semana_inicio, fim = item.semana_fim
      const v = parseFloat(item.preco_total || 0)
      if (S >= fim) return v
      if (S < ini) return 0
      return v * (S - ini + 1) / (fim - ini + 1)
    }

    // realizado por código EAP (o lançamento aponta para a EAP, não p/ pavimento)
    const realPorEap = {}
    pagos.forEach(l => {
      const sem = semanaDoLancamento(l)
      if (!sem || sem > semLimite) return
      const eap = l.codigo_eap || '(sem EAP)'
      realPorEap[eap] = (realPorEap[eap] || 0) + parseFloat(l.valor || 0)
    })

    const prevPorEap = {}
    diretosPlan.forEach(i => {
      const e = i.codigo_eap
      if (!prevPorEap[e]) {
        prevPorEap[e] = {
          codigo_eap: e, descricao: i.descricao,
          grupo_num: i.grupo_num, grupo_nome: i.grupo_nome,
          previsto: 0, orcado: 0,
        }
      }
      prevPorEap[e].previsto += previstoAte(i, semLimite)
      prevPorEap[e].orcado += parseFloat(i.preco_total || 0)
    })

    const comparativo = Object.values(prevPorEap).map(x => {
      const real = realPorEap[x.codigo_eap] || 0
      const saldo = x.previsto - real
      return {
        ...x,
        previsto: +x.previsto.toFixed(2),
        orcado: +x.orcado.toFixed(2),
        realizado: +real.toFixed(2),
        saldo: +saldo.toFixed(2),
        // % do previsto que foi consumido. Acima de 100 = gastou mais que o previsto.
        consumo_pct: x.previsto > 0 ? +(100 * real / x.previsto).toFixed(1) : null,
      }
    }).filter(x => x.previsto > 0 || x.realizado > 0)
      .sort((a, b) => b.previsto - a.previsto)

    // lançamentos sem EAP correspondente no orçamento
    const eapsConhecidas = new Set(Object.keys(prevPorEap))
    Object.entries(realPorEap).forEach(([e, v]) => {
      if (!eapsConhecidas.has(e)) {
        comparativo.push({
          codigo_eap: e, descricao: 'Fora do orçamento', grupo_num: 99,
          grupo_nome: 'Sem classificação', previsto: 0, orcado: 0,
          realizado: +v.toFixed(2), saldo: -(+v.toFixed(2)), consumo_pct: null,
        })
      }
    })

    const realizadoTotal = pagos.reduce((acc, l) => {
      const sem = semanaDoLancamento(l)
      return (sem && sem <= semLimite) ? acc + parseFloat(l.valor || 0) : acc
    }, 0)

    // ---------- CURVAS ALINHADAS ----------
    // Planejadas sempre de S01 a S96; realizadas param no filtro.
    const semanas = []
    for (let i = 1; i <= PRAZO; i++) {
      const fp = finPlan.find(f => f.semana_numero === i)
      const sp = fisPlan.find(f => f.semana_numero === i)
      const fr = finReal.filter(f => f.semana_numero <= i).pop()
      const sr = fisReal.filter(f => f.semana_numero <= i).pop()
      semanas.push({
        semana_numero: i,
        financeiro_planejado: fp ? parseFloat(fp.valor_direto_acumulado) : null,
        financeiro_realizado: (i <= semLimite && fr) ? fr.valor_direto : null,
        fisico_planejado: sp ? parseFloat(sp.percentual_acumulado) : null,
        fisico_realizado: (i <= semLimite && sr) ? sr.percentual_acumulado : null,
        hh_planejado: +planHHate(i).toFixed(3),
        hh_realizado: (i <= semLimite && sr) ? sr.percentual_hh : null,
      })
    }

    return res.status(200).json({
      kpis: {
        orcamento_total: orcamentoTotal,
        custo_direto_total: totalDiretos,
        custo_indireto_total: totalIndiretos,
        base_evm: baseEVM,
        custo_realizado: ult ? ult.valor_acumulado : 0,
        custo_direto_realizado: ult ? ult.valor_direto : 0,
        custo_indireto_realizado: ult ? ult.valor_indireto : 0,
        custo_direto_planejado_ate: +diretoPlanAte.toFixed(2),
        custo_indireto_planejado_ate: +indiretoPlanAte.toFixed(2),
        tem_medicao: fisReal.length > 0,
        previsto_ate: +(diretoPlanAte + indiretoPlanAte).toFixed(2),
        realizado_ate: +realizadoTotal.toFixed(2),
        saldo_financeiro: +(diretoPlanAte + indiretoPlanAte - realizadoTotal).toFixed(2),
        saldo_pct: (diretoPlanAte + indiretoPlanAte) > 0
          ? +(100 * (diretoPlanAte + indiretoPlanAte - realizadoTotal)
              / (diretoPlanAte + indiretoPlanAte)).toFixed(1) : null,
        avanco_fisico_planejado: pctPlan,
        avanco_hh_planejado: +pctPlanHH.toFixed(2),
        avanco_hh_realizado: +pctRealHH.toFixed(2),
        desvio_hh: fisReal.length ? +(pctRealHH - pctPlanHH).toFixed(2) : null,
        base_horas: +pesoHHTotal.toFixed(1),
        avanco_fisico_realizado: pctReal,
        desvio_fisico: fisReal.length ? +(pctReal - pctPlan).toFixed(2) : null,
        bcws: +bcws.toFixed(2), bcwp: +bcwp.toFixed(2), acwp: +acwp.toFixed(2),
        cpi: cpi != null ? +cpi.toFixed(3) : null,
        spi: spi != null ? +spi.toFixed(3) : null,
        cv: +cv.toFixed(2), sv: +sv.toFixed(2),
        eac: +eac.toFixed(2), eac_total: +eacTotal.toFixed(2),
        saldo_real: +saldoReal.toFixed(2), saldo_aparente: +saldoAparente.toFixed(2),
        recorrente_semanal: +recorrenteSemanal.toFixed(2),
        recorrente_mensal: +recorrenteMensal.toFixed(2),
        prazo_projetado_semanas: +prazoRealista.toFixed(1),
        atraso_semanas: +atrasoSemanas.toFixed(1),
        custo_atraso: +custoAtraso.toFixed(2),
        projecao_data_conclusao: dConcl.toISOString().slice(0, 10),
        desvio_prazo_dias: desvioDias,
        semana_atual: semAtual,
        ultima_semana_medida: fisReal.length
          ? fisReal[fisReal.length - 1].semana_numero : null,
        tem_dados: temDados,
        semanas_para_indice: Math.max(0, SEM_MIN_INDICE - semRef),
      },
      curvas: {
        financeiro_planejado: finPlan, financeiro_realizado: finReal,
        fisico_planejado: fisPlan, fisico_realizado: fisReal,
      },
      semanas_alinhadas: semanas,
      avanco_por_pavimento: avancoPorPavimento,
      comparativo,
      metadata: {
        obra_id, prazo_semanas: PRAZO, semana_limite: semLimite,
        lancamentos: lancamentos.length, medicoes: avanco.length,
      },
    })
  } catch (e) {
    console.error('dashboard-integrado:', e)
    return res.status(500).json({ error: 'Erro ao buscar dados', message: e.message })
  }
}
