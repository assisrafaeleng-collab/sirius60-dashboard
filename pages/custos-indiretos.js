import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useEffect, useMemo, useState } from 'react'
import ListaLancamentos from '../components/ListaLancamentos'
import { OBRA, CORES, fmtMoeda2, fmtP1, CORES_VA, semanaLabel,
         inicioSemana, fimSemana, semanaAtualObra, semanasPorMes } from '../lib/constants'

// Pedido 13D: valores com 2 casas e % com 1 casa; desvio com o sinal da Visão geral e do Flats
// (planejado − realizado: positivo = economia verde, negativo = estouro vermelho); realizado = pago + a pagar.
const fmtMoeda = fmtMoeda2
const fmtPct = (v) => fmtP1(v)
const { economia: VERDE, estouro: VERMELHO, aPagar: AMBAR } = CORES_VA

const AZUL = '#5B9BD5'
const REALIZADO = CORES.realizado   // branco (pedido 13E)

// Ordenação (pedido 13F): padrão = código EAP em ordem numérica (19.1.2 antes de 19.1.10). Clicar no título da
// coluna ordena por ela; clicar de novo inverte. O seletor "Ordenar por" é a mesma ordem (coluna + sentido).
const ORDENS = [
  { v: 'eap|asc', l: 'Código EAP' },
  { v: 'acumulado|desc', l: 'Maior acumulado' },
  { v: 'total|desc', l: 'Maior total do projeto' },
  { v: 'categoria|asc', l: 'Categoria (A-Z)' },
  { v: 'realizado|desc', l: 'Maior realizado' },
]
const cmpEap = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1)
    if (d) return d
  }
  return 0
}
// valor de cada coluna; null = célula vazia ("—"), que vai para o fim nos dois sentidos
const VALOR = {
  eap: c => c.codigo_eap || null,
  categoria: c => c.categoria || null,
  total: c => c.valor_total > 0.005 ? c.valor_total : null,
  acumulado: c => c.acumulado > 0.005 ? c.acumulado : null,
  pago: c => c.pago > 0.005 ? c.pago : null,
  a_pagar: c => c.a_pagar > 0.005 ? c.a_pagar : null,
  realizado: c => c.realizado > 0.005 ? c.realizado : null,
  desvio: c => c.realizado <= 0 && c.acumulado <= 0 ? null : c.desvio,
  desembolsado: c => c.pct_desembolsado,
}
const BLOCOS = [
  { chave: 'p', recorrente: false, titulo: 'Pontuais (terreno, impostos, projetos, registros, taxas)', curto: 'pontuais' },
  { chave: 'r', recorrente: true, titulo: 'Recorrentes (diluídos pela obra)', curto: 'recorrentes' },
]
const TEXTO = { eap: true, categoria: true }   // primeiro clique: texto A→Z, números do maior para o menor

