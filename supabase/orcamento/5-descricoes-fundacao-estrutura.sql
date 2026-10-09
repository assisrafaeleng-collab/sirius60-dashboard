-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 5: descrições novas da FUNDAÇÃO (2.1.x) e da ESTRUTURA (3.x) — pedido 13H
-- Rodar no SQL Editor (arquivo inteiro). Desfazer: 5-descricoes-fundacao-estrutura-desfazer.sql
--
-- Planilha revisada pelo Rafael ("Orcamento_Rua Sirius 60 - Final - 03-08-26.xlsx", 09/10/2026): mudou SÓ a coluna
-- "Descrição do serviço" de 69 linhas (10 da fundação, 59 da estrutura). Este passo troca SÓ
-- orcamento_planejado.descricao dessas 69 linhas, pelo ID. Nenhum valor, hora, quantidade, semana, código,
-- pavimento, vínculo, medição ou custo muda.
--   - Ligação planilha → banco: código + pavimento (subgrupo da planilha: 2.1 Fundação, 3.1 Subsolo, 3.2 Térreo,
--     3.3 1º Pav, 3.4 2º Pav, 3.5 3º Pav, 3.6 Terraço, 3.7 Reservatório).
--   - 2º Pav: 3.4.5 (id 720, R$ 37/m², MATERIAL) e 3.4.6 (id 721, R$ 75/m², MÃO DE OBRA) têm os códigos invertidos
--     em relação aos outros pavimentos (passo 2). A descrição vai pela FUNÇÃO da linha, não pelo código:
--     720 → "Material p/ Forma (Apenas Material)"; 721 → "Forma ... 4 utilizações ... - (Mão de Obra)".
--   - Decisões do Rafael (09/10): 3.2.5 e 3.3.5 mantêm "3 utilizações"; 2.1.6 "Montatem" → "Montagem".
--   - Limpeza só de espaços (início/fim e espaços duplos). Nenhuma outra correção de texto.
-- O site e os scripts (vinculo_material.py, cronograma.py) não dependem do texto da descrição (tabela fixa por id).
-- Backup: orcamento_descricoes_bkp_20261009 (as 69 linhas inteiras, antes). Travas: antes e depois 334 linhas e R$ 7.551.387,47;
-- as 69 com o texto de hoje; exatamente 69 alteradas; nenhuma outra coluna muda. Se algo não bater, nada é gravado.
-- =====================================================================
begin;

