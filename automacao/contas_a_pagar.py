"""
Contas a pagar do fechamento (card do dashboard; NÃO é custo realizado). Sirius 60, adaptado do Flats.
Uso: py contas_a_pagar.py --fechamento 2026-09 [--fonseca arq.xlsx] [--dinamica arq.xlsx] [--oc pasta] [--saida saida_v2]
Saída: <saida>/contas_AAAA-MM.csv (uma linha por título e EAP) e <saida>/contas_AAAA-MM_fora.csv (o que saiu e por quê)

Regras (CLAUDE.md, "Contas a pagar", decisões de 08/10/2026):
- Fonte: os relatórios completos ("Relatório de Custo ...") da Fonseca e da Dinâmica; as duas podem ter
  título a pagar (decisão 08/10/2026, pedido 8).
- A pagar = não estava pago no fechamento: Data de Baixa vazia OU Data de Baixa depois do último dia do mês
  do fechamento (ex.: NF do BM4 baixada em 02/10 estava a pagar em 30/09). Não se olha o valor baixado.
- Filtros, nesta ordem: (a) vales/adiantamentos da Sericita e decisões NAO_CUSTO (decisoes_pontuais.csv, ex.:
  Caixa Cartões); (b) previsões das OCs 1787 e 1849;
  (c) duplicidade (mesmo CNPJ + documento já pago em qualquer fonte ou no custo gravado; mesmo CNPJ + valor
  com data a até 5 dias de um título pago; previsão de OC já faturada; BM já pago); (d) vencimento antes do
  mês do fechamento, EXCETO parcela pendente de NF com outra parcela já paga; (e) o resto = contas a pagar.
- EAP pelas mesmas regras e decisões do classificador. direto/indireto pela EAP (19.x = indireto).
- Recorrente (regra do Flats; sai do card e do IPC, mas fica marcado): grupo 17 (locação, estadia 17.1.13,
  alimentação), grupo 18 (funcionários e diárias), 1.1.6 (consumo mensal). Indireto recorrente: o importar.js
  marca pela tabela custos_indiretos_planejados (coluna recorrente), que só ele lê.
- Alertas: fornecedor novo; valor mais de 50% acima da média do fornecedor; previsão sem nota há mais de 1 mês.
"""
import argparse, glob, os, re, json
import pandas as pd
import classificador as C

EXCLUIR_OC = {'1787', '1849'}
SERICITA = '23668984'


def ler_fonseca(path):
    t = C.padronizar(pd.read_excel(path), origem=path)
    t = t[t.documento.notna() & C.e_sirius(t.cc)]
    return pd.DataFrame({
        'fonte': 'Fonseca',
        'ref': t.ref.astype(str).str.replace(r'\.0$', '', regex=True),
        'documento': t.documento.astype(str).str.strip(),
        'fornecedor': t.nome.map(C.norm),
        'cnpj': t.cnpj.map(C.raiz_cnpj),
        'historico': t.historico.map(C.norm),
        'emissao': pd.to_datetime(t.emissao, errors='coerce'),
        'vencimento': pd.to_datetime(t.vencimento, errors='coerce'),
        'previsao': pd.to_datetime(t.prev_baixa, errors='coerce') if 'prev_baixa' in t else pd.NaT,
        'baixa': pd.to_datetime(t.baixa, errors='coerce'),
        'baixado': pd.to_numeric(t.baixado, errors='coerce').fillna(0),
        # valor do título: líquido; previsão sem líquido usa o original
        'valor': pd.to_numeric(t.liquido, errors='coerce').fillna(pd.to_numeric(t.original, errors='coerce')).round(2),
    }).reset_index(drop=True)


def ler_dinamica(path):
    r = C.ler_rateio(path)
    b = C.padronizar(pd.read_excel(path, dtype={'REF_LANCTO': str}), C.SIN_RATEIO, C.SIN_RATEIO.keys(), path)
    b = b[C.e_sirius(b.cc) & (b.pagar_receber.astype(str).str.upper() == 'PAGAR')].reset_index(drop=True)
    return pd.DataFrame({
        'fonte': 'Dinâmica', 'ref': r.ref, 'documento': r.documento, 'fornecedor': r.fornecedor, 'cnpj': r.cnpj,
        'historico': r.historico, 'emissao': pd.to_datetime(r.emissao), 'vencimento': pd.to_datetime(r.vencimento),
        'previsao': pd.NaT, 'baixa': pd.to_datetime(b.baixa, errors='coerce'),
        'baixado': pd.to_numeric(b.baixado, errors='coerce').fillna(0), 'valor': r.valor,
    })


