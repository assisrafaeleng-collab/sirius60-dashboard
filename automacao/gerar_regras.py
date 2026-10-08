"""
Gera regras.csv a partir de fechamentos já feitos manualmente (Sirius 60: aba Lançamentos do consolidado).
Uso: py gerar_regras.py fechamentos/Dashboard_Custos_SIRIUS_60_Consolidado_Mai-Set-2026.xlsx [outro.xlsx ...]
O consolidado já traz o CNPJ/CPF de cada lançamento (no Flats ele vinha do relatório TOTVS ao lado).
- Linha com Confiança BAIXA não vira regra: o fornecedor que só tem linhas BAIXA vira regra 'pendente'.
- Linha com valor zero (líquido em branco no TOTVS) não ensina nada e fica de fora.
- Sericita (Giuliano): cada vale e NF é rateado pelo BM em decisoes_pontuais.csv (CLAUDE.md); aqui ela
  vira regra 'pendente', para título novo sem decisão ir para a fila.
"""
import sys, pandas as pd
from util import norm, raiz_cnpj, padronizar, tokens

SIN_FECH = {'eap': ['codigo da eap'], 'fornecedor': ['fornecedor'], 'documento': ['no documento'],
            'item': ['item comprado (historico / descricao)', 'historico / descricao', 'historico'],
            'valor': ['valor (r$)'], 'cnpj': ['cnpj/cpf'], 'confianca': ['confianca'], 'fonte': ['fonte'],
            'mes': ['mes de competencia']}
OBRIG = ['eap', 'fornecedor', 'documento', 'item', 'valor', 'cnpj']
CNPJ_SERICITA = '23668984'

def carregar(fech):
    d = padronizar(pd.read_excel(fech, sheet_name='Lançamentos'), SIN_FECH, OBRIG, fech)
    d = d.dropna(subset=['eap'])
    d['forn'] = d['fornecedor'].map(norm)
    d['cnpj'] = d['cnpj'].map(raiz_cnpj)
    d['item'] = d['item'].map(norm)
    d['eap'] = d['eap'].astype(str).str.strip()
    d['valor'] = pd.to_numeric(d['valor'], errors='coerce').fillna(0)
    d['baixa'] = d.get('confianca', pd.Series('', index=d.index)).astype(str).str.upper().str.startswith('BAIXA')
    return d[['cnpj', 'forn', 'item', 'eap', 'valor', 'documento', 'baixa']]

if __name__ == "__main__":
    args = sys.argv[1:] or ['fechamentos/Dashboard_Custos_SIRIUS_60_Consolidado_Mai-Set-2026.xlsx']
    d = pd.concat([carregar(f) for f in args])
    d = d[d.valor.abs() >= 0.01]
    sem_cnpj = d[d.cnpj == ''].forn.unique()
    if len(sem_cnpj): print('AVISO: fornecedores sem CNPJ no fechamento (regra por nome):', list(sem_cnpj))

    regras = []
    seri = d[d.cnpj == CNPJ_SERICITA]
    if len(seri):
        regras.append(dict(cnpj=CNPJ_SERICITA, fornecedor=seri.forn.iloc[0], padrao_item='*', tipo='pendente', eap='',
                           obs='Sericita: vale/NF rateados pelo BM em decisoes_pontuais.csv (CLAUDE.md)'))
    d = d[d.cnpj != CNPJ_SERICITA]
    # confiança BAIXA: não ensina regra; fornecedor só com linhas BAIXA vai sempre para a fila
    for (c, f), g in d.groupby(['cnpj', 'forn']):
        if g.baixa.all():
            sug = '; '.join(sorted(g.eap.unique()))
            regras.append(dict(cnpj=c, fornecedor=f, padrao_item='*', tipo='pendente', eap='',
                               obs=f'Confiança BAIXA no consolidado (EAP usada lá: {sug}) — decida e vire regra'))
    # itens com as mesmas palavras significativas (ex.: 'REF FATURA 141 JOSE...' e '...142...') formam um só grupo
    d = d.assign(assinatura=d['item'].map(lambda i: ' '.join(sorted(tokens(i)))))
    so_baixa = d.groupby(['cnpj', 'forn']).baixa.transform('all')
    for (c, f, a), g in d[~so_baixa].groupby(['cnpj', 'forn', 'assinatura']):
        eaps = g.groupby('eap').valor.sum()
        i = g['item'].iloc[0]
        if not a or ' + ' in i:
            continue
        if g.baixa.any():
            # item com alguma linha BAIXA (fornecedor que também tem linhas confiáveis): vai para a fila
            regras.append(dict(cnpj=c, fornecedor=f, padrao_item=i, tipo='pendente', eap='',
                               obs=f'Confiança BAIXA no consolidado (EAP usada lá: {"; ".join(sorted(eaps.index))}) — decida e vire regra'))
            continue
        if len(eaps) > 1:
            continue
        regras.append(dict(cnpj=c, fornecedor=f, padrao_item=i, tipo='fixa', eap=eaps.index[0], obs=f'{len(g)} lanç.'))
    ok = d[~d.baixa]
    for (c, f), g in ok.groupby(['cnpj', 'forn']):
        eaps = g.groupby('eap').valor.sum()
        if len(eaps) == 1:
            regras.append(dict(cnpj=c, fornecedor=f, padrao_item='*', tipo='fixa', eap=eaps.index[0], obs=f'{len(g)} lanç.'))
        else:
            dist = '; '.join(f'{e}={v / eaps.sum():.1%}' for e, v in eaps.sort_values(ascending=False).items())
            regras.append(dict(cnpj=c, fornecedor=f, padrao_item='*', tipo='pendente', eap='',
                               obs=f'Histórico em várias EAPs: {dist}'))
    # regras por valor (VALOR=x) ficam em regras_manuais.csv, que é local e tem prioridade
    pd.DataFrame(regras).to_csv('regras.csv', index=False, encoding='utf-8-sig')
    # parcelas: a mesma NF (ex.: 950513/01 e 950513/02) repete o rateio já decidido
    ok = ok.assign(nf_base=ok['documento'].astype(str).str.strip().str.extract(r'^0*(\d+)/\d+$')[0])
    par = ok.dropna(subset=['nf_base']).groupby(['cnpj', 'nf_base', 'eap']).valor.sum().reset_index()
    par['proporcao'] = par.valor / par.groupby(['cnpj', 'nf_base']).valor.transform('sum')
    par[['cnpj', 'nf_base', 'eap', 'proporcao']].to_csv('regras_parcelas.csv', index=False, encoding='utf-8-sig')
    t = pd.DataFrame(regras)
    print(len(regras), 'regras geradas de', len(d) + len(seri), 'lançamentos |',
          (t.tipo == 'fixa').sum(), 'fixas,', (t.tipo == 'pendente').sum(), 'pendentes')
