import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { OBRA, fmtMoeda, fmtMoedaK, fmtPct, semanaLabel , ehCustoDeTempo } from '../lib/constants'
import MapaPavimentos from './MapaPavimentos'
import FisicoPorAtividade from './FisicoPorAtividade'
import DiarioOcorrencias from './DiarioOcorrencias'

export default function Dashboard({ semana, sessao }) {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)
  // avanço físico sempre por HORAS (CLAUDE.md: horas executadas ÷ horas orçadas, nunca ponderado por valor)
  const base = 'horas'
  const [itens, setItens] = useState(null)
  const [med, setMed] = useState(null)
  const [painel, setPainel] = useState(null)   // valor agregado, comprometido e contas a pagar (/api/painel)

  useEffect(() => {
    setPainel(null)
    fetch(`/api/painel?semana=${semana}&linhas=0`).then(r => r.json())
      .then(j => setPainel(j.error ? { erro: j.message || j.error } : j)).catch(e => setPainel({ erro: e.message }))
  }, [semana])

  useEffect(() => {
    // orçamento do banco (fonte única; antes vinha de public/dados.json)
    fetch('/api/orcamento').then(r => r.json())
      .then(j => Array.isArray(j) && setItens(j.filter(i => i.g <= 16 && !ehCustoDeTempo(i)))).catch(() => {})
  }, [])
  useEffect(() => {
    setMed(null)
    fetch(`/api/avanco?semana=${semana}`).then(r => r.json())
      .then(j => !j.error && setMed(j.medido)).catch(() => {})
  }, [semana])

  useEffect(() => {
    setD(null); setErro(null)
    fetch(`/api/dashboard-integrado?semana=${semana}`)
      .then(r => r.json())
      .then(j => (j.error ? setErro(j.message || j.error) : setD(j)))
      .catch(e => setErro(e.message))
  }, [semana])

  if (erro) return (
    <div className="card">
      <div className="card-title">Não foi possível carregar</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        {erro}
        <br /><br />
        Verifique se as variáveis do Supabase estão no <code>.env.local</code> e se
        os scripts <code>01_estrutura</code> e <code>02_seed</code> rodaram.
      </div>
    </div>
  )
  if (!d) return <div className="loading">Carregando dados da obra…</div>

  const k = d.kpis

  return (
    <>
      <HeroCusto k={k} />
      <div className="kpi-sub" style={{ margin: '0 0 12px' }}>
        Avanço físico por horas de mão de obra: base de {Math.round(k.base_horas || 0).toLocaleString('pt-BR')} h
        (o material segue o avanço do serviço vinculado).
      </div>
      <Kpis k={k} semana={semana} base={base} painel={painel} />
      <ContasAPagar painel={painel} semana={semana} />
      <div className="card">
        <div className="card-title">Curva S — físico e financeiro</div>
        <CurvaS semanas={d.semanas_alinhadas} semAtual={semana} base={base} />
      </div>
      <FisicoPorAtividade itens={itens} medido={med} semana={semana} base={base} />
      <MapaPavimentos itens={itens} medido={med} semana={semana} base={base} />
      <DiarioOcorrencias sessao={sessao} itens={itens} />
    </>
  )
}

/* ─── HERO: DIRETO + INDIRETO = TOTAL ─────────────────────── */
function HeroCusto({ k }) {
  return (
    <div className="hero">
      <div className="hero-block">
        <div className="hero-label">Custo total da obra</div>
        <div className="hero-row">
          <div>
            <div className="hero-cap">Direto</div>
            <div className="hero-num">{fmtMoeda(k.custo_direto_total)}</div>
          </div>
          <div className="hero-op">+</div>
          <div>
            <div className="hero-cap">Indireto</div>
            <div className="hero-num">{fmtMoeda(k.custo_indireto_total)}</div>
          </div>
          <div className="hero-op">=</div>
          <div className="hero-total">
            <div className="hero-cap">Total</div>
            <div className="hero-num">{fmtMoeda(k.orcamento_total)}</div>
          </div>
        </div>
      </div>
      <div className="hero-div" />
      <div className="hero-side">
        <div className="hero-cap">Custo por m² · {OBRA.area_total.toLocaleString('pt-BR')} m²</div>
        <div className="hero-side-num">{fmtMoeda(k.orcamento_total / OBRA.area_total)}</div>
        <div className="kpi-sub" style={{ marginTop: 6 }}>
          {fmtMoeda(k.custo_direto_total / OBRA.area_total)}/m² só de custo direto
        </div>
      </div>
    </div>
  )
}

