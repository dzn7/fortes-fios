# SPEC — Modal de ordem das categorias

> Status: implementado e verificado.
> Pedido do usuário: *"um modal/drawer prático em /admin/produtos e categorias,
> para editar a ordem das categorias da forma correta, algo fácil, responsivo e
> bem implementado, sem bugs de UI, overlays e etc"*

---

## 1. O que já existia — e por que dava bug

`/admin/produtos` já tem reordenação de categorias, escondida atrás do botão
**"Detalhar"** da seção "Ordenação do catálogo". Ela usa `Reorder` do
framer-motion e tem quatro defeitos que produzem exatamente os bugs de UI
citados no pedido:

| # | Defeito | Consequência |
|---|---|---|
| 1 | `Reorder.Group` de produtos **dentro** de um `Reorder.Item` de categoria | arrastar um produto arrasta a categoria junto |
| 2 | `axis="y"` num container `lg:grid-cols-2` | no desktop os cartões ficam lado a lado, mas o arrasto só entende vertical — soltar na coluna ao lado dá resultado imprevisível |
| 3 | scroll dentro de scroll (`max-h-44` dentro de `max-h-[60dvh]`) | no toque, o gesto é capturado pelo container errado |
| 4 | `touch-none` na linha inteira | a página não rola quando o dedo começa sobre a lista |

Ou seja: o recurso existe, mas só funciona confiavelmente com mouse, numa
coluna, sem tocar nos produtos.

## 2. Desenho

Um modal dedicado **só à ordem das categorias**. Uma tarefa por superfície: o
que tornava a UI antiga frágil era fazer duas reordenações aninhadas ao mesmo
tempo.

### 2.1 Superfície — sem inventar nada

`Dialog variant="responsive"` do projeto: **Radix no desktop, Drawer vaul no
mobile**, decidido por `useIsMobile` (que já usa `useSyncExternalStore` para não
remontar depois da hidratação). O empilhamento de overlay já é resolvido por
`overlay-layer`. Nenhum componente novo de modal, nenhuma dependência nova.

### 2.2 Como se reordena

| Ambiente | Mecanismo |
|---|---|
| Mobile | **somente setas ↑ ↓** |
| Desktop | setas ↑ ↓ **e** arrastar pelo punho |

**Por que não arrastar no mobile.** No celular a superfície é um Drawer vaul,
que tem o próprio gesto de arrastar para fechar. Uma lista arrastável dentro
dele disputa o mesmo gesto com o drawer e com o scroll — é o bug 3/4 da tabela
acima reencenado. As setas são alvo de 40px, funcionam com teclado e leitor de
tela, e não competem com gesto nenhum.

No desktop o arrasto usa `useDragControls` com **`dragListener={false}`**: o
arrasto só nasce do punho, nunca do corpo da linha. É isso que impede o
conflito com a rolagem da lista.

### 2.3 Estrutura da linha

Espelha a referência enviada pelo usuário (o "Configurar funil"):

```
⠿  1  ● Kits e promopack        31 produtos      ↑  ↓
```

- punho (só desktop) · posição · ícone da categoria · nome · contagem · setas
- um único container de rolagem, sem aninhamento

### 2.4 Estado e salvamento

Rascunho local: **nada é gravado enquanto o modal está aberto**. "Salvar ordem"
persiste; "Cancelar" descarta. Fechar com ordem mexida pede confirmação — a
alternativa (salvar ao arrastar) transformaria cada toque acidental numa
alteração do catálogo público.

O botão de salvar fica desabilitado quando a ordem não mudou, comparando com o
retrato de quando o modal abriu.

Persistência reusa `persistirOrdemCategorias`, que já existe na página e grava
em `configuracoes_loja` na chave `ordem_categorias_produtos`.

## 3. O que muda no que já existia

O `Reorder.Group` **de categorias** da seção "Detalhar" vira lista comum. Não é
remoção de recurso: a reordenação de categorias passa a ser o modal, e a seção
mantém o que ela faz de único — reordenar **produtos dentro** de cada categoria.

Isso resolve os defeitos 1 e 2 da tabela de graça: sem o grupo externo, o
arrasto dos produtos deixa de disputar com o da categoria, e o `grid-cols-2`
deixa de ser superfície de arrasto.

## 4. Contrato do domínio — `src/lib/ordem-categorias.mjs`

| Função | Regra |
|---|---|
| `moverItem(lista, de, para)` | devolve nova lista; índice fora da faixa devolve a lista intacta |
| `moverParaCima` / `moverParaBaixo` | atalhos; no topo/fundo são no-op |
| `podeSubir` / `podeDescer` | estado `disabled` das setas |
| `ordemMudou(antes, depois)` | comparação posicional, para habilitar "Salvar" |

Nada muta a lista recebida: o rascunho do modal e o retrato original precisam
coexistir para o "Cancelar" funcionar.

## 5. Aceite

| Cenário | Esperado |
|---|---|
| Seta ↑ no primeiro item | desabilitada, nada acontece |
| Seta ↓ no último item | desabilitada, nada acontece |
| Mover e cancelar | ordem do catálogo intacta |
| Mover e salvar | `configuracoes_loja.ordem_categorias_produtos` atualizado |
| Fechar com mudança pendente | pede confirmação |
| Salvar sem mexer | botão desabilitado |
| Mobile | sem punho de arrasto; setas funcionam; drawer fecha normalmente |
| Desktop | arrasto só pelo punho; corpo da linha não inicia arrasto |

Cobertura: `tests/ordem-categorias.test.mjs`.
