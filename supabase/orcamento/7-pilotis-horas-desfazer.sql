-- =====================================================================
-- Sirius 60 — DESFAZER o passo 7: devolve as horas da 3.0.1, da 4.0.9 e das linhas que as receberam, pelo backup
-- orcamento_horas_bkp_20261009. O backup NÃO é apagado.
-- =====================================================================
begin;
do $$
declare t numeric;
begin
  if to_regclass('public.orcamento_horas_bkp_20261009') is null then raise exception 'backup do passo 7 não existe: nada foi feito'; end if;
  -- base de produção = como o site calcula (grupos 1 a 16, fora a 1.1.6 custo de tempo) = 48.454,9 h
  select round(sum(hh), 1) into t from public.orcamento_planejado
   where obra_id = 'sirius60' and grupo_num <= 16 and codigo_eap <> '1.1.6';
  if t <> 48454.9 then raise exception 'base de produção = % h (esperado 48454,9): nada foi feito', t; end if;
  -- total geral (todas as linhas, inclusive a 1.1.6) = 49.510,9 h
  select round(sum(hh), 1) into t from public.orcamento_planejado where obra_id = 'sirius60';
  if t <> 49510.9 then raise exception 'total geral de horas = % (esperado 49510,9): nada foi feito', t; end if;
end $$;
update public.orcamento_planejado o set hh = b.hh from public.orcamento_horas_bkp_20261009 b where o.id = b.id;
drop table if exists public.orcamento_horas_janela;
do $$
declare t numeric;
begin
  select round(sum(hh), 1) into t from public.orcamento_planejado
   where obra_id = 'sirius60' and grupo_num <= 16 and codigo_eap <> '1.1.6';
  if t <> 48454.9 then raise exception 'base de produção mudou para % h: nada foi gravado', t; end if;
  select round(sum(hh), 1) into t from public.orcamento_planejado where obra_id = 'sirius60';
  if t <> 49510.9 then raise exception 'total geral de horas mudou para %: nada foi gravado', t; end if;
  if exists (select 1 from public.orcamento_planejado o join public.orcamento_horas_bkp_20261009 b on b.id = o.id where o.hh <> b.hh) then
    raise exception 'as horas não voltaram iguais ao backup: nada foi gravado';
  end if;
end $$;
commit;
