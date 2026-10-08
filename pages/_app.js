import '../styles/globals.css'
import { useEffect, useState } from 'react'
import { usarCalendario } from '../lib/calendario'

// Antes de mostrar as telas, carrega o calendário de semanas (/api/calendario): as telas calculam a semana de
// hoje, os seletores e os rótulos "S11 · 05/10 a 11/10" com ele. Se a rota falhar, fica o cálculo antigo
// (lib/calendario.js) e o site funciona como antes.
export default function App({ Component, pageProps }) {
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    let vivo = true
    fetch('/api/calendario')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => { if (c && c.semanas) usarCalendario(c) })
      .catch(() => {})
      .finally(() => { if (vivo) setPronto(true) })
    return () => { vivo = false }
  }, [])
  if (!pronto) return <div className="loading" style={{ padding: 40 }}>Carregando…</div>
  return <Component {...pageProps} />
}
