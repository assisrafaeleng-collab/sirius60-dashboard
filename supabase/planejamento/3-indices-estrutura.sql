-- =====================================================================
-- Sirius 60 — PLANEJAMENTO, PASSO 3: índices da estrutura (lançamento e laje treliçada) — decisões do Rafael 09/10/2026
-- Rodar no SQL Editor (arquivo inteiro), DEPOIS do passo 1. Desfazer: 3-indices-estrutura-desfazer.sql
--
-- equipe_padrao: nova equipe "laje_trelicada" = 2 oficiais + 2 ajudantes (4 pessoas).
-- indice_produtividade (por id da linha; origem 'rafael'):
--   Lançamento/concretagem em DIÁRIA: 1 diária = 1 dia de 1 pedreiro + 3 ajudantes = 32 Hh/diária (as diárias do
--     orçamento já incluem folga): 2.1.8 Fundação, 3.1.4 Subsolo, 3.2.4 Térreo, 3.3.4 1º Pav, 3.4.4 2º Pav, 3.6.4 Terraço.
--   Laje treliçada (MO + material): 2 oficiais + 2 ajudantes fazem 283,5 m² em 5 dias úteis = 160 Hh → 0,5644 Hh/m²:
--     3.1.12, 3.2.12, 3.3.11, 3.5.7, 3.6.7.
--   Correção de unidade (Rafael 09/10; só na tabela de índices — o orçamento não muda): 3.4.11 laje do 2º Pav em "m" →
--     m² (382,99 m² × 0,5644); 3.5.4 lançamento do 3º Pav "6 m³" → 6 diárias (× 32 Hh); 3.7.4 lançamento do
--     Reservatório 42,57 m³ pela produtividade do Pilotis (125,89 m³ em 6 diárias = 20,98 m³/diária) → 2,03 diárias
--     = 65 Hh → 32 ÷ 20,98 = 1,5252 Hh/m³.
--   Já valem desde o passo 1: armação 0,0914 Hh/kg, forma 1,606 Hh/m², escada 80 Hh, piso polido 16 Hh.
-- Não mexe em linha editada pelo site (origem 'rafael-site'). Backup: indice_estrutura_bkp_20261009.
-- =====================================================================
begin;

create temporary table _ix (orcamento_id bigint primary key, codigo_eap text, pavimento text, regra text,
  hh numeric, tipo text, obs text, unidade text) on commit drop;
insert into _ix values
  (674, '2.1.8',  'Fundação', 'indice', 32,     'concretagem',    'Rafael 09/10: 1 diária = 1 pedreiro + 3 ajudantes × 8 h = 32 Hh', null),
  (684, '3.1.4',  'Subsolo',  'indice', 32,     'concretagem',    'Rafael 09/10: 1 diária = 1 pedreiro + 3 ajudantes × 8 h = 32 Hh', null),
  (696, '3.2.4',  'Térreo',   'indice', 32,     'concretagem',    'Rafael 09/10: 1 diária = 1 pedreiro + 3 ajudantes × 8 h = 32 Hh', null),
  (708, '3.3.4',  '1º Pav',   'indice', 32,     'concretagem',    'Rafael 09/10: 1 diária = 1 pedreiro + 3 ajudantes × 8 h = 32 Hh', null),
  (719, '3.4.4',  '2º Pav',   'indice', 32,     'concretagem',    'Rafael 09/10: 1 diária = 1 pedreiro + 3 ajudantes × 8 h = 32 Hh', null),
  (737, '3.6.4',  'Terraço',  'indice', 32,     'concretagem',    'Rafael 09/10: 1 diária = 1 pedreiro + 3 ajudantes × 8 h = 32 Hh', null),
  (692, '3.1.12', 'Subsolo',  'indice', 0.5644, 'laje_trelicada', 'Rafael 09/10: 2 oficiais + 2 ajudantes, 283,5 m² em 5 dias = 160 Hh', null),
  (704, '3.2.12', 'Térreo',   'indice', 0.5644, 'laje_trelicada', 'Rafael 09/10: 2 oficiais + 2 ajudantes, 283,5 m² em 5 dias = 160 Hh', null),
  (715, '3.3.11', '1º Pav',   'indice', 0.5644, 'laje_trelicada', 'Rafael 09/10: 2 oficiais + 2 ajudantes, 283,5 m² em 5 dias = 160 Hh', null),
  (733, '3.5.7',  '3º Pav',   'indice', 0.5644, 'laje_trelicada', 'Rafael 09/10: 2 oficiais + 2 ajudantes, 283,5 m² em 5 dias = 160 Hh', null),
  (740, '3.6.7',  'Terraço',  'indice', 0.5644, 'laje_trelicada', 'Rafael 09/10: 2 oficiais + 2 ajudantes, 283,5 m² em 5 dias = 160 Hh', null),
  (726, '3.4.11', '2º Pav',   'indice', 0.5644, 'laje_trelicada', 'Rafael 09/10: unidade corrigida para m² (no orçamento está "m")', 'm²'),
  (730, '3.5.4',  '3º Pav',   'indice', 32,     'concretagem',    'Rafael 09/10: 6 diárias (no orçamento está "6 m³")', 'diaria'),
  (744, '3.7.4',  'Reservatório', 'indice', 1.5252, 'concretagem', 'Rafael 09/10: 42,57 m³ ÷ 20,98 m³/diária (Pilotis) = 2,03 diárias = 65 Hh', 'm³');

