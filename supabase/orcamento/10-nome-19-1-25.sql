-- =====================================================================
-- Sirius 60 — NOME DA LINHA 19.1.25 (antiga 18.1.1; Rafael 16/10/2026)
-- Desfazer: 10-nome-19-1-25-desfazer.sql
--
-- "Mão de obra de apoio (se houver necessidade)" → "Funcionários diretos / impostos".
-- Motivo: DCTFWeb e FGTS da Fonseca (impostos de funcionários a abater no INSS da obra) passam a ser lançados nesta
-- linha. Só troca o TEXTO (coluna categoria). Valor, código, tipo reserva, semanas e lançamentos NÃO mudam.
-- Um bloco só (rodar o arquivo inteiro de uma vez); para sem gravar se o estado não for o esperado.
-- =====================================================================
do $$
declare n int;
begin
  select count(*) into n from public.custos_indiretos_planejados
   where obra_id = 'sirius60' and codigo_eap = '19.1.25'
     and categoria = 'Mão de obra de apoio (se houver necessidade)' and valor_total = 428131.20 and reserva = true;
  if n <> 1 then
    raise exception 'esperava 1 linha 19.1.25 "Mão de obra de apoio (se houver necessidade)" de 428.131,20 (achei %): nada foi feito', n;
  end if;

  update public.custos_indiretos_planejados set categoria = 'Funcionários diretos / impostos'
   where obra_id = 'sirius60' and codigo_eap = '19.1.25';

  select count(*) into n from public.custos_indiretos_planejados
   where obra_id = 'sirius60' and codigo_eap = '19.1.25' and categoria = 'Funcionários diretos / impostos';
  if n <> 1 then raise exception 'a troca não ficou como esperado: nada foi gravado'; end if;
end $$;

-- Conferência: 1 linha, com o nome novo, 428.131,20 e reserva = true
select codigo_eap, categoria, valor_total, reserva from public.custos_indiretos_planejados
 where obra_id = 'sirius60' and codigo_eap = '19.1.25';
