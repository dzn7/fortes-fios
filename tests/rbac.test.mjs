import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CHAVES_RBAC,
  MODULOS_ADMIN,
  PAPEIS,
  PAPEIS_VALIDOS,
  PRESET_ATENDENTE,
  SENSIBILIDADES,
  chave,
  normalizarPermissoes,
  podeEditarPermissoesDe,
  podeExecutar,
  podeVerRota,
  permissaoDaRota,
  permissoesTotais,
  resolverPermissoes,
} from '../src/lib/rbac.mjs'

const admin = (sobrescritas = {}) => ({
  id: 'usuario-admin',
  papel: PAPEIS.ADMIN,
  ativo: true,
  permissoes: {},
  ...sobrescritas,
})

const atendente = (sobrescritas = {}) => ({
  id: 'usuario-atendente',
  papel: PAPEIS.ATENDENTE,
  ativo: true,
  permissoes: {},
  ...sobrescritas,
})

// 1. administrador alcança todo o Admin
test('administrador resolve todas as chaves do catálogo', () => {
  const permissoes = resolverPermissoes(admin())

  assert.equal(Object.keys(permissoes).length, CHAVES_RBAC.length)
  for (const item of CHAVES_RBAC) {
    assert.equal(podeExecutar(permissoes, item), true, `faltou ${item}`)
  }
})

// 2. chave desconhecida não entra
test('normalização descarta chave fora do catálogo e valor não booleano', () => {
  assert.deepEqual(
    normalizarPermissoes({
      'financas.ver': true,
      'financas.inventada': true,
      'pedidos.ver': 'sim',
      'produtos.ver': false,
    }),
    { 'financas.ver': true, 'produtos.ver': false },
  )

  assert.deepEqual(normalizarPermissoes(null), {})
  assert.deepEqual(normalizarPermissoes(['financas.ver']), {})
  assert.deepEqual(normalizarPermissoes('financas.ver'), {})
})

// 3. preset do atendente bate com a matriz da spec
test('preset do atendente é operacional: sem financeiro, sem acessos, sem receita', () => {
  const permissoes = resolverPermissoes(atendente())

  assert.equal(podeExecutar(permissoes, 'pedidos.ver'), true)
  assert.equal(podeExecutar(permissoes, 'pedidos.ver_valor'), true)
  assert.equal(podeExecutar(permissoes, 'estoque.ajustar'), true)

  assert.equal(podeExecutar(permissoes, 'financas.ver'), false)
  assert.equal(podeExecutar(permissoes, 'relatorios.ver'), false)
  assert.equal(podeExecutar(permissoes, 'analise.ver'), false)
  assert.equal(podeExecutar(permissoes, 'dashboard.ver_receita'), false)
  assert.equal(podeExecutar(permissoes, 'produtos.ver_custo'), false)
  assert.equal(podeExecutar(permissoes, 'acessos.ver'), false)
  assert.equal(podeExecutar(permissoes, 'pedidos.excluir'), false)
})

// 4. override do usuário vence o preset do papel — nos dois sentidos
test('override concede e revoga sobre o preset do papel', () => {
  const comFinancas = resolverPermissoes(
    atendente({ permissoes: { 'financas.ver': true } }),
  )
  assert.equal(podeExecutar(comFinancas, 'financas.ver'), true)
  assert.equal(podeExecutar(comFinancas, 'financas.excluir'), false)

  const semPedidos = resolverPermissoes(
    atendente({ permissoes: { 'pedidos.ver_valor': false } }),
  )
  assert.equal(podeExecutar(semPedidos, 'pedidos.ver'), true)
  assert.equal(podeExecutar(semPedidos, 'pedidos.ver_valor'), false)
})

