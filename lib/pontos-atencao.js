// Painel "Pontos de atenção — próxima semana e próximos 30 dias" (pedido 14B, decisões do Rafael 09/10/2026).
// Conta pura (não acessa o banco): recebe as linhas do painel (lib/valor-agregado.js), o calendário e as tabelas de
// planejamento (índices, equipes, prazos de compra, jornada, feriados) e devolve atividades, insumos, compras e resumo.
//
// REGRA DE OURO: nenhum índice, equipe ou prazo inventado. Sem dado → "dado pendente" (e a lista de pendências).
//   Índice (Hh por unidade): tabela indice_produtividade, por id da linha (cronograma quando a atividade do cronograma
//     é uma linha só; CPU do Flats por serviço quando o cronograma agrupa; unidade diferente → pendente).
//   Equipe: equipe_padrao pelo tipo da linha (indice_produtividade.tipo_equipe).
//   Capacidade de UMA equipe no horizonte = pessoas × horas/dia × dias úteis (jornada e feriados das tabelas; sem elas,
//     8 h/dia, segunda a sexta, feriados nacionais).
//   Dois cenários por horizonte (Rafael 09/10): (a) MANTER O RITMO = o que o cronograma prevê dentro do período
//     (planejado no fim − planejado hoje; o que já foi adiantado não conta de novo); (b) RECUPERAR O ATRASO = atraso de
//     hoje (planejado hoje − realizado) diluído nos próximos 30 dias — na próxima semana entra a fração dos dias úteis
//     (≈ 1/4), nunca concentrado. Total = a + b. Equipes = horas ÷ capacidade de uma equipe, para cima.
//   Alerta "cronograma curto": horas pelo índice real (quantidade × índice, ou duração) > horas que o cronograma deu à
//     linha → "o cronograma prevê X h; pelo índice real são Y h (+Z%) — conferir duração".
//   Horas que faltam = quantidade que falta × índice (com índice do cronograma, igual a % × horas da linha); serviço
//     por DURAÇÃO (escada 80 Hh, piso polido 16 Hh, cobertura, canteiro, limpeza, urbanização; Rafael 09/10) = % que
//     falta × horas da linha (indice_produtividade.horas_total).
//   Compras: data de necessidade PROJETADA = início planejado deslocado pelo adiantamento/atraso atual da obra (o mesmo
//     cálculo do card "Adiantamento": semana em que a curva planejada atinge o realizado − semana da medição);
//     pedir até = projetada − antecedência. Recalcula sozinho a cada medição.
// Planejado da linha numa data = fração dos DIAS entre o início da semana_inicio e o fim da semana_fim (o mesmo
// critério linear do painel).

export const JORNADA_PADRAO = { horas_dia: 8, dias_semana: [1, 2, 3, 4, 5] }   // seg–sex (Rafael, 09/10)
// feriados (padrão sem a tabela obra_feriados): nacionais oficiais + municipais de Mariana. Carnaval e Corpus Christi são
// ponto facultativo e ficam de fora.
export const FERIADOS_NACIONAIS = [
  '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25',
  '2027-01-01', '2027-03-26', '2027-04-21', '2027-05-01', '2027-09-07', '2027-10-12', '2027-11-02', '2027-11-15',
  '2027-11-20', '2027-12-25',
  '2028-01-01', '2028-04-14', '2028-04-21', '2028-05-01',
  // municipais de Mariana confirmados pelo Rafael (09/10/2026): 08/12 e 16/07 (aniversário da cidade)
  '2026-12-08', '2027-07-16', '2027-12-08', '2028-07-16',
].sort()
// Adiantamento (igual ao card da Visão geral, components/Dashboard.jsx calcularAdiantamento): curva = [{semana_numero,
// perc_hh_acum}], real = % de horas executado na medição, semMed = semana da última medição. Dias > 0 = adiantado.
export function calcularAdiantamento(curva, semanas, real, semMed) {
  if (!curva || !(real > 0) || !semMed) return null
  const dia = (s) => t(s) / DIA
  const fimDe = (k) => semanas[k - 1].data_fim, iniDe = (k) => semanas[k - 1].data_inicio
  const cs = curva.map((c) => ({ semana: parseInt(c.semana_numero, 10), pl: Number(c.perc_hh_acum) || 0 })).sort((a, b) => a.semana - b.semana)
  for (let i = 0; i < cs.length; i += 1) {
    if (cs[i].pl < real) continue
    const ant = i > 0 ? cs[i - 1] : null, plAnt = ant ? ant.pl : 0
    const f = cs[i].pl - plAnt > 1e-9 ? (real - plAnt) / (cs[i].pl - plAnt) : 1
    const wAnt = ant ? ant.semana : cs[i].semana - 1
    const dAnt = ant ? dia(fimDe(ant.semana)) : dia(iniDe(cs[i].semana)) - 1
    const wEq = wAnt + f * (cs[i].semana - wAnt)
    const diaEq = dAnt + f * (dia(fimDe(cs[i].semana)) - dAnt)
    return { semanas: wEq - semMed, dias: Math.round(diaEq - dia(fimDe(semMed))), wEq, semMed, real }
  }
  return null
}