/* ─── KPIs ────────────────────────────────────────────────── */
function Kpis({ k, semana, base, painel }) {
  const router = useRouter()
  const porHora = base === 'horas'
  // avanço: planejado pela curva do cronograma e realizado pelas medições, em horas (/api/painel); sem o painel,
  // o da dashboard-integrado (mesma regra)
  const av = painel && !painel.erro ? painel.avanco : null
  const planFis = av ? av.planejado : (porHora ? k.avanco_hh_planejado : k.avanco_fisico_planejado)
  const realFis = av ? av.realizado : (porHora ? k.avanco_hh_realizado : k.avanco_fisico_realizado)
  const desvFis = av ? (k.tem_medicao ? +(av.realizado - av.planejado).toFixed(2) : null) : (porHora ? k.desvio_hh : k.desvio_fisico)
  // custo direto: valor agregado × comprometido (pago + a pagar), não o planejado do cronograma (CLAUDE.md, 08/10)
  const tot = painel && !painel.erro ? painel.totais : null
  const indPlan = k.custo_indireto_planejado_ate
  const indReal = k.custo_indireto_realizado
  const saldoDir = tot ? tot.agregado - tot.comprometido : null
  const saldoInd = indPlan - indReal
  const desvio = desvFis
  const temDesvio = desvio != null

  // Planejado: referencia, matiz frio. Realizado: medido, claro + pilula.
  // Saldo: verde quando sobra, vermelho quando estoura.
  const PLAN = '#6e8ba8'
  const REAL = '#f2f4f7'
  const PILL = { background: 'rgba(255,255,255,0.07)', padding: '3px 8px',
                 borderRadius: 6 }
  const corSaldo = v => v >= 0 ? 'var(--green-tx)' : 'var(--red-tx)'
  const legSaldo = v => v >= 0 ? 'Economia' : 'Estouro'
  const pctDe = (real, plan) => plan > 0 ? fmtPct(100 * real / plan) + ' do planejado' : '—'

  const carregando = painel == null ? 'carregando…' : painel.erro ? 'indisponível: ' + painel.erro : null
  const cards = [
    { l: 'Valor agregado (direto)', c: PLAN, v: tot ? fmtMoeda(tot.agregado) : '—',
      s: carregando || `Até S${semana} · ${fmtPct(100 * tot.agregado / tot.orcado)} do orçado`,
      link: `/custos-diretos?semana=${semana}` },
    { l: 'Custo direto comprometido', c: REAL, pill: true, v: tot ? fmtMoeda(tot.comprometido) : '—',
      s: carregando || `${fmtMoedaK(tot.pago)} pago + ${fmtMoedaK(tot.a_pagar)} a pagar`,
      link: `/custos-diretos?semana=${semana}` },
    { l: 'Saldo custo direto', v: saldoDir == null ? '—' : fmtMoeda(saldoDir),
      s: saldoDir == null ? (carregando || '—') : legSaldo(saldoDir) + ' · valor agregado − comprometido',
      c: saldoDir == null ? null : corSaldo(saldoDir), cs: saldoDir == null ? null : corSaldo(saldoDir) },
    { l: 'Avanço físico planejado', v: fmtPct(planFis),
      s: 'Curva do cronograma (horas)',
      link: `/avanco-fisico?semana=${semana}` },
    { l: 'Desvio físico',
      v: temDesvio ? (desvio > 0 ? '+' : '') + fmtPct(desvio) : '—',
      s: !temDesvio ? 'Depende da medição'
         : desvio >= 0 ? 'Adiantado' : 'Atrasado',
      c: !temDesvio ? null : desvio >= 0 ? 'var(--green-tx)'
         : desvio > -5 ? 'var(--amber-tx)' : 'var(--red-tx)',
      cs: !temDesvio ? null : desvio >= 0 ? 'var(--green-tx)'
         : desvio > -5 ? 'var(--amber-tx)' : 'var(--red-tx)' },

    { l: 'Custo indireto planejado', c: PLAN, v: fmtMoeda(indPlan), s: `Acumulado até S${semana}`,
      link: `/custos-indiretos?semana=${semana}` },
    { l: 'Custo indireto realizado', c: REAL, pill: true, v: fmtMoeda(indReal), s: pctDe(indReal, indPlan),
      link: `/custos-indiretos?semana=${semana}` },
    { l: 'Saldo custo indireto', v: fmtMoeda(saldoInd),
      s: legSaldo(saldoInd), c: corSaldo(saldoInd), cs: corSaldo(saldoInd) },
    { l: 'Avanço físico realizado',
      v: k.tem_medicao ? fmtPct(realFis) : '—',
      s: k.tem_medicao
        ? (k.ultima_semana_medida && semana - k.ultima_semana_medida > 2
            ? `última medição na S${k.ultima_semana_medida}`
            : 'Realizado até agora')
        : 'Sem medição lançada',
      cs: (k.tem_medicao && k.ultima_semana_medida && semana - k.ultima_semana_medida > 2)
        ? 'var(--amber-tx)' : null,
      link: `/avanco-fisico?semana=${semana}` },
  ]

  return (
    <div className="kpi-grid">
      {cards.map((c, i) => (
        <div className={'kpi' + (c.link ? ' kpi-clickable' : '')} key={i}
             onClick={c.link ? () => router.push(c.link) : undefined}
             title={c.link ? 'Ver o detalhamento' : undefined}>
          <div className="kpi-label">
            {c.l}{c.link && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>→</span>}
          </div>
          <div className="kpi-value" style={c.c ? { color: c.c } : null}>
            {c.pill ? <span style={PILL}>{c.v}</span> : c.v}
          </div>
          <div className="kpi-sub" style={c.cs ? { color: c.cs } : null}>{c.s}</div>
        </div>
      ))}
    </div>
  )
}

