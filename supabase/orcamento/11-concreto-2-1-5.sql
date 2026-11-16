-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 11: concreto da fundação 2.1.5 (Rafael 09/11/2026)
-- MUDANÇA DE PROJETO: o volume de concreto da fundação diminuiu.
--   id 671 2.1.5 Concreto Bombeado fck 25 MPa (Fundação, material)
--     quantidade 362,21 → 326,20 m³ | valor R$ 239.061,64 → 215.292,40 (−23.769,24) | preço unitário R$ 660,00 (igual)
-- Decisões do Rafael (09/11/2026):
--   - a medição NÃO muda: o % concluído da 2.1.8 (concretagem, de onde a 2.1.5 herda o avanço) continua o mesmo;
--     só o valor agregado da 2.1.5 (% × orçado) e o saldo da linha diminuem;
--   - as horas NÃO mudam (674,7 h): o avanço físico (horas) fica igual.
-- curva_s_semanal_planejada: só o VALOR planejado nas semanas da 2.1.5 (S06 a S16, a janela da concretagem da fundação; mesmas
--   contas do cronograma.py); horas iguais. Valor da curva R$ 6.037.152,17 → 6.013.382,93.
-- Custo direto R$ 6.834.476,17 → 6.810.706,93; total da obra R$ 9.708.984,25 → 9.685.215,01.
-- Backups (RLS, sem permissão para anon/authenticated): orcamento_215_bkp_20261109, curva_s_215_bkp_20261109.
-- Desfazer: 11-concreto-2-1-5-desfazer.sql. Conferência só de leitura: 11-conferir-estado.sql.
-- Um ÚNICO bloco (DO), sem tabela temporária: ou grava tudo, ou nada.
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric;
begin
  -- ===== TRAVAS ANTES =====
  if to_regclass('public.orcamento_215_bkp_20261109') is not null or to_regclass('public.curva_s_215_bkp_20261109') is not null then
    raise exception 'backup já existe: este arquivo já foi rodado? Nada foi gravado';
  end if;
  if not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 671 and codigo_eap = '2.1.5'
                   and pavimento = 'Fundação' and quantidade = 362.21 and preco_total = 239061.64 and hh = 674.7
                   and preco_unitario = 660) then
    raise exception 'linha 671 (2.1.5) não está como esperado (362,21 m³, R$ 239.061,64, 674,7 h): nada foi gravado';
  end if;
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6834476.17 then
    raise exception 'orçamento com % linhas e R$ % (esperado 339 e 6834476.17): nada foi gravado', v_n, v_p;
  end if;
  select round(sum(valor_total), 2) into v_v from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if v_v <> 2874508.08 then raise exception 'indireto R$ % (esperado 2874508.08): nada foi gravado', v_v; end if;
  select count(*), round(sum(valor_semanal), 2) into v_n, v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> 117 or v_v <> 6037152.17 then
    raise exception 'curva com % semanas e R$ % (esperado 117 e 6037152.17): nada foi gravado', v_n, v_v;
  end if;
  with t(semana, valor_hoje) as (values
    (6, 47128.07), (7, 52600.54), (8, 52600.54), (9, 22543.09), (10, 35977.80), (11, 70101.35),
    (12, 70315.49), (13, 71553.18), (14, 64513.95), (15, 80104.50), (16, 74638.70))
  select count(*) into v_n from t join public.curva_s_semanal_planejada c
    on c.obra_id = 'sirius60' and c.semana_numero = t.semana and abs(c.valor_semanal - t.valor_hoje) < 0.01;
  if v_n <> 11 then raise exception 'só % das 11 semanas (S06 a S16) da curva estão como esperado: nada foi gravado', v_n; end if;

  -- ===== BACKUP =====
  create table public.orcamento_215_bkp_20261109 as
    select * from public.orcamento_planejado where obra_id = 'sirius60' and id = 671;
  create table public.curva_s_215_bkp_20261109 as
    select * from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  alter table public.orcamento_215_bkp_20261109 enable row level security;
  alter table public.curva_s_215_bkp_20261109 enable row level security;
  revoke all on public.orcamento_215_bkp_20261109 from anon, authenticated;
  revoke all on public.curva_s_215_bkp_20261109 from anon, authenticated;

  -- ===== ORÇAMENTO (por id; horas e preço unitário iguais) =====
  update public.orcamento_planejado set quantidade = 326.20, preco_total = 215292.40
   where obra_id = 'sirius60' and id = 671;

  -- ===== CURVA PLANEJADA: Δ do valor da 2.1.5 na janela S06–S16 (soma −23.769,24); horas não mudam =====
  with d(semana, dv) as (values
    (6, -1936.75), (7, -2464.96), (8, -2464.96), (9, -1056.41), (10, -1363.11), (11, -2385.44),
    (12, -2385.44), (13, -2385.44), (14, -2044.67), (15, -2817.10), (16, -2464.96))
  update public.curva_s_semanal_planejada c set valor_semanal = round(c.valor_semanal + d.dv, 2)
    from d where c.obra_id = 'sirius60' and c.semana_numero = d.semana;
  update public.curva_s_semanal_planejada c
     set valor_acum = round((select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                             where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero), 2),
         perc_valor_acum = round(100 * (select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                                         where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / 6013382.93, 6)
   where c.obra_id = 'sirius60';

  -- ===== TRAVAS DEPOIS =====
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6810706.93 then
    raise exception 'orçamento ficaria com % linhas e R$ % (esperado 339 e 6810706.93): nada foi gravado', v_n, v_p;
  end if;
  select round(sum(valor_semanal), 2), round(sum(hh_semanal), 1) into v_v, v_h from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_v <> 6013382.93 then raise exception 'curva ficaria com R$ % (esperado 6013382.93): nada foi gravado', v_v; end if;
  if v_h <> (select round(sum(hh_semanal), 1) from public.curva_s_215_bkp_20261109) then
    raise exception 'as horas da curva mudariam: nada foi gravado';
  end if;
  if abs((select perc_valor_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 117) - 100) > 0.001 then
    raise exception 'curva (valor) não fecharia em 100%%: nada foi gravado';
  end if;
  raise notice 'passo 11 gravado: 2.1.5 = 326,20 m³ / R$ 215.292,40; direto R$ 6.810.706,93; curva R$ 6.013.382,93';
end $$;
