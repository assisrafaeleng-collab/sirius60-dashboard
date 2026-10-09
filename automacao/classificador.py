"""
Classificador de custos TOTVS -> EAP  (obra Sirius 60; código vindo do Flats BH)
Uso: py classificador.py --competencia 2026-07
     [--fonseca arq.xlsx] [--dinamica arq.xlsx] [--rateio arq.xlsx] [--oc pasta] [--saida pasta]
Três fontes, cada uma com seu critério de valor (CLAUDE.md, decisões de 07/10/2026):
  Fonseca  = Valor líquido   (relatório TOTVS da Fonseca & Lage)
  Dinâmica = Valor Baixado   (relatório TOTVS da Dinâmica)
  Rateio   = VALOR_RATEIO    (consulta SQL da Dinâmica aberta por centro de custo: só a parte do Sirius)
Saída em saida/AAAA-MM/: lancamentos.csv, pendencias.csv, nao_custo.csv, resumo.json (totais)
"""
import sys, glob, re, os, argparse
import pandas as pd, unicodedata

def colunas(df):
    df.columns = [unicodedata.normalize('NFC', str(c)).strip() for c in df.columns]
    return df
from util import norm, raiz_cnpj, similaridade, padronizar as _padronizar

OBRA_ID = 'sirius60'
INICIO_OBRA = '2026-08-03'   # S01; pago antes disso entra na competência do mês de crédito (modo --completo)
MES_CREDITO = '2026-08'
# o centro de custo vem escrito de três jeitos: 'RUA SIRIUS Nº 60' (Fonseca), 'RUA SIRIUS N º 60'
# (Dinâmica) e '1.02.0046' (OC e consulta SQL). Compara sem espaços, acentos e º.
CENTROS_CUSTO = {'RUASIRIUSN60', '1.02.0046'}
def cc_norm(v):
    s = re.sub(r'[\sº°]', '', str(v))          # antes do NFKD, que transforma 'º' em 'o'
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().upper()
def e_sirius(serie):
    return serie.map(cc_norm).isin(CENTROS_CUSTO)
CENTRO_CUSTO = 'RUA SIRIUS Nº 60'
EXCLUIR_DOCS = set()                     # títulos que você retira do fechamento

# nomes de coluna variam entre exportações do TOTVS: mapeia por sinônimo, não por posição
SINONIMOS = {
    'ref':        ['ref. lancamento'],
    'documento':  ['numero do documento', 'numero documento'],
    'nome':       ['nome'],
    'historico':  ['historico'],
    'emissao':    ['data de emissao', 'emissao'],
    'vencimento': ['data de vencimento', 'vencimento'],
    'cc':         ['centro de custo', 'centro custo', 'descricao centro de custo'],
    'original':   ['valor original'],
    'liquido':    ['valor liquido', 'valor liquido-quitado'],
    'cnpj':       ['cnpj/cpf'],
    'baixa':      ['data de baixa'],
    'prev_baixa': ['data de previsao de baixa', 'previsao de baixa', 'previsaobaixa'],
    'pago':       ['valor pago'],
    'baixado':    ['valor baixado'],
}
OBRIGATORIAS = ['documento', 'nome', 'vencimento', 'cc', 'liquido', 'cnpj']

def padronizar(df, sin=None, obrig=None, origem='TOTVS'):
    if sin is None: return _padronizar(df, SINONIMOS, OBRIGATORIAS, origem)
    return _padronizar(df, sin, obrig, origem)

def competencia(t):
    c = pd.Series(pd.NaT, index=t.index)
    for col in ['baixa', 'prev_baixa', 'vencimento']:
        if col in t:
            c = c.fillna(pd.to_datetime(t[col], errors='coerce'))
    return c.dt.date

def conferir_total(df, coluna, path):
    """A soma das linhas tem de fechar ao centavo com a linha de TOTAL do próprio relatório
    (a linha sem documento). Para com erro se não fechar."""
    tot = df[df['documento'].isna() & pd.to_numeric(df[coluna], errors='coerce').notna()]
    if not len(tot):
        print(f'AVISO: {os.path.basename(path)} sem linha de total — soma não conferida')
        return
    linhas = round(pd.to_numeric(df.loc[df['documento'].notna(), coluna], errors='coerce').fillna(0).sum(), 2)
    total = round(float(tot[coluna].iloc[-1]), 2)
    if abs(linhas - total) >= 0.01:
        raise SystemExit(f'ERRO: {os.path.basename(path)} — soma das linhas ({linhas:,.2f}) não fecha com o TOTAL do relatório ({total:,.2f})')

