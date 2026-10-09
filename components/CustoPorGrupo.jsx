// Quadro "Custo direto por grupo — valor agregado × custo até Sxx" (pedido 13C), aberto pelo card "Custo direto
// realizado" da Visão geral. Layout, cores e textos do Flats (pages/semanal.js de lá, painel de custo direto por
// grupo). Três níveis, tudo recolhido: grupo → atividades (código + pavimento) → lançamentos pagos e títulos a pagar.
// Dados da /api/painel?detalhe=1 (mesmo valor agregado e custo dos cards). Hooks no topo (erro #310).
import React, { useEffect, useState } from 'react'
import { fmtMoeda2 as fmtMoeda, fmtP1 as fmtP, rotuloPavimento } from '../lib/constants'
import { competenciaDaSemana } from '../lib/calendario'
import ListaLancamentos from './ListaLancamentos'
import { PLAN, AMBAR, CINZA, VERMELHO, BarraEstouro, NeutroVerba, Estouro, percDoOrcado, fmtPercOrcado,
  tituloPercOrcado, somar, ResumoVerbaForma } from './ValorCusto'

const GRUPO_COLS = '38px minmax(0,1fr) 140px 150px 200px 84px 180px 28px'
const S2 = (n) => `S${String(n).padStart(2, '0')}`
// mês da obra (M1 = ago/2026) de uma semana
const mesDaSemana = (s) => {
  const c = competenciaDaSemana(s)
  const [y, m] = String(c).split('-').map(Number)
  return (y - 2026) * 12 + m - 8 + 1
}
// linha de título do orçamento (orçado zero, sem custo e sem agregado): não aparece, mas soma
const linhaVisivel = (i) => i.orcado > 0.005 || i.pago + i.a_pagar > 0.005 || i.agregado > 0.005

function ColunasValorCusto({ v, neutroVerba }) {
  const fs = 13
  const sub = { fontSize: 10, color: CINZA }
  const pv = percDoOrcado(v.pago, v.a_pagar, v.orcado)
  return (
    <>
      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: fs }}>
        <div>{fmtMoeda(v.orcado || 0)}</div>
        <div style={sub}>orçado</div>
      </div>
      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: fs }}>
        <div style={{ color: v.agregado > 0.005 ? PLAN : CINZA }}>{v.agregado > 0.005 ? fmtMoeda(v.agregado) : '—'}</div>
        {v.agregado > 0.005 && v.orcado > 0 && <div style={sub}>{fmtP((v.agregado / v.orcado) * 100)} do orçado</div>}
      </div>
      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: fs }}>
        <div>{v.custo > 0.005 ? fmtMoeda(v.custo) : '—'}</div>
        {v.custo > 0.005 && <div style={sub}>pago {fmtMoeda(v.pago || 0)}</div>}
        {v.a_pagar > 0.005 && <div style={{ ...sub, color: AMBAR }}>a pagar {fmtMoeda(v.a_pagar)}</div>}
      </div>
      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: fs, color: pv == null ? CINZA : pv > 100 ? VERMELHO : undefined }}
           title={pv == null ? 'Sem custo' : tituloPercOrcado(v.pago, v.a_pagar, v.orcado)}>
        {fmtPercOrcado(pv)}
      </div>
      {neutroVerba ? <NeutroVerba v={v} fs={fs} /> : <BarraEstouro v={v} fs={fs} />}
    </>
  )
}

