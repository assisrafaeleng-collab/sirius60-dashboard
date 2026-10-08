# Classificador TOTVS → EAP (Sirius 60)

Código vindo do Flats BH (`C:\Users\Rafa\fonsecaelage\automacao`), adaptado ao Sirius em 07/10/2026.
As regras de negócio estão no `CLAUDE.md` da raiz; aqui fica só o como usar.
Python pelo comando `py`. Nada aqui grava no banco: a saída é prévia em CSV.

## Estrutura de pastas
    classificador.py      lê as três fontes, separa o que não é custo, vincula às OCs e classifica por EAP
    gerar_regras.py       cria regras.csv e regras_parcelas.csv a partir do consolidado (aba Lançamentos)
    gerar_orcamento.py    cria orcamento.csv a partir de ../public/dados.json + ajustes_orcamento.csv
    comparar.py           compara a saída com o consolidado, por mês e EAP e título a título
    contas_a_pagar.py     contas a pagar do fechamento (relatórios completos) → saida_v2/contas_AAAA-MM.csv
    util.py               normalização de nomes, CNPJ e similaridade de itens

    entrada/fonseca/      relatórios TOTVS da Fonseca & Lage (o mais recente, com VALOR PAGO, é o usado)
    entrada/dinamica/     relatório TOTVS da Dinâmica
    entrada/rateio/       consulta SQL da Dinâmica aberta por centro de custo (SQL - DINÂMICA.XLSX, VALOR_RATEIO)
    oc/                   relatórios de Ordem de Compras
    fechamentos/          consolidado manual (referência para regras e comparação)
    medicoes/             BMs (Sericita/Giuliano)
    saida/AAAA-MM/        lancamentos.csv, pendencias.csv, nao_custo.csv, resumo.json (totais por fonte)

    regras.csv            gerada pelo gerar_regras.py (não edite à mão)
    regras_manuais.csv    SUAS decisões — têm prioridade e nunca são apagadas
    regras_parcelas.csv   rateio de NFs já fechadas (parcela /02 repete a /01)
    decisoes_pontuais.csv decisão para UM título (cnpj raiz + documento → EAP com proporção, ou NAO_CUSTO)
    etapa.csv             EAP e pavimento em execução para regras ETAPA: (Fundação desde 2026-06-01)
    orcamento.csv         orçamento por código + pavimento (346 linhas do dados.json + ajustes)
    ajustes_orcamento.csv linhas decididas pelo Rafael que ainda NÃO estão no orçamento oficial
                          (codigo_eap;grupo;descricao;pavimento;valor_orcado;origem;data)
    pedidos_aco.csv, fornecedores_recorrentes.csv   estrutura do Flats, vazios por enquanto

Todos os CSVs, relatórios, BMs e a pasta saida/ estão no .gitignore. No git vão só os .py e este LEIAME.

## Linhas fora do orçamento oficial (ajustes_orcamento.csv)
- 17.1.14 "Combustível obra", Canteiro, R$ 24.000,00 (R$ 1.000/mês × 24 meses; Rafael, 08/10/2026). O Auto Posto
  vai para ela. A 17.1.4 é "Locação de Andaime".
- O gerar_orcamento.py soma esse arquivo ao orcamento.csv só para o classificador; o dados.json e o banco
  NÃO têm essas linhas. **Pendente:** incluí-las no orçamento oficial (dados.json + orcamento_planejado) na
  fase do orçamento. Até lá o importar.js aceita o código com aviso, e o dashboard mostra o realizado sem verba.

## Fontes oficiais desde 08/10/2026: relatórios completos (`--completo`)
| Fonte    | Arquivo                                                | Valor        | Prova de pagamento |
|----------|--------------------------------------------------------|--------------|--------------------|
| Fonseca  | entrada/fonseca/Relatório de Custo Fonseca e Lage*.xlsx | Valor Baixado | Data de Baixa preenchida e Valor Baixado > 0 |
| Dinâmica | entrada/dinamica/Relatório de Custo DINAMICA*.xlsx      | VALOR_RATEIO (parte do Sirius) | DATA_BAIXA preenchida e VALORBAIXA > 0 |

    py classificador.py --competencia 2026-09 --completo     # saida_v2/2026-09/

- O relatório da Dinâmica tem o layout da consulta SQL, com todas as obras. Já traz as notas rateadas, então o
  SQL deixa de ser fonte separada (as 27 linhas do Sirius foram conferidas em 08/10).
- As duas fontes conferem com a linha de TOTAL do próprio relatório: a Fonseca nas colunas líquido e baixado;
  a Dinâmica com a soma sem arredondar das linhas do Sirius.
