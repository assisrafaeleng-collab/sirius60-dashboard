-- =====================================================================
-- Sirius 60 — DESFAZER o passo 3 das semanas: devolve semana_numero das medições do backup medicoes_semanas_bkp_20261008
-- Medição lançada DEPOIS do passo 3 não está no backup e não é alterada.
-- =====================================================================
begin;
do $$ begin
  if to_regclass('public.medicoes_semanas_bkp_20261008') is null then raise exception 'backup medicoes_semanas_bkp_20261008 não existe: nada foi feito'; end if;
end $$;
update public.avanco_fisico_realizado as a
   set semana_numero = b.semana_numero
  from public.medicoes_semanas_bkp_20261008 as b
 where a.id = b.id and a.obra_id = 'sirius60';
commit;

-- Conferência: deve vir VAZIA
select a.id from public.avanco_fisico_realizado a join public.medicoes_semanas_bkp_20261008 b using (id) where a.semana_numero <> b.semana_numero;
