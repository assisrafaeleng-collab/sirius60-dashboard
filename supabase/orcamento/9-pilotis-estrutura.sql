-- rodar o arquivo INTEIRO de uma vez (Ctrl+A e Run)
-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 9: orçamento com o PILOTIS no grupo 3 (pedido 20; decisões do Rafael 14/10/2026)
-- Base: automacao/orcamentos/Orcamento_Sirius_60_-_proposta_estrutura_com_Pilotis_v2_2026-10-14.xlsx (aba Orçamento).
-- Gerado por automacao/gerar_sql_pilotis_estrutura.py. Um ÚNICO bloco (DO), sem tabela temporária: grava tudo ou nada.
-- Desfazer: 9-desfazer.sql · Conferência só de leitura: 9-conferir-estado.sql
-- ORDEM: publicar (promover) o código do pedido 20 ANTES deste SQL (verba de forma com as ids novas e rótulo do Subsolo).
--
-- orcamento_planejado (por id; custos, contas a pagar e medições continuam na MESMA linha — nenhum está nas linhas que
-- mudam de código, conferido na trava). Fundação: semanas NÃO mudam; horas ∝ quantidade (índice Hh/un igual). Pilotis: as 1.305 h da atividade 3.1 do
-- cronograma (hoje em orcamento_horas_janela) vão para as linhas de serviço do Pilotis pelas horas reais. Subsolo …
-- Reservatório: horas da própria atividade, ∝ horas × (qtd nova ÷ atual), soma da atividade igual.
--    667   2.1.1 Fundação     →  2.1.1 Fundação     qtd 1,00 → 1,00 | R$ 51.750,00 → 51.750,00 | 44,0 → 44,0 h | S1–S4 → S1–S4
--    668   2.1.2 Fundação     →  2.1.2 Fundação     qtd 389,53 → 343,20 | R$ 97.383,00 → 85.800,00 | 1.558,1 → 1.372,8 h | S3–S13 → S3–S13
--    669   2.1.3 Fundação     →  2.1.3 Fundação     qtd 688,17 → 198,72 | R$ 25.462,35 → 7.352,64 | 132,3 → 38,2 h | S4–S15 → S4–S15
--    670   2.1.4 Fundação     →  2.1.4 Fundação     qtd 16.578,47 → 16.394,38 | R$ 114.723,01 → 113.449,10 | 596,1 → 589,5 h | S4–S15 → S4–S15
--    671   2.1.5 Fundação     →  2.1.5 Fundação     qtd 529,80 → 362,21 | R$ 349.668,00 → 239.061,64 | 986,9 → 674,7 h | S6–S16 → S6–S16
--    672   2.1.6 Fundação     →  2.1.6 Fundação     qtd 688,17 → 198,72 | R$ 51.612,86 → 14.904,00 | 214,6 → 62,0 h | S4–S15 → S4–S15
--    673   2.1.7 Fundação     →  2.1.7 Fundação     qtd 16.578,47 → 16.394,38 | R$ 49.735,41 → 49.183,13 | 258,4 → 255,5 h | S4–S15 → S4–S15
--    674   2.1.8 Fundação     →  2.1.8 Fundação     qtd 6,00 → 6,00 | R$ 7.200,00 → 7.200,00 | 20,3 → 20,3 h | S6–S16 → S6–S16
--    680  2.1.14 Fundação     → 2.1.14 Fundação     qtd 756,99 → 198,72 | R$ 16.858,14 → 4.425,49 | 408,8 → 107,3 h | S11–S22 → S11–S22
--   1001   NOVA                 →  3.1.1 Pilotis      qtd 3.836,48 kg | R$ 26.548,45 | 0,0 h | S10–S16
--   1002   NOVA                 →  3.1.2 Pilotis      qtd 3.836,48 kg | R$ 11.509,44 | 300,3 h | S10–S16
--   1003   NOVA                 →  3.1.3 Pilotis      qtd 64,92 m³ | R$ 42.848,52 | 0,0 h | S13–S18
--   1004   NOVA                 →  3.1.4 Pilotis      qtd 6,00 diária | R$ 7.200,00 | 164,4 h | S13–S18
--   1005   NOVA                 →  3.1.5 Pilotis      qtd 461,28 m² | R$ 34.595,74 | 634,5 h | S10–S18
--   1006   NOVA                 →  3.1.6 Pilotis      qtd 461,28 m² | R$ 17.067,23 | 0,0 h | S10–S18
--    675   2.1.9 Fundação     →  3.1.7 Pilotis      qtd 324,32 → 220,50 | R$ 49.699,41 → 33.789,42 | 304,1 → 304,1 h | S10–S15 → S10–S15
--    692  3.1.12 Subsolo      →  3.1.8 Pilotis      qtd 283,50 → 284,03 | R$ 34.020,00 → 34.083,00 | 344,6 → 137,3 h | S24–S27 → S15–S18
--   1007   NOVA                 →  3.1.9 Pilotis      qtd 3,00 diária | R$ 4.500,00 | 68,5 h | S18–S18
--   1008   NOVA                 → 3.1.10 Pilotis      qtd 13,44 m² | R$ 497,28 | 0,0 h | S18–S18
--   1009   NOVA                 → 3.1.11 Pilotis      qtd 98,99 kg | R$ 685,01 | 0,0 h | S18–S18
--   1010   NOVA                 → 3.1.12 Pilotis      qtd 4,44 m³ | R$ 2.927,23 | 0,0 h | S18–S18
--    681   3.1.1 Subsolo      →  3.2.1 Subsolo      qtd 5.487,13 → 6.128,60 | R$ 37.970,94 → 42.409,88 | 312,9 → 384,3 h | S19–S26 → S19–S26
--    682   3.1.2 Subsolo      →  3.2.2 Subsolo      qtd 5.487,13 → 6.128,60 | R$ 16.461,39 → 18.385,79 | 337,1 → 166,7 h | S19–S26 → S19–S26
--    683   3.1.3 Subsolo      →  3.2.3 Subsolo      qtd 125,89 → 113,36 | R$ 83.090,70 → 74.814,30 | 684,9 → 678,0 h | S22–S28 → S22–S28
--    684   3.1.4 Subsolo      →  3.2.4 Subsolo      qtd 6,00 → 6,00 | R$ 7.200,00 → 7.200,00 | 136,5 → 65,3 h | S22–S28 → S22–S28
--    685   3.1.5 Subsolo      →  3.2.5 Subsolo      qtd 1.432,45 → 834,45 | R$ 107.433,86 → 62.583,86 | 1.632,1 → 453,7 h | S19–S27 → S19–S27
--    686   3.1.6 Subsolo      →  3.2.6 Subsolo      qtd 1.432,45 → 834,45 | R$ 53.000,71 → 30.874,71 | 436,8 → 279,8 h | S19–S27 → S19–S27
--    687   3.1.7 Subsolo      →  3.2.7 Subsolo      qtd 500,00 → 500,00 | R$ 12.500,00 → 12.500,00 | 102,3 → 95,9 h | S15–S18 → S15–S18
--    688   3.1.8 Subsolo      →  3.2.8 Subsolo      qtd 3,00 → 3,00 | R$ 4.500,00 → 4.500,00 | 69,2 → 40,8 h | S27–S28 → S27–S28
--    689   3.1.9 Subsolo      →  3.2.9 Subsolo      qtd 13,44 → 13,44 | R$ 497,28 → 497,28 | 4,1 → 4,5 h | S27–S28 → S27–S28
--    690  3.1.10 Subsolo      → 3.2.10 Subsolo      qtd 98,99 → 98,99 | R$ 685,01 → 685,01 | 5,6 → 6,2 h | S27–S28 → S27–S28
--    691  3.1.11 Subsolo      → 3.2.11 Subsolo      qtd 4,44 → 4,44 | R$ 2.927,23 → 2.927,23 | 24,1 → 26,5 h | S27–S28 → S27–S28
--   1011   NOVA                 → 3.2.12 Subsolo      qtd 536,55 m² | R$ 64.386,00 | 583,5 h | S24–S27
--    693   3.2.1 Térreo       →  3.3.1 Térreo       qtd 4.921,07 → 5.696,60 | R$ 34.053,80 → 39.420,49 | 265,3 → 366,1 h | S29–S35 → S29–S35
--    694   3.2.2 Térreo       →  3.3.2 Térreo       qtd 4.921,07 → 5.696,60 | R$ 14.763,21 → 17.089,81 | 115,0 → 158,7 h | S29–S35 → S29–S35
--    695   3.2.3 Térreo       →  3.3.3 Térreo       qtd 124,89 → 113,41 | R$ 82.427,14 → 74.850,60 | 642,2 → 695,2 h | S32–S37 → S32–S37
--    696   3.2.4 Térreo       →  3.3.4 Térreo       qtd 6,00 → 6,00 | R$ 7.200,00 → 7.200,00 | 56,1 → 66,9 h | S32–S37 → S32–S37
--    697   3.2.5 Térreo       →  3.3.5 Térreo       qtd 1.434,51 → 864,33 | R$ 107.588,25 → 64.824,64 | 670,6 → 481,6 h | S29–S36 → S29–S36
--    698   3.2.6 Térreo       →  3.3.6 Térreo       qtd 1.434,51 → 864,33 | R$ 53.076,87 → 31.980,15 | 413,6 → 297,1 h | S29–S36 → S29–S36
--    699   3.2.7 Térreo       →  3.3.7 Térreo       qtd 313,50 → 313,50 | R$ 7.837,50 → 7.837,50 | 60,1 → 60,1 h | S15–S18 → S15–S18
--    700   3.2.8 Térreo       →  3.3.8 Térreo       qtd 3,00 → 3,00 | R$ 4.500,00 → 4.500,00 | 35,1 → 41,8 h | S36–S37 → S36–S37
--    701   3.2.9 Térreo       →  3.3.9 Térreo       qtd 13,44 → 13,44 | R$ 497,28 → 497,28 | 3,9 → 4,6 h | S36–S37 → S36–S37
--    702  3.2.10 Térreo       → 3.3.10 Térreo       qtd 98,99 → 98,99 | R$ 685,01 → 685,01 | 5,3 → 6,3 h | S36–S37 → S36–S37
--    703  3.2.11 Térreo       → 3.3.11 Térreo       qtd 4,44 → 4,44 | R$ 2.927,23 → 2.927,23 | 22,8 → 27,1 h | S36–S37 → S36–S37
--    704  3.2.12 Térreo       → 3.3.12 Térreo       qtd 517,12 → 512,93 | R$ 59.469,38 → 58.986,38 | 463,4 → 547,9 h | S33–S36 → S33–S36
--    705   3.3.1 1º Pav       →  3.4.1 1º Pav       qtd 5.324,55 → 5.872,90 | R$ 36.845,89 → 40.640,47 | 281,4 → 377,7 h | S38–S45 → S38–S45
--    706   3.3.2 1º Pav       →  3.4.2 1º Pav       qtd 5.324,55 → 5.872,90 | R$ 15.973,65 → 17.618,70 | 122,0 → 163,8 h | S38–S45 → S38–S45
--    707   3.3.3 1º Pav       →  3.4.3 1º Pav       qtd 125,19 → 112,55 | R$ 82.625,33 → 74.284,32 | 631,1 → 690,5 h | S41–S47 → S41–S47
--    708   3.3.4 1º Pav       →  3.4.4 1º Pav       qtd 6,00 → 6,00 | R$ 7.200,00 → 7.200,00 | 55,0 → 66,9 h | S41–S47 → S41–S47
--    709   3.3.5 1º Pav       →  3.4.5 1º Pav       qtd 1.432,42 → 843,38 | R$ 107.431,27 → 63.253,16 | 656,5 → 470,4 h | S38–S47 → S38–S47
--    710   3.3.6 1º Pav       →  3.4.6 1º Pav       qtd 1.432,42 → 843,38 | R$ 52.999,43 → 31.204,89 | 404,8 → 290,0 h | S38–S47 → S38–S47
--    711   3.3.7 1º Pav       →  3.4.7 1º Pav       qtd 3,00 → 3,00 | R$ 4.500,00 → 4.500,00 | 34,4 → 41,9 h | S47–S47 → S47–S47
--    712   3.3.8 1º Pav       →  3.4.8 1º Pav       qtd 13,44 → 13,44 | R$ 497,28 → 497,28 | 3,8 → 4,6 h | S47–S47 → S47–S47
--    713   3.3.9 1º Pav       →  3.4.9 1º Pav       qtd 98,99 → 98,99 | R$ 685,01 → 685,01 | 5,2 → 6,3 h | S47–S47 → S47–S47
--    714  3.3.10 1º Pav       → 3.4.10 1º Pav       qtd 4,44 → 4,44 | R$ 2.927,23 → 2.927,23 | 22,4 → 27,2 h | S47–S47 → S47–S47
--    715  3.3.11 1º Pav       → 3.4.11 1º Pav       qtd 538,12 → 514,50 | R$ 61.884,38 → 59.167,50 | 472,7 → 550,0 h | S43–S47 → S43–S47
--    716   3.4.1 2º Pav       →  3.5.1 2º Pav       qtd 3.533,20 → 3.883,17 | R$ 24.449,74 → 26.871,50 | 187,2 → 254,3 h | S48–S55 → S48–S55
--    717   3.4.2 2º Pav       →  3.5.2 2º Pav       qtd 3.533,20 → 3.883,17 | R$ 10.599,60 → 11.649,50 | 81,2 → 110,3 h | S48–S55 → S48–S55
--    718   3.4.3 2º Pav       →  3.5.3 2º Pav       qtd 83,29 → 73,25 | R$ 54.973,45 → 48.347,24 | 421,0 → 457,6 h | S51–S57 → S51–S57
--    719   3.4.4 2º Pav       →  3.5.4 2º Pav       qtd 6,00 → 6,00 | R$ 7.200,00 → 7.200,00 | 55,1 → 68,1 h | S51–S57 → S51–S57
--    721   3.4.6 2º Pav       →  3.5.5 2º Pav       qtd 1.004,94 → 617,75 | R$ 75.370,43 → 46.330,91 | 461,7 → 350,7 h | S48–S56 → S48–S56
--    720   3.4.5 2º Pav       →  3.5.6 2º Pav       qtd 1.004,94 → 617,75 | R$ 37.182,74 → 22.856,58 | 284,7 → 216,3 h | S48–S56 → S48–S56
--    722   3.4.7 2º Pav       →  3.5.7 2º Pav       qtd 3,00 → 3,00 | R$ 4.500,00 → 4.500,00 | 34,5 → 42,6 h | S56–S57 → S56–S57
--    723   3.4.8 2º Pav       →  3.5.8 2º Pav       qtd 13,44 → 13,44 | R$ 497,28 → 497,28 | 3,8 → 4,7 h | S56–S57 → S56–S57
--    724   3.4.9 2º Pav       →  3.5.9 2º Pav       qtd 98,99 → 98,99 | R$ 685,01 → 685,01 | 5,2 → 6,4 h | S56–S57 → S56–S57
--    725  3.4.10 2º Pav       → 3.5.10 2º Pav       qtd 4,44 → 4,44 | R$ 2.927,23 → 2.927,23 | 22,4 → 27,7 h | S56–S57 → S56–S57
--    726  3.4.11 2º Pav       → 3.5.11 2º Pav       qtd 382,99 → 326,55 | R$ 44.043,56 → 37.553,25 | 337,3 → 355,4 h | S53–S56 → S53–S56
--    727   3.5.1 3º Pav       →  3.6.1 3º Pav       qtd 3.652,22 → 4.078,80 | R$ 25.273,36 → 28.225,30 | 199,8 → 277,9 h | S58–S65 → S58–S65
--    728   3.5.2 3º Pav       →  3.6.2 3º Pav       qtd 3.652,22 → 4.078,80 | R$ 10.956,66 → 12.236,40 | 86,6 → 120,5 h | S58–S65 → S58–S65
--    729   3.5.3 3º Pav       →  3.6.3 3º Pav       qtd 84,66 → 74,38 | R$ 55.873,69 → 49.092,12 | 441,7 → 483,4 h | S61–S67 → S61–S67
--    730   3.5.4 3º Pav       →  3.6.4 3º Pav       qtd 6,00 → 6,00 | R$ 7.200,00 → 7.200,00 | 56,9 → 70,9 h | S61–S67 → S61–S67
--    731   3.5.5 3º Pav       →  3.6.5 3º Pav       qtd 1.023,26 → 632,79 | R$ 76.744,39 → 47.459,06 | 485,4 → 373,9 h | S58–S66 → S58–S66
--    732   3.5.6 3º Pav       →  3.6.6 3º Pav       qtd 1.023,26 → 632,79 | R$ 37.860,56 → 23.413,14 | 299,3 → 230,6 h | S58–S66 → S58–S66
--    733   3.5.7 3º Pav       →  3.6.7 3º Pav       qtd 394,28 → 327,60 | R$ 45.341,63 → 37.674,00 | 358,5 → 371,0 h | S63–S66 → S63–S66
--    734   3.6.1 Terraço      →  3.7.1 Terraço      qtd 3.163,93 → 3.724,09 | R$ 21.894,40 → 25.770,73 | 174,3 → 251,7 h | S68–S75 → S68–S75
--    735   3.6.2 Terraço      →  3.7.2 Terraço      qtd 3.163,93 → 3.724,09 | R$ 9.491,79 → 11.172,28 | 75,5 → 109,0 h | S68–S75 → S68–S75
--    736   3.6.3 Terraço      →  3.7.3 Terraço      qtd 85,90 → 76,67 | R$ 56.694,79 → 50.601,47 | 451,2 → 493,9 h | S71–S77 → S71–S77
--    737   3.6.4 Terraço      →  3.7.4 Terraço      qtd 6,00 → 6,00 | R$ 7.200,00 → 7.200,00 | 57,3 → 70,3 h | S71–S77 → S71–S77
--    738   3.6.5 Terraço      →  3.7.5 Terraço      qtd 1.036,52 → 580,45 | R$ 77.738,85 → 43.533,83 | 495,0 → 340,1 h | S69–S76 → S69–S76
--    739   3.6.6 Terraço      →  3.7.6 Terraço      qtd 1.036,52 → 580,45 | R$ 38.351,17 → 21.476,69 | 305,2 → 209,7 h | S69–S76 → S69–S76
--    740   3.6.7 Terraço      →  3.7.7 Terraço      qtd 403,61 → 403,61 | R$ 46.415,09 → 46.415,09 | 369,4 → 453,2 h | S73–S76 → S73–S76
--    741   3.7.1 Reservatório →  3.8.1 Reservatório qtd 2.241,89 → 2.241,89 | R$ 15.513,86 → 15.513,86 | 163,8 → 163,8 h | S78–S81 → S78–S81
--    742   3.7.2 Reservatório →  3.8.2 Reservatório qtd 2.241,89 → 2.241,89 | R$ 6.725,66 → 6.725,66 | 71,0 → 71,0 h | S78–S81 → S78–S81
--    743   3.7.3 Reservatório →  3.8.3 Reservatório qtd 42,57 → 42,57 | R$ 28.096,20 → 28.096,20 | 296,6 → 296,6 h | S79–S82 → S79–S82
--    744   3.7.4 Reservatório →  3.8.4 Reservatório qtd 42,57 → 42,57 | R$ 522,33 → 522,33 | 5,5 → 5,5 h | S79–S82 → S79–S82
--    745   3.7.5 Reservatório →  3.8.5 Reservatório qtd 531,22 → 531,22 | R$ 39.841,46 → 39.841,46 | 336,5 → 336,5 h | S78–S82 → S78–S82
--    746   3.7.6 Reservatório →  3.8.6 Reservatório qtd 531,22 → 531,22 | R$ 10.858,13 → 10.858,13 | 114,6 → 114,6 h | S78–S82 → S78–S82
--    676  2.1.10 Fundação     → SAI (R$ 4.500,00, 27,5 h)
--    677  2.1.11 Fundação     → SAI (R$ 497,28, 3,0 h)
--    678  2.1.12 Fundação     → SAI (R$ 685,01, 4,2 h)
--    679  2.1.13 Fundação     → SAI (R$ 2.927,23, 17,9 h)
--    992   3.0.1 Pilotis      → SAI (R$ 0,00, 0,0 h)
--   Linhas 333 → 339 · custo direto R$ 7.200.717,91 → 6.834.476,17 · horas do orçamento
--   49.693,6 → 48.585,8 · base do avanço 48.637,6 → 47.529,8 (diferença = escada da fundação que sai 52,6 h + horas da fundação pela quantidade 1.055,2 h)
--   Verba de forma (14 linhas): R$ 311.278,36 → 199.570,56.
-- orcamento_horas_janela: saem as 6 linhas do Pilotis (origem 3.0.1, 1.305,0 h); ficam as 13 da 4.0.9.
-- orcamento_material_servico: saem os 3 vínculos da escada da fundação; entram 6 do Pilotis; códigos refeitos pelo id.
-- indice_produtividade: código e pavimento pelo id; índice do cronograma (horas ÷ quantidade) refeito onde a quantidade mudou;
--   saem 2.1.10 e 3.0.1; entram 3.1.2, 3.1.4, 3.1.5, 3.1.9 e 3.2.12 (índices do Rafael, iguais aos dos outros pavimentos).
-- curva_s_semanal_planejada: 75 semanas mudam; horas 48.637,5 → 47.529,7; valor R$ 6.403.393,91 → 6.037.152,17;
--   planejado acumulado S09 4,30% → 3,66%; S12 7,47% → 6,24%.
-- avanco_fisico_historico: mantém a QUANTIDADE executada (levantamento do Rafael 14/10/2026); 9 correções novas (as antigas ficam):
--   2.1.2 S03 9,2436% → 10,4914% (corrige a medição id 18)
--   2.1.2 S04 46,2181% → 52,4573% (corrige a medição id 19)
--   2.1.2 S09 55,4617% → 62,9487% (corrige a medição id 26)
--   2.1.6 S04 7,0593% → 24,4464% (corrige a medição id 20)
--   2.1.6 S06 11,2949% → 39,1144% (corrige a medição id 24)
--   2.1.6 S09 14,1186% → 48,8929% (corrige a medição id 25)
--   2.1.7 S04 24,9079% → 25,1875% (corrige a medição id 21)
--   2.1.7 S06 34,8710% → 35,2625% (corrige a medição id 23)
--   2.1.8 S04 36,7629% → 53,7727% (corrige a medição id 22)
-- Backups (tabelas de verdade, RLS, sem permissão para anon/authenticated): orcamento_p20_bkp_20261014, curva_p20_bkp_20261014, avanco_p20_bkp_20261014, janela_p20_bkp_20261014, vinculo_p20_bkp_20261014, indice_p20_bkp_20261014.
-- =====================================================================
do $$
declare v_n int; v_p numeric; v_h numeric; v_v numeric; v_seq text; v_last bigint;
        v_cn int; v_cs numeric; v_ck numeric; v_an int; v_as numeric; v_ak numeric; v_hn int;
