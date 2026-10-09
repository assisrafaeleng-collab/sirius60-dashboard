// Painel "Pontos de atenção" (pedido 14C: mais simples e editável). Abaixo do Diário de ocorrências, recolhido.
// Topo: 4 números. Abas: Atrasadas | Próxima semana | Próximos 30 dias (mesma tabela). Compras só num botão discreto.
// Índice (Hh/un) e nº de equipes editáveis: o término recalcula na hora (lib/pontos-atencao.js calcularTermino);
// "salvar" grava pela /api/pontos-atencao (senha da obra; confirmação na página). Clique na linha = memória de cálculo
// e histórico das alterações. Hooks no topo (erro #310). Nada inventado: campo vazio em amarelo para preencher.
import React, { useEffect, useState } from 'react'
import { fmtP1, CORES_VA } from '../lib/constants'
import { calcularTermino } from '../lib/pontos-atencao'
import { fetchComSenhaSemJanela, temSenha } from '../lib/fetch-com-senha'
import Desbloqueio from './Desbloqueio'

const { estouro: VERMELHO, aPagar: AMBAR, economia: VERDE } = CORES_VA
const CINZA = '#8b919c'
const AMARELO_FUNDO = 'rgba(201,164,92,.18)'
const dm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—')
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—')
const nf = (v, d = 1) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }))
const ORIGEM = { cronograma: 'cronograma', cpu_flats: 'CPU Flats', rafael: 'Rafael', 'rafael-site': 'Rafael (site)' }
const ABAS = [['atrasadas', 'Atrasadas'], ['semana', 'Próxima semana'], ['mes', 'Próximos 30 dias']]
const inp = (pend) => ({ width: 70, padding: '3px 6px', fontFamily: 'var(--mono)', fontSize: 12, background: pend ? AMARELO_FUNDO : undefined })
const btnMini = { fontSize: 10, padding: '1px 6px' }
const ixTxt = (v) => String(Number(Number(v).toFixed(4))).replace('.', ',')   // até 4 casas, sem zeros à direita
const num = { textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, whiteSpace: 'nowrap' }
const diasUt = (n) => `${n} dia${n === 1 ? '' : 's'} út${n === 1 ? 'il' : 'eis'}`

