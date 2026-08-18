# SPEC — Filtragem do catálogo do cliente

> Status: implementado e verificado.
> Pedido do usuário: *"na tela do cliente adicionar filtragem: Maiores
> descontos, para aparecer pro cliente os maiores descontos e melhorar toda
> parte de filtragem do site do cliente"*

---

## 1. O que existia

Tudo dentro de um `useMemo` de `src/app/page.tsx`:

```ts
produtos.filter((p) => !busca || p.nome.toLowerCase().includes(buscaLower))
…
if (ordenacaoCliente === 'menor_preco') return […].sort((a,b) => a.preco - b.preco)
```

Três problemas concretos, nenhum deles cosmético:

1. **A busca só olhava `produto.nome`.** O placeholder promete "Buscar shampoo,
   máscara, kit ou **marca**" — marca e tipo vivem na descrição e na categoria,
   que a busca não consultava.
2. **A busca era sensível a acento.** Digitar `mascara` não encontrava
   `Máscara de Nutrição`. Em celular, com teclado sem acento, isso é o caso
   comum e não a exceção.
3. **Nenhum atalho para promoção.** Dos 243 produtos disponíveis, **48 estão em
   oferta** (verificado no banco) e não havia como vê-los juntos — só a vitrine
   curada manualmente no admin, com quantidade limitada.

E, por estar dentro de um componente React, nada disso era testável: o projeto
não aceita teste de browser (AGENTS §3.4).

## 2. Desenho

A regra sai para `src/lib/filtros-catalogo.mjs` — JS puro, como `frete.mjs` e
`whatsapp.mjs`, coberto por `node --test`. `page.tsx` fica só com o estado e a
marcação.

### 2.1 Ordenações

| id | Rótulo | Critério |
|---|---|---|
| `recomendados` | Recomendados | ordem que veio do banco (curadoria da loja) |
| `maior_desconto` | **Maiores descontos** | percentual efetivo, decrescente |
| `menor_preco` | Menor preço | `preco` crescente |
| `maior_preco` | Maior preço | `preco` decrescente |
| `lancamentos` | Novidades | `created_at` decrescente |

`Array.prototype.sort` é estável, então **empate preserva a ordem recomendada**:
dois produtos com 20% continuam na sequência escolhida no admin.

### 2.2 O que conta como desconto

Mesma regra do `CartaoProduto`: percentual `> 0` **e** `preco_original` maior
que o preço atual. Não é preciosismo — se a ordenação usasse critério mais
frouxo, "Maiores descontos" levaria ao topo produtos **sem tarja de desconto no
cartão**. O cliente veria a promessa e não a promoção. No banco os dois números
já batem: 48 produtos com `desconto > 0`, os mesmos 48 com `preco_original >
preco`.

### 2.3 Filtros

| Filtro | Regra |
|---|---|
| busca | acento-insensível, multi-termo (todos precisam aparecer, em qualquer ordem), sobre nome + descrição + categoria |
| categoria | comparação normalizada (sem acento, sem caixa) |
| `apenasOfertas` | só produtos em oferta efetiva |

Ordenação **não** conta como filtro ativo: o catálogo sempre tem uma, e exibir
"1 filtro ativo" numa tela intocada seria mentira.

### 2.4 Interface

Na mesma linha da contagem de resultados — ordenar e filtrar são a resposta ao
número que se acabou de ler, não uma seção à parte:

- **"Só promoções"** com o total ao lado (`48`). Aparece **apenas quando há
  ofertas**: filtro que sempre devolve lista vazia ensina o cliente a não
  confiar nos filtros.
- **"Ordenar por"** alimentado por `ORDENACOES_CATALOGO` — acrescentar uma
  ordenação passa a ser uma linha no módulo, não uma `<option>` perdida no JSX.
- **"Limpar"**, só quando há filtro ligado, com a contagem quando é mais de um.

O botão do estado vazio ("Ver todos os produtos") passa a chamar o mesmo
`limparFiltros`. Antes ele zerava busca e categoria e **deixava "só promoções"
ligado** — a tela continuaria vazia depois do clique.

## 3. Aceite

| Cenário | Esperado |
|---|---|
| Ordenar por "Maiores descontos" | 50% antes de 20%, sem desconto por último |
| Buscar `mascara` | encontra `Máscara de Nutrição` |
| Buscar `hidratante shampoo` | encontra `Shampoo Hidratante` |
| Buscar `oleo` num produto de categoria `Óleos` | encontra |
| "Só promoções" com 0 ofertas no catálogo | botão não aparece |
| Limpar | volta a busca, categoria, ofertas e ordenação ao padrão |
| Empate de preço | mantém a ordem do admin |

Cobertura: `tests/filtros-catalogo.test.mjs`, 28 asserções.

## 4. Fora de escopo

Faixa de preço, filtro por marca e URL com estado dos filtros (`?ordenar=`).
Marca não é coluna hoje — seria inventar campo. Estado na URL vale a pena
quando houver compartilhamento de busca, e não há sinal disso ainda.
