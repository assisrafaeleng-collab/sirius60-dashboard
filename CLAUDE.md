# CLAUDE.md — Dashboard Residencial Sirius 60

Regras deste projeto. Valem para TODA tarefa, mesmo em auto mode.

## Pasta e repositório
- Pasta oficial: `C:\Users\Rafa\Documents\sirius60` (branch `main`). Repositório privado no GitHub.
- `C:\Users\Rafa\sirius60-dashboard` (ou `_ANTIGO`) é uma cópia velha: não usar, não alterar.
- Referência de arquitetura: `C:\Users\Rafa\fonsecaelage` (Flats BH). Pode LER; NUNCA alterar nada lá.
- Obra no banco: `obra_id = 'sirius60'`.

## O que é proibido sem autorização explícita do Rafael na mensagem
- Gravar, alterar ou apagar dados no Supabase (nenhum script, nenhuma chamada de API que grave).
- Rodar SQL. SQL é escrito como arquivo em `supabase/<tema>/`, sempre com o script de DESFAZER ao lado,
  e quem roda é o Rafael, no SQL Editor, uma consulta de cada vez.
- `git commit`, `git push`, deploy, `npm install` de pacote novo.
- Apagar arquivos. Antes de alterar CSV de regras/decisões ou planilhas, fazer backup com data no nome.
- Ler `.env.local` ou qualquer arquivo de chaves. Nunca mostrar valores de chaves, senhas, CPFs.

## Cuidados permanentes
- NUNCA rodar de novo o seed `05_custos_realizados_sirius60.sql`: ele apaga todos os custos da obra.
- `10_seed_horas_v2` também apaga e recarrega o orçamento: não rodar.
- `setup-sirius60-v39.js` (guardado em backup) recria o código antigo e inseguro: nunca rodar.
- Quando um SQL depende de código novo: publicar o código ANTES do SQL.
- Segurança (feita em 07/10/2026): servidor só com `SUPABASE_SECRET_KEY`; anon e authenticated sem nenhuma
  permissão (`supabase/seguranca/1-fechar-acesso.sql`); RLS em todas as tabelas, sem políticas públicas;
  views com `security_invoker = on`. Tabela nova nasce com RLS e sem grant para anon/authenticated.
- Rotas de gravação exigem `SENHA_MEDICAO` no cabeçalho `x-dashboard-senha` (lib/senha-servidor.js).
- Datas sempre no fuso America/Sao_Paulo; não usar `toISOString()` para obter data/competência.
- Arquivos com dados da obra (CSV, XLSX, XLS, PDF, `automacao/` sensível, `diagnostico/`, `pedidos.txt`,
  backups) ficam no `.gitignore`.

## Publicação
- Push na `main` cria deploy de produção NÃO atribuído ao domínio (Auto-assign desligado). O Rafael promove
  manualmente (Promote to Production) depois de conferir.
- Nunca usar Redeploy para publicar mudança.

## Forma de trabalhar
- Pedidos longos chegam pelo `pedidos.txt`. Antes de seguir, confirme a primeira linha do pedido.
- Mudança que grava: primeiro prévia, depois esperar autorização.
- Ao terminar, mostrar no terminal um resumo curto: o que mudou (arquivos), o que conferir, o que falta.
- Indicadores com nomes em português: valor agregado, IPC, IDP, avanço físico (sem siglas em inglês na tela).

## Dados da obra
- Prazo: 24 meses, M01 = ago/2026 a M24 = jul/2028 (cronograma final). Início da obra para custo e cronograma:
  agosto/2026 (S01 começa em 03/08/2026). Os gestores deram um mês de "crédito": tudo que foi pago antes de
  03/08/2026 entra na competência 2026-08 (data real guardada no histórico).
- Cronograma oficial: "Cronograma_Sirius_60__Final_-_13-08-26.xlsx", aba "Cronograma" (a aba "Linha de Balanço"
  NÃO vale). Fica em automacao\cronograma\. O cronograma é esquemático: cada mês M01..M24 tem 4 semanas (96 no
  total); horas por atividade (Horas MO), início e duração em semanas. Os códigos do cronograma NÃO são os da EAP
  (ex.: cronograma 3.1 = Estrutura Pilotis; orçamento 3.1 = Subsolo): ligar por pavimento + serviço.
