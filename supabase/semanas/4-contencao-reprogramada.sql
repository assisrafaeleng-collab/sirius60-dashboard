-- =====================================================================
-- Sirius 60 — SEMANAS, PASSO 4: contenção 15.1.4 (Externo) reprogramada — decisão do Rafael, 09/10/2026 (pedido 14B)
-- Rodar no SQL Editor (arquivo inteiro). Desfazer: 4-contencao-reprogramada-desfazer.sql
--
-- A contenção não foi executada. O início vai para daqui a 1 mês: S16 (09/11/2026), com a MESMA duração
-- (11 semanas) e as MESMAS horas (150 h) e valor (R$ 200.000,00):
--   orcamento_planejado id 973: semana_inicio/fim S2–S12 → S16–S26;
--   curva_s_semanal_planejada: a parte da 15.1.4 sai das semanas antigas e é espalhada pelos dias de S16–S26
--   (mesma conta do automacao/cronograma.py); 25 semanas mudam (horas, %, valor e acumulados).
-- Travas: total de horas planejadas (48,454.8 h) e valor (R$ 6,325,932.24) iguais antes e depois; as semanas
-- alteradas conferem com o valor de hoje antes da troca. Backups: curva_s_contencao_bkp_20261009,
-- orcamento_contencao_bkp_20261009 (RLS, sem permissão para anon/authenticated).
-- Planejado acumulado da obra (horas): S11 6,36% → 6,07%; S16 11,29% → 11,01%; S23 (fim de 2026) 14,90% → 14,82%.
-- =====================================================================
begin;

-- (semana, horas de hoje [trava], horas novas, % semanal, % acumulado, valor semanal, valor acumulado, % valor acum.)
create temporary table _curva (semana int primary key, hh_hoje numeric, hh_semanal numeric, perc_hh_semanal numeric,
  perc_hh_acum numeric, valor_semanal numeric, valor_acum numeric, perc_valor_acum numeric) on commit drop;
insert into _curva values
  (2, 62.2483, 46.7311, 0.096443, 0.192885, 18911.78, 37823.56, 0.597913),
  (3, 184.5050, 168.4130, 0.347568, 0.540453, 22650.97, 60474.54, 0.955979),
  (4, 338.0391, 319.6483, 0.659683, 1.200136, 49174.62, 109649.15, 1.733328),
  (5, 259.6206, 246.2873, 0.508283, 1.708418, 30268.80, 139917.96, 2.211816),
  (6, 359.6641, 344.1085, 0.710164, 2.418583, 56848.44, 196766.39, 3.110472),
  (7, 375.1478, 359.5922, 0.742119, 3.160702, 62721.57, 259487.96, 4.101972),
  (8, 375.1478, 359.5922, 0.742119, 3.902820, 62721.57, 322209.54, 5.093471),
  (9, 160.7776, 154.1109, 0.318050, 4.220871, 26880.67, 349090.21, 5.518399),
  (10, 328.4795, 319.8773, 0.660156, 4.881027, 39815.01, 388905.21, 6.147793),
  (11, 591.9824, 576.9286, 1.190653, 6.071680, 70383.21, 459288.43, 7.260407),
  (12, 606.3867, 596.7093, 1.231476, 7.303156, 71198.92, 530487.35, 8.385916),
  (13, 557.6171, 557.6171, 1.150799, 8.453955, 68755.62, 599242.97, 9.472801),
  (14, 377.4350, 377.4350, 0.778942, 9.232897, 52650.62, 651893.58, 10.305099),
  (15, 502.0469, 502.0469, 1.036114, 10.269011, 66623.20, 718516.79, 11.358275),
  (16, 344.9212, 359.9212, 0.742798, 11.011809, 61762.36, 780279.15, 12.334612),
  (17, 226.8047, 241.8047, 0.499032, 11.510841, 26318.84, 806597.99, 12.750659),
  (18, 259.2053, 276.3482, 0.570322, 12.081162, 30078.67, 836676.67, 13.226140),
  (19, 137.8413, 150.6984, 0.311008, 12.392170, 32239.24, 868915.91, 13.735776),
  (20, 263.5841, 278.5841, 0.574936, 12.967107, 52010.42, 920926.33, 14.557954),
  (21, 263.5841, 278.5841, 0.574936, 13.542042, 52010.42, 972936.76, 15.380132),
  (22, 351.8510, 366.8510, 0.757100, 14.299142, 64301.42, 1037238.18, 16.396606),
  (23, 244.7709, 253.3423, 0.522843, 14.821984, 42830.64, 1080068.82, 17.073670),
  (24, 143.9249, 150.3535, 0.310296, 15.132281, 27370.66, 1107439.48, 17.506344),
  (25, 335.8247, 350.8247, 0.724025, 15.856305, 63864.88, 1171304.36, 18.515917),
  (26, 321.3532, 336.3532, 0.694159, 16.550464, 62109.00, 1233413.35, 19.497733);

