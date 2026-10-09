-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 6: grupo 18 (Mão de Obra Direta) vai para o INDIRETO como RESERVA — pedido 14A
-- Rodar no SQL Editor (arquivo inteiro), DEPOIS de promover o código do pedido 14A. Desfazer: 6-...-desfazer.sql
--
-- Decisão do Rafael (09/10/2026): 18.1.1 "Mão de Obra Direta" (R$ 428.131,20, 24 meses) não se sabe se vai ser
-- contratada; a verba linear no direto criava economia falsa. Ela sai do custo DIRETO e vira a linha de indireto
-- 19.1.25 "Mão de obra de apoio (se houver necessidade)", do tipo RESERVA: o planejado não é diluído
-- (planejado = realizado até a verba; o site mostra "reserva · N% da verba usada").
--   1) custos_indiretos_planejados ganha a coluna reserva (boolean, padrão false) e a linha 19.1.25 (reserva = true).
--   2) orcamento_planejado perde a linha 18.1.1 (id 987; sem horas, sem vínculo, sem medição).
--   3) O único lançamento em 18.1.1 (Caixa Cartões, doc. 030563150/01, R$ 700,00, 08/2026) passa para 19.1.25,
--      pelo id (grupo_custo = 'Custos Indiretos'). O histórico manual protegido (lancado_por = 'Rafael') não é tocado.
-- Totais: direto 7.551.387,47 → 7.123.256,27 (334 → 333 linhas); indireto 2.446.376,88 → 2.874.508,08
-- (13 → 14 linhas); total da obra 9.997.764,35 (não muda). Horas de produção (48.454,9 h) não mudam: 18.1.1 tem 0 h.
-- Backups: orcamento_g18_bkp_20261009, custos_indiretos_planejados_bkp_20261009, lancamento_g18_bkp_20261009.
-- Novas tabelas de backup: RLS ligado, sem permissão para anon/authenticated. Se algo não bater, nada é gravado.
-- =====================================================================
begin;

do $$
declare n int; total numeric; k int; lid bigint;
begin
  if to_regclass('public.orcamento_g18_bkp_20261009') is not null or to_regclass('public.custos_indiretos_planejados_bkp_20261009') is not null
     or to_regclass('public.lancamento_g18_bkp_20261009') is not null then
    raise exception 'backup do passo 6 já existe: este arquivo já foi rodado? Nada foi feito';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
              and table_name = 'custos_indiretos_planejados' and column_name = 'reserva') then
    raise exception 'custos_indiretos_planejados já tem a coluna reserva: nada foi feito';
  end if;
  -- direto: 334 linhas e 7.551.387,47; a 18.1.1 é a única do grupo 18
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'orçamento direto com % linhas e % (esperado 334 e 7551387.47): nada foi feito', n, total;
  end if;
  if (select count(*) from public.orcamento_planejado where obra_id = 'sirius60' and (grupo_num = 18 or codigo_eap like '18.%')) <> 1
     or not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 987 and codigo_eap = '18.1.1'
                     and grupo_num = 18 and round(preco_total, 2) = 428131.20 and coalesce(hh, 0) = 0) then
    raise exception '18.1.1 não está como esperado (id 987, R$ 428.131,20, 0 h, única do grupo 18): nada foi feito';
  end if;
  if exists (select 1 from public.orcamento_material_servico where obra_id = 'sirius60' and (material_id = 987 or servico_id = 987)) then
    raise exception '18.1.1 tem vínculo material/serviço: nada foi feito';
  end if;
  if exists (select 1 from public.avanco_fisico_realizado where obra_id = 'sirius60' and codigo_eap like '18.%') then
    raise exception 'há medição em 18.x (tabela antiga): nada foi feito';
  end if;
  if to_regclass('public.avanco_fisico_historico') is not null then
    execute 'select count(*) from public.avanco_fisico_historico where obra_id = ''sirius60'' and codigo_eap like ''18.%''' into k;
    if k > 0 then raise exception 'há medição em 18.x (avanco_fisico_historico): nada foi feito'; end if;
  end if;
  if to_regclass('public.contas_a_pagar') is not null then
    execute 'select count(*) from public.contas_a_pagar where obra_id = ''sirius60'' and codigo_eap like ''18.%''' into k;
    if k > 0 then raise exception 'há % título(s) a pagar em 18.x: decida antes', k; end if;
  end if;
  -- indireto: 13 linhas e 2.446.376,88; 19.1.25 livre
  select count(*), sum(valor_total) into n, total from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if n <> 13 or round(total, 2) <> 2446376.88 then
    raise exception 'indireto com % linhas e % (esperado 13 e 2446376.88): nada foi feito', n, total;
  end if;
  if exists (select 1 from public.custos_indiretos_planejados where obra_id = 'sirius60' and codigo_eap = '19.1.25')
     or exists (select 1 from public.custos_lancamentos where obra_id = 'sirius60' and codigo_eap = '19.1.25') then
    raise exception '19.1.25 já está em uso: nada foi feito';
  end if;
  -- lançamento: exatamente um em 18.x, o da Caixa Cartões (R$ 700,00, doc. 030563150/01), fora do histórico manual
  select count(*) into k from public.custos_lancamentos where obra_id = 'sirius60' and codigo_eap like '18.%';
  if k <> 1 then raise exception '% lançamento(s) em 18.x (esperado 1, o da Caixa Cartões): nada foi feito', k; end if;
  select id into lid from public.custos_lancamentos where obra_id = 'sirius60' and codigo_eap = '18.1.1'
     and round(valor, 2) = 700.00 and num_documento = '030563150/01' and coalesce(lancado_por, '') <> 'Rafael';
  if lid is null then raise exception 'lançamento da Caixa Cartões em 18.1.1 não está como esperado: nada foi feito'; end if;
