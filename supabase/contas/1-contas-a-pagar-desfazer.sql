-- =====================================================================
-- Sirius 60 — DESFAZER o passo 1 do contas a pagar (1-contas-a-pagar.sql)
-- ATENÇÃO: apaga a tabela e todas as cargas do contas a pagar. Não mexe em custos_lancamentos.
-- Se o site já estiver lendo a tabela, publique antes o código que não lê mais.
-- =====================================================================
begin;

drop table if exists public.contas_a_pagar;

commit;

-- Conferência: deve vir VAZIA
select table_name from information_schema.tables
 where table_schema = 'public' and table_name = 'contas_a_pagar';
