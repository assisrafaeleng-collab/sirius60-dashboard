import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { OBRA, fmtMoeda2, fmtP1, CORES_VA, semanaLabel,
         inicioSemana, fimSemana, semanaAtualObra, semanasPorMes } from '../lib/constants'

// Pedido 13D: valores com 2 casas e % com 1 casa; desvio com o sinal da Visão geral e do Flats
// (planejado − realizado: positivo = economia verde, negativo = estouro vermelho); realizado = pago + a pagar.
const fmtMoeda = fmtMoeda2
const fmtPct = (v) => fmtP1(v)
const { economia: VERDE, estouro: VERMELHO, aPagar: AMBAR } = CORES_VA

const AZUL = '#5B9BD5'
const REALIZADO = '#a99cf0'   // lavanda (pedido 13D)

const ORDENS = [
  { v: 'acumulado', l: 'Maior acumulado' },
  { v: 'total', l: 'Maior total do projeto' },
  { v: 'nome', l: 'Categoria (A-Z)' },
  { v: 'realizado', l: 'Maior realizado' },
]

export default function CustosIndiretos() {
  const router = useRouter()
  const [semana, setSemana] = useState(semanaAtualObra())
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState('acumulado')
  const [visao, setVisao] = useState('vs')   // 'vs' = planejado x realizado | 'plan'

  useEffect(() => {
    if (router.query.semana) setSemana(parseInt(router.query.semana) || semanaAtualObra())
  }, [router.query.semana])

  useEffect(() => {
    setD(null); setErro(null)
    fetch(`/api/indiretos?semana=${semana}`).then(r => r.json())
      .then(j => j.error ? setErro(j.message || j.error) : setD(j))
      .catch(e => setErro(e.message))
  }, [semana])

  const lista = useMemo(() => {
    if (!d) return []
    const q = busca.trim().toLowerCase()
    const l = d.categorias.filter(c => !q || c.categoria.toLowerCase().includes(q))
    const cmp = {
      acumulado: (a, b) => b.acumulado - a.acumulado,
      total: (a, b) => b.valor_total - a.valor_total,
      nome: (a, b) => a.categoria.localeCompare(b.categoria),
      realizado: (a, b) => b.realizado - a.realizado,
    }
    return [...l].sort(cmp[ordem])
  }, [d, busca, ordem])

  const fmtBR = x => x.toLocaleDateString('pt-BR')
  const vs = visao === 'vs'
  const corDesvio = dv => dv == null || Math.abs(dv) < 0.005 ? 'var(--text3)' : dv > 0 ? VERDE : VERMELHO
  const txtPct = dv => dv == null ? '—' : (dv > 0 ? '+' : '') + fmtPct(dv)

  return (
    <>
      <Head><title>{'Custos indiretos planejados - ' + OBRA.nome}</title></Head>
      <div className="page">
        <header className="header">
          <div className="obra-eye">
            Custos indiretos — {vs ? 'planejado vs realizado' : 'planejado'}
          </div>
          <h1 className="obra-nome">{OBRA.nome}</h1>
          <div className="obra-info">
            S{semana} · {fmtBR(inicioSemana(semana))} a {fmtBR(fimSemana(semana))}
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <Link href="/" className="btn-secondary"
                  style={{ textDecoration: 'none', display: 'inline-block' }}>
              ← Dashboard
            </Link>
            <button className="btn-secondary" onClick={() => setVisao(vs ? 'plan' : 'vs')}>
              {vs ? 'Ver só o planejado' : 'Comparar com o realizado'}
            </button>
          </div>
        </header>

        <div style={{ marginTop: 22 }}>
          {erro && (
            <div className="card">
              <div className="card-title">Não foi possível carregar</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{erro}</div>
            </div>
          )}

          {!d && !erro && <div className="loading">Carregando custos indiretos…</div>}

          {d && (() => {
            const saldo = d.desvio
            return (
            <>
              <div className="kpi-grid">
                <div className="kpi" style={{ borderLeft: `3px solid ${AZUL}` }}>
                  <div className="kpi-label">Planejado até S{semana}</div>
                  <div className="kpi-value" style={{ color: vs ? AZUL : undefined }}>
                    {fmtMoeda(d.acumulado_ate)}
                  </div>
                  <div className="kpi-sub">
                    {fmtPct(d.total_projeto > 0 ? 100 * d.acumulado_ate / d.total_projeto : 0)} do total
                  </div>
                </div>
                {vs && (
                  <>
                    <div className="kpi" style={{ borderLeft: `3px solid ${REALIZADO}` }}>
                      <div className="kpi-label">Realizado até S{semana}</div>
                      <div className="kpi-value" style={{ color: REALIZADO }}>
                        {fmtMoeda(d.realizado_ate)}
                      </div>
                      <div className="kpi-sub">
                        {d.acumulado_ate > 0 ? `${fmtPct(100 * d.realizado_ate / d.acumulado_ate)} do planejado (pago + a pagar)` : '—'}
                        <div>pago {fmtMoeda(d.pago_ate)} · <span style={{ color: d.a_pagar > 0 ? AMBAR : undefined }}>a pagar {fmtMoeda(d.a_pagar)}</span></div>
                      </div>
                    </div>
                    <div className="kpi" style={{ borderLeft: `3px solid ${corDesvio(saldo)}` }}>
                      <div className="kpi-label">Saldo custo indireto</div>
                      <div className="kpi-value" style={{ color: corDesvio(saldo) }}>{fmtMoeda(saldo)}</div>
                      <div className="kpi-sub" style={{ color: corDesvio(saldo) }}>
                        {saldo >= 0 ? 'Economia' : 'Estouro'} · planejado − realizado
                      </div>
                    </div>
                    <div className="kpi" style={{ borderLeft: `3px solid ${corDesvio(d.desvio_pct)}` }}>
                      <div className="kpi-label">% Desvio do custo indireto</div>
                      <div className="kpi-value" style={{ color: corDesvio(d.desvio_pct) }}>{txtPct(d.desvio_pct)}</div>
                      <div className="kpi-sub" style={{ color: corDesvio(d.desvio_pct) }}>
                        {d.desvio_pct == null ? 'sem base de comparação'
                          : `${d.desvio_pct >= 0 ? 'Economia' : 'Estouro'} sobre o planejado · até S${semana}`}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="form-section">
                <div className="form-section-title">Filtros e ordenação</div>
                <div className="form-grid-3">
                  <div className="field">
                    <label>Período</label>
                    <select className="styled" value={semana}
                            onChange={e => setSemana(+e.target.value)}>
                      {semanasPorMes().map(g => (
                        <optgroup key={g.mes} label={g.mes}>
                          {g.semanas.map(s => <option key={s} value={s}>{semanaLabel(s)}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Buscar categoria</label>
                    <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                           placeholder="digite para filtrar" />
                  </div>
                  <div className="field">
                    <label>Ordenar por</label>
                    <select className="styled" value={ordem} onChange={e => setOrdem(e.target.value)}>
                      {ORDENS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-title">Custos indiretos por categoria (até S{semana})</div>
                {!lista.length ? (
                  <div className="empty-state"><h3>Nenhuma categoria encontrada</h3></div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 62 }}>EAP</th>
                        <th>Categoria</th>
                        <th style={{ width: 116 }}>Total projeto</th>
                        <th style={{ width: 116 }}>Planejado</th>
                        {vs && <th style={{ width: 130 }}>Pago</th>}
                        {vs && <th style={{ width: 116 }}>A pagar</th>}
                        {vs && <th style={{ width: 120 }} title="Planejado − (pago + a pagar). Positivo = economia (verde), negativo = estouro (vermelho); o % é sobre o planejado">Desvio</th>}
                        {!vs && <th style={{ width: 150 }}>Desembolsado</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11,
                                       color: 'var(--text3)' }}>
                            {c.codigo_eap || '—'}
                          </td>
                          <td>
                            {c.categoria}
                            {c.recorrente && (
                              <span className="badge badge-blue" style={{ marginLeft: 8 }}>
                                recorrente
                              </span>
                            )}
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                            {fmtMoeda(c.valor_total)}
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontWeight: 600,
                                       color: vs ? AZUL : 'var(--accent)' }}>
                            {c.acumulado > 0 ? fmtMoeda(c.acumulado)
                              : <span style={{ color: 'var(--text3)', fontWeight: 400 }}>—</span>}
                          </td>
                          {vs && (
                            <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: REALIZADO }}
                                title={c.pago > 0 ? '' : c.acumulado > 0 ? 'planejado e ainda não pago' : ''}>
                              {c.pago > 0 ? fmtMoeda(c.pago)
                                : <span style={{ color: 'var(--text3)', fontWeight: 400 }}>—</span>}
                            </td>
                          )}
                          {vs && (
                            <td style={{ fontFamily: 'var(--mono)', color: c.a_pagar > 0 ? AMBAR : 'var(--text3)' }}>
                              {c.a_pagar > 0 ? fmtMoeda(c.a_pagar) : '—'}
                            </td>
                          )}
                          {vs && (
                            <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: corDesvio(c.desvio) }}
                                title={c.realizado > 0 || c.acumulado > 0
                                  ? `Planejado − (pago + a pagar)
= ${fmtMoeda(c.acumulado)} − (${fmtMoeda(c.pago)} + ${fmtMoeda(c.a_pagar)})` : ''}>
                              {c.realizado <= 0 && c.acumulado <= 0 ? '—' : (
                                <>
                                  {(c.desvio > 0.005 ? '+' : '') + fmtMoeda(c.desvio)}
                                  <div style={{ fontSize: 10 }}>{txtPct(c.desvio_pct)}</div>
                                </>
                              )}
                            </td>
                          )}
                          {!vs && (
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 11,
                                               minWidth: 42, textAlign: 'right' }}>
                                  {fmtPct(c.pct_desembolsado, 0)}
                                </span>
                                <div className="prog-track" style={{ height: 6 }}>
                                  <div className="prog-fill" style={{
                                    width: c.pct_desembolsado + '%',
                                    background: c.pct_desembolsado >= 100
                                      ? 'var(--green)' : 'var(--blue)',
                                  }} />
                                </div>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="notas-box" style={{ marginTop: 16 }}>
                  Categorias marcadas como <b>recorrentes</b> desembolsam um pouco a cada
                  semana ao longo das {OBRA.prazo_semanas} semanas. As demais concentram o
                  desembolso nas semanas indicadas na primeira coluna.
                </div>
              </div>
            </>
            )
          })()}
        </div>
      </div>
    </>
  )
}
