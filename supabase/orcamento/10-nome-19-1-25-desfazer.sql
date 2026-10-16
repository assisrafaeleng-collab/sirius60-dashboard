-- Sirius 60 — DESFAZ 10-nome-19-1-25.sql: volta o nome "Mão de obra de apoio (se houver necessidade)" da 19.1.25.
do $$
declare n int;
begin
  select count(*) into n from public.custos_indiretos_planejados
   where obra_id = 'sirius60' and codigo_eap = '19.1.25' and categoria = 'Funcionários diretos / impostos';
  if n <> 1 then raise exception 'esperava 1 linha 19.1.25 "Funcionários diretos / impostos" (achei %): nada foi feito', n; end if;
  update public.custos_indiretos_planejados set categoria = 'Mão de obra de apoio (se houver necessidade)'
   where obra_id = 'sirius60' and codigo_eap = '19.1.25';
end $$;

select codigo_eap, categoria, valor_total, reserva from public.custos_indiretos_planejados
 where obra_id = 'sirius60' and codigo_eap = '19.1.25';
