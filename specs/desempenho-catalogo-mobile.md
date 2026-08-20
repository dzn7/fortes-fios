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

## Fora de escopo

- trocar o provedor de armazenamento;
- reprocessar em massa as imagens já gravadas (os dois banners pesados são
  corrigidos pela rota, sem reupload);
- redesenho do hero, do cartão ou do catálogo;
- redução do bundle de 390 kB gzip — medido e registrado, não atacado aqui.