do $$
declare h numeric; v numeric; k int;
begin
  if to_regclass('public.curva_s_contencao_bkp_20261009') is not null or to_regclass('public.orcamento_contencao_bkp_20261009') is not null then
    raise exception 'backup já existe: este arquivo já foi rodado? Nada foi feito';
  end if;
  if not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 973 and codigo_eap = '15.1.4'
                  and pavimento = 'Externo' and semana_inicio = 2 and semana_fim = 12 and round(hh, 1) = 150.0) then
    raise exception '15.1.4 não está como esperado (id 973, S2–S12, 150 h): nada foi feito';
  end if;
  select round(sum(hh_semanal), 1), round(sum(valor_semanal), 2), count(*) into h, v, k
    from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if k <> 117 or h <> 48454.8 or v <> 6325932.24 then
    raise exception 'curva com % semanas, % h e R$ % (esperado 117, 48454.8 e 6325932.24): nada foi feito', k, h, v;
  end if;
  select count(*) into k from _curva t join public.curva_s_semanal_planejada c
    on c.obra_id = 'sirius60' and c.semana_numero = t.semana and abs(c.hh_semanal - t.hh_hoje) < 0.0001;
  if k <> 25 then raise exception 'só % das 25 semanas estão como hoje: nada foi feito', k; end if;
end $$;

create table public.curva_s_contencao_bkp_20261009 as
  select * from public.curva_s_semanal_planejada where obra_id = 'sirius60';
create table public.orcamento_contencao_bkp_20261009 as
  select id, codigo_eap, pavimento, semana_inicio, semana_fim from public.orcamento_planejado where obra_id = 'sirius60' and id = 973;
alter table public.curva_s_contencao_bkp_20261009 enable row level security;
alter table public.orcamento_contencao_bkp_20261009 enable row level security;
revoke all on public.curva_s_contencao_bkp_20261009 from anon, authenticated;
revoke all on public.orcamento_contencao_bkp_20261009 from anon, authenticated;

update public.orcamento_planejado set semana_inicio = 16, semana_fim = 26
 where obra_id = 'sirius60' and id = 973;
update public.curva_s_semanal_planejada c
   set hh_semanal = t.hh_semanal, perc_hh_semanal = t.perc_hh_semanal, perc_hh_acum = t.perc_hh_acum,
       valor_semanal = t.valor_semanal, valor_acum = t.valor_acum, perc_valor_acum = t.perc_valor_acum
  from _curva t where c.obra_id = 'sirius60' and c.semana_numero = t.semana;

do $$
declare h numeric; v numeric;
begin
  select round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into h, v
    from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if h <> 48454.8 or abs(v - 6325932.24) > 0.05 then
    raise exception 'total da curva mudou (% h, R$ %): nada foi gravado', h, v;
  end if;
  if abs((select perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 117) - 100) > 0.001 then
    raise exception 'curva não fecha em 100%%: nada foi gravado';
  end if;
end $$;

commit;

-- Conferência: planejado acumulado em S11, S16 e S23 (fim de 2026), antes (backup) e depois
select c.semana_numero, b.perc_hh_acum as antes, c.perc_hh_acum as depois, b.valor_acum as valor_antes, c.valor_acum as valor_depois
  from public.curva_s_semanal_planejada c join public.curva_s_contencao_bkp_20261009 b
    on b.obra_id = c.obra_id and b.semana_numero = c.semana_numero
 where c.obra_id = 'sirius60' and c.semana_numero in (11, 16, 23) order by 1;