- Calendário (igual ao Flats): semanas de segunda a domingo, cortadas no último dia do mês; cada mês começa numa
  semana nova, mesmo que incompleta; fragmento de 1 dia junta com a semana vizinha do mesmo mês. Numeração
  contínua a partir de S01 = 03/08/2026. O planejado do cronograma é distribuído pelos dias reais de cada mês
  (mês M do cronograma = mês do calendário), para fechar também por mês.
- Pavimentos: Fundação, Subsolo, Pilotis, Térreo, 1º, 2º e 3º Pav, Terraço, Reservatório, Edifício, Externo, Canteiro.
- Site e calendário (pedido 11): as semanas vêm de lib/calendario.js — o servidor lê calendario_semanas e
  curva_s_semanal_planejada (lib/calendario-servidor.js) e o navegador recebe pela /api/calendario (pages/_app.js).
  Sem as tabelas, fica o cálculo antigo (96 semanas de 7 dias) e o site funciona igual: por isso o código vai
  antes do SQL. Nenhuma tela calcula semana por conta própria; usar sempre lib/constants.js / lib/calendario.js.

- Escadas (Rafael, 08/10): são executadas nos dias finais da estrutura de cada pavimento. Cada linha de escada
  (inclusive 2.1.10 a 2.1.13 da fundação) fica na ÚLTIMA semana da atividade de estrutura do seu pavimento.
- Sequência dentro da estrutura de cada pavimento (Rafael, 08/10; igual ao Flats): aço (armação) primeiro, depois
  forma, depois concretagem. Concretagem em 2 etapas: pilares 30% e laje 70%. Escada nos dias finais.
  A forma NÃO espera a armação terminar: começa uns 3 dias (≈ meia semana) depois do início da armação e as duas
  correm juntas (sobrepostas).
  Janelas (pedido 12; automacao/cronograma.py JANELAS_ESTRUTURA): em 8 semanas, armação 1–6, forma da metade da 1
  até a 7, laje treliçada 5–7 (aprovada pelo Rafael, 08/10), concretagem 30% na 4 (pilares) e 70% na 8 (laje),
  escada na 8; Reservatório (4 semanas) na mesma ordem. Material segue a janela do serviço vinculado. Fundação: só
  a 2.1.3 do cronograma muda (forma meia semana depois da armação). Horas por atividade não mudam.
- Encunhamento (4.x.3 / 4.x.4; Rafael, 08/10): em todos os pavimentos começa na semana real seguinte ao FIM da
  alvenaria do mesmo pavimento e dura 2 semanas. Horas não mudam (são as da "Alvenaria <pavimento>" do cronograma).
- Avanço físico (tela): mostrar só as linhas de SERVIÇO (MO). Linhas "Apenas Material" não aparecem no avanço nem
  recebem medição. Cada material fica VINCULADO à linha de serviço do mesmo pavimento (aço → armação; madeira/
  forma material → forma MO; concreto material → concretagem MO etc.) e herda o avanço dela no valor agregado
  (regra do material do Flats: maior entre avanço do serviço × orçado e custo comprometido limitado ao orçado).
  Vínculo (pedido 12): automacao/vinculo_material.py → saida_v2/vinculo_material_servico.csv (49 materiais, 53
  vínculos) e supabase/orcamento/4-vinculo-material.sql (coluna e_material + tabela orcamento_material_servico com
  peso; não rodado). Concreto usinado vinculado à concretagem MO (no Flats ele fica fora e entra pela medição:
  diferença decidida pelo Rafael). Material hidráulico 6.1.2 dividido entre 6.1.1 (ramais) e 6.1.1.1 (prumadas)
  na proporção das horas (60/40; Rafael, 08/10): herda o avanço ponderado pelos pesos.
