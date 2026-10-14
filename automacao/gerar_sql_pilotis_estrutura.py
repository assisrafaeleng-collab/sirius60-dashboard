"""
Gera o SQL do pedido 20: orçamento com o PILOTIS no grupo 3 (decisões do Rafael, 14/10/2026). Só escreve arquivos;
quem decide e roda é o Rafael.

Uso: py gerar_sql_pilotis_estrutura.py [--csv] [--destino ../supabase/orcamento]
  sem --csv: escreve 9-pilotis-estrutura.sql, 9-desfazer.sql, 9-conferir-estado.sql e saida_v2/pedido20_estado_depois.json
  --csv:     também atualiza tipos_linha_orcamento.csv e cronograma/correspondencia_cronograma_eap.csv (com backup
             _backup_2026-10-14_pedido20) e reescreve supabase/cronograma/1-ligacao-cronograma.sql (não rodado)
Lê: orcamentos/Orcamento_Sirius_60_-_proposta_estrutura_com_Pilotis_v2_2026-10-14.xlsx (aba Orçamento, grupos 2 e 3)
    saida_v2/banco_pedido20_2026-10-14.json (exportação do banco em 14/10, só leitura)
    o cronograma oficial (entrada/cronograma/*Final*.xlsx), tipos_linha_orcamento.csv

Regras (pedido 20; tudo por ID, nunca pelo texto):
- Fundação 2.1.x: quantidades e valores da planilha; SEMANAS NÃO MUDAM (o prazo da fundação permanece); HORAS acompanham
  a quantidade (Rafael 14/10, regra 2c do pedido 19: horas × qtd nova ÷ qtd atual, índice Hh/un igual; as horas antigas
  incluíam a forma do Pilotis, que agora tem as 1.305 h dele). 2.1.8 (6 diárias) não muda.
  Saem 2.1.10 a 2.1.13 (escada da fundação; sem custo, conta a pagar nem medição). 2.1.9 (id 675) vira 3.1.7 Pilotis
  (mesmas horas e semanas: atividade "Concretagem piso" do cronograma, S10–S15, dentro da janela do Pilotis).
- Estrutura: novo 3.1 PILOTIS; os outros descem um número (3.1→3.2 … 3.7→3.8). id 692 (antiga 3.1.12, treliçada
  com os 270 m² do Pilotis) vira 3.1.8 Pilotis; o Subsolo ganha a 3.2.12 nova. 2º Pav pela FUNÇÃO: id 720
  (material) → 3.5.6, id 721 (MO) → 3.5.5. Sai a 3.0.1 (id 992: R$ 0 e 0 h; as horas do Pilotis vão para as linhas).
- Horas do Pilotis: as 1.305 h da atividade "3.1 Pilotis" (hoje em orcamento_horas_janela, SQL 7, sobre as linhas do
  antigo 3.1) vão para as linhas de SERVIÇO do Pilotis na proporção das horas reais (índice × quantidade), como no
  SQL 7; materiais do Pilotis com 0 h. Janelas pela sequência da estrutura (armação → forma meia semana depois →
  treliçada → concretagem 30%/70%; escada na última semana), atividade 3.1 do cronograma (S10–S18).
- Subsolo … Reservatório: cada subgrupo fica com as horas da SUA atividade (as do banco, sem as 1.305 h do Pilotis);
  dentro da atividade, horas da linha ∝ horas atuais × (quantidade nova ÷ atual) (índice Hh/un igual, regra do pedido
  19), normalizado para a soma da atividade não mudar. A 3.2.12 nova usa o índice da antiga 3.1.12. Semanas iguais.
- Curva planejada: cada linha muda só nas SUAS janelas (mesmas contas do cronograma.py); horas e valor variam
  exatamente pela diferença das linhas. As 1.305 h saem da janela antiga (atividade inteira, como no banco) e entram
  nas janelas das linhas do Pilotis.
- Medições: mantém a QUANTIDADE executada (levantamento do Rafael 14/10/2026, até 30/09 = S09); para cada medição que
  vale hoje (as correções do pedido 19) entra uma nova correção na MESMA semana e data, % × (qtd antiga ÷ nova);
  a última fica no % real. As antigas ficam guardadas.
"""
import argparse, glob, json, math, os, re, shutil
from collections import namedtuple
import openpyxl
import pandas as pd
from cronograma import calendario, espalhar_coord, semana_da_coord, ler_cronograma, janelas

PROPOSTA = os.path.join('orcamentos', 'Orcamento_Sirius_60_-_proposta_estrutura_com_Pilotis_v2_2026-10-14.xlsx')
BANCO = os.path.join('saida_v2', 'banco_pedido20_2026-10-14.json')
TIPOS = 'tipos_linha_orcamento.csv'
CORRESP = os.path.join('cronograma', 'correspondencia_cronograma_eap.csv')
BKP = '20261014'
SUF_CSV = '_backup_2026-10-14_pedido20'
FONTE = 'levantamento do Rafael 14/10/2026'

ANTES = dict(linhas=333, preco=7200717.91, hh=49693.6, base=48637.6, curva_sem=117, curva_hh=48637.5,
             curva_valor=6403393.91, hist=26, correcoes=9, janelas=19, janelas_hh=1365.1, vinculos=53, indices=269,
             indireto=2874508.08)
ESPERADO_DIRETO = 6834476.18      # pedido 20 (planilha, grupo 18 no indireto, 17.1.14 no direto)

PAV = {'2.1': 'Fundação', '3.1': 'Pilotis', '3.2': 'Subsolo', '3.3': 'Térreo', '3.4': '1º Pav', '3.5': '2º Pav',
       '3.6': '3º Pav', '3.7': 'Terraço', '3.8': 'Reservatório'}
GRUPO_NOME = {2: 'Fundações', 3: 'Estrutura'}
SAI = [676, 677, 678, 679, 992]                      # escada da fundação (2.1.10–2.1.13) e 3.0.1
NOVAS = {1001: '3.1.1', 1002: '3.1.2', 1003: '3.1.3', 1004: '3.1.4', 1005: '3.1.5', 1006: '3.1.6', 1007: '3.1.9',
         1008: '3.1.10', 1009: '3.1.11', 1010: '3.1.12', 1011: '3.2.12'}
# tipo das linhas novas (como em tipos_linha_orcamento.csv)
TIPO_NOVA = {  # id: (material, tipo_material, tipo_servico, servico_estrutura, atividade, regra)
    1001: (True, 'armacao', '', 'armacao', '3.1', 'estrutura do pavimento'),
    1002: (False, '', 'armacao', 'armacao', '3.1', 'estrutura do pavimento'),
    1003: (True, 'concretagem', '', 'concretagem', '3.1', 'estrutura do pavimento'),
    1004: (False, '', 'concretagem', 'concretagem', '3.1', 'estrutura do pavimento'),
    1005: (False, '', 'forma', 'forma', '3.1', 'estrutura do pavimento'),
    1006: (True, 'forma', '', 'forma', '3.1', 'estrutura do pavimento'),
    1007: (False, '', 'escada', 'escada', '3.1', 'ESCADA: última semana da estrutura do pavimento'),
    1008: (True, 'escada', '', 'escada', '3.1', 'ESCADA: última semana da estrutura do pavimento'),
    1009: (True, 'escada', '', 'escada', '3.1', 'ESCADA: última semana da estrutura do pavimento'),
    1010: (True, 'escada', '', 'escada', '3.1', 'ESCADA: última semana da estrutura do pavimento'),
    1011: (False, '', '', 'laje_trelicada', '3.2', 'estrutura do pavimento'),
}
VINC_NOVOS = [(1001, 1002), (1003, 1004), (1006, 1005), (1008, 1007), (1009, 1007), (1010, 1007)]
# índice das linhas novas: copia a linha-modelo (mesmo tipo) do Subsolo de hoje
INDICE_MODELO = {1002: 682, 1004: 684, 1005: 685, 1007: 688, 1011: 692}
SERV_PILOTIS = [1002, 1004, 1005, 692, 1007]          # linhas de serviço do Pilotis que recebem as 1.305 h
VERBA_FORMA = [669, 1006, 1008, 686, 689, 698, 701, 710, 712, 720, 723, 732, 739, 746]
REAL = {  # código: (qtd executada até 30/09, qtd antiga, unidade); a nova vem da planilha (2.1.8 pelo volume da 2.1.5)
    '2.1.2': (216.04, 389.53, 'm³'), '2.1.6': (97.16, 688.17, 'm²'), '2.1.7': (5781.07, 16578.47, 'kg'),
    '2.1.8': (194.77, 529.80, 'm³ (por volume do concreto 2.1.5)'),
}
QTD_REF = {'2.1.2': 668, '2.1.6': 672, '2.1.7': 673, '2.1.8': 671}   # id da linha cuja quantidade dá o denominador

ap = argparse.ArgumentParser()
ap.add_argument('--csv', action='store_true')
ap.add_argument('--destino', default=os.path.join('..', 'supabase', 'orcamento'))
a = ap.parse_args()

r2 = lambda v: round(float(v) + 1e-9, 2)
r1 = lambda v: round(float(v) + 1e-9, 1)
def br(v, n=2):
    return f'{v:,.{n}f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
q = lambda v: "'" + str(v).replace("'", "''") + "'"
def sqlnum(v, n=None):
    if v is None:
        return 'null'
    return repr(round(float(v), n)) if n is not None else repr(float(v))

# ------------------------------------------------------------------ banco (exportação de 14/10)
B = json.load(open(BANCO, encoding='utf-8'))
orc = {int(o['id']): o for o in B['orcamento_planejado']}
for k in ['preco_total', 'hh', 'quantidade', 'preco_unitario']:
    for o in orc.values():
        o[k] = float(o[k])
assert len(orc) == ANTES['linhas'] and r2(sum(o['preco_total'] for o in orc.values())) == ANTES['preco']
assert r1(sum(o['hh'] for o in orc.values())) == ANTES['hh']
prod = lambda o: int(o['grupo_num']) <= 16 and o['codigo_eap'] != '1.1.6'
assert r1(sum(o['hh'] for o in orc.values() if prod(o))) == ANTES['base']
jan = B['orcamento_horas_janela']
assert len(jan) == ANTES['janelas'] and r1(sum(float(j['hh']) for j in jan)) == ANTES['janelas_hh']
jan_p = [j for j in jan if j['origem'] == '3.0.1']
H_PILOTIS = r1(sum(float(j['hh']) for j in jan_p))
assert H_PILOTIS == 1305.0 and all((int(j['semana_inicio']), int(j['semana_fim'])) == (10, 18) for j in jan_p)
extra = {}
for j in jan:
    extra[int(j['orcamento_id'])] = extra.get(int(j['orcamento_id']), 0.0) + float(j['hh'])
