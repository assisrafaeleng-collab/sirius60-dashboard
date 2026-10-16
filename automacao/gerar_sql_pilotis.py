"""
Gera o SQL da ALTERNATIVA B do Pilotis (pedido 17): as 1.305 h que o SQL 7 deixou na janela do Pilotis (S10–S18,
tabela orcamento_horas_janela) passam a seguir a janela PRÓPRIA de cada linha do 3.1 (estrutura do Sub-solo,
S19–S28, com a regra de posição: armação, forma meia semana depois, concretagem 30/70, laje treliçada, escada).
Só escreve o arquivo; quem decide e roda é o Rafael (ver diagnostico/auditoria_cronograma.md, item 3).

Uso: py gerar_sql_pilotis.py [--destino ../supabase/semanas]
Escreve: 5-pilotis-janela-subsolo.sql e 5-pilotis-janela-subsolo-desfazer.sql

Curva planejada (curva_s_semanal_planejada): sai o espalhamento da atividade "Estrutura PILOTIS" do cronograma
(1.305 h pelos dias de out–nov/2026) e entra o das mesmas horas nas janelas das linhas do 3.1 (mesmas contas do
cronograma.py). Total de horas e valores não mudam (a 3.0.1 não tem valor).
"""
import argparse, glob, os
import pandas as pd
from cronograma import calendario, ler_cronograma, espalhar_coord, JANELAS_ESTRUTURA

# horas transferidas pelo SQL 7 (orcamento_horas_janela, origem 3.0.1) e a posição de cada linha
LINHAS = [  # id, código, horas, posição (JANELAS_ESTRUTURA) ou atividade própria
    (682, '3.1.2', 201.4, 'armacao'),
    (685, '3.1.5', 923.8, 'forma'),
    (684, '3.1.4', 77.1, 'concretagem'),
    (687, '3.1.7', 6.4, 'piso_polido'),
    (688, '3.1.8', 32.1, 'escada'),
    (692, '3.1.12', 64.2, 'laje_trelicada'),
]
PILOTIS_H = 1305.0

ap = argparse.ArgumentParser()
ap.add_argument('--destino', default='../supabase/semanas')
a = ap.parse_args()
cal = calendario()
crono = ler_cronograma([f for f in glob.glob('entrada/cronograma/*Final*.xlsx') if not os.path.basename(f).startswith('~$')][0]).set_index('atividade')
assert abs(sum(h for _, _, h, _ in LINHAS) - PILOTIS_H) < 0.05

sai, entra = {}, {}
p = crono.loc['3.1']                       # Estrutura PILOTIS
espalhar_coord(cal, p.ini - 1, p.ini - 1 + p.dur, PILOTIS_H, sai)
sub = crono.loc['3.2']                     # Estrutura SUB-SOLO (onde as linhas do 3.1 estão)
piso = crono.loc['11.1.6']                 # Piso polido (janela própria da 3.1.7)
for _, cod, h, pos in LINHAS:
    if pos == 'piso_polido':
        espalhar_coord(cal, piso.ini - 1, piso.ini - 1 + piso.dur, h, entra)
        continue
    for x0, x1, f in JANELAS_ESTRUTURA[int(sub.dur)][pos]:
        espalhar_coord(cal, sub.ini - 1 + x0, sub.ini - 1 + x1, h * f, entra)
delta = {}
for r in cal.itertuples():
    d = sum(v for k, v in entra.items() if r.data_inicio <= k <= r.data_fim) - sum(v for k, v in sai.items() if r.data_inicio <= k <= r.data_fim)
    if abs(d) > 1e-6:
        delta[r.semana_numero] = round(d, 4)
assert abs(sum(delta.values())) < 0.01, sum(delta.values())
vals = ',\n'.join(f'  ({s}, {d:.4f})' for s, d in sorted(delta.items()))
ws = ', '.join(str(s) for s in sorted(delta))

