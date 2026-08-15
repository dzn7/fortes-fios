'use client'

import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react'
import { Produto, Adicional, ItemCarrinho } from '@/lib/supabase'
import { avaliarCompraProduto, produtoDisponivelParaCompra } from '@/lib/estoque-produto.mjs'

type CarrinhoContextType = {
  itens: ItemCarrinho[]
  adicionarItem: (produto: Produto, quantidade: number, adicionais: Adicional[], observacoes?: string) => boolean
  removerItem: (id: string) => void
  atualizarQuantidade: (id: string, quantidade: number) => boolean
  sincronizarProdutos: (produtos: Produto[]) => void
  limparCarrinho: () => void
  total: number
  quantidadeTotal: number
}

const CarrinhoContext = createContext<CarrinhoContextType | undefined>(undefined)
const IMAGEM_PADRAO_PRODUTO = '/placeholder-produto.svg'

function normalizarUrlImagem(urlImagem: unknown): string {
  if (typeof urlImagem !== 'string') return IMAGEM_PADRAO_PRODUTO
  const urlTratada = urlImagem.trim()
  return urlTratada.length > 0 ? urlTratada : IMAGEM_PADRAO_PRODUTO
}

function normalizarProduto(produto: Produto): Produto {
  const produtoDoCarrinho = {
    ...produto,
    imagem_url: normalizarUrlImagem(produto.imagem_url),
  }

  delete produtoDoCarrinho.parcelamento_ativo
  delete produtoDoCarrinho.parcelas_sem_juros

  return produtoDoCarrinho
}

function normalizarItemCarrinho(item: ItemCarrinho): ItemCarrinho {
  const produtoNormalizado = normalizarProduto(item.produto)
  const adicionais = Array.isArray(item.adicionais) ? item.adicionais : []
  const quantidade = Number.isFinite(item.quantidade) && item.quantidade > 0 ? item.quantidade : 1
  const subtotalAdicionais = adicionais.reduce((acc, ad) => acc + ad.preco, 0)
  const subtotalCalculado = (produtoNormalizado.preco + subtotalAdicionais) * quantidade

  return {
    ...item,
    produto: produtoNormalizado,
    adicionais,
    quantidade,
    subtotal: subtotalCalculado,
  }
}

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [persistenciaCarregada, setPersistenciaCarregada] = useState(false)

  useEffect(() => {
    const carrinhoSalvo = localStorage.getItem('edienai-lanches-carrinho')
    if (carrinhoSalvo) {
      try {
        const itensSalvos = JSON.parse(carrinhoSalvo)
        if (Array.isArray(itensSalvos)) {
          setItens(itensSalvos.map((item) => normalizarItemCarrinho(item as ItemCarrinho)))
        } else {
          setItens([])
        }
      } catch (error) {
        console.error('Erro ao carregar carrinho:', error)
        setItens([])
      }
    }
    setPersistenciaCarregada(true)
  }, [])

  useEffect(() => {
    if (!persistenciaCarregada) return
    localStorage.setItem('edienai-lanches-carrinho', JSON.stringify(itens))
  }, [itens, persistenciaCarregada])

  const adicionarItem = (
    produto: Produto,
    quantidade: number,
    adicionais: Adicional[],
    observacoes?: string
  ): boolean => {
    const produtoNormalizado = normalizarProduto(produto)
    const quantidadeAtual = itens
      .filter((item) => item.produto.id === produtoNormalizado.id)
      .reduce((total, item) => total + item.quantidade, 0)
    const avaliacao = avaliarCompraProduto(produtoNormalizado, quantidadeAtual, quantidade)
    if (!avaliacao.permitido) return false
    const subtotalAdicionais = adicionais.reduce((acc, ad) => acc + ad.preco, 0)
    const subtotal = (produtoNormalizado.preco + subtotalAdicionais) * quantidade

    const novoItem: ItemCarrinho = {
      id: `${produtoNormalizado.id}-${Date.now()}`,
      produto: produtoNormalizado,
      quantidade,
      adicionais,
      observacoes,
      subtotal,
    }

    setItens((prev) => [...prev, novoItem])
    return true
  }

  const removerItem = (id: string) => {
    setItens((prev) => prev.filter((item) => item.id !== id))
  }

  const atualizarQuantidade = (id: string, quantidade: number): boolean => {
    if (quantidade <= 0) {
      removerItem(id)
      return true
    }

    const itemAtual = itens.find((item) => item.id === id)
    if (!itemAtual) return false
    const quantidadeOutrasLinhas = itens
      .filter((item) => item.id !== id && item.produto.id === itemAtual.produto.id)
      .reduce((total, item) => total + item.quantidade, 0)
    const avaliacao = avaliarCompraProduto(
      itemAtual.produto,
      quantidadeOutrasLinhas,
      quantidade,
    )
    if (!avaliacao.permitido) return false

    setItens((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const subtotalAdicionais = item.adicionais.reduce((acc, ad) => acc + ad.preco, 0)
          const subtotal = (item.produto.preco + subtotalAdicionais) * quantidade
          return { ...item, quantidade, subtotal }
        }
        return item
      })
    )
    return true
  }

  const sincronizarProdutos = useCallback((produtosAtuais: Produto[]) => {
    const produtosPorId = new Map(produtosAtuais.map((produto) => [produto.id, produto]))
    setItens((estadoAtual) => estadoAtual.flatMap((item) => {
      const produtoAtual = produtosPorId.get(item.produto.id)
      if (!produtoAtual) return [item]
      if (!produtoDisponivelParaCompra(produtoAtual)) return []

      const produtoNormalizado = normalizarProduto({ ...item.produto, ...produtoAtual })
      const quantidadeMaxima = produtoNormalizado.bloquear_venda_sem_estoque
        ? Number(produtoNormalizado.estoque_quantidade || 0)
        : null
      const quantidade = quantidadeMaxima === null
        ? item.quantidade
        : Math.min(item.quantidade, quantidadeMaxima)
      if (quantidade <= 0) return []

      return [normalizarItemCarrinho({ ...item, produto: produtoNormalizado, quantidade })]
    }))
  }, [])

  const limparCarrinho = () => {
    setItens([])
  }

  const total = itens.reduce((acc, item) => acc + item.subtotal, 0)
  const quantidadeTotal = itens.reduce((acc, item) => acc + item.quantidade, 0)

  return (
    <CarrinhoContext.Provider
      value={{
        itens,
        adicionarItem,
        removerItem,
        atualizarQuantidade,
        sincronizarProdutos,
        limparCarrinho,
        total,
        quantidadeTotal,
      }}
    >
      {children}
    </CarrinhoContext.Provider>
  )
}

export function useCarrinho() {
  const context = useContext(CarrinhoContext)
  if (context === undefined) {
    throw new Error('useCarrinho deve ser usado dentro de um CarrinhoProvider')
  }
  return context
}