own = {i: r1(o['hh'] - extra.get(i, 0.0)) for i, o in orc.items()}
vinc = B['orcamento_material_servico']
assert len(vinc) == ANTES['vinculos']
ind = {int(x['orcamento_id']): x for x in B['indice_produtividade']}
assert len(B['indice_produtividade']) == ANTES['indices']
hist = B['avanco_fisico_historico']
assert len(hist) == ANTES['hist'] and sum(1 for h in hist if h['origem'] == 'correcao') == ANTES['correcoes']
curva_b = sorted(B['curva_s_semanal_planejada'], key=lambda c: int(c['semana_numero']))
assert len(curva_b) == ANTES['curva_sem'] and r1(sum(float(c['hh_semanal']) for c in curva_b)) == ANTES['curva_hh']
assert r2(sum(float(c['valor_semanal']) for c in curva_b)) == ANTES['curva_valor']
assert r2(sum(float(x['valor_total']) for x in B['custos_indiretos_planejados'])) == ANTES['indireto']
assert all(i not in orc for i in NOVAS)

# nada lançado nas linhas que saem / que mudam de código (custos, contas, medições, ocorrências) — pedido 20 item 1
def afetado(cod):
    return bool(re.match(r'^2\.1\.(9|1[0-3])$', str(cod or ''))) or str(cod or '').startswith('3.')
for t in ['custos_lancamentos', 'contas_a_pagar', 'avanco_fisico_historico', 'avanco_fisico_realizado', 'ocorrencias_obra',
          'insumo_prazo_entrega', 'planejamento_historico']:
    ruins = [x for x in B[t] if afetado(x.get('codigo_eap'))]
    assert not ruins, f'PARE: {t} tem lançamento em linha que sai ou muda de código: {ruins[:3]}'

# ------------------------------------------------------------------ planilha (aba Orçamento, grupos 2 e 3)
wb = openpyxl.load_workbook(PROPOSTA, data_only=True)
ws = wb['Orçamento']
pl = {}
for r in ws.iter_rows(min_row=4, values_only=True):
    cod = str(r[0]).strip() if r[0] is not None else ''
    if re.match(r'^[23]\.\d+\.\d+$', cod):
        assert cod not in pl, cod
        pl[cod] = dict(descricao=re.sub(r'\s+', ' ', str(r[1])).strip(), unidade=str(r[2]).strip(), qtd=float(r[3]),
                       unit=float(r[8]), total=float(r[9]))
g2 = sum(v['total'] for c, v in pl.items() if c.startswith('2.'))
g3 = sum(v['total'] for c, v in pl.items() if c.startswith('3.'))
assert abs(g2 - 573126.00016) < 0.01 and abs(g3 - 1873239.3024) < 0.01, (g2, g3)

# ------------------------------------------------------------------ mapa id → código novo
mapa = {}
for i in [667, 668, 669, 670, 671, 672, 673, 674, 680]:
    mapa[i] = orc[i]['codigo_eap']
mapa[675] = '3.1.7'
mapa[692] = '3.1.8'
for i, o in orc.items():
    m = re.match(r'^3\.([1-7])\.(\d+)$', o['codigo_eap'])
    if m and i != 692:
        mapa[i] = f'3.{int(m.group(1)) + 1}.{m.group(2)}'
mapa[720], mapa[721] = '3.5.6', '3.5.5'        # 2º Pav pela função (720 = material, 721 = MO)
afetados_antigos = sorted(i for i, o in orc.items() if int(o['grupo_num']) in (2, 3))
assert set(afetados_antigos) == set(mapa) | set(SAI), set(afetados_antigos) ^ (set(mapa) | set(SAI))
codigos_novos = list(mapa.values()) + list(NOVAS.values())
assert sorted(codigos_novos) == sorted(pl), set(codigos_novos) ^ set(pl)

eh_mat_txt = lambda d: '(Apenas Material)' in d or d.endswith('- (Material)')
novo = {}
for i, cod in list(mapa.items()) + list(NOVAS.items()):
    p = pl[cod]
    sub = '.'.join(cod.split('.')[:2])
    mat = TIPO_NOVA[i][0] if i in NOVAS else bool(orc[i]['e_material'])
    assert eh_mat_txt(p['descricao']) == mat, (i, cod, p['descricao'], mat)
    if i in orc and i not in (675, 692):
        assert orc[i]['pavimento'] == PAV[sub], (i, orc[i]['pavimento'], PAV[sub])
    novo[i] = dict(id=i, codigo_eap=cod, pavimento=PAV[sub], descricao=p['descricao'], quantidade=r2(p['qtd']),
                   qtd_cheia=p['qtd'], unidade=p['unidade'], preco_unitario=p['unit'], preco_total=r2(p['total']),
                   grupo_num=int(cod.split('.')[0]), grupo_nome=GRUPO_NOME[int(cod.split('.')[0])], e_material=mat)

# ------------------------------------------------------------------ tipos por id (atividade do cronograma)
# tipos de ANTES do pedido 20 (se a tabela já foi atualizada por uma rodada com --csv, o original é o backup)
TIPOS_ANTES = TIPOS.replace('.csv', SUF_CSV + '.csv') if os.path.exists(TIPOS.replace('.csv', SUF_CSV + '.csv')) else TIPOS
tipos = pd.read_csv(TIPOS_ANTES, dtype=str).fillna('')
tipos['id'] = tipos.id.astype(int)
tp = {r.id: r for r in tipos.itertuples()}
Tipo = namedtuple('Tipo', 'material tipo_material tipo_servico servico_estrutura atividade regra')
def tipo_antigo(i):
    r = tp[i]
    return Tipo(r.material.lower() == 'true', r.tipo_material, r.tipo_servico, r.servico_estrutura, r.atividade, r.regra)
tipo_novo = {}
for i in novo:
    if i in NOVAS:
        tipo_novo[i] = Tipo(*TIPO_NOVA[i])
    elif i == 692:
        t = tipo_antigo(692)
        tipo_novo[i] = t._replace(atividade='3.1')
    else:
        tipo_novo[i] = tipo_antigo(i)

# ------------------------------------------------------------------ horas
hh_novo = {}
for i in novo:
    if novo[i]['grupo_num'] == 2 or i == 675:
        # fundação: horas ∝ quantidade (índice Hh/un igual; 2.1.8 e 2.1.1 com qtd igual não mudam); 3.1.7 (ex-2.1.9)
        # fica com as 304,1 h (Rafael 14/10)
        hh_novo[i] = orc[i]['hh'] if i == 675 else r1(orc[i]['hh'] * novo[i]['qtd_cheia'] / orc[i]['quantidade'])
ativ_info = {}
for act in ['3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8']:
    velhos = [i for i in afetados_antigos if i not in SAI and tipo_antigo(i).atividade == act]
    T = r1(sum(own[i] for i in velhos))
    membros = [i for i in velhos if i != 692] + ([1011] if act == '3.2' else [])
    raw = {}
    for i in membros:
        if i == 1011:
            raw[i] = own[692] / orc[692]['quantidade'] * novo[i]['qtd_cheia']
        else:
            raw[i] = own[i] * novo[i]['qtd_cheia'] / orc[i]['quantidade']
    esc = T / sum(raw.values())
    h = {i: r1(raw[i] * esc) for i in membros}
    big = max(h, key=h.get)
    h[big] = r1(h[big] + T - sum(h.values()))
    assert r1(sum(h.values())) == T
    hh_novo.update(h)
    ativ_info[act] = dict(total=T, antes={i: own[i] for i in velhos}, depois=h)
real_h = {}
for i in SERV_PILOTIS:
    x = ind[INDICE_MODELO.get(i, i)]
    real_h[i] = float(x['horas_total']) if x['regra'] == 'duracao' else float(x['hh_por_unidade']) * novo[i]['qtd_cheia']
hp = {i: r1(H_PILOTIS * real_h[i] / sum(real_h.values())) for i in SERV_PILOTIS}
big = max(hp, key=hp.get)
hp[big] = r1(hp[big] + H_PILOTIS - sum(hp.values()))
hh_novo.update(hp)
for i in novo:
    if novo[i]['pavimento'] == 'Pilotis' and i not in hh_novo:
        hh_novo[i] = 0.0                                          # materiais do Pilotis
    elif i not in hh_novo:
        # piso polido 3.2.7 / 3.3.7 (atividade própria do cronograma, quantidade igual): as horas da própria linha; a
        # 3.2.7 perde só as 6,4 h do Pilotis que estavam nela (vão para as linhas do Pilotis)
        assert tipo_antigo(i).atividade == '11.1.6' and abs(novo[i]['qtd_cheia'] - orc[i]['quantidade']) < 0.005, i
        hh_novo[i] = own[i]
assert set(hh_novo) == set(novo), sorted((i, novo[i]["codigo_eap"]) for i in set(novo) ^ set(hh_novo))
for i in novo:
    novo[i]['hh'] = hh_novo[i]

hh_sai = r1(sum(orc[i]['hh'] for i in SAI))
FUND = [i for i in novo if novo[i]['grupo_num'] == 2]
hh_fund = r1(sum(orc[i]['hh'] - hh_novo[i] for i in FUND))   # horas que a fundação perde com as quantidades novas
DEPOIS = dict(linhas=ANTES['linhas'] - len(SAI) + len(NOVAS),
              preco=r2(ANTES['preco'] - sum(orc[i]['preco_total'] for i in afetados_antigos) + sum(n['preco_total'] for n in novo.values())),
              hh=r1(ANTES['hh'] - sum(orc[i]['hh'] for i in afetados_antigos) + sum(n['hh'] for n in novo.values())))
DEPOIS['base'] = r1(ANTES['base'] - hh_sai - hh_fund)
assert DEPOIS['hh'] == r1(ANTES['hh'] - hh_sai - hh_fund), (DEPOIS['hh'], ANTES['hh'], hh_sai, hh_fund)

