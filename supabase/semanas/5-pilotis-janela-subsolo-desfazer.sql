-- =====================================================================
-- Sirius 60 — DESFAZER o PASSO 5 (alternativa B do Pilotis): volta a curva e as 6 janelas da 3.0.1 como estavam.
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.curva_s_pilotis_bkp_20261011') is null or to_regclass('public.orcamento_horas_janela_bkp_20261011') is null then
    raise exception 'backups do passo 5 não existem: nada a desfazer';
  end if;
end $$;

update public.curva_s_semanal_planejada c
   set hh_semanal = b.hh_semanal, perc_hh_semanal = b.perc_hh_semanal, perc_hh_acum = b.perc_hh_acum
  from public.curva_s_pilotis_bkp_20261011 b where c.id = b.id;
insert into public.orcamento_horas_janela select * from public.orcamento_horas_janela_bkp_20261011;

drop table public.curva_s_pilotis_bkp_20261011;
drop table public.orcamento_horas_janela_bkp_20261011;

commit;

select semana_numero, perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 11;
