"""
Prévia da conversão da medição para % ACUMULADO (pedido 13), com a MESMA regra do
supabase/avanco/1-medicao-acumulada.sql. Só lê arquivos; não grava no banco.
Uso: py medicao_acumulada.py --retratos <json da /api/medicao-retratos> [--orcamento saida_v2/orcamento_banco_pos3.csv]
     [--vinculo saida_v2/vinculo_material_servico.csv] [--saida saida_v2]
Saída: <saida>/medicao_acumulada.csv (código | pavimento | serviço | % acumulado | data | semana | origem) e, no
terminal, as medições de material (antes → depois) e o avanço por horas antes × depois nas semanas medidas.

Regra: incrementos somados por linha (teto 100%, ordem semana, data, id). Medição em linha de MATERIAL vai para a
linha de SERVIÇO vinculada; se o serviço tem retrato próprio na mesma data, vale o do serviço (medição paralela do
mesmo avanço; somar contaria duas vezes).
"""
import argparse, json, os
import pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument('--retratos', required=True)
ap.add_argument('--orcamento', default='saida_v2/orcamento_banco_pos3.csv')
ap.add_argument('--vinculo', default='saida_v2/vinculo_material_servico.csv')
ap.add_argument('--saida', default='saida_v2')
a = ap.parse_args()

d = json.load(open(a.retratos, encoding='utf-8'))
orc = pd.read_csv(a.orcamento, dtype={'codigo_eap': str})
vin = pd.read_csv(a.vinculo, dtype={'material_codigo': str, 'servico_codigo': str})
r = pd.DataFrame(d['retratos'])
r = r.sort_values(['semana_numero', 'data_lancamento', 'id']).reset_index(drop=True)
r['inc'] = r.incremento.astype(float)
r['acum'] = r.groupby(['codigo_eap', 'pavimento']).inc.cumsum().clip(upper=100)

# destino: serviço vinculado (só material com UM serviço)
linha = orc.set_index(['codigo_eap', 'pavimento']).id.to_dict()
r['linha_id'] = [linha.get((c, p)) for c, p in zip(r.codigo_eap, r.pavimento)]
vv = vin.groupby('material_id')
destino = {m: g for m, g in vv}
def dest(row):
    g = destino.get(row.linha_id)
    if g is None:
        return row.codigo_eap, row.pavimento, None
    if len(g) != 1:
        raise SystemExit(f'medição {row.id} em material com {len(g)} serviços: decida o destino')
    s = g.iloc[0]
    return s.servico_codigo, s.servico_pavimento, row.codigo_eap
r[['dest_codigo', 'dest_pav', 'transferido_de']] = r.apply(lambda x: pd.Series(dest(x)), axis=1)

proprio = r[r.transferido_de.isna()].groupby(['dest_codigo', 'dest_pav', 'data_lancamento'], as_index=False).last()
trans = r[r.transferido_de.notna()]
tem = set(zip(proprio.dest_codigo, proprio.dest_pav, proprio.data_lancamento))
trans_ok = trans[[(c, p, dd) not in tem for c, p, dd in zip(trans.dest_codigo, trans.dest_pav, trans.data_lancamento)]]
trans_ok = trans_ok.groupby(['dest_codigo', 'dest_pav', 'data_lancamento'], as_index=False).last()
h = pd.concat([proprio, trans_ok]).sort_values(['semana_numero', 'data_lancamento'])
desc = orc.set_index(['codigo_eap', 'pavimento']).descricao.to_dict()
hh = orc.set_index(['codigo_eap', 'pavimento']).hh.to_dict()
out = pd.DataFrame({
    'codigo_eap': h.dest_codigo, 'pavimento': h.dest_pav,
    'servico': [desc.get((c, p)) for c, p in zip(h.dest_codigo, h.dest_pav)],
    'percentual_realizado': h.acum, 'data_lancamento': h.data_lancamento, 'semana_numero': h.semana_numero,
    'hh_planejado': [hh.get((c, p)) for c, p in zip(h.dest_codigo, h.dest_pav)],
    'transferido_de': h.transferido_de,
})
out['hh_realizado'] = (out.hh_planejado * out.percentual_realizado / 100).round(2)
out.to_csv(os.path.join(a.saida, 'medicao_acumulada.csv'), index=False, encoding='utf-8-sig')

print(f'{len(r)} medições → {len(out)} retratos ({len(trans_ok)} transferidos; {len(trans) - len(trans_ok)} de material'
      f' absorvidos por retrato do serviço na mesma data)')
print('\nMATERIAL → SERVIÇO (% acumulado na data: material antes | serviço na data depois)')
for x in trans.itertuples():
    sv = proprio[(proprio.dest_codigo == x.dest_codigo) & (proprio.dest_pav == x.dest_pav) & (proprio.data_lancamento == x.data_lancamento)]
    print(f'  {x.codigo_eap} {x.data_lancamento} S{x.semana_numero}: {x.acum:g}% → {x.dest_codigo} '
          f'{"fica " + format(sv.acum.iloc[0], "g") + "% (retrato próprio na data)" if len(sv) else "recebe " + format(x.acum, "g") + "%"}')

print('\nTABELA FINAL')
for x in out.sort_values(['codigo_eap', 'pavimento', 'semana_numero']).itertuples():
    print(f'  {x.codigo_eap:7s} {x.pavimento:9s} {str(x.servico)[:42]:42s} {x.percentual_realizado:6.1f}% {x.data_lancamento} S{x.semana_numero}'
          + (f' (de {x.transferido_de})' if isinstance(x.transferido_de, str) else ''))

# avanço por horas: antes (material com a própria medição) × depois (material herda o serviço)
prod = orc[(orc.grupo_num <= 16) & (orc.codigo_eap != '1.1.6')]
H = prod.hh.sum()
mat = set(vin.material_id)
def ultimo(tab, S, campo):
    t = tab[tab.semana_numero <= S].sort_values(['semana_numero', 'data_lancamento'])
    return t.groupby(['cod', 'pav'])[campo].last().to_dict()
antes_tab = r.rename(columns={'codigo_eap': 'cod', 'pavimento': 'pav'})
depois_tab = out.rename(columns={'codigo_eap': 'cod', 'pavimento': 'pav'})
print('\nAVANÇO FÍSICO POR HORAS (antes × depois)')
for S in sorted(set(r.semana_numero)) + [11]:
    pa = ultimo(antes_tab, S, 'acum')
    pd_ = ultimo(depois_tab, S, 'percentual_realizado')
    por_id = {o.id: pd_.get((o.codigo_eap, o.pavimento), 0) for o in orc.itertuples()}
    her = {}
    for v in vin.itertuples():
        her[v.material_id] = her.get(v.material_id, 0) + v.peso * por_id.get(v.servico_id, 0)
    ha = sum(o.hh * pa.get((o.codigo_eap, o.pavimento), 0) / 100 for o in prod.itertuples())
    hd = sum(o.hh * (her.get(o.id, 0) if o.id in mat else pd_.get((o.codigo_eap, o.pavimento), 0)) / 100 for o in prod.itertuples())
    print(f'  S{S:02d}: antes {100 * ha / H:.2f}% ({ha:,.1f} h) | depois {100 * hd / H:.2f}% ({hd:,.1f} h)')
