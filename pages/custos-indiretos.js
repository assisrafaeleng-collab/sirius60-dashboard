import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { OBRA, fmtMoeda, fmtMoedaK, fmtPct, semanaLabel,
         inicioSemana, fimSemana, semanaAtualObra } from '../lib/constants'

const AZUL = '#5B9BD5'
const ROSA = '#E91E8C'

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
  const corDesvio = dv => dv == null ? 'var(--text3)'
    : dv > 5 ? 'var(--red-tx)' : dv > -5 ? 'var(--amber-tx)' : 'var(--green-tx)'

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
            const saldo = d.acumulado_ate - d.realizado_ate
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
                    <div className="kpi" style={{ borderLeft: `3px solid ${ROSA}` }}>
                      <div className="kpi-label">Realizado até S{semana}</div>
                      <div className="kpi-value" style={{ color: ROSA }}>
                        {fmtMoeda(d.realizado_ate)}
                      </div>
                      <div className="kpi-sub">{d.qtd_lancamentos} lançamentos de indireto</div>
                    </div>
                    <div className="kpi" style={{
                      borderLeft: `3px solid ${saldo >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
                      <div className="kpi-label">Saldo</div>
                      <div className="kpi-value"
                           style={{ color: saldo >= 0 ? 'var(--green-tx)' : 'var(--red-tx)' }}>
                        {fmtMoeda(saldo)}
                      </div>
                      <div className="kpi-sub"
                           style={{ color: saldo >= 0 ? 'var(--green-tx)' : 'var(--red-tx)' }}>
                        {saldo >= 0 ? 'Economia sobre o planejado' : 'Estouro sobre o planejado'}
                      </div>
                    </div>
                    <div className="kpi" style={{ borderLeft: `3px solid ${corDesvio(d.desvio_pct)}` }}>
                      <div className="kpi-label">Desvio financeiro</div>
                      <div className="kpi-value" style={{ color: corDesvio(d.desvio_pct) }}>
                        {d.desvio_pct == null ? '—'
                          : (d.desvio_pct > 0 ? '+' : '') + fmtPct(d.desvio_pct)}
                      </div>
                      <div className="kpi-sub" style={{ color: corDesvio(d.desvio_pct) }}>
                        {d.desvio_pct == null ? 'sem base de comparação'
                          : d.desvio_pct <= 0 ? 'Dentro do orçamento' : 'Acima do orçamento'}
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
                      {Array.from({ length: OBRA.prazo_semanas }, (_, i) => i + 1).map(s => (
                        <option key={s} value={s}>{semanaLabel(s)}</option>
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
                        {vs && <th style={{ width: 116 }}>Realizado</th>}
                        {vs && <th style={{ width: 70 }}>Desvio</th>}
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
                            <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: ROSA }}>
                              {c.realizado > 0 ? fmtMoeda(c.realizado)
                                : <span style={{ color: 'var(--text3)', fontWeight: 400 }}>—</span>}
                            </td>
                          )}
                          {vs && (
                            <td style={{ fontFamily: 'var(--mono)', fontSize: 11,
                                         color: corDesvio(c.desvio_pct) }}>
                              {c.desvio_pct == null ? '—'
                                : (c.desvio_pct > 0 ? '+' : '') + fmtPct(c.desvio_pct, 0)}
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
