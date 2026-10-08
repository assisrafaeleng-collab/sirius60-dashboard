-- =====================================================================
-- Sirius 60 — FECHAR ACESSO DA CHAVE PÚBLICA (anon / authenticated)
-- Rodar UMA vez no SQL Editor do projeto do Sirius 60.
-- Pré-requisito: produção já com o código da chave secreta (commit bb33cd6).
-- Desfazer: 2-desfazer.sql
-- O site usa a chave secreta, que não é afetada por este script.
-- =====================================================================
begin;

-- 1) Políticas de leitura pública (todas as tabelas)
drop policy if exists leitura_publica on public.avanco_fisico_realizado;
drop policy if exists leitura_publica on public.cronograma_horas_planejado;
drop policy if exists leitura_publica on public.custos_indiretos_planejados;
drop policy if exists leitura_publica on public.custos_lancamentos;
drop policy if exists leitura_publica on public.ocorrencias_obra;
drop policy if exists leitura_publica on public.orcamento_planejado;

-- 2) Políticas de escrita pela chave pública
drop policy if exists medicao_escrita    on public.avanco_fisico_realizado;
drop policy if exists lancamento_escrita on public.custos_lancamentos;
drop policy if exists ocorrencia_escrita on public.ocorrencias_obra;

-- 3) RLS ligado em todas as tabelas (já está; só garante)
alter table public.avanco_fisico_realizado     enable row level security;
alter table public.cronograma_horas_planejado  enable row level security;
alter table public.custos_indiretos_planejados enable row level security;
alter table public.custos_lancamentos          enable row level security;
alter table public.ocorrencias_obra            enable row level security;
alter table public.orcamento_planejado         enable row level security;

-- 4) Tirar todas as permissões de anon e authenticated (tabelas, views e sequências)
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 5) Objetos criados no futuro também nascem sem permissão para eles
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- 6) Views passam a respeitar o RLS de quem consulta
alter view public.v_avanco_acumulado             set (security_invoker = on);
alter view public.v_curva_s_financeira_planejada set (security_invoker = on);
alter view public.v_curva_s_fisica_planejada     set (security_invoker = on);
alter view public.v_produtividade                set (security_invoker = on);

commit;

-- Conferência (aparece como último resultado): deve vir VAZIA ("No rows returned")
select table_name, grantee, string_agg(privilege_type, ', ') as privilegios
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated')
 group by table_name, grantee;