export default function CustoPorGrupo({ semana }) {
  const [p, setP] = useState(null)
  const [erro, setErro] = useState(null)
  const [grupoAberto, setGrupoAberto] = useState(null)
  const [itemAberto, setItemAberto] = useState(null)

  useEffect(() => {
    setP(null); setErro(null); setGrupoAberto(null); setItemAberto(null)
    fetch(`/api/painel?semana=${semana}&detalhe=1`).then((r) => r.json())
      .then((j) => (j.error ? setErro(j.message || j.error) : setP(j))).catch((e) => setErro(e.message))
  }, [semana])

  // grupos 1 a 18, com todas as linhas nas somas
  const grupos = []
  if (p) {
    const mapa = new Map()
    p.linhas.forEach((i) => {
      if (!mapa.has(i.grupo_num)) mapa.set(i.grupo_num, { grupo: i.grupo_num, nome: i.grupo_nome, itens: [] })
      mapa.get(i.grupo_num).itens.push(i)
    })
    Array.from(mapa.values()).sort((a, b) => a.grupo - b.grupo).forEach((g) => {
      const t = somar(g.itens)
      const ini = Math.min(...g.itens.map((i) => i.semana_inicio || 999))
      const fim = Math.max(...g.itens.map((i) => i.semana_fim || 0))
      grupos.push({ ...g, ...t, mes_inicio: ini < 999 ? mesDaSemana(ini) : null, mes_fim: fim > 0 ? mesDaSemana(fim) : null })
    })
  }
  const tot = p ? somar(p.linhas) : null

  return (
    <div className="card">
      <div className="card-title">Custo direto por grupo — valor agregado × custo até {S2(semana)}</div>
      <div style={{ fontSize: 11, color: CINZA, margin: '-6px 0 10px' }}>
        Valor agregado pela mesma regra do card (inclusive compra antecipada; material de forma pela verba única) · custo = pago + a pagar · estouro /
        economia = custo − valor agregado: positivo (vermelho) custou mais que o orçado pelo que foi executado, negativo
        (verde) custou menos; o % é sobre o valor agregado
      </div>
      {erro && <div className="kpi-sub">Não foi possível carregar: {erro}</div>}
      {!p && !erro && <div className="loading">Somando os lançamentos da semana...</div>}
      {p && <ResumoVerbaForma v={p.totais.verba_forma} />}
      <div style={{ display: 'grid', gridTemplateColumns: GRUPO_COLS, gap: 12, padding: '0 4px 6px', fontFamily: 'var(--mono)',
                    fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: CINZA, borderBottom: '1px solid var(--border)' }}>
        <span />
        <span>Grupo</span>
        <span style={{ textAlign: 'right' }}>Orçado</span>
        <span style={{ textAlign: 'right' }}>Valor agregado</span>
        <span style={{ textAlign: 'right' }}>Custo (pago + a pagar)</span>
        <span style={{ textAlign: 'right' }} title="(Pago + a pagar) ÷ orçado">% do orçado</span>
        <span style={{ textAlign: 'right' }}>Estouro / economia</span>
        <span />
      </div>
      {grupos.map((g) => {
        const aberto = grupoAberto === g.grupo
        const ritmo = g.plan_valor > 0 ? `ritmo de gasto: ${fmtP((g.pago / g.plan_valor) * 100)} do planejado` : null
        return (
          <div key={g.grupo} style={{ borderBottom: '1px solid var(--border)' }}>
            <div onClick={() => { setGrupoAberto(aberto ? null : g.grupo); setItemAberto(null) }}
                 style={{ display: 'grid', gridTemplateColumns: GRUPO_COLS, gap: 12, alignItems: 'center', padding: '14px 4px', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: CINZA, border: '1px solid var(--border2)', borderRadius: 7,
                             padding: '4px 0', textAlign: 'center' }}>{g.grupo}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{g.nome}</div>
                <div style={{ fontSize: 11, color: CINZA, marginTop: 2 }}>
                  {g.itens.filter(linhaVisivel).length} itens{g.mes_inicio ? ` · M${g.mes_inicio}–M${g.mes_fim}` : ''}
                  {ritmo ? ` · ${ritmo}` : ''}
                </div>
              </div>
              <ColunasValorCusto v={g} neutroVerba={g.grupo === 17} />
              <span style={{ color: CINZA, textAlign: 'center' }}>{aberto ? '▴' : '▾'}</span>
            </div>

            {aberto && (
              <table style={{ marginBottom: 10 }}>
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>EAP</th>
                    <th>Descrição</th>
                    <th style={{ textAlign: 'right', width: 120 }}>Orçado</th>
                    <th style={{ textAlign: 'right', width: 130 }}
                        title="Mesma regra do card de valor agregado: % executado × orçado; material pelo maior entre o avanço do serviço vinculado e o custo (compra antecipada); locação pelo gasto até o orçado; mão de obra direta e limpeza pelo tempo">
                      Valor agregado
                    </th>
                    <th style={{ textAlign: 'right', width: 120 }}>Pago</th>
                    <th style={{ textAlign: 'right', width: 120 }} title="Contas a pagar do último fechamento (só direto e não recorrente)">A pagar</th>
                    <th style={{ textAlign: 'right', width: 80 }} title="(Pago + a pagar) ÷ orçado da linha. Vermelho acima de 100%">% do orçado</th>
                    <th style={{ textAlign: 'right', width: 130 }}
                        title="(Pago + a pagar) − valor agregado. Positivo = estouro (vermelho), negativo = economia (verde); o % é sobre o valor agregado">
                      Estouro / economia
                    </th>
                    <th style={{ textAlign: 'right', width: 80 }}>Período</th>
                  </tr>
                </thead>
                <tbody>
                  {g.itens.filter(linhaVisivel).map((i) => {
                    const k = `${i.id}`
                    const lanc = i.lancamentos || []
                    const on = itemAberto === k
                    const pv = percDoOrcado(i.pago, i.a_pagar, i.orcado)
                    return (
                      <React.Fragment key={k}>
                        <tr onClick={() => lanc.length && setItemAberto(on ? null : k)} style={{ cursor: lanc.length ? 'pointer' : 'default' }}>
                          <td style={{ fontFamily: 'var(--mono)', color: CINZA }}>{i.codigo_eap}</td>
                          <td>
                            {i.codigo_eap} · {i.descricao} · {rotuloPavimento(i.pavimento, i.codigo_eap)}
                            {i.tipo === 'material' && (
                              <span style={{ color: CINZA, fontSize: 11, marginLeft: 8 }}
                                    title="Linha só de material: não tem medição própria; segue o avanço do serviço vinculado">
                                material · segue {(i.herda_de || []).map((h) => h.codigo_eap).join(' + ')}
                              </span>
                            )}
                            <span style={{ display: 'block', color: CINZA, fontSize: 11 }}>
                              {lanc.length > 0 ? `${on ? '▴' : '▾'} ${lanc.length} lanç.` : '0 lanç.'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: PLAN }}>{i.orcado > 0 ? fmtMoeda(i.orcado) : '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }} title={i.perc_real == null ? '' : `${fmtP(i.perc_real)} executado`}>
                            {i.agregado > 0.005 ? fmtMoeda(i.agregado) : '—'}
                            {i.material_comprado && (
                              <span style={{ display: 'block', fontSize: 10, color: CINZA }}
                                    title="Compra antecipada (material comprado antes da execução): o agregado segue o custo (pago + a pagar, até o orçado)">
                                compra antecipada
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{i.pago > 0.005 ? fmtMoeda(i.pago) : '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: i.a_pagar > 0.005 ? AMBAR : undefined }}>
                            {i.a_pagar > 0.005 ? fmtMoeda(i.a_pagar) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: pv == null ? CINZA : pv > 100 ? VERMELHO : undefined }}
                              title={pv == null ? 'Sem custo' : tituloPercOrcado(i.pago, i.a_pagar, i.orcado)}>
                            {fmtPercOrcado(pv)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Estouro agregado={i.agregado} pago={i.pago} aPagar={i.a_pagar} orcado={i.orcado}
                              neutro={i.material_comprado || i.tipo === 'locacao'} />
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: CINZA }}>
                            {i.semana_inicio ? `M${mesDaSemana(i.semana_inicio)}–M${mesDaSemana(i.semana_fim)}` : ''}
                          </td>
                        </tr>
                        {on && (
                          <tr>
                            <td colSpan={9} style={{ padding: 0 }}>
                              <ListaLancamentos lancamentos={lanc} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
      {tot && (
        <div style={{ display: 'grid', gridTemplateColumns: GRUPO_COLS, gap: 12, alignItems: 'center', padding: '14px 4px',
                      background: 'var(--bg3)', fontWeight: 600 }}>
          <span />
          <div style={{ fontSize: 13 }}>Total do custo direto</div>
          <ColunasValorCusto v={tot} />
          <span />
        </div>
      )}
    </div>
  )
}
