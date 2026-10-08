-- =====================================================================
-- Sirius 60 — DESFAZER o orçamento final (1-orcamento-final.sql)
-- Volta orcamento_planejado ao backup de 08/10/2026, linha a linha pelo id:
--   - preço, código, descrição e pavimento das linhas alteradas voltam ao que eram;
--   - a linha 17.1.14 (que não está no backup) sai.
-- Não toca em medições nem custos. custos_indiretos_planejados não foi alterado pelo passo 1.
-- As tabelas de backup ficam (para apagar depois, ver o fim do arquivo).
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.orcamento_planejado_bkp_20261008') is null then
    raise exception 'backup orcamento_planejado_bkp_20261008 não existe: nada foi feito';
  end if;
end $$;

update public.orcamento_planejado as o
   set codigo_eap = b.codigo_eap, descricao = b.descricao, pavimento = b.pavimento,
       preco_unitario = b.preco_unitario, preco_total = b.preco_total
  from public.orcamento_planejado_bkp_20261008 as b
 where o.id = b.id and o.obra_id = 'sirius60'
   and (o.codigo_eap, o.descricao, o.pavimento, o.preco_unitario, o.preco_total)
       is distinct from (b.codigo_eap, b.descricao, b.pavimento, b.preco_unitario, b.preco_total);

delete from public.orcamento_planejado
 where obra_id = 'sirius60' and codigo_eap = '17.1.14'
   and id not in (select id from public.orcamento_planejado_bkp_20261008);

do $$
declare
  n int; total numeric;
begin
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 333 or round(total, 2) <> 7398635.20 then
    raise exception 'desfazer não voltou ao backup (% linhas, total %): nada foi alterado', n, total;
  end if;
end $$;

commit;

-- Conferência: 333 linhas, 7.398.635,20
select count(*) as linhas, sum(preco_total) as direto from public.orcamento_planejado where obra_id = 'sirius60';

-- Depois de conferir o site, as tabelas de backup podem ser apagadas (só com autorização):
-- drop table public.orcamento_planejado_bkp_20261008;
-- drop table public.custos_indiretos_planejados_bkp_20261008;
