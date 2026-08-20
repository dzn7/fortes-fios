# Spec — Paginação numerada do catálogo do cliente

**Status:** implementada e validada
**Data:** 2026-08-20

## Problema

O catálogo montava a lista inteira de forma contínua. A primeira rodada de
desempenho trocou isso por lotes crescentes (rolagem infinita), e o resultado
foi recusado: uma lista que passa de 100 produtos rolando sem fim não deixa a
pessoa saber onde está nem voltar a um ponto.

## Decisão: paginar na tela, não no banco

A skill `supabase-postgres-best-practices` (`data-pagination`) recomenda keyset
em vez de `OFFSET` — e vale para paginação **no banco**. Aqui a resposta certa é
**não introduzir query paginada nenhuma**, e o motivo é de arquitetura, não de
preguiça: a home precisa da lista inteira em memória para

1. a busca acento-insensível sobre nome + descrição + categoria;
2. o filtro por categoria;
3. a ordenação (recomendados, maior desconto, menor/maior preço, novidades);
4. a contagem de "Só promoções", que conta ofertas **dentro do filtro atual**;
5. os carrosséis de mais-vendidos e de ofertas, que resolvem ids contra a lista;
6. `sincronizarProdutos`, que reconcilia o carrinho com o catálogo.

Com `range`/keyset, cada um desses viraria ida ao servidor — busca com latência
por tecla, contagem impossível sem uma segunda query, carrossel referenciando
produto que não está na página. São 505 produtos e 368 kB de JSON (≈60–80 kB
comprimidos) numa requisição só; o custo que a pessoa sentia era de renderização,
não de rede.

**Limiar registrado:** acima de ~2 000 produtos essa conta muda e a busca precisa
ir para o servidor (`ilike` com índice de trigrama ou full-text). Não é o caso
hoje.

## Tamanho da página: 24

Pedido: "uns 25 ou menos". A grade é `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.
**24 divide exato por 2, 3 e 4**; 25 deixa órfão nos três tamanhos. Por isso 24,
e não 25.

## Comportamento esperado

- A grade nunca mostra mais de 24 produtos.
- Navegação por número, com primeira/anterior/próxima/última e elipse, no mesmo
  desenho da paginação do Admin (`PaginacaoPedidos`).
- Trocar busca, categoria, "só promoções" ou ordenação volta para a página 1.
- Trocar de página rola até o topo do catálogo — senão a pessoa cai no meio da
  grade nova.
- Página fora do intervalo é corrigida para a mais próxima válida; catálogo
  vazio não desenha paginação.
- Uma página só (24 ou menos resultados) não desenha paginação.

## Reuso

- Primitivos `src/components/ui/pagination` (shadcn), os mesmos do Admin.
- `criarItensPaginacao` existia apenas dentro de `PaginacaoPedidos.tsx`. Este é
  o **segundo** uso: a lógica sobe para `src/lib/paginacao.mjs` — onde fica ao
  alcance do `node --test` — e os dois passam a consumi-la. É "generalizar o
  existente" (§5), preferível a duplicar num `.tsx` fora do alcance de teste.

## Cenários de teste (`src/lib/paginacao.mjs`)

1. `totalDePaginas` arredonda para cima; lista vazia dá 0 páginas.
2. `normalizarPagina` prende no intervalo `[1, totalPaginas]`; sem páginas dá 1.
3. `fatiarPagina` devolve a fatia certa e os índices `primeiro`/`ultimo` 1-based.
4. `fatiarPagina` na última página devolve o resto, não um bloco cheio.
5. `fatiarPagina` com entrada inválida devolve vazio sem lançar.
6. `janelaDePaginas` com até 7 páginas lista todas, sem elipse.
7. Perto do começo: elipse só no fim. Perto do fim: elipse só no começo.
8. No meio: elipse dos dois lados e a página atual no centro.
9. A janela nunca repete número nem sai do intervalo, para todo par
   (paginaAtual, totalPaginas) até 60 — invariante, não caso isolado.

## Fora de escopo

- paginação no servidor;
- mudar busca, filtros ou ordenação;
- a paginação do Admin muda de origem da função, não de comportamento.