// 5. override não inventa permissão
test('override não consegue conceder chave fora do catálogo', () => {
  const permissoes = resolverPermissoes(
    atendente({ permissoes: { 'banco.transferir': true, 'acessos.permissoes': true } }),
  )

  assert.equal(podeExecutar(permissoes, 'banco.transferir'), false)
  // essa existe no catálogo, então o admin PODE concedê-la conscientemente
  assert.equal(podeExecutar(permissoes, 'acessos.permissoes'), true)
})

// 6. administrador não pode ser esvaziado por override
test('administrador ignora override que tente remover permissão', () => {
  const permissoes = resolverPermissoes(
    admin({ permissoes: { 'financas.ver': false, 'acessos.permissoes': false } }),
  )

  assert.equal(podeExecutar(permissoes, 'financas.ver'), true)
  assert.equal(podeExecutar(permissoes, 'acessos.permissoes'), true)
})

// 7. rota exige a permissão certa
test('rota do Admin mapeia para a permissão correspondente', () => {
  assert.equal(permissaoDaRota('/admin/financas'), 'financas.ver')
  assert.equal(permissaoDaRota('/admin/pedidos/novo'), 'pedidos.criar')
  assert.equal(permissaoDaRota('/admin/pedidos/abc-123'), 'pedidos.ver')
  assert.equal(permissaoDaRota('/admin/pedidos/abc-123/editar'), 'pedidos.ver')
  assert.equal(permissaoDaRota('/admin/estoque?produto=1'), 'estoque.ver')
  assert.equal(permissaoDaRota('/admin/login'), null)

  const permissoes = resolverPermissoes(atendente())
  assert.equal(podeVerRota('/admin/pedidos', permissoes), true)
  assert.equal(podeVerRota('/admin/financas', permissoes), false)
  assert.equal(podeVerRota('/admin/relatorios', permissoes), false)
})

// 8. a tela de Acessos e a de Clientes moram na mesma rota
test('/admin/usuarios abre com qualquer uma das duas abas liberadas', () => {
  const soClientes = resolverPermissoes(atendente())
  assert.equal(podeExecutar(soClientes, 'clientes.ver'), true)
  assert.equal(podeExecutar(soClientes, 'acessos.ver'), false)
  assert.equal(podeVerRota('/admin/usuarios', soClientes), true)

  const semNenhuma = resolverPermissoes(
    atendente({ permissoes: { 'clientes.ver': false } }),
  )
  assert.equal(podeVerRota('/admin/usuarios', semNenhuma), false)
})

// 9. valor operacional é independente de número estratégico
test('ver valor do pedido não implica ver faturamento', () => {
  const permissoes = resolverPermissoes(
    atendente({ permissoes: { 'pedidos.ver_valor': true } }),
  )

  assert.equal(podeExecutar(permissoes, 'pedidos.ver_valor'), true)
  assert.equal(podeExecutar(permissoes, 'dashboard.ver_receita'), false)
  assert.equal(podeExecutar(permissoes, 'financas.ver'), false)
})

// 10. ninguém edita as próprias permissões
test('ninguém edita as próprias permissões, nem administrador', () => {
  const ator = { id: 'a', permissoes: permissoesTotais() }
  const outro = { id: 'b' }

  assert.equal(podeEditarPermissoesDe(ator, outro), true)
  assert.equal(podeEditarPermissoesDe(ator, { id: 'a' }), false)

  const atendenteAtor = { id: 'c', permissoes: resolverPermissoes(atendente()) }
  assert.equal(podeEditarPermissoesDe(atendenteAtor, outro), false)
})

// 11. desativar corta o acesso, mesmo de administrador
test('usuário inativo resolve para conjunto vazio', () => {
  assert.deepEqual(resolverPermissoes(atendente({ ativo: false })), {})
  assert.deepEqual(resolverPermissoes(admin({ ativo: false })), {})
  assert.equal(podeVerRota('/admin/pedidos', resolverPermissoes(admin({ ativo: false }))), false)
})

