-- =====================================================================
-- Sirius 60 — DESFAZER o passo 2 (2-descricoes-2pav.sql): devolve as descrições trocadas do 2º Pav
--   3.4.5 (id 720, R$ 37/m²) volta a dizer "... - Apenas MO"
--   3.4.6 (id 721, R$ 75/m²) volta a dizer "... - Apenas Material"
-- Só troca se as duas estiverem como o passo 2 deixou. Não mexe em preço, código, horas, semanas.
-- (O 1-orcamento-final-desfazer.sql também devolve estas descrições, porque volta tudo ao backup de 08/10.)
-- =====================================================================
begin;

do $$
begin
  if (select count(*) from public.orcamento_planejado
       where obra_id = 'sirius60' and pavimento = '2º Pav' and (
             (id = 720 and codigo_eap = '3.4.5'
              and descricao = 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material')
          or (id = 721 and codigo_eap = '3.4.6'
              and descricao = 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO'))) <> 2 then
    raise exception '3.4.5/3.4.6 não estão como o passo 2 deixou: nada foi feito';
  end if;
end $$;

update public.orcamento_planejado
   set descricao = 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas MO'
 where id = 720 and obra_id = 'sirius60' and codigo_eap = '3.4.5';

update public.orcamento_planejado
   set descricao = 'Forma de chapa compensada plastificada 18 mm, 4 utilizações - (Viga,Pilares e Laje Maçiça) - Apenas Material'
 where id = 721 and obra_id = 'sirius60' and codigo_eap = '3.4.6';

commit;

-- Conferência: 3.4.5 = Apenas MO; 3.4.6 = Apenas Material (como antes do passo 2)
select id, codigo_eap, pavimento, preco_unitario, preco_total, descricao
  from public.orcamento_planejado where id in (720, 721) order by codigo_eap;
