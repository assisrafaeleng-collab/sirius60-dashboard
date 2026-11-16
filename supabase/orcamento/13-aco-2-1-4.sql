-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 13: aço da fundação 2.1.4 (Rafael 09/11/2026)
--   id 670 2.1.4 Aço Tubulões, Blocos e Vigas Baldrame Inferiores - (Apenas Material), Fundação
--     quantidade 16.394,38 → 15.239,38 kg | valor R$ 113.449,10 → 105.456,51 (−7.992,59) | preço unitário R$ 6,92 (igual)
-- PRÉ-REQUISITO: passo 12 (2.1.2) já rodado. Sem ele, a trava para e nada é gravado.
-- Decisões do Rafael (09/11/2026), iguais às dos passos 11 e 12:
--   - medições NÃO mudam (o aço é material e herda o % da armação 2.1.7, que não muda);
--   - horas NÃO mudam (589,5 h); pagamentos não mudam; a 2.1.7 (armação, MO) NÃO muda (16.394,38 kg).
-- curva_s_semanal_planejada: só o VALOR planejado nas semanas da 2.1.4 (S04 a S15, janela da armação no cronograma;
--   mesmas contas do cronograma.py); horas iguais. Valor da curva R$ 6.004.582,93 → 5.996.590,34.
-- Custo direto R$ 6.801.906,93 → 6.793.914,34; total da obra R$ 9.676.415,01 → 9.668.422,42.
-- Backups (RLS, sem permissão para anon/authenticated): orcamento_214_bkp_20261109, curva_s_214_bkp_20261109.
-- Desfazer: 13-aco-2-1-4-desfazer.sql. Conferência só de leitura: 13-conferir-estado.sql.
-- Um ÚNICO bloco (DO), sem tabela temporária: ou grava tudo, ou nada.
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric;
begin
  -- ===== TRAVAS ANTES =====
  if to_regclass('public.orcamento_214_bkp_20261109') is not null or to_regclass('public.curva_s_214_bkp_20261109') is not null then
    raise exception 'backup já existe: este arquivo já foi rodado? Nada foi gravado';
  end if;
  if not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 668
                   and quantidade = 308.00 and preco_total = 77000.00) then
    raise exception 'o passo 12 (2.1.2 = 308 m³ / R$ 77.000,00) ainda não foi rodado: rode o 12 antes. Nada foi gravado';
  end if;
  if not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 670 and codigo_eap = '2.1.4'
                   and pavimento = 'Fundação' and quantidade = 16394.38 and preco_total = 113449.10 and hh = 589.5
                   and abs(preco_unitario - 6.92) < 0.001) then
    raise exception 'linha 670 (2.1.4) não está como esperado (16.394,38 kg, R$ 113.449,10, 589,5 h): nada foi gravado';
  end if;
  select count(*), round(sum(preco_total), 2) into v_n, v_p from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6801906.93 then
    raise exception 'orçamento com % linhas e R$ % (esperado 339 e 6801906.93): nada foi gravado', v_n, v_p;
  end if;
  select round(sum(valor_total), 2) into v_v from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if v_v <> 2874508.08 then raise exception 'indireto R$ % (esperado 2874508.08): nada foi gravado', v_v; end if;
  select count(*), round(sum(valor_semanal), 2) into v_n, v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> 117 or v_v <> 6004582.93 then
    raise exception 'curva com % semanas e R$ % (esperado 117 e 6004582.93): nada foi gravado', v_n, v_v;
  end if;
  with t(semana, valor_hoje) as (values
    (4, 42007.05), (5, 22414.03), (6, 44278.73), (7, 49222.99), (8, 49222.99), (9, 21095.57),
    (10, 34110.03), (11, 66832.76), (12, 67046.90), (13, 68505.36), (14, 62469.28), (15, 77287.40))
  select count(*) into v_n from t join public.curva_s_semanal_planejada c
    on c.obra_id = 'sirius60' and c.semana_numero = t.semana and abs(c.valor_semanal - t.valor_hoje) < 0.01;
  if v_n <> 12 then raise exception 'só % das 12 semanas (S04 a S15) da curva estão como esperado: nada foi gravado', v_n; end if;

  -- ===== BACKUP =====
  create table public.orcamento_214_bkp_20261109 as
    select * from public.orcamento_planejado where obra_id = 'sirius60' and id = 670;
  create table public.curva_s_214_bkp_20261109 as
    select * from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  alter table public.orcamento_214_bkp_20261109 enable row level security;
  alter table public.curva_s_214_bkp_20261109 enable row level security;
  revoke all on public.orcamento_214_bkp_20261109 from anon, authenticated;
  revoke all on public.curva_s_214_bkp_20261109 from anon, authenticated;

  -- ===== ORÇAMENTO (por id; horas e preço unitário iguais) =====
  update public.orcamento_planejado set quantidade = 15239.38, preco_total = 105456.51
   where obra_id = 'sirius60' and id = 670;

  -- ===== CURVA PLANEJADA: Δ do valor da 2.1.4 na janela S04–S15 (soma −7.992,59); horas não mudam =====
  with d(semana, dv) as (values
    (4, -841.31), (5, -673.06), (6, -785.24), (7, -785.24), (8, -785.24), (9, -336.53),
    (10, -434.23), (11, -759.91), (12, -759.91), (13, -759.91), (14, -651.35), (15, -420.66))
  update public.curva_s_semanal_planejada c set valor_semanal = round(c.valor_semanal + d.dv, 2)
    from d where c.obra_id = 'sirius60' and c.semana_numero = d.semana;
  update public.curva_s_semanal_planejada c
     set valor_acum = round((select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                             where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero), 2),
         perc_valor_acum = round(100 * (select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                                         where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / 5996590.34, 6)
   where c.obra_id = 'sirius60';

  -- ===== TRAVAS DEPOIS =====
  select count(*), round(sum(preco_total), 2) into v_n, v_p from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6793914.34 then
    raise exception 'orçamento ficaria com % linhas e R$ % (esperado 339 e 6793914.34): nada foi gravado', v_n, v_p;
  end if;
  select round(sum(valor_semanal), 2), round(sum(hh_semanal), 1) into v_v, v_h from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_v <> 5996590.34 then raise exception 'curva ficaria com R$ % (esperado 5996590.34): nada foi gravado', v_v; end if;
  if v_h <> (select round(sum(hh_semanal), 1) from public.curva_s_214_bkp_20261109) then
    raise exception 'as horas da curva mudariam: nada foi gravado';
  end if;
  if abs((select perc_valor_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 117) - 100) > 0.001 then
    raise exception 'curva (valor) não fecharia em 100%%: nada foi gravado';
  end if;
  raise notice 'passo 13 gravado: 2.1.4 = 15.239,38 kg / R$ 105.456,51; direto R$ 6.793.914,34; curva R$ 5.996.590,34';
end $$;
