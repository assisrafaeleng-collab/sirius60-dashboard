-- =====================================================================
-- Sirius 60 — AVANÇO, PASSO 1: medição em % ACUMULADO (pedido 13). Rodar no SQL Editor (arquivo inteiro).
-- Desfazer: 1-medicao-acumulada-desfazer.sql
-- ORDEM: (1) promover o código do pedido 13 e conferir o site; (2) este SQL + conferência; (3) conferir de novo.
-- (O código lê a tabela nova quando ela existe; sem ela, usa os incrementos antigos — por isso vai antes.)
--
-- Hoje avanco_fisico_realizado guarda INCREMENTOS ("quanto avançou"). Este passo cria avanco_fisico_historico no
-- formato do Flats: um RETRATO ACUMULADO por linha de serviço (código + pavimento) — "a linha está em X%" — e vale
-- o último de cada linha até a semana (pode revisar para baixo). A tabela antiga NÃO é apagada nem alterada
-- (fica como histórico; backup avanco_fisico_realizado_bkp_20261008).
--
-- Carga a partir das 23 medições de 08/10/2026:
--   - incrementos somados por linha, na ordem semana, data, id (o mesmo cálculo do site antigo);
--   - as medições em linha de MATERIAL vão para a linha de SERVIÇO vinculada (orcamento_material_servico; CLAUDE.md
--     08/10): 2.1.3 → 2.1.6 (forma), 2.1.4 → 2.1.7 (armação), 2.1.5 → 2.1.8 (concretagem). O retrato do material
--     é o % ACUMULADO do material naquela data. Se o serviço já tem retrato próprio na MESMA data, vale o do serviço
--     (o do material era uma medição paralela do mesmo avanço; somar contaria duas vezes) e o do material não entra.
--     Conferido em 08/10: as 5 caem em datas em que o serviço tem medição própria → nenhuma muda o serviço.
--     Resultado: 23 medições → 18 retratos.
-- Tabela nova: RLS ligado, SEM política, SEM permissão para anon/authenticated (CLAUDE.md).
-- =====================================================================
begin;

do $$
declare n int; s numeric; neg int; passa int; mat_multi int;
begin
  if to_regclass('public.avanco_fisico_historico') is not null then
    raise exception 'avanco_fisico_historico já existe: este arquivo já foi rodado?';
  end if;
  if to_regclass('public.avanco_fisico_realizado_bkp_20261008') is not null then
    raise exception 'backup avanco_fisico_realizado_bkp_20261008 já existe: este arquivo já foi rodado?';
  end if;
  if to_regclass('public.orcamento_material_servico') is null then
    raise exception 'rode antes o supabase/orcamento/4-vinculo-material.sql';
  end if;
  select count(*), round(sum(incremento_pct), 4), count(*) filter (where incremento_pct < 0)
    into n, s, neg from public.avanco_fisico_realizado where obra_id = 'sirius60';
  if n <> 23 or s <> 1025.9 then
    raise exception 'avanco_fisico_realizado tem % medições somando % (esperado 23 e 1025,9 em 08/10/2026): confira antes', n, s;
  end if;
  if neg > 0 then raise exception '% incremento(s) negativo(s): a soma com teto de 100%% mudaria a ordem; confira antes', neg; end if;
  -- soma por linha não pode passar de 100% (o site antigo cortava em 100)
  select count(*) into passa from (
    select codigo_eap, pavimento from public.avanco_fisico_realizado where obra_id = 'sirius60'
     group by 1, 2 having sum(incremento_pct) > 100.0001) x;
  if passa > 0 then raise exception '% linha(s) somam mais de 100%%: confira antes', passa; end if;
  -- medição em material com mais de um serviço vinculado não tem destino único
  select count(*) into mat_multi from public.avanco_fisico_realizado r
    join public.orcamento_planejado o on o.obra_id = r.obra_id and o.codigo_eap = r.codigo_eap and o.pavimento = r.pavimento
   where r.obra_id = 'sirius60'
     and (select count(*) from public.orcamento_material_servico v where v.obra_id = 'sirius60' and v.material_id = o.id) > 1;
  if mat_multi > 0 then raise exception '% medição(ões) em material com mais de um serviço: decida o destino antes', mat_multi; end if;
  -- toda medição tem linha no orçamento e semana igual à do calendário pela data
  if exists (select 1 from public.avanco_fisico_realizado r where r.obra_id = 'sirius60' and not exists (
       select 1 from public.orcamento_planejado o where o.obra_id = 'sirius60' and o.codigo_eap = r.codigo_eap and o.pavimento = r.pavimento)) then
    raise exception 'há medição sem linha no orçamento (código + pavimento): confira antes';
  end if;
  if exists (select 1 from public.avanco_fisico_realizado r where r.obra_id = 'sirius60' and not exists (
       select 1 from public.calendario_semanas c where c.obra_id = 'sirius60' and c.semana_numero = r.semana_numero
          and r.data_lancamento::date between c.data_inicio and c.data_fim)) then
    raise exception 'há medição com semana diferente da do calendário: rode antes o supabase/semanas/3-medicoes-semanas.sql';
  end if;