# ------------------------------------------------------------------ semanas e janelas (mesmas contas do cronograma.py)
arq = [f for f in glob.glob(os.path.join('entrada', 'cronograma', '*Final*.xlsx')) if not os.path.basename(f).startswith('~$')][0]
cal = calendario()
crono = ler_cronograma(arq).set_index('atividade')
assert (int(crono.ini['3.1']), int(crono.dur['3.1'])) == (9, 8), 'atividade 3.1 Pilotis do cronograma mudou'
O = namedtuple('O', 'regra atividade servico_estrutura')
def jan_linha(t):
    if not t.atividade or t.atividade not in crono.index:
        return None, None
    b = int(crono.ini[t.atividade]) - 1
    return b, janelas(O(t.regra, t.atividade, t.servico_estrutura), int(crono.dur[t.atividade]))
def semanas(t):
    b, js = jan_linha(t)
    return (semana_da_coord(cal, b + min(j[0] for j in js), 'ini'), semana_da_coord(cal, b + max(j[1] for j in js), 'fim'))
for i in afetados_antigos:                                        # o método reproduz as semanas de hoje
    if i == 992:
        continue
    assert semanas(tipo_antigo(i)) == (int(orc[i]['semana_inicio']), int(orc[i]['semana_fim'])), (i, semanas(tipo_antigo(i)))
for i in novo:
    if i in orc and i != 692:
        novo[i]['semana_inicio'], novo[i]['semana_fim'] = int(orc[i]['semana_inicio']), int(orc[i]['semana_fim'])
    else:
        novo[i]['semana_inicio'], novo[i]['semana_fim'] = semanas(tipo_novo[i])
# a 3.2.12 nova fica na janela da treliçada do Subsolo (= a antiga 3.1.12)
assert (novo[1011]['semana_inicio'], novo[1011]['semana_fim']) == (int(orc[692]['semana_inicio']), int(orc[692]['semana_fim']))

# ------------------------------------------------------------------ curva: Δ de cada linha nas suas janelas
dh_dia, dv_dia = {}, {}
def soma(t, h, v, sinal):
    b, js = jan_linha(t)
    for x0, x1, f in js:
        espalhar_coord(cal, b + x0, b + x1, sinal * h * f, dh_dia)
        espalhar_coord(cal, b + x0, b + x1, sinal * v * f, dv_dia)
for i in afetados_antigos:
    if i == 992:
        continue
    soma(tipo_antigo(i), own[i], orc[i]['preco_total'], -1)
b31 = int(crono.ini['3.1']) - 1
espalhar_coord(cal, b31, b31 + int(crono.dur['3.1']), -H_PILOTIS, dh_dia)   # as 1.305 h na atividade inteira (banco)
for i in novo:
    soma(tipo_novo[i], novo[i]['hh'], novo[i]['preco_total'], +1)
sem = lambda por_dia: {int(x.semana_numero): sum(v for dt, v in por_dia.items() if x.data_inicio <= dt <= x.data_fim) for x in cal.itertuples()}
dh, dv = sem(dh_dia), sem(dv_dia)
H = sum(float(c['hh_semanal']) for c in curva_b) + sum(dh.values())
V = sum(float(c['valor_semanal']) for c in curva_b) + sum(dv.values())
curva, ah, av = [], 0.0, 0.0
for c in curva_b:
    w = int(c['semana_numero'])
    h = float(c['hh_semanal']) + dh.get(w, 0.0); v = float(c['valor_semanal']) + dv.get(w, 0.0)
    assert h > -1e-6 and v > -0.005, (w, h, v)
    h, v = max(h, 0.0), max(v, 0.0)
    ah += h; av += v
    curva.append(dict(semana=w, hh_hoje=float(c['hh_semanal']), valor_hoje=float(c['valor_semanal']), hh=round(h, 4),
                      perc=round(100 * h / H, 6), perc_acum=round(100 * ah / H, 6), valor=r2(v), valor_acum=r2(av),
                      perc_valor_acum=round(100 * av / V, 6), perc_acum_hoje=float(c['perc_hh_acum']),
                      valor_acum_hoje=float(c['valor_acum'])))
mudou = [c for c in curva if abs(c['hh'] - c['hh_hoje']) > 0.00005 or abs(c['valor'] - c['valor_hoje']) > 0.004]
H1 = r1(sum(c['hh'] for c in curva)); V1 = r2(sum(c['valor'] for c in curva))
assert abs(H1 - (ANTES['curva_hh'] - hh_sai - hh_fund)) < 0.15, (H1, ANTES['curva_hh'], hh_sai, hh_fund)

# ------------------------------------------------------------------ medições: mantém a quantidade executada
substituida = {int(i) for h in hist if h['origem'] == 'correcao' for i in (h['origem_ids'] or [])}
qnova = {cod: novo[QTD_REF[cod]]['quantidade'] for cod in REAL}
med = []
for cod, (qx, q0, un) in REAL.items():
    assert abs(orc[QTD_REF[cod]]['quantidade'] - q0) < 0.005, cod
    preal = round(100 * qx / qnova[cod], 4)
    rs = sorted([h for h in hist if h['codigo_eap'] == cod and h['pavimento'] == 'Fundação' and not h['excluido_em']
                 and int(h['id']) not in substituida], key=lambda h: (h['semana_numero'], h['data_lancamento'], h['id']))
    assert rs and all(int(h['semana_numero']) <= 9 for h in rs), cod
    p_ult = float(rs[-1]['percentual_realizado'])
    assert abs(p_ult - round(100 * qx / q0, 4)) < 0.00006, (cod, p_ult)
    f = preal / p_ult
    ant = 0.0
    for k, h in enumerate(rs):
        p0 = float(h['percentual_realizado'])
        pn = preal if k == len(rs) - 1 else round(p0 * f, 4)
        assert 0 <= pn <= 100 and pn >= ant, (cod, pn)
        ant = pn
        hh = novo[int(next(i for i, o in orc.items() if o['codigo_eap'] == cod and o['pavimento'] == 'Fundação'))]['hh']
        med.append(dict(id=int(h['id']), codigo=cod, semana=int(h['semana_numero']), data=h['data_lancamento'][:10],
                        competencia=h['competencia'], atividade=h['atividade_nome'], grupo=int(h['grupo_num']),
                        p0=p0, p=pn, hh=hh, fator=f, preal=preal, qx=qx, qnova=qnova[cod], q0=q0, un=un,
                        obs=f"correção da medição (pedido 20, orçamento com o Pilotis no grupo 3; {FONTE}): mantém a quantidade "
                            f"executada até 30/09 = {br(qx)} de {br(qnova[cod])} {un.split(' ')[0]} = {br(preal, 4)}% "
                            f"(era de {br(q0)}); {br(p0, 4)}% × {br(f, 6)}"))
assert len(med) == 9

# ------------------------------------------------------------------ índices de produtividade
ind_upd = []                                                       # (orcamento_id, codigo, pavimento, hh_por_unidade|None, hh_cronograma)
for i in novo:
    if i in ind:
        x = ind[i]
        n = novo[i]
        hc = round(n['hh'] / n['quantidade'], 6) if n['quantidade'] else None
        hpu = None
        if x['origem'] == 'cronograma' and x['regra'] == 'indice':
            hpu = hc                                               # índice do cronograma = horas ÷ quantidade
        ind_upd.append((i, n['codigo_eap'], n['pavimento'], hpu, hc, x))
ind_ins = []
for i, mod in INDICE_MODELO.items():
    if i == 692:
        continue
    x = ind[mod]; n = novo[i]
    ind_ins.append(dict(orcamento_id=i, codigo_eap=n['codigo_eap'], pavimento=n['pavimento'], unidade=x['unidade'],
                        regra=x['regra'], hh_por_unidade=x['hh_por_unidade'], horas_total=x['horas_total'], origem=x['origem'],
                        hh_cronograma=round(n['hh'] / n['quantidade'], 6) if n['quantidade'] else None,
                        conferir=bool(x['conferir']), tipo_equipe=x['tipo_equipe'], observacao=x['observacao']))
ind_del = [i for i in SAI if i in ind]
assert ind_del == [676, 992], ind_del

# ------------------------------------------------------------------ verba de forma
verba_antes = r2(sum(orc[i]['preco_total'] for i in [669, 677, 686, 689, 698, 701, 710, 712, 720, 723, 732, 739, 746]))
verba_depois = r2(sum(novo[i]['preco_total'] for i in VERBA_FORMA))
mat_vinc_depois = {m for m, s in VINC_NOVOS} | {int(v['material_id']) for v in vinc if int(v['material_id']) not in (677, 678, 679)}
assert all(i in mat_vinc_depois and novo[i]['e_material'] for i in VERBA_FORMA)

# ------------------------------------------------------------------ estado depois (para a prévia na memória) e resumo
orc_depois = []
for i, o in orc.items():
    if i in SAI:
        continue
    if i in novo:
        n = novo[i]
        orc_depois.append({**o, **{k: n[k] for k in ['codigo_eap', 'pavimento', 'descricao', 'quantidade', 'unidade',
                           'preco_unitario', 'preco_total', 'grupo_num', 'grupo_nome', 'hh', 'semana_inicio', 'semana_fim', 'e_material']}})
    else:
        orc_depois.append(o)
for i in NOVAS:
    n = novo[i]
    orc_depois.append(dict(id=i, obra_id='sirius60', codigo_eap=n['codigo_eap'], descricao=n['descricao'], quantidade=n['quantidade'],
                           unidade=n['unidade'], preco_unitario=n['preco_unitario'], preco_total=n['preco_total'],
                           semana_inicio=n['semana_inicio'], semana_fim=n['semana_fim'], pavimento=n['pavimento'],
                           grupo_num=n['grupo_num'], grupo_nome=n['grupo_nome'], hh=n['hh'], created_at=None, custo_de_tempo=False,
                           e_material=n['e_material']))
assert len(orc_depois) == DEPOIS['linhas'] and r2(sum(o['preco_total'] for o in orc_depois)) == DEPOIS['preco']
cod_de = {o['id']: (o['codigo_eap'], o['pavimento']) for o in orc_depois}
vinc_depois = [dict(v, material_codigo=cod_de[int(v['material_id'])][0], material_pavimento=cod_de[int(v['material_id'])][1],
                    servico_codigo=cod_de[int(v['servico_id'])][0], servico_pavimento=cod_de[int(v['servico_id'])][1])
               for v in vinc if int(v['material_id']) not in (677, 678, 679)]
