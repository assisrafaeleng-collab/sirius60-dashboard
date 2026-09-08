import { useMemo, useState } from 'react'
import { fmtMoedaK, fmtPct } from '../lib/constants'

// Ordem física, do térreo para cima. Áreas sem pavimento vão para o fim.
const ORDEM = ['Reservatório', 'Terraço', '3º Pav', '2º Pav', '1º Pav', 'Térreo',
               'Pilotis', 'Subsolo', 'Fundação', 'Edifício', 'Externo', 'Canteiro']

const SIGLA = {
  1: 'PRELIM', 2: 'FUNDAÇ', 3: 'ESTRUT', 4: 'ALVEN', 5: 'REBOCO', 6: 'HIDRO',
  7: 'ELÉTR', 8: 'INSTESP', 9: 'COBERT', 10: 'GESSO', 11: 'PISOS', 12: 'ESQUAD',
  13: 'PINTURA', 14: 'LOUÇAS', 15: 'URBAN', 16: 'FINAIS',
}

// Avanço de cada pavimento em cada macrogrupo, comparado ao que o
// cronograma esperava até a semana. Serviço sem medição conta como zero.
export default function MapaPavimentos({ itens, medido, semana, base }) {
  const [foco, setFoco] = useState(null)
  const porHora = base === 'horas'
  // o peso da célula segue a base escolhida no dashboard
  const pesoDe = i => porHora ? i.h : i.c
  if (!itens || !medido) return null

  const planDe = i => {
    if (semana >= i.b) return 100
    if (semana < i.a) return 0
    return 100 * (semana - i.a + 1) / (i.b - i.a + 1)
  }

  const grade = useMemo(() => {
    const m = {}
    itens.forEach(i => {
      if (!m[i.p]) m[i.p] = {}
      if (!m[i.p][i.g]) m[i.p][i.g] = { peso: 0, custo: 0, horas: 0, plan: 0, real: 0,
                                        itens: 0, medidos: 0, ativos: 0 }
      const c = m[i.p][i.g]
      const med = medido[`${i.i}|${i.p}`]
      const w = pesoDe(i)
      c.peso += w
      c.custo += i.c
      c.horas += i.h
      // serviço que o cronograma já iniciou, tenha ou não peso nesta base
      if (planDe(i) > 0) c.ativos++
      c.plan += w * planDe(i) / 100
      c.real += w * (med ? med.percentual : 0) / 100
      c.itens++
      if (med) c.medidos++
    })
    return m
  }, [itens, medido, semana, base])

  const pavs = ORDEM.filter(p => grade[p])
  const grupos = [...new Set(itens.map(i => i.g))].sort((a, b) => a - b)

  function celula(pav, g) {
    const c = grade[pav]?.[g]
    if (!c || c.itens === 0) return null
    // há serviço em andamento, mas ele não tem peso nesta base
    // (ex.: contenções custam R$ 200 mil e não têm hora no cronograma)
    if (c.peso <= 0) {
      return c.ativos > 0
        ? { tipo: 'sembase', c, planPct: null, realPct: null }
        : null
    }
    const planPct = 100 * c.plan / c.peso
    const realPct = 100 * c.real / c.peso
    if (planPct <= 0 && realPct <= 0) return { tipo: 'futuro', c, planPct, realPct }
    const desvio = realPct - planPct
    const tipo = desvio >= -2 ? 'ok' : desvio >= -15 ? 'atencao' : 'atrasado'
    return { tipo, c, planPct, realPct, desvio }
  }

  const COR = {
    ok:       { bg: 'rgba(77,155,106,.85)',  tx: '#fff' },
    atencao:  { bg: 'rgba(200,134,10,.85)',  tx: '#fff' },
    atrasado: { bg: 'rgba(176,48,48,.85)',   tx: '#fff' },
    futuro:   { bg: 'var(--bg3)',            tx: 'var(--text3)' },
    sembase:  { bg: 'transparent',           tx: 'var(--text3)' },
  }

  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span>Mapa de avanço por pavimento</span>
        <span className="kpi-sub">
          ponderado por {porHora ? 'horas de mão de obra' : 'custo do orçamento'}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '2px', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', minWidth: 96, fontSize: 10 }}>Pav</th>
              {grupos.map(g => (
                <th key={g} style={{ minWidth: 58, padding: '4px 2px' }}>
                  <div style={{ font: '600 11px var(--mono)', color: 'var(--text2)' }}>{g}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.02em' }}>
                    {SIGLA[g] || g}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pavs.map(pav => (
              <tr key={pav}>
                <td style={{ font: '600 12px "IBM Plex Sans"', whiteSpace: 'nowrap' }}>{pav}</td>
                {grupos.map(g => {
                  const cel = celula(pav, g)
                  if (!cel) return <td key={g} />
                  const cor = COR[cel.tipo]
                  const k = pav + '|' + g
                  return (
                    <td key={g}
                        onMouseEnter={() => setFoco({ ...cel, pav, g })}
                        onMouseLeave={() => setFoco(null)}
                        title={cel.tipo === 'sembase'
                          ? `Em andamento, mas sem ${porHora ? 'horas' : 'custo'} no cronograma — troque a base para medir`
                          : undefined}
                        style={{ background: cor.bg, color: cor.tx, borderRadius: 5,
                                 textAlign: 'center', padding: '9px 4px', cursor: 'default',
                                 font: '600 11px var(--mono)',
                                 border: cel.tipo === 'sembase'
                                   ? '1px dashed var(--border2)' : 'none',
                                 outline: foco && foco.pav === pav && foco.g === g
                                   ? '2px solid var(--accent)' : 'none' }}>
                      {cel.tipo === 'futuro' ? ''
                        : cel.tipo === 'sembase' ? '?'
                        : fmtPct(cel.realPct, 0)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* leitura da célula sob o cursor */}
      <div style={{ minHeight: 52, marginTop: 10 }}>
        {foco ? (
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center',
                        padding: '10px 14px', background: 'var(--bg3)', borderRadius: 9,
                        border: '1px solid var(--border)' }}>
            <div style={{ font: '600 12px "IBM Plex Sans"' }}>
              {foco.pav} · {SIGLA[foco.g] || foco.g}
            </div>
            {foco.tipo === 'sembase' ? (
              <div style={{ fontSize: 12, color: 'var(--amber-tx)' }}>
                {foco.c.ativos} serviço{foco.c.ativos === 1 ? '' : 's'} em andamento, mas
                sem {porHora ? 'horas' : 'custo'} no cronograma — troque a base acima
                para {porHora ? 'custo' : 'horas'} e este bloco passa a aparecer.
              </div>
            ) : (
              <>
                <div>
                  <div className="kpi-sub">Planejado</div>
                  <div style={{ font: '600 13px var(--mono)', color: '#5B9BD5' }}>
                    {fmtPct(foco.planPct, 1)}
                  </div>
                </div>
                <div>
                  <div className="kpi-sub">Executado</div>
                  <div style={{ font: '600 13px var(--mono)', color: '#E91E8C' }}>
                    {fmtPct(foco.realPct, 1)}
                  </div>
                </div>
              </>
            )}
            <div>
              <div className="kpi-sub">Serviços</div>
              <div style={{ font: '600 13px var(--mono)' }}>
                {foco.c.medidos} medidos de {foco.c.itens}
              </div>
            </div>
            <div>
              <div className="kpi-sub">{porHora ? 'Horas do bloco' : 'Custo do bloco'}</div>
              <div style={{ font: '600 13px var(--mono)' }}>
                {porHora
                  ? Math.round(foco.c.peso).toLocaleString('pt-BR') + ' h'
                  : fmtMoedaK(foco.c.custo)}
              </div>
            </div>
          </div>
        ) : (
          <div className="kpi-sub" style={{ textAlign: 'center', padding: '12px 0' }}>
            Passe o mouse sobre uma célula para ver planejado, executado e quantos
            serviços já foram medidos.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 10,
                    flexWrap: 'wrap' }}>
        {[['ok', 'Em dia'], ['atencao', 'Atenção'], ['atrasado', 'Atrasado'],
          ['futuro', 'Não iniciado'], ['sembase', 'Sem peso nesta base']].map(([t, l]) => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 7,
                                 fontSize: 11, color: 'var(--text2)' }}>
            <span style={{ width: 13, height: 13, borderRadius: 3, background: COR[t].bg,
                           border: t === 'futuro' ? '1px solid var(--border2)'
                                 : t === 'sembase' ? '1px dashed var(--border2)' : 'none' }} />
            {l}
          </span>
        ))}
      </div>

      <div className="kpi-sub" style={{ marginTop: 12, textAlign: 'center' }}>
        Cada célula mostra o executado do macrogrupo naquele pavimento, ponderado
        pela base escolhida acima. Verde é até 2 pontos abaixo do planejado; âmbar até 15; vermelho além disso.
        Célula vazia é serviço que o cronograma ainda não iniciou. Célula com <b>?</b> tem
        serviço em andamento sem peso nesta base — como as contenções, que custam
        R$ 200 mil e não têm hora prevista.
      </div>
    </div>
  )
}
