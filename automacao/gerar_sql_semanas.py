"""
Gera os SQLs do calendário e das semanas do orçamento a partir das saídas do cronograma.py (não roda nada).
Uso: py gerar_sql_semanas.py [--saida saida_v2] [--destino ../supabase/semanas]
Lê: calendario_semanas.csv, curva_s_planejada.csv, eap_cronograma.csv, orcamento_banco.csv
Escreve: 1-calendario.sql, 1-calendario-desfazer.sql, 2-semanas-orcamento.sql, 2-semanas-orcamento-desfazer.sql
"""
import argparse, os
import pandas as pd

OBRA = 'sirius60'
BKP = 'orcamento_semanas_bkp_20261008'

ap = argparse.ArgumentParser()
ap.add_argument('--saida', default='saida_v2')
ap.add_argument('--destino', default='../supabase/semanas')
a = ap.parse_args()
cal = pd.read_csv(os.path.join(a.saida, 'calendario_semanas.csv'))
cs = pd.read_csv(os.path.join(a.saida, 'curva_s_planejada.csv'))
lig = pd.read_csv(os.path.join(a.saida, 'eap_cronograma.csv'), dtype={'codigo_eap': str})
orc = pd.read_csv(os.path.join(a.saida, 'orcamento_banco.csv'), dtype={'codigo_eap': str})
os.makedirs(a.destino, exist_ok=True)
N = len(cal)
meses = {m: i + 1 for i, m in enumerate(sorted(cal.competencia.unique()))}
br = lambda d: f'{d[8:10]}/{d[5:7]}'

cal_vals = ',\n'.join(
    f"  ('{OBRA}', {r.semana_numero}, '{r.data_inicio}', '{r.data_fim}', {r.dias}, '{r.competencia}', {meses[r.competencia]}, "
    f"{r.semana_do_mes}, {str(bool(r.fechamento)).lower()}, 'S{r.semana_numero:02d} {br(r.data_inicio)}–{br(r.data_fim)}')"
    for r in cal.itertuples())
cs_vals = ',\n'.join(
    f"  ('{OBRA}', {r.semana_numero}, '{r.competencia}', {r.horas:.4f}, {r.pct_horas:.6f}, {r.pct_horas_acum:.6f}, "
    f"{r.valor:.2f}, {r.valor_acum:.2f}, {r.pct_valor_acum:.6f})"
    for r in cs.itertuples())
tot_h, tot_v = round(cs.horas.sum(), 1), round(cs.valor.sum(), 2)