end $$;

create table public.avanco_fisico_realizado_bkp_20261008 as
  select * from public.avanco_fisico_realizado where obra_id = 'sirius60';
alter table public.avanco_fisico_realizado_bkp_20261008 enable row level security;
revoke all on public.avanco_fisico_realizado_bkp_20261008 from anon, authenticated;

create table public.avanco_fisico_historico (
  id                    bigserial primary key,
  obra_id               text not null,
  codigo_eap            text not null,
  pavimento             text not null,
  percentual_realizado  numeric(9,4) not null check (percentual_realizado between 0 and 100),  -- ACUMULADO
  data_lancamento       date not null,                 -- data da medição (fuso de São Paulo)
  semana_numero         int  not null,                 -- semana do calendário (calendario_semanas) pela data
  competencia           text not null check (competencia ~ '^\d{4}-\d{2}$'),
  atividade_nome        text,
  grupo_num             int,
  hh_planejado          numeric(12,2),                 -- horas da linha no orçamento
  hh_realizado          numeric(12,2),                 -- hh_planejado × percentual
  medido_por            text,
  observacao            text,
  origem                text not null default 'tela' check (origem in ('tela', 'conversao')),
  origem_ids            bigint[],                      -- ids de avanco_fisico_realizado (conversão)
  transferido_de        text,                          -- material de onde veio a medição (conversão)
  criado_em             timestamptz not null default now(),
  editado_por           text,                          -- última edição pela tela (pedido 13D)
  editado_em            timestamptz,
  excluido_por          text,                          -- exclusão pela tela: a linha fica, mas deixa de valer
  excluido_em           timestamptz
);
create index avanco_fisico_historico_linha on public.avanco_fisico_historico (obra_id, codigo_eap, pavimento, semana_numero);
alter table public.avanco_fisico_historico enable row level security;
revoke all on public.avanco_fisico_historico from anon, authenticated;
revoke all on sequence public.avanco_fisico_historico_id_seq from anon, authenticated;

with lin as (           -- cada medição com a linha do orçamento e o serviço de destino
  select r.id, r.codigo_eap, r.pavimento, r.incremento_pct, r.data_lancamento::date as data, r.semana_numero,
         r.medido_por, r.observacao,
         coalesce(v.servico_codigo, r.codigo_eap) as dest_codigo,
         coalesce(v.servico_pavimento, r.pavimento) as dest_pav,
         case when v.material_id is not null then r.codigo_eap end as transferido_de
    from public.avanco_fisico_realizado r
    join public.orcamento_planejado o on o.obra_id = r.obra_id and o.codigo_eap = r.codigo_eap and o.pavimento = r.pavimento
    left join public.orcamento_material_servico v on v.obra_id = r.obra_id and v.material_id = o.id
   where r.obra_id = 'sirius60'
), acum as (            -- % acumulado da linha ORIGINAL (incrementos somados, teto 100)
  select lin.*,
         least(sum(incremento_pct) over (partition by codigo_eap, pavimento
                                          order by semana_numero, data, id rows unbounded preceding), 100) as perc
    from lin
), proprio as (         -- retrato do próprio serviço: o último da linha em cada data
  select distinct on (dest_codigo, dest_pav, data) *
    from acum where transferido_de is null
   order by dest_codigo, dest_pav, data, semana_numero desc, id desc
), transf as (          -- retrato vindo do material, só em data sem retrato próprio do serviço
  select distinct on (dest_codigo, dest_pav, data) a.*
    from acum a
   where a.transferido_de is not null
     and not exists (select 1 from acum p where p.transferido_de is null and p.dest_codigo = a.dest_codigo
                        and p.dest_pav = a.dest_pav and p.data = a.data)
   order by dest_codigo, dest_pav, data, semana_numero desc, id desc
), juntos as (
  select x.*, (select array_agg(id order by id) from acum y
                where y.dest_codigo = x.dest_codigo and y.dest_pav = x.dest_pav and y.data = x.data
                  and (y.transferido_de is null) = (x.transferido_de is null)) as ids
    from (select * from proprio union all select * from transf) x
)
insert into public.avanco_fisico_historico (obra_id, codigo_eap, pavimento, percentual_realizado, data_lancamento,
  semana_numero, competencia, atividade_nome, grupo_num, hh_planejado, hh_realizado, medido_por, observacao,
  origem, origem_ids, transferido_de)
