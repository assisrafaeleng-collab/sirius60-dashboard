import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { OBRA, fmtMoeda, fmtMoedaK, fmtPct, fmtMoeda2, fmtP1, CORES, CORES_VA, semanaLabel , ehCustoDeTempo } from '../lib/constants'
import { datasDaSemana } from '../lib/calendario'
import MapaPavimentos from './MapaPavimentos'
import FisicoPorAtividade from './FisicoPorAtividade'
import DiarioOcorrencias from './DiarioOcorrencias'
import CustoPorGrupo from './CustoPorGrupo'
import CurvaSCompleta from './CurvaSCompleta'

export default function Dashboard({ semana, sessao, onSemana }) {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)
  // avanço físico sempre por HORAS (CLAUDE.md: horas executadas ÷ horas orçadas, nunca ponderado por valor)
  const base = 'horas'
  const [itens, setItens] = useState(null)
  const [med, setMed] = useState(null)
  const [painel, setPainel] = useState(null)   // valor agregado, comprometido e contas a pagar (/api/painel)
  // "Mostrar: Custos | Avanço físico", como no Flats (pages/semanal.js de lá). Padrão: custos.
  const [mostrar, setMostrar] = useState('custo')   // custo | fisico

  useEffect(() => {
    setPainel(null)
    fetch(`/api/painel?semana=${semana}&linhas=0`).then(r => r.json())
      .then(j => setPainel(j.error ? { erro: j.message || j.error } : j)).catch(e => setPainel({ erro: e.message }))
  }, [semana])

  useEffect(() => {
    // orçamento do banco (fonte única; antes vinha de public/dados.json)
    fetch('/api/orcamento').then(r => r.json())
      .then(j => Array.isArray(j) && setItens(j.filter(i => i.g <= 16 && !ehCustoDeTempo(i)))).catch(() => {})
  }, [])
  useEffect(() => {
    setMed(null)
    fetch(`/api/avanco?semana=${semana}`).then(r => r.json())
      .then(j => !j.error && setMed(j.medido)).catch(() => {})
  }, [semana])

  useEffect(() => {
    setD(null); setErro(null)
    fetch(`/api/dashboard-integrado?semana=${semana}`)
      .then(r => r.json())
      .then(j => (j.error ? setErro(j.message || j.error) : setD(j)))
      .catch(e => setErro(e.message))
  }, [semana])

  if (erro) return (
    <div className="card">
      <div className="card-title">Não foi possível carregar</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        {erro}
        <br /><br />
        Verifique se as variáveis do Supabase estão no <code>.env.local</code> e se
        os scripts <code>01_estrutura</code> e <code>02_seed</code> rodaram.
      </div>
    </div>
  )
  if (!d) return <div className="loading">Carregando dados da obra…</div>

  const k = d.kpis
  const horasOrcadas = painel && !painel.erro ? painel.avanco.hh_total : k.base_horas
  const fisico = mostrar === 'fisico'

  return (
    <>
      <HeroCusto k={k} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '4px 0 16px' }}>
        <span style={{ font: "500 12px 'IBM Plex Sans'", color: 'var(--text3)' }}>Mostrar</span>
        <button className={!fisico ? 'btn-primary' : 'btn-sm'} onClick={() => setMostrar('custo')}>Custos</button>
        <button className={fisico ? 'btn-primary' : 'btn-sm'} onClick={() => setMostrar('fisico')}>Avanço físico</button>
        <span style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text3)' }}>
          avanço físico = horas executadas ÷ {Math.round(horasOrcadas || 0).toLocaleString('pt-BR')} h orçadas (parcela de produção)
        </span>
      </div>
      <Kpis k={k} semana={semana} painel={painel} mostrar={mostrar} curva={d.semanas_alinhadas} />
      <div className="card">
        <div className="card-title">Curva S — físico e financeiro</div>
        <CurvaSCompleta semanas={d.semanas_alinhadas} semana={semana} ultimaMedicao={k.ultima_semana_medida} onPick={onSemana} />
      </div>
      {fisico && <FisicoPorAtividade itens={itens} medido={med} semana={semana} base={base} />}
      {fisico && <MapaPavimentos itens={itens} medido={med} semana={semana} base={base} />}
      <DiarioOcorrencias sessao={sessao} itens={itens} />
    </>
  )
}

