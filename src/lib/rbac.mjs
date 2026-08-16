/**
 * Catálogo de permissões do Admin.
 *
 * Fonte única da verdade: nenhuma tela deve perguntar `papel === 'atendente'`.
 * A pergunta certa é sempre `podeExecutar(permissoes, 'financas.ver')`.
 *
 * Segue o padrão de `controle-acesso.ts` (módulo → ações → chave `modulo.acao`
 * → normalização → resolução em camadas), mas para os perfis que este projeto
 * realmente tem. Os módulos de garçom/entregador de lá pertencem a fluxos que
 * não existem aqui.
 *
 * Espelhado em JS puro, como `notificacoes.mjs`, para ser testável sem banco e
 * para que o servidor e o cliente resolvam permissão pela MESMA função.
 *
 * Spec: specs/rbac-admin.md
 */

export const PAPEIS = {
  ADMIN: 'admin',
  ATENDENTE: 'atendente',
}

/** Papéis que entram pelo `/admin` e resolvem permissão. */
export const PAPEIS_ADMIN = [PAPEIS.ADMIN, PAPEIS.ATENDENTE]

/**
 * Tudo que a coluna `papel` aceita. `garcom` e `entregador` continuam graváveis
 * porque a tela de Equipe ainda cria esses cadastros, mas resolvem para conjunto
 * vazio: existir como linha não é o mesmo que ter acesso ao Admin.
 */
export const PAPEIS_VALIDOS = [PAPEIS.ADMIN, PAPEIS.ATENDENTE, 'garcom', 'entregador']

/**
 * Sensibilidade do dado que a ação alcança:
 *   - `operacional`: o atendente precisa disso para trabalhar;
 *   - `estrategica`: número que descreve o negócio (faturamento, lucro, custo);
 *   - `critica`: mexe em quem tem acesso ao sistema.
 * É o eixo que separa "ver R$ 85,00 de um pedido" de "ver R$ 4.580 do dia".
 */
export const SENSIBILIDADES = {
  OPERACIONAL: 'operacional',
  ESTRATEGICA: 'estrategica',
  CRITICA: 'critica',
}

const acao = (id, rotulo, sensibilidade = SENSIBILIDADES.OPERACIONAL) => ({
  id,
  rotulo,
  sensibilidade,
})

/**
 * Só os 15 módulos que existem no menu real (`admin-sidebar-routes.ts`).
 * Tela legada sem tabela no banco não ganha permissão — ver PRD §Legado.
 */
