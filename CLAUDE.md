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
  (O arquivo está em automacao\entrada\cronograma\.)
- UMA SÓ ITEMIZAÇÃO (Rafael, 11/10/2026, pedido 17): a da EAP do orçamento. Os códigos do cronograma (2.1.3, 3.1
  Pilotis…) NÃO aparecem em nenhuma tela, relatório ou painel; o cronograma só dá as DATAS e as HORAS planejadas de
  cada linha da EAP. A ligação é uma TABELA DE CORRESPONDÊNCIA conferida pelo Rafael, não lógica "de cabeça" no código:
  automacao\cronograma\correspondencia_cronograma_eap.csv (fora do git), uma linha por linha de SERVIÇO (código EAP,
  pavimento, descrição, atividade do cronograma, semanas do cronograma e reais, datas, horas e quantidades do
  orçamento e do cronograma, regra de posição: inteira | armação | forma começa meia semana depois | concretagem
  pilares 30% / laje 70% | laje treliçada | escada última semana | encunhamento depois da alvenaria, observação).
  Materiais não entram (seguem o serviço vinculado). Gerada por automacao/correspondencia.py (1ª versão = a ligação
  que já valia; cronograma.py lendo a tabela dá as mesmas semanas, horas e curva, conferido em 11/10). O cronograma.py
  lê a tabela; serviço fora dela usa a lógica antiga e sai marcado "sem ligação". Conferência das datas:
  automacao/auditoria_cronograma.py → diagnostico\auditoria_cronograma.md (1 divergência em 11/10: contenção 15.1.4,
  reprogramada pelo Rafael). No site, o detalhe da linha (Avanço físico e Pontos de atenção) mostra em cinza "datas do
  cronograma: atividade <nome>, semanas X a Y" — da tabela orcamento_cronograma_ligacao
  (supabase/cronograma/1-ligacao-cronograma.sql, NÃO rodado; sem ela o site não mostra a linha).
- Fundação 2.1.6/2.1.7 (pedido 17): terminam no fim da atividade "Forma + armação" do cronograma, 08/11/2026 (S15). O
  "27/10" era o término com 2 equipes sugeridas (painel em S09), mostrado no relatório sem dizer "com 2 equipes";
  o relatório agora mostra "fim no cronograma" e, embaixo, "com N equipes: DD/MM".
