# Spec — Controle de estoque de produtos

**Status:** aprovada para implementação  
**Data:** 2026-08-15  
**Escopo:** projeto Fortes Fios, sem tenant, slug ou multi-tenant

## 1. Objetivo

Permitir que a loja acompanhe e ajuste o estoque físico de cada produto com rapidez, sem criar um segundo conceito de disponibilidade e sem permitir que um produto bloqueado por falta de estoque seja incluído em um pedido por uma rota alternativa do frontend.

## 2. Estado atual verificado

- `public.produtos` possui disponibilidade comercial (`disponivel`), preço, categoria e demais dados do catálogo, mas não possui quantidade, limite baixo ou regra de bloqueio por estoque.
- O formulário compartilhado `ModalFormularioProduto` atende criação e edição; a página de Produtos persiste diretamente em `produtos`.
- O site público atual consulta `produtos`, mantém os itens no `CarrinhoContext` e persiste o carrinho no `localStorage`.
- O checkout público e o novo pedido do Admin inserem itens em `itens_pedido` com `produto_id`.
- `ModalEditarPedido` perde hoje o `produto_id` ao adicionar um novo item; esse caminho precisa ser corrigido para não escapar da regra de estoque.
- O Supabase não tem RLS nas tabelas envolvidas. Esta task não corrige a arquitetura global de autenticação/RLS, mas não pode ampliar a exposição.
- Já existe realtime de `produtos`; hoje ele recarrega a coleção completa a cada evento.
- Não existe framework de teste. A base já usa `node:test` com módulos de domínio `.mjs`, que será reutilizado sem dependência nova.

## 3. Modelo de domínio

### 3.1 Campos persistidos em `produtos`

| Campo | Tipo | Default | Regra |
|---|---|---:|---|
| `estoque_quantidade` | `integer not null` | `0` | `>= 0` |
| `estoque_minimo` | `integer not null` | `5` | `>= 0` |
| `bloquear_venda_sem_estoque` | `boolean not null` | `false` | controla a venda quando a quantidade chega a zero |

Os produtos já existentes recebem `0`, `5` e `false`; assim, a migration não interrompe vendas atuais.

### 3.2 Estados derivados — nunca persistidos

- `estoque_quantidade = 0` → `esgotado`.
- `estoque_quantidade > 0` e `estoque_quantidade <= estoque_minimo` → `baixo`.
- `estoque_quantidade > estoque_minimo` → `em_estoque`.

O estado físico `esgotado` não é sinônimo de indisponibilidade comercial.

### 3.3 Disponibilidade para compra

```text
pode_comprar = disponivel
  AND (NOT bloquear_venda_sem_estoque OR estoque_quantidade > 0)
```

- `disponivel = false` continua ocultando/desativando o produto conforme a regra atual.
- Quantidade zero + bloqueio ativo mantém o produto visível no catálogo, com estado `ESGOTADO`, mas impede compra.
- Quantidade zero + bloqueio desativado mantém o produto disponível para compra.
- Uma única função de domínio será importada pelo Admin, cards, detalhes e carrinho; o banco repetirá a mesma expressão como autoridade final.

## 4. Integridade e ciclo do estoque — decisão proposta

### 4.1 Recomendação

**Reservar/baixar estoque quando `itens_pedido` é inserido**, porque esse é o primeiro ponto comum e autoritativo dos fluxos verificados. Restaurar a reserva ao remover o item, reduzir sua quantidade, excluir o pedido ou cancelar o pedido.

Motivos:

- impede duas compras simultâneas de consumirem a mesma unidade;
- cobre site e novo pedido Admin sem duplicar regra;
- o trigger pode bloquear e atualizar a linha do produto na mesma transação.

### 4.2 Contabilidade por item

Adicionar em `itens_pedido`:

| Campo | Tipo | Default | Finalidade |
|---|---|---:|---|
| `estoque_quantidade_consumida` | `integer not null` | `0` | registra quanto aquele item efetivamente retirou do estoque |