/* ─── CONTAS A PAGAR ──────────────────────────────────────── */
// Card "Custo direto a pagar" (só direto e não recorrente; CLAUDE.md, 08/10). Ao clicar, a lista do fechamento por
// mês de vencimento, com os totais direto / indireto / geral (/api/contas-a-pagar, sem senha, como no Flats).
function ContasAPagar({ painel, semana }) {
  const [aberto, setAberto] = useState(false)
  const [lista, setLista] = useState(null)
  useEffect(() => { setLista(null); setAberto(false) }, [semana])
  if (!painel || painel.erro) return null
  const c = painel.contas
  if (!c.disponivel) return null
  function alternar() {
    const novo = !aberto
    setAberto(novo)
    if (novo && !lista) {
      fetch(`/api/contas-a-pagar?semana=${semana}`).then(r => r.json())
        .then(j => setLista(j.error ? { erro: j.message || j.error } : j)).catch(e => setLista({ erro: e.message }))
    }
  }
  const mesBR = m => m ? m.split('-').reverse().join('/') : '—'
  return (
    <div className="card">
      <div className="kpi kpi-clickable" onClick={alternar} title="Ver os títulos" style={{ margin: 0 }}>
        <div className="kpi-label">
          Custo direto a pagar<span style={{ color: 'var(--accent)', marginLeft: 6 }}>{aberto ? '▲' : '▼'}</span>
        </div>
        <div className="kpi-value">{c.fechamento ? fmtMoeda(c.totais.custo_direto_a_pagar) : '—'}</div>
        <div className="kpi-sub">
          {c.fechamento
            ? `Vencimentos a partir de ${c.vencimentos_a_partir || '—'} · fechamento ${c.fechamento} · ${c.n_titulos} título${c.n_titulos === 1 ? '' : 's'}`
            : `Nenhum fechamento de contas a pagar até a S${semana}`}
        </div>
      </div>
      {aberto && (
        <div style={{ marginTop: 14 }}>
          {!lista ? <div className="loading">Carregando títulos…</div>
            : lista.erro ? <div className="kpi-sub">Não foi possível carregar: {lista.erro}</div>
            : lista.por_mes.map(m => (
              <div key={m.mes} style={{ marginBottom: 14 }}>
                <div className="form-section-title" style={{ marginBottom: 6 }}>
                  Vencimento {mesBR(m.mes)} · {fmtMoeda(m.total)}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Fornecedor</th><th style={{ width: 130 }}>Documento</th><th style={{ width: 60 }}>Parcela</th>
                      <th style={{ width: 92 }}>Vencimento</th><th style={{ width: 104, textAlign: 'right' }}>Valor</th>
                      <th style={{ width: 150 }}>EAP</th><th style={{ width: 120 }}>Tipo</th><th>Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.titulos.filter(t => t.competencia_vencimento === m.mes).map(t => (
                      <tr key={t.chave}>
                        <td>{t.fornecedor}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{t.num_documento}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{t.parcela || '—'}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{t.data_vencimento ? t.data_vencimento.split('-').reverse().join('/') : '—'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoeda(t.valor)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                          {t.eaps.map(e => (e.codigo_eap || 'pendente') + (e.pavimento ? ' ' + e.pavimento : '')).join(', ')}
                        </td>
                        <td style={{ fontSize: 11 }}>
                          {t.tipo === 'direto' ? 'direto' : t.tipo === 'direto recorrente' ? 'direto recorrente (fora do card)' : t.tipo}
                        </td>
                        <td style={{ fontSize: 11, color: t.alertas.length ? 'var(--amber-tx)' : 'var(--text3)' }}>
                          {t.alertas.length ? t.alertas.join('; ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          {lista && !lista.erro && (
            <div className="kpi-sub">
              Totais do fechamento {lista.fechamento}: direto {fmtMoeda(lista.totais.direto)} (entra no card e no custo
              comprometido) · direto recorrente {fmtMoeda(lista.totais.direto_recorrente)} · indireto{' '}
              {fmtMoeda(lista.totais.indireto)} · pendente {fmtMoeda(lista.totais.pendente)} · geral{' '}
              {fmtMoeda(lista.totais.total)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── CURVA S SEMANAL ─────────────────────────────────────── */
function CurvaS({ semanas, semAtual, base }) {
  const porHora = base === 'horas'
  const W = 900, H = 340, PADL = 52, PADR = 62, PADT = 26, PADB = 40
  const n = semanas.length
  const [hover, setHover] = useState(null)
  const [ocultas, setOcultas] = useState({})

  const maxFin = Math.max(...semanas.map(m => m.financeiro_planejado || 0), 1)
  const x = i => PADL + (i / (n - 1)) * (W - PADL - PADR)
  const yPct = v => H - PADB - (v / 100) * (H - PADT - PADB)
  const yFin = v => H - PADB - (v / maxFin) * (H - PADT - PADB)

  const series = [
    { id: 'fp', nome: porHora ? 'Físico planejado (h)' : 'Físico planejado', cor: '#5B9BD5',
      campo: porHora ? 'hh_planejado' : 'fisico_planejado', esc: yPct, dash: '5,4', tipo: 'pct' },
    { id: 'fr', nome: porHora ? 'Físico realizado (h)' : 'Físico realizado', cor: '#4D9B6A',
      campo: porHora ? 'hh_realizado' : 'fisico_realizado', esc: yPct, dash: null, tipo: 'pct' },
    { id: '$p', nome: 'Financeiro planejado', cor: '#C8860A', campo: 'financeiro_planejado',
      esc: yFin, dash: '5,4', tipo: 'rs' },
    { id: '$r', nome: 'Financeiro realizado', cor: '#E91E8C', campo: 'financeiro_realizado',
      esc: yFin, dash: null, tipo: 'rs' },
  ]
  const visiveis = series.filter(s => !ocultas[s.id])

  const linha = (campo, esc) => {
    let d = ''
    semanas.forEach((m, i) => {
      const v = m[campo]
      if (v == null) return
      d += (d === '' ? 'M' : 'L') + x(i).toFixed(1) + ',' + esc(v).toFixed(1)
    })
    return d
  }

  // clique liga e desliga cada linha — dá para combinar as que quiser
  function alternar(id) {
    const nova = { ...ocultas, [id]: !ocultas[id] }
    // nunca deixa o gráfico vazio
    if (series.every(s => nova[s.id])) return
    setOcultas(nova)
  }
  const mostrarSo = ids => {
    const o = {}
    series.forEach(s => { if (!ids.includes(s.id)) o[s.id] = true })
    setOcultas(o)
  }

  function mover(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    if (px < PADL - 10 || px > W - PADR + 10) { setHover(null); return }
    const i = Math.round(((px - PADL) / (W - PADL - PADR)) * (n - 1))
    setHover(Math.max(0, Math.min(i, n - 1)))
  }

  const h = hover != null ? semanas[hover] : null

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}
           onMouseMove={mover} onMouseLeave={() => setHover(null)}>
        {[0, 25, 50, 75, 100].map(p => (
          <g key={p}>
            <line x1={PADL} y1={yPct(p)} x2={W - PADR} y2={yPct(p)}
                  stroke="var(--border)" strokeWidth="1" />
            <text x={PADL - 8} y={yPct(p) + 3} fill="var(--text3)" fontSize="9"
                  textAnchor="end">{p}%</text>
            <text x={W - PADR + 8} y={yPct(p) + 3} fill="var(--text3)" fontSize="9">
              {fmtMoedaK(maxFin * p / 100)}
            </text>
          </g>
        ))}
        {semanas.map((m, i) => (m.semana_numero % 8 === 0 || m.semana_numero === 1) && (
          <text key={i} x={x(i)} y={H - PADB + 15} fill="var(--text3)" fontSize="8"
                textAnchor="middle">S{m.semana_numero}</text>
        ))}

        <line x1={x(semAtual - 1)} y1={PADT - 10} x2={x(semAtual - 1)} y2={H - PADB}
              stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5,4" />
        <text x={x(semAtual - 1)} y={PADT - 14} fill="var(--accent)" fontSize="9"
              textAnchor="middle" fontWeight="bold">S{semAtual}</text>

        {visiveis.map(s => (
          <path key={s.id} d={linha(s.campo, s.esc)} fill="none" stroke={s.cor}
                strokeWidth="2" strokeDasharray={s.dash || 'none'}
                opacity={s.dash ? .62 : 1} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {h && (
          <g>
            <line x1={x(hover)} y1={PADT - 10} x2={x(hover)} y2={H - PADB}
                  stroke="var(--text3)" strokeWidth="1" opacity=".55" />
            {visiveis.map(s => h[s.campo] == null ? null : (
              <circle key={s.id} cx={x(hover)} cy={s.esc(h[s.campo])} r="3.5"
                      fill={s.cor} stroke="var(--bg)" strokeWidth="1.5" />
            ))}
          </g>
        )}
      </svg>

      {/* leitura da semana sob o cursor */}
      <div style={{ minHeight: 62, marginTop: 4 }}>
        {h ? (
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center',
                        padding: '10px 14px', background: 'var(--bg3)', borderRadius: 9,
                        border: '1px solid var(--border)' }}>
            <div style={{ font: '600 12px var(--mono)', color: 'var(--accent)' }}>
              {semanaLabel(h.semana_numero)}
            </div>
            {visiveis.map(s => (
              <div key={s.id}>
                <div className="kpi-sub">{s.nome}</div>
                <div style={{ font: '600 13px var(--mono)', color: s.cor }}>
                  {h[s.campo] == null ? '—'
                    : s.tipo === 'pct' ? fmtPct(h[s.campo], 2) : fmtMoeda(h[s.campo])}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="kpi-sub" style={{ textAlign: 'center', padding: '14px 0' }}>
            Passe o mouse sobre o gráfico para ver os valores de cada semana.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10,
                    justifyContent: 'center' }}>
        {series.map(s => {
          const off = ocultas[s.id]
          return (
            <button key={s.id} onClick={() => alternar(s.id)}
              title={off ? 'clique para mostrar' : 'clique para ocultar'}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11,
                       padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                       background: off ? 'transparent' : 'var(--bg3)',
                       border: '1px solid ' + (off ? 'var(--border)' : 'var(--border2)'),
                       color: off ? 'var(--text3)' : 'var(--text2)',
                       opacity: off ? .5 : 1 }}>
              <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5"
                stroke={off ? 'var(--text3)' : s.cor} strokeWidth="2.5"
                strokeDasharray={s.dash || 'none'} /></svg>
              {s.nome}
            </button>
          )
        })}
      </div>

      {/* atalhos de comparação */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10,
                    justifyContent: 'center' }}>
        {[['Todas', ['fp', 'fr', '$p', '$r']],
          ['Só físico', ['fp', 'fr']],
          ['Só financeiro', ['$p', '$r']],
          ['Só planejado', ['fp', '$p']],
          ['Só realizado', ['fr', '$r']]].map(([l, ids]) => {
          const ativo = series.every(s => ids.includes(s.id) ? !ocultas[s.id] : !!ocultas[s.id])
          return (
            <button key={l} className="btn-sm" onClick={() => mostrarSo(ids)}
              style={ativo ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}>
              {l}
            </button>
          )
        })}
      </div>

      <div className="kpi-sub" style={{ marginTop: 12, textAlign: 'center' }}>
        Eixo esquerdo: avanço físico. Eixo direito: custo direto acumulado.
        Clique numa legenda para mostrar ou ocultar a linha — dá para deixar quantas
        quiser ao mesmo tempo. Os atalhos acima montam as comparações mais comuns.
      </div>
    </div>
  )
}
