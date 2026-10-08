-- =====================================================================
-- Sirius 60 — CUSTOS, PASSO 1: registro de importações
-- Rodar no SQL Editor do projeto do Sirius 60 (arquivo inteiro).
-- Ordem: 1-importacoes.sql → 2-colunas-custos.sql → (pedido 5B) importar.js --confirmar
-- Desfazer: 1-importacoes-desfazer.sql (depois do 2-colunas-custos-desfazer.sql)
--
-- Cria a tabela importacoes: cada carga do classificador (uma competência)
-- vira uma linha com arquivos, totais e uma CÓPIA das linhas de
-- custos_lancamentos que ela substituiu (coluna substituidos) — é isso que
-- permite o --desfazer do importar.js.
--
-- Não altera nem apaga nenhuma linha existente.
-- Segurança (CLAUDE.md): RLS ligado, SEM política e SEM permissão para anon e
-- authenticated. Só o servidor/scripts com a chave secreta enxergam.
-- =====================================================================
begin;

create table if not exists public.importacoes (
  id                  uuid primary key default gen_random_uuid(),
  obra_id             text not null,
  competencia         text not null check (competencia ~ '^\d{4}-\d{2}$'),   -- AAAA-MM
  origem              text not null default 'classificador',
  arquivos            text,                       -- lancamentos.csv + relatórios TOTVS usados
  linhas              integer not null,
  total               numeric(14,2) not null,
  linhas_substituidas integer not null default 0,
  total_substituido   numeric(14,2) not null default 0,
  substituidos        jsonb,                      -- cópia das linhas que saíram (para desfazer)
  status              text not null default 'gravando'
                        check (status in ('gravando', 'ok', 'desfeita')),
  criado_em           timestamptz not null default now(),
  desfeita_em         timestamptz,
  observacao          text
);

create index if not exists importacoes_obra_comp_idx on public.importacoes (obra_id, competencia);

alter table public.importacoes enable row level security;

-- O fechamento de 07/10 já tirou os privilégios padrão; reforça para esta tabela.
revoke all on public.importacoes from anon, authenticated;

commit;

-- Conferência 1: rls_ativo = true
select relname as tabela, relrowsecurity as rls_ativo
  from pg_class where relname = 'importacoes' and relnamespace = 'public'::regnamespace;

-- Conferência 2: deve vir VAZIA (nenhuma política e nenhuma permissão para anon/authenticated)
select 'politica' as tipo, policyname as nome from pg_policies
 where schemaname = 'public' and tablename = 'importacoes'
union all
select 'grant', grantee || ': ' || privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'importacoes' and grantee in ('anon', 'authenticated');
