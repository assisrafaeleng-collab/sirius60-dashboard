-- =====================================================================
-- Sirius 60 — DESFAZER o passo 4 das semanas: a contenção 15.1.4 volta para S2–S12 e a curva volta
-- ao backup curva_s_contencao_bkp_20261009 (as 117 semanas). Os backups NÃO são apagados.
-- =====================================================================
begin;
do $$
begin
  if to_regclass('public.curva_s_contencao_bkp_20261009') is null or to_regclass('public.orcamento_contencao_bkp_20261009') is null then
    raise exception 'backups do passo 4 não existem: nada foi feito';
  end if;
  if not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 973
                  and semana_inicio = 16 and semana_fim = 26) then
    raise exception '15.1.4 não está como o passo 4 deixou: nada foi feito';
  end if;
end $$;
update public.orcamento_planejado o set semana_inicio = b.semana_inicio, semana_fim = b.semana_fim
  from public.orcamento_contencao_bkp_20261009 b where o.id = b.id;
update public.curva_s_semanal_planejada c
   set hh_semanal = b.hh_semanal, perc_hh_semanal = b.perc_hh_semanal, perc_hh_acum = b.perc_hh_acum,
       valor_semanal = b.valor_semanal, valor_acum = b.valor_acum, perc_valor_acum = b.perc_valor_acum
  from public.curva_s_contencao_bkp_20261009 b where c.obra_id = b.obra_id and c.semana_numero = b.semana_numero;
do $$
begin
  if exists (select 1 from public.curva_s_semanal_planejada c join public.curva_s_contencao_bkp_20261009 b
               on b.obra_id = c.obra_id and b.semana_numero = c.semana_numero
              where c.hh_semanal <> b.hh_semanal or c.valor_semanal <> b.valor_semanal) then
    raise exception 'a curva não voltou igual ao backup: nada foi gravado';
  end if;
end $$;
commit;
