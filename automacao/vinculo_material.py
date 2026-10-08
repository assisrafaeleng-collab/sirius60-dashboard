"""
Vínculo material ↔ serviço (Sirius 60, pedido 12). Só gera CSV; não grava nada.
Uso: py vinculo_material.py [--orcamento saida_v2/orcamento_banco_pos3.csv] [--saida saida_v2]
Saída: <saida>/vinculo_material_servico.csv (uma linha por material) e o resumo no terminal.

Regra (CLAUDE.md, 08/10/2026; lógica do Flats, lib/painel-semanal.js AGREGADO_HERDA e lib/valor-agregado.js):
- Linha de MATERIAL ("Apenas Material", aço CA-50, concreto usinado, material hidráulico/elétrico por estimativa) não
  aparece no avanço físico nem recebe medição. Fica VINCULADA à linha de SERVIÇO (MO) do mesmo pavimento e do mesmo
  subgrupo da EAP: aço → armação; forma material → forma MO; concreto usinado → lançamento/concretagem MO;
  material de escada → execução de escada; material hidráulico → 6.1.1 (ramais) e 6.1.1.1 (prumadas) pelas horas; material elétrico → MO elétrica.
- Valor agregado do material = o MAIOR entre (a) avanço do serviço × orçado do material (herança) e (b) custo da
  linha (pago + a pagar) limitado ao orçado.
- Diferença em relação ao Flats: lá o concreto usinado fica FORA da regra e entra pela medição; no Sirius o Rafael
  decidiu (08/10) vincular o concreto à concretagem MO.
"""
import argparse, os
import pandas as pd

OBRA = 'sirius60'
REGRA = 'herança: maior entre (avanço do serviço × orçado do material) e (custo pago + a pagar, limitado ao orçado)'
# 2º Pav: os códigos da forma estão invertidos em relação aos outros pavimentos (3.4.5 = material, 3.4.6 = MO);
# liga pelo id, valha a descrição que valer no banco.
FIXO_ID = {720: 721}
# Tipos com MAIS de um serviço no pavimento (Rafael, 08/10): o material hidráulico 6.1.2 é dividido entre 6.1.1
# (ramais) e 6.1.1.1 (prumadas) na proporção das horas; herda o avanço ponderado (peso = hh do serviço ÷ soma).
VARIOS_SERVICOS = {'hidraulica'}


def eh_material(o):
    d = str(o.descricao).upper()
    if o.grupo_num >= 17:
        return False
    return ('APENAS MATERIAL' in d or d.startswith('AÇO CA-50') or d.startswith('CONCRETO USINADO')
            or d.startswith('MATERIAL HIDRAULICO') or d.startswith('MATERIAL ELETRICO'))


def tipo_material(d):
    d = str(d).upper()
    if 'ESCADA' in d:
        return 'escada'
    if 'FORMA' in d:
        return 'forma'
    if d.startswith('AÇO') or 'AÇO ' in d:
        return 'armacao'
    if 'CONCRETO' in d:
        return 'concretagem'
    if 'HIDRAULICO' in d:
        return 'hidraulica'
    if 'ELETRICO' in d:
        return 'eletrica'
    return ''


