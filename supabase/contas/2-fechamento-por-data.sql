-- =====================================================================
-- Sirius 60 — CONTAS A PAGAR, PASSO 2: fechamento pela DATA DE CORTE (rotina semanal, pedido 15)
-- Desfazer: 2-fechamento-por-data-desfazer.sql
--
-- A coluna competencia_fechamento passa a aceitar também 'AAAA-MM-DD' (a data de corte do relatório semanal),
-- além de 'AAAA-MM' (fechamento no último dia do mês, como a carga de 2026-09). Só troca a regra (check) da coluna:
-- nenhuma linha é alterada e nenhuma permissão muda.
--
-- Ordem (CLAUDE.md): publicar ANTES o código que entende o fechamento por data (lib/contas-a-pagar.js
-- dataDoFechamento). Rode antes do primeiro "node ferramentas/semana/atualizar.js --confirmar".
-- =====================================================================
begin;

-- remove a regra antiga da coluna (nome automático do check inline), qualquer que seja o nome
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
      join pg_class t on t.oid = con.conrelid
     where t.relname = 'contas_a_pagar' and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%competencia_fechamento%'
  loop
    execute format('alter table public.contas_a_pagar drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.contas_a_pagar
  add constraint contas_a_pagar_fechamento_formato
  check (competencia_fechamento ~ '^\d{4}-\d{2}(-\d{2})?$');

commit;

-- Conferência: deve mostrar UMA linha, com '(-\d{2})?' na regra
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.contas_a_pagar'::regclass and pg_get_constraintdef(oid) ilike '%competencia_fechamento%';
