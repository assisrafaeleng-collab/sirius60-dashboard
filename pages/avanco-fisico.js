import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { OBRA, fmtMoeda, fmtMoedaK, fmtPct, semanaLabel,
         inicioSemana, fimSemana, semanaAtualObra, GRUPO_MAX_EVM , ehCustoDeTempo } from '../lib/constants'

const AZUL = '#5B9BD5'
const ROSA = '#E91E8C'

export default function AvancoFisico() {
  const router = useRouter()
  const [itens, setItens] = useState(null)
  const [med, setMed] = useState(null)
  const [semana, setSemana] = useState(semanaAtualObra())
  const [busca, setBusca] = useState('')
  const [pav, setPav] = useState('')
  const [agrupar, setAgrupar] = useState('grupo')
  const [filtro, setFiltro] = useState('ativos')   // ativos | todos | atrasados
  const [metrica, setMetrica] = useState('%')     // % | Qtd | Hh
  const [aberto, setAberto] = useState({})

  useEffect(() => {
    // só o custo direto de serviço entra no avanço físico (grupos 1-16)
    fetch('/dados.json').then(r => r.json())
      .then(d => setItens(d.filter(i => i.g <= GRUPO_MAX_EVM && !ehCustoDeTempo(i))))
  }, [])
  useEffect(() => {
    if (router.query.semana) setSemana(parseInt(router.query.semana) || semanaAtualObra())
  }, [router.query.semana])
  useEffect(() => {
    setMed(null)
    fetch(`/api/avanco?semana=${semana}`).then(r => r.json())
      .then(j => !j.error && setMed(j)).catch(() => {})
  }, [semana])

  const pavimentos = useMemo(
    () => itens ? [...new Set(itens.map(i => i.p))].sort() : [], [itens])

  // percentual que o cronograma espera do item na semana
  const planDe = i => {
    if (semana >= i.b) return 100
    if (semana < i.a) return 0
    return 100 * (semana - i.a + 1) / (i.b - i.a + 1)
  }

  const linhas = useMemo(() => {
    if (!itens || !med) return []
    const q = busca.trim().toLowerCase()
    return itens.map(i => {
      const plan = planDe(i)
      const m = med.medido[`${i.i}|${i.p}`]
      const real = m ? m.percentual : null
      // horas que o cronograma já reservou até esta semana
      const hhDecorrida = i.h * plan / 100
      // quantidade executada: medida em campo quando existe, senão derivada do %
      const qExec = (m && m.qtd > 0) ? m.qtd : (real != null ? i.q * real / 100 : null)
      // sem apontamento de horas, estima a produtividade pelo tempo decorrido
      const coefApar = (qExec > 0 && hhDecorrida > 0) ? hhDecorrida / qExec : null
      return { ...i, _plan: plan, _real: real, _medido: !!m,
               _semMed: m?.semana, _quem: m?.medido_por,
               _hh: m?.hh || 0, _qtd: m?.qtd || 0, _coefReal: m?.coef_real ?? null,
               _qExec: qExec, _coefApar: coefApar,
               _desvio: real == null ? null : real - plan }
    }).filter(i => {
      if (filtro === 'ativos' && i._plan <= 0 && !i._medido) return false
      if (filtro === 'atrasados' && !(i._desvio != null && i._desvio < -5)) return false
      if (pav && i.p !== pav) return false
      if (!q) return true
      return (i.d + ' ' + i.i + ' ' + i.n).toLowerCase().includes(q)
    })
  }, [itens, med, semana, busca, pav, filtro])

  // agregados ponderados por custo — a mesma régua da curva planejada
  // % pondera por custo (régua da curva S); R$ mostra valor; Hh mostra horas
  const pesoDe = i => metrica === 'Hh' ? i.h : i.c
  const nf = (v, dec = 0) => v.toLocaleString('pt-BR',
    { minimumFractionDigits: dec, maximumFractionDigits: dec })
  const base = itens ? itens.reduce((s, i) => s + pesoDe(i), 0) : 0
  const planGeral = itens
    ? itens.reduce((s, i) => s + pesoDe(i) * planDe(i) / 100, 0) / (base || 1) * 100 : 0
  const realGeral = (itens && med)
    ? itens.reduce((s, i) => {
        const m = med.medido[`${i.i}|${i.p}`]
        return s + pesoDe(i) * (m ? m.percentual : 0) / 100
      }, 0) / (base || 1) * 100 : 0
  // o valor agregado é sempre monetário, mesmo pesando o avanço por horas
  const baseCusto = itens ? itens.reduce((s, i) => s + i.c, 0) : 0
  const bcwp = baseCusto * realGeral / 100
  const desvioGeral = realGeral - planGeral

  const blocos = useMemo(() => {
    const m = {}
    linhas.forEach(i => {
      const k = agrupar === 'grupo' ? i.n : i.p
      if (!m[k]) m[k] = { chave: k, num: agrupar === 'grupo' ? i.g : null,
                          peso: 0, custo: 0, plan: 0, real: 0, medidos: 0,
                          hh: 0, qtd: 0, hhPlanDosMedidos: 0, itens: [],
                          unids: new Set(), qPlan: 0, qExec: 0, qTotal: 0,
                          concluidos: 0 }
      m[k].peso += pesoDe(i)
      m[k].custo += i.c
      m[k].plan += pesoDe(i) * i._plan / 100
      m[k].real += pesoDe(i) * (i._real || 0) / 100
      if (i._medido) m[k].medidos++
      m[k].hh += i._hh; m[k].qtd += i._qtd
      m[k].unids.add(i.u)
      m[k].qPlan += i.q * i._plan / 100
      m[k].qExec += (i._qExec || 0)
      m[k].qTotal += i.q
      if (i._real != null && i._real >= 99.5) m[k].concluidos++
      if (i._hh > 0) m[k].hhPlanDosMedidos += i.h * (i._real || 0) / 100
      m[k].itens.push(i)
    })
    return Object.values(m).map(b => ({
      ...b,
      planPct: b.peso > 0 ? 100 * b.plan / b.peso : 0,
      realPct: b.peso > 0 ? 100 * b.real / b.peso : 0,
      // eficiência: horas que o cronograma daria ao que foi feito ÷ horas gastas.
      // Acima de 1 = rendeu mais do que o previsto.
      efic: b.hh > 0 ? b.hhPlanDosMedidos / b.hh : null,
      // só dá para somar quantidade quando o grupo inteiro usa a mesma unidade
      unidUnica: b.unids.size === 1 ? [...b.unids][0] : null,
    })).sort((a, b) => b.peso - a.peso)
  }, [linhas, agrupar, metrica])

  const corDesvio = dv => dv == null ? 'var(--text3)'
    : dv >= 0 ? 'var(--green-tx)' : dv > -5 ? 'var(--amber-tx)' : 'var(--red-tx)'
  const fmtBR = d => d.toLocaleDateString('pt-BR')

  return (
    <>
      <Head><title>{'Avanço físico - ' + OBRA.nome}</title></Head>
      <div className="page">
        <header className="header">
          <div className="obra-eye">Avanço físico — planejado vs executado</div>
          <h1 className="obra-nome">{OBRA.nome}</h1>
          <div className="obra-info">
            S{semana} · {fmtBR(inicioSemana(semana))} a {fmtBR(fimSemana(semana))}
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <Link href="/" className="btn-secondary"
                  style={{ textDecoration: 'none', display: 'inline-block' }}>
              ← Dashboard
            </Link>
          </div>
        </header>

        <div style={{ marginTop: 22 }}>
          {!itens || !med ? <div className="loading">Carregando avanço físico…</div> : (
            <>
              <div className="kpi-grid">
                <div className="kpi" style={{ borderLeft: `3px solid ${AZUL}` }}>
                  <div className="kpi-label">Planejado até S{semana}</div>
                  <div className="kpi-value" style={{ color: AZUL }}>{fmtPct(planGeral)}</div>
                  <div className="kpi-sub">
                    {metrica === 'Hh' ? 'ponderado por horas de mão de obra'
                                      : 'ponderado por custo'}
                  </div>
                </div>
                <div className="kpi" style={{ borderLeft: `3px solid ${ROSA}` }}>
                  <div className="kpi-label">Executado até S{semana}</div>
                  <div className="kpi-value" style={{ color: ROSA }}>{fmtPct(realGeral)}</div>
                  <div className="kpi-sub">
                    {med.qtd_servicos} serviços medidos em {med.semanas_medidas.length} semanas
                  </div>
                </div>
                <div className="kpi" style={{
                  borderLeft: `3px solid ${desvioGeral >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
                  <div className="kpi-label">Desvio físico</div>
                  <div className="kpi-value" style={{ color: corDesvio(desvioGeral) }}>
                    {(desvioGeral > 0 ? '+' : '') + fmtPct(desvioGeral)}
                  </div>
                  <div className="kpi-sub" style={{ color: corDesvio(desvioGeral) }}>
                    {desvioGeral >= 0 ? 'Adiantado' : 'Atrasado'} em pontos percentuais
                  </div>
                </div>
                <div className="kpi" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <div className="kpi-label">Valor agregado (BCWP)</div>
                  <div className="kpi-value">{fmtMoeda(bcwp)}</div>
                  <div className="kpi-sub">de {fmtMoedaK(baseCusto)} de base física</div>
                </div>
              </div>

              <div className="form-section">
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
                    <label>Buscar</label>
                    <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                           placeholder="grupo, serviço ou código" />
                  </div>
                  <div className="field">
                    <label>Pavimento</label>
                    <select className="styled" value={pav} onChange={e => setPav(e.target.value)}>
                      <option value="">Todos</option>
                      {pavimentos.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-grid-3" style={{ marginTop: 14 }}>
                  <div className="field">
                    <label>Mostrar</label>
                    <div className="btn-row">
                      {[['ativos', 'Já iniciados'], ['atrasados', 'Só atrasados'],
                        ['todos', 'Todos os serviços']].map(([v, l]) => (
                        <button key={v} className="btn-sm" onClick={() => setFiltro(v)}
                          style={filtro === v
                            ? { background: 'var(--accent)', color: '#1a1a1a',
                                borderColor: 'var(--accent)' } : null}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label>Métrica</label>
                    <div className="btn-row">
                      {['%', 'Qtd', 'Hh'].map(v => (
                        <button key={v} className="btn-sm" onClick={() => setMetrica(v)}
                          style={metrica === v
                            ? { background: 'var(--accent)', color: '#1a1a1a',
                                borderColor: 'var(--accent)' } : null}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label>Agrupar por</label>
                    <div className="btn-row">
                      {[['grupo', 'Macrogrupo'], ['pav', 'Pavimento']].map(([v, l]) => (
                        <button key={v} className="btn-sm" onClick={() => setAgrupar(v)}
                          style={agrupar === v
                            ? { background: 'var(--accent)', color: '#1a1a1a',
                                borderColor: 'var(--accent)' } : null}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {!blocos.length ? (
                <div className="empty-state">
                  <h3>Nada para mostrar</h3>
                  <p>{filtro === 'atrasados'
                    ? 'Nenhum serviço medido está mais de 5 pontos atrás do planejado.'
                    : 'Ajuste os filtros acima.'}</p>
                </div>
              ) : blocos.map(b => {
                const dv = b.medidos ? b.realPct - b.planPct : null
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
                          {b.itens.length} serviços · {b.medidos} medidos ·{' '}
                          {metrica === 'Hh' ? nf(b.peso) + ' h' : fmtMoedaK(b.custo)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 74 }}>
                        <div style={{ font: '600 14px var(--mono)', color: AZUL }}>
                          {metrica === 'Hh' ? nf(b.plan) + ' h'
                            : metrica === 'Qtd'
                              ? (b.unidUnica ? nf(b.qPlan, 0) + ' ' + b.unidUnica
                                             : b.itens.length + ' serviços')
                            : fmtPct(b.planPct)}
                        </div>
                        <div className="kpi-sub">
                          {metrica === 'Qtd' && !b.unidUnica ? 'no grupo' : 'planejado'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 74 }}>
                        <div style={{ font: '600 14px var(--mono)', color: ROSA }}>
                          {metrica === 'Qtd'
                            ? (b.unidUnica
                                ? (b.qExec > 0 ? nf(b.qExec, 0) + ' ' + b.unidUnica
                                   : <span style={{ color: 'var(--text3)' }}>—</span>)
                                : <>{b.concluidos} concluído{b.concluidos === 1 ? '' : 's'}</>)
                            : b.medidos
                              ? (metrica === 'Hh' ? nf(b.real) + ' h' : fmtPct(b.realPct))
                              : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </div>
                        <div className="kpi-sub">
                          {metrica === 'Qtd' && !b.unidUnica ? 'de ' + b.itens.length : 'executado'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 60,
                                    font: '600 13px var(--mono)', color: corDesvio(dv) }}>
                        {dv == null ? '—' : (dv > 0 ? '+' : '') + fmtPct(dv)}
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 68 }}>
                        {b.efic == null
                          ? <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                          : <>
                              <div style={{ font: '600 13px var(--mono)',
                                color: b.efic >= 1 ? 'var(--green-tx)'
                                     : b.efic > .85 ? 'var(--amber-tx)' : 'var(--red-tx)' }}>
                                {b.efic.toFixed(2)}
                              </div>
                              <div className="kpi-sub">eficiência</div>
                            </>}
                      </div>
                      {/* barra dupla: planejado atrás, executado na frente */}
                      <div style={{ width: 96, position: 'relative' }}>
                        <div className="prog-track" style={{ height: 10 }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, height: 10,
                                        width: Math.min(b.planPct, 100) + '%',
                                        background: AZUL, opacity: .35, borderRadius: 5 }} />
                          <div style={{ position: 'absolute', left: 0, top: 0, height: 10,
                                        width: Math.min(b.realPct, 100) + '%',
                                        background: ROSA, borderRadius: 5 }} />
                        </div>
                      </div>
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}>{on ? '▲' : '▼'}</span>
                    </div>

                    {on && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '4px 22px 16px' }}>
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: 62 }}>EAP</th>
                              <th>Serviço</th>
                              <th style={{ width: 92 }}>
                                {agrupar === 'grupo' ? 'Pavimento' : 'Grupo'}
                              </th>
                              <th style={{ width: 76 }}>Janela</th>
                              <th style={{ width: 96, textAlign: 'right' }}>
                                {metrica === '%' ? 'Planejado' : 'Plan. acum.'}
                              </th>
                              <th style={{ width: 96, textAlign: 'right' }}>Executado</th>
                              {metrica !== '%' && (
                                <th style={{ width: 96, textAlign: 'right' }}>Total</th>
                              )}
                              {metrica !== '%' && (
                                <th style={{ width: 96, textAlign: 'right' }}>Saldo</th>
                              )}
                              <th style={{ width: 62, textAlign: 'right' }}>Desvio</th>
                              <th style={{ width: 120, textAlign: 'right' }}
                                  title="horas de mão de obra por unidade — cinza é o previsto pelo cronograma">
                                Produtividade
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.itens.sort((a, c) => c.c - a.c).map((i, n) => (
                              <tr key={i.i + i.p + n}>
                                <td style={{ width: 62, fontFamily: 'var(--mono)', fontSize: 11,
                                             color: 'var(--text3)' }}>{i.i}</td>
                                <td>{i.d}</td>
                                <td style={{ width: 92 }}>
                                  <span className="badge badge-gray">
                                    {agrupar === 'grupo' ? i.p : i.n}
                                  </span>
                                </td>
                                <td style={{ width: 76, fontFamily: 'var(--mono)', fontSize: 11,
                                             color: 'var(--text3)' }}>S{i.a}–S{i.b}</td>
                                {(() => {
                                  // total do item na métrica escolhida
                                  const tot = metrica === 'Hh' ? i.h : i.q
                                  const plan = tot * i._plan / 100
                                  // executado: usa a quantidade/horas MEDIDAS quando existem;
                                  // senão deriva do percentual informado
                                  const medido = metrica === 'Hh' ? i._hh : i._qtd
                                  const exec = medido > 0 ? medido
                                    : (i._real != null ? tot * i._real / 100 : null)
                                  const dec = metrica === 'Hh' ? 1 : 1
                                  return (
                                    <>
                                      <td style={{ width: 96, textAlign: 'right',
                                                   fontFamily: 'var(--mono)', color: AZUL }}>
                                        {metrica === '%' ? fmtPct(i._plan, 0) : nf(plan, dec)}
                                      </td>
                                      <td style={{ width: 96, textAlign: 'right',
                                                   fontFamily: 'var(--mono)', color: ROSA }}>
                                        {exec == null
                                          ? <span style={{ color: 'var(--text3)' }}>—</span>
                                          : metrica === '%' ? fmtPct(i._real, 0) : nf(exec, dec)}
                                        {metrica !== '%' && medido > 0 && (
                                          <span style={{ color: 'var(--green-tx)' }} title="medido em campo"> ✓</span>
                                        )}
                                      </td>
                                      {metrica !== '%' && (
                                        <td style={{ width: 96, textAlign: 'right',
                                                     fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                                          {nf(tot, dec)}{' '}
                                          <span style={{ color: 'var(--text3)', fontSize: 10 }}>
                                            {metrica === 'Hh' ? 'h' : i.u}
                                          </span>
                                        </td>
                                      )}
                                      {metrica !== '%' && (
                                        <td style={{ width: 96, textAlign: 'right',
                                                     fontFamily: 'var(--mono)',
                                                     color: exec != null && exec > tot
                                                       ? 'var(--red-tx)' : 'var(--text2)' }}>
                                          {exec == null ? nf(tot, dec) : nf(tot - exec, dec)}
                                        </td>
                                      )}
                                    </>
                                  )
                                })()}
                                <td style={{ width: 62, textAlign: 'right', fontSize: 11,
                                             fontFamily: 'var(--mono)', color: corDesvio(i._desvio) }}>
                                  {i._desvio == null ? '—'
                                    : (i._desvio > 0 ? '+' : '') + fmtPct(i._desvio, 0)}
                                </td>
                                <td style={{ width: 132, textAlign: 'right', fontSize: 11,
                                             fontFamily: 'var(--mono)' }}>
                                  {(() => {
                                    const plan = i.k
                                    const real = i._coefReal ?? i._coefApar
                                    const apontado = i._coefReal != null
                                    if (real == null) {
                                      return <span style={{ color: 'var(--text3)' }}
                                        title="coeficiente do cronograma — ainda sem execução">
                                        {plan ? plan.toFixed(2).replace('.', ',') + ' h/' + (i.u || 'und') : '—'}
                                      </span>
                                    }
                                    const dvc = plan ? 100 * (real - plan) / plan : null
                                    const c = dvc == null ? 'var(--text2)'
                                      : dvc <= 0 ? 'var(--green-tx)'
                                      : dvc < 15 ? 'var(--amber-tx)' : 'var(--red-tx)'
                                    return <span style={{ color: c }} title={
                                      (apontado ? 'horas apontadas ÷ quantidade executada'
                                                : 'horas de cronograma decorridas ÷ quantidade executada')
                                      + ` — previsto ${plan ? plan.toFixed(2) : '—'} h/${i.u || 'und'}`}>
                                      {real.toFixed(2).replace('.', ',')} h/{i.u || 'und'}
                                      {apontado
                                        ? <span style={{ color: 'var(--green-tx)' }}> ✓</span>
                                        : <span style={{ color: 'var(--text3)' }}> ~</span>}
                                      {dvc != null && ` ${dvc > 0 ? '+' : ''}${dvc.toFixed(0)}%`}
                                    </span>
                                  })()}
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

              <div className="notas-box" style={{ marginTop: 16 }}>
                O <b>planejado</b> de cada serviço é a fração do prazo já decorrida: um item
                de S25 a S32, visto na S28, deveria estar em 50%. O <b>executado</b> é o que
                você lançou na medição semanal. Ambos são agregados ponderando pelo{' '}
                <b>custo</b> de cada serviço — a mesma régua da curva S, para que os dois
                números sejam comparáveis.
                <br /><br />
                Na métrica <b>Qtd</b> ou <b>Hh</b>, cada serviço mostra quatro números:
                <b>Plan. acum.</b> é o que o cronograma esperava até a S{semana};
                <b>Executado</b> é o que foi feito — com <span style={{ color: 'var(--green-tx)' }}>✓</span> quando
                veio de quantidade medida em campo, e sem marca quando foi derivado do
                percentual; <b>Total</b> é o teto do orçamento; <b>Saldo</b> é o que ainda
                resta. Saldo negativo em vermelho significa que já se executou mais do que
                o orçamento previa — vale conferir quantitativo.
                <br /><br />
                No cabeçalho do grupo, a métrica <b>Qtd</b> só soma quando todos os
                serviços dali usam a mesma unidade — é o caso de Reboco/Emboço, que é
                todo em m². Onde convivem kg de aço, m² de forma e m³ de concreto, somar
                não significaria nada, então mostro quantos serviços já foram concluídos.
                O total do grupo em percentual: dentro de
                "Estrutura" convivem kg de aço, m² de forma e m³ de concreto, e somar isso
                não significaria nada. Abra o grupo para ver a quantidade de cada serviço
                na sua unidade.
                <br /><br />
                A <b>eficiência</b> compara as horas que o cronograma daria ao que foi
                executado com as horas que a equipe de fato gastou. Acima de 1,00 a obra
                rende mais que o previsto; abaixo de 0,85 há algo a investigar. Ela só
                aparece se você preencher horas na medição semanal — o botão
                "Produtividade" lá liga esses campos.
                <br /><br />
                Serviço sem medição conta como <b>zero</b> no agregado, não como ausente.
                Por isso um grupo com muitos itens não medidos aparece bem atrás do planejado,
                mesmo que a obra esteja em dia — a diferença entre "não fiz" e "não medi"
                depende de você lançar.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