for k, (m, s) in enumerate(VINC_NOVOS):
    vinc_depois.append(dict(id=900 + k, obra_id='sirius60', material_id=m, material_codigo=cod_de[m][0], material_pavimento=cod_de[m][1],
                            servico_id=s, servico_codigo=cod_de[s][0], servico_pavimento=cod_de[s][1], peso=1))
ind_depois = []
upd = {u[0]: u for u in ind_upd}
for x in B['indice_produtividade']:
    i = int(x['orcamento_id'])
    if i in ind_del:
        continue
    if i in upd:
        _, c, p, hpu, hc, _x = upd[i]
        x = dict(x, codigo_eap=c, pavimento=p, hh_cronograma=hc, **({'hh_por_unidade': hpu} if hpu is not None else {}))
    ind_depois.append(x)
for k, x in enumerate(ind_ins):
    ind_depois.append(dict(x, id=9000 + k, obra_id='sirius60', atualizado_em=None, equipes_definidas=None, equipe_oficiais=None,
                           equipe_ajudantes=None, equipe_funcao=None, editado_por=None, editado_em=None))
hist_depois = list(hist) + [dict(id=100000 + k, obra_id='sirius60', codigo_eap=m['codigo'], pavimento='Fundação', percentual_realizado=m['p'],
                                 data_lancamento=m['data'], semana_numero=m['semana'], competencia=m['competencia'],
                                 atividade_nome=m['atividade'], grupo_num=m['grupo'], hh_planejado=m['hh'],
                                 hh_realizado=r2(m['hh'] * m['p'] / 100), medido_por='Rafael', observacao=m['obs'], origem='correcao',
                                 origem_ids=[m['id']], transferido_de=None, criado_em=None, editado_por=None, editado_em=None,
                                 excluido_por=None, excluido_em=None)
                            for k, m in enumerate(sorted(med, key=lambda m: (m['semana'], m['data'], m['id'])))]
curva_depois = [dict(c0, hh_semanal=c['hh'], perc_hh_semanal=c['perc'], perc_hh_acum=c['perc_acum'], valor_semanal=c['valor'],
                     valor_acum=c['valor_acum'], perc_valor_acum=c['perc_valor_acum']) for c0, c in zip(curva_b, curva)]
jan_depois = [j for j in jan if j['origem'] != '3.0.1']
json.dump(dict(orcamento_planejado=orc_depois, orcamento_material_servico=vinc_depois, indice_produtividade=ind_depois,
               avanco_fisico_historico=hist_depois, curva_s_semanal_planejada=curva_depois, orcamento_horas_janela=jan_depois,
               verba_forma_ids=VERBA_FORMA),
          open(os.path.join('saida_v2', 'pedido20_estado_depois.json'), 'w', encoding='utf-8'), ensure_ascii=False, default=str)

# ------------------------------------------------------------------ SQL
cab_linhas = []
for i in sorted(novo, key=lambda i: [int(x) for x in novo[i]['codigo_eap'].split('.')]):
    n = novo[i]
    if i in orc:
        o = orc[i]
        cab_linhas.append(f"--   {i:4d} {o['codigo_eap']:>7s} {o['pavimento']:<12s} → {n['codigo_eap']:>6s} {n['pavimento']:<12s} "
                          f"qtd {br(o['quantidade'])} → {br(n['quantidade'])} | R$ {br(o['preco_total'])} → {br(n['preco_total'])} | "
                          f"{br(o['hh'], 1)} → {br(n['hh'], 1)} h | S{o['semana_inicio']}–S{o['semana_fim']} → S{n['semana_inicio']}–S{n['semana_fim']}")
    else:
        cab_linhas.append(f"--   {i:4d}   NOVA                 → {n['codigo_eap']:>6s} {n['pavimento']:<12s} qtd {br(n['quantidade'])} "
                          f"{n['unidade']} | R$ {br(n['preco_total'])} | {br(n['hh'], 1)} h | S{n['semana_inicio']}–S{n['semana_fim']}")
for i in SAI:
    o = orc[i]
    cab_linhas.append(f"--   {i:4d} {o['codigo_eap']:>7s} {o['pavimento']:<12s} → SAI (R$ {br(o['preco_total'])}, {br(o['hh'], 1)} h)")
CAB_LINHAS = '\n'.join(cab_linhas)
med_txt = '\n'.join(f"--   {m['codigo']} S{m['semana']:02d} {br(m['p0'], 4)}% → {br(m['p'], 4)}% (corrige a medição id {m['id']})" for m in med)
c9 = next(c for c in curva if c['semana'] == 9); c12 = next(c for c in curva if c['semana'] == 12)
TABS = ['orcamento_p20_bkp_' + BKP, 'curva_p20_bkp_' + BKP, 'avanco_p20_bkp_' + BKP, 'janela_p20_bkp_' + BKP,
        'vinculo_p20_bkp_' + BKP, 'indice_p20_bkp_' + BKP]
AFET = ', '.join(str(i) for i in afetados_antigos)
NOVOS_IDS = ', '.join(str(i) for i in NOVAS)

v_exp = ',\n    '.join(f"({i}, {q(orc[i]['codigo_eap'])}, {q(orc[i]['pavimento'])}, {sqlnum(orc[i]['quantidade'])}, "
                       f"{sqlnum(orc[i]['preco_total'])}, {sqlnum(orc[i]['hh'])}, {orc[i]['semana_inicio']}, {orc[i]['semana_fim']})"
                       for i in afetados_antigos)
v_upd = ',\n    '.join(f"({i}, {q(n['codigo_eap'])}, {q(n['pavimento'])}, {q(n['descricao'])}, {sqlnum(n['quantidade'])}, {q(n['unidade'])}, "
                       f"{sqlnum(n['preco_unitario'])}, {sqlnum(n['preco_total'])}, {sqlnum(n['hh'])}, {n['semana_inicio']}, {n['semana_fim']}, "
                       f"{n['grupo_num']}, {q(n['grupo_nome'])})" for i, n in sorted(novo.items()) if i in orc)
v_ins = ',\n    '.join(f"({i}, 'sirius60', {q(n['codigo_eap'])}, {q(n['descricao'])}, {sqlnum(n['quantidade'])}, {q(n['unidade'])}, "
                       f"{sqlnum(n['preco_unitario'])}, {sqlnum(n['preco_total'])}, {n['semana_inicio']}, {n['semana_fim']}, {q(n['pavimento'])}, "
                       f"{n['grupo_num']}, {q(n['grupo_nome'])}, {sqlnum(n['hh'])}, false, {'true' if n['e_material'] else 'false'})"
                       for i, n in sorted(novo.items()) if i in NOVAS)
v_jan = ',\n    '.join(f"({j['orcamento_id']}, {sqlnum(j['hh'])})" for j in jan_p)
v_med_hoje = ',\n    '.join(f"({m['id']}, {q(m['codigo'])}, {m['semana']}, {q(m['data'])}, {sqlnum(m['p0'])})" for m in med)
v_med = ',\n    '.join(f"({m['id']}, {q(m['codigo'])}, {m['semana']}, {q(m['data'])}, {q(m['competencia'])}, {q(m['atividade'])}, "
                       f"{m['grupo']}, {sqlnum(m['p'], 4)}, {sqlnum(m['hh'])}, {q(m['obs'])})"
                       for m in sorted(med, key=lambda m: (m['semana'], m['data'], m['id'])))
v_curva = ',\n    '.join(f"({c['semana']}, {c['hh_hoje']:.4f}, {c['valor_hoje']:.2f}, {c['hh']:.4f}, {c['perc']:.6f}, {c['perc_acum']:.6f}, "
                         f"{c['valor']:.2f}, {c['valor_acum']:.2f}, {c['perc_valor_acum']:.6f})" for c in mudou)
v_iupd = ',\n    '.join(f"({u[0]}, {q(u[1])}, {q(u[2])}, {sqlnum(u[3]) if u[3] is not None else 'null'}, {sqlnum(u[4]) if u[4] is not None else 'null'})"
                        for u in ind_upd)
v_iins = ',\n    '.join(f"('sirius60', {x['orcamento_id']}, {q(x['codigo_eap'])}, {q(x['pavimento'])}, {q(x['unidade'])}, {q(x['regra'])}, "
                        f"{sqlnum(x['hh_por_unidade']) if x['hh_por_unidade'] is not None else 'null'}, "
                        f"{sqlnum(x['horas_total']) if x['horas_total'] is not None else 'null'}, {q(x['origem'])}, "
                        f"{sqlnum(x['hh_cronograma']) if x['hh_cronograma'] is not None else 'null'}, {'true' if x['conferir'] else 'false'}, "
                        f"{q(x['tipo_equipe'])}, {q(x['observacao'] or '')})" for x in ind_ins)
v_vins = ',\n    '.join(f"({m}, {s})" for m, s in VINC_NOVOS)
REAIS = ', '.join(sqlnum(m['preal'], 4) for m in med if m['p'] == m['preal'])
N_VINC_D = ANTES['vinculos'] - 3 + len(VINC_NOVOS)
N_IND_D = ANTES['indices'] - len(ind_del) + len(ind_ins)
N_JAN_D = ANTES['janelas'] - len(jan_p)

