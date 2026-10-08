"""
Gera orcamento.csv a partir de public/dados.json (o orçamento que o dashboard usa)
mais as linhas de ajustes_orcamento.csv (decisões do Rafael que ainda não estão no
orçamento oficial; o dados.json não é alterado).
Uso: py gerar_orcamento.py [../public/dados.json]
Uma linha por código + pavimento: codigo_eap, pavimento, descricao, orcado, grupo, grupo_nome, origem.
"""
import sys, json, os
import pandas as pd

src = sys.argv[1] if len(sys.argv) > 1 else '../public/dados.json'
d = json.load(open(src, encoding='utf-8'))
o = pd.DataFrame([{'codigo_eap': i['i'], 'pavimento': i['p'], 'descricao': i['d'], 'orcado': round(float(i['c']), 2),
                   'grupo': i['g'], 'grupo_nome': i['n'], 'origem': 'dados.json'} for i in d])

# ajustes_orcamento.csv: codigo_eap;grupo;descricao;pavimento;valor_orcado;origem;data (valor com vírgula)
if os.path.exists('ajustes_orcamento.csv'):
    a = pd.read_csv('ajustes_orcamento.csv', sep=';', dtype=str, encoding='utf-8-sig').fillna('')
    repetidos = a[a.codigo_eap.isin(o.codigo_eap)]
    if len(repetidos):
        sys.exit(f'ERRO: ajustes_orcamento.csv repete código que já existe no dados.json: {", ".join(repetidos.codigo_eap)}')
    nomes = o.drop_duplicates('grupo').set_index(o.drop_duplicates('grupo').grupo.astype(str)).grupo_nome
    a = pd.DataFrame({'codigo_eap': a.codigo_eap, 'pavimento': a.pavimento, 'descricao': a.descricao,
                      'orcado': a.valor_orcado.str.replace('.', '', regex=False).str.replace(',', '.').astype(float).round(2),
                      'grupo': a.grupo.astype(int), 'grupo_nome': a.grupo.map(nomes).fillna(''),
                      'origem': 'ajuste: ' + a.origem + ' ' + a.data})
    print(f'ajustes_orcamento.csv: {len(a)} linha(s) | R$ {a.orcado.sum():,.2f} (ainda fora do orçamento oficial)')
    o = pd.concat([o, a], ignore_index=True)

o.to_csv('orcamento.csv', index=False, encoding='utf-8-sig')
print(f'{len(o)} linhas | {o.codigo_eap.nunique()} códigos | orçado R$ {o.orcado.sum():,.2f}')