- ESTRUTURA 8 × 7 (pedido 17; DECIDIDA no pedido 20, 14/10: o Pilotis entra no grupo 3 como 3.1 — ver seção "Pilotis no
  grupo 3"; as alternativas abaixo e o SQL 5 de semanas ficam OBSOLETOS, não rodar). Quadro: EAP 3.k =
  cronograma 3.(k+1) pelos m² (3.1 1.432,45 ≈ Sub-solo 1.445,94; Terraço e Reservatório exatos); sobra o cronograma
  3.1 Pilotis (701,61 m², 1.305 h, S10–S18), cuja quantidade é exatamente a forma do grupo 2 (688,17 + 13,44 da
  escada) e cujo título do grupo 2 inclui "PILARES (P01-P48) - PILOTIS". Alternativas para S11 (hoje 6,07%): B janela
  do Sub-solo 5,59% (SQL escrito: supabase/semanas/5-pilotis-janela-subsolo.sql, NÃO rodado); C tirar as 1.305 h
  5,75% (base 47.149,9 h); D horas nas linhas do grupo 2 6,07%.
- Calendário (igual ao Flats): semanas de segunda a domingo, cortadas no último dia do mês; cada mês começa numa
  semana nova, mesmo que incompleta; fragmento de 1 dia junta com a semana vizinha do mesmo mês. Numeração
  contínua a partir de S01 = 03/08/2026. O planejado do cronograma é distribuído pelos dias reais de cada mês
  (mês M do cronograma = mês do calendário), para fechar também por mês.
- Pavimentos: Fundação, Pilotis, Subsolo, Térreo, 1º, 2º e 3º Pav, Terraço, Reservatório, Edifício, Externo, Canteiro
  (ordem das listas = a da EAP, pedido 20: Pilotis 3.1/4.1 antes do Subsolo 3.2/4.2; o mapa de pavimentos mantém a sua).
- Rótulo "Subsolo / Pilotis" (Rafael, 09/10): nas telas, as linhas do GRUPO 3 com pavimento "Subsolo" no banco
  (subgrupo 3.1, que inclui a laje do Pilotis) aparecem como "Subsolo / Pilotis" — avanço físico (cabeçalho do
  pavimento, memória de cálculo, busca), valor agregado/custos diretos, custo por grupo, medição semanal, pontos de
  atenção (subgrupo da Estrutura, linhas, confirmações, caixa, compras) e mapa de pavimentos (dica e leitura da célula
  do grupo 3; a linha do mapa continua "Subsolo" porque junta vários grupos). Só o texto: lib/constants.js
  rotuloPavimento(pavimento, CÓDIGO da linha). Banco, chaves, filtros e ligação com o cronograma continuam "Subsolo".
  NÃO vale para a alvenaria 4.2.x nem para outros grupos. Pedido 20: só vale para código 3.1.x com pavimento Subsolo,
  então some sozinho depois do SQL 9 (3.1 = Pilotis, Subsolo = 3.2); as telas passam o código de uma linha (não o grupo).
- Site e calendário (pedido 11): as semanas vêm de lib/calendario.js — o servidor lê calendario_semanas e
  curva_s_semanal_planejada (lib/calendario-servidor.js) e o navegador recebe pela /api/calendario (pages/_app.js).
  Sem as tabelas, fica o cálculo antigo (96 semanas de 7 dias) e o site funciona igual: por isso o código vai
  antes do SQL. Nenhuma tela calcula semana por conta própria; usar sempre lib/constants.js / lib/calendario.js.

- Escadas (Rafael, 08/10): são executadas nos dias finais da estrutura de cada pavimento. Cada linha de escada
  (inclusive 2.1.10 a 2.1.13 da fundação) fica na ÚLTIMA semana da atividade de estrutura do seu pavimento. Pedido 20:
  são 5 escadas (Pilotis→Subsolo 3.1.9–3.1.12 … 2º→3º); a da fundação (2.1.10 a 2.1.13) SAI com o SQL 9.
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
  Pedido 20 (depois do SQL 9): 14 linhas, R$ 199.570,56 — 2.1.3, 3.1.6, 3.1.10, 3.2.6, 3.2.9, 3.3.6, 3.3.9, 3.4.6, 3.4.8,
  3.5.6 [id 720], 3.5.8, 3.6.6, 3.7.6, 3.8.6 (sai a 2.1.11, id 677; entram ids 1006 e 1008). A lista do código tem as ids
  de antes e de depois (id que não existe é ignorada), então vale nos dois momentos.
  Custo: o pago + a pagar de qualquer uma delas é o gasto da verba, e cada linha mostra gasto × (orçado ÷ verba); os
  lançamentos continuam gravados na linha original (só cálculo/tela; nível 3 com a nota "verba de forma rateada").
  Valor agregado (Rafael 11/10; SUBSTITUI o "sem compra antecipada" de 09/10): regra de material do Flats aplicada à
  verba inteira = MAIOR entre aplicado (Σ % do serviço de forma vinculado × orçado da linha) e gasto da verba (pago +
  a pagar) limitado à verba; rateado entre as 13 linhas na mesma proporção do custo (orçado ÷ verba), cada linha
  neutra. Estouro só se o gasto passar da verba. O resumo da verba mostra "comprado X% da verba" e "aplicado na obra
  Y%". O % físico e as horas continuam os do serviço. Caixa dos Pontos de atenção: o excesso que abate a forma é
  gasto − APLICADO (campo heranca), não mais gasto − valor agregado. Em S11: aplicado 12.731,18; gasto 34.036,04 →
  valor agregado 34.036,04; estouro 0 (antes +21.304,86). As demais regras de material não mudam.
- Nível PAVIMENTO no custo direto (Rafael 11/10): no "Custo direto por grupo" (components/CustoPorGrupo.jsx) e na
  tabela de valor agregado (pages/custos-diretos.js), grupo com mais de um pavimento → pavimento (ordem de PAVIMENTOS,
  rótulo de rotuloPavimento) → linhas, cada pavimento com subtotal, tudo recolhido. Grupo com um pavimento só vai
  direto nas linhas. Pavimento só com linhas de título (R$ 0, ex.: 3.0.1 Pilotis) não aparece. Helper porPavimento em
  components/ValorCusto.jsx.
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
  - PENDENTE (Rafael 16/10/2026): o vale ADIANT-09/10/26 (R$ 2.500,00) está rateado PROVISORIAMENTE pela composição do
    BM4 (decisoes_pontuais.csv). Quando chegar o BM5, refazer este vale (e os demais vales de outubro) pela composição do BM5.
- Outras decisões (Rafael, 07 e 08/10/2026):
  - ISS RETIDO de nota (linhas ISSRET): NAO_CUSTO, porque o valor da nota (rateio/baixado) já inclui o imposto;
    o ISS fica dentro do custo do serviço. ISS da Prefeitura que NÃO for retenção de nota → 19.1.22.
  - Terraplanagem (Luciano José Perdigão) → 2.1.1.
  - Aço (Gerdau, Fortaleza) → 2.1.4. Viferro e Cofermeta → 17.1.10. Padaria → 17.1.12.
  - Impressões/cópias (Copiadora Realce) → linha de projeto estrutural do grupo 19.
  - DCTFWEB (Receita Federal) e FGTS (Caixa) da Fonseca = impostos de funcionários a abater no INSS da obra → 19.1.25
    (antiga 18.1.1), regra fixa em regras_manuais.csv (Rafael 16/10/2026). Nome da linha passa a ser "Funcionários
    diretos / impostos" (supabase/orcamento/10-nome-19-1-25.sql RODADO pelo Rafael em 16/10/2026 e conferido: 428.131,20,
    reserva = true; orcamento.csv com o nome novo; a planilha oficial ainda tem o nome antigo na 18.1.1).
  - Caixa Cartões (cartão pré-pago/alimentação de funcionário, R$ 700,00 em 08/2026) → 19.1.25 (mão de obra de
    apoio, indireto/reserva; Rafael 09/10, pedido 14A). Antes: 18.1.1 (08/10) e, antes disso, NAO_CUSTO.
  - Combustível da obra (Auto Posto; gasolina do carro de apoio) → 17.1.14 (no orçamento final:
    "Gasolina Carro Vandinho", R$ 24.000,00).
  - Areial Mariana (pedra de mão usada na concretagem dos fustes, no lugar de concreto) → 2.1.5
    (concreto usinado, apenas material).
  - Diária mista "Concretagem blocos e limpeza dos blocos" (BM3 item 3.5, R$ 800) → 50% 2.1.8 / 50% 2.1.2.

## Orçamento oficial (decisão do Rafael, 08/10/2026; arquivo trocado em 14/10/2026, pedidos 19 e 20)
- Arquivo oficial (desde 14/10/2026, depois do SQL 9): "Orcamento_Rua_Sirius_60_-_Final_-_14-10-26_v2.xlsx" (abas
  Orçamento, CPU, Sheet1, Sheet2) = a proposta "Orcamento_Sirius_60_-_proposta_estrutura_com_Pilotis_v2_2026-10-14.xlsx"
  sem as abas de apoio (Decisões, Comparação), com o subtítulo trocado para "ORÇAMENTO OFICIAL v2"; fórmulas e valores
  calculados preservados. Fundação separada do Pilotis; novo subgrupo 3.1 PILOTIS (ver seção do pedido 20). As 87 linhas
  dos grupos 2 e 3 batem com o banco ao centavo. Histórico: "..._14-10-26_corrigido.xlsx" (pedido 19, antes do Pilotis) e
  "..._03-08-26.xlsx"; a "...14-10-26_NAO_USAR.xlsx" e a "..._organizado.xlsx" não valem.
