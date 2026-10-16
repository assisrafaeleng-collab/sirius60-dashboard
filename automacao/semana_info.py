"""
Leitura dos relatórios da semana para a rotina semanal (pedido 15; ferramentas/semana/atualizar.js).
Uso: py semana_info.py --fonseca <arq> --dinamica <arq> [--oc pasta]
Imprime um JSON (só leitura; nada é gravado): linhas lidas por fonte, títulos pagos com a CHAVE DO TÍTULO
(fonte + CNPJ + documento [com a parcela] + data de baixa), meses cobertos, mesma chave nas duas fontes e a ligação
NF ↔ OC (material com OC, NF sem OC, OC sem NF). Usa as funções do classificador (não repete a lógica dele).
"""
import argparse, contextlib, json, re, sys
import pandas as pd
import classificador as C


def montar(a):
    fon = C.ler_totvs(a.fonseca, 'Fonseca')
    din = C.ler_dinamica_completo(a.dinamica)
    C.NAO_CUSTO_DOC['ISS retido de nota'] = r'^ISSRET'
    tudo = pd.concat([fon.assign(cruzamento=''), din.assign(cruzamento='')], ignore_index=True)
    tudo['chave'] = tudo.fonte + '|' + tudo.ref.astype(str) + '|' + tudo.documento
    tudo['mes'] = tudo.competencia.astype(str).str[:7]
    antes = pd.to_datetime(tudo.competencia, errors='coerce') < pd.Timestamp(C.INICIO_OBRA)
    tudo.loc[antes, 'mes'] = C.MES_CREDITO
    custo, _ = C.separar_nao_custo(tudo)
    pagos = custo[custo.pago == True]
    baixa = pd.to_datetime(pagos.competencia, errors='coerce')

    # mesma chave (CNPJ + documento) paga nas DUAS fontes
    k = pagos.assign(k=pagos.cnpj + '|' + pagos.documento.str.replace(r'\s', '', regex=True).str.lstrip('0'))
    dupl = []
    for kk, g in k[k.cnpj != ''].groupby('k'):
        if g.fonte.nunique() > 1:
            dupl.append({'chave': kk, 'fornecedor': g.fornecedor.iloc[0], 'documento': g.documento.iloc[0],
                         'fontes': [{'fonte': r.fonte, 'valor': round(float(r.valor), 2), 'baixa': str(r.competencia)}
                                    for r in g.itertuples()]})

    # NF ↔ OC (3B): vínculo pelo classificador (OC no documento, NF + CNPJ na OC, ou valor de OC pendente)
    ocs = C.ler_ocs(a.oc)
    vinc = []
    for t in pagos.itertuples():
        linhas, conf = C.vincular_oc(t, ocs)
        vinc.append({'fonte': t.fonte, 'baixa': str(t.competencia), 'documento': t.documento, 'fornecedor': t.fornecedor, 'valor': round(float(t.valor), 2),
                     'oc': ','.join(sorted(set(linhas.oc))) if linhas is not None else '', 'confianca': conf or ''})
    nf_tit = set()
    for t in pagos.itertuples():
        m = re.match(r'^0*(\d+)/\d+$', t.documento)
        if m:
            nf_tit.add((t.cnpj, int(m.group(1))))
    oc_sem_nf = ocs[ocs.nf.isna() & (ocs.total_item > 0)].groupby(['oc', 'fornecedor']).total_item.sum().round(2).reset_index()
    oc_nf_sem_titulo = [{'oc': r.oc, 'nf': int(r.nf), 'fornecedor': r.fornecedor}
                        for r in ocs[ocs.nf.notna()].drop_duplicates(['oc', 'nf']).itertuples() if (r.cnpj, int(r.nf)) not in nf_tit]

    return {
        'linhas': {f: int((tudo.fonte == f).sum()) for f in ['Fonseca', 'Dinâmica']},
        'pagos': {f: int((pagos.fonte == f).sum()) for f in ['Fonseca', 'Dinâmica']},
        'baixa_min': str(baixa.min().date()) if len(baixa) else None,
        'baixa_max': str(baixa.max().date()) if len(baixa) else None,
        'meses': sorted(pagos.mes.unique().tolist()),
        'titulos': [{'fonte': r.fonte, 'cnpj': r.cnpj, 'documento': r.documento, 'fornecedor': r.fornecedor,
                     'baixa': str(r.competencia), 'mes': r.mes, 'valor': round(float(r.valor), 2)} for r in pagos.itertuples()],
        'duas_fontes': dupl,
        'oc': {'vinculos': vinc,
               'oc_sem_nf': [{'oc': r.oc, 'fornecedor': r.fornecedor, 'total': float(r.total_item)} for r in oc_sem_nf.itertuples()],
               'oc_nf_sem_titulo': oc_nf_sem_titulo},
    }


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--fonseca', required=True)
    ap.add_argument('--dinamica', required=True)
    ap.add_argument('--oc', default='oc')
    a = ap.parse_args()
    # avisos do classificador vão para o stderr: o stdout é só o JSON
    with contextlib.redirect_stdout(sys.stderr):
        out = montar(a)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(out, ensure_ascii=False))
