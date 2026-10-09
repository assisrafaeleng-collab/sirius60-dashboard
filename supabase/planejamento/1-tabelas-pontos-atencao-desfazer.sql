-- =====================================================================
-- Sirius 60 — DESFAZER o passo 1 do planejamento: apaga as 5 tabelas do painel "Pontos de atenção" (pedido 14B).
-- Elas só têm os dados carregados pelo passo 1 (índices, equipes, prazos, jornada, feriados); nada mais é tocado.
-- O site volta a mostrar "configure as tabelas" e a jornada padrão.
-- =====================================================================
begin;
drop table if exists public.equipe_padrao;
drop table if exists public.indice_produtividade;
drop table if exists public.insumo_prazo_entrega;
drop table if exists public.obra_jornada;
drop table if exists public.obra_feriados;
commit;
