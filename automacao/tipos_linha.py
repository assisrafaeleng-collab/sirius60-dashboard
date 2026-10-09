"""
Tipo de cada linha do orçamento por ID (pedido 13H, Rafael 09/10/2026), lido de tipos_linha_orcamento.csv.

vinculo_material.py e cronograma.py NÃO olham mais o texto da descrição: material ou serviço, tipo do material, tipo
do serviço, janela dentro da estrutura e atividade do cronograma vêm desta tabela, pelo id da linha em
orcamento_planejado. Assim mudar o nome de uma linha no orçamento não muda vínculo, semanas nem horas.

A tabela foi tirada do resultado de 09/10/2026 (regras de texto antigas sobre saida_v2/orcamento_banco_pos3.csv; as
funções antigas estão em backup_2026-10-09_pedido13H/). Colunas:
  id, codigo_eap, pavimento        — a linha (id do banco; código e pavimento só para conferência)
  material                         — True = linha só de material (não é medida; herda do serviço vinculado)
  tipo_material                    — escada | forma | armacao | concretagem | hidraulica | eletrica (material)
  tipo_servico                     — escada | forma | armacao | concretagem | hidraulica | eletrica (serviço de MO)
  servico_estrutura                — escada | laje_trelicada | forma | armacao | concretagem (janela na estrutura)
  atividade, regra                 — atividade do cronograma e motivo da ligação ('' = fora do avanço)
  descricao_em_2026_10_09          — só referência para quem lê; o código não usa
Linha NOVA no orçamento: acrescente uma linha aqui à mão (mesmas colunas). Sem ela, os scripts param com erro em vez
de adivinhar pelo texto.
"""
import os
import pandas as pd

ARQUIVO = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tipos_linha_orcamento.csv')
COLUNAS = ['material', 'tipo_material', 'tipo_servico', 'servico_estrutura', 'atividade', 'regra']


def juntar_tipos(orc, arquivo=ARQUIVO):
    """orc + colunas da tabela, pelo id; para com erro se faltar id ou se código/pavimento não baterem"""
    t = pd.read_csv(arquivo, dtype={'codigo_eap': str, 'tipo_material': str, 'tipo_servico': str,
                                    'servico_estrutura': str, 'atividade': str, 'regra': str})
    for c in ['tipo_material', 'tipo_servico', 'servico_estrutura', 'atividade', 'regra']:
        t[c] = t[c].fillna('')
    t['material'] = t.material.astype(str).str.lower() == 'true'
    falta = orc[~orc.id.isin(t.id)]
    if len(falta):
        raise SystemExit('linhas do orçamento sem tipo em ' + os.path.basename(arquivo) + ' (acrescente à mão): '
                         + '; '.join(f'id {r.id} {r.codigo_eap} {r.pavimento}' for r in falta.itertuples()))
    m = orc.drop(columns=[c for c in COLUNAS if c in orc.columns]).merge(
        t[['id', 'codigo_eap', 'pavimento'] + COLUNAS].rename(columns={'codigo_eap': '_cod', 'pavimento': '_pav'}),
        on='id', how='left')
    ruim = m[(m._cod != m.codigo_eap) | (m._pav != m.pavimento)]
    if len(ruim):
        raise SystemExit('código/pavimento diferente da tabela de tipos: '
                         + '; '.join(f'id {r.id}: {r.codigo_eap} {r.pavimento} × tabela {r._cod} {r._pav}' for r in ruim.itertuples()))
    return m.drop(columns=['_cod', '_pav'])
