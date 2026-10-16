"""
Conferência das datas: fim de cada linha de serviço da EAP no site × fim da atividade do cronograma (pedido 17).
Só lê e escreve um relatório; não grava nada no banco.

Uso: py auditoria_cronograma.py [--orcamento saida_v2/orcamento_banco_2026-10-11.csv] [--destino ../diagnostico/auditoria_cronograma.md]
     --orcamento = exportação do banco de hoje (o que o site usa): id, codigo_eap, pavimento, descricao, hh, semana_inicio,
     semana_fim, quantidade, unidade, janelas_extra (JSON; horas em outra janela, SQL 7)
Lê também: cronograma/correspondencia_cronograma_eap.csv (correspondencia.py) e o cronograma oficial.

Classificação de cada linha de serviço:
  igual        fim no site = fim da atividade do cronograma
  regra        fim no site ≠ fim da atividade, mas = o que a regra de posição dá (escada, armação, forma, laje treliçada,
               concretagem, encunhamento — CLAUDE.md): não é divergência
  DIVERGÊNCIA  fim no site ≠ o que a tabela de correspondência dá (com a causa, quando conhecida)
"""
import argparse, glob, json, os
import pandas as pd
from cronograma import calendario, ler_cronograma, semana_da_coord

# causas conhecidas (decisões registradas no CLAUDE.md)
CAUSAS = {
    '15.1.4': 'contenção NÃO executada: reprogramada pelo Rafael para S16 (09/11/2026), mesma duração '
              '(supabase/semanas/4-contencao-reprogramada.sql) — decisão, não erro',
}

ap = argparse.ArgumentParser()
ap.add_argument('--orcamento', default='saida_v2/orcamento_banco_2026-10-11.csv')
ap.add_argument('--correspondencia', default='cronograma/correspondencia_cronograma_eap.csv')
ap.add_argument('--destino', default='../diagnostico/auditoria_cronograma.md')
a = ap.parse_args()
arq = [f for f in glob.glob('entrada/cronograma/*Final*.xlsx') if not os.path.basename(f).startswith('~$')][0]
cal = calendario()
crono = ler_cronograma(arq).set_index('atividade')
dfim = dict(zip(cal.semana_numero, cal.data_fim)); dini = dict(zip(cal.semana_numero, cal.data_inicio))
banco = pd.read_csv(a.orcamento, dtype={'codigo_eap': str}).set_index('id')
t = pd.read_csv(a.correspondencia, dtype={'codigo_eap': str, 'atividade_cronograma': str}).fillna({'atividade_cronograma': ''})

br = lambda d: f'{d:%d/%m/%Y}'
linhas = []
for r in t.itertuples():
    if not r.atividade_cronograma or r.id not in banco.index:
        linhas.append(dict(r._asdict(), classe='sem ligação', causa='linha sem atividade no cronograma')); continue
    b = banco.loc[r.id]
    x = crono.loc[r.atividade_cronograma]
    fim_ativ = semana_da_coord(cal, int(x.ini) - 1 + int(x.dur), 'fim')
    si_site, sf_site = int(b.semana_inicio), int(b.semana_fim)
    extra = json.loads(b.janelas_extra) if isinstance(b.janelas_extra, str) and b.janelas_extra.strip() else []
    d = dict(codigo_eap=r.codigo_eap, pavimento=r.pavimento, descricao=r.descricao, atividade=r.atividade_nome,
             posicao=r.regra_posicao, si_site=si_site, sf_site=sf_site, si_tab=int(r.semana_inicio), sf_tab=int(r.semana_fim),
             fim_ativ=fim_ativ, fim_site=dfim[sf_site], fim_crono=dfim[fim_ativ], extra=extra,
             ini_site=dini[si_site], ini_ativ=semana_da_coord(cal, int(x.ini) - 1, 'ini'),
             dias=(dfim[sf_site] - dfim[fim_ativ]).days)
    if (si_site, sf_site) != (d['si_tab'], d['sf_tab']):
        d['classe'] = 'DIVERGÊNCIA'
        d['causa'] = CAUSAS.get(r.codigo_eap, f'semanas no banco S{si_site}–S{sf_site} × tabela S{d["si_tab"]}–S{d["sf_tab"]}: causa não registrada')
    elif sf_site != fim_ativ or r.regra_posicao != 'inteira':
        d['classe'] = 'regra'; d['causa'] = r.regra_posicao
    else:
        d['classe'] = 'igual'; d['causa'] = ''
    linhas.append(d)
