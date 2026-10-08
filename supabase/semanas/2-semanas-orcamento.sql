-- =====================================================================
-- Sirius 60 — SEMANAS, PASSO 2: semanas do orçamento e dos indiretos no calendário real (gerado por gerar_sql_semanas.py)
-- Rodar DEPOIS do 3-pilotis-subsolo.sql (orçamento) e do 1-calendario.sql. Desfazer: 2-semanas-orcamento-desfazer.sql
--
-- orcamento_planejado: cada linha ganha as semanas REAIS (S01..S117) da sua janela dentro da atividade do cronograma
--   a que está ligada (automacao/saida_v2/eap_cronograma.csv, coluna janelas): da semana real que contém o início da
--   janela até a que contém o fim. Estrutura de cada pavimento (pedido 12, 8 semanas): armação/aço sem. 1–6; forma
--   (MO e material) da metade da sem. 1 até a 7; laje treliçada 5–7; concretagem (lançamento e concreto usinado)
--   30% pilares na sem. 4 e 70% laje na sem. 8 (a linha vai da sem. 4 à 8); Reservatório (4 semanas) na mesma ordem.
--   Fundação 2.1.3 (forma + armação): armação desde o início, forma meia semana depois.
--   Encunhamento (4.x.3 / 4.x.4, Rafael 08/10): começa na semana real seguinte ao FIM da alvenaria do mesmo
--   pavimento, com 2 semanas de duração em todos os pavimentos (Rafael, 08/10). Horas e valores não mudam.
--   Escadas (2.1.10 a 2.1.13 e as escadas de cada pavimento): só a ÚLTIMA semana da estrutura do pavimento
--   (fundação: última semana da concretagem de blocos/tubulões, 2.1.4 do cronograma).
--   Custo de tempo (1.1.6, grupos 17 e 18): S01 a S117 (a obra toda, 24 meses).
--   A "semana atual" esperada de cada linha é a de DEPOIS do 3-pilotis-subsolo.sql (4.1.x/4.2.x trocadas).
-- custos_indiretos_planejados: recorrentes diluídos de S01 a S117; pontuais nas semanas novas que contêm as datas
--   das semanas antigas (7 dias corridos desde 03/08/2026).
-- Antes de mudar: backups orcamento_semanas_bkp_20261008 e indiretos_semanas_bkp_20261008. Preço, horas e códigos não mudam.
-- =====================================================================
begin;

do $$
declare n int;
begin
  if to_regclass('public.calendario_semanas') is null then
    raise exception 'rode antes o 1-calendario.sql';
  end if;
  if to_regclass('public.orcamento_semanas_bkp_20261008') is not null or to_regclass('public.indiretos_semanas_bkp_20261008') is not null then
    raise exception 'backup de semanas já existe: este arquivo já foi rodado?';
  end if;
  select count(*) into n from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 then raise exception 'orcamento_planejado tem % linhas (esperado 334): nada foi feito', n; end if;
  if not exists (select 1 from public.orcamento_planejado where id = 747 and codigo_eap = '4.1.1' and preco_total = 13901.95) then
    raise exception 'rode antes o supabase/orcamento/3-pilotis-subsolo.sql (4.1.1 Pilotis ainda não tem 143,26 m²)';
  end if;
end $$;

create table public.orcamento_semanas_bkp_20261008 as
  select id, codigo_eap, pavimento, semana_inicio, semana_fim
    from public.orcamento_planejado where obra_id = 'sirius60';
create table public.indiretos_semanas_bkp_20261008 as
  select id, codigo_eap, semana_desembolso, semana_fim
    from public.custos_indiretos_planejados where obra_id = 'sirius60';
alter table public.orcamento_semanas_bkp_20261008 enable row level security;
alter table public.indiretos_semanas_bkp_20261008 enable row level security;
revoke all on public.orcamento_semanas_bkp_20261008 from anon, authenticated;
revoke all on public.indiretos_semanas_bkp_20261008 from anon, authenticated;

