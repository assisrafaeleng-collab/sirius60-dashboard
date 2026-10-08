"""Compara a saída do classificador com um fechamento manual: por mês e EAP, e título a título.
Uso: py comparar.py fechamentos/Dashboard_Custos_SIRIUS_60_Consolidado_Mai-Set-2026.xlsx 2026-05 2026-06 ...
Lê saida/AAAA-MM/lancamentos.csv e pendencias.csv (pendência entra com EAP vazia).
Grava saida/comparacao_eap.csv e saida/comparacao_titulos.csv."""
import sys, re, pandas as pd
from util import padronizar, norm, raiz_cnpj
from gerar_regras import SIN_FECH, OBRIG

MESES = {'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
         'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'}
def mes_iso(s):
    m = re.match(r'([a-z]{3})\w*/(\d{2,4})', str(s).strip().lower())
    return f"{2000 + int(m.group(2)) if len(m.group(2)) == 2 else m.group(2)}-{MESES[m.group(1)]}" if m else ''
def doc(s):
    s = str(s).strip()
    return re.sub(r' · .*$', '', s)          # '3ª MEDIÇÃO 28/08 · 2.1.2' -> '3ª MEDIÇÃO 28/08'

fech, meses = sys.argv[1], sys.argv[2:]
d = padronizar(pd.read_excel(fech, sheet_name='Lançamentos'), SIN_FECH, OBRIG + ['mes'], fech).dropna(subset=['eap'])
man = pd.DataFrame({'mes': d['mes'].map(mes_iso), 'eap': d['eap'].astype(str).str.strip(),
                    'cnpj': d['cnpj'].map(raiz_cnpj), 'fornecedor': d['fornecedor'].map(norm),
                    'documento': d['documento'].map(doc), 'fonte': d.get('fonte', ''),
                    'valor': pd.to_numeric(d['valor'], errors='coerce').fillna(0)})
man = man[man.mes.isin(meses)]

aut = []
for m in meses:
    for arq, tipo in (('lancamentos.csv', 'classificado'), ('pendencias.csv', 'pendente')):
        try:
            x = pd.read_csv(f'saida/{m}/{arq}', dtype=str).fillna('')
        except (FileNotFoundError, pd.errors.EmptyDataError):
            continue
        if not len(x):
            continue
        aut.append(pd.DataFrame({'mes': m, 'eap': x.codigo_eap.where(x.codigo_eap != '', '(pendente)'), 'cnpj': x.cnpj,
                                 'fornecedor': x.fornecedor, 'documento': x.documento.map(doc), 'fonte': x.fonte,
                                 'valor': pd.to_numeric(x.valor), 'tipo': tipo}))
aut = pd.concat(aut, ignore_index=True)

# ---- por mês e EAP ----
a = aut.groupby(['mes', 'eap']).valor.sum().rename('classificador')
b = man.groupby(['mes', 'eap']).valor.sum().rename('consolidado')
e = pd.concat([a, b], axis=1).fillna(0).round(2)
e['diferenca'] = (e.classificador - e.consolidado).round(2)
e.reset_index().to_csv('saida/comparacao_eap.csv', index=False, encoding='utf-8-sig')

# ---- título a título (CNPJ + documento) ----
ka = aut.groupby(['mes', 'cnpj', 'documento']).agg(fornecedor=('fornecedor', 'first'), fonte_classificador=('fonte', 'first'),
                                                    classificador=('valor', 'sum'), eap_classificador=('eap', lambda s: ';'.join(sorted(set(s)))))
kb = man.groupby(['mes', 'cnpj', 'documento']).agg(fornecedor_c=('fornecedor', 'first'), fonte_consolidado=('fonte', 'first'),
                                                   consolidado=('valor', 'sum'), eap_consolidado=('eap', lambda s: ';'.join(sorted(set(s)))))
t = pd.concat([ka, kb], axis=1)
t['fornecedor'] = t.fornecedor.fillna(t.fornecedor_c)
t[['classificador', 'consolidado']] = t[['classificador', 'consolidado']].fillna(0).round(2)
t['diferenca'] = (t.classificador - t.consolidado).round(2)
t = t.drop(columns='fornecedor_c').reset_index()
t.to_csv('saida/comparacao_titulos.csv', index=False, encoding='utf-8-sig')

for m in meses:
    em = e.loc[m] if m in e.index.get_level_values(0) else e.iloc[0:0]
    tm = t[t.mes == m]
    tot_a, tot_b = em.classificador.sum(), em.consolidado.sum()
    certo = sum(min(r.classificador, r.consolidado) for r in em.itertuples() if r.classificador > 0 and r.consolidado > 0)
    print(f'\n== {m}: classificador R$ {tot_a:,.2f} | consolidado R$ {tot_b:,.2f} | diferença R$ {tot_a - tot_b:,.2f}'
          f' | na mesma EAP: R$ {certo:,.2f}')
    for r in tm[tm.diferenca.abs() >= 0.01].sort_values('diferenca').itertuples():
        print(f'   {r.diferenca:>12,.2f}  {r.fornecedor[:34]:34} {r.documento[:22]:22} '
              f'class. {r.classificador:>11,.2f} [{r.eap_classificador or "-"}] | consol. {r.consolidado:>11,.2f} [{r.eap_consolidado or "-"}]')
    mesmo_valor_eap_dif = tm[(tm.diferenca.abs() < 0.01) & (tm.eap_classificador != tm.eap_consolidado)]
    for r in mesmo_valor_eap_dif.itertuples():
        print(f'   {"EAP":>12}  {r.fornecedor[:34]:34} {r.documento[:22]:22} '
              f'class. [{r.eap_classificador}] | consol. [{r.eap_consolidado}]  R$ {r.classificador:,.2f}')
