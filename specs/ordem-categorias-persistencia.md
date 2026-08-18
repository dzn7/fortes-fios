# SPEC — A ordem salva no Admin tem que chegar ao site

> Status: implementado e verificado contra o banco.
> Reportado pelo usuário com três telas: o carrossel do site, o menu do site e o
> modal do Admin — **três ordens diferentes**.

---

## 1. O bug: duas gavetas, e o site lê a outra

| | Onde grava/lê |
|---|---|
| Modal "Ordem das categorias" (Admin) | `configuracoes_loja.ordem_categorias_produtos` (JSON) |
| Site do cliente (`/api/vitrine/categorias`) | `categorias_cardapio.ordem` (coluna) |

As duas foram lidas no banco em 2026-08-18:

```
A) categorias_cardapio.ordem      B) configuracoes_loja (JSON)
 1. Kits e promopack               1. Kits e promopack
 2. Reconstrução                   2. Ofertas relâmpago
 3. Nutrição                       3. Hidratação
 4. Mary Kay                       4. Nutrição
 5. Infantil                       5. Reconstrução
 …                                 …
```

**A** bate exatamente com o print do carrossel do site. **B** bate exatamente
com o print do modal do Admin. Ou seja: o modal salva de verdade — só que numa
gaveta que o site nunca abre.

A chave `ordem_categorias_produtos` é herança da época em que a categoria era só
uma string no produto, antes de existir a tabela `categorias_cardapio`.

## 2. Correção

O modal passa a gravar **`categorias_cardapio.ordem`** — a coluna que o site já
lê — e continua atualizando o JSON no mesmo salvamento, para as duas não
divergirem enquanto o legado existir.

`categorias_cardapio.ordem` é a fonte da verdade. O JSON é espelho.

### 2.1 Por que não o contrário (fazer o site ler o JSON)

Porque `ordem` é coluna da tabela real, é o que a API pública já consulta, e é o
que "ordem da categoria" significa. Ensinar o site a ler uma chave de
configuração manteria a coluna como segunda verdade, desatualizada — que é
exatamente a doença deste bug.

### 2.2 Por que escrita client-side

`categorias_cardapio` já é criada, renomeada e apagada pelo cliente nessa mesma
tela, e `anon` já tem `UPDATE` na tabela (dívida conhecida, AGENTS §3.9). Mover
só a ordenação para route handler não reduziria exposição nenhuma e deixaria a
tela com dois padrões. Fechar a tabela é tarefa própria.

## 3. Contrato — `ordenarParaBanco(nomes, categorias)`

Recebe os nomes na ordem escolhida e as linhas de `categorias_cardapio`.
Devolve `[{ id, ordem }]` com `ordem` começando em 1.

| Regra | Motivo |
|---|---|
| casa por nome normalizado (sem acento/caixa) | "Hidratação" e "hidratacao" são a mesma categoria |
| nome sem linha correspondente é ignorado | não inventa linha; nada a atualizar |
| duplicado fica só com a primeira posição | o modal não deveria produzir, mas dado sujo não pode gerar `ordem` repetida |
| numeração é contígua (1..N) sobre o que existe | buraco na numeração reintroduz empate no `order by` |

## 4. Aceite

| Cenário | Esperado |
|---|---|
| Reordenar e salvar | `categorias_cardapio.ordem` reflete a nova sequência |
| Recarregar o site | carrossel e menu na ordem salva |
| Categoria sem linha na tabela | ignorada, sem erro |
| Falha ao salvar | ordem anterior restaurada na tela e erro visível |

Cobertura: `tests/ordem-categorias.test.mjs`.

## 5. Nota sobre o ícone

O mesmo relato citava o ícone. A correção do ícone é a do commit `3dc7e3d`
(`specs/icone-categoria.md`) e **ainda não estava publicada** quando os prints
foram tirados: o carrossel do site mostrava `Tag` para "Reconstrução" porque
rodava o palpite por nome antigo, enquanto o menu do Header — que já lia o valor
gravado — mostrava o ícone certo. Os dados de `categorias_cardapio.icone`
estavam corretos o tempo todo.