- Medições lançadas em linha de material (Rafael, 08/10): as 5 da fundação (2.1.3, 2.1.4 e 2.1.5, de 30/08 e 13/09)
  serão TRANSFERIDAS para a linha de serviço vinculada (aço 2.1.4 → armação 2.1.7; madeira/forma 2.1.3 → forma
  2.1.6; concreto 2.1.5 → concretagem 2.1.8) na conversão das medições para % acumulado (fase das telas). Até lá
  não mexer nelas.
- Medição em % ACUMULADO (pedido 13, modelo do Flats): tabela avanco_fisico_historico (supabase/avanco/
  1-medicao-acumulada.sql), um retrato por linha de serviço (código + pavimento); vale o último até a semana (pode
  revisar para baixo). Sem a tabela, o site soma os incrementos antigos de avanco_fisico_realizado (fallback;
  lib/medicao-servidor.js). Na conversão, retrato de material vai para o serviço vinculado, mas na MESMA data vale o
  do serviço (as 5 de 08/10 eram medições paralelas e foram absorvidas, avanço igual).
  Medição de 1.1.6 é ignorada (custo de tempo).
  Contenção 15.1.4 (Externo) NÃO foi executada (Rafael, 09/10): as 2 medições dela (ids 4 e 36: 15% em 23/08 e +5%
  em 30/09) ficam FORA da conversão (por id; continuam na tabela antiga e no backup). Resultado: 23 medições → 21 na
  carga → 16 retratos. Em S11: avanço 4,71% → 4,65% (−30 h), valor agregado direto −R$ 40.000,00. Até o SQL rodar,
  o site (fallback dos incrementos antigos) ainda conta a 15.1.4 em 20%.
- Valor agregado (lib/valor-agregado.js, /api/painel): serviço = % × orçado; material = maior entre % herdado ×
  orçado e comprometido limitado ao orçado; locação (17) = pago limitado à verba; tempo (1.1.6) = verba ×
  dias decorridos ÷ dias da obra. Custo comprometido = pago até o fim da semana + a pagar (direto, não recorrente)
  do último fechamento cujo último dia já passou. Pagamento sem pavimento é rateado entre as linhas da EAP pelo orçado.
- public/dados.json saiu do site e do git (pedido 13); cópia em backup_seguranca_2026-10-07\.
- Custo direto (telas e cards, Rafael 08/10; lição do Flats): comparar o custo realizado (pago + a pagar) com o
  VALOR AGREGADO (% de avanço físico da linha × valor orçado da linha; material pela regra do material), e NÃO com o
  planejado do cronograma. O planejado fica só como informação secundária ("ritmo de gasto vs cronograma").
  Colunas: Orçado | Valor agregado | Custo (pago e a pagar) | % do orçado | Estouro/economia | Saldo da verba.
- VERBA DE FORMA (pedido 14A, Rafael 09/10): a madeira de forma é reaproveitada (até 3 usos) na estrutura toda, então
  as 13 linhas de MATERIAL de forma (inclusive forma de escada) são UMA verba de R$ 311.278,36, por id (lib/valor-agregado.js
  VERBA_FORMA_IDS: 2.1.3, 2.1.11, 3.1.6, 3.1.9, 3.2.6, 3.2.9, 3.3.6, 3.3.8, 3.4.5 [id 720], 3.4.8, 3.5.6, 3.6.6, 3.7.6).
  Custo: o pago + a pagar de qualquer uma delas é o gasto da verba, e cada linha mostra gasto × (orçado ÷ verba); os
  lançamentos continuam gravados na linha original (só cálculo/tela; nível 3 com a nota "verba de forma rateada").
  Valor agregado: % do serviço vinculado × orçado, SEM compra antecipada. Material comprado à frente aparece como
  estouro até o serviço avançar (dica na tela). As demais regras de material não mudam.
