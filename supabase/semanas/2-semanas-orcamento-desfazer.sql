-- =====================================================================
-- Sirius 60 — DESFAZER o passo 2 das semanas: devolve semana_inicio/semana_fim do backup orcamento_semanas_bkp_20261008
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.orcamento_semanas_bkp_20261008') is null then
    raise exception 'backup orcamento_semanas_bkp_20261008 não existe: nada foi feito';
  end if;
end $$;

update public.orcamento_planejado as o
   set semana_inicio = b.semana_inicio, semana_fim = b.semana_fim
  from public.orcamento_semanas_bkp_20261008 as b
 where o.id = b.id and o.obra_id = 'sirius60';

commit;

-- Conferência: deve vir VAZIA
select o.id from public.orcamento_planejado o join public.orcamento_semanas_bkp_20261008 b using (id)
 where (o.semana_inicio, o.semana_fim) is distinct from (b.semana_inicio, b.semana_fim);

-- Depois de conferir o site, o backup pode ser apagado (só com autorização):
-- drop table public.orcamento_semanas_bkp_20261008;