sql = f"""-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 9: orçamento com o PILOTIS no grupo 3 (pedido 20; decisões do Rafael 14/10/2026)
-- Base: automacao/orcamentos/Orcamento_Sirius_60_-_proposta_estrutura_com_Pilotis_v2_2026-10-14.xlsx (aba Orçamento).
-- Gerado por automacao/gerar_sql_pilotis_estrutura.py. Um ÚNICO bloco (DO), sem tabela temporária: grava tudo ou nada.
-- Desfazer: 9-desfazer.sql · Conferência só de leitura: 9-conferir-estado.sql
-- ORDEM: publicar (promover) o código do pedido 20 ANTES deste SQL (verba de forma com as ids novas e rótulo do Subsolo).
--
-- orcamento_planejado (por id; custos, contas a pagar e medições continuam na MESMA linha — nenhum está nas linhas que
-- mudam de código, conferido na trava). Fundação: semanas NÃO mudam; horas ∝ quantidade (índice Hh/un igual). Pilotis: as 1.305 h da atividade 3.1 do
-- cronograma (hoje em orcamento_horas_janela) vão para as linhas de serviço do Pilotis pelas horas reais. Subsolo …
-- Reservatório: horas da própria atividade, ∝ horas × (qtd nova ÷ atual), soma da atividade igual.
{CAB_LINHAS}
--   Linhas {ANTES['linhas']} → {DEPOIS['linhas']} · custo direto R$ {br(ANTES['preco'])} → {br(DEPOIS['preco'])} · horas do orçamento
--   {br(ANTES['hh'], 1)} → {br(DEPOIS['hh'], 1)} · base do avanço {br(ANTES['base'], 1)} → {br(DEPOIS['base'], 1)} (diferença = escada da fundação que sai {br(hh_sai, 1)} h + horas da fundação pela quantidade {br(hh_fund, 1)} h)
--   Verba de forma (14 linhas): R$ {br(verba_antes)} → {br(verba_depois)}.
-- orcamento_horas_janela: saem as {len(jan_p)} linhas do Pilotis (origem 3.0.1, {br(H_PILOTIS, 1)} h); ficam as {N_JAN_D} da 4.0.9.
-- orcamento_material_servico: saem os 3 vínculos da escada da fundação; entram {len(VINC_NOVOS)} do Pilotis; códigos refeitos pelo id.
-- indice_produtividade: código e pavimento pelo id; índice do cronograma (horas ÷ quantidade) refeito onde a quantidade mudou;
--   saem 2.1.10 e 3.0.1; entram 3.1.2, 3.1.4, 3.1.5, 3.1.9 e 3.2.12 (índices do Rafael, iguais aos dos outros pavimentos).
-- curva_s_semanal_planejada: {len(mudou)} semanas mudam; horas {br(ANTES['curva_hh'], 1)} → {br(H1, 1)}; valor R$ {br(ANTES['curva_valor'])} → {br(V1)};
--   planejado acumulado S09 {br(c9['perc_acum_hoje'], 2)}% → {br(c9['perc_acum'], 2)}%; S12 {br(c12['perc_acum_hoje'], 2)}% → {br(c12['perc_acum'], 2)}%.
-- avanco_fisico_historico: mantém a QUANTIDADE executada ({FONTE}); 9 correções novas (as antigas ficam):
{med_txt}
-- Backups (tabelas de verdade, RLS, sem permissão para anon/authenticated): {', '.join(TABS)}.
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric; v_seq text; v_last bigint;
        v_cn int; v_cs numeric; v_ck numeric; v_an int; v_as numeric; v_ak numeric; v_hn int;
begin
  -- ===== TRAVAS ANTES =====
  if {' or '.join(f"to_regclass('public.{t}') is not null" for t in TABS)} then
    raise exception 'backup do passo 9 já existe: este arquivo já foi rodado? Nada foi gravado';
  end if;
  if exists (select 1 from public.orcamento_planejado where id in ({NOVOS_IDS})) then
    raise exception 'já existe linha com id 1001 a 1011: nada foi gravado';
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.orcamento_planejado'::regclass and attname = 'id' and attidentity = 'a') then
    raise exception 'id do orçamento é identity ALWAYS (não aceita id fixo): nada foi gravado';
  end if;
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> {ANTES['linhas']} or v_p <> {ANTES['preco']} or v_h <> {ANTES['hh']} then
    raise exception 'orçamento com % linhas, R$ % e % h (esperado {ANTES['linhas']}, {ANTES['preco']} e {ANTES['hh']}): nada foi gravado', v_n, v_p, v_h;
  end if;
  select round(sum(hh), 1) into v_h from public.orcamento_planejado where obra_id = 'sirius60' and grupo_num <= 16 and codigo_eap <> '1.1.6';
  if v_h <> {ANTES['base']} then raise exception 'base de horas % (esperado {ANTES['base']}): nada foi gravado', v_h; end if;
  with x(id, codigo, pavimento, quantidade, preco_total, hh, semana_inicio, semana_fim) as (values
    {v_exp})
  select count(*) into v_n from public.orcamento_planejado o join x on x.id = o.id
   where o.obra_id = 'sirius60' and o.codigo_eap = x.codigo and o.pavimento = x.pavimento and o.quantidade = x.quantidade
     and o.preco_total = x.preco_total and o.hh = x.hh and o.semana_inicio = x.semana_inicio and o.semana_fim = x.semana_fim;
  if v_n <> {len(afetados_antigos)} then raise exception 'só % das {len(afetados_antigos)} linhas dos grupos 2 e 3 estão como esperado: nada foi gravado', v_n; end if;
  select count(*), round(sum(hh), 1) into v_n, v_h from public.orcamento_horas_janela where obra_id = 'sirius60';
  if v_n <> {ANTES['janelas']} or v_h <> {ANTES['janelas_hh']} then raise exception 'orcamento_horas_janela com % linhas e % h: nada foi gravado', v_n, v_h; end if;
  with j(orcamento_id, hh) as (values
    {v_jan})
  select count(*) into v_n from public.orcamento_horas_janela w join j using (orcamento_id)
   where w.obra_id = 'sirius60' and w.origem = '3.0.1' and w.hh = j.hh and w.semana_inicio = 10 and w.semana_fim = 18;
  if v_n <> {len(jan_p)} then raise exception 'janelas do Pilotis diferentes do esperado: nada foi gravado'; end if;
  if (select count(*) from public.orcamento_material_servico where obra_id = 'sirius60') <> {ANTES['vinculos']}
     or (select count(*) from public.orcamento_material_servico where obra_id = 'sirius60' and material_id in (677, 678, 679) and servico_id = 676) <> 3 then
    raise exception 'vínculos material → serviço diferentes do esperado: nada foi gravado';
  end if;
  if (select count(*) from public.indice_produtividade where obra_id = 'sirius60') <> {ANTES['indices']}
     or (select count(*) from public.indice_produtividade where obra_id = 'sirius60' and orcamento_id in (676, 992)) <> 2
     or exists (select 1 from public.indice_produtividade where orcamento_id in ({NOVOS_IDS})) then
    raise exception 'indice_produtividade diferente do esperado: nada foi gravado';
  end if;
  -- nada lançado nas linhas que saem ou mudam de código (2.1.9 a 2.1.13 e grupo 3)
  if exists (select 1 from public.custos_lancamentos where obra_id = 'sirius60' and (codigo_eap ~ '^2\\.1\\.(9|1[0-3])$' or codigo_eap like '3.%'))
     or exists (select 1 from public.contas_a_pagar where obra_id = 'sirius60' and (codigo_eap ~ '^2\\.1\\.(9|1[0-3])$' or codigo_eap like '3.%'))
     or exists (select 1 from public.avanco_fisico_historico where obra_id = 'sirius60' and (codigo_eap ~ '^2\\.1\\.(9|1[0-3])$' or codigo_eap like '3.%'))
     or exists (select 1 from public.ocorrencias_obra where obra_id = 'sirius60' and (codigo_eap ~ '^2\\.1\\.(9|1[0-3])$' or codigo_eap like '3.%'))
     or exists (select 1 from public.insumo_prazo_entrega where obra_id = 'sirius60' and orcamento_id in ({AFET}))
     or exists (select 1 from public.planejamento_historico where obra_id = 'sirius60' and orcamento_id in ({AFET})) then
    raise exception 'há custo, conta a pagar, medição, ocorrência, compra ou edição nas linhas que saem ou mudam de código: nada foi gravado';
  end if;
  select count(*), round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_n, v_h, v_v
    from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> {ANTES['curva_sem']} or v_h <> {ANTES['curva_hh']} or v_v <> {ANTES['curva_valor']} then
    raise exception 'curva com % semanas, % h e R$ % (esperado {ANTES['curva_sem']}, {ANTES['curva_hh']} e {ANTES['curva_valor']}): nada foi gravado', v_n, v_h, v_v;
  end if;
  with t(semana, hh_hoje, valor_hoje, hh_semanal, perc_hh_semanal, perc_hh_acum, valor_semanal, valor_acum, perc_valor_acum) as (values
    {v_curva})
  select count(*) into v_n from t join public.curva_s_semanal_planejada c on c.obra_id = 'sirius60' and c.semana_numero = t.semana
   and abs(c.hh_semanal - t.hh_hoje) < 0.0001 and abs(c.valor_semanal - t.valor_hoje) < 0.01;
  if v_n <> {len(mudou)} then raise exception 'só % das {len(mudou)} semanas da curva estão como hoje: nada foi gravado', v_n; end if;
  select count(*), count(*) filter (where origem = 'correcao') into v_n, v_hn from public.avanco_fisico_historico where obra_id = 'sirius60';
  if v_n <> {ANTES['hist']} or v_hn <> {ANTES['correcoes']} then
    raise exception 'avanco_fisico_historico com % linhas e % correções (esperado {ANTES['hist']} e {ANTES['correcoes']}): nada foi gravado', v_n, v_hn;
  end if;
  with m(id, codigo, semana, data, p) as (values
    {v_med_hoje})
  select count(*) into v_n from public.avanco_fisico_historico a join m using (id)
   where a.obra_id = 'sirius60' and a.codigo_eap = m.codigo and a.pavimento = 'Fundação' and a.excluido_em is null
     and a.percentual_realizado = m.p and a.semana_numero = m.semana and a.data_lancamento = m.data::date
     and not exists (select 1 from public.avanco_fisico_historico c where c.origem = 'correcao' and a.id = any(c.origem_ids));
  if v_n <> 9 then raise exception 'só % das 9 medições que valem hoje estão como esperado: nada foi gravado', v_n; end if;
  select round(sum(valor_total), 2) into v_v from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if v_v <> {ANTES['indireto']} then raise exception 'indireto R$ % (esperado {ANTES['indireto']}): nada foi gravado', v_v; end if;
  -- custos e contas a pagar por linha (id): guardados para comparar no fim
  select count(*), coalesce(round(sum(valor), 2), 0) into v_cn, v_cs from public.custos_lancamentos where obra_id = 'sirius60';
  select coalesce(round(sum(o.id * c.valor), 2), 0) into v_ck from public.orcamento_planejado o join public.custos_lancamentos c
    on c.obra_id = o.obra_id and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento where o.obra_id = 'sirius60';
  select count(*), coalesce(round(sum(valor), 2), 0) into v_an, v_as from public.contas_a_pagar where obra_id = 'sirius60';
  select coalesce(round(sum(o.id * c.valor), 2), 0) into v_ak from public.orcamento_planejado o join public.contas_a_pagar c
    on c.obra_id = o.obra_id and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento where o.obra_id = 'sirius60';

  -- ===== BACKUP (tabelas de verdade, RLS, sem permissão para anon/authenticated) =====
  create table public.{TABS[0]} as select * from public.orcamento_planejado where obra_id = 'sirius60' and id in ({AFET});
  create table public.{TABS[1]} as select * from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  create table public.{TABS[2]} as select * from public.avanco_fisico_historico where obra_id = 'sirius60';
  create table public.{TABS[3]} as select * from public.orcamento_horas_janela where obra_id = 'sirius60';
  create table public.{TABS[4]} as select * from public.orcamento_material_servico where obra_id = 'sirius60';
  create table public.{TABS[5]} as select * from public.indice_produtividade where obra_id = 'sirius60' and orcamento_id in ({AFET});
{chr(10).join(f"  alter table public.{t} enable row level security;" for t in TABS)}
{chr(10).join(f"  revoke all on public.{t} from anon, authenticated;" for t in TABS)}

  -- ===== SAEM: escada da fundação (2.1.10 a 2.1.13) e 3.0.1, com o que depende delas =====
  delete from public.indice_produtividade where obra_id = 'sirius60' and orcamento_id in (676, 992);
  delete from public.orcamento_material_servico where obra_id = 'sirius60' and material_id in (677, 678, 679);
  delete from public.orcamento_horas_janela where obra_id = 'sirius60' and origem = '3.0.1';
  delete from public.orcamento_planejado where obra_id = 'sirius60' and id in ({', '.join(str(i) for i in SAI)});

  -- ===== ORÇAMENTO: linhas que ficam (por id) =====
  with x(id, codigo, pavimento, descricao, quantidade, unidade, preco_unitario, preco_total, hh, semana_inicio, semana_fim, grupo_num, grupo_nome) as (values
    {v_upd})
  update public.orcamento_planejado o
     set codigo_eap = x.codigo, pavimento = x.pavimento, descricao = x.descricao, quantidade = x.quantidade, unidade = x.unidade,
         preco_unitario = x.preco_unitario, preco_total = x.preco_total, hh = x.hh, semana_inicio = x.semana_inicio,
         semana_fim = x.semana_fim, grupo_num = x.grupo_num, grupo_nome = x.grupo_nome
    from x where o.obra_id = 'sirius60' and o.id = x.id;

  -- ===== ORÇAMENTO: linhas novas (ids fixos 1001 a 1011, usados pelo código da verba de forma) =====
  insert into public.orcamento_planejado (id, obra_id, codigo_eap, descricao, quantidade, unidade, preco_unitario, preco_total,
    semana_inicio, semana_fim, pavimento, grupo_num, grupo_nome, hh, custo_de_tempo, e_material) values
    {v_ins};
  v_seq := pg_get_serial_sequence('public.orcamento_planejado', 'id');
  if v_seq is not null then
    execute format('select last_value from %s', v_seq) into v_last;
    if v_last < 1011 then perform setval(v_seq, 1011); end if;
  end if;

  -- ===== VÍNCULO material → serviço =====
  insert into public.orcamento_material_servico (obra_id, material_id, material_codigo, material_pavimento, servico_id, servico_codigo,
    servico_pavimento, peso)
  select 'sirius60', v.m, '', '', v.s, '', '', 1 from (values
    {v_vins}) v(m, s);
  update public.orcamento_material_servico v
     set material_codigo = m.codigo_eap, material_pavimento = m.pavimento, servico_codigo = s.codigo_eap, servico_pavimento = s.pavimento
    from public.orcamento_planejado m, public.orcamento_planejado s
   where v.obra_id = 'sirius60' and m.obra_id = v.obra_id and s.obra_id = v.obra_id and m.id = v.material_id and s.id = v.servico_id;

  -- ===== ÍNDICES DE PRODUTIVIDADE =====
  with x(orcamento_id, codigo, pavimento, hh_por_unidade, hh_cronograma) as (values
    {v_iupd})
  update public.indice_produtividade i
     set codigo_eap = x.codigo, pavimento = x.pavimento, hh_por_unidade = coalesce(x.hh_por_unidade::numeric, i.hh_por_unidade),
         hh_cronograma = x.hh_cronograma::numeric, atualizado_em = now()
    from x where i.obra_id = 'sirius60' and i.orcamento_id = x.orcamento_id;
  insert into public.indice_produtividade (obra_id, orcamento_id, codigo_eap, pavimento, unidade, regra, hh_por_unidade, horas_total,
    origem, hh_cronograma, conferir, tipo_equipe, observacao) values
    {v_iins};

  -- ===== CURVA PLANEJADA =====
  with t(semana, hh_hoje, valor_hoje, hh_semanal, perc_hh_semanal, perc_hh_acum, valor_semanal, valor_acum, perc_valor_acum) as (values
    {v_curva})
  update public.curva_s_semanal_planejada c set hh_semanal = t.hh_semanal, valor_semanal = t.valor_semanal
    from t where c.obra_id = 'sirius60' and c.semana_numero = t.semana;
  -- % de todas as semanas pelos totais novos
  select sum(hh_semanal), sum(valor_semanal) into v_h, v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  update public.curva_s_semanal_planejada c
     set perc_hh_semanal = round(100 * c.hh_semanal / v_h, 6),
         perc_hh_acum = round(100 * (select sum(y.hh_semanal) from public.curva_s_semanal_planejada y
                                      where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / v_h, 6),
         valor_acum = round((select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                             where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero), 2),
         perc_valor_acum = round(100 * (select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                                         where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / v_v, 6)
   where c.obra_id = 'sirius60';

  -- ===== MEDIÇÕES: correções (as antigas não mudam); em ordem, cada uma com id maior que a que ela corrige =====
  with m(id_antigo, codigo, semana, data, competencia, atividade, grupo, p, hh, obs) as (values
    {v_med})
  insert into public.avanco_fisico_historico (obra_id, codigo_eap, pavimento, percentual_realizado, data_lancamento,
    semana_numero, competencia, atividade_nome, grupo_num, hh_planejado, hh_realizado, medido_por, observacao, origem, origem_ids)
  select 'sirius60', m.codigo, 'Fundação', m.p, m.data::date, m.semana, m.competencia, m.atividade, m.grupo, m.hh,
         round(m.hh * m.p / 100, 2), 'Rafael', m.obs, 'correcao', array[m.id_antigo]::bigint[]
    from m order by m.semana, m.data, m.id_antigo;

  -- ===== TRAVAS DEPOIS (se alguma falhar, nada do que está acima fica gravado) =====
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> {DEPOIS['linhas']} or v_p <> {DEPOIS['preco']} or v_h <> {DEPOIS['hh']} then
    raise exception 'orçamento ficaria com % linhas, R$ % e % h (esperado {DEPOIS['linhas']}, {DEPOIS['preco']} e {DEPOIS['hh']}): nada foi gravado', v_n, v_p, v_h;
  end if;
  select round(sum(hh), 1) into v_h from public.orcamento_planejado where obra_id = 'sirius60' and grupo_num <= 16 and codigo_eap <> '1.1.6';
  if v_h <> {DEPOIS['base']} then
    raise exception 'base de horas ficaria % (esperado {DEPOIS['base']} = {ANTES['base']} − {hh_sai} da escada da fundação − {hh_fund} da fundação pela quantidade): nada foi gravado', v_h;
  end if;
  select round(sum(preco_total), 2) into v_p from public.orcamento_planejado where obra_id = 'sirius60' and id in ({', '.join(str(i) for i in VERBA_FORMA)});
  if v_p <> {verba_depois} then raise exception 'verba de forma ficaria R$ % (esperado {verba_depois}): nada foi gravado', v_p; end if;
  if (select count(distinct material_id) from public.orcamento_material_servico where obra_id = 'sirius60'
        and material_id in ({', '.join(str(i) for i in VERBA_FORMA)})) <> {len(VERBA_FORMA)} then
    raise exception 'alguma linha da verba de forma ficaria sem vínculo com o serviço: nada foi gravado';
  end if;
  if (select count(*) from public.orcamento_material_servico where obra_id = 'sirius60') <> {N_VINC_D}
     or exists (select 1 from public.orcamento_material_servico v where v.obra_id = 'sirius60' and not exists (
          select 1 from public.orcamento_planejado m where m.obra_id = v.obra_id and m.id = v.material_id and m.codigo_eap = v.material_codigo
             and m.pavimento = v.material_pavimento)) then
    raise exception 'vínculos ficariam diferentes do esperado ({N_VINC_D}) ou sem a linha certa: nada foi gravado';
  end if;
  if (select count(*) from public.indice_produtividade where obra_id = 'sirius60') <> {N_IND_D}
     or exists (select 1 from public.indice_produtividade i where i.obra_id = 'sirius60' and not exists (
          select 1 from public.orcamento_planejado o where o.obra_id = i.obra_id and o.id = i.orcamento_id and o.codigo_eap = i.codigo_eap
             and o.pavimento is not distinct from i.pavimento)) then
    raise exception 'índices ficariam diferentes do esperado ({N_IND_D}) ou sem a linha certa: nada foi gravado';
  end if;
  if (select count(*) from public.orcamento_horas_janela where obra_id = 'sirius60') <> {N_JAN_D} then
    raise exception 'orcamento_horas_janela ficaria diferente do esperado ({N_JAN_D}): nada foi gravado';
  end if;
  select count(*), round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_n, v_h, v_v
    from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> {ANTES['curva_sem']} or v_h <> {H1} or abs(v_v - {V1}) > 0.05 then
    raise exception 'curva ficaria com % semanas, % h e R$ % (esperado {ANTES['curva_sem']}, {H1} e {V1}): nada foi gravado', v_n, v_h, v_v;
  end if;
  if abs((select perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = {ANTES['curva_sem']}) - 100) > 0.001
     or abs((select perc_valor_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = {ANTES['curva_sem']}) - 100) > 0.001 then
    raise exception 'curva não fecharia em 100%%: nada foi gravado';
  end if;
  if abs((select perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 9) - {c9['perc_acum']:.6f}) > 0.001 then
    raise exception 'planejado acumulado em S09 diferente da prévia ({c9['perc_acum']:.4f}%%): nada foi gravado';
  end if;
  select count(*), count(*) filter (where origem = 'correcao') into v_n, v_hn from public.avanco_fisico_historico where obra_id = 'sirius60';
  if v_n <> {ANTES['hist'] + 9} or v_n - v_hn <> {ANTES['hist'] - ANTES['correcoes']} then
    raise exception 'avanco_fisico_historico ficaria com % linhas (% correções): esperado {ANTES['hist'] + 9}, com as {ANTES['hist'] - ANTES['correcoes']} medições que não são correção iguais: nada foi gravado', v_n, v_hn;
  end if;
  select count(*) into v_n from public.avanco_fisico_historico c join public.avanco_fisico_historico o on o.id = c.origem_ids[1]
   where c.obra_id = 'sirius60' and c.origem = 'correcao' and c.id > o.id and c.semana_numero = o.semana_numero
     and c.data_lancamento = o.data_lancamento and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento;
  if v_n <> {ANTES['correcoes'] + 9} then raise exception 'só % das {ANTES['correcoes'] + 9} correções ficariam depois da medição corrigida: nada foi gravado', v_n; end if;
  select count(*) into v_n from (
    select distinct on (codigo_eap) codigo_eap, percentual_realizado, origem from public.avanco_fisico_historico
     where obra_id = 'sirius60' and pavimento = 'Fundação' and excluido_em is null and semana_numero <= 9
       and codigo_eap in ('2.1.2', '2.1.6', '2.1.7', '2.1.8')
     order by codigo_eap, semana_numero desc, data_lancamento desc, id desc) u
   where origem = 'correcao' and percentual_realizado in ({REAIS});
  if v_n <> 4 then raise exception 'só % das 4 linhas ficariam com o %% real em S09: nada foi gravado', v_n; end if;
  -- custos e contas a pagar: nada mudou e cada lançamento continua na mesma linha (id)
  if (select count(*) from public.custos_lancamentos where obra_id = 'sirius60') <> v_cn
     or (select coalesce(round(sum(valor), 2), 0) from public.custos_lancamentos where obra_id = 'sirius60') <> v_cs
     or (select coalesce(round(sum(o.id * c.valor), 2), 0) from public.orcamento_planejado o join public.custos_lancamentos c
           on c.obra_id = o.obra_id and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento where o.obra_id = 'sirius60') <> v_ck then
    raise exception 'custos lançados ficariam em outra linha: nada foi gravado';
  end if;
  if (select count(*) from public.contas_a_pagar where obra_id = 'sirius60') <> v_an
     or (select coalesce(round(sum(valor), 2), 0) from public.contas_a_pagar where obra_id = 'sirius60') <> v_as
     or (select coalesce(round(sum(o.id * c.valor), 2), 0) from public.orcamento_planejado o join public.contas_a_pagar c
           on c.obra_id = o.obra_id and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento where o.obra_id = 'sirius60') <> v_ak then
    raise exception 'contas a pagar ficariam em outra linha: nada foi gravado';
  end if;

  raise notice 'passo 9 gravado: orçamento com o Pilotis no grupo 3, curva, vínculos, índices e 9 correções de medição';
end $$;

-- ===== CONFERÊNCIA (só leitura) =====
select 'orçamento' as item, count(*)::text as valor1, round(sum(preco_total), 2)::text as valor2, round(sum(hh), 1)::text as valor3
  from public.orcamento_planejado where obra_id = 'sirius60'
union all
select 'grupo ' || grupo_num, count(*)::text, round(sum(preco_total), 2)::text, round(sum(hh), 1)::text
  from public.orcamento_planejado where obra_id = 'sirius60' and grupo_num in (2, 3) group by grupo_num
union all
select 'curva S09 / S12 (% acum.)', (select perc_hh_acum::text from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 9),
       (select perc_hh_acum::text from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 12), ''
union all
select 'medições (todas / correções)', count(*)::text, count(*) filter (where origem = 'correcao')::text, ''
  from public.avanco_fisico_historico where obra_id = 'sirius60';
"""

