# Spec — Desempenho do site do cliente no celular

**Status:** implementada e validada
**Data:** 2026-08-19

## Sintoma relatado

O site do cliente está lento no celular e algumas fotos de produto demoram muito
para aparecer.

## Medições feitas antes de escrever código

Produção, banco `tjljhspczbaxtpbxlyjd`, 2026-08-19.

| Medida | Valor |
| --- | --- |
| Produtos com `disponivel = true` | **505** |
| Cartões renderizados na aba "Todos" | **505** (sem paginação) |
| JSON da consulta de produtos | 368 kB (746 B por produto) |
| Imagens de produto no bucket | 14,1 MB somados · mediana 23 kB · máx. 133 kB |
| Banners do hero | 5,6 MB somados |
| Banner 4 (arte **mobile**) | **1 893 kB** · 960×1200 |
| Banner 5 (arte **mobile**) | **1 150 kB** · 959×1200 |
| Banners 1–3 (mesmas dimensões) | 36–110 kB |
| JS da home | 1 305 kB cru / 390 kB gzip |

## Defeitos encontrados

### D1 — Banner de 1,9 MB é PNG com nome e `Content-Type` de WebP

Bytes reais do banner 4 mobile:

```
$ curl -s -r 0-11 ".../vitrine/…_cgt9wq.webp" | xxd
00000000: 8950 4e47 0d0a 1a0a 0000 000d            .PNG........
```

`Content-Type: image/webp`, `Content-Length: 1938805`, assinatura `\x89PNG`.

Origem, em `src/lib/backblaze.ts`:

```js
canvas.toBlob(cb, 'image/webp', qualidade)          // pode devolver PNG
…
new File([blob], arquivo.name, { type: 'image/webp' })  // afirma WebP sem conferir
```

Quando o navegador não sabe codificar WebP em canvas, a especificação manda cair
para `image/png` — e PNG **ignora** o argumento de qualidade. O código sobrescreve
`blob.type` com uma afirmação fixa, então o PNG de 1,9 MB viaja rotulado como WebP,
é gravado com extensão `.webp` e servido como WebP. Foi assim que dois banners
ficaram 20–50× maiores que os outros três, de dimensão idêntica.

É o maior peso isolado da home no celular, e está no caminho do LCP.

### D2 — `/api/upload` ignora `w` e `q`; nenhuma imagem é redimensionada

O loader (`src/lib/imagem-publica.mjs`) monta `/api/upload?arquivo=…&w=640&q=75`,
mas o `GET` da rota lê apenas `arquivo`: devolve o objeto original, byte a byte.

Consequências:

- toda `<Image>` do catálogo tem `srcset` de **15 larguras** (7 `imageSizes` + 8
  `deviceSizes`) e as 15 devolvem **o mesmo arquivo em tamanho cheio**;
- cada largura é uma chave de cache distinta no CDN, então cada uma paga um miss
  frio: invocação serverless + leitura completa do objeto no B2. É exatamente o
  "algumas fotos demoram muito" — as lentas são as que caíram em largura fria;
- o proxy, que existe por resiliência (spec `hero-responsivo-imagens-resilientes`),
  hoje só acrescenta um salto sem entregar nada em troca.

### D3 — O hero nem pede largura

`criarFontesResponsivasBanner` devolve a URL sem `w`. Mesmo com D2 corrigido, o
hero continuaria recebendo a arte inteira. Junto com D1, é o 1,9 MB chegando puro
num aparelho de 390 px.

### D4 — 505 cartões montados de uma vez

`produtosFiltrados.map(...)` não fatia. A aba "Todos" monta 505 `<article>`, 505
`<img>` com `srcset` de 15 URLs (≈7 600 URLs para o parser) e 505 raízes de
`Dialog`. O custo é de main thread, não de rede — é a lentidão de rolagem e de
toque que o cliente sente.

## Comportamento esperado

- `GET /api/upload` aceita `w` e `q`, redimensiona com `sharp` e devolve WebP.
- `w` só é aceito dentro da lista de larguras que o projeto realmente emite;
  valor fora da lista é ignorado (devolve o original), para não abrir chave de
  cache arbitrária.
- Nunca amplia: fonte menor que `w` é devolvida na dimensão que tem.
- GIF é devolvido intacto — reencodar perderia a animação.
- Falha do `sharp` devolve os bytes originais. A rota existe para ser resiliente;
  ela não pode passar a quebrar por causa da otimização.
- O hero declara `srcset` com larguras reais e `sizes="100vw"`, arte mobile e
  desktop separadas.
- O upload grava o tipo que o canvas **realmente** produziu, e a extensão
  correspondente.
- O catálogo monta um lote inicial e cresce conforme a pessoa rola.

## Cenários de teste

`dimensoes-imagem.mjs`

