-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 4: vínculo material ↔ serviço (pedido 12; gerado por automacao/vinculo_material.py)
-- Rodar no SQL Editor (arquivo inteiro), DEPOIS do 1-orcamento-final.sql. Desfazer: 4-vinculo-material-desfazer.sql
--
-- orcamento_planejado ganha a coluna e_material (true = linha só de material: não aparece no avanço físico e não
--   recebe medição). Nenhum valor, hora, semana ou código muda; o total não muda.
-- Tabela nova orcamento_material_servico: material → serviço(s) de MO que ele acompanha, com peso (soma 1 por material):
--   material_id, material_codigo, material_pavimento, servico_id, servico_codigo, servico_pavimento, peso
--   (a medição é por código + pavimento). RLS ligado, sem política, sem permissão para anon/authenticated.
-- Valor agregado do material (regra do Flats, CLAUDE.md): o MAIOR entre (avanço dos serviços × peso) × orçado do
--   material e custo (pago + a pagar) limitado ao orçado. O site passa a usar isto na fase de telas; até lá nada
--   muda na tela (o site lê colunas explícitas).
-- 49 materiais, 53 vínculos (automacao/saida_v2/vinculo_material_servico.csv): aço → armação; forma
--   material → forma MO; concreto usinado → lançamento/concretagem MO; material de escada → execução de escada;
--   material elétrico → MO elétrica; material hidráulico 6.1.2 → 6.1.1 (ramais) e 6.1.1.1 (prumadas) na proporção
--   das horas (Rafael, 08/10). 2º Pav: 3.4.5 (material) → 3.4.6 (MO), ligado pelo id.
-- Backup: orcamento_vinculo_bkp_20261008 (id, código, pavimento, descrição, preço e horas de hoje). Travas antes e depois.
-- =====================================================================
begin;

do $$
declare n int; total numeric;
begin
  if to_regclass('public.orcamento_vinculo_bkp_20261008') is not null or to_regclass('public.orcamento_material_servico') is not null then
    raise exception 'orcamento_vinculo_bkp_20261008 ou orcamento_material_servico já existe: este arquivo já foi rodado?';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orcamento_planejado'
              and column_name = 'e_material') then
    raise exception 'orcamento_planejado já tem a coluna e_material: nada foi feito';
  end if;
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'orçamento com % linhas e % (esperado 334 e 7551387.47): nada foi feito', n, total;
  end if;
end $$;

create table public.orcamento_vinculo_bkp_20261008 as
  select id, codigo_eap, pavimento, descricao, preco_total, hh from public.orcamento_planejado where obra_id = 'sirius60';
alter table public.orcamento_vinculo_bkp_20261008 enable row level security;
revoke all on public.orcamento_vinculo_bkp_20261008 from anon, authenticated;

alter table public.orcamento_planejado add column e_material boolean not null default false;

create table public.orcamento_material_servico (
  id                 bigserial primary key,
  obra_id            text not null,
  material_id        bigint not null,
  material_codigo    text not null,
  material_pavimento text not null,
  servico_id         bigint not null,
  servico_codigo     text not null,
  servico_pavimento  text not null,
  peso               numeric(9,6) not null check (peso > 0 and peso <= 1),
  unique (obra_id, material_id, servico_id)
);
alter table public.orcamento_material_servico enable row level security;
revoke all on public.orcamento_material_servico from anon, authenticated;
revoke all on sequence public.orcamento_material_servico_id_seq from anon, authenticated;

-- (id do material, código, pavimento, id do serviço, código, pavimento, peso); só entra se as duas linhas existem
insert into public.orcamento_material_servico (obra_id, material_id, material_codigo, material_pavimento, servico_id, servico_codigo,
  servico_pavimento, peso)