// alertas de quantidade grande (pedido 14B): concreto ≥ 10 m³ numa semana, aço ≥ 1 t
export const ALERTA_QTD = { 'm³': 10, m3: 10, kg: 1000 }

const DIA = 864e5
const iso = (d) => new Date(d).toISOString().slice(0, 10)          // datas puras (UTC), não horário
const t = (s) => Date.parse(String(s).slice(0, 10) + 'T00:00:00Z')
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100

export function diasUteis(de, ate, jornada, feriados) {
  const fer = new Set(feriados)
  let n = 0
  for (let x = t(de); x <= t(ate); x += DIA) {
    const dow = new Date(x).getUTCDay()               // 0 = domingo
    if (jornada.dias_semana.includes(dow === 0 ? 7 : dow) && !fer.has(iso(x))) n++
  }
  return n
}

// data do n-ésimo dia útil a partir de "de" (inclusive); n = 0 → null
export function somarDiasUteis(de, n, jornada, feriados) {
  if (!(n > 0)) return null
  const fer = new Set(feriados)
  let k = 0
  for (let x = t(de); k < 4000; x += DIA, k++) {
    const dow = new Date(x).getUTCDay()
    if (jornada.dias_semana.includes(dow === 0 ? 7 : dow) && !fer.has(iso(x)) && --n === 0) return iso(x)
  }
  return null
}

// TÉRMINO de uma atividade (pedido 14C, igual para tudo; usado no servidor e na tela, ao editar):
//   horas que faltam = (100% − concluído) × quantidade × índice  (serviço por duração: × horas da linha)
//   capacidade/dia de 1 equipe = pessoas × horas/dia; data-alvo = fim no cronograma (já passou → hoje + 30 dias)
//   equipes sugeridas = horas ÷ (capacidade/dia × dias úteis até a data-alvo), para cima
//   término com N equipes = hoje + horas ÷ (N × capacidade/dia) dias úteis; cumpre se ≤ fim do cronograma
export function calcularTermino({ quantidade, real, indice, horasTotal, pessoas, equipes, fimCrono, hoje, jornada, feriados }) {
  const base = horasTotal != null ? Number(horasTotal) : indice != null && indice !== '' ? Number(quantidade) * Number(indice) : null
  const horas = base == null ? null : (Math.max(100 - (real || 0), 0) / 100) * base
  const capDia = pessoas > 0 ? pessoas * jornada.horas_dia : null
  const amanha = iso(t(hoje) + DIA)
  const alvo = fimCrono && fimCrono > hoje ? fimCrono : iso(t(hoje) + 30 * DIA)
  const diasAlvo = diasUteis(amanha, alvo, jornada, feriados)
  const sugeridas = horas == null || !capDia ? null : horas <= 0 ? 0 : Math.max(1, Math.ceil(horas / (capDia * Math.max(diasAlvo, 1)) - 1e-9))
  const definida = equipes != null && equipes !== ''
  const usadas = definida ? Number(equipes) : sugeridas
  // equipes necessárias (com fração) para terminar exatamente na data-alvo: base do caixa quando a equipe é só sugerida
  const necessarias = horas == null || !capDia ? null : horas <= 0 ? 0 : horas / (capDia * Math.max(diasAlvo, 1))
  const dias = horas == null || !capDia || !(usadas > 0) ? null : Math.ceil(horas / (usadas * capDia) - 1e-9)
  const termino = dias ? somarDiasUteis(amanha, dias, jornada, feriados) : dias === 0 ? hoje : null
  const cumpre = termino && fimCrono ? termino <= fimCrono : null
  const atrasa = termino && fimCrono && !cumpre ? diasUteis(iso(t(fimCrono) + DIA), termino, jornada, feriados) : 0
  return { horas: horas == null ? null : r1(horas), base: base == null ? null : r1(base), capacidade_dia: capDia, alvo,
    dias_ate_alvo: diasAlvo, sugeridas, usadas, definida, necessarias, dias, termino, cumpre, atrasa }
}

