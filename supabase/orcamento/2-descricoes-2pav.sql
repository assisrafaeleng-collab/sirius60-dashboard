-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 2: descrições da forma no 2º Pav (3.4.5 × 3.4.6)
-- Rodar no SQL Editor DEPOIS do 1-orcamento-final.sql (arquivo inteiro). Desfazer: 2-descricoes-2pav-desfazer.sql
--
-- No 2º Pav as descrições estão trocadas em relação ao preço:
--   3.4.5 (id 720)  R$ 37/m² (preço de MATERIAL)  dizia "... - Apenas MO"
--   3.4.6 (id 721)  R$ 75/m² (preço de MO)        dizia "... - Apenas Material"
-- Este passo troca SÓ as descrições entre as duas linhas, como nos outros pavimentos (3.1.5 MO a R$ 75 / 3.1.6
-- Material a R$ 37...). Código, preço, quantidade, horas, semanas, medições e custos não mudam.
-- Obs.: a ordem dos códigos no 2º Pav continua invertida em relação aos outros pavimentos (lá o .5 é MO e o .6 é
-- Material; aqui o 3.4.5 fica Material e o 3.4.6 fica MO). Nenhuma medição nem custo usa 3.4.5 ou 3.4.6.
-- Trava: só troca se as duas linhas estiverem exatamente como em 08/10/2026 (texto e preço unitário).
-- =====================================================================
begin;

do $$
begin
  if (select count(*) from public.orcamento_planejado
       where obra_id = 'sirius60' and pavimento = '2º Pav' and (
             (id = 720 and codigo_eap = '3.4.5' and preco_unitario = 37
              and descricao = 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO')
          or (id = 721 and codigo_eap = '3.4.6' and preco_unitario = 75
              and descricao = 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material'))) <> 2 then
    raise exception '3.4.5/3.4.6 do 2º Pav não estão como esperado (já trocadas, ou o passo 1 não rodou): nada foi feito';
  end if;
end $$;

update public.orcamento_planejado
   set descricao = 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material'
 where id = 720 and obra_id = 'sirius60' and codigo_eap = '3.4.5' and pavimento = '2º Pav' and preco_unitario = 37;

update public.orcamento_planejado
   set descricao = 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO'
 where id = 721 and obra_id = 'sirius60' and codigo_eap = '3.4.6' and pavimento = '2º Pav' and preco_unitario = 75;

-- Trava final: as duas trocadas, e o orçamento com as mesmas 334 linhas e 7.551.387,47
do $$
declare
  n int; total numeric;
begin
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = 'sirius60';
  if n <> 334 or round(total, 2) <> 7551387.47 then
    raise exception 'orçamento mudou de total (% linhas, %): nada foi gravado', n, total;
  end if;
  if not exists (select 1 from public.orcamento_planejado where id = 720 and descricao like '% - Apenas Material')
     or not exists (select 1 from public.orcamento_planejado where id = 721 and descricao like '% - Apenas MO') then
    raise exception 'a troca das descrições não aconteceu: nada foi gravado';
  end if;
end $$;

commit;

-- Conferência: 3.4.5 (R$ 37) = Apenas Material; 3.4.6 (R$ 75) = Apenas MO
select id, codigo_eap, pavimento, preco_unitario, preco_total, descricao
  from public.orcamento_planejado where id in (720, 721) order by codigo_eap;