-- orçamento: (id, código, semana_inicio atual, semana_fim atual, semana_inicio nova, semana_fim nova)
update public.orcamento_planejado as o
   set semana_inicio = v.ini_novo, semana_fim = v.fim_novo
  from (values
  (661, '1.1.1', 1, 2, 1, 3),
  (662, '1.1.2', 1, 2, 1, 3),
  (663, '1.1.3', 1, 2, 1, 3),
  (664, '1.1.4', 1, 2, 1, 3),
  (665, '1.1.5', 1, 2, 1, 3),
  (666, '1.1.6', 1, 96, 1, 117),  -- custo de tempo: fora do avanço
  (667, '2.1.1', 1, 4, 1, 4),
  (668, '2.1.2', 3, 11, 3, 13),
  (669, '2.1.3', 4, 13, 4, 15),
  (670, '2.1.4', 4, 13, 4, 15),
  (671, '2.1.5', 6, 14, 6, 16),
  (672, '2.1.6', 4, 13, 4, 15),
  (673, '2.1.7', 4, 13, 4, 15),
  (674, '2.1.8', 6, 14, 6, 16),
  (675, '2.1.9', 9, 13, 10, 15),
  (676, '2.1.10', 9, 13, 15, 16),  -- ESCADA: última semana da estrutura da fundação
  (677, '2.1.11', 9, 13, 15, 16),  -- ESCADA: última semana da estrutura da fundação
  (678, '2.1.12', 9, 13, 15, 16),  -- ESCADA: última semana da estrutura da fundação
  (679, '2.1.13', 9, 13, 15, 16),  -- ESCADA: última semana da estrutura da fundação
  (680, '2.1.14', 10, 19, 11, 22),
  (681, '3.1.1', 17, 24, 19, 26),
  (682, '3.1.2', 17, 24, 19, 26),
  (683, '3.1.3', 17, 24, 22, 28),
  (684, '3.1.4', 17, 24, 22, 28),
  (685, '3.1.5', 17, 24, 19, 27),
  (686, '3.1.6', 17, 24, 19, 27),
  (687, '3.1.7', 13, 16, 15, 18),
  (688, '3.1.8', 17, 24, 27, 28),  -- ESCADA: última semana da estrutura do pavimento
  (689, '3.1.9', 17, 24, 27, 28),  -- ESCADA: última semana da estrutura do pavimento
  (690, '3.1.10', 17, 24, 27, 28),  -- ESCADA: última semana da estrutura do pavimento
  (691, '3.1.11', 17, 24, 27, 28),  -- ESCADA: última semana da estrutura do pavimento
  (692, '3.1.12', 17, 24, 24, 27),
  (693, '3.2.1', 25, 32, 29, 35),
  (694, '3.2.2', 25, 32, 29, 35),
  (695, '3.2.3', 25, 32, 32, 37),
  (696, '3.2.4', 25, 32, 32, 37),
  (697, '3.2.5', 25, 32, 29, 36),
  (698, '3.2.6', 25, 32, 29, 36),
  (699, '3.2.7', 13, 16, 15, 18),
  (700, '3.2.8', 25, 32, 36, 37),  -- ESCADA: última semana da estrutura do pavimento
  (701, '3.2.9', 25, 32, 36, 37),  -- ESCADA: última semana da estrutura do pavimento
  (702, '3.2.10', 25, 32, 36, 37),  -- ESCADA: última semana da estrutura do pavimento
  (703, '3.2.11', 25, 32, 36, 37),  -- ESCADA: última semana da estrutura do pavimento
  (704, '3.2.12', 25, 32, 33, 36),
  (705, '3.3.1', 33, 40, 38, 45),
  (706, '3.3.2', 33, 40, 38, 45),
  (707, '3.3.3', 33, 40, 41, 47),
  (708, '3.3.4', 33, 40, 41, 47),
  (709, '3.3.5', 33, 40, 38, 47),
  (710, '3.3.6', 33, 40, 38, 47),
  (711, '3.3.7', 33, 40, 47, 47),  -- ESCADA: última semana da estrutura do pavimento
  (712, '3.3.8', 33, 40, 47, 47),  -- ESCADA: última semana da estrutura do pavimento
  (713, '3.3.9', 33, 40, 47, 47),  -- ESCADA: última semana da estrutura do pavimento
  (714, '3.3.10', 33, 40, 47, 47),  -- ESCADA: última semana da estrutura do pavimento
  (715, '3.3.11', 33, 40, 43, 47),
  (716, '3.4.1', 41, 48, 48, 55),
  (717, '3.4.2', 41, 48, 48, 55),
  (718, '3.4.3', 41, 48, 51, 57),
  (719, '3.4.4', 41, 48, 51, 57),
  (720, '3.4.5', 41, 48, 48, 56),
  (721, '3.4.6', 41, 48, 48, 56),
  (722, '3.4.7', 41, 48, 56, 57),  -- ESCADA: última semana da estrutura do pavimento
  (723, '3.4.8', 41, 48, 56, 57),  -- ESCADA: última semana da estrutura do pavimento
  (724, '3.4.9', 41, 48, 56, 57),  -- ESCADA: última semana da estrutura do pavimento
  (725, '3.4.10', 41, 48, 56, 57),  -- ESCADA: última semana da estrutura do pavimento
  (726, '3.4.11', 41, 48, 53, 56),
  (727, '3.5.1', 49, 56, 58, 65),
  (728, '3.5.2', 49, 56, 58, 65),
  (729, '3.5.3', 49, 56, 61, 67),
  (730, '3.5.4', 49, 56, 61, 67),
  (731, '3.5.5', 49, 56, 58, 66),
  (732, '3.5.6', 49, 56, 58, 66),
  (733, '3.5.7', 49, 56, 63, 66),
  (734, '3.6.1', 57, 64, 68, 75),
  (735, '3.6.2', 57, 64, 68, 75),
  (736, '3.6.3', 57, 64, 71, 77),
  (737, '3.6.4', 57, 64, 71, 77),
  (738, '3.6.5', 57, 64, 69, 76),
  (739, '3.6.6', 57, 64, 69, 76),
  (740, '3.6.7', 57, 64, 73, 76),
  (741, '3.7.1', 65, 68, 78, 81),
  (742, '3.7.2', 65, 68, 78, 81),
  (743, '3.7.3', 65, 68, 79, 82),
  (744, '3.7.4', 65, 68, 79, 82),
  (745, '3.7.5', 65, 68, 78, 82),
  (746, '3.7.6', 65, 68, 78, 82),
  (747, '4.1.1', 21, 23, 33, 37),
  (748, '4.1.2', 21, 23, 33, 37),
  (749, '4.1.3', 24, 27, 38, 39),
  (750, '4.2.1', 29, 32, 24, 27),
  (751, '4.2.2', 29, 32, 24, 27),
  (752, '4.2.3', 29, 32, 28, 29),
  (753, '4.3.1', 37, 44, 43, 52),
  (754, '4.3.2', 37, 44, 43, 52),
  (755, '4.3.3', 37, 44, 43, 52),
  (756, '4.3.4', 37, 44, 53, 54),
  (757, '4.4.1', 45, 51, 53, 61),
  (758, '4.4.2', 45, 51, 53, 61),
  (759, '4.4.3', 45, 51, 53, 61),
  (760, '4.4.4', 45, 51, 62, 63),
  (761, '4.5.1', 52, 58, 61, 70),
  (762, '4.5.2', 52, 58, 61, 70),
  (763, '4.5.3', 52, 58, 61, 70),
  (764, '4.5.4', 52, 58, 71, 72),
  (765, '4.6.1', 61, 67, 73, 81),
  (766, '4.6.2', 61, 67, 73, 81),
  (767, '4.6.3', 61, 67, 73, 81),
  (768, '4.6.4', 61, 67, 82, 83),
  (769, '4.7.1', 69, 71, 83, 87),
  (770, '4.7.2', 69, 71, 83, 87),
  (771, '4.8.1', 73, 74, 88, 90),
  (772, '5.1.1', 26, 76, 30, 92),
  (773, '5.1.1', 26, 76, 30, 92),
  (774, '5.1.1', 26, 76, 30, 92),
  (775, '5.1.1', 26, 76, 30, 92),
  (776, '5.1.1', 26, 76, 30, 92),
  (777, '5.1.1', 26, 76, 30, 92),
  (778, '5.1.1', 26, 76, 30, 92),
  (779, '5.1.1', 26, 76, 30, 92),
  (780, '5.1.2', 50, 80, 58, 97),
  (781, '5.1.2', 50, 80, 58, 97),
  (782, '5.1.2', 50, 80, 58, 97),
  (783, '5.1.2', 50, 80, 58, 97),
  (784, '5.1.2', 50, 80, 58, 97),
  (785, '5.1.3', 65, 80, 78, 97),
  (786, '6.1.1', 54, 86, 64, 105),
  (787, '6.1.1', 54, 86, 64, 105),
  (788, '6.1.1', 54, 86, 64, 105),
  (789, '6.1.1', 54, 86, 64, 105),
  (790, '6.1.2', 30, 79, 34, 96),
  (791, '6.1.2', 30, 79, 34, 96),
  (792, '6.1.2', 30, 79, 34, 96),
  (793, '6.1.2', 30, 79, 34, 96),
  (794, '7.1.1', 54, 86, 64, 105),
  (795, '7.1.1', 54, 86, 64, 105),
  (796, '7.1.1', 54, 86, 64, 105),
  (797, '7.1.1', 54, 86, 64, 105),
  (798, '7.1.1', 54, 86, 64, 105),
  (799, '7.1.1', 54, 86, 64, 105),
  (800, '7.1.2', 30, 79, 34, 96),
  (801, '7.1.2', 30, 79, 34, 96),
  (802, '7.1.2', 30, 79, 34, 96),
  (803, '7.1.2', 30, 79, 34, 96),
  (804, '7.1.2', 30, 79, 34, 96),
  (805, '7.1.2', 30, 79, 34, 96),
  (806, '8.1.1', 80, 83, 96, 101),
  (807, '8.1.2', 80, 83, 96, 101),
  (808, '8.1.2', 80, 83, 96, 101),
  (809, '8.1.2', 80, 83, 96, 101),
  (810, '8.1.2', 80, 83, 96, 101),
  (811, '8.1.3', 80, 83, 96, 101),
  (812, '8.1.3', 80, 83, 96, 101),
  (813, '8.1.3', 80, 83, 96, 101),
  (814, '8.1.3', 80, 83, 96, 101),
  (815, '8.1.4', 80, 83, 96, 101),
  (816, '8.1.4', 80, 83, 96, 101),
  (817, '8.1.4', 80, 83, 96, 101),
  (818, '8.1.4', 80, 83, 96, 101),
  (819, '8.1.5', 93, 96, 113, 114),
  (820, '9.1.1', 50, 57, 58, 69),
  (821, '9.1.2', 62, 63, 74, 76),
  (822, '9.1.2', 62, 63, 74, 76),
  (823, '9.1.2', 62, 63, 74, 76),
  (824, '9.1.2', 62, 63, 74, 76),
  (825, '9.1.2', 62, 63, 74, 76),
  (826, '9.1.3', 84, 86, 101, 105),
  (827, '9.1.4', 84, 86, 101, 105),
  (828, '9.1.5', 84, 86, 101, 105),
  (829, '10.1.1', 58, 73, 69, 89),
  (830, '10.1.1', 58, 73, 69, 89),
  (831, '10.1.1', 58, 73, 69, 89),
  (832, '10.1.1', 58, 73, 69, 89),
  (833, '10.1.1', 58, 73, 69, 89),
  (834, '10.1.1', 58, 73, 69, 89),
  (835, '10.1.1', 58, 73, 69, 89),
  (836, '10.1.2', 66, 71, 79, 87),
  (837, '10.1.2', 66, 71, 79, 87),
  (838, '10.1.2', 66, 71, 79, 87),
  (839, '10.1.2', 66, 71, 79, 87),
  (840, '10.1.3', 66, 71, 79, 87),
  (841, '10.1.3', 66, 71, 79, 87),
  (842, '10.1.3', 66, 71, 79, 87),
  (843, '10.1.3', 66, 71, 79, 87),
  (844, '10.1.4', 66, 71, 79, 87),
  (845, '10.1.4', 66, 71, 79, 87),
  (846, '10.1.4', 66, 71, 79, 87),
  (847, '10.1.4', 66, 71, 79, 87),
  (848, '11.1.1', 82, 83, 99, 101),
  (849, '11.1.1', 82, 83, 99, 101),
  (850, '11.1.1', 82, 83, 99, 101),
  (851, '11.1.1', 82, 83, 99, 101),
  (852, '11.1.2', 51, 75, 60, 91),
  (853, '11.1.2', 51, 75, 60, 91),
  (854, '11.1.2', 51, 75, 60, 91),
  (855, '11.1.2', 51, 75, 60, 91),
  (856, '11.1.2', 51, 75, 60, 91),
  (857, '11.1.2', 51, 75, 60, 91),
  (858, '11.1.2', 51, 75, 60, 91),
  (859, '11.1.3', 66, 84, 79, 102),
  (860, '11.1.3', 66, 84, 79, 102),
  (861, '11.1.3', 66, 84, 79, 102),
  (862, '11.1.3', 66, 84, 79, 102),
  (863, '11.1.3', 66, 84, 79, 102),
  (864, '11.1.4', 70, 83, 84, 101),
  (865, '11.1.4', 70, 83, 84, 101),
  (866, '11.1.4', 70, 83, 84, 101),
  (867, '11.1.4', 70, 83, 84, 101),
  (868, '11.1.4', 70, 83, 84, 101),
  (869, '11.1.7', 84, 87, 101, 106),
  (870, '11.1.7', 84, 87, 101, 106),
  (871, '11.1.7', 84, 87, 101, 106),
  (872, '11.1.7', 84, 87, 101, 106),
  (873, '11.1.8', 82, 83, 99, 101),
  (874, '11.1.8', 82, 83, 99, 101),
  (875, '11.1.8', 82, 83, 99, 101),
  (876, '11.1.8', 82, 83, 99, 101),
  (877, '11.1.8', 82, 83, 99, 101),
  (878, '11.1.9', 82, 83, 99, 101),
  (879, '12.1.1', 95, 95, 115, 117),
  (880, '12.1.2', 95, 95, 115, 117),
  (881, '12.1.3', 66, 84, 79, 102),
  (882, '12.1.3', 66, 84, 79, 102),
  (883, '12.1.3', 66, 84, 79, 102),
  (884, '12.1.3', 66, 84, 79, 102),
  (885, '12.1.4', 66, 84, 79, 102),
  (886, '12.1.4', 66, 84, 79, 102),
  (887, '12.1.4', 66, 84, 79, 102),
  (888, '12.1.4', 66, 84, 79, 102),
  (889, '12.1.5', 66, 84, 79, 102),
  (890, '12.1.5', 66, 84, 79, 102),
  (891, '12.1.5', 66, 84, 79, 102),
  (892, '12.1.5', 66, 84, 79, 102),
  (893, '12.1.6', 95, 95, 115, 117),
  (894, '12.1.7', 90, 95, 109, 117),
  (895, '12.1.8', 90, 95, 109, 117),
  (896, '12.1.9', 90, 95, 109, 117),
  (897, '12.1.10', 90, 95, 109, 117),
  (898, '12.1.11', 90, 95, 109, 117),
  (899, '12.1.12', 90, 95, 109, 117),
  (900, '12.1.13', 90, 95, 109, 117),
  (901, '12.1.14', 95, 96, 115, 117),
  (902, '12.1.15', 95, 96, 115, 117),
  (903, '12.1.16', 95, 96, 115, 117),
  (904, '12.1.17', 95, 96, 115, 117),
  (905, '12.1.18', 95, 96, 115, 117),
  (906, '12.1.19', 95, 96, 115, 117),
  (907, '13.1.1', 72, 77, 87, 94),
  (908, '13.1.1', 72, 77, 87, 94),
  (909, '13.1.1', 72, 77, 87, 94),
  (910, '13.1.1', 72, 77, 87, 94),
  (911, '13.1.2', 78, 95, 94, 117),
  (912, '13.1.2', 78, 95, 94, 117),
  (913, '13.1.2', 78, 95, 94, 117),
  (914, '13.1.2', 78, 95, 94, 117),
  (915, '13.1.2', 78, 95, 94, 117),
  (916, '13.1.2', 78, 95, 94, 117),
  (917, '13.1.2', 78, 95, 94, 117),
  (918, '13.1.3', 95, 95, 115, 117),
  (919, '13.1.4', 81, 93, 98, 114),
  (920, '13.1.5', 81, 93, 98, 114),
  (921, '13.1.6', 95, 95, 115, 117),
  (922, '14.1.1', 91, 96, 110, 117),
  (923, '14.1.1', 91, 96, 110, 117),
  (924, '14.1.1', 91, 96, 110, 117),
  (925, '14.1.1', 91, 96, 110, 117),
  (926, '14.1.2', 91, 96, 110, 117),
  (927, '14.1.2', 91, 96, 110, 117),
  (928, '14.1.2', 91, 96, 110, 117),
  (929, '14.1.2', 91, 96, 110, 117),
  (930, '14.1.3', 91, 96, 110, 117),
  (931, '14.1.3', 91, 96, 110, 117),
  (932, '14.1.3', 91, 96, 110, 117),
  (933, '14.1.3', 91, 96, 110, 117),
  (934, '14.1.4', 91, 96, 110, 117),
  (935, '14.1.4', 91, 96, 110, 117),
  (936, '14.1.4', 91, 96, 110, 117),
  (937, '14.1.4', 91, 96, 110, 117),
  (938, '14.1.5', 78, 83, 94, 101),
  (939, '14.1.5', 78, 83, 94, 101),
  (940, '14.1.5', 78, 83, 94, 101),
  (941, '14.1.5', 78, 83, 94, 101),
  (942, '14.1.6', 91, 96, 110, 117),
  (943, '14.1.6', 91, 96, 110, 117),
  (944, '14.1.6', 91, 96, 110, 117),
  (945, '14.1.6', 91, 96, 110, 117),
  (946, '14.1.7', 91, 96, 110, 117),
  (947, '14.1.7', 91, 96, 110, 117),
  (948, '14.1.7', 91, 96, 110, 117),
  (949, '14.1.7', 91, 96, 110, 117),
  (950, '14.1.8', 91, 96, 110, 117),
  (951, '14.1.8', 91, 96, 110, 117),
  (952, '14.1.8', 91, 96, 110, 117),
  (953, '14.1.8', 91, 96, 110, 117),
  (954, '14.1.9', 91, 96, 110, 117),
  (955, '14.1.9', 91, 96, 110, 117),
  (956, '14.1.9', 91, 96, 110, 117),
  (957, '14.1.9', 91, 96, 110, 117),
  (958, '14.1.10', 91, 96, 110, 117),
  (959, '14.1.10', 91, 96, 110, 117),
  (960, '14.1.10', 91, 96, 110, 117),
  (961, '14.1.10', 91, 96, 110, 117),
  (962, '14.1.11', 91, 96, 110, 117),
  (963, '14.1.11', 91, 96, 110, 117),
  (964, '14.1.11', 91, 96, 110, 117),
  (965, '14.1.11', 91, 96, 110, 117),
  (966, '14.1.12', 78, 83, 94, 101),
  (967, '14.1.12', 78, 83, 94, 101),
  (968, '14.1.12', 78, 83, 94, 101),
  (969, '14.1.12', 78, 83, 94, 101),
  (970, '15.1.1', 78, 80, 94, 97),
  (971, '15.1.2', 90, 96, 109, 112),
  (972, '15.1.3', 96, 96, 117, 117),
  (973, '15.1.4', 2, 10, 2, 12),
  (974, '17.1.1', 1, 96, 1, 117),  -- custo de tempo: fora do avanço
  (975, '17.1.2', 9, 68, 1, 117),  -- custo de tempo: fora do avanço
  (976, '17.1.3', 9, 60, 1, 117),  -- custo de tempo: fora do avanço
  (977, '17.1.4', 9, 60, 1, 117),  -- custo de tempo: fora do avanço
  (978, '17.1.5', 1, 40, 1, 117),  -- custo de tempo: fora do avanço
  (979, '17.1.6', 1, 96, 1, 117),  -- custo de tempo: fora do avanço
  (980, '17.1.7', 1, 72, 1, 117),  -- custo de tempo: fora do avanço
  (981, '17.1.8', 5, 64, 1, 117),  -- custo de tempo: fora do avanço
  (982, '17.1.9', 1, 80, 1, 117),  -- custo de tempo: fora do avanço
  (983, '17.1.10', 1, 96, 1, 117),  -- custo de tempo: fora do avanço
  (984, '17.1.11', 1, 80, 1, 117),  -- custo de tempo: fora do avanço
  (985, '17.1.12', 1, 96, 1, 117),  -- custo de tempo: fora do avanço
  (986, '17.1.13', 1, 96, 1, 117),  -- custo de tempo: fora do avanço
  (987, '18.1.1', 1, 96, 1, 117),  -- custo de tempo: fora do avanço
  (988, '6.1.1.1', 69, 73, 83, 89),
  (989, '6.1.1.1', 69, 73, 83, 89),
  (990, '6.1.1.1', 69, 73, 83, 89),
  (991, '6.1.1.1', 69, 73, 83, 89),
  (992, '3.0.1', 9, 16, 10, 18),
  (993, '4.0.9', 73, 74, 88, 90),
  (994, '17.1.14', 1, 96, 1, 117)  -- custo de tempo: fora do avanço
  ) as v(id, codigo, ini_atual, fim_atual, ini_novo, fim_novo)
 where o.id = v.id and o.obra_id = 'sirius60' and o.codigo_eap = v.codigo
   and o.semana_inicio = v.ini_atual and o.semana_fim = v.fim_atual;