- Grupo 18 → INDIRETO (pedido 14A, Rafael 09/10): 18.1.1 "Mão de Obra Direta" (R$ 428.131,20) sai do direto e vira
  19.1.25 "Mão de obra de apoio (se houver necessidade)", tipo RESERVA (coluna custos_indiretos_planejados.reserva):
  planejado NÃO diluído, planejado = realizado (pago + a pagar) até a verba, "reserva · N% da verba usada"; só gera
  estouro se passar da verba. SQL: supabase/orcamento/6-grupo18-para-indireto.sql (direto 334 → 333 linhas,
  7.123.256,27; indireto 14 linhas, 2.874.508,08; total 9.997.764,35). O grupo 18 deixa de existir no direto.
  Antes do SQL o site funciona como antes (sem a coluna, nenhuma linha é reserva).
- Indiretos "a realizar" (pedido 14A): pontual com planejado até a semana e nada pago nem a pagar. Subtotal e total
  mostram "desvio · a realizar · saldo"; o card "Saldo custo indireto" mostra "inclui R$ X a realizar".
- Indiretos (Rafael, 08/10): recorrentes (engenheiro, contabilidade, IPTU, despesas bancárias…) diluídos linearmente
  pela obra toda; pontuais (terreno, ITBI, projetos, registro, taxas) no mês previsto, convertendo a semana antiga
  para a nova pela data.

## Fontes de custo (decisões do Rafael, 07/10/2026; ATUALIZADO 08/10/2026)
- FONTES OFICIAIS a partir de 08/10/2026 (relatórios completos do que foi pago até 09/2026):
  - "Relatório de Custo Fonseca e Lage - Até 09-26" → valor = VALOR BAIXADO (o que de fato foi pago).
  - "Relatório de Custo DINAMICA - Até 09-26" → valor = VALOR DE RATEIO (parte do Sirius).
  - Linhas sem pagamento nesses relatórios = previsão ou pedido parado: NÃO são custo; vão para avaliação
    do contas a pagar.
  - Os relatórios antigos (SIRIUS 60 (4), SIRIUS 60 - DINÂMICA, SQL - DINÂMICA, Complemento) passam a ser
    só conferência. Se o relatório completo da Dinâmica já traz o rateio, o "SQL (rateio)" deixa de ser fonte
    separada (não somar as duas coisas).
- Duas empresas pagam a obra, sem sobreposição esperada:
  - Fonseca & Lage: mão de obra e serviços sem nota fiscal.
  - Dinâmica: tudo que tem NF-e (maior parte dos materiais).
  - Mesmo assim, checar duplicidade (mesmo CNPJ + documento nas duas fontes) e mostrar na prévia.
- Rateio: notas compradas pela Dinâmica que atendem várias obras. Vale SÓ o valor rateado do Sirius;
  a mesma nota pelo valor cheio NÃO entra (evitar contar duas vezes).
- Centro de custo aparece como `RUA SIRIUS Nº 60` (Fonseca), `RUA SIRIUS N º 60` (Dinâmica) e `1.02.0046` (OC):
  normalizar espaços ao comparar.
- Prova de pagamento (relatório sem "Valor Pago"): Data de Baixa preenchida e Valor Baixado > 0.
- Não existe Taxa ADM no Sirius (a regra M+1 do Flats NÃO se aplica). O salário do engenheiro entra em 19.1.23 (indireto).
- Histórico manual protegido: SÓ os 3 lançamentos com lancado_por = 'Rafael' (terreno e custos anteriores que
  não aparecem nos relatórios TOTVS). Nenhuma carga automática apaga ou substitui esses lançamentos.
- Os 20 lançamentos "carga planilha" (seed 05, vindos do TOTVS da Fonseca) PODEM ser substituídos mês a mês pela
  carga do classificador (com backup e desfazer). Carga substitui o mês inteiro; nunca soma por cima.