export const MODULOS_ADMIN = [
  {
    id: 'dashboard',
    nome: 'Visão geral',
    rota: '/admin/dashboard',
    acoes: [
      acao('ver', 'Acessar a visão geral'),
      acao('ver_receita', 'Ver faturamento e ticket médio', SENSIBILIDADES.ESTRATEGICA),
    ],
  },
  {
    id: 'pedidos',
    nome: 'Pedidos',
    rota: '/admin/pedidos',
    acoes: [
      acao('ver', 'Ver pedidos'),
      acao('ver_valor', 'Ver o valor do pedido'),
      acao('criar', 'Registrar venda'),
      acao('editar', 'Editar pedido'),
      acao('mudar_status', 'Atualizar status'),
      acao('cancelar', 'Cancelar pedido'),
      acao('excluir', 'Excluir pedido'),
    ],
  },
  {
    id: 'produtos',
    nome: 'Produtos e categorias',
    rota: '/admin/produtos',
    acoes: [
      acao('ver', 'Ver produtos'),
      acao('criar', 'Criar produto'),
      acao('editar', 'Editar produto'),
      acao('excluir', 'Excluir produto'),
      acao('ver_custo', 'Ver custo e margem', SENSIBILIDADES.ESTRATEGICA),
    ],
  },
  {
    id: 'estoque',
    nome: 'Estoque',
    rota: '/admin/estoque',
    acoes: [acao('ver', 'Ver estoque'), acao('ajustar', 'Ajustar quantidade')],
  },
  {
    id: 'vitrine',
    nome: 'Vitrine',
    rota: '/admin/vitrine',
    acoes: [acao('ver', 'Ver vitrine'), acao('editar', 'Editar vitrine')],
  },
  {
    id: 'cupons',
    nome: 'Cupons',
    rota: '/admin/cupons',
    acoes: [acao('ver', 'Ver cupons'), acao('editar', 'Criar e editar cupons')],
  },
  {
    id: 'pagamentos',
    nome: 'Pagamentos',
    rota: '/admin/formas-pagamento',
    acoes: [acao('ver', 'Ver formas de pagamento'), acao('editar', 'Editar formas de pagamento')],
  },
  {
    id: 'entregas',
    nome: 'Entregas',
    rota: '/admin/entregas',
    acoes: [acao('ver', 'Ver entregas'), acao('editar', 'Editar entregas')],
  },
  {
    id: 'bairros',
    nome: 'Cidades de entrega',
    rota: '/admin/bairros',
    acoes: [acao('ver', 'Ver cidades'), acao('editar', 'Editar cidades e taxas')],
  },
  {
    id: 'clientes',
    nome: 'Clientes',
    rota: '/admin/usuarios',
    acoes: [acao('ver', 'Ver clientes'), acao('editar', 'Editar clientes')],
  },
  {
    id: 'equipe',
    nome: 'Equipe',
    rota: '/admin/funcionarios',
    acoes: [
      acao('ver', 'Ver equipe'),
      acao('editar', 'Editar equipe', SENSIBILIDADES.ESTRATEGICA),
    ],
  },
  {
    id: 'financas',
    nome: 'Finanças',
    rota: '/admin/financas',
    acoes: [
      acao('ver', 'Ver finanças', SENSIBILIDADES.ESTRATEGICA),
      acao('criar', 'Criar lançamento', SENSIBILIDADES.ESTRATEGICA),
      acao('editar', 'Editar lançamento', SENSIBILIDADES.ESTRATEGICA),
      acao('excluir', 'Excluir lançamento', SENSIBILIDADES.ESTRATEGICA),
    ],
  },
  {
    id: 'analise',
    nome: 'Análise diária',
    rota: '/admin/analise-diaria',
    acoes: [acao('ver', 'Ver análise diária', SENSIBILIDADES.ESTRATEGICA)],
  },
  {
    id: 'relatorios',
    nome: 'Relatórios',
    rota: '/admin/relatorios',
    acoes: [acao('ver', 'Ver relatórios', SENSIBILIDADES.ESTRATEGICA)],
  },
  {
    id: 'acessos',
    nome: 'Acessos da equipe',
    rota: '/admin/usuarios',
    acoes: [
      acao('ver', 'Ver acessos', SENSIBILIDADES.CRITICA),
      acao('criar', 'Criar acesso', SENSIBILIDADES.CRITICA),
      acao('editar', 'Editar acesso', SENSIBILIDADES.CRITICA),
      acao('permissoes', 'Alterar permissões', SENSIBILIDADES.CRITICA),
      acao('excluir', 'Excluir acesso', SENSIBILIDADES.CRITICA),
    ],
  },
]

/** @param {string} modulo @param {string} nomeAcao */
export const chave = (modulo, nomeAcao) => `${modulo}.${nomeAcao}`

export const CHAVES_RBAC = MODULOS_ADMIN.flatMap((modulo) =>
  modulo.acoes.map((item) => chave(modulo.id, item.id)),
)

const CHAVES_VALIDAS = new Set(CHAVES_RBAC)

/**
 * Preset do Atendente: acesso operacional completo, nenhum número estratégico,
 * nenhuma tela de configuração da loja, nenhum acesso a Acessos.
 * É ponto de partida editável, não regra fixa.
 */
export const PRESET_ATENDENTE = Object.freeze({
  'dashboard.ver': true,
  'pedidos.ver': true,
  'pedidos.ver_valor': true,
  'pedidos.criar': true,
  'pedidos.editar': true,
  'pedidos.mudar_status': true,
  'produtos.ver': true,
  'estoque.ver': true,
  'estoque.ajustar': true,
  'pagamentos.ver': true,
  'entregas.ver': true,
  'bairros.ver': true,
  'clientes.ver': true,
})

export const PRESETS_POR_PAPEL = {
  [PAPEIS.ATENDENTE]: PRESET_ATENDENTE,
}

/** Todas as chaves em `true` — o conjunto do Administrador. */
export const permissoesTotais = () =>
  Object.fromEntries(CHAVES_RBAC.map((item) => [item, true]))

