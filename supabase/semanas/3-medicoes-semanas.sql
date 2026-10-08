-- =====================================================================
-- Sirius 60 — SEMANAS, PASSO 3: semana_numero das medições pelo calendário novo (gerado por gerar_sql_semanas.py)
-- Rodar DEPOIS do 1-calendario.sql. Desfazer: 3-medicoes-semanas-desfazer.sql
--
-- Cada medição recebe a semana do calendário novo que contém a DATA da medição (data_lancamento). Nada de
-- deslocar número. Conferido em 08/10/2026: 23 medições, todas com data; 0 mudam de número
-- (as semanas S1–S9 antigas e novas coincidem nas datas medidas até hoje).
-- Backup (id, semana_numero, data_lancamento) em medicoes_semanas_bkp_20261008.
-- =====================================================================
begin;

do $$
declare n int; sem_data int;
begin
  if to_regclass('public.calendario_semanas') is null then raise exception 'rode antes o 1-calendario.sql'; end if;
  if to_regclass('public.medicoes_semanas_bkp_20261008') is not null then raise exception 'medicoes_semanas_bkp_20261008 já existe: este arquivo já foi rodado?'; end if;
  select count(*), count(*) filter (where data_lancamento is null) into n, sem_data
    from public.avanco_fisico_realizado where obra_id = 'sirius60';
  if sem_data > 0 then raise exception '% medição(ões) sem data_lancamento: nada foi feito', sem_data; end if;
  if exists (select 1 from public.avanco_fisico_realizado a where a.obra_id = 'sirius60' and not exists (
       select 1 from public.calendario_semanas c where c.obra_id = 'sirius60' and a.data_lancamento between c.data_inicio and c.data_fim)) then
    raise exception 'há medição com data fora do calendário: nada foi feito';
  end if;
end $$;

create table public.medicoes_semanas_bkp_20261008 as
  select id, semana_numero, data_lancamento from public.avanco_fisico_realizado where obra_id = 'sirius60';
alter table public.medicoes_semanas_bkp_20261008 enable row level security;
revoke all on public.medicoes_semanas_bkp_20261008 from anon, authenticated;

update public.avanco_fisico_realizado as a
   set semana_numero = c.semana_numero
  from public.calendario_semanas as c
 where a.obra_id = 'sirius60' and c.obra_id = 'sirius60' and a.data_lancamento between c.data_inicio and c.data_fim
   and a.semana_numero is distinct from c.semana_numero;

commit;

-- Conferência: medições por semana nova (com o intervalo de datas da semana)
select a.semana_numero, c.label, count(*) as medicoes, min(a.data_lancamento) as de, max(a.data_lancamento) as ate
  from public.avanco_fisico_realizado a join public.calendario_semanas c
    on c.obra_id = a.obra_id and c.semana_numero = a.semana_numero
 where a.obra_id = 'sirius60' group by a.semana_numero, c.label order by 1;