conf_ant = ' or '.join(f"to_regclass('public.{t}') is null" for t in TABS)
desf = f"""-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — DESFAZER o PASSO 9 do orçamento (Pilotis no grupo 3, pedido 20). Um ÚNICO bloco (DO): volta as linhas dos
-- grupos 2 e 3 (inclusive as que saíram), apaga as 11 novas (ids 1001 a 1011), volta a curva, as janelas do Pilotis, os
-- vínculos e os índices dos backups e apaga só as correções de medição do passo 9. Os backups ficam (apagar à mão no fim).
-- Rodar ANTES de qualquer desfazer mais antigo (o do passo 8 apaga todas as correções).
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric;
begin
  if {conf_ant} then
    raise exception 'backups do passo 9 não encontrados: nada foi feito';
  end if;
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> {DEPOIS['linhas']} or v_p <> {DEPOIS['preco']} or v_h <> {DEPOIS['hh']} then
    raise exception 'orçamento com % linhas, R$ % e % h — não está como o passo 9 deixou (alguém mexeu depois?): nada foi feito', v_n, v_p, v_h;
  end if;
  if (select count(*) from public.{TABS[0]}) <> {len(afetados_antigos)} or (select count(*) from public.{TABS[1]}) <> {ANTES['curva_sem']}
     or (select count(*) from public.{TABS[3]}) <> {ANTES['janelas']} or (select count(*) from public.{TABS[4]}) <> {ANTES['vinculos']} then
    raise exception 'backup do passo 9 incompleto: nada foi feito';
  end if;
  if exists (select 1 from public.custos_lancamentos c where c.obra_id = 'sirius60' and c.codigo_eap like '3.%')
     or exists (select 1 from public.contas_a_pagar c where c.obra_id = 'sirius60' and c.codigo_eap like '3.%')
     or exists (select 1 from public.avanco_fisico_historico a where a.obra_id = 'sirius60' and a.codigo_eap like '3.%') then
    raise exception 'já há custo, conta a pagar ou medição no grupo 3 com os códigos novos: desfazer à mão, nada foi feito';
  end if;

  delete from public.indice_produtividade where obra_id = 'sirius60' and orcamento_id in ({AFET}, {NOVOS_IDS});
  insert into public.indice_produtividade select * from public.{TABS[5]};
  delete from public.orcamento_material_servico where obra_id = 'sirius60';
  insert into public.orcamento_material_servico select * from public.{TABS[4]};
  delete from public.orcamento_horas_janela where obra_id = 'sirius60';
  insert into public.orcamento_horas_janela select * from public.{TABS[3]};
  delete from public.orcamento_planejado where obra_id = 'sirius60' and id in ({NOVOS_IDS});
  delete from public.orcamento_planejado where obra_id = 'sirius60' and id in ({AFET});
  insert into public.orcamento_planejado select * from public.{TABS[0]};
  update public.curva_s_semanal_planejada c
     set hh_semanal = b.hh_semanal, perc_hh_semanal = b.perc_hh_semanal, perc_hh_acum = b.perc_hh_acum,
         valor_semanal = b.valor_semanal, valor_acum = b.valor_acum, perc_valor_acum = b.perc_valor_acum
    from public.{TABS[1]} b where c.obra_id = 'sirius60' and b.obra_id = c.obra_id and b.semana_numero = c.semana_numero;
  delete from public.avanco_fisico_historico a where a.obra_id = 'sirius60' and a.origem = 'correcao'
     and not exists (select 1 from public.{TABS[2]} b where b.id = a.id);

  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> {ANTES['linhas']} or v_p <> {ANTES['preco']} or v_h <> {ANTES['hh']} then
    raise exception 'orçamento ficaria com % linhas, R$ % e % h (esperado {ANTES['linhas']}, {ANTES['preco']} e {ANTES['hh']}): nada foi desfeito', v_n, v_p, v_h;
  end if;
  select round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_h, v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_h <> {ANTES['curva_hh']} or v_v <> {ANTES['curva_valor']} then raise exception 'curva ficaria com % h e R$ %: nada foi desfeito', v_h, v_v; end if;
  if (select count(*) from public.avanco_fisico_historico where obra_id = 'sirius60' and origem = 'correcao') <> {ANTES['correcoes']} then
    raise exception 'correções de medição não voltariam a {ANTES['correcoes']}: nada foi desfeito';
  end if;
  if (select count(*) from public.indice_produtividade where obra_id = 'sirius60') <> {ANTES['indices']}
     or (select count(*) from public.orcamento_material_servico where obra_id = 'sirius60') <> {ANTES['vinculos']}
     or (select count(*) from public.orcamento_horas_janela where obra_id = 'sirius60') <> {ANTES['janelas']} then
    raise exception 'índices, vínculos ou janelas não voltariam ao de antes: nada foi desfeito';
  end if;
  raise notice 'passo 9 desfeito';
end $$;

-- Depois de conferir, se quiser apagar os backups (rodar à parte):
{chr(10).join(f"-- drop table public.{t};" for t in TABS)}
"""

