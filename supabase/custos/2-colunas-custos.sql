-- =====================================================================
-- Sirius 60 — CUSTOS, PASSO 2: colunas novas e índice de documento
-- Rodar no SQL Editor DEPOIS do 1-importacoes.sql (arquivo inteiro).
-- Desfazer: 2-colunas-custos-desfazer.sql
--
-- 1) Colunas novas em custos_lancamentos, todas NULLABLE (as linhas atuais
--    ficam com elas vazias; o site em produção não usa e não é afetado):
--      importacao_id  de qual carga do importar.js veio a linha (FK importacoes)
--      cnpj           raiz do CNPJ (8 dígitos) do fornecedor, vinda do TOTVS
--      fonte          'fonseca' | 'dinamica' | 'rateio' | 'manual'
--    Nenhuma coluna existente é removida ou renomeada.
--
-- 2) Índice único de documento. Hoje existe (04_lancamentos_sirius60.sql):
--      uniq_documento (obra_id, num_documento, fornecedor)
--        where num_documento is not null and num_documento <> ''
--    Ele impede a carga do classificador porque:
--      a) uma mesma nota rateada em várias EAPs vira várias linhas com o mesmo
--         documento e fornecedor (ex.: Sericita "3ª MEDIÇÃO 28/08" em 2.1.2,
--         2.1.7 e 2.1.8). O seed 05 contornou isso inventando o documento
--         "3ª MEDIÇÃO 28/08 · 2.1.2";
--      b) o importar.js grava as linhas novas ANTES de apagar as antigas (se
--         falhar no meio, nada some); por alguns instantes a mesma nota existe
--         duas vezes (a antiga da carga planilha e a nova).
--    A parcela (/01, /02, PARC 03/12) já faz parte do num_documento, então
--    parcelas diferentes nunca colidiram.
--    Troca por: (obra_id, num_documento, fornecedor, codigo_eap, carga), em
--    que carga = importacao_id ou 'manual'. Efeito:
--      - lançamento pela tela (sem importacao_id): continua bloqueando a mesma
--        nota do mesmo fornecedor NA MESMA EAP (a mensagem "já foi lançada" do
--        site continua); a mesma nota em outra EAP passa a ser aceita;
--      - dentro de uma carga: uma linha por nota + EAP;
--      - carga nova x carga antiga / linhas manuais: não colidem (o
--        importar.js avisa na prévia quando uma linha mantida parece repetida).
--    O índice novo é mais largo que o atual: nenhuma linha existente o viola.
-- =====================================================================
begin;

alter table public.custos_lancamentos
  add column if not exists importacao_id uuid references public.importacoes(id),
  add column if not exists cnpj          text,
  add column if not exists fonte         text;

alter table public.custos_lancamentos
  drop constraint if exists custos_lancamentos_fonte_chk;
alter table public.custos_lancamentos
  add constraint custos_lancamentos_fonte_chk
  check (fonte is null or fonte in ('fonseca', 'dinamica', 'rateio', 'manual'));

-- (obra_id, competencia): já criado no 01 como idx_lanc_obra; "if not exists" só garante
create index if not exists idx_lanc_obra on public.custos_lancamentos (obra_id, competencia);
create index if not exists idx_lanc_importacao on public.custos_lancamentos (importacao_id);

drop index if exists public.uniq_documento;
create unique index if not exists uniq_documento_eap_carga
  on public.custos_lancamentos (obra_id, num_documento, fornecedor,
                                coalesce(codigo_eap, ''), coalesce(importacao_id::text, 'manual'))
  where num_documento is not null and num_documento <> '';

commit;

-- Conferência 1: as 3 colunas novas
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'custos_lancamentos'
   and column_name in ('importacao_id', 'cnpj', 'fonte');

-- Conferência 2: índices da tabela (deve aparecer uniq_documento_eap_carga e NÃO uniq_documento)
select indexname, indexdef from pg_indexes
 where schemaname = 'public' and tablename = 'custos_lancamentos'
 order by indexname;
