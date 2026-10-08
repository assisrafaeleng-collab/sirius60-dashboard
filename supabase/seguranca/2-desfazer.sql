-- =====================================================================
-- Sirius 60 — DESFAZER o 1-fechar-acesso.sql
-- Volta ao estado de 07/10/2026 (consultas 1, 2 e 3 do diagnóstico).
-- Só rodar se o site quebrar depois do fechamento.
-- =====================================================================
begin;

-- Permissões como estavam (todas para anon e authenticated)
grant all on all tables    in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
alter default privileges for role postgres in schema public grant all on tables    to anon, authenticated;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;

-- Leitura pública
create policy leitura_publica on public.avanco_fisico_realizado     for select to anon, authenticated using (true);
create policy leitura_publica on public.cronograma_horas_planejado  for select to anon, authenticated using (true);
create policy leitura_publica on public.custos_indiretos_planejados for select to anon, authenticated using (true);
create policy leitura_publica on public.custos_lancamentos          for select to anon, authenticated using (true);
create policy leitura_publica on public.ocorrencias_obra            for select to anon, authenticated using (true);
create policy leitura_publica on public.orcamento_planejado         for select to anon, authenticated using (true);

-- Escrita pela chave pública
create policy medicao_escrita    on public.avanco_fisico_realizado for all to anon, authenticated
  using (obra_id = 'sirius60') with check (obra_id = 'sirius60');
create policy lancamento_escrita on public.custos_lancamentos      for all to anon, authenticated
  using (obra_id = 'sirius60') with check (obra_id = 'sirius60');
create policy ocorrencia_escrita on public.ocorrencias_obra        for all to anon, authenticated
  using (obra_id = 'sirius60') with check (obra_id = 'sirius60');

-- Views como estavam
alter view public.v_avanco_acumulado             set (security_invoker = off);
alter view public.v_curva_s_financeira_planejada set (security_invoker = off);
alter view public.v_curva_s_fisica_planejada     set (security_invoker = off);
alter view public.v_produtividade                set (security_invoker = off);

commit;
