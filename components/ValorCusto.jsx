// Peças da tabela de valor agregado e do quadro "custo direto por grupo" (pedido 13C), copiadas do Flats
// (pages/valor-agregado.js e pages/semanal.js de lá): estouro / economia, % do orçado, "neutro · XX% da verba" e
// a barrinha divergente. Componentes sem hooks.
import { fmtMoeda2 as fmtMoeda, fmtP1 as fmtP, CORES_VA } from '../lib/constants'

export const { agregado: PLAN, economia: VERDE, estouro: VERMELHO, aPagar: AMBAR } = CORES_VA
export const CINZA = '#8b919c'
export const MONO = "500 11px 'IBM Plex Mono', monospace"
export const dir = { textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }

// Estouro / economia = custo (pago + a pagar) − valor agregado. Positivo = estouro (vermelho), negativo = economia
// (verde); o % é sobre o valor agregado. Sem valor agregado e sem custo: null ("—").
export function estouroDe(agregado, custo) {
  const ag = agregado || 0
  const c = custo || 0
  if (ag <= 0.005 && c <= 0.005) return null
  const rs = c - ag
  return { rs, perc: ag > 0.005 ? (rs / ag) * 100 : null, ef: ag > 0.005 && c > 0.005 ? ag / c : null }
}
export const corEstouro = (e) => (e == null || Math.abs(e.rs) < 0.005 ? CINZA : e.rs > 0 ? VERMELHO : VERDE)
export const fmtEstouroRs = (rs) => (rs > 0.005 ? '+' : '') + fmtMoeda(Math.abs(rs) < 0.005 ? 0 : rs)
export const fmtEstouroPerc = (p) => (p == null ? '—' : `${p > 0.05 ? '+' : ''}${p.toFixed(1).replace('.', ',')}%`)
export const tituloEstouro = (e, agregado, pago, aPagar) =>
  e == null ? 'Sem valor agregado e sem custo'
    : `(Pago + a pagar) − valor agregado\n= (${fmtMoeda(pago || 0)} + ${fmtMoeda(aPagar || 0)}) − ${fmtMoeda(agregado || 0)}` +
      `\nEficiência (valor agregado ÷ custo): ${e.ef == null ? '—' : e.ef.toFixed(3).replace('.', ',')}`

// % do orçado = (pago + a pagar) ÷ orçado. Sem custo: "—"; vermelho acima de 100%.
export const percDoOrcado = (pago, aPagar, orcado) => {
  const c = (pago || 0) + (aPagar || 0)
  if (c <= 0.005) return null
  return orcado > 0.005 ? (c / orcado) * 100 : Infinity
}
export const fmtPercOrcado = (v) => (v == null ? '—' : v === Infinity ? 'sem verba' : fmtP(v))
export const tituloPercOrcado = (pago, aPagar, orcado) =>
  `(Pago + a pagar) ÷ orçado\n= (${fmtMoeda(pago || 0)} + ${fmtMoeda(aPagar || 0)}) ÷ ${fmtMoeda(orcado || 0)}`

export function PercOrcado({ orcado, pago, aPagar, peso, fs }) {
  const v = percDoOrcado(pago, aPagar, orcado)
  return (
    <div style={{ ...dir, fontWeight: peso, fontSize: fs, color: v == null ? CINZA : v > 100 ? VERMELHO : 'var(--text)' }}
         title={v == null ? 'Sem custo' : tituloPercOrcado(pago, aPagar, orcado)}>
      {fmtPercOrcado(v)}
    </div>
  )
}

// Estouro / economia em duas linhas (R$ em cima, % embaixo). neutro: compra antecipada ou locação dentro da verba
// (agregado = custo) mostra "neutro · XX% da verba"; passando de 100%, o estouro normal.
export function Estouro({ agregado, pago, aPagar, peso, neutro, orcado, fs }) {
  const e = estouroDe(agregado, (pago || 0) + (aPagar || 0))
  if (e == null) return <div style={{ ...dir, fontSize: fs, color: CINZA }}>—</div>
  const pv = percDoOrcado(pago, aPagar, orcado)
  if (neutro && Math.abs(e.rs) < 0.005 && pv != null && pv <= 100)
    return (
      <div style={{ ...dir, fontWeight: peso, fontSize: fs, color: CINZA }}
           title={`Dentro da verba: o valor agregado segue o custo, sem estouro nem economia\n${tituloPercOrcado(pago, aPagar, orcado)}`}>
        neutro
        <div style={{ fontSize: 10, fontWeight: 500 }}>{fmtP(pv)} da verba</div>
      </div>
    )
  return (
    <div style={{ ...dir, fontWeight: peso, fontSize: fs, color: corEstouro(e) }} title={tituloEstouro(e, agregado, pago, aPagar)}>
      {fmtEstouroRs(e.rs)}
      <div style={{ fontSize: 10, fontWeight: 500 }}>{fmtEstouroPerc(e.perc)}</div>
    </div>
  )
}

// Saldo da verba = orçado − pago − a pagar; vermelho quando negativo
export function Saldo({ orcado, pago, aPagar, peso, fs }) {
  const v = (orcado || 0) - (pago || 0) - (aPagar || 0)
  return (
    <div style={{ ...dir, fontWeight: peso, fontSize: fs, color: v < -0.005 ? VERMELHO : 'var(--text)' }}
         title={`Orçado − pago − a pagar\n= ${fmtMoeda(orcado || 0)} − ${fmtMoeda(pago || 0)} − ${fmtMoeda(aPagar || 0)}`}>
      {fmtMoeda(Math.abs(v) < 0.005 ? 0 : v)}
    </div>
  )
}