// Equipes do CAIXA (Rafael 09/10): definidas (salvas ou digitadas na tela) → o nº inteiro, o mesmo do término; só
// sugeridas → as necessárias para terminar na data-alvo, com fração (1 equipe inteira terminaria a atividade muito antes
// do cronograma e puxaria serviço e material para agora).
export function equipesDoCaixa(t) {
  return t.definida ? t.usadas : t.necessarias
}

// RITMO ATUAL (pedido 14D): % concluído ÷ dias úteis desde o início real (1ª medição da linha, quando há mais de uma;
// com uma só ou nenhuma, o início planejado) até a última medição. Fim no ritmo = última medição + (100% − concluído)
// ÷ ritmo, em dias úteis. Sem medição: "não iniciada" (e "deveria ter começado em" se o início planejado já passou).
export function ritmoAtual({ real, medicoes = [], inicioPlan, fimCrono, hoje, jornada, feriados }) {
  const ms = medicoes.filter((m) => m.data && m.data <= hoje).sort((a, b) => a.data.localeCompare(b.data))
  if (!ms.length || !(real > 0)) {
    const deveria = inicioPlan && inicioPlan <= hoje ? inicioPlan : null
    return { nao_iniciada: true, deveria_desde: deveria,
      atrasa: deveria ? diasUteis(deveria, hoje, jornada, feriados) : 0 }
  }
  const comAvanco = ms.filter((m) => m.percentual > 0)
  const inicio = comAvanco.length > 1 ? comAvanco[0].data : inicioPlan || comAvanco[0].data
  const ultima = ms[ms.length - 1].data
  const du = Math.max(diasUteis(inicio, ultima, jornada, feriados), 1)
  const ritmo = real / du                                    // % por dia útil
  if (real >= 100) return { inicio_real: inicio, ultima, ritmo: r2(ritmo), fim_ritmo: ultima, atrasa: 0, cumpre: true }
  const falta = Math.ceil((100 - real) / ritmo - 1e-9)
  const fim = somarDiasUteis(iso(t(ultima) + DIA), falta, jornada, feriados)
  const cumpre = fimCrono ? fim <= fimCrono : null
  return { inicio_real: inicio, ultima, ritmo: r2(ritmo), fim_ritmo: fim, cumpre,
    atrasa: fimCrono && !cumpre ? diasUteis(iso(t(fimCrono) + DIA), fim, jornada, feriados) : 0 }
}

// % A EXECUTAR NO PERÍODO (correção do Rafael, 09/10): o caixa segue o MESMO plano das equipes da coluna de término.
//   (1) com equipes e índice (definidas: o nº inteiro; só sugeridas: as necessárias para terminar na data-alvo, com
//       fração — equipesDoCaixa): % = (equipes × pessoas × horas/dia × dias úteis do período)
//       ÷ horas por 1% (horas que faltam ÷ % que falta = horas da linha ÷ 100), limitado ao que falta
//   (2) sem equipe ou sem índice: ritmo do cronograma no período + atraso diluído em 30 dias (fração dos dias úteis do
//       período sobre os dias úteis dos 30 dias: 4/20, 5/20…), limitado ao que falta — nunca o atraso inteiro de uma vez
// Antes (pedido 14D) era (% planejado no fim do período − concluído), que jogava o atraso inteiro numa semana.
export function pctNoPeriodo({ real, planHoje, planFim, base, pessoas, equipes, diasPeriodo, diasMes, horasDia }) {
  const r = real || 0
  const falta = Math.max(100 - r, 0)
  const nEq = equipes != null && equipes !== '' ? Number(equipes) : null
  if (nEq != null && base > 0 && pessoas > 0) {
    const hh = nEq * pessoas * horasDia * diasPeriodo
    const porPct = base / 100
    return { pct: Math.min(falta, hh / porPct), modo: 'equipes', equipes: nEq, pessoas, horas_dia: horasDia,
      dias: diasPeriodo, hh, horas_por_pct: porPct, limitado: hh / porPct > falta }
  }
  const ritmo = Math.max((planFim || 0) - Math.max(planHoje || 0, r), 0)
  const atrasoTotal = Math.max((planHoje || 0) - r, 0)
  const frac = diasMes > 0 ? Math.min(diasPeriodo / diasMes, 1) : 1
  const atraso = atrasoTotal * frac
  return { pct: Math.min(falta, ritmo + atraso), modo: 'cronograma', ritmo, atraso, atraso_total: atrasoTotal,
    dias: diasPeriodo, dias_mes: diasMes, limitado: ritmo + atraso > falta }
}

