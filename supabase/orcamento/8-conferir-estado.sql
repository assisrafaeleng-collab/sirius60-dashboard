-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- SÓ LEITURA (não grava nada): estado do banco em relação ao passo 8 (pedido 19).
-- Esperado ANTES do passo 8: 2.1.4 18102.18 / 125267.11 / 650.9 · 2.1.5 389.53 / 257091.12 / 725.6 ·
-- 2.1.7 18102.18 / 54306.55 / 282.2 · correções 0 · backups "não existe" · regra origem só tela/conversao ·
-- curva 48454.8 h e S117 = 100 · medições 17.
select 'linha ' || codigo_eap as item, quantidade::text as valor1, preco_total::text as valor2, hh::text as valor3
  from public.orcamento_planejado where obra_id = 'sirius60' and id in (670, 671, 673)
union all
select 'medições com origem correcao', count(*)::text, '', '' from public.avanco_fisico_historico
 where obra_id = 'sirius60' and origem = 'correcao'
union all
select 'medições (todas)', count(*)::text, '', '' from public.avanco_fisico_historico where obra_id = 'sirius60'
union all
select 'backup ' || t, case when to_regclass('public.' || t) is null then 'não existe' else 'EXISTE' end, '', ''
  from unnest(array['orcamento_quantidades_bkp_20261014', 'curva_s_quantidades_bkp_20261014', 'avanco_quantidades_bkp_20261014']) t
union all
select 'regra origem', pg_get_constraintdef(oid), '', '' from pg_constraint where conname = 'avanco_fisico_historico_origem_check'
union all
select 'curva (horas, valor, % acum. S117)', round(sum(hh_semanal), 1)::text, round(sum(valor_semanal), 2)::text,
       max(case when semana_numero = 117 then perc_hh_acum end)::text
  from public.curva_s_semanal_planejada where obra_id = 'sirius60';
