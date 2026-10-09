-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 7: horas da 3.0.1 (Pilotis) e da 4.0.9 nas linhas do pavimento — pedido 14B fase 3
-- PRÉVIA ESCRITA, NÃO RODAR sem a decisão do Rafael (muda a base do avanço físico por linha).
-- Desfazer: 7-pilotis-horas-desfazer.sql
--
-- 3.0.1 "Estrutura PILOTIS" (id 992, 1.305 h, R$ 0): o Rafael confirmou que o Pilotis está orçado no subgrupo 3.1
--   (SUBSOLO - VIGAS(20X)-PILARES(P1 P78)-LAJE PILOTIS + PISO POLIDO). Hoje as linhas 3.1.x recebem as horas da
--   atividade "Estrutura SUB-SOLO" do cronograma (2.689,4 h) e a 3.0.1 as de "Estrutura PILOTIS" (1.305 h): não há
--   horas duplicadas no banco. O total que o banco dá às linhas de serviço do 3.1 (a parte delas na atividade
--   "Estrutura SUB-SOLO") + a 3.0.1 é a base do avanço e não muda; o painel usa as horas REAIS (índice × quantidade).
--   As 1.305 h vão para as 6 linhas de SERVIÇO do 3.1 na proporção das horas REAIS (Rafael 09/10): armação 3.1.2
--   501,7 Hh, forma 3.1.5 2.301,1 Hh, lançamento 3.1.4 192 Hh (6 diárias × 32 Hh), piso polido 3.1.7 16 Hh,
--   escada 3.1.8 80 Hh, laje treliçada 3.1.12 160 Hh (2 oficiais + 2 ajudantes, 1 semana) = 3.250,8 Hh.
--   Os materiais (3.1.1, 3.1.3, 3.1.6, 3.1.9–3.1.11) não mudam.
--   A 3.0.1 fica com 0 h (a linha continua, sem valor e sem horas).
-- 4.0.9 "Vergas, contravergas e encunhamento" (id 993, 60,1 h, R$ 0): as 60,1 h vão para as 13 linhas de verga e
--   encunhamento dos pavimentos, pelas horas de cada uma; a 4.0.9 fica com 0 h.
-- Total de horas da obra NÃO muda (48.454,9 h); o avanço físico de hoje não muda (nenhuma dessas linhas tem medição).
-- O planejado da obra somado linha a linha NÃO muda (as horas transferidas continuam na janela de origem, abaixo).
-- Para o planejado continuar batendo com a curva, as horas transferidas ficam na JANELA DE ORIGEM: tabela nova
-- orcamento_horas_janela (linha, horas, semana início/fim, origem) — 3.0.1 → S10–S18 (Estrutura Pilotis do
-- cronograma), 4.0.9 → S88–S90. O site soma o planejado das duas janelas (o resto das horas segue a janela da
-- própria linha). A curva planejada da obra (curva_s_semanal_planejada) NÃO é alterada.
-- Backup: orcamento_horas_bkp_20261009 (as 21 linhas). Se algo não bater, nada é gravado.
-- =====================================================================
begin;

-- (id, código, pavimento, horas de hoje [trava], horas novas)
create temporary table _h (id bigint primary key, codigo_eap text, pavimento text, hh_hoje numeric, hh_novo numeric) on commit drop;
insert into _h values
  (682, '3.1.2', 'Subsolo', 135.7, 337.1),
  (685, '3.1.5', 'Subsolo', 708.3, 1632.1),
  (684, '3.1.4', 'Subsolo', 59.4, 136.5),
  (687, '3.1.7', 'Subsolo', 95.9, 102.3),
  (688, '3.1.8', 'Subsolo', 37.1, 69.2),
  (692, '3.1.12', 'Subsolo', 280.4, 344.6),
  (748, '4.1.2', 'Pilotis', 17.4, 19.9),
  (749, '4.1.3', 'Pilotis', 5.2, 5.9),
  (751, '4.2.2', 'Subsolo', 13.7, 15.7),
  (752, '4.2.3', 'Subsolo', 8.1, 9.3),
  (755, '4.3.3', 'Térreo', 15.2, 17.4),
  (756, '4.3.4', 'Térreo', 15.9, 18.2),
  (759, '4.4.3', '1º Pav', 40.6, 46.4),
  (760, '4.4.4', '1º Pav', 35.6, 40.7),
  (763, '4.5.3', '2º Pav', 79.0, 90.2),
  (764, '4.5.4', '2º Pav', 43.7, 50.0),
  (767, '4.6.3', '3º Pav', 58.8, 67.2),
  (768, '4.6.4', '3º Pav', 37.5, 42.9),
  (770, '4.7.2', 'Terraço', 48.6, 55.6),
  (992, '3.0.1', 'Pilotis', 1305.0, 0.0),
  (993, '4.0.9', 'Edifício', 60.1, 0.0);

