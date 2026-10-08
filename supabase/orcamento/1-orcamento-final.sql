-- =====================================================================
-- Sirius 60 — ORÇAMENTO FINAL (Orcamento_Rua Sirius 60 - Final - 03-08-26.xlsx, aba Orçamento)
-- Rodar no SQL Editor DEPOIS de promover o código que lê o orçamento do banco (/api/orcamento).
-- Rode o arquivo inteiro; ele para (rollback) se o banco não estiver como o esperado.
-- Desfazer: 1-orcamento-final-desfazer.sql
--
-- O que muda em orcamento_planejado (obra sirius60):
--   1) Backup completo das duas tabelas do orçamento da obra em tabelas com data (RLS ligado, sem permissão
--      para anon/authenticated).
--   2) Preço da forma (mão de obra) de R$ 60 para R$ 75/m² em 8 linhas: +128.752,27 no custo direto.
--        2.1.6 Fundação   41.290,29 →  51.612,86 (+10.322,57)
--        3.1.5 Subsolo    85.947,09 → 107.433,86 (+21.486,77)
--        3.2.5 Térreo     86.070,60 → 107.588,25 (+21.517,65)
--        3.3.5 1º Pav     85.945,02 → 107.431,27 (+21.486,25)
--        3.4.6 2º Pav     60.296,34 →  75.370,43 (+15.074,09)  (*)
--        3.5.5 3º Pav     61.395,51 →  76.744,39 (+15.348,88)
--        3.6.5 Terraço    62.191,08 →  77.738,85 (+15.547,77)
--        3.7.5 Reservat.  31.873,17 →  39.841,46 (+ 7.968,29)
--      (*) no 2º Pav a planilha e o banco têm a descrição trocada: 3.4.5 diz "Apenas MO" com preço de
--          material (R$ 37) e 3.4.6 diz "Apenas Material" com preço de MO. O valor segue a planilha final.
--   3) Linha nova 17.1.14 "Combustível obra" (na planilha: "Gasolina Caro Vandinho"), Canteiro, 24 × R$ 1.000.
--   4) Códigos repetidos no mesmo pavimento:
--        4.1.3 Encunhamento (47,75 m, R$ 666,64) está na subseção 4.2 SUBSOLO da planilha final: é erro de
--          numeração → passa a ser 4.2.3, pavimento Subsolo (decisão do Rafael, 08/10/2026)
--        6.1.1 "MO Hidráulica - Ademir (prumadas e reservatório)" nos 4 pavimentos  → 6.1.1.1
--      Nenhuma medição nem custo gravado usa 4.1.3 (de nenhum pavimento), 4.2.3 ou 6.1.1 (conferido em 08/10/2026).
-- Não muda: custos_indiretos_planejados (grupo 19 igual à planilha: 2.446.376,88), horas, semanas,
-- medições e custos. Medições guardam % por código + pavimento: a 2.1.6 (3 medições) continua igual em %,
-- e o valor agregado dela passa a usar a verba nova.
-- =====================================================================
begin;

-- 0) Trava: o banco tem de estar como na conferência de 08/10/2026
do $$
declare
  n int; total numeric;
begin
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 333 or round(total, 2) <> 7398635.20 then
    raise exception 'orcamento_planejado não está como esperado (% linhas, total %): nada foi feito', n, total;
  end if;
  if exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and codigo_eap in ('17.1.14', '4.2.3', '6.1.1.1')) then
    raise exception 'já existe 17.1.14, 4.2.3 ou 6.1.1.1: este arquivo já foi rodado?';
  end if;
end $$;

-- 1) Backup completo (com data no nome)
create table public.orcamento_planejado_bkp_20261008 as
  select * from public.orcamento_planejado where obra_id = 'sirius60';
create table public.custos_indiretos_planejados_bkp_20261008 as
  select * from public.custos_indiretos_planejados where obra_id = 'sirius60';
alter table public.orcamento_planejado_bkp_20261008 enable row level security;
alter table public.custos_indiretos_planejados_bkp_20261008 enable row level security;
revoke all on public.orcamento_planejado_bkp_20261008 from anon, authenticated;
revoke all on public.custos_indiretos_planejados_bkp_20261008 from anon, authenticated;

