import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { OBRA, fmtPct, semanaLabel, inicioSemana, fimSemana, semanaAtualObra, semanasPorMes } from '../lib/constants'

// Avanço físico (pedido 13): só linhas de SERVIÇO, agrupadas grupo → pavimento → serviço.
// Avanço = horas executadas ÷ horas orçadas (CLAUDE.md). O material não aparece: herda o % do serviço vinculado e
// as horas dele entram nos totais do grupo e da obra. Números da /api/painel (lib/valor-agregado.js).
const AZUL = '#5B9BD5'
const ROSA = '#E91E8C'
const nf = (v, d = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

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

  useEffect(() => {
    if (router.query.semana) setSemana(parseInt(router.query.semana) || semanaAtualObra())
  }, [router.query.semana])
  useEffect(() => {
    setP(null); setErro(null)
    fetch(`/api/painel?semana=${semana}`).then(r => r.json())
      .then(j => (j.error ? setErro(j.message || j.error) : setP(j))).catch(e => setErro(e.message))
  }, [semana])

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
      if (q && !(l.descricao + ' ' + l.codigo_eap + ' ' + l.grupo_nome + ' ' + l.pavimento).toLowerCase().includes(q)) return
      pv.servicos.push({ ...l, desvio })
    })
    return Object.values(grupos).sort((a, b) => a.num - b.num).map(g => ({
      ...g, ag: agrega(g.todas),
      pavs: Object.values(g.pavs).map(pv => ({ ...pv, ag: agrega(pv.todas) })).filter(pv => pv.servicos.length),
    })).filter(g => g.pavs.length)
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

  const Barra = ({ plan, real, w = 96 }) => (
    <div style={{ width: w, position: 'relative' }}>
      <div className="prog-track" style={{ height: 9 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: 9, width: Math.min(plan, 100) + '%',
                      background: AZUL, opacity: .35, borderRadius: 5 }} />
        <div style={{ position: 'absolute', left: 0, top: 0, height: 9, width: Math.min(real, 100) + '%',
                      background: ROSA, borderRadius: 5 }} />
      </div>
    </div>
  )
  const Cab = ({ titulo, sub, ag, nivel, on, onClick, num }) => (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
         padding: nivel === 0 ? '16px 22px' : '10px 22px 10px 40px',
         background: nivel === 0 ? 'transparent' : 'var(--bg3)', borderTop: nivel === 0 ? 'none' : '1px solid var(--border)' }}>
      {num != null && (
        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: 'var(--bg3)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', font: '600 13px var(--mono)', color: 'var(--text2)' }}>{num}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: (nivel === 0 ? '600 14px' : '600 12px') + ' "IBM Plex Sans"' }}>{titulo}</div>
        <div className="kpi-sub">{sub}</div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 64 }}>
        <div style={{ font: '600 13px var(--mono)', color: AZUL }}>{fmtPct(ag.planPct)}</div>
        <div className="kpi-sub">planejado</div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 64 }}>
        <div style={{ font: '600 13px var(--mono)', color: ROSA }}>{fmtPct(ag.realPct)}</div>
        <div className="kpi-sub">realizado</div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 76, font: '600 12px var(--mono)', color: corDesvio(ag.realPct - ag.planPct) }}>
        {pp(ag.realPct - ag.planPct)}
      </div>
      <div style={{ textAlign: 'right', minWidth: 58 }}>
        <div style={{ font: '600 12px var(--mono)', color: 'var(--text2)' }}>{fmtPct(H > 0 ? 100 * ag.hh / H : 0)}</div>
        <div className="kpi-sub">do Hh</div>
      </div>
      <Barra plan={ag.planPct} real={ag.realPct} />
      <span style={{ color: 'var(--text3)', fontSize: 11 }}>{on ? '▲' : '▼'}</span>
    </div>
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
                <div className="kpi" style={{ borderLeft: `3px solid ${ROSA}` }}>
                  <div className="kpi-label">Realizado até S{semana}</div>
                  <div className="kpi-value" style={{ color: ROSA }}>{fmtPct(av.realizado, 2)}</div>
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
              ) : arvore.map(g => {
                const kg = 'g' + g.num
                const onG = !!aberto[kg]
                return (
                  <div className="card" key={kg} style={{ padding: 0, overflow: 'hidden' }}>
                    <Cab nivel={0} num={g.num} titulo={g.nome} on={onG} ag={g.ag}
                         sub={`${g.pavs.length} pavimento${g.pavs.length === 1 ? '' : 's'} · ${nf(g.ag.hh)} h`}
                         onClick={() => setAberto({ ...aberto, [kg]: !onG })} />
                    {onG && g.pavs.map(pv => {
                      const kp = kg + '|' + pv.nome
                      const onP = !!aberto[kp]
                      return (
                        <div key={kp}>
                          <Cab nivel={1} titulo={pv.nome} on={onP} ag={pv.ag}
                               sub={`${pv.servicos.length} serviço${pv.servicos.length === 1 ? '' : 's'} · ${nf(pv.ag.hh)} h`}
                               onClick={() => setAberto({ ...aberto, [kp]: !onP })} />
                          {onP && (
                            <div style={{ padding: '4px 22px 12px 58px' }}>
                              <table>
                                <thead>
                                  <tr>
                                    <th style={{ width: 64 }}>EAP</th>
                                    <th>Serviço</th>
                                    <th style={{ width: 80 }}>Janela</th>
                                    <th style={{ width: 82, textAlign: 'right' }}>Planejado</th>
                                    <th style={{ width: 82, textAlign: 'right' }}>Realizado</th>
                                    <th style={{ width: 86, textAlign: 'right' }}>Desvio</th>
                                    <th style={{ width: 70, textAlign: 'right' }}>% do Hh</th>
                                    <th style={{ width: 84, textAlign: 'right' }}>Medido</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pv.servicos.map(l => (
                                    <tr key={l.id}>
                                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{l.codigo_eap}</td>
                                      <td>{l.descricao}</td>
                                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>S{l.semana_inicio}–S{l.semana_fim}</td>
                                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: AZUL }}>{fmtPct(l.perc_plan, 0)}</td>
                                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: l.medido ? ROSA : 'var(--text3)' }}>
                                        {l.medido ? fmtPct(l.perc_real, 1) : '—'}
                                      </td>
                                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: corDesvio(l.desvio) }}>{pp(l.desvio)}</td>
                                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                                        {fmtPct(H > 0 ? 100 * l.hh / H : 0, 2)}
                                      </td>
                                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                                        {l.semana_medida ? 'S' + l.semana_medida : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

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
