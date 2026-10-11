// Relatório gerencial por período (pedido 16) — para os gestores, em linguagem simples.
// /relatorio?de=AAAA-MM-DD&ate=AAAA-MM-DD (aberto pelo botão "Gerar relatório" da Visão geral).
// Página pronta para imprimir: A4 retrato, cabeçalho e rodapé "Residencial Sirius 60 · período · página X de Y"
// (@page do CSS), quebras de página por bloco; "Baixar PDF" chama a impressão do navegador ("Salvar como PDF").
// Sem pacote novo. Os números vêm das MESMAS rotas e contas dos cards e painéis do site (ver lib/relatorio.js):
//   valor agregado, custo, saldo, rendimento do custo e projeções: /api/painel + lib/projecoes.js (como os cards);
//   prazo: calcularAdiantamento (card "Adiantamento") na semana da última medição;
//   caixa, próximos 30 dias, compras e pendências: /api/pontos-atencao (painel "Pontos de atenção").
// Nada de sigla na tela: "valor do que foi feito" (valor agregado), "rendimento do custo", "avanço físico".
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { OBRA, fmtMoeda2, fmtP1, rotuloPavimento, hojeSaoPaulo } from '../lib/constants'
import { datasDaSemana, totalSemanas } from '../lib/calendario'
import { calcularIndices, projetarIndireto, calcularProjecoes, calcularAdiantamento } from '../lib/projecoes'
import { periodoEmSemanas, ultimaMedicaoAte, fisicoDoPeriodo, financeiroDoPeriodo, motivoDaDiferenca, caixa30,
  corRendimento, corPrazo, corSaldoPct, dmy, dm } from '../lib/relatorio'

const COR = { verde: '#2f7d4a', amarelo: '#b98200', vermelho: '#b3261e', cinza: '#8a9099', azul: '#2f6db3' }
const TXT = '#1d232b', SUAVE = '#5b6470', LINHA = '#d9dde3', FUNDO = '#f4f6f8'
const fmt2 = fmtMoeda2
const pc1 = fmtP1
const virg = (v, c = 2) => (v == null || !isFinite(v) ? '—' : Number(v).toFixed(c).replace('.', ','))
// valores do resumo arredondados ("R$ 112 mil")
function mil(v) {
  if (v == null || !isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e6) return `R$ ${(a / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} milhões`
  if (a >= 1e3) return `R$ ${Math.round(a / 1e3).toLocaleString('pt-BR')} mil`
  return `R$ ${Math.round(a).toLocaleString('pt-BR')}`
}
const S2 = (n) => `S${String(n).padStart(2, '0')}`
const descCurta = (d) => String(d || '').replace(/\s*-?\s*\((M[ãa]o de Obra|Apenas Material|Material)\)\s*$/i, '').trim()
// custo sempre separado e somado (Rafael 11/10): "R$ X (pago R$ Y + a pagar R$ Z)"
const custoTxt = (pago, ap, f = fmt2) => `${f((pago || 0) + (ap || 0))} (pago ${f(pago || 0)} + a pagar ${f(ap || 0)})`
const nomeAtiv = (l) => `${l.codigo_eap} · ${descCurta(l.descricao)} · ${rotuloPavimento(l.pavimento, l.codigo_eap)}`

async function pegar(url) {
  const r = await fetch(url)
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(`${url}: ${j.message || j.error || r.status}`)
  return j
}

export default function Relatorio() {
  const router = useRouter()
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!router.isReady) return
    const de = String(router.query.de || ''), ate = String(router.query.ate || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
      setErro('Período inválido. Volte à Visão geral e escolha a data inicial e a final.'); return
    }
    const per = periodoEmSemanas(de, ate, totalSemanas())
    if (!per) { setErro('O período termina antes do início da obra (03/08/2026).'); return }
    ;(async () => {
      try {
        const [dash, pFim, pAntes, pa, curva, indFim, contas] = await Promise.all([
          pegar(`/api/dashboard-integrado?semana=${per.sFim}`),
          pegar(`/api/painel?semana=${per.sFim}`),
          per.sAntes >= 1 ? pegar(`/api/painel?semana=${per.sAntes}`) : Promise.resolve(null),
          pegar(`/api/pontos-atencao?semana=${per.sFim}`),
          pegar(`/api/curva-s?semana=${per.sFim}`),
          pegar(`/api/indiretos?semana=${per.sFim}`),
          pegar(`/api/contas-a-pagar?semana=${per.sFim}`),
        ])
        const med = ultimaMedicaoAte(pFim)
        let pMed = null, indMed = null
        if (med) {
          ;[pMed, indMed] = await Promise.all([
            med.semana === per.sFim ? Promise.resolve(pFim) : pegar(`/api/painel?semana=${med.semana}&linhas=0`),
            med.semana === per.sFim ? Promise.resolve(indFim) : pegar(`/api/indiretos?semana=${med.semana}`),
          ])
        }
        setD({ per, dash, pFim, pAntes, pa, curva, indFim, contas, med, pMed, indMed, gerado: hojeSaoPaulo() })
      } catch (e) { setErro(e.message) }
    })()
  }, [router.isReady, router.query.de, router.query.ate])

  const titulo = d ? `Relatório Sirius 60 - ${d.per.de} a ${d.per.ate}` : 'Relatório da obra'
  return (
    <>
      <Head><title>{titulo}</title></Head>
      <style>{css(d ? `${OBRA.nome} · ${dmy(d.per.de)} a ${dmy(d.per.ate)}` : OBRA.nome)}</style>
      <div className="barra nao-imprime">
        <a onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>← Visão geral</a>
        <span style={{ flex: 1 }} />
        <span style={{ color: SUAVE, fontSize: 12 }}>No destino da impressão, escolha "Salvar como PDF"</span>
        <button onClick={() => window.print()} disabled={!d}>Baixar PDF</button>
      </div>
      {erro && <div className="folha"><p>Não foi possível montar o relatório: {erro}</p></div>}
      {!erro && !d && <div className="folha"><p>Montando o relatório…</p></div>}
      {d && <Conteudo d={d} />}
      {d && <div id="relatorio-pronto" style={{ display: 'none' }} />}
    </>
  )
}

