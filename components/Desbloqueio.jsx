import { useState } from 'react'

// Pede a senha uma vez e libera as gravações enquanto a página estiver aberta.
export default function Desbloqueio({ onLiberar }) {
  const [senha, setSenha] = useState('')
  const [quem, setQuem] = useState('')
  const [erro, setErro] = useState(null)
  const [indo, setIndo] = useState(false)

  async function entrar() {
    if (!senha) { setErro('Informe a senha.'); return }
    setIndo(true); setErro(null)
    try {
      const r = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao validar')
      onLiberar(senha, quem)
    } catch (e) {
      setErro(e.message === 'Failed to fetch'
        ? 'Sem resposta do servidor. Verifique se o npm run dev está rodando.'
        : e.message)
    } finally { setIndo(false) }
  }

  return (
    <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
      <div className="card-title">Liberar lançamentos</div>
      <div className="kpi-sub" style={{ marginBottom: 18, lineHeight: 1.7 }}>
        A senha é pedida uma vez. Depois disso você lança à vontade
        enquanto esta página estiver aberta.
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>Seu nome</label>
        <input type="text" value={quem} onChange={e => setQuem(e.target.value)}
               placeholder="Ex.: Rafael"
               onKeyDown={e => e.key === 'Enter' && entrar()} />
      </div>
      <div className="field">
        <label>Senha da obra</label>
        <input type="password" value={senha} autoFocus
               onChange={e => setSenha(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && entrar()} />
      </div>
      {erro && <div className="toast toast-err" style={{ marginTop: 14 }}>{erro}</div>}
      <div className="btn-row" style={{ marginTop: 18 }}>
        <button className="btn-primary" onClick={entrar} disabled={indo}>
          {indo ? 'Validando…' : 'Liberar'}
        </button>
      </div>
    </div>
  )
}