// CAIXA DA ATIVIDADE no período = % × (orçado do serviço + orçado dos materiais vinculados), descontando o material já
// comprado além do executado (ex.: verba de forma já gasta, aço/concreto comprados à frente). materiais: [{orcado,
// excesso}] já multiplicados pelo peso do vínculo.
export function caixaAtividade({ pct, orcado, materiais = [] }) {
  const mo = (pct / 100) * (orcado || 0)
  const material = materiais.reduce((s, m) => s + Math.max((pct / 100) * m.orcado - m.excesso, 0), 0)
  return { mo: r2(mo), material: r2(material), total: r2(mo + material) }
}

// % planejado de uma linha no fim do dia "data" (linear pelos dias da janela da linha); com horas em outra janela
// (orcamento_horas_janela, SQL 7), a média ponderada das janelas pelas horas
export function planejadoNaData(linha, data, semanas) {
  const extra = linha.janelas_extra || []
  if (extra.length && linha.hh > 0) {
    const hhExtra = extra.reduce((t, x) => t + Number(x.hh), 0)
    const base = (linha.hh - hhExtra) * planejadoJanela(linha, data, semanas)
    return (base + extra.reduce((t, x) => t + Number(x.hh) * planejadoJanela(x, data, semanas), 0)) / linha.hh
  }
  return planejadoJanela(linha, data, semanas)
}
function planejadoJanela(linha, data, semanas) {
  const a = parseInt(linha.semana_inicio, 10), b = parseInt(linha.semana_fim, 10)
  const sa = semanas[a - 1], sb = semanas[b - 1]
  if (!sa || !sb) return 0
  const ini = t(sa.data_inicio), fim = t(sb.data_fim) + DIA, x = t(data) + DIA
  if (x <= ini) return 0
  if (x >= fim) return 100
  return (100 * (x - ini)) / (fim - ini)
}