- Totais NO BANCO (o que o site usa; grupo 18 no indireto, 17.1.14 no direto): custo direto R$ 6.834.476,17 (era
  7.200.717,91; a planilha dá 6.834.476,18 — 1 centavo de arredondamento das linhas); indireto R$ 2.874.508,08; total
  R$ 9.708.984,25 (era 10.075.225,99). Grupo 2 573.126,00; grupo 3 1.873.239,28 (planilha 1.873.239,30).
- Totais da planilha v2: custo direto R$ 7.238.607,39 (7.262.607,39 com a 17.1.14); indireto R$ 2.446.376,88; total
  geral R$ 9.684.984,27 (com o grupo 18 e sem a 17.1.14). (Antes, corrigido de 14/10: direto 7.604.849,11; total
  10.051.225,99. 03-08-26: direto 7.527.387,47; total 9.973.764,35.)
  Atenção: o subtotal do grupo 17 na planilha (758.444,00) não soma a 17.1.14 "Gasolina Carro Vandinho"
  (R$ 24.000,00); com ela o grupo 17 = 782.444,00.
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
  Rotina semanal (pedido 15): o fechamento passa a ser a DATA DE CORTE do relatório (competencia_fechamento
  'AAAA-MM-DD'; SQL supabase/contas/2-fechamento-por-data.sql RODADO pelo Rafael em 16/10/2026, conferido: regra
  contas_a_pagar_fechamento_formato). Fechamento 'AAAA-MM-DD' só pode ser gravado DEPOIS de publicado o código do pedido 15. A cada corte a lista é refeita inteira; o
  site usa o corte mais recente até o fim da semana e tira do a pagar o título já pago até ali (lib/contas-a-pagar.js
  semJaPagos) — nunca nos dois.

## Rotina semanal de custos + contas a pagar (pedido 15; Rafael 09/10/2026)
- Passo a passo em ROTINA_SEMANAL.md. Comando: node ferramentas/semana/atualizar.js (prévia) | --confirmar | --desfazer
  <id> [--confirmar]. Entrada: automacao/entrada/AAAA-MM-DD/ (nome = data de corte; a pasta mais nova é a usada).
  Saída: automacao/saida_semana/AAAA-MM-DD/ (previa.md, logs, carga_<id>.json; fora do git).
- Só orquestra: classificador.py (--completo --corte), contas_a_pagar.py (--corte), semana_info.py (leitura e NF ↔ OC)
  e importar.js (gravação, backup e desfazer; --apenas para relatório só da semana).
- REGRA ANTI-DUPLICIDADE: CHAVE DO TÍTULO = fonte + CNPJ (sem CNPJ, o fornecedor) + documento com a parcela (sem zeros
  à esquerda) + data de baixa (ferramentas/semana/chave.js). Mesma chave = mesmo pagamento, em quantos relatórios vier.
  Relatório ACUMULADO (pagamentos antes dos últimos 10 dias): substitui só os meses com diferença (importar.js), nunca
  soma por cima. Relatório SÓ DA SEMANA: insere só as chaves novas e nada sai (importar.js --apenas). Pago depois da
  data de corte não entra no custo daquela carga (fica no a pagar do corte). Histórico manual (lancado_por =
  'Rafael') nunca é tocado.
- BLOQUEIAM a carga (prévia mostra e o --confirmar para): mesma chave nas duas fontes; título pago que sumiu do
  relatório novo; valor de título já pago que mudou; mês fechado cujo total mudou > R$ 0,01 sem explicação título a
  título; título no a pagar e no custo até o corte; trava do importar.js. Pendência de classificação no mês a gravar
  também para. O Rafael decide caso a caso.
- 1ª CARGA REAL (16/10/2026, corte 13/10, acumulado; carga semanal fcdf522b-e1e9-4e7d-80c6-5831ec8bca4a; custo 2026-10
  importação 1afab9c5…; contas a pagar carga 0f6d2dff…): custo 2026-10 R$ 52.118,90 (BM4 19.336,12, vale 09/10 2.500,00
  PROVISÓRIO pelo BM4, Betonita 616 29.620,00, CEMIG 202,58, Tecidos 460,20); ago e set sem mudança; a pagar no corte
  R$ 27.002,35 (direto 9.804,54: Madeiras Nova Esperança 2104/02 + Tecidos 25602254/01; indireto 19.1.25 17.197,81:
  DCTFWEB + FGTS). Arquivos "Fonseca/Dinamica pago acumulado até 13-10-26" (trazem também os em aberto; Dinâmica =
  rateio do Sirius); atualizar.js identifica a fonte pelo cabeçalho.
- Teste de 09/10 (só prévia): relatórios "Até 09-26" como 1ª semana (corte 30/09) = custo novo zero, bloqueio zero,
  a pagar R$ 49.158,70 (igual ao banco); relatório igual = zero; um título a mais = só ele; valor mudado = bloqueio.
