# Dashboard — Residencial Sirius 60 (Mariana/MG)

Acompanhamento de obra: EVM, curva S, avanço por pavimento e diário de ocorrências.
Next.js 14 + Supabase + Vercel.

## Dados da obra
- 2.622 m², 13 unidades, 96 semanas (S01 = 03/08/2026, fim planejado 04/06/2028)
- Custo direto R$ 7.398.635,20 | indireto R$ 2.446.376,88 | total R$ 9.845.012,08
- Base do EVM: R$ 6.212.060,00 (grupos 1-16). Grupos 17 e 18 sao custo de TEMPO
  e ficam fora do valor agregado.

## Rodar local
1. Copie `.env.local.exemplo` para `.env.local` e preencha URL e chave anon.
2. `npm install`
3. `npm run dev` -> http://localhost:3000

## Banco
Rodar no SQL Editor do Supabase, nesta ordem:
0. `00_reset_sirius60.sql` (SO na conversao mes->semana)
1. `01_estrutura_sirius60.sql` (uma vez)
2. `02_seed_sirius60.sql` (pode repetir, limpa antes)
3. `03_medicao_sirius60.sql` (uma vez, libera a medicao semanal)

## Medicao semanal
A aba "Medicao semanal" lista as atividades que o cronograma preve em
execucao na semana escolhida e recolhe o percentual ACUMULADO de cada
uma (nao o incremento da semana). Gravar de novo substitui, nao duplica.
Exige a senha definida em SENHA_MEDICAO no .env.local.
