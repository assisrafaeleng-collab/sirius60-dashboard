-- =====================================================================
-- Sirius 60 — DESFAZER o passo 1 das semanas (1-calendario.sql)
-- Rodar SÓ depois de desfazer o passo 2 (2-semanas-orcamento-desfazer.sql) e de voltar o código do site.
-- Apaga as duas tabelas criadas pelo passo 1 (não há outro dado nelas).
-- =====================================================================
begin;
drop table if exists public.curva_s_semanal_planejada;
drop table if exists public.calendario_semanas;
commit;

select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('calendario_semanas', 'curva_s_semanal_planejada');
