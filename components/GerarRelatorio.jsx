// Botão "Gerar relatório" da Visão geral (pedido 16): escolhe a data inicial e a final do período (padrão: mês
// anterior fechado; atalhos "última semana", "último mês", "desde o início") e abre o relatório gerencial
// (pages/relatorio.js) numa aba nova, pronto para imprimir / salvar em PDF. Datas no fuso de São Paulo.
import { useState } from 'react'
import { hojeSaoPaulo, semanaAtualObra } from '../lib/constants'
import { datasDaSemana } from '../lib/calendario'

const ultimoDiaMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()   // mes 1–12
function mesAnterior() {
  const [y, m] = hojeSaoPaulo().split('-').map(Number)
  const ano = m === 1 ? y - 1 : y, mes = m === 1 ? 12 : m - 1
  const mm = String(mes).padStart(2, '0')
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${String(ultimoDiaMes(ano, mes)).padStart(2, '0')}` }
}
function ultimaSemana() {
  const hoje = hojeSaoPaulo()
  let s = semanaAtualObra()
  if (datasDaSemana(s).data_fim > hoje) s -= 1                       // semana ainda aberta: a anterior
  if (s < 1) s = 1
  return { de: datasDaSemana(s).data_inicio, ate: datasDaSemana(s).data_fim }
}
const desdeInicio = () => ({ de: datasDaSemana(1).data_inicio, ate: hojeSaoPaulo() })

export default function GerarRelatorio() {
  const [aberto, setAberto] = useState(false)
  const [p, setP] = useState(mesAnterior)
  const ok = p.de && p.ate && p.de <= p.ate
  const abrir = () => ok && window.open(`/relatorio?de=${p.de}&ate=${p.ate}`, '_blank')
  return (
    <span style={{ position: 'relative' }}>
      <button className="btn-sm" onClick={() => setAberto((v) => !v)} title="Relatório da obra para os gestores, em PDF">
        Gerar relatório {aberto ? '▴' : '▾'}
      </button>
      {aberto && (
        <div className="card" style={{ position: 'absolute', zIndex: 20, top: 34, left: 0, width: 330, margin: 0, padding: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Relatório da obra</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <label style={{ flex: 1, fontSize: 11, color: 'var(--text2)' }}>Data inicial
              <input type="date" value={p.de} max={p.ate} onChange={(e) => setP({ ...p, de: e.target.value })} style={{ width: '100%' }} />
            </label>
            <label style={{ flex: 1, fontSize: 11, color: 'var(--text2)' }}>Data final
              <input type="date" value={p.ate} min={p.de} onChange={(e) => setP({ ...p, ate: e.target.value })} style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="btn-sm" onClick={() => setP(ultimaSemana())}>Última semana</button>
            <button className="btn-sm" onClick={() => setP(mesAnterior())}>Último mês</button>
            <button className="btn-sm" onClick={() => setP(desdeInicio())}>Desde o início</button>
          </div>
          <button className="btn-primary" disabled={!ok} onClick={abrir} style={{ width: '100%' }}>Abrir relatório</button>
          <div className="kpi-sub" style={{ marginTop: 8 }}>
            Abre numa aba nova. Lá, "Baixar PDF" → destino "Salvar como PDF".
          </div>
        </div>
      )}
    </span>
  )
}
