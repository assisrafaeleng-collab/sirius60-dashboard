import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect, useMemo, useState } from 'react'
import { OBRA, fmtMoeda2 as fmtMoeda, fmtP1 as fmtP, semanaLabel, semanaAtualObra, semanasPorMes, rotuloPavimento } from '../lib/constants'
import { datasDaSemana } from '../lib/calendario'
import { PLAN, VERDE, VERMELHO, AMBAR, MONO, dir, PercOrcado, Estouro, Saldo, somar, ResumoVerbaForma } from '../components/ValorCusto'

// Memória de cálculo do valor agregado (pedido 13C): layout, cores, formato e textos da /valor-agregado do Flats.
// Uma tabela única, grupo → linhas (código + pavimento). Números da /api/painel (lib/valor-agregado.js):
//   serviço = % medido × orçado · material = maior entre o % do serviço vinculado × orçado e o custo até o orçado
//   locação (17) = gasto até a verba · limpeza/EPI (1.1.6) e mão de obra direta (18) = tempo decorrido da obra
const s2 = (n) => `S${String(n).padStart(2, '0')}`
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '')

// Código, serviço, pavimento, orçado, % físico, medido, valor agregado, pago, a pagar, % do orçado,
// estouro / economia, saldo da verba. Larguras do Flats (cabe na tela sem rolagem e o serviço quebra em linhas);
// PAV. em 11px cabe "Reservatório"; ORÇADO e SALDO cabem o total de 7 milhões; MEDIDO quebra (herda 6.1.1.1/6.1.1).
const COLS = '62px minmax(0,1fr) 64px 108px 50px 70px 104px 100px 96px 54px 110px 108px'

// Só em tela pequena a tabela rola para o lado; aí CÓDIGO e SERVIÇO ficam fixos (sticky à esquerda)
const CSS_ROLAGEM = `
.va-rolagem { overflow-x: visible; }
@media (max-width: 900px) {
  .va-rolagem { overflow-x: auto; } .va-tabela { min-width: 1080px; }
  .va-fixa { position: sticky; z-index: 2; } .va-fixa-0 { left: 0; }
  .va-fixa-1 { left: 70px; box-shadow: 6px 0 6px -6px rgba(0,0,0,.6); }
}
`
const FIXAS = 2   // CÓDIGO e SERVIÇO; a segunda fica a 70px (62px do código + 8px de espaço)
function Linha({ children, cabecalho, destaque, onClick, title }) {
  const fundo = destaque ? 'var(--bg3)' : 'var(--bg2)'
  return (
    <div onClick={onClick} title={title}
      style={{
        cursor: onClick ? 'pointer' : 'default', display: 'grid', gridTemplateColumns: COLS, gap: 8,
        padding: '7px 0', borderBottom: '1px solid var(--border)',
        font: cabecalho ? MONO : "500 12px 'IBM Plex Sans'", textTransform: cabecalho ? 'uppercase' : 'none',
        letterSpacing: cabecalho ? '.08em' : 0, color: cabecalho ? 'var(--text2)' : 'var(--text)',
        background: fundo, alignItems: 'center',
        ...(cabecalho ? { position: 'sticky', top: 0, zIndex: 3 } : {}),
      }}>
      {React.Children.map(children, (c, n) => (n < FIXAS && React.isValidElement(c)
        ? React.cloneElement(c, { className: `va-fixa va-fixa-${n}`, style: { ...(c.props.style || {}),
            background: fundo, alignSelf: 'stretch', display: 'flex', alignItems: 'center', minWidth: 0, overflowWrap: 'anywhere' } })
        : c))}
    </div>
  )
}