do $$
declare k int; t numeric;
begin
  if to_regclass('public.orcamento_horas_bkp_20261009') is not null or to_regclass('public.orcamento_horas_janela') is not null then
    raise exception 'backup já existe: este arquivo já foi rodado? Nada foi feito';
  end if;
  select count(*) into k from _h x join public.orcamento_planejado o
    on o.obra_id = 'sirius60' and o.id = x.id and o.codigo_eap = x.codigo_eap and o.pavimento = x.pavimento and round(o.hh, 1) = x.hh_hoje;
  if k <> 21 then raise exception 'só % das 21 linhas estão como hoje: nada foi feito', k; end if;
  select round(sum(hh), 1) into t from public.orcamento_planejado where obra_id = 'sirius60';
  if t <> 48454.9 then raise exception 'horas da obra = % (esperado 48454,9): nada foi feito', t; end if;
  if exists (select 1 from public.avanco_fisico_historico h join _h x on h.codigo_eap = x.codigo_eap and h.pavimento = x.pavimento
              where h.obra_id = 'sirius60' and h.excluido_em is null) then
    raise exception 'alguma dessas linhas já tem medição: o avanço mudaria. Nada foi feito';
  end if;
end $$;

create table public.orcamento_horas_janela (
  id bigserial primary key, obra_id text not null, orcamento_id bigint not null, hh numeric(12,2) not null check (hh > 0),
  semana_inicio int not null, semana_fim int not null check (semana_fim >= semana_inicio), origem text not null,
  criado_em timestamptz not null default now());
alter table public.orcamento_horas_janela enable row level security;
revoke all on public.orcamento_horas_janela from anon, authenticated;
revoke all on sequence public.orcamento_horas_janela_id_seq from anon, authenticated;
insert into public.orcamento_horas_janela (obra_id, orcamento_id, hh, semana_inicio, semana_fim, origem) values
  ('sirius60', 682, 201.4, 10, 18, '3.0.1'),
  ('sirius60', 685, 923.8, 10, 18, '3.0.1'),
  ('sirius60', 684, 77.1, 10, 18, '3.0.1'),
  ('sirius60', 687, 6.4, 10, 18, '3.0.1'),
  ('sirius60', 688, 32.1, 10, 18, '3.0.1'),
  ('sirius60', 692, 64.2, 10, 18, '3.0.1'),
  ('sirius60', 748, 2.5, 88, 90, '4.0.9'),
  ('sirius60', 749, 0.7, 88, 90, '4.0.9'),
  ('sirius60', 751, 2.0, 88, 90, '4.0.9'),
  ('sirius60', 752, 1.2, 88, 90, '4.0.9'),
  ('sirius60', 755, 2.2, 88, 90, '4.0.9'),
  ('sirius60', 756, 2.3, 88, 90, '4.0.9'),
  ('sirius60', 759, 5.8, 88, 90, '4.0.9'),
  ('sirius60', 760, 5.1, 88, 90, '4.0.9'),
  ('sirius60', 763, 11.2, 88, 90, '4.0.9'),
  ('sirius60', 764, 6.3, 88, 90, '4.0.9'),
  ('sirius60', 767, 8.4, 88, 90, '4.0.9'),
  ('sirius60', 768, 5.4, 88, 90, '4.0.9'),
  ('sirius60', 770, 7.0, 88, 90, '4.0.9');

create table public.orcamento_horas_bkp_20261009 as
  select id, codigo_eap, pavimento, hh from public.orcamento_planejado where obra_id = 'sirius60' and id in (682, 685, 684, 687, 688, 692, 748, 749, 751, 752, 755, 756, 759, 760, 763, 764, 767, 768, 770, 992, 993);
alter table public.orcamento_horas_bkp_20261009 enable row level security;
revoke all on public.orcamento_horas_bkp_20261009 from anon, authenticated;

update public.orcamento_planejado o set hh = x.hh_novo from _h x where o.obra_id = 'sirius60' and o.id = x.id;

do $$
declare t numeric;
begin
  select round(sum(hh), 1) into t from public.orcamento_planejado where obra_id = 'sirius60';
  if t <> 48454.9 then raise exception 'horas da obra mudaram para %: nada foi gravado', t; end if;
  if exists (select 1 from public.orcamento_planejado where id in (992, 993) and hh <> 0) then
    raise exception '3.0.1 / 4.0.9 não ficaram com 0 h: nada foi gravado';
  end if;
end $$;

commit;

select o.codigo_eap, o.pavimento, b.hh as antes, o.hh as depois
  from public.orcamento_planejado o join public.orcamento_horas_bkp_20261009 b on b.id = o.id
 order by string_to_array(o.codigo_eap, '.')::int[], o.pavimento;
