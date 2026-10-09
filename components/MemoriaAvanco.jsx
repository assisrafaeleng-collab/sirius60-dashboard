// Memória de cálculo do avanço de UMA linha de serviço (código + pavimento) e lançamento pela própria tela de
// avanço físico (pedido 13D, igual ao Flats). Lista os lançamentos (data | semana | avanço | total depois | editar |
// excluir) e o formulário (data | avançou % ↔ total fica em %). Grava só na tabela NOVA de medição acumulada
// (avanco_fisico_historico): enquanto ela não existir (modo 'incremento'), tudo fica só leitura com aviso.
// Senha: Desbloqueio dentro da página (sem alert/confirm/prompt). Hooks no topo (erro #310).
import { useState } from 'react'
import { fmtP1, CORES } from '../lib/constants'
import { dataParaSemana, hojeSaoPaulo } from '../lib/constants'
import { datasDaSemana } from '../lib/calendario'
import { fetchComSenhaSemJanela, temSenha } from '../lib/fetch-com-senha'
import Desbloqueio from './Desbloqueio'

const REALIZADO = CORES.realizado
const S2 = (n) => `S${String(n).padStart(2, '0')}`
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '')
const pc = (v) => fmtP1(v)
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null }

export default function MemoriaAvanco({ linha, retratos, modo, onGravou }) {
  const [form, setForm] = useState({ id: null, data: hojeSaoPaulo(), avancou: '', total: '' })
  const [msg, setMsg] = useState(null)
  const [indo, setIndo] = useState(false)
  const [excluir, setExcluir] = useState(null)        // id aguardando confirmação (na página)
  const [pedirSenha, setPedirSenha] = useState(false)
  const [quem, setQuem] = useState('')

  const acumulado = modo === 'acumulado'
  // lançamentos da linha, em ordem; avanço = total − total anterior
  const lista = []
  let ant = 0
  retratos.forEach((r) => {
    lista.push({ ...r, avanco: r.percentual - ant })
    ant = r.percentual
  })
  const hoje = lista.length ? lista[lista.length - 1].percentual : 0
  // base do formulário: em edição, o total anterior ao lançamento editado; senão, o de hoje
  const base = form.id ? (() => {
    const i = lista.findIndex((l) => l.id === form.id)
    return i > 0 ? lista[i - 1].percentual : 0
  })() : hoje
  const semanaForm = dataParaSemana(form.data)
  const hojeSP = hojeSaoPaulo()

  const setAvancou = (v) => {
    const a = num(v)
    setForm({ ...form, avancou: v, total: a == null ? '' : String(+(base + a).toFixed(2)) })
  }
  const setTotal = (v) => {
    const t = num(v)
    setForm({ ...form, total: v, avancou: t == null ? '' : String(+(t - base).toFixed(2)) })
  }

  function validar() {
    const t = num(form.total)
    if (t == null || t < 0 || t > 100) return 'O total acumulado deve ficar entre 0 e 100%.'
    if (!semanaForm || form.data < datasDaSemana(1).data_inicio) return 'Data fora do calendário da obra.'
    if (form.data > hojeSP) return 'Data no futuro.'
    return null
  }

  async function chamar(url, opts) {
    if (!temSenha()) { setPedirSenha(true); return null }
    const r = await fetchComSenhaSemJanela(url, opts)
    if (r.status === 401) { setPedirSenha(true); return null }
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || j.message || 'Falha ao gravar')
    return j
  }

  async function gravar() {
    const erro = validar()
    if (erro) { setMsg({ tipo: 'err', txt: erro }); return }
    setIndo(true); setMsg(null)
    try {
      const corpo = { codigo_eap: linha.codigo_eap, pavimento: linha.pavimento, data: form.data,
                      percentual: num(form.total), medido_por: quem || null }
      const j = await chamar('/api/medicao', {
        method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.id ? { ...corpo, id: form.id } : corpo),
      })
      if (!j) return
      setMsg({ tipo: 'ok', txt: `${form.id ? 'Medição editada' : 'Medição incluída'}: ${pc(num(form.total))} em ${S2(j.semana)}.` })
      setForm({ id: null, data: hojeSP, avancou: '', total: '' })
      onGravou && onGravou()
    } catch (e) { setMsg({ tipo: 'err', txt: e.message }) } finally { setIndo(false) }
  }

  async function confirmarExclusao(id) {
    setIndo(true); setMsg(null)
    try {
      const j = await chamar(`/api/medicao?id=${id}&quem=${encodeURIComponent(quem || '')}`, { method: 'DELETE' })
      if (!j) return
      setExcluir(null)
      setMsg({ tipo: 'ok', txt: 'Medição excluída (fica guardada com quem e quando).' })
      onGravou && onGravou()
    } catch (e) { setMsg({ tipo: 'err', txt: e.message }) } finally { setIndo(false) }
  }

  const bloqueado = !acumulado
  const btn = { padding: '2px 8px', fontSize: 11, ...(bloqueado ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }

  return (
    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 16px', margin: '4px 0 10px' }}>
      <div className="form-section-title" style={{ marginBottom: 8 }}>
        Memória de cálculo — {linha.codigo_eap} · {linha.descricao} · {linha.pavimento}
      </div>
      {bloqueado && (
        <div className="toast" style={{ marginBottom: 10, background: 'var(--bg3)', color: 'var(--text2)' }}>
          Lançamento liberado depois da conversão da medição acumulada. Histórico só para leitura.
        </div>
      )}

      {lista.length === 0 ? (
        <div className="kpi-sub" style={{ marginBottom: 10 }}>Nenhuma medição lançada nesta linha.</div>
      ) : (
        <table style={{ marginBottom: 10 }}>
          <thead>
            <tr>
              <th style={{ width: 96 }}>Data</th><th style={{ width: 60 }}>Semana</th>
              <th style={{ width: 90, textAlign: 'right' }}>Avanço</th><th style={{ width: 110, textAlign: 'right' }}>Total depois</th>
              <th>Observação</th><th style={{ width: 170 }} />
            </tr>
          </thead>
          <tbody>
            {lista.map((l) => (
              <tr key={l.id}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{dmy(l.data_lancamento)}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{S2(dataParaSemana(l.data_lancamento) || l.semana_numero)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: REALIZADO }}>{(l.avanco >= 0 ? '+' : '') + pc(l.avanco)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{pc(l.percentual)}</td>
                <td style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {l.transferido_de ? `transferida de ${l.transferido_de}` : ''}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {excluir === l.id ? (
                    <span style={{ fontSize: 11 }}>
                      Excluir?{' '}
                      <button className="btn-sm" style={btn} disabled={indo} onClick={() => confirmarExclusao(l.id)}>Sim, excluir</button>{' '}
                      <button className="btn-sm" style={btn} onClick={() => setExcluir(null)}>Não</button>
                    </span>
                  ) : (
                    <>
                      <button className="btn-sm" style={btn} disabled={bloqueado || indo}
                              title={bloqueado ? 'Liberado depois da conversão da medição acumulada' : 'Editar'}
                              onClick={() => setForm({ id: l.id, data: l.data_lancamento, avancou: String(+l.avanco.toFixed(2)), total: String(l.percentual) })}>
                        editar
                      </button>{' '}
                      <button className="btn-sm" style={btn} disabled={bloqueado || indo}
                              title={bloqueado ? 'Liberado depois da conversão da medição acumulada' : 'Excluir'}
                              onClick={() => setExcluir(l.id)}>
                        excluir
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pedirSenha ? (
        <Desbloqueio onLiberar={(q) => { setQuem(q || ''); setPedirSenha(false); setMsg({ tipo: 'ok', txt: 'Liberado. Clique de novo para gravar.' }) }} />
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field">
            <label>Data</label>
            <input type="date" value={form.data} disabled={bloqueado} max={hojeSP}
                   min={datasDaSemana(1).data_inicio} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            <div className="kpi-sub">{semanaForm ? `entra na ${S2(semanaForm)}` : 'fora do calendário'}</div>
          </div>
          <div className="field">
            <label>Avançou (%)</label>
            <input type="number" step="0.1" value={form.avancou} disabled={bloqueado} placeholder="ex.: 10"
                   onChange={(e) => setAvancou(e.target.value)} style={{ width: 110 }} />
            <div className="kpi-sub">Hoje em {pc(hoje)}</div>
          </div>
          <div className="field">
            <label>Total fica em (%)</label>
            <input type="number" step="0.1" min="0" max="100" value={form.total} disabled={bloqueado}
                   onChange={(e) => setTotal(e.target.value)} style={{ width: 110 }} />
            <div className="kpi-sub">{num(form.total) != null && num(form.total) < base ? 'revisão para baixo' : ' '}</div>
          </div>
          <div className="btn-row" style={{ paddingBottom: 18 }}>
            <button className="btn-primary" disabled={bloqueado || indo} onClick={gravar}>
              {indo ? 'Gravando…' : form.id ? 'Salvar edição' : 'Incluir medição'}
            </button>
            {form.id && <button className="btn-sm" onClick={() => setForm({ id: null, data: hojeSP, avancou: '', total: '' })}>cancelar edição</button>}
          </div>
          <div style={{ paddingBottom: 18, marginLeft: 'auto', font: '600 13px var(--mono)', color: REALIZADO }}>
            Total acumulado: {pc(hoje)}
          </div>
        </div>
      )}
      {msg && <div className={'toast ' + (msg.tipo === 'ok' ? 'toast-ok' : 'toast-err')} style={{ marginTop: 8 }}>{msg.txt}</div>}
    </div>
  )
}
