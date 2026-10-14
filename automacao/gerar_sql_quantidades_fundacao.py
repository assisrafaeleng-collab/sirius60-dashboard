"""
Gera o SQL do pedido 19: correção das QUANTIDADES da fundação (correção da memória de cálculo do orçamento, Rafael 14/10)
e das MEDIÇÕES da fundação pelo levantamento real do Rafael. Só escreve os arquivos; quem decide e roda é o Rafael.

Uso: py gerar_sql_quantidades_fundacao.py [--horas-215 proporcional|manter] [--destino ../supabase/orcamento]
Escreve: 8-quantidades-fundacao.sql, 8-quantidades-fundacao-desfazer.sql e saida_v2/correcoes_medicao_pedido19.json
Lê (exportados do banco em 14/10, só leitura): saida_v2/curva_banco_2026-10-14.json (curva_s_semanal_planejada) e
  saida_v2/medicoes_banco_2026-10-14.json (avanco_fisico_historico).

Linhas (por id, nunca pelo texto); preço unitário não muda, valor = quantidade nova × unitário:
  670 2.1.4 aço (material)       18.102,18 → 16.578,47 kg
  673 2.1.7 armação (MO)         18.102,18 → 16.578,47 kg (par com a 2.1.4)
  671 2.1.5 concreto (material)     389,53 → 529,80 m³
  2.1.3 / 2.1.6 (forma, 688,17 m²), 2.1.2 (escavação) e 2.1.8 (6 diárias) não mudam.
Horas: horas novas = horas atuais × (quantidade nova ÷ atual), arredondadas a 0,1 h (o índice Hh/un fica igual).
  A 2.1.5 é "apenas material", mas tem 725,6 h no banco (a mão de obra da concretagem ficou nela; a 2.1.8 tem 20,3 h):
  --horas-215 proporcional  → 725,6 × 529,80 ÷ 389,53 = 986,9 h (DECISÃO do Rafael, 14/10; padrão)
  --horas-215 manter        → continua 725,6 h
Curva planejada: cada linha muda só na SUA janela do cronograma (mesmas contas do cronograma.py): aço e armação na
  janela da armação da atividade "Forma + armação" (cronograma 4–13, armação 0–9,5); concreto na "Concretagem"
  (cronograma 6–14, 0–9). Horas e valor da curva variam exatamente pela diferença das linhas.
Medições REAIS (levantamento do Rafael 14/10/2026, situação física até 30/09/2026 = S09):
  2.1.1 100% (já está) · 2.1.2 216,04 de 389,53 m³ = 55,4617% · 2.1.6 97,16 de 688,17 m² = 14,1186% ·
  2.1.7 5.781,07 de 16.578,47 kg = 34,8710% · 2.1.8 194,77 de 529,80 m³ = 36,7629% (por volume; a linha segue em diárias).
  Histórico: as medições antigas ficam como estão; para cada uma entra uma "correção" (origem 'correcao') na MESMA
  semana e data, com % antigo × fator (fator = % real ÷ % antigo da última medição até S09); id maior → vale no lugar
  dela. A curva realizada não tem degrau, nenhuma passa de 100% nem cai entre semanas. Substitui os "ajustes de
  quantidade" (54,5954% / 76,4336%) da 1ª prévia.
"""
import argparse, json, os
from cronograma import calendario, espalhar_coord

LINHAS = {  # id: (código, qtd antiga, qtd nova, unitário, preço antigo, hh antigo, janela (b, x0, x1))
    670: ('2.1.4', 18102.18, 16578.47, 6.92, 125267.11, 650.9, (3, 0, 9.5)),
    671: ('2.1.5', 389.53, 529.80, 660.00, 257091.12, 725.6, (5, 0, 9)),
    673: ('2.1.7', 18102.18, 16578.47, 3.00, 54306.55, 282.2, (3, 0, 9.5)),
}
REAL = {  # código: (quantidade executada até 30/09, quantidade do orçamento corrigido, % informado pelo Rafael, unidade)
    '2.1.2': (216.04, 389.53, 55.4617, 'm³'),
    '2.1.6': (97.16, 688.17, 14.1186, 'm²'),
    '2.1.7': (5781.07, 16578.47, 34.8710, 'kg'),
    '2.1.8': (194.77, 529.80, 36.7629, 'm³ (por volume)'),
}
HH_SERV = {'2.1.2': 1558.1, '2.1.6': 214.6, '2.1.7': None, '2.1.8': 20.3}  # None = horas novas da 673
FONTE = 'levantamento do Rafael 14/10/2026'
ANTES = dict(linhas=333, preco=7123256.27, hh=49510.9, curva_sem=117, curva_hh=48454.8, curva_valor=6325932.24,
             hist=17, indireto=2874508.08)
