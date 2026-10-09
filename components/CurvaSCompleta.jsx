// Curva S "físico e financeiro" (pedido 13D), copiada do Flats (pages/semanal.js de lá, CurvaS): dois eixos (% à
// esquerda, R$ à direita), períodos "Até a semana atual" | "± 3 meses" | "Obra toda", arrastar para ampliar, duplo
// clique volta, linha da semana selecionada, caixa de valores no mouse, clique vai à semana, legenda clicável e atalhos.
// Físico planejado (curva do cronograma, horas) e valor planejado vêm de semanas_alinhadas (/api/dashboard-integrado);
// valor agregado, custo pago e comprometido da /api/curva-s (mesma conta dos cards). Hooks no topo (erro #310).
import { useEffect, useState } from 'react'
import { fmtMoeda2, fmtP1, CORES_VA } from '../lib/constants'
import { datasDaSemana } from '../lib/calendario'

const { economia: VERDE, estouro: VERMELHO } = CORES_VA
const fmtK = (v) => Math.abs(v) >= 1e6 ? `R$ ${(v / 1e6).toFixed(2).replace('.', ',')}M` : `R$ ${Math.round(v / 1000)}k`
const fmtPcEixo = (v) => `${Number(v.toFixed(1)).toString().replace('.', ',')}%`
const dm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '')
const iso = (s) => String(s || '').slice(0, 10)

// Faixa "redonda" para o eixo: 4 intervalos de 1, 2, 2,5 ou 5 × 10^n que cobrem [min, max] dos valores visíveis.
function faixaDoEixo(min, max, padrao) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return padrao
  if (max - min < 1e-9) {
    const folga = Math.max(Math.abs(max) * 0.05, padrao[1] * 0.01)
    min -= folga
    max += folga
  }
  const bruto = (max - min) / 4
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)))
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => Math.ceil(max / p) - Math.floor(min / p) <= 4) || 10 * pot
  let lo = Math.floor(min / passo) * passo
  if (lo < 0 && min >= 0) lo = 0
  return [lo, lo + 4 * passo]
}
// Data ISO + n meses (dia limitado ao fim do mês)
const somarMeses = (s, n) => {
  const [y, m, d] = iso(s).split('-').map(Number)
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1))
  const fim = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, fim))
  return alvo.toISOString().slice(0, 10)
}

// Cores (Flats; o físico realizado em lavanda e o comprometido pontilhado na cor do custo pago — pedido 13D)
export const SERIES_CURVA = [
  { id: 'fp', nome: 'Físico planejado', cor: '#5B9BD5', campo: 'fp', dash: '5,4', tipo: 'pct' },
  { id: 'fr', nome: 'Físico realizado', cor: '#a99cf0', campo: 'fr', dash: null, tipo: 'pct' },
  { id: 'vp', nome: 'Valor planejado', cor: '#C9B38A', campo: 'vp', dash: '5,4', tipo: 'rs' },
  { id: 'va', nome: 'Valor agregado', cor: '#E8B04B', campo: 'va', dash: null, tipo: 'rs' },
  { id: 'cr', nome: 'Custo pago', cor: '#D9734E', campo: 'cr', dash: null, tipo: 'rs' },
  { id: 'cc', nome: 'Custo comprometido (pago + a pagar)', cor: '#D9734E', campo: 'cc', dash: '2,3', tipo: 'rs' },
]
const ATALHOS_CURVA = [
  ['Todas', ['fp', 'fr', 'vp', 'va', 'cr', 'cc']],
  ['Só físico', ['fp', 'fr']],
  ['Só financeiro', ['vp', 'va', 'cr', 'cc']],
  ['Agregado × realizado', ['va', 'cr', 'cc']],
  ['Agregado × comprometido', ['va', 'cc']],
  ['Só planejado', ['fp', 'vp']],
  ['Só realizado', ['fr', 'cr', 'cc']],
]

