export const ROTAS_ADMIN_REAIS = [
  '/admin/dashboard',
  '/admin/pedidos',
  '/admin/pedidos/novo',
  '/admin/formas-pagamento',
  '/admin/entregas',
  '/admin/funcionarios',
  '/admin/usuarios',
  '/admin/bairros',
  '/admin/produtos',
  '/admin/estoque',
  '/admin/vitrine',
  '/admin/cupons',
  '/admin/financas',
  '/admin/analise-diaria',
  '/admin/relatorios',
]

export const ROTAS_ADMIN_OCULTAS_AJUDA = [
  '/admin/pdv',
  '/admin/mesas',
  '/admin/salao',
  '/admin/impressora',
  '/admin/garcons',
  '/admin/produtividade',
  '/admin/painel',
  '/admin/caixa',
  '/admin/crediario',
  '/admin/combos',
  '/admin/adicionais',
  '/admin/whatsapp',
  '/admin/anos-anteriores',
]

const secao = (titulo, corpo) => ({ titulo, corpo })

export const ARTIGOS_AJUDA = [
  {
    id: 'dashboard',
    rota: '/admin/dashboard',
    titulo: 'Visão geral',
    categoria: 'Pedidos',
    palavrasChave: ['dashboard', 'visão geral', 'loja aberta', 'pedidos hoje', 'receita'],
    resumo: 'Acompanhe o dia, o mês e o status da loja num só lugar.',
    secoes: [
      secao(
        'Para que serve',
        'A Visão geral mostra quantos pedidos e quanto entrou hoje e no mês escolhido, se a loja está aberta para receber pedidos e a lista dos pedidos mais recentes.',
      ),
      secao(
        'Números do dia e do mês',
        'Os quatro indicadores são Pedidos hoje, Receita hoje, Pedidos mês e Receita mês. Use as setas do mês para olhar outro período. O ícone de olho esconde os valores quando alguém estiver perto da tela.',
      ),
      secao(
        'Abrir ou fechar a loja',
        'O controle de status abre ou fecha a loja na hora. Se o horário automático estiver ligado, a loja segue a grade da semana; se estiver desligado, só muda quando você clicar.',
      ),
      secao(
        'Pedidos recentes',
        'A lista de baixo abre o pedido para ver detalhes, editar ou gerar comprovante. Para a lista completa, use Pedidos no menu.',
      ),
    ],
  },
  {
    id: 'pedidos',
    rota: '/admin/pedidos',
    titulo: 'Pedidos',
    categoria: 'Pedidos',
    palavrasChave: ['lista', 'status', 'entrega', 'retirada', 'filtros', 'prazos'],
    resumo: 'Encontre, acompanhe e atualize os pedidos da loja.',
    secoes: [
      secao(
        'Para que serve',
        'Aqui fica o histórico operacional: cada pedido de entrega ou retirada, com status, pagamento e ações para concluir o atendimento.',
      ),
      secao(
        'Como encontrar um pedido',
        'Busque por cliente ou número. Filtre por status (Aguardando, Confirmado, Preparando, Pronto, Em entrega, Entregue, Cancelado), por tipo (Entrega ou Retirada), por situação (abertos ou encerrados) e pelo período (Hoje, 7 dias, mês e outros).',
      ),
      secao(
        'O que dá para fazer',
        'Abra o pedido para ver itens e pagamentos, edite, avance o status, registre pagamento, gere PDF ou cancele. Dá para selecionar vários de uma vez para ações em lote.',
      ),
      secao(
        'Prazos e compra mínima',
        'A engrenagem desta tela define o tempo estimado de retirada e de entrega e a compra mínima de cada cidade. Isso aparece para o cliente na hora de pedir.',
      ),
    ],
  },
  {
    id: 'pedidos-novo',
    rota: '/admin/pedidos/novo',
    titulo: 'Novo pedido',
    categoria: 'Pedidos',
    palavrasChave: ['nova venda', 'pedido manual', 'retirada', 'entrega'],
    resumo: 'Lance uma venda pelo painel, sem o cliente usar o site.',
    secoes: [
      secao(
        'Para que serve',
        'Use Nova venda quando o pedido chega por telefone, no balcão ou por outra conversa. O resultado é um pedido igual aos do site, já na lista de Pedidos.',
      ),
      secao(
        'Como montar',
        'Escolha os produtos, ajuste quantidades e observações, informe o cliente e decida entre retirada ou entrega. Na entrega, a cidade define a taxa e a compra mínima.',
      ),
      secao(
        'Estoque e pagamento',
        'Produto com estoque zerado e bloqueio ligado não entra no pedido. Ao salvar, escolha a forma de pagamento cadastrada em Pagamentos. No celular o catálogo abre em uma gaveta; no computador ele fica ao lado.',
      ),
    ],
  },
  {
    id: 'pagamentos',
    rota: '/admin/formas-pagamento',
    titulo: 'Pagamentos',
    categoria: 'Loja',
    palavrasChave: ['formas de pagamento', 'pix', 'dinheiro', 'cartão', 'troco'],
    resumo: 'Defina como a loja aceita receber pelos pedidos.',
    secoes: [
      secao(
        'Para que serve',
        'Cadastre as formas que aparecem no checkout e no pedido manual: nome, se o cliente vê, se pede troco e se há taxa.',
      ),
      secao(
        'Como usar',
        'Crie, edite, reordene ou oculte uma forma. Desativar tira a opção das vendas novas, sem apagar o histórico. Troco só faz sentido em dinheiro.',
      ),
      secao(
        'O que acontece depois',
        'Pedidos novos passam a oferecer só as formas ativas e visíveis. Taxa percentual ou fixa é informativa na forma; o total do pedido continua sendo o que foi combinado na venda.',
      ),
    ],
  },
  {
    id: 'entregas',
    rota: '/admin/entregas',
    titulo: 'Entregas',
    categoria: 'Loja',
    palavrasChave: ['em rota', 'entregador', 'pendente', 'relatórios de entrega'],
    resumo: 'Acompanhe as saídas, o status de cada entrega e o desempenho do período.',
    secoes: [
      secao(
        'Para que serve',
        'A tela reúne os pedidos de entrega: o que ainda vai sair, o que está em rota e o que já foi entregue ou cancelado.',
      ),
      secao(
        'Acompanhar e atualizar',
        'Filtre por período e por status (Pendente, Em rota, Entregue, Cancelada). Avance o status conforme a saída. Há abas de lista, de repasse aos entregadores e de relatórios do período.',
      ),
      secao(
        'Cidades e prazos',
        'Quem pode receber entrega e quanto custa o frete se configura em Cidades de entrega. Os prazos estimados ficam na engrenagem de Pedidos.',
      ),
    ],
  },
  {
    id: 'equipe',
    rota: '/admin/funcionarios',
    titulo: 'Equipe',
    categoria: 'Loja',
    palavrasChave: ['funcionários', 'colaboradores', 'salário', 'acesso'],
    resumo: 'Cadastre quem trabalha na loja e, se quiser, o acesso ao painel.',
    secoes: [
      secao(
        'Para que serve',
        'A Equipe guarda nome, telefone, tipo (administração, atendimento ou entrega) e se a pessoa está ativa. Esse cadastro alimenta o pagamento de salário em Finanças.',
      ),
      secao(
        'Acesso ao painel',
        'Ao cadastrar, você pode criar um usuário de sistema com senha. O acesso da equipe também pode ser gerido em Clientes e acessos, na aba Acessos da equipe.',
      ),
    ],
  },
  {
    id: 'usuarios',
    rota: '/admin/usuarios',
    titulo: 'Clientes e acessos',
    categoria: 'Loja',
    palavrasChave: ['clientes', 'acessos da equipe', 'usuários', 'histórico de pedidos'],
    resumo: 'Base de clientes da loja e quem pode entrar no painel.',
    secoes: [
      secao(
        'Clientes',
        'A aba Clientes lista quem já comprou, com telefone, endereço e histórico de pedidos. Use para localizar um cliente na hora de lançar ou conferir uma venda.',
      ),
      secao(
        'Acessos da equipe',
        'A segunda aba cria e edita logins do painel: usuário, senha, papel e se está ativo. Não mistura com a conta do cliente no site.',
      ),
    ],
  },
  {
    id: 'bairros',
    rota: '/admin/bairros',
    titulo: 'Cidades de entrega',
    categoria: 'Loja',
    palavrasChave: ['cidades de entrega', 'taxa', 'frete', 'compra mínima', 'dias de entrega'],
    resumo: 'Onde a loja entrega, em quais dias, com qual taxa e compra mínima.',
    secoes: [
      secao(
        'Para que serve',
        'Cada cidade (o nome da tela veio de “bairros”, mas o cadastro é por cidade) define se está ativa, a taxa, se o frete é grátis, o valor mínimo do pedido e os dias da semana em que há entrega.',
      ),
      secao(
        'Como cadastrar',
        'Use Nova cidade, preencha taxa e mínimo e marque os dias. Cidade inativa some do checkout. Prazos estimados e mínimos também podem ser ajustados pelo atalho Prazos e mínimos, que abre a engrenagem de Pedidos.',
      ),
      secao(
        'O que o cliente vê',
        'No site, a cidade escolhida calcula o frete, avisa a compra mínima e mostra os próximos dias de entrega. Bairro e endereço o cliente preenche livremente.',
      ),
    ],
  },
  {
    id: 'produtos',
    rota: '/admin/produtos',
    titulo: 'Produtos e categorias',
    categoria: 'Catálogo',
    palavrasChave: ['catálogo', 'preço', 'desconto', 'parcelamento', 'categorias', 'disponível no catálogo'],
    resumo: 'Cadastre produtos, organize categorias e defina preço, desconto e visibilidade.',
    secoes: [
      secao(
        'Para que serve',
        'Esta é a ficha do produto: nome, foto, categoria, preço, desconto, parcelamento apenas informativo, custo de compra, estoque e se aparece no site.',
      ),
      secao(
        'Categorias',
        'Crie, renomeie, reordene ou exclua categorias. O filtro geral do site (o que reúne tudo) também pode ser renomeado aqui — ele não é uma categoria atribuída a produto.',
      ),
      secao(
        'Disponível no catálogo',
        'Desligar “Disponível no catálogo” oculta o item no site, mesmo que ainda exista quantidade. Isso é diferente de estoque zerado: quantidade zero só impede a venda se “Bloquear venda no zero” estiver ligado, na ficha ou em Estoque.',
      ),
      secao(
        'Preço, desconto e parcelamento',
        'O desconto grava o preço original e o percentual; o preço final é o que vai para o carrinho. Parcelamento (2x a 12x) só aparece no site como informação, não entra no pedido.',
      ),
    ],
  },
  {
    id: 'estoque',
    rota: '/admin/estoque',
    titulo: 'Estoque',
    categoria: 'Catálogo',
    palavrasChave: [
      'quantidade',
      'estoque baixo',
      'esgotado',
      'em estoque',
      'bloquear venda no zero',
      'aumentar',
      'diminuir',
      'zerar',
    ],
    resumo: 'Veja a quantidade de cada produto e ajuste sem abrir a ficha completa.',
    secoes: [
      secao(
        'Visão geral',
        'A tela lista todos os produtos com a quantidade atual. Os três cards no topo contam quantos estão em estoque, com estoque baixo e esgotados. Busque por nome ou categoria e use os filtros para ver só um estado.',
      ),
      secao(
        'Quantidade disponível',
        'O número ao lado do produto é a quantidade física atual. Ele cai sozinho quando um pedido é criado e volta se o item é removido ou o pedido é cancelado.',
      ),
      secao(
        'Estoque baixo e esgotados',
        'Estoque baixo aparece quando a quantidade é maior que zero e chegou no limite “alerta em” daquele produto (o padrão ao cadastrar é 5). Esgotado é quantidade zero. O estado não é um campo separado: o sistema calcula na hora.',
      ),
      secao(
        'Alertas visuais',
        'Estoque baixo ganha barra e quantidade em âmbar, com selo de aviso. Esgotado usa vermelho na barra, na quantidade e no card Esgotados. Em estoque permanece neutro. O sino do canto superior também avisa estoque baixo e esgotado; ao tocar, a linha do produto vem destacada nesta tela.',
      ),
      secao(
        'Como aumentar, diminuir ou zerar',
        'Na própria linha, o botão + aumenta 1, o − diminui 1 e o campo do meio aceita a quantidade digitada. O ícone ao lado zera o estoque. A alteração vale na hora, sem abrir outro formulário. O mesmo controle compacto existe na ficha em Produtos e categorias.',
      ),
      secao(
        'Quando o estoque chega a zero',
        'A opção “Bloquear venda no zero” decide o que acontece. Ligada: o produto continua visível no site como esgotado e ninguém consegue comprar. Desligada: a quantidade zero não impede a venda — o item continua vendável.',
      ),
      secao(
        'Esgotado não é a mesma coisa que indisponível',
        'Quantidade zero com bloqueio ligado = esgotado, visível, sem compra. “Disponível no catálogo” desligado em Produtos e categorias = o item some do site, mesmo com estoque. São dois controles diferentes: um é quantidade, o outro é se o produto entra no catálogo.',
      ),
    ],
  },
  {
    id: 'vitrine',
    rota: '/admin/vitrine',
    titulo: 'Vitrine',
    categoria: 'Catálogo',
    palavrasChave: ['banners', 'mais vendidos', 'ofertas', 'studio', 'cabeçalho', 'faixa'],
    resumo: 'Monte o que o cliente vê no site: banners, destaques, ofertas, studio e aviso do topo.',
    secoes: [
      secao(
        'Finalidade',
        'A Vitrine controla a vitrine pública da loja, não o cadastro do produto. O que você publica aqui aparece no site na mesma ordem das abas: banners, mais vendidos, ofertas, resultados do studio e a faixa do cabeçalho.',
      ),
      secao(
        'Banners',
        'Adicione artes para computador (horizontal) e para celular, recorte, título, posição do texto, contraste e publique ou oculte. Banners ocultos ficam guardados e não entram no carrossel. A ordem da lista é a ordem no site.',
      ),
      secao(
        'Mais vendidos',
        'Escolha Automático (ranking pelas vendas reais de entrega e retirada, sem cancelados) ou Manual (você escolhe e ordena). Defina quantos produtos aparecem, entre 4 e 12, e salve a seleção.',
      ),
      secao(
        'Ofertas',
        'Curadoria manual: ligue a seção, escolha os produtos, a ordem e o percentual de desconto. O desconto é o mesmo do produto — a Vitrine só é um atalho para editar. A seção some do site se estiver desligada ou sem itens disponíveis.',
      ),
      secao(
        'Studio',
        'Prova social da loja: logo e fotos de resultado. Só fotos publicadas aparecem. Se não houver nenhum resultado ativo, a seção some do site.',
      ),
      secao(
        'Cabeçalho',
        'Faixa fina acima do menu do site, com uma mensagem comercial. Liga ou desliga e edita o texto. Ela não altera frete, mínimo nem total do pedido.',
      ),
    ],
  },
  {
    id: 'cupons',
    rota: '/admin/cupons',
    titulo: 'Cupons',
    categoria: 'Catálogo',
    palavrasChave: ['desconto', 'código', 'frete grátis', 'pedido mínimo'],
    resumo: 'Crie códigos de desconto para o pedido ou para um produto.',
    secoes: [
      secao(
        'Para que serve',
        'O cliente informa o código no checkout. O cupom pode ser percentual ou valor fixo, valer no pedido inteiro ou só em um produto, exigir pedido mínimo e ter prazo e limite de usos.',
      ),
      secao(
        'Como criar',
        'Defina código, tipo de desconto, onde se aplica (pedido ou produto específico), validade e se está ativo. Dá para limitar usos totais ou por cliente. Acompanhe quantas vezes cada cupom já foi usado.',
      ),
    ],
  },
  {
    id: 'financas',
    rota: '/admin/financas',
    titulo: 'Finanças',
    categoria: 'Gestão',
    palavrasChave: [
      'financeiro',
      'lucro bruto',
      'receitas',
      'despesas',
      'diárias',
      'margem bruta',
      'custo dos produtos',
    ],
    resumo: 'Lançamentos do caixa, diárias e o lucro bruto dos produtos vendidos.',
    secoes: [
      secao(
        'Três áreas',
        'Finanças tem Lançamentos (entradas e saídas), Diárias (pagamento avulso) e Lucro (resultado dos produtos). O período no topo — mês com setas ou o atalho de hoje — vale para as três. O olho ao lado do título esconde os valores da tela.',
      ),
      secao(
        'Receitas',
        'O total de receitas soma os pedidos do período com as entradas manuais (botão Receitas). Pedidos já entram sozinhos. Use a entrada manual só para um valor que não veio de pedido. Os cards mostram o que já foi recebido.',
      ),
      secao(
        'Despesas, salário e diárias',
        'O botão Despesas lança uma saída com categoria, valor e data. Salário registra o pagamento ligado a alguém da Equipe. Em Diárias você anota quem trabalhou avulso; ao salvar, vira despesa no mesmo período. Os cards de despesas mostram o que já foi pago.',
      ),
      secao(
        'Filtros de Lançamentos',
        'Todos, A receber, Somente Receitas e Somente Despesas. A receber lista pedidos ainda sem pagamento. Há busca, gráfico de fluxo (receita, despesa e diferença no período) e a lista linha a linha para editar ou apagar um lançamento manual.',
      ),
      secao(
        'O que o Lucro representa',
        'Lucro bruto dos produtos não é o dinheiro que sobrou no caixa. É a venda líquida do item (o subtotal) menos o custo de compra gravado naquele item no momento da venda. Pedidos cancelados, aguardando pagamento ou pendentes ficam de fora.',
      ),
      secao(
        'Como o Lucro é calculado',
        'Só entram unidades com custo registrado. O sistema soma (subtotal − custo × quantidade) desses itens. Vendas sem custo não entram no lucro e aparecem no aviso “O lucro deste período é parcial”. Mudar o custo do produto depois não altera vendas já feitas: vale o valor histórico do item.',
      ),
      secao(
        'Cards, gráficos e ranking',
        'Vendas analisadas = subtotal dos itens com custo. Custo dos produtos = soma desses custos. Lucro bruto = diferença. Margem bruta = lucro bruto dividido pelas vendas analisadas. Há composição custo × lucro, cobertura (quanto das vendas tem custo), evolução mensal e ranking por produto.',
      ),
    ],
  },
  {
    id: 'analise-diaria',
    rota: '/admin/analise-diaria',
    titulo: 'Análise diária',
    categoria: 'Gestão',
    palavrasChave: ['dia', 'ticket médio', 'canais', 'horários', 'cancelamentos'],
    resumo: 'Retrato de um dia calendário, das 00h às 23h59.',
    secoes: [
      secao(
        'Para que serve',
        'Escolha um dia no calendário e veja faturamento, quantidade de pedidos, ticket médio e entregas, com variação em relação a ontem.',
      ),
      secao(
        'O que tem em cada bloco',
        'Pedidos por canal (entrega e retirada), formas de pagamento, produtos mais vendidos, horários de pico, entregas por bairro, cancelamentos, comparativo com ontem e com o mesmo dia da semana anterior, e taxas de entrega.',
      ),
    ],
  },
  {
    id: 'relatorios',
    rota: '/admin/relatorios',
    titulo: 'Relatórios',
    categoria: 'Gestão',
    palavrasChave: ['pdf', 'período', 'ticket', 'crescimento', 'ranking'],
    resumo: 'Vendas e desempenho do período escolhido, com exportação em PDF.',
    secoes: [
      secao(
        'Para que serve',
        'Os indicadores do topo são receita, pedidos, ticket médio e crescimento no período. Os gráficos mostram vendas por dia, horários, formas de pagamento, ranking de produtos e categorias, e desempenho das entregas (por período e por local).',
      ),
      secao(
        'Período e PDF',
        'Ajuste as datas e atualize. O botão PDF baixa o relatório do intervalo visível na tela. Entram só entrega e retirada.',
      ),
    ],
  },
  {
    id: 'notificacoes',
    rota: null,
    virtual: true,
    titulo: 'Notificações',
    categoria: 'Pedidos',
    palavrasChave: ['sino', 'alertas', 'estoque baixo', 'esgotado', 'pedido parado'],
    resumo: 'O sino do topo avisa estoque baixo, produto esgotado e pedido esperando atendimento.',
    secoes: [
      secao(
        'Onde fica',
        'O sino fica no alto do painel, ao lado do tema e da sua conta. O número são os alertas ainda não lidos. Vermelho no selo significa que há algo urgente.',
      ),
      secao(
        'O que chega',
        'Estoque baixo, produto esgotado e pedido parado há tempo demais. Tocar no item abre o estoque na linha do produto ou o pedido correspondente.',
      ),
      secao(
        'Como usar',
        'Marque como lida, dispense ou veja as já resolvidas. Na primeira entrada do dia pode aparecer um resumo; “Não mostrar novamente” desliga esse aviso e pode ser reativado no rodapé do painel.',
      ),
    ],
  },
]

