import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabaseConfigurado = Boolean(url && key)

// Sem as variáveis, devolve um cliente que falha com mensagem clara em vez
// de lançar exceção na importação — um throw aqui derrubaria a página toda,
// porque este arquivo é carregado por todas elas.
function clienteInvalido() {
  const erro = {
    data: null,
    error: {
      message: 'Supabase não configurado: faltam NEXT_PUBLIC_SUPABASE_URL e '
        + 'NEXT_PUBLIC_SUPABASE_ANON_KEY. No Vercel, cadastre em Settings → '
        + 'Environment Variables e faça um Redeploy (elas entram no build).',
    },
  }
  const encadeavel = () => new Proxy(Promise.resolve(erro), {
    get(alvo, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return alvo[prop].bind(alvo)
      }
      return () => encadeavel()
    },
  })
  return { from: () => encadeavel() }
}

export const supabase = supabaseConfigurado ? createClient(url, key) : clienteInvalido()
