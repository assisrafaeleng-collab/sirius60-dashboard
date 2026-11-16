-- Sirius 60 — passo 14 (2.1.7). SÓ LEITURA. Rodar uma consulta de cada vez.

-- 1. Linhas 2.1.4 e 2.1.7 (depois: as duas com 15.239,38 kg; 2.1.4 R$ 105.456,51; 2.1.7 R$ 45.718,14 e 255,5 h)
select id, codigo_eap, pavimento, quantidade, preco_unitario, preco_total, hh
  from public.orcamento_planejado where obra_id = 'sirius60' and id in (670, 673) order by id;

-- 2. Totais (antes: 339 linhas, direto 6.793.914,34; depois: 339, 6.790.449,35) e indireto (2.874.508,08)
select (select count(*) from public.orcamento_planejado where obra_id = 'sirius60') as linhas,
       (select round(sum(preco_total), 2) from public.orcamento_planejado where obra_id = 'sirius60') as direto,
       (select round(sum(valor_total), 2) from public.custos_indiretos_planejados where obra_id = 'sirius60') as indireto;

-- 3. Curva planejada (antes: R$ 5.996.590,34; depois: R$ 5.993.125,35; horas iguais: 47.529,7)
select count(*) as semanas, round(sum(hh_semanal), 1) as horas, round(sum(valor_semanal), 2) as valor
  from public.curva_s_semanal_planejada where obra_id = 'sirius60';