- ISS retido de nota (documento "ISSRET..."): não é custo, porque o VALOR_RATEIO é o bruto da nota e já inclui o
  imposto (decisão 08/10/2026). ISS da Prefeitura que não for retenção vai para 19.1.22.
- Linhas sem pagamento = previsão ou pedido parado: não são custo; vão para o contas a pagar. Os
  vales/adiantamentos da Sericita não entram no contas a pagar.
- Sem `--completo`, o classificador funciona como antes (relatórios antigos + SQL). Como os relatórios completos
  são agora os mais recentes de cada pasta, para refazer uma carga antiga é preciso informar os arquivos
  (`--fonseca`, `--dinamica` e `--rateio`).

## Fontes e critério de valor até 07/10/2026 (modo antigo)
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

## Contas a pagar (CLAUDE.md, "Contas a pagar", 08/10/2026)
    py contas_a_pagar.py --fechamento 2026-09          # saida_v2/contas_2026-09.csv (+ _fora.csv e _resumo.json)
    node ferramentas/fechamento/importar.js --contas --fechamento 2026-09 --saida saida_v2              # prévia
    node ferramentas/fechamento/importar.js --contas --fechamento 2026-09 --saida saida_v2 --confirmar  # grava
    node ferramentas/fechamento/importar.js --contas --fechamento 2026-09 --saida saida_v2 --desfazer <carga> [--confirmar]
Pré-requisito para gravar: ../supabase/contas/1-contas-a-pagar.sql. NÃO é custo: nada vai para custos_lancamentos.
- Em aberto no fechamento: Fonseca com Valor Baixado vazio/zero, ou baixa depois do último dia do mês do
  fechamento. Dinâmica: não há a pagar (o que aparecer em aberto é listado em _fora.csv para conferência).
- Filtros, na ordem: (a) vales da Sericita; (b) OCs 1787 e 1849; (c) duplicidade (documento já pago em
  qualquer fonte ou no custo gravado, valor igual com data a até 5 dias, previsão de OC já faturada, BM já
  pago); (d) vencimento antes do mês do fechamento, exceto parcela pendente de NF com outra parcela paga.
- EAP pelas mesmas regras e decisões do classificador. Recorrente (sai do card e do IPC, fica marcado):
  grupos 17 e 18 e 1.1.6; indireto recorrente pela coluna recorrente de custos_indiretos_planejados (marcado
  pelo importar.js). Custo direto a pagar = classe direto e não recorrente.
- --confirmar insere a carga nova e só depois apaga a anterior do mesmo fechamento; a cópia da anterior fica em
  saida_v2/contas_AAAA-MM_backup_<carga>.json (é o que o --desfazer devolve).

## Gravação no banco (../ferramentas/fechamento/importar.js)
Pré-requisito: ../supabase/custos/1-importacoes.sql e 2-colunas-custos.sql rodados (nessa ordem).

    node ferramentas/fechamento/importar.js --competencia 2026-07              # prévia: só lê o banco
    node ferramentas/fechamento/importar.js --competencia 2026-07 --confirmar  # grava
    node ferramentas/fechamento/importar.js --desfazer <id> [--confirmar]      # devolve o mês como estava
    node ferramentas/fechamento/importar.js --competencia 2026-09 --saida saida_v2 [--confirmar]  # relatórios completos

- Uma competência por vez, lida de saida/AAAA-MM/lancamentos.csv.
- SAI só o que é de carga: linhas do mês com importacao_id ou lancado_por = 'carga planilha' (seed 05). O resto
  fica ("mantido"): os 3 lançamentos do Rafael (terreno, ITBI, projeto arquitetônico) e o que for lançado pela tela.
  A prévia avisa quando um mantido parece repetir uma linha nova.
- ENTRA com status 'pago', lancado_por 'importacao', fonte, cnpj e importacao_id. A data de pagamento vai para
  data_emissao (a coluna da semana no site); pagamento antes de 03/08/2026 (S01) vai para 03/08/2026, mantendo a
  competência, e o histórico guarda "[pago em dd/mm/aaaa]".
- Recusa: soma do CSV diferente do resumo.json, competência futura, pendência no mês, EAP fora do orçamento.
- Linhas com a mesma nota, fornecedor e EAP (nota aberta por item da OC, ou com duas naturezas no rateio) são
  agrupadas numa linha só, somando o valor; o total não muda e a prévia mostra quais foram agrupadas.
- Antes de apagar, guarda cópia das linhas que saem em importacoes.substituidos (é o que o --desfazer devolve).