-- indiretos: (id, código, semana antiga início, fim, semana nova início, fim)
update public.custos_indiretos_planejados as i
   set semana_desembolso = v.ini_novo, semana_fim = v.fim_novo
  from (values
  (1, '19.1.1', 1, 8, 1, 8),  -- pontual: 03/08 a 27/09
  (2, '19.1.4', 1, 8, 1, 8),  -- pontual: 03/08 a 27/09
  (3, '19.1.6', 1, 8, 1, 8),  -- pontual: 03/08 a 27/09
  (4, '19.1.10', 1, 4, 1, 4),  -- pontual: 03/08 a 30/08
  (5, '19.1.12', 1, 4, 1, 4),  -- pontual: 03/08 a 30/08
  (6, '19.1.13', 1, 4, 1, 4),  -- pontual: 03/08 a 30/08
  (7, '19.1.14', 1, 4, 1, 4),  -- pontual: 03/08 a 30/08
  (8, '19.1.18', 1, 96, 1, 117),  -- recorrente: diluído
  (9, '19.1.20', 1, 4, 1, 4),  -- pontual: 03/08 a 30/08
  (10, '19.1.21', 1, 96, 1, 117),  -- recorrente: diluído
  (11, '19.1.22', 1, 4, 1, 4),  -- pontual: 03/08 a 30/08
  (12, '19.1.23', 1, 96, 1, 117),  -- recorrente: diluído
  (13, '19.1.24', 1, 96, 1, 117)  -- recorrente: diluído
  ) as v(id, codigo, ini_atual, fim_atual, ini_novo, fim_novo)
 where i.id = v.id and i.obra_id = 'sirius60' and i.codigo_eap = v.codigo
   and i.semana_desembolso = v.ini_atual and i.semana_fim = v.fim_atual;