export default function CurvaSCompleta({ semanas, semana, ultimaMedicao, onPick }) {
  const W = 900, H = 340, PADL = 52, PADR = 66, PADT = 26, PADB = 40
  const [hover, setHover] = useState(null)
  const [ocultas, setOcultas] = useState({})
  // Trecho visível: modo dos botões ('atual', '3m', 'toda') ou faixa arrastada
  const [zoom, setZoom] = useState({ modo: '3m' })
  const [arraste, setArraste] = useState(null)
  const [fin, setFin] = useState(null)

  useEffect(() => {
    setFin(null)
    fetch(`/api/curva-s?semana=${semana}`).then((r) => r.json())
      .then((j) => setFin(j.error ? { erro: j.message || j.error, pontos: [] } : j)).catch((e) => setFin({ erro: e.message, pontos: [] }))
  }, [semana])

  const ultMed = fin && fin.ultima_medicao != null ? fin.ultima_medicao : (ultimaMedicao || 0)
  const porSemana = new Map(((fin && fin.pontos) || []).map((p) => [p.semana, p]))
  const pontos = (semanas || []).map((m) => {
    const w = m.semana_numero
    const f = porSemana.get(w)
    const ds = datasDaSemana(w)
    return {
      semana: w, data_inicio: ds.data_inicio, data_fim: ds.data_fim,
      fp: m.hh_planejado,
      fr: w <= Math.min(semana, ultMed) ? m.hh_realizado : null,
      vp: m.financeiro_planejado,
      va: f && f.va != null && w <= semana ? f.va : null,
      cr: f && w <= semana ? f.cr : null,
      // comprometido: a partir da semana anterior ao fechamento (para sair da linha do pago) até a semana selecionada
      cc: f && w <= semana && fin.semana_fechamento != null && w >= fin.semana_fechamento - 1
        ? (f.cc != null ? f.cc : f.cr) : null,
    }
  })
  const n = pontos.length
  const series = SERIES_CURVA
  const visiveis = series.filter((sr) => !ocultas[sr.id])

  // Índices do trecho visível
  const iSel = Math.max(0, pontos.findIndex((m) => m.semana === semana))
  const [i0, i1] = (() => {
    if (!n) return [0, 1]
    if (zoom.modo === 'faixa') return [zoom.i0, zoom.i1]
    if (zoom.modo === 'toda') return [0, n - 1]
    if (zoom.modo === 'atual') return [0, Math.max(iSel, 1)]
    const ref = pontos[iSel].data_fim
    const de = somarMeses(ref, -3)
    const ate = somarMeses(ref, 3)
    let a = pontos.findIndex((m) => iso(m.data_fim) >= de)
    let b = pontos.length - 1 - [...pontos].reverse().findIndex((m) => iso(m.data_fim) <= ate)
    if (a < 0) a = 0
    if (b < a + 1) b = Math.min(n - 1, a + 1)
    return [a, b]
  })()
  const span = Math.max(i1 - i0, 1)

  // Eixos ajustados ao trecho visível (só as séries ligadas)
  const faixa = (tipo, padrao) => {
    let min = Infinity, max = -Infinity
    visiveis.filter((sr) => sr.tipo === tipo).forEach((sr) => {
      for (let i = i0; i <= i1; i += 1) {
        const v = pontos[i] && pontos[i][sr.campo]
        if (v == null) continue
        min = Math.min(min, v); max = Math.max(max, v)
      }
    })
    return faixaDoEixo(min, max, padrao)
  }
  const maxFinObra = Math.max(...pontos.map((m) => Math.max(m.vp || 0, m.va || 0, m.cr || 0, m.cc || 0)), 1)
  const [pLo, pHi] = faixa('pct', [0, 100])
  const [rLo, rHi] = faixa('rs', [0, maxFinObra])
  const x = (i) => PADL + ((i - i0) / span) * (W - PADL - PADR)
  const yPct = (v) => H - PADB - ((v - pLo) / (pHi - pLo || 1)) * (H - PADT - PADB)
  const yFin = (v) => H - PADB - ((v - rLo) / (rHi - rLo || 1)) * (H - PADT - PADB)
  const esc = (sr) => (sr.tipo === 'pct' ? yPct : yFin)
  const linha = (campo, f) => {
    let d = ''
    for (let i = i0; i <= i1; i += 1) {
      const v = pontos[i] && pontos[i][campo]
      if (v == null) continue
      d += (d === '' ? 'M' : 'L') + x(i).toFixed(1) + ',' + f(v).toFixed(1)
    }
    return d
  }
  function alternar(id) {
    const nova = { ...ocultas, [id]: !ocultas[id] }
    if (series.every((sr) => nova[sr.id])) return // nunca deixa o gráfico vazio
    setOcultas(nova)
  }
  const mostrarSo = (ids) => {
    const o = {}
    series.forEach((sr) => { if (!ids.includes(sr.id)) o[sr.id] = true })
    setOcultas(o)
  }
  const indiceDo = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    if (px < PADL - 10 || px > W - PADR + 10) return null
    const i = i0 + Math.round(((px - PADL) / (W - PADL - PADR)) * span)
    return Math.max(i0, Math.min(i, i1))
  }

  if (!n) return <div className="loading">Montando a curva S…</div>

  const h = hover != null ? pontos[hover] : null
  const desvioFis = h && h.fr != null && h.fp != null && !ocultas.fp && !ocultas.fr ? h.fr - h.fp : null
  const saldo = h && h.va != null && h.cc != null && !ocultas.va && !ocultas.cc ? h.va - h.cc : null
  const passoRotulo = span > 60 ? 8 : span > 30 ? 4 : span > 14 ? 2 : 1
  const ticks = [0, 1, 2, 3, 4]
  const botaoZoom = (rotulo, modo) => (
    <button key={modo} className="btn-sm" onClick={() => setZoom({ modo })}
      style={zoom.modo === modo ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}>{rotulo}</button>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        {botaoZoom('Até a semana atual', 'atual')}
        {botaoZoom('± 3 meses', '3m')}
        {botaoZoom('Obra toda', 'toda')}
        {zoom.modo === 'faixa' && <button className="btn-sm" onClick={() => setZoom({ modo: 'toda' })}>Ver tudo</button>}
        <span className="kpi-sub" style={{ marginLeft: 'auto' }}>
          S{pontos[i0].semana}–S{pontos[i1].semana} · arraste sobre o gráfico para ampliar um trecho (duplo clique volta)
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', cursor: arraste ? 'col-resize' : 'crosshair', userSelect: 'none' }}
        onDoubleClick={() => { setArraste(null); setZoom({ modo: 'toda' }) }}
        onMouseDown={(e) => { const i = indiceDo(e); if (i != null) setArraste({ de: i, ate: i }) }}
        onMouseMove={(e) => { const i = indiceDo(e); setHover(i); if (arraste && i != null) setArraste({ ...arraste, ate: i }) }}
        onMouseLeave={() => { setHover(null); setArraste(null) }}
        onMouseUp={(e) => {
          const i = indiceDo(e)
          const a = arraste
          setArraste(null)
          if (!a) return
          const fim = i == null ? a.ate : i
          const lo = Math.min(a.de, fim), hi = Math.max(a.de, fim)
          // arrasto de 2 semanas ou mais amplia; clique simples vai à semana
          if (hi - lo >= 2) setZoom({ modo: 'faixa', i0: lo, i1: hi })
          else if (onPick) onPick(pontos[a.de].semana)
        }}>
        {ticks.map((k) => {
          const vp = pLo + ((pHi - pLo) * k) / 4
          const vr = rLo + ((rHi - rLo) * k) / 4
          const y = H - PADB - (k / 4) * (H - PADT - PADB)
          return (
            <g key={k}>
              <line x1={PADL} y1={y} x2={W - PADR} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={PADL - 8} y={y + 3} fill="var(--text3)" fontSize="9" textAnchor="end">{fmtPcEixo(vp)}</text>
              <text x={W - PADR + 8} y={y + 3} fill="var(--text3)" fontSize="9">{fmtK(vr)}</text>
            </g>
          )
        })}
        {pontos.map((m, i) => i >= i0 && i <= i1 && (m.semana % passoRotulo === 0 || m.semana === 1) && (
          <text key={i} x={x(i)} y={H - PADB + 15} fill="var(--text3)" fontSize="8" textAnchor="middle">S{m.semana}</text>
        ))}
        {iSel >= i0 && iSel <= i1 && (
          <g>
            <line x1={x(iSel)} y1={PADT - 10} x2={x(iSel)} y2={H - PADB} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5,4" />
            <text x={x(iSel)} y={PADT - 14} fill="var(--accent)" fontSize="9" textAnchor="middle" fontWeight="bold">S{semana}</text>
          </g>
        )}
        <clipPath id="curva-s-area">
          <rect x={PADL} y={PADT - 12} width={W - PADL - PADR} height={H - PADT - PADB + 12} />
        </clipPath>
        <g clipPath="url(#curva-s-area)">
          {/* comprometido por baixo: antes do fechamento ele coincide com o pago */}
          {[...visiveis].sort((p, q) => (q.id === 'cc') - (p.id === 'cc')).map((sr) => (
            <path key={sr.id} d={linha(sr.campo, esc(sr))} fill="none" stroke={sr.cor} strokeWidth="2"
                  strokeDasharray={sr.dash || 'none'} opacity={sr.dash === '5,4' ? 0.62 : 1}
                  strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </g>
        {arraste && arraste.ate !== arraste.de && (
          <rect x={Math.min(x(arraste.de), x(arraste.ate))} y={PADT - 10} width={Math.abs(x(arraste.ate) - x(arraste.de))}
                height={H - PADB - PADT + 10} fill="var(--accent)" opacity="0.12" />
        )}
        {h && (
          <g>
            <line x1={x(hover)} y1={PADT - 10} x2={x(hover)} y2={H - PADB} stroke="var(--text3)" strokeWidth="1" opacity=".55" />
            {visiveis.map((sr) => h[sr.campo] == null ? null : (
              <circle key={sr.id} cx={x(hover)} cy={esc(sr)(h[sr.campo])} r="3.5" fill={sr.cor} stroke="var(--bg)" strokeWidth="1.5" />
            ))}
          </g>
        )}
      </svg>

      {/* leitura da semana sob o cursor */}
      <div style={{ minHeight: 62, marginTop: 4 }}>
        {h ? (
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px',
                        background: 'var(--bg3)', borderRadius: 9, border: '1px solid var(--border)' }}>
            <div style={{ font: '600 12px var(--mono)', color: 'var(--accent)' }}>
              S{String(h.semana).padStart(2, '0')} · {dm(h.data_inicio)} a {dm(h.data_fim)}
            </div>
            {visiveis.map((sr) => (
              <div key={sr.id}>
                <div className="kpi-sub">{sr.nome}</div>
                <div style={{ font: '600 13px var(--mono)', color: sr.cor }}>
                  {h[sr.campo] == null ? '—' : sr.tipo === 'pct' ? fmtP1(h[sr.campo]) : fmtMoeda2(h[sr.campo])}
                </div>
              </div>
            ))}
            {desvioFis != null && (
              <div>
                <div className="kpi-sub">Desvio físico (realizado − planejado)</div>
                <div style={{ font: '600 13px var(--mono)', color: desvioFis >= 0 ? VERDE : VERMELHO }}>
                  {`${desvioFis >= 0 ? '+' : ''}${desvioFis.toFixed(1).replace('.', ',')} p.p.`}
                </div>
              </div>
            )}
            {saldo != null && (
              <div>
                <div className="kpi-sub">Saldo (valor agregado − comprometido)</div>
                <div style={{ font: '600 13px var(--mono)', color: saldo >= 0 ? VERDE : VERMELHO }}>{fmtMoeda2(saldo)}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="kpi-sub" style={{ textAlign: 'center', padding: '14px 0' }}>
            {fin && fin.erro ? `Curva financeira indisponível: ${fin.erro}` : !fin ? 'Somando o valor agregado semana a semana…'
              : 'Passe o mouse sobre o gráfico para ver os valores de cada semana · clique para ir à semana · arraste para ampliar.'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' }}>
        {series.map((sr) => {
          const off = ocultas[sr.id]
          return (
            <button key={sr.id} onClick={() => alternar(sr.id)} title={off ? 'clique para mostrar' : 'clique para ocultar'}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                       background: off ? 'transparent' : 'var(--bg3)', border: '1px solid ' + (off ? 'var(--border)' : 'var(--border2)'),
                       color: off ? 'var(--text3)' : 'var(--text2)', opacity: off ? 0.5 : 1 }}>
              <svg width="20" height="3">
                <line x1="0" y1="1.5" x2="20" y2="1.5" stroke={off ? 'var(--text3)' : sr.cor} strokeWidth="2.5" strokeDasharray={sr.dash || 'none'} />
              </svg>
              {sr.nome}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' }}>
        {ATALHOS_CURVA.map(([l, ids]) => {
          const ativo = series.every((sr) => (ids.includes(sr.id) ? !ocultas[sr.id] : !!ocultas[sr.id]))
          return (
            <button key={l} className="btn-sm" onClick={() => mostrarSo(ids)}
              style={ativo ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}>{l}</button>
          )
        })}
      </div>
      <div className="kpi-sub" style={{ marginTop: 12, textAlign: 'center' }}>
        Eixo esquerdo: avanço físico (horas). Eixo direito: custo direto acumulado. As linhas de realizado terminam na
        semana selecionada (S{semana}); o físico realizado e o valor agregado, na última medição
        {ultMed ? ` (S${ultMed})` : ''}; o planejado vai até o fim da obra. Custo comprometido = pago + contas a pagar do
        direto do último fechamento{fin && fin.semana_fechamento != null
          ? ` (${fin.mes_fechamento}, a partir da S${fin.semana_fechamento}: ${fmtMoeda2(fin.a_pagar_fechamento)})` : ''}.
        Os eixos se ajustam ao trecho visível.
      </div>
    </div>
  )
}
