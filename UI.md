# UI — Fortes Fios

> **Site público Fortes Fios (2026-08-14):** somente as rotas do cliente usam `body.fortes-fios-public` ou o marcador SSR `.fortes-fios-site`: oliva `#636B2F`, oliva escuro `#3D4127` e branco `#FFFFFF`. Chamadas e títulos editoriais usam Quiche Sans Light; corpo e controles usam Raleway ExtraLight 200. Não aplicar esses tokens ao admin. O marcador renderizado no HTML precisa ativar os tokens antes da hidratação para nunca produzir uma primeira pintura azul.

> **Marca atual no cliente (2026-08-13):** Fortes Fios. O catálogo público usa linguagem de produtos capilares; nomes técnicos legados de tabelas e componentes não são copy de interface.

> Fonte da verdade visual confirmada em 2026-07-12. Consulte este documento e os componentes compartilhados antes de criar UI.

## Fundamentos

- Tailwind CSS 3 com tokens definidos em `src/app/globals.css` e mapeados em `tailwind.config.js`.
- shadcn no estilo `new-york`, base `slate`, sem prefixo e com CSS variables.
- Tema por classe via `next-themes`, padrão `system`.
- Interface em português do Brasil.
- Ícones predominantemente `lucide-react`; alguns ícones de domínio ficam em `src/components/icons/`.

## Tipografia

| Uso | Fonte | Token/classe |
|---|---|---|
| Admin: corpo, títulos e UI | Geist (única, igual Juridiq) | `--font-geist` via `geist.className` no `layout.tsx` |
| Cliente: títulos e chamadas editoriais | Quiche Sans Light 300, com Thin 100 disponível | `--font-fortes-display`; aplicado a `h1`–`h6`, `.fonte-titulo` e `.fortes-display` dentro de `body.fortes-fios-public` |
| Cliente: corpo e controles | Raleway ExtraLight 200 | `--font-fortes-text` em `body.fortes-fios-public` |
| Valores monoespaçados | `font-mono tabular-nums` (stack do tema) | Totais/preços no PDV e cards; sem JetBrains dedicado |

Pesos Geist carregados: 100–900 (`public/fonts/Geist-*.woff2`). Quiche Sans é carregada localmente pelos arquivos OTF da identidade; Raleway 200 é integrada pelo carregador de fontes do Next e servida pelo próprio app. Manrope / Bricolage / Outfit / JetBrains no PDV removidos.

## Design tokens

### Tokens semânticos obrigatórios

`background`, `foreground`, `card`, `card-foreground`, `surface-raised`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input` e `ring`.

Há tokens equivalentes para sidebar. Novos componentes devem preferir esses nomes às escalas de cor diretas.

### Paletas por área

#### Catálogo público Fortes Fios

- **Primário / ações:** oliva `#636B2F`; **fundo:** branco `#FFFFFF`; **superfícies escuras:** oliva escuro `#3D4127`.
- A paleta existe em `body.fortes-fios-public` e não deve ser aplicada manualmente em componentes do admin.
- Títulos `h1`–`h6`, `.fonte-titulo` e `.fortes-display` usam Quiche Sans Light 300 no cliente; corpo, formulários e controles usam Raleway ExtraLight 200. Geist permanece exclusivo do admin e das rotas que não recebem `body.fortes-fios-public`.

#### Administração herdada

- **Primário / ações:** `primaryBlue` `#0296F9` (`--primary` em claro e escuro). Escala: `secondaryBlue` `#0D9DFD`, `tertiaryBlue` `#5EBDFD`, `quaternaryBlue` `#86CEFD`.
- **Claro:** fundo branco, cards brancos, texto slate (`222.2 84% 4.9%`), borders `214.3 31.8% 91.4%` — tokens do `global.css` Juridiq.
- **Escuro:** fundo `222.2 84% 4.9%`, cards `#1D1E1E` (`180 2% 12%`), texto quase branco; sem primário dourado.
- Aliases históricos `laranja`/`bordo`/`dourado` no CSS apontam ao azul Juridiq por compatibilidade.
- Estados operacionais: emerald/rose/amber; acento de UI preferir `primaryBlue` / `primary` em vez de `sky-*`.

### Forma e elevação

- Radius global: `0.625rem`.
- Controles operacionais usam em geral `rounded-md`/`rounded-lg`.
- Modais compartilhados usam `rounded-xl`, borda semântica e sombra baixa.
- Evitar excesso de cards, cantos muito arredondados e sombras dramáticas.

### Movimento

Animações disponíveis incluem `fade-in`, `slide-up`, `scaleIn`, `shimmer` e rotações/spinners. Framer Motion é usado em telas específicas. Movimento deve comunicar transição/estado, não decorar controles rotineiros.

A faixa promocional acima da navegação usa repetição contínua e velocidade constante para comunicar a condição da loja sem ocupar uma seção inteira. Com `prefers-reduced-motion`, a animação deve parar e a mensagem permanecer legível. O conteúdo é informativo: uma mensagem de frete não altera cálculo, elegibilidade ou total do checkout.

## Primitivos compartilhados

Todos ficam em `src/components/ui/` e devem ser reutilizados antes de criar qualquer base local.

| Grupo | Componentes | Quando usar |
|---|---|---|
| Ações | `Button`, `Toggle`, `ToggleGroup`, `DropdownMenu`, `MenuAcoes`, `Command` | Ações, alternâncias e menus; preferir `MenuAcoes` para menus ⋯ de lista/card |
| Entrada | `Input`, `Textarea`, `Select`, `Checkbox`, `Field`, `Label` | Formulários; preferir `Field` para composição nova |
| Overlay | `Dialog`, `AlertDialog`, `Sheet`, `Drawer`, `ModalSheet`, `Popover`, `Tooltip` | Modal, confirmação, painel mobile e ajuda contextual |
| Navegação | `Tabs`, `Pagination`, `ScrollArea` | Alternância de seções, listas extensas e paginação |
| Dados/estado | `Table`, `Badge`, `Progress`, `Skeleton`, `Empty`, `Separator`, `Avatar` | Tabelas, status, loading, vazio e avatar Radix |
| Filtros admin | `FiltrosAtivosChips`, `ListaVazia`, `GradeSkeleton`/`ListaSkeleton`/`TabelaSkeleton`, `chip-classes` | Pills Juridiq + chips ativos + estados de lista em `/admin` |
| Especial | `Iphone` | Moldura do preview mobile administrativo |

Primitivos Kibo UI disponíveis:

- `MiniCalendar` e subcomponentes em `src/components/kibo-ui/mini-calendar/`.
- `Pill`, `PillStatus`, `PillIndicator` e `PillIcon` em `src/components/kibo-ui/pill/`.

## Componentes de produto existentes

### Público/cardápio

| Componente | Caminho | Responsabilidade |
|---|---|---|
| `Header` | `src/components/Header.tsx` | Cabeçalho público: marca e ações completas no desktop; no mobile, hambúrguer abre Sheet lateral com categorias reais, pedidos, ajuda e tema, enquanto o carrinho permanece direto na navbar |
| `Footer` | `src/components/Footer.tsx` | Dock de navegação pública exclusiva do mobile: Início, Pedidos e Sacola; superfície flutuante compacta, estado atual inequívoco, badge de quantidade e safe-area integrada |
| `FaixaRodape` | `src/components/FaixaRodape.tsx` | Faixa promocional fina acima da navegação pública: fundo oliva semântico, mensagem em Quiche Sans e movimento contínuo; respeita redução de movimento e nunca substitui regras reais de frete do checkout |
| `HeroVitrine` | `src/components/HeroVitrine.tsx` | Carrossel público full-width com proporção fiel ao recorte salvo; usa art direction desktop/mobile, imagem integral, swipe, navegação acessível, pausa manual e redução de movimento |
| `ResultadosStudio` | `src/components/ResultadosStudio.tsx` | Prova social após o catálogo: logo central e carrossel 4:5 com destaque central, laterais visíveis, swipe, setas, paginação e pausa de autoplay |
| `EditorOfertas` | `src/components/admin/vitrine/EditorOfertas.tsx` | Curadoria manual das ofertas: publicação, quantidade, inclusão, remoção e ordem; cada produto selecionado possui editor rápido inline de percentual, com prévia de/por e remoção por 0% |
| `CartaoProduto` | `src/components/CartaoProduto.tsx` | Card único de catálogo; mostra preço anterior riscado, preço promocional, badge percentual e parcelamento informativo. Produto com estoque zero e bloqueio ativo permanece visível com imagem dessaturada, overlay `ESGOTADO` e CTA desabilitado; `variante="destaque"` amplia presença |
| `ModalIngredientes` | `src/components/ModalIngredientes.tsx` | Detalhe responsivo do produto em Dialog/Drawer, com imagem, descrição, preço, desconto, parcelamento informativo e CTA de compra; replica o estado esgotado do card e nunca reabilita a compra; o nome do arquivo é legado, mas não aparece na interface |
| `CartaoBebida` | `src/components/CartaoBebida.tsx` | Item de bebida |
| `CartaoCombo` | `src/components/CartaoCombo.tsx` | Item de combo |
| `ModalComplementos` | `src/components/ModalComplementos.tsx` | Quantidade, adicionais e observações |
| `ModalCarrinho` | `src/components/ModalCarrinho.tsx` | Checkout completo; em entrega mostra recorrência e próxima data da cidade selecionada e repete a previsão na confirmação |
| `AjudaPedidoPublica` | `src/components/AjudaPedidoPublica.tsx` | Drawer de “Como pedir”, aberto somente pela navbar, com contato por WhatsApp |
| `ModalSelecionarMesa` | `src/components/ModalSelecionarMesa.tsx` | Escolha do ponto local |
| `ModalPedidosCliente` | `src/components/ModalPedidosCliente.tsx` | Consulta de pedidos por cliente |
| `ModalNotificacao` | `src/components/ModalNotificacao.tsx` | Feedback padronizado legado |
| `ImagemOtimizada` | `src/components/ImagemOtimizada.tsx` | Exibição de imagem com fallback |

### Administração

