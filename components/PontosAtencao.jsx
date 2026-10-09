// Painel "Pontos de atenção" (pedidos 14C e 14D). Abaixo do Diário de ocorrências, recolhido.
// Topo: 6 números (atrasadas, a executar na semana e em 30 dias, equipes sugeridas, caixa da semana e de 30 dias — o
// caixa abre a composição). Abas: Atrasadas | Próxima semana | Próximos 30 dias, com as atividades dentro do GRUPO do
// orçamento (recolhido; na Estrutura, por pavimento se houver mais de um). Por atividade: índice e nº de equipes
// editáveis (término, datas e caixa recalculam na hora), coluna DATAS (planejado · no ritmo atual · com N equipes) e
// CAIXA do período (mão de obra | material). Compras só no botão discreto. Clique na atividade = memória de cálculo e
// histórico. Hooks no topo (erro #310). Nada inventado: campo vazio em amarelo para preencher.
import React, { useEffect, useState } from 'react'
import { fmtP1, fmtMoeda2, CORES_VA, rotuloPavimento } from '../lib/constants'
import { calcularTermino, pctNoPeriodo, caixaAtividade } from '../lib/pontos-atencao'
import { fetchComSenhaSemJanela, temSenha } from '../lib/fetch-com-senha'
import Desbloqueio from './Desbloqueio'

const { estouro: VERMELHO, aPagar: AMBAR, economia: VERDE } = CORES_VA
const CINZA = '#8b919c'
const AMARELO_FUNDO = 'rgba(201,164,92,.18)'
const dm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—')
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—')
const nf = (v, d = 1) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }))
const rs = (v) => (v == null ? '—' : fmtMoeda2(v))
const ORIGEM = { cronograma: 'cronograma', cpu_flats: 'CPU Flats', rafael: 'Rafael', 'rafael-site': 'Rafael (site)' }
const ABAS = [['atrasadas', 'Atrasadas'], ['semana', 'Próxima semana'], ['mes', 'Próximos 30 dias']]
const inp = (pend) => ({ width: 70, padding: '3px 6px', fontFamily: 'var(--mono)', fontSize: 12, background: pend ? AMARELO_FUNDO : undefined })
const btnMini = { fontSize: 10, padding: '1px 6px' }
const ixTxt = (v) => String(Number(Number(v).toFixed(4))).replace('.', ',')   // até 4 casas, sem zeros à direita
const num = { textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, whiteSpace: 'nowrap' }
const diasUt = (n) => `${n} dia${n === 1 ? '' : 's'} út${n === 1 ? 'il' : 'eis'}`
const NCOL = 11