conf = f"""-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- SÓ LEITURA (não grava nada): estado do banco em relação ao passo 9 (pedido 20, Pilotis no grupo 3).
-- Esperado ANTES: {ANTES['linhas']} linhas · R$ {ANTES['preco']} · {ANTES['hh']} h · base {ANTES['base']} · grupo 3 sem Pilotis (só a 3.0.1) ·
--   janelas {ANTES['janelas']} · vínculos {ANTES['vinculos']} · índices {ANTES['indices']} · medições {ANTES['hist']} (correções {ANTES['correcoes']}) ·
--   curva {ANTES['curva_hh']} h / R$ {ANTES['curva_valor']} · verba de forma (14 ids) {r2(sum(orc[i]['preco_total'] for i in VERBA_FORMA if i in orc))} · backups "não existe".
-- Esperado DEPOIS: {DEPOIS['linhas']} linhas · R$ {DEPOIS['preco']} · {DEPOIS['hh']} h · base {DEPOIS['base']} · Pilotis com 12 linhas ·
--   janelas {N_JAN_D} · vínculos {N_VINC_D} · índices {N_IND_D} · medições {ANTES['hist'] + 9} (correções {ANTES['correcoes'] + 9}) ·
--   curva {H1} h / R$ {V1} · verba de forma {verba_depois} · backups "EXISTE".
select 'orçamento (linhas, R$, h)' as item, count(*)::text as valor1, round(sum(preco_total), 2)::text as valor2, round(sum(hh), 1)::text as valor3
  from public.orcamento_planejado where obra_id = 'sirius60'
union all
select 'base de horas do avanço', round(sum(hh), 1)::text, '', '' from public.orcamento_planejado
 where obra_id = 'sirius60' and grupo_num <= 16 and codigo_eap <> '1.1.6'
union all
select 'linhas do Pilotis no grupo 3', count(*)::text, round(sum(preco_total), 2)::text, round(sum(hh), 1)::text
  from public.orcamento_planejado where obra_id = 'sirius60' and grupo_num = 3 and pavimento = 'Pilotis'
union all
select 'linhas 1001 a 1011', count(*)::text, '', '' from public.orcamento_planejado where id in ({NOVOS_IDS})
union all
select 'verba de forma (14 ids)', round(sum(preco_total), 2)::text, '', '' from public.orcamento_planejado
 where obra_id = 'sirius60' and id in ({', '.join(str(i) for i in VERBA_FORMA)})
union all
select 'janelas / vínculos / índices', (select count(*) from public.orcamento_horas_janela where obra_id = 'sirius60')::text,
       (select count(*) from public.orcamento_material_servico where obra_id = 'sirius60')::text,
       (select count(*) from public.indice_produtividade where obra_id = 'sirius60')::text
union all
select 'medições (todas / correções)', count(*)::text, count(*) filter (where origem = 'correcao')::text, ''
  from public.avanco_fisico_historico where obra_id = 'sirius60'
union all
select 'backup ' || t, case when to_regclass('public.' || t) is null then 'não existe' else 'EXISTE' end, '', ''
  from unnest(array[{', '.join(q(t) for t in TABS)}]) t
union all
select 'curva (h, R$, % acum. S09)', round(sum(hh_semanal), 1)::text, round(sum(valor_semanal), 2)::text,
       max(case when semana_numero = 9 then perc_hh_acum end)::text
  from public.curva_s_semanal_planejada where obra_id = 'sirius60';
"""

