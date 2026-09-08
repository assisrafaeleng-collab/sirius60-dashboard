// Valida a senha da obra uma única vez por sessão.
// A senha vive só no servidor; o navegador guarda apenas um sinal de liberado.
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.SENHA_MEDICAO) {
    return res.status(500).json({ error: 'SENHA_MEDICAO não configurada no .env.local' })
  }
  const { senha } = req.body || {}
  if (senha !== process.env.SENHA_MEDICAO) {
    return res.status(401).json({ error: 'Senha incorreta' })
  }
  return res.status(200).json({ ok: true })
}