export function montarPontosAtencao({ linhas, semanas, semana, indices = {}, equipes = {}, prazos = [],
  jornada = JORNADA_PADRAO, feriados = FERIADOS_NACIONAIS, curva = null, configurado = {}, avanco = null,
  medicoes = [], contas = [], indiretos = [] }) {
  const hoje = semanas[semana - 1].data_fim
  const h1 = { de: iso(t(hoje) + DIA), ate: iso(t(hoje) + 7 * DIA), rotulo: 'Próxima semana' }
  const h2 = { de: iso(t(hoje) + DIA), ate: iso(t(hoje) + 30 * DIA), rotulo: 'Próximos 30 dias' }
  ;[h1, h2].forEach((h) => { h.dias_uteis = diasUteis(h.de, h.ate, jornada, feriados) })
  const pendencias = []

  // medições por linha (código + pavimento), para o ritmo atual
  const medicoesDe = {}
  medicoes.forEach((m) => (medicoesDe[`${m.codigo_eap}|${m.pavimento}`] = medicoesDe[`${m.codigo_eap}|${m.pavimento}`] || [])
    .push({ data: String(m.data_lancamento || '').slice(0, 10), percentual: Number(m.percentual) || 0 }))
  // materiais vinculados a cada serviço (herda_de)
  const materiaisDe = {}
  linhas.forEach((l) => (l.herda_de || []).forEach((h) => (materiaisDe[h.id] = materiaisDe[h.id] || []).push({ ...l, peso: h.peso })))

  const atividades = []
  linhas.forEach((l) => {
    if (l.tipo !== 'servico' || !l.producao || !(l.hh > 0)) return
    const real = l.perc_real || 0
    const pHoje = planejadoNaData(l, hoje, semanas)
    const p1 = planejadoNaData(l, h1.ate, semanas), p2 = planejadoNaData(l, h2.ate, semanas)
    const atrasada = real < pHoje - 0.05
    if (!(p2 > pHoje + 1e-6) && !atrasada) return
    const ix = indices[l.id] || null
    // equipe: a informada na tela para a linha (oficiais + ajudantes) ou a padrão do tipo
    const eqLinha = ix && (ix.equipe_oficiais != null || ix.equipe_ajudantes != null)
      ? { pessoas: (Number(ix.equipe_oficiais) || 0) + (Number(ix.equipe_ajudantes) || 0), da_linha: true,
          composicao: `${Number(ix.equipe_oficiais) || 0} ${ix.equipe_funcao || 'oficial'} + ${Number(ix.equipe_ajudantes) || 0} ajudante${Number(ix.equipe_ajudantes) === 1 ? '' : 's'}` }
      : null
    const eq = eqLinha || (ix && ix.tipo_equipe ? equipes[ix.tipo_equipe] || null : null)
    const indice = ix && ix.hh_por_unidade != null ? Number(ix.hh_por_unidade) : null
    const horasTotal = ix && ix.horas_total != null ? Number(ix.horas_total) : null   // serviço por duração
    const q = Number(l.quantidade) || 0
    const status = atrasada ? 'ATRASADA' : pHoje <= 0 && real <= 0 ? 'A INICIAR' : real > pHoje + 0.05 ? 'ADIANTADA' : 'EM DIA'
    // horas da linha pelo índice real (100%): duração fixa ou quantidade × índice; null = pendente
    const baseH = horasTotal != null ? horasTotal : indice != null ? q * indice : null
    const atrasoPct = Math.max(pHoje - real, 0)
    const porHorizonte = (h, pFim) => {
      const ritmo = Math.max(pFim - Math.max(pHoje, real), 0)            // (a) previsto no período, sem repetir o adiantado
      const fracAtraso = h2.dias_uteis > 0 ? Math.min(h.dias_uteis / h2.dias_uteis, 1) : 1
      const atraso = atrasoPct * fracAtraso                               // (b) atraso diluído em 30 dias
      const conc = 100 - real
      const H = (pct) => (baseH == null ? null : (pct * baseH) / 100)
      const cap = eq ? eq.pessoas * jornada.horas_dia * h.dias_uteis : null
      const nEq = (x) => (cap && x != null ? (x > 0 ? Math.ceil(x / cap - 1e-9) : 0) : null)
      const hR = H(ritmo), hA = H(atraso), hT = hR == null ? null : hR + hA
      return { plan_fim: r1(pFim), ritmo: r1(ritmo), atraso: r1(atraso), total: r1(ritmo + atraso), falta_concluir: r1(conc),
        qtd_ritmo: r2((ritmo * q) / 100), qtd_atraso: r2((atraso * q) / 100), qtd_total: r2(((ritmo + atraso) * q) / 100),
        horas_ritmo: hR == null ? null : r1(hR), horas_atraso: hA == null ? null : r1(hA), horas: hT == null ? null : r1(hT),
        horas_concluir: H(conc) == null ? null : r1(H(conc)),
        horas_previstas: r1((Math.max(pFim - pHoje, 0) * l.hh) / 100), capacidade_equipe: cap,
        equipes_ritmo: nEq(hR), equipes_atraso: nEq(hA), equipes_total: nEq(hT), equipes_concluir: nEq(H(conc)) }
    }
    const insumos = (materiaisDe[l.id] || []).map((m) => {
      const falta2 = Math.max(p2 - real, 0)
      const qtd = (falta2 / 100) * (Number(m.quantidade) || 0) * (m.peso || 1)
      const und = (m.unidade || '').trim()
      const qtdSemana = (Math.max(p1 - real, 0) / 100) * (Number(m.quantidade) || 0) * (m.peso || 1)
      const lim = ALERTA_QTD[und.toLowerCase()]
      return { id: m.id, codigo_eap: m.codigo_eap, descricao: m.descricao, unidade: und, qtd_30d: r2(qtd), qtd_semana: r2(qtdSemana),
        alerta: lim != null && (qtdSemana >= lim || qtd >= lim)
          ? (und.toLowerCase().startsWith('m') ? 'programar entrega / reservar usina' : 'programar entrega') : null }
    })
    if (!ix || (indice == null && horasTotal == null)) pendencias.push({ tipo: 'índice', linha: `${l.codigo_eap} ${l.pavimento}`, dado: ix && ix.observacao ? ix.observacao : 'sem índice de produtividade' })
    if (!eq) pendencias.push({ tipo: 'equipe', linha: `${l.codigo_eap} ${l.pavimento}`, dado: ix && ix.tipo_equipe ? `equipe "${ix.tipo_equipe}" sem cadastro` : 'linha sem tipo de equipe' })
    const fimCrono = semanas[parseInt(l.semana_fim, 10) - 1] ? semanas[parseInt(l.semana_fim, 10) - 1].data_fim : null
    const iniCrono = semanas[parseInt(l.semana_inicio, 10) - 1] ? semanas[parseInt(l.semana_inicio, 10) - 1].data_inicio : null
    const termino = calcularTermino({ quantidade: q, real, indice, horasTotal, pessoas: eq ? eq.pessoas : null,
      equipes: ix ? ix.equipes_definidas : null, fimCrono, hoje, jornada, feriados })
    const ritmo = ritmoAtual({ real, medicoes: medicoesDe[`${l.codigo_eap}|${l.pavimento}`] || [], inicioPlan: iniCrono,
      fimCrono, hoje, jornada, feriados })
    // materiais vinculados para o caixa: orçado × peso e o que já foi comprado além do executado (× peso)
    const matsCaixa = (materiaisDe[l.id] || []).map((m) => {
      const peso = m.peso || 1, orc = Number(m.orcado) || 0
      const comprado = (Number(m.pago) || 0) + (Number(m.a_pagar) || 0)
      return { id: m.id, codigo_eap: m.codigo_eap, orcado: orc * peso, verba_forma: !!m.verba_forma,
        excesso: m.verba_forma ? 0 : Math.max(comprado - (orc * real) / 100, 0) * peso }
    })
    // caixa no período pelo MESMO plano das equipes do término (definidas ou sugeridas); sem equipe/índice, cronograma
    // + atraso diluído em 30 dias
    const caixaDe = (h, pFim) => {
      const per = pctNoPeriodo({ real, planHoje: pHoje, planFim: pFim, base: termino.base, pessoas: eq ? eq.pessoas : null,
        equipes: equipesDoCaixa(termino), diasPeriodo: h.dias_uteis, diasMes: h2.dias_uteis, horasDia: jornada.horas_dia })
      return { pct: per.pct, detalhe: per, ...caixaAtividade({ pct: per.pct, orcado: l.orcado, materiais: matsCaixa }) }
    }
    atividades.push({
      id: l.id, codigo_eap: l.codigo_eap, pavimento: l.pavimento,
      unidade: String((ix && ix.unidade) || l.unidade || '').trim(),   // unidade corrigida na tabela de índices (SQL 3)
      descricao: String(l.descricao || '').replace(/\s*—\s*custo no grupo 2\s*$/i, ''),
      inicio_crono: iniCrono, fim_crono: fimCrono, termino, equipes_definidas: ix ? ix.equipes_definidas ?? null : null,
      grupo_num: l.grupo_num, grupo_nome: l.grupo_nome, orcado: l.orcado, ritmo, materiais_caixa: matsCaixa,
      plan_fim_semana: r1(p1), plan_fim_mes: r1(p2), caixa_semana: caixaDe(h1, p1), caixa_mes: caixaDe(h2, p2),
      tipo_equipe: ix ? ix.tipo_equipe || '' : '', editado_por: ix ? ix.editado_por || null : null, editado_em: ix ? ix.editado_em || null : null,
      atrasada,
      na_semana: atrasada || (iniCrono && fimCrono && iniCrono <= h1.ate && fimCrono >= h1.de),
      em_30: atrasada || (iniCrono && fimCrono && iniCrono <= h2.ate && fimCrono >= h2.de),
      quantidade: q, hh: l.hh, status, real: r1(real), plan_hoje: r1(pHoje), atraso_horas: r1((Math.max(pHoje - real, 0) * l.hh) / 100),
      indice, horas_total: horasTotal, regra: ix ? ix.regra : null, indice_origem: ix ? ix.origem : null, indice_cronograma: ix && ix.hh_cronograma != null ? Number(ix.hh_cronograma) : null,
      conferir: !!(ix && ix.conferir), equipe: eq, semana: porHorizonte(h1, p1), mes: porHorizonte(h2, p2), insumos,
      cronograma_curto: baseH != null && baseH > l.hh * 1.0001
        ? { horas_cronograma: r1(l.hh), horas_indice: r1(baseH), excesso_pct: l.hh > 0 ? r1((100 * (baseH - l.hh)) / l.hh) : null } : null,
      no_h1: p1 > pHoje + 1e-6 || atrasada,
    })
  })
  // VERBA DE FORMA (pedido 14A): madeira comprada além do executado vale para a forma de qualquer pavimento. O excesso
  // da verba (gasto − valor agregado) abate o material de forma do caixa, em ordem de término no cronograma, sem
  // descontar duas vezes no mesmo período.
  const verba = linhas.filter((l) => l.verba_forma)
  const poolVerba = Math.max(verba.reduce((t, l) => t + (Number(l.pago) || 0) + (Number(l.a_pagar) || 0), 0)
    - verba.reduce((t, l) => t + (Number(l.agregado) || 0), 0), 0)
  ;[['caixa_semana', 'na_semana', 'materiais_semana'], ['caixa_mes', 'em_30', 'materiais_mes']].forEach(([cx, flag, campo]) => {
    let pool = poolVerba
    atividades.filter((a) => a[flag]).sort((a, b) => String(a.fim_crono).localeCompare(String(b.fim_crono))).forEach((a) => {
      const pct = a[cx].pct
      a[campo] = a.materiais_caixa.map((m) => {
        if (!m.verba_forma) return m
        const usa = Math.min(pool, (pct / 100) * m.orcado)
        pool -= usa
        return { ...m, excesso: usa }
      })
      a[cx] = { pct, detalhe: a[cx].detalhe, ...caixaAtividade({ pct, orcado: a.orcado, materiais: a[campo] }) }
    })
  })
  const ordemSt = { ATRASADA: 0, 'A INICIAR': 1, 'EM DIA': 2, ADIANTADA: 3 }
  atividades.sort((a, b) => ordemSt[a.status] - ordemSt[b.status] || b.atraso_horas - a.atraso_horas || a.plan_hoje - b.plan_hoje)

  // compras de prazo longo: a obra toda (não só o horizonte), pela data projetada
  const adiant = avanco ? calcularAdiantamento(curva, semanas, avanco.realizado, avanco.semana_medida) : null
  const desloc = adiant ? adiant.dias : 0
  const fimObra = semanas[semanas.length - 1].data_fim
  const linhaPorId = new Map(linhas.map((l) => [l.id, l]))
  const compras = prazos.map((p) => {
    const l = linhaPorId.get(Number(p.orcamento_id))
    const sIni = l ? semanas[parseInt(l.semana_inicio, 10) - 1] : null
    // planejado = início planejado da atividade; projetado = planejado − dias de adiantamento (atraso empurra)
    let planejado = sIni ? sIni.data_inicio : null
    if (p.regra === 'ultimo_mes') planejado = fimObra.slice(0, 8) + '01'
    let necessidade = planejado ? iso(t(planejado) - desloc * DIA) : null, pedirAte = null
    // último mês PROJETADO: desloca o fim da obra e pega o mês dele
    if (p.regra === 'ultimo_mes') { necessidade = iso(t(fimObra) - desloc * DIA).slice(0, 8) + '01'; pedirAte = necessidade }
    else if (p.antecedencia_dias != null && necessidade) pedirAte = iso(t(necessidade) - Number(p.antecedencia_dias) * DIA)
    const status = !pedirAte ? 'prazo pendente' : pedirAte < iso(t(hoje) + DIA) ? 'vencido'
      : pedirAte <= h1.ate ? 'vence na próxima semana' : pedirAte <= h2.ate ? 'vence em 30 dias' : 'no prazo'
    if (!pedirAte) pendencias.push({ tipo: 'prazo de compra', linha: `${p.codigo_eap} ${p.pavimento || ''}`.trim(), dado: 'prazo de entrega em branco' })
    return { ...p, descricao: p.descricao || (l && l.descricao), planejado, necessidade, pedir_ate: pedirAte, status,
      quantidade: l ? l.quantidade : null, unidade: l ? l.unidade : null }
  }).sort((a, b) => String(a.pedir_ate || '9999').localeCompare(String(b.pedir_ate || '9999')))

  // desembolso previsto (curva planejada), proporcional aos dias da semana dentro do horizonte
  const desembolso = (h) => {
    if (!curva) return null
    let v = 0
    curva.forEach((c) => {
      const s = semanas[parseInt(c.semana_numero, 10) - 1]
      if (!s) return
      const a = Math.max(t(s.data_inicio), t(h.de)), b = Math.min(t(s.data_fim), t(h.ate))
      if (b < a) return
      v += Number(c.valor_semanal || 0) * ((b - a) / DIA + 1) / ((t(s.data_fim) - t(s.data_inicio)) / DIA + 1)
    })
    return r2(v)
  }
  const resumo = (h, campo, so) => {
    const xs = atividades.filter(so)
    return {
      ...h, atividades: xs.length, atrasadas: xs.filter((a) => a.status === 'ATRASADA').length,
      a_iniciar: xs.filter((a) => a.status === 'A INICIAR').length,
      horas_ritmo: r1(xs.reduce((s, a) => s + (a[campo].horas_ritmo ?? 0), 0)),
      horas_atraso: r1(xs.reduce((s, a) => s + (a[campo].horas_atraso ?? 0), 0)),
      horas_necessarias: r1(xs.reduce((s, a) => s + (a[campo].horas ?? 0), 0)),
      horas_sem_indice: xs.filter((a) => a[campo].horas == null).length,
      horas_previstas: r1(xs.reduce((s, a) => s + a[campo].horas_previstas, 0)),
      equipes_ritmo: xs.reduce((s, a) => s + (a[campo].equipes_ritmo || 0), 0),
      equipes_atraso: xs.reduce((s, a) => s + (a[campo].equipes_atraso || 0), 0),
      equipes: xs.reduce((s, a) => s + (a[campo].equipes_total || 0), 0),
      sem_equipe: xs.filter((a) => a[campo].equipes_total == null).length,
      desembolso: desembolso(h),
      compras_vencidas: compras.filter((c) => c.status === 'vencido').length,
      compras_no_periodo: compras.filter((c) => c.pedir_ate && c.pedir_ate >= h.de && c.pedir_ate <= h.ate).length,
    }
  }
  const contasNo = (h) => contas.filter((c) => c.data_vencimento && String(c.data_vencimento).slice(0, 10) >= h.de
      && String(c.data_vencimento).slice(0, 10) <= h.ate)
    .map((c) => ({ fornecedor: c.fornecedor, codigo_eap: c.codigo_eap, vencimento: String(c.data_vencimento).slice(0, 10),
      documento: c.num_documento || '', parcela: c.parcela || '', valor: r2(Number(c.valor) || 0), classe: c.classe }))
  // caixa (Rafael 09/10): contas a pagar com vencimento DENTRO do período (vencido antes = pago, não entra); indiretos
  // recorrentes (sem a reserva) e pontuais planejados DENTRO do período, proporcionais aos dias da janela de cada um
  const indiretosNo = (h) => indiretos.filter((i) => !i.reserva).map((i) => {
    const sa = semanas[parseInt(i.semana_desembolso, 10) - 1], sb = semanas[parseInt(i.semana_fim ?? i.semana_desembolso, 10) - 1]
    if (!sa || !sb) return null
    const a = Math.max(t(sa.data_inicio), t(h.de)), b = Math.min(t(sb.data_fim), t(h.ate))
    const total = (t(sb.data_fim) - t(sa.data_inicio)) / DIA + 1
    const v = b < a ? 0 : (Number(i.valor_total) || 0) * ((b - a) / DIA + 1) / total
    return { codigo_eap: i.codigo_eap, categoria: i.categoria, tipo: i.recorrente ? 'recorrente' : 'pontual', valor: r2(v) }
  }).filter((x) => x && x.valor > 0.005)
  const caixa = {
    semana: { contas: contasNo(h1), indiretos: indiretosNo(h1), curva: desembolso(h1) },
    mes: { contas: contasNo(h2), indiretos: indiretosNo(h2), curva: desembolso(h2) },
  }
  const unicas = (ls) => Object.values(Object.fromEntries(ls.map((p) => [`${p.tipo}|${p.linha}|${p.dado}`, p])))
  return {
    semana, hoje, jornada, feriados, configurado, adiantamento: adiant, caixa,
    periodos: { semana: { de: h1.de, ate: h1.ate, dias_uteis: h1.dias_uteis }, mes: { de: h2.de, ate: h2.ate, dias_uteis: h2.dias_uteis } },
    topo: {
      atrasadas: atividades.filter((a) => a.atrasada).length,
      semana: atividades.filter((a) => a.na_semana).length,
      mes: atividades.filter((a) => a.em_30).length,
      equipes: atividades.filter((a) => a.em_30).reduce((s, a) => s + (a.termino.usadas || 0), 0),
    },
    resumo: { semana: resumo(h1, 'semana', (a) => a.no_h1), mes: resumo(h2, 'mes', () => true) },
    atividades, compras, pendencias: unicas(pendencias),
  }
}
