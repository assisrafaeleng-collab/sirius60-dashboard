-- =====================================================================
-- Sirius 60 — DESFAZER o passo 1 (1-importacoes.sql)
-- Rodar SÓ depois do 2-colunas-custos-desfazer.sql (a coluna importacao_id
-- de custos_lancamentos aponta para esta tabela).
-- ATENÇÃO: apaga o registro das cargas e as cópias para desfazer. Só rode se
-- nenhuma carga foi gravada, ou se todas já foram desfeitas pelo importar.js.
-- =====================================================================
begin;

drop table if exists public.importacoes;

commit;

-- Conferência: deve vir VAZIA
select table_name from information_schema.tables
 where table_schema = 'public' and table_name = 'importacoes';
