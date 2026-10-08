"""
Gera os SQLs do calendário e das semanas do orçamento a partir das saídas do cronograma.py (não roda nada).
Uso: py gerar_sql_semanas.py [--saida saida_v2] [--destino ../supabase/semanas] [--orcamento orcamento_banco_pos3.csv]
Lê (em --saida): calendario_semanas.csv, curva_s_planejada.csv, eap_cronograma.csv, o orçamento exportado do banco
     no estado em que estará quando o passo 2 rodar (padrão: orcamento_banco_pos3.csv, depois do 3-pilotis-subsolo),
     indiretos_semanas.csv e medicoes_banco.csv (id, codigo_eap, pavimento, semana_numero, data_lancamento)
Escreve: 1-calendario.sql, 2-semanas-orcamento.sql e 3-medicoes-semanas.sql, cada um com o seu -desfazer.sql
"""
import argparse, os
import pandas as pd

OBRA = 'sirius60'
BKP = 'orcamento_semanas_bkp_20261008'
BKP_IND = 'indiretos_semanas_bkp_20261008'
BKP_MED = 'medicoes_semanas_bkp_20261008'

ap = argparse.ArgumentParser()
ap.add_argument('--saida', default='saida_v2')
ap.add_argument('--destino', default='../supabase/semanas')
ap.add_argument('--orcamento', default='orcamento_banco_pos3.csv')
a = ap.parse_args()
cal = pd.read_csv(os.path.join(a.saida, 'calendario_semanas.csv'))
cs = pd.read_csv(os.path.join(a.saida, 'curva_s_planejada.csv'))
lig = pd.read_csv(os.path.join(a.saida, 'eap_cronograma.csv'), dtype={'codigo_eap': str})
orc = pd.read_csv(os.path.join(a.saida, a.orcamento), dtype={'codigo_eap': str})
ind = pd.read_csv(os.path.join(a.saida, 'indiretos_semanas.csv'), dtype={'codigo_eap': str})
med = pd.read_csv(os.path.join(a.saida, 'medicoes_banco.csv'), dtype={'codigo_eap': str})
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
-- Ordem: código do site (com fallback) → promover → 3-pilotis-subsolo (orçamento) → este SQL → 2-semanas-orcamento
-- → 3-medicoes-semanas.
--
-- calendario_semanas: {N} semanas, 03/08/2026 a 31/07/2028 (CLAUDE.md: segunda a domingo, cortada no fim do mês,
--   cada mês começa semana nova, fragmento de 1 dia junta com a vizinha do mesmo mês; S01 = 03/08/2026).
-- curva_s_semanal_planejada: cronograma final (13-08-26, aba "Cronograma") espalhado pelos dias reais de cada mês
--   (mês M do cronograma = mês do calendário). Horas: {tot_h:,.1f} h; valor das linhas ligadas: R$ {tot_v:,.2f}.
--   Dentro da estrutura de cada pavimento, cada serviço na sua janela (pedido 12): armação → forma (meia semana
--   depois, junto) → laje treliçada → concretagem 30% pilares / 70% laje → escada na última semana.
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

# ---- passo 2: semanas do orçamento (ligação com o cronograma) e dos indiretos
lig = lig.merge(orc[['id', 'semana_inicio', 'semana_fim']], on='id', suffixes=('', '_atual'))
def nova(r):
    if pd.notna(r.semana_inicio_real):
        return int(r.semana_inicio_real), int(r.semana_fim_real)
    return 1, N      # custo de tempo (1.1.6, grupos 17 e 18): a obra toda
lig[['ini_novo', 'fim_novo']] = lig.apply(lambda r: pd.Series(nova(r)), axis=1)
linhas = []
for i, r in enumerate(lig.sort_values('id').itertuples()):
    sep = ',' if i < len(lig) - 1 else ''
    com = f"  -- {r.regra[:70]}" if str(r.regra).startswith(('ESCADA', 'custo')) else ''
    linhas.append(f"  ({r.id}, '{r.codigo_eap}', {int(r.semana_inicio_atual)}, {int(r.semana_fim_atual)}, {r.ini_novo}, {r.fim_novo}){sep}{com}")
vals = '\n'.join(linhas)
ind_vals = ',\n'.join(
    f"  ({r.id}, '{r.codigo_eap}', {int(r.semana_antiga_ini)}, {int(r.semana_antiga_fim)}, {int(r.semana_nova_ini)}, {int(r.semana_nova_fim)})"
    f"  -- {'recorrente: diluído' if str(r.recorrente).lower() == 'true' else 'pontual: ' + r.como}"
    for r in ind.sort_values('id').itertuples())
