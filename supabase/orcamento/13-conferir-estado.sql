-- Sirius 60 — passo 13 (2.1.4). SÓ LEITURA. Rodar uma consulta de cada vez.

-- 1. Linhas 2.1.2 e 2.1.4 (2.1.2 depois do 12: 308,00 / 77.000,00; 2.1.4 antes: 16.394,38 / 113.449,10 / 589,5 h;
--    depois: 15.239,38 / 105.456,51 / 589,5 h)
select id, codigo_eap, pavimento, quantidade, preco_unitario, preco_total, hh
  from public.orcamento_planejado where obra_id = 'sirius60' and id in (668, 670) order by id;

-- 2. Totais (antes: 339 linhas, direto 6.801.906,93; depois: 339, 6.793.914,34) e indireto (2.874.508,08)
select (select count(*) from public.orcamento_planejado where obra_id = 'sirius60') as linhas,
       (select round(sum(preco_total), 2) from public.orcamento_planejado where obra_id = 'sirius60') as direto,
       (select round(sum(valor_total), 2) from public.custos_indiretos_planejados where obra_id = 'sirius60') as indireto;

-- 3. Curva planejada (antes: R$ 6.004.582,93; depois: R$ 5.996.590,34; horas iguais)
select count(*) as semanas, round(sum(hh_semanal), 1) as horas, round(sum(valor_semanal), 2) as valor
  from public.curva_s_semanal_planejada where obra_id = 'sirius60';
