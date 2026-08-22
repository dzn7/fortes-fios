# Spec — Página pública do produto

**Status:** implementada e validada
**Data:** 2026-08-21

## Objetivo

Cada produto ganha um endereço próprio, compartilhável. No catálogo, clicar
expande o produto por cima da lista; abrir o link direto mostra a página inteira.
A quantidade é escolhida ali, antes de o item entrar no carrinho. No Admin, o
card do produto oferece copiar esse link.

## Formato do link — decidido com o usuário

```
/produto/mascara-hidratacao-profunda-9ceea5e4-5fa6-4677-b85d-d89bcb22b7ce
         └────────── decoração legível ──────────┘└──────── a chave ────────┘
```

O nome é decoração; **quem identifica o produto é o uuid no fim**. Consequências:

- **nenhuma migração**: não há coluna `slug` para criar, preencher nem manter;
- **renomear o produto não quebra link já compartilhado** — o id não muda, e a
  parte legível é recalculada sozinha;
- a busca é pela **chave primária**.

Alternativa descartada pelo usuário: coluna `slug` com índice único (link curto,
mas migração em produção e o dilema do link antigo ao renomear).

## Consulta — o que a skill `supabase-postgres-best-practices` disse aqui

Plano real, medido em produção antes de escrever código:

```
Index Scan using produtos_pkey on produtos  (cost=0.27..2.49 rows=1)
  Index Cond: (id = '9ceea5e4-…'::uuid)
  Filter: disponivel
  Buffers: shared hit=3          Execution Time: 1.305 ms
```

A regra `query-covering-indexes` mira 2–5× em consulta com heap fetch pesado.
Com 3 buffers e 1,3 ms, **não há o que ganhar**: nenhum índice novo, nenhuma
migração. A regra `data-pagination` não se aplica (busca de uma linha só).

Seguindo o §3.9 do AGENTS e a regra `security-privileges`, a leitura é
**server-side** (server component com `obterSupabaseAdmin`), e não mais uma
consulta anon no browser. Só colunas já públicas do catálogo são selecionadas —
`custo_unitario` fica de fora de propósito.

## Comportamento esperado

### Sempre o catálogo com o produto por cima

**Não existe tela separada de produto.** A primeira versão tinha uma, e foi
recusada: caía num cartão sem vitrine atrás, sem busca e sem as outras
categorias, e "voltar ao catálogo" virava um clique obrigatório. O link
compartilhado tem de entregar o mesmo que o clique dentro do site — a loja
aberta, com aquele produto em destaque.

| Entrada | Quem renderiza | Fechar |
|---|---|---|
| Clique no cartão | rota interceptada `@modal/(.)produto/[slug]`; o catálogo já está montado e não remonta | `router.back()`, devolve à página e à rolagem exatas |
| Link direto / recarregar | `/produto/[slug]`, que renderiza o catálogo **e** o produto por cima | `router.push('/')` — não há catálogo na pilha, e `back()` jogaria para fora do site |

Nos dois casos o conteúdo é o mesmo `DetalheProduto`; só muda quem o emoldura.

- Mostra nome, categoria, foto, descrição, preço, preço original e desconto
  quando houver, parcelas quando ativas, e o estado de estoque.
- Seletor de quantidade com − e +, preso ao estoque disponível.
- "Adicionar ao carrinho" leva a quantidade escolhida.
- `generateMetadata` com título, descrição e `openGraph`/`twitter` apontando a
  foto — é o que faz o link virar cartão no WhatsApp. Fica no servidor porque o
  robô que monta a prévia não executa JavaScript.
- Produto **indisponível** (`disponivel = false`) → 404. É o interruptor com que
  o Admin tira o produto do catálogo; manter a página viva o contradiria.
- Produto **esgotado** (estoque) → aparece e mostra "Esgotado", sem permitir
  adicionar.
- Slug inválido, id inexistente ou uuid malformado → 404.

### A superfície: drawer em toda tela