// Estouro / economia com barra divergente: marca no zero, economia (verde) para a esquerda, estouro (vermelho)
// para a direita; escala de ±50% do valor agregado (estouro sem valor agregado enche a barra).
export function BarraEstouro({ v, fs }) {
  const e = estouroDe(v.agregado, (v.pago || 0) + (v.a_pagar || 0))
  const cor = corEstouro(e)
  const frac = e == null ? 0 : e.perc == null ? 1 : Math.min(Math.abs(e.perc), 50) / 50
  const estouro = e != null && e.rs > 0
  return (
    <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }} title={tituloEstouro(e, v.agregado, v.pago, v.a_pagar)}>
      <div style={{ fontSize: fs, color: cor }}>{e == null ? '—' : fmtEstouroRs(e.rs)}</div>
      {e != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 3 }}>
          <span style={{ fontSize: 10, color: cor }}>{fmtEstouroPerc(e.perc)}</span>
          <span style={{ position: 'relative', width: 70, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
            <span style={{ position: 'absolute', top: 0, bottom: 0, [estouro ? 'left' : 'right']: '50%', width: `${frac * 50}%`, background: cor }} />
            <span style={{ position: 'absolute', left: '50%', top: -1, bottom: -1, width: 1, background: 'var(--text2)' }} />
          </span>
        </div>
      )}
    </div>
  )
}

// Locação (grupo 17): dentro da verba o agregado é o gasto, "neutro · XX% da verba"; acima, o estouro em vermelho.
export function NeutroVerba({ v, fs }) {
  const pv = percDoOrcado(v.pago, v.a_pagar, v.orcado)
  const custo = (v.pago || 0) + (v.a_pagar || 0)
  const titulo = 'Locação: o valor agregado é o gasto até a verba, sem estouro nem economia enquanto estiver dentro dela\n' +
    tituloPercOrcado(v.pago, v.a_pagar, v.orcado)
  if (pv != null && pv > 100)
    return (
      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: VERMELHO }} title={titulo}>
        <div style={{ fontSize: fs }}>{fmtEstouroRs(custo - v.orcado)}</div>
        <div style={{ fontSize: 10 }}>{fmtPercOrcado(pv)} da verba</div>
      </div>
    )
  return (
    <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: CINZA }} title={titulo}>
      <div style={{ fontSize: fs }}>{pv == null ? '—' : 'neutro'}</div>
      {pv != null && <div style={{ fontSize: 10 }}>{fmtP(pv)} da verba</div>}
    </div>
  )
}

// Somas de uma lista de linhas da /api/painel
export function somar(ls) {
  const t = { orcado: 0, agregado: 0, pago: 0, a_pagar: 0, plan_valor: 0, hh: 0, hh_exec: 0 }
  ls.forEach((l) => Object.keys(t).forEach((k) => { t[k] += Number(l[k]) || 0 }))
  t.custo = t.pago + t.a_pagar
  return t
}

// Resumo da VERBA DE FORMA (material) — pedido 14A: as 13 linhas de material de forma são uma verba única
// (reaproveitamento da madeira). v = painel.totais.verba_forma. Gasto acima do valor agregado e abaixo da verba é
// material comprado antes da execução: aparece como estouro até o serviço avançar (com a dica).
export function ResumoVerbaForma({ v }) {
  if (!v || !(v.verba > 0)) return null
  const pv = (x) => fmtP((100 * x) / v.verba)
  const e = estouroDe(v.agregado, v.gasto)
  const antecipado = v.gasto > v.agregado + 0.005 && v.gasto < v.verba
  const cel = { textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }
  const rot = { fontSize: 10, color: CINZA, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.06em' }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', margin: '0 0 14px',
                  display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) repeat(5, minmax(110px, auto))', gap: '4px 18px',
                  alignItems: 'center' }}>
      <div style={{ fontWeight: 600, fontSize: 12 }}>
        VERBA DE FORMA (material)
        <div style={{ fontSize: 11, fontWeight: 400, color: CINZA }}>{v.linhas} linhas · madeira reaproveitada na estrutura</div>
      </div>
      <div style={cel}><div style={rot}>Verba</div>{fmtMoeda(v.verba)}</div>
      <div style={cel} title={`pago ${fmtMoeda(v.pago)} + a pagar ${fmtMoeda(v.a_pagar)}`}>
        <div style={rot}>Gasto (pago + a pagar)</div>{fmtMoeda(v.gasto)}<div style={{ fontSize: 10, color: CINZA }}>{pv(v.gasto)} da verba</div>
      </div>
      <div style={{ ...cel, color: PLAN }}><div style={rot}>Valor agregado</div>{fmtMoeda(v.agregado)}<div style={{ fontSize: 10, color: CINZA }}>{pv(v.agregado)} da verba</div></div>
      <div style={{ ...cel, color: corEstouro(e) }} title={tituloEstouro(e, v.agregado, v.pago, v.a_pagar)}>
        <div style={rot}>Estouro / economia</div>{e == null ? '—' : fmtEstouroRs(e.rs)}
        <div style={{ fontSize: 10 }}>{e == null ? '' : fmtEstouroPerc(e.perc)}</div>
      </div>
      <div style={{ ...cel, color: v.saldo < -0.005 ? VERMELHO : 'var(--text)' }}><div style={rot}>Saldo da verba</div>{fmtMoeda(v.saldo)}</div>
      {antecipado && (
        <div style={{ gridColumn: '1 / -1', fontSize: 11, color: CINZA }}>
          Material comprado antes da execução (reaproveitamento): o gasto passa do valor agregado até o serviço de forma
          avançar; ainda dentro da verba.
        </div>
      )}
    </div>
  )
}
