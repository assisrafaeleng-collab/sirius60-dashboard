// Painel "Pontos de atenção — próxima semana e próximos 30 dias" (pedido 14B), logo abaixo do Diário de ocorrências,
// no mesmo estilo (recolhido; abre ao clicar). Dados da /api/pontos-atencao (lib/pontos-atencao.js). Hooks no topo.
// Regra de ouro: índice, equipe ou prazo que falta aparece como "dado pendente" (nada inventado).
import React, { useEffect, useState } from 'react'
import { fmtMoeda2, fmtP1, CORES_VA } from '../lib/constants'

const { estouro: VERMELHO, aPagar: AMBAR, economia: VERDE } = CORES_VA
const CINZA = '#8b919c'
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—')
const nf = (v, d = 1) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }))
const COR_ST = { ATRASADA: VERMELHO, 'A INICIAR': AMBAR, 'EM DIA': CINZA, ADIANTADA: VERDE }
const COR_COMPRA = { vencido: VERMELHO, 'vence na próxima semana': AMBAR, 'vence em 30 dias': AMBAR, 'prazo pendente': CINZA, 'no prazo': CINZA }
const DIAS = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sáb', 7: 'dom' }
const pendente = <span style={{ color: AMBAR, fontSize: 11 }}>dado pendente</span>