**Uma superfície só.** O `Dialog variant="responsive"` do projeto troca para
diálogo centrado acima de 768px — duas telas diferentes para o mesmo conteúdo.
Aqui o produto usa o `Drawer` (vaul) direto: sobe de baixo, com a mesma
transição em qualquer largura, e no desktop fica contido em `sm:max-w-lg`.

**Centralizar no desktop é `mx-auto`, nunca `-translate-x-1/2`.** O vaul escreve
`transform` inline para animar e arrastar, e estilo inline vence classe: a folha
apareceria deslocada meia largura. Com `inset-x-0` + `max-w`, a margem
automática centraliza sem tocar no transform.

**Uma altura, um scroller.** A versão anterior empilhava `max-h-[96dvh]` do
`DrawerContent`, o `overflow-y-auto p-6` do branch drawer do `DialogContent` e um
`max-h-[92dvh] overflow-y-auto` por cima: três limites brigando e dois
containers de rolagem aninhados. O conteúdo ficava cortado sem rolar e o botão
de comprar, fora de alcance. Agora:

| Faixa | Regra |
|---|---|
| Moldura (`DrawerContent`) | `p-0`, uma única `max-h-[92dvh]` |
| Corpo | **o único** `overflow-y-auto`, com `min-h-0` — sem ele o filho estica o pai e empurra o rodapé para fora da folha |
| Rodapé | `shrink-0`, fora do scroller: quantidade e "Adicionar ao carrinho" **sempre visíveis**, com `env(safe-area-inset-bottom)` para escapar da barra de gestos do iPhone |

A imagem tem teto em `max-h-[34dvh]`: numa tela de 430px a versão quadrada
ocupava a altura inteira e empurrava tudo para fora da vista.

Os botões − e + são `size-11` (44px), o mínimo de alvo de toque; antes eram
`size-9` (36px). O "copiar link" virou só ícone — o rótulo roubava largura do
CTA principal e quebrava os dois em duas linhas.

**Limitação conhecida.** O portal (Radix no `Dialog`, vaul no `Drawer`) só monta
no cliente, então o HTML servido traz o catálogo mas **não** o produto
expandido: no link direto, o produto aparece depois da hidratação. Medido no
HTML servido — `id="catalogo"` e a busca presentes, o conteúdo do drawer
ausente. É o preço de o produto morar numa superfície sobreposta; a tela
separada não tinha esse atraso, mas foi recusada por tirar a pessoa da loja.


### Admin

- O card do produto ganha "copiar link": **aparece no hover no desktop** e fica
  **sempre visível no toque**, porque no celular não existe hover.
- Copiado confirma na própria UI e volta ao estado normal sozinho.

## Regras testáveis (`src/lib/link-produto.mjs`)

1. `slugDoProduto` junta nome higienizado + id.
2. Acento vira letra simples; maiúscula vira minúscula; pontuação e espaço viram
   `-`; `-` repetido colapsa; sobra nas pontas é aparada.
3. Nome vazio, ausente ou só símbolos devolve apenas o id — nunca `-uuid`.
4. Nome muito longo é cortado, para a URL não crescer sem limite.
5. `idDoSlug` devolve o uuid do fim, aceitando maiúsculas.
6. `idDoSlug` devolve `null` para slug sem uuid, uuid malformado, vazio ou não
   string — nunca lança.
7. `slugDoProduto` → `idDoSlug` devolve o id original (ida e volta), inclusive
   para nome com acento, emoji e barra.
8. `caminhoDoProduto` começa com `/produto/`.
9. `urlPublicaDoProduto` junta origem sem barra dupla e sem barra sobrando.

## Fora de escopo

- coluna `slug`, índice novo, qualquer migração;
- checkout, frete, cupom na página do produto;
- listar produtos relacionados;
- `ModalIngredientes` continua no repositório (§3.7) mesmo deixando de ser
  aberto pelo cartão do catálogo.
