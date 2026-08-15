import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ARTIGOS_AJUDA,
  ROTAS_ADMIN_OCULTAS_AJUDA,
  ROTAS_ADMIN_REAIS,
  auditarCoberturaAjuda,
  buscarArtigos,
  listarArtigosPorCategoria,
  obterArtigoPorRota,
} from '../src/features/onboarding/help/catalogo.mjs'

const textoDoArtigo = (artigo) =>
  [
    artigo.titulo,
    artigo.resumo,
    ...(artigo.palavrasChave || []),
    ...artigo.secoes.flatMap((secao) => [secao.titulo, secao.corpo]),
  ].join(' ')

test('toda rota real do Admin possui artigo de ajuda', () => {
  const cobertura = auditarCoberturaAjuda()
  assert.deepEqual(cobertura.faltando, [])
  assert.equal(ROTAS_ADMIN_REAIS.length, 15)
  assert.equal(
    ARTIGOS_AJUDA.filter((artigo) => !artigo.virtual).length,
    ROTAS_ADMIN_REAIS.length,
  )
})

test('rotas ocultas do Admin não possuem artigo de ajuda', () => {
  const cobertura = auditarCoberturaAjuda()
  assert.deepEqual(cobertura.extrasOcultos, [])
  for (const rota of ROTAS_ADMIN_OCULTAS_AJUDA) {
    assert.equal(obterArtigoPorRota(rota), null)
  }
})

test('o artigo da rota atual vence sub-rotas mais genéricas', () => {
  assert.equal(obterArtigoPorRota('/admin/estoque')?.id, 'estoque')
  assert.equal(obterArtigoPorRota('/admin/estoque?produto=abc')?.id, 'estoque')
  assert.equal(obterArtigoPorRota('/admin/vitrine')?.id, 'vitrine')
  assert.equal(obterArtigoPorRota('/admin/financas')?.id, 'financas')
  assert.equal(obterArtigoPorRota('/admin/pedidos/novo')?.id, 'pedidos-novo')
  assert.equal(obterArtigoPorRota('/admin/pedidos/abc-123')?.id, 'pedidos')
  assert.equal(obterArtigoPorRota('/admin/pedidos/abc-123/editar')?.id, 'pedidos')
  assert.equal(obterArtigoPorRota('/admin/dashboard')?.id, 'dashboard')
  assert.equal(obterArtigoPorRota('/admin/login'), null)
})

test('artigo virtual de notificações aparece na busca e não rouba o contexto da tela', () => {
  const artigo = ARTIGOS_AJUDA.find((item) => item.id === 'notificacoes')
  assert.equal(artigo?.virtual, true)
  assert.equal(obterArtigoPorRota('/admin/dashboard')?.id, 'dashboard')
  const encontrados = buscarArtigos('sino')
  assert.equal(encontrados.some((item) => item.id === 'notificacoes'), true)
})

test('busca encontra os nomes atuais do painel', () => {
  const ids = (termo) => buscarArtigos(termo).map((item) => item.id)
  assert.equal(ids('visão geral')[0], 'dashboard')
  assert.equal(ids('estoque baixo')[0], 'estoque')
  assert.equal(ids('esgotado')[0], 'estoque')
  assert.equal(ids('lucro bruto')[0], 'financas')
  assert.equal(ids('cidades de entrega')[0], 'bairros')
  assert.equal(ids('mais vendidos').some((id) => id === 'vitrine'), true)
  assert.equal(ids('clientes e acessos')[0], 'usuarios')
})

test('busca não devolve módulos removidos do Admin', () => {
  const ids = (termo) => buscarArtigos(termo).map((item) => item.id)
  assert.deepEqual(ids('crediário'), [])
  assert.deepEqual(ids('kanban'), [])
  assert.deepEqual(ids('whatsapp'), [])
  assert.deepEqual(ids('pdv'), [])
  assert.equal(ids('painel').includes('painel'), false)
})

test('categorias da ajuda repetem os grupos do menu', () => {
  const grupos = listarArtigosPorCategoria().map((grupo) => grupo.categoria)
  assert.deepEqual(grupos, ['Pedidos', 'Loja', 'Catálogo', 'Gestão'])
})

test('estoque explica estados, ajuste e diferença entre zero e indisponível', () => {
  const artigo = obterArtigoPorRota('/admin/estoque')
  const texto = textoDoArtigo(artigo).toLocaleLowerCase('pt-BR')
  for (const trecho of [
    'em estoque',
    'estoque baixo',
    'esgotado',
    'bloquear venda no zero',
    'disponível no catálogo',
    'aument',
    'diminu',
  ]) {
    assert.match(texto, new RegExp(trecho))
  }
  assert.match(texto, /quantidade zero|estoque zerado|zera/)
  assert.match(texto, /ainda pode vender|continua vendável|não impede a venda/)
})

test('vitrine documenta só as áreas existentes na tela', () => {
  const artigo = obterArtigoPorRota('/admin/vitrine')
  const texto = textoDoArtigo(artigo)
  for (const area of ['Banners', 'Mais vendidos', 'Ofertas', 'Studio', 'Cabeçalho']) {
    assert.match(texto, new RegExp(area))
  }
  assert.doesNotMatch(texto, /frete diário/i)
})

test('finanças explica o lucro bruto com a regra real do sistema', () => {
  const artigo = obterArtigoPorRota('/admin/financas')
  const texto = textoDoArtigo(artigo).toLocaleLowerCase('pt-BR')
  assert.match(texto, /lucro bruto/)
  assert.match(texto, /custo/)
  assert.match(texto, /subtotal|venda/)
  assert.match(texto, /histórico|momento da venda/)
  assert.match(texto, /sem custo/)
  assert.match(texto, /cancelad/)
  assert.doesNotMatch(texto, /mutation|supabase|endpoint|hook/)
})