do $$
declare n int; m int; fora int;
begin
  select count(*) into n from public.orcamento_planejado o join public.orcamento_semanas_bkp_20261008 b using (id)
   where (o.semana_inicio, o.semana_fim) is distinct from (b.semana_inicio, b.semana_fim);
  if n <> 333 then
    raise exception 'orçamento: % linha(s) mudaram (esperado 333): nada foi gravado', n;
  end if;
  select count(*) into m from public.custos_indiretos_planejados where obra_id = 'sirius60' and semana_fim = 117;
  if m <> 4 then
    raise exception 'indiretos: % recorrente(s) até S117 (esperado 4): nada foi gravado', m;
  end if;
  select count(*) into fora from public.orcamento_planejado
   where obra_id = 'sirius60' and (semana_inicio < 1 or semana_fim > 117 or semana_fim < semana_inicio);
  if fora > 0 then raise exception '% linha(s) com semanas fora de S01..S117: nada foi gravado', fora; end if;
end $$;

commit;

-- Conferência 1: semanas por grupo (antes × depois)
select o.grupo_num, min(b.semana_inicio) as ini_antes, max(b.semana_fim) as fim_antes,
       min(o.semana_inicio) as ini_depois, max(o.semana_fim) as fim_depois, count(*) as linhas
  from public.orcamento_planejado o join public.orcamento_semanas_bkp_20261008 b using (id)
 where o.obra_id = 'sirius60' group by o.grupo_num order by o.grupo_num;
-- Conferência 2: indiretos (antes × depois)
select i.codigo_eap, i.categoria, i.recorrente, b.semana_desembolso as ini_antes, b.semana_fim as fim_antes,
       i.semana_desembolso as ini_depois, i.semana_fim as fim_depois
  from public.custos_indiretos_planejados i join public.indiretos_semanas_bkp_20261008 b using (id) order by i.codigo_eap;
