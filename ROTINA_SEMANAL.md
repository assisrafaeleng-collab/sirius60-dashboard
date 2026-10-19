# Rotina semanal — custos e contas a pagar (Sirius 60)

1. Salve os 2 relatórios do financeiro nas pastas FIXAS, uma por fonte (o nome traz a **data de corte**):
   - `automacao\entrada\dinamica\` → "Relatório de Custo DINAMICA - Até DD-MM-AA"
   - `automacao\entrada\fonseca\` → "Relatório de Custo FONSECA - Até DD-MM-AA" (vale também "Fonseca e Lage")

   Não apague os antigos: ficam como histórico; a rotina usa o MAIS NOVO de cada pasta. As duas datas de corte têm de ser iguais (se não forem, a prévia para). Relatório de Ordens de Compra vai em `automacao\oc\`.
2. Veja a última carga gravada (só leitura): `! node ferramentas\semana\atualizar.js --ultima`
3. Rode a prévia (nada é gravado): `! node ferramentas\semana\atualizar.js`
4. Mande para conferência o arquivo `automacao\saida_semana\AAAA-MM-DD\previa.md` (anexe no chat).
5. Decida as PENDÊNCIAS e os BLOQUEIOS da prévia (regras e decisões em `automacao\`); rode a prévia de novo até não sobrar nenhum.
6. Confirme: `! node ferramentas\semana\atualizar.js --confirmar` (guarda backup e um id de carga; para voltar: `--desfazer <id> --confirmar`).
7. Lance a medição da semana no site (aba Medição semanal).

Os dados entram direto no site, sem deploy; só código novo precisa de commit e de "Promote to Production".

Regra anti-duplicidade (detalhes no CLAUDE.md, seção "Entrada dos relatórios de custo"): cada pagamento tem uma chave (fonte + CNPJ + documento com a parcela + data de baixa). Os relatórios são ACUMULADOS: a carga substitui os meses cobertos, nunca soma por cima (relatório que parece só da semana bloqueia). Bloqueiam a carga: mesma chave nas duas fontes; título já gravado que entraria de novo com outra chave; Dinâmica com o valor cheio da nota em vez do rateio do Sirius. Relatório só de pagos não refaz o contas a pagar (só tira os títulos que agora aparecem pagos). O histórico manual do Rafael nunca é tocado. O que foi pago depois da data de corte fica no contas a pagar e entra no custo na carga seguinte, nunca nos dois.
