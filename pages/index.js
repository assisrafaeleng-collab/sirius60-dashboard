import Head from 'next/head'
import { useState } from 'react'
import Dashboard from '../components/Dashboard'
import MedicaoSemanal from '../components/MedicaoSemanal'
import Lancamentos from '../components/Lancamentos'
import Desbloqueio from '../components/Desbloqueio'
import { esquecerSenha } from '../lib/fetch-com-senha'
import { OBRA, semanaLabel, semanaAtualObra, semanasPorMes, inicioSemana, fimSemana } from '../lib/constants'

const ABAS = ['Visão geral', 'Medição semanal', 'Lançamentos']

export default function Home() {
  const [semana, setSemana] = useState(semanaAtualObra())
  const [aba, setAba] = useState(0)
  // liberado uma vez, vale enquanto a página estiver aberta.
  // A senha fica em lib/fetch-com-senha (sessionStorage), não no estado.
  const [sessao, setSessao] = useState(null)   // { quem }

  // semanas agrupadas por mês (calendário ativo), para o seletor não virar uma lista cega
  const grupos = semanasPorMes()

  const fmtBR = d => d.toLocaleDateString('pt-BR')

  return (
    <>
      <Head>
        <title>{OBRA.nome + " - Acompanhamento de obra"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="page">
        <header className="header">
          <div className="header-top">
            <div>
              <div className="obra-eye">Acompanhamento semanal de obra</div>
              <h1 className="obra-nome">{OBRA.nome}</h1>
              <div className="obra-info">
                {OBRA.cidade} · {OBRA.area_total.toLocaleString('pt-BR')} m² ·{' '}
                {OBRA.unidades} unidades · {OBRA.prazo_semanas} semanas ·{' '}
                {fmtBR(inicioSemana(1))} a {fmtBR(fimSemana(OBRA.prazo_semanas))}
              </div>
            </div>
            <div className="sel-wrap">
              <div className="sel-lbl">Semana</div>
              <select className="periodo" value={semana} onChange={e => setSemana(+e.target.value)}>
                {grupos.map(g => (
                  <optgroup key={g.mes} label={g.mes}>
                    {g.semanas.map(s => <option key={s} value={s}>{semanaLabel(s)}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          {sessao && (
            <div className="kpi-sub" style={{ marginTop: 10 }}>
              Lançamentos liberados{sessao.quem ? ` para ${sessao.quem}` : ''} ·{' '}
              <a onClick={() => { esquecerSenha(); setSessao(null) }}
                 style={{ color: 'var(--accent)', cursor: 'pointer' }}>bloquear</a>
            </div>
          )}
          <nav className="nav">
            {ABAS.map((a, i) => (
              <button key={a} className={'nav-btn' + (i === aba ? ' active' : '')}
                      onClick={() => setAba(i)}>{a}</button>
            ))}
          </nav>
        </header>

        <div style={{ marginTop: 22 }}>
          {aba === 0 && <Dashboard semana={semana} sessao={sessao} onSemana={setSemana} />}
          {(aba === 1 || aba === 2) && !sessao && (
            <Desbloqueio onLiberar={quem => setSessao({ quem })} />
          )}
          {aba === 1 && sessao && <MedicaoSemanal semana={semana} sessao={sessao} />}
          {aba === 2 && sessao && <Lancamentos semana={semana} sessao={sessao} />}
        </div>
      </div>
    </>
  )
}