/* ─── HERO: DIRETO + INDIRETO = TOTAL ─────────────────────── */
function HeroCusto({ k }) {
  return (
    <div className="hero">
      <div className="hero-block">
        <div className="hero-label">Custo total da obra</div>
        <div className="hero-row">
          <div>
            <div className="hero-cap">Direto</div>
            <div className="hero-num">{fmtMoeda(k.custo_direto_total)}</div>
          </div>
          <div className="hero-op">+</div>
          <div>
            <div className="hero-cap">Indireto</div>
            <div className="hero-num">{fmtMoeda(k.custo_indireto_total)}</div>
          </div>
          <div className="hero-op">=</div>
          <div className="hero-total">
            <div className="hero-cap">Total</div>
            <div className="hero-num">{fmtMoeda(k.orcamento_total)}</div>
          </div>
        </div>
      </div>
      <div className="hero-div" />
      <div className="hero-side">
        <div className="hero-cap">Custo por m² · {OBRA.area_total.toLocaleString('pt-BR')} m²</div>
        <div className="hero-side-num">{fmtMoeda(k.orcamento_total / OBRA.area_total)}</div>
        <div className="kpi-sub" style={{ marginTop: 6 }}>
          {fmtMoeda(k.custo_direto_total / OBRA.area_total)}/m² só de custo direto
        </div>
      </div>
    </div>
  )
}

/* ─── KPIs (pedido 13B: iguais aos do Flats, pages/semanal.js de lá) ─────────────
   Modo "Custos": linha 1 direto (valor agregado, realizado, saldo, % desvio, saldo total da obra); linha 2 indireto
   (planejado, realizado, saldo, % desvio) e custo direto a pagar; linha 3 projeções.
   Modo "Avanço físico": os 3 primeiros de cada linha ficam; no lugar dos 2 últimos, avanço planejado e desvio físico
   (linha 1), avanço realizado e adiantamento (linha 2).
   Contas (como no Flats):
     comprometido = pago + a pagar (direto, não recorrente); saldo direto = valor agregado − comprometido;
     % desvio direto = saldo ÷ valor agregado; saldo indireto = planejado − pago − a pagar indireto;
     % desvio indireto = saldo ÷ planejado; saldo total = direto + indireto, % sobre (valor agregado + indireto
     planejado); adiantamento = semana (interpolada pelas datas) em que a curva planejada atinge o realizado da
     última medição − semana da medição; término projetado = fim do cronograma − esses dias. */
// formato e cores do Flats (lib/constants.js: fmtMoeda2, fmtP1, CORES_VA)
const fmt2 = fmtMoeda2
const pc1 = fmtP1
const sinal = v => (v >= 0 ? '+' : '') + pc1(v)
const S2 = n => 'S' + String(n).padStart(2, '0')
const dmy = iso => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—'
const VERDE = CORES_VA.economia, VERMELHO = CORES_VA.estouro
const PLAN = CORES_VA.agregado, REAL = CORES.realizado   // realizado = branco (pedido 13E)
const PILL = { background: 'rgba(255,255,255,0.07)', padding: '3px 8px', borderRadius: 6 }