select 'sirius60', j.dest_codigo, j.dest_pav, j.perc, j.data, j.semana_numero, to_char(j.data, 'YYYY-MM'),
       o.descricao, o.grupo_num, o.hh, round(o.hh * j.perc / 100, 2), j.medido_por, j.observacao,
       'conversao', j.ids, j.transferido_de
  from juntos j
  join public.orcamento_planejado o on o.obra_id = 'sirius60' and o.codigo_eap = j.dest_codigo and o.pavimento = j.dest_pav
 order by j.semana_numero, j.data, j.transferido_de nulls last, j.ids[1];

do $$
declare n int; t int; ult numeric;
begin
  select count(*), count(*) filter (where transferido_de is not null) into n, t
    from public.avanco_fisico_historico where obra_id = 'sirius60';
  if n <> 18 or t <> 0 then
    raise exception 'conversão gerou % retratos (% transferidos); esperado 18 e 0 em 08/10/2026: nada foi gravado', n, t;
  end if;
  -- último % de cada serviço da fundação = o de antes (forma 50, armação 70, concretagem 50, escavação 60)
  if (select count(*) from (
        select distinct on (codigo_eap) codigo_eap, percentual_realizado from public.avanco_fisico_historico
         where obra_id = 'sirius60' and codigo_eap in ('2.1.2', '2.1.6', '2.1.7', '2.1.8')
         order by codigo_eap, semana_numero desc, data_lancamento desc, id desc) u
       where (codigo_eap, percentual_realizado) in (('2.1.2', 60), ('2.1.6', 50), ('2.1.7', 70), ('2.1.8', 50))) <> 4 then
    raise exception 'último %% dos serviços da fundação diferente do esperado: nada foi gravado';
  end if;
  if exists (select 1 from public.avanco_fisico_historico h join public.orcamento_material_servico v
               on v.obra_id = h.obra_id and v.material_codigo = h.codigo_eap and v.material_pavimento = h.pavimento
              where h.obra_id = 'sirius60') then
    raise exception 'ficou retrato em linha de material: nada foi gravado';
  end if;
end $$;

commit;

-- Conferência 1: tabela final (código | pavimento | serviço | % acumulado | data | semana)
select h.codigo_eap, h.pavimento, left(h.atividade_nome, 50) as servico, h.percentual_realizado as perc_acumulado,
       h.data_lancamento, h.semana_numero, h.transferido_de, h.origem_ids
  from public.avanco_fisico_historico h where h.obra_id = 'sirius60'
 order by h.codigo_eap, h.pavimento, h.semana_numero, h.data_lancamento, h.id;
-- Conferência 2: as medições de material e onde ficaram
select r.id, r.codigo_eap as material, r.data_lancamento, r.incremento_pct, v.servico_codigo as servico,
       (select h.percentual_realizado from public.avanco_fisico_historico h where h.obra_id = 'sirius60'
         and h.codigo_eap = v.servico_codigo and h.pavimento = v.servico_pavimento and h.data_lancamento = r.data_lancamento::date
         order by h.id desc limit 1) as perc_do_servico_na_data
  from public.avanco_fisico_realizado r
  join public.orcamento_planejado o on o.obra_id = r.obra_id and o.codigo_eap = r.codigo_eap and o.pavimento = r.pavimento
  join public.orcamento_material_servico v on v.obra_id = r.obra_id and v.material_id = o.id
 where r.obra_id = 'sirius60' order by r.data_lancamento, r.id;
-- Conferência 3: avanço físico por horas (último % de cada linha × horas ÷ horas de produção) — deve dar 4,71%
-- no site (S11); aqui só as linhas medidas, sem a herança do material (essa o site calcula).
select round(sum(u.hh_realizado), 1) as horas_medidas
  from (select distinct on (codigo_eap, pavimento) hh_realizado from public.avanco_fisico_historico
         where obra_id = 'sirius60' order by codigo_eap, pavimento, semana_numero desc, data_lancamento desc, id desc) u;