sql = f"""-- =====================================================================
-- Sirius 60 — SEMANAS, PASSO 5 (ALTERNATIVA B do Pilotis, pedido 17): as 1.305 h da 3.0.1 seguem a janela PRÓPRIA das
-- linhas do 3.1 (estrutura do Sub-solo, S19–S28), e não mais a janela do Pilotis (S10–S18).
-- ESCRITO, NÃO RODAR sem a decisão do Rafael (diagnostico/auditoria_cronograma.md, item 3). Gerado por
-- automacao/gerar_sql_pilotis.py. Desfazer: 5-pilotis-janela-subsolo-desfazer.sql
--
-- O que muda:
--   orcamento_horas_janela: saem as 6 linhas de origem '3.0.1' (682, 685, 684, 687, 688, 692) — as horas dessas linhas
--     passam a seguir só a janela própria (as horas da linha em orcamento_planejado não mudam).
--   curva_s_semanal_planejada: sai o espalhamento da atividade "Estrutura PILOTIS" do cronograma (1.305 h, S10–S18)
--     e entram as mesmas horas nas janelas das linhas do 3.1 (armação, forma, concretagem 30/70, laje treliçada,
--     escada; piso polido na janela própria). {len(delta)} semanas mudam (S{min(delta)}–S{max(delta)}); total de horas igual.
--   Planejado acumulado da obra em S11: 6,07% → 5,59%.
-- Travas: total de horas 48.454,8 e S11 = 6,071680% antes; as 6 linhas de janela como o SQL 7 gravou; total igual depois.
-- Backups: curva_s_pilotis_bkp_20261011 e orcamento_horas_janela_bkp_20261011 (RLS, sem permissão para anon/authenticated).
-- Ordem: este arquivo pode rodar a qualquer momento depois do 7-pilotis-horas.sql (o código do site já lê as duas tabelas).
-- =====================================================================
begin;

create temporary table _d (semana int primary key, delta numeric) on commit drop;
insert into _d values
{vals};

do $$
declare t numeric; p numeric; k int;
begin
  if to_regclass('public.curva_s_pilotis_bkp_20261011') is not null or to_regclass('public.orcamento_horas_janela_bkp_20261011') is not null then
    raise exception 'backup já existe: este arquivo já foi rodado? Nada foi feito';
  end if;
  select round(sum(hh_semanal), 1) into t from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if t <> 48454.8 then raise exception 'total de horas da curva = % (esperado 48454,8): nada foi feito', t; end if;
  select round(perc_hh_acum, 6) into p from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 11;
  if p <> 6.071680 then raise exception 'S11 = % (esperado 6,071680): nada foi feito', p; end if;
  select count(*) into k from public.orcamento_horas_janela where obra_id = 'sirius60' and origem = '3.0.1'
     and semana_inicio = 10 and semana_fim = 18 and orcamento_id in (682, 685, 684, 687, 688, 692);
  if k <> 6 then raise exception 'janelas da 3.0.1: % de 6 como o SQL 7 gravou: nada foi feito', k; end if;
  if exists (select 1 from _d d left join public.curva_s_semanal_planejada c on c.obra_id = 'sirius60' and c.semana_numero = d.semana
              where c.id is null or c.hh_semanal + d.delta < -0.0001) then
    raise exception 'semana da curva faltando ou horas negativas: nada foi feito';
  end if;
end $$;

create table public.curva_s_pilotis_bkp_20261011 as
  select * from public.curva_s_semanal_planejada where obra_id = 'sirius60';
alter table public.curva_s_pilotis_bkp_20261011 enable row level security;
revoke all on public.curva_s_pilotis_bkp_20261011 from anon, authenticated;
create table public.orcamento_horas_janela_bkp_20261011 as
  select * from public.orcamento_horas_janela where obra_id = 'sirius60' and origem = '3.0.1';
alter table public.orcamento_horas_janela_bkp_20261011 enable row level security;
revoke all on public.orcamento_horas_janela_bkp_20261011 from anon, authenticated;

delete from public.orcamento_horas_janela where obra_id = 'sirius60' and origem = '3.0.1';

update public.curva_s_semanal_planejada c set hh_semanal = round(c.hh_semanal + d.delta, 4)
  from _d d where c.obra_id = 'sirius60' and c.semana_numero = d.semana;
-- % semanal e acumulado recalculados sobre o total (que não muda)
with tot as (select sum(hh_semanal) t from public.curva_s_semanal_planejada where obra_id = 'sirius60'),
     acum as (select id, hh_semanal, sum(hh_semanal) over (order by semana_numero) a
                from public.curva_s_semanal_planejada where obra_id = 'sirius60')
update public.curva_s_semanal_planejada c
   set perc_hh_semanal = round(100 * x.hh_semanal / tot.t, 6), perc_hh_acum = round(100 * x.a / tot.t, 6)
  from acum x, tot where c.id = x.id;

do $$
declare t numeric;
begin
  select round(sum(hh_semanal), 1) into t from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if t <> 48454.8 then raise exception 'total de horas mudou para %: nada foi gravado', t; end if;
end $$;

commit;

select semana_numero, b.perc_hh_acum as antes, c.perc_hh_acum as depois
  from public.curva_s_semanal_planejada c join public.curva_s_pilotis_bkp_20261011 b using (obra_id, semana_numero)
 where c.obra_id = 'sirius60' and c.semana_numero in ({ws})
 order by semana_numero;
"""
desf = """-- =====================================================================
-- Sirius 60 — DESFAZER o PASSO 5 (alternativa B do Pilotis): volta a curva e as 6 janelas da 3.0.1 como estavam.
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.curva_s_pilotis_bkp_20261011') is null or to_regclass('public.orcamento_horas_janela_bkp_20261011') is null then
    raise exception 'backups do passo 5 não existem: nada a desfazer';
  end if;
end $$;

update public.curva_s_semanal_planejada c
   set hh_semanal = b.hh_semanal, perc_hh_semanal = b.perc_hh_semanal, perc_hh_acum = b.perc_hh_acum
  from public.curva_s_pilotis_bkp_20261011 b where c.id = b.id;
insert into public.orcamento_horas_janela select * from public.orcamento_horas_janela_bkp_20261011;

drop table public.curva_s_pilotis_bkp_20261011;
drop table public.orcamento_horas_janela_bkp_20261011;

commit;

select semana_numero, perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 11;
"""
os.makedirs(a.destino, exist_ok=True)
open(os.path.join(a.destino, '5-pilotis-janela-subsolo.sql'), 'w', encoding='utf-8').write(sql)
open(os.path.join(a.destino, '5-pilotis-janela-subsolo-desfazer.sql'), 'w', encoding='utf-8').write(desf)
s11 = sum(v for s, v in delta.items() if s <= 11)
print(f'{len(delta)} semanas mudam (S{min(delta)}–S{max(delta)}); até S11: {s11:+.2f} h → '
      f'{6.071680 + 100 * s11 / 48454.8:.4f}% (hoje 6,0717%)')
