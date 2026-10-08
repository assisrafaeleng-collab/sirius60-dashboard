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
- Prazo: 20 meses, ago/2026 a mar/2028 (S01 = 03/08/2026). O app ainda usa 96 semanas: corrigir na fase do calendário.
- Pavimentos: Fundação, Subsolo, Pilotis, Térreo, 1º, 2º e 3º Pav, Terraço, Reservatório, Edifício, Externo, Canteiro.

## Fontes de custo (decisões do Rafael, 07/10/2026)
- Duas empresas pagam a obra, sem sobreposição esperada:
  - Fonseca & Lage: mão de obra e serviços sem nota fiscal. Valor = Valor líquido.
  - Dinâmica: tudo que tem NF-e (maior parte dos materiais). Valor = Valor Baixado.
  - Mesmo assim, checar duplicidade (mesmo CNPJ + documento nas duas fontes) e mostrar na prévia.
- "SQL (rateio)": notas compradas pela Dinâmica que atendem várias obras. Vale SÓ o valor rateado do Sirius
  (VALOR_RATEIO); a mesma nota pelo valor cheio no relatório da Dinâmica NÃO entra (evitar contar duas vezes).
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
  - NAO_CUSTO: título "Adto Forn" do BM1 (R$ 4.639,17) na Dinâmica (já pago pela Fonseca) e a 2ª linha do
    vale de 26/06 na Fonseca (repetição; pago uma vez só).
  - Previsões das OCs 1787 e 1849 não entram no contas a pagar (comprador vai cancelar/baixar no TOTVS).
- Outras decisões (Rafael, 07/10/2026):
  - ISS da Prefeitura → 19.1.22.
  - Impressões/cópias (Copiadora Realce) → linha de projeto estrutural do grupo 19.
  - Caixa Cartões → NAO_CUSTO.
  - Combustível da obra (Auto Posto; gasolina do carro de apoio) → linha NOVA 17.1.14 "Combustível obra"
    (17.1.4 já é "Locação de Andaime"), verba R$ 1.000,00/mês × 24 meses = R$ 24.000,00 (Rafael, 08/10).
    Entra no orçamento oficial na fase do orçamento; até lá fica em automacao/ajustes_orcamento.csv.
  - Areial Mariana (pedra de mão usada na concretagem dos fustes, no lugar de concreto) → 2.1.5
    (concreto usinado, apenas material).
  - Diária mista "Concretagem blocos e limpeza dos blocos" (BM3 item 3.5, R$ 800) → 50% 2.1.8 / 50% 2.1.2.

## Regras de negócio (resumo; detalhes no documento de continuidade do Flats)
- Custo do mês = títulos pagos no mês. Indireto = grupo 19; direto = grupos 1 a 18.
- Avanço físico = horas executadas ÷ horas orçadas (nunca ponderado por valor).
- Medição = último % acumulado de cada linha, por código + pavimento.
- Custo nos indicadores sempre comprometido (pago + a pagar).
