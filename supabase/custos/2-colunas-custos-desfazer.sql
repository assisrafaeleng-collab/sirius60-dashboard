-- =====================================================================
-- Sirius 60 — DESFAZER o passo 2 (2-colunas-custos.sql)
-- Rodar ANTES do 1-importacoes-desfazer.sql.
-- ATENÇÃO: só funciona se não houver linhas gravadas pelo importar.js
-- (ou se todas as cargas já foram desfeitas com --desfazer). Com cargas no
-- banco, a volta do índice antigo falha (mesma nota em várias EAPs) e o
-- arquivo inteiro é desfeito pelo begin/commit — nada muda.
-- =====================================================================
begin;

-- Trava: para aqui se ainda houver linha de carga
do $$
begin
  if exists (select 1 from public.custos_lancamentos where importacao_id is not null) then
    raise exception 'Há lançamentos gravados pelo importar.js: desfaça as cargas pelo importar.js antes.';
  end if;
end $$;

drop index if exists public.uniq_documento_eap_carga;
create unique index if not exists uniq_documento
  on public.custos_lancamentos (obra_id, num_documento, fornecedor)
  where num_documento is not null and num_documento <> '';

drop index if exists public.idx_lanc_importacao;
-- idx_lanc_obra fica: já existia antes (01_estrutura_sirius60.sql)

alter table public.custos_lancamentos drop constraint if exists custos_lancamentos_fonte_chk;
alter table public.custos_lancamentos
  drop column if exists importacao_id,
  drop column if exists cnpj,
  drop column if exists fonte;

commit;

-- Conferência: deve vir VAZIA
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'custos_lancamentos'
   and column_name in ('importacao_id', 'cnpj', 'fonte');