- NF ↔ OC (3B): chave = nº da NF + CNPJ do relatório de OC (ou nº da OC no documento); o classificador já abre a NF
  pelos itens da OC. Em 09/10 só 15,5% do material da Dinâmica tinha OC ligada (os relatórios de OC só cobrem parte de
  ago/set). A tabela de regras por item de OC (3B-b) espera o Rafael mandar o relatório de OC completo da obra.

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
- Tela (pedido 14C, mais simples): 4 números (atrasadas | a executar na semana | em 30 dias | equipes sugeridas), abas
  Atrasadas | Próxima semana | Próximos 30 dias, compras só no botão "Compras ▸". Por atividade: horas que faltam =
  (100% − concluído) × quantidade × índice; data-alvo = fim no cronograma (já passou → hoje + 30 dias); equipes
  sugeridas = horas ÷ (pessoas × 8 h × dias úteis até o alvo); término com N equipes e se cumpre/atrasa. Índice e nº de
  equipes editáveis (recalcula na hora); linha sem índice/equipe: campos amarelos para preencher. Salvar: POST
  /api/pontos-atencao com SENHA_MEDICAO, confirmação na página, histórico em planejamento_historico
  (supabase/planejamento/2-edicao-no-site.sql: equipes_definidas, equipe_oficiais/ajudantes/funcao, editado_por/em,
  origem 'rafael-site').
- Grupos, datas e caixa (pedido 14D): nas 3 abas as atividades ficam dentro do GRUPO do orçamento (recolhido; na
  Estrutura, por pavimento se houver mais de um), com nº de atividades, maior atraso, equipes, fim planejado, fim no
  ritmo atual e caixa do período. DATAS por atividade: planejado (início → fim) · no ritmo atual (% concluído ÷ dias
  úteis desde a 1ª medição — com uma só, desde o início planejado — até a última; fim = última + falta ÷ ritmo) · com
  N equipes. Sem medição: "não iniciada" / "deveria ter começado em".
- CAIXA (Rafael 09/10; corrigido no mesmo dia): % a executar no período segue o MESMO plano das equipes do término.
  Com equipes e índice — definidas pelo Rafael (salvas ou digitadas na tela; recalcula na hora): o nº inteiro; só
  SUGERIDAS: as equipes necessárias para terminar na data-alvo, com fração (Rafael 09/10: 1 equipe inteira terminava
  atividades pequenas muito antes do cronograma e puxava serviço e material para a semana) — (equipes × pessoas × 8 h × dias úteis do
  período) ÷ horas por 1% (horas que faltam ÷ % que falta), limitado ao que falta. Sem equipe ou sem índice: ritmo do
  cronograma no período + atraso diluído em 30 dias (fração dias úteis do período ÷ dias úteis dos 30 dias), nunca o
  atraso inteiro de uma vez (era o erro: 2.1.2 com 30% numa semana). O % × (orçado do serviço + orçado dos materiais vinculados), descontando material comprado além do
  executado (verba de forma: o excesso da verba inteira abate o material de forma, em ordem de término). Topo: caixa da
  semana e de 30 dias = serviços + materiais + contas a pagar lançadas com vencimento no período + indiretos recorrentes
  (planejado); ao lado, em cinza, a curva do cronograma. Premissa: valor do serviço executado; prazos de pagamento de
  fornecedores ainda não considerados. Painel e equipes usam só linhas de serviço; materiais entram no caixa.
- Regras do caixa (Rafael 09/10): conta a pagar entra se o VENCIMENTO cai dentro do período; vencido antes do período
  = considerado pago, não entra (ex.: Betonita 616, venc. 08/10). Indiretos: recorrentes (19.1.18, 19.1.21, 19.1.23,
  19.1.24; a reserva 19.1.25 fica fora) + pontuais planejados DENTRO do período (pelo mês previsto); pontual planejado
  antes e não pago não entra. Composição do caixa por GRUPO (recolhido, com itens), depois contas a pagar, 19 Indiretos,
  TOTAL e, em cinza, a curva do cronograma; a regra fica escrita no fim da composição.
- Contenção 15.1.4 (Externo) não executada: início empurrado para S16 (09/11/2026), mesma duração (11 semanas, até
  S26) e mesmas 150 h / R$ 200.000 (supabase/semanas/4-contencao-reprogramada.sql; total da curva não muda).
