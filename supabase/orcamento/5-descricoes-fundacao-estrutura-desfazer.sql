-- =====================================================================
-- Sirius 60 — DESFAZER o passo 5 (5-descricoes-fundacao-estrutura.sql): devolve as 69 descrições do backup
-- orcamento_descricoes_bkp_20261009. Só a coluna descricao; nada mais muda. Rodar no SQL Editor (arquivo inteiro).
-- Travas: backup com 69 linhas; as 69 ainda com a descrição do passo 5; 334 linhas e R$ 7.551.387,47 antes e depois;
-- no fim as 69 linhas ficam iguais ao backup em todas as colunas.
-- O backup NÃO é apagado (apagar só com autorização do Rafael: drop table public.orcamento_descricoes_bkp_20261009;).
-- =====================================================================
begin;

-- (id, descrição que o passo 5 gravou)
create temporary table _desc (id bigint primary key, nova text) on commit drop;
insert into _desc (id, nova) values
  (668, 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)'),
  (669, 'Material Forma - (Apenas Material) - (Bloco, vigas e pilares)'),
  (671, 'Concreto Bombeado fck 25 MPa (Bloco, vigas e pilares) - (Material)'),
  (672, 'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)'),
  (673, 'Armação Aço - Blocos e Tubulões - (Mão de Obra)'),
  (674, 'Concretagem 25 MPa - (Bloco e tubulão e vigas) - (Mão de Obra)'),
  (676, 'Execução Escadas - (Mão de Obra)'),
  (677, 'Material Forma Escada - (Apenas Material)'),
  (678, 'Aço Escada - (Apenas Material)'),
  (679, 'Concreto Escada - (Apenas Material)'),
  (682, 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (683, 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (684, 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (685, 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (686, 'Material p/ Forma (Apenas Material)'),
  (687, 'Piso Polido (Mão de Obra)'),
  (688, 'Execução Escadas - (Mão de Obra)'),
  (689, 'Material Forma Escada - (Apenas Material)'),
  (690, 'Aço Escada - (Apenas Material)'),
  (691, 'Concreto Escada - (Apenas Material)'),
  (692, 'Execução Laje Treliçada (Mão de Obra+Material)'),
  (694, 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (695, 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (696, 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (697, 'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (698, 'Material p/ Forma (Apenas Material)'),
  (699, 'Piso Polido (Mão de Obra)'),
  (700, 'Execução Escadas - (Mão de Obra)'),
  (701, 'Material Forma Escada - (Apenas Material)'),
  (702, 'Aço Escada - (Apenas Material)'),
  (703, 'Concreto Escada - (Apenas Material)'),
  (704, 'Execução Laje Treliçada (Mão de Obra+Material)'),
  (706, 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (707, 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (708, 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (709, 'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (710, 'Material p/ Forma (Apenas Material)'),
  (711, 'Execução Escadas - (Mão de Obra)'),
  (712, 'Material Forma Escada - (Apenas Material)'),
  (713, 'Aço Escada - (Apenas Material)'),
  (714, 'Concreto Escada - (Apenas Material)'),
  (715, 'Execução Laje Treliçada (Mão de Obra+Material)'),
  (717, 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (718, 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (719, 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (720, 'Material p/ Forma (Apenas Material)'),
  (721, 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (722, 'Execução Escadas - (Mão de Obra)'),
  (723, 'Material Forma Escada - (Apenas Material)'),
  (724, 'Aço Escada - (Apenas Material)'),
  (725, 'Concreto Escada - (Apenas Material)'),
  (726, 'Execução Laje Treliçada (Mão de Obra+Material)'),
  (728, 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (729, 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (730, 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (731, 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (732, 'Material p/ Forma (Apenas Material)'),
  (733, 'Execução Laje Treliçada (Mão de Obra+Material)'),
  (735, 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (736, 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (737, 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (738, 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (739, 'Material p/ Forma (Apenas Material)'),
  (740, 'Execução Laje Treliçada (Mão de Obra+Material)'),
  (742, 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (743, 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (744, 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (745, 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (746, 'Material p/ Forma (Apenas Material)');

do $$
declare n int; total numeric; k int;
begin
  if to_regclass('public.orcamento_descricoes_bkp_20261009') is null then
    raise exception 'backup orcamento_descricoes_bkp_20261009 não existe (o passo 5 não rodou?): nada foi feito';
  end if;
  select count(*) into k from public.orcamento_descricoes_bkp_20261009;
  if k <> 69 then raise exception 'backup com % linhas (esperado 69): nada foi feito', k; end if;
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'orçamento com % linhas e % (esperado 334 e 7551387.47): nada foi feito', n, total;
  end if;
  select count(*) into k from _desc d join public.orcamento_planejado o on o.id = d.id and o.descricao = d.nova;
  if k <> 69 then
    raise exception 'só % das 69 linhas estão com a descrição do passo 5: nada foi feito', k;
  end if;
end $$;

do $$
declare k int;
begin
  update public.orcamento_planejado o set descricao = b.descricao
    from public.orcamento_descricoes_bkp_20261009 b where o.id = b.id and o.obra_id = 'sirius60';
  get diagnostics k = row_count;
  if k <> 69 then raise exception 'foram alteradas % linhas (esperado 69): nada foi gravado', k; end if;
end $$;

do $$
declare n int; total numeric; k int;
begin
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'orçamento mudou de total (% linhas, %): nada foi gravado', n, total;
  end if;
  select count(*) into k from public.orcamento_descricoes_bkp_20261009 b join public.orcamento_planejado o
    on o.id = b.id and to_jsonb(o) = to_jsonb(b);
  if k <> 69 then raise exception 'só % linhas voltaram iguais ao backup: nada foi gravado', k; end if;
end $$;

commit;

-- Conferência: as 69 linhas de volta à descrição antiga
select o.id, o.codigo_eap, o.pavimento, o.descricao
  from public.orcamento_planejado o where o.id in (668, 669, 671, 672, 673, 674, 676, 677, 678, 679, 682, 683, 684, 685, 686, 687, 688, 689, 690, 691, 692, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 728, 729, 730, 731, 732, 733, 735, 736, 737, 738, 739, 740, 742, 743, 744, 745, 746)
 order by string_to_array(o.codigo_eap, '.')::int[], o.pavimento;
