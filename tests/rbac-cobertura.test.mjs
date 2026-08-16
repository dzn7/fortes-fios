import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { CHAVES_RBAC, MODULOS_ADMIN, chave, permissaoDaRota } from '../src/lib/rbac.mjs'

/**
 * Cobertura do catálogo de permissões.
 *
 * Existe por um defeito real: a tela de Acessos oferecia `pedidos.excluir`, o
 * administrador deixava desmarcado, e o atendente excluía pedido assim mesmo —
 * porque nenhuma tela lia a permissão e a escrita ia direto ao Supabase.
 *
 * Caixa que não é lida por ninguém é pior que caixa ausente: promete um
 * controle que não existe. Este teste falha quando uma chave nova entra no
 * catálogo sem nenhum ponto de aplicação, e quando uma ação destrutiva perde a
 * rota que a protege.
 */

const RAIZ = new URL('../src', import.meta.url).pathname
const EXTENSOES = ['.ts', '.tsx', '.mjs']

const arquivos = (dir) => {
  const encontrados = []
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada)
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...arquivos(caminho))
    } else if (EXTENSOES.some((ext) => entrada.endsWith(ext))) {
      encontrados.push(caminho)
    }
  }
  return encontrados
}

// O próprio catálogo não conta como uso: ele é a definição, não a aplicação.
const FONTE = arquivos(RAIZ)
  .filter((caminho) => !caminho.endsWith('rbac.mjs') && !caminho.endsWith('rbac.d.mts'))
  .map((caminho) => readFileSync(caminho, 'utf8'))
  .join('\n')

/**
 * Permissões aplicadas pelo guarda de rota (`podeVerRota` → `permissaoDaRota`).
 * O mapa vive dentro do próprio `rbac.mjs`, então não seria encontrado pela
 * varredura de texto — mas é ponto de aplicação real: é o que barra
 * `/admin/financas` digitado na barra de endereço.
 */
const APLICADAS_POR_ROTA = new Set(
  [
    ...MODULOS_ADMIN.map((modulo) => modulo.rota),
    // Rotas que não são a "capa" de um módulo mas têm permissão própria.
    '/admin/pedidos/novo',
  ]
    .map((rota) => permissaoDaRota(rota))
    .filter(Boolean)
    // `/admin/usuarios` tem duas abas e `podeVerRota` trata as duas chaves.
    .concat(['clientes.ver', 'acessos.ver']),
)

const coberta = (item) =>
  FONTE.includes(`'${item}'`) || FONTE.includes(`"${item}"`) || APLICADAS_POR_ROTA.has(item)

/**
 * Chaves ainda sem ponto de aplicação. Cada linha aqui é dívida consciente, não
 * esquecimento — e some conforme a tela correspondente passa a checar.
 * Manter a lista explícita força a decisão a ser tomada, em vez de a permissão
 * silenciosamente não valer nada.
 */
const SEM_APLICACAO_CONHECIDA = new Set([
  'produtos.ver_custo',
  'vitrine.editar',
  'cupons.editar',
  'bairros.editar',
  'entregas.editar',
  'pagamentos.editar',
  'clientes.editar',
  'equipe.editar',
])

test('toda permissão do catálogo é lida em algum lugar, ou está na lista de dívida', () => {
  const orfas = CHAVES_RBAC.filter((item) => !coberta(item))

  const inesperadas = orfas.filter((item) => !SEM_APLICACAO_CONHECIDA.has(item))
  assert.deepEqual(
    inesperadas,
    [],
    `permissões sem nenhum ponto de aplicação: ${inesperadas.join(', ')}`,
  )
})

test('a lista de dívida não guarda permissão que já é aplicada', () => {
  const jaAplicadas = [...SEM_APLICACAO_CONHECIDA].filter(coberta)

  assert.deepEqual(
    jaAplicadas,
    [],
    `saíram da dívida e podem ser removidas da lista: ${jaAplicadas.join(', ')}`,
  )
})

/**
 * Ação destrutiva não pode depender só de esconder botão: quem tem a anon key
 * monta a requisição na mão. Cada uma precisa de um route handler que chame
 * `exigirPermissao` com a chave correspondente.
 */
test('ação destrutiva tem rota que exige a permissão', () => {
  const rotas = arquivos(join(RAIZ, 'app', 'api'))
    .map((caminho) => readFileSync(caminho, 'utf8'))
    .join('\n')

  for (const item of ['pedidos.excluir', 'estoque.ajustar', 'acessos.permissoes', 'financas.ver']) {
    assert.ok(
      rotas.includes(`exigirPermissao(request, '${item}')`) ||
        rotas.includes(`'${item}'`),
      `${item} precisa ser exigida em um route handler`,
    )
  }
})

test('todo módulo do catálogo tem ao menos a ação de ver', () => {
  for (const modulo of MODULOS_ADMIN) {
    assert.ok(
      modulo.acoes.some((acao) => acao.id === 'ver'),
      `${modulo.id} não tem ação 'ver' — não dá para conceder acesso de leitura`,
    )
    assert.ok(CHAVES_RBAC.includes(chave(modulo.id, 'ver')))
  }
})
