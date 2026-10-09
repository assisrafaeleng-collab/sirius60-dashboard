// Lista de lançamentos de UMA linha (nível 3): pagos e títulos a pagar, em ordem de data, com subtotal pago |
// a pagar | total. Usada no quadro "custo direto por grupo" (CustoPorGrupo, /api/painel?detalhe=1) e nos custos
// indiretos (/api/indiretos?detalhe=1) — pedido 13E. Só leitura; sem CPF/CNPJ.
// Verba de forma (pedido 14A): nota com a fatia da linha e a linha onde cada lançamento está gravado.
// Pago antes de 03/08/2026 (início da obra): no banco a data é 03/08/2026 e a data real fica no histórico
// ("[pago em 10/06/2026]"); a lista mostra a data real e a nota "competência 2026-08" (mês de crédito).
import { fmtMoeda2 as fmtMoeda } from '../lib/constants'
import { AMBAR, CINZA } from './ValorCusto'

const INICIO_OBRA = '2026-08-03'
const S2 = (n) => `S${String(n).padStart(2, '0')}`
const PAGO_EM = /\s*\[pago em (\d{2})\/(\d{2})\/(\d{4})\]/i
// data real do pagamento (histórico) e descrição sem a marca
function dataReal(l) {
  const m = l.tipo === 'pago' && String(l.descricao || '').match(PAGO_EM)
  return m ? { ...l, data: `${m[3]}-${m[2]}-${m[1]}`, descricao: l.descricao.replace(PAGO_EM, '').trim() } : l
}
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : '')

// rotuloPago: etiqueta "PAGO" cinza nos pagos (custo direto); nos indiretos os pagos ficam sem etiqueta
export default function ListaLancamentos({ lancamentos, rotuloPago = true }) {
  const lanc = (lancamentos || []).map(dataReal).sort((a, b) => String(a.data).localeCompare(String(b.data)))
  const subPago = lanc.filter((l) => l.tipo === 'pago').reduce((t, l) => t + l.valor, 0)
  const subAPagar = lanc.filter((l) => l.tipo === 'a_pagar').reduce((t, l) => t + l.valor, 0)
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', margin: '0 0 8px' }}>
      {lanc.length > 0 && lanc[0].verba_forma_pct != null && (
        <div style={{ fontSize: 11, color: CINZA, padding: '0 0 6px', borderBottom: '1px solid var(--border)' }}
             title="Material de forma é uma verba única da estrutura (reaproveitamento da madeira): os lançamentos das 13 linhas formam o gasto da verba, e cada linha fica com a parte do seu orçado">
          verba de forma rateada: {String(lanc[0].verba_forma_pct).replace('.', ',')}% do gasto total da verba
          (valores abaixo já multiplicados por essa fatia; cada lançamento continua gravado na linha original)
        </div>
      )}
      {lanc.map((l, n) => {
        const credito = l.tipo === 'pago' && l.data && l.data < INICIO_OBRA
        return (
          <div key={n} style={{ display: 'grid', gridTemplateColumns: '80px 60px 70px minmax(0,1fr) minmax(0,1fr) 130px', gap: 10,
                                padding: '5px 0', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--mono)', color: CINZA }}>{dmy(l.data)}</span>
            <span style={{ fontFamily: 'var(--mono)', color: CINZA }}>{l.semana ? S2(l.semana) : l.tipo === 'a_pagar' ? 'venc.' : '—'}</span>
            <span>
              {l.tipo === 'a_pagar'
                ? <span style={{ font: "600 10px 'IBM Plex Mono', monospace", color: '#1a1a1a', background: AMBAR,
                                 borderRadius: 4, padding: '1px 5px', letterSpacing: '.06em' }}>A PAGAR</span>
                : rotuloPago && <span style={{ font: "500 10px 'IBM Plex Mono', monospace", color: CINZA, letterSpacing: '.06em' }}>PAGO</span>}
            </span>
            <span>{l.fornecedor}</span>
            <span style={{ color: CINZA }}>
              {l.tipo === 'a_pagar'
                ? `vence ${dmy(l.data)} · doc. ${l.documento}${l.parcela ? ` · parcela ${l.parcela}` : ''}${l.descricao ? ` · ${l.descricao}` : ''}`
                : [l.descricao, !rotuloPago && l.documento ? `doc. ${l.documento}` : ''].filter(Boolean).join(' · ')}
              {l.rateado ? ' · rateado pelo orçado' : ''}
              {l.linha_original ? ` · lançado em ${l.linha_original}` : ''}
              {credito && <span style={{ color: CINZA, fontStyle: 'italic' }} title="Pago antes do início da obra (03/08/2026): entra no mês de crédito"> · competência 2026-08</span>}
            </span>
            <span style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: l.tipo === 'a_pagar' ? AMBAR : undefined }}>
              {fmtMoeda(l.valor)}
            </span>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 22, justifyContent: 'flex-end', paddingTop: 8, fontSize: 12, fontFamily: 'var(--mono)' }}>
        <span>pago {fmtMoeda(subPago)}</span>
        <span style={{ color: AMBAR }}>a pagar {fmtMoeda(subAPagar)}</span>
        <span style={{ fontWeight: 600 }}>total {fmtMoeda(subPago + subAPagar)}</span>
      </div>
    </div>
  )
}
