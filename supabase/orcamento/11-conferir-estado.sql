-- Sirius 60 — passo 11 (2.1.5). SÓ LEITURA. Rodar uma consulta de cada vez.

-- 1. Linha 2.1.5 (antes: 362,21 / 239.061,64 / 674,7 h; depois: 326,20 / 215.292,40 / 674,7 h)
select id, codigo_eap, pavimento, quantidade, preco_unitario, preco_total, hh
  from public.orcamento_planejado where obra_id = 'sirius60' and id = 671;

-- 2. Totais (antes: 339 linhas, direto 6.834.476,17; depois: 339, 6.810.706,93) e indireto (2.874.508,08)
select (select count(*) from public.orcamento_planejado where obra_id = 'sirius60') as linhas,
       (select round(sum(preco_total), 2) from public.orcamento_planejado where obra_id = 'sirius60') as direto,
       (select round(sum(valor_total), 2) from public.custos_indiretos_planejados where obra_id = 'sirius60') as indireto;

-- 3. Curva planejada (antes: R$ 6.037.152,17; depois: R$ 6.013.382,93; horas iguais)
select count(*) as semanas, round(sum(hh_semanal), 1) as horas, round(sum(valor_semanal), 2) as valor
  from public.curva_s_semanal_planejada where obra_id = 'sirius60';

-- 4. Medições da 2.1.8 (não devem mudar)
select id, semana_numero, data_lancamento, percentual_realizado, origem, excluido_em
  from public.avanco_fisico_historico
 where obra_id = 'sirius60' and codigo_eap = '2.1.8' and pavimento = 'Fundação'
 order by semana_numero, data_lancamento, id;
