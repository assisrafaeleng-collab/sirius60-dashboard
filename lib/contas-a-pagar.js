// Contas a pagar (tabela contas_a_pagar, gravada pelo importar.js --contas; CLAUDE.md, 08/10/2026), copiado do
// Flats (lib/contas-a-pagar.js de lá). NÃO é custo realizado.
// Classe pela EAP: 19.x = indireto, o resto = direto, sem EAP = pendente. O card "Custo direto a pagar" e o custo
// comprometido das linhas somam só classe 'direto' e recorrente = false.
// Este arquivo não acessa o banco (a leitura fica em lib/painel-servidor.js).

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100

// último dia do mês 'AAAA-MM'
export const fimDoMes = (mes) => {
  const [y, m] = String(mes).split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

// Fechamento que vale para uma semana: o mais recente cujo último dia já passou no fim da semana.
export function fechamentoDaSemana(fechamentos, dataFimSemana) {
  return (fechamentos || []).filter((f) => fimDoMes(f) <= dataFimSemana).sort().pop() || null
}

export const entraNoCustoDireto = (l) => l.classe === 'direto' && !l.recorrente

export function resumirContas(linhas) {
  const tot = { direto: 0, direto_recorrente: 0, indireto: 0, pendente: 0, total: 0, custo_direto_a_pagar: 0 }
  const porMes = {}
  const titulos = new Map()
  ;(linhas || []).forEach((l) => {
    const v = Number(l.valor) || 0
    tot.total += v
    if (l.classe === 'pendente') tot.pendente += v
    else if (l.classe === 'indireto') tot.indireto += v
    else if (l.recorrente) tot.direto_recorrente += v
    else tot.direto += v
    if (entraNoCustoDireto(l)) tot.custo_direto_a_pagar += v
    const mes = l.competencia_vencimento || String(l.data_vencimento || '').slice(0, 7)
    if (!porMes[mes]) porMes[mes] = { mes, direto: 0, indireto: 0, pendente: 0, total: 0 }
    const pm = porMes[mes]
    pm.total += v
    if (l.classe === 'pendente') pm.pendente += v
    else if (l.classe === 'indireto') pm.indireto += v
    else pm.direto += v

    const k = `${l.fonte || ''}|${l.cnpj || ''}|${l.num_documento}`
    if (!titulos.has(k)) titulos.set(k, {
      chave: k, fornecedor: l.fornecedor, num_documento: l.num_documento,
      parcela: l.parcela || null,
      data_vencimento: l.data_vencimento, competencia_vencimento: mes, historico: l.historico, fonte: l.fonte,
      recorrente: !!l.recorrente, valor: 0, eaps: [], alertas: [],
    })
    const t = titulos.get(k)
    t.valor += v
    const e = t.eaps.find((x) => x.codigo_eap === (l.codigo_eap || null) && x.pavimento === (l.pavimento || null))
    if (e) e.valor += v
    else t.eaps.push({ codigo_eap: l.codigo_eap || null, pavimento: l.pavimento || null, classe: l.classe, valor: v })
    ;(l.alertas || []).forEach((a) => { if (!t.alertas.includes(a)) t.alertas.push(a) })
  })
  Object.keys(tot).forEach((k) => (tot[k] = r2(tot[k])))
  const meses = Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes))
    .map((m) => ({ ...m, direto: r2(m.direto), indireto: r2(m.indireto), pendente: r2(m.pendente), total: r2(m.total) }))
  const lista = Array.from(titulos.values())
    .map((t) => ({
      ...t, valor: r2(t.valor), eaps: t.eaps.map((e) => ({ ...e, valor: r2(e.valor) })),
      tipo: t.eaps.every((e) => e.classe === 'indireto') ? 'indireto'
        : t.eaps.some((e) => e.classe === 'pendente') ? 'pendente' : t.recorrente ? 'direto recorrente' : 'direto',
    }))
    .sort((a, b) => String(a.data_vencimento || '').localeCompare(String(b.data_vencimento || '')) || b.valor - a.valor)
  return { totais: tot, por_mes: meses, titulos: lista, n_titulos: lista.length, n_alertas: lista.filter((t) => t.alertas.length).length }
}