// 12. papel desconhecido não vira acesso
test('papel fora dos perfis do Admin não recebe nada', () => {
  assert.deepEqual(resolverPermissoes({ id: 'x', papel: 'garcom', ativo: true }), {})
  assert.deepEqual(resolverPermissoes({ id: 'x', papel: 'entregador', ativo: true }), {})
  assert.deepEqual(resolverPermissoes(null), {})
})

// 13. o catálogo é coerente
test('catálogo não tem chave duplicada e cobre os 15 módulos reais', () => {
  assert.equal(new Set(CHAVES_RBAC).size, CHAVES_RBAC.length)
  assert.equal(MODULOS_ADMIN.length, 15)

  for (const modulo of MODULOS_ADMIN) {
    assert.ok(modulo.acoes.length > 0, `${modulo.id} sem ações`)
    assert.ok(modulo.rota.startsWith('/admin/'), `${modulo.id} sem rota do admin`)
    for (const item of modulo.acoes) {
      assert.ok(
        Object.values(SENSIBILIDADES).includes(item.sensibilidade),
        `${chave(modulo.id, item.id)} com sensibilidade inválida`,
      )
    }
  }
})

// 14. toda chave do preset existe no catálogo
test('preset do atendente só usa chave existente', () => {
  for (const item of Object.keys(PRESET_ATENDENTE)) {
    assert.ok(CHAVES_RBAC.includes(item), `preset cita chave inexistente: ${item}`)
  }
})

// 15. nenhuma ação estratégica ou crítica entra no preset
test('preset do atendente não contém ação estratégica nem crítica', () => {
  const sensibilidadePorChave = new Map(
    MODULOS_ADMIN.flatMap((modulo) =>
      modulo.acoes.map((item) => [chave(modulo.id, item.id), item.sensibilidade]),
    ),
  )

  for (const [item, concedida] of Object.entries(PRESET_ATENDENTE)) {
    if (!concedida) continue
    assert.equal(
      sensibilidadePorChave.get(item),
      SENSIBILIDADES.OPERACIONAL,
      `${item} não deveria vir ligada por padrão`,
    )
  }
})

// 16. o preset é o retrato completo, não uma camada sobre o que já estava
test('aplicar preset zera o que estava marcado fora dele', () => {
  const zerado = Object.fromEntries(CHAVES_RBAC.map((k) => [k, false]))
  const aplicado = { ...zerado, ...PRESET_ATENDENTE }

  assert.equal(aplicado['financas.ver'], false)
  assert.equal(aplicado['pedidos.ver'], true)
  // toda chave do catálogo está representada — nada fica indefinido
  for (const item of CHAVES_RBAC) {
    assert.equal(typeof aplicado[item], 'boolean', `${item} ficou indefinida`)
  }
})

// 17. marcar tudo de um módulo não vaza para outro
test('marcar tudo em um módulo não altera os demais', () => {
  const base = resolverPermissoes({ id: 'u', papel: PAPEIS.ATENDENTE, ativo: true })
  const financas = MODULOS_ADMIN.find((m) => m.id === 'financas')
  assert.ok(financas)

  const depois = { ...base }
  for (const acao of financas.acoes) depois[chave('financas', acao.id)] = true

  assert.equal(depois['financas.ver'], true)
  assert.equal(depois['financas.excluir'], true)
  assert.equal(depois['acessos.ver'], base['acessos.ver'])
  assert.equal(depois['pedidos.ver'], true)
  assert.equal(depois['relatorios.ver'], base['relatorios.ver'])
})

// 18. papel legado é gravável, mas não abre nada
test('garcom e entregador continuam graváveis e sem acesso ao Admin', () => {
  assert.ok(PAPEIS_VALIDOS.includes('garcom'))
  assert.ok(PAPEIS_VALIDOS.includes('entregador'))
  assert.deepEqual(resolverPermissoes({ id: 'u', papel: 'garcom', ativo: true }), {})
  assert.equal(podeVerRota('/admin/pedidos', resolverPermissoes({ papel: 'garcom', ativo: true })), false)
})
