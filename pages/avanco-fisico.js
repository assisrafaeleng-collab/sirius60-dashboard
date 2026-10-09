import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useEffect, useMemo, useState } from 'react'
import MemoriaAvanco from '../components/MemoriaAvanco'
import { OBRA, CORES, fmtPct, fmtP1, semanaLabel, inicioSemana, fimSemana, semanaAtualObra, semanasPorMes, rotuloPavimento } from '../lib/constants'

// Avanço físico (pedido 13; layout do Flats no 13E): só linhas de SERVIÇO, grupo → pavimento → serviço; grupo com um
// pavimento só (1 Canteiro, 2 Fundação) abre direto nas linhas de serviço.
// Avanço = horas executadas ÷ horas orçadas (CLAUDE.md). O material não aparece: herda o % do serviço vinculado e
// as horas dele entram nos totais do grupo e da obra. Números da /api/painel (lib/valor-agregado.js).
const AZUL = '#5B9BD5'
const REALIZADO = CORES.realizado   // branco (pedido 13E)
const nf = (v, d = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

const CINZA = '#8b919c'
const GRADE = '38px 1fr 110px 110px 110px 90px 28px'   // cabeçalho de grupo e de pavimento (Flats)

// Serviços em curso (planejado já começou ou com medição) e não iniciados, sobre TODAS as linhas de serviço
function emCurso(linhas) {
  const s = linhas.filter(l => l.tipo === 'servico')
  const n = s.filter(l => l.perc_plan > 0 || l.medido).length
  return { emCurso: n, naoIniciados: s.length - n }
}

function agrega(linhas) {
  const hh = linhas.reduce((t, l) => t + l.hh, 0)
  const plan = linhas.reduce((t, l) => t + l.hh_plan, 0)
  const exec = linhas.reduce((t, l) => t + l.hh_exec, 0)
  return { hh, plan, exec, planPct: hh > 0 ? 100 * plan / hh : 0, realPct: hh > 0 ? 100 * exec / hh : 0 }
}

export default function AvancoFisico() {
  const router = useRouter()
  const [semana, setSemana] = useState(semanaAtualObra())
  const [p, setP] = useState(null)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('ativos')   // ativos | atrasados | todos
  const [aberto, setAberto] = useState({})
  const [linhaAberta, setLinhaAberta] = useState(null)   // memória de cálculo aberta (id da linha)
  const [med, setMed] = useState(null)                   // retratos de medição (/api/medicao-retratos)
  const [recarga, setRecarga] = useState(0)              // depois de gravar: recalcula painel e medições

  useEffect(() => {
    if (router.query.semana) setSemana(parseInt(router.query.semana) || semanaAtualObra())
  }, [router.query.semana])
  useEffect(() => {
    if (!recarga) { setP(null); setErro(null) }
    fetch(`/api/painel?semana=${semana}`).then(r => r.json())
      .then(j => (j.error ? setErro(j.message || j.error) : setP(j))).catch(e => setErro(e.message))
  }, [semana, recarga])
  useEffect(() => {
    fetch('/api/medicao-retratos').then(r => r.json())
      .then(j => !j.error && setMed(j)).catch(() => {})
  }, [recarga])

  // produção: serviços + materiais (os materiais só pesam nos totais)
  const prod = useMemo(() => (p ? p.linhas.filter(l => l.producao && (l.tipo === 'servico' || l.tipo === 'material')) : []), [p])
  const H = useMemo(() => prod.reduce((t, l) => t + l.hh, 0), [prod])

  const arvore = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const grupos = {}
    prod.forEach(l => {
      const g = (grupos[l.grupo_num] = grupos[l.grupo_num] || { num: l.grupo_num, nome: l.grupo_nome, todas: [], pavs: {} })
      g.todas.push(l)
      const pv = (g.pavs[l.pavimento] = g.pavs[l.pavimento] || { nome: l.pavimento, todas: [], servicos: [] })
      pv.todas.push(l)
      if (l.tipo !== 'servico') return
      const desvio = l.perc_real - l.perc_plan
      if (filtro === 'ativos' && l.perc_plan <= 0 && !l.medido) return
      if (filtro === 'atrasados' && !(desvio < -5)) return
      if (q && !(l.descricao + ' ' + l.codigo_eap + ' ' + l.grupo_nome + ' ' + rotuloPavimento(l.pavimento, l.grupo_num)).toLowerCase().includes(q)) return
      pv.servicos.push({ ...l, desvio })
    })
    return Object.values(grupos).sort((a, b) => a.num - b.num).map(g => {
      // Grupo com um pavimento só (ex.: 1 Canteiro, 2 Fundação): sem subnível, as linhas aparecem direto (Flats)
      const porPavimento = Object.keys(g.pavs).length > 1
      const pavs = Object.values(g.pavs).map(pv => ({ ...pv, ag: agrega(pv.todas), ...emCurso(pv.todas) }))
        .filter(pv => pv.servicos.length)
      return { ...g, ag: agrega(g.todas), ...emCurso(g.todas), porPavimento, pavs }
    }).filter(g => g.pavs.length)
  }, [prod, busca, filtro])

  const abrirTodos = (on) => {
    const o = {}
    if (on) arvore.forEach(g => { o['g' + g.num] = true; g.pavs.forEach(pv => { o['g' + g.num + '|' + pv.nome] = true }) })
    setAberto(o)
  }
  const corDesvio = dv => dv == null ? 'var(--text3)'
    : dv >= 0 ? 'var(--green-tx)' : dv > -5 ? 'var(--amber-tx)' : 'var(--red-tx)'
  const pp = dv => dv == null ? '—' : (dv > 0 ? '+' : '') + nf(dv, 1) + ' p.p.'
  const fmtBR = d => d.toLocaleDateString('pt-BR')
  const sel = { background: 'var(--accent)', color: '#1a1a1a', borderColor: 'var(--accent)' }
  const retratosDe = l => (med ? med.retratos.filter(r => r.codigo_eap === l.codigo_eap && r.pavimento === l.pavimento) : null)

  // Cabeçalho de grupo (nível 0) ou de pavimento (nível 1), grade do Flats:
  // nº | nome + "N em curso · X h" | planejado | realizado | desvio | "N% do Hh" | ▾
  const Cab = ({ titulo, sub, ag, nivel, on, onClick, num }) => {
    const dv = ag.realPct - ag.planPct
    return (
      <div onClick={onClick} style={{ display: 'grid', gridTemplateColumns: GRADE, gap: 12, alignItems: 'center', cursor: 'pointer',
           padding: nivel === 0 ? '14px 4px' : '12px 4px', ...(nivel === 1 ? { borderTop: '1px solid var(--border)',
           background: 'var(--bg3)', borderRadius: 6, marginBottom: on ? 6 : 0 } : {}) }}>
        {nivel === 0
          ? <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: CINZA, border: '1px solid var(--border2)',
                           borderRadius: 7, padding: '4px 0', textAlign: 'center' }}>{num}</span>
          : <span />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, ...(nivel === 0 ? { textTransform: 'uppercase' } : { color: AZUL }) }}>{titulo}</div>
          <div style={{ fontSize: 11, color: CINZA, marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
          <div style={{ color: AZUL }}>{fmtP1(ag.planPct)}</div>
          <div style={{ fontSize: 10, color: CINZA }}>planejado</div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
          <div style={{ color: REALIZADO }}>{fmtP1(ag.realPct)}</div>
          <div style={{ fontSize: 10, color: CINZA }}>realizado</div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: corDesvio(dv) }}>
          <div>{pp(dv)}</div>
          <div style={{ fontSize: 10, color: CINZA }}>desvio</div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: CINZA, fontSize: 11 }}>
          {fmtP1(H > 0 ? 100 * ag.hh / H : 0)} do Hh
        </div>
        <span style={{ color: CINZA, textAlign: 'center' }}>{on ? '▴' : '▾'}</span>
      </div>
    )
  }
  const subDe = (x, comExec) => `${x.emCurso} em curso · ${comExec ? `${nf(x.ag.exec)} h de ` : ''}${nf(x.ag.hh)} h` +
    (x.naoIniciados > 0 ? ` · ${x.naoIniciados} não iniciado${x.naoIniciados === 1 ? '' : 's'}` : '')

  // Tabela de serviços: EAP | descrição (+ "▾ N medições", abre a memória) | Hh | janela | planejado | realizado |
  // desvio | último retrato
  const tabelaServicos = (servicos) => (
    <table style={{ marginBottom: 6 }}>
      <thead>
        <tr>
          <th style={{ width: 70 }}>EAP</th>
          <th>Descrição</th>
          <th style={{ textAlign: 'right', width: 80 }}>Hh</th>
          <th style={{ width: 84 }}>Janela</th>
          <th style={{ textAlign: 'right', width: 90 }}>Planejado</th>
          <th style={{ textAlign: 'right', width: 90 }}>Realizado</th>
          <th style={{ textAlign: 'right', width: 90 }} title="Realizado − planejado, em pontos percentuais">Desvio</th>
          <th style={{ textAlign: 'right', width: 100 }}>Último retrato</th>
        </tr>
      </thead>
      <tbody>
        {servicos.map(l => {
          const rts = retratosDe(l)
          const on = linhaAberta === l.id
          return (
            <React.Fragment key={l.id}>
              <tr onClick={() => setLinhaAberta(on ? null : l.id)} style={{ cursor: 'pointer' }}
                  title="Ver a memória de cálculo e lançar medição">
                <td style={{ fontFamily: 'var(--mono)', color: CINZA }}>{l.codigo_eap}</td>
                <td>
                  {l.descricao}
                  <span style={{ color: CINZA, fontSize: 11, marginLeft: 8 }}>
                    {on ? '▴' : '▾'}{' '}
                    {rts == null ? '…' : rts.length === 0 ? 'lançar medição'
                      : `${rts.length} ${rts.length === 1 ? 'medição' : 'medições'}`}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: CINZA }}>{nf(l.hh, 1)}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: CINZA }}>S{l.semana_inicio}–S{l.semana_fim}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: AZUL }}>{fmtP1(l.perc_plan)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: l.medido ? REALIZADO : CINZA }}>
                  {l.medido ? fmtP1(l.perc_real) : '—'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: corDesvio(l.desvio) }}>
                  {`${l.desvio > 0 ? '+' : ''}${nf(l.desvio, 1)}`}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: CINZA }}>
                  {l.semana_medida ? `S${String(l.semana_medida).padStart(2, '0')}` : 'sem medição'}
                </td>
              </tr>
              {on && (
                <tr>
                  <td colSpan={8} style={{ padding: 0 }}>
                    {!med ? <div className="loading">Carregando medições…</div> : (
                      <MemoriaAvanco linha={l} modo={med.modo} retratos={rts}
                        onGravou={() => setRecarga(x => x + 1)} />
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          )
        })}
      </tbody>
    </table>
  )

  const av = p?.avanco
  const desvioObra = av ? av.realizado - av.planejado : null

  return (
    <>
      <Head><title>{'Avanço físico - ' + OBRA.nome}</title></Head>
      <div className="page">
        <header className="header">
          <div className="obra-eye">Avanço físico — planejado vs realizado (horas)</div>
          <h1 className="obra-nome">{OBRA.nome}</h1>
          <div className="obra-info">S{semana} · {fmtBR(inicioSemana(semana))} a {fmtBR(fimSemana(semana))}</div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <Link href="/" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>← Dashboard</Link>
          </div>
        </header>

        <div style={{ marginTop: 22 }}>
          {erro ? <div className="card">Não foi possível carregar: {erro}</div>
            : !p ? <div className="loading">Carregando avanço físico…</div> : (
            <>
              <div className="kpi-grid">
                <div className="kpi" style={{ borderLeft: `3px solid ${AZUL}` }}>
                  <div className="kpi-label">Planejado até S{semana}</div>
                  <div className="kpi-value" style={{ color: AZUL }}>{fmtPct(av.planejado, 2)}</div>
                  <div className="kpi-sub">{av.planejado_fonte === 'curva' ? 'curva do cronograma (horas)' : 'horas do orçamento, linear'}</div>
                </div>
                <div className="kpi" style={{ borderLeft: `3px solid ${REALIZADO}` }}>
                  <div className="kpi-label">Realizado até S{semana}</div>
                  <div className="kpi-value" style={{ color: REALIZADO }}>{fmtPct(av.realizado, 2)}</div>
                  <div className="kpi-sub">{nf(av.hh_exec)} h executadas de {nf(av.hh_total)} h orçadas</div>
                </div>
                <div className="kpi" style={{ borderLeft: `3px solid ${desvioObra >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
                  <div className="kpi-label">Desvio físico</div>
                  <div className="kpi-value" style={{ color: corDesvio(desvioObra) }}>{pp(desvioObra)}</div>
                  <div className="kpi-sub" style={{ color: corDesvio(desvioObra) }}>{desvioObra >= 0 ? 'Adiantado' : 'Atrasado'}</div>
                </div>
                <div className="kpi" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <div className="kpi-label">Medição</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>
                    {p.linhas.filter(l => l.medido).length} serviços medidos
                  </div>
                  <div className="kpi-sub">
                    {p.medicao.modo === 'acumulado' ? '% acumulado por linha' : 'lançamentos antigos (incrementos somados)'}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="form-grid-3">
                  <div className="field">
                    <label>Período</label>
                    <select className="styled" value={semana} onChange={e => setSemana(+e.target.value)}>
                      {semanasPorMes().map(g => (
                        <optgroup key={g.mes} label={g.mes}>
                          {g.semanas.map(s => <option key={s} value={s}>{semanaLabel(s)}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Buscar</label>
                    <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="grupo, serviço, código ou pavimento" />
                  </div>
                  <div className="field">
                    <label>Mostrar</label>
                    <div className="btn-row">
                      {[['ativos', 'Já iniciados'], ['atrasados', 'Só atrasados'], ['todos', 'Todos']].map(([v, l]) => (
                        <button key={v} className="btn-sm" onClick={() => setFiltro(v)} style={filtro === v ? sel : null}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn-sm" onClick={() => abrirTodos(true)}>Abrir todos</button>
                  <button className="btn-sm" onClick={() => abrirTodos(false)}>Recolher todos</button>
                </div>
              </div>

              {!arvore.length ? (
                <div className="empty-state"><h3>Nada para mostrar</h3><p>Ajuste os filtros acima.</p></div>
              ) : (
                <div className="card">
                  <div className="card-title">
                    Avanço físico por grupo — até S{String(semana).padStart(2, '0')} · ponderado por hora-homem
                  </div>
                  {arvore.map(g => {
                    const kg = 'g' + g.num
                    const onG = !!aberto[kg]
                    return (
                      <div key={kg} style={{ borderBottom: '1px solid var(--border)' }}>
                        <Cab nivel={0} num={g.num} titulo={g.nome} on={onG} ag={g.ag} sub={subDe(g, false)}
                             onClick={() => setAberto(a => ({ ...a, [kg]: !a[kg] }))} />
                        {onG && !g.porPavimento && (
                          <div style={{ marginBottom: 10 }}>{tabelaServicos(g.pavs[0].servicos)}</div>
                        )}
                        {onG && g.porPavimento && g.pavs.map(pv => {
                          const kp = kg + '|' + pv.nome
                          const onP = !!aberto[kp]
                          return (
                            <div key={kp}>
                              <Cab nivel={1} titulo={rotuloPavimento(pv.nome, g.num)}on={onP} ag={pv.ag} sub={subDe(pv, true)}
                                   onClick={() => setAberto(a => ({ ...a, [kp]: !a[kp] }))} />
                              {onP && tabelaServicos(pv.servicos)}
                            </div>
                          )
                        })}
                        {onG && g.porPavimento && <div style={{ height: 10 }} />}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="notas-box" style={{ marginTop: 16 }}>
                O avanço é medido em <b>horas</b>: horas executadas ÷ horas orçadas. Cada serviço vale o <b>último
                percentual acumulado</b> medido até a S{semana} (código + pavimento). As linhas só de material (aço,
                madeira de forma, concreto usinado, material elétrico e hidráulico) não aparecem aqui: seguem o
                percentual do serviço a que estão vinculadas, e as horas delas entram no total do pavimento, do grupo
                e da obra. O <b>planejado</b> da obra é a curva do cronograma; o de cada serviço é a fração dos dias da
                janela dele já decorrida. Desvio em <b>pontos percentuais</b> (realizado − planejado). Serviço sem
                medição conta como zero.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
