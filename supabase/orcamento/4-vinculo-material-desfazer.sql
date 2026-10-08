-- =====================================================================
-- Sirius 60 — DESFAZER o passo 4 do orçamento (4-vinculo-material.sql): tira a coluna e_material e a tabela
-- orcamento_material_servico. Rodar só com o código do site que NÃO usa e_material / orcamento_material_servico (senão a tela quebra).
-- Nenhum valor, hora, semana ou código foi mudado pelo passo 4: tirar a coluna e a tabela volta ao estado anterior.
-- =====================================================================
begin;

do $$
declare n int;
begin
  if to_regclass('public.orcamento_vinculo_bkp_20261008') is null then raise exception 'backup orcamento_vinculo_bkp_20261008 não existe: nada foi feito'; end if;
  select count(*) into n from public.orcamento_planejado o join public.orcamento_vinculo_bkp_20261008 b using (id)
   where (o.codigo_eap, o.pavimento, o.descricao, o.preco_total, o.hh) is distinct from (b.codigo_eap, b.pavimento, b.descricao, b.preco_total, b.hh);
  if n > 0 then raise exception '% linha(s) diferentes do backup: confira antes (nada foi desfeito)', n; end if;
end $$;

drop table if exists public.orcamento_material_servico;
alter table public.orcamento_planejado drop column if exists e_material;

commit;

-- Conferência: deve vir VAZIA
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'orcamento_planejado' and column_name = 'e_material';

-- Depois de conferir, o backup pode ser apagado (só com autorização):
-- drop table public.orcamento_vinculo_bkp_20261008;