def ler_totvs(path, fonte):
    """fonte 'Fonseca' (valor = Valor líquido) ou 'Dinâmica' (valor = Valor Baixado)"""
    t = padronizar(pd.read_excel(path), origem=path)
    conferir_total(t, 'liquido' if fonte == 'Fonseca' else 'original', path)
    t = t.dropna(subset=['documento'])      # descarta linha de total
    fora = ~e_sirius(t['cc'])
    if fora.any():
        print(f'AVISO: {fora.sum()} título(s) de outro centro de custo ignorado(s) em {os.path.basename(path)}')
    t = t[~fora]
    t = t[~t['documento'].astype(str).str.strip().isin(EXCLUIR_DOCS)]
    sem_liq = t['liquido'].isna()
    if sem_liq.any():
        print(f'AVISO: {sem_liq.sum()} linha(s) sem Valor líquido ignorada(s): {t.loc[sem_liq, "documento"].tolist()}')
    t = t[~sem_liq]
    p = pago(t)
    liquido = pd.to_numeric(t['liquido'], errors='coerce').astype(float)
    if fonte == 'Fonseca' and 'pago' not in t and 'baixado' in t:
        # "Relatório de Custo Fonseca e Lage" (sem VALOR PAGO; decisão 08/10/2026): o custo é o Valor Baixado.
        # A soma das linhas tem de fechar com o TOTAL do relatório também nessa coluna.
        conferir_total(padronizar(pd.read_excel(path), origem=path), 'baixado', path)
        baixado = pd.to_numeric(t['baixado'], errors='coerce').fillna(0)
        valor = baixado.where(p, liquido)
    elif fonte == 'Dinâmica':
        # Dinâmica: o custo é o Valor Baixado; título sem baixa fica com o líquido só para a lista de não custo
        baixado = pd.to_numeric(t['baixado'], errors='coerce').fillna(0)
        valor = baixado.where(p, liquido)
    else:
        valor = liquido
    return pd.DataFrame({
        'fonte': fonte,
        # Ref. Lançamento vem como número (com a linha de total vira float): '177209.0' -> '177209'
        'ref': t['ref'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True) if 'ref' in t else '',
        'documento': t['documento'].astype(str).str.strip(),
        'fornecedor': t['nome'].map(norm),
        'cnpj': t['cnpj'].map(raiz_cnpj),
        'historico': t['historico'].map(norm) if 'historico' in t else '',
        'emissao': pd.to_datetime(t['emissao']).dt.date if 'emissao' in t else None,
        'competencia': competencia(t),   # Data de Baixa > Previsão de Baixa > Vencimento (decisão set/26)
        'vencimento': pd.to_datetime(t['vencimento'], errors='coerce').dt.date,
        'valor_original': t['original'].astype(float) if 'original' in t else None,
        'valor': valor.round(2),
        'pago': p,
    }).reset_index(drop=True)

def pago(t):
    """True/False por título; None se o relatório não permite conferir.
    Com a coluna VALOR PAGO: VALOR PAGO > 0. Sem ela (CLAUDE.md): Data de Baixa preenchida e Valor Baixado > 0."""
    baixa_ok = None
    if 'baixa' in t and 'baixado' in t:
        baixa_ok = (pd.to_datetime(t['baixa'], errors='coerce').notna()
                    & (pd.to_numeric(t['baixado'], errors='coerce').fillna(0) > 0))
    if 'pago' in t:
        p = pd.to_numeric(t['pago'], errors='coerce').fillna(0) > 0
        return p | baixa_ok if baixa_ok is not None else p
    return baixa_ok

# Consulta SQL da Dinâmica (SQL - DINÂMICA.XLSX): títulos da Dinâmica abertos por centro de custo.
# Do Sirius vale SÓ o VALOR_RATEIO. Cruzamento com o relatório da Dinâmica pela Ref. Lançamento:
#  - título 100% Sirius (soma do rateio = valor original) já está no relatório da Dinâmica pelo
#    Valor Baixado: as linhas do SQL não entram de novo;
#  - título dividido com outras obras que também está no relatório da Dinâmica: entra pelo rateio,
#    e a linha da Dinâmica (valor cheio) sai do custo.
SIN_RATEIO = {
    'ref': ['ref_lancto'], 'cnpj': ['cpf_cnpj_cliente_fornecedor'], 'emissao': ['_emissao', 'data_emissao'],
    'nome': ['nomefantasia_cliente_fornecedor'], 'original': ['valororiginal'], 'baixado': ['valorbaixa'],
    'vencimento': ['vencimento', 'data_vencimento'], 'baixa': ['data_baixa'], 'status': ['status_lancto'],
    'cc': ['centrocusto_rateio'], 'documento': ['numero_documento'], 'historico': ['historico'],
    'natureza': ['descricaonatureza_rateio'], 'pagar_receber': ['pagar_receber'], 'rateio': ['valor_rateio'],
}

def ler_rateio(path):
    r = padronizar(pd.read_excel(path, dtype={'REF_LANCTO': str}), SIN_RATEIO, SIN_RATEIO.keys(), path)
    r = r[e_sirius(r['cc']) & (r['pagar_receber'].astype(str).str.upper() == 'PAGAR')]
    v = pd.to_numeric(r['rateio'], errors='coerce')
    if v.isna().any():
        raise SystemExit(f'ERRO: {v.isna().sum()} linha(s) do Sirius com VALOR_RATEIO que não é número em {path}')
    return pd.DataFrame({
        'fonte': 'Rateio',
        'ref': r['ref'].astype(str).str.strip(),
        'documento': r['documento'].astype(str).str.strip(),
        'fornecedor': r['nome'].map(norm),
        'cnpj': r['cnpj'].map(raiz_cnpj),
        'historico': r['historico'].map(norm),
        'emissao': pd.to_datetime(r['emissao'], errors='coerce').dt.date,
        'competencia': competencia(r),
        'vencimento': pd.to_datetime(r['vencimento'], errors='coerce').dt.date,
        'valor_original': pd.to_numeric(r['original'], errors='coerce'),
        'valor': v.astype(float).round(2),     # VALOR_RATEIO vem com 4 casas; o custo vai em centavos
        'pago': pago(r),
        # baixado (tem Data de Baixa) mas com VALORBAIXA zero: não prova pagamento; vira pendência
        'baixa_sem_valor': (pd.to_datetime(r['baixa'], errors='coerce').notna()
                            & (pd.to_numeric(r['baixado'], errors='coerce').fillna(0) <= 0)),
    }).reset_index(drop=True)

def ler_dinamica_completo(path):
    """'Relatório de Custo DINAMICA' (decisão 08/10/2026): mesmo layout da consulta SQL, todas as obras.
    Do Sirius vale o VALOR_RATEIO; substitui o relatório da Dinâmica e o SQL (não somar os dois).
    A soma das linhas do Sirius tem de fechar ao centavo com a linha de TOTAL do relatório."""
    bruto = pd.read_excel(path, dtype={'REF_LANCTO': str})
    tot = bruto[bruto['REF_LANCTO'].isna() & pd.to_numeric(bruto['VALOR_RATEIO'], errors='coerce').notna()]
    r = ler_rateio(path)
    if len(tot):
        # o TOTAL vem com 4 casas: compara com a soma sem arredondar das linhas do Sirius
        b = padronizar(bruto, SIN_RATEIO, SIN_RATEIO.keys(), path)
        b = b[e_sirius(b['cc']) & (b['pagar_receber'].astype(str).str.upper() == 'PAGAR')]
        total, linhas = float(tot['VALOR_RATEIO'].iloc[-1]), float(pd.to_numeric(b['rateio']).sum())
        if abs(total - linhas) >= 0.005:
            raise SystemExit(f'ERRO: {os.path.basename(path)} — soma do Sirius ({linhas:,.4f}) não fecha com o TOTAL ({total:,.4f})')
    else:
        print(f'AVISO: {os.path.basename(path)} sem linha de total — soma não conferida')
    return r.assign(fonte='Dinâmica')

