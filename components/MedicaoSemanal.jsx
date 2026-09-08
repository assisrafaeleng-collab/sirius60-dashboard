import { useEffect, useMemo, useState } from 'react'
import { OBRA, fmtMoedaK, fmtPct, fmtDate, semanaLabel,
         inicioSemana, fimSemana, dataParaSemana , ehCustoDeTempo } from '../lib/constants'

const AZUL = '#5B9BD5'
const ROSA = '#E91E8C'

export default function MedicaoSemanal({ semana, sessao }) {
  const [itens, setItens] = useState(null)
  const [med, setMed] = useState(null)
  const quem = sessao?.quem || ''
  const senha = sessao?.senha || ''
  const [toast, setToast] = useState(null)
  const [aberto, setAberto] = useState(null)     // chave do serviço expandido
  const [filtro, setFiltro] = useState('semana') // semana | andamento | todos
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState({})
  const [agrupar, setAgrupar] = useState('grupo')   // grupo | pav
  const [fechados, setFechados] = useState({})      // macrogrupos recolhidos

  const chave = (eap, pav) => `${eap}|${pav}`

  useEffect(() => {
    fetch('/dados.json').then(r => r.json())
      .then(d => setItens(d.filter(i => i.g <= 16 && !ehCustoDeTempo(i))))
  }, [])

  function carregar() {
    fetch(`/api/medicao?ate=${OBRA.prazo_semanas}`).then(r => r.json())
      .then(j => j.error ? setToast({ tipo: 'err', txt: j.message || j.error }) : setMed(j))
      .catch(e => setToast({ tipo: 'err', txt: e.message }))
  }
  useEffect(carregar, [])

  const planDe = i => {
    if (semana >= i.b) return 100
    if (semana < i.a) return 0
    return 100 * (semana - i.a + 1) / (i.b - i.a + 1)
  }

  const lista = useMemo(() => {
    if (!itens || !med) return []
    const q = busca.trim().toLowerCase()
    return itens.map(i => {
      const s = med.servicos[chave(i.i, i.p)]
      return { ...i, _acum: s?.acumulado || 0, _lanc: s?.lancamentos || [],
               _plan: planDe(i), _qtd: s?.qtd || 0, _hh: s?.hh || 0 }
    }).filter(i => {
      if (filtro === 'semana' && !(i.a <= semana && i.b >= semana)) return false
      if (filtro === 'andamento' && !(i._acum > 0 && i._acum < 100)) return false
      if (!q) return true
      return (i.d + ' ' + i.i + ' ' + i.n + ' ' + i.p).toLowerCase().includes(q)
    })
  }, [itens, med, semana, filtro, busca])

  // agrupa os serviços e agrega planejado/executado ponderados por custo
  const blocos = useMemo(() => {
    const m = {}
    lista.forEach(i => {
      const k = agrupar === 'grupo' ? i.n : i.p
      if (!m[k]) m[k] = { chave: k, num: agrupar === 'grupo' ? i.g : null,
                          peso: 0, plan: 0, real: 0, lanc: 0, feitos: 0, itens: [] }
      m[k].peso += i.c
      m[k].plan += i.c * i._plan / 100
      m[k].real += i.c * i._acum / 100
      m[k].lanc += i._lanc.length
      if (i._acum >= 99.5) m[k].feitos++
      m[k].itens.push(i)
    })
    return Object.values(m).map(b => ({
      ...b,
      planPct: b.peso > 0 ? 100 * b.plan / b.peso : 0,
      realPct: b.peso > 0 ? 100 * b.real / b.peso : 0,
    })).sort((a, b) => (a.num ?? 99) - (b.num ?? 99) || a.chave.localeCompare(b.chave))
  }, [lista, agrupar])

  function abrir(k, i) {
    if (aberto === k) { setAberto(null); return }
    setAberto(k)
    setForm({
      data: fimSemana(semana).toISOString().slice(0, 10),
      incremento: '', hh: '', qtd: '', observacao: '',
    })
  }

  async function salvar(i) {
    setToast(null)
    try {
      const r = await fetch('/api/medicao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, senha, medido_por: quem,
                               codigo_eap: i.i, pavimento: i.p }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao gravar')
      setToast({ tipo: 'ok', txt: `Lançamento de ${form.incremento}% gravado na S${j.semana}.` })
      setForm({ ...form, incremento: '', hh: '', qtd: '', observacao: '' })
      carregar()
    } catch (e) { setToast({ tipo: 'err', txt: e.message }) }
  }

  async function excluir(id) {
    if (!confirm('Excluir este lançamento?')) return
    try {
      const r = await fetch(`/api/medicao?id=${id}&senha=${encodeURIComponent(senha)}`,
        { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao excluir')
      setToast({ tipo: 'ok', txt: 'Lançamento excluído.' })
      carregar()
    } catch (e) { setToast({ tipo: 'err', txt: e.message }) }
  }

  if (!itens || !med) return <div className="loading">Carregando serviços…</div>

  const emAndamento = lista.filter(i => i._acum > 0 && i._acum < 100).length
  const concluidos = lista.filter(i => i._acum >= 99.5).length

  return (
    <>
      <div className="hero" style={{ marginBottom: 14 }}>
        <div className="hero-block">
          <div className="hero-label">Medição da {semanaLabel(semana).split(' ·')[0]}</div>
          <div className="hero-row">
            <div>
              <div className="hero-cap">Serviços na lista</div>
              <div className="hero-num">{lista.length}</div>
            </div>
            <div>
              <div className="hero-cap">Em andamento</div>
              <div className="hero-num" style={{ color: 'var(--amber-tx)' }}>{emAndamento}</div>
            </div>
            <div className="hero-total">
              <div className="hero-cap">Concluídos</div>
              <div className="hero-num" style={{ color: 'var(--green-tx)' }}>{concluidos}</div>
            </div>
          </div>
        </div>
        <div className="hero-div" />
        <div className="hero-side">
          <div className="hero-cap">Lançamentos registrados</div>
          <div className="hero-side-num">{med.total}</div>
        </div>
      </div>

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'toast-ok' : 'toast-err')}>{toast.txt}</div>}

      <div className="card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span>Serviços</span>
          <span className="btn-row">
            {[['semana', `Previstos na S${semana}`], ['andamento', 'Em andamento'],
              ['todos', 'Todos']].map(([v, l]) => (
              <button key={v} className="btn-sm" onClick={() => setFiltro(v)}
                style={filtro === v ? { background: 'var(--accent)', color: '#1a1a1a',
                                        borderColor: 'var(--accent)' } : null}>{l}</button>
            ))}
            <span style={{ width: 10 }} />
            {[['grupo', 'Por macrogrupo'], ['pav', 'Por pavimento']].map(([v, l]) => (
              <button key={v} className="btn-sm" onClick={() => setAgrupar(v)}
                style={agrupar === v ? { color: 'var(--text)',
                                         borderColor: 'var(--accent)' } : null}>{l}</button>
            ))}
          </span>
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                 placeholder="buscar serviço, código ou pavimento" />
        </div>

        {!lista.length ? (
          <div className="empty-state">
            <h3>Nenhum serviço aqui</h3>
            <p>{filtro === 'semana'
              ? `O cronograma não prevê serviços na S${semana}. Use "Todos" para lançar assim mesmo.`
              : 'Ajuste a busca ou o filtro.'}</p>
          </div>
        ) : blocos.map(b => {
          const recolhido = fechados[b.chave]
          return (
        <div key={b.chave} style={{ marginBottom: 14 }}>
          {/* cabeçalho do macrogrupo */}
          <div onClick={() => setFechados({ ...fechados, [b.chave]: !recolhido })}
               style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                        padding: '12px 14px', marginBottom: 6,
                        background: 'var(--bg3)', borderRadius: 9,
                        border: '1px solid var(--border)' }}>
            {b.num != null && (
              <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: 'var(--bg2)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', font: '600 12px var(--mono)',
                            color: 'var(--text2)' }}>{b.num}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 13px "IBM Plex Sans"', textTransform: 'uppercase',
                            letterSpacing: '.04em' }}>{b.chave}</div>
              <div className="kpi-sub">
                {b.itens.length} serviços · {b.feitos} concluídos ·{' '}
                {b.lanc} lançamento{b.lanc === 1 ? '' : 's'} · {fmtMoedaK(b.peso)}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 58 }}>
              <div style={{ font: '600 13px var(--mono)', color: AZUL }}>
                {fmtPct(b.planPct, 0)}
              </div>
              <div className="kpi-sub">planejado</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 58 }}>
              <div style={{ font: '600 13px var(--mono)',
                            color: b.realPct > 0 ? ROSA : 'var(--text3)' }}>
                {fmtPct(b.realPct, 0)}
              </div>
              <div className="kpi-sub">executado</div>
            </div>
            <div style={{ width: 80, position: 'relative' }}>
              <div className="prog-track" style={{ height: 8 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: 8,
                              width: Math.min(b.planPct, 100) + '%',
                              background: AZUL, opacity: .3, borderRadius: 4 }} />
                <div style={{ position: 'absolute', left: 0, top: 0, height: 8,
                              width: Math.min(b.realPct, 100) + '%',
                              background: ROSA, borderRadius: 4 }} />
              </div>
            </div>
            <span style={{ color: 'var(--text3)', fontSize: 11 }}>{recolhido ? '▼' : '▲'}</span>
          </div>

          {!recolhido && b.itens.map(i => {
          const k = chave(i.i, i.p)
          const on = aberto === k
          const atras = i._acum < i._plan - 5
          return (
            <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 10,
                                  marginBottom: 6, marginLeft: 14, overflow: 'hidden',
                                  background: on ? 'var(--bg3)' : 'transparent' }}>
              <div onClick={() => abrir(k, i)}
                   style={{ display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 16px', cursor: 'pointer' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11,
                               color: 'var(--text3)', width: 58 }}>{i.i}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>{i.d}</div>
                  <div className="kpi-sub">
                    {i.p} · S{i.a}–S{i.b} · {i.q.toLocaleString('pt-BR',
                      { maximumFractionDigits: 1 })} {i.u} · {fmtMoedaK(i.c)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 62 }}>
                  <div style={{ font: '600 13px var(--mono)', color: AZUL }}>
                    {fmtPct(i._plan, 0)}
                  </div>
                  <div className="kpi-sub">planejado</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 62 }}>
                  <div style={{ font: '600 13px var(--mono)',
                                color: i._acum > 0 ? ROSA : 'var(--text3)' }}>
                    {fmtPct(i._acum, 0)}
                  </div>
                  <div className="kpi-sub">executado</div>
                </div>
                <div style={{ width: 90, position: 'relative' }}>
                  <div className="prog-track" style={{ height: 9 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: 9,
                                  width: Math.min(i._plan, 100) + '%',
                                  background: AZUL, opacity: .3, borderRadius: 5 }} />
                    <div style={{ position: 'absolute', left: 0, top: 0, height: 9,
                                  width: Math.min(i._acum, 100) + '%',
                                  background: atras ? 'var(--amber)' : ROSA, borderRadius: 5 }} />
                  </div>
                </div>
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>{on ? '▲' : '▼'}</span>
              </div>

              {on && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px' }}>
                  <div className="form-section-title" style={{ marginBottom: 12 }}>
                    Memória de cálculo — {i._lanc.length} lançamento{i._lanc.length === 1 ? '' : 's'}
                  </div>

                  {i._lanc.length > 0 && (
                    <table style={{ marginBottom: 16 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 96 }}>Data</th>
                          <th style={{ width: 50 }}>Sem</th>
                          <th style={{ width: 78 }}>Avanço</th>
                          <th style={{ width: 78 }}>Horas</th>
                          <th style={{ width: 96 }}>Qtd. feita</th>
                          <th>Observação</th>
                          <th style={{ width: 34 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {i._lanc.map(l => (
                          <tr key={l.id}>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                              {fmtDate(l.data_lancamento)}
                            </td>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: 11,
                                         color: 'var(--text3)' }}>S{l.semana_numero}</td>
                            <td style={{ fontFamily: 'var(--mono)', color: ROSA }}>
                              +{parseFloat(l.incremento_pct).toFixed(1)}%
                            </td>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                              {l.hh_semana ? l.hh_semana + ' h'
                                : <span style={{ color: 'var(--text3)' }}>—</span>}
                            </td>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                              {l.qtd_semana
                                ? `${parseFloat(l.qtd_semana).toLocaleString('pt-BR')} ${i.u}`
                                : <span style={{ color: 'var(--text3)' }}>—</span>}
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--text2)' }}>
                              {l.observacao || (l.medido_por ? `por ${l.medido_por}` : '—')}
                            </td>
                            <td>
                              <button className="btn-danger" onClick={() => excluir(l.id)}
                                      title="Excluir lançamento">×</button>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={2} style={{ fontWeight: 600 }}>Acumulado</td>
                          <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: ROSA }}>
                            {fmtPct(i._acum, 1)}
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                            {i._hh > 0 ? i._hh.toFixed(0) + ' h' : '—'}
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                            {i._qtd > 0
                              ? `${i._qtd.toLocaleString('pt-BR')} de ${i.q.toLocaleString('pt-BR',
                                  { maximumFractionDigits: 1 })} ${i.u}`
                              : '—'}
                          </td>
                          <td colSpan={2} style={{ fontSize: 11, color: 'var(--text2)' }}>
                            {i._hh > 0 && i._qtd > 0 && (() => {
                              const real = i._hh / i._qtd
                              const dv = i.k ? 100 * (real - i.k) / i.k : null
                              return <>produtividade {real.toFixed(2)} h/{i.u}
                                {dv != null && ` (previsto ${i.k.toFixed(2)}, ${dv > 0 ? '+' : ''}${dv.toFixed(0)}%)`}</>
                            })()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  <div className="form-grid-3">
                    <div className="field">
                      <label>Data do avanço</label>
                      <input type="date" value={form.data || ''}
                             min={inicioSemana(1).toISOString().slice(0, 10)}
                             max={fimSemana(OBRA.prazo_semanas).toISOString().slice(0, 10)}
                             onChange={e => setForm({ ...form, data: e.target.value })} />
                      <div className="kpi-sub" style={{ marginTop: 4 }}>
                        {dataParaSemana(form.data)
                          ? `entra na S${dataParaSemana(form.data)}`
                          : 'fora do prazo da obra'}
                      </div>
                    </div>
                    <div className="field">
                      <label>Quanto avançou (%)</label>
                      <input type="number" step="0.1" min="-100" max="100"
                             value={form.incremento || ''}
                             placeholder="ex.: 15"
                             onChange={e => setForm({ ...form, incremento: e.target.value })} />
                      <div className="kpi-sub" style={{ marginTop: 4 }}>
                        {form.incremento
                          ? `acumulado ficaria em ${Math.min(i._acum + parseFloat(form.incremento || 0), 100).toFixed(1)}%`
                          : `hoje em ${i._acum.toFixed(1)}%`}
                      </div>
                    </div>
                    <div className="field">
                      <label>Observação</label>
                      <input type="text" value={form.observacao || ''}
                             placeholder="opcional"
                             onChange={e => setForm({ ...form, observacao: e.target.value })} />
                    </div>
                  </div>

                  <div className="form-grid-2" style={{ marginTop: 12 }}>
                    <div className="field">
                      <label>Horas gastas no período (opcional)</label>
                      <input type="number" step="0.5" min="0" value={form.hh || ''}
                             placeholder="h"
                             onChange={e => setForm({ ...form, hh: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Quantidade feita no período (opcional)</label>
                      <input type="number" step="0.01" min="0" value={form.qtd || ''}
                             placeholder={i.u}
                             onChange={e => setForm({ ...form, qtd: e.target.value })} />
                      <div className="kpi-sub" style={{ marginTop: 4 }}>
                        previsto até a S{semana}: {(i.q * i._plan / 100).toLocaleString('pt-BR',
                          { maximumFractionDigits: 1 })} de {i.q.toLocaleString('pt-BR',
                          { maximumFractionDigits: 1 })} {i.u}
                      </div>
                    </div>
                  </div>

                  <div className="btn-row" style={{ marginTop: 16 }}>
                    <button className="btn-primary" onClick={() => salvar(i)}>
                      Adicionar lançamento
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        </div>
          )
        })}

        <div className="notas-box" style={{ marginTop: 16 }}>
          Cada linha da memória de cálculo é <b>quanto o serviço avançou naquela data</b>,
          não o total. Se a alvenaria estava em 40% e você fez mais um quarto dela, lance
          <b> 25</b> — o acumulado vira 65%. Dá para registrar vários avanços na mesma
          semana e a soma é feita pelo sistema.
          <br /><br />
          A barra mostra o planejado em azul claro atrás e o executado na frente; ela fica
          âmbar quando o serviço cai mais de 5 pontos abaixo do previsto. Horas e
          quantidade são opcionais e servem para calcular a produtividade real.
        </div>
      </div>
    </>
  )
}
