-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — DESFAZER o PASSO 9 do orçamento (Pilotis no grupo 3, pedido 20). Um ÚNICO bloco (DO): volta as linhas dos
-- grupos 2 e 3 (inclusive as que saíram), apaga as 11 novas (ids 1001 a 1011), volta a curva, as janelas do Pilotis, os
-- vínculos e os índices dos backups e apaga só as correções de medição do passo 9. Os backups ficam (apagar à mão no fim).
-- Rodar ANTES de qualquer desfazer mais antigo (o do passo 8 apaga todas as correções).
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric;
begin
  if to_regclass('public.orcamento_p20_bkp_20261014') is null or to_regclass('public.curva_p20_bkp_20261014') is null or to_regclass('public.avanco_p20_bkp_20261014') is null or to_regclass('public.janela_p20_bkp_20261014') is null or to_regclass('public.vinculo_p20_bkp_20261014') is null or to_regclass('public.indice_p20_bkp_20261014') is null then
    raise exception 'backups do passo 9 não encontrados: nada foi feito';
  end if;
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6834476.17 or v_h <> 48585.8 then
    raise exception 'orçamento com % linhas, R$ % e % h — não está como o passo 9 deixou (alguém mexeu depois?): nada foi feito', v_n, v_p, v_h;
  end if;
  if (select count(*) from public.orcamento_p20_bkp_20261014) <> 81 or (select count(*) from public.curva_p20_bkp_20261014) <> 117
     or (select count(*) from public.janela_p20_bkp_20261014) <> 19 or (select count(*) from public.vinculo_p20_bkp_20261014) <> 53 then
    raise exception 'backup do passo 9 incompleto: nada foi feito';
  end if;
  if exists (select 1 from public.custos_lancamentos c where c.obra_id = 'sirius60' and c.codigo_eap like '3.%')
     or exists (select 1 from public.contas_a_pagar c where c.obra_id = 'sirius60' and c.codigo_eap like '3.%')
     or exists (select 1 from public.avanco_fisico_historico a where a.obra_id = 'sirius60' and a.codigo_eap like '3.%') then
    raise exception 'já há custo, conta a pagar ou medição no grupo 3 com os códigos novos: desfazer à mão, nada foi feito';
  end if;

  delete from public.indice_produtividade where obra_id = 'sirius60' and orcamento_id in (667, 668, 669, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687, 688, 689, 690, 691, 692, 693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 727, 728, 729, 730, 731, 732, 733, 734, 735, 736, 737, 738, 739, 740, 741, 742, 743, 744, 745, 746, 992, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011);
  insert into public.indice_produtividade select * from public.indice_p20_bkp_20261014;
  delete from public.orcamento_material_servico where obra_id = 'sirius60';
  insert into public.orcamento_material_servico select * from public.vinculo_p20_bkp_20261014;
  delete from public.orcamento_horas_janela where obra_id = 'sirius60';
  insert into public.orcamento_horas_janela select * from public.janela_p20_bkp_20261014;
  delete from public.orcamento_planejado where obra_id = 'sirius60' and id in (1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011);
  delete from public.orcamento_planejado where obra_id = 'sirius60' and id in (667, 668, 669, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687, 688, 689, 690, 691, 692, 693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 727, 728, 729, 730, 731, 732, 733, 734, 735, 736, 737, 738, 739, 740, 741, 742, 743, 744, 745, 746, 992);
  insert into public.orcamento_planejado select * from public.orcamento_p20_bkp_20261014;
  update public.curva_s_semanal_planejada c
     set hh_semanal = b.hh_semanal, perc_hh_semanal = b.perc_hh_semanal, perc_hh_acum = b.perc_hh_acum,
         valor_semanal = b.valor_semanal, valor_acum = b.valor_acum, perc_valor_acum = b.perc_valor_acum
    from public.curva_p20_bkp_20261014 b where c.obra_id = 'sirius60' and b.obra_id = c.obra_id and b.semana_numero = c.semana_numero;
  delete from public.avanco_fisico_historico a where a.obra_id = 'sirius60' and a.origem = 'correcao'
     and not exists (select 1 from public.avanco_p20_bkp_20261014 b where b.id = a.id);

  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 333 or v_p <> 7200717.91 or v_h <> 49693.6 then
    raise exception 'orçamento ficaria com % linhas, R$ % e % h (esperado 333, 7200717.91 e 49693.6): nada foi desfeito', v_n, v_p, v_h;
  end if;
  select round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_h, v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_h <> 48637.5 or v_v <> 6403393.91 then raise exception 'curva ficaria com % h e R$ %: nada foi desfeito', v_h, v_v; end if;
  if (select count(*) from public.avanco_fisico_historico where obra_id = 'sirius60' and origem = 'correcao') <> 9 then
    raise exception 'correções de medição não voltariam a 9: nada foi desfeito';
  end if;
  if (select count(*) from public.indice_produtividade where obra_id = 'sirius60') <> 269
     or (select count(*) from public.orcamento_material_servico where obra_id = 'sirius60') <> 53
     or (select count(*) from public.orcamento_horas_janela where obra_id = 'sirius60') <> 19 then
    raise exception 'índices, vínculos ou janelas não voltariam ao de antes: nada foi desfeito';
  end if;
  raise notice 'passo 9 desfeito';
end $$;

-- Depois de conferir, se quiser apagar os backups (rodar à parte):
-- drop table public.orcamento_p20_bkp_20261014;
-- drop table public.curva_p20_bkp_20261014;
-- drop table public.avanco_p20_bkp_20261014;
-- drop table public.janela_p20_bkp_20261014;
-- drop table public.vinculo_p20_bkp_20261014;
-- drop table public.indice_p20_bkp_20261014;