- [SUBSTITUÍDO pelo pedido 20 (SQL 9): o Pilotis vira o subgrupo 3.1 com linhas próprias e as janelas abaixo saem.]
  Estrutura do Pilotis (Rafael, fase 3): está orçada no subgrupo 3.1 (SUBSOLO - VIGAS-PILARES-LAJE PILOTIS + PISO
  POLIDO). As linhas 3.1.x já têm as horas da atividade "Estrutura SUB-SOLO" do cronograma (2.689,4 h); a 3.0.1 tem
  as de "Estrutura PILOTIS" (1.305 h) — não duplica no banco. SQL RODADO (conferido no banco em 14/10: 3.0.1 com 0 h e
  19 linhas em orcamento_horas_janela; o registro antigo dizia "não rodado"): supabase/orcamento/7-pilotis-horas.sql: as 1.305 h vão para as 6 linhas de SERVIÇO do 3.1 na proporção das horas REAIS (Rafael 09/10:
  armação 501,7 / forma 2.301,1 / lançamento 192 / piso polido 16 / escada 80 / laje treliçada 160 = 3.250,8 Hh);
  60,1 h da 4.0.9 nas 13 linhas de verga/encunhamento pelas horas; 3.0.1 e 4.0.9 ficam com 0 h; total 48.454,9 h
  igual; materiais do 3.1 não mudam. O painel usa as horas REAIS (índice × quantidade) para equipes e término.
  As horas transferidas ficam na JANELA DE ORIGEM (tabela nova orcamento_horas_janela: 3.0.1 → S10–S18 "Estrutura
  Pilotis" do cronograma; 4.0.9 → S88–S90): o planejado linha a linha não muda e a curva_s_semanal_planejada também não.
  O site soma o planejado das duas janelas de cada linha (lib/valor-agregado.js e lib/pontos-atencao.js).
- Índices da estrutura (Rafael 09/10; supabase/planejamento/3-indices-estrutura.sql): lançamento em diária = 1 dia de
  1 pedreiro + 3 ajudantes = 32 Hh/diária (quantidade do orçamento; diárias já com folga); laje treliçada (MO +
  material) 0,5644 Hh/m² (2 oficiais + 2 ajudantes fazem 283,5 m² em 5 dias = 160 Hh), equipe nova "laje_trelicada";
  escada 80 Hh (5 diárias de 1 oficial + 1 ajudante; o valor do orçamento não muda); piso polido 16 Hh. Unidades
  corrigidas na tabela de índices (o orçamento não muda): 3.4.11 laje = m²; 3.5.4 = 6 diárias; 3.7.4 (42,57 m³) pela
  produtividade do Pilotis (125,89 m³ em 6 diárias = 20,98 m³/diária) → 1,5252 Hh/m³ = 65 Hh. Ritmo atual com uma só
  medição: conta a partir do início planejado.

## Relatório gerencial em PDF por período (pedido 16; 11/10/2026)
- Botão "Gerar relatório" na Visão geral (components/GerarRelatorio.jsx): data inicial e final (padrão mês anterior
  fechado; atalhos última semana, último mês, desde o início) → /relatorio?de=&ate= (pages/relatorio.js). "Baixar PDF" =
  impressão do navegador ("Salvar como PDF"); CSS de impressão A4 retrato, @page com cabeçalho/rodapé "Residencial
  Sirius 60 · período · página X de Y". Sem pacote novo.
- Mesmas contas do site: /api/painel, /api/dashboard-integrado, /api/indiretos, /api/pontos-atencao, /api/curva-s +
  lib/projecoes.js (calcularAdiantamento saiu do Dashboard para lá; o card usa a mesma). Organização em lib/relatorio.js.
- Período → semanas do calendário (semana da data final; números até o fim dela). "No período" = fim da semana final −
  fim da semana anterior à inicial; gasto do período = Δ(pago + a pagar). Prazo, projeções e IDP na última medição até a
  data final; sem medição dentro do período → cinza "sem medição desde DD/MM — atualizar" (físico também em cinza).
- Situação da atividade: regra do painel Pontos de atenção (feito < previsto − 0,05 p.p. = atrasada), com os dias pela
  data em que o cronograma previa chegar ao % feito. Faixas do semáforo além do rendimento (definido pelo Rafael: ≥ 1,00
  verde, 0,95–1,00 amarelo, < 0,95 vermelho) são do relatório, escritas na página: prazo (atraso até 2 semanas
  amarelo), indireto e projeção (estouro até 5% amarelo), atividade (atraso até 7 dias amarelo).
- Sem siglas na tela: valor do que foi feito, custo (pago + a pagar), rendimento do custo, avanço físico.
- Ajustes (Rafael 11/10): resposta principal do custo = ACUMULADO até a data final ("até DD/MM gastamos R$ X a
  menos/mais que o valor do que foi feito"); semáforo da pergunta (a) pelo acumulado; o período fica como informação,
  com a frase de que pagamentos de um período podem se referir a serviços medidos antes (concreto e aço de agosto pagos
  em setembro). Pago e a pagar sempre separados e somados ("Custo: R$ X (pago R$ Y + a pagar R$ Z)"); a soma é o custo
  das comparações. Lista curta das contas a pagar (fornecedor, documento, vencimento, valor) na seção do custo. O a
  pagar com vencimento nos 30 dias depois da data final entra no caixa ("contas já lançadas a pagar") e a projeção diz
  "inclui R$ Z já lançados a pagar". Faixas do semáforo aprovadas (prazo 2 semanas; indireto e projeção 5%; atividade
  7 dias).
- Correções do pedido 18 (Rafael 11/10): semáforo em SVG + palavra ao lado (OK / atenção / problema / sem dado), cores
  exatas na impressão; gráficos com traço diferente (contínua, tracejada, pontilhada) e legenda pelo nome. Indireto: a
  diferença é separada em a pagar (pontuais não pagos + saldo dos pagos em parte) + sem lançamento (recorrentes) +
  economia REAL, que decide o semáforo; com valor a informar ou recorrente sem lançamento: AMARELO "pendências a
  lançar". Projeção: "se o que falta custar o que está orçado, a obra termina em R$ X"; economia SEM a reserva 19.1.25
  é o número principal e a reserva disponível vai à parte (não é economia); com menos de 15% de avanço, sem faixa de
  cenários no resumo. Contas a pagar contadas por TÍTULO (fornecedor + documento + parcela), listadas nos próximos 30
  dias. Período por grupo: locação e material comprado antes (verba de forma) numa linha à parte, NEUTRAS (fora do
  feito e do estouro); coluna "custo por R$ 1 feito"; estouro do mês com acumulado sem estouro = AMARELO "pagamento de
  serviço de meses anteriores". Prazo: frase fixa "Última medição em DD/MM. Sem medição depois disso, o relatório não
  mostra o atraso que pode ter acontecido em <mês>"; data final depois da última medição = AMARELO "medição
  desatualizada". No relatório, pavimento só pelo nome do orçamento (sem "Subsolo / Pilotis").
- Revisão de 14/10 (pedido 18, depois dos pedidos 19 e 20; commit 2e1d03c): linhas do orçamento em TODAS as telas e no
  relatório pela ORDEM DO CÓDIGO (lib/constants.js compararLinhas: número a número; mesmo código em vários pavimentos na
  ordem de PAVIMENTOS), aplicada em carregarOrcamentoDireto e /api/orcamento; caixa do relatório = painel na mesma data
  (01/10–14/10: R$ 443.002,45 nos dois, janela 19/10–17/11 = 30 dias depois do fim da semana da data final). PDFs de teste em
  diagnosticoelatorioselatorio_*_2026-10-14.pdf.
- Pontos de atenção (pedido 18): o início planejado da linha é a janela mais cedo (própria ou orcamento_horas_janela,
  SQL 7), a mesma base do planejado. Antes, na S09 as 6 linhas do 3.1 tinham horas planejadas em outubro mas ficavam
  fora dos "próximos 30 dias": caixa de 01/10 a 30/10 visto da S09 R$ 302.607,61 → R$ 394.031,12 (+91.423,51 do 3.1).
  Depende da decisão Pilotis × Subsolo (pedido 17): na alternativa B essas horas saem de outubro.

## Quantidades e medições da fundação (pedido 19; Rafael 14/10/2026) — SQL 8 RODADO em 14/10/2026
- MOTIVO: a memória de cálculo do orçamento tinha quantitativos errados. É CORREÇÃO DE ERRO DO ORÇAMENTO, não mudança
  de projeto/escopo. O orçamento corrigido passa a ser a referência de economia/estouro.
- Antes → depois (por id; preço unitário não muda; valor = quantidade × unitário):
  670 2.1.4 aço 18.102,18 → 16.578,47 kg (digitado, já com 10% de perdas; era =(15075,53+1381)*1,1), R$ 125.267,11 →
  114.723,01, 650,9 → 596,1 h · 673 2.1.7 armação 18.102,18 → 16.578,47 kg, R$ 54.306,55 → 49.735,41, 282,2 → 258,4 h ·
  671 2.1.5 concreto 389,53 (era =D14, copiava a escavação) → 529,80 m³, R$ 257.091,12 → 349.668,00 (+92.576,88),
  725,6 → 986,9 h (PROPORCIONAL, decisão do Rafael 14/10; o executado em Hh da concretagem não muda: 362,8 h).
  NÃO mudam: 2.1.2 escavação (389,53 m³), 2.1.3/2.1.6 forma (688,17 m²), 2.1.8 (6 diárias). Direto 7.123.256,27 →
  7.200.717,91; total da obra 9.997.764,35 → 10.075.225,99; base de horas 48.454,9 → 48.637,6. Planilha:
  Orcamento_Rua_Sirius_60_-_Final_-_14-10-26_corrigido.xlsx (cópia da oficial com só D16/D17 mudadas; a do Rafael
  "... 14-10-26.xlsx" veio da cópia de 09/10 e NÃO vale; renomeada em 14/10 para "Orcamento_Rua Sirius 60 - Final - 14-10-26_NAO_USAR.xlsx").
- Regras: pares 2.1.3 = 2.1.6 e 2.1.4 = 2.1.7 (mesma quantidade); horas novas = horas × (qtd nova ÷ atual), índice
  Hh/un igual; 2.1.8 só muda se o Rafael informar diárias; curva planejada muda só na janela de cada linha; material
  segue herdando do serviço.
- MEDIÇÕES REAIS ("levantamento do Rafael 14/10/2026", situação até 30/09 = S09): 2.1.1 100% (já estava); 2.1.2
  216,04/389,53 m³ = 55,4617%; 2.1.6 97,16/688,17 m² = 14,1186%; 2.1.7 5.781,07/16.578,47 kg = 34,8710%; 2.1.8
  194,77/529,80 m³ = 36,7629% (por volume; a linha segue em diárias). Substituem os "ajustes de quantidade" da 1ª prévia.
- REGRA DO HISTÓRICO (correção de medição): as medições antigas NÃO mudam; para cada uma entra uma CORREÇÃO (origem
  'correcao', origem_ids = [id da antiga]) na MESMA semana e data, com % antigo × fator (fator = % real ÷ % antigo da
  última medição até a semana do levantamento) — a curva realizada não tem degrau, nada passa de 100% nem cai entre
  semanas. A correção tem id maior e por isso vale no lugar da antiga (ordem semana, data, id). 9 correções:
  2.1.2 S03 9,2436 / S04 46,2181 / S09 55,4617; 2.1.6 S04 7,0593 / S06 11,2949 / S09 14,1186; 2.1.7 S04 24,9079 /
  S06 34,8710; 2.1.8 S04 36,7629. Tela (lib/medicao-servidor.js marca correcao/substituida_por): a antiga aparece riscada
  "substituída pela correção"; a nova, "correção da medição". Desfazer apaga só origem 'correcao'.
- Efeito (prévia = site depois do SQL, conferido em 14/10; diagnostico/previa_pedido19.md): avanço S09 4,65% → 3,50%; planejado S09 4,22 → 4,30, S12 7,30 → 7,47;
  valor agregado S12 466.482,66 → 397.167,70; índice de custo 1,32 → 1,12; índice de prazo 1,10 → 0,81; adiantamento
  +0,65 → −1,60 semana; "restante pelo orçamento" 9.444.059,10 → 9.590.835,70; atrasadas em S12 12 → 12 (mais horas de
  atraso na 2.1.2/2.1.6/2.1.7; equipes 27 → 32).
- Concreto (Rafael 14/10): VALE a medição de 194,77 m³ (tubulões em boa parte e ~25% das vigas baldrame concretados).
  Pelo volume, a NF 524 da Betonita (R$ 60.160,00, paga 14/09, sem m³ nos documentos) é uma ENTREGA À PARTE, não
  faturamento antecipado das NFs 616 (44 m³, a pagar) e 725 (50 m³). CONFERÊNCIA (não bloqueia nada): pedir ao financeiro
  os m³ da NF 524 e confirmar que a NF 725 (50 m³, OC 38544 de 15/09; fora dos relatórios até 30/09) entra no próximo
  relatório.
- FEITO em 14/10/2026: código das telas publicado (commit ac59879) → SQL 8 rodado pelo Rafael e conferido no site
  (direto 7.200.717,91; avanço 3,50%; índice de custo 1,12; índice de prazo 0,81). Backups no banco:
  orcamento_quantidades_bkp_20261014, curva_s_quantidades_bkp_20261014, avanco_quantidades_bkp_20261014. Correções = ids
  18 a 26. Uma 2ª execução do mesmo arquivo parou em "relation _orc does not exist" (a tabela temporária "on commit
  drop" não sobreviveu entre os comandos do SQL Editor) SEM gravar nada — conferido por leitura. Por isso o SQL 8 e o
  desfazer foram reescritos como UM bloco DO $$ (sem tabela temporária; rodar o arquivo inteiro de uma vez); a versão nova
  NÃO precisa ser rodada (pararia na trava "backup já existe"). Conferência só de leitura:
  supabase/orcamento/8-conferir-estado.sql. LIÇÃO para SQLs novos: nada de tabela temporária entre comandos; dados
  dentro do próprio bloco.
- Depois do SQL: arquivo oficial trocado na seção "Orçamento oficial"; correspondencia_cronograma_eap.csv atualizada
  (backup correspondencia_cronograma_eap_backup_2026-10-14.csv): só a 2.1.7 muda (282,2 → 258,4 h; 18.102,18 →
  16.578,47 kg) — 2.1.4 e 2.1.5 são material e não estão na tabela.

## Pilotis no grupo 3 (pedido 20; decisões do Rafael 14/10/2026) — SQL 9 RODADO em 14/10/2026
- FEITO em 14/10/2026: código publicado (commit e760f46) → SQL 9 rodado pelo Rafael e conferido (339 linhas · direto
  6.834.476,17 · grupo 2 573.126,00 · grupo 3 1.873.239,28 · curva S09 3,664% / S12 6,244% · 35 medições, 18 correções).
  Site (rotas) = prévia: avanço 3,58%, índice de custo 1,12, índice de prazo 0,98, −0,29 semana, 8 atrasadas, 24 equipes.
  Arquivo oficial trocado para "..._14-10-26_v2.xlsx" (seção Orçamento oficial).
- Base: automacao\orcamentos\Orcamento_Sirius_60_-_proposta_estrutura_com_Pilotis_v2_2026-10-14.xlsx (abas Decisões,
  Comparação com o código antigo de cada linha, Orçamento). Gerador: automacao/gerar_sql_pilotis_estrutura.py (--csv
  atualiza as tabelas de tipos e de correspondência). SQL: supabase/orcamento/9-pilotis-estrutura.sql (um bloco DO, sem
  tabela temporária, travas antes e depois) + 9-desfazer.sql + 9-conferir-estado.sql (só leitura). Prévia:
  diagnostico\previa_pedido20.md. Tudo POR ID; nenhum custo, conta a pagar, medição, ocorrência ou compra estava nas
  linhas que saem ou mudam de código (conferido; a trava para se aparecer algum).
- Fundação (grupo 2) = só tubulões, blocos e vigas baldrame inferiores: 2.1.2 389,53 → 343,20 m³; 2.1.3/2.1.6 688,17 →
  198,72 m²; 2.1.4/2.1.7 16.578,47 → 16.394,38 kg; 2.1.5 529,80 → 362,21 m³; 2.1.14 756,99 → 198,72 m². SEMANAS DA
  FUNDAÇÃO NÃO MUDAM (o prazo permanece); HORAS acompanham a quantidade (Rafael 14/10, regra 2c do pedido 19: horas ×
  qtd nova ÷ atual, índice Hh/un igual; as horas antigas incluíam a forma do Pilotis, que agora tem as 1.305 h dele —
  manter contaria duas vezes): −1.055,2 h (2.1.2 1.558,1 → 1.372,8; 2.1.3 132,3 → 38,2; 2.1.4 596,1 → 589,5; 2.1.5 986,9 →
  674,7; 2.1.6 214,6 → 62,0; 2.1.7 258,4 → 255,5; 2.1.14 408,8 → 107,3; 2.1.8 igual). Saem 2.1.10 a 2.1.13 (escada; 52,6 h). 2.1.9 (id 675) vira 3.1.7 Pilotis
  (210 m² + 5%), com as mesmas 304,1 h e S10–S15 (atividade de piso do cronograma).
- Estrutura: novo 3.1 PILOTIS; os outros descem um número (Subsolo 3.2 … Reservatório 3.8, igual ao cronograma). Linhas
  novas com ids FIXOS 1001–1010 (3.1.1–3.1.6, 3.1.9–3.1.12) e 1011 (3.2.12 treliçada do Subsolo); id 692 (antiga 3.1.12,
  com os 270 m² do Pilotis) vira 3.1.8; 2º Pav pela função (720 material → 3.5.6, 721 MO → 3.5.5); sai a 3.0.1 (id 992).
  Laje treliçada: MO e material só na linha da treliçada (a forma perde a área da treliçada). Piso polido só 3.2.7 e 3.3.7.
- Cronograma (o ARQUIVO não muda): Pilotis = atividade "3.1 Pilotis" (S10–S18) com as 1.305 h (que hoje estão em
  orcamento_horas_janela sobre as linhas do antigo 3.1) nas linhas de SERVIÇO do Pilotis pelas horas reais (índice ×
  quantidade): armação 300,3 · forma 634,5 · lançamento 164,4 · treliçada 137,3 · escada 68,5; materiais do Pilotis 0 h;
  sequência armação → forma → treliçada → concretagem 30/70 → escada na última semana. Subsolo … Reservatório: horas da
  própria atividade (as do Sub-solo, 2.689,4 h, JÁ estavam nas linhas do antigo 3.1; as 1.305 h eram somadas por cima), e
  dentro dela horas ∝ horas × (qtd nova ÷ atual), soma igual; semanas iguais. Base do avanço 48.637,6 → 47.529,8 h
  (−52,6 escada da fundação − 1.055,2 fundação pela quantidade).
- Medições: mantém a QUANTIDADE executada (levantamento de 14/10): 2.1.2 216,04/343,20 = 62,9487%; 2.1.6 97,16/198,72 =
  48,8929%; 2.1.7 5.781,07/16.394,38 = 35,2625%; 2.1.8 194,77/362,21 = 53,7727% (por volume). 9 correções novas sobre as do
  pedido 19 (origem 'correcao', mesma semana e data); as antigas ficam. Horas executadas ficam iguais (1.700,2 → 1.703,6;
  só a 2.1.8, 6 diárias, sobe pelo volume): avanço S09 3,50% → 3,58% (base menor); planejado S09 4,30% → 3,66%; índice
  de prazo 0,81 → 0,98; atraso −1,60 → −0,29 semana (término 01/08/2028).
- Índice "cronograma" (horas ÷ quantidade): igual na fundação (horas proporcionais); 3.1.7 0,94 → 1,38 Hh/m² (mantém as
  304,1 h com 220,5 m²). Índices do Rafael (armação, forma, lançamento, treliçada, escada) iguais nas linhas novas.
- Efeito no site (prévia pelas rotas): direto 7.200.717,91 → 6.834.476,17 (planilha 6.834.476,18; 1 centavo de
  arredondamento por linha); total 10.075.225,99 → 9.708.984,25; 333 → 339 linhas; verba de forma 311.278,36 → 199.570,56.
- ORDEM (cumprida até o passo 4): (1) publicar e promover o código (verba com ids 1006/1008, rótulo pelo código, ordem dos pavimentos) — funciona
  antes e depois do SQL; (2) rodar 9-pilotis-estrutura.sql; (3) conferir; (4) só então gerar o arquivo oficial
  "Orcamento_Rua_Sirius_60_-_Final_-_14-10-26_v2.xlsx" a partir da proposta, sem as abas de apoio, e trocar a seção
  "Orçamento oficial". supabase/cronograma/1-ligacao-cronograma.sql foi REESCRITO com os códigos novos: fica para depois
  (Rafael 14/10); se rodar, só DEPOIS do SQL 9 (antes a trava dele para). O desfazer do passo 8 apaga todas as correções: só depois do 9-desfazer.
- Tabelas fora do git já atualizadas para o estado DEPOIS do SQL 9 (backups _backup_2026-10-14_pedido20):
  tipos_linha_orcamento.csv e cronograma\correspondencia_cronograma_eap.csv. Se o SQL 9 não for rodado, voltar os backups.
  Quando chegarem notas do Pilotis: acrescentar linhas do Pilotis no automacao\etapa.csv (aço 3.1.1, forma 3.1.6,
  concreto 3.1.3, MO 3.1.2/3.1.5; pavimento Pilotis) com a data de início.

## IPC, IDP e projeções de custo final (pedido 14E; decisões do Rafael, 09/10/2026)
- Conta em lib/projecoes.js; cards e painel em components/Dashboard.jsx (3ª linha: "Projeções de custo final" + IPC no
  modo Custos, + IDP no modo Avanço físico).
- IPC = valor agregado ÷ custo comprometido (pago + a pagar), direto; o card usa o custo até a semana do filtro.
- IDP principal = avanço físico realizado ÷ planejado (horas), como no Flats; IDP em valor (valor agregado ÷ planejado
  da curva do direto) só como informação.
- IDP, projeções e término: SEMPRE na semana da ÚLTIMA MEDIÇÃO (realizado e planejado da mesma semana; valor agregado,
  custo e indireto também dessa semana). Semana do filtro posterior: aviso "sem medição desde Sxx — medir para
  atualizar"; a projeção não muda até a próxima medição.
- Cenários do direto: "O restante sai pelo orçamento" = comprometido + (orçado − valor agregado); "Mantém a eficiência
  atual" = orçado ÷ IPC (aviso: pouco confiável com menos de 15% de avanço físico); "Pessimista (custo e prazo)" =
  comprometido + (orçado − valor agregado) ÷ (IPC × IDP), IDP limitado a 1.
- Indireto projetado = realizado + recorrentes até o fim (verba − planejado até a semana) + pontuais (verba −
  realizado). Reserva 19.1.25 à parte (só o usado entra). Término: pelo adiantamento (principal, Flats) e pelo IDP.
- PENDENTE: engenheiro (19.1.23), contabilidade, IPTU e despesas bancárias sem nenhum lançamento nos relatórios até
  09/2026 — Rafael vai definir quem paga. Até lá, o planejado passado e não pago desses recorrentes fica fora da
  projeção (nota discreta na memória do indireto).
- Pontuais pagos em parte (19.1.1, 19.1.4, 19.1.12, 19.1.22): o restante AINDA SERÁ PAGO (Rafael vai informar os
  valores); a projeção mantém o saldo da verba como "a pagar".
- Memória do valor agregado (/custos-diretos): clique na linha mostra regra, origem do %, conta e custo; botão
  "Baixar memória (CSV)" com todas as linhas.

## Regras de negócio (resumo; detalhes no documento de continuidade do Flats)
- Custo do mês = títulos pagos no mês. Indireto = grupo 19; direto = grupos 1 a 17 (o grupo 18 foi para o indireto
  como 19.1.25 no pedido 14A).
- Avanço físico = horas executadas ÷ horas orçadas (nunca ponderado por valor).
- Medição = último % acumulado de cada linha, por código + pavimento.
- Custo nos indicadores sempre comprometido (pago + a pagar).
