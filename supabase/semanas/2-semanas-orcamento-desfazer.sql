-- =====================================================================
-- Sirius 60 — DESFAZER o passo 2 das semanas: devolve as semanas do orçamento e dos indiretos dos backups
-- orcamento_semanas_bkp_20261008 e indiretos_semanas_bkp_20261008
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.orcamento_semanas_bkp_20261008') is null or to_regclass('public.indiretos_semanas_bkp_20261008') is null then
    raise exception 'backup de semanas não existe: nada foi feito';
  end if;
end $$;

update public.orcamento_planejado as o
   set semana_inicio = b.semana_inicio, semana_fim = b.semana_fim
  from public.orcamento_semanas_bkp_20261008 as b
 where o.id = b.id and o.obra_id = 'sirius60';

update public.custos_indiretos_planejados as i
   set semana_desembolso = b.semana_desembolso, semana_fim = b.semana_fim
  from public.indiretos_semanas_bkp_20261008 as b
 where i.id = b.id and i.obra_id = 'sirius60';

commit;

-- Conferência: as duas consultas devem vir VAZIAS
select o.id from public.orcamento_planejado o join public.orcamento_semanas_bkp_20261008 b using (id)
 where (o.semana_inicio, o.semana_fim) is distinct from (b.semana_inicio, b.semana_fim);
select i.id from public.custos_indiretos_planejados i join public.indiretos_semanas_bkp_20261008 b using (id)
 where (i.semana_desembolso, i.semana_fim) is distinct from (b.semana_desembolso, b.semana_fim);

-- Depois de conferir o site, os backups podem ser apagados (só com autorização):
-- drop table public.orcamento_semanas_bkp_20261008;
-- drop table public.indiretos_semanas_bkp_20261008;
