import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { OBRA, fmtMoeda, fmtMoedaK, fmtPct, semanaLabel, inicioSemana, fimSemana, semanaAtualObra, semanasPorMes } from '../lib/constants'

// Custos diretos (pedido 13; CLAUDE.md 08/10): o custo comprometido (pago + a pagar) é comparado com o VALOR
// AGREGADO da linha (% de avanço × orçado; material pela regra do material; locação = gasto limitado à verba;
// custo de tempo pela obra decorrida), NÃO com o planejado do cronograma. O planejado fica só como "ritmo de gasto
// vs cronograma". Números da /api/painel (lib/valor-agregado.js).
const nf = (v, d = 0) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const REGRA = {
  servico: 'medição', material: 'regra do material', locacao: 'gasto até a verba', tempo: 'obra decorrida',
}

function soma(ls) {
  const t = { orcado: 0, agregado: 0, pago: 0, a_pagar: 0, comprometido: 0, plan_valor: 0 }
  ls.forEach(l => Object.keys(t).forEach(k => { t[k] += Number(l[k]) || 0 }))
  t.desvio = t.agregado - t.comprometido
  t.desvio_pct = t.agregado > 0 ? 100 * t.desvio / t.agregado : (t.comprometido > 0 ? -100 : null)
  t.perc_orcado = t.orcado > 0 ? 100 * t.comprometido / t.orcado : null
  t.saldo_verba = t.orcado - t.comprometido
  return t
}

