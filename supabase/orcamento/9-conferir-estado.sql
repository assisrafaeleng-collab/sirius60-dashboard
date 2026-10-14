-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- SÓ LEITURA (não grava nada): estado do banco em relação ao passo 9 (pedido 20, Pilotis no grupo 3).
-- Esperado ANTES: 333 linhas · R$ 7200717.91 · 49693.6 h · base 48637.6 · grupo 3 sem Pilotis (só a 3.0.1) ·
--   janelas 19 · vínculos 53 · índices 269 · medições 26 (correções 9) ·
--   curva 48637.5 h / R$ 6403393.91 · verba de forma (14 ids) 310781.08 · backups "não existe".
-- Esperado DEPOIS: 339 linhas · R$ 6834476.17 · 48585.8 h · base 47529.8 · Pilotis com 12 linhas ·
--   janelas 13 · vínculos 56 · índices 272 · medições 35 (correções 18) ·
--   curva 47529.7 h / R$ 6037152.17 · verba de forma 199570.56 · backups "EXISTE".
select 'orçamento (linhas, R$, h)' as item, count(*)::text as valor1, round(sum(preco_total), 2)::text as valor2, round(sum(hh), 1)::text as valor3
  from public.orcamento_planejado where obra_id = 'sirius60'
union all
select 'base de horas do avanço', round(sum(hh), 1)::text, '', '' from public.orcamento_planejado
 where obra_id = 'sirius60' and grupo_num <= 16 and codigo_eap <> '1.1.6'
union all
select 'linhas do Pilotis no grupo 3', count(*)::text, round(sum(preco_total), 2)::text, round(sum(hh), 1)::text
  from public.orcamento_planejado where obra_id = 'sirius60' and grupo_num = 3 and pavimento = 'Pilotis'
union all
select 'linhas 1001 a 1011', count(*)::text, '', '' from public.orcamento_planejado where id in (1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011)
union all
select 'verba de forma (14 ids)', round(sum(preco_total), 2)::text, '', '' from public.orcamento_planejado
 where obra_id = 'sirius60' and id in (669, 1006, 1008, 686, 689, 698, 701, 710, 712, 720, 723, 732, 739, 746)
union all
select 'janelas / vínculos / índices', (select count(*) from public.orcamento_horas_janela where obra_id = 'sirius60')::text,
       (select count(*) from public.orcamento_material_servico where obra_id = 'sirius60')::text,
       (select count(*) from public.indice_produtividade where obra_id = 'sirius60')::text
union all
select 'medições (todas / correções)', count(*)::text, count(*) filter (where origem = 'correcao')::text, ''
  from public.avanco_fisico_historico where obra_id = 'sirius60'
union all
select 'backup ' || t, case when to_regclass('public.' || t) is null then 'não existe' else 'EXISTE' end, '', ''
  from unnest(array['orcamento_p20_bkp_20261014', 'curva_p20_bkp_20261014', 'avanco_p20_bkp_20261014', 'janela_p20_bkp_20261014', 'vinculo_p20_bkp_20261014', 'indice_p20_bkp_20261014']) t
union all
select 'curva (h, R$, % acum. S09)', round(sum(hh_semanal), 1)::text, round(sum(valor_semanal), 2)::text,
       max(case when semana_numero = 9 then perc_hh_acum end)::text
  from public.curva_s_semanal_planejada where obra_id = 'sirius60';
