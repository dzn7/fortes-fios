# Spec — Cupom visível no card e no detalhe do pedido

**Status:** implementada e validada
**Data:** 2026-08-20

## Problema

O pedido grava qual cupom foi usado e quanto descontou, e nada disso aparece no
Admin. Quem atende vê o total menor sem saber por quê.

Verificado em produção (2026-08-20): dos 11 pedidos, **4 usaram cupom** — todos
`PRIMEIRACOMPRA`.

## Dado real

Colunas já existentes em `pedidos`:

| Coluna | Exemplo |
|---|---|
| `cupom_id` | uuid |
| `cupom_codigo` | `PRIMEIRACOMPRA` |
| `tipo_desconto_cupom` | `percentual` \| `valor_fixo` \| `frete_gratis` |
| `desconto_cupom` | `2`, `3`, `2.4`, `2.73` |

**`desconto_cupom` guarda o valor em REAIS já calculado, não o percentual.**
Conferido: 40 − 2 = 38, 60 − 3 = 57, 48 − 2,4 = 45,6, 54,5 − 2,73 = 51,77. O
percentual original não é gravado no pedido, então a tela não pode exibi-lo sem
inventar — mostra o código e o valor descontado.

## Comportamento esperado

- **Card:** pedido com cupom ganha um selo ao lado do nome, junto do de
  "Presente", com o código. Sem cupom, nada muda.
- **Modal de detalhes:** linha no Resumo Financeiro, entre o subtotal e as taxas,
  com o código e o valor descontado em negativo.
- Cupom sem valor descontado (`0`) ainda aparece: usar cupom é o fato relevante,
  mesmo que o desconto tenha sido zerado.
- Código ausente com desconto presente mostra "Cupom" sem código, em vez de
  esconder o desconto.

## Regra de exibição (`src/lib/cupom-pedido.mjs`)

1. `pedidoUsouCupom` é verdadeiro com `cupom_id` **ou** `cupom_codigo`
   preenchido **ou** `desconto_cupom` maior que zero — qualquer um dos três, para
   pedido antigo com gravação parcial não sumir.
2. `rotuloCupom` devolve o código em caixa alta e sem espaços nas pontas, ou
   `Cupom` quando não há código.
3. `valorDescontadoCupom` normaliza para número não negativo; texto numérico
   (o PostgREST devolve `numeric` como string em algumas rotas) é aceito.

## Cenários de teste

1. Pedido sem nenhum campo de cupom → não usou.
2. Só `cupom_id` → usou. Só `cupom_codigo` → usou. Só desconto > 0 → usou.
3. `desconto_cupom` igual a 0 com código presente → usou.
4. Código com espaços e caixa baixa → rótulo em caixa alta e aparado.
5. Código vazio/nulo → rótulo `Cupom`.
6. `desconto_cupom` como string `"2.73"` → 2.73.
7. Valor negativo, `NaN`, nulo ou ausente → 0.

## Fora de escopo

- criar, editar ou validar cupom;
- a tela de cupons;
- recalcular desconto de pedido já gravado;
- exibir o percentual original (não é gravado no pedido).