// Adiantamento (Flats): curva = semanas_alinhadas (hh_planejado = curva do cronograma, hh_realizado = medições)
function calcularAdiantamento(curva, semMedida) {
  const iMed = curva.findIndex(c => c.semana_numero === semMedida)
  const real = iMed >= 0 ? curva[iMed].hh_realizado : null
  if (real == null || !(real > 0)) return null
  const dia = iso => Date.parse(iso.slice(0, 10)) / 864e5
  let wEq = null, diaEq = null
  for (let i = 0; i < curva.length; i += 1) {
    const pl = curva[i].hh_planejado || 0
    if (pl < real) continue
    const ant = i > 0 ? curva[i - 1] : null
    const plAnt = ant ? ant.hh_planejado || 0 : 0
    const f = pl - plAnt > 1e-9 ? (real - plAnt) / (pl - plAnt) : 1
    const wAnt = ant ? ant.semana_numero : curva[i].semana_numero - 1
    const dAnt = ant ? dia(datasDaSemana(ant.semana_numero).data_fim) : dia(datasDaSemana(curva[i].semana_numero).data_inicio) - 1
    wEq = wAnt + f * (curva[i].semana_numero - wAnt)
    diaEq = dAnt + f * (dia(datasDaSemana(curva[i].semana_numero).data_fim) - dAnt)
    break
  }
  if (wEq == null) return null
  const semanas = wEq - semMedida
  const dias = Math.round(diaEq - dia(datasDaSemana(semMedida).data_fim))
  const fim = datasDaSemana(curva[curva.length - 1].semana_numero).data_fim
  const termino = new Date((dia(fim) - dias) * 864e5).toISOString().slice(0, 10)
  return { semanas, dias, real, wEq, termino, fim, semMed: semMedida }
}

