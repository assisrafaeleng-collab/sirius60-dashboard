-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 8: quantidades e medições da fundação (pedido 19; Rafael 14/10/2026)
-- CORREÇÃO DA MEMÓRIA DE CÁLCULO do orçamento (não é mudança de projeto/escopo) + medições reais. Gerado por
-- automacao/gerar_sql_quantidades_fundacao.py --horas-215 proporcional. Um único bloco: grava tudo ou nada.
-- Desfazer: 8-quantidades-fundacao-desfazer.sql
--
-- orcamento_planejado (por id; preço unitário não muda):
--   670 2.1.4 aço       18.102,18 → 16.578,47 kg | R$ 125.267,11 → 114.723,01 | 650,9 → 596,1 h
--   673 2.1.7 armação   18.102,18 → 16.578,47 kg | R$  54.306,55 → 49.735,41 | 282,2 → 258,4 h
--   671 2.1.5 concreto     389,53 → 529,80 m³    | R$ 257.091,12 → 349.668,00 | 725,6 → 986,9 h (proporcional)
--   Custo direto R$ 7.123.256,27 → 7.200.717,91 (+77.461,64); total da obra
--   R$ 9.997.764,35 → 10.075.225,99. Horas do orçamento 49.510,9 → 49.693,6.
-- curva_s_semanal_planejada: só as semanas das janelas dessas linhas (aço/armação: armação da "Forma + armação";
--   concreto: "Concretagem"); horas 48.454,8 → 48.637,5; valor R$ 6.325.932,24 → 6.403.393,88.
--   Planejado acumulado: S09 4,22% → 4,30%; S12 7,30% → 7,47%.
-- avanco_fisico_historico: MEDIÇÕES REAIS (levantamento do Rafael 14/10/2026; situação até 30/09/2026 = S09). As medições antigas NÃO
--   mudam; entram 9 "correções" (origem 'correcao'), na MESMA semana e data de cada medição antiga, com
--   % antigo × fator (fator = % real ÷ % antigo da última medição); id maior → vale no lugar da antiga:
--   2.1.2 real 216,04 de 389,53 m³ = 55,4617% · fator 55,4617 ÷ 60 = 0,924362:
--     S03 10% → 9,2436%, S04 50% → 46,2181%, S09 60% → 55,4617%
--   2.1.6 real 97,16 de 688,17 m² = 14,1186% · fator 14,1186 ÷ 50 = 0,282372:
--     S04 25% → 7,0593%, S06 40% → 11,2949%, S09 50% → 14,1186%
--   2.1.7 real 5.781,07 de 16.578,47 kg = 34,8710% · fator 34,8710 ÷ 70 = 0,498157:
--     S04 50% → 24,9079%, S06 70% → 34,8710%
--   2.1.8 real 194,77 de 529,80 m³ (por volume) = 36,7629% · fator 36,7629 ÷ 50 = 0,735258:
--     S04 50% → 36,7629%
--   2.1.1 já está em 100% (sem mudança). A regra da coluna origem passa a aceitar 'correcao'.
-- Travas antes e depois (nada é gravado se algo não bater). Backups (RLS, sem permissão para anon/authenticated):
--   orcamento_quantidades_bkp_20261014, curva_s_quantidades_bkp_20261014, avanco_quantidades_bkp_20261014.
-- Código ANTES do SQL: lib/medicao-servidor.js + telas de medição mostram "correção da medição" e a antiga riscada
--   (sem o código novo os números ficam certos, mas a tela lista as duas medições da semana sem dizer qual vale).
-- =====================================================================
-- Tudo num ÚNICO bloco (DO): ou grava tudo, ou não grava nada (qualquer trava que falhar desfaz o bloco inteiro).
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric;
begin
  -- ===== TRAVAS ANTES =====
  if to_regclass('public.orcamento_quantidades_bkp_20261014') is not null or to_regclass('public.curva_s_quantidades_bkp_20261014') is not null
     or to_regclass('public.avanco_quantidades_bkp_20261014') is not null then
    raise exception 'backup já existe: este arquivo já foi rodado? Nada foi gravado';
  end if;
  with x(id, codigo, qtd0, preco0, hh0, qtd, preco, hh) as (values
    (670, '2.1.4', 18102.18, 125267.11, 650.9, 16578.47, 114723.01, 596.1),
    (671, '2.1.5', 389.53, 257091.12, 725.6, 529.8, 349668.0, 986.9),
    (673, '2.1.7', 18102.18, 54306.55, 282.2, 16578.47, 49735.41, 258.4))
  select count(*) into v_n from public.orcamento_planejado o join x on x.id = o.id
   where o.obra_id = 'sirius60' and o.codigo_eap = x.codigo and o.pavimento = 'Fundação'
     and o.quantidade = x.qtd0 and o.preco_total = x.preco0 and o.hh = x.hh0;
  if v_n <> 3 then raise exception 'só % das 3 linhas (670, 671, 673) estão como esperado: nada foi gravado', v_n; end if;
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 333 or v_p <> 7123256.27 or v_h <> 49510.9 then
    raise exception 'orçamento com % linhas, R$ % e % h (esperado 333, 7123256.27 e 49510.9): nada foi gravado', v_n, v_p, v_h;
  end if;
  select count(*), round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_n, v_h, v_v
    from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> 117 or v_h <> 48454.8 or v_v <> 6325932.24 then
    raise exception 'curva com % semanas, % h e R$ % (esperado 117, 48454.8 e 6325932.24): nada foi gravado', v_n, v_h, v_v;
  end if;
  if abs((select perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 117) - 100) > 0.001 then
    raise exception 'curva de hoje não fecha em 100%%: nada foi gravado';
  end if;
  with t(semana, hh_hoje, valor_hoje, hh_semanal, perc_hh_semanal, perc_hh_acum, valor_semanal, valor_acum, perc_valor_acum) as (values
    (4, 319.6483, 49174.62, 311.3746, 0.640195, 1.178617, 47583.54, 108058.07, 1.687512),
    (5, 246.2873, 30268.80, 239.6684, 0.492765, 1.671381, 28995.94, 137054.01, 2.140334),
    (6, 344.1085, 56848.44, 357.6775, 0.735395, 2.406776, 62906.74, 199960.75, 3.122731),
    (7, 359.5922, 62721.57, 378.9679, 0.779168, 3.185944, 70837.13, 270797.87, 4.228974),
    (8, 359.5922, 62721.57, 378.9679, 0.779168, 3.965112, 70837.13, 341635.00, 5.335218),
    (9, 154.1109, 26880.67, 162.4148, 0.333929, 4.299041, 30358.77, 371993.77, 5.809322),
    (10, 319.8773, 39815.01, 330.5920, 0.679706, 4.978747, 44302.88, 416296.65, 6.501188),
    (11, 576.9286, 70383.21, 595.6793, 1.224732, 6.203479, 78236.98, 494533.62, 7.722992),
    (12, 596.7093, 71198.92, 615.4600, 1.265402, 7.468881, 79052.69, 573586.31, 8.957536),
    (13, 557.6171, 68755.62, 576.3678, 1.185028, 8.653909, 76609.39, 650195.70, 10.153923),
    (14, 377.4350, 52650.62, 393.5070, 0.809061, 9.462970, 59382.42, 709578.12, 11.081282),
    (15, 502.0469, 66623.20, 528.8789, 1.087389, 10.550359, 76799.74, 786377.85, 12.280642),
    (16, 359.9212, 61762.36, 387.0190, 0.795721, 11.346080, 71362.93, 857740.78, 13.395096))
  select count(*) into v_n from t join public.curva_s_semanal_planejada c on c.obra_id = 'sirius60' and c.semana_numero = t.semana
   and abs(c.hh_semanal - t.hh_hoje) < 0.0001 and abs(c.valor_semanal - t.valor_hoje) < 0.01;
  if v_n <> 13 then raise exception 'só % das 13 semanas da curva estão como hoje: nada foi gravado', v_n; end if;
  select count(*) into v_n from public.avanco_fisico_historico where obra_id = 'sirius60';
  if v_n <> 17 then raise exception 'avanco_fisico_historico com % linhas (esperado 17): nada foi gravado', v_n; end if;
  if exists (select 1 from public.avanco_fisico_historico where obra_id = 'sirius60' and origem = 'correcao') then
    raise exception 'já existe medição com origem correcao: nada foi gravado';
  end if;
  with m(id_antigo, codigo, semana, data, competencia, atividade, grupo, p_antigo, p, hh, obs) as (values
    (7, '2.1.2', 3, '2026-08-23', '2026-08', 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)', 2, 10, 9.2436, 1558.1, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 216,04 de 389,53 m³ = 55,4617%; 10% × 0,924362'),
    (9, '2.1.2', 4, '2026-08-30', '2026-08', 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)', 2, 50, 46.2181, 1558.1, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 216,04 de 389,53 m³ = 55,4617%; 50% × 0,924362'),
    (16, '2.1.2', 9, '2026-09-30', '2026-09', 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)', 2, 60, 55.4617, 1558.1, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 216,04 de 389,53 m³ = 55,4617%; 60% × 0,924362'),
    (10, '2.1.6', 4, '2026-08-30', '2026-08', 'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)', 2, 25, 7.0593, 214.6, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 97,16 de 688,17 m² = 14,1186%; 25% × 0,282372'),
    (14, '2.1.6', 6, '2026-09-13', '2026-09', 'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)', 2, 40, 11.2949, 214.6, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 97,16 de 688,17 m² = 14,1186%; 40% × 0,282372'),
    (15, '2.1.6', 9, '2026-09-30', '2026-09', 'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)', 2, 50, 14.1186, 214.6, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 97,16 de 688,17 m² = 14,1186%; 50% × 0,282372'),
    (11, '2.1.7', 4, '2026-08-30', '2026-08', 'Armação Aço - Blocos e Tubulões - (Mão de Obra)', 2, 50, 24.9079, 258.4, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 5.781,07 de 16.578,47 kg = 34,8710%; 50% × 0,498157'),
    (13, '2.1.7', 6, '2026-09-13', '2026-09', 'Armação Aço - Blocos e Tubulões - (Mão de Obra)', 2, 70, 34.8710, 258.4, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 5.781,07 de 16.578,47 kg = 34,8710%; 70% × 0,498157'),
    (12, '2.1.8', 4, '2026-08-30', '2026-08', 'Concretagem 25 MPa - (Bloco e tubulão e vigas) - (Mão de Obra)', 2, 50, 36.7629, 20.3, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 194,77 de 529,80 m³ (por volume) = 36,7629%; 50% × 0,735258'))
  select count(*) into v_n from public.avanco_fisico_historico a join m on m.id_antigo = a.id
   where a.obra_id = 'sirius60' and a.codigo_eap = m.codigo and a.pavimento = 'Fundação' and a.excluido_em is null
     and a.percentual_realizado = m.p_antigo and a.semana_numero = m.semana and a.data_lancamento = m.data::date;
  if v_n <> 9 then raise exception 'só % das 9 medições antigas estão como esperado: nada foi gravado', v_n; end if;
  if (select count(*) from public.avanco_fisico_historico where obra_id = 'sirius60' and pavimento = 'Fundação' and excluido_em is null
        and codigo_eap in ('2.1.2', '2.1.6', '2.1.7', '2.1.8')) <> 9 then
    raise exception 'as linhas 2.1.2, 2.1.6, 2.1.7, 2.1.8 têm medição além das esperadas (alguém mediu depois?): nada foi gravado';
  end if;
  if (select percentual_realizado from public.avanco_fisico_historico where obra_id = 'sirius60' and id = 3 and codigo_eap = '2.1.1'
        and excluido_em is null) is distinct from 100 then
    raise exception '2.1.1 não está em 100%%: nada foi gravado';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'avanco_fisico_historico_origem_check') then
    raise exception 'regra avanco_fisico_historico_origem_check não encontrada: nada foi gravado';
  end if;
  select round(sum(valor_total), 2) into v_v from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if v_v <> 2874508.08 then raise exception 'indireto R$ % (esperado 2874508.08): nada foi gravado', v_v; end if;

  -- ===== BACKUP (tabelas de verdade, RLS, sem permissão para anon/authenticated) =====
  create table public.orcamento_quantidades_bkp_20261014 as
    select * from public.orcamento_planejado where obra_id = 'sirius60' and id in (670, 671, 673);
  create table public.curva_s_quantidades_bkp_20261014 as
    select * from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  create table public.avanco_quantidades_bkp_20261014 as
    select * from public.avanco_fisico_historico where obra_id = 'sirius60';
  alter table public.orcamento_quantidades_bkp_20261014 enable row level security;
  alter table public.curva_s_quantidades_bkp_20261014 enable row level security;
  alter table public.avanco_quantidades_bkp_20261014 enable row level security;
  revoke all on public.orcamento_quantidades_bkp_20261014 from anon, authenticated;
  revoke all on public.curva_s_quantidades_bkp_20261014 from anon, authenticated;
  revoke all on public.avanco_quantidades_bkp_20261014 from anon, authenticated;

  -- ===== ORÇAMENTO (por id) =====
  with x(id, codigo, qtd0, preco0, hh0, qtd, preco, hh) as (values
    (670, '2.1.4', 18102.18, 125267.11, 650.9, 16578.47, 114723.01, 596.1),
    (671, '2.1.5', 389.53, 257091.12, 725.6, 529.8, 349668.0, 986.9),
    (673, '2.1.7', 18102.18, 54306.55, 282.2, 16578.47, 49735.41, 258.4))
  update public.orcamento_planejado o set quantidade = x.qtd, preco_total = x.preco, hh = x.hh
    from x where o.obra_id = 'sirius60' and o.id = x.id;

  -- ===== CURVA PLANEJADA =====
  with t(semana, hh_hoje, valor_hoje, hh_semanal, perc_hh_semanal, perc_hh_acum, valor_semanal, valor_acum, perc_valor_acum) as (values
    (4, 319.6483, 49174.62, 311.3746, 0.640195, 1.178617, 47583.54, 108058.07, 1.687512),
    (5, 246.2873, 30268.80, 239.6684, 0.492765, 1.671381, 28995.94, 137054.01, 2.140334),
    (6, 344.1085, 56848.44, 357.6775, 0.735395, 2.406776, 62906.74, 199960.75, 3.122731),
    (7, 359.5922, 62721.57, 378.9679, 0.779168, 3.185944, 70837.13, 270797.87, 4.228974),
    (8, 359.5922, 62721.57, 378.9679, 0.779168, 3.965112, 70837.13, 341635.00, 5.335218),
    (9, 154.1109, 26880.67, 162.4148, 0.333929, 4.299041, 30358.77, 371993.77, 5.809322),
    (10, 319.8773, 39815.01, 330.5920, 0.679706, 4.978747, 44302.88, 416296.65, 6.501188),
    (11, 576.9286, 70383.21, 595.6793, 1.224732, 6.203479, 78236.98, 494533.62, 7.722992),
    (12, 596.7093, 71198.92, 615.4600, 1.265402, 7.468881, 79052.69, 573586.31, 8.957536),
    (13, 557.6171, 68755.62, 576.3678, 1.185028, 8.653909, 76609.39, 650195.70, 10.153923),
    (14, 377.4350, 52650.62, 393.5070, 0.809061, 9.462970, 59382.42, 709578.12, 11.081282),
    (15, 502.0469, 66623.20, 528.8789, 1.087389, 10.550359, 76799.74, 786377.85, 12.280642),
    (16, 359.9212, 61762.36, 387.0190, 0.795721, 11.346080, 71362.93, 857740.78, 13.395096))
  update public.curva_s_semanal_planejada c
     set hh_semanal = t.hh_semanal, perc_hh_semanal = t.perc_hh_semanal, perc_hh_acum = t.perc_hh_acum,
         valor_semanal = t.valor_semanal, valor_acum = t.valor_acum, perc_valor_acum = t.perc_valor_acum
    from t where c.obra_id = 'sirius60' and c.semana_numero = t.semana;
  -- as semanas fora das janelas mantêm horas e valor, mas o % de cada uma muda porque o total mudou
  update public.curva_s_semanal_planejada c
     set perc_hh_semanal = round(100 * c.hh_semanal / 48637.500000, 6),
         perc_hh_acum = round(100 * (select sum(y.hh_semanal) from public.curva_s_semanal_planejada y
                                      where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / 48637.500000, 6),
         valor_acum = round((select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                             where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero), 2),
         perc_valor_acum = round(100 * (select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                                         where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / 6403393.88, 6)
   where c.obra_id = 'sirius60';

  -- ===== MEDIÇÕES: correções (as antigas não mudam) =====
  alter table public.avanco_fisico_historico drop constraint avanco_fisico_historico_origem_check;
  alter table public.avanco_fisico_historico add constraint avanco_fisico_historico_origem_check
    check (origem in ('tela', 'conversao', 'correcao'));
  -- uma por vez, em ordem (semana, data, id antigo): cada correção fica com id maior que a medição que ela corrige
  with m(id_antigo, codigo, semana, data, competencia, atividade, grupo, p_antigo, p, hh, obs) as (values
    (7, '2.1.2', 3, '2026-08-23', '2026-08', 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)', 2, 10, 9.2436, 1558.1, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 216,04 de 389,53 m³ = 55,4617%; 10% × 0,924362'),
    (9, '2.1.2', 4, '2026-08-30', '2026-08', 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)', 2, 50, 46.2181, 1558.1, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 216,04 de 389,53 m³ = 55,4617%; 50% × 0,924362'),
    (16, '2.1.2', 9, '2026-09-30', '2026-09', 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)', 2, 60, 55.4617, 1558.1, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 216,04 de 389,53 m³ = 55,4617%; 60% × 0,924362'),
    (10, '2.1.6', 4, '2026-08-30', '2026-08', 'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)', 2, 25, 7.0593, 214.6, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 97,16 de 688,17 m² = 14,1186%; 25% × 0,282372'),
    (14, '2.1.6', 6, '2026-09-13', '2026-09', 'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)', 2, 40, 11.2949, 214.6, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 97,16 de 688,17 m² = 14,1186%; 40% × 0,282372'),
    (15, '2.1.6', 9, '2026-09-30', '2026-09', 'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)', 2, 50, 14.1186, 214.6, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 97,16 de 688,17 m² = 14,1186%; 50% × 0,282372'),
    (11, '2.1.7', 4, '2026-08-30', '2026-08', 'Armação Aço - Blocos e Tubulões - (Mão de Obra)', 2, 50, 24.9079, 258.4, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 5.781,07 de 16.578,47 kg = 34,8710%; 50% × 0,498157'),
    (13, '2.1.7', 6, '2026-09-13', '2026-09', 'Armação Aço - Blocos e Tubulões - (Mão de Obra)', 2, 70, 34.8710, 258.4, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 5.781,07 de 16.578,47 kg = 34,8710%; 70% × 0,498157'),
    (12, '2.1.8', 4, '2026-08-30', '2026-08', 'Concretagem 25 MPa - (Bloco e tubulão e vigas) - (Mão de Obra)', 2, 50, 36.7629, 20.3, 'correção da medição (levantamento do Rafael 14/10/2026; pedido 19): real até 30/09 = 194,77 de 529,80 m³ (por volume) = 36,7629%; 50% × 0,735258'))
  insert into public.avanco_fisico_historico (obra_id, codigo_eap, pavimento, percentual_realizado, data_lancamento,
    semana_numero, competencia, atividade_nome, grupo_num, hh_planejado, hh_realizado, medido_por, observacao, origem, origem_ids)
  select 'sirius60', m.codigo, 'Fundação', m.p, m.data::date, m.semana, m.competencia, m.atividade, m.grupo, m.hh,
         round(m.hh * m.p / 100, 2), 'Rafael', m.obs, 'correcao', array[m.id_antigo]::bigint[]
    from m order by m.semana, m.data, m.id_antigo;

  -- ===== TRAVAS DEPOIS (se alguma falhar, nada do que está acima fica gravado) =====
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 333 or v_p <> 7200717.91 or v_h <> 49693.6 then
    raise exception 'orçamento ficaria com % linhas, R$ % e % h (esperado 333, 7200717.91 e 49693.6): nada foi gravado', v_n, v_p, v_h;
  end if;
  select count(*), round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_n, v_h, v_v
    from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> 117 or v_h <> 48637.5 or abs(v_v - 6403393.88) > 0.05 then
    raise exception 'curva ficaria com % semanas, % h e R$ % (esperado 117, 48637.5 e 6403393.88): nada foi gravado', v_n, v_h, v_v;
  end if;
  if abs((select perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 117) - 100) > 0.001
     or abs((select perc_valor_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 117) - 100) > 0.001 then
    raise exception 'curva não fecharia em 100%%: nada foi gravado';
  end if;
  if abs((select perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 9) - 4.299041) > 0.001 then
    raise exception 'planejado acumulado em S09 diferente da prévia (4.2990%%): nada foi gravado';
  end if;
  select count(*) into v_n from public.avanco_fisico_historico where obra_id = 'sirius60';
  if v_n <> 26 then raise exception 'avanco_fisico_historico ficaria com % linhas (esperado 26): nada foi gravado', v_n; end if;
  select count(*) into v_n from public.avanco_fisico_historico c join public.avanco_fisico_historico o on o.id = c.origem_ids[1]
   where c.obra_id = 'sirius60' and c.origem = 'correcao' and c.id > o.id and c.semana_numero = o.semana_numero
     and c.data_lancamento = o.data_lancamento and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento;
  if v_n <> 9 then raise exception 'só % das 9 correções ficariam depois da medição corrigida: nada foi gravado', v_n; end if;
  select count(*) into v_n from (
    select distinct on (codigo_eap) codigo_eap, percentual_realizado, origem from public.avanco_fisico_historico
     where obra_id = 'sirius60' and pavimento = 'Fundação' and excluido_em is null and semana_numero <= 9
       and codigo_eap in ('2.1.2', '2.1.6', '2.1.7', '2.1.8')
     order by codigo_eap, semana_numero desc, data_lancamento desc, id desc) u
   where origem = 'correcao' and percentual_realizado in (55.4617, 14.1186, 34.8710, 36.7629);
  if v_n <> 4 then raise exception 'só % das 4 linhas ficariam com o %% real em S09: nada foi gravado', v_n; end if;

  raise notice 'passo 8 gravado: orçamento, curva e 9 correções de medição';
end $$;

-- ===== CONFERÊNCIA (só leitura; aparece o resultado da última no Supabase) =====
select 'orçamento' as item, o.codigo_eap as linha, b.quantidade || ' → ' || o.quantidade as quantidade,
       b.preco_total || ' → ' || o.preco_total as valor, b.hh || ' → ' || o.hh as horas
  from public.orcamento_planejado o join public.orcamento_quantidades_bkp_20261014 b using (id) where o.obra_id = 'sirius60'
union all
select 'medição', a.codigo_eap || ' S' || a.semana_numero, a.percentual_realizado::text, a.origem, coalesce(a.origem_ids::text, '')
  from public.avanco_fisico_historico a where a.obra_id = 'sirius60' and a.codigo_eap like '2.1.%' and a.excluido_em is null
union all
select 'curva', 'S' || c.semana_numero, b.perc_hh_acum || ' → ' || c.perc_hh_acum, b.valor_acum || ' → ' || c.valor_acum, ''
  from public.curva_s_semanal_planejada c join public.curva_s_quantidades_bkp_20261014 b
    on b.obra_id = c.obra_id and b.semana_numero = c.semana_numero
 where c.obra_id = 'sirius60' and c.semana_numero in (9, 12, 16, 117);