| Componente | Caminho | Responsabilidade |
|---|---|---|
| `AdminLayout` | `src/components/admin/AdminLayout.tsx` | Sidebar, header, comandos, atalhos, tema e personalização via `SidebarPersonalizarModal` + API; exibe logo e marca Fortes Fios sem alterar a paleta azul administrativa |
| `SinoNotificacoes` | `src/components/admin/notificacoes/SinoNotificacoes.tsx` | Sino do header, entre o botão de tema e o menu do usuário. Badge com não lidas (vermelho quando há urgente, `9+` acima de nove); o número vem de contadores do servidor, nunca de varredura da lista. **Hospeda a superfície da central**: `Popover` ancorado no sino no desktop, `Drawer` abaixo de 768 px |
| `PainelNotificacoes` | `src/components/admin/notificacoes/PainelNotificacoes.tsx` | Conteúdo da central, sem superfície própria (quem a fornece é o `SinoNotificacoes`): separa **Precisa de atenção** de **Informações**, com **Histórico** sob demanda. Cabeçalho e rodapé fixos, só a lista rola; rodapé com duas ações apenas — marcar todas como lidas e histórico |
| `ModalAlertasEntrada` | `src/components/admin/notificacoes/ModalAlertasEntrada.tsx` | Modal de entrada, uma vez por sessão, com até 3 alertas e "e mais N". Fechar marca como visualizado; **Não mostrar novamente** desliga o modal para o usuário, de forma reversível pelo rodapé do painel |
| `ItemNotificacao` | `src/components/admin/notificacoes/ItemNotificacao.tsx` | Cartão compartilhado por painel e modal: ícone por tipo, fio vermelho à esquerda quando urgente, ponto de não lida, tempo relativo e ações `✓`/`✕` no canto. O cartão inteiro leva ao contexto por *stretched link* (`after:inset-0`), sem aninhar botão em botão |
| `NotificacoesProvider` | `src/contexts/NotificacoesContext.tsx` | Origem única dos dados, montada em `src/app/admin/layout.tsx`. Nenhuma tela abre consulta própria |
| `/admin/vitrine` | `src/app/admin/vitrine/page.tsx` | Gestão dos banners: arte desktop obrigatoriamente horizontal (21:8 ou 16:9), arte mobile 16:9/4:5/9:16, prévia alternável Desktop/Celular fiel à proporção e tipografia públicas, título multilinear de até 240 caracteres, família tipográfica e peso configuráveis por banner, nove posições de texto (grade 3×3), cor/contraste, publicação, ordem e exclusão; persiste imediatamente no JSON existente. Editor e recorte são etapas sequenciais: nunca manter dois overlays ou dois focus traps montados ao mesmo tempo |
| `EditorFaixaRodape` | `src/components/admin/vitrine/EditorFaixaRodape.tsx` | Aba Cabeçalho da Vitrine: ativa/oculta a faixa promocional, edita a mensagem em linguagem comercial e mostra uma prévia fiel sem exigir caminhos de arquivo ou conhecimento técnico |
| `/admin/pedidos/novo` | `src/app/admin/pedidos/novo/page.tsx` | Venda manual da loja: catálogo permanente no desktop e `Drawer` Vaul no mobile; pedido, cliente, retirada/entrega, desconto e pagamento; não inclui mesas, comandas, cozinha ou impressão |
| `/admin/estoque` | `src/app/admin/estoque/page.tsx` | Gestão rápida do estoque: resumo por estado, busca, filtros e lista responsiva. Ajustes `− / valor / +`, zerar e bloqueio de venda ficam inline, sem modal e sem refetch integral da coleção. Cada linha comunica o estado por **barra lateral** (transparente / âmbar / vermelha), ícone no badge e quantidade colorida; aceita `?produto=<id>` para destacar e rolar até a linha vinda de uma notificação |
| `ControleEstoqueProduto` | `src/components/admin/produtos/ControleEstoqueProduto.tsx` | Controle compacto compartilhado por Estoque e Produtos; aplica atualização otimista por linha, confirma o valor atômico retornado pela RPC e reverte com feedback em erro |
| `ConfiguracoesPedidosDialog` | `src/components/admin/pedidos/ConfiguracoesPedidosDialog.tsx` | Engrenagem de `/admin/pedidos`: painel responsivo para prazos de retirada/entrega e compra mínima individual por cidade; reutiliza `configuracoes_loja` e a tabela legada `bairros`, sem criar valor global concorrente |
| Dashboard | `src/app/admin/dashboard/page.tsx` | Faixa KPI (hoje/mês) + loja compacta + fila impressão + pedidos (tabela desktop / cards mobile); sem aviso de jogo |
| `ControleStatusLoja` | `src/components/admin/ControleStatusLoja.tsx` | Status abrir/fechar + auto; edição de grade semanal em Dialog; AlertDialog de confirmação |
| `AvisoJogoBot` | `src/components/admin/AvisoJogoBot.tsx` | Config de aviso de jogo do bot — vive na aba Jogo de `/admin/whatsapp` |
| `/admin/whatsapp` | `src/app/admin/whatsapp/page.tsx` + `ConfiguracoesBot` | Conexão Evolution, notificações e automação da Carol; pausa total e pausa somente da IA são controles distintos; métricas sempre informam período e telemetria de modelo é desde o último boot; DeepSeek/OpenAI são accordions acessíveis com gasto estimado, tokens, cache, chamadas e latência por provedor |
| `AvatarUsuario` | `src/components/admin/AvatarUsuario.tsx` | Avatar Juridiq: foto ou iniciais (1ª+última palavra) + `cor`; sizes `xs`–`lg`; usa `ui/avatar` |
| `SidebarPersonalizarModal` | `src/components/admin/SidebarPersonalizarModal.tsx` | Ocultar/reordenar/renomear grupos; drag HTML5; Eye/EyeOff; persiste em `admin_sidebar_config`; no mobile fecha o Drawer da sidebar ao abrir |
| `GerenciadorVisibilidadeTelas` | `src/components/dzn/GerenciadorVisibilidadeTelas.tsx` | `/dzn`: login próprio e toggles globais por perfil; usa `Interruptor`, linhas densas e tokens semânticos |
| `GerenciadorPermissoesEquipe` | `src/components/admin/GerenciadorPermissoesEquipe.tsx` | Permissões visuais por cargo/usuário; no modo DZN também controla manutenção |
| `CardPedido` | `src/components/admin/CardPedido.tsx` | Card operacional: canal (entrega/mesa/retirada), status, itens, total; em dívida crediária o CTA explicita “Concluir e quitar”; conta quitada nunca mantém selo nem barra de Crediário; ⋯ para detalhes/editar/WhatsApp/PDF |
| `ModalDetalhesPedido` | `src/components/admin/ModalDetalhesPedido.tsx` | Visão completa e ações do pedido; aberto também via `?pedido=` em `/admin/pedidos` (deep-link do Crediário) |
| `ModalFormaPagamentoItens` | `src/components/admin/pagamento/ModalFormaPagamentoItens.tsx` | Itens, quantidades disponíveis e formas permitidas | Reutilizar para pagamento parcial no Pedido e quitação de item do Crediário; o Crediário não habilita a própria forma Crediário |
| `ModalEditarPedido` | `src/components/admin/ModalEditarPedido.tsx` | Edição de pedido existente; em `entrega` a seção Dados traz **seletor de cidade** e bairro livre. Taxa e compra mínima são derivadas da cidade; uma cidade legada permanece selecionável para evitar apagar o local ao salvar |
| `ColunaKanban`/`CardPedidoKanban` | `src/components/admin/painel/` | Painel de produção Juridiq: board horizontal snap + cards densos + MenuAcoes; pills de coluna no mobile |
| `PainelSalaoAtual` | `src/features/salao/components/PainelSalaoAtual.tsx` | Salão: pills de filtro + busca + grade de `CardMesaSalao`; dialogs de histórico/garçom |
| `CardMesaSalao` | `src/features/salao/components/CardMesaSalao.tsx` | Card operacional da mesa (tempo crítico, total, timeline, ações primárias + `MenuAcoes`) |
| `DialogNovoPedidoSalao` | `src/features/salao/components/DialogNovoPedidoSalao.tsx` | Entrada de pedido a partir do salão |
| Análise diária | `src/app/admin/analise-diaria/page.tsx` + `src/features/analise-diaria/` | KPIs **inline** + seletor de dia calendário (00h–23h59); canais exclusivamente entrega/retirada; pagamentos, produtos, horários, bairros, cancelamentos, comparativo, taxas e crediário; sem salão ou garçom |
| Relatórios | `src/app/admin/relatorios/page.tsx` | Faixa KPI + filtros de período + gráficos e PDF Fortes Fios; canais exclusivamente entrega/retirada, rankings de produtos/categorias e desempenho de entregas; loading Skeleton e tokens semânticos |
| Combos | `src/app/admin/combos/page.tsx` | Shell `max-w-6xl` + header card; busca por nome; cards densos + `MenuAcoes`; Dialog form; Empty; toast sonner |
| `BarraPagamentoParcial` | `src/components/admin/BarraPagamentoParcial.tsx` | Progresso e saldo de pagamentos |
| `PainelFinancas` | `src/features/financas/components/PainelFinancas.tsx` | Finanças Juridiq: valores ocultáveis; Receitas/Despesas/Salário; card principal com toggle **Lançamentos \| Diárias \| Lucro**; Lançamentos concentra fluxo e pagamentos, enquanto Lucro possui período, KPIs, composição, cobertura do custo, evolução de 12 meses e ranking por produto |
| `PainelLucro` | `src/features/financas/components/PainelLucro.tsx` | Visão gerencial de lucro bruto de produtos (venda líquida − custo histórico): cards responsivos, aviso de cálculo parcial, composição, cobertura, série mensal e detalhamento por produto; sempre respeita ocultação de valores |
| `GraficoComposicaoLucro` | `src/features/financas/components/GraficoComposicaoLucro.tsx` | Donut de custo × lucro com legenda numérica e margem central; trata prejuízo, loading, período vazio e privacidade dos valores |
| `ActionDialog` | `src/features/financas/components/ActionDialog.tsx` | Formulários financeiros responsivos: Dialog no desktop e Drawer Vaul no mobile, com altura pelo conteúdo limitada por `dvh`, apenas o corpo rolável, rodapé com safe-area e fechamento explícito; não usar autofocus mobile em campos monetários |
| `CardRadialFinancas` | `src/features/financas/components/CardRadialFinancas.tsx` | Card Receitas/Despesas (verde/laranja/azul + donut Chart.js) espelhando `ChartRadialStacked` do Juridiq |
| `ListaMovimentacoes` | `src/features/financas/components/ListaMovimentacoes.tsx` | Desktop: tabela Juridiq (borda-l verde/vermelho, status centralizado, row clicável). Mobile: `CardMovimentacaoFinancas`. Paginação default 15 |
| `CardMovimentacaoFinancas` | `src/features/financas/components/CardMovimentacaoFinancas.tsx` | Card mobile estilo Juridiq `FinanceTransactionCard` para lançamentos |
| `ListaPagamentos` / `ListaPedidosNaoPagos` / `ListaCrediarioPendente` | `src/features/financas/components/` | Tabelas Juridiq + cards mobile + Empty/Skeleton + paginação 15 |
| `PaginacaoFinancas` | `src/features/financas/components/PaginacaoFinancas.tsx` | Paginação estilo Juridiq (15/30/50/100 + setas) |
| `PainelCrediario` | `src/features/crediario/components/PainelCrediario.tsx` | Crediário Juridiq: faixa de resumo, pills, tabela/cards, paginação 15; modais em linguagem leiga (fiado / ainda deve); refetch silencioso; deep-link “Abrir pedido” → `/admin/pedidos?pedido=`; cobrança individual pede e salva o telefone ausente, depois exige confirmação mostrando destinatário/saldo |
| `CardContaCrediario` | `src/features/crediario/components/CardContaCrediario.tsx` | Card mobile da conta (nome + “ainda deve” + badges + `MenuAcoes`); conta aberta com saldo exibe ação direta verde com o `IconeWhatsApp` real, mesmo sem telefone cadastrado |
| `MenuAcoes` | `src/components/ui/menu-acoes.tsx` | Dropdown ⋯ padrão Juridiq (itens com ícone + variantes) — reusar em listas; `onSelect` sem `preventDefault` (fecha antes de abrir modal) |
| `PainelProdutividade` | `src/features/produtividade/components/PainelProdutividade.tsx` | Produtividade dos garçons (`/admin/produtividade`): header com pills de período (Hoje/Semana/Mês/Período) + faixa KPI inline (pontos, pedidos, entregues, vendas, perdidos, líder) |
| `CardMetasProdutividade` | `src/features/produtividade/components/` | Metas dia/semana/mês em janelas **fixas** (não seguem o filtro), com barra de progresso e CTA “Ajustar pontuação” |
| `RankingGarcons` | `src/features/produtividade/components/` | Ranking Juridiq: troféu nos 3 primeiros, selo de qualidade, tabela desktop / accordion mobile, `MenuAcoes`; quem não trabalhou no período vai para o fim sem posição |
| `GraficoPontosGarcom` / `GraficoEvolucaoPontos` | `src/features/produtividade/components/` | Barras empilhadas ganhos × perdas (Chart.js) e linha por dia operacional; com período de um dia só, a evolução cai para o mês corrente e avisa no subtítulo |
| `ListaOcorrencias` | `src/features/produtividade/components/` | “Pontos perdidos”: pedido, motivo, valor descontado; filtro por garçom em pills, paginação 15 e deep-link `/admin/pedidos?pedido=` |
| `DetalheGarcomDialog` / `ModalConfigPontuacao` | `src/features/produtividade/components/` | Composição dos pontos do garçom (quantidade × peso) e edição de pesos/metas |
| `PainelGarcons` / `ListaGarcons` | `src/components/admin/garcons/` | Dia operacional até **3h**; KPIs criados/editados/**vendas**; mobile **accordion** (avatar + Ver pedidos); sem ícone decorativo de talheres |
| Caixa operacional | `src/app/admin/caixa/page.tsx` + `src/components/admin/caixa/` | Gaveta do dia: saldo dinheiro, sangria/suprimento, fechamento com conferência; extrato estilo Crediário (`Wallet`); Finanças intocada |
| `FiltroAvancado` | `src/components/admin/filtros/FiltroAvancado.tsx` | Padrão Juridiq: botão Filtrar → Dropdown (desktop) / Sheet (mobile) com abas laterais + Limpar/Aplicar |
| `CampoSelectFiltro` | `src/components/admin/filtros/CampoSelectFiltro.tsx` | Label + Select padrão para conteúdo das abas do Filtrar |
| `FiltroPedidosAdmin` | `src/features/pedidos/components/FiltroPedidosAdmin.tsx` | Status + tipo — `/admin/pedidos` |
| `FiltroEntregasAdmin` | `src/features/entregas/components/FiltroEntregasAdmin.tsx` | Período + status + entregador — `/admin/entregas` |
| `FiltroProdutosAdmin` | `src/components/admin/produtos/FiltroProdutosAdmin.tsx` | Status / tipo / foto / categoria — `/admin/produtos` |
| `ModalFormularioProduto` | `src/components/admin/produtos/ModalFormularioProduto.tsx` | Criar/editar produto em Dialog (header/body/footer), incluindo custo, desconto com prévia e parcelamento informativo configurável entre 2x e 12x; substitui edição inline |
| `FiltroFuncionariosAdmin` | `src/components/admin/funcionarios/FiltroFuncionariosAdmin.tsx` | Função + status — `/admin/funcionarios` |
| `FiltroPedidosGarcom` | `src/components/admin/garcons/FiltroPedidosGarcom.tsx` | Abas Geral / Pagamento / Período para monitoramento de pedidos do garçom |
| `PedidosCriadosGarcom` | `src/components/admin/garcons/PedidosCriadosGarcom.tsx` | Default **hoje (3h)**; KPI **Vendas** = total do filtro (não da página); lista mobile densa com ícone por canal |
| `GerenciadorFuncionarios` | `src/components/admin/GerenciadorFuncionarios.tsx` | Funcionários Juridiq: faixa de resumo, pills, tabela/cards, Dialog shadcn, `MenuAcoes`; no **novo** funcionário, toggle **Criar acesso ao sistema** (pré-ativado) com foto, login, senha, papel e cor |
| `GerenciadorUsuariosClientes` | `src/components/admin/GerenciadorUsuariosClientes.tsx` | Clientes Juridiq: faixa de resumo, busca + pills, tabela/cards, `MenuAcoes`; modal detalhes 2 colunas (padrão Crediário); WhatsApp via `IconeWhatsApp` |
| `GerenciadorUsuariosSistema` | `src/components/admin/GerenciadorUsuariosSistema.tsx` | Acessos sistema: resumo, busca + chips função, tabela/cards, Dialog p-0, `MenuAcoes`, avatar via `ModalRecorteAvatar`; select sem `senha_hash`; no **novo** usuário, toggle **Cadastrar como funcionário** (pré-ativado) com função e telefone |
| `/admin/usuarios` | `src/app/admin/usuarios/page.tsx` | Shell Juridiq (header + Tabs); default aba clientes |
| `AppToaster` | `src/components/AppToaster.tsx` | Sonner: topo no mobile (`top-center`), topo-direita no desktop; estilos ricos |
| `ModalMovimentacao` | `src/features/financas/components/ModalMovimentacao.tsx` | Modal criar/editar receita ou despesa (layout Juridiq: descrição, valor, data, categoria, forma) |
| `StatCardsFinanceiros` | `src/features/financas/components/StatCardsFinanceiros.tsx` | Resumo legado (lucro/pedidos/a receber); substituído na tela principal pelo `CardRadialFinancas` |
| `GerenciadorImpressao` | `src/components/admin/GerenciadorImpressao.tsx` | Estado e reprocessamento da fila |
| `ConteudoPreview`/`ModalPreviewMobile` | `src/components/admin/` | Preview do cardápio público |
| `ModalRecorteImagem`/`ModalRecorteAvatar` | `src/components/admin/` | Crop em Dialog Juridiq (`primary`, header/body/footer); produto retangular, resultado do studio 4:5, banner livre ou 21:8/16:9/4:5/9:16 com preview próprio, ou avatar circular |

### Login e perfis

| Componente | Caminho | Responsabilidade |
|---|---|---|
| `TelaSelecaoPerfil` | `src/components/login/TelaSelecaoPerfil.tsx` | Seleção visual de usuário |
| `CardPerfilUsuario` | `src/components/login/CardPerfilUsuario.tsx` | Card de perfil |
| `ModalSenhaLogin` | `src/components/login/ModalSenhaLogin.tsx` | Entrada de senha |
| `TransicaoLogin` | `src/components/login/TransicaoLogin.tsx` | Transição após autenticação |
| `GarcomLayout` | `src/components/garcom/GarcomLayout.tsx` | Shell das telas do garçom |
| Novo pedido do garçom | `src/app/garcom/novo/page.tsx` | Em `entrega`, **bairro é obrigatório** (select do cadastro, acima do endereço) e a taxa vem dele; pré-preenchido pelo cliente salvo e por "repetir pedido", mas só vale se o nome existir no cadastro ativo |

## Notificações do Admin

Central interna do Admin (não é push, e-mail ou WhatsApp). Spec: `specs/central-notificacoes-admin.md`.

### Semântica de cor

- **Vermelho = urgência**, e no estoque fica reservado ao caso terminal: `esgotado` (não vende mais).
- **Âmbar = estoque baixo** — atenção, ainda vende.
- A cor do **ícone** diz *qual* é o problema; o **fio vermelho na borda esquerda** e o agrupamento em **Precisa de atenção** dizem que é urgente. São eixos separados, então "urgente" não obriga tudo a ficar vermelho.
- Não repetir o selo **Urgente** em todo cartão: com o estoque inteiro em alerta o selo vira ruído e apaga a diferença entre baixo e esgotado. A urgência já está no agrupamento e no fio da borda.
- Nunca comunicar estado só por cor: sempre acompanha texto e ícone.
- Com 4 de 5 produtos esgotados hoje, pintar estoque baixo de vermelho destruiria a hierarquia — por isso a divisão âmbar/vermelho.

### Ciclo de vida

Dois eixos, porque quem resolve o problema é a operação e quem lê é a pessoa:

```
notificação (sistema):  ativa ──────────────► resolvida
por usuário (leitura):  nova → visualizada → lida
                                 └─ dispensada (sai da lista e do badge)
```

**Dispensar tem que ter efeito nas três leituras.** `silenciada_em` mora em
`notificacoes_leitura` e precisa ser respeitado por `resumo_notificacoes`, por
`listar_notificacoes` e pelo filtro do painel. Foi exatamente aí que a primeira
versão quebrou: a coluna era gravada e nenhuma das três leituras a consultava,
então o botão parecia morto. `notificacaoVisivelNaCentral` (em
`notificacoes.mjs`) é o espelho em JS desse mesmo `where`.

Uma condição contínua gera **um** alerta ativo — garantido por índice único parcial no banco, não por disciplina de código. Resolver e reincidir gera **ocorrência nova**, que volta a aparecer.

### Regras de superfície

- O painel é `Popover` ancorado no sino no desktop e `Drawer` abaixo de 768 px; o modal de entrada usa o `Dialog` compartilhado. Camada vem de `overlay-layer.tsx`, nunca `z-index` literal.
- Consultar aviso não é decisão modal: o painel não escurece a tela nem prende o foco. Painel centrado no meio da tela perde o vínculo com o sino que a pessoa acabou de clicar.
- Cadeia `flex flex-col` + `min-h-0 flex-1 overflow-y-auto`, com rodapé fora da área que rola e `pb-[max(...,env(safe-area-inset-bottom))]`.
- Mensagem longa usa `break-words`; o modal não bloqueia o uso do sistema (Escape, clique fora e botão de 44 px).
- O modal de entrada aparece **uma vez por sessão** e no máximo com 3 itens; o excedente vira "e mais N".

### Anti-padrões desta área

- Abrir consulta de notificação dentro de uma tela: a origem é o `NotificacoesProvider`, montado uma única vez no layout.
- Contar notificação varrendo a lista para montar o badge — a lista vem truncada, o contador vem do servidor.
- Transformar toda notificação em urgente. Pedido novo é `normal`; ele só escala para urgente depois de 12 h parado.
- Tratar "não mostrar novamente" como estado local: a preferência mora no banco e precisa sobreviver a logout e a outro dispositivo.
- Gravar uma marcação de leitura sem que alguma leitura a respeite. Toda coluna de `notificacoes_leitura` precisa aparecer no `where` de quem lista **e** de quem conta.
- Empilhar três ou mais ações no rodapé do painel. São duas: marcar todas como lidas e histórico. Estado raro — "aviso ao entrar desligado" — vira aviso no corpo, com o próprio botão de reverter.

## Permissões no Admin

RBAC de Administrador e Atendente. Spec: `specs/rbac-admin.md`.

### A pergunta certa

Nunca `papel === 'atendente'`. Sempre a permissão:

```tsx
const pode = usePermissoes()
{pode('dashboard.ver_receita') ? <CardFaturamento /> : null}
```

O catálogo é `src/lib/rbac.mjs` — 15 módulos, os do menu real. Tela legada não
tem permissão porque não tem tabela no banco (PRD §Legado).

### Três camadas, e só uma é visual

| Camada | Onde | O que garante |
|---|---|---|
| Sessão | cookie `httpOnly` assinado, `/api/admin/sessao` | quem é |
| Autorização | `exigirPermissao()` no route handler | 401/403 antes de tocar no banco |
| Dados | grants do Postgres | o desvio pelo DevTools |

Esconder componente é **UX**, não segurança. Todo `if (!pode(...)) return null`
precisa de um `exigirPermissao` correspondente no servidor — senão o dado
continua a uma requisição de distância.

### Tela de Acessos

O modal usa **duas colunas a partir de `lg`** (`lg:max-w-[68rem]`): identidade e
login à esquerda em coluna fixa de `22rem`, permissões à direita com rolagem
própria. Em coluna única a lista de 15 módulos empurrava nome e senha para fora
da tela — quem configurava perdia de vista de quem era o acesso. Abaixo de 768px
o `Dialog` vira Drawer e tudo empilha.

O editor tem barra fixa no topo com contador `14 de 41`, barra de progresso e as
ações de Limpar / Padrão do atendente; sem ela, esses controles rolavam para fora
junto com os módulos. Cards de módulo em `xl:grid-cols-2`, com destaque suave
quando há algo liberado.


`GerenciadorUsuariosSistema` (aba **Acessos da equipe** em `/admin/usuarios`) com
`EditorPermissoes` (`src/components/admin/acessos/`).

- Permissões **agrupadas por módulo**, com "marcar tudo" por grupo e contador `3 de 7`. Lista corrida de 40 caixas é onde esse tipo de tela vira inútil.
- Ação que alcança número estratégico leva selo **Financeiro** (âmbar); ação que mexe em acesso leva **Acesso** (vermelho). O administrador enxerga o que está concedendo sem decorar a matriz.
- Botão **Padrão do atendente** aplica o preset como retrato completo — zera o que estava fora dele, em vez de somar por cima.
- Administrador não tem formulário: aparece um aviso de acesso total. Formulário desabilitado dá a impressão de ser configurável, e não é — admin resolve para tudo por função, não por linha em tabela.
- Trocar o papel recarrega o preset; clicar no papel **já selecionado** não faz nada, senão o clique perderia as customizações.
- A lista mostra o resumo (`Acesso total`, `14 permissões`, `Sem acesso ao Admin`) para responder "o que essa pessoa vê?" sem abrir cada usuário.

### Regras de interface

- Sidebar, ⌘K e atalhos do header filtram por `podeVerRota`. Grupo que fica sem item some inteiro, em vez de virar seção vazia.
- Rota sem permissão mostra a tela de bloqueio do `ProtectedRoute`, com o caminho de volta — não redireciona em silêncio, que deixa a pessoa sem saber o que aconteceu.
- Distinguir preferência de permissão: `telaEstaVisivel` é "o dono escondeu"; `podeVerRota` é "você não tem acesso". Os dois filtram a sidebar e não significam a mesma coisa.
- `/admin/usuarios` abre com Clientes **ou** Acessos liberado; negar a rota inteira por falta de `acessos.ver` esconderia também a lista de clientes.

### Anti-padrões desta área

- `if (role === 'atendente')` espalhado pela tela. A regra mora no catálogo, não no componente.
- Adicionar chave ao catálogo sem nenhum ponto que a leia. Foi assim que `pedidos.excluir` virou caixa decorativa: desmarcada, e o atendente excluía do mesmo jeito. `tests/rbac-cobertura.test.mjs` falha quando isso acontece.
- Botão visível que responde 403. Ação sem permissão **some**; erro de permissão em botão clicável ensina que o sistema está quebrado, não que faltou autorização.
- Conceder permissão nova sem fechar o dado no servidor: vira teatro.
- Devolver campo sensível zerado para quem não tem acesso. `receita: 0` inventa um faturamento de zero reais; o campo **ausente** diz a verdade. Ver `/api/admin/dashboard`.
- Tratar valor de pedido e faturamento como a mesma permissão. `pedidos.ver_valor` é o R$ 85,00 que o atendente precisa cobrar; `dashboard.ver_receita` é o R$ 4.580 do dia.

## WhatsApp

Regra única em `src/lib/whatsapp.mjs`. Existiam quatro construções de link
divergentes — inclusive um número fixo do projeto anterior no cabeçalho da loja,
que mandava o cliente para uma conversa que não é da Fortes Fios.

- **`api.whatsapp.com/send`, nunca `wa.me`.** No Safari do iOS o `wa.me` passa por um redirecionamento que perde o texto ou cai em "página não encontrada" quando aberto de dentro de handler. O endpoint direto resolve para o app e para o WhatsApp Web sem salto.
- **Número inválido devolve `null`, não link torto.** Link torto abre uma conversa inexistente e o usuário acha que enviou.
- **Abrir no clique, síncrono.** `window.open` depois de um `await` é tratado como popup e bloqueado no iOS: monte o link no render, não dentro do handler assíncrono.
- **Reservar aba: NUNCA com `noopener`.** A flag faz `window.open` devolver `null` por especificação — a aba abre e fica órfã em `about:blank`, sem ninguém para navegá-la ou fechá-la. Reserve sem a flag e zere `opener` depois de navegar.
- Reserve a aba **depois** de todas as guardas de validação: pedido recusado com aba reservada deixa janela em branco aberta.
- Número da loja vem de `configuracoes_loja.whatsapp_numero` via `useStatusLoja()`. Nunca fixo no código.

### Follow-ups do cliente

`SeletorFollowUp` (`src/components/admin/clientes/`) — três mensagens prontas, e
nada mais. Punhado se lê de relance; lista longa vira uma segunda decisão antes
da conversa. Cada linha traz o rótulo **e** quando usar, senão a escolha vira
adivinhação e o atendente escreve tudo do zero.

### Envio automático do pedido

A aba do WhatsApp é **reservada no clique** (`window.open('', '_blank')`), antes
do `await` que grava o pedido; quando a mensagem fica pronta, só se troca o
`location.href` da aba já aberta. Abrir depois do `await` não funciona: o
navegador já não reconhece o gesto do usuário e trata como popup — foi
exatamente por isso que o WhatsApp não abria sozinho.

Se o bloqueador recusar mesmo assim, a tela de sucesso **muda de tom**: aviso
verde "Falta enviar o pedido" e botão de 56px destacado. Quando abriu, o mesmo
botão vira "Abrir o WhatsApp de novo", secundário. Pedido gravado com mensagem
não enviada é o pior estado possível — a tela nunca deixa isso passar em branco.

A aba reservada é fechada quando o pedido falha, senão sobra uma janela em branco.

### Troco

A pergunta é **"vai pagar com quanto?"**, não uma caixa "preciso de troco"
seguida de campo vazio.

- Sugestões saem do total (`sugerirValoresTroco`), sempre acima dele. A versão anterior oferecia `[20, 50, 100, 200]` fixos — num pedido de R$ 250, as quatro eram menores que a conta.
- "Valor exato" é a primeira opção e o padrão.
- O troco aparece calculado (`Troco de R$ 25,00`) assim que o valor é escolhido.
- Valor abaixo do total é erro no campo **e** bloqueia o envio: senão o problema só aparecia na entrega.

### Pedido do cliente

A tela de sucesso do carrinho tem **Enviar pedido no WhatsApp** como ação
principal (verde) e "Entendi" como secundária. O retrato do pedido
(`resumoWhatsApp`) é capturado **no envio**: logo depois o carrinho e o
formulário são limpos e não há mais de onde tirar item, endereço ou observação.
Endereço só entra quando o tipo é entrega — em retirada esses campos trazem
sobra do pedido anterior.

## Cupons

`/admin/cupons` — `GerenciadorCupons` + `ResumoCupom`. Domínio testável em
`src/lib/cupom-formulario.mjs`.

A versão anterior veio de outro sistema: 16 campos espelhando colunas do banco,
`<select>` cru com `zinc` fixo fora do design system, e nenhuma pista do que o
cupom faria — só se descobria o efeito quando um cliente usava.

### O desenho

1. **Receitas prontas** (10%, R$ 15, frete grátis) preenchem o formulário inteiro. É o caminho de três interações para o caso que representa quase todo o uso real.
2. **Painel "Como vai funcionar"** ao lado: a frase em português (`descreverCupom`) e o efeito em reais num pedido de exemplo que o administrador ajusta (`simularCupom`). Conferir antes de salvar é o que a tela antiga não permitia.
3. **Regras avançadas colapsadas** — pedido mínimo, teto, limites de uso, validade, produto específico. Abrem já expandidas ao editar cupom que usa alguma delas, senão a pessoa edita sem ver o que está configurado.

### Regras

- **Código sugerido do desconto** (`DESCONTO10`, `MENOS15`, `FRETEGRATIS`) e reescrito enquanto ainda for sugestão. Se a pessoa digitou o dela, manda ela — sobrescrever texto digitado é hostil.
- **Erro por campo**, não um toast por vez que obriga a descobrir os problemas um a um. Só aparece depois da primeira tentativa de salvar.
- **`combo` não existe na tela.** A tabela está vazia e `/admin/combos` é rota legada; opção morta em formulário é armadilha.
- **`descricao` saiu do formulário** — era write-only, não aparecia para ninguém. Continua gravada como `null` para não mexer no schema.
- Validade é **data**, não `datetime`, e vale até o fim do dia escolhido: quem digita 31/12 espera que o dia 31 conte.
- Modal em duas colunas a partir de `lg`; abaixo de 768px o `Dialog` vira Drawer e o resumo desce para depois do formulário, sem competir com os campos.

## Frete grátis

Fonte única em `src/lib/frete.mjs`. O cálculo estava inline no `ModalCarrinho`, e
duplicar a regra é como o valor mostrado ao cliente diverge do gravado no pedido.

- **Base do limite: subtotal de produtos, antes de frete e antes de cupom.** Mesmo critério do `valor_minimo_pedido` que já existia — duas definições de "valor do pedido" fariam "faltam R$ 18" e o frete zerando discordarem.
- **Precedência:** cidade com `entrega_gratis` zera o frete sempre, inclusive com a regra global desligada. É decisão da loja sobre aquela cidade, não promoção.
- **Configuração inválida vira regra desligada.** `ativo` só vale sendo booleano de verdade; `'sim'` no banco não pode ligar frete grátis universal.
- Persiste em `configuracoes_loja` (chave/valor, já guarda JSON em outras chaves). Zero coluna nova.
- No carrinho, o progresso deriva do **mesmo** subtotal do cálculo, então remover item recalcula os dois juntos.

## Meus pedidos

`ModalPedidosCliente` sobre o `Dialog` compartilhado. A versão anterior montava
`fixed inset-0 z-[110]` + `backdrop-blur-sm` de viewport inteira à mão — burlava o
`overlay-layer.tsx`, e `backdrop-filter` em tela cheia é fonte conhecida de
pressão de memória no WebKit.

- **Nada lança no render.** Apresentação por `pedidos-cliente.mjs`: data inválida vira texto, linha sem `id` é descartada, total inválido vira zero. `format()` do date-fns estoura com data ruim, e um throw no render apaga a página.
- `new Date` diverge entre navegadores: `2026-08-16 13:38:03+00` (formato do Postgres) o Chrome aceita e o WebKit recusa. `formatarDataPedido` normaliza antes.
- **Busca por número de sequência:** cada consulta invalida a anterior. Sem isso a resposta lenta sobrescreve a rápida, e uma resposta atrasada repovoa modal já fechado.
- `LimiteDeErro` embrulha carrinho e pedidos: erro contido na área, resto do site de pé.

## Padrões de layout

### Cardápio público

- Mobile-first, com busca, categorias ilustradas em trilho horizontal, contagem de resultados, ordenação e grade responsiva. Categorias atribuíveis vêm de `categorias_cardapio`; o filtro universal usa por padrão “Todos os tipos de cabelo” e seu rótulo editável vem de `configuracoes_loja.rotulo_categoria_todos`, sem virar uma categoria artificial. No desktop, categorias quebram em linhas e o cabeçalho mantém pedidos e carrinho acessíveis.
- A introdução do catálogo preserva a assinatura oficial: “Fortes Fios” e “Tudo o que seu cabelo precisa em um só lugar.” usam a tipografia primária `.fortes-display`; “A loja de quem entende de cabelo.” fecha o bloco. Não substituir esse conteúdo por copy genérica de e-commerce.
- A abertura do catálogo usa `HeroVitrine`: imagem/carrossel full-width integrado ao fluxo, sem borda, radius, margem lateral ou moldura de card. Desktop e celular usam exatamente a proporção salva no respectivo recorte; sem arte mobile, o viewport assume a proporção horizontal da arte desktop e não a força dentro de um quadro retrato. A mídia usa `object-contain` como proteção contra um segundo recorte: uma inconsistência legada pode produzir respiro neutro, nunca zoom ou perda silenciosa da arte.
- Desktop exige recorte horizontal 21:8 ou 16:9. O celular aceita arte independente 16:9, 4:5 ou 9:16; sem arte mobile, a desktop é o fallback. A URL desktop é a fonte-base do `<picture>` e, quando existe uma arte celular, ela é declarada exclusivamente em `<source media="(max-width: 639px)">`; isso não pode depender de `srcSet` gerado por otimização. O ponto de interesse deve ser preservado no recorte de cada destino.
- Imagens públicas armazenadas no Backblaze devem passar pelo carregador central `src/lib/imagem-publica.mjs`, que preserva imagens locais/externas e converte somente URLs válidas do bucket para `/api/upload`. A rota same-origin usa retry do cliente S3 e cache público imutável; não carregar diretamente do host B2 em componentes novos, pois respostas transitórias `503` deixam a imagem quebrada até o usuário recarregar.
- O hero começa imediatamente após a navbar fixa; o `main` compensa apenas a altura do cabeçalho, sem margem visual adicional entre os dois.
- Texto sobre a arte é opcional e configurável em posição, cor, intensidade da camada de contraste, família e peso da frase principal. As opções são Quiche Sans (editorial), Bricolage Grotesque (impacto, mesma família efetivamente percebida no hero do Meu Burguer), Raleway (minimalista) e Geist (moderna); cada peso oferecido precisa ter arquivo/variação real carregada, sem negrito sintético. Banners legados permanecem em Quiche Sans leve. Se a copy já estiver incorporada à imagem, os campos ficam vazios.
- No celular o carrossel responde a swipe; paginação e pausa ficam em uma faixa de navegação abaixo da imagem, nunca sobre título/subtítulo. No desktop, permanecem sobre a área inferior do banner. Todos usam alvo mínimo de 44 px. Autoplay só ocorre com mais de um banner, oferece pausa manual persistente, suspende em hover/foco e respeita redução de movimento.
- Título e subtítulo do banner preservam quebras manuais. Editor, recorte e hero compartilham a mesma grade de alinhamento 3×3 e precisam exibir posição, contraste, overlay, fonte e peso fiéis; uma prévia com texto fixo no canto ou tipografia diferente da publicação não é válida.
- A vitrine sem banner conserva uma chamada editorial simples, sem inventar conteúdo nem bloquear o catálogo.
- Produtos sem imagem usam o estado neutro “Foto em breve”, sem símbolo de restaurante ou de outro segmento.
- O cabeçalho público usa `public/logo.webp`; favicons e ícones PWA usam os arquivos em `public/assets/`.
- Antes do catálogo, uma faixa compacta esclarece compra pelo site, entrega/retirada e acompanhamento de pedidos. Ela não substitui categorias nem produtos.
- A seção Mais vendidos vem depois do slogan e da navegação ilustrada por categorias, antes da busca do catálogo. No mobile, usa trilho horizontal com card comercial de mídia quadrada, imagem `object-cover`, parte do próximo visível e uma barra fina acumulada: ela começa com a proporção já visível e cresce até preencher o trilho conforme a rolagem; nunca deve se mover como um thumb isolado. O feedback é atualizado por frame com `transform: scaleX()`, sem estado React nem transição de duração fixa durante o scroll, para acompanhar imediatamente gesto e inércia no Safari. No desktop, vira grade de até quatro colunas. “escolhas de quem compra” usa a tipografia secundária, pequena e em caixa baixa; “Mais vendidos” usa `.fortes-display`. A variante de destaque remove categoria/descrição do corpo, centraliza nome e preço e preserva o CTA Comprar; não reutilizar a densidade nem a borda pesada do card comum.
- A seção Ofertas vem imediatamente depois de Mais vendidos e só existe quando a curadoria está ativa e resolve ao menos um produto disponível. Ela repete a presença comercial, o trilho responsivo, a barra acumulada e o CTA do destaque, mas usa selo “Oferta” e configuração independente. Quando publicada, “Ofertas” aparece antes das categorias no menu hambúrguer e leva diretamente à seção; ao ocultar, ambos desaparecem.
- No mobile, o menu público reutiliza o Sheet como painel inferior editorial: mantém margem da viewport, cantos suaves, overlay, fechamento circular centralizado sobre a borda e categorias reais em linhas tipográficas com chevron — nunca sidebar cheia com cards ativos. Instagram e WhatsApp ficam no rodapé, seguidos por pedidos, ajuda e tema. Cada ação tem alvo mínimo de 44 px, foco visível, safe-area e fechamento controlado.
- A abertura do menu público usa o movimento vertical nativo do `Sheet` em até 300 ms; conteúdo e rodapé entram com deslocamento curto e defasagem discreta, sem animar cada linha individualmente. Com `prefers-reduced-motion`, a superfície e o conteúdo aparecem sem animação.
- A seção “Produtos testados e aprovados por:” fica depois da grade completa do catálogo e antes do rodapé. A logomarca do studio é centralizada sem moldura; o carrossel usa fotos 4:5 com item central dominante, laterais parcialmente visíveis, swipe e setas discretas. Autoplay configurável pausa em hover/foco, tem controle manual e respeita `prefers-reduced-motion`.
- A edição dessa prova social pertence à área **Studio** de `/admin/vitrine`: permite ativar a seção, ajustar a chamada, configurar autoplay, adicionar até 12 fotos, recortar em 4:5, editar textos opcionais, ocultar, ordenar e remover antes de salvar. As logos `logo-salao-preta.png` e `logo-salao-branca.png` são fixas da marca e alternam automaticamente entre tema claro/escuro; nunca pedir caminho de arquivo ao lojista. O editor de item fecha antes do recorte para nunca empilhar dois modais.
- A curadoria de Mais vendidos pertence a `/admin/vitrine`: automático ordena por unidades realmente vendidas; manual permite buscar, incluir, remover e reordenar inline. A configuração usa `vitrine_produtos_mais_vendidos` em `configuracoes_loja` e não requer tabela própria.
- A curadoria de Ofertas pertence à área **Ofertas** de `/admin/vitrine`: o lojista ativa a seção, define quantidade, busca, inclui, remove e ordena produtos. Cada produto selecionado oferece um atalho inline para aplicar ou remover o desconto sem sair da Vitrine. Preço original, percentual e preço final continuam gravados no próprio produto para que catálogo, detalhe e carrinho compartilhem a mesma fonte.
- A navegação ilustrada por categorias usa o mesmo feedback acumulado no mobile: a barra representa a proporção já vista e cresce até 100%; no desktop, onde as categorias quebram em linhas, o indicador permanece oculto.
- Em `/admin/produtos`, cada grupo de categoria possui a ação explícita `Editar categoria`; o renomeio mantém os produtos vinculados. O filtro universal aparece em um bloco próprio, com explicação curta e ação `Editar nome`, pois altera apenas a nomenclatura pública e não representa uma categoria de produto.
- Trilhos públicos baseados em `overflow-x-auto` mantêm `touch-action: auto`: o navegador decide entre o swipe horizontal do trilho e a rolagem vertical da página. Nunca usar `touch-pan-x` em áreas extensas com cards ou imagens, pois o gesto iniciado nelas bloqueia a rolagem vertical no mobile. `touch-pan-y` fica reservado a carrosséis controlados por biblioteca, como Embla, que assumem o arraste horizontal.
- Cards de produto têm imagem dominante, categoria discreta, desconto, nome/preço e ação direta. Com desconto, mostram o preço original riscado, o preço final e a badge percentual. Quando `parcelamento_ativo` está ligado, mostram `{parcelas_sem_juros}x de R$ … sem juros`, entre 2x e 12x; essa informação é visual e não altera carrinho, checkout, pedido nem Mercado Pago. Tocar na imagem abre o detalhe responsivo; o detalhe repete a ação de adicionar sem iniciar o checkout automaticamente.
- O recorte de produto no admin salva uma única imagem, mas precisa pré-visualizar os dois usos reais antes da confirmação: Catálogo em 4:5 com `object-contain` e Mais vendidos em 1:1 com `object-cover`. Imagens existentes no B2 devem entrar no Canvas pela rota same-origin `/api/upload`, evitando bloqueio de CORS durante a reedição.
- Fotos dos cards usam `object-contain` para preservar frascos, kits e embalagens sem cortes; `object-cover` permanece reservado a banners editoriais.
- Checkout é modal por etapas e precisa caber em `100dvh` sem perder ações.
- O carrinho e dados básicos do cliente persistem localmente.
- No mobile, adicionar item não interrompe a escolha; o carrinho é acessado pelo item `Carrinho` do menu inferior, sem CTA adicional sobre o catálogo.
- A adição confirma por toast curto com ação opcional `Ver carrinho`; produtos com complementos seguem o mesmo feedback e nunca abrem o checkout automaticamente.
- O checkout e a confirmação de pedido usam o `Drawer` Vaul real, com conteúdo rolável e rodapé de ação sempre visível; a confirmação nunca volta ao overlay `.modal-overlay` legado. No site público, `input`, `textarea` e `select` mantêm fonte computada mínima de 16 px para impedir o zoom automático do Safari/iOS.
- Enquanto um fluxo modal estiver aberto, o menu inferior não é renderizado; superfícies Vaul usam overlay em `z-[1000]` e conteúdo em `z-[1001]`. O seletor de cidade é `DrawerNested` dentro do checkout; os overlays legados de alerta e PIX permanecem acima da superfície.
- Em entrega, cidade é seleção tarifada; bairro e endereço são entradas livres, e ponto de referência é opcional. O gatilho da cidade usa ênfase oliva e o `DrawerNested` muda claramente de contexto com cabeçalho primário, explicação curta e linhas selecionáveis com estado textual/ícone. A compra mínima usa o subtotal de produtos após descontos dos itens, antes de frete e cupom, e deve bloquear avanço e envio com mensagem que informa quanto falta. A mesma área resume os dias de entrega e a próxima data; a confirmação troca tempo em minutos pela previsão de calendário quando o pedido for entrega. Os cards Retirada e Entrega mostram seus prazos independentes, configurados pela engrenagem de Pedidos.
- A navegação inferior pública no mobile é uma dock flutuante de três destinos, e não uma barra de sistema: **Início** representa a página atual, **Pedidos** abre o acompanhamento e **Sacola** abre o carrinho com badge de quantidade. A dock usa tokens semânticos, alvos mínimos de 56 px, foco visível e incorpora `safe-area-inset-bottom` ao próprio container, sem criar uma faixa vazia separada.
- A primeira visita ao sistema inicia em modo claro. A escolha manual de tema continua disponível e persistida; o tema do sistema operacional não deve substituir o padrão da loja automaticamente.
- O checkout usa `repositionInputs={false}` no `Drawer` e mede o teclado virtual por `useAjusteTecladoVirtual` (`src/hooks/`), aplicando `height`/`maxHeight`/`bottom` em px no `DrawerContent`. O reposicionamento nativo do Vaul não serve para painel alto com formulário: ele alterna um booleano a cada `visualViewport.resize` e Safari/Chromium emitem vários por animação de teclado, congelando o painel em uma altura curta.
- Ajuda abre o `AjudaPedidoPublica` exclusivamente pela navbar; WhatsApp aparece dentro desse Drawer quando estiver configurado.
- O service worker do cardápio não roda em desenvolvimento e nunca armazena HTML nem payload RSC; misturar documentos e chunks de versões diferentes provoca divergência de hidratação.

### Administração desktop

- `/admin/vitrine` possui uma navegação segmentada compacta, no padrão de Finanças, com quatro áreas mutuamente exclusivas: **Banners**, **Mais vendidos**, **Ofertas** e **Studio**. No celular, as quatro opções formam uma grade 2×2 para preservar alvos de toque e evitar overflow. Apenas o conteúdo da área selecionada permanece visível; ações do cabeçalho devem ser contextuais à área atual, evitando uma página longa com configurações desconectadas.

### Novo pedido administrativo

- A rota `/admin/pedidos/novo` aparece em **Pedidos** e no atalho do cabeçalho. Ela é uma tela de venda: catálogo à esquerda e pedido atual à direita no desktop; no mobile, o catálogo vira o `Drawer` Vaul.
- A escolha de produtos no mobile abre o `Drawer` real em `h-[92dvh]`: cabeçalho e rodapé ficam fixos, e somente a lista interna rola. Não criar overlays paralelos, popovers ou drawers aninhados nesse fluxo.
- Todo novo controle deve usar tokens semânticos (`primary`, `input`, `ring`, `muted`, `destructive`); `primary` é o azul administrativo. O `Input` compartilhado já segue esses tokens.
- Um pedido exige nome e telefone para manter o vínculo com a base de clientes; o telefone é normalizado e não cria um cadastro duplicado.
- Ao digitar ao menos dois caracteres no nome, a venda busca `usuarios_cliente` com debounce e mostra até cinco correspondências. Escolher uma preenche telefone/endereço/bairro disponível; sem escolha, a mensagem informa que o cadastro será criado ao concluir a venda.
- Produto tem duas ações explícitas: **Adicionar** incrementa a linha padrão sem personalização; **Personalizar** abre `ModalItemPedidoAdmin` em uma linha própria (ou edita a linha selecionada). Quantidade, observação e desconto em reais pertencem à linha do produto — não há desconto global nessa tela.
- `ModalItemPedidoAdmin` usa o `Dialog` responsivo compartilhado: no desktop é modal e abaixo de 768 px vira Drawer Vaul. Ao personalizar pelo catálogo mobile, o Drawer do catálogo fecha antes do modal abrir; nunca empilhar dois overlays.
- Cards de produto são deliberadamente textuais e densos: categoria, nome, preço e duas ações visíveis. Ícones são reservados para orientação e ações inequívocas, não para decorar cada produto.

- No Dashboard, “Pedidos hoje” e “Receita hoje” seguem o dia operacional 03:00→03:00 em `America/Sao_Paulo`; o resumo mensal continua usando o mês civil selecionado.
- O `AdminLayout` é o dono do scroll vertical (`data-admin-scroll-container`) e sempre volta ao topo ao mudar de rota; telas paginadas devem reposicionar esse container sem animação antes de trocar a altura do conteúdo.
- O service worker do admin nunca armazena navegações HTML nem payloads RSC (`RSC`, `_rsc`, `text/x-component`); esses documentos precisam vir da mesma versão dos chunks do Next.
- Sidebar colapsável: **112 px** fechada (estilo Juridiq) e 224 px aberta; marca MK; item ativo com barra esquerda absoluta + `bg-primary/10` (ícones opticamente centralizados quando fechada); grupos com abreviação de 3 letras e divisores no estado colapsado.
- Scroll da sidebar desktop é preservado entre navegações (`renderSidebarContent` + restore de `scrollTop`); não redefinir o menu como componente interno do layout.
- Largura via `--largura-sidebar-admin` (`AdminLayout`); sombra leve na rail.
- Ícones da sidebar (`admin-sidebar-routes.ts`): cada rota com ícone distinto — Caixa `Wallet`, Crediário `Coins`, Finanças `Landmark`, Usuários `UserCog`, Funcionários `Contact`, Produtos `CookingPot`, Combos `Layers`, Adicionais `ListPlus`.
- `Button` (`ui/button`): variantes com tokens (`primary` / `border-border/70` / `destructive`) — sem `bordo`/`zinc`.
- Personalizar sidebar: botão no rodapé; itens ocultos no menu **Mais**; renomear grupos (lápis); config por usuário em Postgres (`admin_sidebar_config`). No mobile, abrir Personalizar fecha o Drawer do menu.
- Visibilidade global: `/dzn` controla admin e garçom. Tela desativada globalmente não aparece em nenhum menu, em **Mais**, na busca, nos atalhos ou no personalizador.
- Permissões da equipe: `/admin/usuarios` permite ao Edienai ajustar garçons e entregadores após reautenticação. Cargo usa switches; usuário usa `Padrão do cargo`, `Permitir` ou `Bloquear`.
- Modo manutenção: exclusivo do `/dzn`; módulo pausado some do menu e mostra estado bloqueado ao abrir a rota.
- Esses controles são visuais. A interface deve nomeá-los assim e nunca apresentá-los como segurança de banco.
- Avatares de usuário/funcionário/login: sempre `AvatarUsuario` (não `div` circular ad-hoc).
- Atalhos globais: `Ctrl/Cmd+K` para comando e `Alt+<tecla>` para rotas frequentes.
- Preferir faixas compactas, tabelas, listas e linhas densas às pilhas de cards.
- Conteúdo precisa continuar utilizável com sidebar colapsada e em viewport menor.
- Páginas de catálogo polidas (`/admin/bairros`, `/admin/adicionais`, `/admin/combos`): shell `mx-auto w-full max-w-5xl|6xl space-y-5`; header card `rounded-xl border border-border/70 bg-card p-4 sm:p-5` com ícone `text-primary`, contagem no subtítulo e CTAs outline+primary; listas densas com `MenuAcoes` para ações secundárias; empty via `@/components/ui/empty`.
- Em `/admin/produtos`, **Nova categoria** fica como ação `outline` visível no cabeçalho, ao lado de Novo. Ela abre Dialog/Drawer responsivo próprio e reutiliza a gravação de categoria do formulário de produto; a criação não fica escondida no select.

### Administração mobile

- Sidebar vira `Drawer` (vaul, bottom sheet) no padrão Juridiq.
- Modais usam `Dialog` responsivo (Drawer abaixo de 768px) ou `ModalSheet`.
- Listas densas (finanças, crediário, pagamentos): **cards Juridiq no mobile** (`md:hidden`) e **tabela no desktop** (`hidden md:block`).
- Paginação padrão: **15 itens/página** (opções 15/30/50/100).
- Ações primárias devem permanecer alcançáveis sem rolagem horizontal.
- Formulários longos devem agrupar campos por tarefa, sem textos explicativos redundantes.
- Evitar grid de metric cards genéricos (ícone + número em 4 colunas); preferir faixa de resumo inline no header.

### Painel Kanban (`/admin/painel`)

- Board **horizontal** no mobile (como Tarefas Juridiq): colunas `~88vw/320px`, `overflow-x-auto` + `snap-x` — **nunca** empilhar com `grid-cols-1`.
- Desktop (`md+`): as 3 colunas usam `flex-1` e ocupam 100% da largura útil (`overflow-x` desligado).
- Mobile: pills de coluna no topo (salta/scrollIntoView) + IntersectionObserver na coluna ativa.
- Cards densos: borda esquerda por canal, `MenuAcoes` para secundárias, um CTA de avanço de status; mover coluna via menu (além do drag).
- Header de coluna: badge colorido + contador circular.

### Painel Caixa (`/admin/caixa`)

- Shell Juridiq `max-w-6xl`: header com status Aberto/Fechado, saldo gaveta, CTAs Abrir / Sangria / Suprimento / Sync / Fechar.
- Tabs: **Hoje** (movimentos da sessão), **Pedidos** (sync), **Extrato** (sessões).
- Extrato desktop: tabela estilo Crediário — borda-l + `Wallet` (aberto) / `CheckCircle2` (fechado), `MenuAcoes`, paginação 15.
- Fechamento: confere **dinheiro contado** vs esperado; PIX/cartão só informativos.
- Finanças permanece independente (não redesenhar aqui).

### Operação/PDV

- Prioridade é velocidade de leitura e ação.
- Status, totais e ações devem ter hierarquia mais forte que ornamentos.
- Preservar densidade, atalhos e feedback imediato por toast.
- Visual: tokens semânticos (`background`/`card`/`primary`/`border-border/70`), Geist herdado do layout; sem tema light forçado nem hex locais. Cards de produto `rounded-lg` com hover `accent`; totais em `font-mono tabular-nums text-primary`.

### Novo pedido (`/admin/pedidos/novo`)

- Desktop (`lg+`): catálogo à esquerda; pedido atual em uma coluna `sticky` à direita. A coluna agrupa Cliente → Recebimento → Pagamento → Observação e termina no resumo monetário.
- Mobile: o catálogo abre no Drawer Vaul; cabeçalho e rodapé ficam fixos e apenas a lista rola. O pedido continua na página, sem stepper, para evitar navegação escondida em uma venda curta.
- Catálogo: **Adicionar** incrementa o produto de imediato; **Personalizar** abre o modal de quantidade, observação e desconto daquele produto. O modal aparece como Drawer no mobile e como dialog no desktop.
- Desconto é exclusivamente por produto nesta tela. O ticket exibe produtos, descontos nos itens, entrega e total; não há campo de desconto sobre o pedido inteiro.
- Tokens Juridiq em todos os controles; campos inválidos usam `border-destructive` / `aria-invalid` e recebem foco/rolagem quando a validação for implementada no próprio fluxo.
- Observação geral do pedido fica na seção final e grava `pedidos.observacoes`; instruções de produto ficam em `itens_pedido.observacoes`.

### Cadastro casado funcionário ↔ acesso

- Os dois modais de **criação** trazem um toggle **pré-ativado** que cria o outro lado do cadastro; na **edição** o toggle não aparece (quem já existe é ajustado na tela dele).
- Regras em `src/lib/cadastro-equipe.ts` — mapa papel↔função, sugestão de login e vínculo. Não duplicar essa lógica nas telas.
- Login é sugerido a partir do nome no padrão da base (`joao_pedro`, `md_chefe`) e ganha sufixo se já existir (`nome_usuario` é UNIQUE); se o admin digitar um login à mão, a sugestão para de sobrescrever.
- Ao criar o usuário com o toggle ligado, um funcionário de **mesmo nome** (ignorando acento/caixa) é reaproveitado em vez de duplicado — a base já tinha pares como “Bom Parto”/“Bom parto”.
- Falha no segundo passo não desfaz o primeiro: o toast diz o que ficou pendente, e repetir a operação reaproveita em vez de duplicar.

### Produtividade (`/admin/produtividade`)

- Shell Juridiq `max-w-6xl`; período por pills + datas nativas só no modo Período.
- Todos os recortes usam o **dia operacional 03:00→03:00**; as metas usam janelas fixas (hoje/semana/mês) e dizem isso na própria descrição.
- Pontos ganhos por pedido criado (qualquer status), entregue, item adicionado, edição e cadastro completo; descontos por nome genérico e falta de telefone/endereço. Pesos e metas editáveis no modal, valendo para todo o histórico.
- Ranking e “pontos perdidos” contam a mesma coisa: a soma dos descontos da lista bate com a coluna Perdidos do ranking.
- Números vêm de route handler (`/api/admin/produtividade*`); a tela **não** consulta o Supabase pelo client.

### Finanças / Lançamentos, Diárias e Lucro

- No card principal de `/admin/financas`, toggle **Lançamentos | Diárias | Lucro**. Cada modo possui conteúdo próprio; as tabs inferiores preservam a análise geral do caixa e os pagamentos.
- Diárias: Calendário (FullCalendar mês) ou Lista; clique no dia abre modal; cada diária vira despesa em `movimentacoes_caixa` + linha em `financas_diarias`.
- Lucro: compartilha o seletor de período de Lançamentos e reúne vendas analisadas, custo histórico, lucro bruto, margem, cobertura de custos, evolução dos últimos 12 meses e ranking por produto. Venda sem custo fica fora do lucro e gera aviso explícito de cálculo parcial.
- Mobile: toggle full-width, CTA `min-h-11`, toolbar do calendário empilhada, detalhe em `Dialog` bottom-friendly.

### Fila de impressão

- `GerenciadorImpressao` aparece no dashboard e em `/admin/impressora`.
- O botão Ativa/Pausada controla a fila automática persistida; não é estado local.
- A faixa de horário aceita período que cruza meia-noite. Horários iguais representam funcionamento contínuo.
- O controle de itens adicionados na edição é independente da fila geral.
- Impressões manuais não devem ser desabilitadas pela janela automática.

## Estados de interface

| Estado | Padrão preferido |
|---|---|
| Loading de bloco | `Skeleton` com a geometria aproximada do conteúdo |
| Loading de ação | Botão desabilitado com spinner e rótulo curto |
| Vazio | `Empty` com título curto e, quando útil, uma ação |
| Erro recuperável | Toast `sonner` ou mensagem próxima ao campo, com ação de tentar novamente |
| Confirmação destrutiva | `AlertDialog` |
| Sucesso operacional | Toast curto; não abrir modal se a ação já estiver evidente |
| Status persistente | `Badge` ou `Pill` com texto, nunca apenas cor |

O `AppToaster` posiciona notificações no **topo** (`top-center` no mobile, `top-right` no desktop). Alertas de mesa do salão podem ser ligados/desligados no menu do avatar (`Alertas de mesa`).

## Responsividade

- Evitar largura fixa fora de shells especializados como o preview de iPhone.
- Usar `min-w-0`, quebra de texto e `overflow-x-auto` em tabelas quando necessário.
- Datas nativas possuem correções globais para Safari/mobile.
- `html` e `body` bloqueiam overflow horizontal global; componentes não devem depender de conteúdo vazando.
- **Mobile (abaixo de 768px):** `Dialog` vira bottom sheet Vaul (`Drawer`) com handle e swipe para fechar (padrão Juridiq). Preferir `ModalSheet` / `Dialog` a overlays `fixed inset` manuais. Sidebar admin mobile usa o mesmo `Drawer`. `AlertDialog` sobe de baixo com handle visual (sem Vaul, para preservar Action/Cancel).
- Todo `Dialog` responsivo recebe um botão de fechar de `44×44 px` que aciona o mesmo `onOpenChange(false)` do fluxo controlado; nunca depender somente do gesto de arrastar para encerrar um drawer.
- **Modais com formulário longo:** `DialogContent` com `flex flex-col gap-0 overflow-hidden p-0`; body `min-h-0 flex-1 overflow-y-auto`; `DialogFooter` sticky com botões `h-11 w-full` no mobile e `pb-[max(1rem,env(safe-area-inset-bottom))]`. Não colocar footer dentro da área que rola.
- Desktop: `Dialog` centrado; sidebar fixa.
- Listas admin (pedidos, entregas, finanças, clientes): loading com `Skeleton` (não spinner de página inteira); vazio com `Empty`/`ListaVazia`; filtros rápidos em `ToggleGroup` pill (`CHIP_FILTRO_*`); resumo com `FiltrosAtivosChips` + Limpar tudo.

### Camadas dos overlays

`src/components/ui/overlay-layer.tsx` é a fonte única do empilhamento. Nenhum primitivo de overlay carrega `z-index` literal.

- A camada sai da **ordem de abertura**, não de um número fixo: `overlay = 1000 + p × 10`, `conteúdo = overlay + 1`, `popper = overlay + 5`, onde `p` é quantas superfícies já estavam abertas quando esta montou.
- `useCamadaSuperficie()` é para superfícies modais (`Drawer`, `Dialog`, `AlertDialog`, `Sheet`) e registra na pilha; `useCamadaOverlay()` é leitura, para `Select`, `Popover`, `DropdownMenu`, `Tooltip` e `Command`.
- A pilha é de módulo, e não só contexto de React, porque quase todo modal aninhado do admin é renderizado como **irmão** do que o abriu (`ModalDetalhesPedido`, `ModalEditarPedido`, os recortes de imagem, os avatares) — não há relação de pai/filho para herdar.
- Faixas acima da escala, reservadas: onboarding `9990–9999` e banner do PWA `10001`.
- Consumidor que precisa de uma camada própria passa `style={{ zIndex }}`, **não** classe `z-[…]`: o primitivo define o z-index inline e o inline do consumidor é o único que vence.

### Teclado virtual (iOS)

- `Drawer` desliga o `repositionInputs` do vaul por padrão. A implementação do vaul 1.1.2 *alterna* um booleano a cada `visualViewport.resize`, dessincroniza no Safari e congela o painel em uma altura curta via `style` inline.
- Quem mede é o `useAjusteTecladoVirtual` (`src/hooks/`), aplicado pelo próprio `DrawerContent`. Ele aplica **`maxHeight` + `bottom`, nunca `height`** — drawers de altura por conteúdo seriam esticados. O `style` do consumidor vence, então quem já faz o próprio ajuste (o checkout público) continua no comando.
- `dvh` não encolhe com o teclado: serve para a barra do browser, não para o teclado. Painel que precisa caber acima do teclado tem que ler o `visualViewport`.

### Campos e zoom do Safari

- Abaixo de 768 px, `input`, `textarea` e `select` do admin têm fonte computada mínima de 16 px (`globals.css`, seletor `body:has([data-admin-shell])`). Abaixo disso o Safari/iOS amplia a página ao focar o campo.
- A regra parte do `body` porque todo overlay é portalizado para lá; o marcador `data-admin-shell` é renderizado no SSR por `src/app/admin/layout.tsx`. O desktop mantém `text-sm`.
- O `:not(.text-lg, .text-xl, .text-2xl)` faz a regra **elevar** para 16 px em vez de fixar em 16 px: campo deliberadamente maior continua maior.
- `viewport` e `themeColor` vivem em `export const viewport` no layout raiz — dentro de `metadata` o Next 16 descarta os dois. Não usar `maximumScale`: bloqueia o pinch-zoom e não é o que evita o zoom ao focar.

## Acessibilidade mínima

- Manter foco visível com `focus-visible:ring-*`.
- Botões somente com ícone precisam de `aria-label`.
- Dialogs precisam de `DialogTitle`; descrição deve existir quando agregar contexto.
- Não comunicar status apenas por cor; combinar texto/ícone.
- Preservar navegação por teclado dos componentes Radix.
- Tabelas devem usar headers semânticos; paginação compartilhada já possui rótulos em português.
- Respeitar `disabled` e evitar elementos clicáveis montados em `div` sem teclado.

## Anti-padrões

- Criar primitivas locais quando existe equivalente em `src/components/ui/` ou Kibo UI.
- Hardcode de hex/HSL e cores de tema dentro de componentes novos.
- Usar aliases históricos de cor como decisão visual nova; preferir tokens semânticos.
- Empilhar cards para cada pequeno dado em dashboards.
- Excesso de radius, sombras, gradientes e animação em superfícies operacionais.
- Copy longa explicando o que o controle já mostra.
- Taxa, compra mínima ou agenda de entrega vinda de constante na UI. As três derivam da cidade ativa cadastrada na tabela legada `bairros`; bairro do endereço nunca é opção tarifada. A data prevista deve ser recalculada no servidor nos pagamentos online.
- Mudar a aparência do cardápio público como efeito colateral de uma tarefa administrativa.
- Usar Playwright para validação.
- `grid-auto-rows: 1fr` (`auto-rows-fr`) sem container com altura definida — infla linhas e gera scroll vazio após a lista/paginação.
- `h-screen` / `min-h-screen` / `calc(100vh-…)` como altura de conteúdo **dentro** do `AdminLayout` (`h-[100dvh]` + `main` com scroll) — preferir `100dvh` descontando header/padding ou altura pelo conteúdo (`py-*`).
- Sidebar mobile lateral (`Sheet` left) — no admin use `Drawer` bottom (Juridiq).
- Overlay mobile custom (`fixed inset-0` + `items-end`) — preferir `ModalSheet` / `Dialog` responsivo.
- Adicionar item e abrir o carrinho automaticamente; isso interrompe a montagem do pedido e remove o controle do usuário.
- Colocar um `DrawerContent` abaixo do próprio overlay ou reduzir localmente o z-index das primitivas compartilhadas.
- `z-index` literal em primitivo de overlay. Empilhar dois overlays com o mesmo par fixo (overlay 1000 / conteúdo 1001) faz o backdrop do filho ficar **abaixo** do conteúdo do pai — o painel de trás continua aceso por cima do escurecimento. A camada vem de `overlay-layer.tsx`.
- Overlay manual (`fixed inset-0` + backdrop próprio) em tela viva: fica sem focus trap, sem Escape, sem bloqueio de scroll e fora da escala de camadas. Use `ModalSheet` / `Dialog`.
- Bloquear scroll escrevendo em `document.body.style` e limpar com `= ''`. O vaul e o `react-remove-scroll` do Radix já bloqueiam, e o `= ''` apaga o bloqueio de um overlay alheio que ainda esteja aberto.
- Montar um modal customizado como irmão de um Drawer modal; o pai conserva o focus trap e bloqueia os eventos do irmão. Use `DrawerNested` dentro da árvore do Drawer. Subir o `z-index` **não** resolve: o Radix põe `pointer-events:none` no `body` e o `react-remove-scroll` bloqueia `touchmove`/`wheel` fora do content — o overlay aparece, mas não recebe clique nem scroll.
- Combinar altura fixa (`h-*dvh`) com o `repositionInputs` do Vaul em drawer com formulário; os dois escrevem a mesma propriedade e o inline do Vaul vence para sempre.
- `max-h-[60vh]` / `80vh` dentro de bottom sheet mobile — `vh` ignora a barra do browser no iOS; use a cadeia flex (`min-h-0 flex-1 overflow-y-auto`) com `dvh` no container.
- Cachear `/`, respostas HTML ou `text/x-component` no service worker do Next; uma versão antiga pode hidratar com chunks novos.
- Executar transições de scroll suave enquanto uma lista paginada troca cards por skeletons; a mudança simultânea de altura pode deixar o container em uma posição intermediária.

## Onboarding e Ajuda do Admin

Módulo `src/features/onboarding/` — documentação da Ajuda + tour opcional, montado uma vez em `src/app/admin/layout.tsx` (`OnboardingProvider` + `OnboardingRoot`). **Sem vídeos**. A fonte da verdade do conteúdo é o catálogo de artigos, não a lista antiga de treinamentos.

| Peça | Caminho | Responsabilidade |
|---|---|---|
| Catálogo de artigos | `help/catalogo.mjs` | Um artigo por rota real do menu (`rota → título → categoria → resumo → seções → palavras-chave`) + Notificações (virtual). Busca, contexto por rota e auditoria de cobertura. |
| Sincronia com o menu | `help/sincronizar-menu.ts` | Em desenvolvimento, alerta se o menu ganhar rota sem artigo. |
| Provider/estado | `context.tsx` | Estado global (tour ativo, etapa, progresso); `usePathname`/`useRouter`; id do usuário via `useAdminAuth`. |
| Persistência | `storage.ts` | Progresso de tour em **localStorage por usuário** (`edienai:onboarding:<userId>`). |
| Spotlight | `components/spotlight.tsx` | Overlay + recorte (SVG mask) com anel `primaryBlue`; `pointer-events:none`. |
| Popover / Sheet do tour | `components/tour-popover.tsx` (desktop), `tour-mobile-sheet.tsx` (mobile) | Etapas do tour guiado, só quando houver `TourConfig` registrado. |
| Botão Ajuda | `components/help-button.tsx` | Pílula flutuante (bottom-right, `/admin`, fora do login; some durante tour). |
| Painel Ajuda | `components/help-panel.tsx` + `module-catalog.tsx` | `Sheet` (lateral desktop / inferior mobile): artigo da tela atual, busca, índice das áreas reais (sem “Em breve”) e botão de tutorial guiado só em Finanças. |
| Engine | `engine/*` | `element-tracker`, `positioning`, `dom`, `route-match`, `use-foreign-dialog`, `demo-runner`. |

**Regra do dado de demonstração (ver AGENTS.md §0.2.5):** o alvo de um tour guiado é **simulado no cliente** e entra na UI real. O tour de Finanças injeta uma diária falsa (`demo/financas-demo-store.ts` + `FinancasDemoBridge`) no calendário/lista reais, blindada por `DIARIA_DEMO_ID`. Stores de Crediário e Painel continuam no repositório, mas os tours **não estão registrados**. Nada grava no banco para tutorial.

**Auto-start:** desligado (`autoStart: false`) — o tour **só abre pelo botão do tutorial guiado** na Ajuda de Finanças, nunca ao entrar na tela.

**Conteúdo da Ajuda:** artigos para todas as rotas de `GRUPOS_MENU_ADMIN` (Visão geral, Pedidos, Novo pedido, Pagamentos, Entregas, Equipe, Clientes e acessos, Cidades de entrega, Produtos e categorias, Estoque, Vitrine, Cupons, Finanças, Análise diária, Relatórios) e o artigo virtual Notificações. Abrir Ajuda em uma rota mostra o artigo correspondente; busca e o índice cobrem as demais áreas sem sair da página.

Tour registrado (os arquivos de Crediário e Painel existem, mas **não são registrados** — as telas estão em `ROTAS_ADMIN_OCULTAS`):

- **Finanças** (`config/financas.ts`): lucro bruto (subtotal − custo histórico do item) → Receitas / Despesas / Salário → cards → período → lançamentos → **Diárias** → Análise/Pagamentos. Diária de exemplo client-side (`demo/financas-demo-store.ts` + `FinancasDemoBridge`) injetada no calendário/lista **reais** do `PainelDiarias`, com exclusão blindada por `DIARIA_DEMO_ID`.

Âncoras de Finanças: `financas-lucro`, `financas-receita`, `financas-despesa`, `financas-salario`, `financas-cards`, `financas-periodo`, `financas-lancamentos`, `financas-toggle-principal`, `financas-nova-diaria`, `financas-diarias-conteudo`, `financas-diarias-vista`, `financas-tabs`.

## Divergências existentes a preservar até tarefa específica

- Há componentes legados com cores diretas, radius maior e classes próprias como `.card-produto`, `.modal-overlay` e `.modal-content`.
- Há mistura de componentes compartilhados, MUI e UI específica em telas antigas (migrar para tokens ao tocar a tela).
- `Button` usa tokens semânticos (`primary`/`destructive`/`border-border/70`).

Essas divergências não autorizam refatoração incidental. Reuse o padrão dominante da tela alvo e altere o sistema visual somente quando esse for o escopo explícito.
