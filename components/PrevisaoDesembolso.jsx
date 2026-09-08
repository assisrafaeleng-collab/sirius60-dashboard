import { useMemo, useState } from 'react'
import { fmtMoeda, fmtMoedaK, fmtPct, inicioSemana, fimSemana } from '../lib/constants'

// Previsto pelo orçamento x realizado, até a semana escolhida.
export default function PrevisaoDesembolso({ curva, comparativo, k, semana }) {
  const [horizonte, setHorizonte] = useState(8)
  const [verTudo, setVerTudo] = useState(false)
  const [agrupar, setAgrupar] = useState(true)
  const [soDesvio, setSoDesvio] = useState(false)

  if (!curva || !curva.length) return null
  const num = v => parseFloat(v || 0)
  const atual = curva.find(c => c.semana_numero === semana)
  if (!atual) return null

  const proximas = curva.filter(c => c.semana_numero > semana).slice(0, horizonte)
  const somaProx = proximas.reduce((s, c) => s + num(c.valor_semanal), 0)
  const ini = Math.max(1, semana - 4)
  const janela = curva.filter(c => c.semana_numero >= ini && c.semana_numero < ini + 20)
  const maxBarra = Math.max(...janela.map(c => num(c.valor_semanal)), 1)
  const fmtBR = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })


  // linhas do comparativo, por grupo ou por item
  const linhas = useMemo(() => {
    const base = comparativo || []
    if (!agrupar) return base
    const m = {}
    base.forEach(x => {
      const kk = x.grupo_nome || '—'
      if (!m[kk]) m[kk] = {
        codigo_eap: String(x.grupo_num), descricao: kk, grupo_nome: kk,
        previsto: 0, realizado: 0, orcado: 0,
      }
      m[kk].previsto += x.previsto
      m[kk].realizado += x.realizado
      m[kk].orcado += x.orcado
    })
    return Object.values(m).map(x => ({
      ...x,
      saldo: x.previsto - x.realizado,
      consumo_pct: x.previsto > 0 ? 100 * x.realizado / x.previsto : null,
    })).sort((a, b) => b.previsto - a.previsto)
  }, [comparativo, agrupar])

  const visiveis = useMemo(() => {
    let l = linhas
    if (soDesvio) l = l.filter(x => x.realizado > 0)
    return verTudo ? l : l.slice(0, 12)
  }, [linhas, verTudo, soDesvio])

  return (
    <>
      {/* ---- COMPARATIVO LINHA A LINHA ---- */}
      <div className="card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span>Previsto x realizado até a S{semana}</span>
          <span className="btn-row">
            <button className="btn-sm" onClick={() => setAgrupar(!agrupar)}>
              {agrupar ? 'Abrir por item' : 'Agrupar por grupo'}
            </button>
            <button className="btn-sm" onClick={() => setSoDesvio(!soDesvio)}>
              {soDesvio ? 'Mostrar tudo' : 'Só com gasto'}
            </button>
          </span>
        </div>

        {!linhas.length ? (
          <div className="empty-state">
            <h3>Nada previsto até esta semana</h3>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 62 }}>{agrupar ? 'Grupo' : 'EAP'}</th>
                  <th>{agrupar ? '' : 'Serviço'}</th>
                  <th style={{ width: 96 }}>Previsto</th>
                  <th style={{ width: 96 }}>Realizado</th>
                  <th style={{ width: 96 }}>Saldo</th>
                  <th style={{ width: 120 }}>Consumo</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((x, n) => {
                  const pct = x.consumo_pct
                  const cor = pct == null ? 'var(--text3)'
                    : pct > 105 ? 'var(--red-tx)'
                    : pct > 90 ? 'var(--amber-tx)' : 'var(--green-tx)'
                  return (
                    <tr key={x.codigo_eap + n}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{x.codigo_eap}</td>
                      <td style={{ fontSize: 12 }}>{agrupar ? x.grupo_nome : x.descricao}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{fmtMoedaK(x.previsto)}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>
                        {x.realizado > 0 ? fmtMoedaK(x.realizado)
                          : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)',
                                   color: x.saldo >= 0 ? 'var(--green-tx)' : 'var(--red-tx)' }}>
                        {fmtMoedaK(x.saldo)}
                      </td>
                      <td>
                        {pct == null ? <span style={{ color: 'var(--text3)' }}>—</span> : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="prog-track" style={{ height: 7 }}>
                              <div className="prog-fill" style={{
                                width: Math.min(pct, 100) + '%',
                                background: cor,
                              }} />
                            </div>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: cor,
                                           minWidth: 44, textAlign: 'right' }}>
                              {fmtPct(pct, 0)}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {linhas.length > 12 && (
              <button className="btn-sm" style={{ marginTop: 14 }}
                      onClick={() => setVerTudo(!verTudo)}>
                {verTudo ? 'Mostrar menos' : `Ver todas as ${linhas.length} linhas`}
              </button>
            )}

            <div className="notas-box" style={{ marginTop: 16 }}>
              <b>Previsto</b> é a parcela do orçamento que o cronograma reserva até a S{semana} —
              um serviço que ocupa 10 semanas e está na 3ª conta 30% do valor.
              <b> Consumo</b> acima de 100% significa que a linha gastou mais do que
              deveria ter gasto até aqui, o que pode ser estouro ou antecipação de compra.
            </div>
          </>
        )}
      </div>

      {/* ---- DESEMBOLSO SEMANA A SEMANA ---- */}
      <div className="card">
        <div className="card-title">Desembolso previsto nas próximas semanas</div>

        <div className="kpi-grid" style={{ marginBottom: 18 }}>
          <div className="kpi">
            <div className="kpi-label">Previsto nesta semana</div>
            <div className="kpi-value">{fmtMoeda(num(atual.valor_semanal))}</div>
            <div className="kpi-sub">
              {fmtMoedaK(num(atual.valor_direto))} direto +{' '}
              {fmtMoedaK(num(atual.valor_semanal) - num(atual.valor_direto))} indireto
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Próximas {horizonte} semanas</div>
            <div className="kpi-value">{fmtMoeda(somaProx)}</div>
            <div className="kpi-sub">
              até {proximas.length ? fmtBR(fimSemana(proximas[proximas.length - 1].semana_numero)) : '—'}
            </div>
          </div>
        </div>

        <svg viewBox="0 0 900 190" style={{ width: '100%', height: 'auto' }}>
          {janela.map((c, i) => {
            const w = 900 / janela.length
            const x = i * w
            const hTot = (num(c.valor_semanal) / maxBarra) * 130
            const hDir = (num(c.valor_direto) / maxBarra) * 130
            const eh = c.semana_numero === semana
            return (
              <g key={c.semana_numero}>
                <rect x={x + w * .16} y={150 - hTot} width={w * .68} height={hTot}
                      fill="#C8860A" opacity={eh ? .95 : .38} rx="2" />
                <rect x={x + w * .16} y={150 - hDir} width={w * .68} height={hDir}
                      fill="#5B9BD5" opacity={eh ? .95 : .55} rx="2" />
                <text x={x + w / 2} y={166} fill={eh ? 'var(--accent)' : 'var(--text3)'}
                      fontSize="8" textAnchor="middle" fontWeight={eh ? 'bold' : 'normal'}>
                  S{c.semana_numero}
                </text>
                {eh && (
                  <text x={x + w / 2} y={150 - hTot - 6} fill="var(--accent)"
                        fontSize="9" textAnchor="middle" fontWeight="bold">
                    {fmtMoedaK(num(c.valor_semanal))}
                  </text>
                )}
              </g>
            )
          })}
          <line x1="0" y1="150" x2="900" y2="150" stroke="var(--border2)" strokeWidth="1" />
          <text x="0" y="182" fill="var(--text3)" fontSize="9">
            barra azul = custo direto · barra amarela = total com indiretos
          </text>
        </svg>

        <div className="btn-row" style={{ margin: '16px 0 12px' }}>
          {[4, 8, 13].map(h => (
            <button key={h} className="btn-sm"
                    style={h === horizonte ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}
                    onClick={() => setHorizonte(h)}>
              {h} semanas
            </button>
          ))}
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 44 }}>Sem</th>
              <th style={{ width: 110 }}>Período</th>
              <th style={{ width: 100 }}>Direto</th>
              <th style={{ width: 100 }}>Indireto</th>
              <th style={{ width: 100 }}>Total</th>
              <th>Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {proximas.map(c => (
              <tr key={c.semana_numero}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>S{c.semana_numero}</td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                  {fmtBR(inicioSemana(c.semana_numero))} a {fmtBR(fimSemana(c.semana_numero))}
                </td>
                <td style={{ fontFamily: 'var(--mono)' }}>{fmtMoedaK(num(c.valor_direto))}</td>
                <td style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                  {fmtMoedaK(num(c.valor_semanal) - num(c.valor_direto))}
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                  {fmtMoedaK(num(c.valor_semanal))}
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                  {fmtMoedaK(num(c.valor_acumulado))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="notas-box" style={{ marginTop: 16 }}>
          As <b>quatro primeiras semanas</b> carregam o terreno, o ITBI e os registros —
          por isso são muito maiores que as demais. Para julgar o ritmo da obra,
          olhe a barra azul.
        </div>
      </div>
    </>
  )
}
