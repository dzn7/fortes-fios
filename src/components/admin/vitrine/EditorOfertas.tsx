'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, BadgePercent, Loader2, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import {
  CHAVE_OFERTAS_VITRINE,
  ConfiguracaoOfertas,
} from '@/lib/vitrineOfertas'

export type ProdutoOfertaAdmin = {
  id: string
  nome: string
  categoria: string | null
  preco: number
  preco_original?: number | null
  desconto?: number | null
}

type EditorOfertasProps = {
  configuracaoInicial: ConfiguracaoOfertas
  produtos: ProdutoOfertaAdmin[]
  onConfiguracaoSalva: (configuracao: ConfiguracaoOfertas) => void
}

export default function EditorOfertas({
  configuracaoInicial,
  produtos,
  onConfiguracaoSalva,
}: EditorOfertasProps) {
  const [configuracao, setConfiguracao] =
    useState<ConfiguracaoOfertas>(configuracaoInicial)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)

  const produtosSelecionados = useMemo(
    () =>
      configuracao.produtoIds.flatMap((produtoId) => {
        const produto = produtos.find((item) => item.id === produtoId)
        return produto ? [produto] : []
      }),
    [configuracao.produtoIds, produtos],
  )

  const produtosDisponiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return produtos
      .filter(
        (produto) =>
          !configuracao.produtoIds.includes(produto.id) &&
          (!termo ||
            produto.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
            produto.categoria?.toLocaleLowerCase('pt-BR').includes(termo)),
      )
      .slice(0, 8)
  }, [busca, configuracao.produtoIds, produtos])

  const adicionarProduto = (produtoId: string) => {
    setConfiguracao((configuracaoAtual) => ({
      ...configuracaoAtual,
      produtoIds: [...configuracaoAtual.produtoIds, produtoId].slice(0, 12),
    }))
  }

  const removerProduto = (produtoId: string) => {
    setConfiguracao((configuracaoAtual) => ({
      ...configuracaoAtual,
      produtoIds: configuracaoAtual.produtoIds.filter(
        (idAtual) => idAtual !== produtoId,
      ),
    }))
  }

  const moverProduto = (indice: number, direcao: -1 | 1) => {
    const novoIndice = indice + direcao
    if (novoIndice < 0 || novoIndice >= configuracao.produtoIds.length) return

    setConfiguracao((configuracaoAtual) => {
      const produtoIds = [...configuracaoAtual.produtoIds]
      const [produtoId] = produtoIds.splice(indice, 1)
      produtoIds.splice(novoIndice, 0, produtoId)
      return { ...configuracaoAtual, produtoIds }
    })
  }

  const salvar = async () => {
    if (configuracao.ativo && produtosSelecionados.length === 0) {
      toast.warning('Escolha pelo menos um produto antes de publicar Ofertas')
      return
    }

    setSalvando(true)
    try {
      const configuracaoValida = {
        ...configuracao,
        produtoIds: produtosSelecionados.map((produto) => produto.id),
      }
      const { error } = await supabase.from('configuracoes_loja').upsert(
        {
          chave: CHAVE_OFERTAS_VITRINE,
          valor: JSON.stringify(configuracaoValida),
          tipo: 'json',
          descricao:
            'Publicação, quantidade e ordem dos produtos em oferta na vitrine pública.',
        },
        { onConflict: 'chave' },
      )

      if (error) throw error
      setConfiguracao(configuracaoValida)
      onConfiguracaoSalva(configuracaoValida)
      toast.success('Ofertas atualizadas', {
        description: configuracaoValida.ativo
          ? 'A seleção já está disponível na loja.'
          : 'A seção foi ocultada e sua seleção permanece salva.',
      })
    } catch (erro) {
      console.error('Erro ao salvar ofertas:', erro)
      toast.error('Não foi possível salvar as ofertas')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Ofertas</CardTitle>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Escolha os produtos que terão destaque promocional na loja.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => void salvar()}
          disabled={salvando}
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : null}
          Salvar ofertas
        </Button>
      </CardHeader>

      <CardContent className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-foreground">
                Exibir Ofertas no site
              </span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                Também adiciona Ofertas ao menu do celular.
              </span>
            </span>
            <input
              type="checkbox"
              checked={configuracao.ativo}
              onChange={(event) =>
                setConfiguracao((configuracaoAtual) => ({
                  ...configuracaoAtual,
                  ativo: event.target.checked,
                }))
              }
              className="size-4 shrink-0 accent-primary"
            />
          </label>

          <div className="space-y-2">
            <Label htmlFor="quantidade-ofertas">Quantidade no site</Label>
            <Select
              value={String(configuracao.quantidade)}
              onValueChange={(valor) =>
                setConfiguracao((configuracaoAtual) => ({
                  ...configuracaoAtual,
                  quantidade: Number(valor),
                }))
              }
            >
              <SelectTrigger id="quantidade-ofertas" className="min-h-11 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 4, 6, 8, 10, 12].map((quantidade) => (
                  <SelectItem key={quantidade} value={String(quantidade)}>
                    {quantidade} produtos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-3 rounded-lg border border-border/70 bg-muted/25 p-4">
          <BadgePercent
            className="mt-0.5 size-5 shrink-0 text-primary"
            strokeWidth={1.8}
            aria-hidden
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              Preço e desconto vêm do produto
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Ajuste o preço promocional em Produtos e categorias. Aqui você
              escolhe quais ofertas terão maior destaque e em qual ordem.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground">
            Ordem de exibição
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            O primeiro produto será a primeira oferta vista pelo cliente.
          </p>
          {produtosSelecionados.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma oferta selecionada.
            </div>
          ) : (
            <div className="mt-3 divide-y divide-border/70 rounded-lg border border-border/70">
              {produtosSelecionados.map((produto, indice) => (
                <div
                  key={produto.id}
                  className="flex min-w-0 items-center gap-3 p-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                    {indice + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {produto.nome}
                      </p>
                      {produto.desconto && produto.desconto > 0 ? (
                        <Badge variant="secondary" className="shrink-0">
                          -{produto.desconto}%
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {produto.categoria || 'Sem categoria'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      onClick={() => moverProduto(indice, -1)}
                      disabled={indice === 0}
                      aria-label={`Mover ${produto.nome} para cima`}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      onClick={() => moverProduto(indice, 1)}
                      disabled={indice === produtosSelecionados.length - 1}
                      aria-label={`Mover ${produto.nome} para baixo`}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 text-destructive hover:text-destructive"
                      onClick={() => removerProduto(produto.id)}
                      aria-label={`Remover ${produto.nome} das ofertas`}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="buscar-produto-oferta">Adicionar oferta</Label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="buscar-produto-oferta"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por nome ou categoria"
              className="min-h-11 pl-10"
            />
          </div>
          <div className="mt-2 divide-y divide-border/70 rounded-lg border border-border/70">
            {produtosDisponiveis.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                Nenhum outro produto disponível.
              </p>
            ) : (
              produtosDisponiveis.map((produto) => (
                <button
                  key={produto.id}
                  type="button"
                  onClick={() => adicionarProduto(produto.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {produto.nome}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {produto.categoria || 'Sem categoria'}
                    </p>
                  </div>
                  {produto.desconto && produto.desconto > 0 ? (
                    <Badge variant="secondary" className="shrink-0">
                      -{produto.desconto}%
                    </Badge>
                  ) : null}
                  <Plus className="size-4 shrink-0 text-primary" />
                </button>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