begin
  -- ===== TRAVAS ANTES =====
  if to_regclass('public.orcamento_p20_bkp_20261014') is not null or to_regclass('public.curva_p20_bkp_20261014') is not null or to_regclass('public.avanco_p20_bkp_20261014') is not null or to_regclass('public.janela_p20_bkp_20261014') is not null or to_regclass('public.vinculo_p20_bkp_20261014') is not null or to_regclass('public.indice_p20_bkp_20261014') is not null then
    raise exception 'backup do passo 9 já existe: este arquivo já foi rodado? Nada foi gravado';
  end if;
  if exists (select 1 from public.orcamento_planejado where id in (1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011)) then
    raise exception 'já existe linha com id 1001 a 1011: nada foi gravado';
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.orcamento_planejado'::regclass and attname = 'id' and attidentity = 'a') then
    raise exception 'id do orçamento é identity ALWAYS (não aceita id fixo): nada foi gravado';
  end if;
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 333 or v_p <> 7200717.91 or v_h <> 49693.6 then
    raise exception 'orçamento com % linhas, R$ % e % h (esperado 333, 7200717.91 e 49693.6): nada foi gravado', v_n, v_p, v_h;
  end if;
  select round(sum(hh), 1) into v_h from public.orcamento_planejado where obra_id = 'sirius60' and grupo_num <= 16 and codigo_eap <> '1.1.6';
  if v_h <> 48637.6 then raise exception 'base de horas % (esperado 48637.6): nada foi gravado', v_h; end if;
  with x(id, codigo, pavimento, quantidade, preco_total, hh, semana_inicio, semana_fim) as (values
    (667, '2.1.1', 'Fundação', 1.0, 51750.0, 44.0, 1, 4),
    (668, '2.1.2', 'Fundação', 389.53, 97383.0, 1558.1, 3, 13),
    (669, '2.1.3', 'Fundação', 688.17, 25462.35, 132.3, 4, 15),
    (670, '2.1.4', 'Fundação', 16578.47, 114723.01, 596.1, 4, 15),
    (671, '2.1.5', 'Fundação', 529.8, 349668.0, 986.9, 6, 16),
    (672, '2.1.6', 'Fundação', 688.17, 51612.86, 214.6, 4, 15),
    (673, '2.1.7', 'Fundação', 16578.47, 49735.41, 258.4, 4, 15),
    (674, '2.1.8', 'Fundação', 6.0, 7200.0, 20.3, 6, 16),
    (675, '2.1.9', 'Fundação', 324.32, 49699.41, 304.1, 10, 15),
    (676, '2.1.10', 'Fundação', 3.0, 4500.0, 27.5, 15, 16),
    (677, '2.1.11', 'Fundação', 13.44, 497.28, 3.0, 15, 16),
    (678, '2.1.12', 'Fundação', 98.99, 685.01, 4.2, 15, 16),
    (679, '2.1.13', 'Fundação', 4.44, 2927.23, 17.9, 15, 16),
    (680, '2.1.14', 'Fundação', 756.99, 16858.14, 408.8, 11, 22),
    (681, '3.1.1', 'Subsolo', 5487.13, 37970.94, 312.9, 19, 26),
    (682, '3.1.2', 'Subsolo', 5487.13, 16461.39, 337.1, 19, 26),
    (683, '3.1.3', 'Subsolo', 125.89, 83090.7, 684.9, 22, 28),
    (684, '3.1.4', 'Subsolo', 6.0, 7200.0, 136.5, 22, 28),
    (685, '3.1.5', 'Subsolo', 1432.45, 107433.86, 1632.1, 19, 27),
    (686, '3.1.6', 'Subsolo', 1432.45, 53000.71, 436.8, 19, 27),
    (687, '3.1.7', 'Subsolo', 500.0, 12500.0, 102.3, 15, 18),
    (688, '3.1.8', 'Subsolo', 3.0, 4500.0, 69.2, 27, 28),
    (689, '3.1.9', 'Subsolo', 13.44, 497.28, 4.1, 27, 28),
    (690, '3.1.10', 'Subsolo', 98.99, 685.01, 5.6, 27, 28),
    (691, '3.1.11', 'Subsolo', 4.44, 2927.23, 24.1, 27, 28),
    (692, '3.1.12', 'Subsolo', 283.5, 34020.0, 344.6, 24, 27),
    (693, '3.2.1', 'Térreo', 4921.07, 34053.8, 265.3, 29, 35),
    (694, '3.2.2', 'Térreo', 4921.07, 14763.21, 115.0, 29, 35),
    (695, '3.2.3', 'Térreo', 124.89, 82427.14, 642.2, 32, 37),
    (696, '3.2.4', 'Térreo', 6.0, 7200.0, 56.1, 32, 37),
    (697, '3.2.5', 'Térreo', 1434.51, 107588.25, 670.6, 29, 36),
    (698, '3.2.6', 'Térreo', 1434.51, 53076.87, 413.6, 29, 36),
    (699, '3.2.7', 'Térreo', 313.5, 7837.5, 60.1, 15, 18),
    (700, '3.2.8', 'Térreo', 3.0, 4500.0, 35.1, 36, 37),
    (701, '3.2.9', 'Térreo', 13.44, 497.28, 3.9, 36, 37),
    (702, '3.2.10', 'Térreo', 98.99, 685.01, 5.3, 36, 37),
    (703, '3.2.11', 'Térreo', 4.44, 2927.23, 22.8, 36, 37),
    (704, '3.2.12', 'Térreo', 517.12, 59469.38, 463.4, 33, 36),
    (705, '3.3.1', '1º Pav', 5324.55, 36845.89, 281.4, 38, 45),
    (706, '3.3.2', '1º Pav', 5324.55, 15973.65, 122.0, 38, 45),
    (707, '3.3.3', '1º Pav', 125.19, 82625.33, 631.1, 41, 47),
    (708, '3.3.4', '1º Pav', 6.0, 7200.0, 55.0, 41, 47),
    (709, '3.3.5', '1º Pav', 1432.42, 107431.27, 656.5, 38, 47),
    (710, '3.3.6', '1º Pav', 1432.42, 52999.43, 404.8, 38, 47),
    (711, '3.3.7', '1º Pav', 3.0, 4500.0, 34.4, 47, 47),
    (712, '3.3.8', '1º Pav', 13.44, 497.28, 3.8, 47, 47),
    (713, '3.3.9', '1º Pav', 98.99, 685.01, 5.2, 47, 47),
    (714, '3.3.10', '1º Pav', 4.44, 2927.23, 22.4, 47, 47),
    (715, '3.3.11', '1º Pav', 538.12, 61884.38, 472.7, 43, 47),
    (716, '3.4.1', '2º Pav', 3533.2, 24449.74, 187.2, 48, 55),
    (717, '3.4.2', '2º Pav', 3533.2, 10599.6, 81.2, 48, 55),
    (718, '3.4.3', '2º Pav', 83.29, 54973.45, 421.0, 51, 57),
    (719, '3.4.4', '2º Pav', 6.0, 7200.0, 55.1, 51, 57),
    (720, '3.4.5', '2º Pav', 1004.94, 37182.74, 284.7, 48, 56),
    (721, '3.4.6', '2º Pav', 1004.94, 75370.43, 461.7, 48, 56),
    (722, '3.4.7', '2º Pav', 3.0, 4500.0, 34.5, 56, 57),
    (723, '3.4.8', '2º Pav', 13.44, 497.28, 3.8, 56, 57),
    (724, '3.4.9', '2º Pav', 98.99, 685.01, 5.2, 56, 57),
    (725, '3.4.10', '2º Pav', 4.44, 2927.23, 22.4, 56, 57),
    (726, '3.4.11', '2º Pav', 382.99, 44043.56, 337.3, 53, 56),
    (727, '3.5.1', '3º Pav', 3652.22, 25273.36, 199.8, 58, 65),
    (728, '3.5.2', '3º Pav', 3652.22, 10956.66, 86.6, 58, 65),
    (729, '3.5.3', '3º Pav', 84.66, 55873.69, 441.7, 61, 67),
    (730, '3.5.4', '3º Pav', 6.0, 7200.0, 56.9, 61, 67),
    (731, '3.5.5', '3º Pav', 1023.26, 76744.39, 485.4, 58, 66),
    (732, '3.5.6', '3º Pav', 1023.26, 37860.56, 299.3, 58, 66),
    (733, '3.5.7', '3º Pav', 394.28, 45341.63, 358.5, 63, 66),
    (734, '3.6.1', 'Terraço', 3163.93, 21894.4, 174.3, 68, 75),
    (735, '3.6.2', 'Terraço', 3163.93, 9491.79, 75.5, 68, 75),
    (736, '3.6.3', 'Terraço', 85.9, 56694.79, 451.2, 71, 77),
    (737, '3.6.4', 'Terraço', 6.0, 7200.0, 57.3, 71, 77),
    (738, '3.6.5', 'Terraço', 1036.52, 77738.85, 495.0, 69, 76),
    (739, '3.6.6', 'Terraço', 1036.52, 38351.17, 305.2, 69, 76),
    (740, '3.6.7', 'Terraço', 403.61, 46415.09, 369.4, 73, 76),
    (741, '3.7.1', 'Reservatório', 2241.89, 15513.86, 163.8, 78, 81),
    (742, '3.7.2', 'Reservatório', 2241.89, 6725.66, 71.0, 78, 81),
    (743, '3.7.3', 'Reservatório', 42.57, 28096.2, 296.6, 79, 82),
    (744, '3.7.4', 'Reservatório', 42.57, 522.33, 5.5, 79, 82),
    (745, '3.7.5', 'Reservatório', 531.22, 39841.46, 336.5, 78, 82),
    (746, '3.7.6', 'Reservatório', 531.22, 10858.13, 114.6, 78, 82),
    (992, '3.0.1', 'Pilotis', 701.61, 0.0, 0.0, 10, 18))
  select count(*) into v_n from public.orcamento_planejado o join x on x.id = o.id
   where o.obra_id = 'sirius60' and o.codigo_eap = x.codigo and o.pavimento = x.pavimento and o.quantidade = x.quantidade
     and o.preco_total = x.preco_total and o.hh = x.hh and o.semana_inicio = x.semana_inicio and o.semana_fim = x.semana_fim;
  if v_n <> 81 then raise exception 'só % das 81 linhas dos grupos 2 e 3 estão como esperado: nada foi gravado', v_n; end if;
  select count(*), round(sum(hh), 1) into v_n, v_h from public.orcamento_horas_janela where obra_id = 'sirius60';
  if v_n <> 19 or v_h <> 1365.1 then raise exception 'orcamento_horas_janela com % linhas e % h: nada foi gravado', v_n, v_h; end if;
  with j(orcamento_id, hh) as (values
    (682, 201.4),
    (685, 923.8),
    (684, 77.1),
    (687, 6.4),
    (688, 32.1),
    (692, 64.2))
  select count(*) into v_n from public.orcamento_horas_janela w join j using (orcamento_id)
   where w.obra_id = 'sirius60' and w.origem = '3.0.1' and w.hh = j.hh and w.semana_inicio = 10 and w.semana_fim = 18;
  if v_n <> 6 then raise exception 'janelas do Pilotis diferentes do esperado: nada foi gravado'; end if;
  if (select count(*) from public.orcamento_material_servico where obra_id = 'sirius60') <> 53
     or (select count(*) from public.orcamento_material_servico where obra_id = 'sirius60' and material_id in (677, 678, 679) and servico_id = 676) <> 3 then
    raise exception 'vínculos material → serviço diferentes do esperado: nada foi gravado';
  end if;
  if (select count(*) from public.indice_produtividade where obra_id = 'sirius60') <> 269
     or (select count(*) from public.indice_produtividade where obra_id = 'sirius60' and orcamento_id in (676, 992)) <> 2
     or exists (select 1 from public.indice_produtividade where orcamento_id in (1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011)) then
    raise exception 'indice_produtividade diferente do esperado: nada foi gravado';
  end if;
  -- nada lançado nas linhas que saem ou mudam de código (2.1.9 a 2.1.13 e grupo 3)
  if exists (select 1 from public.custos_lancamentos where obra_id = 'sirius60' and (codigo_eap ~ '^2\.1\.(9|1[0-3])$' or codigo_eap like '3.%'))
     or exists (select 1 from public.contas_a_pagar where obra_id = 'sirius60' and (codigo_eap ~ '^2\.1\.(9|1[0-3])$' or codigo_eap like '3.%'))
     or exists (select 1 from public.avanco_fisico_historico where obra_id = 'sirius60' and (codigo_eap ~ '^2\.1\.(9|1[0-3])$' or codigo_eap like '3.%'))
     or exists (select 1 from public.ocorrencias_obra where obra_id = 'sirius60' and (codigo_eap ~ '^2\.1\.(9|1[0-3])$' or codigo_eap like '3.%'))
     or exists (select 1 from public.insumo_prazo_entrega where obra_id = 'sirius60' and orcamento_id in (667, 668, 669, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687, 688, 689, 690, 691, 692, 693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 727, 728, 729, 730, 731, 732, 733, 734, 735, 736, 737, 738, 739, 740, 741, 742, 743, 744, 745, 746, 992))
     or exists (select 1 from public.planejamento_historico where obra_id = 'sirius60' and orcamento_id in (667, 668, 669, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687, 688, 689, 690, 691, 692, 693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 727, 728, 729, 730, 731, 732, 733, 734, 735, 736, 737, 738, 739, 740, 741, 742, 743, 744, 745, 746, 992)) then
    raise exception 'há custo, conta a pagar, medição, ocorrência, compra ou edição nas linhas que saem ou mudam de código: nada foi gravado';
  end if;
  select count(*), round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_n, v_h, v_v
    from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> 117 or v_h <> 48637.5 or v_v <> 6403393.91 then
    raise exception 'curva com % semanas, % h e R$ % (esperado 117, 48637.5 e 6403393.91): nada foi gravado', v_n, v_h, v_v;
  end if;
  with t(semana, hh_hoje, valor_hoje, hh_semanal, perc_hh_semanal, perc_hh_acum, valor_semanal, valor_acum, perc_valor_acum) as (values
    (3, 168.4130, 22650.97, 149.9540, 0.315495, 0.512135, 21497.11, 59320.67, 0.982594),
    (4, 311.3746, 47583.54, 274.6716, 0.577895, 1.090029, 43085.98, 102406.65, 1.696274),
    (5, 239.6684, 28995.94, 201.6226, 0.424203, 1.514233, 23196.25, 125602.91, 2.080499),
    (6, 357.6775, 62906.74, 287.8522, 0.605626, 2.119859, 47128.07, 172730.98, 2.861133),
    (7, 378.9679, 70837.13, 302.2048, 0.635823, 2.755682, 52600.54, 225331.52, 3.732414),
    (8, 378.9679, 70837.13, 302.2048, 0.635823, 3.391505, 52600.54, 277932.06, 4.603695),
    (9, 162.4148, 30358.77, 129.5163, 0.272496, 3.664000, 22543.09, 300475.15, 4.977101),
    (10, 330.5920, 44302.88, 231.3555, 0.486760, 4.150760, 35977.80, 336452.95, 5.573041),
    (11, 595.6793, 78236.98, 494.7853, 1.041002, 5.191762, 70101.35, 406554.31, 6.734207),
    (12, 615.4600, 79052.69, 499.9773, 1.051926, 6.243689, 70315.49, 476869.79, 7.898920),
    (13, 576.3678, 76609.39, 476.6710, 1.002891, 7.246579, 71553.18, 548422.97, 9.084134),
    (14, 393.5070, 59382.42, 348.6449, 0.733531, 7.980110, 64513.95, 612936.92, 10.152749),
    (15, 528.8789, 76799.74, 462.0699, 0.972171, 8.952281, 80104.50, 693041.42, 11.479608),
    (16, 387.0190, 71362.93, 305.6960, 0.643168, 9.595449, 74638.70, 767680.12, 12.715931),
    (17, 241.8047, 26318.84, 195.2379, 0.410770, 10.006219, 43180.33, 810860.45, 13.431175),
    (18, 276.3482, 30078.67, 263.3270, 0.554026, 10.560246, 73683.28, 884543.74, 14.651672),
    (19, 150.6984, 32239.24, 123.2066, 0.259220, 10.819466, 29272.50, 913816.23, 15.136545),
    (20, 278.5841, 52010.42, 209.5719, 0.440928, 11.260394, 42538.55, 956354.79, 15.841158),
    (21, 278.5841, 52010.42, 209.5719, 0.440928, 11.701322, 42538.55, 998893.34, 16.545770),
    (22, 366.8510, 64301.42, 312.2823, 0.657026, 12.358348, 54229.72, 1053123.06, 17.444037),
    (23, 253.3423, 42830.64, 229.3132, 0.482463, 12.840811, 36778.32, 1089901.39, 18.053237),
    (24, 150.3535, 27370.66, 171.5575, 0.360948, 13.201759, 27710.75, 1117612.13, 18.512241),
    (25, 350.8247, 63864.88, 400.3006, 0.842212, 14.043970, 64658.42, 1182270.55, 19.583249),
    (26, 336.3532, 62109.00, 382.5259, 0.804814, 14.848785, 62697.27, 1244967.81, 20.621773),
    (27, 296.8293, 38798.54, 327.8602, 0.689801, 15.538585, 38091.11, 1283058.92, 21.252718),
    (28, 538.3625, 65078.37, 544.1431, 1.144849, 16.683434, 59845.55, 1342904.47, 22.244006),
    (29, 150.4921, 20710.03, 151.0754, 0.317855, 17.001289, 17079.91, 1359984.38, 22.526919),
    (30, 273.6316, 33335.77, 250.7149, 0.527491, 17.528780, 24793.32, 1384777.70, 22.937598),
    (31, 273.6316, 33335.77, 250.7149, 0.527491, 18.056271, 24793.32, 1409571.02, 23.348277),
    (32, 483.1139, 60223.92, 479.3372, 1.008500, 19.064771, 49408.51, 1458979.53, 24.166685),
    (33, 416.8045, 51719.53, 421.5464, 0.886912, 19.951683, 43858.35, 1502837.87, 24.893159),
    (34, 416.8045, 55808.24, 421.5464, 0.886912, 20.838595, 47947.06, 1550784.93, 25.687359),
    (35, 371.8245, 50524.83, 359.4750, 0.756317, 21.594911, 41753.69, 1592538.62, 26.378971),
    (36, 503.3655, 65380.60, 533.0539, 1.121517, 22.716429, 59230.96, 1651769.58, 27.360079),
    (37, 244.9222, 31355.78, 267.1261, 0.562019, 23.278448, 29302.78, 1681072.36, 27.845453),
    (38, 66.4853, 8721.22, 77.2178, 0.162462, 23.440910, 8866.42, 1689938.78, 27.992317),
    (39, 259.2165, 36858.57, 237.4926, 0.499672, 23.940582, 28231.74, 1718170.52, 28.459951),
    (40, 255.7026, 36434.34, 233.9787, 0.492279, 24.432861, 27807.51, 1745978.03, 28.920557),
    (41, 324.3126, 45416.88, 309.7187, 0.651632, 25.084493, 35955.95, 1781933.98, 29.516135),
    (42, 319.8647, 43989.60, 318.6076, 0.670334, 25.754827, 36159.38, 1818093.35, 30.115082),
    (43, 121.3153, 16637.31, 121.9581, 0.256594, 26.011420, 14018.30, 1832111.65, 30.347283),
    (44, 424.6037, 58230.58, 426.8537, 0.898078, 26.909498, 49064.05, 1881175.70, 31.159985),
    (45, 420.2660, 57662.63, 421.0310, 0.885827, 27.795325, 48437.61, 1929613.31, 31.962310),
    (46, 363.8768, 50279.25, 345.3375, 0.726572, 28.521897, 40293.85, 1969907.16, 32.629742),
    (47, 641.0856, 83639.48, 704.5335, 1.482302, 30.004199, 77444.15, 2047351.31, 33.912534),
    (48, 135.8556, 18153.24, 140.4023, 0.295399, 30.299598, 16614.64, 2063965.95, 34.187741),
    (49, 225.4863, 31279.71, 214.6907, 0.451698, 30.751296, 25592.88, 2089558.82, 34.611664),
    (50, 225.4863, 31279.71, 214.6907, 0.451698, 31.202994, 25592.88, 2115151.70, 35.035587),
    (51, 311.1889, 42470.93, 309.3213, 0.650796, 31.853790, 35591.38, 2150743.08, 35.625126),
    (52, 153.7720, 20866.40, 155.0973, 0.326317, 32.180106, 17634.04, 2168377.13, 35.917218),
    (53, 224.7648, 29142.78, 221.9089, 0.466885, 32.646991, 24881.38, 2193258.50, 36.329356),
    (54, 393.3384, 50999.87, 388.3406, 0.817048, 33.464039, 43542.41, 2236800.92, 37.050597),
    (55, 368.7924, 47857.24, 358.6225, 0.754523, 34.218562, 40213.14, 2277014.05, 37.716691),
    (56, 381.6364, 49011.73, 378.3667, 0.796064, 35.014626, 41979.31, 2318993.36, 38.412041),
    (57, 426.9385, 53700.69, 465.8185, 0.980058, 35.994684, 50109.71, 2369103.07, 39.242063),
    (58, 273.4041, 33620.82, 277.9171, 0.584723, 36.579407, 30767.76, 2399870.83, 39.751703),
    (59, 364.9101, 42959.30, 356.7301, 0.750541, 37.329948, 37519.32, 2437390.15, 40.373177),
    (60, 436.2676, 49389.84, 428.0876, 0.900674, 38.230622, 43949.86, 2481340.01, 41.101167),
    (61, 555.8996, 62944.86, 560.1174, 1.178458, 39.409080, 55995.43, 2537335.44, 42.028681),
    (62, 176.0895, 19888.20, 178.0646, 0.374639, 39.783718, 17808.90, 2555144.34, 42.323670),
    (63, 433.9959, 48747.96, 430.7361, 0.906246, 40.689964, 43028.82, 2598173.15, 43.036403),
    (64, 598.4670, 67235.25, 593.9032, 1.249541, 41.939506, 59228.45, 2657401.61, 44.017469),
    (65, 587.7150, 65577.43, 573.1957, 1.205974, 43.145479, 57194.48, 2714596.09, 44.964845),
    (66, 619.3952, 68484.98, 626.5975, 1.318328, 44.463808, 61937.14, 2776533.23, 45.990778),
    (67, 382.9541, 42175.92, 403.7488, 0.849466, 45.313274, 39644.13, 2816177.36, 46.647447),
    (68, 158.9552, 15545.53, 166.1100, 0.349487, 45.662761, 15904.03, 2832081.39, 46.910883),
    (69, 520.0400, 52133.13, 506.2890, 1.065205, 46.727966, 46758.98, 2878840.38, 47.685404),
    (70, 621.5151, 55828.13, 603.4147, 1.269553, 47.997519, 49566.74, 2928407.12, 48.506432),
    (71, 577.8838, 52333.01, 561.4005, 1.181157, 49.178677, 45894.72, 2974301.84, 49.266637),
    (72, 700.9080, 67791.43, 697.9005, 1.468346, 50.647023, 59878.95, 3034180.79, 50.258478),
    (73, 783.2505, 76448.69, 790.6179, 1.663419, 52.310441, 69978.59, 3104159.39, 51.417610),
    (74, 810.3771, 85861.89, 817.7445, 1.720491, 54.030933, 79391.79, 3183551.18, 52.732664),
    (75, 779.1571, 82401.16, 771.7378, 1.623696, 55.654629, 75190.15, 3258741.33, 53.978121),
    (76, 831.1059, 82094.75, 857.5806, 1.804305, 57.458933, 77395.17, 3336136.50, 55.260103),
    (77, 241.9394, 23486.11, 252.3367, 0.530903, 57.989837, 22348.69, 3358485.19, 55.630289))
  select count(*) into v_n from t join public.curva_s_semanal_planejada c on c.obra_id = 'sirius60' and c.semana_numero = t.semana
   and abs(c.hh_semanal - t.hh_hoje) < 0.0001 and abs(c.valor_semanal - t.valor_hoje) < 0.01;
  if v_n <> 75 then raise exception 'só % das 75 semanas da curva estão como hoje: nada foi gravado', v_n; end if;
  select count(*), count(*) filter (where origem = 'correcao') into v_n, v_hn from public.avanco_fisico_historico where obra_id = 'sirius60';
  if v_n <> 26 or v_hn <> 9 then
    raise exception 'avanco_fisico_historico com % linhas e % correções (esperado 26 e 9): nada foi gravado', v_n, v_hn;
  end if;
  with m(id, codigo, semana, data, p) as (values
    (18, '2.1.2', 3, '2026-08-23', 9.2436),
    (19, '2.1.2', 4, '2026-08-30', 46.2181),
    (26, '2.1.2', 9, '2026-09-30', 55.4617),
    (20, '2.1.6', 4, '2026-08-30', 7.0593),
    (24, '2.1.6', 6, '2026-09-13', 11.2949),
    (25, '2.1.6', 9, '2026-09-30', 14.1186),
    (21, '2.1.7', 4, '2026-08-30', 24.9079),
    (23, '2.1.7', 6, '2026-09-13', 34.871),
    (22, '2.1.8', 4, '2026-08-30', 36.7629))
  select count(*) into v_n from public.avanco_fisico_historico a join m using (id)
   where a.obra_id = 'sirius60' and a.codigo_eap = m.codigo and a.pavimento = 'Fundação' and a.excluido_em is null
     and a.percentual_realizado = m.p and a.semana_numero = m.semana and a.data_lancamento = m.data::date
     and not exists (select 1 from public.avanco_fisico_historico c where c.origem = 'correcao' and a.id = any(c.origem_ids));
  if v_n <> 9 then raise exception 'só % das 9 medições que valem hoje estão como esperado: nada foi gravado', v_n; end if;
  select round(sum(valor_total), 2) into v_v from public.custos_indiretos_planejados where obra_id = 'sirius60';
  if v_v <> 2874508.08 then raise exception 'indireto R$ % (esperado 2874508.08): nada foi gravado', v_v; end if;
  -- custos e contas a pagar por linha (id): guardados para comparar no fim
  select count(*), coalesce(round(sum(valor), 2), 0) into v_cn, v_cs from public.custos_lancamentos where obra_id = 'sirius60';
  select coalesce(round(sum(o.id * c.valor), 2), 0) into v_ck from public.orcamento_planejado o join public.custos_lancamentos c
    on c.obra_id = o.obra_id and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento where o.obra_id = 'sirius60';
  select count(*), coalesce(round(sum(valor), 2), 0) into v_an, v_as from public.contas_a_pagar where obra_id = 'sirius60';
  select coalesce(round(sum(o.id * c.valor), 2), 0) into v_ak from public.orcamento_planejado o join public.contas_a_pagar c
    on c.obra_id = o.obra_id and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento where o.obra_id = 'sirius60';

  -- ===== BACKUP (tabelas de verdade, RLS, sem permissão para anon/authenticated) =====
  create table public.orcamento_p20_bkp_20261014 as select * from public.orcamento_planejado where obra_id = 'sirius60' and id in (667, 668, 669, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687, 688, 689, 690, 691, 692, 693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 727, 728, 729, 730, 731, 732, 733, 734, 735, 736, 737, 738, 739, 740, 741, 742, 743, 744, 745, 746, 992);
  create table public.curva_p20_bkp_20261014 as select * from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  create table public.avanco_p20_bkp_20261014 as select * from public.avanco_fisico_historico where obra_id = 'sirius60';
  create table public.janela_p20_bkp_20261014 as select * from public.orcamento_horas_janela where obra_id = 'sirius60';
  create table public.vinculo_p20_bkp_20261014 as select * from public.orcamento_material_servico where obra_id = 'sirius60';
  create table public.indice_p20_bkp_20261014 as select * from public.indice_produtividade where obra_id = 'sirius60' and orcamento_id in (667, 668, 669, 670, 671, 672, 673, 674, 675, 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687, 688, 689, 690, 691, 692, 693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 727, 728, 729, 730, 731, 732, 733, 734, 735, 736, 737, 738, 739, 740, 741, 742, 743, 744, 745, 746, 992);
  alter table public.orcamento_p20_bkp_20261014 enable row level security;
  alter table public.curva_p20_bkp_20261014 enable row level security;
  alter table public.avanco_p20_bkp_20261014 enable row level security;
  alter table public.janela_p20_bkp_20261014 enable row level security;
  alter table public.vinculo_p20_bkp_20261014 enable row level security;
  alter table public.indice_p20_bkp_20261014 enable row level security;
  revoke all on public.orcamento_p20_bkp_20261014 from anon, authenticated;
  revoke all on public.curva_p20_bkp_20261014 from anon, authenticated;
  revoke all on public.avanco_p20_bkp_20261014 from anon, authenticated;
  revoke all on public.janela_p20_bkp_20261014 from anon, authenticated;
  revoke all on public.vinculo_p20_bkp_20261014 from anon, authenticated;
  revoke all on public.indice_p20_bkp_20261014 from anon, authenticated;

  -- ===== SAEM: escada da fundação (2.1.10 a 2.1.13) e 3.0.1, com o que depende delas =====
  delete from public.indice_produtividade where obra_id = 'sirius60' and orcamento_id in (676, 992);
  delete from public.orcamento_material_servico where obra_id = 'sirius60' and material_id in (677, 678, 679);
  delete from public.orcamento_horas_janela where obra_id = 'sirius60' and origem = '3.0.1';
  delete from public.orcamento_planejado where obra_id = 'sirius60' and id in (676, 677, 678, 679, 992);

  -- ===== ORÇAMENTO: linhas que ficam (por id) =====
  with x(id, codigo, pavimento, descricao, quantidade, unidade, preco_unitario, preco_total, hh, semana_inicio, semana_fim, grupo_num, grupo_nome) as (values
    (667, '2.1.1', 'Fundação', 'Escavação Mecanizada - Terraplanagem', 1.0, 'vb', 51750.0, 51750.0, 44.0, 1, 4, 2, 'Fundações'),
    (668, '2.1.2', 'Fundação', 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)', 343.2, 'm³', 250.0, 85800.0, 1372.8, 3, 13, 2, 'Fundações'),
    (669, '2.1.3', 'Fundação', 'Material Forma - (Apenas Material) - (Vigas baldrame inferiores)', 198.72, 'm²', 37.0, 7352.64, 38.2, 4, 15, 2, 'Fundações'),
    (670, '2.1.4', 'Fundação', 'Aço Tubulões, Blocos e Vigas Baldrame Inferiores - (Apenas Material)', 16394.38, 'kg', 6.92, 113449.1, 589.5, 4, 15, 2, 'Fundações'),
    (671, '2.1.5', 'Fundação', 'Concreto Bombeado fck 25 MPa (Tubulões, Blocos e Vigas Baldrame) - (Material)', 362.21, 'm³', 660.0, 239061.64, 674.7, 6, 16, 2, 'Fundações'),
    (672, '2.1.6', 'Fundação', 'Montagem Forma - (Vigas Baldrame Inferiores) - (Mão de Obra)', 198.72, 'm²', 75.0, 14904.0, 62.0, 4, 15, 2, 'Fundações'),
    (673, '2.1.7', 'Fundação', 'Armação Aço - Tubulões, Blocos e Vigas Baldrame - (Mão de Obra)', 16394.38, 'kg', 3.0, 49183.13, 255.5, 4, 15, 2, 'Fundações'),
    (674, '2.1.8', 'Fundação', 'Concretagem 25 MPa - (Tubulões, Blocos e Vigas Baldrame) - (Mão de Obra)', 6.0, 'diária', 1200.0, 7200.0, 20.3, 6, 16, 2, 'Fundações'),
    (675, '3.1.7', 'Pilotis', 'Concretagem Piso - (Material e MO)', 220.5, 'm²', 153.24, 33789.42, 304.1, 10, 15, 3, 'Estrutura'),
    (680, '2.1.14', 'Fundação', 'Impermeabilização baldrame com emulsão asfáltica (2 demãos) - (Material e MO)', 198.72, 'm²', 22.27, 4425.49, 107.3, 11, 22, 2, 'Fundações'),
    (681, '3.2.1', 'Subsolo', 'Aço CA-50 - (Apenas Material)', 6128.6, 'kg', 6.92, 42409.88, 384.3, 19, 26, 3, 'Estrutura'),
    (682, '3.2.2', 'Subsolo', 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)', 6128.6, 'kg', 3.0, 18385.79, 166.7, 19, 26, 3, 'Estrutura'),
    (683, '3.2.3', 'Subsolo', 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)', 113.36, 'm³', 660.0, 74814.3, 678.0, 22, 28, 3, 'Estrutura'),
    (684, '3.2.4', 'Subsolo', 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)', 6.0, 'diária', 1200.0, 7200.0, 65.3, 22, 28, 3, 'Estrutura'),
    (685, '3.2.5', 'Subsolo', 'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Vigas e Pilares) - (Mão de Obra)', 834.45, 'm²', 75.0, 62583.86, 453.7, 19, 27, 3, 'Estrutura'),
    (686, '3.2.6', 'Subsolo', 'Material p/ Forma (Apenas Material)', 834.45, 'm²', 37.0, 30874.71, 279.8, 19, 27, 3, 'Estrutura'),
    (687, '3.2.7', 'Subsolo', 'Piso Polido (Mão de Obra)', 500.0, 'm²', 25.0, 12500.0, 95.9, 15, 18, 3, 'Estrutura'),
    (688, '3.2.8', 'Subsolo', 'Execução Escadas - (Mão de Obra)', 3.0, 'diária', 1500.0, 4500.0, 40.8, 27, 28, 3, 'Estrutura'),
    (689, '3.2.9', 'Subsolo', 'Material Forma - Escada - (Apenas Material)', 13.44, 'm²', 37.0, 497.28, 4.5, 27, 28, 3, 'Estrutura'),
    (690, '3.2.10', 'Subsolo', 'Aço Escada - (Apenas Material)', 98.99, 'kg', 6.92, 685.01, 6.2, 27, 28, 3, 'Estrutura'),
    (691, '3.2.11', 'Subsolo', 'Concreto - Escada - (Apenas Material)', 4.44, 'm³', 660.0, 2927.23, 26.5, 27, 28, 3, 'Estrutura'),
    (692, '3.1.8', 'Pilotis', 'Execução Laje Treliçada (Mão de Obra + Material)', 284.03, 'm²', 120.0, 34083.0, 137.3, 15, 18, 3, 'Estrutura'),
    (693, '3.3.1', 'Térreo', 'Aço CA-50 - (Apenas Material)', 5696.6, 'kg', 6.92, 39420.49, 366.1, 29, 35, 3, 'Estrutura'),
    (694, '3.3.2', 'Térreo', 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)', 5696.6, 'kg', 3.0, 17089.81, 158.7, 29, 35, 3, 'Estrutura'),
    (695, '3.3.3', 'Térreo', 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)', 113.41, 'm³', 660.0, 74850.6, 695.2, 32, 37, 3, 'Estrutura'),
    (696, '3.3.4', 'Térreo', 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)', 6.0, 'diária', 1200.0, 7200.0, 66.9, 32, 37, 3, 'Estrutura'),
    (697, '3.3.5', 'Térreo', 'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Vigas e Pilares) - (Mão de Obra)', 864.33, 'm²', 75.0, 64824.64, 481.6, 29, 36, 3, 'Estrutura'),
    (698, '3.3.6', 'Térreo', 'Material p/ Forma (Apenas Material)', 864.33, 'm²', 37.0, 31980.15, 297.1, 29, 36, 3, 'Estrutura'),
    (699, '3.3.7', 'Térreo', 'Piso Polido (Mão de Obra)', 313.5, 'm²', 25.0, 7837.5, 60.1, 15, 18, 3, 'Estrutura'),
    (700, '3.3.8', 'Térreo', 'Execução Escadas - (Mão de Obra)', 3.0, 'diária', 1500.0, 4500.0, 41.8, 36, 37, 3, 'Estrutura'),
    (701, '3.3.9', 'Térreo', 'Material Forma - Escada - (Apenas Material)', 13.44, 'm²', 37.0, 497.28, 4.6, 36, 37, 3, 'Estrutura'),
    (702, '3.3.10', 'Térreo', 'Aço Escada - (Apenas Material)', 98.99, 'kg', 6.92, 685.01, 6.3, 36, 37, 3, 'Estrutura'),
    (703, '3.3.11', 'Térreo', 'Concreto - Escada - (Apenas Material)', 4.44, 'm³', 660.0, 2927.23, 27.1, 36, 37, 3, 'Estrutura'),
    (704, '3.3.12', 'Térreo', 'Execução Laje Treliçada (Mão de Obra + Material)', 512.93, 'm²', 115.0, 58986.38, 547.9, 33, 36, 3, 'Estrutura'),
    (705, '3.4.1', '1º Pav', 'Aço CA-50 - (Apenas Material)', 5872.9, 'kg', 6.92, 40640.47, 377.7, 38, 45, 3, 'Estrutura'),
    (706, '3.4.2', '1º Pav', 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)', 5872.9, 'kg', 3.0, 17618.7, 163.8, 38, 45, 3, 'Estrutura'),
    (707, '3.4.3', '1º Pav', 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)', 112.55, 'm³', 660.0, 74284.32, 690.5, 41, 47, 3, 'Estrutura'),
    (708, '3.4.4', '1º Pav', 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)', 6.0, 'diária', 1200.0, 7200.0, 66.9, 41, 47, 3, 'Estrutura'),
    (709, '3.4.5', '1º Pav', 'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Vigas, Pilares e Laje Maciça) - (Mão de Obra)', 843.38, 'm²', 75.0, 63253.16, 470.4, 38, 47, 3, 'Estrutura'),
    (710, '3.4.6', '1º Pav', 'Material p/ Forma (Apenas Material)', 843.38, 'm²', 37.0, 31204.89, 290.0, 38, 47, 3, 'Estrutura'),
    (711, '3.4.7', '1º Pav', 'Execução Escadas - (Mão de Obra)', 3.0, 'diária', 1500.0, 4500.0, 41.9, 47, 47, 3, 'Estrutura'),
    (712, '3.4.8', '1º Pav', 'Material Forma - Escada - (Apenas Material)', 13.44, 'm²', 37.0, 497.28, 4.6, 47, 47, 3, 'Estrutura'),
    (713, '3.4.9', '1º Pav', 'Aço Escada - (Apenas Material)', 98.99, 'kg', 6.92, 685.01, 6.3, 47, 47, 3, 'Estrutura'),
    (714, '3.4.10', '1º Pav', 'Concreto - Escada - (Apenas Material)', 4.44, 'm³', 660.0, 2927.23, 27.2, 47, 47, 3, 'Estrutura'),
    (715, '3.4.11', '1º Pav', 'Execução Laje Treliçada (Mão de Obra + Material)', 514.5, 'm²', 115.0, 59167.5, 550.0, 43, 47, 3, 'Estrutura'),
    (716, '3.5.1', '2º Pav', 'Aço CA-50 - (Apenas Material)', 3883.17, 'kg', 6.92, 26871.5, 254.3, 48, 55, 3, 'Estrutura'),
    (717, '3.5.2', '2º Pav', 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)', 3883.17, 'kg', 3.0, 11649.5, 110.3, 48, 55, 3, 'Estrutura'),
    (718, '3.5.3', '2º Pav', 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)', 73.25, 'm³', 660.0, 48347.24, 457.6, 51, 57, 3, 'Estrutura'),
    (719, '3.5.4', '2º Pav', 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)', 6.0, 'diária', 1200.0, 7200.0, 68.1, 51, 57, 3, 'Estrutura'),
    (720, '3.5.6', '2º Pav', 'Material p/ Forma (Apenas Material)', 617.75, 'm²', 37.0, 22856.58, 216.3, 48, 56, 3, 'Estrutura'),
    (721, '3.5.5', '2º Pav', 'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Vigas, Pilares e Laje Maciça) - (Mão de Obra)', 617.75, 'm²', 75.0, 46330.91, 350.7, 48, 56, 3, 'Estrutura'),
    (722, '3.5.7', '2º Pav', 'Execução Escadas - (Mão de Obra)', 3.0, 'diária', 1500.0, 4500.0, 42.6, 56, 57, 3, 'Estrutura'),
    (723, '3.5.8', '2º Pav', 'Material Forma - Escada - (Apenas Material)', 13.44, 'm²', 37.0, 497.28, 4.7, 56, 57, 3, 'Estrutura'),
    (724, '3.5.9', '2º Pav', 'Aço Escada - (Apenas Material)', 98.99, 'kg', 6.92, 685.01, 6.4, 56, 57, 3, 'Estrutura'),
    (725, '3.5.10', '2º Pav', 'Concreto - Escada - (Apenas Material)', 4.44, 'm³', 660.0, 2927.23, 27.7, 56, 57, 3, 'Estrutura'),
    (726, '3.5.11', '2º Pav', 'Execução Laje Treliçada (Mão de Obra + Material)', 326.55, 'm²', 115.0, 37553.25, 355.4, 53, 56, 3, 'Estrutura'),
    (727, '3.6.1', '3º Pav', 'Aço CA-50 - (Apenas Material)', 4078.8, 'kg', 6.92, 28225.3, 277.9, 58, 65, 3, 'Estrutura'),
    (728, '3.6.2', '3º Pav', 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)', 4078.8, 'kg', 3.0, 12236.4, 120.5, 58, 65, 3, 'Estrutura'),
    (729, '3.6.3', '3º Pav', 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)', 74.38, 'm³', 660.0, 49092.12, 483.4, 61, 67, 3, 'Estrutura'),
    (730, '3.6.4', '3º Pav', 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)', 6.0, 'diária', 1200.0, 7200.0, 70.9, 61, 67, 3, 'Estrutura'),
    (731, '3.6.5', '3º Pav', 'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Vigas, Pilares e Laje Maciça) - (Mão de Obra)', 632.79, 'm²', 75.0, 47459.06, 373.9, 58, 66, 3, 'Estrutura'),
    (732, '3.6.6', '3º Pav', 'Material p/ Forma (Apenas Material)', 632.79, 'm²', 37.0, 23413.14, 230.6, 58, 66, 3, 'Estrutura'),
    (733, '3.6.7', '3º Pav', 'Execução Laje Treliçada (Mão de Obra + Material)', 327.6, 'm²', 115.0, 37674.0, 371.0, 63, 66, 3, 'Estrutura'),
    (734, '3.7.1', 'Terraço', 'Aço CA-50 - (Apenas Material)', 3724.09, 'kg', 6.92, 25770.73, 251.7, 68, 75, 3, 'Estrutura'),
    (735, '3.7.2', 'Terraço', 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)', 3724.09, 'kg', 3.0, 11172.28, 109.0, 68, 75, 3, 'Estrutura'),
    (736, '3.7.3', 'Terraço', 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)', 76.67, 'm³', 660.0, 50601.47, 493.9, 71, 77, 3, 'Estrutura'),
    (737, '3.7.4', 'Terraço', 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)', 6.0, 'diária', 1200.0, 7200.0, 70.3, 71, 77, 3, 'Estrutura'),
    (738, '3.7.5', 'Terraço', 'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Vigas e Pilares) - (Mão de Obra)', 580.45, 'm²', 75.0, 43533.83, 340.1, 69, 76, 3, 'Estrutura'),
    (739, '3.7.6', 'Terraço', 'Material p/ Forma (Apenas Material)', 580.45, 'm²', 37.0, 21476.69, 209.7, 69, 76, 3, 'Estrutura'),
    (740, '3.7.7', 'Terraço', 'Execução Laje Treliçada (Mão de Obra + Material)', 403.61, 'm²', 115.0, 46415.09, 453.2, 73, 76, 3, 'Estrutura'),
    (741, '3.8.1', 'Reservatório', 'Aço CA-50 - (Apenas Material)', 2241.89, 'kg', 6.92, 15513.86, 163.8, 78, 81, 3, 'Estrutura'),
    (742, '3.8.2', 'Reservatório', 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)', 2241.89, 'kg', 3.0, 6725.66, 71.0, 78, 81, 3, 'Estrutura'),
    (743, '3.8.3', 'Reservatório', 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)', 42.57, 'm³', 660.0, 28096.2, 296.6, 79, 82, 3, 'Estrutura'),
    (744, '3.8.4', 'Reservatório', 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)', 42.57, 'm³', 12.27, 522.33, 5.5, 79, 82, 3, 'Estrutura'),
    (745, '3.8.5', 'Reservatório', 'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Viga,Pilares e Laje Maciça) - (Mão de Obra)', 531.22, 'm²', 75.0, 39841.46, 336.5, 78, 82, 3, 'Estrutura'),
    (746, '3.8.6', 'Reservatório', 'Material p/ Forma (Apenas Material)', 531.22, 'm²', 20.44, 10858.13, 114.6, 78, 82, 3, 'Estrutura'))
  update public.orcamento_planejado o
     set codigo_eap = x.codigo, pavimento = x.pavimento, descricao = x.descricao, quantidade = x.quantidade, unidade = x.unidade,
         preco_unitario = x.preco_unitario, preco_total = x.preco_total, hh = x.hh, semana_inicio = x.semana_inicio,
         semana_fim = x.semana_fim, grupo_num = x.grupo_num, grupo_nome = x.grupo_nome
    from x where o.obra_id = 'sirius60' and o.id = x.id;

  -- ===== ORÇAMENTO: linhas novas (ids fixos 1001 a 1011, usados pelo código da verba de forma) =====
  insert into public.orcamento_planejado (id, obra_id, codigo_eap, descricao, quantidade, unidade, preco_unitario, preco_total,
    semana_inicio, semana_fim, pavimento, grupo_num, grupo_nome, hh, custo_de_tempo, e_material) values
    (1001, 'sirius60', '3.1.1', 'Aço CA-50 - (Apenas Material)', 3836.48, 'kg', 6.92, 26548.45, 10, 16, 'Pilotis', 3, 'Estrutura', 0.0, false, true),
    (1002, 'sirius60', '3.1.2', 'Armação aço CA-50 incl. corte, dobra, montagem e perdas (Mão de Obra)', 3836.48, 'kg', 3.0, 11509.44, 10, 16, 'Pilotis', 3, 'Estrutura', 300.3, false, false),
    (1003, 'sirius60', '3.1.3', 'Concreto usinado fck 25 MPa estrutural, bombeado, slump 100±20 - (Material)', 64.92, 'm³', 660.0, 42848.52, 13, 18, 'Pilotis', 3, 'Estrutura', 0.0, false, true),
    (1004, 'sirius60', '3.1.4', 'Lançamento, adensamento e acabamento de concreto estrutural - (Mão de Obra)', 6.0, 'diária', 1200.0, 7200.0, 13, 18, 'Pilotis', 3, 'Estrutura', 164.4, false, false),
    (1005, 'sirius60', '3.1.5', 'Forma de chapa compensada plastificada 18 mm, 3 utilizações - (Vigas, Pilares e Laje Maciça) - (Mão de Obra)', 461.28, 'm²', 75.0, 34595.74, 10, 18, 'Pilotis', 3, 'Estrutura', 634.5, false, false),
    (1006, 'sirius60', '3.1.6', 'Material p/ Forma (Apenas Material)', 461.28, 'm²', 37.0, 17067.23, 10, 18, 'Pilotis', 3, 'Estrutura', 0.0, false, true),
    (1007, 'sirius60', '3.1.9', 'Execução Escadas - (Mão de Obra)', 3.0, 'diária', 1500.0, 4500.0, 18, 18, 'Pilotis', 3, 'Estrutura', 68.5, false, false),
    (1008, 'sirius60', '3.1.10', 'Material Forma - Escada - (Apenas Material)', 13.44, 'm²', 37.0, 497.28, 18, 18, 'Pilotis', 3, 'Estrutura', 0.0, false, true),
    (1009, 'sirius60', '3.1.11', 'Aço Escada - (Apenas Material)', 98.99, 'kg', 6.92, 685.01, 18, 18, 'Pilotis', 3, 'Estrutura', 0.0, false, true),
    (1010, 'sirius60', '3.1.12', 'Concreto - Escada - (Apenas Material)', 4.44, 'm³', 660.0, 2927.23, 18, 18, 'Pilotis', 3, 'Estrutura', 0.0, false, true),
    (1011, 'sirius60', '3.2.12', 'Execução Laje Treliçada (Mão de Obra + Material)', 536.55, 'm²', 120.0, 64386.0, 24, 27, 'Subsolo', 3, 'Estrutura', 583.5, false, false);
  v_seq := pg_get_serial_sequence('public.orcamento_planejado', 'id');
  if v_seq is not null then
    execute format('select last_value from %s', v_seq) into v_last;
    if v_last < 1011 then perform setval(v_seq, 1011); end if;
  end if;

  -- ===== VÍNCULO material → serviço =====
  insert into public.orcamento_material_servico (obra_id, material_id, material_codigo, material_pavimento, servico_id, servico_codigo,
    servico_pavimento, peso)
  select 'sirius60', v.m, '', '', v.s, '', '', 1 from (values
    (1001, 1002),
    (1003, 1004),
    (1006, 1005),
    (1008, 1007),
    (1009, 1007),
    (1010, 1007)) v(m, s);
  update public.orcamento_material_servico v
     set material_codigo = m.codigo_eap, material_pavimento = m.pavimento, servico_codigo = s.codigo_eap, servico_pavimento = s.pavimento
    from public.orcamento_planejado m, public.orcamento_planejado s
   where v.obra_id = 'sirius60' and m.obra_id = v.obra_id and s.obra_id = v.obra_id and m.id = v.material_id and s.id = v.servico_id;

  -- ===== ÍNDICES DE PRODUTIVIDADE =====
  with x(orcamento_id, codigo, pavimento, hh_por_unidade, hh_cronograma) as (values
    (667, '2.1.1', 'Fundação', 44.0, 44.0),
    (668, '2.1.2', 'Fundação', 4.0, 4.0),
    (672, '2.1.6', 'Fundação', null, 0.311997),
    (673, '2.1.7', 'Fundação', null, 0.015585),
    (674, '2.1.8', 'Fundação', null, 3.383333),
    (680, '2.1.14', 'Fundação', 0.539956, 0.539956),
    (675, '3.1.7', 'Pilotis', 1.379138, 1.379138),
    (692, '3.1.8', 'Pilotis', null, 0.4834),
    (682, '3.2.2', 'Subsolo', null, 0.0272),
    (684, '3.2.4', 'Subsolo', null, 10.883333),
    (685, '3.2.5', 'Subsolo', null, 0.543711),
    (687, '3.2.7', 'Subsolo', null, 0.1918),
    (688, '3.2.8', 'Subsolo', null, 13.6),
    (694, '3.3.2', 'Térreo', null, 0.027859),
    (696, '3.3.4', 'Térreo', null, 11.15),
    (697, '3.3.5', 'Térreo', null, 0.557195),
    (699, '3.3.7', 'Térreo', null, 0.191707),
    (700, '3.3.8', 'Térreo', null, 13.933333),
    (704, '3.3.12', 'Térreo', null, 1.068177),
    (706, '3.4.2', '1º Pav', null, 0.027891),
    (708, '3.4.4', '1º Pav', null, 11.15),
    (709, '3.4.5', '1º Pav', null, 0.557756),
    (711, '3.4.7', '1º Pav', null, 13.966667),
    (715, '3.4.11', '1º Pav', null, 1.068999),
    (717, '3.5.2', '2º Pav', null, 0.028405),
    (719, '3.5.4', '2º Pav', null, 11.35),
    (721, '3.5.5', '2º Pav', null, 0.567705),
    (722, '3.5.7', '2º Pav', null, 14.2),
    (726, '3.5.11', '2º Pav', null, 1.088348),
    (728, '3.6.2', '3º Pav', null, 0.029543),
    (730, '3.6.4', '3º Pav', null, 11.816667),
    (731, '3.6.5', '3º Pav', null, 0.590875),
    (733, '3.6.7', '3º Pav', null, 1.132479),
    (735, '3.7.2', 'Terraço', null, 0.029269),
    (737, '3.7.4', 'Terraço', null, 11.716667),
    (738, '3.7.5', 'Terraço', null, 0.585925),
    (740, '3.7.7', 'Terraço', null, 1.122866),
    (742, '3.8.2', 'Reservatório', null, 0.03167),
    (744, '3.8.4', 'Reservatório', null, 0.129199),
    (745, '3.8.5', 'Reservatório', null, 0.633448))
  update public.indice_produtividade i
     set codigo_eap = x.codigo, pavimento = x.pavimento, hh_por_unidade = coalesce(x.hh_por_unidade::numeric, i.hh_por_unidade),
         hh_cronograma = x.hh_cronograma::numeric, atualizado_em = now()
    from x where i.obra_id = 'sirius60' and i.orcamento_id = x.orcamento_id;
  insert into public.indice_produtividade (obra_id, orcamento_id, codigo_eap, pavimento, unidade, regra, hh_por_unidade, horas_total,
    origem, hh_cronograma, conferir, tipo_equipe, observacao) values
    ('sirius60', 1002, '3.1.2', 'Pilotis', 'kg', 'indice', 0.091429, null, 'rafael', 0.078275, false, 'armacao', 'Rafael 09/10: equipe de 2 × 8 h = 16 Hh/dia; armação 175 kg/dia, forma 9,96 m²/dia'),
    ('sirius60', 1004, '3.1.4', 'Pilotis', 'diaria', 'indice', 32.0, null, 'rafael', 27.4, false, 'concretagem', 'Rafael 09/10: 1 diária = 1 pedreiro + 3 ajudantes × 8 h = 32 Hh'),
    ('sirius60', 1005, '3.1.5', 'Pilotis', 'm²', 'indice', 1.606426, null, 'rafael', 1.37552, false, 'forma', 'Rafael 09/10: equipe de 2 × 8 h = 16 Hh/dia; armação 175 kg/dia, forma 9,96 m²/dia'),
    ('sirius60', 1007, '3.1.9', 'Pilotis', 'diaria', 'duracao', null, 80.0, 'rafael', 22.833333, false, 'escada', '5 dias úteis × 2 pessoas × 8 h (concretagem 1 dia)'),
    ('sirius60', 1011, '3.2.12', 'Subsolo', 'm²', 'indice', 0.5644, null, 'rafael', 1.087503, false, 'laje_trelicada', 'Rafael 09/10: 2 oficiais + 2 ajudantes, 283,5 m² em 5 dias = 160 Hh');

  -- ===== CURVA PLANEJADA =====
  with t(semana, hh_hoje, valor_hoje, hh_semanal, perc_hh_semanal, perc_hh_acum, valor_semanal, valor_acum, perc_valor_acum) as (values
    (3, 168.4130, 22650.97, 149.9540, 0.315495, 0.512135, 21497.11, 59320.67, 0.982594),
    (4, 311.3746, 47583.54, 274.6716, 0.577895, 1.090029, 43085.98, 102406.65, 1.696274),
    (5, 239.6684, 28995.94, 201.6226, 0.424203, 1.514233, 23196.25, 125602.91, 2.080499),
    (6, 357.6775, 62906.74, 287.8522, 0.605626, 2.119859, 47128.07, 172730.98, 2.861133),
    (7, 378.9679, 70837.13, 302.2048, 0.635823, 2.755682, 52600.54, 225331.52, 3.732414),
    (8, 378.9679, 70837.13, 302.2048, 0.635823, 3.391505, 52600.54, 277932.06, 4.603695),
    (9, 162.4148, 30358.77, 129.5163, 0.272496, 3.664000, 22543.09, 300475.15, 4.977101),
    (10, 330.5920, 44302.88, 231.3555, 0.486760, 4.150760, 35977.80, 336452.95, 5.573041),
    (11, 595.6793, 78236.98, 494.7853, 1.041002, 5.191762, 70101.35, 406554.31, 6.734207),
    (12, 615.4600, 79052.69, 499.9773, 1.051926, 6.243689, 70315.49, 476869.79, 7.898920),
    (13, 576.3678, 76609.39, 476.6710, 1.002891, 7.246579, 71553.18, 548422.97, 9.084134),
    (14, 393.5070, 59382.42, 348.6449, 0.733531, 7.980110, 64513.95, 612936.92, 10.152749),
    (15, 528.8789, 76799.74, 462.0699, 0.972171, 8.952281, 80104.50, 693041.42, 11.479608),
    (16, 387.0190, 71362.93, 305.6960, 0.643168, 9.595449, 74638.70, 767680.12, 12.715931),
    (17, 241.8047, 26318.84, 195.2379, 0.410770, 10.006219, 43180.33, 810860.45, 13.431175),
    (18, 276.3482, 30078.67, 263.3270, 0.554026, 10.560246, 73683.28, 884543.74, 14.651672),
    (19, 150.6984, 32239.24, 123.2066, 0.259220, 10.819466, 29272.50, 913816.23, 15.136545),
    (20, 278.5841, 52010.42, 209.5719, 0.440928, 11.260394, 42538.55, 956354.79, 15.841158),
    (21, 278.5841, 52010.42, 209.5719, 0.440928, 11.701322, 42538.55, 998893.34, 16.545770),
    (22, 366.8510, 64301.42, 312.2823, 0.657026, 12.358348, 54229.72, 1053123.06, 17.444037),
    (23, 253.3423, 42830.64, 229.3132, 0.482463, 12.840811, 36778.32, 1089901.39, 18.053237),
    (24, 150.3535, 27370.66, 171.5575, 0.360948, 13.201759, 27710.75, 1117612.13, 18.512241),
    (25, 350.8247, 63864.88, 400.3006, 0.842212, 14.043970, 64658.42, 1182270.55, 19.583249),
    (26, 336.3532, 62109.00, 382.5259, 0.804814, 14.848785, 62697.27, 1244967.81, 20.621773),
    (27, 296.8293, 38798.54, 327.8602, 0.689801, 15.538585, 38091.11, 1283058.92, 21.252718),
    (28, 538.3625, 65078.37, 544.1431, 1.144849, 16.683434, 59845.55, 1342904.47, 22.244006),
    (29, 150.4921, 20710.03, 151.0754, 0.317855, 17.001289, 17079.91, 1359984.38, 22.526919),
    (30, 273.6316, 33335.77, 250.7149, 0.527491, 17.528780, 24793.32, 1384777.70, 22.937598),
    (31, 273.6316, 33335.77, 250.7149, 0.527491, 18.056271, 24793.32, 1409571.02, 23.348277),
    (32, 483.1139, 60223.92, 479.3372, 1.008500, 19.064771, 49408.51, 1458979.53, 24.166685),
    (33, 416.8045, 51719.53, 421.5464, 0.886912, 19.951683, 43858.35, 1502837.87, 24.893159),
    (34, 416.8045, 55808.24, 421.5464, 0.886912, 20.838595, 47947.06, 1550784.93, 25.687359),
    (35, 371.8245, 50524.83, 359.4750, 0.756317, 21.594911, 41753.69, 1592538.62, 26.378971),
    (36, 503.3655, 65380.60, 533.0539, 1.121517, 22.716429, 59230.96, 1651769.58, 27.360079),
    (37, 244.9222, 31355.78, 267.1261, 0.562019, 23.278448, 29302.78, 1681072.36, 27.845453),
    (38, 66.4853, 8721.22, 77.2178, 0.162462, 23.440910, 8866.42, 1689938.78, 27.992317),
    (39, 259.2165, 36858.57, 237.4926, 0.499672, 23.940582, 28231.74, 1718170.52, 28.459951),
    (40, 255.7026, 36434.34, 233.9787, 0.492279, 24.432861, 27807.51, 1745978.03, 28.920557),
    (41, 324.3126, 45416.88, 309.7187, 0.651632, 25.084493, 35955.95, 1781933.98, 29.516135),
    (42, 319.8647, 43989.60, 318.6076, 0.670334, 25.754827, 36159.38, 1818093.35, 30.115082),
    (43, 121.3153, 16637.31, 121.9581, 0.256594, 26.011420, 14018.30, 1832111.65, 30.347283),
    (44, 424.6037, 58230.58, 426.8537, 0.898078, 26.909498, 49064.05, 1881175.70, 31.159985),
    (45, 420.2660, 57662.63, 421.0310, 0.885827, 27.795325, 48437.61, 1929613.31, 31.962310),
    (46, 363.8768, 50279.25, 345.3375, 0.726572, 28.521897, 40293.85, 1969907.16, 32.629742),
    (47, 641.0856, 83639.48, 704.5335, 1.482302, 30.004199, 77444.15, 2047351.31, 33.912534),
    (48, 135.8556, 18153.24, 140.4023, 0.295399, 30.299598, 16614.64, 2063965.95, 34.187741),
    (49, 225.4863, 31279.71, 214.6907, 0.451698, 30.751296, 25592.88, 2089558.82, 34.611664),
    (50, 225.4863, 31279.71, 214.6907, 0.451698, 31.202994, 25592.88, 2115151.70, 35.035587),
    (51, 311.1889, 42470.93, 309.3213, 0.650796, 31.853790, 35591.38, 2150743.08, 35.625126),
    (52, 153.7720, 20866.40, 155.0973, 0.326317, 32.180106, 17634.04, 2168377.13, 35.917218),
    (53, 224.7648, 29142.78, 221.9089, 0.466885, 32.646991, 24881.38, 2193258.50, 36.329356),
    (54, 393.3384, 50999.87, 388.3406, 0.817048, 33.464039, 43542.41, 2236800.92, 37.050597),
    (55, 368.7924, 47857.24, 358.6225, 0.754523, 34.218562, 40213.14, 2277014.05, 37.716691),
    (56, 381.6364, 49011.73, 378.3667, 0.796064, 35.014626, 41979.31, 2318993.36, 38.412041),
    (57, 426.9385, 53700.69, 465.8185, 0.980058, 35.994684, 50109.71, 2369103.07, 39.242063),
    (58, 273.4041, 33620.82, 277.9171, 0.584723, 36.579407, 30767.76, 2399870.83, 39.751703),
    (59, 364.9101, 42959.30, 356.7301, 0.750541, 37.329948, 37519.32, 2437390.15, 40.373177),
    (60, 436.2676, 49389.84, 428.0876, 0.900674, 38.230622, 43949.86, 2481340.01, 41.101167),
    (61, 555.8996, 62944.86, 560.1174, 1.178458, 39.409080, 55995.43, 2537335.44, 42.028681),
    (62, 176.0895, 19888.20, 178.0646, 0.374639, 39.783718, 17808.90, 2555144.34, 42.323670),
    (63, 433.9959, 48747.96, 430.7361, 0.906246, 40.689964, 43028.82, 2598173.15, 43.036403),
    (64, 598.4670, 67235.25, 593.9032, 1.249541, 41.939506, 59228.45, 2657401.61, 44.017469),
    (65, 587.7150, 65577.43, 573.1957, 1.205974, 43.145479, 57194.48, 2714596.09, 44.964845),
    (66, 619.3952, 68484.98, 626.5975, 1.318328, 44.463808, 61937.14, 2776533.23, 45.990778),
    (67, 382.9541, 42175.92, 403.7488, 0.849466, 45.313274, 39644.13, 2816177.36, 46.647447),
    (68, 158.9552, 15545.53, 166.1100, 0.349487, 45.662761, 15904.03, 2832081.39, 46.910883),
    (69, 520.0400, 52133.13, 506.2890, 1.065205, 46.727966, 46758.98, 2878840.38, 47.685404),
    (70, 621.5151, 55828.13, 603.4147, 1.269553, 47.997519, 49566.74, 2928407.12, 48.506432),
    (71, 577.8838, 52333.01, 561.4005, 1.181157, 49.178677, 45894.72, 2974301.84, 49.266637),
    (72, 700.9080, 67791.43, 697.9005, 1.468346, 50.647023, 59878.95, 3034180.79, 50.258478),
    (73, 783.2505, 76448.69, 790.6179, 1.663419, 52.310441, 69978.59, 3104159.39, 51.417610),
    (74, 810.3771, 85861.89, 817.7445, 1.720491, 54.030933, 79391.79, 3183551.18, 52.732664),
    (75, 779.1571, 82401.16, 771.7378, 1.623696, 55.654629, 75190.15, 3258741.33, 53.978121),
    (76, 831.1059, 82094.75, 857.5806, 1.804305, 57.458933, 77395.17, 3336136.50, 55.260103),
    (77, 241.9394, 23486.11, 252.3367, 0.530903, 57.989837, 22348.69, 3358485.19, 55.630289))
  update public.curva_s_semanal_planejada c set hh_semanal = t.hh_semanal, valor_semanal = t.valor_semanal
    from t where c.obra_id = 'sirius60' and c.semana_numero = t.semana;
  -- % de todas as semanas pelos totais novos
  select sum(hh_semanal), sum(valor_semanal) into v_h, v_v from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  update public.curva_s_semanal_planejada c
     set perc_hh_semanal = round(100 * c.hh_semanal / v_h, 6),
         perc_hh_acum = round(100 * (select sum(y.hh_semanal) from public.curva_s_semanal_planejada y
                                      where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / v_h, 6),
         valor_acum = round((select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                             where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero), 2),
         perc_valor_acum = round(100 * (select sum(y.valor_semanal) from public.curva_s_semanal_planejada y
                                         where y.obra_id = c.obra_id and y.semana_numero <= c.semana_numero) / v_v, 6)
   where c.obra_id = 'sirius60';

  -- ===== MEDIÇÕES: correções (as antigas não mudam); em ordem, cada uma com id maior que a que ela corrige =====
  with m(id_antigo, codigo, semana, data, competencia, atividade, grupo, p, hh, obs) as (values
    (18, '2.1.2', 3, '2026-08-23', '2026-08', 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)', 2, 10.4914, 1372.8, 'correção da medição (pedido 20, orçamento com o Pilotis no grupo 3; levantamento do Rafael 14/10/2026): mantém a quantidade executada até 30/09 = 216,04 de 343,20 m³ = 62,9487% (era de 389,53); 9,2436% × 1,134994'),
    (19, '2.1.2', 4, '2026-08-30', '2026-08', 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)', 2, 52.4573, 1372.8, 'correção da medição (pedido 20, orçamento com o Pilotis no grupo 3; levantamento do Rafael 14/10/2026): mantém a quantidade executada até 30/09 = 216,04 de 343,20 m³ = 62,9487% (era de 389,53); 46,2181% × 1,134994'),
    (20, '2.1.6', 4, '2026-08-30', '2026-08', 'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)', 2, 24.4464, 62.0, 'correção da medição (pedido 20, orçamento com o Pilotis no grupo 3; levantamento do Rafael 14/10/2026): mantém a quantidade executada até 30/09 = 97,16 de 198,72 m² = 48,8929% (era de 688,17); 7,0593% × 3,463013'),
    (21, '2.1.7', 4, '2026-08-30', '2026-08', 'Armação Aço - Blocos e Tubulões - (Mão de Obra)', 2, 25.1875, 255.5, 'correção da medição (pedido 20, orçamento com o Pilotis no grupo 3; levantamento do Rafael 14/10/2026): mantém a quantidade executada até 30/09 = 5.781,07 de 16.394,38 kg = 35,2625% (era de 16.578,47); 24,9079% × 1,011227'),
    (22, '2.1.8', 4, '2026-08-30', '2026-08', 'Concretagem 25 MPa - (Bloco e tubulão e vigas) - (Mão de Obra)', 2, 53.7727, 20.3, 'correção da medição (pedido 20, orçamento com o Pilotis no grupo 3; levantamento do Rafael 14/10/2026): mantém a quantidade executada até 30/09 = 194,77 de 362,21 m³ = 53,7727% (era de 529,80); 36,7629% × 1,462689'),
    (23, '2.1.7', 6, '2026-09-13', '2026-09', 'Armação Aço - Blocos e Tubulões - (Mão de Obra)', 2, 35.2625, 255.5, 'correção da medição (pedido 20, orçamento com o Pilotis no grupo 3; levantamento do Rafael 14/10/2026): mantém a quantidade executada até 30/09 = 5.781,07 de 16.394,38 kg = 35,2625% (era de 16.578,47); 34,8710% × 1,011227'),
    (24, '2.1.6', 6, '2026-09-13', '2026-09', 'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)', 2, 39.1144, 62.0, 'correção da medição (pedido 20, orçamento com o Pilotis no grupo 3; levantamento do Rafael 14/10/2026): mantém a quantidade executada até 30/09 = 97,16 de 198,72 m² = 48,8929% (era de 688,17); 11,2949% × 3,463013'),
    (25, '2.1.6', 9, '2026-09-30', '2026-09', 'Montagem Forma - (Blocos- Vigas -Pilares) - (Mão de Obra)', 2, 48.8929, 62.0, 'correção da medição (pedido 20, orçamento com o Pilotis no grupo 3; levantamento do Rafael 14/10/2026): mantém a quantidade executada até 30/09 = 97,16 de 198,72 m² = 48,8929% (era de 688,17); 14,1186% × 3,463013'),
    (26, '2.1.2', 9, '2026-09-30', '2026-09', 'Escavação Manual - (Tubulão, blocos, vigas, etc) - (Mão de Obra)', 2, 62.9487, 1372.8, 'correção da medição (pedido 20, orçamento com o Pilotis no grupo 3; levantamento do Rafael 14/10/2026): mantém a quantidade executada até 30/09 = 216,04 de 343,20 m³ = 62,9487% (era de 389,53); 55,4617% × 1,134994'))
  insert into public.avanco_fisico_historico (obra_id, codigo_eap, pavimento, percentual_realizado, data_lancamento,
    semana_numero, competencia, atividade_nome, grupo_num, hh_planejado, hh_realizado, medido_por, observacao, origem, origem_ids)
  select 'sirius60', m.codigo, 'Fundação', m.p, m.data::date, m.semana, m.competencia, m.atividade, m.grupo, m.hh,
         round(m.hh * m.p / 100, 2), 'Rafael', m.obs, 'correcao', array[m.id_antigo]::bigint[]
    from m order by m.semana, m.data, m.id_antigo;

  -- ===== TRAVAS DEPOIS (se alguma falhar, nada do que está acima fica gravado) =====
  select count(*), round(sum(preco_total), 2), round(sum(hh), 1) into v_n, v_p, v_h from public.orcamento_planejado where obra_id = 'sirius60';
  if v_n <> 339 or v_p <> 6834476.17 or v_h <> 48585.8 then
    raise exception 'orçamento ficaria com % linhas, R$ % e % h (esperado 339, 6834476.17 e 48585.8): nada foi gravado', v_n, v_p, v_h;
  end if;
  select round(sum(hh), 1) into v_h from public.orcamento_planejado where obra_id = 'sirius60' and grupo_num <= 16 and codigo_eap <> '1.1.6';
  if v_h <> 47529.8 then
    raise exception 'base de horas ficaria % (esperado 47529.8 = 48637.6 − 52.6 da escada da fundação − 1055.2 da fundação pela quantidade): nada foi gravado', v_h;
  end if;
  select round(sum(preco_total), 2) into v_p from public.orcamento_planejado where obra_id = 'sirius60' and id in (669, 1006, 1008, 686, 689, 698, 701, 710, 712, 720, 723, 732, 739, 746);
  if v_p <> 199570.56 then raise exception 'verba de forma ficaria R$ % (esperado 199570.56): nada foi gravado', v_p; end if;
  if (select count(distinct material_id) from public.orcamento_material_servico where obra_id = 'sirius60'
        and material_id in (669, 1006, 1008, 686, 689, 698, 701, 710, 712, 720, 723, 732, 739, 746)) <> 14 then
    raise exception 'alguma linha da verba de forma ficaria sem vínculo com o serviço: nada foi gravado';
  end if;
  if (select count(*) from public.orcamento_material_servico where obra_id = 'sirius60') <> 56
     or exists (select 1 from public.orcamento_material_servico v where v.obra_id = 'sirius60' and not exists (
          select 1 from public.orcamento_planejado m where m.obra_id = v.obra_id and m.id = v.material_id and m.codigo_eap = v.material_codigo
             and m.pavimento = v.material_pavimento)) then
    raise exception 'vínculos ficariam diferentes do esperado (56) ou sem a linha certa: nada foi gravado';
  end if;
  if (select count(*) from public.indice_produtividade where obra_id = 'sirius60') <> 272
     or exists (select 1 from public.indice_produtividade i where i.obra_id = 'sirius60' and not exists (
          select 1 from public.orcamento_planejado o where o.obra_id = i.obra_id and o.id = i.orcamento_id and o.codigo_eap = i.codigo_eap
             and o.pavimento is not distinct from i.pavimento)) then
    raise exception 'índices ficariam diferentes do esperado (272) ou sem a linha certa: nada foi gravado';
  end if;
  if (select count(*) from public.orcamento_horas_janela where obra_id = 'sirius60') <> 13 then
    raise exception 'orcamento_horas_janela ficaria diferente do esperado (13): nada foi gravado';
  end if;
  select count(*), round(sum(hh_semanal), 1), round(sum(valor_semanal), 2) into v_n, v_h, v_v
    from public.curva_s_semanal_planejada where obra_id = 'sirius60';
  if v_n <> 117 or v_h <> 47529.7 or abs(v_v - 6037152.17) > 0.05 then
    raise exception 'curva ficaria com % semanas, % h e R$ % (esperado 117, 47529.7 e 6037152.17): nada foi gravado', v_n, v_h, v_v;
  end if;
  if abs((select perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 117) - 100) > 0.001
     or abs((select perc_valor_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 117) - 100) > 0.001 then
    raise exception 'curva não fecharia em 100%%: nada foi gravado';
  end if;
  if abs((select perc_hh_acum from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 9) - 3.664000) > 0.001 then
    raise exception 'planejado acumulado em S09 diferente da prévia (3.6640%%): nada foi gravado';
  end if;
  select count(*), count(*) filter (where origem = 'correcao') into v_n, v_hn from public.avanco_fisico_historico where obra_id = 'sirius60';
  if v_n <> 35 or v_n - v_hn <> 17 then
    raise exception 'avanco_fisico_historico ficaria com % linhas (% correções): esperado 35, com as 17 medições que não são correção iguais: nada foi gravado', v_n, v_hn;
  end if;
  select count(*) into v_n from public.avanco_fisico_historico c join public.avanco_fisico_historico o on o.id = c.origem_ids[1]
   where c.obra_id = 'sirius60' and c.origem = 'correcao' and c.id > o.id and c.semana_numero = o.semana_numero
     and c.data_lancamento = o.data_lancamento and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento;
  if v_n <> 18 then raise exception 'só % das 18 correções ficariam depois da medição corrigida: nada foi gravado', v_n; end if;
  select count(*) into v_n from (
    select distinct on (codigo_eap) codigo_eap, percentual_realizado, origem from public.avanco_fisico_historico
     where obra_id = 'sirius60' and pavimento = 'Fundação' and excluido_em is null and semana_numero <= 9
       and codigo_eap in ('2.1.2', '2.1.6', '2.1.7', '2.1.8')
     order by codigo_eap, semana_numero desc, data_lancamento desc, id desc) u
   where origem = 'correcao' and percentual_realizado in (62.9487, 48.8929, 35.2625, 53.7727);
  if v_n <> 4 then raise exception 'só % das 4 linhas ficariam com o %% real em S09: nada foi gravado', v_n; end if;
  -- custos e contas a pagar: nada mudou e cada lançamento continua na mesma linha (id)
  if (select count(*) from public.custos_lancamentos where obra_id = 'sirius60') <> v_cn
     or (select coalesce(round(sum(valor), 2), 0) from public.custos_lancamentos where obra_id = 'sirius60') <> v_cs
     or (select coalesce(round(sum(o.id * c.valor), 2), 0) from public.orcamento_planejado o join public.custos_lancamentos c
           on c.obra_id = o.obra_id and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento where o.obra_id = 'sirius60') <> v_ck then
    raise exception 'custos lançados ficariam em outra linha: nada foi gravado';
  end if;
  if (select count(*) from public.contas_a_pagar where obra_id = 'sirius60') <> v_an
     or (select coalesce(round(sum(valor), 2), 0) from public.contas_a_pagar where obra_id = 'sirius60') <> v_as
     or (select coalesce(round(sum(o.id * c.valor), 2), 0) from public.orcamento_planejado o join public.contas_a_pagar c
           on c.obra_id = o.obra_id and c.codigo_eap = o.codigo_eap and c.pavimento = o.pavimento where o.obra_id = 'sirius60') <> v_ak then
    raise exception 'contas a pagar ficariam em outra linha: nada foi gravado';
  end if;

  raise notice 'passo 9 gravado: orçamento com o Pilotis no grupo 3, curva, vínculos, índices e 9 correções de medição';
end $$;

-- ===== CONFERÊNCIA (só leitura) =====
select 'orçamento' as item, count(*)::text as valor1, round(sum(preco_total), 2)::text as valor2, round(sum(hh), 1)::text as valor3
  from public.orcamento_planejado where obra_id = 'sirius60'
union all
select 'grupo ' || grupo_num, count(*)::text, round(sum(preco_total), 2)::text, round(sum(hh), 1)::text
  from public.orcamento_planejado where obra_id = 'sirius60' and grupo_num in (2, 3) group by grupo_num
union all
select 'curva S09 / S12 (% acum.)', (select perc_hh_acum::text from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 9),
       (select perc_hh_acum::text from public.curva_s_semanal_planejada where obra_id = 'sirius60' and semana_numero = 12), ''
union all
select 'medições (todas / correções)', count(*)::text, count(*) filter (where origem = 'correcao')::text, ''
  from public.avanco_fisico_historico where obra_id = 'sirius60';