// Subtotal de grupo ou total: todas as colunas somadas
function LinhaTotal({ codigo, nome, t, forte, onClick, aberto, title }) {
  const w = forte ? 600 : 500
  const semExec = !(t.agregado > 0.005)
  return (
    <Linha destaque onClick={onClick} title={title}>
      <div style={{ fontWeight: w }}>
        {onClick && <span style={{ color: 'var(--text2)', marginRight: 6 }}>{aberto ? '▾' : '▸'}</span>}
        {codigo}
      </div>
      <div style={{ fontWeight: w, textTransform: 'uppercase' }}>{nome}</div>
      <div />
      <div style={{ ...dir, fontWeight: w }}>{fmtMoeda(t.orcado)}</div>
      <div style={{ ...dir, fontWeight: w }}>{semExec || !(t.orcado > 0) ? '—' : fmtP((t.agregado / t.orcado) * 100)}</div>
      <div />
      <div style={{ ...dir, fontWeight: w, color: semExec ? 'var(--text2)' : PLAN }}>{semExec ? '—' : fmtMoeda(t.agregado)}</div>
      <div style={{ ...dir, fontWeight: w }}>{t.pago > 0.005 ? fmtMoeda(t.pago) : '—'}</div>
      <div style={{ ...dir, fontWeight: w, color: t.a_pagar > 0.005 ? AMBAR : 'var(--text2)' }}>
        {t.a_pagar > 0.005 ? fmtMoeda(t.a_pagar) : '—'}
      </div>
      <PercOrcado orcado={t.orcado} pago={t.pago} aPagar={t.a_pagar} peso={w} />
      <Estouro agregado={t.agregado} pago={t.pago} aPagar={t.a_pagar} peso={w} orcado={t.orcado} />
      <Saldo orcado={t.orcado} pago={t.pago} aPagar={t.a_pagar} peso={w} />
    </Linha>
  )
}

const medidoDe = (i) => i.tipo === 'tempo' ? 'tempo'
  : i.tipo === 'locacao' ? 'verba'
  : i.tipo === 'material' ? (i.material_comprado ? 'compra antecipada' : `herda ${(i.herda_de || []).map((h) => h.codigo_eap).join('/')}`)
  : i.semana_medida ? s2(i.semana_medida) : '—'
const tituloMedido = (i) => i.material_comprado
  ? `Compra antecipada (material comprado antes da execução): agregado = custo pago + a pagar, até o orçado. O serviço está em ${fmtP(i.perc_real)}.`
  : i.tipo === 'tempo' ? 'Verba que corre com o tempo: linear pelos dias da obra'
  : i.tipo === 'locacao' ? 'Locação: valor agregado = gasto até a verba'
  : i.verba_forma ? `Verba de forma (material reaproveitado): valor agregado = % de ${(i.herda_de || []).map((h) => `${h.codigo_eap} ${rotuloPavimento(h.pavimento, h.codigo_eap)}`).join(' + ')} × orçado; custo = ${String(i.verba_forma_pct).replace('.', ',')}% do gasto da verba`
  : i.tipo === 'material' ? `Material sem medição própria: usa o % de ${(i.herda_de || []).map((h) => `${h.codigo_eap} ${rotuloPavimento(h.pavimento, h.codigo_eap)}${h.peso < 1 ? ` (peso ${fmtP(h.peso * 100)})` : ''}`).join(' + ')}; ou o custo pago + a pagar até o orçado, se for maior`
  : ''

// Memória de cálculo de uma linha (pedido 14E): regra, de onde veio o %, a conta e o custo. Também vira o CSV.
const ddmm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '')
const pct2 = (v) => (v == null ? '—' : `${Number(v).toFixed(2).replace('.', ',')}%`)
const servicoTxt = (h) => `${h.codigo_eap} ${rotuloPavimento(h.pavimento, h.codigo_eap)} em ${pct2(h.percentual)}` +
  (h.semana_medida ? ` (medição de ${ddmm(h.data_medida) || s2(h.semana_medida)})` : ' (sem medição)') +
  (h.peso < 1 ? ` × peso ${pct2(h.peso * 100)}` : '')