/**
 * Descarta chave desconhecida e valor que não seja booleano. Sem isso, um POST
 * adulterado plantaria `{"financas.ver": "sim"}` no jsonb do usuário.
 *
 * @param {unknown} valor
 */
export const normalizarPermissoes = (valor) => {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {}

  const resultado = {}
  for (const [item, permitido] of Object.entries(valor)) {
    if (!CHAVES_VALIDAS.has(item)) continue
    if (typeof permitido !== 'boolean') continue
    resultado[item] = permitido
  }
  return resultado
}

/**
 * Resolução em camadas: preset do papel → overrides do usuário.
 *
 * Duas regras que não se negociam:
 *   - `admin` devolve tudo, sempre. Não depende de linha em tabela, então não
 *     existe estado em que um administrador se tranque para fora.
 *   - usuário inativo devolve conjunto vazio, mesmo sendo admin.
 *
 * @param {{ papel?: string, ativo?: boolean, permissoes?: unknown }} usuario
 */
export const resolverPermissoes = (usuario) => {
  if (!usuario || usuario.ativo === false) return {}
  if (usuario.papel === PAPEIS.ADMIN) return permissoesTotais()

  const preset = PRESETS_POR_PAPEL[usuario.papel]
  if (!preset) return {}

  return { ...preset, ...normalizarPermissoes(usuario.permissoes) }
}

/**
 * @param {Record<string, boolean>} permissoes
 * @param {string} item
 */
export const podeExecutar = (permissoes, item) =>
  Boolean(permissoes && permissoes[item] === true)

const ROTAS_EXIGIDAS = new Map([
  ['/admin/dashboard', 'dashboard.ver'],
  ['/admin/pedidos', 'pedidos.ver'],
  ['/admin/pedidos/novo', 'pedidos.criar'],
  ['/admin/formas-pagamento', 'pagamentos.ver'],
  ['/admin/entregas', 'entregas.ver'],
  ['/admin/funcionarios', 'equipe.ver'],
  ['/admin/bairros', 'bairros.ver'],
  ['/admin/produtos', 'produtos.ver'],
  ['/admin/estoque', 'estoque.ver'],
  ['/admin/vitrine', 'vitrine.ver'],
  ['/admin/cupons', 'cupons.ver'],
  ['/admin/financas', 'financas.ver'],
  ['/admin/analise-diaria', 'analise.ver'],
  ['/admin/relatorios', 'relatorios.ver'],
])

/**
 * Permissão exigida por uma rota do Admin, ou `null` quando a rota não é
 * controlada (login, 404). `/admin/usuarios` tem duas abas e basta uma delas.
 *
 * @param {string} rota
 */
export const permissaoDaRota = (rota) => {
  if (typeof rota !== 'string' || !rota) return null

  const limpa = rota.split('?')[0].replace(/\/+$/, '') || '/'
  if (ROTAS_EXIGIDAS.has(limpa)) return ROTAS_EXIGIDAS.get(limpa)

  // Detalhe e edição de pedido herdam a permissão da listagem.
  if (/^\/admin\/pedidos\/[^/]+(\/editar)?$/.test(limpa)) return 'pedidos.ver'
  return null
}

/**
 * `/admin/usuarios` abre com qualquer uma das duas abas liberadas — negar a
 * rota inteira porque falta `acessos.ver` esconderia também a lista de clientes.
 *
 * @param {string} rota
 * @param {Record<string, boolean>} permissoes
 */
export const podeVerRota = (rota, permissoes) => {
  const limpa = typeof rota === 'string' ? rota.split('?')[0].replace(/\/+$/, '') : ''
  if (limpa === '/admin/usuarios') {
    return podeExecutar(permissoes, 'clientes.ver') || podeExecutar(permissoes, 'acessos.ver')
  }

  const exigida = permissaoDaRota(rota)
  return exigida === null ? true : podeExecutar(permissoes, exigida)
}

/**
 * Ninguém edita as próprias permissões — nem administrador. Evita tanto
 * escalonamento quanto o admin se trancar para fora por engano.
 *
 * @param {{ id?: string, permissoes?: Record<string, boolean> }} ator
 * @param {{ id?: string }} alvo
 */
export const podeEditarPermissoesDe = (ator, alvo) => {
  if (!ator?.id || !alvo?.id) return false
  if (ator.id === alvo.id) return false
  return podeExecutar(ator.permissoes, 'acessos.permissoes')
}