export default function PontosAtencao({ semana }) {
  const [aberto, setAberto] = useState(false)
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)
  const [hz, setHz] = useState('semana')          // semana | mes
  const [verPend, setVerPend] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setD(null); setErro(null)
    fetch(`/api/pontos-atencao?semana=${semana}`).then((r) => r.json())
      .then((j) => (j.error ? setErro(j.message || j.error) : setD(j))).catch((e) => setErro(e.message))
  }, [aberto, semana])

  const faltaConfig = d ? Object.entries(d.configurado).filter(([, v]) => !v).map(([k]) => k) : []
  const lista = d ? d.atividades.filter((a) => (hz === 'semana' ? a.no_h1 : true)) : []
  const jornadaTxt = d ? `${nf(d.jornada.horas_dia, 0)} h/dia, ${d.jornada.dias_semana.map((x) => DIAS[x]).join('–').replace('seg–ter–qua–qui–sex', 'seg–sex')}` : ''

  const Resumo = ({ r }) => (
    <div className="kpi" style={{ flex: 1, minWidth: 260 }}>
      <div className="kpi-label">{r.rotulo} · {dmy(r.de)} a {dmy(r.ate)} · {r.dias_uteis} dias úteis</div>
      <div style={{ fontSize: 13, lineHeight: 1.7, marginTop: 6 }}>
        <div><b style={{ color: r.atrasadas ? VERMELHO : undefined }}>{r.atrasadas} atrasada{r.atrasadas === 1 ? '' : 's'}</b> · {r.a_iniciar} a iniciar · {r.atividades} atividades</div>
        <div>Horas: manter o ritmo {nf(r.horas_ritmo, 0)} h + recuperar o atraso {nf(r.horas_atraso, 0)} h = <b>{nf(r.horas_necessarias, 0)} h</b>
          {r.horas_sem_indice > 0 && <span style={{ color: AMBAR, fontSize: 11 }}> · {r.horas_sem_indice} sem índice</span>}
          <span style={{ color: CINZA, fontSize: 11 }}> (cronograma previa {nf(r.horas_previstas, 0)} h)</span></div>
        <div>Equipes: ritmo {r.equipes_ritmo} + atraso {r.equipes_atraso} → <b>{r.equipes} sugeridas</b>{r.sem_equipe > 0 && <span style={{ color: AMBAR, fontSize: 11 }}> + {r.sem_equipe} sem equipe (pendente)</span>}</div>
        <div>Desembolso previsto {r.desembolso == null ? '—' : fmtMoeda2(r.desembolso)}</div>
        <div>Compras: <span style={{ color: r.compras_vencidas ? VERMELHO : undefined }}>{r.compras_vencidas} vencida{r.compras_vencidas === 1 ? '' : 's'}</span> · {r.compras_no_periodo} a pedir no período</div>
      </div>
    </div>
  )

  const h = (a) => a[hz]
  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setAberto(!aberto)}>
        <span>Pontos de atenção — próxima semana e próximos 30 dias</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="kpi-sub">{d ? `${d.resumo.mes.atrasadas} atrasadas · ${d.compras.filter((c) => c.status === 'vencido').length} compras vencidas` : aberto ? 'carregando…' : `a partir da S${semana}`}</span>
          <span style={{ color: 'var(--text3)', fontSize: 11 }}>{aberto ? '▲' : '▼'}</span>
        </span>
      </div>
      {aberto && (erro ? <div className="kpi-sub">Não foi possível carregar: {erro}</div> : !d ? <div className="loading">Analisando o horizonte…</div> : (
        <>
          <div className="kpi-sub" style={{ marginBottom: 10 }}>
            Hoje = fim da S{d.semana} ({dmy(d.hoje)}) · jornada: {jornadaTxt} · {d.configurado.feriados ? 'feriados da tabela' : 'feriados nacionais e de Mariana'}
            {faltaConfig.length > 0 && <span style={{ color: AMBAR }}> · configure as tabelas ({faltaConfig.join(', ')}): sem elas índices, equipes e prazos ficam pendentes</span>}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
            <Resumo r={d.resumo.semana} /><Resumo r={d.resumo.mes} />
          </div>

          <div className="btn-row" style={{ marginBottom: 10 }}>
            {[['semana', 'Próxima semana'], ['mes', 'Próximos 30 dias']].map(([v, l]) => (
              <button key={v} className="btn-sm" onClick={() => setHz(v)} style={hz === v ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}>{l}</button>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Atividade</th>
                  <th style={{ textAlign: 'right' }} title="Realizado (última medição) · planejado hoje · planejado no fim do horizonte">Real · hoje · fim</th>
                  <th style={{ textAlign: 'right' }} title="O que o cronograma prevê dentro do período (planejado no fim − hoje)">Manter o ritmo</th>
                  <th style={{ textAlign: 'right' }} title="Atraso de hoje (planejado − realizado) diluído em 30 dias; na próxima semana, a fração dos dias úteis">Recuperar atraso</th>
                  <th style={{ textAlign: 'right' }} title="Hh por unidade: cronograma (atividade = uma linha) ou CPU do Flats (atividade agrupada)">Índice</th>
                  <th>Equipe padrão</th>
                  <th style={{ textAlign: 'right' }} title="Manter o ritmo + recuperar o atraso; equipes para o total (e para concluir no horizonte)">Total sugerido</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <React.Fragment key={a.id}>
                    <tr>
                      <td style={{ fontSize: 12 }}>
                        <span style={{ fontFamily: 'var(--mono)', color: CINZA }}>{a.codigo_eap}</span> {a.descricao}
                        <span style={{ color: CINZA }}> · {a.pavimento}</span>
                        <div style={{ font: "600 10px 'IBM Plex Mono', monospace", color: COR_ST[a.status], letterSpacing: '.06em' }}>
                          {a.status}{a.atraso_horas > 0 ? ` · ${nf(a.atraso_horas, 0)} h de atraso` : ''}
                        </div>
                        {a.cronograma_curto && (
                          <div style={{ fontSize: 10, color: AMBAR }}>
                            o cronograma prevê {nf(a.cronograma_curto.horas_cronograma, 0)} h; pelo índice real são {nf(a.cronograma_curto.horas_indice, 0)} h
                            (+{nf(a.cronograma_curto.excesso_pct, 0)}%) — conferir duração
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11 }}>{fmtP1(a.real)} · {fmtP1(a.plan_hoje)} · {fmtP1(h(a).plan_fim)}</td>
                      {[['ritmo', 'qtd_ritmo', 'horas_ritmo', 'equipes_ritmo'], ['atraso', 'qtd_atraso', 'horas_atraso', 'equipes_atraso']].map(([p, qd, hr, eqs]) => (
                        <td key={p} style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11 }}>
                          {fmtP1(h(a)[p])}<div style={{ color: CINZA }}>{nf(h(a)[qd], 1)} {a.unidade} · {h(a)[hr] == null ? pendente : `${nf(h(a)[hr], 0)} Hh`}
                            {h(a)[eqs] != null && ` · ${h(a)[eqs]} eq.`}</div>
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11 }}
                          title={a.indice_cronograma != null ? `pelo cronograma: ${nf(a.indice_cronograma, 4)} Hh/${a.unidade}` : ''}>
                        {a.horas_total != null ? <>duração · {nf(a.horas_total, 0)} Hh</>
                          : a.indice == null ? pendente : <>{nf(a.indice, 4)} Hh/{a.unidade}</>}
                        <div style={{ color: a.conferir ? AMBAR : CINZA, fontSize: 10 }}>
                          {({ cpu_flats: 'CPU Flats', rafael: 'Rafael', cronograma: 'cronograma' })[a.indice_origem] || ''}{a.conferir ? ` · conferir (crono ${nf(a.indice_cronograma, 4)})` : ''}
                        </div>
                      </td>
                      <td style={{ fontSize: 11 }}>{a.equipe ? <>{a.equipe.composicao}<div style={{ color: CINZA }}>{a.equipe.pessoas} pessoas</div></> : pendente}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {h(a).horas == null ? pendente : <>{nf(h(a).horas, 0)} Hh</>}
                        <div>{h(a).equipes_total == null ? pendente : <><b>{h(a).equipes_total}</b> equipe{h(a).equipes_total === 1 ? '' : 's'}</>}</div>
                        <div style={{ color: CINZA, fontSize: 10 }}>concluir: {h(a).horas_concluir == null ? '—' : `${nf(h(a).horas_concluir, 0)} Hh · ${h(a).equipes_concluir ?? '—'} eq.`}</div>
                      </td>
                    </tr>
                    {a.insumos.length > 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '0 0 8px 24px', fontSize: 11, color: CINZA }}>
                          {a.insumos.map((m) => (
                            <span key={m.id} style={{ marginRight: 16 }}>
                              {m.codigo_eap} {m.descricao.slice(0, 40)}: {nf(m.qtd_30d, 1)} {m.unidade} em 30 dias
                              {m.alerta && <b style={{ color: AMBAR }}> · {m.alerta}</b>}
                            </span>
                          ))}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-title" style={{ marginTop: 18 }}>Compras de prazo longo — obra toda</div>
          <div className="kpi-sub" style={{ marginBottom: 8 }}>
            Data projetada = início planejado {d.adiantamento
              ? `${d.adiantamento.dias >= 0 ? 'adiantado' : 'atrasado'} ${Math.abs(d.adiantamento.dias)} dias (adiantamento da obra: ${nf(d.adiantamento.semanas, 1)} semanas, medição da S${d.adiantamento.semMed})`
              : 'sem deslocamento (sem medição)'} · pedir até = projetada − antecedência; recalcula a cada medição
          </div>
          {d.compras.length === 0 ? <div className="kpi-sub">Sem itens cadastrados (tabela insumo_prazo_entrega).</div> : (
            <table>
              <thead><tr><th>Item</th><th>Categoria</th><th style={{ textAlign: 'right' }}>Planejado</th><th style={{ textAlign: 'right' }}>Projetado</th><th style={{ textAlign: 'right' }}>Pedir até</th><th>Situação</th></tr></thead>
              <tbody>
                {d.compras.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12 }}><span style={{ fontFamily: 'var(--mono)', color: CINZA }}>{c.codigo_eap}</span> {c.descricao} <span style={{ color: CINZA }}>{c.pavimento}</span></td>
                    <td style={{ fontSize: 11 }}>{c.categoria}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: CINZA }}>{c.regra === 'ultimo_mes' ? `${c.planejado.slice(5, 7)}/${c.planejado.slice(0, 4)}` : dmy(c.planejado)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11 }}>{c.regra === 'ultimo_mes' ? `${c.necessidade.slice(5, 7)}/${c.necessidade.slice(0, 4)}` : dmy(c.necessidade)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11 }}>{c.regra === 'ultimo_mes' ? `comprar/instalar em ${c.necessidade.slice(5, 7)}/${c.necessidade.slice(0, 4)}` : dmy(c.pedir_ate)}</td>
                    <td style={{ fontSize: 11, color: COR_COMPRA[c.status] }}>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 14 }}>
            <button className="btn-sm" onClick={() => setVerPend((v) => !v)}>{verPend ? '▴' : '▾'} Dados pendentes ({d.pendencias.length})</button>
            {verPend && (
              <ul style={{ fontSize: 11, color: 'var(--text2)', marginTop: 8, columns: 2 }}>
                {d.pendencias.map((p, i) => <li key={i}><b>{p.tipo}</b> · {p.linha}: {p.dado}</li>)}
              </ul>
            )}
          </div>
        </>
      ))}
    </div>
  )
}