export default function PontosAtencao({ semana }) {
  const [aberto, setAberto] = useState(false)
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)
  const [aba, setAba] = useState('atrasadas')
  const [verCompras, setVerCompras] = useState(false)
  const [verCaixa, setVerCaixa] = useState(null)   // 'semana' | 'mes' | null — composição do caixa
  const [cxAbertos, setCxAbertos] = useState(() => new Set())   // grupos abertos na composição do caixa
  const [grupos, setGrupos] = useState(() => new Set())   // grupos/pavimentos abertos (chave aba|grupo|pav)
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
  const alternar = (k) => setGrupos((g) => { const n = new Set(g); n.has(k) ? n.delete(k) : n.add(k); return n })

  // valores efetivos (edição na tela > salvo > sugerido): término e caixa recalculados
  const efetivo = (a) => {
    const e = ed(a.id)
    const mudouIx = e.indice !== undefined && e.indice !== ''
    const pessoas = e.oficiais !== undefined || e.ajudantes !== undefined
      ? (Number(e.oficiais) || 0) + (Number(e.ajudantes) || 0) : a.equipe ? a.equipe.pessoas : null
    const equipes = e.equipes !== undefined && e.equipes !== '' ? e.equipes : a.equipes_definidas
    const t = calcularTermino({ quantidade: a.quantidade, real: a.real, indice: mudouIx ? e.indice : a.indice,
      horasTotal: mudouIx ? null : a.horas_total, pessoas, equipes, fimCrono: a.fim_crono, hoje: d.hoje, jornada: d.jornada, feriados: d.feriados })
    const caixa = (per) => {
      const pct = pctNoPeriodo({ real: a.real, planFim: per === 'semana' ? a.plan_fim_semana : a.plan_fim_mes, base: t.base, pessoas,
        equipes, diasPeriodo: d.periodos[per].dias_uteis, horasDia: d.jornada.horas_dia })
      // materiais com o desconto da verba de forma já repartido no servidor para o período
      return { pct, ...caixaAtividade({ pct, orcado: a.orcado, materiais: (per === 'semana' ? a.materiais_semana : a.materiais_mes) || a.materiais_caixa }) }
    }
    return { t, cxSemana: caixa('semana'), cxMes: caixa('mes') }
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

  if (!aberto || !d || erro) {
    return (
      <div className="card">
        <div className="card-title" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setAberto(!aberto)}>
          <span>Pontos de atenção</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="kpi-sub">{aberto ? (erro ? '' : 'carregando…') : `a partir da S${semana}`}</span>
            <span style={{ color: 'var(--text3)', fontSize: 11 }}>{aberto ? '▲' : '▼'}</span>
          </span>
        </div>
        {aberto && erro && <div className="kpi-sub">Não foi possível carregar: {erro}</div>}
        {aberto && !erro && <div className="loading">Analisando…</div>}
      </div>
    )
  }

  // atividades com os valores efetivos
  const ativs = d.atividades.map((a) => ({ ...a, ef: efetivo(a) }))
  const naAba = (a, k) => (k === 'atrasadas' ? a.atrasada : k === 'semana' ? a.na_semana : a.em_30)
  const perDaAba = aba === 'semana' ? 'semana' : 'mes'
  const cxDe = (a, per) => (per === 'semana' ? a.ef.cxSemana : a.ef.cxMes)
  const somaCx = (ls, per) => ls.reduce((s, a) => { const c = cxDe(a, per); return { mo: s.mo + c.mo, material: s.material + c.material, total: s.total + c.total } }, { mo: 0, material: 0, total: 0 })
  const caixaTopo = (per) => {
    const ls = ativs.filter((a) => naAba(a, per))
    const serv = somaCx(ls, per)
    const contas = d.caixa[per].contas.reduce((s, c) => s + c.valor, 0)
    const indir = d.caixa[per].indiretos.reduce((s, c) => s + c.valor, 0)
    return { serv, contas, indir, total: serv.total + contas + indir, curva: d.caixa[per].curva, ls }
  }
  const cxS = caixaTopo('semana'), cxM = caixaTopo('mes')
  const equipesTopo = ativs.filter((a) => a.em_30).reduce((s, a) => s + (a.ef.t.usadas || 0), 0)
  const em6m = new Date(Date.parse(d.hoje) + 183 * 864e5).toISOString().slice(0, 10)
  const alertasCompra = d.compras.filter((c) => c.pedir_ate && c.pedir_ate <= em6m)
  const atrasoDe = (a) => Math.max(a.ritmo ? a.ritmo.atrasa || 0 : 0, a.ef.t.atrasa || 0)

  // grupos da aba (ordem: com atraso primeiro, depois pelo início planejado)
  const lista = ativs.filter((a) => naAba(a, aba))
  const porGrupo = {}
  lista.forEach((a) => { (porGrupo[a.grupo_num] = porGrupo[a.grupo_num] || { num: a.grupo_num, nome: a.grupo_nome, itens: [] }).itens.push(a) })
  const resumoGrupo = (itens) => {
    const fimsRitmo = itens.map((a) => (a.ritmo && a.ritmo.fim_ritmo) || null)
    return {
      n: itens.length, atrasadas: itens.filter((a) => a.atrasada).length,
      atraso: Math.max(0, ...itens.map(atrasoDe)),
      equipes: itens.reduce((s, a) => s + (a.ef.t.usadas || 0), 0),
      fimPlan: itens.map((a) => a.fim_crono).filter(Boolean).sort().pop(),
      fimRitmo: fimsRitmo.some((x) => !x) ? null : fimsRitmo.sort().pop(),
      naoIniciadas: itens.filter((a) => a.ritmo && a.ritmo.nao_iniciada).length,
      cx: somaCx(itens, perDaAba),
      inicio: itens.map((a) => a.inicio_crono).filter(Boolean).sort()[0],
    }
  }
  const gruposAba = Object.values(porGrupo).map((g) => ({ ...g, r: resumoGrupo(g.itens) }))
    .sort((a, b) => (b.r.atraso > 0) - (a.r.atraso > 0) || b.r.atraso - a.r.atraso || String(a.r.inicio).localeCompare(String(b.r.inicio)))

  const numero = (l, v, cor, onClick, sub) => (
    <div key={l} className={'kpi' + (onClick ? ' kpi-clickable' : '')} style={{ flex: 1, minWidth: 140 }} onClick={onClick}>
      <div className="kpi-label">{l}</div>
      <div className="kpi-value" style={{ fontSize: 20, color: cor }}>{v}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )

  const cabGrupo = (k, titulo, r, nivel) => (
    <tr key={'g' + k} onClick={() => alternar(k)} style={{ cursor: 'pointer', background: nivel === 0 ? 'var(--bg3)' : 'transparent' }}>
      <td colSpan={NCOL} style={{ fontSize: 12, padding: nivel === 0 ? '9px 8px' : '7px 8px 7px 28px' }}>
        <span style={{ color: CINZA, marginRight: 6 }}>{grupos.has(k) ? '▾' : '▸'}</span>
        <b style={nivel === 0 ? { textTransform: 'uppercase' } : null}>{titulo}</b>
        <span style={{ color: CINZA }}>
          {' · '}{r.n} atividade{r.n === 1 ? '' : 's'} ({r.atrasadas} atrasada{r.atrasadas === 1 ? '' : 's'})
          {r.atraso > 0 && <span style={{ color: VERMELHO }}> · maior atraso {diasUt(r.atraso)}</span>}
          {' · '}{r.equipes} equipe{r.equipes === 1 ? '' : 's'} sugerida{r.equipes === 1 ? '' : 's'}
          {' · '}fim planejado {dm(r.fimPlan)}
          {' · '}no ritmo atual {r.fimRitmo ? dm(r.fimRitmo) : r.naoIniciadas ? `— (${r.naoIniciadas} não iniciada${r.naoIniciadas === 1 ? '' : 's'})` : '—'}
          {' · '}caixa {perDaAba === 'semana' ? 'da semana' : 'em 30 dias'} <b style={{ color: 'var(--text)' }}>{rs(r.cx.total)}</b>
        </span>
      </td>
    </tr>
  )

  const linhaAtividade = (a) => {
    const e = ed(a.id)
    const { t } = a.ef
    const cx = cxDe(a, perDaAba)
    const desvio = a.real - a.plan_hoje
    const faltaQtd = (Math.max(100 - a.real, 0) / 100) * a.quantidade
    const semIndice = a.indice == null && a.horas_total == null
    const semEquipe = !a.equipe
    const mudouEq = e.equipes !== undefined
    const mudouIx = e.indice !== undefined
    const on = linhaAberta === a.id
    const rt = a.ritmo || {}
    return (
      <React.Fragment key={a.id}>
        <tr>
          <td style={{ fontSize: 12, cursor: 'pointer', paddingLeft: 30 }} onClick={() => setLinhaAberta(on ? null : a.id)} title="Ver memória de cálculo e alterações">
            <span style={{ color: CINZA, marginRight: 4 }}>{on ? '▾' : '▸'}</span>
            <span style={{ fontFamily: 'var(--mono)', color: CINZA }}>{a.codigo_eap}</span> {a.descricao.length > 40 ? a.descricao.slice(0, 38) + '…' : a.descricao}
            <span style={{ color: CINZA }}> · {rotuloPavimento(a.pavimento, a.codigo_eap)}</span>
          </td>
          <td style={num}>{nf(a.quantidade, 1)} {a.unidade}</td>
          <td style={num}>{fmtP1(a.real)}</td>
          <td style={num}>{fmtP1(a.plan_hoje)}</td>
          <td style={{ ...num, color: desvio < -0.05 ? VERMELHO : desvio > 0.05 ? VERDE : CINZA }}>{(desvio > 0 ? '+' : '') + nf(desvio, 1)} p.p.</td>
          <td style={num}>{nf(faltaQtd, 1)} {a.unidade}<div style={{ color: CINZA }}>{t.horas == null ? '—' : `${nf(t.horas, 0)} Hh`}</div></td>
          <td style={{ textAlign: 'right', fontSize: 11 }}>
            {a.horas_total != null && !mudouIx ? (
              <span style={{ fontFamily: 'var(--mono)', cursor: 'pointer' }} title="Serviço por duração. Clique para trocar por um índice"
                    onClick={() => setCampo(a.id, 'indice', '')}>duração {nf(a.horas_total, 0)} Hh</span>
            ) : (
              <input type="text" inputMode="decimal" style={inp(semIndice && !mudouIx)} placeholder={semIndice ? 'preencher' : ''}
                     value={mudouIx ? String(e.indice).replace('.', ',') : a.indice == null ? '' : ixTxt(a.indice)}
                     onChange={(ev) => setCampo(a.id, 'indice', ev.target.value.replace(',', '.'))} />
            )}
            <div style={{ color: CINZA, fontSize: 10 }}>{a.indice_origem ? `sugerido (${ORIGEM[a.indice_origem] || a.indice_origem})` : 'sem índice'}</div>
            {mudouIx && (
              <div>
                <button className="btn-sm" style={btnMini} disabled={!(Number(e.indice) > 0)}
                        onClick={() => setConfirmar({ id: a.id, campo: 'indice', valor: e.indice, texto: `Gravar índice ${nf(e.indice, 4)} Hh/${a.unidade} em ${a.codigo_eap} ${rotuloPavimento(a.pavimento, a.codigo_eap)}?` })}>salvar</button>
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
                <input type="text" style={{ ...inp(true), width: 84 }} placeholder="função" title="função do oficial"
                       value={e.funcao ?? ''} onChange={(ev) => setCampo(a.id, 'funcao', ev.target.value)} />
                {(Number(e.oficiais) || 0) + (Number(e.ajudantes) || 0) > 0 && (
                  <button className="btn-sm" style={btnMini}
                          onClick={() => setConfirmar({ id: a.id, campo: 'equipe', valor: { oficiais: Number(e.oficiais) || 0, ajudantes: Number(e.ajudantes) || 0, funcao: e.funcao || '' },
                            texto: `Gravar equipe ${Number(e.oficiais) || 0} ${e.funcao || 'oficial'} + ${Number(e.ajudantes) || 0} ajudante(s) em ${a.codigo_eap} ${rotuloPavimento(a.pavimento, a.codigo_eap)}?` })}>salvar</button>
                )}
              </div>
            ) : (
              <input type="number" min="1" style={{ ...inp(false), width: 52 }}
                     value={mudouEq ? e.equipes : t.usadas ?? ''} onChange={(ev) => setCampo(a.id, 'equipes', ev.target.value)} />
            )}
            <div style={{ color: CINZA, fontSize: 10 }}>sugerido {t.sugeridas ?? '—'}{a.equipe ? ` · ${a.equipe.composicao}` : ''}</div>
            {!semEquipe && (mudouEq || a.equipes_definidas != null) && (
              <div>
                {mudouEq && Number(e.equipes) > 0 && (
                  <button className="btn-sm" style={btnMini}
                          onClick={() => setConfirmar({ id: a.id, campo: 'equipes', valor: Number(e.equipes), texto: `Gravar ${e.equipes} equipe(s) em ${a.codigo_eap} ${rotuloPavimento(a.pavimento, a.codigo_eap)}?` })}>salvar</button>
                )}
                <button className="btn-sm" style={{ ...btnMini, marginLeft: 4 }}
                        onClick={() => (a.equipes_definidas != null
                          ? setConfirmar({ id: a.id, campo: 'equipes', valor: null, texto: `Voltar ${a.codigo_eap} ${rotuloPavimento(a.pavimento, a.codigo_eap)} ao número sugerido de equipes (apaga o valor salvo)?` })
                          : limpar(a.id, ['equipes']))}>voltar ao sugerido</button>
              </div>
            )}
          </td>
          <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
            <div style={{ color: CINZA }}>planejado {dm(a.inicio_crono)} → {dm(a.fim_crono)}</div>
            <div style={{ color: rt.nao_iniciada ? (rt.deveria_desde ? VERMELHO : CINZA) : rt.cumpre ? VERDE : VERMELHO }}>
              {rt.nao_iniciada
                ? (rt.deveria_desde ? `não iniciada · deveria ter começado em ${dm(rt.deveria_desde)}` : 'não iniciada')
                : `no ritmo atual ${dm(rt.fim_ritmo)} (${rt.cumpre ? 'cumpre' : `atrasa ${diasUt(rt.atrasa)}`})`}
            </div>
            <div style={{ color: t.termino ? (t.cumpre ? VERDE : VERMELHO) : AMBAR }}>
              {t.termino ? `com ${t.usadas} equipe${t.usadas === 1 ? '' : 's'} ${dm(t.termino)} (${t.cumpre ? 'cumpre' : `atrasa ${diasUt(t.atrasa)}`})`
                : `preencha ${semIndice ? 'o índice' : ''}${semIndice && semEquipe ? ' e ' : ''}${semEquipe ? 'a equipe' : ''}`}
            </div>
          </td>
          <td style={num} title={`${nf(cx.pct, 1)}% a executar no período`}>
            {rs(cx.total)}
            <div style={{ color: CINZA, fontSize: 10 }}>MO {rs(cx.mo)} · mat. {rs(cx.material)}</div>
          </td>
        </tr>
        {on && (
          <tr>
            <td colSpan={NCOL} style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg)', lineHeight: 1.7, paddingLeft: 30 }}>
              <b>Memória de cálculo</b> · horas que faltam = (100% − {fmtP1(a.real)}) × {a.horas_total != null && !mudouIx ? `${nf(a.horas_total, 0)} Hh (duração)` : `${nf(a.quantidade, 1)} ${a.unidade} × índice`}
              {' '}= {nf(t.horas, 0)} Hh · 1 equipe = {t.capacidade_dia ?? '—'} Hh/dia · data-alvo {dmy(t.alvo)} ({diasUt(t.dias_ate_alvo)}) · sugerido {t.sugeridas ?? '—'} equipe(s)
              <br />Ritmo atual: {rt.nao_iniciada ? 'sem medição' : `${nf(rt.ritmo, 2)}% por dia útil, de ${dmy(rt.inicio_real)} até a última medição ${dmy(rt.ultima)}`}
              <br />Caixa {perDaAba === 'semana' ? 'da semana' : 'em 30 dias'}: {nf(cx.pct, 1)}% × (serviço {rs(a.orcado)}
              {a.materiais_caixa.length > 0 && <> + materiais {((perDaAba === 'semana' ? a.materiais_semana : a.materiais_mes) || a.materiais_caixa).map((m) => `${m.codigo_eap} ${rs(m.orcado)}${m.excesso > 0.005 ? ` − ${m.verba_forma ? 'verba de forma já comprada' : 'já comprado além do executado'} ${rs(m.excesso)}` : ''}`).join(' + ')}</>}) = {rs(cx.total)}
              <br />Em 30 dias: manter o ritmo {nf(a.mes.horas_ritmo, 0)} Hh · recuperar o atraso {nf(a.mes.horas_atraso, 0)} Hh · horas da linha no orçamento {nf(a.hh, 1)} Hh
              {a.cronograma_curto && <> · <span style={{ color: AMBAR }}>cronograma curto: prevê {nf(a.cronograma_curto.horas_cronograma, 0)} h, pelo índice são {nf(a.cronograma_curto.horas_indice, 0)} h</span></>}
              <br /><b>Alterações</b>: {a.historico && a.historico.length
                ? a.historico.map((h, i) => <span key={i}>{i ? ' · ' : ''}{dmy(String(h.editado_em).slice(0, 10))} {h.editado_por || '—'}: {h.campo} {h.valor_anterior ?? '—'} → {h.valor_novo ?? 'sugerido'}</span>)
                : 'nenhuma'}
            </td>
          </tr>
        )}
      </React.Fragment>
    )
  }

  // composição do caixa por GRUPO (decisão do Rafael 09/10): cada grupo recolhido com o total; ao abrir, os itens
  const composicao = (per) => {
    const c = per === 'semana' ? cxS : cxM
    const pg = {}
    c.ls.forEach((a) => {
      const x = cxDe(a, per)
      if (!(x.total > 0.005)) return
      const g = (pg[a.grupo_num] = pg[a.grupo_num] || { nome: a.grupo_nome, mo: 0, material: 0, itens: [] })
      g.mo += x.mo; g.material += x.material; g.itens.push({ a, x })
    })
    const abre = (k) => setCxAbertos((s0) => { const n = new Set(s0); n.has(k) ? n.delete(k) : n.add(k); return n })
    const linha = (k, rot, valor, abrivel, forte) => (
      <div onClick={abrivel ? () => abre(k) : undefined}
           style={{ display: 'flex', gap: 8, cursor: abrivel ? 'pointer' : 'default', fontWeight: forte ? 600 : 400, padding: '2px 0' }}>
        <span style={{ color: CINZA, width: 12 }}>{abrivel ? (cxAbertos.has(k) ? '▾' : '▸') : ''}</span>
        <span style={{ flex: 1 }}>{rot}</span>
        <span style={{ fontFamily: 'var(--mono)' }}>{rs(valor)}</span>
      </div>
    )
    const sub = (conteudo) => <div style={{ paddingLeft: 22, color: 'var(--text2)', fontSize: 11 }}>{conteudo}</div>
    const recs = d.caixa[per].indiretos.filter((x) => x.tipo === 'recorrente')
    const ponts = d.caixa[per].indiretos.filter((x) => x.tipo === 'pontual')
    return (
      <div className="toast" style={{ marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
        <b>Caixa {per === 'semana' ? 'da próxima semana' : 'dos próximos 30 dias'}</b> ({dmy(d.periodos[per].de)} a {dmy(d.periodos[per].ate)})
        {Object.entries(pg).sort((a, b) => a[0] - b[0]).map(([k, g]) => (
          <div key={k}>
            {linha(`${per}|g${k}`, `${k} ${g.nome}`, g.mo + g.material, true)}
            {cxAbertos.has(`${per}|g${k}`) && sub(g.itens.map(({ a, x }) => (
              <div key={a.id} style={{ display: 'flex', gap: 8 }}>
                <span style={{ flex: 1 }}>{a.codigo_eap} {a.descricao.slice(0, 40)} · {rotuloPavimento(a.pavimento, a.codigo_eap)}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>MO {rs(x.mo)} · material {rs(x.material)} · <b>{rs(x.total)}</b></span>
              </div>
            )))}
          </div>
        ))}
        {linha(`${per}|contas`, 'Contas a pagar no período', c.contas, d.caixa[per].contas.length > 0)}
        {cxAbertos.has(`${per}|contas`) && sub(d.caixa[per].contas.map((x, i) => (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            <span style={{ flex: 1 }}>{x.fornecedor || '—'} · doc. {x.documento || '—'}{x.parcela ? ` / ${x.parcela}` : ''} · vence {dm(x.vencimento)} · {x.codigo_eap || 'sem EAP'}</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{rs(x.valor)}</span>
          </div>
        )))}
        {linha(`${per}|ind`, '19 Indiretos', c.indir, d.caixa[per].indiretos.length > 0)}
        {cxAbertos.has(`${per}|ind`) && sub(<>
          {recs.length > 0 && <div><i>recorrentes</i>: {recs.map((x) => `${x.codigo_eap} ${x.categoria} ${rs(x.valor)}`).join(' · ')}</div>}
          {ponts.length > 0 ? <div><i>pontuais</i>: {ponts.map((x) => `${x.codigo_eap} ${x.categoria} ${rs(x.valor)}`).join(' · ')}</div>
            : <div><i>pontuais</i>: nenhum planejado no período</div>}
        </>)}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
          {linha(`${per}|tot`, 'TOTAL', c.total, false, true)}
          <div style={{ color: CINZA, fontSize: 11, textAlign: 'right' }}>curva do cronograma no período: {rs(c.curva)}</div>
        </div>
        <div style={{ color: CINZA, fontSize: 10, marginTop: 4 }}>
          Contas a pagar: entra o título com vencimento dentro do período; vencido antes do período conta como pago. Indiretos:
          recorrentes (sem a reserva 19.1.25) e pontuais planejados dentro do período; pontual planejado antes e não pago não entra.
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setAberto(false)}>
        <span>Pontos de atenção</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="kpi-sub">{d.topo.atrasadas} atrasadas · {equipesTopo} equipes sugeridas</span>
          <span style={{ color: 'var(--text3)', fontSize: 11 }}>▲</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        {numero('Atrasadas', d.topo.atrasadas, d.topo.atrasadas ? VERMELHO : undefined)}
        {numero('A executar na semana', d.topo.semana)}
        {numero('A executar em 30 dias', d.topo.mes)}
        {numero('Equipes sugeridas (30 dias)', equipesTopo)}
        {numero('Caixa próxima semana', rs(cxS.total), undefined, () => setVerCaixa(verCaixa === 'semana' ? null : 'semana'), `curva: ${rs(cxS.curva)}`)}
        {numero('Caixa 30 dias', rs(cxM.total), undefined, () => setVerCaixa(verCaixa === 'mes' ? null : 'mes'), `curva: ${rs(cxM.curva)}`)}
      </div>
      <div className="kpi-sub" style={{ marginBottom: 10 }}>
        Caixa pelo valor do serviço executado no período; prazos de pagamento de fornecedores ainda não considerados.
        {' '}Hoje = fim da S{d.semana} ({dmy(d.hoje)}) · jornada {nf(d.jornada.horas_dia, 0)} h/dia, seg–sex
        {!d.configurado.indices && <span style={{ color: AMBAR }}> · configure as tabelas (SQL do planejamento)</span>}
        {d.configurado.indices && !d.configurado.edicao && <span style={{ color: AMBAR }}> · para salvar pelo site, rode o SQL 2 do planejamento</span>}
      </div>
      {verCaixa && composicao(verCaixa)}

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
                <td style={{ fontSize: 12 }}><span style={{ fontFamily: 'var(--mono)', color: CINZA }}>{c.codigo_eap}</span> {c.descricao} <span style={{ color: CINZA }}>{rotuloPavimento(c.pavimento, c.codigo_eap)}</span></td>
                <td style={{ ...num, color: CINZA }}>{c.regra === 'ultimo_mes' ? c.planejado.slice(5, 7) + '/' + c.planejado.slice(0, 4) : dmy(c.planejado)}</td>
                <td style={num}>{c.regra === 'ultimo_mes' ? c.necessidade.slice(5, 7) + '/' + c.necessidade.slice(0, 4) : dmy(c.necessidade)}</td>
                <td style={{ ...num, color: c.status === 'vencido' ? VERMELHO : c.pedir_ate && c.pedir_ate <= em6m ? AMBAR : undefined }}>
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

      {gruposAba.length === 0 ? <div className="kpi-sub">Nada nesta aba.</div> : (
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
                <th>Datas</th>
                <th style={{ textAlign: 'right' }}>Caixa {perDaAba === 'semana' ? 'semana' : '30 dias'}</th>
                <th style={{ width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {gruposAba.map((g) => {
                const kg = `${aba}|${g.num}`
                const pavs = [...new Set(g.itens.map((a) => a.pavimento))]
                const subdividir = g.num === 3 && pavs.length > 1
                return (
                  <React.Fragment key={kg}>
                    {cabGrupo(kg, `${g.num} ${g.nome}`, g.r, 0)}
                    {grupos.has(kg) && (subdividir
                      ? pavs.map((p) => {
                        const itens = g.itens.filter((a) => a.pavimento === p)
                        const kp = `${kg}|${p}`
                        return (
                          <React.Fragment key={kp}>
                            {cabGrupo(kp, rotuloPavimento(p, g.num), resumoGrupo(itens), 1)}
                            {grupos.has(kp) && itens.map(linhaAtividade)}
                          </React.Fragment>
                        )
                      })
                      : g.itens.map(linhaAtividade))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
