'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Camera,
  Crop,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  calcularPrecoComDesconto,
  calcularValorParcelaProduto,
  normalizarPercentualDesconto,
  normalizarQuantidadeParcelas,
  QUANTIDADE_MAXIMA_PARCELAS,
  QUANTIDADE_MINIMA_PARCELAS,
  QUANTIDADE_PARCELAS_PADRAO,
} from '@/lib/condicoesComerciaisProduto'
import { cn } from '@/lib/utils'

export type ProdutoFormulario = {
  id: string
  nome: string
  descricao?: string
  preco: number
  custo_unitario?: number | null
  preco_original?: number | null
  desconto?: number | null
  parcelamento_ativo?: boolean | null
  parcelas_sem_juros?: number | null
  categoria: string
  imagem_url?: string
  disponivel: boolean
  tabela?: string
}

export type DadosSalvarProduto = {
  nome: string
  descricao: string
  preco: string
  custoUnitario: string
  desconto: string
  parcelamentoAtivo: boolean
  quantidadeParcelas: number
  categoria: string
  disponivel: boolean
}

type ModalFormularioProdutoProps = {
  aberto: boolean
  modo: 'criar' | 'editar'
  produto?: ProdutoFormulario | null
  categorias: string[]
  categoriasBebidas: string[]
  categoriaBebidasFallback?: string
  salvando?: boolean
  enviandoImagem?: boolean
  onFechar: () => void
  onSalvar: (dados: DadosSalvarProduto) => void | Promise<void>
  onCriarCategoria?: (nome: string) => Promise<string | null>
  onSelecionarFoto?: () => void
  onRecortarFoto?: () => void
  onRemoverFoto?: () => void
  onExcluir?: () => void
  previewImagemCriacao?: string | null
  onSelecionarFotoCriacao?: () => void
}