select 'sirius60', v.mid, v.mcod, v.mpav, v.sid, v.scod, v.spav, v.peso
  from (values
  (669, '2.1.3', 'Fundação', 672, '2.1.6', 'Fundação', 1.000000),  -- forma
  (670, '2.1.4', 'Fundação', 673, '2.1.7', 'Fundação', 1.000000),  -- armacao
  (671, '2.1.5', 'Fundação', 674, '2.1.8', 'Fundação', 1.000000),  -- concretagem
  (677, '2.1.11', 'Fundação', 676, '2.1.10', 'Fundação', 1.000000),  -- escada
  (678, '2.1.12', 'Fundação', 676, '2.1.10', 'Fundação', 1.000000),  -- escada
  (679, '2.1.13', 'Fundação', 676, '2.1.10', 'Fundação', 1.000000),  -- escada
  (681, '3.1.1', 'Subsolo', 682, '3.1.2', 'Subsolo', 1.000000),  -- armacao
  (683, '3.1.3', 'Subsolo', 684, '3.1.4', 'Subsolo', 1.000000),  -- concretagem
  (686, '3.1.6', 'Subsolo', 685, '3.1.5', 'Subsolo', 1.000000),  -- forma
  (689, '3.1.9', 'Subsolo', 688, '3.1.8', 'Subsolo', 1.000000),  -- escada
  (690, '3.1.10', 'Subsolo', 688, '3.1.8', 'Subsolo', 1.000000),  -- escada
  (691, '3.1.11', 'Subsolo', 688, '3.1.8', 'Subsolo', 1.000000),  -- escada
  (693, '3.2.1', 'Térreo', 694, '3.2.2', 'Térreo', 1.000000),  -- armacao
  (695, '3.2.3', 'Térreo', 696, '3.2.4', 'Térreo', 1.000000),  -- concretagem
  (698, '3.2.6', 'Térreo', 697, '3.2.5', 'Térreo', 1.000000),  -- forma
  (701, '3.2.9', 'Térreo', 700, '3.2.8', 'Térreo', 1.000000),  -- escada
  (702, '3.2.10', 'Térreo', 700, '3.2.8', 'Térreo', 1.000000),  -- escada
  (703, '3.2.11', 'Térreo', 700, '3.2.8', 'Térreo', 1.000000),  -- escada
  (705, '3.3.1', '1º Pav', 706, '3.3.2', '1º Pav', 1.000000),  -- armacao
  (707, '3.3.3', '1º Pav', 708, '3.3.4', '1º Pav', 1.000000),  -- concretagem
  (710, '3.3.6', '1º Pav', 709, '3.3.5', '1º Pav', 1.000000),  -- forma
  (712, '3.3.8', '1º Pav', 711, '3.3.7', '1º Pav', 1.000000),  -- escada
  (713, '3.3.9', '1º Pav', 711, '3.3.7', '1º Pav', 1.000000),  -- escada
  (714, '3.3.10', '1º Pav', 711, '3.3.7', '1º Pav', 1.000000),  -- escada
  (716, '3.4.1', '2º Pav', 717, '3.4.2', '2º Pav', 1.000000),  -- armacao
  (718, '3.4.3', '2º Pav', 719, '3.4.4', '2º Pav', 1.000000),  -- concretagem
  (720, '3.4.5', '2º Pav', 721, '3.4.6', '2º Pav', 1.000000),  -- forma
  (723, '3.4.8', '2º Pav', 722, '3.4.7', '2º Pav', 1.000000),  -- escada
  (724, '3.4.9', '2º Pav', 722, '3.4.7', '2º Pav', 1.000000),  -- escada
  (725, '3.4.10', '2º Pav', 722, '3.4.7', '2º Pav', 1.000000),  -- escada
  (727, '3.5.1', '3º Pav', 728, '3.5.2', '3º Pav', 1.000000),  -- armacao
  (729, '3.5.3', '3º Pav', 730, '3.5.4', '3º Pav', 1.000000),  -- concretagem
  (732, '3.5.6', '3º Pav', 731, '3.5.5', '3º Pav', 1.000000),  -- forma
  (734, '3.6.1', 'Terraço', 735, '3.6.2', 'Terraço', 1.000000),  -- armacao
  (736, '3.6.3', 'Terraço', 737, '3.6.4', 'Terraço', 1.000000),  -- concretagem
  (739, '3.6.6', 'Terraço', 738, '3.6.5', 'Terraço', 1.000000),  -- forma
  (741, '3.7.1', 'Reservatório', 742, '3.7.2', 'Reservatório', 1.000000),  -- armacao
  (743, '3.7.3', 'Reservatório', 744, '3.7.4', 'Reservatório', 1.000000),  -- concretagem
  (746, '3.7.6', 'Reservatório', 745, '3.7.5', 'Reservatório', 1.000000),  -- forma
  (790, '6.1.2', 'Térreo', 786, '6.1.1', 'Térreo', 0.600000),  -- hidraulica
  (790, '6.1.2', 'Térreo', 988, '6.1.1.1', 'Térreo', 0.400000),  -- hidraulica
  (791, '6.1.2', '1º Pav', 787, '6.1.1', '1º Pav', 0.600000),  -- hidraulica
  (791, '6.1.2', '1º Pav', 989, '6.1.1.1', '1º Pav', 0.400000),  -- hidraulica
  (792, '6.1.2', '2º Pav', 788, '6.1.1', '2º Pav', 0.600000),  -- hidraulica
  (792, '6.1.2', '2º Pav', 990, '6.1.1.1', '2º Pav', 0.400000),  -- hidraulica
  (793, '6.1.2', '3º Pav', 789, '6.1.1', '3º Pav', 0.600000),  -- hidraulica
  (793, '6.1.2', '3º Pav', 991, '6.1.1.1', '3º Pav', 0.400000),  -- hidraulica
  (800, '7.1.2', 'Subsolo', 794, '7.1.1', 'Subsolo', 1.000000),  -- eletrica
  (801, '7.1.2', 'Pilotis', 795, '7.1.1', 'Pilotis', 1.000000),  -- eletrica
  (802, '7.1.2', 'Térreo', 796, '7.1.1', 'Térreo', 1.000000),  -- eletrica
  (803, '7.1.2', '1º Pav', 797, '7.1.1', '1º Pav', 1.000000),  -- eletrica
  (804, '7.1.2', '2º Pav', 798, '7.1.1', '2º Pav', 1.000000),  -- eletrica
  (805, '7.1.2', '3º Pav', 799, '7.1.1', '3º Pav', 1.000000)  -- eletrica
  ) as v(mid, mcod, mpav, sid, scod, spav, peso)
  join public.orcamento_planejado m on m.id = v.mid and m.codigo_eap = v.mcod and m.pavimento = v.mpav and m.obra_id = 'sirius60'
  join public.orcamento_planejado s on s.id = v.sid and s.codigo_eap = v.scod and s.pavimento = v.spav and s.obra_id = 'sirius60';