do $$
declare k int;
begin
  if to_regclass('public.indice_produtividade') is null or to_regclass('public.equipe_padrao') is null then
    raise exception 'rode antes o supabase/planejamento/1-tabelas-pontos-atencao.sql';
  end if;
  if to_regclass('public.indice_estrutura_bkp_20261009') is not null
     or exists (select 1 from public.equipe_padrao where obra_id = 'sirius60' and tipo = 'laje_trelicada') then
    raise exception 'este arquivo já foi rodado: nada foi feito';
  end if;
  select count(*) into k from _ix x join public.indice_produtividade i
    on i.obra_id = 'sirius60' and i.orcamento_id = x.orcamento_id and i.codigo_eap = x.codigo_eap and i.pavimento = x.pavimento;
  if k <> 14 then raise exception 'só % das 14 linhas estão em indice_produtividade: nada foi feito', k; end if;
  if exists (select 1 from _ix x join public.indice_produtividade i on i.obra_id = 'sirius60' and i.orcamento_id = x.orcamento_id
              where i.origem = 'rafael-site') then
    raise exception 'alguma dessas linhas já foi editada pelo site: confira antes (nada foi feito)';
  end if;
end $$;

create table public.indice_estrutura_bkp_20261009 as
  select i.* from public.indice_produtividade i join _ix x on x.orcamento_id = i.orcamento_id where i.obra_id = 'sirius60';
alter table public.indice_estrutura_bkp_20261009 enable row level security;
revoke all on public.indice_estrutura_bkp_20261009 from anon, authenticated;

insert into public.equipe_padrao (obra_id, tipo, nome, composicao, pessoas)
values ('sirius60', 'laje_trelicada', 'Laje treliçada', '2 oficiais + 2 ajudantes', 4);

update public.indice_produtividade i
   set regra = x.regra, hh_por_unidade = x.hh, horas_total = null,
       origem = case when x.hh is null then '' else 'rafael' end, conferir = false,
       tipo_equipe = x.tipo, observacao = x.obs, unidade = coalesce(x.unidade, i.unidade), atualizado_em = now()
  from _ix x where i.obra_id = 'sirius60' and i.orcamento_id = x.orcamento_id;

do $$
begin
  if (select count(*) from public.indice_produtividade where obra_id = 'sirius60' and origem = 'rafael'
       and orcamento_id in (674, 684, 696, 708, 719, 737, 692, 704, 715, 733, 740, 726, 730, 744)) <> 14 then
    raise exception 'índices não ficaram como esperado: nada foi gravado';
  end if;
end $$;

commit;

select i.codigo_eap, i.pavimento, i.unidade, i.hh_por_unidade, i.tipo_equipe, i.observacao
  from public.indice_produtividade i join public.indice_estrutura_bkp_20261009 b on b.orcamento_id = i.orcamento_id
 where i.obra_id = 'sirius60' order by string_to_array(i.codigo_eap, '.')::int[];