BKP = '20261014'

ap = argparse.ArgumentParser()
ap.add_argument('--horas-215', choices=['manter', 'proporcional'], default='proporcional')
ap.add_argument('--destino', default='../supabase/orcamento')
a = ap.parse_args()

novo = {}
for i, (cod, q0, q1, unit, p0, h0, jan) in LINHAS.items():
    h1 = h0 if (i == 671 and a.horas_215 == 'manter') else round(h0 * q1 / q0, 1)
    novo[i] = dict(qtd=q1, preco=round(q1 * unit, 2), hh=h1)
d_preco = round(sum(novo[i]['preco'] - LINHAS[i][4] for i in LINHAS), 2)
d_hh = round(sum(novo[i]['hh'] - LINHAS[i][5] for i in LINHAS), 1)
DEPOIS = dict(preco=round(ANTES['preco'] + d_preco, 2), hh=round(ANTES['hh'] + d_hh, 1))

# correções de medição: para cada medição antiga (não excluída) das linhas de REAL, % antigo × fator
hist = json.load(open(os.path.join('saida_v2', 'medicoes_banco_2026-10-14.json'), encoding='utf-8'))
assert len(hist) == ANTES['hist']
med, fatores = [], {}
for cod, (q, qtot, preal, un) in REAL.items():
    assert abs(round(100 * q / qtot, 4) - preal) < 0.00006, (cod, 100 * q / qtot)
    rs = sorted([r for r in hist if r['codigo_eap'] == cod and r['pavimento'] == 'Fundação' and not r['excluido_em']],
                key=lambda r: (r['semana_numero'], r['data_lancamento'], r['id']))
    assert rs and all(r['semana_numero'] <= 9 for r in rs), cod
    p_ult = float(rs[-1]['percentual_realizado'])
    f = preal / p_ult
    fatores[cod] = (p_ult, f)
    hh = HH_SERV[cod] if HH_SERV[cod] is not None else novo[673]['hh']
    ant = 0.0
    for k, r in enumerate(rs):
        p0 = float(r['percentual_realizado'])
        pn = preal if k == len(rs) - 1 else round(p0 * f, 4)
        assert 0 <= pn <= 100 and pn >= ant, (cod, pn)
        ant = pn
        med.append(dict(id=r['id'], codigo=cod, semana=r['semana_numero'], data=r['data_lancamento'][:10],
                        competencia=r['competencia'], atividade=r['atividade_nome'], grupo=r['grupo_num'],
                        p0=p0, p=pn, hh=hh, fator=f))
