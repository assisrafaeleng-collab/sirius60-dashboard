"""
Tabela de correspondência cronograma → EAP (pedido 17, Rafael 11/10/2026). Só gera o CSV; não grava nada.

A obra tem UMA itemização: a do orçamento (EAP). O cronograma só dá as DATAS e as HORAS planejadas de cada linha da
EAP. A ligação (linha do cronograma → linhas da EAP, por pavimento + serviço) fica nesta tabela, conferida pelo Rafael,
e o cronograma.py passa a lê-la (com a lógica antiga como reserva, marcando "sem ligação").

Uso: py correspondencia.py [--orcamento saida_v2/orcamento_banco_2026-10-11.csv] [--saida cronograma]
Escreve: cronograma/correspondencia_cronograma_eap.csv (fora do git: *.csv)

Uma linha por linha de SERVIÇO da EAP (grupos 1 a 16, fora a 1.1.6 custo de tempo). Materiais NÃO entram: seguem o
serviço vinculado (automacao/vinculo_material.py, regra já existente) e, no cronograma.py, continuam com a ligação da
tabela de tipos (tipos_linha_orcamento.csv).
Colunas: id · codigo_eap · pavimento · descricao · atividade_cronograma (código interno, nunca vai para a tela) ·
  atividade_nome · cronograma_semana_inicio/fim (semanas 1–96 do cronograma esquemático) · semana_inicio/fim (semanas
  reais do calendário novo, já com a regra de posição) · data_inicio/fim · horas_orcamento · quantidade_orcamento ·
  unidade_orcamento · quantidade_cronograma · unidade_cronograma · regra_posicao · observacao · conferido_rafael.
A primeira versão (11/10/2026) é a ligação que o cronograma.py já usava (tabela de tipos de 09/10 + JANELAS_*): os
dois dão as mesmas semanas e as mesmas horas (conferido rodando os dois). Mudança daqui em diante: só nesta tabela.
"""
import argparse, glob, os, re
import pandas as pd
from tipos_linha import juntar_tipos
from cronograma import (calendario, ler_cronograma, janelas, semana_da_coord, ENCUNHAMENTO, DUR_ENCUNHAMENTO,
                        PAV_EST, JANELAS_ESTRUTURA)

# regra de posição dentro da atividade (texto da tabela) ⇄ o que o cronograma.py usa
POSICOES = {
    'inteira': 'a linha ocupa a atividade inteira',
    'armação': 'estrutura: armação desde o início (semanas 1–6 de 8; fundação: até a metade da última)',
    'forma: começa meia semana depois': 'forma começa meia semana depois da armação e corre junto',
    'laje treliçada': 'estrutura: laje treliçada antes da concretagem da laje (semanas 5–7 de 8)',
    'concretagem: pilares 30% / laje 70%': 'concretagem em 2 etapas: pilares 30% (semana 4) e laje 70% (semana 8)',
    'escada: última semana': 'escada nos dias finais: última semana da estrutura do pavimento',
    'encunhamento: depois da alvenaria': 'encunhamento: 2 semanas reais depois do fim da alvenaria do pavimento',
}


def posicao_da_linha(o, dur):
    """texto da regra de posição, pelo que o cronograma.py faz hoje com a linha"""
    if o.regra == ENCUNHAMENTO:
        return 'encunhamento: depois da alvenaria'
    if str(o.regra).startswith('ESCADA'):
        return 'escada: última semana'
    tipo = o.servico_estrutura or ''
    if (o.atividade in PAV_EST.values() and dur in JANELAS_ESTRUTURA) or o.atividade == '2.1.3':
        if o.atividade == '2.1.3' and tipo not in ('armacao', 'forma'):
            return 'inteira'
        return {'armacao': 'armação', 'forma': 'forma: começa meia semana depois', 'laje_trelicada': 'laje treliçada',
                'concretagem': 'concretagem: pilares 30% / laje 70%', 'escada': 'escada: última semana'}.get(tipo, 'inteira')
    return 'inteira'


def nome_limpo(d):
    """nome da atividade do cronograma sem as notas ("◀ ...")"""
    return re.sub(r'\s*◀.*$', '', str(d)).strip()


