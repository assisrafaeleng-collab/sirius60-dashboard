import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { OBRA, fmtMoeda, fmtMoedaK, fmtPct, semanaLabel,
         inicioSemana, fimSemana, semanaAtualObra } from '../lib/constants'

// Planejado é referência: fica em cinza. Realizado é o número que se procura:
// fica claro. Cor só entra onde há desvio relevante — ver corDesvio abaixo.
const PLAN = '#6e8ba8'   // azul lavado: valor de referencia, canal proprio
const REAL = '#f2f4f7'   // medido em campo: o numero que se procura

// O realizado ganha fundo sutil para nao se confundir com o saldo,
// que tambem e claro e fica ao lado nos cards do topo.
const PILL = { background: 'rgba(255,255,255,0.07)', padding: '3px 8px',
               borderRadius: 6, fontWeight: 500 }

// Zona morta: desvio pequeno é ruído de medição, não ganha cor.
const LIM_NEUTRO = 15   // abaixo disso, cinza
const LIM_ALERTA = 30   // acima disso, estouro

export default function CustosDiretos() {
  const router = useRouter()
  const [visao, setVisao] = useState('vs')   // 'vs' = planejado x realizado | 'plan'
  const [itens, setItens] = useState(null)
  const [api, setApi] = useState(null)
  const [busca, setBusca] = useState('')
  const [semana, setSemana] = useState(semanaAtualObra())
  const [pav, setPav] = useState('')
  const [agrupar, setAgrupar] = useState('grupo')
  const [modo, setModo] = useState('ate')      // 'ate' = acumulado | 'na' = só a semana
  const [metrica, setMetrica] = useState('R$')
  const [aberto, setAberto] = useState({})

  useEffect(() => {
    fetch('/dados.json').then(r => r.json()).then(d => setItens(d.filter(i => i.g <= 18)))
  }, [])
  useEffect(() => {
    if (router.query.semana) setSemana(parseInt(router.query.semana) || semanaAtualObra())
  }, [router.query.semana])
  useEffect(() => {
    setApi(null)
    fetch(`/api/dashboard-integrado?semana=${semana}`).then(r => r.json())
      .then(j => !j.error && setApi(j)).catch(() => {})
  }, [semana])

  const pavimentos = useMemo(
    () => itens ? [...new Set(itens.map(i => i.p))].sort() : [], [itens])

  // Parcela de um item que cabe no recorte escolhido.
  // 'ate'  -> acumulado proporcional até a semana (item de 10 semanas na 3ª vale 30%)
  // 'na'   -> só a parcela daquela semana
  function fator(i) {
    if (!semana) return 1
    const dur = i.b - i.a + 1
    if (modo === 'na') return (semana >= i.a && semana <= i.b) ? 1 / dur : 0
    if (semana >= i.b) return 1
    if (semana < i.a) return 0
    return (semana - i.a + 1) / dur
  }

  const realPorEap = useMemo(() => {
    const m = {}
    ;(api?.comparativo || []).forEach(c => { m[c.codigo_eap] = c.realizado })
    return m
  }, [api])

  const filtrados = useMemo(() => {
    if (!itens) return []
    const q = busca.trim().toLowerCase()
    // o lançamento aponta para a EAP; rateamos entre as linhas dela pelo custo
    const totalEap = {}
    itens.forEach(i => { totalEap[i.i] = (totalEap[i.i] || 0) + i.c })
    return itens.map(i => {
      const f = fator(i)
      const parte = totalEap[i.i] > 0 ? i.c / totalEap[i.i] : 0
      return { ...i, c: i.c * f, h: i.h * f, _f: f, _real: (realPorEap[i.i] || 0) * parte }
    }).filter(i => {
      if (i.c <= 0 && i._real <= 0) return false
      if (pav && i.p !== pav) return false
      if (!q) return true
      return (i.d + ' ' + i.i + ' ' + i.n).toLowerCase().includes(q)
    })
  }, [itens, busca, semana, pav, modo, realPorEap])

  const totalGeral = itens ? itens.reduce((s, i) => s + i.c, 0) : 0
  const totalFiltrado = filtrados.reduce((s, i) => s + i.c, 0)
  const realTotal = filtrados.reduce((s, i) => s + i._real, 0)
  const hhFiltrado = filtrados.reduce((s, i) => s + i.h, 0)
  const desvioTotal = totalFiltrado > 0
    ? 100 * (realTotal - totalFiltrado) / totalFiltrado : null

  const desvioDe = (plan, real) => plan > 0 ? 100 * (real - plan) / plan
                                            : (real > 0 ? 100 : null)

  // Cinza é o estado normal. Só sai do cinza quem passou dos limites acima.
  const corDesvio = dv => dv == null ? 'var(--text3)'
    : dv >= LIM_ALERTA ? 'var(--red-tx)'
    : dv >= LIM_NEUTRO ? 'var(--amber-tx)'
    : dv <= -LIM_NEUTRO ? 'var(--green-tx)'
    : 'var(--text3)'

  // A barra não repete a cor do desvio: ela só acende quando há estouro.
  const corBarra = dv => dv == null ? 'var(--text3)'
    : dv >= LIM_ALERTA ? 'var(--red)'
    : dv >= LIM_NEUTRO ? 'var(--amber)'
    : 'var(--text3)'

  // Segundo canal de leitura: sobrevive à impressão em preto e branco.
  const seta = dv => dv > 0 ? '▲ ' : dv < 0 ? '▼ ' : ''
  const txtDesvio = (dv, casas) => dv == null ? '—'
    : seta(dv) + fmtPct(Math.abs(dv), casas)

  const saldo = totalFiltrado - realTotal
  const vs = visao === 'vs'

  const blocos = useMemo(() => {
    const m = {}
    filtrados.forEach(i => {
      const k = agrupar === 'grupo' ? i.n : i.p
      if (!m[k]) m[k] = { chave: k, num: agrupar === 'grupo' ? i.g : null,
                          custo: 0, real: 0, hh: 0, itens: [] }
      m[k].custo += i.c; m[k].real += i._real; m[k].hh += i.h; m[k].itens.push(i)
    })
    return Object.values(m).sort((a, b) => (b.custo + b.real) - (a.custo + a.real))
  }, [filtrados, agrupar])

  const valorMetrica = (custo, hh) =>
    metrica === 'R$' ? fmtMoeda(custo)
    : metrica === 'Hh' ? Math.round(hh).toLocaleString('pt-BR') + ' h'
    : fmtPct(totalFiltrado > 0 ? 100 * custo / totalFiltrado : 0)

  const fmtBR = d => d.toLocaleDateString('pt-BR')

  // Estado selecionado dos filtros: contraste, não cor. O âmbar fica
  // reservado para "atenção" nos dados.
  const selecionado = { background: 'var(--text)', color: 'var(--bg)',
                        borderColor: 'var(--text)' }

  return (
    <>
      <Head><title>{'Custos diretos planejados - ' + OBRA.nome}</title></Head>
      <div className="page">
        <header className="header">
          <div className="obra-eye">
            Custos diretos — {vs ? 'planejado vs realizado' : 'planejado'}
          </div>
          <h1 className="obra-nome">{OBRA.nome}</h1>
          <div className="obra-info">
            {OBRA.prazo_semanas} semanas · {fmtBR(inicioSemana(1))} a{' '}
            {fmtBR(fimSemana(OBRA.prazo_semanas))}
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
          {vs ? (
            <div className="kpi-grid">
              <div className="kpi" style={{ borderLeft: '3px solid var(--border)' }}>
                <div className="kpi-label">Planejado até S{semana}</div>
                <div className="kpi-value" style={{ color: PLAN }}>{fmtMoeda(totalFiltrado)}</div>
                <div className="kpi-sub">
                  {blocos.length} grupos · {filtrados.length} itens ativos
                </div>
              </div>
              <div className="kpi" style={{ borderLeft: '3px solid var(--border)' }}>
                <div className="kpi-label">Realizado até S{semana}</div>
                <div className="kpi-value">
                  <span style={{ ...PILL, color: REAL }}>{fmtMoeda(realTotal)}</span>
                </div>
                <div className="kpi-sub">
                  {api ? `${api.metadata.lancamentos} lançamentos na obra` : 'carregando…'}
                </div>
              </div>
              <div className="kpi" style={{
                borderLeft: `3px solid ${saldo >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
                <div className="kpi-label">Saldo</div>
                <div className="kpi-value" style={{
                  color: saldo >= 0 ? 'var(--green-tx)' : 'var(--red-tx)' }}>
                  {fmtMoeda(saldo)}
                </div>
                <div className="kpi-sub" style={{ color: saldo >= 0 ? 'var(--green-tx)' : 'var(--red-tx)' }}>
                  {saldo >= 0 ? 'Economia sobre o planejado'
                              : 'Estouro sobre o planejado'}
                </div>
              </div>
              <div className="kpi" style={{ borderLeft: `3px solid ${corDesvio(desvioTotal)}` }}>
                <div className="kpi-label">Desvio financeiro</div>
                <div className="kpi-value" style={{ color: corDesvio(desvioTotal) }}>
                  {txtDesvio(desvioTotal)}
                </div>
                <div className="kpi-sub">
                  {desvioTotal == null ? 'sem base de comparação'
                    : desvioTotal >= LIM_ALERTA ? 'Acima do orçamento'
                    : desvioTotal >= LIM_NEUTRO ? 'Levemente acima'
                    : desvioTotal <= -LIM_NEUTRO ? 'Economia sobre o planejado'
                    : 'Em linha com o planejado'}
                </div>
              </div>
            </div>
          ) : (
          <div className="hero" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div className="hero-block">
              <div className="hero-label">
                {!semana ? 'Total custo direto'
                  : modo === 'ate' ? `Custo direto previsto até a S${semana}`
                  : `Custo direto previsto na S${semana}`}
              </div>
              <div className="hero-total">
                <div className="hero-num" style={{ fontSize: 34 }}>{fmtMoeda(totalFiltrado)}</div>
              </div>
              <div className="kpi-sub" style={{ marginTop: 8 }}>
                {blocos.length} {agrupar === 'grupo' ? 'macrogrupos' : 'pavimentos'} ·{' '}
                {filtrados.length} itens ·{' '}
                {Math.round(hhFiltrado).toLocaleString('pt-BR')} Hh
                {semana ? ` · ${fmtPct(100 * totalFiltrado / totalGeral)} do orçamento direto` : ''}
              </div>
            </div>
          </div>
          )}

          <div className="form-section">
            <div className="form-grid-3">
              <div className="field">
                <label>Buscar</label>
                <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                       placeholder="macrogrupo, item ou código" />
              </div>
              <div className="field">
                <label>Período</label>
                <select className="styled" value={semana} onChange={e => setSemana(+e.target.value)}>
                  <option value={0}>Todas ({OBRA.prazo_semanas} semanas)</option>
                  {Array.from({ length: OBRA.prazo_semanas }, (_, i) => i + 1).map(s => (
                    <option key={s} value={s}>{semanaLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Pavimento</label>
                <select className="styled" value={pav} onChange={e => setPav(e.target.value)}>
                  <option value="">Todos</option>
                  {pavimentos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            {semana > 0 && (
              <div className="field" style={{ marginTop: 14 }}>
                <label>Recorte</label>
                <div className="btn-row">
                  {[['ate', `Acumulado até S${semana}`], ['na', `Só a S${semana}`]].map(([v, l]) => (
                    <button key={v} className="btn-sm" onClick={() => setModo(v)}
                      style={modo === v ? selecionado : null}>{l}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="form-grid-2" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Agrupar por</label>
                <div className="btn-row">
                  {[['grupo', 'Macrogrupo'], ['pav', 'Pavimento']].map(([v, l]) => (
                    <button key={v} className="btn-sm" onClick={() => setAgrupar(v)}
                      style={agrupar === v ? selecionado : null}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Métrica</label>
                <div className="btn-row">
                  {['%', 'R$', 'Hh'].map(v => (
                    <button key={v} className="btn-sm" onClick={() => setMetrica(v)}
                      style={metrica === v ? selecionado : null}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {!itens ? <div className="loading">Carregando orçamento…</div>
            : !blocos.length ? (
              <div className="empty-state">
                <h3>Nenhum item com esses filtros</h3>
                <p>{semana ? `O cronograma não prevê serviços na S${semana}.` : 'Ajuste a busca.'}</p>
              </div>
            ) : blocos.map(b => {
              const pctTotal = totalFiltrado > 0 ? 100 * b.custo / totalFiltrado : 0
              const dvBloco = desvioDe(b.custo, b.real)
              const on = aberto[b.chave]
              return (
                <div className="card" key={b.chave} style={{ padding: 0, overflow: 'hidden' }}>
                  <div onClick={() => setAberto({ ...aberto, [b.chave]: !on })}
                       style={{ display: 'flex', alignItems: 'center', gap: 16,
                                padding: '18px 22px', cursor: 'pointer' }}>
                    {b.num != null && (
                      <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                                    background: 'var(--bg3)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    font: '600 13px var(--mono)', color: 'var(--text2)' }}>
                        {b.num}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 14px "IBM Plex Sans"' }}>{b.chave}</div>
                      <div className="kpi-sub">
                        {b.itens.length} itens ·{' '}
                        {Math.round(b.hh).toLocaleString('pt-BR')} Hh
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 96 }}>
                      <div style={{ font: '600 14px var(--mono)', color: vs ? PLAN : 'var(--accent)' }}>
                        {valorMetrica(b.custo, b.hh)}
                      </div>
                      <div className="kpi-sub">{vs ? 'planejado' : fmtPct(pctTotal, 2) + ' do total'}</div>
                    </div>
                    {vs && (
                      <>
                        <div style={{ textAlign: 'right', minWidth: 96 }}>
                          <div style={{ font: '600 14px var(--mono)', color: REAL }}>
                            {b.real > 0 ? <span style={PILL}>{fmtMoedaK(b.real)}</span>
                              : <span style={{ color: 'var(--text3)' }}>—</span>}
                          </div>
                          <div className="kpi-sub">realizado</div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 60,
                                      font: '600 13px var(--mono)',
                                      color: corDesvio(dvBloco) }}>
                          {txtDesvio(dvBloco)}
                        </div>
                      </>
                    )}
                    <div className="prog-track" style={{ maxWidth: vs ? 88 : 120, height: 6 }}>
                      <div className="prog-fill" style={{
                        width: (vs ? (b.custo > 0 ? Math.min(100 * b.real / b.custo, 100) : 0)
                                   : pctTotal) + '%',
                        background: vs ? corBarra(dvBloco) : 'var(--accent)' }} />
                    </div>
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>{on ? '▲' : '▼'}</span>
                  </div>

                  {on && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '4px 22px 16px' }}>
                      <table>
                        <tbody>
                          {b.itens.sort((a, c) => c.c - a.c).map((i, n) => (
                            <tr key={i.i + i.p + n}>
                              <td style={{ width: 66, fontFamily: 'var(--mono)', fontSize: 11,
                                           color: 'var(--text3)' }}>{i.i}</td>
                              <td>{i.d}</td>
                              <td style={{ width: 96 }}>
                                <span className="badge badge-gray">
                                  {agrupar === 'grupo' ? i.p : i.n}
                                </span>
                              </td>
                              <td style={{ width: 86, fontFamily: 'var(--mono)', fontSize: 11,
                                           color: 'var(--text3)' }}>
                                S{i.a}–S{i.b}
                                {i._f != null && i._f < 1 && (
                                  <span style={{ color: 'var(--text3)' }}>
                                    {' '}{Math.round(i._f * 100)}%
                                  </span>
                                )}
                              </td>
                              <td style={{ width: 96, textAlign: 'right',
                                           fontFamily: 'var(--mono)',
                                           color: vs ? PLAN : 'var(--text)' }}>
                                {valorMetrica(i.c, i.h)}
                              </td>
                              {vs && (
                                <>
                                  <td style={{ width: 96, textAlign: 'right',
                                               fontFamily: 'var(--mono)', color: REAL }}>
                                    {i._real > 0 ? <span style={PILL}>{fmtMoedaK(i._real)}</span>
                                      : <span style={{ color: 'var(--text3)' }}>—</span>}
                                  </td>
                                  <td style={{ width: 60, textAlign: 'right', fontSize: 11,
                                               fontFamily: 'var(--mono)',
                                               color: corDesvio(desvioDe(i.c, i._real)) }}>
                                    {txtDesvio(desvioDe(i.c, i._real), 0)}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}

          {vs && (
            <div className="notas-box" style={{ marginTop: 16 }}>
              O <b>planejado</b> é a parcela do orçamento que o cronograma reserva até a
              S{semana}. O <b>realizado</b> vem das notas lançadas, rateado entre os
              pavimentos de cada EAP na proporção do orçamento. Desvio negativo significa
              gastar menos do que o previsto até aqui — o que pode ser economia ou serviço
              atrasado, e é a medição física que distingue os dois casos. Desvios de até{' '}
              {LIM_NEUTRO}% aparecem em cinza por serem ruído de medição.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
