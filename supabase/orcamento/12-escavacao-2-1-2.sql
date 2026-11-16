-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 12: escavação manual da fundação 2.1.2 (Rafael 09/11/2026)
--   id 668 2.1.2 Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra), Fundação
--     quantidade 343,20 → 308,00 m³ | valor R$ 85.800,00 → 77.000,00 (−8.800,00) | preço unitário R$ 250,00 (igual)
-- Decisões do Rafael (09/11/2026), iguais às do passo 11:
--   - medições NÃO mudam: o % concluído da 2.1.2 fica o mesmo; só o valor agregado (% × orçado) e o saldo da linha caem;
--   - horas NÃO mudam (1.372,8 h): o avanço físico fica igual; pagamentos não mudam.
-- curva_s_semanal_planejada: só o VALOR planejado nas semanas da 2.1.2 (S03 a S13, atividade de escavação do cronograma;
--   mesmas contas do cronograma.py); horas iguais. Valor da curva R$ 6.013.382,93 → 6.004.582,93.
-- Custo direto R$ 6.810.706,93 → 6.801.906,93; total da obra R$ 9.685.215,01 → 9.676.415,01.
-- Backups (RLS, sem permissão para anon/authenticated): orcamento_212_bkp_20261109, curva_s_212_bkp_20261109.
-- Desfazer: 12-escavacao-2-1-2-desfazer.sql. Conferência só de leitura: 12-conferir-estado.sql.
-- Um ÚNICO bloco (DO), sem tabela temporária: ou grava tudo, ou nada.
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric;
begin
  -- ===== TRAVAS ANTES =====
  if to_regclass('public.orcamento_212_bkp_20261109') is not null or to_regclass('public.curva_s_212_bkp_20261109') is not null then
    raise exception 'backup já existe: este arquivo já foi rodado? Nada foi gravado';
  end if;
  if not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 668 and codigo_eap = '2.1.2'
                   and pavimento = 'Fundação' and quantidade = 343.2 and preco_total = 85800 and hh = 1372.8
                   and preco_unitario = 250) then
    raise exception 'linha 668 (2.1.2) não está como esperado (343,20 m³, R$ 85.800,00, 1.372,8 h): nada foi gravado';
  end if;
  select count(*), round(sum(preco_total), 2) into v_n, v_p from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6810706.93 then
    raise exception 'orçamento com % linhas e R$ % (esperado 339 e 6810706.93): nada foi gravado', v_n, v_p;
  end if;
  select round(sum(valor_total), 2) into v_v from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if v_v <> 2874508.08 then raise exception 'indireto R$ % (esperado 2874508.08): nada foi gravado', v_v; end if;
  select count(*), round(sum(valor_semanal), 2) into v_n, v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> 117 or v_v <> 6013382.93 then
    raise exception 'curva com % semanas e R$ % (esperado 117 e 6013382.93): nada foi gravado', v_n, v_v;
  end if;
  with t(semana, valor_hoje) as (values
    (3, 21497.11), (4, 43085.98), (5, 23196.25), (6, 45191.32), (7, 50135.58), (8, 50135.58),
    (9, 21486.68), (10, 34614.69), (11, 67715.91), (12, 67930.05), (13, 69167.74))
  select count(*) into v_n from t join public.curva_s_semanal_planejada c
    on c.obra_id = 'sirius60' and c.semana_numero = t.semana and abs(c.valor_semanal - t.valor_hoje) < 0.01;
  if v_n <> 11 then raise exception 'só % das 11 semanas (S03 a S13) da curva estão como esperado: nada foi gravado', v_n; end if;

  -- ===== BACKUP =====
  create table public.orcamento_212_bkp_20261109 as
    select * from public.orcamento_planejado where obra_id = 'sirius60' and id = 668;
  create table public.curva_s_212_bkp_20261109 as
    select * from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  alter table public.orcamento_212_bkp_20261109 enable row level security;
  alter table public.curva_s_212_bkp_20261109 enable row level security;
  revoke all on public.orcamento_212_bkp_20261109 from anon, authenticated;
  revoke all on public.curva_s_212_bkp_20261109 from anon, authenticated;

  -- ===== ORÇAMENTO (por id; horas e preço unitário iguais) =====
  update public.orcamento_planejado set quantidade = 308.00, preco_total = 77000.00
   where obra_id = 'sirius60' and id = 668;

  -- ===== CURVA PLANEJADA: Δ do valor da 2.1.2 na janela S03–S13 (soma −8.800,00); horas não mudam =====
  with d(semana, dv) as (values
    (3, -876.63), (4, -1078.93), (5, -782.22), (6, -912.59), (7, -912.59), (8, -912.59),
    (9, -391.11), (10, -504.66), (11, -883.15), (12, -883.15), (13, -662.38))
  update public.curva_s_semanal_planejada c set valor_semanal = round(c.valor_semanal + d.dv, 2)
    from d where c.obra_id = 'sirius60' and c.semana_numero = d.semana;
  update public.curva_s_semanal_planejada c
     set valor_acum = round((select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                             where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero), 2),
         perc_valor_acum = round(100 * (select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                                         where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / 6004582.93, 6)
   where c.obra_id = 'sirius60';

  -- ===== TRAVAS DEPOIS =====
  select count(*), round(sum(preco_total), 2) into v_n, v_p from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6801906.93 then
    raise exception 'orçamento ficaria com % linhas e R$ % (esperado 339 e 6801906.93): nada foi gravado', v_n, v_p;
  end if;
  select round(sum(valor_semanal), 2), round(sum(hh_semanal), 1) into v_v, v_h from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_v <> 6004582.93 then raise exception 'curva ficaria com R$ % (esperado 6004582.93): nada foi gravado', v_v; end if;
  if v_h <> (select round(sum(hh_semanal), 1) from public.curva_s_212_bkp_20261109) then
    raise exception 'as horas da curva mudariam: nada foi gravado';
  end if;
  if abs((select perc_valor_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 117) - 100) > 0.001 then
    raise exception 'curva (valor) não fecharia em 100%%: nada foi gravado';
  end if;
  raise notice 'passo 12 gravado: 2.1.2 = 308,00 m³ / R$ 77.000,00; direto R$ 6.801.906,93; curva R$ 6.004.582,93';
end $$;