const ORDEM_CATEGORIAS = ['Pedidos', 'Loja', 'Catálogo', 'Gestão']

const normalizarBusca = (valor) =>
  String(valor || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const caminhoDaRota = (pathname) => String(pathname || '').split('?')[0]

const rotaCasaComCaminho = (rota, pathname) =>
  pathname === rota || pathname.startsWith(`${rota}/`)

const textoIndexavel = (artigo) =>
  normalizarBusca(
    [
      artigo.titulo,
      artigo.categoria,
      artigo.resumo,
      ...(artigo.palavrasChave || []),
      ...artigo.secoes.flatMap((item) => [item.titulo, item.corpo]),
    ].join(' '),
  )

export const obterArtigoPorRota = (pathname) => {
  const caminho = caminhoDaRota(pathname)
  const candidatos = ARTIGOS_AJUDA.filter(
    (artigo) => !artigo.virtual && artigo.rota && rotaCasaComCaminho(artigo.rota, caminho),
  )
  if (candidatos.length === 0) return null
  return candidatos.sort((a, b) => b.rota.length - a.rota.length)[0]
}

const pontuarArtigo = (artigo, termo) => {
  const titulo = normalizarBusca(artigo.titulo)
  const palavras = (artigo.palavrasChave || []).map(normalizarBusca)
  const resumo = normalizarBusca(artigo.resumo)
  const categoria = normalizarBusca(artigo.categoria)
  const corpo = textoIndexavel(artigo)
  if (titulo === termo) return 100
  if (palavras.some((palavra) => palavra === termo)) return 90
  if (titulo.includes(termo)) return 80
  if (palavras.some((palavra) => palavra.includes(termo))) return 70
  if (resumo.includes(termo) || categoria.includes(termo)) return 50
  if (corpo.includes(termo)) return 20
  return 0
}

export const buscarArtigos = (termo) => {
  const normalizado = normalizarBusca(termo)
  if (!normalizado) return []
  return ARTIGOS_AJUDA.map((artigo) => ({
    artigo,
    pontos: pontuarArtigo(artigo, normalizado),
  }))
    .filter((item) => item.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((item) => item.artigo)
}

export const listarArtigosPorCategoria = () =>
  ORDEM_CATEGORIAS.map((categoria) => ({
    categoria,
    artigos: ARTIGOS_AJUDA.filter((artigo) => artigo.categoria === categoria),
  })).filter((grupo) => grupo.artigos.length > 0)

export const auditarCoberturaAjuda = () => {
  const rotasComArtigo = new Set(
    ARTIGOS_AJUDA.filter((artigo) => !artigo.virtual && artigo.rota).map((artigo) => artigo.rota),
  )
  const faltando = ROTAS_ADMIN_REAIS.filter((rota) => !rotasComArtigo.has(rota))
  const extrasOcultos = ARTIGOS_AJUDA.filter((artigo) => {
    if (!artigo.rota) return false
    return ROTAS_ADMIN_OCULTAS_AJUDA.some(
      (oculta) => artigo.rota === oculta || artigo.rota.startsWith(`${oculta}/`),
    )
  }).map((artigo) => artigo.rota)
  return { faltando, extrasOcultos }
}