def base_nf(d):
    return str(d).split('/')[0].lstrip('0')


def parcela(d):
    m = re.match(r'^0*\d+/(\d+)$', str(d).strip())
    return m.group(1) if m else ''


def custo_gravado(pasta):
    """lançamentos de custo da saída do classificador (é o que está no banco depois da carga)"""
    fs = glob.glob(os.path.join(pasta, '*', 'lancamentos.csv'))
    if not fs:
        return pd.DataFrame(columns=['cnpj', 'documento', 'valor', 'competencia'])
    l = pd.concat([pd.read_csv(f, dtype=str, encoding='utf-8-sig') for f in fs], ignore_index=True)
    l['valor'] = l.valor.astype(float)
    return l


def recorrente_direto(eap):
    g = str(eap).split('.')[0]
    if g in ('17', '18'):
        return 'sim'
    if eap == '1.1.6':
        return 'sim'
    if g == '19':
        return 'verificar (indiretos recorrentes: o importar.js marca pelo banco)'
    return 'não'


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--fechamento', required=True, help='AAAA-MM')
    ap.add_argument('--fonseca'); ap.add_argument('--dinamica')
    ap.add_argument('--oc', default='oc'); ap.add_argument('--saida', default='saida_v2')
    a = ap.parse_args()
    fech = a.fechamento
    if not re.fullmatch(r'\d{4}-\d{2}', fech):
        raise SystemExit('--fechamento AAAA-MM')
    inicio = pd.Timestamp(f'{fech}-01')
    fim = inicio + pd.offsets.MonthEnd(0)
    F = a.fonseca or C.mais_recente_padrao('entrada/fonseca', 'Relatório de Custo*')
    D = a.dinamica or C.mais_recente_padrao('entrada/dinamica', 'Relatório de Custo*')
    print(f'Fonseca: {F}\nDinâmica: {D}\nFechamento {fech}: em aberto em {fim:%d/%m/%Y}')

    fon, din = ler_fonseca(F), ler_dinamica(D)
    tudo = pd.concat([fon, din], ignore_index=True)
    # a pagar = não estava pago no fechamento: baixa vazia ou baixa depois do último dia do mês (pedido 8)
    tudo['pago_no_fech'] = tudo.baixa.notna() & (tudo.baixa <= fim)
    gravado = custo_gravado(a.saida)
    ocs = C.ler_ocs(a.oc)
    regras = C.carregar_regras()

    aberto = tudo[~tudo.pago_no_fech].copy()
    aberto['motivo'] = ''
    depois = aberto[aberto.baixa.notna()]
    print(f'\nEm aberto em {fim:%d/%m/%Y}: Fonseca {sum(aberto.fonte == "Fonseca")} linha(s) | Dinâmica {sum(aberto.fonte == "Dinâmica")} linha(s)')
    for t in depois.itertuples():
        print(f'  pago depois do fechamento ({t.baixa:%d/%m/%Y}): {t.fonte} {t.documento} {t.fornecedor[:34]} R$ {t.valor:,.2f}')

    def marcar(filtro, mask, motivo):
        m = (aberto.motivo == '') & mask
        aberto.loc[m, 'motivo'] = motivo if isinstance(motivo, str) else motivo[m]
        print(f'  {filtro}: {int(m.sum())} linha(s) | R$ {aberto.loc[m, "valor"].sum():,.2f}')

    # (a) vales / adiantamentos da Sericita
    vale = (aberto.cnpj == SERICITA) & (aberto.documento.str.upper().str.contains('ADIANT')
                                        | aberto.historico.str.contains('ADIANT') | aberto.documento.str.match(r'^0{8,}'))
    marcar('(a) vales/adiantamentos da Sericita', vale, '(a) vale/adiantamento da Sericita (nunca entra)')
    try:
        dp = pd.read_csv('decisoes_pontuais.csv', dtype=str).fillna('')
        nc = set(zip(dp[dp.eap == 'NAO_CUSTO'].cnpj, dp[dp.eap == 'NAO_CUSTO'].documento))
    except FileNotFoundError:
        nc = set()
    marcar('(a) decisão NAO_CUSTO', pd.Series([(c, d) in nc for c, d in zip(aberto.cnpj, aberto.documento)], index=aberto.index),
           '(a) decisão NAO_CUSTO (decisoes_pontuais.csv)')
    # (b) OCs 1787 e 1849
    ocn = aberto.historico.str.extract(r'\bOC\s*0*(\d+)')[0].fillna('')
    marcar('(b) OCs 1787 e 1849', ocn.isin(EXCLUIR_OC), '(b) previsão da OC 1787/1849 (CLAUDE.md)')
    # (c) duplicidade
    pagos = tudo[tudo.pago_no_fech]
    dup = pd.Series('', index=aberto.index)
    for i, t in aberto[aberto.motivo == ''].iterrows():
        p = pagos[(pagos.cnpj == t.cnpj) & (pagos.documento == t.documento)]
        g = gravado[(gravado.cnpj == t.cnpj) & (gravado.documento == t.documento)]
        perto = pagos[(pagos.cnpj == t.cnpj) & ((pagos.valor - t.valor).abs() < 0.005)
                      & ((pagos.baixa - (t.vencimento if pd.notna(t.vencimento) else t.emissao)).abs() <= pd.Timedelta(days=5))]
        prev = bool(re.search(r'PREV\.?\s*FINANC', t.historico))
        o = ocn[i]
        faturada = prev and o and len(ocs[(ocs.oc == o) & ocs.nf.notna()])
        bm = t.cnpj == SERICITA and 'MEDI' in t.documento.upper() and len(gravado[(gravado.cnpj == SERICITA) & (gravado.documento == t.documento)])
        if len(p):
            dup[i] = f'(c) mesmo CNPJ + documento já pago ({p.fonte.iloc[0]}, baixa {p.baixa.iloc[0]:%d/%m/%Y})'
        elif len(g):
            dup[i] = '(c) mesmo CNPJ + documento já no custo gravado'
        elif bm:
            dup[i] = '(c) BM já pago'
        elif faturada:
            dup[i] = f'(c) previsão da OC {o}, que já tem NF lançada'
        elif len(perto):
            dup[i] = f'(c) mesmo CNPJ + valor de {perto.documento.iloc[0]} pago em {perto.baixa.iloc[0]:%d/%m/%Y}'
    marcar('(c) duplicidade', dup != '', dup)
    # (d) vencimento antes do mês do fechamento, exceto parcela pendente de compra parcelada
    venc = aberto.vencimento.fillna(aberto.emissao)
    irma_paga = pd.Series([len(pagos[(pagos.cnpj == t.cnpj) & (pagos.documento.map(base_nf) == base_nf(t.documento))
                                     & (pagos.documento != t.documento)]) > 0 and parcela(t.documento) != ''
                           for t in aberto.itertuples()], index=aberto.index)
    marcar(f'(d) vencimento antes de {inicio:%d/%m/%Y}', (venc < inicio) & ~irma_paga, f'(d) vencimento antes de {inicio:%d/%m/%Y}')
    entra = aberto[aberto.motivo == ''].reset_index(drop=True)
    print(f'  (e) contas a pagar: {len(entra)} linha(s) | R$ {entra.valor.sum():,.2f}')

    # EAP pelas regras do classificador
    tit = pd.DataFrame({'fonte': entra.fonte, 'ref': entra.ref, 'documento': entra.documento, 'fornecedor': entra.fornecedor,
                        'cnpj': entra.cnpj, 'historico': entra.historico, 'emissao': entra.emissao.dt.date,
                        'competencia': entra.vencimento.dt.date, 'vencimento': entra.vencimento.dt.date,
                        'valor_original': entra.valor, 'valor': entra.valor})
    lanc, pend = C.classificar(tit, ocs, regras) if len(tit) else (pd.DataFrame(), pd.DataFrame())
    linhas = pd.concat([lanc, pend], ignore_index=True) if len(pend) else lanc
    assert abs(round(linhas.valor.sum(), 2) - round(entra.valor.sum(), 2)) < 0.01, 'total não fecha'

    # um título pode vir em várias linhas (Dinâmica: uma por natureza do rateio, ex. Betonita 616 material + bomba)
    ent_k = entra.assign(k=entra.cnpj + '|' + entra.documento)
    info = ent_k.drop_duplicates('k').set_index('k')
    valor_titulo = ent_k.groupby('k').valor.sum().round(2)
    linhas['k'] = linhas.cnpj + '|' + linhas.documento
    linhas['seq'] = linhas.groupby('k').cumcount() + 1
    linhas['parcela'] = linhas.documento.map(parcela)
    linhas['emissao'] = linhas.k.map(info.emissao).dt.strftime('%Y-%m-%d')
    linhas['vencimento'] = linhas.k.map(info.vencimento).dt.strftime('%Y-%m-%d')
    linhas['valor_titulo'] = linhas.k.map(valor_titulo)
    linhas['historico'] = linhas.k.map(info.historico)
    linhas['eap'] = linhas.eap.fillna('')
    linhas['classe'] = linhas.eap.map(lambda e: 'pendente' if not e else ('indireto' if e.startswith('19.') else 'direto'))
    linhas['natureza'] = linhas.historico.map(lambda h: 'previsto_sem_nf' if re.search(r'PREV\.?\s*FINANC', str(h)) else 'nf')
    linhas['recorrente'] = linhas.eap.map(recorrente_direto)

    # alertas
    hist = pd.concat([gravado.assign(doc=gravado.documento)[['cnpj', 'doc', 'valor']],
                      pagos.assign(doc=pagos.documento)[['cnpj', 'doc', 'valor']]]).drop_duplicates()
    por_doc = hist.groupby(['cnpj', 'doc']).valor.sum().reset_index()
    al = {}
    for k, t in info.iterrows():
        x, v = [], valor_titulo[k]
        h = por_doc[por_doc.cnpj == t.cnpj]
        if not len(h):
            x.append('fornecedor novo')
        elif v > 1.5 * h.valor.mean():
            x.append(f'valor {v / h.valor.mean() - 1:.0%} acima da média do fornecedor ({C.brl(h.valor.mean())} em {len(h)} título(s))')
        if re.search(r'PREV\.?\s*FINANC', t.historico) and pd.notna(t.emissao) and t.emissao < fim - pd.DateOffset(months=1):
            x.append(f'previsão sem nota desde {t.emissao:%d/%m/%Y}')
        al[k] = ' | '.join(x)
    linhas['alertas'] = linhas.k.map(al).fillna('')
    linhas['competencia_fechamento'] = fech
    linhas['competencia_vencimento'] = linhas.vencimento.str[:7]

    cols = ['competencia_fechamento', 'competencia_vencimento', 'fonte', 'cnpj', 'fornecedor', 'documento', 'parcela', 'seq',
            'historico', 'item', 'oc', 'emissao', 'vencimento', 'valor_titulo', 'valor', 'eap', 'classe', 'natureza',
            'recorrente', 'vinculo_oc', 'regra', 'alertas', 'pavimento']
    os.makedirs(a.saida, exist_ok=True)
    out = os.path.join(a.saida, f'contas_{fech}.csv')
    linhas.reindex(columns=cols).to_csv(out, index=False, encoding='utf-8-sig')
    fora = aberto[aberto.motivo != ''][['fonte', 'cnpj', 'fornecedor', 'documento', 'historico', 'emissao', 'vencimento', 'baixa', 'valor', 'motivo']]
    fora.to_csv(os.path.join(a.saida, f'contas_{fech}_fora.csv'), index=False, encoding='utf-8-sig')
    resumo = {'fechamento': fech, 'linhas': len(linhas), 'titulos': int(linhas.k.nunique()), 'total': round(float(linhas.valor.sum()), 2)}
    json.dump(resumo, open(os.path.join(a.saida, f'contas_{fech}_resumo.json'), 'w', encoding='utf-8'), ensure_ascii=False)

    print(f'\n{out}: {resumo["titulos"]} título(s), {resumo["linhas"]} linha(s) | R$ {resumo["total"]:,.2f}')
    for (cl, rec), g in linhas.groupby(['classe', 'recorrente']):
        print(f'  {cl:9s} recorrente={rec[:3]:3s} | R$ {g.valor.sum():,.2f}')
    cd = linhas[(linhas.classe == 'direto') & (linhas.recorrente == 'não')].valor.sum()
    print(f'  CUSTO DIRETO A PAGAR (direto, não recorrente; vai para o card e o IPC): R$ {cd:,.2f}')
    if (linhas.classe == 'pendente').any():
        print(f'  PENDÊNCIAS: {int((linhas.classe == "pendente").sum())} linha(s) sem EAP')