open(os.path.join(a.destino, '1-calendario.sql'), 'w', encoding='utf-8').write(f"""-- =====================================================================
-- Sirius 60 — SEMANAS, PASSO 1: calendário real e curva S planejada (gerado por automacao/gerar_sql_semanas.py)
-- Rodar no SQL Editor (arquivo inteiro). Desfazer: 1-calendario-desfazer.sql
-- Ordem: código do site que lê estas tabelas → promover → este SQL → 2-semanas-orcamento.sql.
--
-- calendario_semanas: {N} semanas, 03/08/2026 a 31/07/2028 (CLAUDE.md: segunda a domingo, cortada no fim do mês,
--   cada mês começa semana nova, fragmento de 1 dia junta com a vizinha do mesmo mês; S01 = 03/08/2026).
-- curva_s_semanal_planejada: cronograma final (13-08-26, aba "Cronograma") espalhado pelos dias reais de cada mês
--   (mês M do cronograma = mês do calendário). Horas: {tot_h:,.1f} h; valor das linhas ligadas: R$ {tot_v:,.2f}.
-- Tabelas novas: RLS ligado, SEM política, SEM permissão para anon/authenticated (CLAUDE.md).
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.calendario_semanas') is not null or to_regclass('public.curva_s_semanal_planejada') is not null then
    raise exception 'calendario_semanas ou curva_s_semanal_planejada já existe: nada foi feito';
  end if;
end $$;

create table public.calendario_semanas (
  id             bigserial primary key,
  obra_id        text not null,
  semana_numero  int  not null,
  data_inicio    date not null,
  data_fim       date not null,
  dias           int  not null check (dias between 1 and 8),
  competencia    text not null check (competencia ~ '^\\d{{4}}-\\d{{2}}$'),
  mes_numero     int  not null,            -- M01 = ago/2026
  semana_do_mes  int  not null,
  fechamento     boolean not null default false,   -- última semana do mês
  label          text,
  unique (obra_id, semana_numero),
  check (data_fim >= data_inicio)
);

create table public.curva_s_semanal_planejada (
  id              bigserial primary key,
  obra_id         text not null,
  semana_numero   int  not null,
  competencia     text not null,
  hh_semanal      numeric(12,4) not null,
  perc_hh_semanal numeric(12,6) not null,
  perc_hh_acum    numeric(12,6) not null,
  valor_semanal   numeric(14,2) not null,
  valor_acum      numeric(14,2) not null,
  perc_valor_acum numeric(12,6) not null,
  unique (obra_id, semana_numero)
);

alter table public.calendario_semanas enable row level security;
alter table public.curva_s_semanal_planejada enable row level security;
revoke all on public.calendario_semanas from anon, authenticated;
revoke all on public.curva_s_semanal_planejada from anon, authenticated;
revoke all on sequence public.calendario_semanas_id_seq from anon, authenticated;
revoke all on sequence public.curva_s_semanal_planejada_id_seq from anon, authenticated;

insert into public.calendario_semanas (obra_id, semana_numero, data_inicio, data_fim, dias, competencia, mes_numero,
  semana_do_mes, fechamento, label) values
{cal_vals};

insert into public.curva_s_semanal_planejada (obra_id, semana_numero, competencia, hh_semanal, perc_hh_semanal,
  perc_hh_acum, valor_semanal, valor_acum, perc_valor_acum) values
{cs_vals};

do $$
declare n int; d int; ac numeric;
begin
  select count(*), sum(dias) into n, d from public.calendario_semanas where obra_id = '{OBRA}';
  if n <> {N} or d <> {int(cal.dias.sum())} then raise exception 'calendário: % semanas / % dias (esperado {N} / {int(cal.dias.sum())})', n, d; end if;
  select max(perc_hh_acum) into ac from public.curva_s_semanal_planejada where obra_id = '{OBRA}';
  if round(ac, 3) <> 100 then raise exception 'curva S não fecha em 100%% (%)', ac; end if;
end $$;

commit;

-- Conferência
select competencia, count(*) as semanas, sum(dias) as dias, min(semana_numero) as de, max(semana_numero) as ate
  from public.calendario_semanas where obra_id = '{OBRA}' group by competencia order by competencia;
select semana_numero, competencia, round(perc_hh_acum, 2) as perc_hh_acum, valor_acum
  from public.curva_s_semanal_planejada where obra_id = '{OBRA}' and semana_numero in (4, 9, 14, {N}) order by 1;
""")

open(os.path.join(a.destino, '1-calendario-desfazer.sql'), 'w', encoding='utf-8').write(f"""-- =====================================================================
-- Sirius 60 — DESFAZER o passo 1 das semanas (1-calendario.sql)
-- Rodar SÓ depois de desfazer o passo 2 (2-semanas-orcamento-desfazer.sql) e de voltar o código do site.
-- Apaga as duas tabelas criadas pelo passo 1 (não há outro dado nelas).
-- =====================================================================
begin;
drop table if exists public.curva_s_semanal_planejada;
drop table if exists public.calendario_semanas;
commit;

select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('calendario_semanas', 'curva_s_semanal_planejada');
""")

# ---- passo 2: semanas do orçamento pela ligação com o cronograma
lig = lig.merge(orc[['id', 'semana_inicio', 'semana_fim']], on='id', suffixes=('', '_atual'))
def nova(r):
    if pd.notna(r.semana_inicio_real):
        return int(r.semana_inicio_real), int(r.semana_fim_real)
    return 1, N      # custo de tempo (1.1.6, grupos 17 e 18): a obra toda
lig[['ini_novo', 'fim_novo']] = lig.apply(lambda r: pd.Series(nova(r)), axis=1)
vals = ',\n'.join(f"  ({r.id}, '{r.codigo_eap}', {int(r.semana_inicio_atual)}, {int(r.semana_fim_atual)}, {r.ini_novo}, {r.fim_novo})"
                  f"{'  -- ' + r.regra[:60] if str(r.regra).startswith(('SUGERIDO', 'custo')) else ''}"
                  for r in lig.sort_values('id').itertuples())
vals = vals.replace('),  --', '), --')
# vírgula antes do comentário
linhas = []
for i, r in enumerate(lig.sort_values('id').itertuples()):
    sep = ',' if i < len(lig) - 1 else ''
    com = f"  -- {r.regra[:70]}" if str(r.regra).startswith(('SUGERIDO', 'custo')) else ''
    linhas.append(f"  ({r.id}, '{r.codigo_eap}', {int(r.semana_inicio_atual)}, {int(r.semana_fim_atual)}, {r.ini_novo}, {r.fim_novo}){sep}{com}")
