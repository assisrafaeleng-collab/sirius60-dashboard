-- =====================================================================
-- Sirius 60 — DESFAZER o passo 6 (6-grupo18-para-indireto.sql): a 18.1.1 volta ao direto, a 19.1.25 sai do indireto,
-- o lançamento da Caixa Cartões volta para 18.1.1 e a coluna reserva sai. Tudo pelos backups do passo 6.
-- Rodar no SQL Editor (arquivo inteiro). Travas: estado igual ao que o passo 6 deixou; no fim 334 linhas e
-- R$ 7.551.387,47 no direto, 13 linhas e R$ 2.446.376,88 no indireto. Os backups NÃO são apagados.
-- =====================================================================
begin;

do $$
declare n int; total numeric;
begin
  if to_regclass('public.orcamento_g18_bkp_20261009') is null or to_regclass('public.custos_indiretos_planejados_bkp_20261009') is null
     or to_regclass('public.lancamento_g18_bkp_20261009') is null then
    raise exception 'backups do passo 6 não existem (o passo 6 não rodou?): nada foi feito';
  end if;
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 333 or round(total, 2) <> 7123256.27 then
    raise exception 'direto com % linhas e % (esperado 333 e 7123256.27): nada foi feito', n, total;
  end if;
  select count(*), sum(valor_total) into n, total from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if n <> 14 or round(total, 2) <> 2874508.08 then
    raise exception 'indireto com % linhas e % (esperado 14 e 2874508.08): nada foi feito', n, total;
  end if;
  if exists (select 1 from public.orcamento_planejado where id = 987) then
    raise exception 'id 987 já existe no orçamento: nada foi feito';
  end if;
  if (select count(*) from public.custos_lancamentos l join public.lancamento_g18_bkp_20261009 b on b.id = l.id
       where l.codigo_eap = '19.1.25') <> 1 then
    raise exception 'o lançamento da Caixa Cartões não está em 19.1.25: nada foi feito';
  end if;
end $$;

insert into public.orcamento_planejado select * from public.orcamento_g18_bkp_20261009;
update public.custos_lancamentos l set codigo_eap = b.codigo_eap, grupo_custo = b.grupo_custo
  from public.lancamento_g18_bkp_20261009 b where l.id = b.id;
delete from public.custos_indiretos_planejados where obra_id = 'sirius60' and codigo_eap = '19.1.25' and reserva;
alter table public.custos_indiretos_planejados drop column reserva;

do $$
declare n int; total numeric;
begin
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'direto voltou com % linhas e % (esperado 334 e 7551387.47): nada foi gravado', n, total;
  end if;
  select count(*), sum(valor_total) into n, total from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if n <> 13 or round(total, 2) <> 2446376.88 then
    raise exception 'indireto voltou com % linhas e % (esperado 13 e 2446376.88): nada foi gravado', n, total;
  end if;
  if (select count(*) from public.custos_lancamentos l join public.lancamento_g18_bkp_20261009 b on b.id = l.id
       where l.codigo_eap = b.codigo_eap and l.grupo_custo is not distinct from b.grupo_custo and l.valor = b.valor) <> 1 then
    raise exception 'o lançamento não voltou igual ao backup: nada foi gravado';
  end if;
end $$;

commit;

select codigo_eap, preco_total from public.orcamento_planejado where obra_id = 'sirius60' and codigo_eap = '18.1.1';
