-- =====================================================================
-- Sirius 60 — DESFAZER o passo 3 (3-pilotis-subsolo.sql): devolve as 6 linhas 4.1.x/4.2.x do backup
-- Se o 2-semanas-orcamento.sql já rodou depois, desfaça ele antes (ele guardou as semanas de depois do passo 3).
-- =====================================================================
do $$
declare n int; total numeric;
begin
  if to_regclass('public.orcamento_pilotis_subsolo_bkp_20261008') is null then
    raise exception 'backup orcamento_pilotis_subsolo_bkp_20261008 não existe: nada foi feito';
  end if;
  update public.orcamento_planejado as o
     set quantidade = b.quantidade, preco_unitario = b.preco_unitario, preco_total = b.preco_total,
         semana_inicio = b.semana_inicio, semana_fim = b.semana_fim, hh = b.hh
    from public.orcamento_pilotis_subsolo_bkp_20261008 as b
   where o.id = b.id and o.obra_id = 'sirius60';
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'desfazer deixou o orçamento com % linhas e %: nada foi alterado', n, total;
  end if;
end $$;

-- Conferência: 4.1.1 Pilotis volta a 92,41 m²; 4.2.1 Subsolo volta a 143,26 m²
select id, codigo_eap, pavimento, quantidade, preco_total, hh, semana_inicio, semana_fim
  from public.orcamento_planejado where id in (747, 748, 749, 750, 751, 752) order by codigo_eap;

-- Depois de conferir, o backup pode ser apagado (só com autorização):
-- drop table public.orcamento_pilotis_subsolo_bkp_20261008;