os.makedirs(a.destino, exist_ok=True)
for nome, txt in [('9-pilotis-estrutura.sql', sql), ('9-desfazer.sql', desf), ('9-conferir-estado.sql', conf)]:
    open(os.path.join(a.destino, nome), 'w', encoding='utf-8', newline='\n').write(txt)

# ------------------------------------------------------------------ resumo
json.dump(dict(antes=ANTES, depois=DEPOIS, hh_sai=hh_sai, verba_antes=verba_antes, verba_depois=verba_depois,
               curva=dict(H=H1, V=V1, semanas=[{k: c[k] for k in ['semana', 'perc_acum_hoje', 'perc_acum', 'valor_acum_hoje', 'valor_acum', 'hh_hoje', 'hh']} for c in curva]),
               atividades={k: dict(total=v['total'], antes={str(i): h for i, h in v['antes'].items()}, depois={str(i): h for i, h in v['depois'].items()})
                           for k, v in ativ_info.items()},
               pilotis=dict(real={str(i): round(v, 2) for i, v in real_h.items()}, horas={str(i): hp[i] for i in hp}),
               linhas={str(i): {k: n[k] for k in ['codigo_eap', 'pavimento', 'quantidade', 'unidade', 'preco_total', 'hh', 'semana_inicio', 'semana_fim']}
                       | ({'antes': {k: orc[i][k] for k in ['codigo_eap', 'pavimento', 'quantidade', 'preco_total', 'hh', 'semana_inicio', 'semana_fim']}} if i in orc else {})
                       for i, n in novo.items()},
               sai={str(i): {k: orc[i][k] for k in ['codigo_eap', 'pavimento', 'preco_total', 'hh']} for i in SAI},
               medicoes=med, indices_cronograma=[(u[0], u[1], u[5]['hh_por_unidade'], u[3]) for u in ind_upd if u[3] is not None]),
          open(os.path.join('saida_v2', 'pedido20_resumo.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=str)
print(f"linhas {ANTES['linhas']} → {DEPOIS['linhas']} | direto {br(ANTES['preco'])} → {br(DEPOIS['preco'])} (pedido: {br(ESPERADO_DIRETO)})")
print(f"horas {br(ANTES['hh'], 1)} → {br(DEPOIS['hh'], 1)} | base {br(ANTES['base'], 1)} → {br(DEPOIS['base'], 1)} (escada sai {br(hh_sai, 1)} h)")
print(f"verba de forma {br(verba_antes)} → {br(verba_depois)} | curva {br(ANTES['curva_hh'], 1)} → {br(H1, 1)} h; R$ {br(ANTES['curva_valor'])} → {br(V1)}; {len(mudou)} semanas")
print(f"S09 {c9['perc_acum_hoje']:.4f} → {c9['perc_acum']:.4f} | S12 {c12['perc_acum_hoje']:.4f} → {c12['perc_acum']:.4f}")
for act, v in ativ_info.items():
    print(f"  atividade {act}: {br(v['total'], 1)} h | " + ' '.join(f"{novo[i]['codigo_eap']}={br(h, 1)}" for i, h in v['depois'].items()))
print('  Pilotis: ' + ' '.join(f"{novo[i]['codigo_eap']} real {br(real_h[i], 1)} → {br(hp[i], 1)} h S{novo[i]['semana_inicio']}–S{novo[i]['semana_fim']}" for i in SERV_PILOTIS))
for m in med:
    print(f"  medição {m['codigo']} S{m['semana']:02d} id {m['id']}: {m['p0']} → {m['p']}")

# ------------------------------------------------------------------ CSVs (só com --csv): tipos por id e correspondência
if a.csv:
    import correspondencia as C
    # o backup é a versão de ANTES do pedido 20: se já existe (rodada anterior), a tabela é refeita a partir dele
    for arq_csv in [TIPOS, CORRESP]:
        dest = arq_csv.replace('.csv', SUF_CSV + '.csv')
        if not os.path.exists(dest):
            shutil.copy2(arq_csv, dest)
    orig = lambda arq_csv: arq_csv.replace('.csv', SUF_CSV + '.csv')
    t = pd.read_csv(orig(TIPOS), dtype=str).fillna('')
    t = t[~t.id.astype(int).isin(SAI)].copy()
    for k in t.index:
        i = int(t.id[k])
        if i in novo:
            t.loc[k, 'codigo_eap'] = novo[i]['codigo_eap']; t.loc[k, 'pavimento'] = novo[i]['pavimento']
            t.loc[k, 'atividade'] = tipo_novo[i].atividade
    linhas_novas = [dict(id=str(i), codigo_eap=novo[i]['codigo_eap'], pavimento=novo[i]['pavimento'], material=str(TIPO_NOVA[i][0]),
                         tipo_material=TIPO_NOVA[i][1], tipo_servico=TIPO_NOVA[i][2], servico_estrutura=TIPO_NOVA[i][3],
                         atividade=TIPO_NOVA[i][4], regra=TIPO_NOVA[i][5], descricao_em_2026_10_09=novo[i]['descricao'] + ' (nova, pedido 20)')
                    for i in NOVAS]
    t = pd.concat([t, pd.DataFrame(linhas_novas)], ignore_index=True)
    t.to_csv(TIPOS, index=False, encoding='utf-8-sig')
    c = pd.read_csv(orig(CORRESP), dtype=str).fillna('')
    c = c[~c.id.astype(int).isin(SAI)].copy()
    data_ini = {int(r.semana_numero): r.data_inicio for r in cal.itertuples()}
    data_fim = {int(r.semana_numero): r.data_fim for r in cal.itertuples()}
    def linha_corr(i, base=None):
        tn = tipo_novo[i]; n = novo[i]
        r = crono.loc[tn.atividade]
        pos = C.posicao_da_linha(O(tn.regra, tn.atividade, tn.servico_estrutura), int(r.dur))
        d = dict(base or {})
        d.update(id=str(i), codigo_eap=n['codigo_eap'], pavimento=n['pavimento'], descricao=n['descricao'], atividade_cronograma=tn.atividade,
                 atividade_nome=C.nome_limpo(r.descricao), cronograma_semana_inicio=str(int(r.ini)), cronograma_semana_fim=str(int(r.fim)),
                 semana_inicio=str(n['semana_inicio']), semana_fim=str(n['semana_fim']), data_inicio=str(data_ini[n['semana_inicio']]),
                 data_fim=str(data_fim[n['semana_fim']]), horas_orcamento=str(n['hh']), quantidade_orcamento=str(n['quantidade']),
                 unidade_orcamento=n['unidade'], regra_posicao=pos)
        if tn.atividade in ('3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8') and 'quantidade_cronograma' not in (base or {}):
            d.update(quantidade_cronograma='', unidade_cronograma='m²', observacao=f'estrutura do pavimento "{C.nome_limpo(r.descricao)}"',
                     conferido_rafael='')
        return d
    for k in c.index:
        i = int(c.id[k])
        if i in novo:
            d = linha_corr(i, c.loc[k].to_dict())
            if i == 692:
                d['quantidade_cronograma'] = ''
                d['observacao'] = 'pedido 20: treliçada do Pilotis (era a 3.1.12 do Subsolo)'
            if i == 675:
                d['observacao'] = 'pedido 20: era a 2.1.9 da fundação; mantém horas e semanas da atividade de piso do cronograma'
            for col, v in d.items():
                c.loc[k, col] = v
    novas_c = [linha_corr(i, {'quantidade_cronograma': '', 'unidade_cronograma': '', 'observacao': 'nova (pedido 20)', 'conferido_rafael': ''})
               for i in NOVAS if not TIPO_NOVA[i][0]]
    c = pd.concat([c, pd.DataFrame(novas_c)], ignore_index=True)[list(c.columns)]
    c.to_csv(CORRESP, index=False, encoding='utf-8-sig')
    c2 = pd.read_csv(CORRESP, dtype={'codigo_eap': str, 'atividade_cronograma': str, 'regra_posicao': str}).fillna(
        {'atividade_cronograma': '', 'regra_posicao': ''})
    C.escrever_sql(c2, os.path.join('..', 'supabase', 'cronograma'))
    print(f'CSVs atualizados (backups {SUF_CSV}); tipos {len(t)} linhas; correspondência {len(c)} linhas; 1-ligacao-cronograma.sql reescrito')