/* ─── CONTAS DO RELATÓRIO (todas pelas funções do site) ─────────────────────────── */
function montar(d) {
  const { per, dash, pFim, pAntes, pa, curva, indFim, med, pMed, indMed } = d
  const k = dash.kpis
  const tot = pFim.totais
  // a) custo direto: o mesmo dos cards "Saldo custo direto" e "Rendimento" (até o fim do período)
  const idx = calcularIndices({ agregado: tot.agregado, comprometido: tot.comprometido, planejadoDireto: null, avancoReal: null, avancoPlan: null })
  const saldoDireto = tot.agregado - tot.comprometido
  // indireto: o mesmo dos cards do indireto (planejado × pago + a pagar)
  const indPlan = k.custo_indireto_planejado_ate || 0
  const indPago = k.custo_indireto_realizado || 0
  const indAPagar = pFim.contas && pFim.contas.totais ? pFim.contas.totais.indireto || 0 : 0
  const indReal = indPago + indAPagar
  const saldoInd = indPlan - indReal
  const pctInd = indPlan > 0 ? 100 * saldoInd / indPlan : null
  // b) prazo na semana da última medição (como os cards)
  const medNoPeriodo = med && med.semana >= per.sIni
  const adi = med ? calcularAdiantamento(dash.semanas_alinhadas || [], med.semana) : null
  const ponto = med ? (dash.semanas_alinhadas || []).find((c) => c.semana_numero === med.semana) : null
  const idxMed = pMed ? calcularIndices({ agregado: pMed.totais.agregado, comprometido: pMed.totais.comprometido,
    planejadoDireto: ponto ? ponto.financeiro_planejado : null, avancoReal: pMed.avanco.realizado, avancoPlan: pMed.avanco.planejado }) : null
  // d) projeções (mesma conta do painel "Projeções de custo final")
  const proj = pMed && idxMed ? calcularProjecoes({ orcadoDireto: pMed.totais.orcado, agregado: pMed.totais.agregado,
    comprometido: pMed.totais.comprometido, indices: idxMed, indireto: projetarIndireto(indMed.categorias), orcamentoTotal: k.orcamento_total }) : null
  const cx = caixa30(pa)
  const fis = fisicoDoPeriodo(pFim, pAntes, per.fimReal, !!med && !medNoPeriodo, med ? med.data : null)
  const fin = financeiroDoPeriodo(pFim, pAntes)
  return { k, tot, idx, saldoDireto, indPlan, indPago, indAPagar, indReal, saldoInd, pctInd, medNoPeriodo, adi, idxMed, proj, cx, fis, fin }
}

function Conteudo({ d }) {
  const m = montar(d)
  return (
    <>
      <Capa d={d} />
      <Resumo d={d} m={m} />
      <Fisico d={d} m={m} />
      <Financeiro d={d} m={m} />
      <Graficos d={d} m={m} />
      <Proximos d={d} m={m} />
      <Atencao d={d} m={m} />
    </>
  )
}

/* ─── PEÇAS ─────────────────────────────────────────────────────────────────────── */
const ROT_COR = { verde: 'bom', amarelo: 'atenção', vermelho: 'problema', cinza: 'sem dado', azul: 'informação' }
function Sinal({ cor, grande }) {
  const t = grande ? 16 : 10
  return <span className="sinal" title={ROT_COR[cor]} style={{ width: t, height: t, background: COR[cor] || COR.cinza }} />
}
const Nota = ({ children }) => <div className="nota">{children}</div>

/* 1. CAPA */
function Capa({ d }) {
  const { per, med } = d
  return (
    <section className="folha capa">
      <div className="capa-topo">{OBRA.cidade}</div>
      <h1>{OBRA.nome}</h1>
      <h2>Relatório da obra — {dmy(per.de)} a {dmy(per.ate)}</h2>
      <div className="capa-dados">
        <div><b>Gerado em</b> {dmy(d.gerado)}</div>
        <div><b>Última medição da obra até {dmy(per.ate)}</b> {med ? `${S2(med.semana)} · ${dmy(med.data)}` : 'nenhuma'}</div>
        <div><b>Semanas do período</b> {S2(per.sIni)} a {S2(per.sFim)} ({dmy(per.iniReal)} a {dmy(per.fimReal)})</div>
        <div><b>Obra</b> {OBRA.area_total.toLocaleString('pt-BR')} m² · {OBRA.unidades} unidades · {dmy(datasDaSemana(1).data_inicio)} a {dmy(OBRA.fim_planejado)}</div>
      </div>
      {(per.ajusteFim || per.ajusteIni) && (
        <Nota>As contas da obra são fechadas por semana. Este relatório usa as semanas {S2(per.sIni)} a {S2(per.sFim)}
          {per.ajusteFim ? `; a data final foi estendida até o fim da semana (${dmy(per.fimReal)})` : ''}
          {per.ajusteIni ? `; a data inicial vai do começo da semana (${dmy(per.iniReal)})` : ''}.</Nota>
      )}
      <div className="capa-legenda">
        <div><Sinal cor="verde" /> verde = bom</div>
        <div><Sinal cor="amarelo" /> amarelo = atenção</div>
        <div><Sinal cor="vermelho" /> vermelho = problema</div>
        <div><Sinal cor="cinza" /> cinza = sem dado no período</div>
      </div>
    </section>
  )
}

