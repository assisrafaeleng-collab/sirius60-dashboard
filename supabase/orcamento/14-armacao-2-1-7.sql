-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 14: armação da fundação 2.1.7 acompanha o aço 2.1.4 (Rafael 09/11/2026)
--   id 673 2.1.7 Armação Aço - Tubulões, Blocos e Vigas Baldrame - (Mão de Obra), Fundação
--     quantidade 16.394,38 → 15.239,38 kg (= 2.1.4) | valor R$ 49.183,13 → 45.718,14 (−3.464,99) | preço unitário R$ 3,00 (igual)
-- PRÉ-REQUISITO: passo 13 (2.1.4) já rodado. Sem ele, a trava para e nada é gravado.
-- Decisões do Rafael (09/11/2026), iguais às dos passos 11 a 13:
--   - medições NÃO mudam: o % concluído da 2.1.7 fica o mesmo; só o valor agregado (% × orçado) e o saldo caem;
--   - horas NÃO mudam (255,5 h): o avanço físico fica igual; pagamentos não mudam.
-- curva_s_semanal_planejada: só o VALOR planejado nas semanas da 2.1.7 (S04 a S15, janela da armação; mesmas contas do
--   cronograma.py); horas iguais. Valor da curva R$ 5.996.590,34 → 5.993.125,35.
-- Custo direto R$ 6.793.914,34 → 6.790.449,35; total da obra R$ 9.668.422,42 → 9.664.957,43.
-- Backups (RLS, sem permissão para anon/authenticated): orcamento_217_bkp_20261109, curva_s_217_bkp_20261109.
-- Desfazer: 14-armacao-2-1-7-desfazer.sql. Conferência só de leitura: 14-conferir-estado.sql.
-- Um ÚNICO bloco (DO), sem tabela temporária: ou grava tudo, ou nada.
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric;
begin
  -- ===== TRAVAS ANTES =====
  if to_regclass('public.orcamento_217_bkp_20261109') is not null or to_regclass('public.curva_s_217_bkp_20261109') is not null then
    raise exception 'backup já existe: este arquivo já foi rodado? Nada foi gravado';
  end if;
  if not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 670
                   and quantidade = 15239.38 and preco_total = 105456.51) then
    raise exception 'o passo 13 (2.1.4 = 15.239,38 kg) ainda não foi rodado: rode o 13 antes. Nada foi gravado';
  end if;
  if not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 673 and codigo_eap = '2.1.7'
                   and pavimento = 'Fundação' and quantidade = 16394.38 and preco_total = 49183.13 and hh = 255.5
                   and abs(preco_unitario - 3) < 0.001) then
    raise exception 'linha 673 (2.1.7) não está como esperado (16.394,38 kg, R$ 49.183,13, 255,5 h): nada foi gravado';
  end if;
  select count(*), round(sum(preco_total), 2) into v_n, v_p from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6793914.34 then
    raise exception 'orçamento com % linhas e R$ % (esperado 339 e 6793914.34): nada foi gravado', v_n, v_p;
  end if;
  select round(sum(valor_total), 2) into v_v from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if v_v <> 2874508.08 then raise exception 'indireto R$ % (esperado 2874508.08): nada foi gravado', v_v; end if;
  select count(*), round(sum(valor_semanal), 2) into v_n, v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> 117 or v_v <> 5996590.34 then
    raise exception 'curva com % semanas e R$ % (esperado 117 e 5996590.34): nada foi gravado', v_n, v_v;
  end if;
  with t(semana, valor_hoje) as (values
    (4, 41165.74), (5, 21740.97), (6, 43493.49), (7, 48437.75), (8, 48437.75), (9, 20759.04),
    (10, 33675.80), (11, 66072.85), (12, 66286.99), (13, 67745.45), (14, 61817.93), (15, 76866.74))
  select count(*) into v_n from t join public.curva_s_semanal_planejada c
    on c.obra_id = 'sirius60' and c.semana_numero = t.semana and abs(c.valor_semanal - t.valor_hoje) < 0.01;
  if v_n <> 12 then raise exception 'só % das 12 semanas (S04 a S15) da curva estão como esperado: nada foi gravado', v_n; end if;

  -- ===== BACKUP =====
  create table public.orcamento_217_bkp_20261109 as
    select * from public.orcamento_planejado where obra_id = 'sirius60' and id = 673;
  create table public.curva_s_217_bkp_20261109 as
    select * from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  alter table public.orcamento_217_bkp_20261109 enable row level security;
  alter table public.curva_s_217_bkp_20261109 enable row level security;
  revoke all on public.orcamento_217_bkp_20261109 from anon, authenticated;
  revoke all on public.curva_s_217_bkp_20261109 from anon, authenticated;

  -- ===== ORÇAMENTO (por id; horas e preço unitário iguais) =====
  update public.orcamento_planejado set quantidade = 15239.38, preco_total = 45718.14
   where obra_id = 'sirius60' and id = 673;

  -- ===== CURVA PLANEJADA: Δ do valor da 2.1.7 na janela S04–S15 (soma −3.464,99); horas não mudam =====
  with d(semana, dv) as (values
    (4, -364.73), (5, -291.79), (6, -340.42), (7, -340.42), (8, -340.42), (9, -145.89),
    (10, -188.25), (11, -329.44), (12, -329.44), (13, -329.44), (14, -282.38), (15, -182.37))
  update public.curva_s_semanal_planejada c set valor_semanal = round(c.valor_semanal + d.dv, 2)
    from d where c.obra_id = 'sirius60' and c.semana_numero = d.semana;
  update public.curva_s_semanal_planejada c
     set valor_acum = round((select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                             where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero), 2),
         perc_valor_acum = round(100 * (select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                                         where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / 5993125.35, 6)
   where c.obra_id = 'sirius60';

  -- ===== TRAVAS DEPOIS =====
  select count(*), round(sum(preco_total), 2) into v_n, v_p from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6790449.35 then
    raise exception 'orçamento ficaria com % linhas e R$ % (esperado 339 e 6790449.35): nada foi gravado', v_n, v_p;
  end if;
  select round(sum(valor_semanal), 2), round(sum(hh_semanal), 1) into v_v, v_h from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_v <> 5993125.35 then raise exception 'curva ficaria com R$ % (esperado 5993125.35): nada foi gravado', v_v; end if;
  if v_h <> (select round(sum(hh_semanal), 1) from public.curva_s_217_bkp_20261109) then
    raise exception 'as horas da curva mudariam: nada foi gravado';
  end if;
  if abs((select perc_valor_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 117) - 100) > 0.001 then
    raise exception 'curva (valor) não fecharia em 100%%: nada foi gravado';
  end if;
  raise notice 'passo 14 gravado: 2.1.7 = 15.239,38 kg / R$ 45.718,14; direto R$ 6.790.449,35; curva R$ 5.993.125,35';
end $$;
