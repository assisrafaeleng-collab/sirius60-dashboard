-- =====================================================================
-- Sirius 60 — PLANEJAMENTO, PASSO 2: editar índice e equipes pelo site (pedido 14C)
-- Rodar no SQL Editor (arquivo inteiro), DEPOIS do passo 1 (1-tabelas-pontos-atencao.sql) e de promover o código do
-- pedido 14C. Desfazer: 2-edicao-no-site-desfazer.sql
--
-- indice_produtividade ganha (por linha do orçamento):
--   equipes_definidas  nº de equipes escolhido pelo Rafael na tela (null = usa o sugerido; "voltar ao sugerido" apaga)
--   equipe_oficiais, equipe_ajudantes, equipe_funcao  equipe informada na tela para linha sem tipo de equipe
--   editado_por, editado_em  última edição pelo site
--   origem passa a aceitar 'rafael-site' (índice digitado na tela).
-- planejamento_historico (nova): toda alteração feita no site — linha, campo, valor anterior, valor novo, quem e quando.
-- Nada existente é apagado nem alterado de valor. Tabela nova: RLS ligado, sem política, sem permissão para
-- anon/authenticated. A rota do site grava com a chave secreta (só no servidor) e exige SENHA_MEDICAO.
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.indice_produtividade') is null then
    raise exception 'rode antes o supabase/planejamento/1-tabelas-pontos-atencao.sql';
  end if;
  if to_regclass('public.planejamento_historico') is not null
     or exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'indice_produtividade' and column_name = 'equipes_definidas') then
    raise exception 'este arquivo já foi rodado: nada foi feito';
  end if;
end $$;

alter table public.indice_produtividade
  add column equipes_definidas int check (equipes_definidas > 0),
  add column equipe_oficiais int check (equipe_oficiais >= 0),
  add column equipe_ajudantes int check (equipe_ajudantes >= 0),
  add column equipe_funcao text,
  add column editado_por text,
  add column editado_em timestamptz;
alter table public.indice_produtividade drop constraint if exists indice_produtividade_origem_check;
alter table public.indice_produtividade add constraint indice_produtividade_origem_check
  check (origem in ('rafael', 'rafael-site', 'cronograma', 'cpu_flats', ''));

create table public.planejamento_historico (
  id bigserial primary key,
  obra_id text not null,
  orcamento_id bigint not null,
  codigo_eap text,
  pavimento text,
  campo text not null check (campo in ('indice', 'equipes', 'equipe')),
  valor_anterior text,
  valor_novo text,
  editado_por text,
  editado_em timestamptz not null default now()
);
create index planejamento_historico_linha on public.planejamento_historico (obra_id, orcamento_id, editado_em);
alter table public.planejamento_historico enable row level security;
revoke all on public.planejamento_historico from anon, authenticated;
revoke all on sequence public.planejamento_historico_id_seq from anon, authenticated;

do $$
begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'indice_produtividade'
       and column_name in ('equipes_definidas', 'equipe_oficiais', 'equipe_ajudantes', 'equipe_funcao', 'editado_por', 'editado_em')) <> 6 then
    raise exception 'colunas novas não foram criadas: nada foi gravado';
  end if;
end $$;

commit;

select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name in ('indice_produtividade', 'planejamento_historico')
 order by table_name, ordinal_position;