/* 2. RESUMO EM UMA PÁGINA */
function Pergunta({ q, cor, grande, frase, children }) {
  return (
    <div className="pergunta">
      <div className="pq">{q}</div>
      <div className="pr"><Sinal cor={cor} grande /><span className="grande" style={{ color: COR[cor] || TXT }}>{grande}</span></div>
      <div className="frase">{frase}</div>
      {children}
    </div>
  )
}
function Resumo({ d, m }) {
  const { per, med, pMed, pa } = d
  const fim = dmy(per.fimReal)
  const rend = m.idx.ipc
  const temValor = m.tot.agregado > 0.005
  // a) direto
  const a = temValor
    ? { cor: corRendimento(rend), grande: `${mil(m.saldoDireto)} de ${m.saldoDireto >= 0 ? 'economia' : 'estouro'}`,
        frase: <>Até {fim} gastamos <b>{mil(m.saldoDireto)} a {m.saldoDireto >= 0 ? 'menos' : 'mais'}</b> que o valor do que foi feito
          ({mil(m.tot.agregado)}). Custo: {custoTxt(m.tot.pago, m.tot.a_pagar, mil)}. Para cada R$ 1,00 gasto, a obra executou
          {' '}<b>R$ {virg(rend)}</b> de serviço.
          <div className="motivo" style={{ marginTop: 4 }}>Só no período: feito {mil(m.fin.total.feito)}, custo {mil(m.fin.total.gasto)}
            {' '}({m.fin.total.saldo >= 0 ? 'economia' : 'estouro'} de {mil(m.fin.total.saldo)}). Pagamentos de um período podem se referir a
            serviços medidos em períodos anteriores.</div></> }
    : { cor: 'cinza', grande: 'sem dado', frase: 'Ainda não há serviço medido até a data final.' }
  // indireto
  const ci = m.indPlan > 0 ? corSaldoPct(m.pctInd) : 'cinza'
  const aRealizar = m.k.custo_indireto_a_realizar || 0
  // b) prazo
  const semMed = !med || !m.medNoPeriodo
  const adi = m.adi
  const b = !med ? { cor: 'cinza', grande: 'sem medição', frase: 'Ainda não há medição de serviço até a data final.' }
    : semMed ? { cor: 'cinza', grande: 'sem medição no período',
        frase: <>Sem medição desde {dmy(med.data)} — atualizar. Na última medição: {pc1(pMed.avanco.realizado)} feito ×
          {' '}{pc1(pMed.avanco.planejado)} previsto{adi ? `; ${adi.semanas >= 0 ? 'adiantada' : 'atrasada'} ${virg(Math.abs(adi.semanas), 1)} semana(s)` : ''}.</> }
    : { cor: corPrazo(adi ? adi.semanas : null),
        grande: adi ? `${adi.semanas >= 0 ? 'adiantada' : 'atrasada'} ${virg(Math.abs(adi.semanas), 1)} semana${Math.abs(adi.semanas) >= 1.95 ? 's' : ''}` : 'sem cálculo',
        frase: <>Avanço físico (horas de trabalho): <b>{pc1(pMed.avanco.realizado)}</b> feito × {pc1(pMed.avanco.planejado)} previsto
          na medição de {dmy(med.data)}.{adi ? <> Término projetado <b>{dmy(adi.termino)}</b> (cronograma: {dmy(adi.fim)}), se o ritmo for mantido.</> : ''}</> }
  // c) caixa
  const cx = m.cx
  // d) projeção
  const p = m.proj
  const cen = p ? p.cenarios : null
  const totais = cen ? [cen.otimista.total, cen.tendencia.total, cen.pessimista.total].filter((x) => x != null) : []
  const dCor = cen && cen.otimista.saldo_total != null ? corSaldoPct(cen.otimista.saldo_total_pct) : 'cinza'
  const pouco = pMed && pMed.avanco.realizado < 15
  return (
    <section className="folha">
      <h3>Resumo do período</h3>
      <div className="perguntas">
        <Pergunta q="Estamos gastando menos do que deveríamos? (custo direto)" cor={a.cor} grande={a.grande} frase={a.frase}>
          <div className="frase" style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${LINHA}` }}>
            <Sinal cor={ci} /> <b>Custo indireto</b> (administração, projetos, taxas, terreno): {m.indPlan > 0
              ? <>previsto {mil(m.indPlan)} × custo {custoTxt(m.indPago, m.indAPagar, mil)} até {fim} → {mil(m.saldoInd)} {m.saldoInd >= 0 ? 'abaixo' : 'acima'} do previsto ({pc1(Math.abs(m.pctInd))}).
                {aRealizar > 0.005 && <> Inclui {mil(aRealizar)} previstos e ainda não pagos: não é economia de verdade.</>}</>
              : 'sem previsão até a data final.'}
          </div>
        </Pergunta>
        <Pergunta q="A obra está no prazo?" cor={b.cor} grande={b.grande} frase={b.frase} />
        <Pergunta q="Quanto vamos precisar no próximo mês?" cor="azul" grande={mil(cx.total)}
          frase={<>Dinheiro previsto de {dmy(cx.de)} a {dmy(cx.ate)} (30 dias depois da data final), na mesma conta do painel
            “Pontos de atenção”.</>}>
          <table className="mini">
            <tbody>
              {cx.grupos.slice(0, 4).map((g) => <tr key={g.grupo}><td>{g.grupo} {g.nome}</td><td className="n">{mil(g.valor)}</td></tr>)}
              {cx.grupos.length > 4 && <tr><td>outros grupos</td><td className="n">{mil(cx.grupos.slice(4).reduce((t, g) => t + g.valor, 0))}</td></tr>}
              <tr><td>Contas já lançadas a pagar que vencem no período ({cx.n_contas} título{cx.n_contas === 1 ? '' : 's'})</td><td className="n">{mil(cx.contas)}</td></tr>
              <tr><td>Custo indireto do período</td><td className="n">{mil(cx.indiretos)}</td></tr>
            </tbody>
          </table>
        </Pergunta>
        <Pergunta q="Quanto a obra vai custar no final?" cor={dCor}
          grande={cen && cen.otimista.total != null ? mil(cen.otimista.total) : 'sem projeção'}
          frase={cen && cen.otimista.total != null ? <>
            Se mantivermos o ritmo atual, a obra deve terminar com <b>{cen.otimista.saldo_total >= 0 ? 'economia' : 'estouro'} de
            {' '}{mil(cen.otimista.saldo_total)} ({pc1(Math.abs(cen.otimista.saldo_total_pct))})</b> sobre o orçamento de {mil(p.orcamento_total)}.
            Faixa entre {mil(Math.min(...totais))} e {mil(Math.max(...totais))} nos outros cenários. Base: medição de {dmy(med.data)};
            o custo até lá, {custoTxt(pMed.totais.pago, pMed.totais.a_pagar, mil)}, já está na projeção: <b>inclui {mil(pMed.totais.a_pagar)} já lançados a pagar</b>.
            {pouco && <span style={{ color: COR.amarelo }}> Projeção pouco confiável com menos de 15% de avanço (hoje {pc1(pMed.avanco.realizado)}).</span>}
          </> : 'Sem medição ainda: não há projeção.'} />
      </div>
      <Nota>Semáforo: rendimento do custo verde a partir de R$ 1,00 por R$ 1,00 gasto, amarelo de R$ 0,95 a R$ 1,00, vermelho abaixo
        de R$ 0,95. Prazo: verde em dia ou adiantada, amarelo até 2 semanas de atraso, vermelho acima disso. Indireto e projeção:
        verde sem estouro, amarelo estouro até 5%, vermelho acima de 5%. Valores do resumo arredondados; nas tabelas, com centavos.</Nota>
    </section>
  )
}

/* 3. PREVISTO × FEITO (FÍSICO) */
function Fisico({ d, m }) {
  const { per, med } = d
  const f = m.fis
  const preoc = f.preocupa.slice(0, 3)
  return (
    <section className="folha">
      <h3>O que estava previsto no período e o que foi feito</h3>
      <p className="intro">Atividades que o cronograma previa entre {dmy(per.iniReal)} e {dmy(per.fimReal)}. Previsto e feito em % da
        atividade inteira, no fim do período{med ? ` (feito = medição de ${dmy(med.data)})` : ''}.</p>
      {!m.medNoPeriodo && <Nota><b>Sem medição no período.</b> {med ? `O feito é o da última medição (${dmy(med.data)}); medir para atualizar.` : 'Nenhuma medição ainda.'}</Nota>}
      {f.total === 0 ? <p>O cronograma não previa nenhuma atividade de serviço neste período.</p> : (
        <table className="tab">
          <thead><tr><th>Atividade</th><th className="n">Previsto</th><th className="n">Feito</th><th>Situação</th></tr></thead>
          {f.grupos.map((g) => (
            <tbody key={`${g.grupo}|${g.pavimento}`}>
              <tr className="grupo"><td colSpan={4}>{g.grupo} {g.nome}{g.pavimento ? ` · ${rotuloPavimento(g.pavimento, 3)}` : ''}</td></tr>
              {g.itens.map((l) => (
                <tr key={l.id}>
                  <td>{l.codigo_eap} · {descCurta(l.descricao)}{g.pavimento ? '' : ` · ${rotuloPavimento(l.pavimento, l.codigo_eap)}`}</td>
                  <td className="n">{pc1(l.perc_plan)}</td>
                  <td className="n">{pc1(l.perc_real)}</td>
                  <td><Sinal cor={l.situacao.cor} /> {l.situacao.texto}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      )}
      {f.total > 0 && !m.medNoPeriodo && (
        <p className="conclusao">Sem medição entre {dmy(per.iniReal)} e {dmy(per.fimReal)}: não dá para dizer o que foi feito no período.
          {' '}Pela última medição ({med ? dmy(med.data) : '—'}), {f.lista.filter((l) => l.situacao.base && l.situacao.base.cor === 'verde').length} de {f.total} atividades
          {' '}estariam em dia. <b>Medir para atualizar.</b></p>
      )}
      {f.total > 0 && m.medNoPeriodo && (
        <p className="conclusao">
          <b>{f.emDia} de {f.total}</b> atividades previstas estão em dia (concluídas, em dia ou adiantadas).{' '}
          {preoc.length ? <>As maiores preocupações são {preoc.map((l, i) => <span key={l.id}>{i ? (i === preoc.length - 1 ? ' e ' : ', ') : ''}<b>{descCurta(l.descricao)} ({rotuloPavimento(l.pavimento, l.codigo_eap)})</b>, {l.situacao.texto}</span>)}.</>
            : 'Nenhuma atividade prevista está atrasada.'}
        </p>
      )}
      <Nota>Atrasada = feito abaixo do previsto (mesma regra do painel “Pontos de atenção” do site). Os dias comparam a data em que o
        cronograma previa chegar ao % feito com o fim do período. Amarelo até 7 dias de atraso; vermelho acima disso.</Nota>
    </section>
  )
}

/* 4. QUANTO CUSTOU O QUE FOI FEITO (Rafael 11/10: resposta principal = ACUMULADO até a data final; período = informação;
   pago e a pagar sempre separados e somados) */
function Financeiro({ d, m }) {
  const { per, contas } = d
  const f = m.fin
  const fim = dmy(per.fimReal)
  const cor = (feito, custo) => (custo > 0.005 ? corRendimento(feito / custo) : feito > 0.005 ? 'verde' : 'cinza')
  const pct = (feito, saldo) => (feito > 0.005 ? pc1(Math.abs(100 * saldo / feito)) : '—')
  const dif = (saldo) => (Math.abs(saldo) < 0.005 ? <span style={{ color: SUAVE }}>sem diferença</span>
    : <span style={{ color: saldo > 0 ? COR.verde : COR.vermelho }}>{saldo > 0 ? 'economia' : 'estouro'} {fmt2(Math.abs(saldo))}</span>)
  const Custo = ({ pago, ap }) => <>{fmt2((pago || 0) + (ap || 0))}<div className="motivo">pago {fmt2(pago || 0)} + a pagar {fmt2(ap || 0)}</div></>
  const comAc = f.grupos.filter((g) => g.tem_ac)
  const comMov = f.grupos.filter((g) => g.movimento)
  const t = m.tot
  const linhaDif = (l) => (
    <tr key={l.id}>
      <td>{nomeAtiv(l)}<div className="motivo">{motivoDaDiferenca(l)}</div></td>
      <td className="n">{fmt2(l.agregado)}</td>
      <td className="n"><Custo pago={l.pago} ap={l.a_pagar} /></td>
      <td className="n">{dif(l.saldo_acumulado)}</td>
    </tr>
  )
  const titulos = (contas && contas.titulos) || []
  const tipoTxt = (x) => (x.tipo === 'direto' ? 'sim' : x.tipo === 'direto recorrente' ? 'não (conta recorrente; entra no caixa)'
    : x.tipo === 'indireto' ? 'não (custo indireto)' : x.tipo || '—')
  return (
    <section className="folha quebra">
      <h3>Quanto custou o que foi feito</h3>
      <p className="intro">Custo direto, do início da obra até {fim}. <b>Valor do que foi feito</b> = serviço executado a preço de orçamento.
        {' '}<b>Custo</b> = pago + lançado a pagar (as duas partes aparecem separadas); é sempre a soma que entra na comparação.</p>
      <p className="conclusao" style={{ marginTop: 0 }}>Até {fim} gastamos <b>{fmt2(Math.abs(m.saldoDireto))} a {m.saldoDireto >= 0 ? 'menos' : 'mais'}</b> que o
        valor do que foi feito: feito {fmt2(t.agregado)} × custo {custoTxt(t.pago, t.a_pagar)}.</p>
      <table className="tab">
        <thead><tr><th>Grupo</th><th className="n">Orçado</th><th className="n">Valor do que foi feito</th><th className="n">Custo (pago + a pagar)</th>
          <th className="n">Economia / estouro</th><th className="n">%</th><th /></tr></thead>
        <tbody>
          {comAc.map((g) => (
            <tr key={g.grupo}>
              <td>{g.grupo} {g.nome}</td><td className="n">{fmt2(g.orcado)}</td><td className="n">{fmt2(g.feito_ac)}</td>
              <td className="n"><Custo pago={g.pago_ac} ap={g.ap_ac} /></td><td className="n">{dif(g.saldo_ac)}</td>
              <td className="n">{pct(g.feito_ac, g.saldo_ac)}</td><td><Sinal cor={cor(g.feito_ac, g.custo_ac)} /></td>
            </tr>
          ))}
          <tr className="total">
            <td>Total do custo direto</td><td className="n">{fmt2(t.orcado)}</td><td className="n">{fmt2(t.agregado)}</td>
            <td className="n"><Custo pago={t.pago} ap={t.a_pagar} /></td><td className="n">{dif(m.saldoDireto)}</td>
            <td className="n">{pct(t.agregado, m.saldoDireto)}</td><td><Sinal cor={cor(t.agregado, t.comprometido)} /></td>
          </tr>
        </tbody>
      </table>
      {comAc.length < f.grupos.length && <Nota>Os outros {f.grupos.length - comAc.length} grupos ainda não tiveram serviço nem custo.</Nota>}
      {(d.pFim.fora_orcamento || []).length > 0 && <Nota>O total inclui custo lançado em códigos fora do orçamento.</Nota>}

      <h4>Contas a pagar lançadas{contas && contas.fechamento ? ` (fechamento ${contas.fechamento})` : ''}</h4>
      {titulos.length ? (
        <table className="tab peq">
          <thead><tr><th>Fornecedor</th><th>Documento</th><th>Vencimento</th><th className="n">Valor</th><th>Entra no custo direto?</th></tr></thead>
          <tbody>
            {titulos.map((x) => (
              <tr key={x.chave}>
                <td>{x.fornecedor || '—'}</td><td>{x.num_documento || '—'}</td><td>{dmy(x.data_vencimento)}</td>
                <td className="n">{fmt2(x.valor)}</td><td>{tipoTxt(x)}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={3}>Total ({contas.n_titulos} título{contas.n_titulos === 1 ? '' : 's'}) · no custo direto: {fmt2(contas.totais.custo_direto_a_pagar)}</td>
              <td className="n">{fmt2(contas.totais.total)}</td><td />
            </tr>
          </tbody>
        </table>
      ) : <p>Nenhuma conta a pagar lançada até {fim}.</p>}

      <h4>Maiores economias (acumulado)</h4>
      {f.economias.length ? <table className="tab peq"><thead><tr><th>Atividade</th><th className="n">Feito</th><th className="n">Custo (pago + a pagar)</th><th className="n">Diferença</th></tr></thead>
        <tbody>{f.economias.map(linhaDif)}</tbody></table> : <p>Nenhuma.</p>}
      <h4>Maiores estouros (acumulado)</h4>
      {f.estouros.length ? <table className="tab peq"><thead><tr><th>Atividade</th><th className="n">Feito</th><th className="n">Custo (pago + a pagar)</th><th className="n">Diferença</th></tr></thead>
        <tbody>{f.estouros.map(linhaDif)}</tbody></table> : <p>Nenhum.</p>}

      <div className="junto">
      <h4>Só no período ({dmy(per.iniReal)} a {fim}) — informação</h4>
      <p className="nota" style={{ marginTop: 0 }}>Pagamentos de um período podem se referir a serviços medidos em períodos anteriores (ex.: concreto e
        aço medidos em agosto e pagos em setembro). Custo no período = pago no período + a pagar no fim − a pagar no início.</p>
      {comMov.length ? (
        <table className="tab peq">
          <thead><tr><th>Grupo</th><th className="n">Feito no período</th><th className="n">Pago no período</th>
            <th className="n">A pagar (fim − início)</th><th className="n">Custo no período</th><th className="n">Diferença</th></tr></thead>
          <tbody>
            {comMov.map((g) => (
              <tr key={g.grupo}>
                <td>{g.grupo} {g.nome}</td><td className="n">{fmt2(g.feito)}</td><td className="n">{fmt2(g.pago_p)}</td>
                <td className="n">{fmt2(g.ap_fim)} − {fmt2(g.ap_ini)}</td><td className="n">{fmt2(g.gasto)}</td><td className="n">{dif(g.saldo)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td><td className="n">{fmt2(f.total.feito)}</td><td className="n">{fmt2(f.total.pago_p)}</td>
              <td className="n">{fmt2(f.total.ap_fim)} − {fmt2(f.total.ap_ini)}</td><td className="n">{fmt2(f.total.gasto)}</td><td className="n">{dif(f.total.saldo)}</td>
            </tr>
          </tbody>
        </table>
      ) : <p>Sem serviço nem custo no período.</p>}
      </div>
      <Nota>Semáforo do grupo pelo rendimento do custo acumulado (feito ÷ custo), nas mesmas faixas do resumo.</Nota>
    </section>
  )
}

/* 5. GRÁFICOS (SVG simples, imprime nítido) */
function Grafico({ titulo, series, xMax, yMax, yFmt, marca, marcaTxt, legenda }) {
  const W = 680, H = 250, L = 64, R = 14, T = 14, B = 34
  const x = (s) => L + ((s - 1) / Math.max(xMax - 1, 1)) * (W - L - R)
  const y = (v) => T + (1 - v / yMax) * (H - T - B)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)
  const passoX = xMax > 60 ? 12 : xMax > 24 ? 4 : 2
  return (
    <div className="grafico">
      <h4>{titulo}</h4>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={LINHA} />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill={SUAVE}>{yFmt(t)}</text></g>)}
        {Array.from({ length: xMax }, (_, i) => i + 1).filter((s) => s === 1 || s % passoX === 0).map((s) => (
          <text key={s} x={x(s)} y={H - B + 14} textAnchor="middle" fontSize="10" fill={SUAVE}>{S2(s)}</text>))}
        {marca && <g><line x1={x(marca)} x2={x(marca)} y1={T} y2={H - B} stroke={TXT} strokeDasharray="3,3" />
          <text x={x(marca) + 4} y={T + 10} fontSize="10" fill={TXT}>{marcaTxt}</text></g>}
        {series.map((s) => {
          const pts = s.pontos.filter((p) => p.v != null && isFinite(p.v) && p.s <= xMax)
          if (!pts.length) return null
          return <polyline key={s.nome} fill="none" stroke={s.cor} strokeWidth={s.largura || 2} strokeDasharray={s.tracejado || undefined}
            points={pts.map((p) => `${x(p.s).toFixed(1)},${y(Math.min(p.v, yMax)).toFixed(1)}`).join(' ')} />
        })}
      </svg>
      <div className="legenda">{series.map((s) => (
        <span key={s.nome}><svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" stroke={s.cor} strokeWidth="2.5" strokeDasharray={s.tracejado || undefined} /></svg> {s.nome}</span>))}</div>
      {legenda && <Nota>{legenda}</Nota>}
    </div>
  )
}
const teto = (v) => {
  if (!(v > 0)) return 1
  const bruto = (v * 1.05) / 4
  const p = Math.pow(10, Math.floor(Math.log10(bruto)))
  return 4 * ([1, 1.5, 2, 2.5, 3, 4, 5, 10].map((k) => k * p).find((k) => k >= bruto) || 10 * p)
}
function Graficos({ d }) {
  const { per, dash, curva, med } = d
  const sa = dash.semanas_alinhadas || []
  const xMax = Math.min(sa.length, Math.max(per.sFim + 8, 16))
  const fisPlan = sa.map((c) => ({ s: c.semana_numero, v: c.hh_planejado }))
  const fisReal = sa.filter((c) => !med || c.semana_numero <= med.semana).map((c) => ({ s: c.semana_numero, v: c.hh_realizado }))
  const yFis = teto(Math.max(...fisPlan.filter((p) => p.s <= xMax).map((p) => p.v || 0), ...fisReal.map((p) => p.v || 0)))
  const pts = curva.pontos || []
  const finPlan = sa.filter((c) => c.semana_numero <= per.sFim).map((c) => ({ s: c.semana_numero, v: c.financeiro_planejado }))
  const feito = pts.map((p) => ({ s: p.semana, v: p.va }))
  const gasto = pts.map((p) => ({ s: p.semana, v: p.cc != null ? p.cc : p.cr }))
  const yFin = teto(Math.max(...finPlan.map((p) => p.v || 0), ...feito.map((p) => p.v || 0), ...gasto.map((p) => p.v || 0)))
  const fmtK = (v) => (v >= 1e6 ? `${virg(v / 1e6, 1)} mi` : `${Math.round(v / 1e3)} mil`)
  return (
    <section className="folha quebra">
      <h3>Gráficos</h3>
      <Grafico titulo="Avanço da obra — previsto × feito (% das horas de trabalho da obra)" xMax={xMax} yMax={yFis}
        yFmt={(v) => `${virg(v, 1)}%`} marca={per.sFim} marcaTxt={`fim do período ${dm(per.fimReal)}`}
        series={[{ nome: 'Previsto no cronograma', cor: COR.azul, tracejado: '6,4', pontos: fisPlan },
          { nome: 'Feito (medições)', cor: TXT, largura: 2.5, pontos: fisReal }]}
        legenda={`Semanas da obra (S01 = 03/08/2026); mostra até ${S2(xMax)}. A obra toda tem ${sa.length} semanas.`} />
      <Grafico titulo="Dinheiro — valor do que foi feito × custo acumulado (custo direto)" xMax={per.sFim} yMax={yFin}
        yFmt={(v) => (v ? `R$ ${fmtK(v)}` : '0')} marca={null}
        series={[{ nome: 'Previsto no orçamento (cronograma)', cor: COR.cinza, tracejado: '6,4', pontos: finPlan },
          { nome: 'Valor do que foi feito', cor: COR.verde, largura: 2.5, pontos: feito },
          { nome: 'Custo (pago + a pagar)', cor: COR.vermelho, largura: 2.5, pontos: gasto }]}
        legenda="Linha verde acima da vermelha = a obra está custando menos do que vale o que foi feito." />
    </section>
  )
}

/* 6. PRÓXIMOS 30 DIAS */
function Proximos({ d, m }) {
  const { pa } = d
  const cx = m.cx
  const ativs = pa.atividades.filter((a) => a.em_30)
    .sort((a, b) => (b.atrasada - a.atrasada) || (b.atraso_horas - a.atraso_horas) || String(a.inicio_crono).localeCompare(String(b.inicio_crono)))
  const top = ativs.slice(0, 10)
  const em6m = new Date(Date.parse(pa.hoje) + 183 * 864e5).toISOString().slice(0, 10)
  const compras = pa.compras.filter((c) => c.pedir_ate && c.pedir_ate <= em6m).sort((a, b) => a.pedir_ate.localeCompare(b.pedir_ate)).slice(0, 6)
  return (
    <section className="folha quebra">
      <h3>Próximos 30 dias ({dmy(cx.de)} a {dmy(cx.ate)})</h3>
      <p className="intro">{ativs.length} atividades previstas ou atrasadas; as {top.length} mais importantes (atrasadas primeiro):</p>
      <table className="tab">
        <thead><tr><th>Atividade</th><th className="n">Falta</th><th>Equipes sugeridas</th><th>Término projetado</th></tr></thead>
        <tbody>
          {top.map((a) => {
            const t = a.termino || {}
            return (
              <tr key={a.id}>
                <td><Sinal cor={a.atrasada ? 'vermelho' : a.status === 'A INICIAR' ? 'cinza' : 'verde'} /> {a.grupo_num} {a.grupo_nome} · {a.codigo_eap} {descCurta(a.descricao)} · {rotuloPavimento(a.pavimento, a.codigo_eap)}
                  {a.atrasada && <div className="motivo">atrasada: previsto {pc1(a.plan_hoje)}, feito {pc1(a.real)}{!m.medNoPeriodo && d.med ? ` (medição de ${dm(d.med.data)})` : ''}</div>}</td>
                <td className="n">{pc1(100 - a.real)}{t.horas != null ? <div className="motivo">{Math.round(t.horas).toLocaleString('pt-BR')} h</div> : null}</td>
                <td>{t.usadas ? `${t.usadas} equipe${t.usadas > 1 ? 's' : ''}` : 'a definir'}{a.equipe ? <div className="motivo">{a.equipe.composicao}</div> : null}</td>
                <td>{t.termino ? dmy(t.termino) : '—'}<div className="motivo">{t.termino ? (t.cumpre ? 'dentro do cronograma' : `${t.atrasa} dia(s) depois do cronograma`) : 'sem índice ou equipe'}</div></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="duas">
        <div>
          <h4>Dinheiro necessário: {fmt2(cx.total)}</h4>
          <table className="tab peq"><tbody>
            {cx.grupos.map((g) => <tr key={g.grupo}><td>{g.grupo} {g.nome}</td><td className="n">{fmt2(g.valor)}</td></tr>)}
            <tr><td>Contas já lançadas a pagar</td><td className="n">{fmt2(cx.contas)}</td></tr>
            <tr><td>Custo indireto do período</td><td className="n">{fmt2(cx.indiretos)}</td></tr>
            <tr className="total"><td>Total</td><td className="n">{fmt2(cx.total)}</td></tr>
          </tbody></table>
          <Nota>Pelo cronograma seriam {fmt2(cx.curva)}. Serviço pelo valor executado; prazos de pagamento de fornecedores ainda não considerados.</Nota>
        </div>
        <div>
          <h4>Compras importantes</h4>
          {compras.length ? <table className="tab peq"><thead><tr><th>Item</th><th>Pedir até</th></tr></thead><tbody>
            {compras.map((c) => <tr key={c.orcamento_id}><td>{c.categoria} · {descCurta(c.descricao)}<div className="motivo">usar em {dmy(c.necessidade)}</div></td>
              <td style={{ color: c.status === 'no prazo' ? TXT : COR.vermelho }}>{dmy(c.pedir_ate)}<div className="motivo">{c.status}</div></td></tr>)}
          </tbody></table> : <p>Nenhuma compra de prazo longo nos próximos 6 meses.</p>}
        </div>
      </div>
    </section>
  )
}

/* 7. PONTOS DE ATENÇÃO E PENDÊNCIAS */
function Atencao({ d, m }) {
  const { per, pa, med, indFim, pFim } = d
  const itens = []
  const atr = pa.atividades.filter((a) => a.atrasada)
  if (atr.length) itens.push({ cor: 'vermelho', txt: <>{atr.length} atividade{atr.length > 1 ? 's' : ''} atrasada{atr.length > 1 ? 's' : ''} em {dmy(per.fimReal)}{!m.medNoPeriodo && med ? ` pela última medição (${dmy(med.data)})` : ''}: {atr.slice(0, 4).map((a) => `${descCurta(a.descricao)} (${rotuloPavimento(a.pavimento, a.codigo_eap)})`).join('; ')}.</> })
  const curto = pa.atividades.filter((a) => a.cronograma_curto)
  curto.slice(0, 4).forEach((a) => itens.push({ cor: 'amarelo', txt: <>Cronograma curto: {descCurta(a.descricao)} ({rotuloPavimento(a.pavimento, a.codigo_eap)}) tem {Math.round(a.cronograma_curto.horas_cronograma)} h no cronograma, mas pela produtividade real precisa de {Math.round(a.cronograma_curto.horas_indice)} h (+{pc1(a.cronograma_curto.excesso_pct)}).</> }))
  if (!med) itens.push({ cor: 'cinza', txt: 'Nenhuma medição de serviço até a data final.' })
  else if (med.semana < per.sFim) itens.push({ cor: m.medNoPeriodo ? 'amarelo' : 'vermelho', txt: <>Última medição em {dmy(med.data)}; o período vai até {dmy(per.fimReal)}. Medir para atualizar avanço, prazo e projeções.</> })
  const cats = indFim.categorias || []
  const recSem = cats.filter((c) => c.recorrente && !c.reserva && c.acumulado > 0.005 && (c.pago || 0) + (c.a_pagar || 0) < 0.005)
  if (recSem.length) itens.push({ cor: 'amarelo', txt: <>Indiretos que deveriam estar correndo e não têm nenhum lançamento: {recSem.map((c) => c.categoria).join(', ')} ({fmt2(recSem.reduce((t, c) => t + c.acumulado, 0))} previstos até {dmy(per.fimReal)}). Falta definir quem paga.</> })
  const parte = cats.filter((c) => !c.recorrente && !c.reserva && (c.pago || 0) > 0.005 && (c.pago || 0) + (c.a_pagar || 0) < c.valor_total - 0.005)
  if (parte.length) itens.push({ cor: 'amarelo', txt: <>Pagos em parte (o restante ainda será pago; valores a informar): {parte.map((c) => `${c.categoria} — saldo ${fmt2(c.valor_total - c.pago - (c.a_pagar || 0))}`).join('; ')}.</> })
  const aReal = cats.filter((c) => c.a_realizar)
  if (aReal.length) itens.push({ cor: 'amarelo', txt: <>Previstos até agora e ainda sem pagamento: {aReal.map((c) => `${c.categoria} (${fmt2(c.acumulado)})`).join('; ')}.</> })
  const vf = pFim.totais.verba_forma
  if (vf && vf.compra_antecipada) itens.push({ cor: 'verde', txt: <>Madeira de forma comprada antes: {pc1(100 * vf.gasto / vf.verba)} da verba comprada e {pc1(100 * vf.aplicado / vf.verba)} já aplicada na obra; vale para os próximos pavimentos (sem estouro enquanto estiver dentro da verba).</> })
  const vencidas = pa.compras.filter((c) => c.status && c.status !== 'no prazo')
  if (vencidas.length) itens.push({ cor: 'vermelho', txt: <>Compras com prazo de pedido vencido ou em cima: {vencidas.slice(0, 4).map((c) => `${c.categoria} (pedir até ${dmy(c.pedir_ate)})`).join('; ')}.</> })
  if (pa.pendencias && pa.pendencias.length) itens.push({ cor: 'cinza', txt: <>{pa.pendencias.length} atividade(s) sem índice de produtividade ou equipe cadastrada: equipes e término dessas ficam “a definir”.</> })
  return (
    <section className="folha quebra">
      <h3>Pontos de atenção e pendências</h3>
      {itens.length ? <ul className="pontos">{itens.map((i, n) => <li key={n}><Sinal cor={i.cor} /> <span>{i.txt}</span></li>)}</ul> : <p>Nenhum ponto de atenção.</p>}
      <Glossario d={d} m={m} />
    </section>
  )
}

/* 8. GLOSSÁRIO */
function Glossario({ d, m }) {
  const { per, pMed } = d
  const fim = dmy(per.fimReal)
  const p = m.proj
  return (
    <div className="glossario">
      <h3 style={{ marginTop: 22 }}>Glossário</h3>
      <dl>
        <dt>Valor do que foi feito</dt>
        <dd>Quanto vale, a preço de orçamento, o serviço já executado (no site: valor agregado). Até {fim}: {fmt2(m.tot.agregado)}.</dd>
        <dt>Custo (pago + a pagar)</dt>
        <dd>O que já foi pago mais o que está lançado a pagar; é o custo usado em todas as comparações. Até {fim}: {custoTxt(m.tot.pago, m.tot.a_pagar)}.</dd>
        <dt>Economia / estouro</dt>
        <dd>Valor do que foi feito menos o custo (pago + a pagar). Positivo é economia; negativo, estouro. Até {fim}: {fmt2(m.saldoDireto)}.</dd>
        <dt>Rendimento do custo</dt>
        <dd>Quanto de serviço a obra entregou para cada R$ 1,00 gasto. Até {fim}: R$ {virg(m.idx.ipc)}.</dd>
        <dt>Avanço físico</dt>
        <dd>Horas de trabalho já executadas ÷ horas de trabalho da obra inteira{pMed ? ` (${Math.round(pMed.avanco.hh_total).toLocaleString('pt-BR')} h). Na última medição: ${pc1(pMed.avanco.realizado)}` : ''}.</dd>
        <dt>Projeção</dt>
        <dd>Estimativa do custo final da obra. A principal supõe que o que falta sai pelo orçamento{p && p.cenarios.otimista.total != null ? `: ${fmt2(p.cenarios.otimista.total)} contra ${fmt2(p.orcamento_total)} orçados` : ''}.</dd>
        <dt>Caixa</dt>
        <dd>Dinheiro que a obra deve precisar num período: serviços e materiais previstos, contas a pagar que vencem e custo indireto. Próximos 30 dias: {fmt2(m.cx.total)}.</dd>
      </dl>
    </div>
  )
}

/* ─── CSS (tela e impressão A4) ─────────────────────────────────────────────────── */
function css(cabecalho) {
  const c = cabecalho.replace(/"/g, '')
  return `
html, body { background: #e6e9ed !important; color: ${TXT} !important; }
:root { color-scheme: light !important; }
.barra { position: sticky; top: 0; z-index: 5; display: flex; gap: 14px; align-items: center; padding: 10px 24px;
  background: #fff; border-bottom: 1px solid ${LINHA}; font: 500 13px 'IBM Plex Sans'; }
.barra a { color: ${COR.azul}; }
.barra button { background: ${COR.azul}; color: #fff; border: 0; border-radius: 6px; padding: 8px 16px; font: 600 13px 'IBM Plex Sans'; cursor: pointer; }
.barra button:disabled { opacity: .5; }
.folha { background: #fff; width: 210mm; min-height: 297mm; margin: 18px auto; padding: 16mm 14mm; box-shadow: 0 2px 10px rgba(0,0,0,.12);
  font: 10.5pt/1.45 'IBM Plex Sans', sans-serif; color: ${TXT}; }
.folha h3 { font: 600 16pt 'IBM Plex Sans'; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 2px solid ${TXT}; }
.folha h4 { font: 600 11.5pt 'IBM Plex Sans'; margin: 14px 0 6px; }
.folha p { margin: 0 0 8px; }
.folha h4 { break-after: avoid; }
.junto { break-inside: avoid; }
.intro { color: ${SUAVE}; }
.nota { font-size: 8.5pt; color: ${SUAVE}; margin: 8px 0; line-height: 1.4; }
.sinal { display: inline-block; border-radius: 50%; vertical-align: middle; flex-shrink: 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.capa { display: flex; flex-direction: column; justify-content: center; }
.capa-topo { font: 500 11pt 'IBM Plex Mono'; letter-spacing: .14em; text-transform: uppercase; color: ${SUAVE}; }
.capa h1 { font: 700 34pt/1.1 'IBM Plex Sans'; margin: 10px 0 14px; }
.capa h2 { font: 500 18pt 'IBM Plex Sans'; margin: 0 0 40px; color: ${TXT}; }
.capa-dados div { margin: 6px 0; font-size: 11pt; } .capa-dados b { display: inline-block; min-width: 72mm; color: ${SUAVE}; font-weight: 500; }
.capa-legenda { display: flex; gap: 22px; margin-top: 48px; font-size: 10pt; color: ${SUAVE}; }
.perguntas { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pergunta { border: 1px solid ${LINHA}; border-radius: 8px; padding: 12px 14px; break-inside: avoid; }
.pq { font: 600 10.5pt 'IBM Plex Sans'; margin-bottom: 8px; }
.pr { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.grande { font: 700 17pt/1.15 'IBM Plex Sans'; }
.frase { font-size: 9.5pt; line-height: 1.45; }
table.mini { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9pt; }
table.mini td { padding: 2px 0; border-bottom: 1px solid ${FUNDO}; }
table.tab { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 6px 0; }
table.tab th { text-align: left; font: 600 8pt 'IBM Plex Sans'; text-transform: uppercase; letter-spacing: .04em; color: ${SUAVE};
  border-bottom: 1.5px solid ${TXT}; padding: 4px 5px; }
table.tab td, table.mini td { color: ${TXT}; }
.folha th { color: ${SUAVE} !important; }
.folha .motivo { color: ${SUAVE}; }
.folha tr:hover td { background: transparent; }
table.tab td { padding: 4px 5px; border-bottom: 1px solid ${LINHA}; vertical-align: top; }
table.tab tr { break-inside: avoid; }
table.tab thead { display: table-header-group; }
table.tab tr.grupo td { background: ${FUNDO}; font-weight: 600; padding-top: 6px; }
table.tab tr.total td { font-weight: 700; border-top: 1.5px solid ${TXT}; background: ${FUNDO}; }
table.peq { font-size: 8.5pt; }
.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.motivo { font-size: 8pt; color: ${SUAVE}; }
.conclusao { margin-top: 10px; padding: 8px 10px; background: ${FUNDO}; border-radius: 6px; }
.duas { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.grafico { break-inside: avoid; margin-bottom: 12px; }
.legenda { display: flex; gap: 16px; flex-wrap: wrap; font-size: 9pt; color: ${TXT}; margin-top: 2px; }
ul.pontos { list-style: none; padding: 0; margin: 0; }
ul.pontos li { display: flex; gap: 8px; align-items: baseline; padding: 6px 0; border-bottom: 1px solid ${LINHA}; font-size: 10pt; }
.glossario { break-inside: avoid; }
.glossario dl { display: grid; grid-template-columns: 46mm 1fr; gap: 6px 12px; font-size: 10pt; }
.glossario dt { font-weight: 600; }
@media screen and (max-width: 820px) { .folha { width: auto; min-height: 0; margin: 12px; padding: 18px; } .perguntas, .duas { grid-template-columns: 1fr; } }
@page { size: A4 portrait; margin: 16mm 13mm 15mm 13mm; background: #fff;
  @top-left { content: "${c}"; font: 8pt 'IBM Plex Sans', sans-serif; color: #6b7480; }
  @bottom-left { content: "${c}"; font: 8pt 'IBM Plex Sans', sans-serif; color: #6b7480; }
  @bottom-right { content: "página " counter(page) " de " counter(pages); font: 8pt 'IBM Plex Sans', sans-serif; color: #6b7480; } }
@page :first { @top-left { content: none; } }
@media print {
  html, body { background: #fff !important; }
  .nao-imprime { display: none !important; }
  .folha { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; break-after: page; }
  .folha:last-of-type { break-after: auto; }
  .capa { min-height: 250mm; }
}
`
}