json.dump(dict(fonte=FONTE, horas_215=a.horas_215, linhas={str(i): novo[i] for i in novo}, correcoes=med),
          open(os.path.join('saida_v2', 'correcoes_medicao_pedido19.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
LISTA_REAL = ', '.join(f"'{c}'" for c in REAL)

# curva: Δ de cada linha na sua janela
cal = calendario()
dh_dia, dv_dia = {}, {}
for i, (cod, q0, q1, unit, p0, h0, (b, x0, x1)) in LINHAS.items():
    espalhar_coord(cal, b + x0, b + x1, novo[i]['hh'] - h0, dh_dia)
    espalhar_coord(cal, b + x0, b + x1, novo[i]['preco'] - p0, dv_dia)
sem = lambda por_dia: {int(x.semana_numero): sum(v for dt, v in por_dia.items() if x.data_inicio <= dt <= x.data_fim) for x in cal.itertuples()}
dh, dv = sem(dh_dia), sem(dv_dia)
banco = json.load(open(os.path.join('saida_v2', 'curva_banco_2026-10-14.json'), encoding='utf-8'))
assert len(banco) == ANTES['curva_sem'] and round(sum(float(c['hh_semanal']) for c in banco), 1) == ANTES['curva_hh']
H = sum(float(c['hh_semanal']) for c in banco) + sum(dh.values())
V = sum(float(c['valor_semanal']) for c in banco) + sum(dv.values())
curva, ah, av = [], 0.0, 0.0
for c in banco:
    w = int(c['semana_numero'])
    h = float(c['hh_semanal']) + dh.get(w, 0.0); v = float(c['valor_semanal']) + dv.get(w, 0.0)
    ah += h; av += v
    curva.append((w, float(c['hh_semanal']), float(c['valor_semanal']), h, 100 * h / H, 100 * ah / H, v, av, 100 * av / V,
                  float(c['perc_hh_acum'])))
H1, V1 = round(H, 1), round(V, 2)
med9 = curva[8]; med12 = curva[11]

def br(v, n=2):
    return f'{v:,.{n}f}'.replace(',', 'X').replace('.', ',').replace('X', '.')

linhas_med = ''.join(
    f"--   {cod} real {br(REAL[cod][0], 2)} de {br(REAL[cod][1], 2)} {REAL[cod][3]} = {br(REAL[cod][2], 4)}% · fator "
    f"{br(REAL[cod][2], 4)} ÷ {br(fatores[cod][0], 0)} = {br(fatores[cod][1], 6)}:\n--     "
    + ', '.join(f"S{m['semana']:02d} {br(m['p0'], 0)}% → {br(m['p'], 4)}%" for m in med if m['codigo'] == cod) + "\n"
    for cod in REAL)

cab = f"""-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 8: quantidades e medições da fundação (pedido 19; Rafael 14/10/2026)
-- CORREÇÃO DA MEMÓRIA DE CÁLCULO do orçamento (não é mudança de projeto/escopo) + medições reais. Gerado por
-- automacao/gerar_sql_quantidades_fundacao.py --horas-215 {a.horas_215}. Um único bloco: grava tudo ou nada.
-- Desfazer: 8-quantidades-fundacao-desfazer.sql
--
-- orcamento_planejado (por id; preço unitário não muda):
--   670 2.1.4 aço       18.102,18 → 16.578,47 kg | R$ 125.267,11 → {br(novo[670]['preco'])} | {br(650.9, 1)} → {br(novo[670]['hh'], 1)} h
--   673 2.1.7 armação   18.102,18 → 16.578,47 kg | R$  54.306,55 → {br(novo[673]['preco'])} | {br(282.2, 1)} → {br(novo[673]['hh'], 1)} h
--   671 2.1.5 concreto     389,53 → 529,80 m³    | R$ 257.091,12 → {br(novo[671]['preco'])} | {br(725.6, 1)} → {br(novo[671]['hh'], 1)} h ({a.horas_215})
--   Custo direto R$ {br(ANTES['preco'])} → {br(DEPOIS['preco'])} ({'+' if d_preco >= 0 else ''}{br(d_preco)}); total da obra
--   R$ {br(ANTES['preco'] + ANTES['indireto'])} → {br(DEPOIS['preco'] + ANTES['indireto'])}. Horas do orçamento {br(ANTES['hh'], 1)} → {br(DEPOIS['hh'], 1)}.
-- curva_s_semanal_planejada: só as semanas das janelas dessas linhas (aço/armação: armação da "Forma + armação";
--   concreto: "Concretagem"); horas {br(ANTES['curva_hh'], 1)} → {br(H1, 1)}; valor R$ {br(ANTES['curva_valor'])} → {br(V1)}.
--   Planejado acumulado: S09 {br(med9[9], 2)}% → {br(med9[5], 2)}%; S12 {br(med12[9], 2)}% → {br(med12[5], 2)}%.
-- avanco_fisico_historico: MEDIÇÕES REAIS ({FONTE}; situação até 30/09/2026 = S09). As medições antigas NÃO
--   mudam; entram {len(med)} "correções" (origem 'correcao'), na MESMA semana e data de cada medição antiga, com
--   % antigo × fator (fator = % real ÷ % antigo da última medição); id maior → vale no lugar da antiga:
{linhas_med}--   2.1.1 já está em 100% (sem mudança). A regra da coluna origem passa a aceitar 'correcao'.
-- Travas antes e depois (nada é gravado se algo não bater). Backups (RLS, sem permissão para anon/authenticated):
--   orcamento_quantidades_bkp_{BKP}, curva_s_quantidades_bkp_{BKP}, avanco_quantidades_bkp_{BKP}.
-- Código ANTES do SQL: lib/medicao-servidor.js + telas de medição mostram "correção da medição" e a antiga riscada
--   (sem o código novo os números ficam certos, mas a tela lista as duas medições da semana sem dizer qual vale).
-- =====================================================================
"""

valores_curva = ',\n'.join(f"  ({w}, {h0:.4f}, {v0:.2f}, {h:.4f}, {ps:.6f}, {pa:.6f}, {v:.2f}, {va:.2f}, {pv:.6f})"
                           for w, h0, v0, h, ps, pa, v, va, pv, _ in curva if abs(h - h0) > 1e-9 or abs(v - v0) > 1e-9)
n_curva = valores_curva.count('\n') + 1
valores_med = ',\n'.join(
    f"  ({m['id']}, '{m['codigo']}', {m['semana']}, '{m['data']}', '{m['competencia']}', '{m['atividade']}', {m['grupo']}, "
    f"{m['p0']:g}, {m['p']:.4f}, {m['hh']}, 'correção da medição ({FONTE}; pedido 19): real até 30/09 = "
    f"{br(REAL[m['codigo']][0], 2)} de {br(REAL[m['codigo']][1], 2)} {REAL[m['codigo']][3]} = {br(REAL[m['codigo']][2], 4)}%; "
    f"{br(m['p0'], 0)}% × {br(m['fator'], 6)}')" for m in med)

TOPO = "-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)\n"
# CTEs com os dados (sem tabela temporária: cada comando traz os seus valores)
CTE_ORC = "with x(id, codigo, qtd0, preco0, hh0, qtd, preco, hh) as (values\n" + ',\n'.join(
    f"    ({i}, '{LINHAS[i][0]}', {LINHAS[i][1]}, {LINHAS[i][4]}, {LINHAS[i][5]}, {novo[i]['qtd']}, {novo[i]['preco']}, {novo[i]['hh']})"
    for i in LINHAS) + ")\n"
CTE_CURVA = ("with t(semana, hh_hoje, valor_hoje, hh_semanal, perc_hh_semanal, perc_hh_acum, valor_semanal, valor_acum, perc_valor_acum) as (values\n"
             + '\n'.join('  ' + l for l in valores_curva.split('\n')) + ")\n")
CTE_MED = ("with m(id_antigo, codigo, semana, data, competencia, atividade, grupo, p_antigo, p, hh, obs) as (values\n"
           + '\n'.join('  ' + l for l in valores_med.split('\n')) + ")\n")

sql = TOPO + cab + f"""-- Tudo num ÚNICO bloco (DO): ou grava tudo, ou não grava nada (qualquer trava que falhar desfaz o bloco inteiro).
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric;
begin
  -- ===== TRAVAS ANTES =====
  if to_regclass('public.orcamento_quantidades_bkp_{BKP}') is not null or to_regclass('public.curva_s_quantidades_bkp_{BKP}') is not null
     or to_regclass('public.avanco_quantidades_bkp_{BKP}') is not null then
    raise exception 'backup já existe: este arquivo já foi rodado? Nada foi gravado';
  end if;
  {CTE_ORC}  select count(*) into v_n from public.orcamento_planejado o join x on x.id = o.id
   where o.obra_id = 'sirius60' and o.codigo_eap = x.codigo and o.pavimento = 'Fundação'
     and o.quantidade = x.qtd0 and o.preco_total = x.preco0 and o.hh = x.hh0;
  if v_n <> 3 then raise exception 'só % das 3 linhas (670, 671, 673) estão como esperado: nada foi gravado', v_n; end if;
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> {ANTES['linhas']} or v_p <> {ANTES['preco']} or v_h <> {ANTES['hh']} then
    raise exception 'orçamento com % linhas, R$ % e % h (esperado {ANTES['linhas']}, {ANTES['preco']} e {ANTES['hh']}): nada foi gravado', v_n, v_p, v_h;
  end if;
  select count(*), round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_n, v_h, v_v
    from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> {ANTES['curva_sem']} or v_h <> {ANTES['curva_hh']} or v_v <> {ANTES['curva_valor']} then
    raise exception 'curva com % semanas, % h e R$ % (esperado {ANTES['curva_sem']}, {ANTES['curva_hh']} e {ANTES['curva_valor']}): nada foi gravado', v_n, v_h, v_v;
  end if;
  if abs((select perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = {ANTES['curva_sem']}) - 100) > 0.001 then
    raise exception 'curva de hoje não fecha em 100%%: nada foi gravado';
  end if;
  {CTE_CURVA}  select count(*) into v_n from t join public.curva_s_semanal_planejada c on c.obra_id = 'sirius60' and c.semana_numero = t.semana
   and abs(c.hh_semanal - t.hh_hoje) < 0.0001 and abs(c.valor_semanal - t.valor_hoje) < 0.01;
  if v_n <> {n_curva} then raise exception 'só % das {n_curva} semanas da curva estão como hoje: nada foi gravado', v_n; end if;
  select count(*) into v_n from public.avanco_fisico_historico where obra_id = 'sirius60';
  if v_n <> {ANTES['hist']} then raise exception 'avanco_fisico_historico com % linhas (esperado {ANTES['hist']}): nada foi gravado', v_n; end if;
  if exists (select 1 from public.avanco_fisico_historico where obra_id = 'sirius60' and origem = 'correcao') then
    raise exception 'já existe medição com origem correcao: nada foi gravado';
  end if;
  {CTE_MED}  select count(*) into v_n from public.avanco_fisico_historico a join m on m.id_antigo = a.id
   where a.obra_id = 'sirius60' and a.codigo_eap = m.codigo and a.pavimento = 'Fundação' and a.excluido_em is null
     and a.percentual_realizado = m.p_antigo and a.semana_numero = m.semana and a.data_lancamento = m.data::date;
  if v_n <> {len(med)} then raise exception 'só % das {len(med)} medições antigas estão como esperado: nada foi gravado', v_n; end if;
  if (select count(*) from public.avanco_fisico_historico where obra_id = 'sirius60' and pavimento = 'Fundação' and excluido_em is null
        and codigo_eap in ({LISTA_REAL})) <> {len(med)} then
    raise exception 'as linhas {', '.join(REAL)} têm medição além das esperadas (alguém mediu depois?): nada foi gravado';
  end if;
  if (select percentual_realizado from public.avanco_fisico_historico where obra_id = 'sirius60' and id = 3 and codigo_eap = '2.1.1'
        and excluido_em is null) is distinct from 100 then
    raise exception '2.1.1 não está em 100%%: nada foi gravado';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'avanco_fisico_historico_origem_check') then
    raise exception 'regra avanco_fisico_historico_origem_check não encontrada: nada foi gravado';
  end if;
  select round(sum(valor_total), 2) into v_v from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if v_v <> {ANTES['indireto']} then raise exception 'indireto R$ % (esperado {ANTES['indireto']}): nada foi gravado', v_v; end if;

  -- ===== BACKUP (tabelas de verdade, RLS, sem permissão para anon/authenticated) =====
  create table public.orcamento_quantidades_bkp_{BKP} as
    select * from public.orcamento_planejado where obra_id = 'sirius60' and id in (670, 671, 673);
  create table public.curva_s_quantidades_bkp_{BKP} as
    select * from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  create table public.avanco_quantidades_bkp_{BKP} as
    select * from public.avanco_fisico_historico where obra_id = 'sirius60';
  alter table public.orcamento_quantidades_bkp_{BKP} enable row level security;
  alter table public.curva_s_quantidades_bkp_{BKP} enable row level security;
  alter table public.avanco_quantidades_bkp_{BKP} enable row level security;
  revoke all on public.orcamento_quantidades_bkp_{BKP} from anon, authenticated;
  revoke all on public.curva_s_quantidades_bkp_{BKP} from anon, authenticated;
  revoke all on public.avanco_quantidades_bkp_{BKP} from anon, authenticated;

  -- ===== ORÇAMENTO (por id) =====
  {CTE_ORC}  update public.orcamento_planejado o set quantidade = x.qtd, preco_total = x.preco, hh = x.hh
    from x where o.obra_id = 'sirius60' and o.id = x.id;

  -- ===== CURVA PLANEJADA =====
  {CTE_CURVA}  update public.curva_s_semanal_planejada c
     set hh_semanal = t.hh_semanal, perc_hh_semanal = t.perc_hh_semanal, perc_hh_acum = t.perc_hh_acum,
         valor_semanal = t.valor_semanal, valor_acum = t.valor_acum, perc_valor_acum = t.perc_valor_acum
    from t where c.obra_id = 'sirius60' and c.semana_numero = t.semana;
  -- as semanas fora das janelas mantêm horas e valor, mas o % de cada uma muda porque o total mudou
  update public.curva_s_semanal_planejada c
     set perc_hh_semanal = round(100 * c.hh_semanal / {H:.6f}, 6),
         perc_hh_acum = round(100 * (select sum(y.hh_semanal) from public.curva_s_semanal_planejada y
                                      where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / {H:.6f}, 6),
         valor_acum = round((select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                             where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero), 2),
         perc_valor_acum = round(100 * (select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                                         where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / {V:.2f}, 6)
   where c.obra_id = 'sirius60';

  -- ===== MEDIÇÕES: correções (as antigas não mudam) =====
  alter table public.avanco_fisico_historico drop constraint avanco_fisico_historico_origem_check;
  alter table public.avanco_fisico_historico add constraint avanco_fisico_historico_origem_check
    check (origem in ('tela', 'conversao', 'correcao'));
  -- uma por vez, em ordem (semana, data, id antigo): cada correção fica com id maior que a medição que ela corrige
  {CTE_MED}  insert into public.avanco_fisico_historico (obra_id, codigo_eap, pavimento, percentual_realizado, data_lancamento,
    semana_numero, competencia, atividade_nome, grupo_num, hh_planejado, hh_realizado, medido_por, observacao, origem, origem_ids)
  select 'sirius60', m.codigo, 'Fundação', m.p, m.data::date, m.semana, m.competencia, m.atividade, m.grupo, m.hh,
         round(m.hh * m.p / 100, 2), 'Rafael', m.obs, 'correcao', array[m.id_antigo]::bigint[]
    from m order by m.semana, m.data, m.id_antigo;

  -- ===== TRAVAS DEPOIS (se alguma falhar, nada do que está acima fica gravado) =====
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> {ANTES['linhas']} or v_p <> {DEPOIS['preco']} or v_h <> {DEPOIS['hh']} then
    raise exception 'orçamento ficaria com % linhas, R$ % e % h (esperado {ANTES['linhas']}, {DEPOIS['preco']} e {DEPOIS['hh']}): nada foi gravado', v_n, v_p, v_h;
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
  if abs((select perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 9) - {med9[5]:.6f}) > 0.001 then
    raise exception 'planejado acumulado em S09 diferente da prévia ({med9[5]:.4f}%%): nada foi gravado';
  end if;
  select count(*) into v_n from public.avanco_fisico_historico where obra_id = 'sirius60';
  if v_n <> {ANTES['hist'] + len(med)} then raise exception 'avanco_fisico_historico ficaria com % linhas (esperado {ANTES['hist'] + len(med)}): nada foi gravado', v_n; end if;
  select count(*) into v_n from public.avanco_fisico_historico c join public.avanco_fisico_historico o on o.id = c.origem_ids[1]
   where c.obra_id = 'sirius60' and c.origem = 'correcao' and c.id > o.id and c.semana_numero = o.semana_numero
     and c.data_lancamento = o.data_lancamento and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento;
  if v_n <> {len(med)} then raise exception 'só % das {len(med)} correções ficariam depois da medição corrigida: nada foi gravado', v_n; end if;
  select count(*) into v_n from (
    select distinct on (codigo_eap) codigo_eap, percentual_realizado, origem from public.avanco_fisico_historico
     where obra_id = 'sirius60' and pavimento = 'Fundação' and excluido_em is null and semana_numero <= 9
       and codigo_eap in ({LISTA_REAL})
     order by codigo_eap, semana_numero desc, data_lancamento desc, id desc) u
   where origem = 'correcao' and percentual_realizado in ({', '.join(f'{REAL[c][2]:.4f}' for c in REAL)});
  if v_n <> {len(REAL)} then raise exception 'só % das {len(REAL)} linhas ficariam com o %% real em S09: nada foi gravado', v_n; end if;

  raise notice 'passo 8 gravado: orçamento, curva e {len(med)} correções de medição';
end $$;

-- ===== CONFERÊNCIA (só leitura; aparece o resultado da última no Supabase) =====
select 'orçamento' as item, o.codigo_eap as linha, b.quantidade || ' → ' || o.quantidade as quantidade,
       b.preco_total || ' → ' || o.preco_total as valor, b.hh || ' → ' || o.hh as horas
  from public.orcamento_planejado o join public.orcamento_quantidades_bkp_{BKP} b using (id) where o.obra_id = 'sirius60'
union all
select 'medição', a.codigo_eap || ' S' || a.semana_numero, a.percentual_realizado::text, a.origem, coalesce(a.origem_ids::text, '')
  from public.avanco_fisico_historico a where a.obra_id = 'sirius60' and a.codigo_eap like '2.1.%' and a.excluido_em is null
union all
select 'curva', 'S' || c.semana_numero, b.perc_hh_acum || ' → ' || c.perc_hh_acum, b.valor_acum || ' → ' || c.valor_acum, ''
  from public.curva_s_semanal_planejada c join public.curva_s_quantidades_bkp_{BKP} b
    on b.obra_id = c.obra_id and b.semana_numero = c.semana_numero
 where c.obra_id = 'sirius60' and c.semana_numero in (9, 12, 16, {ANTES['curva_sem']});
"""

desf = TOPO + f"""-- =====================================================================
-- Sirius 60 — DESFAZER o PASSO 8 do orçamento (quantidades e medições da fundação, pedido 19). Um ÚNICO bloco (DO):
-- volta as linhas 670, 671 e 673 e a curva planejada dos backups, apaga as {len(med)} "correções" de medição (origem
-- 'correcao') e volta a regra da coluna origem. Os backups ficam (apagar à mão no fim, se quiser).
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric;
begin
  if to_regclass('public.orcamento_quantidades_bkp_{BKP}') is null or to_regclass('public.curva_s_quantidades_bkp_{BKP}') is null
     or to_regclass('public.avanco_quantidades_bkp_{BKP}') is null then
    raise exception 'backups do passo 8 não encontrados: nada foi feito';
  end if;
  select count(*) into v_n from public.orcamento_planejado where obra_id = 'sirius60' and (
       (id = 670 and quantidade = {novo[670]['qtd']} and preco_total = {novo[670]['preco']} and hh = {novo[670]['hh']})
    or (id = 671 and quantidade = {novo[671]['qtd']} and preco_total = {novo[671]['preco']} and hh = {novo[671]['hh']})
    or (id = 673 and quantidade = {novo[673]['qtd']} and preco_total = {novo[673]['preco']} and hh = {novo[673]['hh']}));
  if v_n <> 3 then raise exception 'só % das 3 linhas estão como o passo 8 deixou (alguém mexeu depois?): nada foi feito', v_n; end if;
  if (select count(*) from public.orcamento_quantidades_bkp_{BKP}) <> 3 then raise exception 'backup do orçamento incompleto: nada foi feito'; end if;
  if (select count(*) from public.curva_s_quantidades_bkp_{BKP} where obra_id = 'sirius60') <> {ANTES['curva_sem']} then
    raise exception 'backup da curva incompleto: nada foi feito';
  end if;
  if (select count(*) from public.avanco_fisico_historico where obra_id = 'sirius60' and origem = 'correcao') <> {len(med)} then
    raise exception 'esperava {len(med)} correções de medição (alguém lançou ou excluiu depois?): nada foi feito';
  end if;

  update public.orcamento_planejado o set quantidade = b.quantidade, preco_total = b.preco_total, hh = b.hh
    from public.orcamento_quantidades_bkp_{BKP} b where o.obra_id = 'sirius60' and o.id = b.id;
  update public.curva_s_semanal_planejada c
     set hh_semanal = b.hh_semanal, perc_hh_semanal = b.perc_hh_semanal, perc_hh_acum = b.perc_hh_acum,
         valor_semanal = b.valor_semanal, valor_acum = b.valor_acum, perc_valor_acum = b.perc_valor_acum
    from public.curva_s_quantidades_bkp_{BKP} b where c.obra_id = 'sirius60' and b.obra_id = c.obra_id and b.semana_numero = c.semana_numero;
  delete from public.avanco_fisico_historico where obra_id = 'sirius60' and origem = 'correcao';
  alter table public.avanco_fisico_historico drop constraint avanco_fisico_historico_origem_check;
  alter table public.avanco_fisico_historico add constraint avanco_fisico_historico_origem_check check (origem in ('tela', 'conversao'));

  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> {ANTES['linhas']} or v_p <> {ANTES['preco']} or v_h <> {ANTES['hh']} then
    raise exception 'orçamento ficaria com % linhas, R$ % e % h (esperado {ANTES['linhas']}, {ANTES['preco']} e {ANTES['hh']}): nada foi desfeito', v_n, v_p, v_h;
  end if;
  select round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_h, v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_h <> {ANTES['curva_hh']} or v_v <> {ANTES['curva_valor']} then
    raise exception 'curva ficaria com % h e R$ %: nada foi desfeito', v_h, v_v;
  end if;
  select count(*) into v_n from public.avanco_fisico_historico where obra_id = 'sirius60';
  if v_n <> {ANTES['hist']} then raise exception 'avanco_fisico_historico ficaria com % linhas (esperado {ANTES['hist']}): nada foi desfeito', v_n; end if;
  raise notice 'passo 8 desfeito';
end $$;

-- Depois de conferir, se quiser apagar os backups (rodar à parte):
-- drop table public.orcamento_quantidades_bkp_{BKP};
-- drop table public.curva_s_quantidades_bkp_{BKP};
-- drop table public.avanco_quantidades_bkp_{BKP};
"""

os.makedirs(a.destino, exist_ok=True)
for nome, txt in (('8-quantidades-fundacao.sql', sql), ('8-quantidades-fundacao-desfazer.sql', desf)):
    with open(os.path.join(a.destino, nome), 'w', encoding='utf-8', newline='\n') as f:
        f.write(txt)
print(f'horas da 2.1.5: {a.horas_215} ({novo[671]["hh"]} h) | direto {DEPOIS["preco"]:,.2f} (Δ {d_preco:+,.2f}) | horas orçamento '
      f'{DEPOIS["hh"]:,.1f} (Δ {d_hh:+,.1f}) | curva {H1:,.1f} h, R$ {V1:,.2f}, {n_curva} semanas | S09 {med9[5]:.4f}% | S12 {med12[5]:.4f}%')
for cod in REAL:
    print(f'{cod}: fator {fatores[cod][1]:.6f} |', ', '.join(f"S{m['semana']:02d} {m['p0']:g}% → {m['p']:.4f}%" for m in med if m['codigo'] == cod))
