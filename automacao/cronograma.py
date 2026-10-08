"""
Calendário de semanas, ligação orçamento × cronograma e curva S planejada (Sirius 60). Só gera CSVs; não grava nada.
Uso: py cronograma.py --orcamento saida_v2/orcamento_banco.csv [--cronograma arq.xlsx] [--saida saida_v2] [--hoje AAAA-MM-DD]
     (orcamento_banco.csv = exportação de orcamento_planejado: id, codigo_eap, pavimento, descricao, hh, preco_total, grupo_num)
Saídas em <saida>/: calendario_semanas.csv, eap_cronograma.csv, curva_s_planejada.csv, cronograma_atividades.csv

Regras (CLAUDE.md, 08/10/2026):
- Calendário: S01 = 03/08/2026 até 31/07/2028; semanas de segunda a domingo, cortadas no último dia do mês; cada mês
  começa semana nova; fragmento de 1 dia junta com a vizinha do mesmo mês (no início do mês, com a seguinte; no fim,
  com a anterior); numeração contínua.
- Cronograma oficial: aba "Cronograma" (a "Linha de Balanço" não vale); esquemático, 24 meses × 4 semanas = 96.
  Semana k do cronograma = mês M = ceil(k/4) (M01 = ago/2026), posição p = k − 4(M−1), que ocupa a fração
  (p−1)/4 … p/4 dos DIAS do mês no calendário. Horas (e valor) da atividade: iguais em cada semana do cronograma
  e espalhadas linearmente pelos dias dessa fração; somadas por semana real.
- Ligação: por pavimento + serviço (os códigos do cronograma não são os da EAP). Encunhamento de cada pavimento →
  "Alvenaria <pavimento>" (as horas do cronograma já o incluem); 4.0.9 → 4.9. Custo de tempo (1.1.6, grupos 17,
  18 e 19) não entra no avanço.
"""
import argparse, glob, math, os, re
from datetime import date, timedelta
import pandas as pd

INICIO, FIM = date(2026, 8, 3), date(2028, 7, 31)
MES0 = (2026, 8)          # M01 = ago/2026
SEM_CRONO = 96


# ---------------------------------------------------------------- calendário
def calendario():
    semanas, d = [], INICIO
    while d <= FIM:
        ano, mes = d.year, d.month
        ult = (date(ano + (mes == 12), mes % 12 + 1, 1) - timedelta(days=1))
        fim_mes = min(ult, FIM)
        partes, ini = [], d
        while ini <= fim_mes:
            fim = min(ini + timedelta(days=6 - ini.weekday()), fim_mes)   # domingo ou fim do mês
            partes.append([ini, fim])
            ini = fim + timedelta(days=1)
        # fragmento de 1 dia: no início do mês junta com a seguinte; no fim, com a anterior
        if len(partes) > 1 and partes[0][0] == partes[0][1]:
            partes[1][0] = partes[0][0]; partes.pop(0)
        if len(partes) > 1 and partes[-1][0] == partes[-1][1]:
            partes[-2][1] = partes[-1][1]; partes.pop()
        for k, (a, b) in enumerate(partes, 1):
            semanas.append(dict(data_inicio=a, data_fim=b, dias=(b - a).days + 1, competencia=f'{ano}-{mes:02d}',
                                semana_do_mes=k, fechamento=(k == len(partes))))
        d = fim_mes + timedelta(days=1)
    cal = pd.DataFrame(semanas)
    cal.insert(0, 'semana_numero', range(1, len(cal) + 1))
    return cal


def dias_do_mes(cal, M):
    """datas (lista) do mês M do cronograma no calendário"""
    ano, mes = MES0[0] + (MES0[1] - 1 + M - 1) // 12, (MES0[1] - 1 + M - 1) % 12 + 1
    c = cal[cal.competencia == f'{ano}-{mes:02d}']
    a, b = c.data_inicio.min(), c.data_fim.max()
    return [a + timedelta(days=i) for i in range((b - a).days + 1)]


def espalhar(cal, k, quanto, por_dia):
    """soma em por_dia[data] a parte de 'quanto' da semana k do cronograma (linear nos dias da fração do mês)"""
    M = math.ceil(k / 4); p = k - 4 * (M - 1)
    dias = dias_do_mes(cal, M); n = len(dias)
    a, b = n * (p - 1) / 4, n * p / 4
    for i, dia in enumerate(dias):
        ov = max(0.0, min(i + 1, b) - max(i, a))
        if ov > 0:
            por_dia[dia] = por_dia.get(dia, 0.0) + quanto * ov / (b - a)


