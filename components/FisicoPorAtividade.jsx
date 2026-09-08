import { useMemo, useState } from 'react'
import { fmtMoedaK, fmtPct } from '../lib/constants'

const VERDE = '#4D9B6A'
const VERM  = '#B03030'
const AZUL  = '#5B6B9B'

const SIGLA = {
  1: 'Prelim', 2: 'Fundaç', 3: 'Estrut', 4: 'Alven', 5: 'Reboco', 6: 'Hidro',
  7: 'Elétr', 8: 'InstEsp', 9: 'Cobert', 10: 'Gesso', 11: 'Pisos', 12: 'Esquad',
  13: 'Pintura', 14: 'Louças', 15: 'Urban', 16: 'Finais',
}

// Para cada frente com avanço lançado: quanto foi executado, quanto
// deveria estar pronto e quanto falta. O desvio é da meta da própria
// atividade — não se soma ao desvio do projeto.
export default function FisicoPorAtividade({ itens, medido, semana, base }) {
  const [agrupar, setAgrupar] = useState('grupo')   // grupo | pav
  const [todas, setTodas] = useState(false)
  if (!itens || !medido) return null

  const porHora = base === 'horas'
  const pesoDe = i => porHora ? i.h : i.c
  const planDe = i => {
    if (semana >= i.b) return 100
    if (semana < i.a) return 0
    return 100 * (semana - i.a + 1) / (i.b - i.a + 1)
  }

  const linhas = useMemo(() => {
    const m = {}
    itens.forEach(i => {
      const k = agrupar === 'grupo' ? i.g : i.p
      if (!m[k]) m[k] = { chave: k, nome: agrupar === 'grupo' ? (SIGLA[i.g] || i.n) : i.p,
                          num: agrupar === 'grupo' ? i.g : null,
                          peso: 0, custo: 0, plan: 0, real: 0, medidos: 0, itens: 0 }
      const w = pesoDe(i)
      const med = medido[`${i.i}|${i.p}`]
      m[k].peso += w
      m[k].custo += i.c
      m[k].plan += w * planDe(i) / 100
      m[k].real += w * (med ? med.percentual : 0) / 100
      m[k].itens++
      if (med) m[k].medidos++
    })
    return Object.values(m)
      .filter(b => b.peso > 0)
      .map(b => {
        const plan = 100 * b.plan / b.peso
        const real = 100 * b.real / b.peso
        return { ...b, planPct: plan, realPct: real, desvio: real - plan }
      })
      .filter(b => todas ? (b.planPct > 0 || b.realPct > 0) : b.realPct > 0)
      .sort((a, b) => (a.num ?? 99) - (b.num ?? 99) || a.nome.localeCompare(b.nome))
  }, [itens, medido, semana, base, agrupar, todas])

  if (!linhas.length) return (
    <div className="card">
      <div className="card-title">Físico por atividade — desvio relativo</div>
      <div className="empty-state">
        <h3>Nenhuma frente com avanço lançado</h3>
        <p>Assim que houver medição, cada atividade aparece aqui com sua própria meta.</p>
      </div>
    </div>
  )

  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span>Físico por atividade — desvio relativo da atividade</span>
        <span className="btn-row">
          <button className="btn-sm" onClick={() => setTodas(!todas)}>
            {todas ? 'Só com avanço' : 'Incluir não iniciadas'}
          </button>
          <button className="btn-sm" onClick={() => setAgrupar(agrupar === 'grupo' ? 'pav' : 'grupo')}>
            {agrupar === 'grupo' ? 'Por pavimento' : 'Por macrogrupo'}
          </button>
        </span>
      </div>

      <div className="kpi-sub" style={{ marginBottom: 18, lineHeight: 1.7 }}>
        Mede o desvio da meta de cada atividade até a S{semana}, ponderado por{' '}
        {porHora ? 'horas' : 'custo'}. Não é somável ao desvio do projeto: uma frente
        pequena adiantada não compensa uma grande atrasada.
      </div>

      {linhas.map(b => {
        const exec = Math.min(b.realPct, 100)
        const meta = Math.min(b.planPct, 100)
        const atraso = Math.max(meta - exec, 0)
        const falta = Math.max(100 - Math.max(exec, meta), 0)
        const corDv = b.desvio >= 0 ? 'var(--green-tx)'
          : b.desvio > -5 ? 'var(--amber-tx)' : 'var(--red-tx)'
        return (
          <div key={b.chave} style={{ display: 'flex', alignItems: 'center', gap: 12,
                                      marginBottom: 9 }}>
            <div style={{ width: 108, flexShrink: 0, fontSize: 12, color: 'var(--text2)',
                          textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden',
                          textOverflow: 'ellipsis' }}
                 title={`${b.itens} serviços · ${b.medidos} medidos · ${fmtMoedaK(b.custo)}`}>
              {b.num != null ? `${b.num}. ` : ''}{b.nome}
            </div>

            <div style={{ flex: 1, display: 'flex', height: 13, borderRadius: 7,
                          overflow: 'hidden', background: 'var(--bg3)' }}>
              <div style={{ width: exec + '%', background: VERDE }}
                   title={`executado ${fmtPct(exec, 1)}`} />
              <div style={{ width: atraso + '%', background: VERM }}
                   title={`atraso ${fmtPct(atraso, 1)}`} />
              <div style={{ width: falta + '%', background: AZUL, opacity: .55 }}
                   title={`a executar ${fmtPct(falta, 1)}`} />
            </div>

            <div style={{ width: 62, textAlign: 'right', font: '600 12px var(--mono)' }}>
              {fmtPct(exec, 1)}
            </div>
            <div style={{ width: 62, textAlign: 'right', font: '600 12px var(--mono)',
                          color: corDv }}>
              {(b.desvio > 0 ? '+' : '') + fmtPct(b.desvio, 1)}
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 18, marginTop: 16, flexWrap: 'wrap' }}>
        {[[VERDE, 'Executado'], [VERM, 'Atraso'], [AZUL, 'A executar']].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 7,
                                 fontSize: 11, color: 'var(--text2)' }}>
            <span style={{ width: 13, height: 13, borderRadius: 3, background: c,
                           opacity: c === AZUL ? .55 : 1 }} />
            {l}
          </span>
        ))}
      </div>

      <div className="notas-box" style={{ marginTop: 16 }}>
        A barra <b>vermelha</b> é a distância entre o que está pronto e o que o cronograma
        esperava até agora. A <b>azul</b> é o que ainda falta no total, e sem vermelho
        significa que a frente está em dia ou adiantada. Passe o mouse na barra para os
        valores, e no nome para ver quantos serviços já foram medidos.
      </div>
    </div>
  )
}
