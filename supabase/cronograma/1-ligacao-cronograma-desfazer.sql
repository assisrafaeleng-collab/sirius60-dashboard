-- Sirius 60 — DESFAZER o CRONOGRAMA, PASSO 1: apaga a tabela orcamento_cronograma_ligacao (só informação de origem).
begin;
drop table if exists public.orcamento_cronograma_ligacao;
commit;
