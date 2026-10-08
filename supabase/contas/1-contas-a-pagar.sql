-- =====================================================================
-- Sirius 60 — CONTAS A PAGAR, PASSO 1: tabela do card (rode o arquivo inteiro)
-- Desfazer: 1-contas-a-pagar-desfazer.sql
--
-- Cria a tabela contas_a_pagar: títulos EM ABERTO no fechamento (relatórios completos), já classificados
-- por EAP (automacao/contas_a_pagar.py) e gravados pelo
--   node ferramentas/fechamento/importar.js --contas --fechamento 2026-09 --saida saida_v2 --confirmar
--
-- Uma linha por título e EAP (a NF de um BM é aberta pela composição do BM). Cada carga tem um carga_id:
-- a nova entra inteira e só depois a anterior do mesmo fechamento sai.
--
-- NÃO é custo realizado: nada daqui vai para custos_lancamentos. O card e o IPC somam só
-- classe = 'direto' e recorrente = false ("custo direto a pagar").
--
-- Ordem (CLAUDE.md): publicar antes o código que lê a tabela; este SQL não altera nenhuma tabela existente.
-- Segurança (CLAUDE.md): RLS ligado, SEM política e SEM permissão para anon e authenticated.
-- =====================================================================
begin;

create table if not exists public.contas_a_pagar (
  id                      uuid primary key default gen_random_uuid(),
  obra_id                 text not null,
  carga_id                uuid not null,
  competencia_fechamento  text not null check (competencia_fechamento ~ '^\d{4}-\d{2}$'),  -- 2026-09
  competencia_vencimento  text not null check (competencia_vencimento ~ '^\d{4}-\d{2}$'),  -- 2026-10
  fonte                   text not null check (fonte in ('fonseca', 'dinamica')),
  cnpj                    text,                         -- raiz do CNPJ (ou CPF)
  fornecedor              text not null,
  num_documento           text not null,
  parcela                 text,                         -- '02' de 2104/02
  seq                     smallint not null default 1,  -- linha do título (EAP / item da OC)
  historico               text,
  item                    text,
  oc                      text,
  data_emissao            date,
  data_vencimento         date,
  valor_titulo            numeric(14,2),
  valor                   numeric(14,2) not null,       -- valor desta linha
  codigo_eap              text,                         -- vazio = pendente
  pavimento               text,
  classe                  text not null check (classe in ('direto', 'indireto', 'pendente')),
  natureza                text not null check (natureza in ('nf', 'previsto_sem_nf')),
  recorrente              boolean not null default false,  -- sai do card e do IPC (fica marcado)
  vinculo_oc              text,
  regra                   text,
  alertas                 text[] not null default '{}',
  importado_em            timestamptz not null default now(),
  unique (carga_id, cnpj, num_documento, seq)
);

create index if not exists contas_a_pagar_fechamento on public.contas_a_pagar (obra_id, competencia_fechamento);

alter table public.contas_a_pagar enable row level security;
revoke all on public.contas_a_pagar from anon, authenticated;

commit;

-- Conferência 1: rls_ativo = true
select relname as tabela, relrowsecurity as rls_ativo
  from pg_class where relname = 'contas_a_pagar' and relnamespace = 'public'::regnamespace;

-- Conferência 2: deve vir VAZIA (nenhuma política e nenhuma permissão para anon/authenticated)
select 'politica' as tipo, policyname as nome from pg_policies
 where schemaname = 'public' and tablename = 'contas_a_pagar'
union all
select 'grant', grantee || ': ' || privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'contas_a_pagar' and grantee in ('anon', 'authenticated');
