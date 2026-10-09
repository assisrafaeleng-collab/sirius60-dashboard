-- =====================================================================
-- Sirius 60 — DESFAZER o passo 1 do avanço (1-medicao-acumulada.sql)
-- O site volta sozinho ao modelo antigo (incrementos de avanco_fisico_realizado), que não foi alterado.
-- ATENÇÃO: medições lançadas pela tela DEPOIS do passo 1 (origem = 'tela') existem só na tabela nova. Elas são
-- guardadas em avanco_fisico_historico_desfeito_20261008 antes de a tabela sair; relance-as como incremento, se
-- for o caso.
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.avanco_fisico_historico') is null then
    raise exception 'avanco_fisico_historico não existe: nada a desfazer';
  end if;
  if to_regclass('public.avanco_fisico_historico_desfeito_20261008') is not null then
    raise exception 'avanco_fisico_historico_desfeito_20261008 já existe: confira antes';
  end if;
end $$;

create table public.avanco_fisico_historico_desfeito_20261008 as select * from public.avanco_fisico_historico;
alter table public.avanco_fisico_historico_desfeito_20261008 enable row level security;
revoke all on public.avanco_fisico_historico_desfeito_20261008 from anon, authenticated;

drop table public.avanco_fisico_historico;

commit;

-- Conferência: medições lançadas pela tela depois do passo 1 (relançar como incremento, se houver)
select id, codigo_eap, pavimento, percentual_realizado, data_lancamento, medido_por
  from public.avanco_fisico_historico_desfeito_20261008 where origem = 'tela' order by data_lancamento, id;
-- O backup avanco_fisico_realizado_bkp_20261008 pode ser apagado depois de conferir (só com autorização):
-- drop table public.avanco_fisico_realizado_bkp_20261008;
