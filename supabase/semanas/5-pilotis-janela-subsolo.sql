-- =====================================================================
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
--     escada; piso polido na janela própria). 19 semanas mudam (S10–S28); total de horas igual.
--   Planejado acumulado da obra em S11: 6,07% → 5,59%.
-- Travas: total de horas 48.454,8 e S11 = 6,071680% antes; as 6 linhas de janela como o SQL 7 gravou; total igual depois.
-- Backups: curva_s_pilotis_bkp_20261011 e orcamento_horas_janela_bkp_20261011 (RLS, sem permissão para anon/authenticated).
-- Ordem: este arquivo pode rodar a qualquer momento depois do 7-pilotis-horas.sql (o código do site já lê as duas tabelas).
-- =====================================================================
begin;

create temporary table _d (semana int primary key, delta numeric) on commit drop;
insert into _d values
  (10, -84.1935),
  (11, -147.3387),
  (12, -147.3387),
  (13, -147.3387),
  (14, -126.2903),
  (15, -172.2933),
  (16, -150.7567),
  (17, -150.7567),
  (18, -172.2933),
  (19, 64.9563),
  (20, 158.6875),
  (21, 158.6875),
  (22, 169.8794),
  (23, 102.6166),
  (24, 76.2928),
  (25, 178.0165),
  (26, 171.5198),
  (27, 140.2028),
  (28, 77.7406);

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
 where c.obra_id = 'sirius60' and c.semana_numero in (10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28)
 order by semana_numero;
