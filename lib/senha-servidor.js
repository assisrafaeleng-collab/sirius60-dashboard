// Confere a senha da obra nas rotas que gravam ou leem dados protegidos (somente servidor).
// A senha vem no cabeçalho "x-dashboard-senha" e é comparada com SENHA_MEDICAO.
// Sem SENHA_MEDICAO configurada, tudo que exige senha é recusado.
import crypto from 'crypto'

if (typeof window !== 'undefined') {
  throw new Error('lib/senha-servidor.js é só para o servidor (pages/api).')
}

// Devolve true se a senha confere; senão já responde 401/500 e devolve false.
// Uso no início da rota: if (!senhaOk(req, res)) return
export function senhaOk(req, res) {
  const esperada = process.env.SENHA_MEDICAO
  if (!esperada) {
    res.status(500).json({ error: 'SENHA_MEDICAO não configurada no servidor. Acesso bloqueado.' })
    return false
  }
  const recebida = String(req.headers['x-dashboard-senha'] || '')
  // compara os hashes para ter o mesmo tamanho e tempo constante
  const a = crypto.createHash('sha256').update(recebida).digest()
  const b = crypto.createHash('sha256').update(esperada).digest()
  if (!recebida || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Senha incorreta ou não informada.' })
    return false
  }
  return true
}