-- 2) Preço da forma (MO): pelo id de cada linha (conferido em 08/10/2026)
update public.orcamento_planejado as o
   set preco_unitario = v.unitario, preco_total = v.total
  from (values
    (672, '2.1.6', 'Fundação',      75.00,  51612.86),
    (685, '3.1.5', 'Subsolo',       75.00, 107433.86),
    (697, '3.2.5', 'Térreo',        75.00, 107588.25),
    (709, '3.3.5', '1º Pav',        75.00, 107431.27),
    (721, '3.4.6', '2º Pav',        75.00,  75370.43),
    (731, '3.5.5', '3º Pav',        75.00,  76744.39),
    (738, '3.6.5', 'Terraço',       75.00,  77738.85),
    (745, '3.7.5', 'Reservatório',  75.00,  39841.46)
  ) as v(id, codigo, pavimento, unitario, total)
 where o.id = v.id and o.obra_id = 'sirius60' and o.codigo_eap = v.codigo and o.pavimento = v.pavimento;

-- 3) 17.1.14 Combustível obra (semanas 1 a 96, como o resto do grupo 17; custo de tempo, sem horas)
insert into public.orcamento_planejado (obra_id, codigo_eap, descricao, quantidade, unidade, preco_unitario, preco_total,
  semana_inicio, semana_fim, pavimento, grupo_num, grupo_nome, hh, custo_de_tempo)
values ('sirius60', '17.1.14', 'Combustível obra', 24, 'mês', 1000.00, 24000.00, 1, 96, 'Canteiro', 17,
        'Locação de Equipamentos', 0, true);

-- 4) Linhas repetidas no mesmo código + pavimento
update public.orcamento_planejado set codigo_eap = '4.2.3', pavimento = 'Subsolo'
 where id = 752 and obra_id = 'sirius60' and codigo_eap = '4.1.3' and pavimento = 'Pilotis' and preco_total = 666.64;
-- Semanas: a linha 752 está em S29–32 (as do Pilotis); a alvenaria do Subsolo (4.2.1, 4.2.2) está em S21–23.
-- As semanas foram mantidas. Para seguir o Subsolo, tire o comentário da linha abaixo antes de rodar:
-- update public.orcamento_planejado set semana_inicio = 21, semana_fim = 23 where id = 752 and codigo_eap = '4.2.3';
update public.orcamento_planejado
   set codigo_eap = '6.1.1.1', descricao = 'MO Hidráulica - Ademir (prumadas e reservatório)'
 where id in (988, 989, 990, 991) and obra_id = 'sirius60' and codigo_eap = '6.1.1';

-- Trava final: o resultado tem de bater com a planilha (direto sem a 17.1.14 + 24.000,00)
do $$
declare
  n int; total numeric;
begin
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'resultado inesperado (% linhas, total %): nada foi gravado', n, total;
  end if;
  if not exists (select 1 from public.orcamento_planejado where id = 752 and codigo_eap = '4.2.3' and pavimento = 'Subsolo')
     or (select count(*) from public.orcamento_planejado where obra_id = 'sirius60' and codigo_eap = '6.1.1.1') <> 4 then
    raise exception 'troca de códigos (4.2.3 / 6.1.1.1) não aconteceu como esperado: nada foi gravado';
  end if;
end $$;

commit;

-- Conferência 1: total do direto = 7.551.387,47 (7.527.387,47 da planilha + 24.000,00 da 17.1.14), 334 linhas
select count(*) as linhas, sum(preco_total) as direto from public.orcamento_planejado where obra_id = 'sirius60';

-- Conferência 2: linhas alteradas
select id, codigo_eap, pavimento, descricao, preco_unitario, preco_total
  from public.orcamento_planejado
 where obra_id = 'sirius60' and (id in (672, 685, 697, 709, 721, 731, 738, 745, 752, 988, 989, 990, 991) or codigo_eap = '17.1.14')
 order by codigo_eap, pavimento;