def cruzar_rateio(din, rat):
    """Marca o que sai do custo por já estar contado em outra fonte (ver ler_rateio). Devolve din, rat com 'cruzamento'."""
    din, rat = din.copy(), rat.copy()
    din['cruzamento'], rat['cruzamento'] = '', ''
    soma = rat.groupby('ref').valor.sum().round(2)
    orig = rat.groupby('ref').valor_original.first().round(2)
    cheio = set(soma[(soma - orig).abs() < 0.01].index)
    refs_din = set(din.ref)
    rat.loc[rat.ref.isin(cheio) & rat.ref.isin(refs_din), 'cruzamento'] = 'já contado no relatório da Dinâmica (título 100% Sirius)'
    parcial = set(soma.index) - cheio
    din.loc[din.ref.isin(parcial), 'cruzamento'] = 'no rateio: entra só a parte do Sirius (fonte Rateio)'
    return din, rat

# não são custo (decisão out/26): previsão financeira de OC ainda sem NF e aporte de sócio.
# Saem da classificação e vão para nao_custo.csv (base do futuro card de contas a pagar).
NAO_CUSTO = {'previsão financeira': r'PREV\.?\s*FINANC', 'aporte': r'\bAPORTE\b'}
# pelo número do documento; preenchido no modo --completo (ver __main__)
NAO_CUSTO_DOC = {}

def separar_nao_custo(tit):
    tipo = pd.Series('', index=tit.index)
    # já contado em outra fonte (cruzamento Dinâmica x Rateio)
    if 'cruzamento' in tit:
        tipo[tit.cruzamento.fillna('') != ''] = tit.cruzamento.fillna('')
    for nome, padrao in NAO_CUSTO.items():
        tipo[(tipo == '') & tit.historico.str.contains(padrao, regex=True)] = nome
    for nome, padrao in NAO_CUSTO_DOC.items():
        tipo[(tipo == '') & tit.documento.astype(str).str.upper().str.contains(padrao, regex=True)] = nome
    # título que você marcou em decisoes_pontuais.csv com eap = NAO_CUSTO (ex.: NF já paga por adiantamento)
    try:
        dp = pd.read_csv('decisoes_pontuais.csv', dtype={'cnpj': str, 'documento': str, 'eap': str}).fillna('')
        dp = dp[dp.eap == 'NAO_CUSTO']
        for r in dp.itertuples():
            tipo[(tipo == '') & (tit.cnpj == r.cnpj) & (tit.documento == r.documento)] = r.obs or 'decisão: não é custo'
    except FileNotFoundError:
        pass
    # só entra como custo o que consta como pago no relatório (decisão out/26). No Sirius não há Taxa ADM.
    if tit.pago.notna().all():
        tipo[(tipo == '') & (tit.pago == False)] = 'sem pagamento no relatório'
    else:
        print('AVISO: relatório sem VALOR PAGO / Data de Baixa + Valor Baixado — não foi possível conferir o pagamento dos títulos')
    fora = tit[tipo != ''].assign(tipo=tipo[tipo != ''])
    return tit[tipo == ''].reset_index(drop=True), fora.reset_index(drop=True)

SIN_OC = {
    'oc': ['no oc'], 'cnpj': ['cnpj'], 'fornecedor': ['razao social'], 'item': ['nome prod'],
    'total_item': ['total do item'], 'nf': ['no nf'], 'status': ['desc_status'],
    'cc': ['descricao c.custo'], 'emissao': ['data emissao'], 'sc': ['no sc fluig'],
}

