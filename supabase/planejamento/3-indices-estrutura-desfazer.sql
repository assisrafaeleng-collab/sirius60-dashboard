-- =====================================================================
-- Sirius 60 — DESFAZER o passo 3 do planejamento: as 14 linhas voltam ao backup indice_estrutura_bkp_20261009 e a
-- equipe "laje_trelicada" sai. O backup NÃO é apagado.
-- =====================================================================
begin;
do $$
begin
  if to_regclass('public.indice_estrutura_bkp_20261009') is null then raise exception 'backup do passo 3 não existe: nada foi feito'; end if;
end $$;
update public.indice_produtividade i
   set regra = b.regra, hh_por_unidade = b.hh_por_unidade, horas_total = b.horas_total, origem = b.origem,
       conferir = b.conferir, tipo_equipe = b.tipo_equipe, observacao = b.observacao, unidade = b.unidade, atualizado_em = now()
  from public.indice_estrutura_bkp_20261009 b where i.obra_id = b.obra_id and i.orcamento_id = b.orcamento_id;
delete from public.equipe_padrao where obra_id = 'sirius60' and tipo = 'laje_trelicada';
commit;