def tipo_servico(d):
    d = str(d).upper()
    if 'APENAS MATERIAL' in d:
        return ''
    if 'ESCADA' in d and 'MO' in d:
        return 'escada'
    if 'FORMA' in d and ('APENAS MO' in d or '(MO)' in d):
        return 'forma'
    if 'ARMAÇÃO' in d:
        return 'armacao'
    if ('LANÇAMENTO' in d or 'CONCRETAGEM' in d) and 'PISO' not in d:
        return 'concretagem'
    if d.startswith('MO DE OBRA HIDRAULICA') or d.startswith('MO HIDRÁULICA'):
        return 'hidraulica'
    if d.startswith('MO ELETRICA'):
        return 'eletrica'
    return ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--orcamento', default='saida_v2/orcamento_banco_pos3.csv')
    ap.add_argument('--saida', default='saida_v2')
    ap.add_argument('--sql', default='../supabase/orcamento')
    a = ap.parse_args()
    orc = pd.read_csv(a.orcamento, dtype={'codigo_eap': str})
    orc['subgrupo'] = orc.codigo_eap.str.split('.').str[:2].str.join('.')
    orc['material'] = [eh_material(o) for o in orc.itertuples()]
    orc['tipo_mat'] = [tipo_material(d) if m else '' for d, m in zip(orc.descricao, orc.material)]
    orc['tipo_srv'] = [tipo_servico(d) if not m else '' for d, m in zip(orc.descricao, orc.material)]
    por_id = orc.set_index('id')

    out, pend = [], []
    for m in orc[orc.material].itertuples():
        if m.id in FIXO_ID:
            cand = orc[orc.id == FIXO_ID[m.id]]
        else:
            cand = orc[(orc.pavimento == m.pavimento) & (orc.subgrupo == m.subgrupo) & (orc.tipo_srv == m.tipo_mat)]
        varios = m.tipo_mat in VARIOS_SERVICOS
        if len(cand) == 0 or (len(cand) > 1 and not varios) or (varios and cand.hh.sum() <= 0):
            pend.append(dict(material_id=m.id, material_codigo=m.codigo_eap, pavimento=m.pavimento, descricao=m.descricao,
                             valor=m.preco_total, motivo=f'{len(cand)} serviço(s) candidato(s) ({m.tipo_mat or "tipo não reconhecido"})'))
            continue
        for s in cand.itertuples():
            peso = round(s.hh / cand.hh.sum(), 6) if varios else 1.0
            out.append(dict(material_id=m.id, material_codigo=m.codigo_eap, pavimento=m.pavimento, descricao=m.descricao,
                            material_hh=m.hh, material_valor=m.preco_total, servico_id=int(s.id), servico_codigo=s.codigo_eap,
                            servico_pavimento=s.pavimento, descricao_servico=s.descricao, peso=peso, tipo=m.tipo_mat,
                            regra=REGRA + (' — avanço dos serviços ponderado pelas horas' if varios else '')))
    v = pd.DataFrame(out)
    v.to_csv(os.path.join(a.saida, 'vinculo_material_servico.csv'), index=False, encoding='utf-8-sig')

    # serviços (grupos 2, 3, 6 e 7, onde o material vem em linha separada) sem material vinculado
    srv = orc[(~orc.material) & orc.grupo_num.isin([2, 3, 6, 7]) & (orc.hh > 0)]
    sem_mat = srv[~srv.id.isin(v.servico_id)]

    um = v.drop_duplicates('material_id')
    print(f'materiais: {int(orc.material.sum())} | vinculados {len(um)} ({len(v)} vínculos) | pendentes {len(pend)}'
          f' | valor vinculado R$ {um.material_valor.sum():,.2f} | horas dos materiais {um.material_hh.sum():,.1f} h')
    print(um.groupby('tipo').agg(linhas=('material_id', 'size'), valor=('material_valor', 'sum')).to_string())
    for r in v[v.peso < 1].itertuples():
        print(f'  dividido: {r.material_codigo} {r.pavimento} → {r.servico_codigo} peso {r.peso:.4f}')
    for p in pend:
        print(f'  PENDENTE {p["material_codigo"]:8s} {p["pavimento"]:12s} {str(p["descricao"])[:60]:60s} R$ {p["valor"]:,.2f} — {p["motivo"]}')
    print(f'serviços dos grupos 2, 3, 6 e 7 sem material vinculado: {len(sem_mat)}')
    for s in sem_mat.itertuples():
        print(f'  {s.codigo_eap:8s} {s.pavimento:12s} {str(s.descricao)[:70]:70s} R$ {s.preco_total:,.2f}')
    if pend:
        print('há material pendente: o SQL não foi gerado')
    else:
        escrever_sql(v, orc, a.sql)