def ler_ocs(pasta):
    dfs = []
    for f in sorted(glob.glob(f'{pasta}/*.xls*')):
        o = pd.read_excel(f, engine='xlrd' if f.lower().endswith('.xls') else None)
        # relatório de OC de agosto/26: duas colunas "Nº OC" e a primeira vazia (o pandas chama a 2ª de "Nº OC.1")
        base = lambda c: re.sub(r'\.\d+$', '', str(c))
        gemeas = [c for c in o.columns if sum(base(x) == base(c) for x in o.columns) > 1]
        o = o.drop(columns=[c for c in gemeas if o[c].isna().all()])
        o.columns = [base(c) if base(c) not in o.columns else c for c in map(str, o.columns)]
        o = padronizar(o, SIN_OC, ['oc', 'cnpj', 'item', 'total_item', 'nf'], f)
        if 'cc' in o:
            o = o[e_sirius(o['cc'])]
        else:
            print(f'AVISO: {f} não tem centro de custo — considerando todas as OCs como {CENTRO_CUSTO}')
        o['arquivo'] = f
        dfs.append(o)
    o = pd.concat(dfs)
    o = pd.DataFrame({
        'oc': o['oc'].astype(str).str.lstrip('0'),
        'cnpj': o['cnpj'].map(raiz_cnpj),
        'fornecedor': o['fornecedor'].map(norm),
        'item': o['item'].map(norm),
        'total_item': pd.to_numeric(o['total_item'], errors='coerce').fillna(0),
        'nf': pd.to_numeric(o['nf'], errors='coerce'),
        'status': o.get('status'),
        # SC (solicitação de compra) da OC: liga a compra de aço ao pedido (pedidos_aco.csv)
        'sc': o['sc'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip() if 'sc' in o else '',
        'emissao': pd.to_datetime(o.get('emissao'), errors='coerce'),
        'arquivo': o['arquivo'],
    })
    # a mesma OC aparece em vários relatórios mensais: fica a versão do relatório mais recente
    o = o.sort_values('arquivo')   # nomeie os arquivos OC_AAAA-MM.xls
    return o.drop_duplicates(subset=['oc', 'item', 'total_item', 'nf'], keep='last')

def vincular_oc(tit, ocs):
    """Retorna (linhas da OC, confiança) para um título."""
    m = re.match(r'^OC\s*(\d+)', tit.documento)
    if m:
        g = ocs[ocs.oc == m.group(1)]
        return (g, 'ALTA') if len(g) else (None, None)
    # "Prev. Financ. OC 000001826 ...": a OC vem no histórico; abre pelos itens dela (decisão out/26)
    m = re.search(r'PREV\.?\s*FINANC.*\bOC\s*0*(\d+)', str(tit.historico))
    if m:
        g = ocs[(ocs.oc == m.group(1)) & (ocs.total_item > 0)]
        if len(g):
            return g, 'ALTA (OC no histórico)'
    m = re.match(r'^0*(\d+)/\d+$', tit.documento)
    if m:
        g = ocs[(ocs.nf == int(m.group(1))) & (ocs.cnpj == tit.cnpj)]
        g = g[g.total_item > 0]
        if len(g):
            return g, 'ALTA'
    # sem NF na OC: procura OC PENDENTE do mesmo fornecedor cujo total (ou soma de duas) = valor original do título
    alvo = round(tit.valor_original or tit.valor, 2)
    pend = ocs[(ocs.cnpj == tit.cnpj) & (ocs.nf.isna()) & (ocs.total_item > 0)]
    tot = pend.groupby('oc').total_item.sum().round(2)
    unicas = tot[tot == alvo]
    if len(unicas) == 1:
        return pend[pend.oc == unicas.index[0]], f'MÉDIA (valor = OC {unicas.index[0]})'
    from itertools import combinations
    pares = [(a, b) for a, b in combinations(tot.index, 2) if round(tot[a] + tot[b], 2) == alvo]
    if len(pares) == 1:
        a, b = pares[0]
        return pend[pend.oc.isin([a, b])], f'MÉDIA (valor = OC {a} + OC {b})'
    return None, None

def carregar_regras(path='regras.csv', manuais='regras_manuais.csv'):
    """regras_manuais.csv = decisões suas; têm prioridade e não são apagadas quando gerar_regras roda de novo"""
    r = pd.read_csv(path, dtype=str).fillna('')
    r['alerta'] = ''
    try:
        m = pd.read_csv(manuais, dtype=str).fillna('')
    except FileNotFoundError:
        m = r.iloc[0:0]
    return m, r

LIMIAR_SIMILARIDADE = 0.5

def _aplicar(regras, cnpj, fornecedor, item, valor, competencia=None):
    if 'vigente_desde' in regras and competencia is not None:
        c = str(competencia)
        regras = regras[(regras.vigente_desde == '') | (regras.vigente_desde <= c)]
    r = regras[regras.cnpj == cnpj] if cnpj else regras.iloc[0:0]
    if len(r) == 0:
        r = regras[regras.fornecedor == fornecedor]
    r = pd.concat([r, regras[regras.cnpj == '*']])          # regras de item válidas p/ qualquer fornecedor
    hit, tipo = r[r.padrao_item == f'VALOR={valor:g}'], 'valor'
    if len(hit) == 0:
        cont = r[r.padrao_item.str.startswith('CONTEM:')]
        cont = cont[cont.padrao_item.map(lambda p: p[7:] in norm(item))]
        if len(cont):
            hit, tipo = cont.iloc[[0]], 'palavra-chave'
    if len(hit) == 0:
        cand = r[(r.padrao_item != '*') & (~r.padrao_item.str.startswith(('VALOR=', 'CONTEM:')))]
        if len(cand):
            sims = cand.padrao_item.map(lambda p: similaridade(p, item))
            if sims.max() >= LIMIAR_SIMILARIDADE:
                hit, tipo = cand.loc[[sims.idxmax()]], f'item ({sims.max():.0%})'
    if len(hit) == 0:
        hit, tipo = r[r.padrao_item == '*'], 'fornecedor'
    if len(hit) == 0:
        return None, 'sem regra (fornecedor novo)', ''
    h = hit.iloc[0]
    if h.tipo == 'pendente':
        return None, h.obs or 'fornecedor com várias EAPs', ''
    return h.eap, f'regra por {tipo}', h.get('alerta', '')

try:
    # uma linha por categoria e etapa; vigente_desde vazio = desde o início da obra
    ETAPA = pd.read_csv('etapa.csv', dtype=str).fillna('')
    if 'vigente_desde' not in ETAPA:
        ETAPA['vigente_desde'] = ''
except FileNotFoundError:
    ETAPA = pd.DataFrame(columns=['categoria', 'eap', 'vigente_desde'])

def resolver_etapa(eap, alerta, competencia=None, emissao=None):
    """EAP 'ETAPA:ACO_MATERIAL' -> linha do pavimento em execução na competência do título (etapa.csv).
    'ETAPA_NF:...' usa a data de emissão da nota (prego e arame, decisão out/26); sem ela, a competência."""
    if eap and eap.startswith(('ETAPA:', 'ETAPA_NF:')):
        por_nota = eap.startswith('ETAPA_NF:')
        cat = eap.split(':', 1)[1]
        data = emissao if por_nota and emissao is not None and not pd.isna(emissao) else competencia
        e = ETAPA[ETAPA.categoria == cat]
        if data is not None:
            e = e[(e.vigente_desde == '') | (e.vigente_desde <= str(data))]
        if len(e) == 0:
            return None, f'categoria {cat} sem EAP em etapa.csv'
        e = e.sort_values('vigente_desde').iloc[-1]
        return e.eap, (alerta + ' | ' if alerta else '') + f'EAP pela etapa ({cat} = {e.eap}' + (f', nota de {data}' if por_nota else '') + ')'
    return eap, alerta

def pavimento_na_data(data):
    """Pavimento em execução na data da nota (decisão out/26), pelo etapa.csv: a etapa
    mais recente vigente na data; EAP 3.N.x -> 'Nº'. Sem data ou sem etapa -> ''.
    O importar.js só usa o pavimento em código repetido por pavimento (7.1.7 do 1º ao
    6º) e só se o código tiver linha nesse pavimento; sem pavimento, divide pela verba."""
    if data is None or pd.isna(data) or str(data).strip() == '':
        return ''
    e = ETAPA[(ETAPA.vigente_desde == '') | (ETAPA.vigente_desde <= str(data)[:10])]
    if len(e) == 0:
        return ''
    atual = e.sort_values('vigente_desde', kind='stable').iloc[-1]
    if str(atual.get('pavimento', '')).strip():
        return str(atual.pavimento).strip()      # Sirius: etapa.csv traz o pavimento (ex.: Fundação)
    m = re.match(r'^3\.(\d+)\.', str(atual.eap))
    return f'{m.group(1)}º' if m else ''

def aplicar_regra(regras, cnpj, fornecedor, item, valor, competencia=None, emissao=None):
    manuais, geradas = regras
    eap, motivo, alerta = _aplicar(manuais, cnpj, fornecedor, item, valor, competencia)
    if eap:
        eap, alerta = resolver_etapa(eap, alerta, competencia, emissao)
        return eap, motivo.replace('regra por', 'decisão sua por'), alerta
    return _aplicar(geradas, cnpj, fornecedor, item, valor)

def ratear(eap, valor, competencia=None, emissao=None):
    """regra com rateio: eap = '19.1.7=0.581;19.1.9=0.419' -> [(eap, valor), ...] fechando ao centavo na última"""
    if not eap or '=' not in eap:
        return [(eap, valor)]
    partes = [p.split('=') for p in eap.split(';') if p.strip()]
    vals = [round(valor * float(pr), 2) for _, pr in partes]
    vals[-1] = round(vals[-1] + valor - sum(vals), 2)
    return [(resolver_etapa(e.strip(), '', competencia, emissao)[0], v) for (e, _), v in zip(partes, vals)]

# Compra de aço (decisão out/26): regra com eap = 'PEDIDO_ACO' divide o título pelo pedido de aço
# (SC da OC) e pelas pranchas, na proporção em kg de pedidos_aco.csv (uma linha por SC e EAP).
# Sem OC identificada, ou com SC fora da planilha de pedidos: pendência para você informar o pedido.
try:
    PEDIDOS_ACO = pd.read_csv('pedidos_aco.csv', dtype=str).fillna('')
except FileNotFoundError:
    PEDIDOS_ACO = pd.DataFrame(columns=['sc', 'pedido', 'eap', 'proporcao', 'obs'])

def oc_do_historico(historico):
    m = re.search(r'\bOC\s*0*(\d+)', str(historico))
    return m.group(1) if m else ''

def resolver_pedido_aco(oc, ocs):
    if not oc:
        return None, 'pedido de aço: título sem OC identificada (informe o pedido)'
    scs = sorted({x for x in ocs[ocs.oc == oc].sc if x and x != 'nan'}) if 'sc' in ocs else []
    if not scs:
        return None, f'pedido de aço: OC {oc} sem SC no relatório de OC (informe o pedido)'
    p = PEDIDOS_ACO[PEDIDOS_ACO.sc.isin(scs)]
    if not len(p):
        return None, f'pedido de aço: SC {", ".join(scs)} (OC {oc}) não está na planilha de pedidos (informe o pedido)'
    eap = ';'.join(f'{r.eap}={r.proporcao}' for r in p.itertuples())
    return eap, f'{p.pedido.iloc[0]}º pedido de aço (SC {p.sc.iloc[0]}, OC {oc}): divisão pelas pranchas'

def parcela_anterior(pontuais, t):
    """Parcelas seguintes de uma NF seguem a decisão da primeira parcela (decisão out/26):
    sem decisão própria, '2141/02' usa a de '2141/01'. NAO_CUSTO não é herdado."""
    if '/' not in t.documento:
        return pontuais.iloc[0:0], None
    base, par = t.documento.split('/')[0].lstrip('0'), t.documento.split('/')[-1]
    irm = pontuais[(pontuais.cnpj == t.cnpj) & (pontuais.eap != 'NAO_CUSTO') & pontuais.documento.str.contains('/', regex=False)]
    irm = irm[irm.documento.str.split('/').str[0].str.lstrip('0') == base]
    irm = irm[pd.to_numeric(irm.documento.str.split('/').str[-1], errors='coerce') < pd.to_numeric(par, errors='coerce')]
    if not len(irm):
        return irm, None
    primeira = min(irm.documento.unique(), key=lambda d: int(d.split('/')[-1]))
    return irm[irm.documento == primeira], primeira

def classificar(tit, ocs, regras):
    lanc, pend = [], []
    try:
        parcelas = pd.read_csv('regras_parcelas.csv', dtype={'cnpj': str, 'nf_base': str, 'eap': str})
    except FileNotFoundError:
        parcelas = pd.DataFrame(columns=['cnpj', 'nf_base', 'eap', 'proporcao'])
    try:
        pontuais = pd.read_csv('decisoes_pontuais.csv', dtype={'cnpj': str, 'documento': str, 'eap': str})
    except FileNotFoundError:
        pontuais = pd.DataFrame(columns=['cnpj', 'documento', 'eap', 'proporcao', 'obs'])
    for t in tit.itertuples():
        dp = pontuais[(pontuais.cnpj == t.cnpj) & (pontuais.documento == t.documento)]
        herdada = None
        if not len(dp):
            dp, herdada = parcela_anterior(pontuais, t)
        if len(dp):
            # rateio informado por você (ex.: boletim de medição); linha sem EAP vai para pendências
            vals = [round(t.valor * float(p), 2) for p in dp.proporcao]
            vals[-1] = round(vals[-1] + t.valor - sum(vals), 2)
            for r, v in zip(dp.fillna('').itertuples(), vals):
                eap_r, _ = resolver_etapa(r.eap, '', t.competencia, t.emissao)
                r = r._replace(eap=eap_r or '')
                row = dict(documento=t.documento, fornecedor=t.fornecedor, item=r.obs, oc='',
                           competencia=t.competencia, valor=v, eap=r.eap, vinculo_oc='decisão pontual',
                           regra=f'decisão: {r.obs}' + (f' (herdada da parcela {herdada})' if herdada else ''),
                           alerta=getattr(r, 'alerta', ''),
                           data_emissao=t.emissao, cnpj=t.cnpj, fonte=t.fonte, ref=t.ref,
                           classificacao=getattr(r, 'classificacao', ''),   # opcional, vai para o banco
                           pavimento=str(getattr(r, 'pavimento', '') or ''))  # opcional: decisão sua de pavimento
                (lanc if r.eap else pend).append(row)
            continue
        m = re.match(r'^0*(\d+)/\d+$', t.documento)
        ant = parcelas[(parcelas.cnpj == t.cnpj) & (parcelas.nf_base == m.group(1))] if m else parcelas.iloc[0:0]
        rm = regras[0]
        volatil = len(rm[(rm.cnpj == t.cnpj) & rm.eap.str.startswith(('ETAPA:', 'ETAPA_NF:')) & ((rm.vigente_desde == '') | (rm.vigente_desde <= str(t.competencia)))]) > 0
        if len(ant) and not volatil:
            # outra parcela de uma NF já fechada: repete o mesmo rateio
            partes = [(e, round(t.valor * p, 2)) for e, p in zip(ant.eap, ant.proporcao)]
            dif = round(t.valor - sum(v for _, v in partes), 2)
            partes[0] = (partes[0][0], round(partes[0][1] + dif, 2))
            for e, v in partes:
                lanc.append(dict(documento=t.documento, fornecedor=t.fornecedor, item=t.historico, oc='',
                                 competencia=t.competencia, valor=v, eap=e, vinculo_oc='parcela anterior',
                                 regra='mesmo rateio da parcela anterior da NF', alerta='',
                                 data_emissao=t.emissao, cnpj=t.cnpj, fonte=t.fonte, ref=t.ref))
            continue
        linhas_oc, conf = vincular_oc(t, ocs)
        if linhas_oc is not None:
            # abre o título por item da OC, rateando o valor líquido na proporção do item
            base = linhas_oc.total_item.sum()
            partes = [(r.item, round(t.valor * r.total_item / base, 2), r.oc) for r in linhas_oc.itertuples()]
            dif = round(t.valor - sum(p[1] for p in partes), 2)       # fecha ao centavo
            i_max = max(range(len(partes)), key=lambda i: partes[i][1])
            partes[i_max] = (partes[i_max][0], round(partes[i_max][1] + dif, 2), partes[i_max][2])
        else:
            partes = [(t.historico, t.valor, '')]
        for item, valor, oc in partes:
            eap, motivo, alerta = aplicar_regra(regras, t.cnpj, t.fornecedor, item, t.valor if len(partes) == 1 else valor, t.competencia, t.emissao)
            if eap == 'PEDIDO_ACO':
                eap, motivo = resolver_pedido_aco(oc or oc_do_historico(t.historico), ocs)
            for eap_r, valor_r in ratear(eap, valor, t.competencia, t.emissao):
                row = dict(documento=t.documento, fornecedor=t.fornecedor, item=item, oc=oc,
                           competencia=t.competencia, valor=valor_r, eap=eap_r or '',
                           vinculo_oc=conf or 'sem OC', regra=motivo, alerta=alerta,
                           data_emissao=t.emissao, cnpj=t.cnpj, fonte=t.fonte, ref=t.ref)
                (lanc if eap_r else pend).append(row)
    # Pavimento: o da decisão pontual (coluna opcional pavimento) ou o em
    # execução na data da nota (etapa.csv). Decisão out/26.
    for row in lanc + pend:
        if not row.get('pavimento'):
            row['pavimento'] = pavimento_na_data(row.get('data_emissao'))
    return pd.DataFrame(lanc), pd.DataFrame(pend)


# ---------------------------------------------------------------------------------------------
# Sirius 60: três fontes no mesmo mês
# ---------------------------------------------------------------------------------------------
def mais_recente(pasta):
    arqs = [f for f in glob.glob(os.path.join(pasta, '*.xls*')) if not os.path.basename(f).startswith('~$')]
    if not arqs:
        raise SystemExit(f'ERRO: nenhum relatório em {pasta}')
    return max(arqs, key=os.path.getmtime)

def mais_recente_padrao(pasta, padrao):
    arqs = [f for f in glob.glob(os.path.join(pasta, padrao + '.xls*')) if not os.path.basename(f).startswith('~$')]
    if not arqs:
        raise SystemExit(f'ERRO: nenhum "{padrao}" em {pasta}')
    return max(arqs, key=os.path.getmtime)

def doc_base(d):
    m = re.match(r'^0*(\d+)/\d+$', str(d).strip())
    return m.group(1) if m else ''

def duplicidades(tit, pontuais, dias=7):
    """Mesmo CNPJ em fontes diferentes com o mesmo documento (NF e parcela), ou mesmo valor com
    datas a até `dias` dias. Título com decisão pontual (decisoes_pontuais.csv) já está resolvido."""
    decididos = set(zip(pontuais.cnpj, pontuais.documento))
    t = tit[[(c, d) not in decididos for c, d in zip(tit.cnpj, tit.documento)]].copy()
    t['base'] = t.documento.map(doc_base)
    t['data'] = pd.to_datetime(t.competencia)
    motivo = {}
    for c, g in t[t.cnpj != ''].groupby('cnpj'):
        if g.fonte.nunique() < 2:
            continue
        linhas = list(g.itertuples())
        for i, a in enumerate(linhas):
            for b in linhas[i + 1:]:
                if a.fonte == b.fonte:
                    continue
                mesmo_doc = a.base and a.base == b.base and a.documento.split('/')[-1] == b.documento.split('/')[-1]
                mesmo_valor = abs(a.valor - b.valor) < 0.01 and abs((a.data - b.data).days) <= dias
                if mesmo_doc or mesmo_valor:
                    por = 'mesmo documento' if mesmo_doc else f'mesmo valor em datas próximas'
                    motivo[a.chave] = f'possível duplicidade ({por}) com {b.fonte} {b.documento} R$ {b.valor:,.2f}'
                    motivo[b.chave] = f'possível duplicidade ({por}) com {a.fonte} {a.documento} R$ {a.valor:,.2f}'
    return motivo

def brl(v):
    return f'R$ {v:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Classificador de custos do Sirius 60 (prévia; não grava no banco)')
    ap.add_argument('--competencia', required=True, help='AAAA-MM')
    ap.add_argument('--fonseca', help='relatório TOTVS da Fonseca (padrão: o mais recente de entrada/fonseca)')
    ap.add_argument('--dinamica', help='relatório TOTVS da Dinâmica (padrão: o mais recente de entrada/dinamica)')
    ap.add_argument('--rateio', help='consulta SQL da Dinâmica com VALOR_RATEIO (padrão: o mais recente de entrada/rateio)')
    ap.add_argument('--oc', default='oc', help='pasta dos relatórios de OC')
    ap.add_argument('--saida', help='pasta de saída (padrão: saida/AAAA-MM; com --completo, saida_v2/AAAA-MM)')
    ap.add_argument('--completo', action='store_true',
                    help='relatórios completos (decisão 08/10/2026): "Relatório de Custo Fonseca e Lage" (Valor Baixado) '
                         'e "Relatório de Custo DINAMICA" (VALOR_RATEIO); o SQL deixa de ser fonte separada')
    a = ap.parse_args()
    comp = a.competencia
    if not re.fullmatch(r'\d{4}-\d{2}', comp):
        raise SystemExit('ERRO: --competencia no formato AAAA-MM')
    completo = lambda pasta: mais_recente_padrao(pasta, 'Relatório de Custo*')
    if a.completo:
        arq = {'Fonseca': a.fonseca or completo('entrada/fonseca'), 'Dinâmica': a.dinamica or completo('entrada/dinamica')}
    else:
        arq = {'Fonseca': a.fonseca or mais_recente('entrada/fonseca'),
               'Dinâmica': a.dinamica or mais_recente('entrada/dinamica'),
               'Rateio': a.rateio or mais_recente('entrada/rateio')}
    for f, p in arq.items():
        print(f'{f}: {p}')
    saida = a.saida or os.path.join('saida_v2' if a.completo else 'saida', comp)
    os.makedirs(saida, exist_ok=True)

    fon = ler_totvs(arq['Fonseca'], 'Fonseca')
    if a.completo:
        # ISS retido de nota (ISSRET): o VALOR_RATEIO é o bruto da nota e já inclui o imposto; o ISS fica no
        # custo do serviço (decisão 08/10/2026). ISS da Prefeitura que não é retenção continua em 19.1.22.
        NAO_CUSTO_DOC['ISS retido de nota: já está no valor bruto da nota (decisão 08/10/2026)'] = r'^ISSRET'
        din = ler_dinamica_completo(arq['Dinâmica'])
        din['cruzamento'] = ''
        fon['cruzamento'] = ''
        tudo = pd.concat([fon, din], ignore_index=True)
    else:
        din = ler_totvs(arq['Dinâmica'], 'Dinâmica')
        rat = ler_rateio(arq['Rateio'])
        din, rat = cruzar_rateio(din, rat)
        tudo = pd.concat([fon, din, rat], ignore_index=True)
    tudo['cruzamento'] = tudo.cruzamento.fillna('')
    tudo['chave'] = tudo.fonte + '|' + tudo.ref.astype(str) + '|' + tudo.documento
    tudo['mes'] = tudo.competencia.astype(str).str[:7]
    if a.completo:
        # Mês de "crédito" (CLAUDE.md, 08/10/2026): o que foi pago antes do início da obra (03/08/2026) entra na
        # competência 2026-08. A data real do pagamento continua em 'competencia' (o importar.js leva para o histórico).
        antes = pd.to_datetime(tudo.competencia, errors='coerce') < pd.Timestamp(INICIO_OBRA)
        tudo.loc[antes, 'mes'] = MES_CREDITO

    ocs, regras = ler_ocs(a.oc), carregar_regras()
    try:
        pontuais = pd.read_csv('decisoes_pontuais.csv', dtype=str).fillna('')
    except FileNotFoundError:
        pontuais = pd.DataFrame(columns=['cnpj', 'documento', 'eap', 'proporcao', 'obs'])

    custo, nao_custo = separar_nao_custo(tudo)
    # título baixado com valor baixado zero (ex.: cartão pré-pago): não há prova de pagamento, mas o
    # status é Baixado — vai para pendência para você confirmar, não some como "sem pagamento"
    duvida = (nao_custo.tipo == 'sem pagamento no relatório') & (nao_custo.baixa_sem_valor == True)
    # pagamento já confirmado por você: decisão pontual com EAP (ex.: Caixa Cartões → 19.1.25, antes 18.1.1)
    confirmados = set(zip(pontuais[pontuais.eap != 'NAO_CUSTO'].cnpj, pontuais[pontuais.eap != 'NAO_CUSTO'].documento))
    forcar = {k: 'baixado no TOTVS com VALORBAIXA 0: confirme o pagamento'
              for k, c, d in zip(nao_custo.loc[duvida, 'chave'], nao_custo.loc[duvida, 'cnpj'], nao_custo.loc[duvida, 'documento'])
              if (c, d) not in confirmados}
    custo = pd.concat([custo, nao_custo[duvida].drop(columns='tipo')], ignore_index=True)
    nao_custo = nao_custo[~duvida].reset_index(drop=True)
    forcar.update(duplicidades(custo, pontuais))

    # ---- só a competência pedida ----
    tit = custo[custo.mes == comp].reset_index(drop=True)
    nao_m = nao_custo[nao_custo.mes == comp].reset_index(drop=True)
    lanc, pend = classificar(tit, ocs, regras)
    cols = ['documento', 'fornecedor', 'item', 'oc', 'competencia', 'valor', 'eap', 'vinculo_oc', 'regra', 'alerta',
            'data_emissao', 'cnpj', 'fonte', 'ref', 'classificacao', 'pavimento']
    lanc = lanc.reindex(columns=cols) if len(lanc) else pd.DataFrame(columns=cols)
    pend = pend.reindex(columns=cols) if len(pend) else pd.DataFrame(columns=cols)
    # duplicidade entre fontes e pagamento a confirmar: vira pendência (com a EAP que a regra daria)
    chave_l = lanc.fonte + '|' + lanc.ref.astype(str) + '|' + lanc.documento
    mover = chave_l.isin(forcar.keys())
    if mover.any():
        m = lanc[mover].copy()
        m['regra'] = [forcar[k] + f' | EAP sugerida pela regra: {e}' for k, e in zip(chave_l[mover], m.eap)]
        m['eap'] = ''
        pend = pd.concat([pend, m], ignore_index=True)
        lanc = lanc[~mover].reset_index(drop=True)
    chave_p = pend.fonte + '|' + pend.ref.astype(str) + '|' + pend.documento
    for i in pend.index[chave_p.isin(forcar.keys())]:
        if forcar[chave_p[i]] not in str(pend.at[i, 'regra']):
            pend.at[i, 'regra'] = forcar[chave_p[i]] + ' | ' + str(pend.at[i, 'regra'])

    # ---- soma de cada fonte tem de fechar ao centavo com o relatório ----
    erro = False
    for f in ['Fonseca', 'Dinâmica', 'Rateio']:
        rel = round(tudo.loc[(tudo.fonte == f) & (tudo.mes == comp), 'valor'].sum(), 2)
        dist = round(lanc.loc[lanc.fonte == f, 'valor'].sum() + pend.loc[pend.fonte == f, 'valor'].sum()
                     + nao_m.loc[nao_m.fonte == f, 'valor'].sum(), 2)
        if abs(rel - dist) >= 0.01:
            print(f'ERRO: {f} {comp}: relatório {brl(rel)} x classificado + pendente + não custo {brl(dist)}')
            erro = True
    if erro:
        raise SystemExit('ERRO: soma por fonte não fecha ao centavo — nada foi gravado em ' + saida)

    try:
        orc = set(pd.read_csv('orcamento.csv', dtype=str).codigo_eap)
        fora = ~lanc.eap.isin(orc)
        if fora.any():
            lanc.loc[fora, 'alerta'] = 'EAP não existe no orçamento'
            print(f'AVISO: {fora.sum()} lançamento(s) com EAP fora do orçamento')
    except FileNotFoundError:
        pass
    for df in (lanc, pend):
        df.insert(0, 'obra_id', OBRA_ID)
        df.rename(columns={'eap': 'codigo_eap'}, inplace=True)
    nao_m = nao_m.drop(columns=['chave', 'mes', 'cruzamento'], errors='ignore')
    nao_m.insert(0, 'obra_id', OBRA_ID)
    lanc.to_csv(os.path.join(saida, 'lancamentos.csv'), index=False, encoding='utf-8-sig')
    pend.to_csv(os.path.join(saida, 'pendencias.csv'), index=False, encoding='utf-8-sig')
    nao_m.to_csv(os.path.join(saida, 'nao_custo.csv'), index=False, encoding='utf-8-sig')
    # resumo.json: o importar.js confere a soma do lancamentos.csv com este total antes de gravar
    import json
    from datetime import datetime
    from zoneinfo import ZoneInfo
    soma = lambda df, f: round(float(df[df.fonte == f].valor.sum()), 2)
    resumo = {
        'obra_id': OBRA_ID, 'competencia': comp,
        'gerado_em': datetime.now(ZoneInfo('America/Sao_Paulo')).strftime('%Y-%m-%d %H:%M'),
        'lancamentos': len(lanc), 'total': round(float(lanc.valor.sum()), 2),
        'pendencias': len(pend), 'total_pendente': round(float(pend.valor.sum()), 2),
        'por_fonte': {f: {'classificado': soma(lanc, f), 'pendente': soma(pend, f), 'nao_custo': soma(nao_m, f)}
                      for f in ['Fonseca', 'Dinâmica', 'Rateio']},
    }
    with open(os.path.join(saida, 'resumo.json'), 'w', encoding='utf-8') as fh:
        json.dump(resumo, fh, ensure_ascii=False, indent=1)

    print(f'\n== {OBRA_ID} | competência {comp} | saída em {saida}')
    for f in ['Fonseca', 'Dinâmica', 'Rateio']:
        l, p, n = (lanc[lanc.fonte == f].valor.sum(), pend[pend.fonte == f].valor.sum(), nao_m[nao_m.fonte == f].valor.sum())
        print(f'{f:9}: classificado {brl(l):>15} | pendente {brl(p):>14} | não custo {brl(n):>14}')
    for tp, g in nao_m.groupby('tipo'):
        print(f'  não custo — {tp}: {len(g)} título(s) | {brl(g.valor.sum())}')
    print(f'Classificados: {len(lanc)} lançamentos | {brl(lanc.valor.sum())}')
    print(f'Pendências: {len(pend)} | {brl(pend.valor.sum())}')
    tudo_l = pd.concat([lanc, pend])
    vinc = tudo_l[~tudo_l.vinculo_oc.isin(['sem OC', 'decisão pontual', 'parcela anterior'])].documento.nunique()
    print(f'Títulos vinculados a OC: {vinc}')