function Kpis({ k, semana, painel, mostrar, curva }) {
  const router = useRouter()
  const [abrirAPagar, setAbrirAPagar] = useState(false)
  const [abrirProjecao, setAbrirProjecao] = useState(false)
  const [abrirGrupos, setAbrirGrupos] = useState(false)   // quadro "custo direto por grupo" (pedido 13C)
  useEffect(() => { setAbrirAPagar(false) }, [semana])

  const ok = painel && !painel.erro
  const carregando = painel == null ? 'carregando…' : painel.erro ? 'indisponível: ' + painel.erro : null
  const tot = ok ? painel.totais : null
  const contas = ok ? painel.contas : null
  const fisico = mostrar === 'fisico'
  const sRef = S2(semana)
  const semMedida = Math.min(semana, k.ultima_semana_medida || semana)
  const sMed = S2(k.ultima_semana_medida || semana)

  // direto
  const agregado = tot ? tot.agregado : null
  const pago = tot ? tot.pago : null
  const aPagarDireto = tot ? tot.a_pagar : 0
  const comprometido = tot ? tot.comprometido : null
  const saldoDireto = tot ? agregado - comprometido : null
  const pctDireto = saldoDireto == null || !(agregado > 0) ? null : 100 * saldoDireto / agregado
  // indireto (planejado: recorrentes diluídos + pontuais no mês, rateio pelos dias)
  const indiretoPlan = k.custo_indireto_planejado_ate || 0
  const indiretoPago = k.custo_indireto_realizado || 0
  const aPagarIndireto = contas && contas.totais ? contas.totais.indireto : 0
  const indiretoReal = indiretoPago + aPagarIndireto
  const saldoIndireto = indiretoPlan - indiretoReal
  const pctIndireto = indiretoPlan > 0 ? 100 * saldoIndireto / indiretoPlan : null
  const saldoTotal = saldoDireto == null ? null : saldoDireto + saldoIndireto
  const baseTotal = (agregado || 0) + indiretoPlan
  const pctTotal = saldoTotal == null || baseTotal <= 0 ? null : 100 * saldoTotal / baseTotal
  // avanço (horas)
  const av = ok ? painel.avanco : null
  const avancoPlan = av ? av.planejado : k.avanco_hh_planejado
  const avancoReal = k.tem_medicao ? (av ? av.realizado : k.avanco_hh_realizado) : null
  const adiantamento = calcularAdiantamento(curva || [], semMedida)
  const cor = v => v == null ? REAL : v >= 0 ? VERDE : VERMELHO

  const card = (c) => (
    <div key={c.l} className={'kpi' + (c.onClick || c.link ? ' kpi-clickable' : '')}
         onClick={c.onClick || (c.link ? () => router.push(c.link) : undefined)} title={c.title}>
      <div className="kpi-label">{c.l}</div>
      <div className="kpi-value" style={{ fontSize: 20, lineHeight: 1.2, color: c.c || undefined }}>
        {c.pill ? <span style={PILL}>{c.v}</span> : c.v}
      </div>
      <div className="kpi-sub" style={c.cs ? { color: c.cs } : null}>{c.s}</div>
    </div>
  )

  const c1 = { l: 'Valor agregado ↗', c: PLAN, v: fmt2(agregado), link: `/custos-diretos?semana=${semana}`,
    s: carregando || `Executado até ${sRef} · medição de ${sMed}`,
    title: 'Serviço executado a preço de orçamento (percentual × custo da linha; material pela regra do material).' }
  const c2 = { l: `Custo direto realizado ${abrirGrupos ? '▴' : '▾'}`, c: REAL, pill: true, v: fmt2(comprometido),
    onClick: () => setAbrirGrupos(v => !v), title: 'Ver o custo direto por grupo',
    s: carregando || <>{agregado > 0 ? `${pc1(100 * comprometido / agregado)} do executado (pago + a pagar)` : '—'}
      <div>pago {fmt2(pago)} · a pagar {fmt2(aPagarDireto)} · até {sRef}</div></> }
  const c3 = { l: 'Saldo custo direto', v: fmt2(saldoDireto), c: cor(saldoDireto),
    s: saldoDireto == null ? (carregando || '—') : `${saldoDireto >= 0 ? 'Economia' : 'Estouro'} · até ${sRef}`,
    cs: saldoDireto == null ? null : cor(saldoDireto),
    title: `Valor agregado − custo realizado (pago + a pagar)\n${fmt2(agregado)} − ${fmt2(comprometido)}` }
  const c4 = { l: '% Desvio do custo direto', v: pctDireto == null ? '—' : sinal(pctDireto), c: cor(pctDireto),
    s: pctDireto == null ? 'Sem medição' : `${pctDireto >= 0 ? 'Economia' : 'Estouro'} sobre o valor agregado · até ${sRef}`,
    title: `Saldo do direto ÷ valor agregado\n${fmt2(saldoDireto)} ÷ ${fmt2(agregado)}` }
  const c5 = { l: 'Saldo total da obra', v: fmt2(saldoTotal), c: cor(saldoTotal),
    s: pctTotal == null ? 'Sem medição' : `${sinal(pctTotal)} · direto + indireto`, cs: pctTotal == null ? null : cor(pctTotal),
    title: `Saldo do direto ${fmt2(saldoDireto)} + saldo do indireto ${fmt2(saldoIndireto)} = ${fmt2(saldoTotal)}\n% = saldo total ÷ (valor agregado + indireto planejado)` }
  const c4f = { l: 'Avanço físico · planejado', v: pc1(avancoPlan), s: `Hh planejado ÷ Hh do projeto · em ${sRef}`,
    link: `/avanco-fisico?semana=${semana}` }
  const desv = avancoReal == null ? null : avancoReal - avancoPlan
  const c5f = { l: 'Desvio físico', v: desv == null ? '—' : sinal(desv), c: desv == null ? REAL : cor(desv),
    s: desv == null ? 'Sem medição' : `${desv >= 0 ? 'Adiantado' : 'Atrasado'} · p.p. do projeto · em ${sRef} · medição de ${sMed}` }

  const c6 = { l: 'Custo indireto planejado ↗', c: PLAN, v: fmt2(indiretoPlan), link: `/custos-indiretos?semana=${semana}`,
    s: `Rateio linear · acumulado até ${sRef}`,
    title: 'Recorrentes (engenheiro, contabilidade, IPTU, despesas bancárias…) diluídos pela obra toda; pontuais no mês previsto.' }
  const c7 = { l: 'Custo indireto realizado ↗', c: REAL, pill: true, v: fmt2(indiretoReal), link: `/custos-indiretos?semana=${semana}`,
    s: <>{indiretoPlan > 0 ? `${pc1(100 * indiretoReal / indiretoPlan)} do planejado (pago + a pagar)` : '—'}
      <div>pago {fmt2(indiretoPago)} · a pagar {fmt2(aPagarIndireto)}</div></> }
  const aRealizarInd = k.custo_indireto_a_realizar || 0   // pontuais planejados ainda sem pagamento (pedido 14A)
  const c8 = { l: 'Saldo custo indireto', v: fmt2(saldoIndireto), c: cor(saldoIndireto),
    s: (saldoIndireto >= 0 ? 'Economia' : 'Estouro') + (aRealizarInd > 0.005 ? ` · inclui ${fmt2(aRealizarInd)} a realizar` : ''),
    cs: cor(saldoIndireto),
    title: aRealizarInd > 0.005 ? `Planejado − realizado. Inclui ${fmt2(aRealizarInd)} de pontuais planejados até ${sRef} e ainda não pagos (a realizar): não é economia de verdade.` : undefined }
  const c9 = { l: '% Desvio do custo indireto', v: pctIndireto == null ? '—' : sinal(pctIndireto), c: cor(pctIndireto),
    s: pctIndireto == null ? '—' : `${pctIndireto >= 0 ? 'Economia' : 'Estouro'} sobre o planejado · até ${sRef}`,
    title: `Saldo do indireto ÷ indireto planejado\n${fmt2(saldoIndireto)} ÷ ${fmt2(indiretoPlan)}` }
  const c10 = { l: `Custo direto a pagar ${abrirAPagar ? '▴' : '▾'}`, c: '#c9a45c', v: fmt2(aPagarDireto),
    onClick: () => setAbrirAPagar(v => !v),
    s: !contas ? (carregando || '—') : !contas.disponivel ? 'Aguardando a carga do contas a pagar'
      : contas.fechamento ? `Vencimentos a partir de ${contas.fechamento} · fechamento ${contas.fechamento}`
      : `Nenhum fechamento até ${sRef}`,
    title: contas && contas.fechamento
      ? `Custo direto a pagar (só direto e não recorrente), o mesmo valor que entra no custo realizado.\nIndireto a pagar (fora deste card): ${fmt2(aPagarIndireto)}. Clique para ver os títulos.`
      : undefined }
  const c9f = { l: 'Avanço físico · realizado ↗', c: REAL, v: pc1(avancoReal), link: `/avanco-fisico?semana=${semana}`,
    s: avancoReal == null ? 'Sem medição lançada' : `Hh executado ÷ Hh do projeto · medido até ${sMed}` }
  const c10f = { l: 'Adiantamento',
    v: adiantamento == null ? '—' : `${adiantamento.semanas >= 0 ? '+' : ''}${adiantamento.semanas.toFixed(1).replace('.', ',')} semanas`,
    c: adiantamento == null ? REAL : cor(adiantamento.semanas),
    s: adiantamento == null ? 'Sem medição'
      : `${adiantamento.semanas >= 0 ? 'Adiantado' : 'Atrasado'} ${Math.abs(adiantamento.dias)} dias · término projetado ${dmy(adiantamento.termino)} se o ritmo for mantido`,
    title: adiantamento == null ? 'Sem medição' :
      `Físico realizado na última medição (${S2(adiantamento.semMed)}): ${pc1(adiantamento.real)}\n` +
      `A curva planejada atinge esse valor na S${adiantamento.wEq.toFixed(1).replace('.', ',')} (interpolada)\n` +
      `Adiantamento = S${adiantamento.wEq.toFixed(1).replace('.', ',')} − ${S2(adiantamento.semMed)} = ${adiantamento.semanas.toFixed(1).replace('.', ',')} semanas (${adiantamento.dias} dias)\n` +
      `Término projetado = término do cronograma (${dmy(adiantamento.fim)}) − ${adiantamento.dias} dias = ${dmy(adiantamento.termino)}\nVale se o ritmo for mantido.` }
  const c11 = { l: `Projeções de custo final ${abrirProjecao ? '▴' : '▾'}`, v: fmt2(tot ? tot.orcado : null),
    onClick: () => setAbrirProjecao(v => !v), s: 'Orçado do custo direto · clique para ver as projeções' }

  const linha1 = fisico ? [c1, c2, c3, c4f, c5f] : [c1, c2, c3, c4, c5]
  const linha2 = fisico ? [c6, c7, c8, c9f, c10f] : [c6, c7, c8, c9, c10]
  const grade = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }

  return (
    <>
      <div className="kpi-grid" style={grade}>{linha1.map(card)}</div>
      <div className="kpi-grid" style={{ ...grade, marginTop: -10 }}>{linha2.map(card)}</div>
      {!fisico && abrirAPagar && <ListaContas semana={semana} />}
      {abrirGrupos && <CustoPorGrupo semana={semana} />}
      <div className="kpi-grid" style={{ ...grade, marginTop: -10 }}>{card(c11)}</div>
      {abrirProjecao && (
        <div className="card"><div className="kpi-sub">Projeções no próximo pedido.</div></div>
      )}
    </>
  )
}