L = pd.DataFrame(linhas)

out = ['# Auditoria das datas — cronograma × linhas da EAP (pedido 17, 11/10/2026)', '',
       'Só leitura: semanas do banco de hoje (o que o site usa) × cronograma oficial (aba "Cronograma") ligado pela tabela',
       '`automacao/cronograma/correspondencia_cronograma_eap.csv`. Fim da atividade = semana real que contém o fim da atividade',
       'no cronograma esquemático (mês do cronograma = mês do calendário). Nada foi gravado.', '']
n = L.classe.value_counts().to_dict()
out.append(f"**{len(L)} linhas de serviço** · iguais à atividade: {n.get('igual', 0)} · posição pela regra: {n.get('regra', 0)} · "
           f"**divergências: {n.get('DIVERGÊNCIA', 0)}** · sem ligação: {n.get('sem ligação', 0)}")
out.append('')
out.append('## (b) Divergências (fim no site ≠ tabela de correspondência)')
dv = L[L.classe == 'DIVERGÊNCIA']
if len(dv):
    out.append('| EAP | Pavimento | Fim no site | Fim no cronograma | Diferença (dias) | Causa |')
    out.append('|---|---|---|---|---:|---|')
    for r in dv.itertuples():
        out.append(f'| {r.codigo_eap} | {r.pavimento} | {br(r.fim_site)} (S{r.sf_site}) | {br(r.fim_crono)} (S{r.fim_ativ}) | {r.dias:+d} | {r.causa} |')
else:
    out.append('Nenhuma.')
out.append('')
out.append('## (c) Posição pela REGRA do CLAUDE.md (escada, concretagem, forma, armação, laje treliçada, encunhamento: não são divergência)')
rg = L[L.classe == 'regra']
out.append('| EAP | Pavimento | Atividade do cronograma (nome) | No site (início → fim) | Atividade (início → fim) | Dif. no fim (dias) | Regra |')
out.append('|---|---|---|---|---|---:|---|')
for r in rg.itertuples():
    out.append(f'| {r.codigo_eap} | {r.pavimento} | {r.atividade} | {br(r.ini_site)} → {br(r.fim_site)} | '
               f'{br(dini[r.ini_ativ])} → {br(r.fim_crono)} | {r.dias:+d} | {r.causa} |')
out.append('')
ex = L[L.extra.apply(lambda e: isinstance(e, list) and len(e) > 0)]
if len(ex):
    out.append('## Horas em outra janela (SQL 7, tabela orcamento_horas_janela)')
    out.append('Estas linhas têm parte das horas planejadas fora da própria janela (por isso o planejado delas começa antes):')
    out.append('')
    out.append('| EAP | Pavimento | Janela própria | Horas em outra janela |')
    out.append('|---|---|---|---|')
    for r in ex.itertuples():
        out.append(f"| {r.codigo_eap} | {r.pavimento} | S{r.si_site}–S{r.sf_site} | " +
                   '; '.join(f"{e['hh']:g} h em S{e['semana_inicio']}–S{e['semana_fim']}" for e in r.extra) + ' |')
    out.append('')
os.makedirs(os.path.dirname(a.destino), exist_ok=True)
L.to_csv(os.path.join(os.path.dirname(a.destino), 'auditoria_cronograma_linhas.csv'), index=False, encoding='utf-8-sig')
corpo = '\n'.join(out) + '\n'
# as seções escritas à mão (fundação e estrutura) ficam num arquivo ao lado e entram antes da conferência automática
manual = os.path.join(os.path.dirname(a.destino), 'auditoria_cronograma_analise.md')
if os.path.exists(manual):
    corpo = corpo.replace('## (b) Divergências', open(manual, encoding='utf-8').read().rstrip() + '\n\n## (b) Divergências', 1)
open(a.destino, 'w', encoding='utf-8').write(corpo)
print(f'{a.destino}: {len(L)} linhas | ' + ' | '.join(f'{k} {v}' for k, v in n.items()))
for r in dv.itertuples():
    print(f'  DIVERGÊNCIA {r.codigo_eap} {r.pavimento}: site {br(r.fim_site)} × cronograma {br(r.fim_crono)} ({r.dias:+d} d) — {r.causa[:80]}')