vals = '\n'.join(linhas)
open(os.path.join(a.destino, '2-semanas-orcamento.sql'), 'w', encoding='utf-8').write(f"""-- =====================================================================
-- Sirius 60 — SEMANAS, PASSO 2: semana_inicio/semana_fim do orçamento no calendário real (gerado por gerar_sql_semanas.py)
-- Rodar DEPOIS do 1-calendario.sql e do código do site que usa o calendário novo. Desfazer: 2-semanas-orcamento-desfazer.sql
--
-- Cada linha do orçamento ganha as semanas REAIS (S01..S{N}) da atividade do cronograma a que está ligada
-- (automacao/saida_v2/eap_cronograma.csv): da semana real que contém o início da atividade até a que contém o fim.
-- Custo de tempo (1.1.6, grupos 17 e 18): S01 a S{N} (a obra toda, 24 meses).
-- Escada da fundação (2.1.10 a 2.1.13): ligação SUGERIDA ao piso da fundação (2.1.5 do cronograma); confirmar.
-- Antes de mudar: backup (id, código, pavimento, semanas atuais) em {BKP}. Preço, horas e códigos não mudam.
-- custos_indiretos_planejados (semana_desembolso/semana_fim) NÃO é tratado aqui.
-- =====================================================================
begin;

do $$
declare n int; total numeric;
begin
  if to_regclass('public.calendario_semanas') is null then
    raise exception 'rode antes o 1-calendario.sql';
  end if;
  if to_regclass('public.{BKP}') is not null then
    raise exception '{BKP} já existe: este arquivo já foi rodado?';
  end if;
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = '{OBRA}';
  if n <> {len(orc)} then raise exception 'orcamento_planejado tem % linhas (esperado {len(orc)}): nada foi feito', n; end if;
end $$;

create table public.{BKP} as
  select id, codigo_eap, pavimento, semana_inicio, semana_fim
    from public.orcamento_planejado where obra_id = '{OBRA}';
alter table public.{BKP} enable row level security;
revoke all on public.{BKP} from anon, authenticated;

-- (id, código, semana_inicio atual, semana_fim atual, semana_inicio nova, semana_fim nova)
update public.orcamento_planejado as o
   set semana_inicio = v.ini_novo, semana_fim = v.fim_novo
  from (values
{vals}
  ) as v(id, codigo, ini_atual, fim_atual, ini_novo, fim_novo)
 where o.id = v.id and o.obra_id = '{OBRA}' and o.codigo_eap = v.codigo
   and o.semana_inicio = v.ini_atual and o.semana_fim = v.fim_atual;

do $$
declare n int; fora int;
begin
  select count(*) into n from public.orcamento_planejado o join public.{BKP} b using (id)
   where (o.semana_inicio, o.semana_fim) is distinct from (b.semana_inicio, b.semana_fim);
  select count(*) into fora from public.orcamento_planejado
   where obra_id = '{OBRA}' and (semana_inicio < 1 or semana_fim > {N} or semana_fim < semana_inicio);
  if fora > 0 then raise exception '% linha(s) com semanas fora de S01..S{N}: nada foi gravado', fora; end if;
  raise notice '% linha(s) com semanas alteradas', n;
end $$;

commit;

-- Conferência: semanas por grupo (antes × depois)
select o.grupo_num, min(b.semana_inicio) as ini_antes, max(b.semana_fim) as fim_antes,
       min(o.semana_inicio) as ini_depois, max(o.semana_fim) as fim_depois, count(*) as linhas
  from public.orcamento_planejado o join public.{BKP} b using (id)
 where o.obra_id = '{OBRA}' group by o.grupo_num order by o.grupo_num;
""")

open(os.path.join(a.destino, '2-semanas-orcamento-desfazer.sql'), 'w', encoding='utf-8').write(f"""-- =====================================================================
-- Sirius 60 — DESFAZER o passo 2 das semanas: devolve semana_inicio/semana_fim do backup {BKP}
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.{BKP}') is null then
    raise exception 'backup {BKP} não existe: nada foi feito';
  end if;
end $$;

update public.orcamento_planejado as o
   set semana_inicio = b.semana_inicio, semana_fim = b.semana_fim
  from public.{BKP} as b
 where o.id = b.id and o.obra_id = '{OBRA}';

commit;

-- Conferência: deve vir VAZIA
select o.id from public.orcamento_planejado o join public.{BKP} b using (id)
 where (o.semana_inicio, o.semana_fim) is distinct from (b.semana_inicio, b.semana_fim);

-- Depois de conferir o site, o backup pode ser apagado (só com autorização):
-- drop table public.{BKP};
""")
print('ok:', a.destino, '| semanas', N, '| linhas do orçamento', len(lig),
      '| alteradas', int(((lig.ini_novo != lig.semana_inicio_atual) | (lig.fim_novo != lig.semana_fim_atual)).sum()))
