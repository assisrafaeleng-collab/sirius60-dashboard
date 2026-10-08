# Classificador TOTVS → EAP (Sirius 60)

Código vindo do Flats BH (`C:\Users\Rafa\fonsecaelage\automacao`), adaptado ao Sirius em 07/10/2026.
As regras de negócio estão no `CLAUDE.md` da raiz; aqui fica só o como usar.
Python pelo comando `py`. Nada aqui grava no banco: a saída é prévia em CSV.

## Estrutura de pastas
    classificador.py      lê as três fontes, separa o que não é custo, vincula às OCs e classifica por EAP
    gerar_regras.py       cria regras.csv e regras_parcelas.csv a partir do consolidado (aba Lançamentos)
    gerar_orcamento.py    cria orcamento.csv a partir de ../public/dados.json
    comparar.py           compara a saída com o consolidado, por mês e EAP e título a título
    util.py               normalização de nomes, CNPJ e similaridade de itens

    entrada/fonseca/      relatórios TOTVS da Fonseca & Lage (o mais recente, com VALOR PAGO, é o usado)
    entrada/dinamica/     relatório TOTVS da Dinâmica
    entrada/rateio/       consulta SQL da Dinâmica aberta por centro de custo (SQL - DINÂMICA.XLSX, VALOR_RATEIO)
    oc/                   relatórios de Ordem de Compras
    fechamentos/          consolidado manual (referência para regras e comparação)
    medicoes/             BMs (Sericita/Giuliano)
    saida/AAAA-MM/        lancamentos.csv, pendencias.csv, nao_custo.csv

    regras.csv            gerada pelo gerar_regras.py (não edite à mão)
    regras_manuais.csv    SUAS decisões — têm prioridade e nunca são apagadas
    regras_parcelas.csv   rateio de NFs já fechadas (parcela /02 repete a /01)
    decisoes_pontuais.csv decisão para UM título (cnpj raiz + documento → EAP com proporção, ou NAO_CUSTO)
    etapa.csv             EAP e pavimento em execução para regras ETAPA: (Fundação desde 2026-06-01)
    orcamento.csv         orçamento por código + pavimento (346 linhas do dados.json)
    pedidos_aco.csv, fornecedores_recorrentes.csv   estrutura do Flats, vazios por enquanto

Todos os CSVs, relatórios, BMs e a pasta saida/ estão no .gitignore. No git vão só os .py e este LEIAME.

## Fontes e critério de valor (CLAUDE.md, 07/10/2026)
| Fonte    | Arquivo                           | Valor          | Prova de pagamento |
|----------|-----------------------------------|----------------|--------------------|
| Fonseca  | entrada/fonseca (mais recente)    | Valor líquido  | VALOR PAGO > 0 |
| Dinâmica | entrada/dinamica                  | Valor Baixado  | Data de Baixa preenchida e Valor Baixado > 0 |
| Rateio   | entrada/rateio (SQL - DINÂMICA)   | VALOR_RATEIO   | DATA_BAIXA preenchida e VALORBAIXA > 0 |

- Centro de custo: aceita "RUA SIRIUS Nº 60", "RUA SIRIUS N º 60" e "1.02.0046" (sem espaços e º).
- Competência = Data de Baixa; se vazia, Previsão de Baixa; por último, Vencimento.
- Cruzamento Dinâmica × Rateio (pela Ref. Lançamento):
  - título 100% Sirius (soma do rateio = valor original) fica no relatório da Dinâmica pelo Valor Baixado; as
    linhas do SQL saem como "já contado no relatório da Dinâmica";
  - título dividido com outras obras: entra pelo VALOR_RATEIO; a linha da Dinâmica (valor cheio) sai.
- Duplicidade entre fontes (mesmo CNPJ + mesmo documento, ou mesmo CNPJ + mesmo valor com até 7 dias): vai
  para pendências, exceto título com decisão pontual.
- Título do SQL com Data de Baixa mas VALORBAIXA zero: pendência para confirmar o pagamento.
- Não são custo (nao_custo.csv): "Prev. Financ." (OC sem NF), APORTE, sem pagamento no relatório e
  decisoes_pontuais com eap = NAO_CUSTO. No Sirius NÃO existe Taxa ADM (a regra M+1 do Flats foi retirada).
- O classificador para com erro se a soma de cada fonte no mês não fechar ao centavo (classificado +
  pendente + não custo = relatório), ou se a soma das linhas não fechar com o TOTAL do relatório.

## Sericita (Giuliano)
Regra confirmada (CLAUDE.md e ../diagnostico/conciliacao_sericita.md): vale e NF líquida são custo quando
pagos; cada um é rateado pela composição do BM a que pertence (2.1.2 / 2.1.6 / 2.1.7 / 2.1.8), em
decisoes_pontuais.csv — provisório até o Rafael confirmar as EAPs. Título novo da Sericita sem decisão vai
para pendências (regra 'pendente' em regras.csv). Nunca lançar o bruto do BM.

## Uso mensal
    py gerar_orcamento.py                         # quando o dados.json mudar
    py gerar_regras.py fechamentos/<consolidado>.xlsx
    py classificador.py --competencia 2026-09     # saida/2026-09/
    py comparar.py fechamentos/<consolidado>.xlsx 2026-05 2026-06 2026-07 2026-08 2026-09
Opções do classificador: --fonseca, --dinamica, --rateio (arquivo), --oc (pasta), --saida (pasta).

## Regras (mesma sintaxe do Flats)
- padrao_item = '*'        → qualquer item do fornecedor
- padrao_item = 'VALOR=x'  → título com esse valor exato
- padrao_item = texto      → item parecido (≥50% das palavras em comum)
- padrao_item = 'CONTEM:X' → item que contém a palavra X
- cnpj = '*'               → regra de item válida para qualquer fornecedor
- eap = 'ETAPA:CAT'        → EAP da etapa vigente na competência (etapa.csv); 'ETAPA_NF:CAT' usa a data da nota
- eap = '2.1.2=0.6;2.1.7=0.4' → rateio fixo entre EAPs (fecha ao centavo na última)
- tipo = pendente          → sempre vai para a fila (ex.: confiança BAIXA no consolidado)
- vigente_desde = AAAA-MM-DD → a regra só vale a partir dessa competência
- decisoes_pontuais.csv com eap = NAO_CUSTO → o título sai do custo; parcela seguinte de uma NF herda a
  decisão da primeira (NAO_CUSTO não é herdado)

## Gravação
Ainda não há carga para o banco do Sirius. Quando houver, a carga substitui o mês inteiro (nunca soma por
cima), com backup e desfazer, e não toca nos 3 lançamentos com lancado_por = 'Rafael' (CLAUDE.md).