def intervalo_real(cal, ini, fim_k):
    """semana real que contém o início da semana 'ini' do cronograma e a que contém o fim da semana 'fim_k'"""
    def data_k(k, ponta):
        M = math.ceil(k / 4); p = k - 4 * (M - 1)
        dias = dias_do_mes(cal, M); n = len(dias)
        i = math.floor(n * (p - 1) / 4) if ponta == 'ini' else math.ceil(n * p / 4) - 1
        return dias[max(0, min(i, n - 1))]
    def semana(d):
        return int(cal[(cal.data_inicio <= d) & (cal.data_fim >= d)].semana_numero.iloc[0])
    return semana(data_k(ini, 'ini')), semana(data_k(fim_k, 'fim'))


# ---------------------------------------------------------------- cronograma
def ler_cronograma(path):
    c = pd.read_excel(path, sheet_name='Cronograma', header=None)
    out = []
    for i in range(4, len(c)):
        cod, desc = c.iat[i, 0], c.iat[i, 1]
        if pd.isna(cod) or str(cod).strip() in ('Total', 'nan'):
            if str(cod).strip() == 'Total':
                break
            continue
        ini, dur = c.iat[i, 9], c.iat[i, 7]
        if pd.isna(ini) or pd.isna(dur):
            continue     # título de grupo
        horas = pd.to_numeric(c.iat[i, 5], errors='coerce')
        out.append(dict(atividade=str(cod).strip(), descricao=str(desc).strip(), horas=0.0 if pd.isna(horas) else float(horas),
                        ini=int(ini), dur=int(dur), fim=int(ini) + int(dur) - 1))
    return pd.DataFrame(out)


PAV_EST = {'Pilotis': '3.1', 'Subsolo': '3.2', 'Térreo': '3.3', '1º Pav': '3.4', '2º Pav': '3.5', '3º Pav': '3.6',
           'Terraço': '3.7', 'Reservatório': '3.8'}
PAV_ALV = {'Subsolo': '4.1', 'Pilotis': '4.2', 'Térreo': '4.3', '1º Pav': '4.4', '2º Pav': '4.5', '3º Pav': '4.6',
           'Terraço': '4.7', 'Reservatório': '4.8'}
# (código do orçamento ou prefixo, função do pavimento/descrição) -> atividade do cronograma
FIXO = {
    **{f'1.1.{i}': '1.1.1' for i in range(1, 6)},
    '2.1.1': '2.1.1', '2.1.2': '2.1.2', '2.1.3': '2.1.3', '2.1.4': '2.1.3', '2.1.6': '2.1.3', '2.1.7': '2.1.3',
    '2.1.5': '2.1.4', '2.1.8': '2.1.4', '2.1.9': '2.1.5', '2.1.14': '2.1.6',
    '4.0.9': '4.9',
    '5.1.1': '5.1.1', '5.1.2': '5.1.2', '5.1.3': '5.1.3',
    '6.1.1': '6.1.2', '6.1.1.1': '6.1.1', '6.1.2': '6.1.3',
    '7.1.1': '7.1.1', '7.1.2': '7.1.3',
    '8.1.1': '8.1.1', '8.1.2': '8.1.1', '8.1.3': '8.1.1', '8.1.4': '8.1.1', '8.1.5': '8.1.16',
    '9.1.1': '9.1.1', '9.1.2': '9.1.2', '9.1.3': '9.1.5', '9.1.4': '9.1.5', '9.1.5': '9.1.5',
    '10.1.1': '10.1.1', '10.1.2': '10.1.2', '10.1.3': '10.1.2', '10.1.4': '10.1.2',
    '11.1.1': '11.1.9', '11.1.2': '11.1.2', '11.1.3': '11.1.3', '11.1.4': '11.1.4', '11.1.7': '11.1.8',
    '11.1.8': '11.1.9', '11.1.9': '11.1.10',
    '12.1.1': '12.1.d', '12.1.2': '12.1.d', '12.1.6': '12.1.d',
    **{f'12.1.{i}': '12.1.a' for i in (3, 4, 5)}, **{f'12.1.{i}': '12.1.b' for i in range(7, 14)},
    **{f'12.1.{i}': '12.1.c' for i in range(14, 20)},
    '13.1.1': '13.1.1', '13.1.2': '13.1.2', '13.1.3': '13.1.6', '13.1.6': '13.1.6', '13.1.4': '13.1.4', '13.1.5': '13.1.4',
    '14.1.5': '14.1.5', '14.1.12': '14.1.5', **{f'14.1.{i}': '14.1.1' for i in (1, 2, 3, 4, 6, 7, 8, 9, 10, 11)},
    '15.1.1': '15.1.1', '15.1.2': '15.1.2', '15.1.3': '15.1.3', '15.1.4': '15.1.4',
}
SUGERIDO = {'2.1.10': '2.1.5', '2.1.11': '2.1.5', '2.1.12': '2.1.5', '2.1.13': '2.1.5'}   # escada da fundação: pelas semanas


