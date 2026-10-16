# Rotina semanal — custos e contas a pagar (Sirius 60)

1. Crie a pasta `automacao\entrada\AAAA-MM-DD\` com a **data de corte** do relatório ("Até DD-MM-AA") e salve nela os 2 arquivos do financeiro: "Relatório de Custo Fonseca e Lage - Até …" e "Relatório de Custo DINAMICA - Até …" (e, se tiver, o relatório de Ordens de Compra).
2. Rode a prévia (nada é gravado): `! node ferramentas\semana\atualizar.js`
3. Mande para conferência o arquivo `automacao\saida_semana\AAAA-MM-DD\previa.md` (anexe no chat).
4. Decida as PENDÊNCIAS e os BLOQUEIOS da prévia (regras e decisões em `automacao\`); rode a prévia de novo até não sobrar nenhum.
5. Confirme: `! node ferramentas\semana\atualizar.js --confirmar` (guarda backup e um id de carga; para voltar: `--desfazer <id> --confirmar`).
6. Lance a medição da semana no site (aba Medição semanal).

Os dados entram direto no site, sem deploy; só código novo precisa de commit e de "Promote to Production".

Regra anti-duplicidade (detalhes no CLAUDE.md): cada pagamento tem uma chave (fonte + CNPJ + documento com a parcela + data de baixa). O relatório acumulado substitui os meses que mudaram; o relatório só da semana entra pela chave. O histórico manual do Rafael nunca é tocado. O que foi pago depois da data de corte fica no contas a pagar e entra no custo na carga seguinte, nunca nos dois.
