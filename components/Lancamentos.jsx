import { useEffect, useMemo, useState } from 'react'
import { fmtMoeda, fmtMoedaK, fmtDate, semanaLabel, dataParaSemana } from '../lib/constants'

const STATUS = [
  { v: 'pago', l: 'Pago' },
  { v: 'a_pagar', l: 'A pagar' },
  { v: 'previsto', l: 'Previsto' },
  { v: 'cancelado', l: 'Cancelado' },
]
// Previsto e cancelado não entram no custo realizado.
const CONTA = s => s !== 'previsto' && s !== 'cancelado'

export default function Lancamentos({ semana, sessao }) {
  const [lista, setLista] = useState(null)
  const [itens, setItens] = useState([])
  const [toast, setToast] = useState(null)
  const [abrindo, setAbrindo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // filtros
  const [busca, setBusca] = useState('')
  const [fGrupo, setFGrupo] = useState('')
  const [fPav, setFPav] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [soAteSemana, setSoAteSemana] = useState(false)

  const vazio = {
    data_emissao: '', valor: '', codigo_eap: '', fornecedor: '', historico: '',
    num_documento: '', status: 'pago', pavimento: '', grupo_custo: '',
  }
  const [f, setF] = useState(vazio)

  useEffect(() => { fetch('/dados.json').then(r => r.json()).then(setItens) }, [])

  function carregar() {
    setLista(null)
    fetch(`/api/lancamentos?semana=${semana}`).then(r => r.json()).then(j => {
      if (j.error) { setToast({ tipo: 'err', txt: j.message || j.error }); setLista([]) }
      else setLista(j.lancamentos)
    }).catch(e => { setToast({ tipo: 'err', txt: e.message }); setLista([]) })
  }
  useEffect(carregar, [semana])

  // catálogo de EAP para o autocompletar
  const catalogo = useMemo(() => {
    const m = {}
    itens.forEach(i => {
      if (!m[i.i]) m[i.i] = { desc: i.d, grupo: i.n, pavs: new Set() }
      m[i.i].pavs.add(i.p)
    })
    return m
  }, [itens])

  const grupos = useMemo(() => [...new Set(itens.map(i => i.n))].sort(), [itens])
  const pavimentos = useMemo(() => [...new Set(itens.map(i => i.p))].sort(), [itens])

  // ao escolher a EAP, preenche grupo e pavimento sozinho
  function escolheEap(cod) {
    const it = catalogo[cod]
    const novo = { ...f, codigo_eap: cod }
    if (it) {
      novo.grupo_custo = it.grupo
      const pavs = [...it.pavs]
      if (pavs.length === 1) novo.pavimento = pavs[0]
    }
    setF(novo)
  }

  const filtrados = useMemo(() => {
    if (!lista) return []
    const q = busca.trim().toLowerCase()
    return lista.filter(l => {
      if (soAteSemana && l.fora_do_filtro) return false
      if (fGrupo && l.grupo_custo !== fGrupo) return false
      if (fPav && l.pavimento !== fPav) return false
      if (fStatus && l.status !== fStatus) return false
      if (!q) return true
      return [l.fornecedor, l.historico, l.codigo_eap, l.num_documento]
        .some(c => (c || '').toLowerCase().includes(q))
    })
  }, [lista, busca, fGrupo, fPav, fStatus, soAteSemana])

  const totalFiltrado = filtrados
    .filter(l => CONTA(l.status) && !l.fora_do_filtro)
    .reduce((s, l) => s + parseFloat(l.valor || 0), 0)

  async function salvar() {
    setSalvando(true); setToast(null)
    try {
      const r = await fetch('/api/lancamentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, senha: sessao?.senha, lancado_por: sessao?.quem }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao gravar')
      setToast({ tipo: 'ok', txt: j.semana > semana
        ? `Gravado na S${j.semana} — posterior à S${semana} do filtro, por isso aparece marcado na lista.`
        : `Lançamento gravado na S${j.semana}.` })
      setF({ ...vazio })
      carregar()
    } catch (e) {
      setToast({ tipo: 'err', txt: e.message })
    } finally { setSalvando(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir este lançamento?')) return
    try {
      const r = await fetch(`/api/lancamentos?id=${id}&senha=${encodeURIComponent(sessao?.senha || '')}`,
        { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao excluir')
      setToast({ tipo: 'ok', txt: 'Lançamento excluído.' })
      carregar()
    } catch (e) { setToast({ tipo: 'err', txt: e.message }) }
  }

  return (
    <>
      <div className="hero" style={{ marginBottom: 14 }}>
        <div className="hero-block">
          <div className="hero-label">Custos lançados até a {semanaLabel(semana).split(' ·')[0]}</div>
          <div className="hero-row">
            <div>
              <div className="hero-cap">Notas</div>
              <div className="hero-num">{lista ? filtrados.length : '—'}</div>
            </div>
            <div className="hero-total">
              <div className="hero-cap">Valor</div>
              <div className="hero-num">{fmtMoeda(totalFiltrado)}</div>
            </div>
          </div>
        </div>
        <div className="hero-div" />
        <div className="hero-side">
          <button className="btn-primary" onClick={() => setAbrindo(!abrindo)}>
            {abrindo ? 'Fechar formulário' : 'Lançar nota'}
          </button>
        </div>
      </div>

      {toast && <div className={'toast ' + (toast.tipo === 'ok' ? 'toast-ok' : 'toast-err')}>{toast.txt}</div>}

      {lista && lista.some(l => l.fora_do_filtro) && (
        <div className="alert-strip ok" style={{ marginBottom: 12 }}>
          <div className="alert-main">
            <div className="alert-text">
              {lista.filter(l => l.fora_do_filtro).length} nota(s) com data posterior
              à S{semana}. Elas aparecem na lista marcadas como <b>fora do filtro</b> e
              não entram no total nem nos indicadores desta semana.
            </div>
          </div>
          <div className="alert-pills">
            <button className="btn-sm" onClick={() => setSoAteSemana(!soAteSemana)}>
              {soAteSemana ? 'Mostrar todas' : `Ocultar as posteriores`}
            </button>
          </div>
        </div>
      )}

      {abrindo && (
        <div className="form-section">
          <div className="form-section-title">Nova nota</div>
          <div className="form-grid-3">
            <div className="field">
              <label>Data da nota</label>
              <input type="date" value={f.data_emissao}
                     onChange={e => setF({ ...f, data_emissao: e.target.value })} />
              {f.data_emissao && dataParaSemana(f.data_emissao) && (
                <div className="kpi-sub" style={{ marginTop: 4 }}>
                  cai na S{dataParaSemana(f.data_emissao)}
                </div>
              )}
            </div>
            <div className="field">
              <label>Valor (R$)</label>
              <input type="number" step="0.01" min="0" value={f.valor}
                     onChange={e => setF({ ...f, valor: e.target.value })} placeholder="0,00" />
            </div>
            <div className="field">
              <label>Situação</label>
              <select className="styled" value={f.status}
                      onChange={e => setF({ ...f, status: e.target.value })}>
                {STATUS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid-3" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Código EAP</label>
              <input type="text" list="lista-eap" value={f.codigo_eap}
                     onChange={e => escolheEap(e.target.value)} placeholder="2.1.1" />
              <datalist id="lista-eap">
                {Object.entries(catalogo).map(([cod, i]) => (
                  <option key={cod} value={cod}>{i.desc}</option>
                ))}
              </datalist>
              {catalogo[f.codigo_eap] && (
                <div className="kpi-sub" style={{ marginTop: 4 }}>{catalogo[f.codigo_eap].desc}</div>
              )}
            </div>
            <div className="field">
              <label>Pavimento</label>
              <select className="styled" value={f.pavimento}
                      onChange={e => setF({ ...f, pavimento: e.target.value })}>
                <option value="">—</option>
                {pavimentos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Nº do documento</label>
              <input type="text" value={f.num_documento}
                     onChange={e => setF({ ...f, num_documento: e.target.value })} placeholder="NF 1234" />
            </div>
          </div>

          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Fornecedor</label>
              <input type="text" value={f.fornecedor}
                     onChange={e => setF({ ...f, fornecedor: e.target.value })} />
            </div>
            <div className="field">
              <label>Histórico</label>
              <input type="text" value={f.historico}
                     onChange={e => setF({ ...f, historico: e.target.value })}
                     placeholder="do que se trata" />
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 18 }}>
            <button className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? 'Gravando…' : 'Gravar lançamento'}
            </button>
            <span className="kpi-sub">
              Nota com mesmo número e fornecedor é recusada, para não duplicar.
            </span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Filtros</div>
        <div className="form-grid-3">
          <div className="field">
            <label>Buscar</label>
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                   placeholder="fornecedor, histórico, EAP, nota" />
          </div>
          <div className="field">
            <label>Grupo</label>
            <select className="styled" value={fGrupo} onChange={e => setFGrupo(e.target.value)}>
              <option value="">Todos</option>
              {grupos.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Pavimento</label>
            <select className="styled" value={fPav} onChange={e => setFPav(e.target.value)}>
              <option value="">Todos</option>
              {pavimentos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid-3" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Situação</label>
            <select className="styled" value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="">Todas</option>
              {STATUS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Lançamentos</div>
        {!lista ? <div className="loading">Carregando…</div>
          : !filtrados.length ? (
            <div className="empty-state">
              <h3>{lista.length ? 'Nenhum lançamento com esses filtros' : 'Nenhuma nota lançada'}</h3>
              <p>{lista.length ? 'Ajuste os filtros acima.' : 'Use o botão "Lançar nota" para começar.'}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 84 }}>Data</th>
                  <th style={{ width: 44 }}>Sem</th>
                  <th style={{ width: 66 }}>EAP</th>
                  <th>Fornecedor / histórico</th>
                  <th style={{ width: 96 }}>Pavimento</th>
                  <th style={{ width: 100 }}>Valor</th>
                  <th style={{ width: 76 }}>Situação</th>
                  <th style={{ width: 34 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(l => (
                  <tr key={l.id} style={CONTA(l.status) ? null : { opacity: .5 }}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{fmtDate(l.data_emissao)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11,
                                 color: l.fora_do_filtro ? 'var(--amber-tx)' : 'var(--text3)' }}
                        title={l.fora_do_filtro ? `Posterior à S${semana} do filtro` : ''}>
                      S{l.semana}{l.fora_do_filtro && ' ▸'}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{l.codigo_eap || '—'}</td>
                    <td>
                      <div>{l.fornecedor || '—'}</div>
                      {l.historico && (
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{l.historico}</div>
                      )}
                    </td>
                    <td>{l.pavimento
                      ? <span className="badge badge-gray">{l.pavimento}</span> : '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{fmtMoedaK(l.valor)}</td>
                    <td>
                      <span className={'badge ' + (l.status === 'pago' ? 'badge-ok'
                        : l.status === 'a_pagar' ? 'badge-warn'
                        : l.status === 'cancelado' ? 'badge-bad' : 'badge-gray')}>
                        {STATUS.find(s => s.v === l.status)?.l || l.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-danger" onClick={() => excluir(l.id)} title="Excluir">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </>
  )
}
