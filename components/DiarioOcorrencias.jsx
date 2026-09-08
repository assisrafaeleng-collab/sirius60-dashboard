import { useEffect, useMemo, useState } from 'react'
import { OBRA, fmtDate, dataParaSemana, inicioSemana, fimSemana } from '../lib/constants'

const CATEGORIAS = ['Chuva', 'Falta de material', 'Falta de mão de obra',
  'Quebra de equipamento', 'Retrabalho', 'Embargo ou fiscalização',
  'Projeto ou definição pendente', 'Acidente ou segurança', 'Outro']

const IMPACTOS = [
  { v: 'baixo', l: 'Baixo', cls: 'badge-gray' },
  { v: 'medio', l: 'Médio', cls: 'badge-warn' },
  { v: 'alto',  l: 'Alto',  cls: 'badge-bad' },
]

const VAZIO = {
  data_ocorrencia: '', categoria: '', impacto: 'baixo', codigo_eap: '',
  grupo: '', dias_atraso_estimado: '', descricao: '',
}

export default function DiarioOcorrencias({ sessao, itens }) {
  const [aberto, setAberto] = useState(true)
  const [lista, setLista] = useState(null)
  const [form, setForm] = useState(null)      // null = formulário fechado
  const [toast, setToast] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [fCat, setFCat] = useState('')

  function carregar() {
    fetch('/api/ocorrencias').then(r => r.json())
      .then(j => j.error ? setToast({ tipo: 'err', txt: j.message || j.error })
                         : setLista(j.ocorrencias))
      .catch(e => setToast({ tipo: 'err', txt: e.message }))
  }
  useEffect(carregar, [])

  const catalogo = useMemo(() => {
    const m = {}
    ;(itens || []).forEach(i => { if (!m[i.i]) m[i.i] = { desc: i.d, grupo: i.n } })
    return m
  }, [itens])

  const visiveis = useMemo(() => {
    if (!lista) return []
    return fCat ? lista.filter(o => o.categoria === fCat) : lista
  }, [lista, fCat])

  const diasSomados = (lista || []).reduce((s, o) => s + (o.dias_atraso_estimado || 0), 0)

  function novo() {
    setForm({ ...VAZIO, data_ocorrencia: new Date().toISOString().slice(0, 10) })
  }
  function editar(o) {
    setForm({
      id: o.id, data_ocorrencia: o.data_ocorrencia, categoria: o.categoria,
      impacto: o.impacto, codigo_eap: o.codigo_eap || '', grupo: o.grupo || '',
      dias_atraso_estimado: o.dias_atraso_estimado ?? '', descricao: o.descricao || '',
    })
  }

  function escolheEap(cod) {
    const it = catalogo[cod]
    setForm({ ...form, codigo_eap: cod, grupo: it ? it.grupo : form.grupo })
  }

  async function salvar() {
    if (!sessao?.senha) {
      setToast({ tipo: 'err', txt: 'Abra a aba Medição ou Lançamentos para liberar a senha.' })
      return
    }
    setSalvando(true); setToast(null)
    try {
      const r = await fetch('/api/ocorrencias', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, senha: sessao.senha, registrado_por: sessao.quem }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao gravar')
      setToast({ tipo: 'ok', txt: form.id ? 'Ocorrência atualizada.' : 'Ocorrência registrada.' })
      setForm(null); carregar()
    } catch (e) {
      setToast({ tipo: 'err', txt: e.message === 'Failed to fetch'
        ? 'Sem resposta do servidor. Verifique se o npm run dev está rodando.' : e.message })
    } finally { setSalvando(false) }
  }

  async function excluir(id) {
    if (!sessao?.senha) {
      setToast({ tipo: 'err', txt: 'Abra a aba Medição ou Lançamentos para liberar a senha.' })
      return
    }
    if (!confirm('Excluir esta ocorrência?')) return
    try {
      const r = await fetch(`/api/ocorrencias?id=${id}&senha=${encodeURIComponent(sessao.senha)}`,
        { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao excluir')
      setToast({ tipo: 'ok', txt: 'Ocorrência excluída.' }); carregar()
    } catch (e) { setToast({ tipo: 'err', txt: e.message }) }
  }

  const cats = [...new Set((lista || []).map(o => o.categoria))].sort()

  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between', cursor: 'pointer' }}
           onClick={() => setAberto(!aberto)}>
        <span>Diário de ocorrências</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="kpi-sub">
            {lista ? `${lista.length} registro${lista.length === 1 ? '' : 's'}` : 'carregando…'}
            {diasSomados > 0 && ` · ${diasSomados} dias de atraso apontados`}
          </span>
          <span style={{ color: 'var(--text3)', fontSize: 11 }}>{aberto ? '▲' : '▼'}</span>
        </span>
      </div>

      {aberto && (
        <>
          <div className="btn-row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => form ? setForm(null) : novo()}>
              {form ? 'Cancelar' : '+ Nova ocorrência'}
            </button>
            {cats.length > 1 && (
              <>
                <button className="btn-sm" onClick={() => setFCat('')}
                  style={!fCat ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}>
                  Todas
                </button>
                {cats.map(c => (
                  <button key={c} className="btn-sm" onClick={() => setFCat(c)}
                    style={fCat === c ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}>
                    {c}
                  </button>
                ))}
              </>
            )}
          </div>

          {toast && (
            <div className={'toast ' + (toast.tipo === 'ok' ? 'toast-ok' : 'toast-err')}>
              {toast.txt}
            </div>
          )}

          {form && (
            <div className="form-section">
              <div className="form-section-title">
                {form.id ? 'Editar ocorrência' : 'Nova ocorrência'}
              </div>
              <div className="form-grid-3">
                <div className="field">
                  <label>Data</label>
                  <input type="date" value={form.data_ocorrencia}
                    onChange={e => setForm({ ...form, data_ocorrencia: e.target.value })} />
                  {dataParaSemana(form.data_ocorrencia) && (
                    <div className="kpi-sub" style={{ marginTop: 4 }}>
                      S{dataParaSemana(form.data_ocorrencia)}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label>Categoria</label>
                  <select className="styled" value={form.categoria}
                    onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    <option value="">Escolha…</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Impacto</label>
                  <select className="styled" value={form.impacto}
                    onChange={e => setForm({ ...form, impacto: e.target.value })}>
                    {IMPACTOS.map(i => <option key={i.v} value={i.v}>{i.l}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-grid-3" style={{ marginTop: 12 }}>
                <div className="field">
                  <label>Código EAP (opcional)</label>
                  <input type="text" list="eap-ocor" value={form.codigo_eap}
                    placeholder="3.1.4"
                    onChange={e => escolheEap(e.target.value)} />
                  <datalist id="eap-ocor">
                    {Object.entries(catalogo).map(([c, i]) => (
                      <option key={c} value={c}>{i.desc}</option>
                    ))}
                  </datalist>
                  {catalogo[form.codigo_eap] && (
                    <div className="kpi-sub" style={{ marginTop: 4 }}>
                      {catalogo[form.codigo_eap].desc}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label>Frente ou pavimento</label>
                  <input type="text" value={form.grupo}
                    placeholder="ex.: 1º Pavimento"
                    onChange={e => setForm({ ...form, grupo: e.target.value })} />
                </div>
                <div className="field">
                  <label>Atraso estimado (dias)</label>
                  <input type="number" min="0" step="1" value={form.dias_atraso_estimado}
                    onChange={e => setForm({ ...form, dias_atraso_estimado: e.target.value })} />
                </div>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label>O que aconteceu</label>
                <textarea rows={4} value={form.descricao}
                  placeholder="Descreva o fato, a causa e o que foi feito."
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }} />
              </div>

              <div className="btn-row" style={{ marginTop: 16 }}>
                <button className="btn-primary" onClick={salvar} disabled={salvando}>
                  {salvando ? 'Gravando…' : form.id ? 'Salvar alterações' : 'Registrar'}
                </button>
                <button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {!lista ? <div className="loading">Carregando ocorrências…</div>
            : !visiveis.length ? (
              <div className="empty-state">
                <h3>{lista.length ? 'Nenhuma nesta categoria' : 'Nenhuma ocorrência registrada'}</h3>
                <p>{lista.length ? 'Escolha outra categoria acima.'
                  : 'Registre chuva, falta de material, embargo — é o que vai explicar, meses depois, por que uma semana rendeu menos.'}</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 92 }}>Data</th>
                    <th style={{ width: 44 }}>Sem</th>
                    <th style={{ width: 148 }}>Categoria</th>
                    <th style={{ width: 68 }}>Impacto</th>
                    <th style={{ width: 150 }}>EAP / frente</th>
                    <th style={{ width: 78 }}>Atraso est.</th>
                    <th>Descrição</th>
                    <th style={{ width: 118 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(o => {
                    const imp = IMPACTOS.find(i => i.v === o.impacto) || IMPACTOS[0]
                    return (
                      <tr key={o.id}>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                          {fmtDate(o.data_ocorrencia)}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11,
                                     color: 'var(--text3)' }}>
                          {o.semana_numero ? 'S' + o.semana_numero : '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>{o.categoria}</td>
                        <td><span className={'badge ' + imp.cls}>{imp.l}</span></td>
                        <td style={{ fontSize: 11, color: 'var(--text2)' }}>
                          {o.codigo_eap ? <span style={{ fontFamily: 'var(--mono)' }}>{o.codigo_eap}</span> : '—'}
                          {o.grupo ? <> · {o.grupo}</> : ''}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11,
                                     color: o.dias_atraso_estimado > 0 ? 'var(--red-tx)' : 'var(--text3)' }}>
                          {o.dias_atraso_estimado > 0 ? `${o.dias_atraso_estimado} dia(s)` : '—'}
                        </td>
                        <td style={{ fontSize: 12, lineHeight: 1.6 }}>
                          {o.descricao}
                          {o.registrado_por && (
                            <div className="kpi-sub" style={{ marginTop: 3 }}>
                              por {o.registrado_por}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="btn-row">
                            <button className="btn-sm" onClick={() => editar(o)}>Editar</button>
                            <button className="btn-danger" onClick={() => excluir(o.id)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

          <div className="notas-box" style={{ marginTop: 16 }}>
            O <b>atraso estimado</b> é o seu julgamento de quantos dias aquele fato custou.
            Ele não entra automaticamente em nenhum índice — serve para, ao olhar um SPI
            ruim daqui a três meses, você saber se foi chuva, falta de material ou ritmo
            de equipe. {!sessao && <b>Para registrar, abra a aba Medição semanal e informe a senha.</b>}
          </div>
        </>
      )}
    </div>
  )
}
