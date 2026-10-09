-- =====================================================================
-- Sirius 60 — DESFAZER o passo 2 do planejamento: tira as colunas de edição de indice_produtividade e apaga
-- planejamento_historico. ATENÇÃO: índices digitados no site (origem 'rafael-site') ficam com o valor digitado; só as
-- equipes escolhidas, a equipe por linha e o histórico se perdem. Faça cópia do histórico antes, se quiser guardá-lo.
-- =====================================================================
begin;
alter table public.indice_produtividade
  drop column if exists equipes_definidas, drop column if exists equipe_oficiais, drop column if exists equipe_ajudantes,
  drop column if exists equipe_funcao, drop column if exists editado_por, drop column if exists editado_em;
update public.indice_produtividade set origem = 'rafael' where origem = 'rafael-site';
alter table public.indice_produtividade drop constraint if exists indice_produtividade_origem_check;
alter table public.indice_produtividade add constraint indice_produtividade_origem_check
  check (origem in ('rafael', 'cronograma', 'cpu_flats', ''));
drop table if exists public.planejamento_historico;
commit;
