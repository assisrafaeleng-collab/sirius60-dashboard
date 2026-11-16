-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — DESFAZER o PASSO 13 (aço 2.1.4, Rafael 09/11/2026). Um ÚNICO bloco (DO):
-- volta a linha 670 e a curva planejada dos backups. Os backups ficam (apagar à mão no fim, se quiser).
-- Desfazer o 13 ANTES de desfazer o 12 (o 12 confere a curva com o total de antes do 13).
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_v numeric;
begin
  if to_regclass('public.orcamento_214_bkp_20261109') is null or to_regclass('public.curva_s_214_bkp_20261109') is null then
    raise exception 'backups do passo 13 não encontrados: nada foi feito';
  end if;
  if not exists (select 1 from public.orcamento_planejado where obra_id = 'sirius60' and id = 670
                   and quantidade = 15239.38 and preco_total = 105456.51) then
    raise exception 'a linha 670 não está como o passo 13 deixou (alguém mexeu depois?): nada foi feito';
  end if;
  if (select count(*) from public.orcamento_214_bkp_20261109) <> 1
     or (select count(*) from public.curva_s_214_bkp_20261109 where obra_id = 'sirius60') <> 117 then
    raise exception 'backups incompletos: nada foi feito';
  end if;

  update public.orcamento_planejado o set quantidade = b.quantidade, preco_total = b.preco_total
    from public.orcamento_214_bkp_20261109 b where o.obra_id = 'sirius60' and o.id = b.id;
  update public.curva_s_semanal_planejada c
     set valor_semanal = b.valor_semanal, valor_acum = b.valor_acum, perc_valor_acum = b.perc_valor_acum
    from public.curva_s_214_bkp_20261109 b
   where c.obra_id = 'sirius60' and b.obra_id = c.obra_id and b.semana_numero = c.semana_numero;

  select count(*), round(sum(preco_total), 2) into v_n, v_p from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6801906.93 then
    raise exception 'orçamento ficaria com % linhas e R$ %: nada foi desfeito', v_n, v_p;
  end if;
  select round(sum(valor_semanal), 2) into v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_v <> 6004582.93 then raise exception 'curva ficaria com R$ %: nada foi desfeito', v_v; end if;
  raise notice 'passo 13 desfeito: 2.1.4 volta a 16.394,38 kg / R$ 113.449,10';
end $$;

-- Depois de conferir, se quiser apagar os backups (rodar à parte):
-- drop table public.orcamento_214_bkp_20261109;
-- drop table public.curva_s_214_bkp_20261109;