end $$;

-- Backups
create table public.orcamento_g18_bkp_20261009 as
  select * from public.orcamento_planejado where obra_id = 'sirius60' and id = 987;
create table public.custos_indiretos_planejados_bkp_20261009 as
  select * from public.custos_indiretos_planejados where obra_id = 'sirius60';
create table public.lancamento_g18_bkp_20261009 as
  select * from public.custos_lancamentos where obra_id = 'sirius60' and codigo_eap = '18.1.1';
alter table public.orcamento_g18_bkp_20261009 enable row level security;
alter table public.custos_indiretos_planejados_bkp_20261009 enable row level security;
alter table public.lancamento_g18_bkp_20261009 enable row level security;
revoke all on public.orcamento_g18_bkp_20261009 from anon, authenticated;
revoke all on public.custos_indiretos_planejados_bkp_20261009 from anon, authenticated;
revoke all on public.lancamento_g18_bkp_20261009 from anon, authenticated;

-- 1) tipo reserva + a linha 19.1.25 (semanas: a obra toda; a reserva não é diluída, o site usa planejado = realizado)
alter table public.custos_indiretos_planejados add column reserva boolean not null default false;
insert into public.custos_indiretos_planejados (obra_id, categoria, codigo_eap, valor_total, semana_desembolso, semana_fim,
  recorrente, reserva)
select 'sirius60', 'Mão de obra de apoio (se houver necessidade)', '19.1.25', 428131.20, 1,
       (select max(semana_numero) from public.calendario_semanas where obra_id = 'sirius60'), false, true;

-- 2) o lançamento da Caixa Cartões vai para 19.1.25, pelo id
update public.custos_lancamentos l set codigo_eap = '19.1.25', grupo_custo = 'Custos Indiretos'
  from public.lancamento_g18_bkp_20261009 b where l.id = b.id and l.obra_id = 'sirius60';

-- 3) a 18.1.1 sai do orçamento direto
delete from public.orcamento_planejado where obra_id = 'sirius60' and id = 987;

-- Trava final
do $$
declare n int; total numeric; ni int; ti numeric;
begin
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 333 or round(total, 2) <> 7123256.27 then
    raise exception 'direto ficou com % linhas e % (esperado 333 e 7123256.27): nada foi gravado', n, total;
  end if;
  select count(*), sum(valor_total) into ni, ti from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if ni <> 14 or round(ti, 2) <> 2874508.08 then
    raise exception 'indireto ficou com % linhas e % (esperado 14 e 2874508.08): nada foi gravado', ni, ti;
  end if;
  if round(total + ti, 2) <> 9997764.35 then
    raise exception 'total da obra mudou (%): nada foi gravado', round(total + ti, 2);
  end if;
  if (select count(*) from public.custos_indiretos_planejados where obra_id = 'sirius60' and reserva) <> 1 then
    raise exception 'esperada 1 linha de reserva: nada foi gravado';
  end if;
  if exists (select 1 from public.custos_lancamentos where obra_id = 'sirius60' and codigo_eap like '18.%')
     or (select count(*) from public.custos_lancamentos l join public.lancamento_g18_bkp_20261009 b on b.id = l.id
          where l.codigo_eap = '19.1.25' and l.valor = b.valor) <> 1 then
    raise exception 'o lançamento não foi para 19.1.25 como esperado: nada foi gravado';
  end if;
end $$;

commit;

-- Conferência 1: totais (direto 333 / 7.123.256,27; indireto 14 / 2.874.508,08; obra 9.997.764,35)
select (select count(*) from public.orcamento_planejado where obra_id = 'sirius60') as linhas_direto,
       (select sum(preco_total) from public.orcamento_planejado where obra_id = 'sirius60') as direto,
       (select count(*) from public.custos_indiretos_planejados where obra_id = 'sirius60') as linhas_indireto,
       (select sum(valor_total) from public.custos_indiretos_planejados where obra_id = 'sirius60') as indireto;
-- Conferência 2: a reserva e o lançamento movido
select i.codigo_eap, i.categoria, i.valor_total, i.reserva, i.semana_desembolso, i.semana_fim,
       (select sum(valor) from public.custos_lancamentos l where l.obra_id = 'sirius60' and l.codigo_eap = i.codigo_eap) as pago
  from public.custos_indiretos_planejados i where i.obra_id = 'sirius60' and i.reserva;