export const ModalFormularioProduto = ({
  aberto,
  modo,
  produto,
  categorias,
  categoriasBebidas,
  categoriaBebidasFallback = '',
  salvando = false,
  enviandoImagem = false,
  onFechar,
  onSalvar,
  onCriarCategoria,
  onSelecionarFoto,
  onRecortarFoto,
  onRemoverFoto,
  onExcluir,
  previewImagemCriacao,
  onSelecionarFotoCriacao,
}: ModalFormularioProdutoProps) => {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [preco, setPreco] = useState('')
  const [custoUnitario, setCustoUnitario] = useState('')
  const [desconto, setDesconto] = useState('0')
  const [parcelamentoAtivo, setParcelamentoAtivo] = useState(false)
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(
    QUANTIDADE_PARCELAS_PADRAO,
  )
  const [categoria, setCategoria] = useState('')
  const [disponivel, setDisponivel] = useState(true)
  const [criandoCategoria, setCriandoCategoria] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [criandoCat, setCriandoCat] = useState(false)

  useEffect(() => {
    if (!aberto) return
    if (modo === 'editar' && produto) {
      setNome(produto.nome)
      setDescricao(produto.descricao || '')
      setPreco(String(produto.preco_original ?? produto.preco ?? ''))
      setCustoUnitario(produto.custo_unitario === null || produto.custo_unitario === undefined ? '' : String(produto.custo_unitario))
      setDesconto(String(produto.desconto || 0))
      setParcelamentoAtivo(produto.parcelamento_ativo === true)
      setQuantidadeParcelas(
        normalizarQuantidadeParcelas(produto.parcelas_sem_juros),
      )
      setCategoria(produto.categoria)
      setDisponivel(produto.disponivel)
    } else {
      setNome('')
      setDescricao('')
      setPreco('')
      setCustoUnitario('')
      setDesconto('0')
      setParcelamentoAtivo(false)
      setQuantidadeParcelas(QUANTIDADE_PARCELAS_PADRAO)
      setCategoria(categorias[0] || categoriasBebidas[0] || categoriaBebidasFallback || '')
      setDisponivel(true)
    }
    setCriandoCategoria(false)
    setNovaCategoria('')
  }, [aberto, modo, produto, categorias, categoriasBebidas, categoriaBebidasFallback])

  const ehBebida = useMemo(() => {
    return (
      categoriasBebidas.some((item) => item.toLowerCase() === categoria.trim().toLowerCase()) ||
      categoria.trim().toLowerCase() === categoriaBebidasFallback.trim().toLowerCase() ||
      produto?.tabela === 'bebidas'
    )
  }, [categoria, categoriasBebidas, categoriaBebidasFallback, produto?.tabela])

  const categoriasSelect = useMemo(
    () =>
      Array.from(
        new Set([...categorias, ...categoriasBebidas, categoriaBebidasFallback].filter(Boolean)),
      ),
    [categoriaBebidasFallback, categorias, categoriasBebidas],
  )

  const preview =
    modo === 'criar'
      ? previewImagemCriacao || null
      : produto?.imagem_url || null

  const precoNumero = Number(preco)
  const descontoNumero = normalizarPercentualDesconto(desconto)
  const precoFinalPreview = Number.isFinite(precoNumero)
    ? calcularPrecoComDesconto(precoNumero, descontoNumero)
    : 0

  const handleSalvar = () => {
    void onSalvar({
      nome: nome.trim(),
      descricao: descricao.trim(),
      preco,
      custoUnitario,
      desconto,
      parcelamentoAtivo,
      quantidadeParcelas,
      categoria,
      disponivel,
    })
  }

  const handleCriarCategoria = async () => {
    if (!onCriarCategoria || !novaCategoria.trim()) return
    try {
      setCriandoCat(true)
      const criada = await onCriarCategoria(novaCategoria.trim())
      if (criada) {
        setCategoria(criada)
        setCriandoCategoria(false)
        setNovaCategoria('')
      }
    } finally {
      setCriandoCat(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(proximo) => !proximo && onFechar()}>
      <DialogContent
        className={cn(
          'flex max-h-[92dvh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0',
          'sm:max-h-[90dvh]',
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 pr-12 text-left">
          <DialogTitle className="text-[15px] font-semibold tracking-tight">
            {modo === 'criar' ? 'Novo produto' : 'Editar produto'}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            {modo === 'criar'
              ? 'Cadastre um produto nas categorias do catálogo.'
              : 'Altere dados, foto e disponibilidade do item.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="space-y-2">
            <Label>Foto</Label>
            <button
              type="button"
              onClick={modo === 'criar' ? onSelecionarFotoCriacao : onSelecionarFoto}
              className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border/70 bg-muted/30 transition-colors hover:bg-muted/50"
              aria-label={preview ? 'Trocar foto' : 'Adicionar foto'}
            >
              {preview ? (
                <Image src={preview} alt="" fill className="object-cover" unoptimized />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Camera className="h-6 w-6" />
                  Adicionar foto
                </span>
              )}
              {enviandoImagem ? (
                <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </span>
              ) : null}
            </button>
            {modo === 'editar' && preview ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shadow-none"
                  onClick={onRecortarFoto}
                >
                  <Crop className="mr-2 h-4 w-4" />
                  Recortar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shadow-none text-destructive hover:text-destructive"
                  onClick={onRemoverFoto}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover foto
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Imagem comprimida antes do envio.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Categoria *</Label>
            {!criandoCategoria ? (
              <Select
                value={categoria}
                onValueChange={(valor) => {
                  if (valor === '__nova__') {
                    setCriandoCategoria(true)
                    setNovaCategoria('')
                    return
                  }
                  setCategoria(valor)
                }}
              >
                <SelectTrigger className="h-11 border-border/70 shadow-none">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasSelect.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  {onCriarCategoria ? (
                    <SelectItem value="__nova__">Criar nova categoria</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  placeholder="Nome da nova categoria"
                  className="h-11 border-border/70 shadow-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleCriarCategoria()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-11 w-11 shrink-0 shadow-none"
                  onClick={() => void handleCriarCategoria()}
                  disabled={criandoCat}
                >
                  {criandoCat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 shadow-none"
                  onClick={() => {
                    setCriandoCategoria(false)
                    setNovaCategoria('')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-produto-nome">
              Nome do produto *
            </Label>
            <Input
              id="modal-produto-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Cabo flexível 2,5 mm"
              className="h-11 border-border/70 shadow-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-produto-descricao">Descrição</Label>
            {ehBebida ? (
              <Input
                id="modal-produto-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: 350ml, 600ml, 2L"
                className="h-11 border-border/70 shadow-none"
              />
            ) : (
              <Textarea
                id="modal-produto-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva especificações, marca ou medidas"
                rows={3}
                className="border-border/70 shadow-none"
              />
            )}
          </div>

          <div className={cn('grid gap-3', !ehBebida ? 'grid-cols-2' : 'grid-cols-1')}>
            <div className="space-y-2">
              <Label htmlFor="modal-produto-preco">Preço (R$) *</Label>
              <Input
                id="modal-produto-preco"
                type="number"
                step="0.01"
                min="0"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0.00"
                className="h-11 border-border/70 shadow-none"
              />
            </div>
            {!ehBebida ? (
              <div className="space-y-2">
                <Label htmlFor="modal-produto-custo">Custo de compra (R$)</Label>
                <Input
                  id="modal-produto-custo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={custoUnitario}
                  onChange={(e) => setCustoUnitario(e.target.value)}
                  placeholder="Opcional"
                  className="h-11 border-border/70 shadow-none"
                />
                <p className="text-xs text-muted-foreground">Usado para calcular o lucro nas vendas futuras.</p>
              </div>
            ) : null}
          </div>

          {!ehBebida ? (
            <div className="space-y-4 rounded-xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Condições comerciais</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  O desconto altera o preço do produto; as parcelas são apenas informativas.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="modal-produto-desconto">Desconto (%)</Label>
                  <Input
                    id="modal-produto-desconto"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    step="1"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                    className="h-11 border-border/70 shadow-none"
                  />
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Preço exibido no site</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                    R$ {precoFinalPreview.toFixed(2).replace('.', ',')}
                  </p>
                  {descontoNumero > 0 && precoNumero > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      De R$ {precoNumero.toFixed(2).replace('.', ',')} · {descontoNumero}% OFF
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border border-border/60 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end">
                <label className="flex cursor-pointer items-start justify-between gap-4 sm:items-center">
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      Mostrar parcelamento sem juros
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Informação visual no catálogo; não altera o pagamento.
                    </span>
                  </span>
                  <Checkbox
                    checked={parcelamentoAtivo}
                    onCheckedChange={(valor) => setParcelamentoAtivo(valor === true)}
                    aria-label="Mostrar parcelamento sem juros no site"
                  />
                </label>

                <div className="space-y-1.5">
                  <Label htmlFor="modal-produto-parcelas">Quantidade</Label>
                  <Select
                    value={String(quantidadeParcelas)}
                    onValueChange={(valor) => setQuantidadeParcelas(Number(valor))}
                    disabled={!parcelamentoAtivo}
                  >
                    <SelectTrigger id="modal-produto-parcelas" className="h-11 border-border/70 shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        {
                          length:
                            QUANTIDADE_MAXIMA_PARCELAS -
                            QUANTIDADE_MINIMA_PARCELAS +
                            1,
                        },
                        (_, indice) => QUANTIDADE_MINIMA_PARCELAS + indice,
                      ).map((quantidade) => (
                        <SelectItem key={quantidade} value={String(quantidade)}>
                          {quantidade}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {parcelamentoAtivo ? (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Prévia: {quantidadeParcelas}x de R${' '}
                    {calcularValorParcelaProduto(
                      precoFinalPreview,
                      quantidadeParcelas,
                    )
                      .toFixed(2)
                      .replace('.', ',')}{' '}
                    sem juros
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {modo === 'editar' ? (
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Disponível no catálogo</p>
                <p className="text-xs text-muted-foreground">Itens ocultos não aparecem no site</p>
              </div>
              <Checkbox
                checked={disponivel}
                onCheckedChange={(valor) => setDisponivel(valor === true)}
                aria-label="Disponível no catálogo"
              />
            </div>
          ) : null}

          {!preview && modo === 'editar' ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              Este item está sem foto
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:gap-2 sm:px-5 sm:pb-4">
          {modo === 'editar' && onExcluir ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full shadow-none text-destructive hover:text-destructive sm:mr-auto sm:w-auto"
              onClick={onExcluir}
              disabled={salvando}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full shadow-none sm:w-auto"
            onClick={onFechar}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 w-full shadow-none sm:min-w-[140px] sm:w-auto"
            onClick={handleSalvar}
            disabled={salvando || !nome.trim() || !preco}
          >
            {salvando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {modo === 'criar' ? 'Salvar' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
