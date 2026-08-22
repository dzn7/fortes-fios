# Spec — Lupa de busca no header

**Status:** implementada e validada
**Data:** 2026-08-22

## Objetivo

Uma lupa ao lado do carrinho, no header, que abre a busca de produtos de
qualquer ponto do site — sem descer até o catálogo.

## Decisão: buscar na memória, não no banco

Pedido explícito: "sem queries pesadas e sem travar". Medido **antes** de
escrever código, com os 510 produtos reais de produção.

| Opção | Custo por tecla digitada |
| --- | --- |
| **Cliente**, sobre o catálogo já carregado | **1,7 ms**, **zero** queries |
| Servidor com `ilike '%termo%'` | `Seq Scan` (0,3 ms hoje) **+ ida e volta de rede** — 50–300 ms num celular — **+ invocação serverless**, a cada tecla |
| Servidor com `tsvector` + GIN | migração e índice novo, e continua pagando a rede a cada tecla |

Plano real do `ilike`, colhido em produção:

```
Limit  (cost=0.00..8.80 rows=20)
  ->  Seq Scan on produtos  (cost=0.00..39.62 rows=90)
        Filter: (disponivel AND ((nome ~~* '%shampoo%') OR (descricao ~~* '%shampoo%')))
```

A regra `advanced-full-text-search` da skill está certa e é a razão de o `ilike`
varrer a tabela: padrão com curinga à esquerda não usa índice. Mas a regra vale
**quando é preciso consultar o banco**. Aqui o catálogo inteiro já está no
browser — a home o carrega numa requisição só — então a resposta certa é **não
consultar**. Índice nenhum torna uma ida à rede mais rápida que uma varredura
de 510 itens em memória.

**Limiar registrado:** o argumento se inverte quando o catálogo não couber mais
em memória (ordem de ~2 000 produtos, o mesmo limiar da paginação). Aí a busca
vai para o servidor **com `tsvector` + GIN**, nunca com `ilike`.

## Ordenação dos resultados

`filtrarProdutos` devolve na ordem do catálogo: digitar "sh" traz 92 produtos com
o primeiro sendo o que estiver na frente da lista, não o mais parecido. A busca
do header ordena por proximidade:

1. nome **começa** com o termo;
2. nome **contém** o termo;
3. categoria contém;
4. só a descrição contém.

Empate preserva a ordem do catálogo — a curadoria da loja é o desempate.

## Comportamento esperado

- Lupa ao lado do carrinho, no mobile e no desktop.
- Abre com o campo já focado; `Escape` e o botão fecham.
- Resultados aparecem enquanto digita, **sem debounce** — 1,7 ms não precisa.
- No máximo 20 resultados desenhados, com a contagem total quando houver mais.
  Cortar é o que impede a lista de 500 linhas travar o toque.
- Termo com menos de 2 caracteres não busca: "a" traria quase o catálogo inteiro.
- Sem resultado, oferece limpar e ver o catálogo.
- Tocar num resultado fecha a busca e abre aquele produto.
- Produto esgotado aparece marcado, e não sumido: ele existe e a pessoa procurou.

## Cenários de teste (`src/lib/busca-produtos.mjs`)

1. Termo com menos de 2 caracteres devolve vazio.
2. Acento e caixa são ignorados: `oleo` acha `Óleo`, `MASCARA` acha `Máscara`.
3. Nome que começa com o termo vem antes de nome que só contém.
4. Nome que contém vem antes de casar só pela descrição.
5. Empate no mesmo nível preserva a ordem do catálogo.
6. O limite corta os desenhados mas `total` conta todos.
7. Vários termos exigem todos (`kit hidratacao`).
8. Entrada inválida devolve vazio sem lançar.
9. Produto indisponível nunca aparece.

## Fora de escopo

- migração, índice, `tsvector` ou qualquer mudança de banco;
- alterar a busca que já existe na seção do catálogo;
- busca por marca, tag ou sinônimo;
- histórico de buscas.