function memoriaDaLinha(i, av) {
  const her = (i.herda_de || []).map(servicoTxt).join(' + ')
  if (i.tipo === 'tempo') return { regra: 'custo de tempo linear', origem: `% do prazo decorrido: ${av.dias_decorridos} de ${av.dias_obra} dias`,
    pct: i.perc_real, conta: `${fmtMoeda(i.orcado)} × ${pct2(i.perc_real)} = ${fmtMoeda(i.agregado)}` }
  if (i.tipo === 'locacao') return { regra: 'verba / locação neutra', origem: 'pago ÷ verba (valor agregado = pago, limitado à verba)',
    pct: i.perc_verba, conta: `mínimo entre pago ${fmtMoeda(i.pago)} e verba ${fmtMoeda(i.orcado)} = ${fmtMoeda(i.agregado)}` }
  if (i.verba_forma) return { regra: 'verba de forma rateada', origem: `serviço vinculado ${her || '—'}`, pct: i.perc_real,
    conta: `${fmtMoeda(i.orcado)} × ${pct2(i.perc_real)} = ${fmtMoeda(i.agregado)} (sem compra antecipada); custo = ` +
      `${String(i.verba_forma_pct).replace('.', ',')}% do gasto da verba de forma` }
  if (i.tipo === 'material') return {
    regra: i.material_comprado ? 'material: compra antecipada' : `material herdado do serviço ${(i.herda_de || []).map((h) => h.codigo_eap).join(' + ')}`,
    origem: `serviço vinculado ${her || '—'}`, pct: i.perc_real,
    conta: i.material_comprado
      ? `maior entre herdado ${fmtMoeda(i.orcado)} × ${pct2(i.perc_real)} = ${fmtMoeda(i.heranca)} e custo até o orçado ${fmtMoeda(Math.min(i.comprometido, i.orcado))} = ${fmtMoeda(i.agregado)}`
      : `${fmtMoeda(i.orcado)} × ${pct2(i.perc_real)} = ${fmtMoeda(i.agregado)} (maior que o custo até o orçado, ${fmtMoeda(Math.min(i.comprometido, i.orcado))})` }
  return { regra: 'serviço por medição',
    origem: i.semana_medida ? `medição de ${ddmm(i.data_medida) || '—'} (${s2(i.semana_medida)})` : 'sem medição (0%)',
    pct: i.perc_real, conta: `${fmtMoeda(i.orcado)} × ${pct2(i.perc_real)} = ${fmtMoeda(i.agregado)}` }
}
function baixarCsv(p, semana) {
  const n = (v) => (Number(v) || 0).toFixed(2).replace('.', ',')
  const q = (t) => `"${String(t == null ? '' : t).replace(/"/g, '""')}"`
  const cab = ['Código', 'Pavimento', 'Descrição', 'Regra', 'Origem do %', '%', 'Orçado', 'Valor agregado', 'Pago', 'A pagar']
  const linhas = p.linhas.map((i) => {
    const m = memoriaDaLinha(i, p.avanco)
    return [q(i.codigo_eap), q(rotuloPavimento(i.pavimento, i.codigo_eap)), q(i.descricao), q(m.regra), q(m.origem),
      m.pct == null ? '' : n(m.pct), n(i.orcado), n(i.agregado), n(i.pago), n(i.a_pagar)].join(';')
  })
  const blob = new Blob(['﻿' + [cab.map(q).join(';'), ...linhas].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `memoria-valor-agregado-${s2(semana)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
function Memoria({ i, av }) {
  const m = memoriaDaLinha(i, av)
  const custo = i.pago + i.a_pagar
  const est = custo - i.agregado
  return (
    <div style={{ padding: '8px 12px 12px 70px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
      font: "500 12px 'IBM Plex Sans'", color: 'var(--text2)', lineHeight: 1.7 }}>
      <div><b style={{ color: 'var(--text)' }}>Regra:</b> {m.regra}</div>
      <div><b style={{ color: 'var(--text)' }}>% usado:</b> {pct2(m.pct)} · {m.origem}</div>
      <div><b style={{ color: 'var(--text)' }}>Valor agregado:</b> {m.conta}</div>
      <div><b style={{ color: 'var(--text)' }}>Custo:</b> pago {fmtMoeda(i.pago)} + a pagar {fmtMoeda(i.a_pagar)} = {fmtMoeda(custo)}
        {' · '}<span style={{ color: Math.abs(est) < 0.005 ? undefined : est > 0 ? VERMELHO : VERDE }}>
          {Math.abs(est) < 0.005 ? 'sem estouro nem economia' : est > 0 ? `estouro ${fmtMoeda(est)}` : `economia ${fmtMoeda(-est)}`}
        </span> (custo − valor agregado)</div>
    </div>
  )
}

export default function ValorAgregado() {
  const router = useRouter()
  const [semana, setSemana] = useState(semanaAtualObra())
  const [p, setP] = useState(null)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState('')
  const [mostrarZerados, setMostrarZerados] = useState(false)
  const [abertos, setAbertos] = useState(() => new Set())   // grupos abertos; começa tudo recolhido
  const [memoria, setMemoria] = useState(null)              // id da linha com a memória aberta (pedido 14E)

  useEffect(() => {
    if (router.query.semana) setSemana(parseInt(router.query.semana) || semanaAtualObra())
  }, [router.query.semana])
  useEffect(() => {
    setP(null); setErro(null)
    fetch(`/api/painel?semana=${semana}`).then((r) => r.json())
      .then((j) => (j.error ? setErro(j.message || j.error) : setP(j))).catch((e) => setErro(e.message))
  }, [semana])

  const grupos = useMemo(() => {
    if (!p) return []
    const termo = busca.trim().toLowerCase()
    const mapa = new Map()
    p.linhas.forEach((i) => {
      if (!mapa.has(i.grupo_num)) mapa.set(i.grupo_num, { grupo: i.grupo_num, nome: i.grupo_nome, todas: [], itens: [], zerados: 0 })
      const g = mapa.get(i.grupo_num)
      g.todas.push(i)                                   // subtotal sempre com todas as linhas
      const custo = i.pago + i.a_pagar
      if (i.orcado <= 0.005 && custo <= 0.005 && i.agregado <= 0.005) return   // linha de título: não aparece
      const casa = !termo || [i.codigo_eap, i.descricao, rotuloPavimento(i.pavimento, i.codigo_eap)].some((x) => String(x || '').toLowerCase().includes(termo))
      if (!casa) return
      // Não iniciado = sem % físico, sem valor agregado, sem pago e sem a pagar: escondido, mas fica no subtotal
      if (i.perc_real > 0 || i.agregado > 0.005 || custo > 0.005 || mostrarZerados) g.itens.push(i)
      else g.zerados += 1
    })
    // Grupo sem nenhum item iniciado (ou sem resultado na busca) também some; o total geral soma todos
    return Array.from(mapa.values()).sort((a, b) => a.grupo - b.grupo).map((g) => ({ ...g, t: somar(g.todas) }))
      .filter((g) => g.itens.length > 0 || (mostrarZerados && !termo))
  }, [p, busca, mostrarZerados])

  const chaves = grupos.map((g) => `g${g.grupo}`)
  const todosAbertos = chaves.length > 0 && chaves.every((k) => abertos.has(k))
  const estaAberto = (k) => !!busca.trim() || abertos.has(k)
  const alternar = (k) => setAbertos((atual) => {
    const novo = new Set(atual)
    if (novo.has(k)) novo.delete(k)
    else novo.add(k)
    return novo
  })

  const pt = p ? p.totais.por_tipo : null
  const total = p ? somar(p.linhas) : null

  return (
    <>
      <Head><title>{'Valor agregado - ' + OBRA.nome}</title></Head>
      <div className="page">
        <div className="header">
          <div className="header-top">
            <div>
              <div className="obra-eye">
                <a onClick={() => router.push('/')} style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>← Visão geral</a>
              </div>
              <div className="obra-nome">Memória de cálculo · Valor agregado</div>
              <div className="obra-info">
                {OBRA.nome} · até {s2(semana)} ({dmy(datasDaSemana(semana).data_fim)}) · serviço executado a preço de orçamento
              </div>
            </div>
            <div className="sel-wrap">
              <div className="sel-lbl">Semana</div>
              <select className="periodo" value={semana} onChange={(e) => setSemana(+e.target.value)}>
                {semanasPorMes().map((g) => (
                  <optgroup key={g.mes} label={g.mes}>
                    {g.semanas.map((s) => <option key={s} value={s}>{semanaLabel(s)}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        </div>

        {erro ? <div className="loading">Erro: {erro}</div>
          : !p ? <div className="loading">Montando a memória de cálculo...</div> : (
          <>
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 18 }}>
              <div className="kpi">
                <div className="kpi-label">Produção · grupos 1–16</div>
                <div className="kpi-value" style={{ fontSize: 20, color: PLAN }}>{fmtMoeda(pt.servico.agregado + pt.material.agregado)}</div>
                <div className="kpi-sub">% medido × orçado da linha (material pelo serviço vinculado)</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Locação · grupo 17</div>
                <div className="kpi-value" style={{ fontSize: 20, color: PLAN }}>{fmtMoeda(pt.locacao.agregado)}</div>
                <div className="kpi-sub">
                  Gasto, limitado ao orçado
                  {pt.locacao.orcado > 0 && (
                    <div style={{ color: pt.locacao.comprometido > pt.locacao.orcado ? VERMELHO : undefined }}>
                      gasto {fmtMoeda(pt.locacao.comprometido)} de {fmtMoeda(pt.locacao.orcado)} · {fmtP((pt.locacao.comprometido / pt.locacao.orcado) * 100)} da verba
                    </div>
                  )}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Mão de obra direta e limpeza · 18 e 1.1.6</div>
                <div className="kpi-value" style={{ fontSize: 20, color: PLAN }}>{fmtMoeda(pt.tempo.agregado)}</div>
                <div className="kpi-sub">Tempo decorrido · {fmtP(p.avanco.fracao_tempo)} da obra</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Valor agregado total</div>
                <div className="kpi-value" style={{ fontSize: 20 }}>{fmtMoeda(p.totais.agregado)}</div>
                <div className="kpi-sub">Produção + locação + mão de obra direta</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Produção — item a item</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código, serviço ou pavimento" style={{ maxWidth: 320 }} />
                <button className="btn-sm" onClick={() => setAbertos(todosAbertos ? new Set() : new Set(chaves))}>
                  {todosAbertos ? 'Recolher todos' : 'Abrir todos'}
                </button>
                <button className="btn-sm" onClick={() => setMostrarZerados((v) => !v)}>
                  {mostrarZerados ? 'Ocultar itens não iniciados' : 'Mostrar itens não iniciados'}
                </button>
                <button className="btn-sm" onClick={() => baixarCsv(p, semana)} title="Todas as linhas do custo direto, com a regra e a origem do %">
                  Baixar memória (CSV)
                </button>
                <span style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)' }}>
                  Valor agregado = orçado da linha × % físico · <i>tempo</i>: verba linear pela obra · <i>herda</i>: material sem
                  medição, usa o % do serviço vinculado · clique numa linha para ver a memória de cálculo · <i>compra antecipada</i>: material comprado antes da execução, agregado =
                  custo pago + a pagar até o orçado · <i>verba</i>: locação, gasto até o orçado · <i>a pagar</i>: contas a pagar do
                  último fechamento{p.contas.fechamento ? ` (${p.contas.fechamento})` : ''} · estouro / economia = (pago + a pagar) −
                  valor agregado · saldo da verba = orçado − pago − a pagar · % orç. = (pago + a pagar) ÷ orçado
                </span>
              </div>

              <ResumoVerbaForma v={p.totais.verba_forma} />
              <style>{CSS_ROLAGEM}</style>
              <div className="va-rolagem">
                <div className="va-tabela">
                  <Linha cabecalho>
                    <div>Código</div>
                    <div>Serviço</div>
                    <div>Pav.</div>
                    <div style={dir}>Orçado</div>
                    <div style={dir}>% físico</div>
                    <div style={dir}>Medido</div>
                    <div style={dir}>Valor agregado</div>
                    <div style={dir}>Pago</div>
                    <div style={dir} title="Contas a pagar do último fechamento (só direto e não recorrente)">A pagar</div>
                    <div style={dir} title="(Pago + a pagar) ÷ orçado. Vermelho acima de 100%">% orç.</div>
                    <div style={dir} title="(Pago + a pagar) − valor agregado. Positivo = estouro (vermelho), negativo = economia (verde); o % é sobre o valor agregado">
                      Estouro / economia
                    </div>
                    <div style={dir} title="Orçado − pago − a pagar. Vermelho: verba estourada">Saldo da verba</div>
                  </Linha>

                  {grupos.map((g) => (
                    <div key={g.grupo}>
                      <LinhaTotal codigo={g.grupo} nome={g.nome} t={g.t} forte
                        onClick={() => alternar(`g${g.grupo}`)} aberto={estaAberto(`g${g.grupo}`)}
                        title={g.t.plan_valor > 0
                          ? `Ritmo de gasto vs cronograma: pago ${fmtMoeda(g.t.pago)} de ${fmtMoeda(g.t.plan_valor)} planejados até ${s2(semana)} (${fmtP((g.t.pago / g.t.plan_valor) * 100)})`
                          : 'Sem planejado do cronograma até a semana'} />
                      {estaAberto(`g${g.grupo}`) && g.itens.map((i) => {
                        const semExec = !(i.agregado > 0.005)
                        const estouroPago = i.pago > i.agregado + 0.005 && i.agregado > 0
                        return (
                          <React.Fragment key={i.id}>
                          <Linha onClick={() => setMemoria((m) => (m === i.id ? null : i.id))} title="Clique para ver a memória de cálculo">
                            <div style={{ color: 'var(--text2)' }}>{i.codigo_eap}</div>
                            <div>{i.descricao}</div>
                            <div style={{ color: 'var(--text2)', fontSize: 11 }}>{rotuloPavimento(i.pavimento, i.codigo_eap) || '—'}</div>
                            <div style={dir}>{fmtMoeda(i.orcado)}</div>
                            <div style={dir}>{semExec || i.tipo === 'locacao' || i.perc_real == null ? '—' : fmtP(i.perc_real)}</div>
                            <div style={{ ...dir, overflowWrap: 'break-word', color: i.tipo === 'servico' ? 'var(--text2)' : PLAN }} title={tituloMedido(i)}>{medidoDe(i)}</div>
                            <div style={{ ...dir, color: semExec ? 'var(--text2)' : PLAN }}>{semExec ? '—' : fmtMoeda(i.agregado)}</div>
                            <div style={{ ...dir, color: estouroPago ? VERMELHO : 'var(--text)' }} title={estouroPago ? 'Pago acima do executado' : ''}>
                              {i.pago > 0.005 ? fmtMoeda(i.pago) : '—'}
                            </div>
                            <div style={{ ...dir, color: i.a_pagar > 0.005 ? AMBAR : 'var(--text2)' }}>{i.a_pagar > 0.005 ? fmtMoeda(i.a_pagar) : '—'}</div>
                            <PercOrcado orcado={i.orcado} pago={i.pago} aPagar={i.a_pagar} />
                            <Estouro agregado={i.agregado} pago={i.pago} aPagar={i.a_pagar} orcado={i.orcado}
                              neutro={i.material_comprado || i.tipo === 'locacao'} />
                            <Saldo orcado={i.orcado} pago={i.pago} aPagar={i.a_pagar} />
                          </Linha>
                          {memoria === i.id && <Memoria i={i} av={p.avanco} />}
                          </React.Fragment>
                        )
                      })}
                      {estaAberto(`g${g.grupo}`) && g.zerados > 0 && (
                        <div style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)', padding: '6px 0 10px 100px' }}>
                          {g.zerados} {g.zerados === 1 ? 'item não iniciado' : 'itens não iniciados'} (0%)
                        </div>
                      )}
                    </div>
                  ))}

                  <LinhaTotal codigo="" nome="Total do custo direto" forte t={total} />
                </div>
              </div>
              <div style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)', marginTop: 10, lineHeight: 1.6 }}>
                <b>A pagar</b> = contas a pagar do último fechamento, a mesma base do card "Custo direto a pagar".{' '}
                <b>Estouro / economia</b> = (pago + a pagar) − valor agregado: positivo (vermelho) custou mais que o orçado
                pelo que foi executado, negativo (verde) custou menos; o % é sobre o valor agregado e a eficiência aparece
                ao passar o mouse. <b>Saldo da verba</b> = orçado − pago − a pagar; em vermelho, verba estourada. Pago em
                vermelho: pago acima do executado. O ritmo de gasto vs cronograma aparece ao passar o mouse no nome do grupo.
                {p.fora_orcamento.length > 0 && (
                  <> Custo com EAP fora do orçamento (fora da tabela): {p.fora_orcamento.map((f) => `${f.codigo_eap} ${fmtMoeda(f.pago + f.a_pagar)}`).join('; ')}.</>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
