'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Archive,
  ImageIcon,
  PackageCheck,
  PackageX,
  RefreshCw,
  Search,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import AdminLayout from '@/components/admin/AdminLayout'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import { ControleEstoqueProduto } from '@/components/admin/produtos/ControleEstoqueProduto'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { obterSituacaoEstoque } from '@/lib/estoque-produto.mjs'
import { cn } from '@/lib/utils'

type ProdutoEstoque = {
  id: string
  nome: string
  categoria: string
  imagem_url: string | null
  disponivel: boolean
  estoque_quantidade: number
  estoque_minimo: number
  bloquear_venda_sem_estoque: boolean
}

type FiltroEstoque = 'todos' | 'em_estoque' | 'baixo' | 'esgotado'

const rotulosSituacao = {
  em_estoque: 'Em estoque',
  baixo: 'Estoque baixo',
  esgotado: 'Esgotado',
} as const

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroEstoque>('todos')
  const [salvandoBloqueioId, setSalvandoBloqueioId] = useState<string | null>(null)

  const carregarProdutos = useCallback(async () => {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, categoria, imagem_url, disponivel, estoque_quantidade, estoque_minimo, bloquear_venda_sem_estoque')
        .order('nome', { ascending: true })

      if (error) throw error
      setProdutos((data || []) as ProdutoEstoque[])
    } catch (erro) {
      console.error('Erro ao carregar estoque:', erro)
      toast.error('Não foi possível carregar o estoque')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarProdutos()

    const canal = supabase
      .channel('estoque-produtos-admin')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'produtos' },
        (evento) => {
          const atualizado = evento.new as Partial<ProdutoEstoque> & { id?: string }
          if (!atualizado.id) return
          setProdutos((estadoAtual) => estadoAtual.map((produto) =>
            produto.id === atualizado.id ? { ...produto, ...atualizado } : produto
          ))
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'produtos' },
        () => void carregarProdutos(),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'produtos' },
        (evento) => {
          const removido = evento.old as { id?: string }
          if (removido.id) {
            setProdutos((estadoAtual) => estadoAtual.filter((produto) => produto.id !== removido.id))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [carregarProdutos])

  const contadores = useMemo(() => produtos.reduce(
    (acumulado, produto) => {
      acumulado[obterSituacaoEstoque(produto)] += 1
      return acumulado
    },
    { em_estoque: 0, baixo: 0, esgotado: 0 },
  ), [produtos])

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return produtos.filter((produto) => {
      const situacao = obterSituacaoEstoque(produto)
      const correspondeFiltro = filtro === 'todos' || filtro === situacao
      const correspondeBusca = termo.length === 0
        || produto.nome.toLocaleLowerCase('pt-BR').includes(termo)
        || produto.categoria.toLocaleLowerCase('pt-BR').includes(termo)
      return correspondeFiltro && correspondeBusca
    })
  }, [busca, filtro, produtos])

  const alterarBloqueio = async (produto: ProdutoEstoque, proximoValor: boolean) => {
    if (salvandoBloqueioId) return
    setSalvandoBloqueioId(produto.id)
    setProdutos((estadoAtual) => estadoAtual.map((item) =>
      item.id === produto.id ? { ...item, bloquear_venda_sem_estoque: proximoValor } : item
    ))
    try {
      const { error } = await supabase
        .from('produtos')
        .update({ bloquear_venda_sem_estoque: proximoValor })
        .eq('id', produto.id)
      if (error) throw error
    } catch (erro) {
      setProdutos((estadoAtual) => estadoAtual.map((item) =>
        item.id === produto.id
          ? { ...item, bloquear_venda_sem_estoque: produto.bloquear_venda_sem_estoque }
          : item
      ))
      toast.error('Não foi possível alterar a regra de venda')
    } finally {
      setSalvandoBloqueioId(null)
    }
  }

  const filtros: Array<{ id: FiltroEstoque; rotulo: string; quantidade: number }> = [
    { id: 'todos', rotulo: 'Todos', quantidade: produtos.length },
    { id: 'em_estoque', rotulo: 'Em estoque', quantidade: contadores.em_estoque },
    { id: 'baixo', rotulo: 'Estoque baixo', quantidade: contadores.baixo },
    { id: 'esgotado', rotulo: 'Esgotados', quantidade: contadores.esgotado },
  ]

  return (
    <ProtectedRoute>
      <AdminLayout>
        <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Archive className="size-5" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Estoque</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Confira a situação dos produtos e ajuste quantidades sem abrir formulários.
              </p>
            </div>
            <Button type="button" variant="outline" className="gap-2" onClick={() => void carregarProdutos()} disabled={carregando}>
              <RefreshCw className={cn('size-4', carregando && 'animate-spin')} />
              Atualizar
            </Button>
          </header>

          <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo do estoque">
            <Card className="border-border/70 shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <PackageCheck className="size-5" />
                </div>
                <div><p className="text-2xl font-semibold tabular-nums">{contadores.em_estoque}</p><p className="text-xs text-muted-foreground">Em estoque</p></div>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <AlertTriangle className="size-5" />
                </div>
                <div><p className="text-2xl font-semibold tabular-nums">{contadores.baixo}</p><p className="text-xs text-muted-foreground">Estoque baixo</p></div>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <PackageX className="size-5" />
                </div>
                <div><p className="text-2xl font-semibold tabular-nums">{contadores.esgotado}</p><p className="text-xs text-muted-foreground">Esgotados</p></div>
              </CardContent>
            </Card>
          </section>

          <Card className="border-border/70 shadow-none">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar produto ou categoria" className="pl-9" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtros de estoque">
                  {filtros.map((item) => (
                    <Button key={item.id} type="button" size="sm" variant={filtro === item.id ? 'default' : 'outline'} className="shrink-0 gap-2" onClick={() => setFiltro(item.id)}>
                      {item.rotulo}<Badge variant={filtro === item.id ? 'secondary' : 'outline'}>{item.quantidade}</Badge>
                    </Button>
                  ))}
                </div>
              </div>

              {carregando ? (
                <div className="flex min-h-56 items-center justify-center"><RefreshCw className="size-5 animate-spin text-muted-foreground" /></div>
              ) : produtosFiltrados.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center text-center">
                  <Archive className="mb-3 size-9 text-muted-foreground/50" />
                  <p className="font-medium">Nenhum produto encontrado</p>
                  <p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou selecione outro filtro.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/70">
                  {produtosFiltrados.map((produto) => {
                    const situacao = obterSituacaoEstoque(produto)
                    return (
                      <article key={produto.id} className="grid gap-4 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {produto.imagem_url ? <Image src={produto.imagem_url} alt="" fill className="object-cover" sizes="56px" /> : <ImageIcon className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate font-medium">{produto.nome}</h2>
                              <Badge variant={situacao === 'em_estoque' ? 'success' : situacao === 'baixo' ? 'warning' : 'secondary'}>{rotulosSituacao[situacao]}</Badge>
                            </div>
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">{produto.categoria} · alerta em {produto.estoque_minimo} un.</p>
                          </div>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm lg:border-0 lg:px-0">
                          <Checkbox checked={produto.bloquear_venda_sem_estoque} disabled={salvandoBloqueioId === produto.id} onCheckedChange={(valor) => void alterarBloqueio(produto, valor === true)} />
                          Bloquear venda no zero
                        </label>
                        <ControleEstoqueProduto produtoId={produto.id} produtoNome={produto.nome} quantidade={produto.estoque_quantidade} estoqueMinimo={produto.estoque_minimo} onQuantidadeAlterada={(quantidade) => setProdutos((estadoAtual) => estadoAtual.map((item) => item.id === produto.id ? { ...item, estoque_quantidade: quantidade } : item))} />
                      </article>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </AdminLayout>
    </ProtectedRoute>
  )
}
