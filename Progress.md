# Progress

## [2026-08-21] Correção: o link do produto abre a loja, não uma tela solta

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Spec:** `specs/pagina-publica-produto.md`
**Arquivos alterados:** `src/app/produto/[slug]/page.tsx`, `src/components/produto/ModalProduto.tsx`, `src/components/produto/DetalheProduto.tsx`, `tests/cupom-formulario.test.mjs`, `specs/pagina-publica-produto.md`, `UI.md`, `Progress.md`
**Removidos:** `src/components/produto/BarraProduto.tsx` — era a barra da tela solta, criada na mesma sessão e obsoleta com a correção

**O que estava errado.** O link direto abria uma tela separada: cartão do produto
sozinho, sem vitrine atrás, sem busca, sem as outras categorias, e "voltar ao
catálogo" como clique obrigatório. Tirava a pessoa da loja bem no momento em que
ela acabava de chegar por um link compartilhado.

Agora `/produto/[slug]` renderiza **o catálogo com o produto por cima** — o mesmo
que o clique dentro do site entrega. A rota interceptada continua servindo o
clique, em que o catálogo já está montado e não precisa remontar.

Fechar passou a depender de como se chegou: pela interceptação, `router.back()`
devolve à página e à rolagem exatas; pelo link direto, `router.push('/')`, porque
não há catálogo na pilha e `back()` jogaria quem veio do WhatsApp para fora do
site.

**Limitação registrada:** o `DialogPortal` do Radix só monta no cliente, então o
HTML servido traz o catálogo mas não o produto expandido — no link direto o
produto aparece depois da hidratação. Conferido no HTML servido: `id="catalogo"`
e a busca presentes, `role="dialog"` ausente.

**O teste do cupom, corrigido.** `validade no passado é recusada` calculava
"ontem" com `toISOString()` (UTC) enquanto o validador compara
`${validade}T23:59:59` em **hora local**. Entre 21h e a meia-noite no UTC-3,
"ontem UTC" ainda é hoje local, o limite caía no futuro e o teste falhava — só
nessa janela de três horas, o que fazia parecer instabilidade aleatória. A
correção calcula a data no fuso local. Verificado às **21h28**, dentro da janela
em que falhava: vermelho → verde.

**Verificação:** `tsc --noEmit` ✓ 0 erros · build ✓ (rotas `ƒ /produto/[slug]` e
`ƒ /(.)produto/[slug]`) · `node --test` **343/343** — a suíte inteira verde ·
link direto servido em servidor local: **HTTP 200** com `id="catalogo"`, a busca
da home e o carrossel de categorias no HTML, sem resquício da tela solta, e
`og:image`/`title` preservados
**Pendências / próximos passos:** `ModalIngredientes.tsx` segue no repositório
(§3.7) sem ninguém abri-lo. Se o atraso do produto no link direto incomodar, dá
para servir o conteúdo do produto no HTML em vez de esperar a hidratação — é
mudança de moldura, não de dado.
**Armadilhas descobertas:** `role="dialog"` ausente do HTML servido **não** é
defeito de renderização: portal do Radix não existe no servidor. Confundir isso
com bug levaria a caçar um problema que não existe.

## [2026-08-21] Página pública do produto, com link próprio e quantidade

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Spec:** `specs/pagina-publica-produto.md`
**Arquivos alterados:** `src/app/layout.tsx`, `src/components/CartaoProduto.tsx`, `src/app/admin/produtos/page.tsx`, `UI.md`, `Progress.md`
**Criados:** `src/lib/link-produto.mjs` (+`.d.mts`), `src/lib/server/produto-publico.ts`, `src/app/produto/[slug]/page.tsx`, `src/app/@modal/default.tsx`, `src/app/@modal/(.)produto/[slug]/page.tsx`, `src/components/produto/DetalheProduto.tsx`, `src/components/produto/ModalProduto.tsx`, `src/components/produto/BarraProduto.tsx`, `src/components/admin/produtos/BotaoCopiarLinkProduto.tsx`, `tests/link-produto.test.mjs`, a spec

### O formato do link — decidido com o usuário (§7)

```
/produto/creme-de-pentear-3-em-1-500ml-toque-final-9ceea5e4-…-d89bcb22b7ce
```

O nome é decoração; **quem identifica é o uuid no fim**. Ganhos: nenhuma
migração, e **renomear o produto não quebra link já compartilhado**. A
alternativa (coluna `slug` + índice único) foi apresentada e descartada pelo
usuário — link curto, mas migração em produção e o dilema do link antigo ao
renomear.

### O que a skill `supabase-postgres-best-practices` disse aqui

Plano medido em produção **antes** de escrever código:

```
Index Scan using produtos_pkey  (cost=0.27..2.49 rows=1)
  Buffers: shared hit=3         Execution Time: 1.305 ms
```

A regra `query-covering-indexes` mira 2–5× em consulta com heap fetch pesado;
com 3 buffers **não há o que ganhar**. Conclusão registrada: **nenhum índice
novo, nenhuma migração**. `data-pagination` não se aplica (uma linha só). Pela
`security-privileges` + §3.9, a leitura é server-side e a lista de colunas é
fechada — `custo_unitario` fica de fora de propósito.

**Decisões tomadas:** (1) Rotas interceptadas do App Router: clicar expande por
cima do catálogo sem remontar a lista; recarregar cai na página inteira. Mesmo
endereço, moldura diferente. (2) `DetalheProduto` é o mesmo componente nas duas
molduras — dois arquivos e um sairia do ar sem ninguém notar. (3) A barra da
página é própria e **não** reusa o `Header`, que exige busca, categorias e
manipuladores de pedido: acoplaria as duas telas para ganhar um cabeçalho. (4)
`disponivel = false` → 404, porque é o interruptor com que o Admin tira o
produto do catálogo; esgotado é outra coisa e a página existe mostrando
"Esgotado". (5) Sem `import 'server-only'`: o pacote não está instalado e
acrescentá-lo seria dependência nova (§3.2).

**Verificação:** `tsc --noEmit` ✓ 0 erros · build ✓ (rotas `ƒ /produto/[slug]` e
`ƒ /(.)produto/[slug]` registradas) · `node --test` **342/343** · servidor local
exercitado contra a produção: produto real **HTTP 200**, slug inválido **404**,
uuid inexistente **404**, `/`, `/contato`, `/admin/login` e `/garcom/login` **200**,
e a home sem nenhum diálogo injetado pelo slot vazio · `og:title`,
`og:description`, `og:image` e `twitter:card` conferidos no HTML servido
**Pendências / próximos passos:** `ModalIngredientes.tsx` continua no
repositório (§3.7) mas nada mais o abre — o cartão agora navega. Remover é
decisão do usuário.
**Armadilhas descobertas:** (1) O 404 inicial na página do produto **não era do
código**: um `next start` de tarefa anterior seguia vivo na porta e servia o
build velho. Só ver o log do servidor mostrou isso — depurar a camada errada
custaria caro. (2) O teste `validade no passado é recusada` foi diagnosticado:
ele calcula "ontem" em **UTC** (`toISOString`), e o validador compara em **hora
local**; entre 21h e meia-noite no UTC-3, "ontem UTC" é "hoje local" e o teste
falha. Falha idêntica no HEAD limpo. Correção é 1 linha no teste, mas está fora
do escopo desta task.

## [2026-08-20] Paginação numerada do catálogo e cupom visível no pedido

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Specs:** `specs/paginacao-catalogo-cliente.md` · `specs/cupom-no-pedido-admin.md`
**Arquivos alterados:** `src/app/page.tsx`, `src/features/pedidos/components/PaginacaoPedidos.tsx`, `src/components/admin/CardPedido.tsx`, `src/components/admin/ModalDetalhesPedido.tsx`, `src/app/admin/pedidos/page.tsx`, `src/app/admin/dashboard/page.tsx`, `UI.md`, `Progress.md`
**Criados:** `src/lib/paginacao.mjs` (+`.d.mts`), `src/lib/cupom-pedido.mjs` (+`.d.mts`), `src/components/PaginacaoCatalogo.tsx`, `tests/paginacao.test.mjs`, `tests/cupom-pedido.test.mjs`, as duas specs
**Removidos:** `src/lib/paginacao-catalogo.mjs` (+`.d.mts`) e `tests/paginacao-catalogo.test.mjs` — a rolagem infinita da rodada anterior, recusada pelo usuário e substituída aqui

### Paginação

A rolagem infinita entregue na rodada anterior foi recusada: lista que não acaba
não deixa a pessoa saber onde está nem voltar a um ponto. Trocada por paginação
numerada, no desenho da paginação do Admin.

**Paginar na tela, não no banco.** A skill `supabase-postgres-best-practices`
(`data-pagination`) recomenda keyset em vez de `OFFSET` — e isso vale para
paginação **no banco**. Aqui a decisão certa foi não introduzir query paginada
nenhuma: a home precisa da lista inteira em memória para a busca, os filtros, a
ordenação, a contagem de ofertas dentro do filtro e para os carrosséis
resolverem ids. Com `range`, cada um viraria ida ao servidor. São 505 produtos e
368 kB de JSON (≈60–80 kB comprimidos) numa requisição só, e o custo que a
pessoa sentia era de renderização. Limiar registrado na spec: acima de ~2 000
produtos a conta muda.

**24 por página, não 25.** A grade é `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`;
24 divide exato por 2, 3 e 4, e 25 deixa órfão nos três tamanhos.

`criarItensPaginacao` vivia presa dentro de `PaginacaoPedidos.tsx`. Este foi o
segundo uso, então subiu para `src/lib/paginacao.mjs` — "generalizar o
existente" (§5), e agora está ao alcance do `node --test`. O Admin passou a
consumi-la, sem mudança de comportamento.

### Cupom

O pedido já gravava `cupom_id`, `cupom_codigo`, `tipo_desconto_cupom` e
`desconto_cupom`, e nada aparecia no Admin. Em produção, **4 dos 11 pedidos**
usaram cupom.

**`desconto_cupom` guarda o valor em REAIS já calculado, não o percentual** —
conferido: 40 − 2 = 38, 60 − 3 = 57, 48 − 2,4 = 45,6, 54,5 − 2,73 = 51,77. O
percentual original não é gravado no pedido, então a tela mostra o código e o
valor descontado; exibir porcentagem exigiria inventar.

**Decisões tomadas:** (1) Selo de cupom em `outline`, ao lado do de presente que
é preenchido — quando os dois aparecem juntos (acontece em pedido real), dá para
ler os dois. (2) O cupom aparece mesmo com desconto zero: ter usado cupom é o
fato que explica o total. (3) Código ausente com desconto presente mostra
"Cupom" sem nome, em vez de esconder a linha e deixar a conta sem explicação.

**Verificação:** `tsc --noEmit` ✓ 0 erros · build limpo ✓ ·
`node --test tests/*.test.mjs` **331/331** · a janela de páginas é conferida por
invariante sobre **todas** as combinações até 60 páginas, não por casos isolados ·
o `select` novo foi executado contra a produção pelo PostgREST e o resultado
passado pelo módulo: `subtotal − desconto = total` bate nos 3 pedidos ·
lint indisponível (`next lint` saiu no Next 16)
**Pendências / próximos passos:** **Achado, não corrigido:** o `select` do
`/admin/pdv` não traz `presente` **nem** os campos de cupom, embora renderize o
mesmo `CardPedido` — o selo de presente já não aparecia lá antes desta task.
Corrigir é uma linha, mas está fora do escopo pedido; decisão do usuário.
**Armadilhas descobertas:** `TicketPercent` **não existe** no `lucide-react`
instalado — conferido em runtime antes de importar, senão teria quebrado o
build. Usei `Ticket`. `BadgePercent`, que existe, já é o ícone das taxas no
mesmo modal, então reusá-lo para cupom confundiria.

## [2026-08-20] Bundle da home e vazamento de object URL no upload

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Spec:** `specs/desempenho-catalogo-mobile.md` (§Segunda rodada)
**Arquivos alterados:** `src/components/ModalLojaFechada.tsx`, `tailwind.config.js`, `src/lib/backblaze.ts`, `specs/desempenho-catalogo-mobile.md`, `UI.md`, `Progress.md`
**Orçamento:** previsto 3 arquivos de código (ModalLojaFechada, page.tsx, backblaze) — gastos 3, mas `page.tsx` não precisou mudar e `tailwind.config.js` entrou no lugar. Dentro do orçamento.

**A medição derrubou a correção óbvia.** A varredura transitiva de imports
(71 arquivos a partir de `page.tsx` + `layout.tsx`) mostrou **um único** ponto de
entrada de `framer-motion` no site do cliente: `ModalLojaFechada`, um banner de
aviso que só aparece com a loja fechada.

| Experimento | Resultado |
|---|---|
| baseline | 16 chunks · 391 kB gzip |
| `next/dynamic` no componente | 18 chunks · **393 kB — piorou** |
| componente removido (só para medir o teto) | 15 chunks · 348 kB |
| **entregue: animação em CSS** | 15 chunks · **349 kB** |

`next/dynamic` era a resposta óbvia e **não funciona aqui**: o Next pré-carrega o
chunk dinâmico no HTML inicial. Sem medir, teria sido a correção — e não teria
corrigido nada.

O reuso veio de graça: `animate-slide-up` já existe no `tailwind.config.js` e os
três `PWAManager` usam a **mesma estrutura de className** para banner fixo.
`ModalLojaFechada` era o único fora do padrão. Só a saída precisou de keyframe
novo.

**O vazamento:** `comprimirImagem` criava object URL e tinha **quatro** saídas
sem revogar nenhuma — a URL prende o `File` original no blob URL store até a aba
morrer, e o Admin é SPA longeva. Era o único `createObjectURL` do `src/` sem
`revokeObjectURL`; os outros oito já revogavam.

**Decisões tomadas:** (1) Entrada passa de 250 ms para os 500 ms de
`animate-slide-up` — escolha de reuso (§5) para alinhar com os três banners
irmãos, não descuido. (2) A saída virou máquina de estados com `animationend`
**e** timeout de rede: sem o timeout, animação que não roda (aba em segundo
plano, motion reduzido) deixaria o aviso montado para sempre. (3) Não usei o
`Dialog` do projeto: isto é banner (`role="status"`, `aria-live="polite"`), e o
Dialog prenderia foco e criaria overlay.

**Verificação:** `tsc --noEmit` ✓ 0 erros · build limpo (`rm -rf .next`) ✓ ·
`node --test tests/*.test.mjs` **316/316** · marcadores de framer-motion nos 15
chunks JS da home: **0** · CSS conferido no bundle
(`@keyframes slideDownOut` e `.animate-slide-down-out{animation:.25s ease-in forwards}`) ·
lint indisponível (`next lint` saiu no Next 16, sem config de ESLint)
**Pendências / próximos passos:** Os 349 kB restantes são react-dom,
`@supabase/supabase-js` + phoenix (5 canais realtime na home) e o runtime do
Next — nenhum removível sem mudar o desenho da página. **Achado novo, não
corrigido:** `tailwindcss-animate` não está instalado e `plugins: []`, então
`animate-in`/`fade-in-0`/`zoom-in-95` no `src/components/ui/dialog.tsx` não geram
CSS — os diálogos do projeto não animam. Fora do escopo desta task.
**Armadilhas descobertas:** (1) Marcador textual em chunk minificado **não** mede
peso: inferi ~100 kB de framer-motion por `grep` em chunks mistos e o valor real
era 42 kB. Só o experimento de remoção mede. (2) O teste
`validade no passado é recusada` que falhava ontem passou hoje sem eu tocar nele
— era dependente da data corrente, como eu havia diagnosticado. (3) `comprimirImagem`
segue sem resolver a promise se nem `onload` nem `onerror` dispararem; é
pré-existente e ficou fora do escopo.

## [2026-08-19] Lentidão do site do cliente no celular

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Spec:** `specs/desempenho-catalogo-mobile.md`
**Arquivos alterados:** `src/app/api/upload/route.ts`, `src/lib/imagem-publica.mjs`, `src/lib/backblaze.ts`, `src/components/HeroVitrine.tsx`, `src/app/page.tsx`, `tests/imagens-publicas.test.mjs`, `UI.md`, `Progress.md`. **Criados:** `src/lib/dimensoes-imagem.mjs` (+`.d.mts`), `src/lib/paginacao-catalogo.mjs` (+`.d.mts`), `tests/dimensoes-imagem.test.mjs`, `tests/paginacao-catalogo.test.mjs`, `specs/desempenho-catalogo-mobile.md`.

**O diagnóstico saiu de medição, não de palpite.** Produção, 2026-08-19: 505
produtos disponíveis, 14,1 MB de fotos de produto (mediana 23 kB) e **5,6 MB de
banners** — dos quais dois sozinhos somam 3,0 MB.

O banner mais pesado tem 1 893 kB para 960×1200. Os banners 1–3, de dimensão
idêntica, têm 36–110 kB. A diferença estava nos bytes:

```
$ curl -s -r 0-11 ".../vitrine/…_cgt9wq.webp" | xxd
00000000: 8950 4e47 0d0a 1a0a 0000 000d            .PNG........
```

Nome `.webp`, `Content-Type: image/webp`, **bytes PNG**. `canvas.toBlob` cai para
`image/png` quando o navegador não sabe codificar WebP — e PNG ignora o argumento
de qualidade. O upload afirmava `type: 'image/webp'` sem conferir `blob.type`, e a
mentira viajou até o CDN.

**Quatro defeitos, todos no caminho do que o cliente reclamou:**

| | Defeito | Efeito medido |
|---|---|---|
| D1 | Upload afirma WebP sem conferir o que o canvas devolveu | 2 banners PNG de 1,9 MB e 1,15 MB |
| D2 | `GET /api/upload` ignorava `w` e `q` | nenhuma imagem redimensionada; 15 larguras por foto devolvendo o arquivo cheio, cada uma pagando um miss frio de cache |
| D3 | Hero não declarava largura nenhuma | arte inteira num aparelho de 390 px |
| D4 | 505 cartões montados no primeiro quadro | 505 `<img>` com `srcset` de 15 URLs e 505 raízes de `Dialog` |

**Resultado, medido ponta a ponta contra as imagens reais de produção:**

- hero no celular: **3 231 kB → 222 kB (93% menor)**;
- primeiro lote do catálogo: **1 368 kB → 527 kB (61% menor)**;
- o banner de 1 893 kB vira 62 kB em `w=640` e 94 kB em `w=828`, agora WebP de verdade.

**Decisões tomadas:** (1) A rota continua sendo um proxy — ela existe para
absorver o 503 transitório do Backblaze (spec `hero-responsivo-imagens-resilientes`),
e falha do `sharp` devolve o original em vez de quebrar. (2) `w` só é aceito
dentro de uma lista fechada; largura arbitrária abriria chave de cache e
invocação serverless novas a cada requisição. (3) As duas imagens pesadas **não
foram reenviadas**: a rota as corrige na entrega, e o defeito de origem foi
fechado para não gerar novas. (4) O catálogo pagina com sentinela **e** botão —
o botão é o caminho de quem usa teclado ou leitor de tela.

**Verificação:** `tsc --noEmit` ✓ 0 erros · `npm run build` ✓ · `node --test tests/*.test.mjs` 315/316 · rota exercitada contra as imagens reais de produção em servidor local ✓
**Pendências / próximos passos:** O JS da home tem 390 kB gzip — medido e registrado, **não atacado** nesta task. `comprimirImagem` nunca faz `URL.revokeObjectURL` do blob que cria (vazamento no upload do Admin); fica anotado, fora do escopo daqui.
**Armadilhas descobertas:** O `Content-Type` gravado no bucket **não é confiável** — quem decide o formato de saída é o `sharp`, lendo os bytes. E o teste `validade no passado é recusada` (`tests/cupom-formulario.test.mjs`) já falhava no HEAD limpo: depende da data corrente, não desta mudança.

## [2026-08-18] A ordem das categorias salva no Admin não chegava ao site

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Spec:** `specs/ordem-categorias-persistencia.md`
**Arquivos alterados:** `src/lib/ordem-categorias.mjs`, `src/app/admin/produtos/page.tsx`, `tests/ordem-categorias.test.mjs`, `UI.md`, `Progress.md`. **Criado:** `specs/ordem-categorias-persistencia.md`.

**O diagnóstico veio dos três prints do usuário — três ordens diferentes.** As
duas fontes, lidas no banco:

| `categorias_cardapio.ordem` (site lê) | `configuracoes_loja` JSON (modal grava) |
|---|---|
| 1 Kits · 2 Reconstrução · 3 Nutrição · 4 Mary Kay | 1 Kits · 2 Ofertas relâmpago · 3 Hidratação · 4 Nutrição |

A primeira bate exatamente com o print do carrossel; a segunda, exatamente com o
print do modal. **Duas gavetas** — o modal salvava de verdade, numa que o site
nunca abre. A chave `ordem_categorias_produtos` é herança da época em que
categoria era só uma string no produto, antes da tabela existir.

Correção: o modal passa a gravar `categorias_cardapio.ordem` (via
`ordenarParaBanco`, testado) e segue atualizando o JSON no mesmo salvamento,
para os dois não divergirem enquanto o legado existir.

**A borda que os dados revelaram:** a tabela tinha **11** categorias e a lista
do modal, **10** — faltava "Mary Kay". Se a linha de fora mantivesse a `ordem`
antiga, duas categorias ficariam com o mesmo número e quem decidiria a posição
no site seria o desempate do `order by`, que é a doença de origem. Toda linha da
tabela recebe numeração contígua; as não citadas entram no fim.

**Decisões tomadas:**
- **`categorias_cardapio.ordem` é a fonte da verdade**, não o JSON. É coluna da
  tabela real e é o que a API pública já consulta; ensinar o site a ler a chave
  de configuração manteria a coluna como segunda verdade desatualizada.
- **Escrita client-side**, como o resto da tela: `categorias_cardapio` já é
  criada, renomeada e apagada pelo cliente ali, e `anon` já tem `UPDATE`. Mover
  só a ordenação para route handler não reduziria exposição e deixaria dois
  padrões na mesma tela.
- **Corrigi o dado de produção** aplicando a ordem que o usuário já havia
  escolhido no modal — o estado inconsistente era artefato do bug. 11 linhas,
  1..11, sem repetição, conferido depois.

**Sobre o ícone no mesmo relato:** já estava corrigido no commit `3dc7e3d`, que
**não tinha sido publicado** quando os prints foram tirados. Confere: o
carrossel mostrava `Tag` para "Reconstrução" (palpite por nome antigo) enquanto
o menu do Header — que já lia o valor gravado — mostrava o ícone certo. Os dados
de `icone` estavam corretos o tempo todo.

**Verificação:** RED→GREEN em duas rodadas (a segunda descobriu a borda do
"Mary Kay") · `node --test tests/*.test.mjs` **293/293** · `npx tsc --noEmit` ✓ ·
`npm run build` ✓ · `ordenarParaBanco` rodado contra as 11 linhas reais do banco:
cobertura total e zero ordem repetida · ordem aplicada e reconferida no banco.

**Pendências / próximos passos:**
- 🟡 `configuracoes_loja.ordem_categorias_produtos` continua sendo escrita como
  espelho. Aposentá-la exige tirar `ordenarCategoriasPorPreferencia` do
  `page.tsx` do Admin — tarefa própria.
- 🟡 Categoria ativa **sem produto** aparece no site (a API lista todas as
  ativas) e **não** aparece no modal (a lista do Admin deriva dos produtos).
  Não é o bug relatado, mas é a mesma família.

**Armadilhas descobertas:**
- **Dois armazenamentos para o mesmo conceito só aparecem quando um dos dois
  muda.** O modal "funcionava" — gravava, relia, exibia. Só comparando com o
  que o *site* lê é que a divergência apareceu.
- Teste que codifica contrato incompleto vira obstáculo: quatro asserções
  minhas afirmavam que categoria fora da lista era omitida, e precisaram ser
  corrigidas quando a completude virou requisito.


## [2026-08-18] Ícone da categoria não aparecia no site + catálogo de 12 para 24

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Spec:** `specs/icone-categoria.md`
**Arquivos criados:** `src/components/icons/IconeCategoria.tsx`, `specs/icone-categoria.md`.
**Arquivos alterados:** `src/app/page.tsx`, `src/lib/categorias.mjs`, `src/components/admin/produtos/SeletorIconeCategoria.tsx`, `src/components/Header.tsx`, `src/components/admin/produtos/ModalOrdemCategorias.tsx`, `src/app/admin/produtos/page.tsx`, `tests/categorias.test.mjs`, `UI.md`, `Progress.md`.

**O bug.** O Admin gravava `categorias_cardapio.icone`, a API devolvia o campo, e
o carrossel do site **não olhava para ele**: chamava um `obterIconeCategoria`
que adivinhava pelo NOME. O mesmo arquivo já tinha o memo certo — com o
comentário "para o menu mostrar o mesmo símbolo escolhido no Admin" — mas ele só
ia para o `Header`. Trocar o ícone mudava o menu hambúrguer e não mudava o
carrossel, que é a tela que o cliente vê.

Correção: o valor gravado vence, e `sugerirIconePorNome` (que já existia no
domínio) vira a rede para categoria sem escolha. `obterIconeCategoria` saiu.

**O catálogo.** De 12 para 24 ícones, e os dados de produção mostravam por que:
"Hidratação" estava com `etiqueta` (a etiqueta genérica), "Finalizadores" e
"Acessórios" com `maquiagem`, "Cabelos oleosos, caspa, antiqueda" com `liso`.
Havia ainda `pele` mapeado para o ícone **`Gift`** (presente) — sem relação
nenhuma. Só `lucide-react`, que já é dependência.

**Decisões tomadas:**
- **Nenhum id antigo removido.** Há categorias no banco apontando para os 12
  originais; sumir com um faria `iconeValido` devolver o padrão e a categoria
  perderia o ícone em silêncio. Tem teste para isso.
- **Específico antes do genérico no catálogo**, porque `sugerirIconePorNome`
  devolve o primeiro que casar — senão "Hidratação" continuaria caindo em
  `tratamento` e o ícone novo nunca seria sugerido. O comentário que descrevia a
  ordem estava invertido em relação ao que o código fazia; corrigido.
- **`IconeCategoria` mudou de `admin/produtos/` para `components/icons/`.** O
  `Header` do site importava de dentro da pasta do Admin — sintoma de que a peça
  estava no lugar errado.
- **Removi `normalizarCategoriaFortesFios` de `page.tsx`**, que ficou sem
  chamador: a filtragem passou para `chaveTexto` na task dos filtros, e o
  palpite de ícone saiu agora.

**Verificação:** RED nos 4 testes novos → GREEN, com os 11 antigos intactos ·
`node --test tests/*.test.mjs` **284/284** · `npx tsc --noEmit` ✓ ·
`npm run build` ✓ · um teste percorre as **11 categorias reais da loja** lidas do
banco · os 24 ícones renderizados pelos componentes React reais e
**inspecionados visualmente** (a primeira tentativa, que extraía o SVG na mão,
desenhou vários ícones quebrados — foi descartada por isso).

**Pendências / próximos passos:**
- 🟡 Seis categorias reais ainda têm gravado o ícone que o catálogo antigo
  forçou (Hidratação → `etiqueta`, Finalizadores/Acessórios → `maquiagem`,
  oleosos/caspa → `liso`, Reconstrução/Nutrição → `tratamento`). O código já
  exibe o valor gravado corretamente; o valor é que está ruim. Repicar é decisão
  de conteúdo — não mexi nos dados.
- 🟡 `Acessórios` (Gem) e `Pele e corpo` (Hand) são os dois em que menos confio
  depois de ver renderizados; os outros 22 ficaram claros.

**Armadilhas descobertas:**
- **Componente lucide não é função**, é `forwardRef` — `Comp({})` explode. Para
  renderizar fora do React, `renderToStaticMarkup(createElement(Icone))`.
- **Extrair `d` de SVG com regex desenha ícone errado sem avisar.** A primeira
  grade saiu com Cachos em branco e Etiqueta virando um ponto; se eu tivesse
  julgado por ela, teria trocado ícones que estavam certos.
- **`qlmanage -s` corta a última coluna** de um SVG largo. Conferir o conteúdo do
  arquivo, não só a imagem.


## [2026-08-18] 🔴 Crash do Realtime na home + modal de ordem das categorias

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Specs:** `specs/canal-realtime-unico.md` · `specs/ordem-categorias-modal.md`
**Arquivos criados:** `src/lib/canal-realtime.mjs`, `src/lib/ordem-categorias.mjs`, `src/components/admin/produtos/ModalOrdemCategorias.tsx`, `tests/canal-realtime.test.mjs`, `tests/ordem-categorias.test.mjs`, as 2 specs.
**Arquivos alterados:** `src/lib/useStatusLoja.ts`, `src/app/admin/produtos/page.tsx`, `UI.md`, `Progress.md`.

### 1. 🔴 O erro que derrubava a loja (reportado pelo usuário)

```
Uncaught Error: cannot add `postgres_changes` callbacks for
realtime:configuracoes-loja-1787062157414 after `subscribe()`.
```

Duas peças do `supabase-js` 2.112.2, transcritas do bundle:

```js
channel(nome) { const t = `realtime:${nome}`
                const existente = this.getChannels().find((c) => c.topic === t)
                if (existente) return existente }        // ← reaproveita
on(evento)    { if ((isJoined() || isJoining()) && evento === 'postgres_changes')
                  throw Error('cannot add …') }          // ← recusa
```

`useStatusLoja` nomeava o canal `configuracoes-loja-${Date.now()}`. O sufixo
**não** garante unicidade: o hook tem 4 consumidores e **3 montam juntos na
home** (`page.tsx`, `Header`, `ModalCarrinho`), no mesmo commit do React, logo
no mesmo milissegundo. O segundo `.on()` recebia o canal do primeiro, já em
`joining`, e lançava de dentro do efeito — sem captura, o React desmontava a
árvore.

**Não é corrida, é determinístico.** E explica por que só o site do cliente
quebrava: no admin há um único consumidor (`ControleStatusLoja`).

Correção: `topicoUnico()` com contador de módulo — não depende da resolução do
relógio. Mais `try/catch` na criação do canal: as configurações já vieram por
`carregarConfiguracoes`, então sem realtime a loja só perde atualização ao
vivo. Derrubar a vitrine por causa de um canal é a troca errada.

**Prova (modelo fiel das duas funções da lib, 3 consumidores no mesmo ms):**

```
ANTES : { quebrou: 'Header', mensagem: 'cannot add `postgres_changes` …' }
DEPOIS: { quebrou: null, canais: 3 }
```

### 2. Modal de ordem das categorias

`/admin/produtos` já tinha reordenação, escondida no "Detalhar", com quatro
defeitos que produzem justamente os bugs de UI que o usuário pediu para evitar:

1. `Reorder.Group` de produtos **dentro** de um `Reorder.Item` de categoria —
   arrastar produto arrastava a categoria;
2. `axis="y"` num `lg:grid-cols-2` — arrasto vertical em layout de duas colunas;
3. scroll dentro de scroll;
4. `touch-none` na linha inteira.

O modal novo faz **uma tarefa só**: ordem das categorias, lista plana, um único
container de rolagem. Superfície pelo `Dialog variant="responsive"` que o
projeto já tem (Radix no desktop, Drawer vaul no mobile, overlay resolvido por
`overlay-layer`) — nenhum componente de modal novo, nenhuma dependência nova.

**Decisões tomadas:**
- **Setas são o mecanismo principal; arrasto é conveniência de desktop.** No
  mobile a superfície é um Drawer vaul, que tem o próprio gesto de arrastar —
  lista arrastável ali disputa o gesto com o drawer e com o scroll.
- **`dragListener={false}` + `useDragControls`**, conferido no fonte
  (`render/html/use-props.mjs`): o framer-motion só escreve
  `touch-action: pan-*` quando `dragListener !== false`. Com o listener
  desligado ele não toca em `touch-action`, e o arrasto nasce só do punho. É
  exatamente o defeito 4 acima, invertido.
- **Confirmação de descarte no rodapé, não num segundo diálogo.** Empilhar
  `AlertDialog` sobre Drawer é a classe de bug de overlay que o modal existe
  para não ter.
- **A lista de categorias do "Detalhar" deixou de ser arrastável** e virou
  `<div>`. Não é remoção de recurso — é onde os defeitos 1 e 2 moravam; sem o
  grupo externo, o arrasto dos produtos passa a ser o único da tela.
- **Removi `aoReordenarCategorias`**, que ficou órfã com essa troca. Era a única
  chamadora do `Reorder.Group` externo.

**Verificação:** RED→GREEN nos dois módulos novos · `node --test tests/*.test.mjs`
**279/279** · `npx tsc --noEmit` ✓ · `npm run build` ✓ · classes Tailwind do
modal conferidas no CSS emitido (`max-h-[90dvh]`, `size-9`, `cursor-grabbing`,
`overscroll-contain`) · reprodução red/green do crash de realtime.

**Pendências / próximos passos:**
- 🔴 **Não verifiquei o modal na tela.** A extensão do Chrome não estava
  conectada nesta sessão. Markup, tipos, build e CSS conferidos; aparência e
  gesto, não.
- 🟡 `` `algo-${Date.now()}` `` continua em **12 outros canais**. Conferidos um
  a um: nenhum quebra hoje, todos têm um consumidor montado por vez
  (`ModalAbrirCaixa` importa só um `type` de `useCaixa`, não o hook). São
  armadilhas latentes — basta um segundo consumidor. Trocar os 12 é tarefa
  própria (§0.2.2).

**Armadilhas descobertas:**
- **`supabase.channel(nome)` não cria canal novo** quando o tópico já existe —
  devolve o existente. Somado ao `.on()` que recusa canal assinado, `Date.now()`
  como sufixo de unicidade é uma armadilha, não uma solução.
- **Efeitos do mesmo commit do React compartilham o milissegundo.** Qualquer
  unicidade baseada em relógio falha entre irmãos montados juntos.
- **`$(find ...)` multi-linha quebra em loop de shell.** Segunda vez neste
  projeto; usar `find -print0 | xargs -0`.


## [2026-08-18] Acesso `dzndev`, exclusão de acesso órfã, filtros do catálogo e pedido-presente

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Specs:** `specs/acesso-desenvolvedor.md` · `specs/exclusao-acesso-funcionario.md` · `specs/filtros-catalogo-cliente.md` · `specs/pedido-presente.md`
**Arquivos criados:** `src/lib/server/acesso-desenvolvedor.mjs|.d.mts`, `src/lib/filtros-catalogo.mjs|.d.mts`, `tests/acesso-desenvolvedor.test.mjs`, `tests/filtros-catalogo.test.mjs`, `supabase/migrations/202608180001_vincular_acesso_funcionario.sql`, `supabase/migrations/202608180002_pedido_presente.sql`, as 4 specs.
**Arquivos alterados:** `src/lib/server/sessao-admin.ts`, `src/app/api/admin/acessos/route.ts`, `src/lib/autenticacao.ts`, `src/components/admin/GerenciadorFuncionarios.tsx`, `src/app/page.tsx`, `src/lib/whatsapp.mjs|.d.mts`, `tests/whatsapp.test.mjs`, `src/components/ModalCarrinho.tsx`, `src/components/admin/CardPedido.tsx`, `src/app/admin/pedidos/page.tsx`, `src/app/admin/dashboard/page.tsx`, `UI.md`, `Progress.md`.

### 1. `dzndev` / `1503` de volta — mas fora do bundle

A credencial existia dentro de `AdminAuthContext.tsx`, um componente `'use
client'`: a senha era **servida ao navegador de todo visitante**. Voltou como
`src/lib/server/acesso-desenvolvedor.mjs`, importado só por `sessao-admin.ts`,
que só é importado por route handler. Continua hardcoded, como pedido, e o
build confirma **0 ocorrências de `dzndev` em `.next/static/`**.

Perfil sintético com id sentinela `00000000-0000-4000-8000-000000000000`,
reconhecido por `autenticar` (antes do banco) e por `lerSessao` (antes da
consulta). Sem linha em `usuarios_sistema`, logo não aparece na lista de perfis
do login — entra pelo "Entrar com usuário e senha".

**A armadilha:** `acessos_auditoria.ator_id` é FK para `usuarios_sistema(id)`.
Gravar o sentinela levantaria `23503` e derrubaria a operação — criar um acesso
falharia **justamente quando quem cria é o dzndev**. Daí `idAtorParaAuditoria`,
que devolve `null` para ele. Verificado: a linha de auditoria do teste saiu com
`ator_id: null` e o INSERT passou.

### 2. Excluir funcionário deixava o login vivo

Duas telas criam a mesma pessoa (`funcionarios` + `usuarios_sistema`), e a
Equipe apagava só uma. A pessoa sumia da Equipe, **continuava no cartão de
perfis de `/admin/login`** e continuava entrando com a senha antiga.

Antes de culpar a aba de Acessos, rodei o ciclo criar → conferir → apagar →
conferir em `usuarios_sistema` pela Management API: **aquele caminho funciona**.
Nenhum trigger na tabela e nenhuma FK restritiva. O caminho quebrado era o outro.

Havia um segundo defeito que impedia até a correção óbvia: `criarUsuarioSistema`
recebia `funcionarioId` e `corAvatar` e **descartava os dois** ao montar o POST,
e a rota não lia nenhum. O vínculo nunca chegava ao banco — sem ele não há como
achar o login do funcionário. A cor do avatar escolhida no cadastro também era
perdida em silêncio.

Correção: POST grava vínculo e cor; `DELETE /api/admin/acessos` ganha o seletor
`?funcionarioId=`; a Equipe apaga o acesso **antes** do funcionário e aborta se
a exclusão for recusada — melhor não apagar nada do que apagar o cadastro e
deixar o login órfão de novo.

### 3. Filtragem do catálogo do cliente

A regra saiu do `useMemo` de `page.tsx` para `src/lib/filtros-catalogo.mjs`
(28 asserções). Ganhos medidos **sobre o catálogo real** (246 produtos):

| Busca | Antes | Agora |
|---|---|---|
| `mascara` | 1 resultado | **66** |
| `hidratacao` | 0 | **55** |
| `oleo` | 3 | **75** |

A busca era sensível a acento e só olhava `produto.nome` — num teclado de
celular sem acento, isso é o caso comum, não a exceção. Agora é
acento-insensível, multi-termo e alcança descrição e categoria.

Ordenações: Recomendados · **Maiores descontos** · Menor preço · Maior preço ·
Novidades. Mais o filtro **"Só promoções"** (48 dos 246) e um "Limpar".

### 4. Pedido para presente

Coluna `pedidos.presente boolean not null default false`, marcação no carrinho,
linha `🎁 *PEDIDO PARA PRESENTE*` no topo da mensagem do WhatsApp e badge
`primary` no card do admin.

**Decisões tomadas:**
- **Coluna, não `observacoes`.** Aviso escondido em parágrafo não vira badge,
  não vira filtro e não vira contagem.
- **Marca no topo da mensagem, não no rodapé.** A mensagem é lida no celular; o
  aviso que muda o preparo precisa chegar antes de quem lê começar a separar os
  produtos. Pedido comum não ganha linha nenhuma.
- **"Maiores descontos" usa a MESMA regra do `CartaoProduto`** (percentual > 0
  *e* `preco_original` > `preco`). Critério mais frouxo levaria ao topo produtos
  sem tarja no cartão — o cliente veria a promessa e não a promoção.
- **`chaveTexto` substituiu `normalizarCategoriaFortesFios` na filtragem.**
  Provado equivalente sobre as 9 categorias reais do banco: 0 divergências.
- **Apagar, não desativar**, ao excluir funcionário: o verbo da tela é
  "Excluir" e a aba de Acessos já apaga de fato. Duas telas com o mesmo botão e
  efeitos diferentes é como se chega num bug destes.

**Verificação:** RED→GREEN nos três módulos novos (`ERR_MODULE_NOT_FOUND` e
falha de asserção antes) · `node --test tests/*.test.mjs` **255/255** ·
`npx tsc --noEmit` ✓ · `npm run build` ✓ · login `dzndev` ponta a ponta contra o
servidor (senha errada 401, cookie `HttpOnly`, `GET` devolve 41 permissões,
`DZNDEV` com espaços entra) · ciclo real pela API: criar acesso vinculado como
dzndev → `funcionario_id` e `cor_avatar` gravados → `DELETE ?funcionarioId`
devolveu `excluidos: 1` → 0 resíduos, os 3 usuários reais intactos ·
`?funcionarioId` inexistente devolve `excluidos: 0` sem erro, inválido 400, sem
sessão 401 · filtros exercitados sobre os 246 produtos reais · `dzndev` ausente
de `.next/static/`.

**Pendências / próximos passos:**
- 🔴 **`202608180001` (vínculo dos acessos antigos) NÃO foi aplicada** — o
  classificador bloqueou o UPDATE em dados de produção. O ensaio somente-leitura
  mostrou **1 vínculo** a criar: `MARÍLIA GABRYELLE` → funcionário homônimo.
  Enquanto não rodar, excluir a Marília pela Equipe **não** apaga o login dela.
  Acessos criados a partir de agora já nascem vinculados.
- 🔴 `/admin/dev` continua com `dzn`/`1503` **dentro do bundle do navegador**
  (`DEV_PASSWORD` em componente client) — pré-existente, fora do escopo desta
  task, mas é a mesma classe de problema que o §1 resolveu.
- `npm run lint` segue inexecutável no repo (`next lint` saiu no Next 16 e não
  há config de ESLint) — pré-existente.

**Armadilhas descobertas:**
- **A Management API serializa `numeric` como string**; o PostgREST que o
  navegador consome devolve número. Um teste de filtro contra a Management API
  acusou "0 ofertas" quando o catálogo tem 48. Conferir tipo na fonte certa
  antes de acreditar no resultado.
- **`assert.ok(texto.indexOf(x) < texto.indexOf(y))` passa por vácuo:**
  `indexOf` devolve `-1` quando não acha, e `-1` é menor que qualquer posição.
  Três dos quatro testes de presente passaram no RED até eu exigir `>= 0`.
- **`"      setObservacoes('')"` contém `"    setObservacoes('')"`.** Substituir
  por texto com indentação exige âncora de contexto, não só a linha.
- Grant por coluna e FK `on delete set null` deixam o `DELETE` passar — o que
  parecia bloqueio de banco era ausência de código.


## [2026-08-17] TikTok nas redes do menu e aviso de parcelamento no carrinho

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Arquivos criados:** `src/components/icons/IconeTikTok.tsx`.
**Arquivos alterados:** `src/components/Header.tsx`, `src/components/ModalCarrinho.tsx`, `UI.md`, `Progress.md`.

**TikTok.** Glifo oficial como SVG próprio, na mesma forma do `IconeWhatsApp`
(monocromático em `currentColor`), porque o `lucide-react` não traz marcas. Entra
como terceiro link do rodapé do Sheet, reaproveitando exatamente as classes de
Instagram e WhatsApp — alvo de 44 px, hover e foco idênticos. Só existe no menu
mobile: o desktop não exibe redes hoje, e ampliar isso não foi pedido.

**Link normalizado** para `https://www.tiktok.com/@jamesfortes1`. O endereço
enviado trazia `?_r=1&_t=ZS-98xuJyA55Lm`, parâmetros de rastreio do
compartilhamento — apontam para o mesmo perfil e não pertencem a um link fixo.

**Aviso de parcelamento.** Nota permanente ao final do bloco de pagamento
(etapa 3), em tom neutro com ícone de cartão. Fica sempre visível, e não só com
cartão selecionado, porque quem tem R$ 150 no carrinho e conta com parcelar
precisa da regra **antes** de escolher a forma de pagamento. Os avisos acima dela
reagem à seleção; esta é a nota de rodapé do bloco.

**Puramente visual, como pedido:** não valida, não bloqueia envio e não entra em
cálculo nenhum. Segue a mesma regra já registrada para a faixa promocional. O
valor está na constante `VALOR_MINIMO_PARCELAMENTO` no topo do `ModalCarrinho`.

**Sem teste automatizado, com justificativa (AGENTS §0.5):** as duas mudanças são
markup — um link e um parágrafo estático. Não há função, ramo ou contrato novo
para exercitar, e §3.4 proíbe teste de browser. A verificação foi: `tsc`, build,
suíte existente intacta, classes Tailwind conferidas no CSS emitido, URL e texto
conferidos no bundle, e o SVG do TikTok **renderizado em PNG e inspecionado** —
path de marca não se valida por leitura.

**Decisão para revisar:** o valor R$ 200 está no código, não em
`configuracoes_loja`. Foi o que "apenas visual" pedia, mas mudar exige deploy.

## [2026-08-16] Service worker do site removido (worker-lápide)

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Arquivos criados:** `specs/remocao-pwa-cliente.md`.
**Arquivos alterados:** `public/sw.js` (virou lápide), `src/app/layout.tsx`, `tests/service-worker-cliente.test.mjs` (reescrito para a lápide), `UI.md`, `Progress.md`.
**Arquivos removidos:** `src/components/PWAManager.tsx`, `src/lib/atualizacao-pwa.mjs|.d.mts`, `tests/atualizacao-pwa.test.mjs`.

**Decisão do usuário**, depois do levantamento abaixo: remover o PWA do site,
mantendo o `manifest.json`.

**O que o worker entregava: nada.** Verificado um a um — cache de `/_next/static`
é redundante (o Next responde `Cache-Control: public, max-age=31536000, immutable`,
conferido no build servido); não existe `beforeinstallprompt` no site, então
ninguém era convidado a instalar; não existe `pushManager` no cliente (os
`.subscribe()` são canais Realtime do Supabase, e o handler `push` era herança do
restaurante); navegar offline nunca funcionou, porque o catálogo vem do Supabase e
nunca foi cacheado. E cobrava preço: `networkFirstWithTimeout` abortava em 3 s,
derrubando fonte e imagem em conexão lenta.

**Por que lápide e não `rm`.** Service worker mora no navegador da pessoa, não no
servidor. Apagar `public/sw.js` deixaria o worker antigo rodando indefinidamente
em quem já visitou — e destruiria o único canal capaz de alcançá-lo. A lápide
mantém a URL respondendo, sem handler de `fetch`, apaga os caches do site e chama
`registration.unregister()`. Verificado ao vivo: `/sw.js` responde 200 com
`Cache-Control: public, max-age=0`, então o navegador revalida o script a cada
verificação e a lápide chega na navegação seguinte.

**Defeito pré-existente descoberto no caminho:** o `activate` do worker do site
apagava todo cache com prefixo `edienai-lanches-`. Os workers de admin, garçom e
entregador usam exatamente esse prefixo — o site vinha apagando o cache dos três a
cada ativação. `caches` é compartilhado pela origem. A lápide é cirúrgica
(`fortes-fios-client-*` e `edienai-lanches-client-*`) e há teste que falha se
alguém voltar a varrer demais.

**Nada recarrega a página:** sem `clients.claim()` e sem `client.navigate()`. As
abas abertas seguem como estão; a navegação seguinte já acontece sem worker.

**Se um dia o fix do PWA do admin for autorizado**, o módulo
`atualizacao-pwa.mjs` (decisão de `controllerchange` sem reload automático) foi
removido junto com o `PWAManager` do cliente e precisa ser recriado — está na
entrada anterior e no histórico do Git.

## [2026-08-16] Site não carregava na primeira entrada (tela de erro do Chrome)

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Arquivos criados:** `src/lib/atualizacao-pwa.mjs|.d.mts`, `tests/service-worker-cliente.test.mjs`, `tests/atualizacao-pwa.test.mjs`, `specs/service-worker-navegacao-cliente.md`.
**Arquivos alterados:** `public/sw.js`, `src/components/PWAManager.tsx`, `UI.md`, `Progress.md`.

**Sintoma:** ao entrar no site, recarregar, ou voltar ao navegador que ficou
aberto, o Chrome no Android mostrava a **própria** tela de erro ("This page
couldn't load"). Apertar *Reload* resolvia. Intermitente.

**Como foi isolado:** build de produção servido e aberto por origem LAN — contexto
inseguro, então `'serviceWorker' in navigator === false` e o `PWAManager` retorna
cedo. **Sem service worker a página carrega íntegra, com zero erro de console.**
Isso apontou o worker como o componente que diferenciava os dois cenários. Em
seguida, `public/sw.js` foi avaliado de verdade num contexto `vm` (não simulado):
com a rede caindo, o handler entrega **`Response.error()`** para o documento —
que é exatamente o que o Chrome desenha como aquela tela.

**Causa raiz (duas decisões somadas):**
1. O worker interceptava **toda** navegação (`respondWith(networkNavigation(...))`)
   sem ganho nenhum — ele nunca guarda HTML — e convertia qualquer soluço de rede
   numa falha dura e sem recuperação.
2. `clients.claim()` disparava `controllerchange` numa página que ainda estava
   carregando, e o `PWAManager` respondia com `window.location.reload()`. A
   primeira visita se recarregava sozinha, no meio do carregamento, atendida por
   um worker recém-ativado. Daí "na entrada falha, no reload manual funciona".

**Correção:** navegação nunca é interceptada (a checagem vem antes de todas as
outras, inclusive `/api`); `clients.claim()` removido; nenhum reload automático —
a troca de controlador apenas **oferece** a atualização no banner que já existia,
e o reload só acontece no clique. `CACHE_VERSION` → `client-v3.0.0`.

**Decisões que revertem escolhas registradas antes:**
- "recarrega uma única vez na troca de controller" (entrada do SW admin `v4.3.5`)
  está **revertida para o site**: era a corrida que derrubava a navegação.
- "a navegação usa rede com fallback apenas para a página offline" — **o fallback
  de navegação saiu**. Sem rede aparece a tela offline do próprio Chrome, não
  `/offline.html`. O arquivo continua no repositório; ele hoje está com a
  identidade de outro projeto ("Divina Pastelaria"), então não exibi-lo não é perda.

**Armadilhas descobertas:** `Response.error()` entregue a `respondWith` **é** a
tela de erro do Chrome — um worker que "trata" a falha de rede assim fica pior do
que não interceptar. `clients.claim()` dispara `controllerchange` em página que
nunca teve controlador, e é isso que torna a primeira visita o pior caso, não o
melhor. E `skipWaiting()` no `install` faz `reg.waiting` já ser `null` quando o
banner aparece — sem tratar isso, o botão "Atualizar" não faria nada.

**Não coberto:** o mesmo defeito existe em `sw-admin.js`, `sw-garcom.js` e
`sw-entregador.js` (e nos dois últimos há `respondWith(undefined)` possível, que
também derruba a navegação). Mesma edição em ≥3 arquivos exige proposta antes
(AGENTS §0.2.2) — **proposto, não alterado**. Falta também o teste em Android real.

## [2026-08-16] Login do Admin repaginado na identidade da loja

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Arquivos criados:** `src/lib/preferencias-login.mjs|.d.mts`, `tests/preferencias-login.test.mjs`.
**Arquivos alterados:** `src/components/login/TelaSelecaoPerfil.tsx` (reescrito), `CardPerfilUsuario.tsx`, `ModalSenhaLogin.tsx`, `TransicaoLogin.tsx`, `UI.md`, `Progress.md`.

**Diagnóstico:** a tela era preto + `zinc-*` + acento **laranja** — herança do
projeto de restaurante. A loja é oliva sobre creme, display em Quiche Sans. Não
era "feia" por acaso: não tinha relação nenhuma com a marca. 45 ocorrências de
cor hardcoded nos quatro arquivos.

**Skill `frontend-design` foi lida e aplicada parcialmente, de propósito.** Ela
pede fontes expressivas próprias, quebra de grid e "evitar shadcn/Tailwind
default". O `AGENTS.md` §6.1 diz que ele e o `SKILLS.md` vencem quando uma skill
os contradiz, e o `UI.md` proíbe design system paralelo. Peguei da skill o que é
compatível — direção estética nomeada, uma âncora memorável, ritmo tipográfico —
expresso pelos tokens e fontes que o projeto já tem.

**O que foi feito:**
- Container com `fortes-fios-site dark`: a paleta oliva da loja passa a valer, e cada cor virou token. Sobrou só o scrim `bg-black/85` do overlay, igual ao `Dialog` do projeto.
- Âncora: uma luz oliva atrás da marca, `bg-primary/[0.14]` com blur. Um efeito, não três.
- Títulos em `.fortes-display` (Quiche Sans) no lugar de `font-bold`.
- Campos e botões passaram a `Input`/`Label`/`Button`/`Checkbox` do design system, altura 48px, com mostrar/ocultar senha.
- **"Lembrar meu usuário"**: guarda o nome, nunca a senha. Quem tem preferência salva abre direto no formulário com o campo preenchido.

**Decisão que você deve revisar:** você pediu "lembrar usuário/senha". Implementei
só o usuário. A versão que existia antes gravava `admin_saved_password` em texto
claro no `localStorage`, e foi por isso que a removi. O efeito prático de
"lembrar" — não redigitar e não relogar — vem do nome salvo mais o cookie de
sessão de 8 horas, sem nenhum segredo no navegador. Se quiser mesmo a senha
salva, dá para fazer, mas é uma decisão de risco que precisa ser sua.

**Verificação:** `node --test tests/*.test.mjs` **202/202** (8 novos) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · `.fortes-display` conferida no CSS emitido · zero `zinc-*`, `laranja-*` ou `text-white` restantes nos quatro arquivos.

**Pendências / próximos passos:**
- Smoke visual em desktop e mobile, e no fluxo de perfil (modal de senha + transição).

**Armadilhas descobertas:**
- Skill de design genérica empurra para "não use seu design system". Quando o projeto já tem identidade e tokens, o valor da skill está no método (direção nomeada, âncora, restrição), não nas prescrições visuais.
- `text-white` sobre fundo escuro parece inofensivo e trava o componente em um único tema — `text-foreground` faz a mesma coisa e continua verdadeiro se o ambiente mudar.

## [2026-08-16] Prazo de entrega: 24 horas no lugar dos minutos do restaurante

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Arquivos criados:** `src/lib/agenda-entrega.mjs`, `src/lib/agenda-entrega.d.mts`, `tests/agenda-entrega.test.mjs`.
**Arquivos alterados:** `src/lib/agenda-entrega.ts` (virou reexport tipado), `src/components/ModalCarrinho.tsx`, `UI.md`, `Progress.md`.

**Defeito relatado:** o card de Entrega dizia "estimada em 20-30 min"; deveria
ser "em até 24 horas", inclusive para Porto.

**Causa:** duas, e só a primeira era óbvia.
1. O card do passo 2 renderiza **antes** de haver cidade escolhida e caía no
   `tempo_entrega_estimado = '20-30'` herdado do projeto de restaurante.
2. Porto tem `dias_entrega = [0,1,2,3,4,5,6]` — entrega todo dia. O cálculo de
   "próxima data" devolvia **hoje**, e a tela de sucesso prometia "entrega
   prevista para domingo, 16 de agosto". Cidade que entrega todo dia não tem
   próxima data útil; prometer hoje é promessa que a operação não controla.

As outras duas cidades têm dia fixo (`[2]` e `[1]`) e por isso já mostravam data
correta — como o usuário observou.

**O que foi feito:**
- `descreverPrazoEntrega(dias)` devolve `{ texto, ehData }`. Semana completa ou sem configuração → `em até 24 horas`; dias fixos → a data. `ehData` deixa a tela escolher entre "Previsão de entrega" e "Prazo de entrega".
- A lógica migrou de `agenda-entrega.ts` para `.mjs` (testável por `node --test` sem transpilação, como os demais domínios); o `.ts` virou reexport tipado e nenhum call site mudou.
- O retrato do pedido guarda `prazoEntrega` e `prazoEhData`, para a tela de sucesso não recalcular nem prometer data para quem recebeu prazo.
- `tempoEntregaEstimado` saiu do fluxo de entrega — estado, carregamento e a chave na consulta. Minutos permanecem só para retirada.

**Verificação:** `node --test tests/*.test.mjs` **194/194** (6 novos) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · conferido com as três cidades reais: Porto → `em até 24 horas`, Campo Largo → `chega terça-feira, 18 de agosto`, Nossa Senhora dos Remédios → `chega segunda-feira, 17 de agosto`, sem cidade → `em até 24 horas`.

**Pendências / próximos passos:**
- `tempo_entrega_estimado` continua na tabela e no `ConfiguracoesBot`, agora sem efeito no site. Remover exige mexer numa tela legada; deixei a chave intacta.

**Armadilhas descobertas:**
- "Próxima data de entrega" só é informação útil quando a entrega **não** é diária. Para quem entrega todo dia, o cálculo devolve hoje e vira uma promessa que a loja não fez.
- O card do seletor de tipo renderiza antes de qualquer cidade existir; qualquer texto que dependa da cidade precisa de um caminho para esse estado.

## [2026-08-16] WhatsApp do cabeçalho, about:blank e fluxo de categorias

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Arquivos criados:** `src/lib/categorias.mjs`, `src/components/admin/produtos/SeletorIconeCategoria.tsx`, `supabase/migrations/202608160002_categoria_icone.sql`, `tests/categorias.test.mjs`.
**Arquivos alterados:** `src/lib/whatsapp.mjs|.d.mts`, `src/components/Header.tsx`, `src/components/ModalCarrinho.tsx`, `src/app/admin/produtos/page.tsx`, `src/app/page.tsx`, `src/app/api/vitrine/categorias/route.ts`, `src/lib/supabase.ts`, `tests/whatsapp.test.mjs`, `UI.md`, `Progress.md`.

**🔴 Erro meu, corrigido:** na task do WhatsApp afirmei que `5586981428538` era
"número hardcoded herdado do projeto anterior, DDD do Piauí" e troquei por
leitura de `configuracoes_loja`. **É o número real da loja.** E a chave
`whatsapp_numero` nunca existiu no banco, então o link virou `null` e o botão
sumiu do menu. Gravei a chave e criei `NUMERO_WHATSAPP_PADRAO`: a configuração
continua vencendo, mas a ausência dela não pode mais apagar o canal de contato.

**about:blank, de novo — a correção anterior era incompleta.** Eu tinha tirado o
`noopener` (que fazia `window.open` devolver `null`), mas a aba continuava sendo
reservada **antes** de montar a URL. Com o número ausente, `urlWhatsApp` saía
`null`, caía no `else` e sobrava a aba em branco. Agora o destino é resolvido
**antes** do `window.open` — sem destino, aba nenhuma é aberta. O `opener = null`
também passou para depois do `location.replace`.

**Categorias:** ganharam ícone. Migration com default `etiqueta` e backfill que
deu às 7 categorias existentes o palpite que a tela daria (Kits→kit,
Pós-química→tratamento, Cacheados→cachos, Mary Kay→maquiagem). O modal de criação
tem grade de 12 ícones, sugestão automática pelo nome, preview de como o filtro
aparece na loja, e validação de duplicata que ignora acento e caixa. A edição
abre com o ícone atual e salva mesmo quando só o ícone muda — o `return` antecipado
por "nome igual" descartava a troca em silêncio. O ícone aparece no menu da loja.

**Verificação:** `node --test tests/*.test.mjs` **188/188** (13 novos) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · link conferido com configuração vazia → `phone=5586981428538` · API pública devolvendo `{"nome":"Cacheados","icone":"cachos"}` · duplicata `"pos-quimica"` recusada contra `"Pós-química"` existente.

**Pendências / próximos passos:**
- Smoke do envio real: a reserva de aba é o mecanismo que só o navegador confirma. Se ainda abrir `about:blank`, o log do console dirá se `destinoWhatsApp` resolveu.
- O ícone aparece no menu hamburguer da loja; o filtro do catálogo em si ainda mostra só texto.

**Armadilhas descobertas:**
- Afirmar que um valor é "legado do projeto anterior" sem confirmar com quem conhece a loja: o DDD 86 parecia fora de contexto e era o número real.
- Configuração ausente virando `null` que apaga UI é pior que valor padrão. Canal de contato precisa de chão.
- Reservar aba antes de saber o destino recria o `about:blank` mesmo sem `noopener` — as duas correções eram necessárias, não alternativas.

## [2026-08-16] Carrinho preserva etapa · notificação de cliente inativo

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Arquivos criados:** `supabase/migrations/202608160001_notificacao_cliente_inativo.sql`.
**Arquivos alterados:** `src/components/ModalCarrinho.tsx`, `src/lib/notificacoes.mjs|.d.mts`, `src/components/admin/notificacoes/aparencia.ts`, `src/components/admin/GerenciadorUsuariosClientes.tsx`, `tests/notificacoes.test.mjs`, `UI.md`, `Progress.md`.

**Carrinho:** ao fechar, o efeito fazia `setEtapaAtual(1)`. Os campos persistiam
no estado, mas a pessoa voltava ao passo 1 e precisava percorrer o stepper de
novo — daí a sensação de ter perdido tudo. Agora a etapa é preservada, e só o
carrinho vazio reabre no passo 1. O aviso de frete grátis ganhou **Adicionar
mais itens**, que fecha o modal e devolve ao catálogo.

**Notificação de cliente inativo:** condição sem evento — ninguém escreve na
tabela quando alguém deixa de comprar. Por isso não há trigger: entra em
`reconciliar_notificacoes()`, que já roda a cada carregamento do painel e já é
onde a passagem do tempo é reavaliada (é lá que pedido parado escala). Sete dias
como gatilho, prioridade `normal` que nunca escala, ícone azul — é oportunidade,
não problema, e competir com estoque esgotado pelo vermelho tiraria a força dos
dois.

Clicar leva a `/admin/usuarios?cliente=<id>`, que abre a ficha direto no
follow-up de WhatsApp. Um `ref` garante que isso aconteça uma vez: sem ele, cada
recarga da lista reabriria a ficha que o usuário acabou de fechar.

**Cliente de teste criado, como pedido:** `Marly Marques` · `63992104477` ·
primeira compra há 40 dias, última há 12.

**Verificação:** `node --test tests/*.test.mjs` **176/176** (5 novos, RED antes) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · notificação nasceu sozinha na reconciliação (`Marly Marques não compra há 12 dias.`) e apareceu na rota do admin com o destino `/admin/usuarios?cliente=…` · em transação com rollback: cliente volta a comprar → alerta resolve para **0 ativas**. Marcação de leitura de teste removida.

**Pendências / próximos passos:**
- Smoke visual: clicar na notificação do cliente e confirmar que a ficha abre com o follow-up à mão.
- O clique da notificação de estoque já existia (`/admin/estoque?produto=`) e foi conferido na resposta da API — mas o destaque do produto na tela merece o olho.

**Armadilhas descobertas:**
- Condição sem evento não pode virar trigger. Estoque e pedido têm escrita que dispara; "parou de comprar" é ausência de escrita, e só a reconciliação enxerga isso.
- Abrir detalhe por parâmetro de URL sem guarda reabre a ficha a cada recarga da lista — o usuário fecha, a lista atualiza, e a ficha volta sozinha.

## [2026-08-16] Correção: seção de Depoimentos renderizava sem imagem

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Arquivos alterados:** `src/lib/vitrineDepoimentos.mjs|.d.mts`, `src/components/Depoimentos.tsx`, `src/components/admin/vitrine/EditorDepoimentos.tsx`, `tests/depoimentos.test.mjs`, `UI.md`, `Progress.md`.

**Defeito relatado:** a seção aparecia como uma fileira de "bolhas" com o nome
dos clientes, sem nenhuma imagem.

**Causa raiz — regressão minha, da entrega anterior:** eu coloquei as classes de
Tailwind (`aspect-[9/16]`, `w-[220px]`…) dentro de `src/lib/vitrineDepoimentos.mjs`.
O `content` do `tailwind.config` cobre `pages|components|features|app` com
extensão `{js,ts,jsx,tsx,mdx}`: **`src/lib/` não está na lista, e `.mjs` não casa
com o glob**. As classes nunca foram geradas. Sem largura e sem proporção, o
container do `<Image fill>` colapsou para altura zero e sobrou apenas o parágrafo
do nome — as "bolhas".

Falha silenciosa: build passa, tsc passa, nenhum aviso.

**Correção:** as classes saíram do domínio e foram para os componentes, escritas
por extenso em um `Record` — que é onde o scanner do Tailwind lê e onde
presentation pertence. O domínio agora carrega `proporcao: 9/16` (número), e
`formatoDepoimento` substituiu `proporcaoDoFormato`.

**Verificação:** `node --test tests/*.test.mjs` **172/172** · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · **conferido no CSS emitido**, não no build passar: `aspect-\[9\/16\]{aspect-ratio:9/16}`, `.w-\[220px\]{width:220px}`, `lg\:w-\[260px\]{width:260px}` presentes em `.next/static/chunks/*.css`. Teste novo falha se classe voltar a vazar para o domínio.

**Armadilhas descobertas:**
- Classe de Tailwind fora do `content` não gera erro em lugar nenhum — nem build, nem tipo, nem console. O elemento só colapsa.
- Verificar "o build passou" não prova que o CSS existe. A checagem certa é grep no arquivo emitido, com o escape que o Tailwind aplica (`aspect-\[9\/16\]`).
- Minha primeira tentativa de conferir isso grepou um caminho inexistente e o `&& echo ✓` disparou no warning do grep, dando falso positivo nos dois sentidos. Comando de verificação também precisa ser verificado.

## [2026-08-16] Nova seção de Depoimentos (Admin + site)

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Objetivo:** prints de clientes configuráveis, com formato por item e compressão que preserve o texto.
**Arquivos criados:** `src/lib/vitrineDepoimentos.mjs|.d.mts`, `src/app/api/vitrine/depoimentos/route.ts`, `src/components/Depoimentos.tsx`, `src/components/admin/vitrine/EditorDepoimentos.tsx`, `tests/depoimentos.test.mjs`.
**Arquivos alterados:** `src/app/api/upload/route.ts`, `src/lib/servicoUploadImagem.ts`, `src/app/admin/vitrine/page.tsx`, `src/app/page.tsx`, `UI.md`, `Progress.md`.

**🔴 Achado da auditoria: Sharp estava no `package.json` e nenhum código importava.**
A compressão real é Canvas no cliente, a **800px / JPEG 70%** — desenhada para
miniatura de produto e destrutiva para screenshot com texto, que é exatamente o
que a task proíbe. Sharp aqui não é estrutura paralela: é a ferramenta certa
para um requisito que o pipeline atual não atende, com a dependência já instalada.

**Segundo achado, durante a implementação:** `enviarImagemParaR2` compacta no
cliente **antes** de enviar. Usá-la para depoimentos entregaria ao Sharp uma
imagem já destruída em 800px — o segundo passe não recupera o que o primeiro
jogou fora. Criei `enviarImagemOriginalParaR2`, e o limite de upload da pasta
subiu para 15MB porque print de celular passa dos 5MB com facilidade.

**O que foi feito:**
- Domínio `vitrineDepoimentos.mjs` no molde do Estúdio: normalização defensiva, teto de 12, URL só `/` ou `https://`, id desambiguado, formato inválido cai em `vertical`.
- Sharp só na pasta `depoimentos/`: `rotate()` pelo EXIF, 1080px no lado maior, WebP `quality: 90` + `smartSubsample`. Falha no processamento não custa o upload — segue com o original.
- Site: carrossel `embla` onde **cada card tem a largura do seu formato**, `object-contain`, visualização ampliada com Escape/clique-fora/botão, `max-h-[88dvh]` para não estourar viewport.
- Admin: aba própria em `/admin/vitrine`. Escolher a imagem já cria o item; nome e formato editam no card, sem modal. O formato é sugerido pela proporção do arquivo.

**Decisões tomadas:** aba separada em vez de anexar à do Estúdio — a aba se chama "Studio" e misturar confundiria. Overlay próprio na ampliação em vez do `Dialog`: aqui o conteúdo é só a imagem, e a moldura do `Dialog` competiria com o print.

**Verificação:** `node --test tests/*.test.mjs` **171/171** (16 novos) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · **Sharp medido em print real com texto: 2000×1027/188KB → 1080×555/18KB webp**, contra 800×411/17KB do pipeline antigo — mesmo peso, 35% mais resolução linear, e conferi visualmente que telefone, datas e valores continuam legíveis · ciclo completo no banco: admin grava vertical+horizontal+oculto → domínio devolve as proporções certas e descarta o oculto → seção desligada devolve zero itens. Fixture removida.

**Pendências / próximos passos:**
- 🔴 **Cleanup de arquivo órfão no B2 não foi implementado.** Remover um depoimento tira a referência do JSON mas deixa o `.webp` no bucket. `removerImagemDoR2` existe em `servicoUploadImagem.ts`; ligar isso exige decidir o comportamento quando a mesma URL é reusada, e preferi não apagar arquivo por conta própria.
- Smoke visual do carrossel com prints reais em desktop e mobile.

**Armadilhas descobertas:**
- Dependência no `package.json` não significa dependência em uso. `grep "from 'sharp'"` devolveu zero — a auditoria do pipeline tinha que ser no código, não no manifesto.
- `chromaSubsampling` é opção do JPEG; no WebP o equivalente é `smartSubsample`. O TypeScript pegou, mas a intenção (não borrar texto) exigia a API certa.
- Compactar no cliente e reprocessar no servidor é pior que qualquer um dos dois sozinho.

## [2026-08-16] about:blank, Meus Pedidos repaginado e frete grátis configurável

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Arquivos criados:** `src/lib/frete.mjs|.d.mts`, `src/lib/pedidos-cliente.mjs|.d.mts`, `src/components/LimiteDeErro.tsx`, `src/components/admin/entregas/ConfigFreteGratis.tsx`, `tests/frete.test.mjs`, `tests/pedidos-cliente.test.mjs`.
**Arquivos alterados:** `src/components/ModalPedidosCliente.tsx` (reescrito), `src/components/ModalCarrinho.tsx`, `src/app/page.tsx`, `src/app/admin/entregas/page.tsx`, `src/lib/configuracoes-pedidos.ts`, `UI.md`, `Progress.md`.

**🔴 `about:blank` — regressão minha, causa raiz confirmada.** Eu escrevi
`window.open('', '_blank', 'noopener,noreferrer')`. A flag `noopener` faz o
`window.open` **devolver `null` por especificação** — é o que ela existe para
fazer, cortar o vínculo com a aba criada. A aba abria mesmo assim e ficava órfã
em `about:blank`, sem referência para navegar nem fechar. Corrigido: reserva sem
a flag, `opener = null` depois de navegar (recupera a proteção), `location.replace`
no lugar de `href`, e a reserva movida para **depois** de todas as guardas —
antes, pedido recusado por loja fechada também deixava aba órfã.

**Safari — o que testei e descartei.** A hipótese mais provável era
`format(new Date(created_at))` receber data em formato que o WebKit recusa.
**Descartada com dado real:** a RPC devolve `2026-08-16T13:38:03.718152+00:00`,
ISO válido. Não entreguei correção de data como se fosse a causa. O que tratei
foram fragilidades verificadas: `format()` sem guarda (único ponto que lança no
render daquele fluxo), overlay manual `fixed inset-0` + `backdrop-blur` de
viewport inteira (fora do `overlay-layer.tsx`, e pressão de memória conhecida no
WebKit), busca sem cancelamento, e ausência de error boundary. **Sem stack trace
de Safari não afirmo causa raiz única.**

**O que foi feito:**
- `pedidos-cliente.mjs`: apresentação onde nada lança — data inválida vira texto, linha sem `id` é descartada, total inválido vira zero, e `2026-08-16 13:38:03+00` (formato do Postgres) é normalizado antes do `new Date`.
- `ModalPedidosCliente` reescrito sobre o `Dialog` compartilhado (Drawer no mobile), zero hardcode: saíram `bg-white`, `dark:bg-zinc-950`, `border-zinc-200`, `text-zinc-900`, `bg-bordo-600`, `z-[110]`, `max-h-[55vh]`. Skeleton no lugar do spinner, estados vazio/erro/não-encontrado distintos, "Limpar busca", texto longo com `break-words`.
- Busca com número de sequência: consulta antiga não sobrescreve a nova, e resposta atrasada não repovoa modal fechado.
- `LimiteDeErro` embrulhando carrinho e pedidos.
- `frete.mjs` como fonte única, com precedência explícita (cidade > regra global) e base do limite documentada: subtotal de produtos, antes de frete e cupom.
- `ConfigFreteGratis` em `/admin/entregas`: liga/desliga, atalhos R$ 50/80/100/150/200 e campo livre, sem modal. Persiste em `configuracoes_loja` — nenhuma coluna nova.
- Feedback no carrinho: "Faltam R$ 18,00 para você ganhar frete grátis" / "Você ganhou frete grátis!" com barra discreta, derivado do mesmo subtotal do cálculo.

**Verificação:** `node --test tests/*.test.mjs` **155/155** (24 novos) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · ciclo do frete conferido contra o banco real: admin grava → site lê → domínio decide (`82 → R$ 8, faltam R$ 18` · `100 → R$ 0, ganhou`). Chave de teste removida do banco.

**Pendências / próximos passos:**
- 🔴 Smoke em Safari macOS e iOS: a quebra relatada não foi reproduzida aqui, e a reserva de aba é justamente o mecanismo que só o dispositivo confirma. Se voltar a quebrar, o `LimiteDeErro` agora loga `[LimiteDeErro:MeusPedidos]` com component stack no console do cliente — é o rastro que faltava.
- Realtime da config de frete não chega ao site (publication vazia, PRD §Realtime): mudar o valor mínimo exige recarregar a página do cliente.

**Armadilhas descobertas:**
- **`noopener` em `window.open` devolve `null`.** Reservar aba e passar a flag são mutuamente exclusivos.
- Guarda de validação depois de reservar a aba deixa janela em branco a cada pedido recusado.
- Buscar sem número de sequência: no mobile, com rede lenta, a resposta da busca anterior chega depois e sobrescreve a atual.

## [2026-08-16] Envio automático do pedido no WhatsApp + troco inteligente

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Objetivo:** o pedido sair para o WhatsApp sozinho, com passo manual claro quando o navegador barrar; e o troco parar de sugerir valores que não pagam a conta.
**Arquivos criados:** `src/lib/troco.mjs`, `tests/troco.test.mjs`.
**Arquivos alterados:** `src/components/ModalCarrinho.tsx`, `UI.md`, `Progress.md`.

**Por que não abria sozinho:** a abertura acontecia depois do `await` que grava o
pedido. Nesse ponto o navegador já não associa a ação ao gesto do usuário e trata
`window.open` como popup — bloqueado em Safari e Chrome. Eu tinha documentado o
risco e ainda assim deixei a abertura só no clique manual.

**O que foi feito:**
- A aba é **reservada no clique** (`window.open('', '_blank')`), antes do await; quando a mensagem fica pronta, troca-se o `location.href` da aba já aberta.
- Falhou o bloqueador? A tela de sucesso muda de tom: aviso "Falta enviar o pedido" e botão de 56px destacado. Deu certo? O mesmo botão vira "Abrir o WhatsApp de novo", secundário, e "Entendi" vira "Fechar" em ghost.
- A aba reservada é fechada quando o pedido falha, senão sobra janela em branco.
- Troco reescrito: pergunta "Vai pagar com quanto?", sugestões derivadas do total, "Valor exato" como padrão, troco calculado na hora e erro que **bloqueia o envio**.
- Saiu o verde hardcoded (`bg-green-50 dark:bg-green-950/20`, `bg-white dark:bg-gray-900`) do bloco de troco; agora usa tokens.

**Decisões tomadas:** mantive o botão manual visível mesmo quando a abertura automática funciona — em iOS o app pode demorar a subir e a pessoa acha que não foi. O `resumoWhatsApp` do estado e o objeto que abre a aba são o mesmo, em vez de duas cópias dos 15 campos.

**Verificação:** `node --test tests/*.test.mjs` **131/131** (12 novos) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · sugestões conferidas: `75 → 80, 100, 150, 200` e `250 → 255, 260, 300, 400`.

**Pendências / próximos passos:**
- Smoke real em Safari iOS e Chrome Android: a reserva de aba é justamente o caminho que só o dispositivo confirma.
- Se a aba reservada ficar em branco por alguns segundos antes de navegar, vale avaliar um `about:blank` com mensagem de "preparando seu pedido".

**Armadilhas descobertas:**
- Reservar a aba no gesto e navegar depois é o único caminho confiável para abrir algo após trabalho assíncrono. Tentar `window.open` no fim do fluxo falha calado — sem erro no console.
- Sugestão de troco fixa é pior que nenhuma: num pedido acima do maior valor sugerido, todos os atalhos ficam errados e a pessoa nem percebe.

## [2026-08-16] Tela de cupons reconstruída

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Objetivo:** criar um cupom deixar de exigir que a pessoa entenda o schema do banco.
**Arquivos criados:** `src/lib/cupom-formulario.mjs`, `src/lib/cupom-formulario.d.mts`, `tests/cupom-formulario.test.mjs`, `src/components/admin/cupons/ResumoCupom.tsx`.
**Arquivos alterados:** `src/components/admin/cupons/GerenciadorCupons.tsx` (reescrito), `UI.md`, `Progress.md`.

**O que a auditoria encontrou:** o componente veio de outro sistema. `CLASSE_CAMPO`
com `border-zinc-300 bg-white dark:bg-zinc-800` — cor fixa fora do design system,
repetida em 12 campos; `<select>`/`<input>` crus em vez de `Select`/`Input` do
projeto; 16 campos numa grade plana sem hierarquia; opção "aplicar em combo" com
a tabela `combos` **vazia** e a rota legada; e nada que dissesse o que o cupom
faria. Base atual: **0 cupons, 0 usos** — a tela nunca foi usada neste projeto.

**O que foi feito:**
- `cupom-formulario.mjs`: presets, `sugerirCodigo`, `descreverCupom`, `simularCupom`, validação por campo. 17 testes, RED antes.
- `ResumoCupom`: a frase em português e o desconto em reais num pedido de exemplo ajustável. É a peça que faltava.
- Formulário reorganizado — tipo de desconto em três cartões, valor, código e nome; tudo que é regra fina foi para "Regras avançadas", colapsado.
- Lista com etiqueta de desconto em destaque, código copiável, selo de expirado, `MenuAcoes` e `ListaVazia` com CTA no estado zero.
- Modal em duas colunas no `lg`, Drawer no mobile.

**Decisões tomadas:** removi `combo` do formulário (opção morta) e o campo `descricao` (write-only, não aparecia para ninguém) — `descricao` continua gravada como `null`, sem mexer no schema. Validade virou data simples valendo até 23:59:59 do dia. O código sugerido só é reescrito enquanto ainda for sugestão: texto digitado pela pessoa não é sobrescrito. Tirei a subscription Realtime da tela — a publication deste projeto está vazia (PRD §Realtime), então o canal só consumia conexão sem nunca receber evento.

**Verificação:** `node --test tests/*.test.mjs` **119/119** (17 novos) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · payload de INSERT conferido contra a tabela real em transação com rollback (0 cupons sobraram).

**Pendências / próximos passos:**
- Smoke visual em desktop largo e mobile; e criar um cupom de verdade para conferir o round-trip pela interface.
- `cupons.editar` continua sem aplicação de permissão (está na dívida declarada em `tests/rbac-cobertura.test.mjs`).

**Armadilhas descobertas:**
- `uso_unico` é redundante com `uso_maximo_por_cliente = 1`. Mantive a coluna gravada em coerência com o outro campo em vez de expor os dois e deixar a pessoa criar estado contraditório.
- Campo write-only (`descricao`) é pior que campo ausente: pede trabalho e não produz efeito nenhum.

## [2026-08-16] Modal de acessos redesenhado + WhatsApp unificado

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Objetivo:** dar ao modal de acesso o porte da decisão que ele representa; follow-ups prontos na ficha do cliente; pedido do cliente terminando no WhatsApp da loja.
**Arquivos criados:** `src/lib/whatsapp.mjs`, `src/lib/whatsapp.d.mts`, `tests/whatsapp.test.mjs`, `src/components/admin/clientes/SeletorFollowUp.tsx`.
**Arquivos alterados:** `src/components/admin/GerenciadorUsuariosSistema.tsx`, `src/components/admin/acessos/EditorPermissoes.tsx`, `src/components/admin/GerenciadorUsuariosClientes.tsx`, `src/components/ModalCarrinho.tsx`, `src/components/Header.tsx`, `UI.md`, `Progress.md`.

**Achado da investigação:** existiam **quatro** construções de link `wa.me`
divergentes, e o `Header.tsx` tinha o número **fixo do projeto anterior**
(`5586981428538`, DDD do Piauí) enquanto a loja é `(63)`. O botão de WhatsApp do
cabeçalho mandava o cliente para uma conversa que não é da Fortes Fios.

**O que foi feito:**
- `whatsapp.mjs`: normalização de número, link, três follow-ups e a mensagem completa do pedido. 11 testes, RED antes.
- Modal de acessos em duas colunas a partir de `lg` (`68rem`): identidade fixa à esquerda, permissões rolando à direita. Era `max-w-md` com tudo empilhado.
- Editor com barra fixa (contador `14 de 41`, progresso, Limpar / Padrão do atendente) e módulos em duas colunas no `xl`, com destaque quando há algo liberado.
- `SeletorFollowUp` na ficha do cliente: três mensagens prontas com rótulo e "quando usar", mais "conversa em branco". Substituiu os dois botões que abriam sempre o mesmo texto.
- Carrinho: **Enviar pedido no WhatsApp** como ação principal da tela de sucesso, com nome, telefone, tipo, pagamento, troco, itens, dados de entrega, observações e total.
- Cabeçalho da loja passou a usar o número configurado.

**Decisões tomadas:** `api.whatsapp.com/send` em vez de `wa.me` — o `wa.me` redireciona e o Safari do iOS perde o texto ou cai em erro. O link é montado no render, não no handler: `window.open` depois de `await` é bloqueado como popup no iOS. Três follow-ups, não seis: lista longa vira uma segunda decisão antes da conversa.

**Verificação:** `node --test tests/*.test.mjs` **102/102** (11 novos) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · mensagem gerada conferida linha a linha para entrega com troco e observações.

**Pendências / próximos passos:**
- Smoke visual do modal em desktop largo, notebook e mobile; e do envio real em Safari iOS e Chrome Android — a verificação desta sessão foi por código e teste.
- `AjudaPedidoPublica` e `ModalLojaFechada` ainda montam o link por conta própria; podem migrar para `linkWhatsApp` numa limpeza.

**Armadilhas descobertas:**
- `wa.me` no Safari iOS: o redirecionamento come o `?text=` com alguma frequência. `api.whatsapp.com/send` resolve direto.
- Capturar o retrato do pedido **depois** de `limparCarrinho()` produziria mensagem sem itens — o estado já foi zerado. Tem que ser no mesmo bloco do envio.
- Em `Bairro`, `nome` é a **cidade** (a seleção tarifada); o bairro é entrada livre em outro estado. Trocar os dois manda o cliente para o endereço errado.

## [2026-08-15] Correção crítica — permissões que ninguém lia

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Objetivo:** fazer as caixas da tela de Acessos realmente valerem.
**Spec:** `specs/rbac-admin.md` §12
**Arquivos criados:** `src/app/api/admin/pedidos/route.ts`, `src/app/api/admin/estoque/route.ts`, `src/lib/acoes-admin.ts`, `tests/rbac-cobertura.test.mjs`.
**Arquivos alterados:** `src/app/admin/pedidos/page.tsx`, `src/app/admin/dashboard/page.tsx`, `src/app/admin/produtos/page.tsx`, `src/components/admin/CardPedido.tsx`, `src/components/admin/produtos/ControleEstoqueProduto.tsx`, `specs/rbac-admin.md`, `UI.md`, `Progress.md`.

**Defeito relatado pelo usuário:** atendente com `pedidos.excluir` desmarcado
excluía pedido assim mesmo. Confirmado no banco — o usuário `derick` tem
`"pedidos.excluir": false` e a exclusão funcionava.

**Causa, encontrada na auditoria:** **nenhuma** tela do Admin lia permissão. Os
únicos `pode()` do projeto estavam nos fluxos legados de garçom/entregador,
usando o `controle-acesso.ts` que está morto. Eu havia entregue o catálogo, a
tela de edição e a proteção de Finanças/Acessos/Dashboard, e deixei o resto do
Admin escrevendo direto no Supabase com a anon key — que tem grant total em
`pedidos`. Caixa que ninguém lê é pior que caixa ausente: promete um controle
que não existe.

**O que foi feito:**
- `/api/admin/pedidos`: `DELETE` exige `pedidos.excluir`; `PATCH` exige `pedidos.cancelar` quando o destino é `cancelado` e `pedidos.mudar_status` no resto. Desfazer uma venda não é o mesmo que movê-la de "preparando" para "pronto".
- `/api/admin/estoque`: ajuste por delta ou valor absoluto atrás de `estoque.ajustar`, devolvendo a quantidade confirmada para a UI otimista reconciliar.
- `src/lib/acoes-admin.ts` centraliza as chamadas e traduz 403 em "Seu acesso não inclui esta operação" — não em "erro ao salvar".
- Gating na UI: excluir, editar, mudar status (pedidos e dashboard), novo/editar/excluir produto, controles de estoque. Ação sem permissão **some** em vez de aparecer e falhar.
- `pedidos.ver_valor` implementado no `CardPedido` reaproveitando o mecanismo de mascarar valores: um ponto cobre total, subtotal de item e barra de pagamento parcial.

**Decisões tomadas:** as escritas de `pedidos` e `produtos` continuam existindo no cliente para os fluxos legados (pdv, painel, garçons) — migrei só os caminhos vivos. Não revoguei `pedidos` do `anon` porque o checkout público precisa de INSERT e do DELETE de rollback.

**Verificação:** `node --test tests/*.test.mjs` **91/91** (4 arquivos novos de teste) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · smoke com admin e atendente descartáveis sobre um pedido real: atendente `DELETE` → **403**, `PATCH cancelado` → **403**, `PATCH preparando` → **200** (tem no preset), admin `DELETE` → **200**. Fixtures removidas; o usuário real `derick` foi preservado.

**Pendências / próximos passos:**
- 8 chaves ainda sem aplicação, declaradas em `SEM_APLICACAO_CONHECIDA`: `produtos.ver_custo` e os `.editar` de vitrine, cupons, bairros, entregas, pagamentos, clientes e equipe. Essas telas escrevem direto no Supabase; esconder o botão sem rota autorizada seria cosmético.
- 🔴 `pedidos`, `produtos`, `itens_pedido` e `pagamentos_pedido` seguem com grant total para `anon`. O gating de UI ajuda o uso honesto; não impede requisição montada à mão.
- Telas legadas (pdv, painel, garçons, caixa) continuam sem gating — estão fora do menu.

**Armadilhas descobertas:**
- Entregar catálogo de permissões sem ponto de aplicação é pior que não entregar: a interface passa a afirmar um controle que não existe, e ninguém desconfia até alguém testar.
- O mecanismo de "ocultar valores" que a tela já tinha serviu de gancho para `pedidos.ver_valor`: uma linha em `formatarValor` cobriu todos os valores do cartão. Procurar o ponto que já existe rende mais que espalhar `if` por JSX.
- `derick` (atendente real criado pelo usuário) não tinha `pedidos.ver_valor` marcado — depois desta correção ele passa a ver `••••••` no lugar dos totais. É o comportamento correto pela configuração, mas é mudança visível.

## [2026-08-15] RBAC fase 2 — tela de Acessos com permissões configuráveis

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Objetivo:** o administrador criar e permissionar atendentes pela interface, no padrão visual atual.
**Spec:** `specs/rbac-admin.md` §5 e §11
**Arquivos criados:** `src/components/admin/acessos/EditorPermissoes.tsx`.
**Arquivos alterados:** `src/components/admin/GerenciadorUsuariosSistema.tsx`, `src/lib/rbac.mjs|.d.mts`, `src/lib/autenticacao.ts`, `src/lib/cadastro-equipe.ts`, `src/components/login/TelaSelecaoPerfil.tsx`, `src/app/admin/login/page.tsx`, `src/app/api/admin/acessos/route.ts`, `tests/rbac.test.mjs`, `specs/rbac-admin.md`, `UI.md`, `Progress.md`.

**Regressão que eu mesmo tinha causado e corrigi antes de seguir:** a rota
`/api/admin/acessos` validava o papel contra `PAPEIS_ADMIN` (admin | atendente),
mas a tela de **Equipe** cria acesso `garcom`/`entregador` — esses cadastros
passariam a falhar. Agora existe `PAPEIS_VALIDOS` com os quatro: os legados
continuam graváveis e resolvem para conjunto vazio. Existir como linha não é o
mesmo que ter acesso ao Admin.

**O que foi feito:**
- `EditorPermissoes`: módulos agrupados, "marcar tudo" por grupo, contador por módulo e selo de sensibilidade (**Financeiro** âmbar, **Acesso** vermelho). Botão **Padrão do atendente** aplica o preset como retrato completo, zerando o que está fora dele.
- Administrador não ganha formulário desabilitado — ganha aviso de acesso total. Formulário cinza sugere que é configurável, e não é.
- `atendente` entra como papel operacional do projeto; `garcom`/`entregador` viram "(legado)" e não são oferecidos para cadastro novo.
- A tela carrega por `/api/admin/acessos`, que devolve as permissões **já resolvidas** — a interface não reimplementa preset + override.
- Login do Admin passou a listar administradores **e** atendentes (`papeisListados`): os dois entram pela mesma porta.
- A escrita de avatar, que ainda ia direto ao Supabase, passou pela rota. Era a última escrita solta em `usuarios_sistema` nesta tela.
- Lista mostra o resumo de acesso por usuário (`Acesso total`, `14 permissões`, `Sem acesso ao Admin`).

**Decisões tomadas:** o editor trabalha sobre o mapa resolvido e envia o mapa inteiro como override — `resolverPermissoes` faz `{...preset, ...overrides}`, então `false` explícito é preservado e não há ambiguidade entre "não marcado" e "revogado". Clicar no papel já selecionado não recarrega o preset: perderia as customizações.

**Verificação:** `node --test tests/*.test.mjs` **87/87** (3 casos novos) · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · smoke do ciclo completo com admin descartável: criar atendente com `financas.ver` concedido → lista devolve 41 permissões para admin e 14 para o atendente → atendente entra em `/financas` (200) e é barrado em `/acessos` (403) → admin revoga → **sessão antiga invalidada (401)** → depois de novo login, `/financas` = 403. Artefatos removidos.

**Pendências / próximos passos:**
- 🔴 `ajustar_estoque_produto` e `definir_estoque_produto` seguem executáveis por `anon`.
- 🔴 `pedidos`, `itens_pedido`, `pagamentos_pedido`, `usuarios_cliente` continuam abertos ao `anon` — fechar exige migrar o checkout público.
- `ADMIN_SESSAO_SECRET` continua pendente na Vercel.
- Smoke visual da tela nova, desktop e mobile: a verificação desta sessão foi por API.

**Armadilhas descobertas:**
- Preset aplicado como merge (`{...atual, ...PRESET}`) mantém ligado o que estava fora do preset e o botão vira "adicionar", não "restaurar padrão". Tem que partir de tudo desligado.
- Trocar de papel sem recarregar o preset deixa o formulário com as permissões do papel anterior — o oposto do que a escolha significa.
- Enviar `permissoes` para um administrador grava override que nunca é lido, porque `resolverPermissoes` devolve tudo antes de olhar overrides. Melhor não mandar.

## [2026-08-15] RBAC fase 4 — dado financeiro fora do alcance da anon key

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Objetivo:** fechar de verdade Finanças e receita, não só esconder da sidebar.
**Spec:** `specs/rbac-admin.md` §11
**Arquivos criados:** `src/app/api/admin/financas/route.ts`, `src/app/api/admin/financas/diarias/route.ts`, `src/app/api/admin/dashboard/route.ts`, `supabase/migrations/202608150005_rbac_fechar_financas.sql`, `supabase/migrations/202608150006_rbac_fechar_rpcs.sql`.
**Arquivos alterados:** `src/features/financas/hooks/useFinancas.ts`, `useDiarias.ts`, `src/app/admin/dashboard/page.tsx`, `src/lib/autenticacao.ts`, `src/app/api/admin/acessos/route.ts`, `tests/rbac-banco.sql`, `specs/rbac-admin.md`, `Progress.md`, `UI.md`.

**🔴 O achado desta sessão:** todo `revoke ... from anon` que escrevi nas
migrations anteriores era **no-op silencioso**. Função em Postgres nasce com
`EXECUTE` para `PUBLIC` (o `=X/postgres` no `proacl`); `anon` executa por
herança, sem grant próprio, e revogar de quem não tem grant não tira nada **nem
devolve erro**. Descobri auditando por `has_function_privilege` em vez de
confiar no texto do comando: 21 funções ainda executáveis por `anon`, entre elas
`salvar_acesso_usuario`, `criar_usuario_sistema` e `atualizar_senha_usuario` —
todas `SECURITY DEFINER`, rodando como `postgres`. Ou seja: o RBAC que entreguei
antes era contornável por uma requisição REST que criava um administrador ou
trocava a senha de outra pessoa. Fechado em `202608150006`; sobraram 7
executáveis por anon, sendo 3 trigger functions (não expostas pelo PostgREST) e
4 intencionais.

**O que foi feito:**
- `/api/admin/financas` e `/api/admin/financas/diarias`: as 9 consultas do `useFinancas` e as escritas do `useDiarias` passam a rodar com service_role atrás de `financas.ver`/`criar`/`editar`/`excluir`. A compensação da diária (apagar a movimentação quando a segunda inserção falha) foi para o servidor, onde o cliente não pode desistir no meio.
- `/api/admin/dashboard`: o corte operacional × estratégico acontece no servidor. Sem `dashboard.ver_receita` os campos de receita não são calculados nem enviados — **ausentes, não zerados**, porque faturamento zero significa outra coisa.
- Migration `202608150005`: `financas_diarias`, `movimentacoes_caixa`, `caixas` e `categorias_caixa` fora do `anon`, com RLS ligada sem policy como segunda camada (service_role tem BYPASSRLS).
- Os quatro helpers de `autenticacao.ts` (criar/atualizar/senha/excluir) agora chamam `/api/admin/acessos`, que ganhou `PUT` (senha) e `DELETE` com a invariante do último admin.
- `PATCH /api/admin/acessos` passou a ter dois níveis: papel/permissões/ativação exigem `acessos.permissoes`; nome e avatar bastam `acessos.editar`.

**Decisões tomadas:** não fechei `pedidos`/`itens_pedido`/`pagamentos_pedido` — a **loja pública** escreve neles no checkout, e revogar quebraria a venda. Relatórios e Análise derivam dessas tabelas, então continuam expostos por essa via; fechá-los é migrar o checkout, tarefa própria. `ajustar_estoque_produto`/`definir_estoque_produto` seguem abertas porque a tela de Estoque as chama client-side.

**Verificação:** `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · `node --test tests/*.test.mjs` 84/84 · `tests/rbac-banco.sql` com o cenário 11 novo (12 asserções de grant), rollback limpo · smoke com admin e atendente descartáveis: `/financas`, `/financas/diarias`, `POST /financas` e `/acessos` = **200 admin / 403 atendente**; `/dashboard` devolve `receitaTotal` só para o admin; `/notificacoes` 200 para ambos (service_role intacto após o lockdown) · ataque pela anon key: 4 tabelas financeiras e 2 RPCs de lucro/faturamento em `42501`. Artefatos removidos: 1 usuário, 1 admin ativo, 0 lixo.

**Pendências / próximos passos:**
- Fase 2 — tela de Acessos reconstruída. Hoje a permissão só se edita pela API.
- 🔴 `ajustar_estoque_produto` e `definir_estoque_produto` seguem executáveis por `anon`: com a anon key dá para zerar o estoque de qualquer produto. Pré-existente, mas agora é o buraco mais fácil que sobrou.
- 🔴 `pedidos`, `itens_pedido`, `pagamentos_pedido` e `usuarios_cliente` continuam abertos ao `anon` — histórico de pedidos, telefone e endereço de cliente são legíveis por quem tiver a chave do bundle público.
- `ADMIN_SESSAO_SECRET` continua pendente de configuração na Vercel.

**Armadilhas descobertas:**
- **`revoke ... from anon` em função não faz nada** se o grant veio de `PUBLIC`. Sempre `revoke ... from public`, e sempre conferir por `has_function_privilege`, nunca por leitura do comando.
- Ligar RLS sem policy nenhuma nega tudo, menos para quem tem BYPASSRLS — `service_role` passa. É a segunda camada barata: se um GRANT voltar por engano numa migration futura, a tabela continua fechada.
- Campo sensível ausente ≠ zerado. Devolver `receita: 0` para quem não tem permissão inventa um faturamento de zero reais; omitir o campo diz a verdade.

## [2026-08-15] RBAC do Admin — fundação: sessão verificável + modelo de permissões

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Objetivo:** Administrador e Atendente entrando pelo mesmo `/admin`, com controle real de acesso a dados e ações.
**Spec:** `specs/rbac-admin.md` (Opção A escolhida pelo usuário)
**Arquivos criados:** `specs/rbac-admin.md`, `src/lib/rbac.mjs|.d.mts`, `src/lib/sessao-token.mjs|.d.mts`, `src/lib/server/sessao-admin.ts`, `src/app/api/admin/sessao/route.ts`, `src/app/api/admin/acessos/route.ts`, `supabase/migrations/202608150004_rbac_admin.sql`, `tests/rbac.test.mjs`, `tests/sessao-token.test.mjs`, `tests/rbac-banco.sql`.
**Arquivos alterados:** `src/contexts/AdminAuthContext.tsx`, `src/components/admin/ProtectedRoute.tsx`, `src/components/admin/AdminLayout.tsx`, `src/app/admin/login/page.tsx`, `src/components/login/TelaSelecaoPerfil.tsx`, `Progress.md`, `UI.md`.

**O diagnóstico que mudou o desenho:** o pedido era RBAC, mas a base não tinha
autenticação. `AdminAuthContext` trazia duas senhas em texto claro **dentro do
bundle** (`edienailanches/1234`, `dzndev/1503`) e o `ProtectedRoute` aceitava
qualquer `localStorage.adminToken` com o prefixo certo — uma linha no console
virava administrador. No banco: 0 tabelas com RLS, 0 policies, `anon` com SELECT
e DELETE em 27 de 30 tabelas, `auth.users` vazio, senha em SHA-256 **sem salt**
e `senha_hash` legível pela anon key (que é pública). Sem identidade que o
servidor consiga conferir, permissão é só componente escondido. Apresentei as
duas saídas e o usuário escolheu a sessão assinada própria.

**O que foi feito:**
- Cookie `httpOnly` + `SameSite=Lax` assinado em HMAC-SHA256 com `node:crypto` — sem dependência nova. Comparação em tempo constante; entrada malformada devolve `null` em vez de lançar.
- Senha migra para bcrypt (`crypt`/`gen_salt('bf')`) de forma transparente: hash antigo continua entrando e é regravado no primeiro login. Ninguém redefine senha.
- `anon` perde `senha_hash` (leitura) e `papel`/`permissoes`/`permissoes_versao` (escrita) por **grant de coluna** — o buraco fecha hoje sem quebrar as 8 telas que leem a tabela pelo cliente.
- `permissoes jsonb` + `permissoes_versao` + tabela `acessos_auditoria`; `salvar_acesso_usuario` audita e impõe no banco: ninguém altera o próprio acesso, e a loja nunca fica sem administrador ativo.
- `exigirPermissao(request, chave)` como fronteira dos route handlers: 401/403 **antes** de tocar no banco.
- Catálogo `rbac.mjs` com os 15 módulos reais do menu. Nenhuma tela legada recebeu permissão — várias consultam tabela que não existe (PRD §Legado).
- Sidebar, ⌘K e rotas filtrados por permissão; `ProtectedRoute` mostra tela de bloqueio em vez de redirecionar em silêncio.

**Decisões tomadas:** `admin` resolve para todas as chaves por retorno de função, não por linha em tabela — não existe estado em que um administrador se tranque para fora. `pedidos.ver_valor` e `dashboard.ver_receita` são chaves distintas, que é a fronteira entre valor operacional e número estratégico. Revogação total do `anon` em `usuarios_sistema` ficou para quando as consultas dessas telas migrarem para route handler (fase 4).

**Verificação:** RED `ERR_MODULE_NOT_FOUND` → GREEN em ambos os módulos novos · `node --test tests/*.test.mjs` **84/84** · `tests/rbac-banco.sql` 10 cenários pela Management API, encerrado em rollback, 0 fixtures vazadas · `npx tsc --noEmit` ✓ · `npm run build` ✓ 49 páginas · smoke ponta a ponta com atendente descartável: senha errada 401, cookie `HttpOnly`, `/api/admin/acessos` 401 sem sessão e **403 com sessão de atendente**, autopromoção a admin 403 · **ataque pela anon key recusado com `42501`** em `papel`, `permissoes` e `senha_hash` · alteração de permissão invalidou a sessão na hora (`motivo: permissoes_alteradas`) · escrita legítima (avatar) segue em 204. Usuário de teste removido.

**Pendências / próximos passos:**
- 🔴 **Fase 4** — Finanças, Relatórios e Análise ainda são só tela escondida: `financas_diarias`, `movimentacoes_caixa`, `caixas` e `crediario_*` continuam com grant total para `anon`. Enquanto isso não migrar para route handler autorizado, o §6 do pedido **não vale para esses módulos**.
- Fase 2 — tela de Acessos reconstruída; hoje a permissão só é editável por SQL ou pela rota `PATCH /api/admin/acessos`.
- Fase 5 — Dashboard decomposto: atendente com `dashboard.ver` ainda enxerga `receitaHoje`/`receitaTotal`.
- `ADMIN_SESSAO_SECRET` foi gerado no `.env.local` (não rastreado). **Precisa ser configurado também na Vercel** ou o login quebra em produção.
- `/api/controle-acesso`, `ControleAcessoContext` e `GerenciadorPermissoesEquipe` seguem mortos (RPCs inexistentes). Não removi: §3.7.

**Armadilhas descobertas:**
- Grant por coluna (`grant update (avatar_url, …)`) fecha escalonamento de privilégio sem quebrar tela — muito menos invasivo que revogar a tabela e migrar 8 arquivos de uma vez.
- `salvar_acesso_usuario` levanta `check_violation` para recusa de negócio (último admin, auto-edição). No route handler isso vira 409, não 500: é recusa, não falha.
- Revalidar a sessão contra o banco a cada request parece caro e não é: é busca por chave primária, e é o único jeito de uma permissão revogada parar de valer sem polling.

## [2026-08-15] Correção do "Dispensar" e redesenho da central de notificações

**Agente/Modelo:** Claude Opus 5 (Claude Code)
**Objetivo:** fazer as ações do painel funcionarem de fato e aproximar a interface de um sistema de gestão profissional.
**Arquivos alterados:** `supabase/migrations/202608150003_notificacoes_dispensar.sql`, `src/lib/notificacoes.mjs`, `src/lib/notificacoes.d.mts`, `tests/notificacoes.test.mjs`, `tests/notificacoes-banco.sql`, `src/contexts/NotificacoesContext.tsx`, `src/components/admin/notificacoes/{ItemNotificacao,PainelNotificacoes,SinoNotificacoes,ModalAlertasEntrada,NotificacoesRoot,aparencia}.tsx|.ts`, `UI.md`, `Progress.md`.

**O defeito (confirmado no banco antes de tocar em código):** três linhas de
`notificacoes_leitura` já tinham `silenciada_em` preenchido — o clique em
**Dispensar** chegava ao Postgres. O que não existia era o lado da leitura:
nem `resumo_notificacoes`, nem `listar_notificacoes`, nem o filtro do painel
consultavam a coluna. O item voltava na lista e continuava no badge, então o
botão parecia morto. Com os 5 alertas já lidos, "Marcar todas como lidas"
ficava desabilitado e o painel não tinha saída nenhuma.

**O que foi feito:**
- Migration `202608150003`: `resumo_notificacoes` e `listar_notificacoes` passam a respeitar `silenciada_em`. `p_incluir_resolvidas` vira "incluir histórico" (resolvidas + dispensadas), sem trocar a assinatura.
- `notificacaoVisivelNaCentral` / `notificacaoNoHistorico` no domínio, espelhando o `where` do banco; `resumirNotificacoes` reescrito sobre `contribuicaoResumo`.
- `deltaResumo` para a marcação otimista: dispensar tira urgentes/normais/naoLidas/total de uma vez, e não tira "não lida" de algo que já estava lido.
- Delta calculado **fora** dos updaters, sobre um espelho síncrono (`notificacoesRef`): o cálculo antigo chamava `setResumo` dentro do updater de `setNotificacoes`, que o StrictMode executa duas vezes.
- Clicar no cartão agora marca como lida antes de navegar — ir até o contexto é atender o aviso.
- UI: painel virou `Popover` ancorado no sino (desktop) e `Drawer` no mobile, no lugar do `Dialog` centrado. Cartões com borda, ações `✓`/`✕` no canto e *stretched link* no lugar da fileira de botões de texto. Rodapé de três ghosts virou dois; "aviso ao entrar desligado" virou aviso no corpo com botão de reverter.
- Selo **Urgente** removido do cartão: com 4 de 5 produtos esgotados ele aparecia em tudo e apagava a diferença entre baixo e esgotado. Urgência agora é o agrupamento + fio vermelho na borda.

**Decisões tomadas:** dispensada continua `ativa` no banco (a condição continua verdadeira) e some só para quem dispensou; reincidência é linha nova, sem registro de leitura, então volta a aparecer. Nada de Realtime — a estratégia de egress da spec segue valendo.

**Verificação:** `node --test tests/notificacoes.test.mjs` 20/20 (4 casos novos) · `tests/notificacoes-banco.sql` com os cenários 25 e 26 novos, aplicado pela Management API e encerrado em rollback (0 fixtures vazadas) · `npx tsc --noEmit` sem erros · `npm run build` ✓ 49 páginas · validação ponta a ponta pela rota HTTP com chave de teste descartável: 5 ativas → dispensar → 4 ativas e badge 4, item presente no histórico, outro usuário segue com 5. Artefato de teste removido do banco.

**Pendências / próximos passos:** smoke visual do popover e do drawer após login, desktop e mobile — a verificação desta sessão foi por API, não por navegador.

**Armadilhas descobertas:**
- Gravar uma coluna de leitura sem que alguma leitura a respeite produz botão que "não funciona" sem erro nenhum no console nem no banco. Toda coluna de `notificacoes_leitura` precisa aparecer no `where` de quem lista **e** de quem conta.
- `PopoverContent` e `DialogContent` já trazem `overflow-y-auto`; sobrescrever com `overflow-hidden` não resolve, porque o twMerge trata `overflow` e `overflow-y` como grupos diferentes e os dois sobrevivem. O correto é `overflow-y-hidden`.
- `max-h: min(32rem, var(--radix-popover-content-available-height))` não vira classe: a vírgula não sobrevive ao JIT. Vai em `style` inline, depois do `zIndex` que o primitivo injeta.

## [2026-08-15] Reconstrução da Ajuda do Admin a partir do produto real

**Agente/Modelo:** Cursor Grok 4.6
**Objetivo:** a Ajuda do `/admin` documentar só o que o usuário alcança hoje, com Estoque, Vitrine e Lucro alinhados ao código.
**Arquivos alterados:** `specs/ajuda-admin.md`, `tests/ajuda-admin.test.mjs`, `src/features/onboarding/help/catalogo.mjs`, `src/features/onboarding/help/catalogo.d.mts`, `src/features/onboarding/help/sincronizar-menu.ts`, `src/features/onboarding/components/{help-panel,module-catalog,help-button,onboarding-root}.tsx`, `src/features/onboarding/config/index.ts`, `src/features/onboarding/config/financas.ts`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Auditei o menu (`GRUPOS_MENU_ADMIN`), `ROTAS_ADMIN_OCULTAS` e as telas importadas; a lista antiga de treinamentos não foi usada como fonte.
- Spec e 10 testes em RED (módulo inexistente) antes do catálogo; GREEN com cobertura, contexto, busca e exclusão de legado.
- Catálogo central `rota → título → categoria → conteúdo → palavras-chave` para as 15 rotas reais + artigo virtual de Notificações.
- Painel mostra o artigo da tela atual, busca e índice das áreas; sumiu o “Em breve” e o progresso 0 de 3 dos tours mortos.
- Tours de Crediário e Painel deixaram de ser registrados (arquivos mantidos). Tour de Finanças corrigido: Lucro = subtotal − custo histórico do item; abas Lançamentos / Diárias / Lucro.
- Alerta em desenvolvimento se o menu ganhar rota sem artigo.
**Decisões tomadas:** documentação por artigo em vez de 15 tours com demo store; não apaguei configs/demos de Crediário e Painel; não documentei Fiado nem cupom de combo (legado visível, fora da operação). Lucro documentado pela RPC `obter_lucro_produtos`, não por fórmula inventada.
**Verificação:** RED `ERR_MODULE_NOT_FOUND` → GREEN `node --test tests/ajuda-admin.test.mjs` (10/10) · `npx tsc --noEmit --incremental false` ✓ · ReadLints sem erros nos arquivos tocados · bug-hunter ✓ (tutorial guiado só na tela correspondente). Browser/mobile não exercitados nesta sessão (Ajuda só aparece após login).
**Pendências / próximos passos:** smoke visual após login em cada rota do menu, desktop e mobile. `npm run lint` continua o script legado incompatível com Next 16.
**Armadilhas descobertas:**
- O progresso “0 de 3” vinha de tours registrados para `/admin/crediario` e `/admin/painel`, rotas que o layout redireciona. O catálogo da sidebar nunca mostrava esses tours, só “Em breve”.
- Lucro bruto ≠ resultado do caixa: a aba Lucro ignora despesas/salário/diárias e só usa itens com `custo_unitario` em pedidos que não estão cancelados, aguardando ou pendentes.
- `usePathname` não traz query string; `?produto=` em Estoque não muda o artigo contextual.

## [2026-08-15] Correção do PRD para o projeto real

**Agente/Modelo:** Claude Opus 5
**Objetivo:** substituir no `PRD.md` a descrição herdada do Edienai Lanches pelo estado verificado do projeto Fortes Fios.
**Arquivos alterados:** `PRD.md`, `Progress.md`.
**O que foi feito:**
- Todos os números e nomes foram levantados do banco pela Management API e do repositório, não do texto anterior.
- Projeto corrigido: `fortes-fios` / `tjljhspczbaxtpbxlyjd` / PG 17.6.1.155 / criado em 2026-08-13 — o PRD apontava para `edienai` / `bawysvqqeqwxasmggfcn`.
- Inventário corrigido: 30 tabelas + 1 view, 365 colunas, 98 índices, 20 funções e 5 triggers. O texto anterior dizia 50 tabelas, 647 colunas, 199 índices, 82 funções e 36 triggers.
- Nova seção **§Legado: código presente, banco ausente**, com a tabela módulo × estruturas ausentes. É a correção mais importante: as telas ocultas não estão apenas escondidas — suas tabelas e funções não existem.
- Segurança reescrita com os números reais (0 pedidos, 1 cliente, 1 usuário) e com a correção sobre `.env.local`.
- Arquitetura do repositório corrigida: os subprojetos Electron e o bot não existem aqui.
- Rotas, fluxos, integrações, hotspots e glossário alinhados ao que existe; acrescentados os fluxos de Estoque e Notificações.
- Seção Realtime reescrita: a publication está vazia e 32 arquivos assinam `postgres_changes` sem receber evento.
**Decisões tomadas:** preservei o legado como seção documentada em vez de apagá-lo, porque o código continua no repositório e a próxima pessoa precisa saber por que aquelas telas existem e por que não podem ser reativadas por toggle. Marquei com `[?]` a única questão em aberto: o destino desse legado.
**Verificação:** cada afirmação numérica conferida por consulta à Management API ou por contagem no repositório nesta sessão. Contagens de tabela por domínio somam exatamente as 30 tabelas. Sem alteração de código, portanto sem typecheck/build novos — o build desta sessão já havia passado.
**Pendências / próximos passos:**
- 🔴 O `AGENTS.md` §3.9 e §3.10 ainda descrevem o projeto antigo (50 tabelas; `.env.local` versionado com `MERCADO_PAGO_ACCESS_TOKEN`/`EVOLUTION_API_KEY`/`VERCEL_OIDC_TOKEN`). Como o `AGENTS.md` tem precedência sobre o `PRD.md` (§1), essa divergência engana o próximo agente. Correção pendente de autorização.
- Decidir o destino do código legado: remover, migrar ou reativar com migration própria.
**Armadilhas descobertas:**
- O banco veio de `supa-mk/00_public_schema.sql` (dump estrutural do projeto "MK Soluções", 27 tabelas), aplicado como a única migration do histórico remoto. O frontend veio do Edienai inteiro. A divergência entre os dois é a origem de quase todo o legado quebrado.
- 17 RPCs são chamadas pelo código e **não existem** no banco (crediário, produtividade, controle de acesso, mesas, fila de impressão).
- `SUPABASE_SERVICE_ROLE_KEY` **está** configurada, ao contrário do que o PRD afirmava ao justificar as funções `security definer` de produtividade.
- `.env.local` **não** está rastreado no git neste repositório e contém apenas as quatro variáveis do Supabase.

## [2026-08-15] Central de Notificações do Admin e alerta visual de estoque

**Agente/Modelo:** Claude Opus 5
**Objetivo:** entregar uma central interna de notificações persistente e sem duplicação, com estoque e pedidos como casos críticos, e tornar o estoque baixo evidente na listagem de Estoque.
**Arquivos alterados:** `specs/central-notificacoes-admin.md`, `supabase/migrations/202608150002_central_notificacoes_admin.sql`, `tests/notificacoes.test.mjs`, `tests/notificacoes-banco.sql`, `src/lib/notificacoes.mjs`, `src/lib/notificacoes.d.mts`, `src/contexts/NotificacoesContext.tsx`, `src/app/api/admin/notificacoes/route.ts`, `src/components/admin/notificacoes/{index.ts,aparencia.ts,ItemNotificacao.tsx,PainelNotificacoes.tsx,SinoNotificacoes.tsx,ModalAlertasEntrada.tsx,NotificacoesRoot.tsx}`, `src/app/admin/layout.tsx`, `src/components/admin/AdminLayout.tsx`, `src/components/admin/produtos/ControleEstoqueProduto.tsx`, `src/app/admin/estoque/page.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Spec e testes escritos e observados em RED antes da implementação (domínio: módulo inexistente; banco: `relation "public.notificacoes" does not exist`).
- Uma notificação passou a representar uma **condição**, não um evento: `notificacoes` com `chave_dedupe` e índice único parcial `where estado = 'ativa'`, o que torna a duplicação estruturalmente impossível.
- Geração por trigger em `produtos` e `pedidos`, nunca na leitura da tela — abrir a página não cria nada. `reconciliar_notificacoes()` faz uma passada conjunta idempotente e escala pedido parado há 12 h de `normal` para `urgente` na mesma linha.
- Estado por usuário em `notificacoes_leitura` (visualizada/lida/silenciada) e preferência do modal em `notificacoes_preferencias` — ambos no banco, então sobrevivem a refresh, logout/login e reabertura do navegador.
- Sino no header com badge que vem de contadores (`resumo_notificacoes`), nunca de varredura da lista; painel separando "Precisa de atenção" de "Informações"; modal de entrada com "Não mostrar novamente" reversível pelo rodapé do painel.
- Item da notificação leva ao contexto: produto abre `/admin/estoque?produto=<id>` com a linha destacada; pedido abre `/admin/pedidos/<id>`.
- Tela de Estoque ganhou barra lateral âmbar/vermelha, ícone no badge, quantidade colorida e card "Esgotados" em vermelho quando há esgotado.
**Decisões tomadas:**
- **Sem Realtime**, por decisão explícita do usuário de não consumir o egress do plano free: uma busca ao montar, invalidação após mutação na própria aba e revalidação por foco (throttle de 60 s) que só busca a lista quando os contadores mudam. Nenhum polling por intervalo.
- **Tipos limitados a estoque e pedidos.** Crediário, caixa e cupons ficaram de fora porque as telas estão em `ROTAS_ADMIN_OCULTAS` (legado do restaurante) e as tabelas têm zero linhas. A engine nasceu genérica: um gerador novo é só uma função SQL, sem migration de schema.
- **Estoque baixo = âmbar, esgotado = vermelho**, escolhido pelo usuário. Vermelho fica reservado ao caso terminal; com 4 de 5 produtos esgotados hoje, pintar tudo de vermelho destruiria a hierarquia.
- Funções de sincronização são `SECURITY DEFINER` com `search_path` vazio (mesmo padrão de `sincronizar_estoque_item_pedido`), o que permitiu **revogar** as tabelas novas de `anon`/`authenticated` sem quebrar a escrita do site público.
- `usuario_chave` é `text`, não FK `uuid`, porque `usuarioAtual` é `null` nos logins hardcoded; cai para `'admin-local'`, como o `'default'` do onboarding.
**Verificação:** RED confirmado nos dois níveis antes da implementação · red-green de regressão validado (remover a regra de silenciamento derruba o teste 10; restaurar volta ao verde) · `node --test tests/*.test.mjs` ✓ (48 testes) · teste SQL transacional com rollback ✓ (10 cenários, sem fixture vazada) · ciclo completo exercitado contra o banco real: repor→resolvida, reincidir→**linha nova**, continuar baixo→**não duplica**, esgotar→troca de tipo, e 1 ativa por produto em todas as transições · endpoints exercitados por HTTP: badge, marcar lida, isolamento entre usuários e persistência do "não mostrar novamente" · `npx tsc --noEmit --incremental false` ✓ 0 erros · `npm run build` ✓ (49 páginas) · `git diff --check` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓. `npm run lint` continua quebrado por motivo pré-existente (`next lint` incompatível com Next 16 — interpreta "lint" como diretório).
**Pendências / próximos passos:** corrigir o script de lint em task própria de tooling. Avaliar geradores de notificação para crediário/caixa quando esses fluxos entrarem em uso.
**Armadilhas descobertas:**
- 🔴 **A publication `supabase_realtime` deste projeto está VAZIA.** `pg_publication_rel` só contém `realtime.messages_*`. A migration `202607280016_realtime.sql` existe no repositório mas **nunca foi aplicada aqui** — ela veio transcrita do projeto original do Edienai. Consequência verificada: o `postgres_changes` de `src/app/admin/estoque/page.tsx` **nunca dispara**. Não foi corrigido por estar fora do escopo; é task própria, e qualquer tela que "depende de Realtime" hoje está, na prática, sem atualização automática.
- As migrations em `supabase/migrations/` não são espelho fiel do banco: parte foi transcrita do projeto antigo e não aplicada. Confirme pelo banco, não pelo arquivo.
- `ALTER DEFAULT PRIVILEGES` do Supabase concede tudo a `anon`/`authenticated` em tabela nova. Tabela criada sem `revoke` explícito nasce aberta.
- Declaração de tipos de módulo `.mjs` precisa se chamar `<nome>.d.mts`. O `<nome>.mjs.d.ts` (padrão de `nome-cliente-local.mjs.d.ts`) **não** é lido pelo TypeScript — a tipagem vinha da inferência do JSDoc.
- `useSearchParams` em página client obriga fronteira de `Suspense`, senão o build falha no prerender. `/admin/pedidos` já tinha o padrão.

## [2026-08-15] Edição clara das categorias do catálogo

**Agente/Modelo:** Codex GPT-5
**Objetivo:** tornar o renomeio de categorias encontrável no Admin e permitir editar o nome do filtro que reúne todo o catálogo.
**Arquivos alterados:** `specs/edicao-categorias-catalogo.md`, `tests/categorias-publicas.test.mjs`, `src/lib/categorias-publicas.mjs`, `src/lib/categoriasCardapio.ts`, `src/app/api/vitrine/categorias/route.ts`, `src/app/admin/produtos/page.tsx`, `src/app/page.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Especificação e testes do rótulo geral foram escritos antes da implementação; o RED confirmou a ausência da regra e o GREEN validou padrão, normalização e chave estável.
- A ação antes escondida no lápis virou `Editar categoria` no desktop, mantendo um alvo acessível e compacto no mobile.
- O filtro geral aparece separadamente e usa por padrão `Todos os tipos de cabelo`; o administrador pode renomeá-lo sem criar uma categoria falsa nem alterar produtos.
- Categorias reais continuam usando o fluxo existente, que preserva vínculos; o rótulo geral reutiliza `configuracoes_loja` e chega ao site na mesma resposta das categorias.
- O catálogo mantém o filtro ativo ao receber um novo nome e reage em tempo real a alterações de categorias e da configuração.
**Decisões tomadas:** nenhuma migration foi criada porque `configuracoes_loja` já é a estrutura chave/valor destinada a esse tipo de preferência. O filtro universal foi separado visual e estruturalmente das categorias atribuíveis.
**Verificação:** RED ✓ · `node --test tests/*.test.mjs` ✓ (32 testes) · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (49 páginas) · `git diff --check` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓. `npm run lint` foi executado, mas o script legado `next lint` é incompatível com Next 16 e falha antes de analisar arquivos.
**Pendências / próximos passos:** nenhuma dentro deste escopo.
**Armadilhas descobertas:** a capacidade de renomear já existia, mas um botão somente com ícone a tornava praticamente invisível; “Todos” era constante de frontend e não uma linha de `categorias_cardapio`.

## [2026-08-15] Hero desktop responsivo e carregamento resiliente de imagens

**Agente/Modelo:** Codex GPT-5
**Objetivo:** restaurar as artes horizontais do Hero no desktop sem alterar o mobile aprovado e impedir que falhas transitórias do Backblaze apareçam como imagens quebradas.
**Arquivos alterados:** `specs/hero-responsivo-imagens-resilientes.md`, `tests/imagens-publicas.test.mjs`, `src/lib/imagem-publica.mjs`, `next.config.js`, `src/components/HeroVitrine.tsx`, `src/app/api/upload/route.ts`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A spec e os cinco testes de regressão foram escritos antes da implementação; o RED confirmou a ausência do módulo e o GREEN validou a seleção de mídia e normalização das URLs.
- O Hero passou a usar a arte desktop como fonte-base e a arte mobile somente até 639 px, mantendo as proporções já persistidas de 21:8/16:9 e 4:5/9:16.
- Imagens do bucket passaram a usar a rota same-origin existente, com três tentativas no cliente S3 e cache público imutável; imagens locais e hosts externos permanecem intactos.
- O carregador customizado do Next aplica essa proteção de forma central aos componentes `next/image`, enquanto o Hero reutiliza a mesma regra no `<picture>` de art direction.
**Decisões tomadas:** manter `object-contain` e os recortes salvos, corrigindo apenas a origem selecionada. A rota existente foi estendida em vez de criar proxy ou componente paralelo.
**Verificação:** RED ✓ · `node --test tests/*.test.mjs` ✓ (27 testes) · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (49 páginas) · `git diff --check` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓. `npm run lint` foi executado, mas o script legado `next lint` é incompatível com Next 16 e falha antes de analisar arquivos.
**Pendências / próximos passos:** corrigir o script de lint em uma task própria de tooling.
**Armadilhas descobertas:** com `images.unoptimized: true`, `getImageProps` não fornece `srcSet`; usar a arte mobile como `src` base fazia o desktop permanecer mobile. A mesma URL B2 respondeu `503` e depois `206`, confirmando a intermitência relatada.

## [2026-08-15] Controle de estoque integrado

**Agente/Modelo:** Codex GPT-5
**Objetivo:** entregar controle de estoque simples no Admin e autoritativo no banco, consistente até o catálogo e a criação do pedido.
**Arquivos alterados:** `AGENTS.md`, `specs/controle-estoque.md`, `supabase/migrations/202608150001_controle_estoque_produtos.sql`, `tests/estoque-produtos.test.mjs`, `tests/estoque-banco.sql`, `src/lib/estoque-produto.mjs`, `src/lib/supabase.ts`, `src/lib/admin-sidebar-routes.ts`, `src/app/admin/estoque/page.tsx`, `src/components/admin/produtos/ControleEstoqueProduto.tsx`, `src/components/admin/produtos/ModalFormularioProduto.tsx`, `src/app/admin/produtos/page.tsx`, `src/app/admin/pedidos/novo/page.tsx`, `src/components/admin/ModalEditarPedido.tsx`, `src/app/page.tsx`, `src/contexts/CarrinhoContext.tsx`, `src/components/CartaoProduto.tsx`, `src/components/ModalIngredientes.tsx`, `src/components/ModalComplementos.tsx`, `src/components/ModalCarrinho.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Os testes de domínio e SQL foram escritos e observados falhando antes da implementação; depois ficaram verdes.
- Produtos receberam quantidade, limite baixo e bloqueio opcional de venda no zero, sem status persistido duplicado.
- A migration aplicada pela Management API adicionou constraints, RPCs atômicas e reserva/restauração de estoque por item do pedido.
- A nova tela Estoque oferece resumo, filtros, busca, ajuste direto, zerar e bloqueio comercial; Produtos reutiliza o mesmo controle compacto.
- Catálogo, detalhe, personalização, carrinho, checkout, novo pedido e edição de pedido compartilham a regra de disponibilidade e preservam `produto_id`.
- Produto bloqueado no zero permanece visível como `ESGOTADO`; chamadas diretas do frontend ainda são recusadas pelo contexto e pelo trigger do banco.
- Atualizações Realtime de estoque reconciliam somente a linha alterada nas superfícies tocadas, sem refetch completo.
**Decisões tomadas:** reserva ocorre na criação de `itens_pedido`; cancelamento/remoção restaura somente o valor efetivamente consumido. Produtos legados iniciam em zero com bloqueio desativado. Mercado Pago/pagamento online ficou explicitamente fora do escopo.
**Verificação:** RED confirmado antes da implementação no teste de domínio e no SQL · `node --test tests/estoque-produtos.test.mjs` ✓ (11 testes, 16 cenários cobertos) · teste SQL transacional via Management API ✓ com rollback · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (49 páginas) · `bug-hunter` ✓ · `verification-before-completion` ✓. `npm run lint` foi executado, mas o script legado `next lint` é incompatível com Next 16 e falha antes de analisar arquivos; a inspeção dirigida não encontrou `TODO`, `console.log` ou `debugger` novos.
**Pendências / próximos passos:** corrigir o comando de lint do projeto em uma task própria de tooling, sem misturar essa mudança à entrega de estoque.
**Armadilhas descobertas:** itens adicionados por `ModalEditarPedido` antes desta correção não preservavam `produto_id`; sem esse vínculo, qualquer trigger de produto seria contornado. O banco continua sem RLS conforme risco global já documentado.

## [2026-08-15] Governança TDD/Spec-Driven e especificação do estoque

**Agente/Modelo:** Codex GPT-5  
**Objetivo:** tornar TDD e Spec-Driven obrigatórios e definir, antes do código, o comportamento completo do controle de estoque.  
**Arquivos alterados:** `AGENTS.md`, `specs/controle-estoque.md`, `Progress.md`.  
**O que foi feito:**
- `AGENTS.md` agora exige o ciclo SPEC → RED → GREEN → REFACTOR → VALIDAÇÃO e proíbe implementação antes do teste falho.
- Auditados schema real do Supabase, formulário/listagem de Produtos, site público, Context/carrinho, checkout, novo pedido Admin, edição de pedido e pagamento online.
- Documentada a proposta de quantidade, limite baixo e bloqueio comercial sem status duplicado.
- Documentados os 16 cenários corrigidos, sem tenant/slug, incluindo proteção contra bypass do frontend.
- Identificado que `ModalEditarPedido` não preserva `produto_id` em novos itens e que o checkout direto exige validação autoritativa no banco.
**Decisões tomadas:** produtos existentes usam quantidade zero com bloqueio desativado para não interromper vendas; a reserva automática na criação do item foi recomendada, mas ficou no gate humano antes de migration ou implementação.  
**Verificação:** leitura cruzada da spec com código e schema de produção via Management API ✓ · nenhuma migration ou implementação executada ✓.  
**Pendências / próximos passos:** validar o momento de reserva/baixa; após aprovação, escrever e executar os testes em RED antes de implementar.  
**Armadilhas descobertas:** o carrinho é localStorage e os pedidos são gravados direto no Supabase; bloquear apenas a UI não protege estoque. A autenticação Admin atual não sustenta um endpoint `service_role` realmente privilegiado sem uma task coordenada de auth/RLS.

## [2026-08-14] Correção da fonte selecionada no hero público

**Agente/Modelo:** Codex GPT-5
**Objetivo:** fazer a família escolhida no editor da Vitrine prevalecer no título e subtítulo publicados.
**Arquivos alterados:** `src/components/HeroVitrine.tsx`, `src/app/globals.css`, `Progress.md`.
**O que foi feito:**
- Identificada por inspeção do CSS compilado a colisão entre a regra global dos headings públicos e a família herdada do contêiner do banner.
- A família selecionada passou a ser aplicada diretamente ao título e ao subtítulo do hero.
- Títulos configuráveis foram excluídos da regra tipográfica global, mantendo a regra inalterada para os demais headings do site e sem recorrer a `!important`.
**Decisões tomadas:** corrigir a origem da cascata no hero, sem elevar globalmente a especificidade das quatro famílias e sem alterar persistência ou banco.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · CSS compilado confirma as quatro famílias e a exclusão dos headings configuráveis da regra global ✓ · `git diff --check` ✓ · `ui-review` Pass ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro desta correção.
**Armadilhas descobertas:** uma classe de fonte no ancestral não prevalece quando o heading filho recebe `font-family` diretamente de uma regra global mais específica.

## [2026-08-14] Tipografia configurável por banner da Vitrine

**Agente/Modelo:** Codex GPT-5
**Objetivo:** dar presença e nitidez às chamadas do hero permitindo escolher fonte e peso individualmente em cada banner.
**Arquivos alterados:** `src/lib/fonts.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/lib/vitrineBannerTexto.ts`, `src/app/admin/vitrine/page.tsx`, `src/components/HeroVitrine.tsx`, `src/components/admin/ModalRecorteImagem.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Confirmado que o Meu Burguer declara Satoshi sem carregá-la e, portanto, exibe Bricolage Grotesque como fonte real do hero, em pesos fortes.
- Cada banner agora persiste família tipográfica e peso da frase principal no JSON existente, sem migration.
- O editor oferece Quiche Sans, Bricolage Grotesque, Raleway e Geist, com amostra imediata e pesos Leve, Médio, Seminegrito e Negrito.
- Formulário, prévia desktop/mobile, prévia do recorte e hero público compartilham as mesmas classes tipográficas.
- Banners antigos continuam válidos e usam Quiche Sans leve quando os novos campos não existem.
**Decisões tomadas:** Bricolage foi incorporada como opção de impacto, não como substituição global da identidade Fortes Fios. Foram carregados pesos reais das quatro famílias para evitar negrito sintético e perda de nitidez.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · CSS compilado contém as quatro famílias e pesos reais ✓ · `git diff --check` ✓ · `ui-review` Pass ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro da tipografia dos banners.
**Armadilhas descobertas:** declarar uma fonte antes do fallback no CSS não significa que ela está carregada; no Meu Burguer, “Satoshi” não possui arquivo/import e o navegador usa Bricolage Grotesque.

## [2026-08-14] Auditoria mobile do admin — camadas, teclado iOS e zoom nos campos

**Agente/Modelo:** Claude Opus 5
**Objetivo:** tornar a experiência mobile do admin robusta no Safari/iOS, corrigindo na camada compartilhada as causas estruturais dos drawers que se reorganizam com o teclado e do zoom automático ao focar campos.
**Arquivos alterados:** `src/components/ui/overlay-layer.tsx` (novo), `src/components/ui/{drawer,dialog,alert-dialog,sheet,popover,select,tooltip,dropdown-menu,command}.tsx`, `src/hooks/useIsMobile.ts`, `src/app/layout.tsx`, `src/app/admin/layout.tsx`, `src/app/globals.css`, `src/components/admin/AdminLayout.tsx`, `ModalWhatsApp.tsx`, `ControleStatusLoja.tsx`, `GerenciadorFuncionarios.tsx`, `GerenciadorUsuariosClientes.tsx`, `ModalDetalhesPedido.tsx`, `cupons/GerenciadorCupons.tsx`, `entregas/DialogPagarEntregador.tsx`, `filtros/FiltroAvancado.tsx`, `pagamento/ModalFormaPagamentoItens.tsx`, `src/features/financas/components/PainelDiarias.tsx`, `src/features/onboarding/components/{help-panel,step-content}.tsx`, `UI.md`, `Progress.md`.

**Escopo — o que ficou de fora e por quê:** `AdminLayout.tsx:81-95` mantém `ROTAS_ADMIN_OCULTAS`, que bloqueia 13 rotas herdadas do sistema de restaurante (`pdv`, `mesas`, `salao`, `impressora`, `garcons`, `produtividade`, `painel`, `caixa`, `crediario`, `combos`, `adicionais`, `whatsapp`, `anos-anteriores`): elas renderizam `null` e redirecionam para o dashboard. Também não foram tocados componentes sem nenhum importador — `PainelAnotacoes`, `BotaoImprimirPedido`, `BotaoPreviewMobile`/`ModalPreviewMobile`, `ui/input-aceternity`, `kibo-ui/mini-calendar` — nem o bloco `open={false}` em `ModalDetalhesPedido.tsx`. As correções de base alcançam essas telas sem custo de diff.

**O que foi feito:**
- **Camadas:** nova escala derivada da ordem de abertura (`overlay-layer.tsx`), substituindo os `z-index` literais dos nove primitivos. `Sheet` saiu do `z-50` e `DropdownMenu` do `z-[10001]`.
- **Teclado:** `Drawer` passou a desligar o `repositionInputs` do vaul por padrão, e o `DrawerContent` aplica o `useAjusteTecladoVirtual` — que existia desde julho e tinha um único consumidor, o checkout público. O `Dialog` centrado recebeu o mesmo tratamento para iPhone deitado.
- **Zoom:** marcador SSR `data-admin-shell` + regra de 16 px escopada ao admin no mobile, alcançando os ~144 usos de `<Input>`, os ~50 campos crus e os campos dentro de portais com uma regra só.
- **Viewport:** `viewport`/`themeColor` movidos para `export const viewport`; dentro de `metadata` o Next 16 descartava os dois, então nem a meta nem o `theme-color` chegavam ao HTML. O `maximumScale: 1` foi deliberadamente descartado.
- **AdminLayout:** removido o bloqueio manual de scroll no `body`; menu do usuário virou `DropdownMenu`; o `Drawer` da sidebar deixou de montar no desktop.
- **Overlays manuais:** `ModalWhatsApp` virou `ModalSheet` e o formulário de cupom virou `Dialog` — ganharam focus trap, Escape e bloqueio de scroll.
- **Consumidores vivos:** `vh` → `dvh`, `100vw` → `100%`, safe-area nos rodapés, cadeia de scroll em `DialogPagarEntregador`, `PainelDiarias` e `FiltroAvancado`.

**Decisões tomadas:** a camada vem de uma pilha de módulo, e não só de contexto React, porque no admin quase todo modal aninhado é **irmão** do que o abriu — com contexto puro os empates continuariam. O contador de overlays que eu havia planejado para travar o `<main>` foi descartado depois de verificar que o `react-remove-scroll` do Radix já bloqueia o scroll por evento, inclusive fora do `body`; mantê-lo seria código morto e ainda causaria salto de scrollbar no desktop. O `viewportFit: 'cover'` não foi ativado: sem ele o Safari já posiciona a página dentro da safe area, e ativar exigiria reauditar a loja pública.

**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · `npm run build` ✓ (compilado sem warnings; o warning de `metadata viewport` desapareceu) · HTML estático de `/admin/dashboard` contém `data-admin-shell`, `<meta name="viewport" content="width=device-width, initial-scale=1">` e os dois `theme-color` ✓ · CSS compilado contém a regra de 16 px dentro de `@media (max-width:767px)`, depois das utilitárias e com especificidade maior ✓ · varredura confirmou zero `vh`/`100vw` restantes na superfície viva do admin ✓ · `npm run lint` **indisponível**: o script legado `next lint` foi removido no Next 16.

**Pendências / próximos passos:** a validação em iPhone/Safari real continua necessária (AGENTS §3.4 proíbe teste de browser aqui) — o roteiro por drawer está na resposta da task. `tailwindcss-animate` **não está instalado** (`tailwind.config.js` → `plugins: []`), então `animate-in`, `fade-in-0`, `zoom-in-95` e `slide-in-from-*` dos overlays são CSS morto hoje; instalar é dependência nova (§3.2) e precisa de autorização. O `package.json` traz o pacote monolítico `radix-ui` junto com 16 `@radix-ui/react-*` individuais — risco de duas cópias de contexto do `react-dialog`. O repositório usa **pnpm** (`pnpm-lock.yaml`), não npm como diz o `SKILLS.md`.

**Armadilhas descobertas:**
- Empatar `z-index` entre overlays é pior que errar o valor: com overlay 1000 e conteúdo 1001 fixos, o backdrop do modal filho fica **abaixo** do conteúdo do pai, que continua aceso por cima do escurecimento. É o sintoma de "drawer atrás do modal".
- O Radix copia o `z-index` **computado** do Content para o wrapper do popper (`react-popper@1.3.7`, `getComputedStyle(content).zIndex`). Por isso definir a camada inline no Content funciona para empilhamento entre portais — e por isso classe `z-[…]` de consumidor passa a perder para o inline do primitivo.
- No admin quem rola é o `<main data-admin-scroll-container>`, não o `body` — mas o `react-remove-scroll` do Radix bloqueia por evento (`wheel`/`touchmove`) e não só por `overflow` no `body`, então o scroll de fundo já estava contido.
- `metadata.viewport` no Next 16 é descartado silenciosamente: só o warning de build denuncia. Todo `env(safe-area-inset-*)` do projeto resolve 0 sem `viewport-fit=cover` — sem ele o navegador já insere a página na safe area, e o `max(1rem, env(…))` continua garantindo o respiro.
- Um `font-size: 1rem` sem guarda não é "mínimo de 16 px": ele também **reduz** campo deliberadamente maior. O `:not(.text-lg, …)` transforma a regra em elevação.

## [2026-08-14] Safari sem zoom, confirmação em drawer e identidade sem flash

**Agente/Modelo:** Codex GPT-5
**Objetivo:** estabilizar o checkout público no Safari/iOS, dar feedback claro à seleção de cidade e garantir que a identidade oliva esteja presente desde a primeira pintura.
**Arquivos alterados:** `src/app/globals.css`, `src/app/contato/page.tsx`, `src/components/ModalCarrinho.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Todos os inputs, textareas e selects da loja pública passaram a ter fonte computada mínima de 16 px, eliminando o gatilho de zoom automático do Safari/iOS sem alterar o admin.
- Os tokens da Fortes Fios agora também são ativados pelo marcador SSR `.fortes-fios-site`, antes de efeitos do cliente, removendo a primeira pintura azul.
- A confirmação de pedido deixou o overlay manual e passou a usar o Drawer Vaul compartilhado, com rolagem interna e ação protegida pela safe area.
- O gatilho e o drawer aninhado de cidades receberam hierarquia oliva, mudança clara de contexto, foco visível e seleção identificada por cor, texto e ícone.
**Decisões tomadas:** a proteção contra zoom foi aplicada por CSS escopado ao site público porque existem campos em vários componentes e portals; alterar cada campo separadamente deixaria lacunas. O marcador SSR já existente foi reutilizado em vez de inserir script bloqueante no cabeçalho.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · HTML estático contém `.fortes-fios-site` antes da hidratação ✓ · `git diff --check` ✓ · `ui-review`, `bug-hunter` e `verification-before-completion` ✓ · `npm run lint` indisponível pelo script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro do comportamento solicitado.
**Armadilhas descobertas:** aplicar tokens da marca apenas em `useEffect` sempre permite uma pintura com o tema global do admin; drawers em portal continuam cobertos porque o seletor usa o marcador público como descendente do `body`.

## [2026-08-14] Configurações de prazos e mínimos em Pedidos

**Agente/Modelo:** Codex GPT-5
**Objetivo:** centralizar em Pedidos os prazos informados ao cliente e oferecer edição rápida da compra mínima individual de cada cidade.
**Arquivos alterados:** `src/lib/configuracoes-pedidos.ts`, `src/components/admin/pedidos/ConfiguracoesPedidosDialog.tsx`, `src/app/admin/pedidos/page.tsx`, `src/app/admin/bairros/page.tsx`, `src/components/ModalCarrinho.tsx`, `src/components/admin/ConfiguracoesBot.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A página Pedidos ganhou uma engrenagem com painel responsivo de configurações.
- Retirada e entrega possuem prazos independentes, aceitando número ou intervalo em minutos.
- A compra mínima continua individual por cidade e usa os mesmos registros do checkout e de Cidades de entrega.
- Cidades de entrega ganhou o atalho “Prazos e mínimos”, que abre diretamente a configuração de Pedidos.
- O checkout mostra os prazos nos cards de escolha e usa o prazo correto na confirmação de retirada.
**Decisões tomadas:** não foi criado mínimo global; a tabela legada `bairros` permanece como fonte única por cidade. A chave existente `tempo_entrega_estimado` foi preservada e `tempo_retirada_estimado` foi adicionada como configuração chave/valor.
**Verificação:** validação de prazos ✓ · `npx tsc --noEmit` ✓ · build de produção ✓ (48 páginas) · `git diff --check` ✓ · revisão bug-hunter e verification-before-completion ✓ · `npm run lint` indisponível pelo script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro das configurações solicitadas.
**Armadilhas descobertas:** `inputMode="numeric"` não oferece hífen de forma consistente no Safari móvel, portanto campos que aceitam intervalo usam teclado textual.

## [2026-08-14] Agenda semanal e previsão de entrega por cidade

**Agente/Modelo:** Codex GPT-5
**Objetivo:** permitir que a loja configure os dias de entrega por cidade e comunicar ao cliente a próxima data real no checkout e na confirmação.
**Arquivos alterados:** `src/lib/agenda-entrega.ts`, `src/app/admin/bairros/page.tsx`, `src/components/ModalCarrinho.tsx`, `src/lib/server/pagamento-online.ts`, `src/lib/useEntregas.ts`, `src/lib/tipos-entregas.ts`, `supabase/migrations/202608140002_agenda_entrega_cidades.sql`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Cada cidade ganhou uma seleção semanal simples no admin, com resumo da recorrência na própria lista.
- Porto foi configurada para todos os dias, Nossa Senhora dos Remédios para segunda-feira e Campo Largo para terça-feira.
- O checkout informa recorrência e próxima data; a confirmação substitui o tempo genérico pela previsão quando for entrega.
- Pedido e entrega preservam `data_prevista_entrega`; no PIX online a data é recalculada no servidor a partir da cidade ativa.
**Decisões tomadas:** se o pedido for feito em um dia habilitado, a previsão é o próprio dia; não foi introduzido horário de corte porque não foi definido pela operação.
**Verificação:** Management API ✓ · cenário de domingo validado ✓ · `npx tsc --noEmit` ✓ · build de produção ✓ (48 páginas) · `git diff --check` ✓ · revisão bug-hunter e verification-before-completion ✓ · `npm run lint` indisponível pelo script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** definir horário de corte em tarefa própria caso pedidos feitos tarde devam passar para a semana seguinte.
**Armadilhas descobertas:** `entregas.data_entrega` registra a conclusão efetiva e não pode ser reutilizado como previsão; por isso a previsão possui coluna própria.

## [2026-08-14] Texto multilinear e posicionamento completo dos banners

**Agente/Modelo:** Codex GPT-5
**Objetivo:** permitir chamadas maiores com quebras de linha e ampliar o posicionamento do texto, mantendo as prévias fiéis ao hero publicado.
**Arquivos alterados:** `src/lib/vitrineBannerTexto.ts`, `src/app/admin/vitrine/page.tsx`, `src/components/HeroVitrine.tsx`, `src/components/admin/ModalRecorteImagem.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A frase principal virou textarea redimensionável, aceita Enter, mostra contador e comporta até 240 caracteres.
- O posicionamento passou de quatro opções para uma grade completa de nove combinações: esquerda, centro e direita nos eixos superior, central e inferior.
- Hero, prévia do editor e prévia do recorte preservam quebras de linha e compartilham as mesmas classes de alinhamento.
- A prévia do recorte passou a reproduzir também cor do texto e intensidade do overlay selecionadas.
**Decisões tomadas:** a configuração de posições foi centralizada porque já possui três consumidores reais; 240 caracteres permitem avisos comerciais maiores sem transformar o banner em conteúdo longo.
**Verificação:** typecheck intermediário ✓; verificação final registrada na resposta da task.
**Pendências / próximos passos:** nenhuma conhecida dentro do texto dos banners.
**Armadilhas descobertas:** a prévia de recorte antiga mostrava texto, mas sempre no canto inferior esquerdo e com gradiente escuro fixo, divergindo do banner publicado.

## [2026-08-14] Entrega por cidade com compra mínima

**Agente/Modelo:** Codex GPT-5
**Objetivo:** substituir a escolha tarifada de bairro por cidades atendidas, preservando bairro/endereço livres e impondo compra mínima de R$ 70 para entrega.
**Arquivos alterados:** `src/components/ModalCarrinho.tsx`, `src/lib/server/pagamento-online.ts`, `src/lib/registrar-cliente-pedido.ts`, `src/app/admin/pedidos/novo/page.tsx`, `src/components/admin/ModalEditarPedido.tsx`, `src/app/admin/bairros/page.tsx`, `src/app/admin/entregas/page.tsx`, `src/lib/tipos-entregas.ts`, `src/lib/useEntregas.ts`, `src/lib/useEntregador.ts`, `src/lib/admin-sidebar-routes.ts`, `supabase/migrations/202608140001_cidades_entrega.sql`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O checkout público agora seleciona cidade e coleta bairro, endereço e referência em campos próprios; a referência é opcional.
- Porto - PI, Nossa Senhora dos Remédios - PI e Campo Largo - PI foram cadastradas com taxas de R$ 5, R$ 10 e R$ 10 e compra mínima de R$ 70.
- O bloqueio por compra mínima foi aplicado ao checkout comum, ao PIX online e aos fluxos administrativos de criação/edição.
- Pedido, cliente e entrega preservam `cidade` separada de `bairro`; as listas de entrega passaram a exibir ambos.
- `/admin/bairros` permanece como rota e tabela física por compatibilidade, mas a interface agora administra cidades, taxas e mínimos.
**Decisões tomadas:** a compra mínima considera produtos após descontos de item e antes de frete/cupom; a tabela física `bairros` foi mantida para não quebrar integrações existentes.
**Verificação:** pendente ao início desta entrada; resultados finais registrados na resposta da task.
**Pendências / próximos passos:** renomear fisicamente a tabela é uma migração coordenada futura e não é necessária para o comportamento atual.
**Armadilhas descobertas:** o modal de edição recebe pedidos de sete telas com selects diferentes; por isso ele precisa recarregar cidade, bairro e endereço pelo ID antes de salvar.

## [2026-08-14] Faixa promocional editável no cabeçalho público

**Agente/Modelo:** Codex GPT-5
**Objetivo:** incluir acima da navegação pública uma faixa oliva fina e rolante, com mensagem e visibilidade controladas pela Vitrine do administrador.
**Arquivos alterados:** `src/lib/vitrineFaixaRodape.ts`, `src/app/api/vitrine/faixa-rodape/route.ts`, `src/components/FaixaRodape.tsx`, `src/components/admin/vitrine/EditorFaixaRodape.tsx`, `src/components/Header.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/admin/vitrine/page.tsx`, `UI.md`, `Progress.md`; `tsconfig.tsbuildinfo` pode ser regenerado pelo typecheck.
**O que foi feito:**
- A loja pública ganhou uma faixa promocional no topo em oliva, com Quiche Sans, repetição contínua e mensagem padrão “Frete grátis em compras a partir de R$ 150”.
- A nova aba Cabeçalho em `/admin/vitrine` permite ativar, ocultar e editar a mensagem com contador e prévia fiel.
- A configuração reutiliza `configuracoes_loja`; a leitura pública passa por route handler server-side e não expõe credenciais administrativas ao navegador.
- A animação é ignorada quando o visitante prefere movimento reduzido, mantendo uma mensagem estática e acessível.
**Decisões tomadas:** a faixa é estritamente informativa e não altera o cálculo de frete ou o checkout; na ausência de configuração salva, a oferta padrão permanece ativa para que a entrega solicitada seja visível imediatamente.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `git diff --check` ✓ · busca de resíduos ✓ · `npm run lint` indisponível pelo script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** nenhuma funcionalidade de frete real faz parte desta task.
**Armadilhas descobertas:** mensagem promocional e regra comercial não podem compartilhar implicitamente a mesma fonte; a faixa não deve prometer execução automática no checkout.

## [2026-08-14] Seleção mobile-first da arte do hero

**Agente/Modelo:** Codex GPT-5
**Objetivo:** impedir que o banner desktop apareça no catálogo mobile quando existe uma versão própria para celular.
**Arquivos alterados:** `src/components/HeroVitrine.tsx`, `UI.md`, `Progress.md`; `tsconfig.tsbuildinfo` pode ser regenerado pelo typecheck.
**O que foi feito:**
- A investigação confirmou que o `<img>` base era sempre desktop e a arte mobile dependia de uma fonte condicional que falhou no ambiente reproduzido.
- O `picture` passou a ser mobile-first: a arte mobile é o fallback base e a desktop assume somente a partir de 640 px.
- Banners sem imagem mobile continuam usando a imagem desktop em qualquer largura.
**Decisões tomadas:** manter um único recurso responsivo por slide, em vez de dois elementos ocultados por CSS, evita download duplicado e torna o fallback correto no mobile.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `git diff --check` ✓ · `npm run lint` indisponível pelo script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro da seleção responsiva do banner.
**Armadilhas descobertas:** em art direction, o fallback do `<picture>` precisa representar a menor viewport; usar desktop como base faz qualquer falha de seleção degradar justamente o mobile.

## [2026-08-14] Fidelidade dos banners entre recorte, prévia e site

**Agente/Modelo:** Codex GPT-5
**Objetivo:** eliminar o zoom adicional dos banners desktop e mobile e permitir a conferência explícita das duas telas no editor.
**Arquivos alterados:** `src/components/HeroVitrine.tsx`, `src/app/admin/vitrine/page.tsx`, `src/components/admin/ModalRecorteImagem.tsx`, `src/app/globals.css`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O hero público deixou de sobrescrever a proporção salva com altura fixa no desktop ou limite de viewport no celular.
- As imagens passam a preservar integralmente o recorte; metadados legados inconsistentes geram respiro neutro em vez de novo corte ou zoom.
- O editor exibe a arte desktop na proporção realmente escolhida e oferece uma única seta para alternar a prévia entre Desktop e Celular.
- A prévia identifica quando o celular usa a imagem desktop como fallback e reproduz Quiche Sans no título e Raleway ExtraLight no texto complementar.
- A miniatura do modal de recorte também passou a usar as fontes públicas.
**Decisões tomadas:** fidelidade da composição aprovada prevalece sobre preencher o contêiner a qualquer custo; `object-contain` impede recortes secundários caso imagem e metadado divirjam.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `git diff --check` ✓ · buscas de resíduos ✓ · `npm run lint` indisponível pelo script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro da fidelidade e alternância das prévias.
**Armadilhas descobertas:** salvar a proporção não basta se o componente publicado impõe uma altura concorrente; `object-cover` então transforma essa diferença em zoom aparente.

## [2026-08-14] Gestos livres nos cards e transição do menu público

**Agente/Modelo:** Codex GPT-5
**Objetivo:** permitir rolagem vertical iniciada sobre imagens e cards do catálogo e tornar a abertura do menu hambúrguer mais refinada sem pesar a interface.
**Arquivos alterados:** `src/app/page.tsx`, `src/components/CartaoProduto.tsx`, `src/components/Header.tsx`, `UI.md`, `Progress.md`; `tsconfig.tsbuildinfo` pode ser regenerado pelo typecheck.
**O que foi feito:**
- A investigação isolou `touch-pan-x` como causa do bloqueio: a regra proibia o navegador de assumir o eixo vertical quando o toque começava nos trilhos.
- Categorias, Mais vendidos e Ofertas agora deixam o navegador arbitrar os eixos, preservando overflow horizontal, snap e inércia do Safari.
- Imagens de produto não iniciam mais arraste nativo e a ampliação em hover deixa de animar quando o visitante prefere movimento reduzido.
- O menu público mantém o `Sheet` existente, mas abre e fecha em tempos mais curtos; conteúdo e rodapé recebem entrada sutil em duas camadas.
- A animação do menu é desativada por `prefers-reduced-motion`.
**Decisões tomadas:** não adicionar handlers manuais de touch; o scroll é nativo e mais confiável entre Safari e Chromium. A animação ocorre por blocos, não item a item, para evitar aparência artificial e custo desnecessário.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · busca confirmou remoção de `touch-pan-x`, presença de inércia, redução de movimento e ausência de resíduos novos ✓ · `npm run lint` indisponível pelo script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro dos gestos do catálogo e da abertura do menu.
**Armadilhas descobertas:** `touch-pan-x` em um trilho nativo não significa apenas “permitir swipe horizontal”; ele também nega explicitamente o pan vertical iniciado naquela região.

## [2026-08-14] Navegação móvel de ecommerce e tema claro inicial

**Agente/Modelo:** Codex GPT-5
**Objetivo:** substituir a barra inferior genérica do catálogo por uma navegação móvel mais clara e sofisticada, adotando modo claro como padrão inicial.
**Arquivos alterados:** `src/components/Footer.tsx`, `src/providers/ThemeProvider.tsx`, `src/app/page.tsx`, `UI.md`, `Progress.md`; `tsconfig.tsbuildinfo` regenerado pelo typecheck.
**O que foi feito:**
- A barra inferior de largura total virou uma dock flutuante compacta, com superfície elevada, respiro lateral e safe-area incorporada.
- Os destinos foram refinados para Início, Pedidos e Sacola, usando ícones coerentes com ecommerce e rótulos legíveis.
- Somente Início aparece como destino atual; Sacola comunica estado pelo badge de quantidade, sem parecer selecionada permanentemente.
- Alvos de toque passaram a 56 px, com foco visível, feedback de pressão e descrição acessível da quantidade na sacola.
- O conteúdo público ganhou compensação inferior para que a dock não cubra produtos ou ações.
- A primeira visita agora inicia em modo claro; uma escolha manual posterior continua persistida pelo provedor de tema.
**Decisões tomadas:** manter três destinos evita sobrecarregar o fluxo curto da loja; “Sacola” comunica melhor o padrão de ecommerce do que “Carrinho”, e a preferência manual de tema continua soberana sobre o novo padrão inicial.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · lint indisponível: o script legado `next lint` é incompatível com Next 16 e o repositório não possui arquivo de configuração para execução direta do ESLint.
**Pendências / próximos passos:** nenhuma conhecida dentro da navegação inferior; a validação final está registrada no fechamento da task.
**Armadilhas descobertas:** a safe-area não deve ser desenhada como uma segunda faixa sob a navegação, pois cria uma emenda visual; ela precisa fazer parte do espaçamento da própria dock.

## [2026-08-14] Barra de rolagem fluida nos trilhos públicos

**Agente/Modelo:** Codex GPT-5
**Objetivo:** corrigir o atraso e a sensação de travamento das barras de Categorias, Mais vendidos e Ofertas no mobile.
**Arquivos alterados:** `src/app/page.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A auditoria `ui-review` identificou que cada evento de scroll atualizava estado React e renderizava novamente a página inteira com os cards.
- A animação de 150 ms aplicada à largura acumulava atraso durante o gesto e a inércia do Safari, fazendo a barra perseguir a posição real.
- Os três indicadores agora são atualizados uma vez por frame com `requestAnimationFrame`, diretamente no elemento visual e sem rerender do catálogo.
- O preenchimento usa `transform: scaleX()` com origem à esquerda, evitando recálculo de layout; os trilhos receberam `touch-pan-x` e contenção horizontal consistente.
**Decisões tomadas:** a barra não possui easing durante a rolagem, pois feedback posicional precisa acompanhar o dedo imediatamente; redução de movimento remove também a dica de otimização persistente.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · busca confirmou remoção dos estados, transições concorrentes, resíduos e cores diretas ✓ · `npm run lint` indisponível pelo script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** nenhuma dentro do comportamento das barras; o lint do repositório continua exigindo uma tarefa própria de infraestrutura.
**Armadilhas descobertas:** animar `width` com transição em um handler de scroll combina reflow, rerender e atraso visual; indicadores contínuos devem usar transform compositorizado sem transição concorrente.

## [2026-08-14] Progresso contínuo dos trilhos e parcelas configuráveis

**Agente/Modelo:** Codex GPT-5
**Objetivo:** tornar inequívoco o avanço dos carrosséis públicos e permitir que cada produto informe sua própria quantidade de parcelas sem afetar o checkout.
**Arquivos alterados:** `src/app/page.tsx`, `src/lib/condicoesComerciaisProduto.ts`, `src/lib/supabase.ts`, `src/components/admin/produtos/ModalFormularioProduto.tsx`, `src/app/admin/produtos/page.tsx`, `src/components/CartaoProduto.tsx`, `src/components/ModalIngredientes.tsx`, `src/contexts/CarrinhoContext.tsx`, `PRD.md`, `UI.md`, `Progress.md`; schema remoto `public.produtos`.
**O que foi feito:**
- Os indicadores móveis de categorias, Mais vendidos e Ofertas passaram de marcador deslizante para barra acumulada, iniciando pela fração visível e preenchendo até 100% conforme o visitante avança.
- O formulário de criar/editar produto permite ativar o aviso de parcelamento e escolher entre 2 e 12 parcelas, com prévia imediata do valor por parcela.
- Cards e detalhes públicos usam a quantidade salva no produto; registros antigos ativos foram preservados com 3 parcelas.
- Foi adicionada via Management API a coluna opcional `produtos.parcelas_sem_juros`, com restrição entre 2 e 12, sem RLS novo e sem alteração em tabelas de pedido/pagamento.
- Os campos visuais são removidos já na normalização do item do carrinho, e o payload de checkout permanece restrito a id, nome e preço do produto; o parcelamento não é enviado nem persistido no pedido.
**Decisões tomadas:** manter `parcelamento_ativo` para compatibilidade e armazenar a quantidade separadamente; quando um registro legado não tiver quantidade, a UI usa 3x. A barra representa a proporção já vista, não somente a posição do primeiro card.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · schema remoto e dados legados validados ✓ · checkout inspecionado e isolado ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível pelo script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** nenhuma dentro do escopo funcional; o lint do repositório continua exigindo uma tarefa própria de infraestrutura.
**Armadilhas descobertas:** o checkout monta um objeto mínimo do produto antes do envio; não substituir esse mapeamento por spread do objeto de catálogo, pois isso levaria metadados puramente visuais ao pagamento.

## [2026-08-14] Desconto e parcelamento informativo por produto

**Agente/Modelo:** Codex GPT-5
**Objetivo:** completar as condições comerciais dos produtos com desconto editável no cadastro e na Vitrine, além de comunicação visual de parcelamento em 3x sem alterar pagamentos.
**Arquivos alterados:** `src/lib/condicoesComerciaisProduto.ts`, `src/lib/supabase.ts`, `src/components/admin/produtos/ModalFormularioProduto.tsx`, `src/app/admin/produtos/page.tsx`, `src/components/admin/vitrine/EditorOfertas.tsx`, `src/app/admin/vitrine/page.tsx`, `src/app/page.tsx`, `src/components/CartaoProduto.tsx`, `src/components/ModalIngredientes.tsx`, `PRD.md`, `UI.md`, `Progress.md`; schema remoto `public.produtos`.
**O que foi feito:**
- O formulário de criar e editar produto ganhou uma seção única de condições comerciais com desconto percentual, prévia do preço final e ativação de parcelamento informativo.
- O desconto passou a funcionar também no cadastro: o valor digitado é a referência, `preco_original` preserva esse valor e `preco` recebe o preço promocional arredondado em centavos.
- A área Ofertas ganhou atalho inline para aplicar, trocar ou remover desconto sem abrir outro modal ou sair da curadoria.
- Cards e detalhe público exibem preço anterior riscado, preço final destacado, badge de percentual e, quando ativado, `3x de R$ … sem juros`.
- Foi adicionada via Management API a coluna `produtos.parcelamento_ativo boolean not null default false`, validada no OpenAPI do projeto.
- Nenhum arquivo de carrinho, checkout, pedido, Mercado Pago ou pagamento foi alterado; parcelamento permanece estritamente visual.
**Decisões tomadas:** o parcelamento é fixo em três vezes e armazena somente um booleano; quantidade e valor de parcela são derivados para evitar inconsistência. Desconto rápido e cadastro atualizam os mesmos campos do produto, mantendo uma fonte única de preço.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · schema remoto validado ✓ · busca de isolamento do checkout ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível pelo script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** nenhuma dentro do escopo funcional; o lint do repositório continua exigindo uma tarefa própria de infraestrutura.
**Armadilhas descobertas:** `bebidas` não possui colunas de desconto nem parcelamento no schema Fortes Fios; os novos controles ficam restritos a produtos e o fluxo legado de bebidas preserva apenas preço comum.

## [2026-08-14] Tipografia oficial no site público

**Agente/Modelo:** Codex GPT-5
**Objetivo:** aplicar Quiche Sans Light/Thin como tipografia principal e Raleway ExtraLight 200 como tipografia secundária no site da Fortes Fios sem alterar o admin.
**Arquivos alterados:** `src/lib/fonts.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Os arquivos locais `QuicheSans-Thin.otf` e `QuicheSans-Light.otf` foram registrados no carregador de fontes do Next, com pesos 100 e 300.
- Raleway ExtraLight 200 foi integrada pelo `next/font/google`, sendo empacotada e servida pelo próprio app.
- Títulos e chamadas do cliente usam Quiche Sans Light; corpo, formulários e controles usam Raleway ExtraLight.
- As variáveis das fontes ficam disponíveis no layout raiz, mas os tokens e seletores visuais só são ativados por `body.fortes-fios-public`; o admin permanece em Geist.
**Decisões tomadas:** Quiche Light 300 é o peso padrão dos títulos para preservar legibilidade; Thin 100 permanece carregada para usos editoriais futuros. O Raleway usa o carregador nativo do Next porque não havia arquivo Raleway no projeto e isso evita dependência ou CDN em runtime.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · escopo dos seletores revisado ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida na aplicação tipográfica.
**Armadilhas descobertas:** aplicar a família diretamente no `body` raiz também mudaria o admin; os tokens Fortes Fios devem continuar condicionados à classe pública.

## [2026-08-14] Ofertas configuráveis na vitrine

**Agente/Modelo:** Codex GPT-5
**Objetivo:** permitir que a loja publique uma seleção de ofertas com destaque próprio no site e acesso condicional pelo menu móvel.
**Arquivos alterados:** `src/lib/vitrineOfertas.ts`, `src/app/api/vitrine/ofertas/route.ts`, `src/components/admin/vitrine/EditorOfertas.tsx`, `src/app/admin/vitrine/page.tsx`, `src/app/page.tsx`, `src/components/Header.tsx`, `src/components/CartaoProduto.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A Vitrine ganhou uma quarta área, Ofertas, em grade 2×2 no mobile e quatro segmentos no desktop.
- O editor próprio permite ativar/ocultar a seção, definir a quantidade, buscar, adicionar, remover e ordenar até 12 produtos.
- A configuração usa a chave `vitrine_produtos_ofertas` já compatível com `configuracoes_loja`; nenhuma tabela ou migration foi criada.
- O site lê a configuração por route handler server-side, resolve somente produtos disponíveis e acompanha mudanças da configuração em Realtime.
- A seção aparece imediatamente depois de Mais vendidos, com o mesmo peso comercial, trilho responsivo, indicador móvel e selo “Oferta”.
- O menu hambúrguer mostra Ofertas somente quando a seção está ativa e possui ao menos um produto resolvido; o item leva diretamente ao bloco promocional.
- Preço original, desconto e preço final continuam vindo do cadastro do produto, evitando preço divergente entre vitrine, detalhe e carrinho.
**Decisões tomadas:** a participação em Ofertas é uma curadoria editorial independente; não foi criada coluna no produto porque a ordem, quantidade e publicação pertencem à Vitrine, enquanto preço e desconto já possuem fonte própria.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas e `/api/vitrine/ofertas`) · rota real HTTP 200 preservando 2 IDs já configurados ✓ · documentação oficial do Supabase revisada ✓ · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro da seção de Ofertas.
**Armadilhas descobertas:** o banco já possuía uma configuração ativa de Ofertas com dois IDs; a normalização deve preservar esse conteúdo e nunca substituir a seleção por valores padrão durante a implantação.

## [2026-08-14] Vitrine organizada por áreas para o lojista

**Agente/Modelo:** Codex GPT-5
**Objetivo:** tornar a configuração da Vitrine compreensível para a pessoa que opera a loja, removendo campos técnicos e separando cada tarefa visual.
**Arquivos alterados:** `src/app/admin/vitrine/page.tsx`, `src/components/admin/vitrine/EditorResultadosStudio.tsx`, `src/components/ResultadosStudio.tsx`, `src/lib/vitrineResultadosStudio.ts`, `public/logo-salao-preta.png`, `public/logo-salao-branca.png`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A Vitrine ganhou navegação segmentada com Banners, Mais vendidos e Studio, seguindo o padrão compacto da tela de Finanças.
- Cada área agora aparece isoladamente; o botão “Adicionar banner” só é exibido quando Banners está selecionado.
- O editor do Studio removeu nome técnico, caminho de arquivo e qualquer referência a `public`; o lojista configura apenas publicação, chamada, rotação e fotos.
- As logos reais foram localizadas no projeto Mikael, copiadas para o Fortes Fios e vinculadas automaticamente: preta no tema claro e branca no tema escuro.
- A prévia administrativa explica a troca de tema sem expor detalhes de implementação.
**Decisões tomadas:** a logomarca é parte fixa da identidade, não conteúdo operacional; por isso não é um campo editável e não compete visualmente com a gestão das fotos.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · `ui-review` ✓.
**Pendências / próximos passos:** nenhuma conhecida dentro desta reorganização.
**Armadilhas descobertas:** os arquivos da logo do salão haviam sido adicionados em `/Users/administrador/Mikael/public`, e não no `fortes-fios/public`.

## [2026-08-14] Fallback horizontal correto no hero móvel

**Agente/Modelo:** Codex GPT-5
**Objetivo:** impedir que uma arte desktop horizontal seja ampliada e destruída por um viewport retrato quando não houver versão exclusiva para celular.
**Arquivos alterados:** `src/components/HeroVitrine.tsx`, `src/app/admin/vitrine/page.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A leitura dos banners deixou de transformar silenciosamente a URL desktop em URL mobile, preservando a informação de que a arte móvel está ausente.
- O hero móvel agora usa a proporção desktop salva quando está em fallback e mantém a proporção 4:5/9:16 apenas quando existe uma arte móvel própria.
- O preview administrativo passou a reproduzir a proporção real do site e identifica quando está mostrando a adaptação horizontal da arte desktop.
- Registros legados em que as URLs desktop e mobile são iguais passam a ser tratados como fallback, evitando manter o recorte vertical defeituoso.
**Decisões tomadas:** o fallback preserva integralmente a composição horizontal; uma composição vertical continua sendo uma escolha explícita do administrador por meio da versão mobile.
**Verificação:** dados reais confirmaram 2 banners sem arte mobile e proporções desktop próximas de 21:8 · `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas) · `systematic-debugging` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro desta correção.
**Armadilhas descobertas:** preencher `imagemMobileUrl` com o fallback durante a normalização elimina a informação necessária para escolher o aspect ratio correto.

## [2026-08-14] Prova social configurável do studio parceiro

**Agente/Modelo:** Codex GPT-5
**Objetivo:** incluir depois do catálogo uma seção sofisticada com logomarca do studio e carrossel de resultados, totalmente administrável pela Vitrine.
**Arquivos alterados:** `src/lib/vitrineResultadosStudio.ts`, `src/app/api/vitrine/resultados-studio/route.ts`, `src/components/ResultadosStudio.tsx`, `src/components/admin/vitrine/EditorResultadosStudio.tsx`, `src/components/admin/ModalRecorteImagem.tsx`, `src/app/admin/vitrine/page.tsx`, `src/app/page.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O site público ganhou a chamada “Produtos testados e aprovados por:”, logomarca central e carrossel 4:5 com destaque central, laterais visíveis, swipe, setas, paginação e pausa.
- A seção respeita redução de movimento, pausa em hover/foco e permanece ausente até ser ativada com logo e ao menos uma foto publicada.
- `/admin/vitrine` ganhou editor próprio para chamada, nome/caminho da logo em `public`, autoplay, intervalo e até 12 resultados.
- Cada resultado pode receber foto, recorte 4:5 fiel, título/descrição opcionais, visibilidade, ordem, edição e remoção antes da publicação.
- O recorte fecha o editor antes de abrir e volta ao formulário depois do upload, sem empilhar modais.
- A configuração reutiliza `configuracoes_loja` na chave `vitrine_resultados_studio`; nenhuma tabela ou migration foi criada.
- O menu móvel foi conferido e mantém o SVG oficial do WhatsApp, com `+55 86 98142-8538`, e o Instagram `@fortesfioss`.
**Decisões tomadas:** como a logomarca ainda será colocada em `public`, o administrador informa seu caminho sem exigir novo upload ou adivinhar nome de arquivo; a seção nasce desativada para não publicar conteúdo incompleto.
**Verificação:** rota `/api/vitrine/resultados-studio` HTTP 200 com configuração padrão segura ✓ · `npx tsc --noEmit` ✓ (0 erros) · build de produção ✓ (48 páginas e nova rota dinâmica) · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** colocar a logomarca do studio em `public`, informar o caminho e adicionar as fotos pelo editor antes de ativar a seção.
**Armadilhas descobertas:** o crop de resultados precisa de preview próprio; reutilizar o preview de produto mostraria preço e CTA falsos no fluxo do studio.

## [2026-08-14] Menu móvel editorial da Fortes Fios

**Agente/Modelo:** Codex GPT-5
**Objetivo:** substituir a sidebar móvel pesada por um painel sofisticado inspirado na referência da marca, preservando categorias reais e acesso rápido às ações da loja.
**Arquivos alterados:** `src/components/Header.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O menu passou de sidebar lateral para Sheet inferior com margens, overlay, cantos suaves e botão circular de fechar flutuando no topo.
- Categorias vindas do banco agora aparecem como uma lista editorial de tipografia forte, sem cards verdes ou ícones decorativos, com chevrons da mesma família Lucide.
- O rodapé ganhou links reais para Instagram `@fortesfioss` e WhatsApp `+55 86 98142-8538`, além de pedidos, ajuda e tema.
- Scroll interno, overscroll controlado, safe-area, foco visível e alvos mínimos de 44 px foram preservados.
**Decisões tomadas:** o painel segue a composição da referência sem copiar rosa, logo ou navegação irrelevante; o oliva e os tokens da Fortes Fios continuam como único destaque.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · build de produção ✓ (48 páginas) · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · varredura sem `TODO`, `console.log`, conflito ou cor hardcoded nova ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro desta alteração.
**Armadilhas descobertas:** botão flutuante dentro de Sheet não pode permanecer sob `overflow-hidden`, pois a tradução negativa seria recortada.

## [2026-08-14] Navegação, destaques e recorte fiel da vitrine pública

**Agente/Modelo:** Codex GPT-5
**Objetivo:** aproximar a home de uma navegação de e-commerce, corrigir a hierarquia e os cards de Mais vendidos, tornar o recorte fiel aos usos reais e eliminar categorias mockadas no frontend.
**Arquivos alterados:** `src/app/page.tsx`, `src/components/Header.tsx`, `src/components/CartaoProduto.tsx`, `src/components/admin/ModalRecorteImagem.tsx`, `src/app/admin/produtos/page.tsx`, `src/app/api/vitrine/categorias/route.ts`, `src/app/api/upload/route.ts`, `PRD.md`, `UI.md`, `Progress.md`; dados alterados via Management API em `public.categorias_cardapio`.
**O que foi feito:**
- Sete categorias atribuíveis foram gravadas no Supabase, ativas e ordenadas; “Todos” permanece somente como filtro universal para não virar opção inválida no cadastro de produto.
- A home removeu a constante de categorias e passou a buscar `id`, `nome` e `ordem` em route handler server-side.
- O mobile ganhou menu hambúrguer lateral com categorias, pedidos, ajuda e tema; o carrinho continua acessível diretamente na navbar.
- A navegação de categorias virou um trilho de ícones semânticos e o filtro leva ao catálogo correspondente.
- O slogan agora antecede Mais vendidos. A variante de destaque ficou mais compacta, com mídia quadrada, selo discreto, conteúdo centralizado e CTA comercial, sem alterar o card comum.
- O destaque agora preenche a mídia quadrada sem faixas laterais; a hierarquia tipográfica segue as fontes da marca e um indicador fino acompanha a rolagem horizontal no mobile.
- O editor de produto ganhou previews alternáveis e fiéis de Catálogo 4:5 e Mais vendidos 1:1; a reedição de imagens do B2 usa o proxy same-origin existente, agora liberado para as pastas de catálogo.
**Decisões tomadas:** ícones são apresentação local por significado, enquanto nomes/ordem/atividade vêm do banco; não foi criada coluna de ícone nem uma categoria artificial “Todos”. Uma única imagem é salva por produto, por isso o editor mostra os dois recortes e orienta manter o produto centralizado.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · build de produção ✓ (48 páginas) · `/api/vitrine/categorias` HTTP 200 com as 7 categorias ordenadas ✓ · proxy real de imagem de produto HTTP 200 `image/jpeg` ✓ · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro desta alteração.
**Armadilhas descobertas:** `categorias_cardapio` existia sem linhas e está sem RLS com grants amplos; a leitura pública nova passa por rota server-side e expõe apenas campos allowlisted, sem ampliar consultas client-side.

## [2026-08-14] Produtos iniciais publicados em Mais vendidos

**Agente/Modelo:** Codex GPT-5
**Objetivo:** cadastrar os cinco produtos informados pela Fortes Fios sem imagens e publicá-los na curadoria manual de Mais vendidos.
**Arquivos alterados:** `Progress.md`; dados alterados via Management API: `public.produtos` e chave `vitrine_produtos_mais_vendidos` de `public.configuracoes_loja`.
**O que foi feito:**
- Foram cadastrados cinco produtos com nomes, descrições e preços fornecidos, todos disponíveis e com `imagem_url` nula para que as fotos sejam incluídas posteriormente pelo administrador.
- Os produtos foram organizados nas categorias existentes do catálogo: Outros, Cacheados, Pós-química, Cabelos ressecados e Kits e promopack.
- A seção Mais vendidos foi ativada em modo manual e recebeu os cinco produtos na mesma ordem em que foram informados.
**Decisões tomadas:** o cadastro foi idempotente por nome para não criar duplicatas em uma repetição da operação; como não existia configuração anterior, a seleção manual contém somente os cinco novos produtos.
**Verificação:** Management API confirmou 5 produtos únicos, 5 disponíveis, 5 sem imagem e os 5 IDs presentes na configuração manual de Mais vendidos · `npx tsc --noEmit --incremental false` ✓ (0 erros) · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** adicionar as imagens pelo formulário de edição de cada produto no administrador.
**Armadilhas descobertas:** a quantidade visual configurada aceita opções discretas e ficou em 6, mas a seção renderiza corretamente os 5 IDs selecionados sem criar conteúdo fictício.

## [2026-08-14] Vitrine de mais vendidos com curadoria manual e ranking real

**Agente/Modelo:** Codex GPT-5
**Objetivo:** dar mais presença comercial ao catálogo público e permitir que a Fortes Fios configure produtos mais vendidos manualmente ou pelas vendas reais.
**Arquivos alterados:** `src/app/page.tsx`, `src/components/CartaoProduto.tsx`, `src/app/admin/vitrine/page.tsx`, `src/app/api/vitrine/mais-vendidos/route.ts`, `src/lib/vitrineMaisVendidos.ts`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A home ganhou uma seção Mais vendidos antes do catálogo, com cards grandes em trilho horizontal no mobile e grade no desktop.
- O card existente foi estendido com variante de destaque, selo sem emoji, CTA Comprar, preço em `pt-BR` e imagem inteira sem cortar embalagens.
- A Vitrine administrativa ganhou controles inline para publicar/ocultar, alternar Automático/Manual, definir quantidade, buscar, incluir, remover e ordenar produtos.
- O modo automático usa uma rota server-side que retorna somente ranking agregado por `produto_id`, quantidade e receita; pedidos cancelados, aguardando pagamento e canais fora de entrega/retirada são excluídos.
- A configuração reutiliza `configuracoes_loja` como JSON; nenhuma migration ou tabela foi criada.
**Decisões tomadas:** a seção segue a hierarquia comercial da referência Tout Lissie, mas mantém o oliva, os tokens, a tipografia e o radius da Fortes Fios. Sem vendas, o modo automático não inventa destaques e mantém a seção oculta.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · build de produção ✓ (48 páginas estáticas e nova API dinâmica listada) · rota real HTTP 200 ✓ · consulta real confirmou 0 pedidos/itens atuais sem erro · revisão responsiva e de segurança por código ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** o modo automático passará a exibir produtos após a primeira venda válida; o modo manual depende de produtos disponíveis no catálogo.
**Armadilhas descobertas:** o processo já existente na porta 3000 pertencia a outro projeto; a validação do Fortes Fios foi isolada na porta 3107. Consultas server-side de ranking devem paginar porque o Data API limita respostas por padrão.

## [2026-08-13] Slogan oficial na abertura do catálogo

**Agente/Modelo:** Codex GPT-5
**Objetivo:** substituir a chamada genérica do catálogo pelo slogan oficial da Fortes Fios, com a tipografia primária da identidade.
**Arquivos alterados:** `src/app/page.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O bloco “Catálogo Fortes Fios / Encontre o cuidado...” foi removido.
- A abertura agora exibe “Fortes Fios”, “Tudo o que seu cabelo precisa em um só lugar.” e “A loja de quem entende de cabelo.” exatamente na hierarquia da marca.
- Nome e frase principal reutilizam `.fortes-display`, com tamanhos e entrelinha próprios para mobile e desktop.
**Decisões tomadas:** o slogan fica imediatamente antes da busca para fortalecer a identidade sem alongar o caminho até os produtos no celular.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · verificação textual e responsiva por código ✓ · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida neste bloco.
**Armadilhas descobertas:** a introdução do catálogo é uma assinatura institucional e não deve receber copy genérica de marketplace.

## [2026-08-13] Hero protegido e catálogo com experiência de e-commerce

**Agente/Modelo:** Codex GPT-5
**Objetivo:** impedir banners verticais de expandirem a vitrine no desktop e aproximar a experiência pública de um e-commerce capilar sem dificultar o pedido.
**Arquivos alterados:** `src/app/page.tsx`, `src/app/admin/vitrine/page.tsx`, `src/components/HeroVitrine.tsx`, `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/components/CartaoProduto.tsx`, `src/components/ModalIngredientes.tsx`, `src/components/admin/ModalRecorteImagem.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O hero deixou de herdar a proporção do arquivo e ganhou altura responsiva limitada; uma arte 9:16 antiga agora é recortada pelo viewport em vez de aumentar a página inteira.
- O recorte de banner passou a ser específico por destino: desktop aceita somente 21:8/16:9 e mobile aceita 16:9/4:5/9:16, preservando a arte separada por breakpoint.
- A página pública ganhou faixa de confiança, apresentação explícita do catálogo, busca mais clara, categorias, contagem de resultados, ordenação e estados de carregamento/vazio.
- O desktop ganhou ações persistentes de pedidos e carrinho no cabeçalho; a barra inferior ficou exclusiva do mobile.
- Cards e detalhe do produto foram alinhados ao varejo: imagem dominante, categoria, desconto, preço e CTA direto; o detalhe agora reutiliza o Dialog/Drawer responsivo e permite adicionar ao carrinho.
**Decisões tomadas:** o tamanho do hero pertence ao layout, não ao arquivo enviado; art direction separada e `object-cover` seguem o comportamento responsivo de vitrines de e-commerce. A compra rápida foi preservada tanto no card quanto no detalhe.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · build de produção ✓ (48 rotas) · revisão estrutural de proporções, limites de altura, navegação e alvos móveis ✓ · `ui-review` ✓ · `bug-hunter` ✓ · `code-reviewer` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** corrigir o script legado de lint e os avisos de metadata/viewport do build exige tarefa própria; nenhum foi criado por esta alteração.
**Armadilhas descobertas:** usar a proporção persistida como `aspect-ratio` do container full-width faz qualquer arte retrato dominar a altura de todos os slides; a proporção deve orientar o recorte, não dimensionar a página.

## [2026-08-13] Lucro como área principal de Finanças

**Agente/Modelo:** Codex GPT-5
**Objetivo:** substituir o indicador pequeno de lucro por uma visão gerencial completa, no mesmo nível de Lançamentos e Diárias.
**Arquivos alterados:** `src/features/financas/components/PainelFinancas.tsx`, `src/features/financas/components/PainelLucro.tsx`, `src/features/financas/components/GraficoComposicaoLucro.tsx`, `src/features/financas/components/GraficoLucroMensal.tsx`, `src/features/onboarding/config/financas.ts`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O card principal agora alterna entre Lançamentos, Diárias e Lucro; o valor minúsculo do cabeçalho foi removido.
- Lucro ganhou KPIs de vendas analisadas, custo histórico, lucro bruto e margem, com composição radial, cobertura de custos, evolução dos últimos 12 meses e ranking por produto.
- O mesmo seletor de período de Lançamentos controla a visão de Lucro, sem nova consulta ou mudança no cálculo existente.
- Vendas sem custo geram aviso de cálculo parcial; prejuízo, loading, vazio e responsividade móvel possuem estados próprios.
- Ocultar valores também mascara margens, acumulado, escala e tooltips dos novos gráficos.
- O onboarding passou a apontar para a nova aba e teve os textos financeiros alinhados ao comércio de produtos capilares.
**Decisões tomadas:** lucro continua significando lucro bruto dos produtos (venda líquida menos custo histórico); despesas operacionais permanecem no resultado de caixa para não misturar dois conceitos contábeis. A série de 12 meses e o RPC existentes foram reutilizados, sem tocar banco.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · build de produção ✓ (48 rotas) · 9 assertions de hierarquia/conteúdo/privacidade/onboarding/ausência de consulta nova ✓ · revisão manual de estados vazio, parcial, prejuízo e mobile ✓ · `bug-hunter` ✓ · `code-reviewer` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** corrigir o script de lint e os avisos legados de metadata/viewport exige tarefa própria; nenhum deles foi criado por esta alteração.
**Armadilhas descobertas:** mover a âncora `financas-lucro` para conteúdo condicional quebraria o onboarding quando Lançamentos estivesse ativo; ela deve permanecer no controle Lucro, sempre montado.

## [2026-08-13] Análise diária e Relatórios para e-commerce capilar

**Agente/Modelo:** Codex GPT-5
**Objetivo:** disponibilizar os módulos copiados do Edienai no admin Fortes Fios, preservando sua profundidade analítica sem conceitos de restaurante.
**Arquivos alterados:** `src/app/admin/analise-diaria/page.tsx`, `src/app/admin/relatorios/page.tsx`, `src/features/analise-diaria/types.ts`, `src/features/analise-diaria/hooks/useAnaliseDiaria.ts`, `src/features/analise-diaria/lib/processadores.ts`, `src/features/analise-diaria/components/relatorios/RelatorioCanais.tsx`, `src/features/analise-diaria/components/relatorios/RelatorioEquipe.tsx`, `src/lib/gerarPdfRelatorios.ts`, `src/lib/admin-sidebar-routes.ts`, `src/components/admin/AdminLayout.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Confirmado por comparação byte a byte que as páginas e a feature de análise já eram cópias integrais do Edienai; o trabalho concentrou-se em integrar e adaptar corretamente o domínio.
- Análise diária passou a usar dia calendário e mantém faturamento, pedidos, ticket, entrega, pagamentos, produtos, horários, bairros, cancelamentos, comparativos, taxas e crediário.
- Relatórios preservam filtros, KPIs, gráficos, rankings, categorias, pagamentos, entregas por bairro e exportação PDF, agora identificada como Fortes Fios.
- “Salão”, “no local”, mesa e métricas baseadas em `garcom_id` foram retirados dos cálculos e da interface; os únicos canais são entrega e retirada.
- As duas rotas foram reativadas no layout e adicionadas ao grupo Gestão da sidebar e ao personalizador.
- Via Management API, confirmou-se que as cinco tabelas exigidas já existiam no Fortes Fios como superconjunto compatível; nenhuma tabela nem dado foi duplicado. Foram adicionados somente três índices de leitura por status/data, canal/status/data e pagamentos/data.
**Decisões tomadas:** estruturas existentes foram preservadas em vez de recriadas; recriar tabelas compatíveis poderia perder constraints e dados. Campos legados continuam no schema para compatibilidade, mas não alimentam os novos relatórios.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · build de produção ✓ (48 rotas) · 10 assertions de domínio/navegação/PDF ✓ · 5/5 consultas reais via Supabase Data API ✓ · Management API confirmou 5 tabelas compatíveis, 3 índices e banco sem pedidos copiados ✓ · varredura de termos de restaurante e `console.log` ✓ · `bug-hunter` ✓ · `code-reviewer` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro dos dois módulos.
**Armadilhas descobertas:** copiar os arquivos do Edienai sem adaptar os processadores mantém restaurante no cálculo mesmo quando a copy visual é trocada; o contrato precisa ser corrigido nos tipos, queries, agregações e PDF.

## [2026-08-13] Recorte sequencial no editor da Vitrine

**Agente/Modelo:** Codex GPT-5
**Objetivo:** eliminar o modal sobre modal ao editar ou adicionar imagens dos banners da Vitrine.
**Arquivos alterados:** `src/app/admin/vitrine/page.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O formulário do banner agora é desmontado antes de abrir o recorte, garantindo uma única camada e um único focus trap ativos.
- Cancelar ou confirmar o recorte desmonta o editor de imagem e retorna ao formulário com título, subtítulo, configurações e imagens preservados.
- A transição foi centralizada em funções únicas para impedir que novos pontos de entrada reintroduzam estados sobrepostos.
**Decisões tomadas:** foi adotado um fluxo sequencial entre superfícies em vez de elevar `z-index`; isso preserva o contexto do usuário sem competir por foco, Escape ou gesto de fechamento no mobile.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · build de produção ✓ (48 rotas) · 5 assertions estruturais de montagem/transição ✓ · `ui-review` Pass ✓ · `ui-score` 88/100 (B) ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida dentro deste fluxo.
**Armadilhas descobertas:** ocultar visualmente o modal anterior ou aumentar o `z-index` não resolve overlays e focus traps concorrentes; a superfície anterior precisa ser desmontada.

## [2026-08-13] Paginação do hero fora do texto no mobile

**Agente/Modelo:** Codex GPT-5
**Objetivo:** impedir que indicadores e pausa do carrossel atravessem os textos configuráveis dos banners no celular.
**Arquivos alterados:** `src/components/HeroVitrine.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A proporção dinâmica passou a pertencer somente à mídia do carrossel, permitindo reservar uma faixa móvel independente abaixo da imagem.
- Paginação e pausa ficam nessa faixa no mobile, com cores semânticas da Fortes Fios e alvos de toque de 44 px; no desktop continuam sobre o banner.
- Foco de teclado ganhou contraste correto nos dois fundos.
**Decisões tomadas:** controles foram retirados da imagem apenas no mobile porque qualquer posição interna pode colidir com uma das quatro posições configuráveis de texto.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · build de produção ✓ (48 rotas) · assertions estruturais da faixa/posição/foco/overflow ✓ · `ui-review` Pass ✓ · `ui-score` 96/100 (A) ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida.
**Armadilhas descobertas:** controles absolutos e texto configurável não podem compartilhar o mesmo rodapé em banners móveis de proporção variável.

## [2026-08-13] Vitrine responsiva com art direction

**Agente/Modelo:** Codex GPT-5
**Objetivo:** elevar o hero da Fortes Fios ao padrão de vitrine de e-commerce, com composição correta em desktop e celular e edição profissional no admin.
**Arquivos alterados:** `src/components/HeroVitrine.tsx`, `src/components/admin/ModalRecorteImagem.tsx`, `src/app/admin/vitrine/page.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O hero passou a ocupar a largura total da viewport no desktop e no celular, encostado ao cabeçalho e sem moldura de card.
- Cada banner aceita arte e proporção independentes para desktop e mobile; o navegador escolhe apenas a fonte adequada via `picture`, com fallback retrocompatível para o JSON legado.
- O editor ganhou seções claras para as duas telas, recorte livre e presets 21:8, 16:9, 4:5 e 9:16, além de preview, posição do texto, cor e intensidade de contraste.
- A altura do carrossel acompanha a proporção do banner ativo; artes retrato e paisagem deixam de ser forçadas ao mesmo formato.
- Autoplay ganhou pausa manual persistente, continua suspendendo em hover/foco e respeita `prefers-reduced-motion`.
**Decisões tomadas:** manter o mesmo registro JSON com parser retrocompatível evita migration; arte separada por breakpoint foi escolhida porque um único corte não preserva conteúdo em 21:8 e 9:16.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · build de produção ✓ (48 rotas) · 2 banners legados remotos aceitos pelo parser retrocompatível ✓ · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** recadastrar as artes mobile dos 2 banners legados quando houver arquivos verticais; até lá, eles usam a imagem desktop como fallback.
**Armadilhas descobertas:** carrosséis Embla com slides de proporções diferentes precisam que a altura pertença ao viewport e siga o slide ativo; deixar cada slide definir a própria altura faz o maior banner dominar todos os demais.

## [2026-08-13] Hero junto à navbar e editor profissional de banners

**Agente/Modelo:** Codex GPT-5
**Objetivo:** remover a faixa vazia entre navbar e hero e oferecer edição/recorte profissional das imagens da vitrine.
**Arquivos alterados:** `src/app/page.tsx`, `src/app/admin/vitrine/page.tsx`, `src/components/admin/ModalRecorteImagem.tsx`, `src/app/api/upload/route.ts`, `src/lib/backblaze.ts`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O catálogo compensa somente os 64 px da navbar fixa; o carrossel agora começa imediatamente abaixo dela.
- O formulário de banner ganhou preview 16:9 em largura total, seleção/troca de arquivo e ação explícita para ajustar recorte.
- O recorte compartilhado ganhou modo banner com proporção 16:9, preview horizontal usando os textos reais, zoom, rotação, espelhamento, reset e alvos de toque de 44 px no mobile.
- Imagens já publicadas passam por uma leitura same-origin restrita às pastas `vitrine/` e `geral/`, evitando o bloqueio CORS do Canvas sem aceitar URLs externas arbitrárias.
- O helper Backblaze passou a respeitar a pasta solicitada; novos banners ficam organizados em `vitrine/`.
**Decisões tomadas:** o crop existente foi estendido em vez de criar um editor paralelo; o endpoint de leitura usa allowlist de caminho e extensão para não virar proxy SSRF.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · endpoint same-origin com imagem permitida ✓ (200 `image/webp`) · entrada externa rejeitada ✓ (400) · build de produção ✓ (48 rotas) · `ui-review` ✓ · `bug-hunter` ✓ · `verification-before-completion` ✓ · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma conhecida.
**Armadilhas descobertas:** imagens públicas do B2 não retornam CORS para `localhost`, portanto não podem ser reprocessadas diretamente por Canvas no browser.

## [2026-08-13] Hero sem moldura de card

**Agente/Modelo:** Codex GPT-5
**Objetivo:** tornar a vitrine uma imagem/carrossel integrada ao catálogo, em vez de um card contendo uma imagem.
**Arquivos alterados:** `src/components/HeroVitrine.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Removidos borda, cantos arredondados e margem lateral do carrossel.
- No mobile, o hero agora ocupa toda a largura disponível da viewport e usa proporção paisagem 16:9; no desktop conserva o formato horizontal 21:8.
- Swipe, autoplay, texto sobreposto, setas e indicadores foram preservados.
**Decisões tomadas:** a referência do Meu Burguer foi aplicada à estrutura visual contínua, não à altura vertical; Fortes Fios mantém banner paisagem como solicitado.
**Verificação:** pendente nesta entrada — typecheck, build e revisão final.
**Pendências / próximos passos:** nenhuma conhecida.
**Armadilhas descobertas:** `rounded-xl border` no hero, somado ao `px-4` do catálogo, fazia uma imagem de largura total parecer um card independente.

## [2026-08-13] Publicação imediata da vitrine e marca correta no painel

**Agente/Modelo:** Codex GPT-5
**Objetivo:** corrigir o banner que não chegava ao site, remover a marca MK das interfaces e recuperar a tipografia editorial da identidade Fortes Fios.
**Arquivos alterados:** `src/app/admin/vitrine/page.tsx`, `src/components/HeroVitrine.tsx`, `src/app/globals.css`, `src/components/admin/AdminLayout.tsx`, `src/components/login/TelaSelecaoPerfil.tsx`, `src/app/entregador/page.tsx`, `src/components/admin/GerenciadorUsuariosClientes.tsx`, `public/manifest-admin.json`, `public/manifest-entregador.json`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Confirmado que “Concluir banner” só atualizava estado local; o Supabase não possuía o registro, por isso o cliente mostrava corretamente o fallback.
- Criar, editar, reordenar, publicar/ocultar e excluir agora persistem imediatamente, bloqueiam ações concorrentes e só informam sucesso depois da resposta do banco.
- A imagem já enviada ao Backblaze foi localizada e o banner do print foi restaurado em `vitrine_banners_publicos`, sem exigir novo upload.
- Sidebar do admin, login, entregador, mensagem de recuperação e manifests deixaram de exibir MK; a logo existente substitui raio e iniciais, mantendo a paleta azul do painel.
- “Fortes Fios” permanece em escrita normal com Geist; somente as frases de destaque usam a tipografia fina `Bodoni 72`/`Didot` da referência principal.
**Decisões tomadas:** a persistência em duas etapas foi removida porque permitia que um card parecesse publicado sem existir no banco; feedback de sucesso agora significa publicação real.
**Verificação:** pendente nesta entrada — typecheck, lint legado, build, leitura remota do registro e revisão final.
**Pendências / próximos passos:** nenhuma conhecida.
**Armadilhas descobertas:** o upload termina antes da publicação do banner; uma falha posterior não apaga a imagem já armazenada, o que permitiu recuperar o conteúdo original.

## [2026-08-13] Vitrine paisagem gerenciável da Fortes Fios

**Agente/Modelo:** Codex GPT-5
**Objetivo:** substituir a assinatura pública em caixa-alta por tipografia natural e permitir que a loja administre uma vitrine em carrossel sem criar tabela nova.
**Arquivos alterados:** `src/components/HeroVitrine.tsx`, `src/app/page.tsx`, `src/app/contato/page.tsx`, `src/components/Header.tsx`, `src/app/globals.css`, `src/app/admin/vitrine/page.tsx`, `src/lib/admin-sidebar-routes.ts`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O site público passou a abrir com um carrossel horizontal de banners paisagem, com swipe, paginação acessível, navegação desktop, pausa por interação e fallback editorial quando ainda não há imagem cadastrada.
- O painel ganhou Vitrine em Catálogo: adicionar imagem pela infraestrutura Backblaze existente, frase e texto opcional, publicar/ocultar, reordenar e excluir antes de salvar.
- A lista de banners é salva como JSON ordenado em `configuracoes_loja.vitrine_banners_publicos`; nenhuma migration, tabela ou dado operacional foi criado ou modificado.
- A marca textual deixou de usar caixa-alta espaçada e fonte editorial artificial; continua em Geist, coerente com o restante do site cliente.
**Decisões tomadas:** o padrão do Meu Burger foi estudado apenas como referência de navegação por carrossel. Fortes Fios não copia sua hero full-screen, copy centralizada, imagens estáticas ou barra decorativa de progresso.
**Verificação:** leitura da implementação do carrossel e fluxos vazio/publicado/oculto ✓ · varredura de `console.log`/`TODO` nos arquivos da task ✓ · `npx tsc --noEmit --incremental false` ✓ (0 erros) · build de produção ✓ (48 rotas, incluindo `/admin/vitrine`) · `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** cadastrar as fotos e mensagens reais em Admin → Vitrine antes de publicar a vitrine visual definitiva.
**Armadilhas descobertas:** salvar ordem/visibilidade é intencionalmente uma ação explícita; fechar o formulário ou alterar uma linha não publica mudança parcial por acidente.

## [2026-08-13] Ambiente local seguro do Fortes Fios

**Agente/Modelo:** Codex GPT-5
**Objetivo:** configurar localmente Supabase e Backblaze para o Fortes Fios, sem expor valores ou alterar a área administrativa.
**Arquivos alterados:** `.env.local` (segredos locais, não documentados) e `.gitignore`.
**O que foi feito:**
- Obtidas as chaves do projeto Fortes Fios pela Management API e registradas como URL pública, chave pública e chave de serviço somente no servidor.
- Registradas as variáveis Backblaze fornecidas e restringida a permissão de leitura do arquivo local.
- Criado `.gitignore` para manter ambientes e artefatos locais fora de um futuro repositório.
**Decisões tomadas:** a chave de serviço usa apenas `SUPABASE_SERVICE_ROLE_KEY`; nenhuma chave de servidor foi exposta como `NEXT_PUBLIC_*`.
**Verificação:** endpoint público de `produtos` autenticado ✓ · formato/permite do ambiente ✓ · `npx tsc --noEmit` ✓ · build de produção ✓.
**Pendências / próximos passos:** nenhum para a configuração local.
**Armadilhas descobertas:** a Management API retorna o project ref, não `api_url`; a URL correta segue o host canônico do ref.

## [2026-08-13] Identidade pública Fortes Fios

**Agente/Modelo:** Codex GPT-5
**Objetivo:** substituir o catálogo e a página de contato derivados da MK/Edienai pela identidade visual da Fortes Fios, sem alterar admin, banco ou assets de marca.
**Arquivos alterados:** `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/contato/layout.tsx`, `src/app/contato/page.tsx`, `src/components/Header.tsx`, `src/components/CartaoProduto.tsx`, `src/components/ModalIngredientes.tsx`, `src/components/ModalComplementos.tsx`, `src/components/ModalCarrinho.tsx`, `src/components/PWAManager.tsx`, `public/manifest.json`, `public/sw.js`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Catálogo público passou a usar categorias estáveis de cabelo e só renderiza produtos; blocos visuais de bebidas e combos não são mais carregados nem exibidos.
- A identidade do site cliente é escopada por `body.fortes-fios-public`, incluindo drawers e modais, com a paleta oliva/branco e tipografia editorial de sistema; o admin mantém os tokens globais azuis.
- Atualizados header, slogan, metadados/PWA, mensagem de checkout e a página pública de contato para Fortes Fios; logos e favicons existentes foram preservados.
- Copy de “ingredientes” e “personalizar pedido” foi substituída por termos de produto.
**Decisões tomadas:** categorias são declaradas na UI até que o catálogo receba dados próprios; a normalização ignora caixa e acentuação para aceitar nomes equivalentes vindos do banco.
**Verificação:** varredura de copy pública ✓ · `npx tsc --noEmit` ✓ (0 erros) · build compila e passa TypeScript, mas a geração das rotas admin para sem as variáveis Supabase desta cópia · `npm run lint` indisponível por script legado `next lint` incompatível com Next 16.
**Pendências / próximos passos:** preencher produtos e categorias próprias no banco Fortes Fios; revisar contatos reais antes de publicar links externos.
**Armadilhas descobertas:** o projeto copiado retém componentes administrativos e de restaurante não montados no cliente; eles ficaram fora desta task por exigência explícita de não alterar outras rotas.

## [2026-08-13] Estrutura da MK restaurada no Fortes Fios

**Agente/Modelo:** Codex GPT-5
**Objetivo:** criar no Supabase Fortes Fios o schema público da MK sem levar dados operacionais.
**Arquivos alterados:** `Progress.md` (a migration foi aplicada em diretório temporário, sem criar arquivo de aplicação adicional).
**O que foi feito:**
- Identificado o projeto `fortes-fios`, confirmado ativo e saudável.
- Antes da escrita, o dump público do destino confirmou zero tabelas da aplicação.
- Aplicada a migration temporária `20260813210000_mk_public_schema.sql`, cópia do dump versionado em `supa-mk/00_public_schema.sql`.
- A estrutura no destino foi validada contra a origem: 27 tabelas, 7 funções, 1 view, 1 trigger, 48 índices, 69 constraints e 30 FKs; a lista de tabelas é idêntica.
- A consulta final em `pg_stat_user_tables` confirmou 27 tabelas públicas e 0 linhas estimadas.
**Decisões tomadas:** a aplicação ocorreu via `supabase db push` após `--dry-run`, garantindo uma migration rastreada no projeto novo e evitando executar SQL manualmente sem prévia.
**Verificação:** projeto destino vazio antes ✓ · dry-run ✓ · migration remota ✓ · dump comparado ✓ · consulta de linhas ✓ (0) · `supabase migration list` ✓.
**Pendências / próximos passos:** definir RLS e grants seguros antes de expor o Fortes Fios; iniciar a adaptação de front-end/branding somente na próxima task.
**Armadilhas descobertas:** o dump preserva `GRANT ALL` da MK, logo o Fortes Fios também recebeu essa configuração herdada e exige tarefa própria de segurança.

## [2026-08-13] Dump estrutural reutilizável do Supabase MK

**Agente/Modelo:** Codex GPT-5
**Objetivo:** preservar a estrutura pública da MK para futura replicação no Fortes Fios, sem levar dados operacionais.
**Arquivos alterados:** `supa-mk/00_public_schema.sql`, `supa-mk/README.md`, `Progress.md`.
**O que foi feito:**
- Gerado o dump oficial de schema `public` com a CLI Supabase; o arquivo contém tabelas, funções, view, trigger, índices, constraints, FKs e grants do projeto de origem.
- Verificada a ausência de comandos `INSERT` e `COPY`: nenhum registro foi exportado.
- Documentada a dependência de `pgcrypto` e a necessidade de revisar os grants/RLS antes de restaurar em outro projeto.
**Decisões tomadas:** foi usado `supabase db dump --schema public`, em vez de `pg_dump` cru, pois a CLI filtra schemas internos gerenciados pela plataforma e é o caminho oficial para uma cópia portável de estrutura.
**Verificação:** CLI Supabase ✓ · leitura do dump ✓ · 27 tabelas, 7 funções, 1 view, 1 trigger, 48 índices, 69 constraints e 30 FKs ✓ · varredura sem dados ✓.
**Pendências / próximos passos:** receber o project ref do Fortes Fios e definir a política de acesso/RLS antes de aplicar o schema no destino.
**Armadilhas descobertas:** o dump reproduz `GRANT ALL` da MK; executá-lo sem revisão manteria o mesmo modelo de exposição atual.

## [2026-08-10] Fechamento confiável dos drawers administrativos

**Agente/Modelo:** Codex GPT-5
**Objetivo:** corrigir o fechamento por botão nos drawers móveis do admin e evitar que o formulário financeiro abra artificialmente alto.
**Arquivos alterados:** `src/components/ui/dialog.tsx`, `src/features/financas/components/ActionDialog.tsx`, `src/components/admin/AdminLayout.tsx`, `src/app/admin/pedidos/novo/page.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O `Dialog` responsivo passou a encaminhar o fechamento solicitado pelos botões para o `onOpenChange(false)` controlado, cobrindo todos os dialogs que viram Drawer no admin.
- O botão compartilhado de fechar agora tem área de toque de 44 px, rótulo acessível e foco visível; sidebar e catálogo direto receberam o mesmo alvo de toque e fechamento explícito.
- O drawer de receita/despesa não usa mais `dismissible={false}` e deixou de forçar `h-[92dvh]`; abre pela altura do conteúdo e só limita a viewport com `dvh`.
**Decisões tomadas:** a correção foi centralizada no primitivo `Dialog`, pois a busca encontrou 387 usos no dashboard e apenas dois drawers Vaul diretos a tratar separadamente.
**Verificação:** `ui-review` ✓ · `bug-hunter` ✓ · varredura dos consumers de `Dialog`/`Drawer` ✓ · `git diff --check` ✓ · `npx tsc --noEmit --incremental false` ✓ (0 erros) · `npm run build` ✓ (47 rotas) · `npm run lint` indisponível: script legado incompatível com Next 16.
**Pendências / próximos passos:** a validação manual em Safari/iOS real continua necessária; testes de browser são proibidos neste projeto.
**Armadilhas descobertas:** `dismissible={false}` no Vaul impede o fechamento acionado por `DrawerClose`; o botão explícito deve continuar chamando o estado controlado.

## [2026-08-10] Drawer estável para receitas e despesas no Safari mobile

**Agente/Modelo:** Codex GPT-5
**Objetivo:** tornar os formulários de receita e despesa utilizáveis em drawers móveis, inclusive no Safari/iOS.
**Arquivos alterados:** `src/features/financas/components/ActionDialog.tsx`, `src/features/financas/components/ModalMovimentacao.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O formulário financeiro usa agora uma superfície Vaul móvel com altura baseada em `dvh`, uma única região de scroll com inércia WebKit e rodapé preservado pela safe-area.
- Fechamento por arraste/toque externo foi desativado em formulários para evitar perda acidental de dados durante a rolagem; o botão de fechar e Cancelar continuam disponíveis.
- O botão de fechar passou a ter 44 px e os controles do lançamento 44 px no mobile; o valor não recebe autofocus no mobile, evitando que o teclado desloque o drawer assim que ele abre.
**Decisões tomadas:** a correção foi centralizada em `ActionDialog`, pois ele é a superfície já compartilhada pelos formulários financeiros; desktop continua usando Dialog.
**Verificação:** `ui-review` ✓ (correções aplicadas) · `npx tsc --noEmit --incremental false` ✓ (0 erros) · `npm run build` ✓ (47 rotas) · `npm run lint` indisponível: script legado incompatível com Next 16.
**Pendências / próximos passos:** validação manual em um iPhone/Safari real continua necessária; testes de browser são proibidos neste projeto.
**Armadilhas descobertas:** `autoFocus` em um Drawer Vaul abre o teclado cedo demais no Safari, o que torna o cálculo de viewport visual instável.

## [2026-08-10] Custo de compra e lucro bruto por produto

**Agente/Modelo:** Codex GPT-5
**Objetivo:** permitir custo opcional no produto e mostrar lucro bruto histórico por produto e por mês em Finanças.
**Arquivos alterados:** `src/components/admin/produtos/ModalFormularioProduto.tsx`, `src/app/admin/produtos/page.tsx`, `src/app/page.tsx`, `src/features/financas/types.ts`, `src/features/financas/hooks/useFinancas.ts`, `src/features/financas/components/PainelFinancas.tsx`, `src/features/financas/components/GraficoLucroMensal.tsx`, `src/features/financas/components/StatCardsFinanceiros.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Adicionado custo de compra opcional no cadastro e na edição de produtos, com validação de valor não negativo.
- No Supabase, `produtos.custo_unitario` guarda o custo atual e `itens_pedido.custo_unitario` preserva o snapshot do instante da venda por trigger. A função agregada de lucro calcula por produto e por mês sem usar o custo atual retrospectivamente.
- Finanças mostra vendas com custo, custo das mercadorias, lucro bruto, margem, gráfico mensal e ranking por produto. Pedidos pendentes foram removidos do conjunto considerado pago.
- Itens sem custo ficam sinalizados como cálculo parcial e não têm margem inventada. O catálogo público passou a selecionar explicitamente os campos que usa, sem carregar o custo no payload da página.
**Decisões tomadas:** lucro bruto usa `subtotal` do item (já descontado) menos custo unitário × quantidade; taxas de entrega/pagamento e despesas operacionais não são tratadas como margem de produto. Pedidos anteriores à funcionalidade permanecem sem custo até que novas vendas sejam feitas, preservando a honestidade do histórico.
**Verificação:** Management API ✓ · trigger/colunas/função SQL ✓ · RPC consultada pelo app ✓ · `npx tsc --noEmit --incremental false` ✓ (0 erros) · `npm run build` ✓ (47 rotas) · `npm run lint` indisponível: o script legado `next lint` interpreta `lint` como diretório no Next 16.
**Pendências / próximos passos:** cadastrar os custos reais dos produtos para que as próximas vendas componham o lucro; revisar em tarefa de segurança a exposição atual da base sem RLS.
**Armadilhas descobertas:** custo 0 é válido e diferente de custo ausente; não preencher pedidos antigos com o custo atual do catálogo, pois isso altera artificialmente o lucro histórico.

## [2026-08-10] Clientes sugeridos e categoria acessível

**Agente/Modelo:** Codex GPT-5
**Objetivo:** reduzir redigitação na venda manual e tornar a criação de categoria descobrível fora do formulário de produto.
**Arquivos alterados:** `src/app/admin/pedidos/novo/page.tsx`, `src/app/admin/produtos/page.tsx`, `.env.local`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O campo Nome da nova venda pesquisa até cinco clientes por nome após 260 ms; a escolha preenche os dados disponíveis e mostra confirmação visual.
- Sem seleção, o fluxo mantém a criação/atualização existente por telefone no envio do pedido e explica isso ao operador.
- Produtos agora oferece `Nova categoria` no cabeçalho, independente do modal de produto, reutilizando a mesma normalização e persistência de categorias.
- As três credenciais Backblaze B2 já esperadas pela rota de upload foram copiadas do `.env.local` do Edienai sem registrar valores no código, logs ou documentação.
**Decisões tomadas:** a busca é por nome, como solicitado; telefone continua sendo a chave de deduplicação ao salvar, portanto não duplica um cliente caso o operador não selecione uma sugestão mas informe um telefone já existente.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · `npm run build` ✓ (47 rotas) · presença das 3 chaves B2 ✓ · bug-hunter ✓ · verification-before-completion ✓ · `npm run lint` indisponível: o script legado `next lint` interpreta `lint` como diretório no Next 16.
**Pendências / próximos passos:** validar visualmente o dropdown de clientes com a base real no navegador; fotos continuam dependendo também das variáveis públicas de bucket já presentes no projeto.
**Armadilhas descobertas:** o script `npm run lint` é legado e incompatível com Next 16; não interpretar a falha do comando como erro do código.

## [2026-08-10] Personalização por produto na nova venda

**Agente/Modelo:** Codex GPT-5
**Objetivo:** tornar a venda manual mais clara para comércio/marketplace, com desconto e instruções por produto em vez de desconto global.
**Arquivos alterados:** `src/app/admin/pedidos/novo/page.tsx`, `src/components/admin/pedidos/novo/ModalItemPedidoAdmin.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A grade de catálogo agora mostra ações explícitas de Adicionar e Personalizar, sem ícones decorativos por produto.
- Quantidade, observação e desconto em reais são configurados por produto no modal responsivo já existente; o resumo e o payload de `pedidos`/`itens_pedido` persistem esses valores por linha.
- O desconto global foi removido da venda manual; no mobile, o catálogo Vaul fecha antes do Drawer de personalização abrir, evitando overlays empilhados.
- A coluna de pedido foi simplificada em seções de tarefa (cliente, recebimento, pagamento e observação), mantendo controles grandes e resumo monetário imediato.
**Decisões tomadas:** Adicionar incrementa apenas a linha padrão sem personalização; Personalizar cria (ou edita) uma linha independente. Isso preserva descontos/instruções diferentes para o mesmo produto sem mudar schema nesta tarefa.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · `npm run build` ✓ (47 rotas) · busca sem referências legadas na rota/modal ✓ · bug-hunter ✓ · verification-before-completion ✓ · `npm run lint` indisponível: o script legado `next lint` interpreta `lint` como diretório no Next 16.
**Pendências / próximos passos:** validar a interação visual em dispositivo real quando o ambiente de navegador estiver disponível; fotos, variações e estoque são escopos próprios.
**Armadilhas descobertas:** abrir o personalizador por cima do Drawer do catálogo gerava duas superfícies móveis; a transição agora é sequencial.

## [2026-08-10] Redesign da venda manual da MK

**Agente/Modelo:** Codex GPT-5
**Objetivo:** substituir o novo pedido herdado por uma experiência de venda própria para loja de materiais elétricos.
**Arquivos alterados:** `src/app/admin/pedidos/novo/page.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A rota foi reconstruída com catálogo de produtos sempre visível no desktop e pedido atual em coluna lateral, sem reutilizar painéis, etapas ou componentes de pedido de restaurante.
- No mobile, o catálogo abre em `Drawer` Vaul com uma única área rolável e rodapé fixo; o pedido permanece na página, sem overlay paralelo ou drawer aninhado.
- O fluxo contém somente produto, cliente, retirada/entrega, endereço, desconto, pagamento, observação e total. A varredura da rota não encontrou mesa, comanda, salão, cozinha, impressão, garçom, crediário ou combo.
**Decisões tomadas:** o catálogo não fica escondido atrás de modal no desktop; o operador monta a venda e acompanha quantidades/preço no mesmo campo visual.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · varredura sem termos legados na rota ✓ · lint pendente nesta entrada.
**Pendências / próximos passos:** validar visualmente em dispositivo real quando o servidor local for recarregado; o projeto não tem teste de browser por regra.
**Armadilhas descobertas:** componentes antigos em `src/components/admin/pedidos/novo/` ainda existem no repositório, mas não são importados pela rota nova; não reconectá-los ao fluxo MK.

## [2026-08-10] Clientes vinculados a pedidos e sidebar persistente

**Agente/Modelo:** Codex GPT-5
**Objetivo:** corrigir as telas de Clientes e Personalizar, além de registrar o cliente em cada pedido público ou manual.
**Arquivos alterados:** `src/lib/registrar-cliente-pedido.ts`, `src/components/ModalCarrinho.tsx`, `src/app/admin/pedidos/novo/page.tsx`, `src/components/admin/GerenciadorUsuariosClientes.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Pela Management API, foram criadas no projeto Mikael a tabela `admin_sidebar_config` (PK/FK para `usuarios_sistema`) e a view `vw_usuarios_cliente_metricas`; o índice único de telefone foi adicionado a `usuarios_cliente`.
- Os dois pedidos existentes foram vinculados ao cliente recuperável pelo telefone. A base passou de 0 para 1 cliente, com 0 pedidos sem `cliente_id`.
- O checkout público e o novo pedido administrativo agora normalizam o telefone, fazem upsert do cliente e gravam `pedidos.cliente_id`; o pedido manual exige telefone.
- A view foi ajustada para não contar falsamente um pedido válido para clientes sem pedidos e o schema cache do PostgREST foi recarregado.
**Decisões tomadas:** a atualização é atômica por telefone (`upsert` com índice único); endereço/bairro só substituem dados do cliente quando vierem preenchidos no pedido.
**Verificação:** Management API ✓ · leitura anônima da view e de clientes ✓ · estrutura/índices/FK ✓ · `npx tsc --noEmit --incremental false` ✓ (0 erros) · `npm run lint` indisponível: o script legado `next lint` interpreta `lint` como diretório no Next 16; ESLint local também não possui arquivo de configuração.
**Pendências / próximos passos:** nenhuma de dados para Clientes/Personalizar; a proteção de RLS continua fora do escopo explícito.
**Armadilhas descobertas:** `LEFT JOIN` com `count(*) filter` contabiliza a linha nula; métricas de pedidos devem usar `count(p.id)`.

## [2026-08-10] Novo pedido simplificado e tokens azuis da MK

**Agente/Modelo:** Codex GPT-5
**Objetivo:** restaurar o pedido manual administrativo como operação de loja e remover a paleta herdada na confirmação/cupom do checkout.
**Arquivos alterados:** `src/app/admin/pedidos/novo/page.tsx`, `src/components/ModalCarrinho.tsx`, `src/components/ui/input.tsx`, `src/lib/admin-sidebar-routes.ts`, `src/components/admin/AdminLayout.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A rota `/admin/pedidos/novo` voltou ao menu e ao atalho do cabeçalho com um fluxo enxuto: catálogo no `Drawer` Vaul, itens, cliente, retirada/entrega, desconto manual, pagamento e criação do pedido.
- O fluxo não consulta nem grava mesas, comandas, cozinha, impressão, garçom, combos ou crediário. Em caso de erro após criar o pedido, remove o pedido criado para não deixar registro parcial.
- O `Input` compartilhado, a confirmação de pedido e o campo de cupom agora usam tokens semânticos; o primário resolve para o azul da MK em claro e escuro.
- O drawer tem altura em `dvh`, uma única região rolável e rodapé fora do scroll para evitar overflow, sobreposição e ação perdida no mobile.
**Decisões tomadas:** o desconto manual é persistido no campo numérico de desconto já existente no pedido, sem alterar schema; ele entra diretamente no total e no pagamento registrado.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · busca de regressão do novo fluxo ✓ · `npm run lint` executado, mas o script legado `next lint` falha no Next 16 tratando `lint` como diretório.
**Pendências / próximos passos:** revisar em tarefa própria os modais antigos de detalhes/edição de pedido, que ainda têm ações legadas internas; validar visualmente com a conta administrativa inicial quando ela for criada.
**Armadilhas descobertas:** o `DrawerContent` compartilhado já fornece overlay e focus trap; não adicionar `fixed inset-0` ou outro modal irmão ao catálogo de produtos.

## [2026-08-10] Admin operacional da MK e identidade visual

**Agente/Modelo:** Codex GPT-5
**Objetivo:** aplicar a identidade MK e tornar os módulos administrativos mantidos compatíveis com o schema do projeto Mikael.
**Arquivos alterados:** `Header.tsx`, `CartaoProduto.tsx`, `ModalIngredientes.tsx`, `layout.tsx`, manifests PWA, sidebar/admin, filtros e páginas de pedidos/usuários/equipe, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- A logo MK passou a ser exibida no cabeçalho; os metadados e manifests apontam aos favicons reais em `public/assets/`.
- Cartões e modal de produto usam linguagem de detalhes técnicos, sem talheres ou ingredientes.
- A sidebar e as rotas administrativas removem PDV, salão/mesas, garçom, cozinha, impressão, produtividade, crediário, bot e relatórios herdados do restaurante.
- Via Management API, foram copiadas para o Mikael as estruturas de equipe e finanças do Edienai: funcionários, usuários de sistema, caixas, categorias/movimentações, pagamentos de pedido, crediário, finanças diárias, FKs, índices e RPCs de login/estatística.
- Foram incluídas quatro categorias financeiras neutras para a operação inicial: vendas avulsas, compra de mercadorias, despesas operacionais e transporte/entrega.
- Corrigida a configuração de entrega para `entregas_online_ativas=false` até o cadastro de bairros/taxas.
**Decisões tomadas:** os identificadores internos legados de papel (`garcom`) permanecem apenas para compatibilidade de schema, mas a UI os apresenta como Atendimento; não foi copiado nenhum usuário, senha, pedido, cliente ou lançamento financeiro do Edienai.
**Verificação:** Management API ✓ · `npx tsc --noEmit --incremental false` ✓ (0 erros) · lint pendente nesta entrada.
**Pendências / próximos passos:** criar a conta administrativa inicial da MK com usuário/senha fornecidos pelo responsável; revisar os modais detalhados de pedido que ainda carregam ações legadas internamente; cadastrar endereço/WhatsApp/bairros e taxas.
**Armadilhas descobertas:** `/admin/pedidos` e o dashboard herdaram joins/ações de mesa; o carregamento principal foi desvinculado de `mesas`, mas modais legados ainda exigem uma limpeza própria antes da publicação.

## [2026-08-10] Catálogo inicial e Supabase da MK

**Agente/Modelo:** Codex GPT-5
**Objetivo:** preparar o banco do projeto Supabase Mikael para o catálogo elétrico inicial e eliminar a última chamada de impressão do checkout público.
**Arquivos alterados:** `src/components/ModalCarrinho.tsx`, `.env.local`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Pela Management API, foi criado no projeto `skiymlnbaicgluynfrhl` o subconjunto do schema do Edienai usado por catálogo e checkout: categorias, produtos, variações legadas, configurações, pagamento, pedidos, itens, entrega, cupons e clientes.
- Foram incluídos índices de joins/filtros e constraints/FKs compatíveis; `obter_pedidos_cliente_por_telefone` foi criada para a consulta de histórico.
- Foram cadastrados 5 grupos e 27 produtos elétricos, todos disponíveis por R$ 1,00, sem imagem para usar o placeholder elétrico.
- O checkout não enfileira mais impressão de cozinha; a criação de entrega permanece somente para pedidos de entrega.
- `.env.local` passou a apontar ao projeto Mikael com URL e chave anon. O token da Management API não foi persistido.
**Decisões tomadas:** entregas online ficaram desativadas até que bairros/taxas sejam cadastrados; retirada continua disponível. RLS não foi ativado por instrução explícita do solicitante, portanto a anon key não deve ser considerada uma fronteira de segurança.
**Verificação:** schema remoto ✓ · 27 produtos a R$ 1,00 ✓ · RPC de telefone normaliza números ✓ · 0 FKs públicas sem índice ✓ · RLS ausente confirmado conforme escopo · `npx tsc --noEmit --incremental false` ✓ (0 erros) · `npm run lint` indisponível: binário `next` ausente no workspace.
**Pendências / próximos passos:** cadastrar fotos reais, preços definitivos, bairros/taxas e, em tarefa autorizada, proteger o banco com RLS e rotas server-side.
**Armadilhas descobertas:** a tabela de formas de pagamento usa `codigo`/`visivel_cliente`, e não `tipo`/`disponivel_cliente`; usar os nomes do schema real nos próximos seeds.

## [2026-08-10] Transição visual para MK Soluções Elétricas

**Agente/Modelo:** Codex GPT-5
**Objetivo:** retirar da interface pública e administrativa a identidade de restaurante e aplicar a marca MK Soluções Elétricas e Materiais Elétricos, sem alterar banco ou migrations.
**Arquivos alterados:** interface pública, sidebar/admin, manifests/PWA, login, entregas, documentação visual e placeholder de produto.
**O que foi feito:**
- Marca, metadados e manifests passaram a MK; o logo de restaurante deixou de ser renderizado nos shells atualizados.
- Catálogo, checkout, ajuda, produtos, kits e complementos receberam nomenclatura genérica de comércio.
- Fluxos visuais de mesa/consumo local foram removidos do checkout; o catálogo mantém entrega e retirada.
- Menu e atalhos do admin ocultam PDV, salão/mesas, garçons, impressora, produtividade e painel de cozinha; URLs desses módulos retornam ao dashboard.
- A rota `/garcom` redireciona para a loja e não exibe a interface anterior.
**Decisões tomadas:** a marca usa o nome fornecido pelo usuário; o catálogo continua consumindo os dados existentes do Supabase, que serão substituídos em etapa própria.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · revisão de regressão por busca das rotas/textos removidos ✓ · `npm run lint` não pôde executar porque o binário `next` não está instalado no workspace (`sh: next: command not found`).
**Pendências / próximos passos:** cadastrar produtos, categorias, imagens e identidade visual final da MK no Supabase em tarefa autorizada separadamente.
**Armadilhas descobertas:** tabelas e tipos internos ainda possuem nomes de restaurante; não foram alterados para respeitar o escopo sem banco/migrations.

## [2026-08-08] Permissões visuais e manutenção DZN

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** permitir que Edienai controle visualmente ações dos garçons/entregadores e que o DZN pause módulos operacionais.
**Arquivos alterados:** `src/lib/controle-acesso.ts`, `src/contexts/ControleAcessoContext.tsx`, `src/app/api/controle-acesso/route.ts`, `src/components/admin/GerenciadorPermissoesEquipe.tsx`, `src/app/admin/usuarios/page.tsx`, `src/components/dzn/GerenciadorVisibilidadeTelas.tsx`, `src/app/garcom/layout.tsx`, `src/components/garcom/GarcomLayout.tsx`, `src/app/garcom/page.tsx`, `src/app/garcom/mesas/page.tsx`, `src/app/garcom/editar/[id]/page.tsx`, `src/app/entregador/layout.tsx`, `src/app/entregador/page.tsx`, `src/features/salao/components/PainelSalaoAtual.tsx`, `src/features/salao/components/CardMesaSalao.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:** permissões por cargo; overrides individuais; ocultação de criar/editar/excluir; bloqueio visual de rotas sem `ver`; modo manutenção; painel reutilizado no admin e `/dzn`.
**Banco:** Management API criou `permissoes_papel`, `permissoes_usuario` e `manutencao_modulos`; todas possuem RLS ativo e zero grants para `anon`/`authenticated`. Três RPCs com `search_path` fixo têm escopo mínimo: leitura operacional segura e gestão somente após validar senha administrativa. O usuário `dzn` foi criado como admin ativo com a senha solicitada.
**Decisões tomadas:** controle exclusivamente visual, conforme solicitado; cargos controlados são `garcom` e `entregador`; overrides individuais têm precedência; falha da API preserva a operação anterior; o admin reautentica antes de gerir acessos.
**Verificação:** schema remoto ✓ · RLS/grants/RPC ACL ✓ · login DZN ✓ · defaults remotos ✓ · API GET/POST/PUT ✓ · override individual e restauração ✓ · origem cruzada rejeitada ✓ · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (47/47 páginas). `npm run lint` indisponível: `next lint` foi removido no Next 16 e não existe configuração ESLint.
**Pendências / próximos passos:** nenhuma dentro do escopo visual solicitado.
**Armadilhas descobertas:** estes controles não impedem chamadas diretas às tabelas operacionais já abertas; são deliberadamente visuais. As RPCs novas não concedem acesso direto às três tabelas de configuração.

## [2026-08-08] DZN — visibilidade global de telas

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** criar `/dzn` para o superusuário ocultar globalmente telas do admin e garçom.
**Arquivos alterados:** `src/app/dzn/page.tsx`, `src/components/dzn/GerenciadorVisibilidadeTelas.tsx`, `src/app/api/dzn/visibilidade/route.ts`, `src/lib/visibilidade-telas.ts`, `src/components/admin/AdminLayout.tsx`, `src/components/admin/SidebarPersonalizarModal.tsx`, `src/components/garcom/GarcomLayout.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:** login validado pela RPC existente para o usuário `dzn`; toggles salvam em `admin_sidebar_config`; o admin remove telas da sidebar, Mais, busca, atalhos e personalizador; o garçom remove itens do menu desktop e mobile.
**Decisões tomadas:** reutilizar a tabela existente; manter senha apenas em memória; não criar RBAC nem bloquear URL direta.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (47/47 páginas) · `git diff --check` ✓ · bug-hunter ✓ · verification-before-completion ✓. `npm run lint` indisponível: `next lint` foi removido no Next 16 e o projeto não possui configuração ESLint.
**Pendências / próximos passos:** cadastrar o usuário de sistema `dzn` com papel `admin` e a senha definida, caso ainda não exista.
**Armadilhas descobertas:** ocultação global e personalização individual compartilham a linha do usuário `dzn`; essa conta fica reservada para o controle global.

## [2026-08-03] Crediário — reparo pontual do pedido de Bastião

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** remover os R$ 288,00 fantasmas do pedido `45B61F27`, restaurando o valor comprovado pelas 24 Stellas sem quitar ou concluir o pedido.
**Arquivos alterados:** `Progress.md` (nenhum código ou migration).
**O que foi feito:** pela Supabase Management API, uma transação guardada restaurou `pedidos.subtotal/total`, o pagamento global vinculado, `crediario_movimentos.valor` e o saldo da conta de R$ 576,00 para R$ 288,00. O trigger existente sincronizou o movimento; os itens, valores originais, status `confirmado` e forma `Crediário` foram preservados. O movimento recebeu metadados do reparo.
**Decisões tomadas:** o pagamento global também foi corrigido para não deixar outra representação financeira em R$ 576,00; nenhum outro pedido ou movimento foi alterado.
**Verificação:** preflight remoto ✓ · ensaio integral com rollback ✓ · commit ✓ · consulta read-only pós-commit ✓ (`pedido=288`, `pagamento=288`, `movimento=288`, `saldo=288`, 24 unidades) · `npx tsc --noEmit --incremental false` ✓ (0 erros) · `npm run lint` indisponível no Next 16 (`next lint` interpreta `lint` como diretório) · diff check ✓ · bug-hunter ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** tornar a edição de pedido transacional e recalcular valores a partir dos itens persistidos para impedir nova divergência.

## [2026-08-03] WhatsApp admin — accordions de consumo DeepSeek e OpenAI

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** permitir inspecionar separadamente o consumo dos dois provedores sem poluir o resumo operacional nem criar novas consultas externas.
**Implementação:** as linhas DeepSeek e OpenAI viraram accordions nativos acessíveis por clique e teclado. Ao expandir, exibem gasto estimado desde o boot, tarifa por 1M tokens, chamadas, sucessos/falhas, latência média/acumulada, entrada, cache, saída e última atividade. O cálculo usa somente o snapshot do `/status`, com tarifas oficiais cadastradas para `deepseek-v4-flash` e `gpt-5-mini`; modelo desconhecido mostra estimativa indisponível. A telemetria do bot passou a capturar `prompt_tokens_details.cached_tokens` da OpenAI.
**Egress:** abrir/fechar o accordion não chama OpenAI, DeepSeek, Evolution nem Supabase. Os valores continuam vindo do polling de status já existente.
**TDD RED→GREEN:** cálculo DeepSeek com cache, cálculo GPT-5 mini e recusa de tarifa desconhecida; teste do cliente OpenAI comprova captura real dos tokens em cache.
**Verificação final:** TDD do custo `node --test tests/ai-usage.test.mjs` ✓ (3/3) · suíte do admin ✓ (11/11) · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (46/46 páginas) · bot `rtk npm test` ✓ (521/521) · bot `rtk npm run check` ✓ · `git diff --check` ✓. `npm run lint` permanece indisponível porque o script legado usa `next lint`, removido no Next 16. Tarifas conferidas nas documentações oficiais do DeepSeek e OpenAI em 03/08/2026.

## [2026-08-03] Crediário — cadastro de WhatsApp antes da cobrança

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** manter a cobrança acessível para contas sem telefone, solicitando e salvando o WhatsApp antes da confirmação, e corrigir o nome institucional para Edienai Lanches.
**Implementação:** o botão permanece ativo em contas abertas com saldo. Sem telefone válido, abre um diálogo com DDD, valida o número e segue para a revisão do envio. A rota aceita o telefone informado somente se a conta ainda não tiver um contato válido, salva o número normalizado e ignora tentativa de substituição de contato existente. A mensagem agora diz “aqui do Edienai Lanches”.
**Verificação final:** teste focado RED→GREEN `node --test tests/crediario-cobranca.test.mjs` ✓ (5/5) · suíte `node --test tests/*.test.mjs` ✓ (8/8) · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (46/46 páginas) · `git diff --check` ✓. `npm run lint` segue indisponível porque o script legado usa `next lint`, removido no Next 16. Nenhum telefone real foi alterado e nenhuma cobrança foi enviada durante os testes.

## [2026-08-03] Cobrança individual do crediário pelo WhatsApp

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** permitir que o operador envie, no card ou na tabela do crediário, um lembrete personalizado e grounded da dívida usando o WhatsApp da Edienai.
**Arquivos alterados:** `src/lib/crediario-cobranca.mjs`, `src/app/api/crediario/cobranca/route.ts`, `src/features/crediario/components/CardContaCrediario.tsx`, `src/features/crediario/components/PainelCrediario.tsx`, `tests/crediario-cobranca.test.mjs`, `PRD.md`, `UI.md`, `Progress.md`.

**O que foi feito:** a ação direta usa o ícone real do WhatsApp no card mobile e na tabela desktop, fica disponível somente para conta aberta, com saldo e telefone válido, e exige confirmação mostrando cliente, telefone e saldo. O navegador envia apenas o UUID da conta. A rota relê conta e movimentos ativos no Supabase, monta o resumo do ciclo ainda em aberto e chama o `/send` já existente do bot, que usa Evolution, protege o próprio eco e registra a mensagem enviada.

**Banco e segurança:** a Management API foi usada na ordem `GET /v1/projects` → projeto `edienai` → uma query read-only consolidada. `vw_crediario_contas_resumo`, snapshots `crediario_movimentos.itens`, datas e índices existentes atendem o fluxo; não houve migration. A rota não aceita telefone nem mensagem arbitrários do cliente, valida UUID/content-type/origin e aplica cooldown local de 60 segundos contra clique duplicado. Nenhuma cobrança real foi enviada durante a implementação.

**TDD RED→GREEN:** o RED começou com o módulo de cobrança inexistente. Os GREENs cobrem mensagem com nome/pedido/dia/saldo, exclusão de ciclo já quitado, limite de resumo para contas longas e telefone brasileiro válido.

**Verificação final:** teste focado `node --test tests/crediario-cobranca.test.mjs` ✓ (4/4) · suíte `node --test tests/*.test.mjs` ✓ (7/7) · `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (46/46 páginas) · `git diff --check` ✓. `npm run lint` permanece indisponível porque o script legado usa `next lint`, removido no Next 16. Revisão bug-hunter: nenhum envio automático/em massa, nenhum dado financeiro aceito do navegador e nenhum eco do próprio bot tratado como atendimento humano.

## [2026-08-03] WhatsApp admin — pausa real, IA separada, conexão coerente e estatísticas

**Agente/Modelo:** Codex GPT-5.6 SOL
**Objetivo:** transformar `/admin/whatsapp` em controle operacional real da Carol: pausar atendimento ou apenas IA, mostrar conexão/número coerentes e exibir métricas com período definido.

**Diagnóstico confirmado:** a Management API foi usada na sequência correta (`GET /v1/projects` → projeto `edienai` → query read-only). Não existiam as chaves `bot_ativo` nem `ia_conversa_ativa`; o toggle antigo fazia somente `UPDATE`, afetava zero linhas e mostrava sucesso. O adaptador fixava recebidas/notificações em zero e usava apenas `connectionState`, que não traz número/perfil. A tela ainda chamava `connect`/QR a cada 5 segundos mesmo conectada.

**Fix:** toggles usam `upsert` allowlisted e exigem confirmação do refresh real do cache do bot. Pausar IA preserva regras determinísticas; pausar Carol interrompe respostas. O status combina `connectionState` com `fetchInstances`, removendo a contradição “Conectado / Não conectado”. O painel mostra mensagens em 24h, notificações em 7 dias, conversas, fila/outbox, takeover e telemetria DeepSeek/OpenAI desde o boot, sem expor credenciais. Polling de status passou a 15s; QR só é solicitado quando desconectado e visível, a cada 20s.

**Evidência:** Evolution respondeu `open` e retornou número/perfil reais pelos dois endpoints. Snapshot read-only: 198 recebidas/154 enviadas em 24h, 47 conversas em 24h, 12 notificações em 7 dias, 100 rascunhos ativos, outbox 974 enviadas/101 falhas. Nenhuma escrita de produção, migration, deploy ou git de escrita foi executada.

**Verificação final:** `npx tsc --noEmit --incremental false` ✓ · `npm run build` ✓ (46/46 páginas; avisos preexistentes de metadata) · `git diff --check` ✓. `npm run lint` permanece indisponível porque o script legado usa `next lint`, removido no Next 16.

## [2026-08-02] Crediário — conclusão atômica, saldo de Derick e cards quitados

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Fazer toda conclusão futura quitar o consumo crediário do pedido, corrigir o saldo comprovadamente corrompido de Derick e impedir pagamentos acima da dívida.
**Arquivos alterados:** `scripts/migrations/20260802_crediario_conclusao_atomica.sql`, `scripts/migrations/20260802_reparar_saldo_derick_144.sql`, `src/lib/pedidos-utils.ts`, `src/app/admin/pedidos/page.tsx`, `src/components/admin/CardPedido.tsx`, `src/components/admin/painel/CardPedidoKanban.tsx`, `src/components/admin/garcons/PedidosCriadosGarcom.tsx`, `PRD.md`, `UI.md`, `Progress.md`.

**O que foi feito:**
- Trigger `BEFORE UPDATE OF status` aplicado em produção: ao passar de qualquer status para `entregue`, pedido crediário recebe pagamento vinculado ao consumo, preserva a trilha consumo + pagamento e grava `forma_pagamento='Concluído'` na mesma transação.
- A sincronização deixa de cancelar consumo já pareado com quitação do pedido e preserva movimentos zerados por pagamento de itens.
- `registrar_pagamento_crediario` agora bloqueia valor acima de `saldo_atual`; pagamento integral converte todos os pedidos crediários da conta para `Concluído`.
- Pagamento do último item também converte o pedido para `Concluído`.
- Reativado somente o consumo de R$ 143,00 comprovadamente cancelado após ter sido pago na conta de Derick; o crédito residual indevido saiu e o saldo real voltou de R$ 1,00 para R$ 144,00.
- `/admin/pedidos` usa a linha retornada pelo banco e remove imediatamente o estado visual de crediário; o CTA mostra “Concluir e quitar”.
- Predicado de crediário aberto foi centralizado e reutilizado no card principal, Kanban e lista do garçom; conta quitada não aparece como “Crediário”, “Crediário ok”, “Fiado” nem reexibe a barra vermelha do snapshot auditável.

**Decisões tomadas:** A regra ficou em trigger transacional porque existem cinco produtores web de `status='entregue'` e clientes externos compartilhando o banco; duplicar a lógica deixaria fluxos sem cobertura. A função de trigger é `security invoker`, sem nova elevação de privilégio. Os 80 pedidos históricos entregues/crediário (R$ 2.500,46) foram preservados por decisão explícita: entrega antiga não prova pagamento.
**Verificação:** Management API ✓ · ensaio transacional com rollback ✓ (excesso rejeitado, conclusão idempotente, consumo auditável) · pagamento integral/item com rollback ✓ · typecheck ✓ (0 erros) · `npm run lint` indisponível no Next 16 (`next lint` interpreta `lint` como diretório) · bug-hunter ✓ · verification-before-completion ✓ · diff check ✓.
**Pendências / próximos passos:** reconciliar em tarefa própria as 17 contas negativas históricas; revisar manualmente os 80 pedidos antigos antes de qualquer baixa.
**Armadilhas descobertas:** `crediario_contas.saldo_atual` soma todos os ciclos ativos da conta; cancelar um consumo já pago cria crédito residual que abate dívidas futuras. UI não pode inferir “Fiado” apenas pela existência de `crediario_status`.

## [2026-07-26] Bairro na criação pelo garçom + descontos no total da edição

**Agente/Modelo:** Claude Opus 5
**Objetivo:** Fechar as duas pendências da task anterior: o app do garçom criava pedido de entrega com `bairro: null` e taxa fixa, e o total do modal de edição ignorava cupom, frete grátis e desconto manual.
**Arquivos alterados:** `src/app/garcom/novo/page.tsx`, `src/components/admin/ModalEditarPedido.tsx`, `UI.md`, `Progress.md`.

**O que foi feito — app do garçom:**
- Select de bairro na seção de entrega (acima do endereço, com a taxa no rótulo), carga de `bairros` ativos e taxa derivada do bairro. `TAXA_ENTREGA_FIXA` saiu do arquivo.
- `bairro: null` no insert virou o nome do bairro selecionado; o insert em `entregas` passa a receber a taxa correta pela mesma variável.
- Bairro **obrigatório** em `entrega`, nas três barreiras já existentes (`dadosClienteValidos`, `pendenciaEtapaDados`, `pendenciaPrincipalSalvar`) e no guard de `salvarPedido`.
- Pré-preenchimento a partir do cliente salvo (`usuarios_cliente.bairro`) e de "repetir pedido" (o select do pedido base passou a trazer `bairro`).

**O que foi feito — modal de edição:**
- `desconto_cupom`, `desconto_frete` e `desconto_manual` buscados **dentro do modal** por `pedido.id` e aplicados ao total; os três aparecem no resumo do rodapé.
- `subtotal` gravado virou o líquido (`subtotalItens − desconto_manual`), alinhando com o significado da coluna no PDV.

**Decisões tomadas:**
- **Semântica das colunas conferida antes de mexer em dinheiro**, não presumida: `pedidos.subtotal` já vem líquido do `desconto_manual` (`/admin/pedidos/novo:772,996`) e `desconto_itens_total` já está embutido no subtotal de cada item — subtrair qualquer um dos dois de novo contaria em dobro. `desconto_cupom`/`desconto_frete` ficam **fora** do subtotal (`ModalCarrinho:1258,1270`). Fórmula final: `total = (subtotalItens − desconto_manual) + taxa_entrega + taxa_serviço − desconto_cupom − desconto_frete`.
- **`desconto_frete` limitado à taxa vigente** e regravado com o valor limitado: trocar para um bairro mais barato deixaria o desconto de frete maior que a própria taxa.
- **Descontos buscados no modal, não recebidos por prop.** São **7 call sites** (`/admin/pedidos`, `/admin/pedidos/[id]`, dashboard, painel, pdv, salão, `PedidosCriadosGarcom`) montando o objeto `pedido` com selects diferentes; mudar o tipo obrigaria a tocar todos (§4).
- **Validação exige bairro DO CADASTRO (`bairroSelecionado`), não texto preenchido.** Primeira versão validava `Boolean(bairro)` e tinha um furo: bairro vindo do cliente salvo ou de "repetir pedido" que tivesse sido desativado passava na validação e salvava com taxa 0. Validar pelo objeto encontrado também evita corrida com a carga assíncrona de `bairros`.

**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · `npx next build` ✓ compilou · conferido que, com os três descontos em 0 (situação de **todos** os pedidos do banco hoje), a fórmula nova devolve exatamente o valor antigo — a mudança é inerte sobre os dados atuais e só age quando houver desconto · `npm run lint` indisponível no repositório.

**Pendências / próximos passos:**
- `src/lib/taxas-entrega.ts` ficou **sem nenhum importador** (`TAXA_ENTREGA_FIXA`, `obterTaxaEntrega`, `formatarTaxa`). Não apaguei (§3.7); é remoção de uma linha quando alguém confirmar.
- Os 83 pedidos já gravados com bairro nulo e taxa 2,00 continuam como estão — reprecificar histórico mexe em caixa/crediário/finanças.
- No modal de edição, mudar a quantidade de um item recalcula `subtotal` como `(preço + adicionais) × qtd`, **descartando o `desconto_manual` daquele item**. Pré-existente e não coberto aqui.

**Armadilhas descobertas:**
- `pedidos.subtotal` tem significado **diferente** conforme a origem: no PDV já vem líquido do desconto do pedido; no cardápio vem bruto e o cupom fica só nas colunas de desconto. Qualquer tela que recalcule total precisa das duas regras juntas.
- `<select>` com `value` que não bate com nenhuma `<option>` renderiza vazio mas mantém o estado preenchido — validar por "campo não vazio" deixa passar valor inválido.

## [2026-07-26] Editar pedido apagava o bairro e rebaixava a taxa de entrega para R$ 2

**Agente/Modelo:** Claude Opus 5
**Objetivo:** Editar um pedido de entrega deve preservar (e permitir trocar) o bairro e cobrar a taxa real desse bairro, em vez de zerar o bairro e forçar o valor fixo.
**Arquivos alterados:** `src/components/admin/ModalEditarPedido.tsx`, `UI.md`, `Progress.md`.

**O que foi feito:**
- Estado `bairro` + carga de `bairros` (`ativo=true`, ordenado por `ordem`) no `ModalEditarPedido`, espelhando `/admin/pedidos/novo`.
- Taxa **derivada do bairro** (`entrega_gratis ? 0 : taxa_entrega`); `TAXA_ENTREGA_FIXA` saiu do arquivo.
- `bairro: null` hard-coded no update virou `tipoEntrega === 'entrega' ? (bairro || null) : null`; o snapshot de impressão passou a usar o bairro editado em vez do original.
- Seletor de bairro na seção Dados, visível só em `entrega`, com o valor de cada taxa no rótulo. O aviso passou a mostrar a taxa efetiva.

**Diagnóstico (dados de produção, PostgREST/anon — a Management API respondeu 403 com o token do ambiente):**
- `bairros`: 13 ativos, taxas de **R$ 2, R$ 3 e R$ 5**. O fixo era R$ 2, o **mais barato** — editar um pedido de Morrins/Taboquinha/Lagoa de fora derrubava a taxa de R$ 5 para R$ 2.
- `pedidos` com `tipo_entrega='entrega'`: 1.341 no total, **121 sem bairro**, dos quais **83 com taxa exatamente 2,00**.
- Nos 15 mais recentes sem bairro, **13 tinham `updated_at > created_at`** (ou seja, passaram pelo modal) e **todos** ficaram com taxa 2,00 — inclusive um cujo endereço diz "Bairro Lorival", que custa R$ 3.

**Decisões tomadas:**
- **Sem bairro conhecido, preserva `pedido.taxa_entrega`** em vez de cair para 0 ou para um fixo. Os 121 pedidos legados não são reprecificados sozinhos ao serem abertos, e nenhum save silencioso muda dinheiro.
- **Bairro fora do cadastro continua selecionável** (opção "fora do cadastro"): se um bairro for desativado ou renomeado, abrir e salvar um pedido antigo não apaga o dado.
- **Casamento por `nome`, não por id.** `pedidos.bairro` é `text` (o PDV grava o nome); usar id exigiria migração de coluna — fora do escopo.
- Query client-side com anon, contra a preferência do §3.9, porque `bairros` já é lido assim pelo cardápio público e pelo PDV e o modal inteiro já consulta o Supabase direto. Não amplia exposição.

**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · `npx next build` ✓ compilou · a query exata que o modal passa a fazer (`bairros?select=id,nome,taxa_entrega,entrega_gratis&ativo=eq.true&order=ordem`) respondeu **200 com os 13 bairros** · `npm run lint` indisponível no repositório (`next lint`, Next 16).

**Pendências / próximos passos:**
- **`src/app/garcom/novo/page.tsx:813` grava `bairro: null`** e usa `TAXA_ENTREGA_FIXA` (linha 651) — mesmo defeito, mas na **criação**. É a outra fonte dos 121 pedidos sem bairro. Corrigir exige adicionar seletor de bairro ao formulário do garçom: tarefa própria.
- **Os 83 pedidos já corrompidos não foram corrigidos** — reprecificar histórico mexe em caixa/crediário/finanças e precisa de autorização.
- `totalFinal` do modal é `subtotal + taxa + taxa_serviço` e **ignora `desconto_cupom`, `desconto_frete` e `desconto_manual`**: editar um pedido com cupom inflaria o total. Hoje é latente — nenhum pedido no banco tem esses campos > 0.

**Armadilhas descobertas:**
- `pedidos.bairro` é **texto solto**, não FK para `bairros`. Bairro renomeado no cadastro desliga a associação dos pedidos antigos em silêncio.
- Existem duas colunas de endereço em `pedidos` (`endereco` e `endereco_entrega`); o modal de edição só lê e grava `endereco`.
- A Management API respondeu **403** com o `SUPABASE_ACCESS_TOKEN` do ambiente ("account does not have the necessary privileges") — para análise de banco nesta máquina, o caminho que funciona é PostgREST com a anon key.

## [2026-07-25] Drawer do carrinho no mobile — seletor de bairro morto e painel cortado pelo teclado

**Agente/Modelo:** Claude Opus 5
**Objetivo:** Fazer o checkout público funcionar no mobile: escolher/rolar/fechar o bairro com o Drawer aberto e o painel não ficar cortado quando o teclado virtual abre, em Chromium e Safari.
**Arquivos alterados:** `src/hooks/useAjusteTecladoVirtual.ts` (novo), `src/components/ModalCarrinho.tsx`, `UI.md`, `Progress.md`.

**O que foi feito:**
- **Seletor de bairro virou `DrawerNested`** dentro do `DrawerContent` do checkout, espelhando o `ModalSelecionarMesa` que já estava certo. A lista rola pela cadeia flex (`min-h-0 flex-1 overflow-y-auto overscroll-contain`) em vez de `max-h-[60vh]`, e o fechar/swipe/Esc passam a ser do próprio Vaul.
- **Teclado virtual medido por conta própria:** `repositionInputs={false}` no `Drawer` + `useAjusteTecladoVirtual`, que deriva `height`/`bottom` do `visualViewport` a cada evento e devolve `null` quando o teclado fecha, devolvendo o painel ao `h-[92dvh]` do CSS.
- Efeito curto que realinha (`scrollIntoView({ block: 'center' })`) o campo em foco depois que o painel encolhe — o browser só alinha o campo *antes* do redimensionamento.

**Decisões tomadas:**
- **`DrawerNested` em vez de subir o z-index.** O overlay do bairro era irmão do `<Drawer>` com `z-[1100]`: aparecia por cima, mas o Radix (que o Vaul usa por baixo) põe `pointer-events:none` no `body` e o `react-remove-scroll` bloqueia `touchmove`/`wheel` fora do content. Daí os três sintomas juntos — não escolhia, não rolava, não fechava. O `ModalAlerta` escapa porque tem `pointer-events-auto` explícito.
- **Desligar o `repositionInputs` do Vaul em vez de ajustar o CSS.** O Vaul escreve `style.height`/`style.bottom` inline (vence o `h-[92dvh]`) e decide isso por um `keyboardIsOpen` que ele **alterna** (`!keyboardIsOpen`) a cada `visualViewport.resize` maior que 60px. Safari/Chromium emitem vários eventos durante a animação do teclado, o flag dessincroniza, o handler passa a sair cedo (`isInput(activeElement) || keyboardIsOpen`) e a altura em px fica congelada. O hook novo nunca acumula estado: recalcula da medida atual e volta a `null` sozinho.
- **Hook local, primitiva compartilhada intocada.** `src/components/ui/drawer.tsx` é usado pelo admin (sidebar, dialogs responsivos) — mexer nele arriscava regressão fora do escopo (§3.3).
- Perdemos o `usePreventScroll` do Vaul (o `isDisabled` dele inclui `!repositionInputs`), mas o bloqueio de scroll de fundo continua: quem tranca é o `DialogPrimitive.Overlay` do Radix, como o próprio código do Vaul comenta. De quebra sai o hack iOS de `translateY(-2000px)` no input.
- No modo simulação o bairro deixou de renderizar `absolute` dentro da moldura de iPhone. Já era incoerente: o Drawer pai sempre foi portal para o `body`, então o filho ficava dentro da moldura e o pai fora.

**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · `npx next build` ✓ compilou e gerou todas as rotas · `npm run lint` **segue indisponível** no repositório (o script é `next lint`, removido no Next 16 — falha idêntica antes da mudança) · skill `bug-hunter` executada sobre o próprio diff ✓ (achado: com `bairros.length === 0`, o botão "No local" fecha um `DrawerNested` e abre o outro no mesmo commit; os efeitos rodam na ordem de montagem e o pai fica sem o recuo de 16px — cosmético, estado neutro, sem correção) · `verification-before-completion` **não** executada como skill; a verificação foi typecheck + build + releitura do diff.

**Pendências / próximos passos:**
- **O modal PIX (`modalPagamentoPixAberto`) tem exatamente o mesmo defeito** e continua quebrado: `fixed inset-0 z-[1100]` irmão do `<Drawer>`, sem `pointer-events-auto` — com o checkout aberto nenhum botão dele responde e o conteúdo não rola. Não entrou no escopo porque a correção certa (`DrawerNested`) muda a apresentação dele no desktop de diálogo centralizado para bottom sheet — decisão de UI a confirmar.
- O botão de fechar do `ModalAlerta` é clicável (tem `pointer-events-auto`), mas ele vive fora da árvore do Drawer; se um dia ganhar interação real, mover também.

**Armadilhas descobertas:**
- `z-index` não vence focus trap. Overlay irmão de Drawer modal fica visível e inerte: `pointer-events:none` no `body` (Radix) + `react-remove-scroll` fora do content.
- O `repositionInputs` do Vaul 1.1.2 **alterna** `keyboardIsOpen` em vez de setar; com mais de dois `visualViewport.resize` por animação de teclado ele dessincroniza e o drawer nunca volta à altura original.
- `dvh` **não** encolhe com o teclado virtual (nem no iOS nem no Chrome Android) — ele acompanha só a barra do browser. Painel que precisa caber acima do teclado tem que ler `visualViewport`.
- `visualViewport.offsetTop` importa no iOS: a conta é `innerHeight - vv.height - vv.offsetTop`, senão o painel fica deslocado quando o Safari rola o viewport visual.
## [2026-07-25] Cadastro casado funcionário ↔ usuário do sistema

**Agente/Modelo:** Claude Opus 5
**Objetivo:** Parar de exigir cadastro manual nas duas telas: um toggle pré-ativado em cada modal de criação passa a criar o outro lado já vinculado.
**Arquivos alterados:** `src/lib/cadastro-equipe.ts` (novo), `src/components/admin/GerenciadorFuncionarios.tsx`, `src/components/admin/GerenciadorUsuariosSistema.tsx`, `UI.md`, `Progress.md`.

**O que foi feito:**
- **Novo funcionário:** toggle “Criar acesso ao sistema” (ligado por padrão) abre foto (recorte real via `ModalRecorteAvatar`), login, senha com olho, papel e cor do avatar. Salvar grava o funcionário, cria o usuário com `funcionario_id` e sobe a foto depois (o upload precisa do id do usuário).
- **Novo usuário:** toggle “Cadastrar como funcionário” (ligado por padrão) com função na equipe e telefone. O funcionário é criado antes para o usuário já nascer vinculado.
- Login sugerido a partir do nome no padrão real da base (`joao_pedro`, `md_chefe`), com sufixo numérico quando já existe; a sugestão para de sobrescrever assim que o admin digita à mão.
- Papel e função se traduzem nos dois sentidos (`PAPEL_PARA_TIPO_FUNCIONARIO` / `TIPO_FUNCIONARIO_PARA_PAPEL`), sempre como valor inicial editável.
- Em edição, nenhum dos toggles aparece: alterar quem já existe continua sendo feito na tela do próprio cadastro.

**Decisões tomadas:**
- **Reaproveitar em vez de duplicar:** ao criar usuário com o toggle ligado, um funcionário de mesmo nome normalizado (sem acento/caixa) é vinculado. A base já tinha “Bom Parto”/“Bom parto”, “Edienai”/“edienai”, “Zacarias”/“Zacarias” — justamente o efeito do cadastro manual em duas telas.
- **Sem transação distribuída:** se o segundo passo falhar, o primeiro permanece e o toast diz o que ficou pendente. Repetir a operação reaproveita o cadastro criado, então não gera duplicata.
- `cozinheiro` mapeia para o papel `garcom` porque `usuarios_sistema.papel` tem CHECK (`admin|garcom|entregador`); o campo fica visível para correção.

**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · RPC `criar_usuario_sistema` inspecionada ao vivo — ela de fato insere `funcionario_id` ✓ · cadeia completa testada no banco em bloco `DO` abortado por exceção (`vinculo_ok=t`, papel `garcom`) e resíduo conferido depois: 0 registros de teste, contagens intactas (8 funcionários / 11 usuários) ✓ · `/admin/funcionarios`, `/admin/usuarios` e `/admin/produtividade` compilam e respondem **200** em dev server temporário (porta 3005, derrubado ao fim; log sem erro de compilação) ✓ · geração de login conferida contra os nomes reais (`João Pedro`→`joao_pedro`, `MD Chefe`→`md_chefe`) ✓. `npm run lint` segue indisponível (o `next lint` legado é incompatível com Next 16).

**Pendências / próximos passos:**
- Os 11 usuários e 8 funcionários **já existentes** continuam sem vínculo: um backfill que case os pares por nome resolveria, mas é tarefa própria (mexe em dados de produção).
- `criar_usuario_sistema` guarda a senha como **SHA-256 sem salt**. Não foi tocado por estar fora do escopo, mas é fraqueza real de autenticação.

**Armadilhas descobertas:**
- `URL.createObjectURL` do preview precisa de `revokeObjectURL` ao limpar o formulário, senão o blob fica retido.
- O upload de avatar (`enviarImagemParaR2`) exige o id do usuário, então a foto só pode subir **depois** de criar o acesso — não dá para inverter a ordem.
- `funcionarios.tipo` não tem CHECK (aceita qualquer texto), mas `usuarios_sistema.papel` tem: a tradução precisa partir do lado restrito.

## [2026-07-25] Produtividade dos garçons — pontuação, ranking e boas práticas

**Agente/Modelo:** Claude Opus 5
**Objetivo:** Criar o módulo de produtividade (inspirado no `metrics` do Juridiq) medindo pedidos criados, entregues e editados por garçom, com desconto de pontos por cadastro ruim.
**Arquivos alterados:** `scripts/migrations/20260725_produtividade_garcons.sql` (novo, **aplicado em produção** via Management API), `src/lib/server/produtividade.ts`, `src/app/api/admin/produtividade/route.ts`, `src/app/api/admin/produtividade/ocorrencias/route.ts`, `src/app/api/admin/produtividade/config/route.ts`, `src/features/produtividade/*` (types, `lib/periodo.ts`, `lib/metricas.ts`, `hooks/useProdutividade.ts`, 7 componentes), `src/app/admin/produtividade/page.tsx`, `src/lib/admin-sidebar-routes.ts`, `PRD.md`, `UI.md`, `Progress.md`.

**O que foi feito:**
- Pontuação **calculada sob demanda** por funções SQL — nenhum trigger novo em `pedidos` (que já tem 9 e move caixa/crediário/impressão) e retroativa sobre os 2.996 pedidos de garçom já existentes.
- Ganhos: pedido criado (qualquer status, inclusive pendente), pedido entregue, item adicionado, pedido editado e bônus de cadastro completo. Descontos: nome de cliente genérico e retirada/entrega sem telefone ou endereço. Cancelado é neutro (peso 0, configurável).
- Pesos e metas em `produtividade_config`, editáveis pela UI; mudar um peso recalcula todo o histórico.
- Tela `/admin/produtividade`: faixa KPI + metas dia/semana/mês, ranking com pódio e selo de qualidade, gráfico de ganhos × perdas, evolução por dia operacional, lista paginada de "pontos perdidos" com deep-link para o pedido e modal de composição dos pontos por garçom.

**Decisões tomadas:**
- **Fechamento = pedido chega a `entregue`**, creditado ao dono (`garcom_id`). O app do garçom não foi instrumentado: em 313 edições registradas só 2 foram "status alterado para entregue" — o fechamento acontece no admin/salão.
- **`security definer` em vez de abrir a tabela.** `SUPABASE_SERVICE_ROLE_KEY` **não existe no `.env.local`**, então `obterSupabaseAdmin()` cai no fallback da anon key e um `REVOKE` puro deixava a tela sem dados (`permission denied for table produtividade_config`). As funções de topo rodam como o dono e a tabela continua inacessível ao anon; a escrita passa por `produtividade_salvar_config`, que só aceita as 11 chaves conhecidas com valor entre 0 e 100000.
- **Nenhum índice criado** — medido: o recorte de `pedidos` custa 2,4 ms pelo `idx_pedidos_created_at` existente e a agregação de `atividade_garcom` 3,4 ms em seq scan. O custo estava na avaliação das regras por linha.
- Pedido em aberto **não** desconta ponto (decisão do usuário), mas aparece como métrica e como aviso no modal do garçom.

**Verificação:** `npx tsc --noEmit --incremental false` ✓ 0 erros · funções conferidas ao vivo pela Management API (5 funções, todas `security definer`, tabela negada ao anon: `has_table_privilege('anon',…,'SELECT') = false`) · execução completa sob `set local role anon` ✓ · endpoints reais em `localhost:3000`: GET produtividade/ocorrências/config 200 e período inválido, ausente e janela de 3 anos → 400 ✓ · PUT válido grava e PUT com valor negativo ou chave desconhecida → 400 ✓ · consistência cruzada: pontos negativos do ranking = soma das ocorrências (587 em 7 dias; 6.820 em 90 dias) e total do ranking = soma da série em 7/30/90/365 dias ✓ · bug-hunter ✓ · verification-before-completion ✓. **`npm run lint` continua indisponível** no repositório (o script legado `next lint` é incompatível com Next 16 e não há config ESLint).

**Pendências / próximos passos:**
- Se um dia o garçom passar a fechar pedido pelo app, registrar `pedido_fechado` em `atividade_garcom` permite separar "fechou" de "foi fechado por outro".
- Quando `SUPABASE_SERVICE_ROLE_KEY` existir no ambiente, dá para revogar os `grant execute` do anon nas funções de topo.

**Armadilhas descobertas:**
- Função SQL com `WITH` **ou** com `SET search_path` não é inlineada pelo planner: `fn_produtividade_nome_generico` custava 88 ms por 3.000 linhas e caiu para ~46 ms quando virou expressão única com tudo qualificado em `pg_catalog` (a proteção contra search_path hijack é mantida pela qualificação).
- `revoke ... from anon` **não** fecha uma função: o `EXECUTE` default vem do pseudo-role `PUBLIC`. Só `revoke ... from public` fecha.
- Em `count(distinct (dia, pedido_id))` o par **não** é nulo quando só `pedido_id` é — sem `pedido_id is not null` no filtro, o único evento órfão de `atividade_garcom` entrava na conta e o total do ranking divergia da série em 3 pontos.
- `pedidos` não tem `status_atualizado_em` nem autoria de fechamento, e `updated_at` não serve como "fechado em" (média de 3,7 dias entre criação e último update).

## [2026-07-25] Pedidos — cache, scroll e recargas concorrentes

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Eliminar a quebra intermitente da lista de Pedidos, o scroll fantasma e a necessidade de F5.
**Arquivos alterados:** `public/sw-admin.js`, `src/components/admin/PWAManagerAdmin.tsx`, `src/components/admin/AdminLayout.tsx`, `src/app/admin/pedidos/page.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Service worker admin `v4.3.5`: navegações HTML e payloads RSC são sempre de rede; somente GETs não HTML/RSC podem entrar no cache; o cache antigo é invalidado na ativação.
- O novo worker usa `skipWaiting`, o gerenciador verifica atualização imediatamente e recarrega uma única vez na troca de controller; em desenvolvimento, registros e caches do admin são removidos.
- `AdminLayout` passou a identificar o container rolável e restaurá-lo sem animação em mudanças de rota.
- Pedidos restaura o scroll em mudanças de consulta/paginação, aceita somente a resposta assíncrona mais recente e preserva a grade já carregada durante recargas, com estado visual ocupado; skeleton aparece apenas na carga inicial.
**Decisões tomadas:** Preservado o fallback `/offline.html`, mas HTML/RSC do painel não têm fallback em cache porque misturar versões do App Router é mais perigoso do que apresentar o estado offline.
**Verificação:** `node --check public/sw-admin.js` ✓ · `npx tsc --noEmit --incremental false` ✓ · teste estrutural red/green e contratos críticos ✓ · `git diff --check` ✓ · bug-hunter ✓ · code-reviewer ✓ · verification-before-completion ✓. `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16.
**Pendências / próximos passos:** nenhuma dentro do escopo.
**Armadilhas descobertas:** `skipWaiting` precisa ser acompanhado por listener de `controllerchange` registrado antes da verificação explícita; listeners anônimos/recriados não são removidos corretamente.

## [2026-07-25] Dashboard — pedidos de hoje com corte às 03h

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Corrigir os KPIs “Pedidos hoje” e “Receita hoje” para respeitarem o dia operacional real, encerrado às 03:00 do dia seguinte.
**Arquivos alterados:** `src/app/admin/dashboard/page.tsx`, `PRD.md`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Substituído o helper legado de 10:00→09:59 pelo `obterIntervaloDiaOperacionalAtual`, já compartilhado por Garçons e Salão.
- A RPC `estatisticas_pedidos_periodo` foi preservada: ela estava correta e apenas recebia `p_inicio` errado do dashboard.
- O fim do payload de “hoje” continua sendo o instante atual; o início agora é 03:00 em `America/Sao_Paulo`.
**Decisões tomadas:** Reuso do helper único de dia operacional; nenhuma migration, índice ou alteração de função foi necessária.
**Verificação Management API:** em 25/07/2026 às 16:53 SP, RPC 10h retornou 6 pedidos/R$ 48,00 e RPC 03h retornou 9 pedidos/R$ 85,00. Os pedidos das 09:25, 09:34 e 09:45 eram os três excluídos pelo payload antigo.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ · teste estrutural red/green do payload ✓ · `git diff --check` ✓ · conferência Management API ✓ · bug-hunter ✓ · verification-before-completion ✓. `npm run lint` indisponível: o script legado `next lint` é incompatível com Next 16; execução direta do ESLint também não encontra configuração no repositório.
**Pendências / próximos passos:** Auditar separadamente Análise Diária e Caixa, que ainda usam o helper legado de 10h; não foram alterados nesta tarefa.
**Armadilhas descobertas:** A RPC não define o dia operacional; o chamador define a janela. Comparar apenas a função do banco esconderia o erro no payload client-side.

## [2026-07-24] Checkout público — seletor de mesa aninhado

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Impedir que o seletor de mesa bloqueie o carrinho e permitir fechar ou selecionar sem perder o checkout.
**Arquivos alterados:** `src/components/ModalCarrinho.tsx`, `src/components/ModalSelecionarMesa.tsx`, `src/components/ui/drawer.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- O seletor deixou de ser um overlay customizado irmão do checkout e passou a usar o `NestedRoot` oficial do Vaul.
- O componente agora é montado dentro da árvore do Drawer pai, preservando a coordenação de foco, eventos externos, Escape, overlay e scroll.
- Fechar a seleção encerra apenas o Drawer filho; o carrinho permanece aberto no mesmo estado.
- Título e descrição passaram a usar as primitivas acessíveis do Drawer; o botão de fechar mantém alvo mínimo de 44 px.
**Decisões tomadas:** Não foi usado `modal={false}` no carrinho: isso apenas relaxaria o bloqueio global e esconderia o sintoma. `DrawerNested` trata a relação pai/filho na origem.
**Verificação:** teste estrutural red/green ✓ · `npx tsc --noEmit --incremental false` ✓ (0 erros) · `git diff --check` ✓ · revisão da implementação instalada do Vaul ✓ · `npm run lint` bloqueado pelo script preexistente `next lint`, incompatível com Next 16 · bug-hunter ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** Nenhuma funcional; validação visual manual no aparelho continua necessária porque teste de browser é proibido neste repositório.
**Armadilhas descobertas:** `z-index` maior não vence o focus trap nem `pointer-events` controlados por um Drawer modal.

## [2026-07-24] Cardápio público — correção estrutural do mobile, Drawer e hidratação

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Corrigir o carrinho escurecido/inoperante, remover a navegação inferior durante fluxos modais, eliminar a divergência de hidratação e tornar a montagem do pedido mais clara no celular.
**Arquivos alterados:** `public/sw.js`, `src/app/page.tsx`, `src/components/AjudaPedidoPublica.tsx`, `src/components/Footer.tsx`, `src/components/Header.tsx`, `src/components/ModalAlerta.tsx`, `src/components/ModalCarrinho.tsx`, `src/components/ModalComplementos.tsx`, `src/components/ModalSelecionarMesa.tsx`, `src/components/PWAManager.tsx`, `src/contexts/CarrinhoContext.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Corrigida a ordem de camadas do Vaul: overlay e superfície voltaram aos níveis compartilhados, enquanto seletor de bairro/mesa, alerta e PIX ficam acima do checkout.
- A navegação inferior deixa de ser renderizada enquanto carrinho, pedidos, ajuda, complementos ou notificação estiverem abertos; o aviso não bloqueante de loja fechada preserva a navegação.
- O service worker não registra em desenvolvimento, remove registros/caches antigos e não armazena HTML nem payload RSC; a navegação usa rede com fallback apenas para a página offline.
- O cabeçalho passou a ter árvore inicial estável entre servidor e cliente; apenas o ícone dependente do tema muda depois da montagem.
- A persistência do carrinho ganhou uma barreira de hidratação para não sobrescrever o `localStorage` com o estado vazio inicial.
- Adicionar produto, bebida, combo ou item personalizado agora confirma por toast com ação `Ver carrinho`, sem interromper a escolha nem abrir o checkout à força.
- O carrinho recebeu alvos de toque maiores, quantidade/total junto à decisão, rodapé fixo legível, scroll contido e etapas futuras realmente desabilitadas.
**Decisões tomadas:** Aplicados os princípios de `uxui-principles` de controle do usuário, alvo de toque, hierarquia, feedback imediato e redução de sobreposição; o checkout existente foi preservado como única fonte do pedido.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · `git diff --check` ✓ · `npm run lint` bloqueado pelo script preexistente `next lint` no Next 16 · ESLint direto também indisponível porque o repositório não possui arquivo de configuração · bug-hunter ✓ · code-reviewer ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** Validação visual manual em celular real; teste de browser automatizado é proibido neste repositório.
**Armadilhas descobertas:** Um service worker cacheando `/` pode combinar HTML antigo com chunks novos do Next e produzir mismatch de classe literal; nunca baixar localmente o conteúdo de um Drawer abaixo do overlay compartilhado.

## [2026-07-24] Correção do cardápio público — Drawer e camadas mobile

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Corrigir a regressão visual do CTA sobre o catálogo, o Drawer de ajuda bloqueado pelo próprio overlay e o carrinho que ainda era um modal customizado.
**Arquivos alterados:** `src/app/page.tsx`, `src/components/AjudaPedidoPublica.tsx`, `src/components/ModalCarrinho.tsx`, `src/components/ModalSelecionarMesa.tsx`, `src/components/ui/drawer.tsx`, `UI.md`, `Progress.md`; removido `src/components/BarraCarrinhoPublico.tsx`.
**O que foi feito:**
- Removidos CTA de carrinho, ajuda e WhatsApp flutuantes; carrinho permanece no menu inferior e ajuda somente na navbar.
- Corrigida a causa do Drawer de ajuda escurecido e sem clique: o conteúdo tinha `z-[80]` abaixo do overlay `z-[1000]`.
- Checkout passou a usar o Drawer Vaul compartilhado, preservando os seletores internos acima da superfície.
- Cards explicativos das etapas foram substituídos por progresso compacto; texto redundante antes dos itens foi removido.
- Ajuda virou instrução curta em linha, com ações reais para voltar ao cardápio ou chamar no WhatsApp.
**Decisões tomadas:** `DrawerContent` ganhou `overlayClassName` opcional para o checkout coexistir com os submodais legados de bairro, mesa, alerta e PIX sem alterar o z-index global dos demais Drawers.
**Verificação:** `npx tsc --noEmit --incremental false` ✓ (0 erros) · `git diff --check` ✓ · `npm run lint` bloqueado pelo script preexistente `next lint`, incompatível com Next 16 · bug-hunter ✓ · code-reviewer ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** validação visual manual em celular real; teste de browser automatizado é proibido neste repositório.
**Armadilhas descobertas:** nunca aplicar z-index de conteúdo abaixo do `DrawerOverlay`; o menu inferior já era o controle persistente do carrinho, portanto uma segunda barra fixa sempre concorreria pelo mesmo espaço.

## [2026-07-24] Cardápio público — pedido mobile, ajuda e WhatsApp

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Tornar o pedido pelo cardápio público mais direto no celular, com carrinho acessível, cores coerentes e ajuda imediata.
**Arquivos alterados:** `src/app/page.tsx`, `src/components/Header.tsx`, `src/components/BarraCarrinhoPublico.tsx`, `src/components/AjudaPedidoPublica.tsx`, `src/components/ModalCarrinho.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Adicionada barra fixa de carrinho no mobile com quantidade e total; produtos, bebidas e combos permanecem no cardápio depois de adicionar.
- Checkout existente ganhou apresentação de bottom sheet no mobile, altura segura em `100dvh`, footer sempre alcançável e etapas mais legíveis em telas estreitas.
- Busca, filtros e superfícies da página pública passaram a usar tokens semânticos do tema.
- Criado Drawer “Como fazer seu pedido”, acionável no cabeçalho e por botão flutuante; botão flutuante de WhatsApp é exibido quando o número estiver configurado.
**Decisões tomadas:** foi preservado o `ModalCarrinho` existente como única finalização para não duplicar fluxo de checkout; o botão do WhatsApp usa a configuração já carregada por `useStatusLoja`.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros) · `git diff --check` ✓ · `npm run lint` bloqueado por script preexistente (`next lint` é incompatível com Next 16) · bug-hunter ✓ · verification-before-completion ✓.
**Pendências / próximos passos:** validação visual manual em aparelhos reais continua recomendada; Playwright é proibido neste repositório.
**Armadilhas descobertas:** o `npm run lint` deste projeto chama `next lint`, comando incompatível com Next 16; registrar a falha se ela persistir.

## [2026-07-24] Crediário — excluir pedido cancela o consumo vinculado

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Remover do saldo do Crediário o consumo de um pedido excluído.
**Arquivos alterados:** `scripts/migrations/20260724_cancelar_crediario_ao_excluir_pedido.sql`, `Progress.md`.
**O que foi feito:** Atualizada e aplicada a função trigger `limpar_dados_pedido_excluido`: antes da exclusão, ela cancela somente o consumo ativo de origem `pedido` ligado por `pedido_id` e registra o motivo no metadata.
**Decisões tomadas:** Cancelamento lógico, não exclusão física do movimento, para manter auditoria; o trigger já existente de movimentos recalcula o saldo da conta.
**Verificação:** Função confirmada ao vivo pela Supabase Management API · `npx tsc --noEmit` ✓ 0 erros · `npm run lint` indisponível no repositório (Next 16 interpreta `lint` como diretório).
**Pendências / próximos passos:** Nenhuma.
**Armadilhas descobertas:** A FK de `crediario_movimentos.pedido_id` usa `ON DELETE SET NULL`; sem a atualização antes do delete, o consumo ficava ativo, sem vínculo e continuava compondo o saldo.

## [2026-07-24] Crediário — ordenação das contas

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Permitir ordenar as contas filtradas por atualização ou saldo.
**Arquivos alterados:** `src/features/crediario/components/PainelCrediario.tsx`, `Progress.md`.
**O que foi feito:** Adicionados pills de ordenação: Mais recentes, Mais antigas, Maior saldo e Menor saldo; a ordenação ocorre antes da paginação.
**Decisões tomadas:** Mais recentes é o padrão inicial e os filtros de status, origem e busca continuam sendo aplicados antes da ordenação.
**Verificação:** `npx tsc --noEmit` ✓ 0 erros · `npm run lint` indisponível no repositório (Next 16 interpreta `lint` como diretório).
**Pendências / próximos passos:** Nenhuma.
**Armadilhas descobertas:** A ordenação precisa ocorrer antes do `slice` da paginação para não produzir páginas inconsistentes.

## [2026-07-24] Crediário — contas mais recentes primeiro

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Exibir as contas filtradas por atualização mais recente antes da paginação.
**Arquivos alterados:** `src/features/crediario/components/PainelCrediario.tsx`, `Progress.md`.
**O que foi feito:** Ordenada uma cópia de `contasFiltradas` por `atualizado_em` decrescente depois dos filtros de status, origem e busca.
**Decisões tomadas:** A conta de demonstração do onboarding permanece fixada no topo; todas as contas reais respeitam a ordem cronológica.
**Verificação:** `npx tsc --noEmit` ✓ 0 erros · `npm run lint` indisponível no repositório (Next 16 interpreta `lint` como diretório).
**Pendências / próximos passos:** Nenhuma.
**Armadilhas descobertas:** A paginação usa diretamente `contasFiltradas`; ordenar após o `slice` deixaria as páginas fora de ordem.

## [2026-07-24] Crediário — pagamento de item sincronizado ao pedido

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Fazer o pagamento de unidades no Crediário refletir no pedido sem criar um segundo desconto no saldo.
**Arquivos alterados:** `src/components/admin/pagamento/ModalFormaPagamentoItens.tsx`, `src/components/admin/pagamento/pagamentoItens.ts`, `src/components/admin/ModalDetalhesPedido.tsx`, `src/features/crediario/components/PainelCrediario.tsx`, `scripts/migrations/20260724_pagamento_item_crediario_sincronizado.sql`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Extraído o seletor real de quantidade e forma de pagamento para componente compartilhado; no Crediário ele oferece PIX, Dinheiro e Cartão.
- Adicionada a RPC `registrar_pagamento_item_crediario`, aplicada via Management API: bloqueia o consumo, valida o snapshot, reduz somente as unidades quitadas e grava `pagamentos_pedido` na mesma transação.
- O pagamento livre da conta foi preservado como fluxo separado.
**Decisões tomadas:** A RPC não cria `crediario_movimentos.tipo='pagamento'` e não altera `pedidos.forma_pagamento`; isso evita desconto duplicado e o cancelamento indevido do consumo pelo trigger existente.
**Verificação:** `npx tsc --noEmit` ✓ 0 erros · função confirmada ao vivo pela Management API · `npm run lint` indisponível no repositório (Next 16 interpreta `lint` como diretório).
**Pendências / próximos passos:** Validar manualmente, no admin, uma quitação parcial e uma total de item que possua taxa de entrega no mesmo consumo.
**Armadilhas descobertas:** Há consumos cujo `valor` excede a soma dos itens (taxas/ajustes); a RPC preserva o saldo residual ao quitar o último item, em vez de cancelar o movimento.

## [2026-07-24] Crediário — quitar conclui o pedido (migration aplicada)

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Pedido salvo com forma de pagamento crediário continuava marcado como "Crediário" mesmo após a quitação. Ao quitar, deve virar "Concluído" no card.
**Arquivos alterados:** `scripts/migrations/20260724_crediario_concluir_pedidos.sql` (novo, **aplicado em produção** via Management API), `Progress.md`.
**Causa raiz:** `quitar_crediario` só inseria o pagamento e zerava a conta — **nunca escrevia em `pedidos`**; e nenhum trigger faz o caminho crediário → pedido. Como o card deriva o selo de `forma_pagamento` + status da conta (`pedidoEmCrediario` em `CardPedido.tsx`), o pedido ficava "Crediário" para sempre.
**Armadilha tratada:** `trigger_sincronizar_pedido_crediario` dispara em `UPDATE OF forma_pagamento` e **cancela o consumo** quando a forma deixa de casar com `%credi%`. Trocar para "Concluído" sem proteção deixaria o pagamento da quitação sozinho → **saldo negativo** na conta.
**O que foi feito (2 funções, 1 migration):**
- `quitar_crediario`: após zerar a conta, `update public.pedidos set forma_pagamento='Concluído'` para os pedidos com consumo ativo daquela conta. Statement único (locks atômicos, regra `lock-deadlock-prevention`), por último na transação, idempotente (`and pedido_usa_crediario(p.forma_pagamento)`). Também passa a concluir no caminho `saldo <= 0` (antes retornava cedo).
- `sincronizar_pedido_crediario`: não cancela consumo cuja conta já está `quitado` (evita o saldo negativo).
**Decisão (via skill `supabase-postgres-best-practices`):** feito **no banco**, não no app — atômico na mesma transação (app-side seria 2º round-trip que pode falhar após o RPC), fonte única para qualquer chamador, e não amplia a superfície da anon key (§Segurança). Índices já existentes (`idx_crediario_movimentos_conta_data`, `idx_crediario_movimentos_pedido`) cobrem o join; nenhum índice novo.
**Verificação:** migration aplicada com sucesso; `pg_get_functiondef` confirma as duas alterações nas funções em produção.
**Backfill (autorizado e aplicado):** `scripts/migrations/20260724_crediario_backfill_pedidos_concluidos.sql` — concluiu **107 pedidos** de contas já quitadas. Verificação pós-backfill:
- pedidos quitados ainda marcados como crediário: **107 → 0** ✓
- contas com saldo negativo: **17 → 17** (inalterado — backfill não danificou nada) ✓
- consumos desses 107 pedidos: **107 ativos, 0 cancelados** ✓ (a guarda no trigger funcionou)
- das 61 contas envolvidas, só **3** têm saldo ≠ 0 (todas negativas, do grupo pré-existente; soma −R$ 1.056,00)

**Pendência / achado (NÃO corrigido, precisa de decisão):**
- **17 contas com `saldo_atual` negativo** (pré-existente, anterior a esta correção). Provável causa: consumo cancelado com o pagamento mantido — exatamente o cenário que a nova guarda impede daqui pra frente. Precisa de decisão sobre como reconciliar (estorno, ajuste ou reativar o consumo).
**Armadilhas:** não trocar `forma_pagamento` para um valor sem "credi"/"fiado"/"conta" sem a guarda no trigger, sob pena de zerar o consumo e negativar a conta.

## [2026-07-23] Onboarding — módulo Painel (Kanban de produção)

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Terceiro tour: Painel de produção (`/admin/painel`), ensinando o quadro Kanban de ponta a ponta.
**Arquivos alterados:**
- Novos: `onboarding/demo/painel-demo-store.ts`, `onboarding/demo/PainelDemoBridge.tsx`, `onboarding/config/painel.ts`.
- Tocados: `onboarding/config/index.ts`, `onboarding/index.ts`, `onboarding/components/onboarding-root.tsx`, `src/app/admin/painel/page.tsx`, `src/components/admin/painel/CardPedidoKanban.tsx`, `UI.md`, `Progress.md`.
**O que foi feito:**
- Tour de 11 etapas: problema → benefício → resumo/contadores → as 3 colunas → o card de exemplo → avançar status → menu ⋯ → arrastar → atalhos de coluna (mobile) → busca → conclusão.
- **Pedido de exemplo client-side** injetado no topo da coluna "Em análise" do board REAL (`pedidosNovos`), com itens/total/canal coerentes.
- **Blindagem central**: helper `comGuardaDemo` embrulha os 7 handlers do board (detalhes, avançar, mover, editar, apagar, imprimir, confirmar pagamento) — no pedido de exemplo mostram toast e **não tocam o banco**. As três colunas usam `acoesBoard`.
- Âncoras `data-onboarding` no page (resumo/busca/pills/board) e no `CardPedidoKanban` **condicionais ao id demo** (card/avançar/menu/arrastar), sem afetar cards reais.
**Decisões:** mesmo padrão de Crediário/Finanças — dado de exemplo client-side alimentando a UI real (AGENTS §0.2.5/§0.2.6). Guardas centralizadas num helper em vez de editar cada handler (diff menor, menos risco de esquecer um caminho).
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). Lint não executável no repo (pré-existente). Sem teste de browser (AGENTS §3.4).
**Pendências:** smoke: iniciar pelo Ajuda em `/admin/painel`, ver o card de exemplo na 1ª coluna, testar avançar/menu (toast) e conferir que some ao concluir.
**Armadilhas:** `handleDragEnd` procura o pedido no estado `pedidos` — o demo NÃO está lá, então arrastar o card de exemplo é inócuo por construção (não precisa de guarda extra). `totalAtivos` e o contador da 1ª coluna incluem o demo enquanto o tour roda.

## [2026-07-23] Onboarding — módulo Finanças completo (com Diárias)

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Segundo tour do onboarding: Finanças completo, incluindo a área de Diárias.
**Arquivos alterados:**
- Novos: `onboarding/demo/financas-demo-store.ts`, `onboarding/demo/FinancasDemoBridge.tsx`, `onboarding/config/financas.ts`.
- Tocados: `onboarding/config/index.ts` (registro), `onboarding/index.ts` (exports), `onboarding/components/onboarding-root.tsx` (monta o bridge), `PainelFinancas.tsx` (âncoras), `PainelDiarias.tsx` (âncoras + diária de exemplo + guardas), `UI.md`, `Progress.md`.
**O que foi feito:**
- Tour de 16 etapas cobrindo o módulo inteiro: lucro + ocultar valores → Receitas / Despesas / Salário → cards recebido×pago → período e filtros rápidos → lista de lançamentos → **Diárias** → Análise/Pagamentos → conclusão.
- **Diárias**: etapa de troca de aba com **demonstração ao vivo** (o tour clica em "Diárias" pelo usuário, via `demo.actions` + `advanceOn: element-visible`), depois ensina Nova diária, o calendário e a alternância calendário×lista.
- **Diária de exemplo client-side** injetada no calendário/lista **reais** do `PainelDiarias` (`diariasComDemo`), com data de hoje; contagem/total do header a incluem quando visível. Exclusão (detalhe e lista) blindada por `DIARIA_DEMO_ID` → **nada é gravado ou removido em `financas_diarias`/`movimentacoes_caixa`**.
- Âncoras `data-onboarding` adicionadas sem alterar lógica financeira (só atributos e um wrapper na lista).
**Decisões:** segui o padrão do Crediário — dado de exemplo client-side alimentando a UI real (AGENTS §0.2.5/§0.2.6), sem componente paralelo. Etapas dependentes de aba usam `skipIfMissing` para degradar sem travar.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). Lint não executável no repo (pré-existente). Sem teste de browser (AGENTS §3.4).
**Pendências:** smoke no browser: iniciar pelo botão Ajuda em `/admin/financas`, usar "Abrir as Diárias para mim", conferir a diária de exemplo no dia de hoje e que ela some ao concluir.
**Armadilhas:** a diária de exemplo só aparece quando o mês exibido contém a data de hoje (se o usuário navegar para outro mês, ela some — proposital). O seletor da demo usa `aria-label="Diárias"` dentro de `financas-toggle-principal`.

## [2026-07-23] Onboarding Crediário — ROOT CAUSE: modal Radix/vaul matava os cliques do tour

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** O tour continuava sem avançar ao abrir o modal (as correções anteriores de dismiss/z-index não resolveram). Achar a causa real.
**Root cause (real):** `Dialog`/`Drawer` são **`modal` por padrão**. O Radix `DismissableLayer` com `disableOutsidePointerEvents` aplica **`pointer-events: none` no `<body>`** e só o conteúdo do modal fica clicável — além de prender o foco e marcar o resto como `aria-hidden`. Como o popover/sheet do tour é renderizado FORA do modal, ele ficava **visível porém morto**: clicar em "Avançar" não fazia nada ("não avança"), e o tour travado gerava a sensação de "abre algo por baixo" e de "div incorreta".
**Arquivos alterados:** `components/tour-popover.tsx`, `components/tour-mobile-sheet.tsx`, `PainelCrediario.tsx`, `Progress.md`.
**O que foi feito:**
- `pointer-events-auto` no popover (desktop) e no slider (mobile) — necessário para receber clique sob qualquer modal da aplicação (correção geral do engine, não só do crediário).
- `modal={false}` no Dialog **apenas** enquanto a conta é a de exemplo: sem trava de pointer-events, sem focus trap, sem `aria-hidden`. Fora do tutorial nada muda.
- Popover com modal aberto passa a fixar no canto **inferior esquerdo** (antes superior direito) — no topo-direito ele cobria exatamente os botões Receber/Quitar/PDF que o tour ensina.
- Mobile: slider com `max-h-[52dvh]`, corpo rolável e `safe-area-inset-bottom` — o modal real no mobile é um Drawer alto e o slider não pode comer a tela.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). **Sem verificação em browser** — AGENTS §3.4 proíbe teste de browser/Playwright neste repo; validação de runtime é do usuário.
**Armadilhas:** qualquer UI de onboarding renderizada fora de um modal PRECISA de `pointer-events-auto`, senão fica inerte enquanto um `Dialog`/`Drawer` estiver aberto. Não basta z-index.

## [2026-07-23] Onboarding Crediário — fix: modal fechava ao interagir com o tour

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Corrigir bugs relatados (ui-review): abrir o modal "abria algo por baixo" e não avançava; ao interagir, o modal fechava (devia ficar aberto). Melhorar o mobile.
**Arquivos alterados:** `src/components/ui/dialog.tsx` (prop `dismissible` → vaul), `PainelCrediario.tsx` (modal demo: `dismissible={false}`, `onInteractOutside`/`onEscapeKeyDown` preventDefault, X oculto), `Progress.md`.
**Root cause:** o modal real é Radix Dialog (desktop) / Drawer vaul (mobile). Ambos fecham em "interação externa" — clicar no popover/sheet do tour (que fica fora do modal) disparava o fechamento, quebrando os passos `modal-*` (alvo sumia → "não avança"/"div incorreta").
**O que foi feito:**
- Enquanto a conta é a de exemplo (`CONTA_DEMO_ID`), o modal só é controlado pelo tour: `preventDefault` em interação externa/ESC (desktop) + `dismissible={false}` (mobile vaul) + botão X do header oculto.
- O modal aberto é detectado como dialog (via `role="dialog"`, nas duas superfícies) → o tour esconde o spotlight e fixa o popover no canto: **modal real 100% visível** enquanto ensina (sem "abrir por baixo").
- Mobile: modal = Drawer vaul (bottom, botões no topo); sheet do tour no rodapé não cobre os botões; sem fechar por arraste durante o tutorial.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). Lint não executável no repo (pré-existente).
**Pendências:** smoke no browser (desktop + mobile): abrir a conta demo pelo tour, avançar por todos os passos do modal sem ele fechar, quitar (vira Quitado), PDF/toast, concluir (modal fecha e conta some).
**Armadilhas:** `ui/dialog.tsx` é responsivo — no mobile é **Drawer vaul**, não Radix. Prevenir fechamento exige `dismissible` (vaul) + `onInteractOutside`/`onEscapeKeyDown` (Radix). Não marcar o modal como `data-onboarding-ui` (deixá-lo ser "foreign" é o que faz o tour sair da frente e mostrar o modal inteiro).

## [2026-07-23] Onboarding Crediário — REUSAR o modal real (remoção do paralelo)

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Correção pedida pelo usuário: o tutorial criava um modal paralelo — proibido. Deve reusar o MODAL REAL do Crediário (AGENTS §5). Também: sem auto-start; corrigir linha branca do Sheet.
**Arquivos alterados:**
- Removidos: `demo/CrediarioDemoRow.tsx`, `demo/CrediarioDemoModal.tsx` (UI paralela).
- `demo/crediario-demo-store.ts` (conta + consumos + flag `modalAberto`), `demo/CrediarioDemoBridge.tsx`, `config/crediario.ts` (10 etapas, `autoStart:false`, alvos do modal real), `index.ts`, `components/onboarding-root.tsx`, `components/help-panel.tsx` (`border-0`).
- `PainelCrediario.tsx`: injeta a conta demo em `contasFiltradas`; `contaSelecionada`/`contaPagamento`/efeito de movimentos reconhecem `CONTA_DEMO_ID`; efeito sincroniza `modalAberto`→abre/fecha o **modal real**; guardas em quitar/pagamento/PDF/cancelar/apagar (nada no banco); âncoras `data-onboarding` condicionais na linha, no ⋯ e nos botões do modal.
**O que foi feito:**
- A conta de exemplo agora é uma linha real no topo da lista; clicar abre o **modal real** da tela. O tour ensina dentro dele: visão (saldo/pedidos/pagamentos), Receber, Quitar (vira Quitado/R$0 na hora) e PDF — tudo simulado, **zero Supabase**.
- Etapa nova "menu ⋯" (dropdown) antes de abrir o modal.
- `autoStart:false` (só abre pelo botão Ajuda). Linha branca do Sheet corrigida (`border-0`).
**Decisões:** conta demo mapeada para `ContaCrediario`/`MovimentoCrediario` dentro do PainelCrediario (tipos moram lá); ciclo de vida do modal via flag `modalAberto` na store + efeito no painel (o engine segue genérico).
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). Lint não executável no repo (pré-existente).
**Pendências:** smoke no browser — abrir a conta demo, quitar (Quitado/R$0), PDF/toast, e **confirmar que nenhuma linha é gravada em `crediario_contas`/`crediario_movimentos`** (via Management API, contar linhas `origem='tutorial'` = 0).
**Armadilhas:** linha 765 do PainelCrediario zera a seleção se a conta não estiver em `contasFiltradas` — por isso a conta demo é injetada lá (sempre no topo, mesmo quitada). NÃO reintroduzir modal paralelo (proibido pelo usuário / AGENTS §5).

## [2026-07-23] Onboarding Crediário — modal responsivo no mobile

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Corrigir colisão no mobile — o modal de exemplo (centralizado) se sobrepunha ao slider inferior do tour.
**Arquivos alterados:** `demo/CrediarioDemoModal.tsx`, `config/crediario.ts`, `Progress.md`.
**O que foi feito:**
- Modal de demo agora é **responsivo**: no mobile ancora no TOPO (`inset-x-3 top-3 max-h-[56vh]`) com layout header (shrink-0) / corpo rolável (`overflow-y-auto`) / rodapé fixo com 3 botões em grid — deixa a metade de baixo livre para o slider do tutorial. No desktop segue centralizado.
- Rodapé compacto (ícone + rótulo curto, 3 colunas) para caber sem rolar no mobile.
- Etapa "abrir" passa a destacar o **card inteiro** (`data-onboarding="demo-card"`, placement bottom) em vez do botão pequeno — mais claro no toque.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros).
**Armadilhas:** z-index mantido (modal 9985 < spotlight 9990 < slider 9995). No mobile, modal ocupa topo (~56vh) e slider ocupa base — não se sobrepõem.

## [2026-07-23] Onboarding Crediário — modal interativo + ajustes de UX

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Tornar a conta de exemplo clicável e ensinar DENTRO do modal (abrir, registrar pagamento, quitar, gerar PDF) e pelo menu ⋯; desligar auto-start; remover a linha branca do Sheet.
**Arquivos alterados:**
- Novos: `src/features/onboarding/demo/{CrediarioDemoRow,CrediarioDemoModal}.tsx`.
- Reescritos: `demo/crediario-demo-store.ts` (agora com consumos + estado do modal + pagamento/quitação), `demo/CrediarioDemoBridge.tsx` (abre modal nas etapas `modal-*`), `config/crediario.ts` (10 etapas + `autoStart:false`), `index.ts` (exporta `CrediarioDemoRow`).
- Tocados: `components/onboarding-root.tsx` (monta `CrediarioDemoModal`), `components/help-panel.tsx` (`border-0` → some a linha branca), `PainelCrediario.tsx` (bloco inline da demo → `<CrediarioDemoRow />`), `UI.md`.
**O que foi feito:**
- Conta de exemplo virou **card clicável** (mobile e desktop) com botão "Abrir" e menu ⋯ (ver detalhes / registrar pagamento / quitar).
- **Modal de demonstração client-side** espelhando o real: consumos item a item, saldo, e botões Registrar pagamento / Quitar tudo / Gerar PDF — todos simulados (toast/store), **zero Supabase**. Fica em z abaixo do spotlight, então os destaques do tour recortam os botões dentro do modal.
- Tour ensina o ciclo dentro do modal (`modal-visao` → `modal-pagamento` → `modal-quitar` → `modal-pdf`) e depois o atalho pelo ⋯.
- **Auto-start desligado**: o tutorial só abre pelo botão Ajuda.
- Linha branca do Sheet corrigida (`border-0` via twMerge sobrepõe o `border-l` da variante `side=right`).
**Decisões:** modal de demo é um `motion.div` próprio (não Radix Dialog) para não brigar com focus-trap nem com o `useForeignDialog`; wrap `data-onboarding-ui` para não ser tratado como modal alheio.
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). Lint segue não executável no repo (sem config ESLint / `next lint` quebrado — pré-existente).
**Pendências:** smoke no browser (abrir card → modal → quitar vira Quitado/R$0 → PDF/toast → menu ⋯; mobile Sheet; verificar que nada é gravado no banco).
**Armadilhas:** o bridge abre/fecha o modal por `stepId`; z-index: modal 9985 < spotlight 9990 < popover 9995 (ordem necessária para o recorte funcionar sobre o modal).

## [2026-07-23] Onboarding interativo (aulas dos módulos) — Crediário

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** Replicar o onboarding do Juridiq (sem vídeos, sem "IA faz por você"): central de Ajuda com catálogo de módulos + tour guiado com spotlight; 1º módulo completo = Crediário.
**Arquivos alterados:**
- Novos: `src/features/onboarding/` — `types.ts`, `storage.ts`, `progress.ts`, `registry.ts`, `context.tsx`, `index.ts`; `engine/{dom,route-match,element-tracker,positioning,use-foreign-dialog,demo-runner}.ts`; `components/{spotlight,tour-popover,tour-mobile-sheet,step-content,tour-renderer,help-button,help-panel,module-catalog,onboarding-root}.tsx`; `demo/{crediario-demo-store.ts,CrediarioDemoBridge.tsx}`; `config/{index,crediario}.ts`.
- Tocados: `src/app/admin/layout.tsx` (monta `OnboardingProvider` + `OnboardingRoot`); `src/features/crediario/components/PainelCrediario.tsx` (âncoras `data-onboarding` + linha da conta demo no topo); `AGENTS.md` (§0.2.5 regra do dado demo), `UI.md` (§Onboarding), `Progress.md`.
**O que foi feito:**
- Engine config-driven: spotlight com **overlay escuro + recorte** (SVG mask, `pointer-events:none` → tela clicável) e anel pulsante; popover que se reposiciona (desktop) e slider inferior (mobile, `useIsMobile`); continuidade entre rotas + auto-start na 1ª visita.
- Central **Ajuda**: pílula flutuante → `Sheet` (lateral desktop / inferior mobile) com "Ver tutorial desta tela", "Ver todos os treinamentos" (catálogo por grupo da sidebar via `GRUPOS_MENU_ADMIN`, status Concluído/Continuar/Iniciar/Em breve) e card de progresso.
- Progresso em **localStorage por usuário** (`useAdminAuth().usuarioAtual?.id`); sem tabela nova (sem migração coordenada).
- **Dado de demonstração 100% client-side** (regra registrada): store externa injeta uma conta de crediário FALSA como alvo da div interativa; `CrediarioDemoBridge` cria ao iniciar, marca "Quitado" na etapa e remove ao encerrar. **Zero escrita no Supabase.**
- Tour Crediário: problema → benefício → onde se cria (Pedidos/Fiado) → analisar conta a conta → buscar → filtrar → quitar → próximo passo.
**Decisões tomadas (confirmadas pelo usuário):** localStorage (não tabela); dado falso client-side (não grava banco); spotlight COM overlay/recorte; sem feature de IA. Sem deps novas. `demo-runner` (cursor) mantido para "Ver na prática".
**Verificação:** `npx tsc --noEmit` ✓ (0 erros). `npm run lint`: **não executável no repo** — não há config ESLint e `next lint` está quebrado no Next 16 (falha pré-existente, ver entradas anteriores); não é efeito desta mudança.
**Pendências / próximos passos:** smoke no browser (abrir `/admin/crediario`, iniciar tour, ver a conta demo, quitar, concluir, checar remoção; testar mobile Sheet e o painel Ajuda). Criar `config/*` dos demais módulos (hoje "Em breve" no catálogo).
**Armadilhas descobertas:**
- Repo **sem ESLint config**; verificação real é só `tsc --noEmit`.
- Estilo do repo: **sem ponto e vírgula**, aspas simples, `@/` alias (Juridiq original usa `;` — não copiar).
- A conta demo é renderizada **acima** do bloco loading/vazio do PainelCrediario para aparecer mesmo sem dados reais; alvo `data-onboarding="conta-demo"`.
- Etapa "onde se cria" mira `a[href="/admin/pedidos/novo"]` com `skipIfMissing` (no mobile a sidebar é Drawer fechado → a etapa pula sozinha).

## [2026-07-23] Garçons — accordion + troca de ícones

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Remover UtensilsCrossed/Package ruins; lista mobile em accordion com Ver pedidos; ícones de canal melhores (Lucide).  
**Arquivos alterados:** `ListaGarcons.tsx`, `PedidosCriadosGarcom.tsx`, `UI.md`, `Progress.md`  
**O que foi feito:** Accordion com `AvatarUsuario` + métricas + CTA Ver pedidos; pedidos usam `Bike` / `ShoppingBag` / `UserRound` (sem Package/Store/Truck genéricos).  
**Verificação:** `npx tsc --noEmit` ✓  

## [2026-07-23] Garçons — dia 3h, vendas e UI densa

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Corrigir criados/editados/hoje (query usava meia-noite); mostrar vendas do dia; valor total na tela de pedidos; UI densa Juridiq.  
**Arquivos alterados:** `src/lib/dia-operacional.ts`, `PainelGarcons.tsx`, `ListaGarcons.tsx`, `tipos.ts`, `PedidosCriadosGarcom.tsx`, `UI.md`, `Progress.md`  
**O que foi feito:**
- `obterIntervaloDiaOperacionalAtual` em America/Sao_Paulo com corte **03:00→03:00** (antes Painel usava 00:00 e zerava métricas).
- Métricas: criados/editados do dia + **vendas R$** + ticket; header com vendas da equipe.
- Lista: ordenação vendas/pedidos/nome; mobile em linhas densas (barra + UtensilsCrossed).
- Pedidos do garçom: default `hoje`; KPI **Vendas** = soma do filtro (exclui cancelado/aguardando), não da página; cards mobile densos por canal.
**Verificação Management API:** meia-noite=0 vs corte 3h=44 pedidos com `garcom_id`; Dilma 21/R$409, Luciane 13/R$339, Bom Parto 9/R$123.  
**Verificação:** `npx tsc --noEmit` ✓  
**Armadilhas:** análise diária usa corte **10h**; garçons/salão usam **3h** via `dia-operacional.ts` — não misturar.

## [2026-07-23] Análise Diária — correção UI (anti cards) + audit queries

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Remover grid de metric cards (viola UI.md/Juridiq); KPIs inline Crediário; melhorar ranking de produtos; auditar schema/queries.  
**Arquivos alterados:** `FaixaKpiAnalise`, `page.tsx`, relatórios (canais/produtos/pagamentos/bairros/equipe/cancelamentos/taxas/fiado), `useAnaliseDiaria`, `processadores`, `types`, `UI.md`, `Progress.md`  
**O que foi feito:**
- KPIs voltam à faixa inline no header (4 métricas: faturamento/pedidos/ticket/entregas) — sem cards com ícone.
- Produtos: tabela densa com pedidos distintos, % receita e barra de participação; aberto por default.
- Canais/listas: `divide-y` em vez de mini-cards.
- Pagamentos: payload por `pedido_id` do dia (não `pagamentos_pedido.created_at`).
- Management API (`edienai` / `bawysvqqeqwxasmggfcn`): colunas `garcom_id`, `crediario_movimentos.tipo/status/origem/valor` confirmadas; fiado `consumo+ativo+origem=pedido` coerente.
**Verificação:** `npx tsc --noEmit` ✓  
**Armadilhas:** UI.md §admin mobile: “Evitar grid de metric cards”; §anti-padrões: não empilhar cards por métrica.

## [2026-07-23] Renovação Análise Diária (Juridiq)

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Tela `/admin/analise-diaria` densa e útil, visual Juridiq, seletor de data sem clipping, relatórios em accordion.  
**Arquivos alterados:** `src/app/admin/analise-diaria/page.tsx`, `src/features/analise-diaria/**`, `UI.md`, `Progress.md`  
**O que foi feito:**
- Extraído `useAnaliseDiaria` + tipos/processadores (queries enriquecidas: cancelados, comparativo −1/−7d, taxas, `garcom_id`, fiado).
- `SeletorDiaOperacional` com Popover + grade mensal (`date-fns`); header sem `overflow-hidden`.
- `FaixaKpiAnalise` (ícones Lucide) + `SecaoRelatorio` accordion local (defaults: canais + pagamentos abertos).
- Relatórios refinados + novos: cancelamentos, comparativo, taxas entrega, equipe/PDV, fiado do dia.
**Decisões:** sem deps novas; sem tocar Finanças/Caixa; accordion sem Radix Accordion; calendário sem `react-day-picker`.  
**Verificação:** `npx tsc --noEmit` ✓ · `npm run lint` falha pré-existente (`next lint` → diretório `lint` inválido)  
**Pendências:** smoke no browser (Popover, trocar dia, accordions, dia operacional pré-10h).  
**Armadilhas:** seleção de data no calendário deve fixar 12:00 (não usar `obterDiaTrabalhoReferencia` em meia-noite — desloca o dia).

## [2026-07-20] Fix Suspense useSearchParams /admin/pedidos

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Corrigir build Vercel: `useSearchParams()` sem Suspense em `/admin/pedidos`.  
**Arquivos alterados:** `src/app/admin/pedidos/page.tsx`, `Progress.md`  
**O que foi feito:** `PedidosContent` com deep-link `?pedido=` envolvido em `<Suspense>` (mesmo padrão de `/admin/pedidos/novo`).  
**Verificação:** `npx tsc --noEmit` ✓  

## [2026-07-20] Crediário → Pedidos deep-link

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Do modal de Crediário, abrir o pedido em `/admin/pedidos` com ModalDetalhesPedido; edição via fluxo existente (refletir no crediário).  
**Arquivos alterados:** `src/features/crediario/components/PainelCrediario.tsx`, `src/app/admin/pedidos/page.tsx`, `Progress.md`, `UI.md`  
**O que foi feito:**
- Botão “Abrir pedido” em consumos com `pedido_id` → `/admin/pedidos?pedido=<uuid>` (fecha modal da conta).
- Consumo sem vínculo: botão desabilitado (legado/migração).
- Pedidos lê `?pedido=`, abre `ModalDetalhesPedido` e limpa a URL com `replace`.
**Decisões:** sem DDL; sync permanece em triggers/RPC + realtime existentes.  
**Verificação:** `npx tsc --noEmit` ✓  
**Pendências:** smoke browser; dump Management API completo se houver token do projeto Edienai.  
**Armadilhas:** ~781 consumos sem `pedido_id` não abrem pedido.

## [2026-07-20] Usuários Cliente UI Juridiq + modal 2 colunas

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Polir tela de usuários cliente (não sistema) e modal de detalhes no padrão Crediário (2 colunas); WhatsApp com ícone real.  
**Arquivos alterados:** `src/components/admin/GerenciadorUsuariosClientes.tsx`, `src/app/admin/usuarios/page.tsx`, `Progress.md`, `UI.md`  
**O que foi feito:**
- Lista: faixa de resumo, busca + pills, tabela/cards Juridiq, `MenuAcoes`, paginação 15.
- Modal detalhes: Dialog full-height `p-0`, grid 2 colunas (`lg:grid-cols-[minmax(0,1fr)_1px_26rem]`) — histórico à esquerda, contato/resumo à direita.
- WhatsApp: `IconeWhatsApp` (verde `#25D366`) no menu, header do modal e CTA lateral.
- Shell `/admin/usuarios`: header Juridiq + tabs sem padding duplicado; aba sistema intocada.
**Decisões:** só clientes no escopo; sistema permanece como estava.  
**Verificação:** `npx tsc --noEmit` ✓  
**Pendências:** smoke no browser (lista, detalhes desktop 2 cols, WhatsApp, editar).  
**Armadilhas:** nenhuma.

## [2026-07-20] Caixa operacional + extrato Juridiq

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Caixa como gaveta do dia (A) + extrato leve estilo Crediário; Finanças intocada.  
**Arquivos alterados:** `scripts/20260720_caixa_operacional_gaveta.sql`, `src/lib/caixa-gaveta.ts`, `src/lib/tipos-caixa.ts`, `src/lib/useCaixa.ts`, `src/app/admin/caixa/page.tsx`, modais em `src/components/admin/caixa/`, `Progress.md`, `UI.md`, `PRD.md`  
**O que foi feito:**
- SQL (Management API): categorias Sangria/Suprimento; `caixas.fechamento_formas jsonb`; índice `(caixa_id, created_at DESC)`.
- Domínio: saldo gaveta = dinheiro; fechamento confere dinheiro contado vs esperado; PIX/cartão informativos; `registrarSangria`/`registrarSuprimento`.
- UI Juridiq: header + tabs Hoje/Pedidos/Extrato; tabela extrato com Wallet/CheckCircle2 (padrão Crediário); Dialogs Abrir/Fechar/Sangria/Suprimento.
**Decisões:** Finanças sem diff; gaveta só Dinheiro.  
**Verificação:** `npx tsc --noEmit` ✓ · índices/categorias via Management API ✓  
**Pendências:** saldos/relatórios satélite sem redesign profundo.  
**Armadilhas:** movimentos sem `caixa_id` (Finanças) não entram no saldo da gaveta.

## [2026-07-20] Painel Kanban: desktop full-width

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Com 3 colunas, desktop deve preencher 100% da largura; mobile permanece snap horizontal.  
**Arquivos alterados:** `ColunaKanban.tsx`, `painel/page.tsx`, `CardPedidoKanban.tsx`, `UI.md`, `Progress.md`  
**O que foi feito:**
- Coluna: mobile `w-[min(88vw,320px)] shrink-0 snap`; `md+` → `flex-1 min-w-0` sem snap.
- Board: `md:overflow-x-hidden md:snap-none w-full`.
- Cards/coluna com espaçamento um pouco maior no desktop; pills mobile usam `tituloCurto`.
**Verificação:** `npx tsc --noEmit` ✓  
**Pendências:** nenhuma  
**Armadilhas:** nenhuma

## [2026-07-20] Painel Kanban estilo Juridiq (mobile-first)

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Alinhar `/admin/painel` ao kanban de Tarefas da Juridiq — board horizontal, cards densos e UX mobile.  
**Arquivos alterados:** `src/app/admin/painel/page.tsx`, `src/components/admin/painel/ColunaKanban.tsx`, `src/components/admin/painel/CardPedidoKanban.tsx`, `Progress.md`, `UI.md`  
**O que foi feito:**
- Board: `grid-cols-1` (empilhava 3 colunas no mobile) → scroll horizontal `snap-x` com colunas fixas ~320–350px (padrão Juridiq `w-[350px]`).
- Mobile: pills sticky de coluna + IntersectionObserver para destacar a coluna visível; `Mover →` no menu (alternativa ao drag).
- Cards: densos (`p-2.5`, borda-l por canal), `MenuAcoes` (imprimir/editar/mover/excluir), CTA único de avanço de status `h-9`.
- Coluna: badge colorido + contador circular; drop highlight com primary.
**Decisões:** sem `@hello-pangea/dnd` (deps novas proibidas); mantido DnD nativo + touch ghost.  
**Verificação:** `npx tsc --noEmit` ✓ · ReadLints ✓  
**Pendências / próximos passos:** densidade card/linha opcional se pedido.  
**Armadilhas:** overflow-x deve ficar no board interno (html/body bloqueiam overflow global).

## [2026-07-20] Corrigir métricas Criados/Editados/Total em Garçons


**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Corrigir queries de Criados hoje, Editados hoje e Total pedidos no painel de garçons, alinhadas ao schema real via Management API.  
**Arquivos alterados:** `src/components/admin/garcons/PainelGarcons.tsx`, `src/app/admin/pdv/page.tsx`, `Progress.md`  
**O que foi feito:**
- Causa: CHECK em `atividade_garcom.tipo_acao` só aceita `pedido_criado|pedido_modificado|item_adicionado|status_alterado`; PDV inseria `pdv_pedido` (falha silenciosa) → Dilma/Bom Parto com pedidos em `pedidos.garcom_id` e zero atividade.
- UI contava “Criados” só em `atividade_garcom` e “Total” em `pedidos` → inconsistente.
- **Criados hoje / Total** passam a vir de `pedidos` filtrado por `garcom_id` (janela “hoje” em America/Sao_Paulo).
- **Editados** = `atividade_garcom` com `pedido_modificado`, contagem distinta por `pedido_id`.
- PDV registra `tipo_acao: 'pedido_criado'` + `dados_extra.origem: 'pdv'`.
**Decisões:** Fonte canônica de criação = `pedidos.garcom_id` (cobre histórico PDV sem atividade); edição continua em atividade.  
**Verificação:** Management API ✓ (Dilma 13/0/433 hoje) · `npx tsc --noEmit` ✓  
**Pendências / próximos passos:** histórico de atividade PDV antigo não existe (métricas de criação já cobertas por `pedidos`).  
**Armadilhas descobertas:** não inventar `tipo_acao` fora do CHECK; meia-noite local do browser ≠ dia Brasília.

## [2026-07-20] Polish UI admin Adicionais (Juridiq)

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Alinhar `/admin/adicionais` ao padrão visual Juridiq (header tipo bairros), sem mudar lógica.  
**Arquivos alterados:** `src/app/admin/adicionais/page.tsx`, `Progress.md`, `UI.md`  
**O que foi feito:**
- Shell `max-w-6xl space-y-5` + header card com `ListPlus` primary, contagem, Atualizar outline + Novo primary.
- Busca client por nome acima dos `FiltroChip`; empty via `@/components/ui/empty`.
- Lista mais densa, `min-w-0`/stack mobile; ações secundárias em `MenuAcoes` (vincular, crop, remover imagem, excluir).
- Loading com spinner `text-primary`; CTAs de dialogs com tokens primary (checkbox selecionado).
**Decisões:** Upload de foto permanece inline (ação frequente); crop/delete imagem no menu.  
**Verificação:** `npx tsc --noEmit` ✓ · lint do arquivo ✓  
**Pendências / próximos passos:** nenhuma  
**Armadilhas:** AdminLayout já tem `p-4 md:p-6` — não duplicar padding na page.

## [2026-07-20] Combos: polish Juridiq/admin

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Polir `/admin/combos` no padrão Juridiq sem reescrever lógica de negócio.  
**Arquivos alterados:** `src/app/admin/combos/page.tsx`, `Progress.md`  
**O que foi feito:**
- Shell `max-w-6xl` + header card (Layers, count, Novo combo / Atualizar).
- Busca client-side por nome (`useMemo`); Empty + EmptyContent CTA.
- Cards densos com tokens (`border-border/70`, preço `text-primary`, hover `border-primary/40`); status via Badge; ações via `MenuAcoes`.
- Modal custom (framer-motion) → Dialog shadcn (drawer no mobile); Input/Label/Textarea/Checkbox; toasts sonner no lugar do modal de notificação.
**Verificação:** `npx tsc --noEmit` ✓ (zero erros em combos/page) · ReadLints ✓  
**Pendências / próximos passos:** nenhum  
**Armadilhas descobertas:** Dialog do projeto já é responsive (drawer no mobile); não recriar overlay fixed.

## [2026-07-20] Sidebar mobile: Mais abre inline (Vaul)

**Agente/Modelo:** Cursor Grok 4.5  
**Objetivo:** Dropdown/Popover "Mais" da sidebar admin abrir no drawer mobile.  
**Arquivos alterados:** `src/components/admin/AdminLayout.tsx`, `Progress.md`  
**O que foi feito:**
- Causa: Popover portaliza para `body` fora do Vaul Drawer → overlay/trap impede uso.
- Mobile: lista "Mais" expansível inline (sem portal); fecha drawer ao navegar.
- Desktop: Popover mantido com `modal={false}`.
**Verificação:** `npx tsc --noEmit` ✓ · eslint AdminLayout  
**Armadilhas:** Popover/Dropdown portaled dentro de Vaul Drawer não funciona — expandir inline ou portal com container do drawer.

## [2026-07-20] Migration financas_diarias aplicada

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Criar tabela `financas_diarias` + categoria Diária no projeto `bawysvqqeqwxasmggfcn`.
**Arquivos alterados:** nenhum de código (só SQL remoto) · `Progress.md`
**O que foi feito:** Management API executou `scripts/migrations/20260720_financas_diarias.sql`. Verify: tabela existe, 0 rows, categoria Diária ok; PostgREST 200.
**Verificação:** Management API ✓ · PostgREST `financas_diarias` 200 · `categorias_caixa` Diária 200
**Armadilhas:** token Management API não persistir no repo; token curto no env sem privilégio ≠ token válido.

## [2026-07-20] Diárias: CSS FC6 + calendário full-size

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Corrigir 500 (CSS inexistente) e calendário minúsculo em card aninhado.
**Arquivos alterados:** `CalendarioDiarias.tsx`, `PainelDiarias.tsx`, `PainelFinancas.tsx`, `globals.css`, `Progress.md`
**O que foi feito:**
- Removidos imports `@fullcalendar/*/index.css` (v6 injeta CSS via JS; arquivos não existem).
- Calendário sem card interno; altura 560–720px + `expandRows`; células maiores no CSS.
**Verificação:** `npx tsc --noEmit` ✓
**Armadilhas:** Nunca importar CSS de pacotes FC6; estilos vêm de `injectStyles`.

## [2026-07-20] Finanças: Diárias (calendário + despesa)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Aba Diárias no mesmo nível de Lançamentos, calendário FullCalendar, lista e despesa vinculada.
**Arquivos alterados:** `PainelFinancas.tsx`, `PainelDiarias.tsx`, `CalendarioDiarias.tsx`, `ListaDiarias.tsx`, `ModalDiaria.tsx`, `useDiarias.ts`, `types.ts`, `globals.css`, migration SQL, `UI.md`, `PRD.md`, `Progress.md`, `package.json`
**O que foi feito:**
- Toggle Lançamentos | Diárias no card principal (não nas tabs de baixo); Diárias ocupa a tela.
- FullCalendar v6 (mês) + lista; modal Juridiq; detalhe em Dialog; mobile com CTA/toolbar densos.
- Tabela `financas_diarias` + categoria Diária; cada create = saída em `movimentacoes_caixa`.
**Verificação:** `npx tsc --noEmit` ✓ · migration Management API pendente (403 no ambiente; SQL em `scripts/migrations/20260720_financas_diarias.sql`)
**Armadilhas:** deps FullCalendar alinhadas em 6.1.21; CSS importado no componente + tokens em `.calendario-diarias`; Diárias fica no toggle do card principal, não nas tabs Análise/Pagamentos.

## [2026-07-20] Novo pedido barra fixa + sidebar personalizada sem flash

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Confirmar pedido não cobrir o Resumo; sidebar personalizada não “piscar” a ordem padrão ao navegar.
**Arquivos alterados:** `pedidos/novo/page.tsx`, `PainelTicketPedido.tsx`, `AdminLayout.tsx`, `Progress.md`
**O que foi feito:**
- Altura do shell desktop desconta a barra fixa (`100dvh - 104px - 5.5rem`); padding mobile maior; sticky do resumo sem sombra por cima do CTA.
- Config da sidebar em `sessionStorage` + `useLayoutEffect` (AdminLayout remonta a cada página) para pintar já na ordem personalizada; save otimista.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Novo pedido: polish Juridiq (UX + tokens)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Tornar `/admin/pedidos/novo` fácil e consistente com o padrão Juridiq (desktop + mobile), sem mudar regra de negócio.
**Arquivos alterados:** `pedidos/novo/page.tsx`, `PainelCategoriasProduto.tsx`, `PainelTicketPedido.tsx`, `UI.md`, `Progress.md`
**O que foi feito:**
- Cards Cliente / Atendimento / Pagamento em tokens (`border-border/70`); removidos zinc/bordo/blue/purple e o `<select>` duplicado de tipo.
- Chip-resumo de atendimento + Trocar; stepper com label dinâmico; `carregarMesas` ao entrar na etapa Local.
- Catálogo 1-toque (padrão PDV) + Personalizar; abas com `focus-visible`.
- Prévia do carrinho na etapa Itens (mobile); resumo sticky no desktop; observação geral no insert.
- Highlight de campos inválidos (`aria-invalid` / ring) ao avançar/salvar.
**Verificação:** `npx tsc --noEmit` ✓ · ReadLints ✓
**Fora de escopo:** PDV, garçom, `GradeProdutosCategoria` morto.
**Armadilhas:** Não reintroduzir um segundo controle de `tipoEntrega` nos dados do cliente.

## [2026-07-20] Sidebar: scroll não reseta ao navegar

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Ao clicar item baixo da sidebar, o menu não deve “pular” pro topo.
**Arquivos alterados:** `AdminLayout.tsx`, `Progress.md`, `UI.md`
**O que foi feito:**
- Causa: `SidebarContent` era componente definido *dentro* do layout → identidade muda a cada render/pathname → React remonta o `<nav>` e zera o scroll.
- Troca para `renderSidebarContent(...)` (função de render, não componente).
- Backup: `sidebarNavRef` + `sidebarScrollTopRef` + `useLayoutEffect` restauram o scroll no desktop após troca de rota.
**Verificação:** `npx tsc --noEmit` ✓
**Armadilhas:** Não definir componentes React dentro de outro componente se o DOM interno precisa preservar estado (scroll, focus, inputs).

## [2026-07-20] Bairros: coluna entrega_gratis + toggle

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Corrigir PGRST204 e toggle “Grátis” invertido/desalinhado.
**Arquivos alterados:** `bairros/page.tsx`, `scripts/migrations/20260720_bairros_entrega_gratis.sql`, `Progress.md`
**O que foi feito:**
- Coluna `bairros.entrega_gratis boolean not null default false` criada via Management API (`bawysvqqeqwxasmggfcn`).
- Toggle refeito com `justify-start`/`justify-end` (sem `translate` absoluto); linha com `items-center`.
- Load normaliza `entrega_gratis`/`ativo` com `Boolean`.
**Verificação:** schema confirmado na API; `npx tsc --noEmit` ✓

## [2026-07-20] Produtos/Bairros/Mesas: tokens + ícones catálogo

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Corrigir cores antigas (Button bordo/zinc), polish Juridiq em Bairros e Mesas, ícones Produtos/Combos.
**Arquivos alterados:** `ui/button.tsx`, `admin-sidebar-routes.ts`, `bairros/page.tsx`, `mesas/page.tsx`, `combos/page.tsx`, `UI.md`, `Progress.md`
**O que foi feito:**
- `Button` → `primary` / `outline` com `border-border/70` / `destructive` (corrige modais e botões de Produtos e do admin inteiro).
- Sidebar: Produtos `CookingPot`, Combos `Layers`.
- Bairros reescrito com tokens, cards/header Juridiq, desktop tabela + ações densas no mobile.
- Mesas: zinc/amber → tokens semânticos (mantém HTML de impressão).
- Combos: limpeza bordo/zinc residual.
**Verificação:** `npx tsc --noEmit` ✓
**Ainda com zinc/bordo (fora deste escopo):** vários componentes em `anos-anteriores/`, caixa, cupons, etc.

## [2026-07-20] PDV: visual Juridiq (Geist + tokens)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Tirar o PDV do visual “quadradão” com hex/JetBrains e alinhar à composição do admin/Juridiq.
**Arquivos alterados:** `src/app/admin/pdv/page.tsx`, `UI.md`, `Progress.md`
**O que foi feito:**
- Removidos JetBrains Mono e `pdvLightVars` (forçava tema claro e primary próprio).
- Hex (`#0f5bd8`, `#f7fbff`, etc.) → tokens (`primary`, `background`, `card`, `muted-foreground`, `destructive`, `border/70`).
- Tabs, cards de produto, header e superfícies com radius/hover mais leves; preços em `font-mono tabular-nums`.
**Verificação:** `npx tsc --noEmit` ✓
**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Melhorar a sidebar fechada no padrão Juridiq.
**Arquivos alterados:** `AdminLayout.tsx`, `UI.md`, `Progress.md`
**O que foi feito:**
- Largura colapsada 64→112px (próximo aos 114px do Juridiq); aberta permanece 224px.
- Largura/margin via `--largura-sidebar-admin`.
- Ícones centralizados; ativo com barra absoluta + `bg-primary/10` (sem deslocar o ícone).
- Grupos com abreviação + divisores; rodapé com avatar + botões `size-10`; tooltips; sombra leve.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Sidebar: ícones distintos (usuários, crediário, finanças)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Eliminar ícones repetidos na sidebar e diferenciar pessoas (funcionários / usuários / garçons).
**Arquivos alterados:** `admin-sidebar-routes.ts`, `AdminLayout.tsx`, `usuarios/page.tsx`, `Progress.md`, `UI.md`
**O que foi feito:**
- Crediário → `Coins`; Finanças → `Landmark`; Caixa permanece `Wallet`.
- Usuários → `UserCog`; Funcionários → `Contact`; Garçons permanece `UtensilsCrossed`.
- Produtos → `Package`; Adicionais → `ListPlus` (deixam de colidir com PDV / Novo pedido).
- Atalho Alt+U e header da página Usuários alinhados ao `UserCog`.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] CardPedido visual Juridiq / restaurante

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Melhorar hierarquia e limpeza visual do card de pedidos.
**Arquivos alterados:** `CardPedido.tsx`, `Progress.md`
**O que foi feito:** Header (cliente + status); canal com ícone; itens em bloco; total destacado; ações críticas em botões; secundárias no `MenuAcoes`; barra lateral por tipo; sem min-heights forçados; badges semânticos.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Dashboard: cards ricos + loja com toggles

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Corrigir Dashboard minimalista demais — pedidos operacionais e loja com toggles de restaurante.
**Arquivos alterados:** `ControleStatusLoja.tsx`, `dashboard/page.tsx`, `Progress.md`
**O que foi feito:**
- Pedidos recentes de volta com `CardPedido` em grade (status, ações, WhatsApp, etc.).
- Loja: Abrir/Fechar destacado; toggle de horário automático; grade dos 7 dias; +30 min; Dialog de edição.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Dashboard Juridiq + jogo no WhatsApp

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Limpar Dashboard (KPI faixa, loja compacta, pedidos densos); mover aviso de jogo para WhatsApp.
**Arquivos alterados:** `dashboard/page.tsx`, `ControleStatusLoja.tsx`, `AvisoJogoBot.tsx`, `whatsapp/page.tsx`, `UI.md`, `Progress.md`
**O que foi feito:**
- Removido `AvisoJogoBot` do Dashboard; aba **Jogo** em `/admin/whatsapp`.
- KPI em faixa (sem grid de 4 cards); Skeleton no loading.
- `ControleStatusLoja` compacto: status + ações; horários em Dialog; confirmação em AlertDialog.
- Pedidos recentes: tabela `md+` / `CardPedido` no mobile; link Ver todos.
**Verificação:** `npx tsc --noEmit` ✓
**Próximos (mapa):** Painel, Caixa, Mesas, Combos/Adicionais/Cupons/Bairros, Novo pedido.

## [2026-07-20] Sidebar: migration + rename + mobile/UI

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Aplicar `admin_sidebar_config` no Supabase; renomear categorias; fechar menu mobile ao personalizar; UI-review do modal/sidebar.
**Arquivos alterados:** `SidebarPersonalizarModal.tsx`, `AdminLayout.tsx`, `UI.md`, `Progress.md` (+ SQL aplicado via Management API no projeto `bawysvqqeqwxasmggfcn`)
**O que foi feito:**
- Migration aplicada e tabela confirmada.
- Modal: renomear grupos (lápis), targets ≥44px no mobile, focus-visible, descrição atualizada.
- `handleAbrirPersonalizar` fecha Drawer + popover Mais antes de abrir o modal.
**Verificação:** `npx tsc --noEmit` ✓
**Armadilhas:** token Management API nunca versionar; Dialog responsivo vira Drawer no mobile — por isso fechar a sidebar evita dois drawers.

## [2026-07-20] Correção: período padrão “todos” + logo WhatsApp

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Filtros de pedidos sem período padrão “hoje”; header WhatsApp com marca do WhatsApp.
**Arquivos alterados:** `PeriodoEntrega`/`intervalo-entregas`, `FiltroPedidosAdmin`, `FiltroPedidosGarcom`, `pedidos/page`, `PedidosCriadosGarcom`, `entregas/page` (label), `whatsapp/page`, `Progress.md`
**O que foi feito:** Período `todos` (sem `gte/lt` de data) como padrão e ao limpar, em Pedidos e Garçons; WhatsApp usa `IconeWhatsApp` verde em vez de `/logo.png`.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Task 4 — Personalizar sidebar + DB

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Ocultar/reordenar itens da sidebar com persistência por usuário.
**Arquivos alterados:** `scripts/migrations/20260720_admin_sidebar_config.sql`, `src/app/api/admin/sidebar-config/route.ts`, `src/lib/admin-sidebar-routes.ts`, `src/components/admin/SidebarPersonalizarModal.tsx`, `AdminLayout.tsx`, `UI.md`, `Progress.md`
**O que foi feito:** Tabela `admin_sidebar_config` (SQL para aplicar no Supabase); API GET/PUT/DELETE com service role; modal drag + Eye/EyeOff + Restaurar; wire no AdminLayout com menu **Mais** para ocultos.
**Verificação:** `npx tsc --noEmit` ✓
**Pendências:** aplicar `scripts/migrations/20260720_admin_sidebar_config.sql` no Supabase antes de usar em produção.
**Armadilhas:** auth da API usa `usuarioId` da sessão localStorage (dívida conhecida); sem `@radix-ui/react-switch` — toggle Eye/EyeOff.

## [2026-07-20] Task 3 — Sidebar visual Juridiq

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Alinhar visual da sidebar ao Juridiq (logo, ativo primary, grupos, scroll).
**Arquivos alterados:** `AdminLayout.tsx`, `UI.md`, `Progress.md`
**O que foi feito:** Logo + marca; item ativo `border-l-primary` / `bg-primary/10`; títulos de grupo discretos; nav `min-h-0 flex-1`; footer com `AvatarUsuario`; colapso localStorage mantido.
**Verificação:** `npx tsc --noEmit` ✓

## [2026-07-20] Task 2 — AvatarUsuario Juridiq

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Unificar avatares do admin/login no estilo Juridiq.
**Arquivos alterados:** `src/components/ui/avatar.tsx`, `src/components/admin/AvatarUsuario.tsx`, `GerenciadorUsuariosSistema.tsx`, `ListaGarcons.tsx`, `PedidosCriadosGarcom.tsx`, `AdminLayout.tsx`, `CardPerfilUsuario.tsx`, `ModalSenhaLogin.tsx`, `TransicaoLogin.tsx`, `UI.md`, `Progress.md`, `package.json` (`@radix-ui/react-avatar`)
**O que foi feito:** Primitivo Radix Avatar + wrapper `AvatarUsuario` (iniciais + cor); call sites de listas, sidebar, header e login passam a usá-lo.
**Verificação:** `npx tsc --noEmit` ✓
**Armadilhas:** `@radix-ui/react-switch` não existe no projeto — personalizar sidebar usa toggle Eye/EyeOff.

## [2026-07-20] Task 1 — WhatsApp Juridiq + logo

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Redesign `/admin/whatsapp` com logo real e faixa de resumo.
**Arquivos alterados:** `src/app/admin/whatsapp/page.tsx`, `Progress.md`
**O que foi feito:** Header com `/logo.png`; KPI em faixa (status/número/msgs/notificações); tokens semânticos; AlertDialog e botões de admin alinhados ao padrão mobile.
**Verificação:** `npx tsc --noEmit` ✓ (fechamento das 4 tasks)

## [2026-07-20] Pedidos filtros + crop Juridiq + PDV/Usuários/Relatórios

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Enriquecer Filtrar de Pedidos; alinhar modais de recorte ao Juridiq; melhorar PDV (voltar dashboard), Usuários Sistema e Relatórios.
**Arquivos alterados:** `FiltroPedidosAdmin.tsx`, `pedidos/page.tsx`, `ModalRecorteImagem.tsx`, `ModalRecorteAvatar.tsx`, `pdv/page.tsx`, `usuarios/page.tsx`, `GerenciadorUsuariosSistema.tsx`, `relatorios/page.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**
- Pedidos: abas Geral (situação/status/tipo/garçom/canal), Pagamento, Período — query com intervalo + chips.
- Crop produto/avatar: Dialog shadcn, tokens `primary`, footer sticky; sem amber/laranja.
- PDV: botão Painel → `/admin/dashboard`; chips de categoria; remove fullscreen agressivo no pointer/auto.
- Usuários Sistema + Relatórios: polish Juridiq (resumo, tabela/cards, KPI strip, Skeleton) — ver entradas abaixo.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Decisão a revisar:** filtro padrão de Pedidos passou de “ano atual” para “hoje” (como garçom/entregas).

## [2026-07-20] Usuários Sistema: lista Juridiq + select seguro
**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Alinhar página Usuários + GerenciadorUsuariosSistema ao padrão lista Juridiq (Clientes/Funcionários) e não expor senha_hash.
**Arquivos alterados:** `src/app/admin/usuarios/page.tsx`, `src/components/admin/GerenciadorUsuariosSistema.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**
- Header da página: tokens `bg-primary/10 text-primary` / `foreground` / `muted-foreground`; acentos (Usuários, garçom).
- Sistema: faixa de resumo, busca + ToggleGroup de função + `FiltrosAtivosChips`, tabela md+ / cards mobile, `MenuAcoes`.
- Modais criar/editar e senha: `DialogContent` `flex flex-col p-0`, body scroll, footer sticky `h-11` no mobile.
- `select` só colunas seguras (sem `senha_hash`); `ModalRecorteAvatar` mantido.

**Decisões tomadas:** Espelhou `GerenciadorFuncionarios` (resumo + table/cards) + chips de filtro estilo Clientes; cor padrão do avatar `#0296F9` (primary) em vez de laranja.

**Verificação:** typecheck nos arquivos da task ✓ (erros pré-existentes em `ModalRecorteImagem.tsx` fora do escopo) · lint IDE ✓ · browser não testado

**Pendências / próximos passos:** nenhum nesta task

**Armadilhas descobertas:** coluna de login é `nome_usuario`, não `email`.

## [2026-07-20] Relatórios: polish Juridiq (faixa KPI + tokens)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Melhorar UI/UX de `/admin/relatorios` no padrão Juridiq sem reescrever analytics.
**Arquivos alterados:** `src/app/admin/relatorios/page.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Faixa de resumo única (receita, pedidos, ticket, crescimento) no lugar de 4 cards gradiente.
- Loading com `Skeleton` (filtros/header permanecem); pills `CHIP_FILTRO_BOTAO`; `Button` shadcn.
- Tokens semânticos (`primary`, `muted`, `border`, `card`) no lugar de amber/zinc.
- Query de entregas concluídas filtrada pelo período da página (`gte`/`lte` created_at).
- Charts e PDF preservados; cores de gráfico alinhadas ao primary azul.

**Verificação:** `npx tsc --noEmit` sem erros em `relatorios/page.tsx` · `npm run lint` quebrado no Next 16 CLI · browser não testado

**Armadilhas:** Contadores hoje/semana/mês de entregas ainda usam janelas de calendário, mas só sobre pedidos já filtrados pelo período da tela.

## [2026-07-20] Produtos: modal completo + Dialog mobile (footer fixo)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Eliminar edição inline e overflow/overlay dos modais em Produtos (e padrão Dialog no mobile).
**Arquivos alterados:** `dialog.tsx`, `ModalFormularioProduto.tsx`, `produtos/page.tsx`, `ActionDialog.tsx`, `ModalItemPedidoAdmin.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- `Dialog` no mobile (Vaul): remove wrapper que enrolava tudo em `overflow-y-auto` — footer deixa de rolar com o formulário; `DialogFooter` com `mt-auto` + safe-area.
- `ModalFormularioProduto` (criar/editar): header/body/footer, botões `h-11` full-width no mobile, foto/categoria/preço/desconto/disponível/excluir.
- Lista de produtos: cards compactos + botão Editar abre modal (sem expansão inline).
- Ordenação manual: área com `max-height` + scroll interno; “Salvar ordem” sticky.
- Alinhados footers de `ActionDialog` e `ModalItemPedidoAdmin`.

**Verificação:** `npx tsc --noEmit` ✓ · `npm run lint` quebrado no Next 16 CLI (`lint` interpretado como diretório) · browser não testado

**Armadilhas:** Modais longos no mobile precisam de `p-0` + `overflow-hidden` + body `flex-1 overflow-y-auto` + footer separado; senão o footer some no scroll.

## [2026-07-19] FiltroAvancado em Pedidos/Entregas/Produtos/Funcionários + redesign Produtos

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Expandir o padrão Filtrar Juridiq às listas densas; redesenhar o topo/modais de Produtos.
**Arquivos alterados:** `FiltroAvancado.tsx`, `CampoSelectFiltro.tsx`, `FiltroPedidosAdmin.tsx`, `FiltroEntregasAdmin.tsx`, `FiltroProdutosAdmin.tsx`, `FiltroFuncionariosAdmin.tsx`, `pedidos/page.tsx`, `entregas/page.tsx`, `produtos/page.tsx`, `GerenciadorFuncionarios.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Shell reutilizável + `CampoSelectFiltro`; wrappers por domínio (Pedidos, Entregas, Produtos, Funcionários).
- Admin Pedidos / Entregas / Funcionários: busca + Filtrar (sem fileiras de pills / card de período).
- Entregas: período + status (+ entregador na aba Repasse) dentro do Filtrar.
- Produtos: faixa de resumo Juridiq; busca + Filtrar (status/tipo/foto/categoria); ordenação e lista sem caixas de ícone; modal Novo produto alinhado ao Dialog Juridiq.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Pendências:** Cards de produto ainda usam expansão inline (lógica intacta); polish visual fino dos cards pode continuar depois.

## [2026-07-19] Filtro Juridiq (Filtrar + abas) nos pedidos do garçom

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Trocar filtros inline enormes pelo padrão Juridiq (botão Filtrar → popover/sheet com abas laterais) em desktop e mobile.
**Arquivos alterados:** `FiltroAvancado.tsx`, `FiltroPedidosGarcom.tsx`, `PedidosCriadosGarcom.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- `FiltroAvancado` reutilizável: espelha Pessoas do Juridiq — desktop `DropdownMenu` 600×420 com abas laterais; mobile `Sheet` + Limpar/Aplicar; bolinha azul quando há filtro ativo.
- `FiltroPedidosGarcom`: abas Geral (situação/tipo/status), Pagamento, Período (atalhos + datas).
- Barra da lista: só busca + Filtrar; chips ativos abaixo; removidos card de período e fileiras de pills.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

## [2026-07-19] Pedidos do garçom (monitoramento) + fix next/image R2

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Corrigir hostname R2 no Next Image; redesenhar `/admin/garcons/[id]/pedidos` no padrão Juridiq com filtros úteis, paginação e payload leve.
**Arquivos alterados:** `next.config.js`, `PedidosCriadosGarcom.tsx`, `UI.md`, `Progress.md` (também nesta sessão: `PainelGarcons`, `ListaGarcons`, `GerenciadorFuncionarios`, `funcionarios/page.tsx`, `menu-acoes`)

**O que foi feito:**

- `next.config.js`: unificou export — `images.remotePatterns` (R2 + B2) + `allowedDevOrigins` (antes a config de imagens nunca era exportada).
- Pedidos do garçom: removidos grid de metric cards e `CardPedido` na lista; faixa de resumo (período / em aberto / valor da página); `FiltroPeriodoEntregas` (hoje = dia operacional 03h); pills server-side (situação, tipo, pagamento, status) + busca debounced; tabela desktop + cards mobile; `PaginacaoPedidos` default 15.
- Payload: lista não carrega mais `itens_pedido` nem pagamentos parciais (só crediário leve); itens ficam nos modais de detalhe/edição/PDF.
- Ações operacionais preservadas via `MenuAcoes` (detalhes, editar, PDF, impressão, PIX, concluir, salão, fiado, excluir).

**Decisões tomadas:** Monitoramento prioriza filtros no servidor + lista leve; detalhe sob demanda. “Hoje” usa dia operacional (não meia-noite civil).

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado (reiniciar `next dev` para aplicar `next.config.js`)

**Armadilhas:** Filtro “fiado” usa `forma_pagamento ilike %credi%` — pedidos só no crediário via movimento sem forma gravada podem não aparecer.

## [2026-07-19] Redesign Salão + Análise diária (Juridiq)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Redesenhar Salão e Análise diária (desktop/mobile) no padrão Juridiq, sem quebrar fluxos críticos do salão.
**Arquivos alterados:** `CardMesaSalao.tsx`, `PainelSalaoAtual.tsx`, `salao/page.tsx`, `analise-diaria/page.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Salão: header limpo; painel com pills (Todas / Tempo crítico / Sem garçom / Pagamento); `CardMesaSalao` com hierarquia clara + `MenuAcoes`; Empty/Skeleton; ações primárias (pagar/imprimir/fechar) em destaque; lógica/RPC intacta.
- Análise diária: faixa de resumo no header (sem grid de 4 metric cards com ícone); canais em bloco único; gráficos/listas mais limpos; tabela desktop + cards mobile nos produtos; loading skeleton sem tela inteira de spinner; refresh realtime silencioso.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Armadilhas:** No salão, filtros “urgentes” só aplicam a mesas (não a parceiros).

## [2026-07-19] MenuAcoes Juridiq + toasts topo + modais Crediário + fix refetch

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Dropdown reutilizável Juridiq; toasts no topo no mobile + toggle alertas de mesa; modais/card crediário legíveis; fechar modal sem skeleton.
**Arquivos alterados:** `menu-acoes.tsx`, `dropdown-menu.tsx`, `AppToaster.tsx`, `layout.tsx`, `AdminLayout.tsx`, `CardMovimentacaoFinancas.tsx`, `ListaMovimentacoes.tsx`, `CardContaCrediario.tsx`, `PainelCrediario.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- `MenuAcoes` compartilhado (⋯ Juridiq com variantes default/success/destructive) + `dropdown-menu` alinhado (z-index, dark `#161717`).
- Reuso em movimentações e crediário (card + tabela).
- `AppToaster`: mobile `top-center`, desktop `top-right`; estilos mais limpos. Removido `position: bottom-right` forçado nos alertas de mesa.
- Toggle **Alertas de mesa** no menu do usuário (`localStorage admin:alertas-mesa`).
- Crediário: language leiga nos modais (fiado / ainda deve / receber pagamento); card mobile redesenhado; refetch silencioso; canal realtime sem depender de `contaSelecionadaId` (causa do skeleton ao fechar).

**Decisões tomadas:** Toggle de alertas no menu do avatar (lugar global e óbvio). Refresh pós-mutação silencioso para não flashar skeleton.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Armadilhas descobertas:** `useEffect` do canal com `contaSelecionadaId` nas deps remonta o channel e chama `carregarContas()` a cada fechar de modal.

## [2026-07-19] Tabelas Juridiq (15/página) + redesign Crediário

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Tabelas de finanças (e correlatas) no visual Juridiq desktop/mobile com default 15/página; redesenhar Crediário sem amontoado de cards genéricos.
**Arquivos alterados:** `ListaMovimentacoes.tsx`, `CardMovimentacaoFinancas.tsx`, `PaginacaoFinancas.tsx`, `ListaPagamentos.tsx`, `ListaPedidosNaoPagos.tsx`, `ListaCrediarioPendente.tsx`, `PainelCrediario.tsx`, `CardContaCrediario.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Finanças movimentações: tabela desktop Juridiq (borda-l, status centrado, row clicável) + cards mobile; paginação default 15 (opções 15/30/50/100).
- Listas satélite (pagamentos, pedidos não pagos, crediário pendente): mesmo padrão mobile/desktop + Empty/Skeleton + paginação 15.
- Crediário: removido grid de 4 metric cards; faixa de resumo no header; pills ToggleGroup (status/origem); chips ativos; tabela desktop + `CardContaCrediario` mobile; menu ⋯; paginação 15; detalhe do modal sem caixas aninhadas de métricas.

**Decisões tomadas:** Reuso de `PaginacaoFinancas` no crediário (mesmo componente genérico). Lógica/RPC do crediário intacta — só visual.

**Verificação:** `npx tsc --noEmit` ✓ · `npm run lint` falha conhecida (Next resolve `lint` como dir) · browser não testado

**Pendências / próximos passos:** Validar visual no browser (mobile + desktop) em `/admin/financas` e `/admin/crediario`.

**Armadilhas descobertas:** ToggleGroup `type="single"` não desmarca ao reclicar — limpar via chips “Limpar tudo”.

## [2026-07-19] Empty/Skeleton + filtros Juridiq + chips ativos

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Listas principais com Empty/Skeleton; filtros em pills Juridiq; chips “Filtros ativos” + Limpar tudo.
**Arquivos alterados:** `filtros/chip-classes.ts`, `FiltrosAtivosChips.tsx`, `ListaEstado.tsx`, `pedidos/page.tsx`, `entregas/page.tsx`, `FiltroPeriodoEntregas.tsx`, `PainelFinancas.tsx`, `ListaMovimentacoes.tsx`, `GerenciadorUsuariosClientes.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Chips pill compartilhados (`CHIP_FILTRO_DEFAULT` / `ALERTA`) iguais ao Juridiq (`#0399F9` / `#E6F4FE`).
- `FiltrosAtivosChips` com label + valor + botão Limpar tudo.
- `ListaVazia` / `GradeSkeleton` / `ListaSkeleton` / `TabelaSkeleton` sobre Empty + Skeleton.
- Pedidos: selects → ToggleGroup pills (status + tipo); skeleton/empty; chips.
- Entregas: período e status em pills; skeleton nos cards/lista; chips; sem tela inteira de spinner.
- Finanças: chips ativos; Empty/Skeleton na lista; classes de chip unificadas.
- Clientes: Select → pills; skeleton/empty; chips.

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Armadilhas:** ToggleGroup `type="single"` não permite desmarcar o item ativo clicando de novo — limpar via “Limpar tudo”.

## [2026-07-19] Mobile Juridiq: Drawer (vaul) na sidebar e modais

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Sidebar e modais mobile iguais ao Juridiq (bottom sheet com handle + swipe para fechar) em admin, garçom e entregador.
**Arquivos alterados:** `package.json` (vaul), `src/hooks/useIsMobile.ts`, `src/components/ui/drawer.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `modal-sheet.tsx`, `AdminLayout.tsx`, `ModalDetalhesPedido.tsx`, `ModalEditarPedido.tsx`, `ModalItemPedido.tsx`, `ModalCatalogoItensPedido.tsx`, `entregador/page.tsx`, modais de caixa (`ModalAbrirCaixa`, `ModalFecharCaixa`, `ModalNovaMovimentacao`, `ModalDetalhesCaixa`), `UI.md`, `Progress.md`

**O que foi feito:**

- Dependência `vaul` + primitivo `Drawer` (handle `h-1.5 w-[100px]` como Juridiq).
- `Dialog` responsivo: abaixo de 768px vira Drawer (arrastar para fechar); desktop mantém centrado. Prop `variant="dialog"` força centrado.
- `AlertDialog` no mobile sobe de baixo com handle visual (Radix mantido — Action/Cancel incompatíveis com Vaul).
- `ModalSheet` compartilhado para migrar overlays custom.
- Sidebar admin mobile: Sheet lateral → Drawer bottom.
- Migrados modais custom principais (detalhes/editar pedido, garçom, entregador notificações, caixa).

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível · browser não testado

**Pendências:** Modais custom restantes (recorte imagem/avatar, usuários sistema/clientes, cupons overlay, ControleStatusLoja, Preview mobile) ainda usam `fixed inset` — migrar sob demanda via `ModalSheet`. Cardápio público fora do escopo B.

**Armadilhas:** Não converter `AlertDialog` root para Vaul (quebra Action/Cancel). `Dialog` com `p-0` no mobile: padding fica a cargo do conteúdo.

## [2026-07-19] Auditoria UI /admin: scroll e alturas de viewport

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Varrer `/admin` por bugs da mesma família do scroll vazio em Pedidos (auto-rows-fr, h-screen, calc 100vh vs AdminLayout) e corrigir.
**Arquivos alterados:** `dashboard/page.tsx`, `painel/page.tsx`, `pedidos/page.tsx`, `PedidosCriadosGarcom.tsx`, `PainelCategoriasProduto.tsx`, `caixa/page.tsx`, `ModalPreviewMobile.tsx`, `UI.md`, `Progress.md`

**O que foi feito:**

- Removido `auto-rows-fr` em dashboard e lista de pedidos do garçom (mesma causa do bug de Pedidos).
- Loading do dashboard: `h-screen` → `py-24` (não força viewport dentro do `main`).
- Painel kanban: `h-[calc(100vh-80px)]` → `h-[calc(100dvh-5.5rem)]` / `md:…6.5rem` alinhado ao shell do AdminLayout.
- Pedidos: removido `overflow-hidden` no wrapper (evita clip estranho).
- Trocas pontuais `100vh` → `100dvh` em novo pedido (categorias), caixa (modal), preview mobile.
- Documentados anti-padrões em `UI.md`.

**Verificação:** `npx tsc --noEmit` ✓ · `npm run lint` falha (Next interpreta dir `lint` — problema conhecido no projeto) · browser não testado

**Pendências / próximos passos:** Inconsistências visuais (zinc legado vs tokens) e telas fullscreen próprias (PDV/login) ficaram de fora — não são bugs de scroll.

**Armadilhas:** Qualquer grid de cards com `auto-rows-fr` sem altura de pai definida = scroll fantasma. Conteúdo fullscreen dentro do AdminLayout deve usar `100dvh` menos header (~5.5–6.5rem), não `100vh` solto.

## [2026-07-19] Fix scroll vazio abaixo da paginação em Pedidos

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Impedir scroll além do conteúdo (lista + paginação) em `/admin/pedidos`.
**Arquivos alterados:** `src/app/admin/pedidos/page.tsx`, `src/components/admin/CardPedido.tsx`, `Progress.md`

**O que foi feito:**

- Removido `auto-rows-fr` do grid (com altura indefinida, `1fr` inflava as linhas e gerava espaço preto após a paginação).
- Removido `min-h-[380px]` do `CardPedido` (altura passa a seguir o conteúdo / stretch da linha).
- Scroll ao mudar página aponta para o `main` do AdminLayout (onde o overflow real acontece).

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

**Armadilhas:** `grid-auto-rows: 1fr` sem container com altura definida é anti-padrão e estoura o layout.

## [2026-07-19] Dark mode + sidebar ativa azul (Juridiq)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Dark mode e sidebar iguais ao Juridiq; item da página atual em azul.
**Arquivos alterados:** `src/app/globals.css`, `src/components/admin/AdminLayout.tsx`, `Progress.md`

**O que foi feito:**

- Dark: fundo `240 6% 6%`, cards/sidebar `#1D1F1F` (`180 3% 12%`).
- Item ativo: texto/ícone `#0296F9`, fundo `rgba(2,150,249,0.08/0.12)`, borda esquerda 3px azul (igual `sidebar-buttons` Juridiq).
- Match de rota com prefixo inteligente (não marca Pedidos quando está em Novo pedido).

**Verificação:** `npx tsc --noEmit` ✓ · browser não testado

## [2026-07-19] Tema Juridiq: Geist único + tokens de cor


**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Tipografia só Geist (como Juridiq) e cores alinhadas (claro/escuro).
**Arquivos alterados:** `src/lib/fonts.ts`, `public/fonts/Geist-*.woff2`, `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.js`, `UI.md`, `Progress.md`

**O que foi feito:**

- Removidos Manrope, Bricolage Grotesque e Outfit do layout.
- Geist via `next/font/local` + `geist.className` no `body` (padrão Juridiq).
- Títulos herdam Geist (`font-family: inherit`); sem fallback `sans-serif` na stack do app.
- Tokens CSS / `primaryBlue` alinhados ao Juridiq; dark sem primário dourado.

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível · browser não testado

**Armadilhas:** `geist.className` é o que aplica a face real; só `--font-geist` no Tailwind sem className no body não basta.

## [2026-07-19] Finanças: dropdowns, edição, paginação Juridiq + fix R$ 1.561


**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Menu ⋯ (visualizar/editar/excluir), modais receita/despesa no padrão Juridiq, paginação 30/50/100, corrigir receita do dia no fluxo.
**Arquivos alterados:** `ActionDialog.tsx`, `ModalMovimentacao.tsx`, `ModalNovaMovimentacao.tsx`, `PaginacaoFinancas.tsx`, `ListaMovimentacoes.tsx`, `PainelFinancas.tsx`, `useFinancas.ts`, `Progress.md`, `UI.md`

**O que foi feito:**

- Dropdown `MoreHorizontal` por linha: Visualizar · Editar (manual) · Excluir (todos, com confirm).
- Modal unificado criar/editar (descrição → valor/data → categoria/forma; botão Confirmar/Atualizar).
- `PaginacaoFinancas` espelhando Juridiq (`FinancePagination`): select 30/50/100 + first/prev/números/next/last.
- Bug 1561: fluxo passa a agregar por **dia de trabalho** (10h→09h59) e pedidos alinhados ao dashboard (`≠ cancelado/aguardando_pagamento`).
- `atualizarMovimentacao` no hook.

**Decisões:** Sync de pedido não edita (só visualizar/excluir o registro do caixa). Paginação client-side (lista já limitada a 1000).

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível · browser não testado

**Pendências:** Conferir no browser se o ponto de hoje no gráfico ≈ Receita Hoje do dashboard.

**Armadilhas:** Comparar gráfico (dia civil) com dashboard (dia operacional) gera falsa discrepância.

## [2026-07-19] Finanças: UI Juridiq real (ChartRadial + filtros + tabela)


**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Reconstruir Finanças a partir do repo Juridiq (`finance-releases`, `chartStacked`, `finance-quick-filters`) + screenshots — não só “inspiração genérica”.
**Arquivos alterados:** `CardRadialFinancas.tsx` (novo), `PainelFinancas.tsx`, `ListaMovimentacoes.tsx`, `Progress.md`, `UI.md`

**O que foi feito:**

- Cards Receitas/Despesas no padrão `ChartRadialStacked`: faixas verde / laranja / azul + donut (Chart.js, sem recharts).
- Shell único de Lançamentos: título, nav de mês (← / Mês Atual / →), pills (Todos · A receber · Somente Receitas · Somente Despesas), busca por descrição, tabela embutida.
- Botões Receitas/Despesas com `PlusCircle`/`MinusCircle` nas cores Juridiq (`#00C247` / `#FF5151`).
- Lista com barra lateral de status, badges Pedido/Manual e valor colorido.

**Decisões tomadas:** Domínio restaurante — “Inadimplentes/A vencer” do Juridiq mapeados para “A receber” (pedidos não pagos + crediário). Sem dependência nova (Chart.js já existia).

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível (Next 16) · browser não testado

**Pendências:** Validar no browser; opcional remover `StatCardsFinanceiros` se ninguém mais usar.

**Armadilhas:** O Juridiq usa Phosphor `CaretLeft`/`CirclePlus` + Recharts; no Edienai usar Lucide equivalentes + Chart.js doughnut.

## [2026-07-19] Finanças: totais corretos + UI estilo Juridiq

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Eliminar receita duplicada (~2×) e redesenhar Finanças no visual do Juridiq.
**Arquivos alterados:** `src/features/financas/hooks/useFinancas.ts`, `lib/formatadores.ts`, `PainelFinancas.tsx`, `StatCardsFinanceiros.tsx`, `ActionDialog.tsx`, `ModalNovaMovimentacao.tsx`, `ModalPagamentoSalario.tsx`, `ListaMovimentacoes.tsx`, `Progress.md`, `UI.md`

**O que foi feito:**

- Receita extra e gráficos passam a ignorar `movimentacoes_caixa` com `pedido_id` (sync do caixa) — fim da contagem em dobro.
- “Hoje” usa dia de trabalho (10h); pedidos não pagos filtrados pelo período; selects estreitos.
- Header Juridiq: lucro com olho, pedidos/ticket, a receber + botões verdes/vermelhos de receita/despesa; modal e lista com marcação de sync.

**Decisões tomadas:** Sem base-ui (Juridiq usa Radix/Chakra; Edienai já tem Radix). Default do filtro = hoje operacional.

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível (Next 16) · browser não testado

**Pendências:** Validar no browser com caixa aberto e pedidos sincronizados.

**Armadilhas:** Somar pedidos + todas as entradas do caixa duplica receita sempre que o sync de pedidos estiver ativo.

## [2026-07-19] Otimização round 2 — painel, caixa, configuracoes_loja

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Cortar os 3 hotspots restantes de egress/compute sem mexer no fluxo de pedidos.
**Arquivos alterados:** `src/app/admin/painel/page.tsx`, `src/lib/useCaixa.ts`, `src/lib/useStatusLoja.ts`, `Progress.md`

**O que foi feito:**

- **Painel Kanban:** debounce 800ms no realtime; reload silencioso não busca mais a base de numeração 48h (reusa mapa local); INSERT agenda numeração; focus só recarrega se >30s desde a última carga.
- **useCaixa:** todos os `select('*')` de caixas/funcionarios/categorias/automação/movimentações trocados por colunas tipadas (joins estreitos).
- **useStatusLoja:** `select('chave, valor')`; realtime aplica o payload sem full-reload; sync automático de aberto/fechado debounced 5s (evita tempestade de upsert → realtime → select em loop com o timer de 30s).

**Decisões tomadas:** Sem schema novo — `configuracoes_loja` já tem índice em `chave`; o problema era volume de queries (17 linhas, 354k seq scans = muitas leituras, não índice faltando).

**Verificação:** `npx tsc --noEmit` ✓ · lint indisponível (Next 16) · browser não testado

**Pendências / próximos passos:** Monitorar seq_scan de `configuracoes_loja`/`funcionarios` em 24–48h; opcional estreitar outros call sites de `configuracoes_loja` (cardápio, ModalCarrinho, produtos).

**Armadilhas:** Timer de horário automático + upsert imediato era o principal gerador de tráfego em `configuracoes_loja`.

## [2026-07-19] Otimização de egress/compute (dashboard, garçom, relatórios)

**Agente/Modelo:** Cursor Grok 4.5
**Objetivo:** Reduzir egress e compute das queries pesadas do admin/garçom sem quebrar o fluxo de pedidos.
**Arquivos alterados:** `src/app/admin/dashboard/page.tsx`, `src/lib/useEntregas.ts`, `src/app/garcom/mesas/page.tsx`, `src/app/admin/relatorios/page.tsx`, `src/app/admin/analise-diaria/page.tsx`, `scripts/otimizar-egress-dashboard-management.sql`, `Progress.md`

**O que foi feito:**

- Auditoria via Management API (`pg_stat_user_tables`, EXPLAIN, índices): hotspots confirmados em `pedidos` (54M tuplas em seq scan), `item_adicionais` (624k seq scans sem índice no FK), `mesas`/`funcionarios`/`configuracoes_loja` (tabelas pequenas com polls/realtime agressivos).
- Banco: criado `idx_item_adicionais_item_pedido_id` e RPC `estatisticas_pedidos_periodo(p_inicio, p_fim)` (aggregates PostgREST estão desabilitados — `PGRST123`).
- Dashboard: removeu paginação do mês inteiro para somar `total`; usa RPC; realtime de itens/pagamentos/crediário só recarrega a lista dos 12; poll de stats a 120s.
- Entregas: select estreito (sem `*` / `funcionarios(*)`).
- Garçom mesas: select estreito; debounce 600ms no realtime; poll 20s → 90s.
- Relatórios: eliminou N+1 (`itens_pedido` por pedido); batch `.in` + colunas mínimas.
- Análise diária: colunas mínimas em pedidos/itens.

**Decisões tomadas:** Manter queries client+anon (pedido explícito). RPC em vez de `total.sum()` porque aggregates REST estão off. Índice no FK de `item_adicionais` porque embeds nested faziam seq scan a cada listagem.

**Verificação:** `npx tsc --noEmit` ✓ · `npm run lint` indisponível (Next 16 removeu `next lint`; sem `eslint.config`) · browser não testado · bug-hunter ✓ (filtro RPC alinhado a `NOT IN` como o `.neq` do client)

**Pendências / próximos passos:**

1. Monitorar egress no dashboard Supabase após 24–48h de operação.
2. Candidatos seguintes (não feitos): `admin/painel` (reload completo em realtime), `configuracoes_loja` (354k seq scans), `useCaixa` (`select *` em massa), realtime do bot WhatsApp (maior tabela: `whatsapp_messages` 47 MB).
3. Rotacionar o access token da Management API (foi exposto no chat).

**Armadilhas descobertas:**

- PostgREST aggregates (`select=total.sum()`) retornam `PGRST123` neste projeto — usar RPC.
- `CREATE INDEX CONCURRENTLY` pode falhar se a Management API rodar em transação; `CREATE INDEX IF NOT EXISTS` funciona.
- Dashboard antigo reexecutava o loop de ~1000 linhas do mês a cada mudança em `itens_pedido` (debounce 300ms) — principal vilão de egress no horário de pico.
- App e bot compartilham o mesmo banco; RPC/índice afetam ambos (só leitura/aditivo).

## [2026-07-19] Documentação para agentes + auditoria de segurança do banco

**Agente/Modelo:** Claude Opus 4.8
**Objetivo:** enriquecer a documentação operacional para IA (template de tarefa, curadoria de skills) e auditar o estado real do Supabase via Management API.
**Arquivos alterados:** `AGENTS.md` (§0 template + §3.9/§3.10 segurança + §6 skills), `SKILLS.md` (novo), `PRD.md` (nova seção §Segurança), `Progress.md`

**O que foi feito:**

- Adicionado ao `AGENTS.md`: §0 Template de Tarefa (aplicável a qualquer pedido), §0.3 stack real verificada, §3.9 estado de segurança do banco, §3.10 `.env.local` versionado, §6 reescrito apontando `SKILLS.md` como leitura obrigatória.
- Criado `SKILLS.md`: curadoria pela stack real (Next 16 App Router / React 18 / TS strict / shadcn+Radix+framer-motion+Tailwind v3 / React Context / Supabase / Mercado Pago / npm / Vercel), incluindo `supabase-postgres-best-practices` conforme pedido, e lista de skills que quebram a stack.
- Adicionada seção §Segurança ao `PRD.md`, elevando o acesso direto do cliente de "restrição arquitetural" (como estava na linha ~240) para **risco crítico explícito**.

**Auditoria via Management API (access token do usuário, sem MCP):**

- Projeto `bawysvqqeqwxasmggfcn` — **compartilhado com o bot**; 52 tabelas (as `whatsapp_*` são do bot).
- 🔴 **0 de 50 tabelas com RLS.** Roles `anon`/`authenticated` com grant total (incl. `TRUNCATE`) em `usuarios_cliente`, `pedidos`, `pagamentos_pedido`, `crediario_contas`, `usuarios_sistema` (com `senha_hash`), etc. Anon key vai ao browser (`src/lib/supabase.ts`); 69 componentes client consultam tabelas direto.
- 🔴 `.env.local` rastreado no git (`MERCADO_PAGO_ACCESS_TOKEN`, `EVOLUTION_API_KEY`, `VERCEL_OIDC_TOKEN`); branch 3 commits à frente de `origin/main`.

**Decisões tomadas:**

- **Não** reescrever `PRD.md`/`Progress.md`/`UI.md` (fortes e recém-datados 2026-07-12); apenas enriquecer/append. `SKILLS.md` e o template são o valor novo.
- **Não** corrigir RLS/grants nem `.env.local` (migração coordenada + rotação de chaves + Git de escrita = autorização do mantenedor). Apenas documentado e reportado.
- Access token do usuário usado só em memória/scratchpad de sessão; **não** escrito em nenhum doc, log ou commit.

**Verificação:** schema, RLS, grants e contagens lidos ao vivo pela Management API; stack confirmada em `package.json`/código (Next 16, TS strict, shadcn 55 / Radix 18 / framer 56, sem zod/rhf/zustand, npm). Sem alteração de código — sem `tsc`/lint nesta task (só documentação).

**Pendências / próximos passos (ordem de risco):**

1. **Rotacionar** service role do Supabase, `MERCADO_PAGO_ACCESS_TOKEN`, `EVOLUTION_API_KEY` — expostas no git/bundle.
2. Habilitar **RLS + policies** e **revogar grants do `anon`**; mover consultas sensíveis para route handlers server-side (migração coordenada web/Electron/bot).
3. `git rm --cached .env.local` e limpar histórico.

**Armadilhas descobertas:**

- App e bot **compartilham o mesmo banco**; mudança de schema/grant/trigger afeta web + 2 Electron + bot ao mesmo tempo.
- `@mui/material`/`@emotion` estão nas deps mas **sem uso real** — UI é shadcn; não criar UI nova com MUI.
- **Sem zod e sem react-hook-form**: forms são manuais; não presuma esse ferramental.
- Não há script `typecheck` nem framework de teste: verificação é `npx tsc --noEmit` + `npm run lint`.

## [2026-07-12] Controles sólidos da fila de impressão

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Permitir desativar a impressão automática de itens adicionados na edição e impedir acúmulo de pedidos fora do horário, sem recompilar o Electron.
**Arquivos alterados:** `scripts/configurar-fila-impressao-management.sql`, `src/lib/filaImpressao.ts`, `src/components/admin/GerenciadorImpressao.tsx`, `src/app/admin/impressora/page.tsx`, call sites manuais de impressão, `PRD.md`, `UI.md`, `Progress.md`
**O que foi feito:**

- Substituído o toggle local/fictício por configuração persistida no Supabase.
- Adicionada janela diária da fila automática com suporte a período noturno que cruza meia-noite.
- Adicionado controle independente para impressão automática de itens novos após edição.
- Separadas impressões automáticas e manuais; reimpressão explícita continua disponível fora da janela.
- Pendências automáticas incompatíveis são canceladas ao salvar a configuração; eventos novos fora da regra não entram na fila.
- Migration aplicada no projeto `edienai` pela Supabase Management API, sem MCP.
- Electron preservado sem alterações e sem necessidade de novo empacotamento.

**Decisões tomadas:** A regra ficou no PostgreSQL para cobrir todos os produtores e consumidores atuais sem depender de o Electron conhecer a nova configuração. Defaults preservam o comportamento anterior (`ativa 24h`, itens editados ligados).
**Verificação:** `tsc --noEmit` ✓ · 3 testes Node ✓ · 5 cenários transacionais PostgreSQL ✓ com rollback · diff check ✓ · lint indisponível por configuração ausente/script incompatível na base
**Pendências / próximos passos:** Escolher no admin a janela operacional desejada; nenhum horário restritivo foi ativado automaticamente.
**Armadilhas descobertas:** `impressora_auto_imprimir` controla a impressão Web Bluetooth, não o Electron. O antigo botão Ativa/Pausada do dashboard alterava somente estado React e não pausava a fila real.

## [2026-07-12] Inicialização da documentação viva

**Agente/Modelo:** Codex (GPT-5)
**Objetivo:** Criar a governança documental e analisar a arquitetura do repositório e do Supabase antes da primeira tarefa de implementação.
**Arquivos alterados:** `AGENTS.md`, `PRD.md`, `Progress.md`, `UI.md`
**O que foi feito:**

- Criado o `AGENTS.md` normativo a partir do conteúdo fornecido pelo usuário.
- Criadas as bases de `PRD.md`, `Progress.md` e `UI.md` para enriquecimento durante o inventário.

**Decisões tomadas:** O token da Management API será usado apenas em memória/processo e nunca persistido nos documentos ou no código.
**Verificação:** Em andamento; documentação será revisada após o inventário completo.
**Pendências / próximos passos:** Mapear módulos, fluxos, componentes, integrações e schema real do Supabase; consolidar os documentos.
**Armadilhas descobertas:** A raiz possui múltiplas aplicações; o mapa deve separar claramente a aplicação Next.js, a impressora Electron e a integração WhatsApp.