def escrever_sql(v, orc, destino):
    n, total = len(orc), round(orc.preco_total.sum(), 2)
    bkp = 'orcamento_vinculo_bkp_20261008'
    tab = 'orcamento_material_servico'
    nmat = v.material_id.nunique()
    vals = ',\n'.join(f"  ({r.material_id}, '{r.material_codigo}', '{r.pavimento}', {r.servico_id}, '{r.servico_codigo}', "
                      f"'{r.servico_pavimento}', {r.peso:.6f})  -- {r.tipo}" for r in v.sort_values(['material_id', 'servico_id']).itertuples())
    vals = '\n'.join(l.replace(')  --', '),  --', 1) if k < len(v) - 1 else l for k, l in enumerate(vals.split(',\n')))
    os.makedirs(destino, exist_ok=True)
    open(os.path.join(destino, '4-vinculo-material.sql'), 'w', encoding='utf-8').write(f"""-- =====================================================================
-- Sirius 60 — ORÇAMENTO, PASSO 4: vínculo material ↔ serviço (pedido 12; gerado por automacao/vinculo_material.py)
-- Rodar no SQL Editor (arquivo inteiro), DEPOIS do 1-orcamento-final.sql. Desfazer: 4-vinculo-material-desfazer.sql
--
-- orcamento_planejado ganha a coluna e_material (true = linha só de material: não aparece no avanço físico e não
--   recebe medição). Nenhum valor, hora, semana ou código muda; o total não muda.
-- Tabela nova {tab}: material → serviço(s) de MO que ele acompanha, com peso (soma 1 por material):
--   material_id, material_codigo, material_pavimento, servico_id, servico_codigo, servico_pavimento, peso
--   (a medição é por código + pavimento). RLS ligado, sem política, sem permissão para anon/authenticated.
-- Valor agregado do material (regra do Flats, CLAUDE.md): o MAIOR entre (avanço dos serviços × peso) × orçado do
--   material e custo (pago + a pagar) limitado ao orçado. O site passa a usar isto na fase de telas; até lá nada
--   muda na tela (o site lê colunas explícitas).
-- {nmat} materiais, {len(v)} vínculos (automacao/saida_v2/vinculo_material_servico.csv): aço → armação; forma
--   material → forma MO; concreto usinado → lançamento/concretagem MO; material de escada → execução de escada;
--   material elétrico → MO elétrica; material hidráulico 6.1.2 → 6.1.1 (ramais) e 6.1.1.1 (prumadas) na proporção
--   das horas (Rafael, 08/10). 2º Pav: 3.4.5 (material) → 3.4.6 (MO), ligado pelo id.
-- Backup: {bkp} (id, código, pavimento, descrição, preço e horas de hoje). Travas antes e depois.
-- =====================================================================
begin;

do $$
declare n int; total numeric;
begin
  if to_regclass('public.{bkp}') is not null or to_regclass('public.{tab}') is not null then
    raise exception '{bkp} ou {tab} já existe: este arquivo já foi rodado?';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orcamento_planejado'
              and column_name = 'e_material') then
    raise exception 'orcamento_planejado já tem a coluna e_material: nada foi feito';
  end if;
  select count(*), sum(preco_total) into n, total from public.orcamento_planejado where obra_id = '{OBRA}';
  if n <> {n} or round(total, 2) <> {total:.2f} then
    raise exception 'orçamento com % linhas e % (esperado {n} e {total:.2f}): nada foi feito', n, total;
  end if;
end $$;

create table public.{bkp} as
  select id, codigo_eap, pavimento, descricao, preco_total, hh from public.orcamento_planejado where obra_id = '{OBRA}';
alter table public.{bkp} enable row level security;
revoke all on public.{bkp} from anon, authenticated;

alter table public.orcamento_planejado add column e_material boolean not null default false;

create table public.{tab} (
  id                 bigserial primary key,
  obra_id            text not null,
  material_id        bigint not null,
  material_codigo    text not null,
  material_pavimento text not null,
  servico_id         bigint not null,
  servico_codigo     text not null,
  servico_pavimento  text not null,
  peso               numeric(9,6) not null check (peso > 0 and peso <= 1),
  unique (obra_id, material_id, servico_id)
);
alter table public.{tab} enable row level security;
revoke all on public.{tab} from anon, authenticated;
revoke all on sequence public.{tab}_id_seq from anon, authenticated;

-- (id do material, código, pavimento, id do serviço, código, pavimento, peso); só entra se as duas linhas existem
insert into public.{tab} (obra_id, material_id, material_codigo, material_pavimento, servico_id, servico_codigo,
  servico_pavimento, peso)
select '{OBRA}', v.mid, v.mcod, v.mpav, v.sid, v.scod, v.spav, v.peso
  from (values
{vals}
  ) as v(mid, mcod, mpav, sid, scod, spav, peso)
  join public.orcamento_planejado m on m.id = v.mid and m.codigo_eap = v.mcod and m.pavimento = v.mpav and m.obra_id = '{OBRA}'
  join public.orcamento_planejado s on s.id = v.sid and s.codigo_eap = v.scod and s.pavimento = v.spav and s.obra_id = '{OBRA}';

update public.orcamento_planejado as o set e_material = true
 where o.obra_id = '{OBRA}' and o.id in (select material_id from public.{tab} where obra_id = '{OBRA}');

do $$
declare n int; total numeric; m int; k int; ruim int;
begin
  select count(*), sum(preco_total), count(*) filter (where e_material) into n, total, m
    from public.orcamento_planejado where obra_id = '{OBRA}';
  if n <> {n} or round(total, 2) <> {total:.2f} then
    raise exception 'orçamento mudou (% linhas, %): nada foi gravado', n, total;
  end if;
  select count(*) into k from public.{tab} where obra_id = '{OBRA}';
  if m <> {nmat} or k <> {len(v)} then
    raise exception '% material(is) e % vínculo(s) (esperado {nmat} e {len(v)}): nada foi gravado', m, k;
  end if;
  -- pesos somam 1 por material; serviço do mesmo pavimento e que não é material
  select count(*) into ruim from (select material_id from public.{tab} where obra_id = '{OBRA}'
     group by material_id having abs(sum(peso) - 1) > 0.00001) x;
  if ruim > 0 then raise exception '% material(is) com pesos que não somam 1: nada foi gravado', ruim; end if;
  select count(*) into ruim from public.{tab} t
    join public.orcamento_planejado s on s.id = t.servico_id
   where t.obra_id = '{OBRA}' and (s.e_material or s.pavimento <> t.material_pavimento);
  if ruim > 0 then raise exception '% vínculo(s) inválido(s): nada foi gravado', ruim; end if;
end $$;

commit;

-- Conferência 1: materiais por serviço
select t.material_codigo, t.material_pavimento, left(m.descricao, 45) as material, m.preco_total,
       t.servico_codigo, left(s.descricao, 45) as servico, t.peso
  from public.{tab} t
  join public.orcamento_planejado m on m.id = t.material_id
  join public.orcamento_planejado s on s.id = t.servico_id
 where t.obra_id = '{OBRA}' order by t.material_id, t.servico_id;
-- Conferência 2: total (deve ser {n} linhas e {total:,.2f}; {nmat} materiais)
select count(*) as linhas, sum(preco_total) as direto, count(*) filter (where e_material) as materiais
  from public.orcamento_planejado where obra_id = '{OBRA}';
""")
    open(os.path.join(destino, '4-vinculo-material-desfazer.sql'), 'w', encoding='utf-8').write(f"""-- =====================================================================
-- Sirius 60 — DESFAZER o passo 4 do orçamento (4-vinculo-material.sql): tira a coluna e_material e a tabela
-- {tab}. Rodar só com o código do site que NÃO usa e_material / {tab} (senão a tela quebra).
-- Nenhum valor, hora, semana ou código foi mudado pelo passo 4: tirar a coluna e a tabela volta ao estado anterior.
-- =====================================================================
begin;

do $$
declare n int;
begin
  if to_regclass('public.{bkp}') is null then raise exception 'backup {bkp} não existe: nada foi feito'; end if;
  select count(*) into n from public.orcamento_planejado o join public.{bkp} b using (id)
   where (o.codigo_eap, o.pavimento, o.descricao, o.preco_total, o.hh) is distinct from (b.codigo_eap, b.pavimento, b.descricao, b.preco_total, b.hh);
  if n > 0 then raise exception '% linha(s) diferentes do backup: confira antes (nada foi desfeito)', n; end if;
end $$;

drop table if exists public.{tab};
alter table public.orcamento_planejado drop column if exists e_material;

commit;

-- Conferência: deve vir VAZIA
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'orcamento_planejado' and column_name = 'e_material';

-- Depois de conferir, o backup pode ser apagado (só com autorização):
-- drop table public.{bkp};
""")
    print('SQL:', os.path.join(destino, '4-vinculo-material.sql'), '(+ desfazer)')


if __name__ == '__main__':
    main()