export default function CustosIndiretos() {
  const router = useRouter()
  const [semana, setSemana] = useState(semanaAtualObra())
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState({ col: 'eap', dir: 'asc' })
  const [visao, setVisao] = useState('vs')   // 'vs' = planejado x realizado | 'plan'
  const [linhaAberta, setLinhaAberta] = useState(null)   // lançamentos abertos (id da categoria); tudo recolhido

  useEffect(() => {
    if (router.query.semana) setSemana(parseInt(router.query.semana) || semanaAtualObra())
  }, [router.query.semana])

  useEffect(() => {
    setD(null); setErro(null)
    fetch(`/api/indiretos?semana=${semana}&detalhe=1`).then(r => r.json())
      .then(j => j.error ? setErro(j.message || j.error) : setD(j))
      .catch(e => setErro(e.message))
  }, [semana])

  const lista = useMemo(() => {
    if (!d) return []
    const q = busca.trim().toLowerCase()
    const l = d.categorias.filter(c => !q || c.categoria.toLowerCase().includes(q))
    const val = VALOR[ordem.col]
    const sinal = ordem.dir === 'asc' ? 1 : -1
    return [...l].sort((a, b) => {
      const x = val(a), y = val(b)
      if (x == null || y == null) return x == null && y == null ? cmpEap(a.codigo_eap, b.codigo_eap) : x == null ? 1 : -1
      const d = ordem.col === 'eap' ? cmpEap(x, y) : TEXTO[ordem.col] ? String(x).localeCompare(String(y), 'pt-BR') : x - y
      return sinal * d || cmpEap(a.codigo_eap, b.codigo_eap)
    })
  }, [d, busca, ordem])

  const ordenarPor = col => setOrdem(o => o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' }
    : { col, dir: TEXTO[col] ? 'asc' : 'desc' })
  const valorSelect = `${ordem.col}|${ordem.dir}`
  // título de coluna clicável, com ▲/▼ na coluna ativa
  const th = (col, children, w, title, direita) => (
    <th key={col} style={{ width: w, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: direita ? 'right' : 'left' }} title={title}
        onClick={() => ordenarPor(col)}>
      {children}
      <span style={{ marginLeft: 4, color: ordem.col === col ? 'var(--text)' : 'transparent' }}>
        {ordem.col === col && ordem.dir === 'desc' ? '▼' : '▲'}
      </span>
    </th>
  )
  const fmtBR = x => x.toLocaleDateString('pt-BR')
  const vs = visao === 'vs'
  const corDesvio = dv => dv == null || Math.abs(dv) < 0.005 ? 'var(--text3)' : dv > 0 ? VERDE : VERMELHO
  const txtPct = dv => dv == null ? '—' : (dv > 0 ? '+' : '') + fmtPct(dv)
  // Tabela por categoria (pedido 13G): seta em coluna própria, TIPO em coluna, blocos pontuais / recorrentes com
  // subtotal e total geral; células centralizadas na vertical, números à direita em fonte mono.
  const nCols = vs ? 9 : 7
  const celula = { verticalAlign: 'middle', height: 50 }
  const num = { ...celula, textAlign: 'right', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }
  const vazio = <span style={{ color: 'var(--text3)', fontWeight: 400 }}>—</span>
  // desvio em duas linhas (valor em cima, % embaixo); "a realizar" e "—" numa linha só, centrada na mesma altura
  // (a linha tem altura fixa)
  const duasLinhas = (cima, baixo, cor) => (
    <>
      <div style={{ color: cor }}>{cima}</div>
      {baixo != null && <div style={{ fontSize: 10, color: cor }}>{baixo}</div>}
    </>
  )
  const somaInd = (ls) => {
    const t = { valor_total: 0, acumulado: 0, pago: 0, a_pagar: 0 }
    ls.forEach(c => Object.keys(t).forEach(k => { t[k] += Number(c[k]) || 0 }))
    t.realizado = t.pago + t.a_pagar
    t.desvio = t.acumulado - t.realizado
    t.desvio_pct = t.acumulado > 0 ? 100 * t.desvio / t.acumulado : (t.realizado > 0 ? -100 : null)
    return t
  }
  const desvioCel = (c, aRealizar, peso) => (
    <td style={{ ...num, fontSize: 11, fontWeight: peso }}
        title={c.realizado > 0 || c.acumulado > 0
          ? `Planejado − (pago + a pagar)\n= ${fmtMoeda(c.acumulado)} − (${fmtMoeda(c.pago)} + ${fmtMoeda(c.a_pagar)})` : ''}>
      {c.realizado <= 0 && c.acumulado <= 0 ? duasLinhas('—', null, 'var(--text3)')
        : aRealizar ? duasLinhas('a realizar', null, 'var(--text3)')
        : duasLinhas((c.desvio > 0.005 ? '+' : '') + fmtMoeda(c.desvio), txtPct(c.desvio_pct), corDesvio(c.desvio))}
    </td>
  )
  const linha = (c) => {
    const lanc = c.lancamentos || []
    const on = linhaAberta === c.id
    // pontual com planejado e nada pago nem a pagar: ainda não aconteceu, não é economia (13E)
    const aRealizar = !c.recorrente && c.acumulado > 0.005 && !(c.pago > 0.005) && !(c.a_pagar > 0.005)
    return (
      <React.Fragment key={c.id}>
        <tr onClick={() => lanc.length && setLinhaAberta(on ? null : c.id)} style={{ cursor: lanc.length ? 'pointer' : 'default' }}>
          <td style={{ ...celula, padding: '0 0 0 2px', fontSize: 10, color: 'var(--text3)' }}>{lanc.length > 0 ? (on ? '▾' : '▸') : ''}</td>
          <td style={{ ...celula, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{c.codigo_eap || '—'}</td>
          <td style={celula}>{c.categoria}</td>
          <td style={{ ...celula, fontSize: 11, color: 'var(--text3)' }}>{c.recorrente ? 'recorrente' : 'pontual'}</td>
          <td style={{ ...num, color: 'var(--text2)' }}>{fmtMoeda(c.valor_total)}</td>
          <td style={{ ...num, fontWeight: 600, color: vs ? AZUL : 'var(--accent)' }}>{c.acumulado > 0 ? fmtMoeda(c.acumulado) : vazio}</td>
          {vs && (
            <td style={{ ...num, fontWeight: 600, color: REALIZADO }}
                title={c.pago > 0 ? '' : c.acumulado > 0 ? 'planejado e ainda não pago' : ''}>
              {c.pago > 0 ? fmtMoeda(c.pago) : vazio}
            </td>
          )}
          {vs && <td style={{ ...num, color: c.a_pagar > 0 ? AMBAR : 'var(--text3)' }}>{c.a_pagar > 0 ? fmtMoeda(c.a_pagar) : '—'}</td>}
          {vs && desvioCel(c, aRealizar)}
          {!vs && (
            <td style={celula}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 46, textAlign: 'right' }}>{fmtPct(c.pct_desembolsado, 0)}</span>
                <div className="prog-track" style={{ height: 6 }}>
                  <div className="prog-fill" style={{ width: c.pct_desembolsado + '%',
                    background: c.pct_desembolsado >= 100 ? 'var(--green)' : 'var(--blue)' }} />
                </div>
              </div>
            </td>
          )}
        </tr>
        {on && (
          <tr>
            <td colSpan={nCols} style={{ padding: 0 }}>
              <ListaLancamentos lancamentos={lanc} rotuloPago={false} />
            </td>
          </tr>
        )}
      </React.Fragment>
    )
  }
  // subtotal do bloco ou total geral (soma de TODAS as linhas, mesmo com busca: bate com os cards)
  const linhaTotal = (nome, t, geral) => {
    const peso = 600
    const fundo = { background: 'var(--bg3)' }
    return (
      <tr style={fundo}>
        <td style={celula} />
        <td colSpan={3} style={{ ...celula, fontWeight: peso, ...(geral ? { textTransform: 'uppercase', letterSpacing: '.04em' } : {}) }}>{nome}</td>
        <td style={{ ...num, fontWeight: peso }}>{fmtMoeda(t.valor_total)}</td>
        <td style={{ ...num, fontWeight: peso, color: vs ? AZUL : 'var(--accent)' }}>{fmtMoeda(t.acumulado)}</td>
        {vs && <td style={{ ...num, fontWeight: peso, color: REALIZADO }}>{fmtMoeda(t.pago)}</td>}
        {vs && <td style={{ ...num, fontWeight: peso, color: t.a_pagar > 0.005 ? AMBAR : 'var(--text3)' }}>{t.a_pagar > 0.005 ? fmtMoeda(t.a_pagar) : '—'}</td>}
        {vs && desvioCel(t, false, peso)}
        {!vs && <td style={{ ...num, fontWeight: peso }}>{fmtPct(t.valor_total > 0 ? 100 * t.acumulado / t.valor_total : 0, 0)}</td>}
      </tr>
    )
  }

  return (
    <>
      <Head><title>{'Custos indiretos planejados - ' + OBRA.nome}</title></Head>
      <div className="page">
        <header className="header">
          <div className="obra-eye">
            Custos indiretos — {vs ? 'planejado vs realizado' : 'planejado'}
          </div>
          <h1 className="obra-nome">{OBRA.nome}</h1>
          <div className="obra-info">
            S{semana} · {fmtBR(inicioSemana(semana))} a {fmtBR(fimSemana(semana))}
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <Link href="/" className="btn-secondary"
                  style={{ textDecoration: 'none', display: 'inline-block' }}>
              ← Dashboard
            </Link>
            <button className="btn-secondary" onClick={() => setVisao(vs ? 'plan' : 'vs')}>
              {vs ? 'Ver só o planejado' : 'Comparar com o realizado'}
            </button>
          </div>
        </header>

        <div style={{ marginTop: 22 }}>
          {erro && (
            <div className="card">
              <div className="card-title">Não foi possível carregar</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{erro}</div>
            </div>
          )}

          {!d && !erro && <div className="loading">Carregando custos indiretos…</div>}

          {d && (() => {
            const saldo = d.desvio
            return (
            <>
              <div className="kpi-grid">
                <div className="kpi" style={{ borderLeft: `3px solid ${AZUL}` }}>
                  <div className="kpi-label">Planejado até S{semana}</div>
                  <div className="kpi-value" style={{ color: vs ? AZUL : undefined }}>
                    {fmtMoeda(d.acumulado_ate)}
                  </div>
                  <div className="kpi-sub">
                    {fmtPct(d.total_projeto > 0 ? 100 * d.acumulado_ate / d.total_projeto : 0)} do total
                  </div>
                </div>
                {vs && (
                  <>
                    <div className="kpi" style={{ borderLeft: `3px solid ${REALIZADO}` }}>
                      <div className="kpi-label">Realizado até S{semana}</div>
                      <div className="kpi-value" style={{ color: REALIZADO }}>
                        {fmtMoeda(d.realizado_ate)}
                      </div>
                      <div className="kpi-sub">
                        {d.acumulado_ate > 0 ? `${fmtPct(100 * d.realizado_ate / d.acumulado_ate)} do planejado (pago + a pagar)` : '—'}
                        <div>pago {fmtMoeda(d.pago_ate)} · <span style={{ color: d.a_pagar > 0 ? AMBAR : undefined }}>a pagar {fmtMoeda(d.a_pagar)}</span></div>
                      </div>
                    </div>
                    <div className="kpi" style={{ borderLeft: `3px solid ${corDesvio(saldo)}` }}>
                      <div className="kpi-label">Saldo custo indireto</div>
                      <div className="kpi-value" style={{ color: corDesvio(saldo) }}>{fmtMoeda(saldo)}</div>
                      <div className="kpi-sub" style={{ color: corDesvio(saldo) }}>
                        {saldo >= 0 ? 'Economia' : 'Estouro'} · planejado − realizado
                      </div>
                    </div>
                    <div className="kpi" style={{ borderLeft: `3px solid ${corDesvio(d.desvio_pct)}` }}>
                      <div className="kpi-label">% Desvio do custo indireto</div>
                      <div className="kpi-value" style={{ color: corDesvio(d.desvio_pct) }}>{txtPct(d.desvio_pct)}</div>
                      <div className="kpi-sub" style={{ color: corDesvio(d.desvio_pct) }}>
                        {d.desvio_pct == null ? 'sem base de comparação'
                          : `${d.desvio_pct >= 0 ? 'Economia' : 'Estouro'} sobre o planejado · até S${semana}`}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="form-section">
                <div className="form-section-title">Filtros e ordenação</div>
                <div className="form-grid-3">
                  <div className="field">
                    <label>Período</label>
                    <select className="styled" value={semana}
                            onChange={e => setSemana(+e.target.value)}>
                      {semanasPorMes().map(g => (
                        <optgroup key={g.mes} label={g.mes}>
                          {g.semanas.map(s => <option key={s} value={s}>{semanaLabel(s)}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Buscar categoria</label>
                    <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                           placeholder="digite para filtrar" />
                  </div>
                  <div className="field">
                    <label>Ordenar por</label>
                    <select className="styled" value={valorSelect}
                            onChange={e => { const [col, dir] = e.target.value.split('|'); setOrdem({ col, dir }) }}>
                      {ORDENS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      {!ORDENS.some(o => o.v === valorSelect) && <option value={valorSelect}>Pela coluna clicada</option>}
                    </select>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-title">Custos indiretos por categoria (até S{semana})</div>
                {!lista.length ? (
                  <div className="empty-state"><h3>Nenhuma categoria encontrada</h3></div>
                ) : (
                  <table style={{ tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                      <col style={{ width: 16 }} />
                      <col style={{ width: 66 }} />
                      <col />
                      <col style={{ width: 84 }} />
                      <col style={{ width: 128 }} />
                      <col style={{ width: 128 }} />
                      {vs && <col style={{ width: 128 }} />}
                      {vs && <col style={{ width: 112 }} />}
                      {vs && <col style={{ width: 128 }} />}
                      {!vs && <col style={{ width: 170 }} />}
                    </colgroup>
                    <thead>
                      <tr>
                        <th />
                        {th('eap', 'EAP')}
                        {th('categoria', 'Categoria')}
                        <th>Tipo</th>
                        {th('total', 'Total projeto', null, null, true)}
                        {th('acumulado', 'Planejado', null, null, true)}
                        {vs && th('pago', 'Pago', null, null, true)}
                        {vs && th('a_pagar', 'A pagar', null, null, true)}
                        {vs && th('desvio', 'Desvio', null, 'Planejado − (pago + a pagar). Positivo = economia (verde), negativo = estouro (vermelho); o % é sobre o planejado', true)}
                        {!vs && th('desembolsado', 'Desembolsado', null, null, true)}
                      </tr>
                    </thead>
                    {BLOCOS.map(b => {
                      const linhas = lista.filter(c => !!c.recorrente === b.recorrente)
                      const todas = d.categorias.filter(c => !!c.recorrente === b.recorrente)
                      if (!todas.length) return null
                      return (
                        <tbody key={b.chave}>
                          <tr>
                            <td colSpan={nCols} style={{ ...celula, paddingTop: 18, font: "600 11px 'IBM Plex Mono', monospace",
                                                         letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text2)' }}>
                              {b.titulo}
                            </td>
                          </tr>
                          {linhas.map(c => linha(c))}
                          {linhaTotal(`Subtotal ${b.curto}`, somaInd(todas))}
                        </tbody>
                      )
                    })}
                    <tbody>{linhaTotal('Total geral', somaInd(d.categorias), true)}</tbody>
                  </table>
                )}

                <div className="notas-box" style={{ marginTop: 16 }}>
                  As <b>recorrentes</b> desembolsam um pouco a cada semana ao longo das {OBRA.prazo_semanas} semanas;
                  as <b>pontuais</b> concentram o desembolso no mês previsto. Os subtotais e o total geral somam todas as
                  linhas do bloco, mesmo com a busca; o total geral bate com os cards.
                </div>
              </div>
            </>
            )
          })()}
        </div>
      </div>
    </>
  )
}