export default function PontosAtencao({ semana }) {
  const [aberto, setAberto] = useState(false)
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)
  const [aba, setAba] = useState('atrasadas')
  const [verCompras, setVerCompras] = useState(false)
  const [linhaAberta, setLinhaAberta] = useState(null)
  const [edit, setEdit] = useState({})             // { id: { indice, equipes, oficiais, ajudantes, funcao } } — só na tela
  const [confirmar, setConfirmar] = useState(null) // { id, campo, valor, texto }
  const [pedirSenha, setPedirSenha] = useState(false)
  const [quem, setQuem] = useState('')
  const [msg, setMsg] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!aberto) return
    setErro(null)
    fetch(`/api/pontos-atencao?semana=${semana}`).then((r) => r.json())
      .then((j) => (j.error ? setErro(j.message || j.error) : setD(j))).catch((e) => setErro(e.message))
  }, [aberto, semana, recarga])

  const ed = (id) => edit[id] || {}
  const setCampo = (id, campo, v) => setEdit((e) => ({ ...e, [id]: { ...(e[id] || {}), [campo]: v } }))
  const limpar = (id, campos) => setEdit((e) => { const x = { ...(e[id] || {}) }; campos.forEach((c) => delete x[c]); return { ...e, [id]: x } })

  // valores efetivos (edição na tela > salvo > sugerido) e o término recalculado
  const calc = (a) => {
    const e = ed(a.id)
    const mudouIx = e.indice !== undefined && e.indice !== ''
    const pessoas = e.oficiais !== undefined || e.ajudantes !== undefined
      ? (Number(e.oficiais) || 0) + (Number(e.ajudantes) || 0) : a.equipe ? a.equipe.pessoas : null
    const equipes = e.equipes !== undefined && e.equipes !== '' ? e.equipes : a.equipes_definidas
    return calcularTermino({ quantidade: a.quantidade, real: a.real, indice: mudouIx ? e.indice : a.indice,
      horasTotal: mudouIx ? null : a.horas_total, pessoas, equipes, fimCrono: a.fim_crono, hoje: d.hoje, jornada: d.jornada, feriados: d.feriados })
  }

  async function gravar() {
    const c = confirmar
    if (!temSenha()) { setPedirSenha(true); return }
    const r = await fetchComSenhaSemJanela('/api/pontos-atencao', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orcamento_id: c.id, campo: c.campo, valor: c.valor, quem }) })
    if (r.status === 401) { setPedirSenha(true); return }
    const j = await r.json()
    if (!r.ok) { setMsg({ tipo: 'err', txt: j.error || 'Falha ao gravar' }); setConfirmar(null); return }
    setMsg({ tipo: 'ok', txt: 'Gravado.' }); setConfirmar(null)
    limpar(c.id, c.campo === 'equipe' ? ['oficiais', 'ajudantes', 'funcao'] : [c.campo])
    setRecarga((x) => x + 1)
  }

  const lista = !d ? [] : d.atividades.filter((a) => (aba === 'atrasadas' ? a.atrasada : aba === 'semana' ? a.na_semana : a.em_30))
  const em6m = d ? new Date(Date.parse(d.hoje) + 183 * 864e5).toISOString().slice(0, 10) : null
  const alertasCompra = d ? d.compras.filter((c) => c.pedir_ate && c.pedir_ate <= em6m) : []
  const numero = (l, v, cor) => (
    <div key={l} className="kpi" style={{ flex: 1, minWidth: 150 }}>
      <div className="kpi-label">{l}</div>
      <div className="kpi-value" style={{ fontSize: 22, color: cor }}>{v}</div>
    </div>
  )

  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setAberto(!aberto)}>
        <span>Pontos de atenção</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="kpi-sub">{d ? `${d.topo.atrasadas} atrasadas · ${d.topo.equipes} equipes sugeridas` : aberto ? 'carregando…' : `a partir da S${semana}`}</span>
          <span style={{ color: 'var(--text3)', fontSize: 11 }}>{aberto ? '▲' : '▼'}</span>
        </span>
      </div>
      {aberto && (erro ? <div className="kpi-sub">Não foi possível carregar: {erro}</div> : !d ? <div className="loading">Analisando…</div> : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            {numero('Atrasadas', d.topo.atrasadas, d.topo.atrasadas ? VERMELHO : undefined)}
            {numero('A executar na semana', d.topo.semana)}
            {numero('A executar em 30 dias', d.topo.mes)}
            {numero('Equipes sugeridas (30 dias)', d.topo.equipes)}
          </div>
          <div className="kpi-sub" style={{ marginBottom: 10 }}>
            Hoje = fim da S{d.semana} ({dmy(d.hoje)}) · jornada {nf(d.jornada.horas_dia, 0)} h/dia, seg–sex
            {!d.configurado.indices && <span style={{ color: AMBAR }}> · configure as tabelas (SQL do planejamento) para ver índices e equipes</span>}
            {d.configurado.indices && !d.configurado.edicao && <span style={{ color: AMBAR }}> · para salvar pelo site, rode o SQL 2 do planejamento</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {ABAS.map(([v, l]) => (
              <button key={v} className="btn-sm" onClick={() => setAba(v)} style={aba === v ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}>{l}</button>
            ))}
            <span style={{ flex: 1 }} />
            <button className="btn-sm" onClick={() => setVerCompras((x) => !x)} style={{ color: CINZA }}>
              Compras {verCompras ? '▾' : '▸'}{alertasCompra.length > 0 && <span style={{ color: AMBAR }}> {alertasCompra.length} vence{alertasCompra.length === 1 ? '' : 'm'} em 6 meses</span>}
            </button>
          </div>

          {verCompras && (
            <table style={{ marginBottom: 14 }}>
              <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Planejado</th><th style={{ textAlign: 'right' }}>Projetado</th><th style={{ textAlign: 'right' }}>Pedir até</th></tr></thead>
              <tbody>
                {d.compras.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12 }}><span style={{ fontFamily: 'var(--mono)', color: CINZA }}>{c.codigo_eap}</span> {c.descricao} <span style={{ color: CINZA }}>{c.pavimento}</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: CINZA }}>{c.regra === 'ultimo_mes' ? c.planejado.slice(5, 7) + '/' + c.planejado.slice(0, 4) : dmy(c.planejado)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11 }}>{c.regra === 'ultimo_mes' ? c.necessidade.slice(5, 7) + '/' + c.necessidade.slice(0, 4) : dmy(c.necessidade)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: c.status === 'vencido' ? VERMELHO : c.pedir_ate && c.pedir_ate <= em6m ? AMBAR : undefined }}>
                      {c.regra === 'ultimo_mes' ? 'no último mês' : c.pedir_ate ? dmy(c.pedir_ate) : 'prazo pendente'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pedirSenha && <Desbloqueio onLiberar={(q) => { setQuem(q || ''); setPedirSenha(false); setMsg({ tipo: 'ok', txt: 'Liberado. Clique em Gravar.' }) }} />}
          {confirmar && !pedirSenha && (
            <div className="toast" style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{confirmar.texto}</span>
              <button className="btn-primary" onClick={gravar}>Gravar</button>
              <button className="btn-sm" onClick={() => setConfirmar(null)}>Cancelar</button>
            </div>
          )}
          {msg && <div className={'toast ' + (msg.tipo === 'err' ? 'toast-err' : '')} style={{ marginBottom: 10 }} onClick={() => setMsg(null)}>{msg.txt}</div>}

          {lista.length === 0 ? <div className="kpi-sub">Nada nesta aba.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th style={{ textAlign: 'right' }}>Quantidade</th>
                    <th style={{ textAlign: 'right' }}>% concluído</th>
                    <th style={{ textAlign: 'right' }}>% planejado</th>
                    <th style={{ textAlign: 'right' }}>Desvio</th>
                    <th style={{ textAlign: 'right' }}>Falta</th>
                    <th style={{ textAlign: 'right' }}>Índice (Hh/un)</th>
                    <th style={{ textAlign: 'right' }}>Equipes</th>
                    <th>Término</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => {
                    const e = ed(a.id)
                    const t = calc(a)
                    const desvio = a.real - a.plan_hoje
                    const faltaQtd = (Math.max(100 - a.real, 0) / 100) * a.quantidade
                    const semIndice = a.indice == null && a.horas_total == null
                    const semEquipe = !a.equipe
                    const mudouEq = e.equipes !== undefined
                    const mudouIx = e.indice !== undefined
                    const on = linhaAberta === a.id
                    return (
                      <React.Fragment key={a.id}>
                        <tr>
                          <td style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => setLinhaAberta(on ? null : a.id)} title="Ver memória de cálculo e alterações">
                            <span style={{ color: CINZA, marginRight: 4 }}>{on ? '▾' : '▸'}</span>
                            <span style={{ fontFamily: 'var(--mono)', color: CINZA }}>{a.codigo_eap}</span> {a.descricao.length > 46 ? a.descricao.slice(0, 44) + '…' : a.descricao}
                            <span style={{ color: CINZA }}> · {a.pavimento}</span>
                          </td>
                          <td style={num}>{nf(a.quantidade, 1)} {a.unidade}</td>
                          <td style={num}>{fmtP1(a.real)}</td>
                          <td style={num}>{fmtP1(a.plan_hoje)}</td>
                          <td style={{ ...num, color: desvio < -0.05 ? VERMELHO : desvio > 0.05 ? VERDE : CINZA }}>
                            {(desvio > 0 ? '+' : '') + nf(desvio, 1)} p.p.
                          </td>
                          <td style={num}>
                            {nf(faltaQtd, 1)} {a.unidade}<div style={{ color: CINZA }}>{t.horas == null ? '—' : `${nf(t.horas, 0)} Hh`}</div>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 11 }}>
                            {a.horas_total != null && !mudouIx ? (
                              <span style={{ fontFamily: 'var(--mono)', cursor: 'pointer' }} title="Serviço por duração. Clique para trocar por um índice"
                                    onClick={() => setCampo(a.id, 'indice', '')}>duração {nf(a.horas_total, 0)} Hh</span>
                            ) : (
                              <input type="text" inputMode="decimal" style={inp(semIndice && !mudouIx)} placeholder={semIndice ? 'preencher' : ''}
                                     value={mudouIx ? String(e.indice).replace('.', ',') : a.indice == null ? '' : ixTxt(a.indice)}
                                     onChange={(ev) => setCampo(a.id, 'indice', ev.target.value.replace(',', '.'))} />
                            )}
                            <div style={{ color: CINZA, fontSize: 10 }}>
                              {a.indice_origem ? `sugerido (${ORIGEM[a.indice_origem] || a.indice_origem})` : 'sem índice'}
                              {a.indice_cronograma != null && a.indice_origem !== 'cronograma' ? ` · cronograma ${nf(a.indice_cronograma, 3)}` : ''}
                            </div>
                            {mudouIx && (
                              <div>
                                <button className="btn-sm" style={btnMini} disabled={!(Number(e.indice) > 0)}
                                        onClick={() => setConfirmar({ id: a.id, campo: 'indice', valor: e.indice, texto: `Gravar índice ${nf(e.indice, 4)} Hh/${a.unidade} em ${a.codigo_eap} ${a.pavimento}?` })}>salvar</button>
                                <button className="btn-sm" style={{ ...btnMini, marginLeft: 4 }} onClick={() => limpar(a.id, ['indice'])}>voltar</button>
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 11 }}>
                            {semEquipe ? (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <input type="number" min="0" style={{ ...inp(true), width: 44 }} placeholder="of." title="nº de oficiais"
                                       value={e.oficiais ?? ''} onChange={(ev) => setCampo(a.id, 'oficiais', ev.target.value)} />
                                <input type="number" min="0" style={{ ...inp(true), width: 44 }} placeholder="aj." title="nº de ajudantes"
                                       value={e.ajudantes ?? ''} onChange={(ev) => setCampo(a.id, 'ajudantes', ev.target.value)} />
                                <input type="text" style={{ ...inp(true), width: 90 }} placeholder="função" title="função do oficial"
                                       value={e.funcao ?? ''} onChange={(ev) => setCampo(a.id, 'funcao', ev.target.value)} />
                                {(Number(e.oficiais) || 0) + (Number(e.ajudantes) || 0) > 0 && (
                                  <button className="btn-sm" style={btnMini}
                                          onClick={() => setConfirmar({ id: a.id, campo: 'equipe', valor: { oficiais: Number(e.oficiais) || 0, ajudantes: Number(e.ajudantes) || 0, funcao: e.funcao || '' },
                                            texto: `Gravar equipe ${Number(e.oficiais) || 0} ${e.funcao || 'oficial'} + ${Number(e.ajudantes) || 0} ajudante(s) em ${a.codigo_eap} ${a.pavimento}?` })}>salvar</button>
                                )}
                              </div>
                            ) : (
                              <input type="number" min="1" style={{ ...inp(false), width: 52 }}
                                     value={mudouEq ? e.equipes : t.usadas ?? ''} onChange={(ev) => setCampo(a.id, 'equipes', ev.target.value)} />
                            )}
                            <div style={{ color: CINZA, fontSize: 10 }}>
                              sugerido {t.sugeridas ?? '—'}{a.equipe ? ` · ${a.equipe.composicao}` : ''}
                            </div>
                            {!semEquipe && (mudouEq || a.equipes_definidas != null) && (
                              <div>
                                {mudouEq && Number(e.equipes) > 0 && (
                                  <button className="btn-sm" style={btnMini}
                                          onClick={() => setConfirmar({ id: a.id, campo: 'equipes', valor: Number(e.equipes), texto: `Gravar ${e.equipes} equipe(s) em ${a.codigo_eap} ${a.pavimento}?` })}>salvar</button>
                                )}
                                <button className="btn-sm" style={{ ...btnMini, marginLeft: 4 }}
                                        onClick={() => (a.equipes_definidas != null
                                          ? setConfirmar({ id: a.id, campo: 'equipes', valor: null, texto: `Voltar ${a.codigo_eap} ${a.pavimento} ao número sugerido de equipes (apaga o valor salvo)?` })
                                          : limpar(a.id, ['equipes']))}>voltar ao sugerido</button>
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: 11 }}>
                            {t.termino ? (
                              <>
                                <span>com {t.usadas} equipe{t.usadas === 1 ? '' : 's'} termina em <b>{dm(t.termino)}</b> ({diasUt(t.dias)})</span>
                                <div style={{ color: t.cumpre ? VERDE : VERMELHO }}>
                                  cronograma: {dm(a.fim_crono)} · {t.cumpre ? 'cumpre' : `atrasa ${diasUt(t.atrasa)}`}
                                </div>
                              </>
                            ) : <span style={{ color: AMBAR }}>preencha {semIndice ? 'o índice' : ''}{semIndice && semEquipe ? ' e ' : ''}{semEquipe ? 'a equipe' : ''}</span>}
                          </td>
                        </tr>
                        {on && (
                          <tr>
                            <td colSpan={9} style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg)', lineHeight: 1.7 }}>
                              <b>Memória de cálculo</b> · horas que faltam = (100% − {fmtP1(a.real)}) × {a.horas_total != null && !mudouIx ? `${nf(a.horas_total, 0)} Hh (duração)` : `${nf(a.quantidade, 1)} ${a.unidade} × índice`}
                              {' '}= {nf(t.horas, 0)} Hh · 1 equipe = {t.capacidade_dia ?? '—'} Hh/dia · data-alvo {dmy(t.alvo)}
                              ({t.dias_ate_alvo} dias úteis) · sugerido {t.sugeridas ?? '—'} equipe(s)
                              <br />Em 30 dias: manter o ritmo {nf(a.mes.horas_ritmo, 0)} Hh · recuperar o atraso {nf(a.mes.horas_atraso, 0)} Hh
                              · o cronograma previa {nf(a.mes.horas_previstas, 0)} Hh · horas da linha no orçamento {nf(a.hh, 1)} Hh
                              {a.cronograma_curto && <> · <span style={{ color: AMBAR }}>cronograma curto: prevê {nf(a.cronograma_curto.horas_cronograma, 0)} h, pelo índice são {nf(a.cronograma_curto.horas_indice, 0)} h</span></>}
                              {a.insumos && a.insumos.length > 0 && <><br />Materiais em 30 dias: {a.insumos.map((m) => `${m.codigo_eap} ${nf(m.qtd_30d, 1)} ${m.unidade}${m.alerta ? ' (' + m.alerta + ')' : ''}`).join(' · ')}</>}
                              <br /><b>Alterações</b>: {a.historico && a.historico.length
                                ? a.historico.map((h, i) => <span key={i}>{i ? ' · ' : ''}{dmy(String(h.editado_em).slice(0, 10))} {h.editado_por || '—'}: {h.campo} {h.valor_anterior ?? '—'} → {h.valor_novo ?? 'sugerido'}</span>)
                                : 'nenhuma'}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ))}
    </div>
  )
}