1. Largura da lista permitida é aceita; fora da lista devolve `null`.
2. `q` fora de 1–100, ausente ou não numérico cai no padrão 75.
3. `deveConverter` recusa GIF e aceita JPEG/PNG/WebP.
4. Largura maior que a fonte não amplia.

`imagem-publica.mjs`

5. Loader do Next devolve `w` e `q` na URL same-origin.
6. Hero declara `srcset` com as larguras de mobile e de desktop.
7. Hero sem arte mobile continua sem `source` alternativo.
8. Imagem local e host externo continuam intactos (regressão da spec anterior).

`paginacao-catalogo.mjs`

9. Lista menor que o lote devolve tudo e marca que acabou.
10. Lista maior devolve só o lote e marca que há mais.
11. Trocar de filtro reinicia a contagem.

## Segunda rodada — 2026-08-20

As duas pendências registradas na primeira rodada foram atacadas.

### D5 — framer-motion inteiro no bundle por causa de um banner

A varredura transitiva de imports a partir de `page.tsx` + `layout.tsx` (71
arquivos) mostrou **um único** ponto de entrada de `framer-motion` no site do
cliente: `ModalLojaFechada.tsx`, que usa `motion.div` + `AnimatePresence` para
um fade/slide de 250 ms.

O aviso só aparece com a loja fechada — todo visitante pagava a biblioteca por
algo que a maioria nunca vê.

**Duas medições decidiram a solução, e a primeira derrubou a opção óbvia:**

| Experimento | Resultado |
| --- | --- |
| baseline | 16 chunks · 391 kB gzip |
| `next/dynamic` no componente | 18 chunks · **393 kB** — piorou |
| componente removido (só para medir) | 15 chunks · 348 kB |
| **entregue: animação em CSS** | 15 chunks · **349 kB** |

`next/dynamic` não serve aqui porque o Next pré-carrega o chunk dinâmico no HTML
inicial. Sem a medição, essa teria sido a correção — e não teria corrigido nada.

`animate-slide-up` já existia no `tailwind.config.js` e já é o idioma do projeto
para banner fixo: `PWAManagerAdmin`, `PWAManagerGarcom` e `PWAManagerEntregador`
usam a **mesma estrutura de className**. `ModalLojaFechada` era o único fora do
padrão. Só a saída precisou de keyframe novo (`slide-down-out`).

A desmontagem adiada — o que o `AnimatePresence` fazia — virou máquina de
estados com `animationend` **e** timeout de rede: se a animação não rodar (aba
em segundo plano, motion reduzido, navegador que pula), `animationend` nunca
chega e o aviso ficaria montado para sempre.

**Nota:** a entrada passa de 250 ms para os 500 ms de `animate-slide-up`, que é
o valor dos três banners irmãos. Foi escolha de reuso (§5), não descuido.

### D6 — object URL nunca revogada no upload do Admin

`comprimirImagem` (`src/lib/backblaze.ts`) fazia `URL.createObjectURL(arquivo)`
e tinha **quatro** saídas — `onerror`, canvas sem contexto, blob nulo e o
sucesso — sem `revokeObjectURL` em nenhuma. A object URL prende o `File`
original no blob URL store até a aba morrer; no Admin, que é SPA longeva, cada
imagem editada ficava presa (limite de upload: 5 MB, 15 MB nas pastas com
texto).

Era o **único** `createObjectURL` do `src/` sem revogação — os outros oito já
revogavam. `concluir`/`falhar` tornam a revogação estrutural: não há como sair
da função sem passar por uma das duas.

**Sem teste de regressão, e por quê** (exigido pelo §0.5): a função depende de
`Image`, `document.createElement('canvas')` e `canvas.toBlob`. O projeto não tem
DOM em teste, o §3.4 proíbe teste de browser e adicionar jsdom seria dependência
nova (§3.2). A verificação foi leitura do diff mais a comparação com os outros
oito pontos da base. Inventar uma abstração só para ter o que testar seria
simular TDD, que o §0.5 proíbe explicitamente.

## Fora de escopo

- trocar o provedor de armazenamento;
- reprocessar em massa as imagens já gravadas (os dois banners pesados são
  corrigidos pela rota, sem reupload);
- redesenho do hero, do cartão ou do catálogo;
- os 349 kB gzip restantes: react-dom, `@supabase/supabase-js` + phoenix
  (realtime, com 5 canais na home) e o runtime do Next. Nenhum é removível sem
  mudar o desenho da página;
- `tailwindcss-animate` **não está instalado** e `plugins: []`, então
  `animate-in`, `fade-in-0` e `zoom-in-95` no `src/components/ui/dialog.tsx` não
  geram CSS nenhum — os diálogos do projeto não têm animação de entrada/saída.
  Defeito pré-existente, encontrado nesta investigação, **não corrigido aqui**.
