// fetch para as chamadas protegidas (gravações e leituras das abas Medição e
// Lançamentos), usado nas telas. A senha é informada no Desbloqueio e fica só
// enquanto a aba estiver aberta (sessionStorage). Vai sempre no cabeçalho
// x-dashboard-senha, nunca na URL nem no corpo. Se o servidor recusar (401),
// esquece a senha, avisa e pede de novo uma vez.
const CHAVE = 'sirius60_senha'

function lerSenha() {
  try { return sessionStorage.getItem(CHAVE) } catch { return null }
}
function guardarSenha(s) {
  try { s ? sessionStorage.setItem(CHAVE, s) : sessionStorage.removeItem(CHAVE) } catch {}
}
function pedirSenha(msg) {
  const s = window.prompt(msg || 'Senha da obra:')
  return s ? s.trim() : null
}

// Se o usuário cancelar, devolve uma resposta 401 sem chamar o servidor.
function cancelado() {
  return new Response(JSON.stringify({ error: 'Cancelado: senha não informada.' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'x-cancelado': '1' },
  })
}

async function chamar(url, opts, senha) {
  const headers = new Headers(opts.headers || {})
  headers.set('x-dashboard-senha', senha)
  return fetch(url, { ...opts, headers })
}

export async function fetchComSenha(url, opts = {}) {
  let senha = lerSenha() || pedirSenha()
  if (!senha) return cancelado()

  let res = await chamar(url, opts, senha)
  if (res.status !== 401) {
    guardarSenha(senha)
    return res
  }

  guardarSenha(null)
  senha = pedirSenha('Senha incorreta. Digite a senha da obra:')
  if (!senha) return cancelado()
  res = await chamar(url, opts, senha)
  if (res.status !== 401) guardarSenha(senha)
  return res
}

// Igual ao fetchComSenha, mas SEM janela do navegador (prompt): sem senha guardada ou com senha recusada, devolve
// 401 e a tela mostra o Desbloqueio dentro da página (pedido 13D: nada de alert/confirm/prompt).
export async function fetchComSenhaSemJanela(url, opts = {}) {
  const senha = lerSenha()
  if (!senha) return cancelado()
  const res = await chamar(url, opts, senha)
  if (res.status === 401) guardarSenha(null)
  return res
}

// Usado pelo Desbloqueio: confere a senha digitada em /api/auth (que não
// acessa o banco) e, se estiver certa, guarda para as próximas chamadas.
export async function conferirSenha(senha) {
  const res = await chamar('/api/auth', { method: 'POST' }, senha)
  if (res.ok) guardarSenha(senha)
  return res
}

export function temSenha() {
  return Boolean(lerSenha())
}

export function esquecerSenha() {
  guardarSenha(null)
}