update public.orcamento_planejado as o set e_material = true
 where o.obra_id = 'sirius60' and o.id in (select material_id from public.orcamento_material_servico where obra_id = 'sirius60');

do $$
declare n int; total numeric; m int; k int; ruim int;
begin
  select count(*), sum(preco_total), count(*) filter (where e_material) into n, total, m
    from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'orçamento mudou (% linhas, %): nada foi gravado', n, total;
  end if;
  select count(*) into k from public.orcamento_material_servico where obra_id = 'sirius60';
  if m <> 49 or k <> 53 then
    raise exception '% material(is) e % vínculo(s) (esperado 49 e 53): nada foi gravado', m, k;
  end if;
  -- pesos somam 1 por material; serviço do mesmo pavimento e que não é material
  select count(*) into ruim from (select material_id from public.orcamento_material_servico where obra_id = 'sirius60'
     group by material_id having abs(sum(peso) - 1) > 0.00001) x;
  if ruim > 0 then raise exception '% material(is) com pesos que não somam 1: nada foi gravado', ruim; end if;
  select count(*) into ruim from public.orcamento_material_servico t
    join public.orcamento_planejado s on s.id = t.servico_id
   where t.obra_id = 'sirius60' and (s.e_material or s.pavimento <> t.material_pavimento);
  if ruim > 0 then raise exception '% vínculo(s) inválido(s): nada foi gravado', ruim; end if;
end $$;

commit;

-- Conferência 1: materiais por serviço
select t.material_codigo, t.material_pavimento, left(m.descricao, 45) as material, m.preco_total,
       t.servico_codigo, left(s.descricao, 45) as servico, t.peso
  from public.orcamento_material_servico t
  join public.orcamento_planejado m on m.id = t.material_id
  join public.orcamento_planejado s on s.id = t.servico_id
 where t.obra_id = 'sirius60' order by t.material_id, t.servico_id;
-- Conferência 2: total (deve ser 334 linhas e 7,551,387.47; 49 materiais)
select count(*) as linhas, sum(preco_total) as direto, count(*) filter (where e_material) as materiais
  from public.orcamento_planejado where obra_id = 'sirius60';
