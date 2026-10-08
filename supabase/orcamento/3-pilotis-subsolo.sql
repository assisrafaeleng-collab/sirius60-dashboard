-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 3: alvenaria PILOTIS × SUBSOLO (decisão do Rafael, 08/10/2026)
-- Rodar no SQL Editor (arquivo inteiro). Desfazer: 3-pilotis-subsolo-desfazer.sql
--
-- O Pilotis tem mais alvenaria; o orçamento estava trocado e o cronograma está certo. Os CÓDIGOS ficam com o
-- subgrupo (4.1.x = Pilotis, 4.2.x = Subsolo); os VALORES trocam de linha, aos pares:
--   4.1.1 Pilotis (id 747) ↔ 4.2.1 Subsolo (id 750)  alvenaria: Pilotis fica com 143,26 m²; Subsolo com 92,41 m²
--   4.1.2 Pilotis (id 748) ↔ 4.2.2 Subsolo (id 751)  verga: Pilotis 5,25 m³; Subsolo 3,024 m³
--   4.1.3 Pilotis (id 749) ↔ 4.2.3 Subsolo (id 752)  encunhamento: Pilotis 47,75 m (R$ 666,64); Subsolo 30,80 m (R$ 430,02)
-- Trocam: quantidade, preço unitário, preço total e semanas. As HORAS NÃO trocam (decisão do Rafael, 08/10/2026).
-- O total do orçamento não muda (334 linhas, 7.551.387,47). Nenhum custo, medição ou contas a pagar usa 4.1.x/4.2.x
-- (conferido em 08/10/2026).
--
-- HORAS (decisão do Rafael, 08/10/2026: NÃO trocar): as horas de hoje no banco JÁ batem com o cronograma por
-- pavimento (Pilotis 4.1.x = 130,9 h + 8,1 h do encunhamento = 139,0 h = "Alvenaria PILOTIS" do cronograma;
-- Subsolo 4.2.x = 89,6 h = "Alvenaria SUBSOLO"). Por isso este arquivo não altera a coluna hh.
-- (As semanas trocam aqui, mas o 2-semanas-orcamento.sql regrava as semanas pela ligação com o cronograma.)
-- =====================================================================
do $$
declare
  n int; total numeric;
begin
  -- 0) Trava: as 6 linhas exatamente como em 08/10/2026
  if (select count(*) from public.orcamento_planejado where obra_id = 'sirius60' and (
        (id = 747 and codigo_eap = '4.1.1' and pavimento = 'Pilotis' and quantidade = 92.41  and preco_total = 8967.66)
     or (id = 748 and codigo_eap = '4.1.2' and pavimento = 'Pilotis' and quantidade = 3.02   and preco_total = 1443.51)
     or (id = 749 and codigo_eap = '4.1.3' and pavimento = 'Pilotis' and quantidade = 30.8   and preco_total = 430.02)
     or (id = 750 and codigo_eap = '4.2.1' and pavimento = 'Subsolo' and quantidade = 143.26 and preco_total = 13901.95)
     or (id = 751 and codigo_eap = '4.2.2' and pavimento = 'Subsolo' and quantidade = 5.25   and preco_total = 2506.09)
     or (id = 752 and codigo_eap = '4.2.3' and pavimento = 'Subsolo' and quantidade = 47.75  and preco_total = 666.64))) <> 6 then
    raise exception 'as linhas 4.1.x/4.2.x não estão como em 08/10/2026 (já trocadas?): nada foi feito';
  end if;
  if to_regclass('public.orcamento_pilotis_subsolo_bkp_20261008') is not null then
    raise exception 'o backup orcamento_pilotis_subsolo_bkp_20261008 já existe: este arquivo já foi rodado?';
  end if;
  if exists (select 1 from public.custos_lancamentos where obra_id = 'sirius60' and codigo_eap ~ '^4\.[12]\.')
     or exists (select 1 from public.avanco_fisico_realizado where obra_id = 'sirius60' and codigo_eap ~ '^4\.[12]\.') then
    raise exception 'há custo ou medição em 4.1.x/4.2.x: confira antes de trocar';
  end if;

  -- 1) Backup das 6 linhas
  create table public.orcamento_pilotis_subsolo_bkp_20261008 as
    select * from public.orcamento_planejado where id in (747, 748, 749, 750, 751, 752);
  alter table public.orcamento_pilotis_subsolo_bkp_20261008 enable row level security;
  revoke all on public.orcamento_pilotis_subsolo_bkp_20261008 from anon, authenticated;

  -- 2) Troca aos pares, a partir do backup (a linha recebe os valores da parceira; hh fica como está)
  update public.orcamento_planejado as o
     set quantidade     = p.quantidade,
         preco_unitario = p.preco_unitario,
         preco_total    = p.preco_total,
         semana_inicio  = p.semana_inicio,
         semana_fim     = p.semana_fim
    from (values (747, 750), (750, 747), (748, 751), (751, 748), (749, 752), (752, 749)) as par(id, parceira)
    join public.orcamento_pilotis_subsolo_bkp_20261008 as p on p.id = par.parceira
   where o.id = par.id and o.obra_id = 'sirius60';

  -- 3) Trava final
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'orçamento mudou de total (% linhas, %): nada foi gravado', n, total;
  end if;
  if (select count(*) from public.orcamento_planejado where obra_id = 'sirius60' and (
        (id = 747 and pavimento = 'Pilotis' and quantidade = 143.26 and preco_total = 13901.95)
     or (id = 748 and pavimento = 'Pilotis' and quantidade = 5.25   and preco_total = 2506.09)
     or (id = 749 and pavimento = 'Pilotis' and quantidade = 47.75  and preco_total = 666.64)
     or (id = 750 and pavimento = 'Subsolo' and quantidade = 92.41  and preco_total = 8967.66)
     or (id = 751 and pavimento = 'Subsolo' and quantidade = 3.02   and preco_total = 1443.51)
     or (id = 752 and pavimento = 'Subsolo' and quantidade = 30.8   and preco_total = 430.02))) <> 6 then
    raise exception 'a troca não ficou como esperado: nada foi gravado';
  end if;
  if exists (select 1 from public.orcamento_planejado as o
               join public.orcamento_pilotis_subsolo_bkp_20261008 as b on b.id = o.id
              where o.hh is distinct from b.hh) then
    raise exception 'as horas mudaram (não deviam): nada foi gravado';
  end if;
  raise notice 'troca feita (horas mantidas)';
end $$;

-- Conferência: Pilotis 4.1.x = 143,26 m² / 5,25 m³ / 47,75 m; Subsolo 4.2.x = 92,41 m² / 3,02 m³ / 30,80 m
select id, codigo_eap, pavimento, descricao, quantidade, unidade, preco_total, hh, semana_inicio, semana_fim
  from public.orcamento_planejado where id in (747, 748, 749, 750, 751, 752) order by codigo_eap;
select count(*) as linhas, sum(preco_total) as direto from public.orcamento_planejado where obra_id = 'sirius60';