def ligar(o):
    eap, pav, d = o.codigo_eap, o.pavimento, str(o.descricao).upper()
    g = int(o.grupo_num)
    if eap == '1.1.6' or g >= 17:
        return '', 'custo de tempo: fora do avanço'
    if eap in FIXO:
        return FIXO[eap], 'serviço'
    if eap in SUGERIDO:
        return SUGERIDO[eap], 'SUGERIDO (escada da fundação sem atividade própria; mesmas semanas do piso 2.1.5)'
    if g == 3:
        if 'PISO POLIDO' in d:
            return '11.1.6', 'piso polido (cronograma: "junto à laje de cada pavimento")'
        if pav in PAV_EST:
            return PAV_EST[pav], 'estrutura do pavimento'
    if g == 4 and pav in PAV_ALV:
        # o cronograma soma o encunhamento de cada pavimento dentro da "Alvenaria <pavimento>"; a 4.9 (60,1 h) é a
        # linha 4.0.9 do orçamento (vergas, contravergas e encunhamento diluídos)
        return PAV_ALV[pav], 'alvenaria/verga/encunhamento do pavimento'
    return '', 'SEM ATIVIDADE'


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--orcamento', required=True)
    ap.add_argument('--cronograma', default=None)
    ap.add_argument('--saida', default='saida_v2')
    ap.add_argument('--hoje', default=None)
    a = ap.parse_args()
    arq = a.cronograma or [f for f in glob.glob('entrada/cronograma/*Final*.xlsx') if not os.path.basename(f).startswith('~$')][0]
    print('cronograma:', arq)
    cal = calendario()
    crono = ler_cronograma(arq)
    orc = pd.read_csv(a.orcamento, dtype={'codigo_eap': str})
    os.makedirs(a.saida, exist_ok=True)

    # 1) ligação
    orc[['atividade', 'regra']] = orc.apply(lambda o: pd.Series(ligar(o)), axis=1)
    info = crono.set_index('atividade')
    orc['descricao_atividade'] = orc.atividade.map(info.descricao)
    orc['ini_crono'] = orc.atividade.map(info.ini); orc['fim_crono'] = orc.atividade.map(info.fim)
    reais = {r.atividade: intervalo_real(cal, r.ini, r.fim) for r in crono.itertuples()}
    orc['semana_inicio_real'] = orc.atividade.map(lambda x: reais[x][0] if x in reais else None)
    orc['semana_fim_real'] = orc.atividade.map(lambda x: reais[x][1] if x in reais else None)
    orc.to_csv(os.path.join(a.saida, 'eap_cronograma.csv'), index=False, encoding='utf-8-sig')

    # 2) atividades: horas do cronograma × horas e valor das linhas ligadas
    lig = orc[orc.atividade != '']
    soma = lig.groupby('atividade').agg(linhas=('id', 'size'), hh_banco=('hh', 'sum'), valor=('preco_total', 'sum'))
    crono = crono.join(soma, on='atividade').fillna({'linhas': 0, 'hh_banco': 0.0, 'valor': 0.0})
    crono['dif_h'] = (crono.hh_banco - crono.horas).round(1)
    crono.to_csv(os.path.join(a.saida, 'cronograma_atividades.csv'), index=False, encoding='utf-8-sig')

    # 3) planejado por dia → por semana real
    h_dia, v_dia = {}, {}
    for r in crono.itertuples():
        for k in range(r.ini, r.fim + 1):
            espalhar(cal, k, r.horas / r.dur, h_dia)
            espalhar(cal, k, r.valor / r.dur, v_dia)
    H, V = sum(h_dia.values()), sum(v_dia.values())
    cs = cal.copy()
    cs['horas'] = [sum(h for d, h in h_dia.items() if x.data_inicio <= d <= x.data_fim) for x in cal.itertuples()]
    cs['valor'] = [sum(v for d, v in v_dia.items() if x.data_inicio <= d <= x.data_fim) for x in cal.itertuples()]
    cs['pct_horas'] = cs.horas / H * 100; cs['pct_horas_acum'] = cs.pct_horas.cumsum()
    cs['valor_acum'] = cs.valor.cumsum(); cs['pct_valor_acum'] = cs.valor_acum / V * 100
    cs[['semana_numero', 'competencia', 'data_inicio', 'data_fim', 'dias', 'horas', 'pct_horas', 'pct_horas_acum', 'valor',
        'valor_acum', 'pct_valor_acum']].round(6).to_csv(os.path.join(a.saida, 'curva_s_planejada.csv'), index=False, encoding='utf-8-sig')
    cal.to_csv(os.path.join(a.saida, 'calendario_semanas.csv'), index=False, encoding='utf-8-sig')

    # ---- impressão
    print(f'\nCALENDÁRIO: {len(cal)} semanas, de {cal.data_inicio.min():%d/%m/%Y} a {cal.data_fim.max():%d/%m/%Y}')
    for m in ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']:
        x = cal[cal.competencia == m]
        print(f'  {m}: ' + '  '.join(f'S{r.semana_numero:02d} {r.data_inicio:%d}–{r.data_fim:%d}/{r.data_fim:%m} ({r.dias}d){"*" if r.fechamento else ""}' for r in x.itertuples()))
    hoje = date.fromisoformat(a.hoje) if a.hoje else date.today()
    sh = cal[(cal.data_inicio <= hoje) & (cal.data_fim >= hoje)].iloc[0]
    print(f'  hoje {hoje:%d/%m/%Y} = S{sh.semana_numero:02d} ({sh.data_inicio:%d/%m}–{sh.data_fim:%d/%m}, {sh.semana_do_mes}ª de {sh.competencia})')
    print(f'\nLIGAÇÃO: {len(orc)} linhas do orçamento | ligadas {len(lig)} | custo de tempo {sum(orc.regra.str.startswith("custo de tempo"))}'
          f' | sugeridas {sum(orc.regra.str.startswith("SUGERIDO"))} | sem atividade {sum(orc.regra == "SEM ATIVIDADE")}')
    for r in orc[orc.regra.isin(['SEM ATIVIDADE']) | orc.regra.str.startswith('SUGERIDO')].itertuples():
        print(f'  {r.codigo_eap:8s} {r.pavimento:12s} {str(r.descricao)[:45]:45s} hh {r.hh:7.1f} → {r.atividade or "—"} {r.regra[:40]}')
    sem_linha = crono[crono.linhas == 0]
    print('  atividades sem linha do orçamento:', ', '.join(f'{r.atividade} {r.descricao[:30]} ({r.horas} h)' for r in sem_linha.itertuples()) or 'nenhuma')
    print(f'\nHORAS: cronograma {crono.horas.sum():,.1f} h | banco (todas as linhas) {orc.hh.sum():,.1f} h | banco ligado {lig.hh.sum():,.1f} h'
          f' | custo de tempo {orc[orc.regra.str.startswith("custo de tempo")].hh.sum():,.1f} h')
    d = crono[crono.dif_h.abs() >= 0.5].sort_values('dif_h', key=abs, ascending=False)
    for r in d.itertuples():
        print(f'  {r.atividade:7s} {r.descricao[:42]:42s} crono {r.horas:8.1f} | banco {r.hh_banco:8.1f} | dif {r.dif_h:+8.1f}')
    print(f'\nPLANEJADO: horas distribuídas {H:,.1f} (100% = {cs.pct_horas_acum.iloc[-1]:.4f}%) | valor {V:,.2f}')
    por_mes = cs.groupby('competencia').horas.sum()
    meses_crono = {}
    for r in crono.itertuples():
        for k in range(r.ini, r.fim + 1):
            M = math.ceil(k / 4); meses_crono[M] = meses_crono.get(M, 0) + r.horas / r.dur
    dif_mes = max(abs(por_mes.iloc[M - 1] - meses_crono.get(M, 0)) for M in range(1, 25))
    print(f'  maior diferença mês do calendário × mês do cronograma: {dif_mes:.6f} h')
    for m in ['2026-08', '2026-09', '2026-10']:
        x = cs[cs.competencia == m].iloc[-1]
        print(f'  fim de {m}: {x.pct_horas_acum:.2f}% das horas | R$ {x.valor_acum:,.2f} ({x.pct_valor_acum:.2f}% do valor)')
    ate = sum(h for dd, h in h_dia.items() if dd <= hoje) / H * 100
    print(f'  hoje {hoje:%d/%m/%Y}: {ate:.2f}% das horas (planejado até o dia)')
