-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — DESFAZER o PASSO 8 do orçamento (quantidades e medições da fundação, pedido 19). Um ÚNICO bloco (DO):
-- volta as linhas 670, 671 e 673 e a curva planejada dos backups, apaga as 9 "correções" de medição (origem
-- 'correcao') e volta a regra da coluna origem. Os backups ficam (apagar à mão no fim, se quiser).
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric;
begin
  if to_regclass('public.orcamento_quantidades_bkp_20261014') is null or to_regclass('public.curva_s_quantidades_bkp_20261014') is null
     or to_regclass('public.avanco_quantidades_bkp_20261014') is null then
    raise exception 'backups do passo 8 não encontrados: nada foi feito';
  end if;
  select count(*) into v_n from public.orcamento_planejado where obra_id = 'sirius60' and (
       (id = 670 and quantidade = 16578.47 and preco_total = 114723.01 and hh = 596.1)
    or (id = 671 and quantidade = 529.8 and preco_total = 349668.0 and hh = 986.9)
    or (id = 673 and quantidade = 16578.47 and preco_total = 49735.41 and hh = 258.4));
  if v_n <> 3 then raise exception 'só % das 3 linhas estão como o passo 8 deixou (alguém mexeu depois?): nada foi feito', v_n; end if;
  if (select count(*) from public.orcamento_quantidades_bkp_20261014) <> 3 then raise exception 'backup do orçamento incompleto: nada foi feito'; end if;
  if (select count(*) from public.curva_s_quantidades_bkp_20261014 where obra_id = 'sirius60') <> 117 then
    raise exception 'backup da curva incompleto: nada foi feito';
  end if;
  if (select count(*) from public.avanco_fisico_historico where obra_id = 'sirius60' and origem = 'correcao') <> 9 then
    raise exception 'esperava 9 correções de medição (alguém lançou ou excluiu depois?): nada foi feito';
  end if;

  update public.orcamento_planejado o set quantidade = b.quantidade, preco_total = b.preco_total, hh = b.hh
    from public.orcamento_quantidades_bkp_20261014 b where o.obra_id = 'sirius60' and o.id = b.id;
  update public.curva_s_semanal_planejada c
     set hh_semanal = b.hh_semanal, perc_hh_semanal = b.perc_hh_semanal, perc_hh_acum = b.perc_hh_acum,
         valor_semanal = b.valor_semanal, valor_acum = b.valor_acum, perc_valor_acum = b.perc_valor_acum
    from public.curva_s_quantidades_bkp_20261014 b where c.obra_id = 'sirius60' and b.obra_id = c.obra_id and b.semana_numero = c.semana_numero;
  delete from public.avanco_fisico_historico where obra_id = 'sirius60' and origem = 'correcao';
  alter table public.avanco_fisico_historico drop constraint avanco_fisico_historico_origem_check;
  alter table public.avanco_fisico_historico add constraint avanco_fisico_historico_origem_check check (origem in ('tela', 'conversao'));

  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 333 or v_p <> 7123256.27 or v_h <> 49510.9 then
    raise exception 'orçamento ficaria com % linhas, R$ % e % h (esperado 333, 7123256.27 e 49510.9): nada foi desfeito', v_n, v_p, v_h;
  end if;
  select round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_h, v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_h <> 48454.8 or v_v <> 6325932.24 then
    raise exception 'curva ficaria com % h e R$ %: nada foi desfeito', v_h, v_v;
  end if;
  select count(*) into v_n from public.avanco_fisico_historico where obra_id = 'sirius60';
  if v_n <> 17 then raise exception 'avanco_fisico_historico ficaria com % linhas (esperado 17): nada foi desfeito', v_n; end if;
  raise notice 'passo 8 desfeito';
end $$;

-- Depois de conferir, se quiser apagar os backups (rodar à parte):
-- drop table public.orcamento_quantidades_bkp_20261014;
-- drop table public.curva_s_quantidades_bkp_20261014;
-- drop table public.avanco_quantidades_bkp_20261014;