-- (id, código, pavimento, descrição de hoje, descrição nova)
create temporary table _desc (id bigint primary key, codigo_eap text, pavimento text, antes text, nova text) on commit drop;
insert into _desc (id, codigo_eap, pavimento, antes, nova) values
  (668, '2.1.2', 'Fundação',
   'Escavação manual em material 1ª categoria (até 1,50 m) - (Tubulões e Blocos) - MO',
   'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)'),
  (669, '2.1.3', 'Fundação',
   'Material Forma - (Apenas Material) - Bloco e Vigas',
   'Material Forma - (Apenas Material) - (Bloco, vigas e pilares)'),
  (671, '2.1.5', 'Fundação',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Tubulão, Blocos- Vigas) - (Apenas Material)',
   'Concreto Bombeado fck 25 MPa (Bloco, vigas e pilares) - (Material)'),
  (672, '2.1.6', 'Fundação',
   'Montatem Forma - (MO) - Blocos- Vigas',
   'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)'),
  (673, '2.1.7', 'Fundação',
   'Armação Aço- (MO) - Blocos e Tubulões',
   'Armação Aço - Blocos e Tubulões - (Mão de Obra)'),
  (674, '2.1.8', 'Fundação',
   'Concretagem 25Mpa - (MO) - Bloco e tubulão',
   'Concretagem 25 MPa - (Bloco e tubulão e vigas) - (Mão de Obra)'),
  (676, '2.1.10', 'Fundação',
   'Execução Escadas - MO',
   'Execução Escadas - (Mão de Obra)'),
  (677, '2.1.11', 'Fundação',
   'Material Forma - (Apenas Material) -Escada',
   'Material Forma Escada - (Apenas Material)'),
  (678, '2.1.12', 'Fundação',
   'Aço  - (Apenas Material) -Escada',
   'Aço Escada - (Apenas Material)'),
  (679, '2.1.13', 'Fundação',
   'Concreto - (Apenas Material) -Escada',
   'Concreto Escada - (Apenas Material)'),
  (682, '3.1.2', 'Subsolo',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (MO)',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (683, '3.1.3', 'Subsolo',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (684, '3.1.4', 'Subsolo',
   'Lançamento, adensamento e acabamento de concreto estrutural',
   'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (685, '3.1.5', 'Subsolo',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (686, '3.1.6', 'Subsolo',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material',
   'Material p/ Forma (Apenas Material)'),
  (687, '3.1.7', 'Subsolo',
   'Piso Polido (MO)',
   'Piso Polido (Mão de Obra)'),
  (688, '3.1.8', 'Subsolo',
   'Execução Escadas - MO',
   'Execução Escadas - (Mão de Obra)'),
  (689, '3.1.9', 'Subsolo',
   'Material Forma - (Apenas Material) -Escada',
   'Material Forma Escada - (Apenas Material)'),
  (690, '3.1.10', 'Subsolo',
   'Aço  - (Apenas Material) -Escada',
   'Aço Escada - (Apenas Material)'),
  (691, '3.1.11', 'Subsolo',
   'Concreto - (Apenas Material) -Escada',
   'Concreto Escada - (Apenas Material)'),
  (692, '3.1.12', 'Subsolo',
   'Execução Laje Treliçada',
   'Execução Laje Treliçada (Mão de Obra+Material)'),
  (694, '3.2.2', 'Térreo',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (MO)',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (695, '3.2.3', 'Térreo',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (696, '3.2.4', 'Térreo',
   'Lançamento, adensamento e acabamento de concreto estrutural',
   'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (697, '3.2.5', 'Térreo',
   'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO',
   'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (698, '3.2.6', 'Térreo',
   'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material',
   'Material p/ Forma (Apenas Material)'),
  (699, '3.2.7', 'Térreo',
   'Piso Polido (MO)',
   'Piso Polido (Mão de Obra)'),
  (700, '3.2.8', 'Térreo',
   'Execução Escadas - MO',
   'Execução Escadas - (Mão de Obra)'),
  (701, '3.2.9', 'Térreo',
   'Material Forma - (Apenas Material) -Escada',
   'Material Forma Escada - (Apenas Material)'),
  (702, '3.2.10', 'Térreo',
   'Aço  - (Apenas Material) -Escada',
   'Aço Escada - (Apenas Material)'),
  (703, '3.2.11', 'Térreo',
   'Concreto - (Apenas Material) -Escada',
   'Concreto Escada - (Apenas Material)'),
  (704, '3.2.12', 'Térreo',
   'Execução Laje Treliçada',
   'Execução Laje Treliçada (Mão de Obra+Material)'),
  (706, '3.3.2', '1º Pav',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (MO)',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (707, '3.3.3', '1º Pav',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (708, '3.3.4', '1º Pav',
   'Lançamento, adensamento e acabamento de concreto estrutural',
   'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (709, '3.3.5', '1º Pav',
   'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO',
   'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (710, '3.3.6', '1º Pav',
   'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material',
   'Material p/ Forma (Apenas Material)'),
  (711, '3.3.7', '1º Pav',
   'Execução Escadas - MO',
   'Execução Escadas - (Mão de Obra)'),
  (712, '3.3.8', '1º Pav',
   'Material Forma - (Apenas Material) -Escada',
   'Material Forma Escada - (Apenas Material)'),
  (713, '3.3.9', '1º Pav',
   'Aço  - (Apenas Material) -Escada',
   'Aço Escada - (Apenas Material)'),
  (714, '3.3.10', '1º Pav',
   'Concreto - (Apenas Material) -Escada',
   'Concreto Escada - (Apenas Material)'),
  (715, '3.3.11', '1º Pav',
   'Execução Laje Treliçada',
   'Execução Laje Treliçada (Mão de Obra+Material)'),
  (717, '3.4.2', '2º Pav',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (MO)',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (718, '3.4.3', '2º Pav',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (719, '3.4.4', '2º Pav',
   'Lançamento, adensamento e acabamento de concreto estrutural',
   'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (720, '3.4.5', '2º Pav',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material',
   'Material p/ Forma (Apenas Material)'),
  (721, '3.4.6', '2º Pav',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (722, '3.4.7', '2º Pav',
   'Execução Escadas - MO',
   'Execução Escadas - (Mão de Obra)'),
  (723, '3.4.8', '2º Pav',
   'Material Forma - (Apenas Material) -Escada',
   'Material Forma Escada - (Apenas Material)'),
  (724, '3.4.9', '2º Pav',
   'Aço  - (Apenas Material) -Escada',
   'Aço Escada - (Apenas Material)'),
  (725, '3.4.10', '2º Pav',
   'Concreto - (Apenas Material) -Escada',
   'Concreto Escada - (Apenas Material)'),
  (726, '3.4.11', '2º Pav',
   'Execução Laje Treliçada',
   'Execução Laje Treliçada (Mão de Obra+Material)'),
  (728, '3.5.2', '3º Pav',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (MO)',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (729, '3.5.3', '3º Pav',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (730, '3.5.4', '3º Pav',
   'Lançamento, adensamento e acabamento de concreto estrutural',
   'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (731, '3.5.5', '3º Pav',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (732, '3.5.6', '3º Pav',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material',
   'Material p/ Forma (Apenas Material)'),
  (733, '3.5.7', '3º Pav',
   'Execução Laje Treliçada',
   'Execução Laje Treliçada (Mão de Obra+Material)'),
  (735, '3.6.2', 'Terraço',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (MO)',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (736, '3.6.3', 'Terraço',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (737, '3.6.4', 'Terraço',
   'Lançamento, adensamento e acabamento de concreto estrutural',
   'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (738, '3.6.5', 'Terraço',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (739, '3.6.6', 'Terraço',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material',
   'Material p/ Forma (Apenas Material)'),
  (740, '3.6.7', 'Terraço',
   'Execução Laje Treliçada',
   'Execução Laje Treliçada (Mão de Obra+Material)'),
  (742, '3.7.2', 'Reservatório',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (MO)',
   'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)'),
  (743, '3.7.3', 'Reservatório',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20',
   'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)'),
  (744, '3.7.4', 'Reservatório',
   'Lançamento, adensamento e acabamento de concreto estrutural',
   'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)'),
  (745, '3.7.5', 'Reservatório',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga, Pilares e Laje Maciça) - (Mão de Obra)'),
  (746, '3.7.6', 'Reservatório',
   'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material',
   'Material p/ Forma (Apenas Material)');

-- Trava inicial: 334 linhas, R$ 7.551.387,47, backup ainda não existe, as 69 linhas exatamente como hoje
do $$
declare n int; total numeric; k int;
begin
  if to_regclass('public.orcamento_descricoes_bkp_20261009') is not null then
    raise exception 'orcamento_descricoes_bkp_20261009 já existe: este arquivo já foi rodado? Nada foi feito';
  end if;
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'orçamento com % linhas e % (esperado 334 e 7551387.47): nada foi feito', n, total;
  end if;
  select count(*) into k from _desc d join public.orcamento_planejado o
    on o.id = d.id and o.obra_id = 'sirius60' and o.codigo_eap = d.codigo_eap and o.pavimento = d.pavimento
   and o.descricao = d.antes;
  if k <> 69 then
    raise exception 'só % das 69 linhas estão como esperado (id + código + pavimento + descrição de hoje): nada foi feito', k;
  end if;
end $$;

-- Backup das 69 linhas inteiras
create table public.orcamento_descricoes_bkp_20261009 as
  select o.* from public.orcamento_planejado o where o.obra_id = 'sirius60' and o.id in (668, 669, 671, 672, 673, 674, 676, 677, 678, 679, 682, 683, 684, 685, 686, 687, 688, 689, 690, 691, 692, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 728, 729, 730, 731, 732, 733, 735, 736, 737, 738, 739, 740, 742, 743, 744, 745, 746);
alter table public.orcamento_descricoes_bkp_20261009 enable row level security;
revoke all on public.orcamento_descricoes_bkp_20261009 from anon, authenticated;

-- Troca SÓ a descrição, pelo id; conta as linhas alteradas
do $$
declare k int;
begin
  update public.orcamento_planejado o set descricao = d.nova
    from _desc d where o.id = d.id and o.obra_id = 'sirius60' and o.descricao = d.antes;
  get diagnostics k = row_count;
  if k <> 69 then
    raise exception 'foram alteradas % linhas (esperado 69): nada foi gravado', k;
  end if;
end $$;

-- Trava final: mesmo total, as 69 com o texto novo, nenhuma outra coluna mudou
do $$
declare n int; total numeric; k int; outras int;
begin
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'orçamento mudou de total (% linhas, %): nada foi gravado', n, total;
  end if;
  select count(*) into k from _desc d join public.orcamento_planejado o on o.id = d.id and o.descricao = d.nova;
  if k <> 69 then
    raise exception 'só % das 69 linhas ficaram com a descrição nova: nada foi gravado', k;
  end if;
  select count(*) into outras from public.orcamento_descricoes_bkp_20261009 b join public.orcamento_planejado o on o.id = b.id
   where (to_jsonb(o) - 'descricao') <> (to_jsonb(b) - 'descricao');
  if outras <> 0 then
    raise exception '% linhas mudaram em outra coluna além da descrição: nada foi gravado', outras;
  end if;
end $$;

commit;

-- Conferência: as 69 linhas com a descrição nova (e a de antes, do backup)
select o.id, o.codigo_eap, o.pavimento, o.preco_total, o.hh, o.descricao as descricao_nova, b.descricao as descricao_antes
  from public.orcamento_planejado o join public.orcamento_descricoes_bkp_20261009 b on b.id = o.id
 order by string_to_array(o.codigo_eap, '.')::int[], o.pavimento;