- Sericita (Giuliano), CNPJ 23.668.984/0001-89 (no TOTVS aparece como "GIULIANO DA SILVA OLIVEIRA"/"SERECITA"),
  regra CONFIRMADA na conciliação de 07/10/2026 (diagnostico/conciliacao_sericita.md):
  - Vale de R$ 2.500 toda sexta; no fechamento do mês os vales são abatidos no BM; a NF sai pelo LÍQUIDO.
  - Fonte única: Fonseca. Vale = custo no pagamento; NF líquida = custo no pagamento; vale + NF = bruto do BM.
  - Cada pagamento (vale ou NF) é rateado pela composição do BM a que pertence. EAPs (Rafael, 07/10):
    escavação → 2.1.2; armação → 2.1.7; forma → 2.1.6.
  - Diárias NÃO têm linha própria: vão para o serviço em execução no período, pela descrição da diária no BM
    (terra, escavação, limpeza de blocos, pedra → 2.1.2; concretagem → linha de concretagem da fundação;
    aço → 2.1.7). Na dúvida, pendência.
  - NUNCA lançar o bruto do BM além dos vales (conta duas vezes).
  - BM1 (R$ 4.639,17, jul/26) foi pago pela DINÂMICA ("Adto Forn" 03/07, faturamento direto): é custo UMA vez,
    em 2.1.2. Se aparecer também na Fonseca, a da Fonseca é que vira NAO_CUSTO (regra geral: cada BM/título conta
    uma vez só, seja qual for a empresa que pagou).
  - NAO_CUSTO: a 2ª linha do vale de 26/06 na Fonseca (repetição; pago uma vez só).
  - Vales/adiantamentos semanais da Sericita NÃO entram no contas a pagar (sem medição do período, só poluem);
    entram como custo apenas quando pagos.
  - Previsões das OCs 1787 e 1849 não entram no contas a pagar (comprador vai cancelar/baixar no TOTVS).
- Outras decisões (Rafael, 07 e 08/10/2026):
  - ISS RETIDO de nota (linhas ISSRET): NAO_CUSTO, porque o valor da nota (rateio/baixado) já inclui o imposto;
    o ISS fica dentro do custo do serviço. ISS da Prefeitura que NÃO for retenção de nota → 19.1.22.
  - Terraplanagem (Luciano José Perdigão) → 2.1.1.
  - Aço (Gerdau, Fortaleza) → 2.1.4. Viferro e Cofermeta → 17.1.10. Padaria → 17.1.12.
  - Impressões/cópias (Copiadora Realce) → linha de projeto estrutural do grupo 19.
  - Caixa Cartões (cartão pré-pago/alimentação de funcionário, R$ 700,00 em 08/2026) → 19.1.25 (mão de obra de
    apoio, indireto/reserva; Rafael 09/10, pedido 14A). Antes: 18.1.1 (08/10) e, antes disso, NAO_CUSTO.
  - Combustível da obra (Auto Posto; gasolina do carro de apoio) → 17.1.14 (no orçamento final:
    "Gasolina Carro Vandinho", R$ 24.000,00).
  - Areial Mariana (pedra de mão usada na concretagem dos fustes, no lugar de concreto) → 2.1.5
    (concreto usinado, apenas material).
  - Diária mista "Concretagem blocos e limpeza dos blocos" (BM3 item 3.5, R$ 800) → 50% 2.1.8 / 50% 2.1.2.

## Orçamento oficial (decisão do Rafael, 08/10/2026)
- Arquivo oficial: "Orcamento_Rua_Sirius_60_-_Final_-_03-08-26.xlsx" (aba Orçamento). Substitui o
  "Orcamento_Rua_Sirius_60_organizado.xlsx" (versão antiga, não usar).
- Totais da planilha: custo direto R$ 7.527.387,47; indireto R$ 2.446.376,88; total R$ 9.973.764,35.
  Atenção: o subtotal do grupo 17 na planilha (758.444,00) não soma a 17.1.14 "Gasolina Carro Vandinho"
  (R$ 24.000,00); com ela o grupo 17 = 782.444,00 e o direto = 7.551.387,47.
- Grupo 17: 17.1.11 Restaurante, 17.1.12 Padaria, 17.1.13 Locação de Estadia p/ empreiteiros, 17.1.14 Gasolina
  (combustível da obra). Alimentação e estadia ficam no grupo 17 (direto), decisão do Rafael.
- Arquivo fica em automacao\orcamentos\ (fora do git).
- Diferença final × banco antigo (+128.752,27) = só preço: MO de forma R$ 60 → R$ 75/m² em 2.1.6, 3.1.5, 3.2.5,
  3.3.5, 3.4.6, 3.5.5, 3.6.5, 3.7.5. Mais a linha nova 17.1.14 (+24.000,00).
