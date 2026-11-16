-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — DESFAZER o PASSO 14 (armação 2.1.7, Rafael 09/11/2026). Um ÚNICO bloco (DO):
-- volta a linha 673 e a curva planejada dos backups. Os backups ficam (apagar à mão no fim, se quiser).
-- Ordem para desfazer vários: 14, depois 13, depois 12.
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_v numeric;
begin
  if to_regclass('public.orcamento_217_bkp_20261109') is null or to_regclass('public.curva_s_217_bkp_20261109') is null then
    raise exception 'backups do passo 14 não encontrados: nada foi feito';
  end if;
  if not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 673
                   and quantidade = 15239.38 and preco_total = 45718.14) then
    raise exception 'a linha 673 não está como o passo 14 deixou (alguém mexeu depois?): nada foi feito';
  end if;
  if (select count(*) from public.orcamento_217_bkp_20261109) <> 1
     or (select count(*) from public.curva_s_217_bkp_20261109 where obra_id = 'sirius60') <> 117 then
    raise exception 'backups incompletos: nada foi feito';
  end if;

  update public.orcamento_planejado o set quantidade = b.quantidade, preco_total = b.preco_total
    from public.orcamento_217_bkp_20261109 b where o.obra_id = 'sirius60' and o.id = b.id;
  update public.curva_s_semanal_planejada c
     set valor_semanal = b.valor_semanal, valor_acum = b.valor_acum, perc_valor_acum = b.perc_valor_acum
    from public.curva_s_217_bkp_20261109 b
   where c.obra_id = 'sirius60' and b.obra_id = c.obra_id and b.semana_numero = c.semana_numero;

  select count(*), round(sum(preco_total), 2) into v_n, v_p from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6793914.34 then
    raise exception 'orçamento ficaria com % linhas e R$ %: nada foi desfeito', v_n, v_p;
  end if;
  select round(sum(valor_semanal), 2) into v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_v <> 5996590.34 then raise exception 'curva ficaria com R$ %: nada foi desfeito', v_v; end if;
  raise notice 'passo 14 desfeito: 2.1.7 volta a 16.394,38 kg / R$ 49.183,13';
end $$;

-- Depois de conferir, se quiser apagar os backups (rodar à parte):
-- drop table public.orcamento_217_bkp_20261109;
-- drop table public.curva_s_217_bkp_20261109;