# a vírgula tem de vir antes do comentário
ind_vals = '\n'.join(l.replace(')  --', '),  --', 1) if k < len(ind) - 1 else l for k, l in enumerate(ind_vals.split(',\n')))
open(os.path.join(a.destino, '2-semanas-orcamento.sql'), 'w', encoding='utf-8').write(f"""-- =====================================================================
-- Sirius 60 — SEMANAS, PASSO 2: semanas do orçamento e dos indiretos no calendário real (gerado por gerar_sql_semanas.py)
-- Rodar DEPOIS do 3-pilotis-subsolo.sql (orçamento) e do 1-calendario.sql. Desfazer: 2-semanas-orcamento-desfazer.sql
--
-- orcamento_planejado: cada linha ganha as semanas REAIS (S01..S{N}) da sua janela dentro da atividade do cronograma
--   a que está ligada (automacao/saida_v2/eap_cronograma.csv, coluna janelas): da semana real que contém o início da
--   janela até a que contém o fim. Estrutura de cada pavimento (pedido 12, 8 semanas): armação/aço sem. 1–6; forma
--   (MO e material) da metade da sem. 1 até a 7; laje treliçada 5–7; concretagem (lançamento e concreto usinado)
--   30% pilares na sem. 4 e 70% laje na sem. 8 (a linha vai da sem. 4 à 8); Reservatório (4 semanas) na mesma ordem.
--   Fundação 2.1.3 (forma + armação): armação desde o início, forma meia semana depois.
--   Encunhamento (4.x.3 / 4.x.4, Rafael 08/10): começa na semana real seguinte ao FIM da alvenaria do mesmo
--   pavimento, com 2 semanas de duração em todos os pavimentos (Rafael, 08/10). Horas e valores não mudam.
--   Escadas (2.1.10 a 2.1.13 e as escadas de cada pavimento): só a ÚLTIMA semana da estrutura do pavimento
--   (fundação: última semana da concretagem de blocos/tubulões, 2.1.4 do cronograma).
--   Custo de tempo (1.1.6, grupos 17 e 18): S01 a S{N} (a obra toda, 24 meses).
--   A "semana atual" esperada de cada linha é a de DEPOIS do 3-pilotis-subsolo.sql (4.1.x/4.2.x trocadas).
-- custos_indiretos_planejados: recorrentes diluídos de S01 a S{N}; pontuais nas semanas novas que contêm as datas
--   das semanas antigas (7 dias corridos desde 03/08/2026).
-- Antes de mudar: backups {BKP} e {BKP_IND}. Preço, horas e códigos não mudam.
-- =====================================================================
begin;

do $$
declare n int;
begin
  if to_regclass('public.calendario_semanas') is null then
    raise exception 'rode antes o 1-calendario.sql';
  end if;
  if to_regclass('public.{BKP}') is not null or to_regclass('public.{BKP_IND}') is not null then
    raise exception 'backup de semanas já existe: este arquivo já foi rodado?';
  end if;
  select count(*) into n from public.orcamento_planejado where obra_id = '{OBRA}';
  if n <> {len(orc)} then raise exception 'orcamento_planejado tem % linhas (esperado {len(orc)}): nada foi feito', n; end if;
  if not exists (select 1 from public.orcamento_planejado where id = 747 and codigo_eap = '4.1.1' and preco_total = 13901.95) then
    raise exception 'rode antes o supabase/orcamento/3-pilotis-subsolo.sql (4.1.1 Pilotis ainda não tem 143,26 m²)';
  end if;
end $$;

create table public.{BKP} as
  select id, codigo_eap, pavimento, semana_inicio, semana_fim
    from public.orcamento_planejado where obra_id = '{OBRA}';
create table public.{BKP_IND} as
  select id, codigo_eap, semana_desembolso, semana_fim
    from public.custos_indiretos_planejados where obra_id = '{OBRA}';
alter table public.{BKP} enable row level security;
alter table public.{BKP_IND} enable row level security;
revoke all on public.{BKP} from anon, authenticated;
revoke all on public.{BKP_IND} from anon, authenticated;

-- orçamento: (id, código, semana_inicio atual, semana_fim atual, semana_inicio nova, semana_fim nova)
update public.orcamento_planejado as o
   set semana_inicio = v.ini_novo, semana_fim = v.fim_novo
  from (values
{vals}
  ) as v(id, codigo, ini_atual, fim_atual, ini_novo, fim_novo)
 where o.id = v.id and o.obra_id = '{OBRA}' and o.codigo_eap = v.codigo
   and o.semana_inicio = v.ini_atual and o.semana_fim = v.fim_atual;

-- indiretos: (id, código, semana antiga início, fim, semana nova início, fim)
update public.custos_indiretos_planejados as i
   set semana_desembolso = v.ini_novo, semana_fim = v.fim_novo
  from (values
{ind_vals}
  ) as v(id, codigo, ini_atual, fim_atual, ini_novo, fim_novo)
 where i.id = v.id and i.obra_id = '{OBRA}' and i.codigo_eap = v.codigo
   and i.semana_desembolso = v.ini_atual and i.semana_fim = v.fim_atual;

do $$
declare n int; m int; fora int;
begin
  select count(*) into n from public.orcamento_planejado o join public.{BKP} b using (id)
   where (o.semana_inicio, o.semana_fim) is distinct from (b.semana_inicio, b.semana_fim);
  if n <> {int(((lig.ini_novo != lig.semana_inicio_atual) | (lig.fim_novo != lig.semana_fim_atual)).sum())} then
    raise exception 'orçamento: % linha(s) mudaram (esperado {int(((lig.ini_novo != lig.semana_inicio_atual) | (lig.fim_novo != lig.semana_fim_atual)).sum())}): nada foi gravado', n;
  end if;
  select count(*) into m from public.custos_indiretos_planejados where obra_id = '{OBRA}' and semana_fim = {N};
  if m <> {int((ind.semana_nova_fim == N).sum())} then
    raise exception 'indiretos: % recorrente(s) até S{N} (esperado {int((ind.semana_nova_fim == N).sum())}): nada foi gravado', m;
  end if;
  select count(*) into fora from public.orcamento_planejado
   where obra_id = '{OBRA}' and (semana_inicio < 1 or semana_fim > {N} or semana_fim < semana_inicio);
  if fora > 0 then raise exception '% linha(s) com semanas fora de S01..S{N}: nada foi gravado', fora; end if;
end $$;

commit;

-- Conferência 1: semanas por grupo (antes × depois)
select o.grupo_num, min(b.semana_inicio) as ini_antes, max(b.semana_fim) as fim_antes,
       min(o.semana_inicio) as ini_depois, max(o.semana_fim) as fim_depois, count(*) as linhas
  from public.orcamento_planejado o join public.{BKP} b using (id)
 where o.obra_id = '{OBRA}' group by o.grupo_num order by o.grupo_num;
-- Conferência 2: indiretos (antes × depois)
select i.codigo_eap, i.categoria, i.recorrente, b.semana_desembolso as ini_antes, b.semana_fim as fim_antes,
       i.semana_desembolso as ini_depois, i.semana_fim as fim_depois
  from public.custos_indiretos_planejados i join public.{BKP_IND} b using (id) order by i.codigo_eap;
""")