- Produto com bloqueio ativo: a inserção/elevação falha se a quantidade disponível for insuficiente.
- Produto com bloqueio desativado: o pedido é permitido; baixa-se somente `least(estoque_quantidade, quantidade_solicitada)`, nunca abaixo de zero.
- Ao reduzir/remover/cancelar, restaura-se exatamente `estoque_quantidade_consumida`, evitando criar estoque fictício em vendas permitidas com zero.
- Ao reabrir pedido cancelado, a reserva é refeita de forma atômica e pode falhar por falta de estoque.
- Itens sem `produto_id` não participam do estoque; caminhos de produto existentes devem preservar `produto_id`.

### 4.3 Concorrência

- Trigger/função de pedido usa `SELECT ... FOR UPDATE` na linha de `produtos`, em ordem estável quando houver múltiplos itens.
- Constraints impedem quantidade negativa em qualquer escrita.
- Ajuste rápido do Admin usa operação atômica de delta/definição e retorna somente a linha alterada.
- A UI pode aplicar optimistic update, mas confirma o valor retornado; conflito ou falha reverte apenas o produto afetado.
- Nenhuma alteração de estoque exige refetch da lista completa.

## 5. Banco e segurança

Migration proposta:

1. adicionar os quatro campos e constraints descritos nas seções 3 e 4;
2. criar funções restritas para ajustar/definir estoque atomicamente;
3. criar triggers de reserva/reconciliação em `itens_pedido`;
4. criar trigger de restauração/reabertura em mudança relevante de `pedidos.status`;
5. manter o trigger atual de custo unitário;
6. criar índice somente se `EXPLAIN` justificar os filtros de estado; cinco produtos atuais não justificam índice antecipado;
7. aplicar e validar somente pela Management API.

Limite de segurança conhecido: o banco atual permite escrita ampla com anon e não possui RLS. Um endpoint com `service_role` não seria realmente administrativo enquanto a sessão Admin continuar apenas no cliente. Esta task não criará um endpoint privilegiado sem autenticação real nem alegará resolver esse risco. A integridade comercial ficará no banco; a remediação de RLS/autenticação permanece uma task coordenada própria.

## 6. Contratos compartilhados

O tipo de produto passa a expor:

```ts
estoque_quantidade: number
estoque_minimo: number
bloquear_venda_sem_estoque: boolean
```

Um módulo único fornece:

- normalização/validação de inteiros não negativos;
- estado derivado (`em_estoque | baixo | esgotado`);
- disponibilidade comercial por estoque;
- limite máximo adicionável quando o bloqueio está ativo;
- mensagem estável para feedback de indisponibilidade.

Alterações de contrato exigem atualização dos call sites já encontrados: página pública, `CartaoProduto`, `ModalIngredientes`, `ModalComplementos`, `CarrinhoContext`, `ModalCarrinho`, formulário/página de Produtos, novo pedido Admin e edição de pedido.

## 7. Experiência do Admin

### 7.1 Cadastro e edição

No formulário existente, seção compacta “Estoque”:

- quantidade atual (opcional na criação; vazio equivale ao default `0`);
- aviso de estoque baixo (default `5`);
- switch “Impedir vendas quando o estoque zerar”;
- resumo imediato do estado resultante;
- validação inline para inteiro negativo/inválido.

### 7.2 Nova tela `/admin/estoque`

- item “Estoque” no grupo Catálogo da sidebar;
- cards de resumo: em estoque, estoque baixo e esgotados;
- busca e filtros rápidos pelos três estados;
- listagem responsiva com foto, nome, categoria, quantidade, limite e badge;
- controle inline `− quantidade +`, edição direta e ação “Zerar estoque”;
- operações simples sem modal;
- feedback otimista por linha, estado de salvamento e rollback com toast em erro;
- controles com alvo mínimo de toque e sem overflow no mobile.

### 7.3 Tela Produtos

Reusar o mesmo controle compacto por produto, com quantidade, badge, `−`, `+`, edição direta e zerar. A edição completa continua no formulário já existente.

## 8. Site público e carrinho