export default function CustosDiretos() {
  const router = useRouter()
  const [semana, setSemana] = useState(semanaAtualObra())
  const [p, setP] = useState(null)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState({})

  useEffect(() => {
    if (router.query.semana) setSemana(parseInt(router.query.semana) || semanaAtualObra())
  }, [router.query.semana])
  useEffect(() => {
    setP(null); setErro(null)
    fetch(`/api/painel?semana=${semana}`).then(r => r.json())
      .then(j => (j.error ? setErro(j.message || j.error) : setP(j))).catch(e => setErro(e.message))
  }, [semana])

  const arvore = useMemo(() => {
    if (!p) return []
    const q = busca.trim().toLowerCase()
    const grupos = {}
    p.linhas.forEach(l => {
      const g = (grupos[l.grupo_num] = grupos[l.grupo_num] || { num: l.grupo_num, nome: l.grupo_nome, todas: [], pavs: {} })
      g.todas.push(l)
      const pv = (g.pavs[l.pavimento] = g.pavs[l.pavimento] || { nome: l.pavimento, todas: [], visiveis: [], ocultas: 0 })
      pv.todas.push(l)
      if (l.orcado === 0 && l.comprometido === 0) { pv.ocultas++; return }   // escondida, mas somada
      if (q && !(l.descricao + ' ' + l.codigo_eap + ' ' + l.grupo_nome + ' ' + l.pavimento).toLowerCase().includes(q)) return
      pv.visiveis.push(l)
    })
    return Object.values(grupos).sort((a, b) => a.num - b.num).map(g => ({
      ...g, t: soma(g.todas),
      pavs: Object.values(g.pavs).map(pv => ({ ...pv, t: soma(pv.todas) })).filter(pv => pv.visiveis.length),
    })).filter(g => g.pavs.length)
  }, [p, busca])

  const abrirTodos = (on) => {
    const o = {}
    if (on) arvore.forEach(g => { o['g' + g.num] = true; g.pavs.forEach(pv => { o['g' + g.num + '|' + pv.nome] = true }) })
    setAberto(o)
  }
  const corDesvio = (v) => v == null ? 'var(--text3)' : v >= 0 ? 'var(--green-tx)' : 'var(--red-tx)'
  const txtDesvio = (v, pct) => v == null ? '—'
    : (v >= 0 ? '▼ economia ' : '▲ estouro ') + fmtMoedaK(Math.abs(v)) + (pct != null ? ` (${nf(Math.abs(pct), 0)}%)` : '')
  const fmtBR = d => d.toLocaleDateString('pt-BR')

  const Valores = ({ t, forte }) => (
    <>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{fmtMoedaK(t.orcado)}</td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: forte ? 600 : 400 }}>{fmtMoedaK(t.agregado)}</td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: forte ? 600 : 400 }}>
        {t.comprometido > 0 ? fmtMoedaK(t.comprometido) : <span style={{ color: 'var(--text3)' }}>—</span>}
        {t.a_pagar > 0 && (
          <div className="kpi-sub">{fmtMoedaK(t.pago)} pago + {fmtMoedaK(t.a_pagar)} a pagar</div>
        )}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11,
                   color: t.perc_orcado > 100 ? 'var(--red-tx)' : 'var(--text2)' }}>
        {t.perc_orcado == null ? '—' : fmtPct(t.perc_orcado, 0)}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: corDesvio(t.comprometido || t.agregado ? t.desvio : null) }}>
        {t.comprometido || t.agregado ? txtDesvio(t.desvio, t.desvio_pct) : '—'}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11,
                   color: t.saldo_verba < 0 ? 'var(--red-tx)' : 'var(--text2)' }}>{fmtMoedaK(t.saldo_verba)}</td>
    </>
  )
  const Cabecalho = () => (
    <thead>
      <tr>
        <th style={{ width: 64 }}>EAP</th>
        <th>Linha</th>
        <th style={{ width: 92, textAlign: 'right' }}>Orçado</th>
        <th style={{ width: 96, textAlign: 'right' }}>Valor agregado</th>
        <th style={{ width: 132, textAlign: 'right' }}>Custo (pago + a pagar)</th>
        <th style={{ width: 70, textAlign: 'right' }}>% do orçado</th>
        <th style={{ width: 150, textAlign: 'right' }}>Estouro / economia</th>
        <th style={{ width: 92, textAlign: 'right' }}>Saldo da verba</th>
      </tr>
    </thead>
  )

  const t = p?.totais
  const saldo = t ? t.agregado - t.comprometido : 0

  return (
    <>
      <Head><title>{'Custos diretos - ' + OBRA.nome}</title></Head>
      <div className="page">
        <header className="header">
          <div className="obra-eye">Custos diretos — custo comprometido vs valor agregado</div>
          <h1 className="obra-nome">{OBRA.nome}</h1>
          <div className="obra-info">S{semana} · {fmtBR(inicioSemana(semana))} a {fmtBR(fimSemana(semana))}</div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <Link href="/" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>← Dashboard</Link>
          </div>
        </header>

        <div style={{ marginTop: 22 }}>
          {erro ? <div className="card">Não foi possível carregar: {erro}</div>
            : !p ? <div className="loading">Carregando custos diretos…</div> : (
            <>
              <div className="kpi-grid">
                <div className="kpi" style={{ borderLeft: '3px solid var(--border)' }}>
                  <div className="kpi-label">Valor agregado até S{semana}</div>
                  <div className="kpi-value">{fmtMoeda(t.agregado)}</div>
                  <div className="kpi-sub">de {fmtMoedaK(t.orcado)} orçados ({fmtPct(100 * t.agregado / t.orcado)})</div>
                </div>
                <div className="kpi" style={{ borderLeft: '3px solid var(--border)' }}>
                  <div className="kpi-label">Custo comprometido</div>
                  <div className="kpi-value">{fmtMoeda(t.comprometido)}</div>
                  <div className="kpi-sub">
                    {fmtMoedaK(t.pago)} pago + {fmtMoedaK(t.a_pagar)} a pagar
                    {p.contas.fechamento ? ` (fechamento ${p.contas.fechamento})` : ''}
                  </div>
                </div>
                <div className="kpi" style={{ borderLeft: `3px solid ${saldo >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
                  <div className="kpi-label">Saldo (agregado − comprometido)</div>
                  <div className="kpi-value" style={{ color: corDesvio(saldo) }}>{fmtMoeda(saldo)}</div>
                  <div className="kpi-sub" style={{ color: corDesvio(saldo) }}>{saldo >= 0 ? 'Economia' : 'Estouro'}</div>
                </div>
                <div className="kpi" style={{ borderLeft: '3px solid var(--border)' }}>
                  <div className="kpi-label">Ritmo de gasto vs cronograma</div>
                  <div className="kpi-value" style={{ fontSize: 18, color: 'var(--text2)' }}>{fmtMoeda(t.plan_valor)}</div>
                  <div className="kpi-sub">planejado até S{semana} (só referência; não é a comparação do custo)</div>
                </div>
              </div>

              <div className="form-section">
                <div className="form-grid-2">
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
                    <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="grupo, linha, código ou pavimento" />
                  </div>
                </div>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn-sm" onClick={() => abrirTodos(true)}>Abrir todos</button>
                  <button className="btn-sm" onClick={() => abrirTodos(false)}>Recolher todos</button>
                </div>
              </div>

              {arvore.map(g => {
                const kg = 'g' + g.num
                const onG = !!aberto[kg]
                return (
                  <div className="card" key={kg} style={{ padding: 0, overflow: 'hidden' }}>
                    <div onClick={() => setAberto({ ...aberto, [kg]: !onG })} style={{ cursor: 'pointer', padding: '14px 22px' }}>
                      <table><tbody><tr>
                        <td style={{ width: 64 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg3)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', font: '600 13px var(--mono)', color: 'var(--text2)' }}>{g.num}</div>
                        </td>
                        <td><div style={{ font: '600 14px "IBM Plex Sans"' }}>{g.nome} <span style={{ color: 'var(--text3)', fontSize: 11 }}>{onG ? '▲' : '▼'}</span></div>
                          <div className="kpi-sub">ritmo do cronograma até S{semana}: {fmtMoedaK(g.t.plan_valor)}</div></td>
                        <Valores t={g.t} forte />
                      </tr></tbody></table>
                    </div>
                    {onG && g.pavs.map(pv => {
                      const kp = kg + '|' + pv.nome
                      const onP = !!aberto[kp]
                      return (
                        <div key={kp} style={{ borderTop: '1px solid var(--border)' }}>
                          <div onClick={() => setAberto({ ...aberto, [kp]: !onP })}
                               style={{ cursor: 'pointer', padding: '8px 22px', background: 'var(--bg3)' }}>
                            <table><tbody><tr>
                              <td style={{ width: 64 }} />
                              <td><span style={{ font: '600 12px "IBM Plex Sans"' }}>{pv.nome}</span>{' '}
                                <span style={{ color: 'var(--text3)', fontSize: 11 }}>{onP ? '▲' : '▼'}</span>
                                <div className="kpi-sub">{pv.visiveis.length} linha{pv.visiveis.length === 1 ? '' : 's'}
                                  {pv.ocultas ? ` · ${pv.ocultas} sem orçado nem custo (somadas, escondidas)` : ''}</div></td>
                              <Valores t={pv.t} />
                            </tr></tbody></table>
                          </div>
                          {onP && (
                            <div style={{ padding: '4px 22px 12px' }}>
                              <table>
                                <Cabecalho />
                                <tbody>
                                  {pv.visiveis.map(l => (
                                    <tr key={l.id}>
                                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{l.codigo_eap}</td>
                                      <td>
                                        {l.descricao}
                                        <div className="kpi-sub">
                                          {REGRA[l.tipo]}
                                          {l.tipo === 'servico' && ` · ${l.medido ? fmtPct(l.perc_real, 0) + ' executado' : 'sem medição'}`}
                                          {l.tipo === 'material' && ` · segue ${(l.herda_de || []).map(h => h.codigo_eap).join(' + ')} (${fmtPct(l.perc_real, 0)})`
                                            + (l.material_comprado ? ' · comprado antes da execução (neutro)' : '')}
                                          {l.tipo === 'locacao' && ` · neutro · ${fmtPct(l.perc_verba || 0, 0)} da verba`}
                                          {l.tipo === 'tempo' && ` · ${fmtPct(l.perc_real, 0)} da obra decorrida`}
                                          {` · ritmo do cronograma ${fmtMoedaK(l.plan_valor)}`}
                                        </div>
                                      </td>
                                      <Valores t={l} />
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

              {p.fora_orcamento.length > 0 && (
                <div className="card">
                  <div className="card-title">Custos com EAP fora do orçamento</div>
                  <table><tbody>
                    {p.fora_orcamento.map(f => (
                      <tr key={f.codigo_eap}><td style={{ fontFamily: 'var(--mono)' }}>{f.codigo_eap}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMoeda(f.pago)} pago</td>
                        <td style={{ textAlign: 'right' }}>{fmtMoeda(f.a_pagar)} a pagar</td></tr>
                    ))}
                  </tbody></table>
                </div>
              )}

              <div className="notas-box" style={{ marginTop: 16 }}>
                <b>Valor agregado</b> é quanto do orçado já foi "ganho" pela execução: % de avanço da linha × orçado.
                Material segue o serviço vinculado e vale o maior entre esse avanço e o custo comprometido limitado ao
                orçado (material comprado antes da execução fica neutro). Locação (grupo 17) vale o gasto até a verba
                (neutro). Limpeza/EPI (1.1.6) e mão de obra direta (grupo 18) seguem o tempo decorrido da obra.
                <br /><br />
                <b>Custo</b> = pago até o fim da S{semana} + a pagar do último fechamento
                {p.contas.fechamento ? ` (${p.contas.fechamento})` : ''} (só direto e não recorrente). O pagamento sem
                pavimento é rateado entre as linhas da EAP pelo orçado. <b>Estouro/economia</b> = valor agregado −
                custo (▼ economia, ▲ estouro). <b>Saldo da verba</b> = orçado − custo. O planejado do cronograma aparece
                só como ritmo de gasto. Linhas sem orçado e sem custo ficam escondidas, mas somadas.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