open(os.path.join(a.destino, '2-semanas-orcamento-desfazer.sql'), 'w', encoding='utf-8').write(f"""-- =====================================================================
-- Sirius 60 — DESFAZER o passo 2 das semanas: devolve as semanas do orçamento e dos indiretos dos backups
-- {BKP} e {BKP_IND}
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.{BKP}') is null or to_regclass('public.{BKP_IND}') is null then
    raise exception 'backup de semanas não existe: nada foi feito';
  end if;
end $$;

update public.orcamento_planejado as o
   set semana_inicio = b.semana_inicio, semana_fim = b.semana_fim
  from public.{BKP} as b
 where o.id = b.id and o.obra_id = '{OBRA}';

update public.custos_indiretos_planejados as i
   set semana_desembolso = b.semana_desembolso, semana_fim = b.semana_fim
  from public.{BKP_IND} as b
 where i.id = b.id and i.obra_id = '{OBRA}';

commit;

-- Conferência: as duas consultas devem vir VAZIAS
select o.id from public.orcamento_planejado o join public.{BKP} b using (id)
 where (o.semana_inicio, o.semana_fim) is distinct from (b.semana_inicio, b.semana_fim);
select i.id from public.custos_indiretos_planejados i join public.{BKP_IND} b using (id)
 where (i.semana_desembolso, i.semana_fim) is distinct from (b.semana_desembolso, b.semana_fim);

-- Depois de conferir o site, os backups podem ser apagados (só com autorização):
-- drop table public.{BKP};
-- drop table public.{BKP_IND};
""")

