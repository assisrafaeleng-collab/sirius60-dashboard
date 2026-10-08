"""
Gera orcamento.csv a partir de public/dados.json (o orçamento que o dashboard usa).
Uso: py gerar_orcamento.py [../public/dados.json]
Uma linha por código + pavimento: codigo_eap, pavimento, descricao, orcado, grupo, grupo_nome.
"""
import sys, json
import pandas as pd

src = sys.argv[1] if len(sys.argv) > 1 else '../public/dados.json'
d = json.load(open(src, encoding='utf-8'))
o = pd.DataFrame([{'codigo_eap': i['i'], 'pavimento': i['p'], 'descricao': i['d'], 'orcado': round(float(i['c']), 2),
                   'grupo': i['g'], 'grupo_nome': i['n']} for i in d])
o.to_csv('orcamento.csv', index=False, encoding='utf-8-sig')
print(f'{len(o)} linhas | {o.codigo_eap.nunique()} códigos | orçado R$ {o.orcado.sum():,.2f}')