- No 2º Pav, as descrições de 3.4.5 e 3.4.6 estão trocadas (planilha e banco): corrigir junto.
- 3.0.1 e 4.0.9 têm R$ 0,00 mas têm horas (1.305 Hh e 60,1 Hh): MANTER (base de horas do avanço físico).
- Código repetido no mesmo pavimento: 6.1.1 "prumadas e reservatório" → 6.1.1.1 (nos 4 pavimentos).
- ALVENARIA PILOTIS × SUBSOLO (Rafael, 08/10): o PILOTIS tem mais alvenaria. O orçamento está trocado; o cronograma
  está certo. Pilotis = 143,26 m² de alvenaria, verga 5,25 m³, encunhamento 47,75 m (R$ 666,64);
  Subsolo = 92,41 m², verga 3,024 m³, encunhamento 30,80 m (R$ 430,02). Os códigos seguem o subgrupo do orçamento:
  4.1.x = Pilotis, 4.2.x = Subsolo (os valores é que trocam de linha).
- Linhas sem valor na planilha (11.1.5, 11.1.6, 15.1.5 Muro de Divisas): ficam fora até o Rafael definir.
- Fonte única: o banco (orcamento_planejado + custos_indiretos_planejados), lido pelo site em /api/orcamento
  (commit def580f). public/dados.json deixa de ser usado; apagar só com autorização, depois de conferido.
- SQL do orçamento final: supabase/orcamento/1-orcamento-final.sql (+ desfazer), com travas
  (antes: 333 linhas e 7.398.635,20; depois: 334 linhas e 7.551.387,47). Ordem: promover def580f → conferir
  o site (números iguais) → rodar o SQL.
