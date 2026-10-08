import { senhaOk } from '../../lib/senha-servidor'

// Confere a senha da obra (cabeçalho x-dashboard-senha). Não acessa o banco.
// A senha vive só no servidor; o navegador guarda a digitada enquanto a aba estiver aberta.
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!senhaOk(req, res)) return
  return res.status(200).json({ ok: true })
}
