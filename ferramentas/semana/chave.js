// CHAVE DO TÍTULO (pedido 15, regra anti-duplicidade): fonte + CNPJ (raiz; sem CNPJ, o fornecedor) + documento (com a
// parcela, ex. "2141/02", sem zeros à esquerda nem espaços) + data de baixa. A mesma chave é o mesmo pagamento, venha
// em quantos relatórios vier. Usada pela rotina semanal (atualizar.js) e pelo importar.js (--apenas).
'use strict'

const txt = (v) => (v == null ? '' : String(v).trim())
const semAcento = (s) => txt(s).normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const FONTE = { fonseca: 'fonseca', 'dinâmica': 'dinamica', dinamica: 'dinamica', rateio: 'rateio' }

const fonteNorm = (f) => FONTE[txt(f).toLowerCase()] || txt(f).toLowerCase()
const docNorm = (d) => txt(d).replace(/\s/g, '').replace(/^0+/, '').toUpperCase()
const quem = (cnpj, fornecedor) => txt(cnpj).replace(/\D/g, '') || semAcento(fornecedor).slice(0, 20)

// data de pagamento real de uma linha do banco: o importar.js leva o pago antes de S01 para 03/08/2026 e guarda a
// data real no histórico ("[pago em dd/mm/aaaa]")
function baixaDoBanco(l) {
  const m = txt(l.historico).match(/\[pago em (\d{2})\/(\d{2})\/(\d{4})\]/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : txt(l.data_emissao).slice(0, 10)
}

const chave = ({ fonte, cnpj, fornecedor, documento, baixa }) =>
  [fonteNorm(fonte), quem(cnpj, fornecedor), docNorm(documento), txt(baixa).slice(0, 10)].join('|')

// linha do lancamentos.csv do classificador (coluna competencia = data de baixa)
const chaveCsv = (b) => chave({ fonte: b.fonte, cnpj: b.cnpj, fornecedor: b.fornecedor, documento: b.documento, baixa: b.competencia })
// linha de custos_lancamentos
const chaveBanco = (l) => chave({ fonte: l.fonte, cnpj: l.cnpj, fornecedor: l.fornecedor, documento: l.num_documento, baixa: baixaDoBanco(l) })
// título (sem a data): para "mesma chave nas duas fontes" e para o contas a pagar
const chaveTitulo = (cnpj, fornecedor, documento) => `${quem(cnpj, fornecedor)}|${docNorm(documento)}`

module.exports = { chave, chaveCsv, chaveBanco, chaveTitulo, baixaDoBanco, docNorm, fonteNorm }