def ler_quantidades(path):
    c = pd.read_excel(path, sheet_name='Cronograma', header=None)
    q = {}
    for i in range(4, len(c)):
        cod = str(c.iat[i, 0]).strip()
        if cod == 'Total':
            break
        q[cod] = (c.iat[i, 3], c.iat[i, 2])
    return q


def escrever_sql(t, pasta):
    """SQL (só escrito) da tabela orcamento_cronograma_ligacao: a origem das datas de cada linha de serviço, para o
    site mostrar no detalhe da linha ("datas do cronograma: atividade <nome>, semanas X a Y"). Sem código do
    cronograma. RLS, sem permissão para anon/authenticated (CLAUDE.md). O site funciona sem ela (não mostra a linha)."""
    q = lambda v: "'" + str(v).replace("'", "''") + "'"
    ok = t[t.atividade_cronograma != '']
    vals = ',\n'.join(f"  ('sirius60', {r.id}, {q(r.codigo_eap)}, {q(r.pavimento)}, {q(r.atividade_nome)}, "
                       f"{int(r.cronograma_semana_inicio)}, {int(r.cronograma_semana_fim)}, {int(r.semana_inicio)}, {int(r.semana_fim)}, "
                       f"{q(r.regra_posicao)})" for r in ok.itertuples())
    n = len(ok)
    sql = f"""-- =====================================================================
-- Sirius 60 — CRONOGRAMA, PASSO 1: origem das datas de cada linha de serviço da EAP (pedido 17, Rafael 11/10/2026)
-- Gerado por automacao/correspondencia.py a partir de automacao/cronograma/correspondencia_cronograma_eap.csv.
-- Rodar no SQL Editor (arquivo inteiro) DEPOIS de publicar o código que lê a tabela. Desfazer: 1-ligacao-cronograma-desfazer.sql
--
-- A obra tem uma só itemização (a do orçamento). Esta tabela só guarda, para cada linha de SERVIÇO, de que atividade
-- do cronograma vêm as datas (nome, semanas 1–96 do cronograma esquemático e semanas reais da linha) e a regra de
-- posição — o site mostra isso em cinza no detalhe da linha. Não muda semanas, horas, valores nem medições.
-- {n} linhas. Tabela nova: RLS ligado, sem política, sem permissão para anon/authenticated.
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.orcamento_cronograma_ligacao') is not null then
    raise exception 'orcamento_cronograma_ligacao já existe: este arquivo já foi rodado? Nada foi feito';
  end if;
end $$;

create table public.orcamento_cronograma_ligacao (
  id bigserial primary key, obra_id text not null, orcamento_id bigint not null, codigo_eap text not null,
  pavimento text not null, atividade_nome text not null, cronograma_semana_inicio int not null,
  cronograma_semana_fim int not null, semana_inicio int not null, semana_fim int not null, regra_posicao text not null,
  criado_em timestamptz not null default now(), unique (obra_id, orcamento_id));
alter table public.orcamento_cronograma_ligacao enable row level security;
revoke all on public.orcamento_cronograma_ligacao from anon, authenticated;
revoke all on sequence public.orcamento_cronograma_ligacao_id_seq from anon, authenticated;

insert into public.orcamento_cronograma_ligacao (obra_id, orcamento_id, codigo_eap, pavimento, atividade_nome,
  cronograma_semana_inicio, cronograma_semana_fim, semana_inicio, semana_fim, regra_posicao) values
{{vals}};

do $$
declare k int;
begin
  -- trava: toda linha da tabela existe no orçamento com o mesmo código e pavimento
  select count(*) into k from public.orcamento_cronograma_ligacao l join public.orcamento_planejado o
    on o.obra_id = l.obra_id and o.id = l.orcamento_id and o.codigo_eap = l.codigo_eap and o.pavimento = l.pavimento;
  if k <> {n} then raise exception 'só % de {n} linhas batem com o orçamento: nada foi gravado', k; end if;
end $$;

commit;

select count(*) as linhas from public.orcamento_cronograma_ligacao where obra_id = 'sirius60';
"""
    desf = """-- Sirius 60 — DESFAZER o CRONOGRAMA, PASSO 1: apaga a tabela orcamento_cronograma_ligacao (só informação de origem).
begin;
drop table if exists public.orcamento_cronograma_ligacao;
commit;
"""
    os.makedirs(pasta, exist_ok=True)
    open(os.path.join(pasta, '1-ligacao-cronograma.sql'), 'w', encoding='utf-8').write(sql.replace('{vals}', vals))
    open(os.path.join(pasta, '1-ligacao-cronograma-desfazer.sql'), 'w', encoding='utf-8').write(desf)
    print(f'SQL: {pasta}/1-ligacao-cronograma.sql ({n} linhas) + desfazer')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--orcamento', default='saida_v2/orcamento_banco_2026-10-11.csv')
    ap.add_argument('--cronograma', default=None)
    ap.add_argument('--saida', default='cronograma')
    ap.add_argument('--sql', default=None, help='pasta para escrever o SQL da tabela orcamento_cronograma_ligacao (ex.: ../supabase/cronograma)')
    a = ap.parse_args()
    arq = a.cronograma or [f for f in glob.glob('entrada/cronograma/*Final*.xlsx') if not os.path.basename(f).startswith('~$')][0]
    cal = calendario()
    crono = ler_cronograma(arq)
    info = crono.set_index('atividade')
    qtd = ler_quantidades(arq)
    orc = juntar_tipos(pd.read_csv(a.orcamento, dtype={'codigo_eap': str}))
    servico = orc[(~orc.material) & (orc.grupo_num <= 16) & (orc.codigo_eap != '1.1.6')]
    data_ini = dict(zip(cal.semana_numero, cal.data_inicio)); data_fim = dict(zip(cal.semana_numero, cal.data_fim))
    out = []
    for o in servico.itertuples():
        x = o.atividade
        if x not in info.index:
            out.append(dict(id=o.id, codigo_eap=o.codigo_eap, pavimento=o.pavimento, descricao=o.descricao, atividade_cronograma='',
                            atividade_nome='', regra_posicao='', observacao='SEM LIGAÇÃO: linha de serviço sem atividade no cronograma',
                            horas_orcamento=o.hh, quantidade_orcamento=o.quantidade, unidade_orcamento=o.unidade))
            continue
        r = info.loc[x]
        dur = int(r.dur)
        b = int(r.ini) - 1
        if o.regra == ENCUNHAMENTO:
            fim_alv = semana_da_coord(cal, b + dur, 'fim')
            si, sf = fim_alv + 1, min(fim_alv + DUR_ENCUNHAMENTO, len(cal))
        else:
            js = janelas(o, dur)
            si = semana_da_coord(cal, b + min(j[0] for j in js), 'ini')
            sf = semana_da_coord(cal, b + max(j[1] for j in js), 'fim')
        q, u = qtd.get(x, (None, None))
        obs = []
        if o.codigo_eap == '3.0.1':
            obs.append('linha sem valor (R$ 0) que guarda as horas da atividade de estrutura do Pilotis; ver auditoria item 3')
        if x in PAV_EST.values():
            obs.append(f'estrutura do pavimento "{nome_limpo(r.descricao)}"')
        out.append(dict(
            id=o.id, codigo_eap=o.codigo_eap, pavimento=o.pavimento, descricao=o.descricao,
            atividade_cronograma=x, atividade_nome=nome_limpo(r.descricao),
            cronograma_semana_inicio=int(r.ini), cronograma_semana_fim=int(r.fim),
            semana_inicio=si, semana_fim=sf, data_inicio=data_ini[si], data_fim=data_fim[sf],
            horas_orcamento=o.hh, quantidade_orcamento=o.quantidade, unidade_orcamento=o.unidade,
            quantidade_cronograma=q, unidade_cronograma=u, regra_posicao=posicao_da_linha(o, dur),
            observacao='; '.join(obs), conferido_rafael=''))
    t = pd.DataFrame(out)
    os.makedirs(a.saida, exist_ok=True)
    dest = os.path.join(a.saida, 'correspondencia_cronograma_eap.csv')
    t.to_csv(dest, index=False, encoding='utf-8-sig')
    print(f'{dest}: {len(t)} linhas de serviço | sem ligação {int((t.atividade_cronograma == "").sum())}')
    print(t.regra_posicao.value_counts().to_string())
    if a.sql:
        escrever_sql(t, a.sql)