- Descrições novas da fundação e da estrutura (pedido 13H, Rafael 09/10): planilha revisada muda SÓ a descrição de
  69 linhas (2.1.x e 3.x); SQL em supabase/orcamento/5-descricoes-fundacao-estrutura.sql. Decisões:
  - 3.2.5 e 3.3.5: MANTER "3 utilizações" (não o "4 utilizações" da planilha nova): "Forma de chapa compensada
    plastificada 18 mm, 3 utilizações - (Viga,Pilares e Laje Maçiça) - (Mão de Obra)".
  - 2.1.6: "Montatem" corrigido para "Montagem": "Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)".
  - As duas correções valem na planilha (automacao\orcamentos\) e no banco, para ficarem iguais.
  - 2º Pav: a descrição vai pela FUNÇÃO da linha (id 720 = material → "Material p/ Forma (Apenas Material)";
    id 721 = MO → "... - (Mão de Obra)"), não pelo código. Limpeza só de espaços duplos/início/fim.
  - Correções de digitação (Rafael, 09/10), iguais na planilha e no SQL 5: 2.1.5 = "Concreto Bombeado fck 25 MPa
    (Bloco, vigas e pilares) - (Material)"; sem espaço dentro dos parênteses, espaço antes de "(" e depois de vírgula
    ("(Bloco, vigas e pilares)", "(Viga, Pilares e Laje Maciça)"); fundação no padrão da estrutura ("Concreto Escada -
    (Apenas Material)", "Material Forma Escada - (Apenas Material)"); "Maçiça" → "Maciça"; "25Mpa" → "25 MPa".
    Traços ("Blocos- Vigas -Pilares", 2.1.6) ficaram como estão.
  - Backups: planilha antiga ..._backup_2026-10-09.xlsx, a nova como chegou ..._recebida_2026-10-09.xlsx e antes das
    correções de digitação ..._backup_2026-10-09_antes_digitacao.xlsx.
- Tipo de cada linha por ID, NÃO pelo texto (pedido 13H, Rafael 09/10): automacao/vinculo_material.py e
  automacao/cronograma.py leem automacao/tipos_linha_orcamento.csv (via tipos_linha.py): material, tipo do material,
  tipo do serviço, janela na estrutura e atividade do cronograma. A tabela é o resultado das regras de texto antigas
  sobre o orçamento de 09/10 (scripts antigos em automacao/backup_2026-10-09_pedido13H/). Provado: com os nomes
  novos, os dois scripts dão exatamente os mesmos vínculos (53), o mesmo SQL 4, as mesmas semanas e as mesmas horas
  por semana. Linha nova no orçamento: acrescentar à mão na tabela (sem ela o script para com erro).

## Contas a pagar (decisões do Rafael, 08/10/2026)
- Fonte: os mesmos relatórios completos de automacao\entrada\ (Fonseca e Dinâmica). A Dinâmica também pode ter
  títulos em aberto (ex.: Betonita 616, R$ 29.620,00 — entra, decisão do Rafael 08/10).
- Fonseca: linha SEM valor na coluna "Valor Baixado" = em aberto (candidata a contas a pagar).
- Regra da data: é a pagar o título que NÃO estava pago na data do fechamento (último dia do mês). Ex.: NF do BM4
  (R$ 19.336,12) paga em 02/10 = a pagar no fechamento 2026-09 e custo pago em 2026-10.
- Considerar só vencimentos de 2026-09-01 em diante, EXCETO parcelas pendentes de compras antigas pagas
  parceladamente (ex.: NF /01 e /02 pagas e /03 em aberto) — essas entram qualquer que seja a data.
- Antes de entrar, descartar duplicidade: título já pago em outra linha/fonte, parcela já baixada, previsão de OC
  já faturada, OCs 1787 e 1849, BM já pago, vales da Sericita (nunca entram).
- Fechamento de referência da primeira carga: 2026-09. GRAVADO em 08/10/2026 (carga 56f2a06f): BM4 19.336,12 +
  Betonita 616 29.620,00 (direto, não recorrente) + CEMIG 202,58 (recorrente). Custo direto a pagar = 48.956,12.
- Implementação da regra da data: data de baixa vazia OU data de baixa > último dia do fechamento.

## Painel "Pontos de atenção" (pedido 14B; decisões do Rafael, 09/10/2026)
- REGRA DE OURO: não inventar índice, equipe ou prazo. Faltou → "dado pendente" e lista para o Rafael.
- Painel na Visão geral abaixo do Diário de ocorrências (components/PontosAtencao.jsx, /api/pontos-atencao, conta em
  lib/pontos-atencao.js). Horizontes: próxima semana e próximos 30 dias a partir do fim da semana do filtro; compras
  de prazo longo olham a obra toda. Sem as tabelas novas: "configure as tabelas", jornada padrão, resto pendente.
- Jornada: 8 h/dia, segunda a sexta, NÃO trabalha sábado (Rafael, fase 3); feriados nacionais oficiais (Carnaval e
  Corpus Christi são ponto facultativo: fora) + municipais de Mariana CONFIRMADOS pelo Rafael (09/10): 16/07 (aniversário
  da cidade) e 08/12 — na carga: 08/12/2026, 16/07/2027, 08/12/2027, 16/07/2028 (24 feriados na obra_feriados).
- Índice de produtividade (Hh/unidade), nesta ordem: (a) cronograma, quando a atividade do cronograma tem um código só
  do orçamento (horas da linha ÷ quantidade); (b) quando o cronograma agrupa códigos, índice da CPU do FLATS (aba CPU
  da planilha oficial é a do Flats; o Rafael autorizou) por serviço: armação CPU 3.1.3 (Hh/kg), forma 3.1.5 (Hh/m²),
  lançamento 3.1.2 (Hh/m³); demais pela descrição; ao lado, o que daria pelo cronograma e "conferir" se diferir > 50%;
  (c) sem índice ou unidade diferente (diária × m³ etc.) → pendente. Não escolher sozinho quando houver conflito.
- Índices do RAFAEL (valem para TODAS as linhas do tipo, fundação e pavimentos; substituem cronograma e CPU), em Hh por
  unidade (soma das horas de todas as pessoas). Armação: 175 kg/dia por equipe de 2 × 8 h = 16 Hh/dia → 0,0914 Hh/kg.
  Forma: 9,96 m²/dia por equipe de 2 × 8 h → 1,606 Hh/m² (Rafael 09/10, valores reais; substituem 0,18 e 2,0).
  Gesso 0,6 Hh/m²; pintura 0,275 Hh/m².
- Serviços por DURAÇÃO (horas fixas da linha): escada 80 Hh por escada (1 oficial + 1 ajudante, 5 dias úteis,
  concretagem 1 dia); piso polido 16 Hh por linha; cobertura 1 mês (dias úteis do mês × 16 Hh, repartidas pelas
  horas das linhas 9.1.1, 9.1.3–9.1.5); canteiro 320 Hh (1.1.1–1.1.5) e limpeza final 320 Hh (15.1.2), 2 ajudantes ×
  20 dias; urbanização 64 Hh (15.1.1 e 15.1.3). Concretagem dos pavimentos: quantidade = m³ do concreto vinculado;
  CPU do Flats 1,5 Hh/m³ só se coerente com o cronograma — hoje diverge (> 50%): pendente.
- Equipes padrão: escavação 1 tubuleiro + 1 ajudante; armação 1 armador + 1 ajudante; forma 1 carpinteiro + 1
  ajudante; concretagem 1 pedreiro + 3 ajudantes; alvenaria/reboco/piso 1 pedreiro + 1 ajudante; impermeabilização
  1 impermeabilizador + 1 ajudante; gesso, pintura, piso polido, cobertura, urbanização e escada 1 oficial + 1
  ajudante; canteiro e limpeza 2 ajudantes. Capacidade = pessoas × 8 h × dias úteis. Linha sem tipo → "equipe
  pendente" só quando entra no horizonte.
- Prazos de compra RELATIVOS: elevador 15 meses (456 dias); janelas e esquadrias, portas Blindex, portas de madeira,
  granitos, louças e metais, portões, corrimão, alçapão e ecogranito 45 dias; central de GLP no último mês da obra.
  A data de necessidade é a PROJETADA: início planejado deslocado pelo adiantamento/atraso da obra (mesmo cálculo do
  card "Adiantamento"); pedir até = projetada − prazo; recalcula a cada medição (por frente/pavimento: ainda não).
- Tabelas (supabase/planejamento/1-tabelas-pontos-atencao.sql): equipe_padrao, indice_produtividade (por id da linha),
  insumo_prazo_entrega, obra_jornada, obra_feriados — RLS, sem grant.
- Contenção 15.1.4 (Externo) não executada: início empurrado para S16 (09/11/2026), mesma duração (11 semanas, até
  S26) e mesmas 150 h / R$ 200.000 (supabase/semanas/4-contencao-reprogramada.sql; total da curva não muda).
- Estrutura do Pilotis (Rafael, fase 3): está orçada no subgrupo 3.1 (SUBSOLO - VIGAS-PILARES-LAJE PILOTIS + PISO
  POLIDO). As linhas 3.1.x já têm as horas da atividade "Estrutura SUB-SOLO" do cronograma (2.689,4 h); a 3.0.1 tem
  as de "Estrutura PILOTIS" (1.305 h) — não duplica no banco. SQL escrito, NÃO rodado: supabase/orcamento/
  7-pilotis-horas.sql (1.305 h nas linhas de serviço 3.1.x com índice, pelo índice × quantidade; 60,1 h da 4.0.9 nas
  13 linhas de verga/encunhamento pelas horas; 3.0.1 e 4.0.9 ficam com 0 h; total 48.454,9 h igual).

## Regras de negócio (resumo; detalhes no documento de continuidade do Flats)
- Custo do mês = títulos pagos no mês. Indireto = grupo 19; direto = grupos 1 a 17 (o grupo 18 foi para o indireto
  como 19.1.25 no pedido 14A).
- Avanço físico = horas executadas ÷ horas orçadas (nunca ponderado por valor).
- Medição = último % acumulado de cada linha, por código + pavimento.
- Custo nos indicadores sempre comprometido (pago + a pagar).