/* ─── CONTAS A PAGAR: lista do card "Custo direto a pagar" ─────────────────────
   Títulos do fechamento por mês de vencimento, com os totais direto / indireto / geral
   (/api/contas-a-pagar, sem senha, como no Flats). */
function ListaContas({ semana }) {
  const [lista, setLista] = useState(null)
  useEffect(() => {
    setLista(null)
    fetch(`/api/contas-a-pagar?semana=${semana}`).then(r => r.json())
      .then(j => setLista(j.error ? { erro: j.message || j.error } : j)).catch(e => setLista({ erro: e.message }))
  }, [semana])
  const mesBR = m => m ? m.split('-').reverse().join('/') : '—'
  return (
    <div className="card">
      {!lista ? <div className="loading">Carregando títulos…</div>
        : lista.erro ? <div className="kpi-sub">Não foi possível carregar: {lista.erro}</div>
        : !lista.fechamento ? <div className="kpi-sub">Nenhum fechamento de contas a pagar até a {S2(semana)}.</div>
        : <>
          {lista.por_mes.map(m => (
            <div key={m.mes} style={{ marginBottom: 14 }}>
              <div className="form-section-title" style={{ marginBottom: 6 }}>
                Vencimento {mesBR(m.mes)} · {fmt2(m.total)}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Fornecedor</th><th style={{ width: 130 }}>Documento</th><th style={{ width: 60 }}>Parcela</th>
                    <th style={{ width: 92 }}>Vencimento</th><th style={{ width: 110, textAlign: 'right' }}>Valor</th>
                    <th style={{ width: 150 }}>EAP</th><th style={{ width: 120 }}>Tipo</th><th>Alerta</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.titulos.filter(t => t.competencia_vencimento === m.mes).map(t => (
                    <tr key={t.chave}>
                      <td>{t.fornecedor}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{t.num_documento}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{t.parcela || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{dmy(t.data_vencimento)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt2(t.valor)}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {t.eaps.map(e => (e.codigo_eap || 'pendente') + (e.pavimento ? ' ' + e.pavimento : '')).join(', ')}
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {t.tipo === 'direto recorrente' ? 'direto recorrente (fora do card)' : t.tipo}
                      </td>
                      <td style={{ fontSize: 11, color: t.alertas.length ? 'var(--amber-tx)' : 'var(--text3)' }}>
                        {t.alertas.length ? t.alertas.join('; ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div className="kpi-sub">
            Totais do fechamento {lista.fechamento}: direto {fmt2(lista.totais.direto)} (entra no card e no custo
            realizado) · direto recorrente {fmt2(lista.totais.direto_recorrente)} · indireto{' '}
            {fmt2(lista.totais.indireto)} · pendente {fmt2(lista.totais.pendente)} · geral {fmt2(lista.totais.total)}
          </div>
        </>}
    </div>
  )
}

/* ─── CURVA S SEMANAL ─────────────────────────────────────── */
// so = 'pct' (curva física, horas) | 'rs' (curva financeira, custo direto) | ausente (as quatro linhas)
function CurvaS({ semanas, semAtual, base, so }) {
  const porHora = base === 'horas'
  const W = 900, H = 340, PADL = 52, PADR = 62, PADT = 26, PADB = 40
  const n = semanas.length
  const [hover, setHover] = useState(null)
  const [ocultas, setOcultas] = useState({})

  const maxFin = Math.max(...semanas.map(m => Math.max(m.financeiro_planejado || 0, m.financeiro_realizado || 0)), 1)
  const x = i => PADL + (i / (n - 1)) * (W - PADL - PADR)
  const yPct = v => H - PADB - (v / 100) * (H - PADT - PADB)
  const yFin = v => H - PADB - (v / maxFin) * (H - PADT - PADB)

  const todas = [
    { id: 'fp', nome: porHora ? 'Físico planejado (h)' : 'Físico planejado', cor: '#5B9BD5',
      campo: porHora ? 'hh_planejado' : 'fisico_planejado', esc: yPct, dash: '5,4', tipo: 'pct' },
    { id: 'fr', nome: porHora ? 'Físico realizado (h)' : 'Físico realizado', cor: CORES.realizado,
      campo: porHora ? 'hh_realizado' : 'fisico_realizado', esc: yPct, dash: null, tipo: 'pct' },
    { id: '$p', nome: 'Financeiro planejado', cor: '#C8860A', campo: 'financeiro_planejado',
      esc: yFin, dash: '5,4', tipo: 'rs' },
    { id: '$r', nome: 'Financeiro realizado', cor: CORES.realizado, campo: 'financeiro_realizado',
      esc: yFin, dash: null, tipo: 'rs' },
  ]
  const series = so ? todas.filter(s => s.tipo === so) : todas
  const visiveis = series.filter(s => !ocultas[s.id])

  const linha = (campo, esc) => {
    let d = ''
    semanas.forEach((m, i) => {
      const v = m[campo]
      if (v == null) return
      d += (d === '' ? 'M' : 'L') + x(i).toFixed(1) + ',' + esc(v).toFixed(1)
    })
    return d
  }

  // clique liga e desliga cada linha — dá para combinar as que quiser
  function alternar(id) {
    const nova = { ...ocultas, [id]: !ocultas[id] }
    // nunca deixa o gráfico vazio
    if (series.every(s => nova[s.id])) return
    setOcultas(nova)
  }
  const mostrarSo = ids => {
    const o = {}
    series.forEach(s => { if (!ids.includes(s.id)) o[s.id] = true })
    setOcultas(o)
  }

  function mover(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    if (px < PADL - 10 || px > W - PADR + 10) { setHover(null); return }
    const i = Math.round(((px - PADL) / (W - PADL - PADR)) * (n - 1))
    setHover(Math.max(0, Math.min(i, n - 1)))
  }

  const h = hover != null ? semanas[hover] : null

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}
           onMouseMove={mover} onMouseLeave={() => setHover(null)}>
        {[0, 25, 50, 75, 100].map(p => (
          <g key={p}>
            <line x1={PADL} y1={yPct(p)} x2={W - PADR} y2={yPct(p)}
                  stroke="var(--border)" strokeWidth="1" />
            {so !== 'rs' && <text x={PADL - 8} y={yPct(p) + 3} fill="var(--text3)" fontSize="9"
                  textAnchor="end">{p}%</text>}
            {so !== 'pct' && <text x={so === 'rs' ? PADL - 8 : W - PADR + 8} y={yPct(p) + 3} fill="var(--text3)" fontSize="9"
                  textAnchor={so === 'rs' ? 'end' : 'start'}>
              {fmtMoedaK(maxFin * p / 100)}
            </text>}
          </g>
        ))}
        {semanas.map((m, i) => (m.semana_numero % 8 === 0 || m.semana_numero === 1) && (
          <text key={i} x={x(i)} y={H - PADB + 15} fill="var(--text3)" fontSize="8"
                textAnchor="middle">S{m.semana_numero}</text>
        ))}

        <line x1={x(semAtual - 1)} y1={PADT - 10} x2={x(semAtual - 1)} y2={H - PADB}
              stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5,4" />
        <text x={x(semAtual - 1)} y={PADT - 14} fill="var(--accent)" fontSize="9"
              textAnchor="middle" fontWeight="bold">S{semAtual}</text>

        {visiveis.map(s => (
          <path key={s.id} d={linha(s.campo, s.esc)} fill="none" stroke={s.cor}
                strokeWidth="2" strokeDasharray={s.dash || 'none'}
                opacity={s.dash ? .62 : 1} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {h && (
          <g>
            <line x1={x(hover)} y1={PADT - 10} x2={x(hover)} y2={H - PADB}
                  stroke="var(--text3)" strokeWidth="1" opacity=".55" />
            {visiveis.map(s => h[s.campo] == null ? null : (
              <circle key={s.id} cx={x(hover)} cy={s.esc(h[s.campo])} r="3.5"
                      fill={s.cor} stroke="var(--bg)" strokeWidth="1.5" />
            ))}
          </g>
        )}
      </svg>

      {/* leitura da semana sob o cursor */}
      <div style={{ minHeight: 62, marginTop: 4 }}>
        {h ? (
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center',
                        padding: '10px 14px', background: 'var(--bg3)', borderRadius: 9,
                        border: '1px solid var(--border)' }}>
            <div style={{ font: '600 12px var(--mono)', color: 'var(--accent)' }}>
              {semanaLabel(h.semana_numero)}
            </div>
            {visiveis.map(s => (
              <div key={s.id}>
                <div className="kpi-sub">{s.nome}</div>
                <div style={{ font: '600 13px var(--mono)', color: s.cor }}>
                  {h[s.campo] == null ? '—'
                    : s.tipo === 'pct' ? fmtPct(h[s.campo], 2) : fmtMoeda2(h[s.campo])}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="kpi-sub" style={{ textAlign: 'center', padding: '14px 0' }}>
            Passe o mouse sobre o gráfico para ver os valores de cada semana.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10,
                    justifyContent: 'center' }}>
        {series.map(s => {
          const off = ocultas[s.id]
          return (
            <button key={s.id} onClick={() => alternar(s.id)}
              title={off ? 'clique para mostrar' : 'clique para ocultar'}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11,
                       padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                       background: off ? 'transparent' : 'var(--bg3)',
                       border: '1px solid ' + (off ? 'var(--border)' : 'var(--border2)'),
                       color: off ? 'var(--text3)' : 'var(--text2)',
                       opacity: off ? .5 : 1 }}>
              <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5"
                stroke={off ? 'var(--text3)' : s.cor} strokeWidth="2.5"
                strokeDasharray={s.dash || 'none'} /></svg>
              {s.nome}
            </button>
          )
        })}
      </div>

      {/* atalhos de comparação (só na curva com as quatro linhas) */}
      {!so && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10,
                    justifyContent: 'center' }}>
        {[['Todas', ['fp', 'fr', '$p', '$r']],
          ['Só físico', ['fp', 'fr']],
          ['Só financeiro', ['$p', '$r']],
          ['Só planejado', ['fp', '$p']],
          ['Só realizado', ['fr', '$r']]].map(([l, ids]) => {
          const ativo = series.every(s => ids.includes(s.id) ? !ocultas[s.id] : !!ocultas[s.id])
          return (
            <button key={l} className="btn-sm" onClick={() => mostrarSo(ids)}
              style={ativo ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}>
              {l}
            </button>
          )
        })}
      </div>}

      <div className="kpi-sub" style={{ marginTop: 12, textAlign: 'center' }}>
        {so === 'pct'
          ? 'Avanço físico acumulado por horas: planejado pela curva do cronograma, realizado pelas medições.'
          : so === 'rs'
            ? 'Custo direto acumulado: planejado pelo cronograma e realizado (pago) por semana.'
            : 'Eixo esquerdo: avanço físico. Eixo direito: custo direto acumulado.'}
        {' '}Clique numa legenda para mostrar ou ocultar a linha.
      </div>
    </div>
  )
}