- O produto bloqueado por estoque continua na listagem.
- Card e detalhe exibem imagem dessaturada, overlay discreto e `ESGOTADO` centralizado.
- Botões de comprar/adicionar ficam desabilitados e acessíveis (`disabled`/`aria-disabled`).
- `ModalComplementos`, ação do card e Context recusam inclusão mesmo quando chamados diretamente.
- Ao carregar/restaurar `localStorage`, o carrinho reconcilia produtos bloqueados e não permite aumentar além do estoque disponível.
- Antes do checkout, os produtos do carrinho são conferidos; a validação final ocorre atomicamente no banco ao inserir `itens_pedido`.
- Erro de concorrência informa qual produto esgotou e preserva o carrinho para correção.
- Produto com zero e bloqueio desativado continua comprável sem limite derivado do estoque.

## 9. Consultas e performance

- Substituir os `select('*')` tocados pela task por colunas explícitas.
- Consultas de catálogo trazem os três campos de estoque na mesma query dos produtos.
- Resumos da tela Estoque são derivados da coleção já carregada; não há três queries para contadores.
- Mutação atualiza/retorna somente `id`, quantidade e campos necessários do produto alterado.
- Realtime reconcilia a linha alterada, sem download completo da coleção.
- Não criar subscription adicional se a tela já puder usar o canal existente.

## 10. Testes escritos antes da implementação

Sem dependência nova, usando `node:test` e o padrão `.mjs` já existente.

1. Produto criado com estoque.
2. Produto criado sem estoque/configuração recebe quantidade `0`, limite `5` e bloqueio desativado.
3. Aumentar estoque.
4. Diminuir estoque.
5. Impedir quantidade inválida ou negativa.
6. Definir estoque como zero.
7. Identificar estoque baixo corretamente, inclusive no limite.
8. Zero + bloqueio ativado → produto esgotado e indisponível.
9. Zero + bloqueio desativado → produto disponível.
10. Produto esgotado não pode ser adicionado/comprado no site.
11. Produto liberado com zero pode seguir para pedido.
12. Alteração na tela Estoque produz o mesmo estado exibido em Produtos.
13. Alteração em Produtos produz o mesmo estado exibido na tela Estoque.
14. Operações concorrentes não duplicam, sobrescrevem nem tornam estoque negativo.
15. Valor confirmado pelo banco permanece correto após refresh/reconsulta.
16. O produto mantém o mesmo estado entre Admin, Estoque, site e pedido; chamada direta/manipulação do frontend não contorna o bloqueio autoritativo.

Além dos testes de domínio, um teste SQL transacional valida constraints, locks, reserva, edição, remoção, cancelamento, reabertura e erro por saldo insuficiente. Ele deve executar com rollback e nunca persistir fixture no projeto real.

## 11. Critérios de aceite

- Os 16 cenários estão verdes depois de terem sido observados em RED.
- Quantidade nunca fica negativa.
- Nenhuma tela calcula disponibilidade com expressão própria.
- Produto esgotado e bloqueado permanece visível, mas não entra no carrinho nem em `itens_pedido`.
- Zero sem bloqueio continua vendável.
- Admin ajusta uma linha sem refetch global.
- Cancelamento/edição não perde nem duplica estoque reservado.
- Typecheck e lint são executados conforme `AGENTS.md`; limitações existentes são relatadas honestamente.

## 12. Fora de escopo

- tenant, multi-tenant, slug, `[slug]` ou isolamento entre clientes;
- estoque de `bebidas`, combos, adicionais ou insumos;
- lote, validade, fornecedor, inventário fiscal ou múltiplos depósitos;
- correção global de RLS/autenticação;
- redesign das telas fora dos controles de estoque.
- Mercado Pago, PIX online ou qualquer fluxo de pagamento online.

## 13. Decisão aprovada

O usuário aprovou em 2026-08-15 que o estoque será reservado no momento em que o item do pedido é criado e devolvido quando o item/pedido é removido ou cancelado. Pagamento online não integra este projeto e foi removido do escopo.

Sequência autorizada: **TESTES EM RED → migration e domínio → UI/integrações → testes em GREEN → validação completa**.