# ---- passo 3: medições renumeradas pela DATA no calendário novo
med['data'] = pd.to_datetime(med.data_lancamento).dt.date
med['nova'] = [int(cal[(pd.to_datetime(cal.data_inicio).dt.date <= d) & (pd.to_datetime(cal.data_fim).dt.date >= d)].semana_numero.iloc[0])
               for d in med.data]
mudam = int((med.nova != med.semana_numero).sum())
open(os.path.join(a.destino, '3-medicoes-semanas.sql'), 'w', encoding='utf-8').write(f"""-- =====================================================================
-- Sirius 60 — SEMANAS, PASSO 3: semana_numero das medições pelo calendário novo (gerado por gerar_sql_semanas.py)
-- Rodar DEPOIS do 1-calendario.sql. Desfazer: 3-medicoes-semanas-desfazer.sql
--
-- Cada medição recebe a semana do calendário novo que contém a DATA da medição (data_lancamento). Nada de
-- deslocar número. Conferido em 08/10/2026: {len(med)} medições, todas com data; {mudam} mudam de número
-- (as semanas S1–S9 antigas e novas coincidem nas datas medidas até hoje).
-- Backup (id, semana_numero, data_lancamento) em {BKP_MED}.
-- =====================================================================
begin;

do $$
declare n int; sem_data int;
begin
  if to_regclass('public.calendario_semanas') is null then raise exception 'rode antes o 1-calendario.sql'; end if;
  if to_regclass('public.{BKP_MED}') is not null then raise exception '{BKP_MED} já existe: este arquivo já foi rodado?'; end if;
  select count(*), count(*) filter (where data_lancamento is null) into n, sem_data
    from public.avanco_fisico_realizado where obra_id = '{OBRA}';
  if sem_data > 0 then raise exception '% medição(ões) sem data_lancamento: nada foi feito', sem_data; end if;
  if exists (select 1 from public.avanco_fisico_realizado a where a.obra_id = '{OBRA}' and not exists (
       select 1 from public.calendario_semanas c where c.obra_id = '{OBRA}' and a.data_lancamento between c.data_inicio and c.data_fim)) then
    raise exception 'há medição com data fora do calendário: nada foi feito';
  end if;
end $$;

create table public.{BKP_MED} as
  select id, semana_numero, data_lancamento from public.avanco_fisico_realizado where obra_id = '{OBRA}';
alter table public.{BKP_MED} enable row level security;
revoke all on public.{BKP_MED} from anon, authenticated;

update public.avanco_fisico_realizado as a
   set semana_numero = c.semana_numero
  from public.calendario_semanas as c
 where a.obra_id = '{OBRA}' and c.obra_id = '{OBRA}' and a.data_lancamento between c.data_inicio and c.data_fim
   and a.semana_numero is distinct from c.semana_numero;

commit;

-- Conferência: medições por semana nova (com o intervalo de datas da semana)
select a.semana_numero, c.label, count(*) as medicoes, min(a.data_lancamento) as de, max(a.data_lancamento) as ate
  from public.avanco_fisico_realizado a join public.calendario_semanas c
    on c.obra_id = a.obra_id and c.semana_numero = a.semana_numero
 where a.obra_id = '{OBRA}' group by a.semana_numero, c.label order by 1;
""")
open(os.path.join(a.destino, '3-medicoes-semanas-desfazer.sql'), 'w', encoding='utf-8').write(f"""-- =====================================================================
-- Sirius 60 — DESFAZER o passo 3 das semanas: devolve semana_numero das medições do backup {BKP_MED}
-- Medição lançada DEPOIS do passo 3 não está no backup e não é alterada.
-- =====================================================================
begin;
do $$ begin
  if to_regclass('public.{BKP_MED}') is null then raise exception 'backup {BKP_MED} não existe: nada foi feito'; end if;
end $$;
update public.avanco_fisico_realizado as a
   set semana_numero = b.semana_numero
  from public.{BKP_MED} as b
 where a.id = b.id and a.obra_id = '{OBRA}';
commit;

-- Conferência: deve vir VAZIA
select a.id from public.avanco_fisico_realizado a join public.{BKP_MED} b using (id) where a.semana_numero <> b.semana_numero;
""")
print('ok:', a.destino, '| semanas', N, '| linhas do orçamento', len(lig),
      '| alteradas', int(((lig.ini_novo != lig.semana_inicio_atual) | (lig.fim_novo != lig.semana_fim_atual)).sum()),
      '| indiretos', len(ind), '| medições', len(med), 'mudam', mudam)
print(med[med.nova != med.semana_numero][['id', 'codigo_eap', 'data_lancamento', 'semana_numero', 'nova']].to_string() if mudam else 'nenhuma medição muda de número')
