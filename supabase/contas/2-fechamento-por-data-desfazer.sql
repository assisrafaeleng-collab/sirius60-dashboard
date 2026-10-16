-- =====================================================================
-- Sirius 60 — DESFAZER o passo 2 do contas a pagar (2-fechamento-por-data.sql)
-- Volta a regra da coluna para só 'AAAA-MM'. ATENÇÃO: se já houver carga com fechamento por data (AAAA-MM-DD),
-- desfaça antes essas cargas (node ferramentas/semana/atualizar.js --desfazer <id> --confirmar); senão o SQL para
-- com erro e nada muda.
-- =====================================================================
begin;

alter table public.contas_a_pagar drop constraint if exists contas_a_pagar_fechamento_formato;

alter table public.contas_a_pagar
  add constraint contas_a_pagar_competencia_fechamento_check
  check (competencia_fechamento ~ '^\d{4}-\d{2}$');

commit;

-- Conferência: deve mostrar UMA linha, sem '(-\d{2})?' na regra
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.contas_a_pagar'::regclass and pg_get_constraintdef(oid) ilike '%competencia_fechamento%';
