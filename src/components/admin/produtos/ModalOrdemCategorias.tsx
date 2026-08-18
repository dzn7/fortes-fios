'use client'

import { useCallback, useEffect, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { ArrowDown, ArrowUp, GripVertical, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { IconeCategoria } from '@/components/icons/IconeCategoria'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  moverItem,
  moverParaBaixo,
  moverParaCima,
  ordemMudou,
  podeDescer,
  podeSubir,
} from '@/lib/ordem-categorias.mjs'
import { cn } from '@/lib/utils'

type ModalOrdemCategoriasProps = {
  aberto: boolean
  aoFechar: () => void
  /** Ordem atual, já resolvida pela página. */
  categorias: string[]
  contarProdutos: (categoria: string) => number
  iconeDaCategoria: (categoria: string) => string | null | undefined
  aoSalvar: (novaOrdem: string[]) => Promise<void>
}

type LinhaProps = {
  categoria: string
  posicao: number
  total: number
  quantidade: number
  icone: string | null | undefined
  arrastavel: boolean
  aoSubir: () => void
  aoDescer: () => void
}

/**
 * Uma categoria da lista.
 *
 * Componente próprio por causa do `useDragControls`: o hook precisa de uma
 * instância por linha, e hook não se cria dentro de `map`.
 */
function LinhaCategoria({
  categoria,
  posicao,
  total,
  quantidade,
  icone,
  arrastavel,
  aoSubir,
  aoDescer,
}: LinhaProps) {
  const controlesArraste = useDragControls()

  return (
    <Reorder.Item
      value={categoria}
      as="li"
      /*
        `dragListener={false}` é a peça central, e não um detalhe de gosto.
        Conferido no fonte do framer-motion (`render/html/use-props.mjs`):

            if (props.drag && props.dragListener !== false) {
              style.touchAction = `pan-${...}`
            }

        Com o listener padrão, o item recebe `touch-action: pan-x` e a lista
        deixa de rolar no toque — que é o defeito da reordenação antiga desta
        tela. Desligando o listener, o framer-motion não escreve `touch-action`
        nenhum, e o arrasto passa a nascer só do punho.
      */
      dragListener={false}
      dragControls={controlesArraste}
      className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-2 py-2 sm:gap-3 sm:px-3"
    >
      {arrastavel ? (
        <span
          onPointerDown={(evento) => controlesArraste.start(evento)}
          className="hidden cursor-grab touch-none text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing sm:block"
          aria-hidden
        >
          <GripVertical className="size-4" strokeWidth={1.8} />
        </span>
      ) : null}

      <span className="w-5 shrink-0 text-center font-mono text-xs font-semibold tabular-nums text-muted-foreground">
        {posicao + 1}
      </span>

      <IconeCategoria icone={icone} className="size-4 shrink-0 text-primary" />

      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {categoria}
      </span>

      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {quantidade}
        <span className="hidden sm:inline"> {quantidade === 1 ? 'produto' : 'produtos'}</span>
      </span>

      {/*
        As setas são o mecanismo principal, não o plano B: funcionam no toque,
        no teclado e no leitor de tela, e são o único caminho no mobile — onde a
        superfície é um Drawer que tem o próprio gesto de arrastar.
      */}
      <div className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9"
          disabled={!podeSubir(posicao)}
          onClick={aoSubir}
          aria-label={`Mover ${categoria} para cima`}
        >
          <ArrowUp className="size-4" strokeWidth={1.8} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9"
          disabled={!podeDescer(posicao, total)}
          onClick={aoDescer}
          aria-label={`Mover ${categoria} para baixo`}
        >
          <ArrowDown className="size-4" strokeWidth={1.8} />
        </Button>
      </div>
    </Reorder.Item>
  )
}

/**
 * Ordem das categorias do catálogo público.
 *
 * **Uma tarefa por superfície.** A reordenação que já existia nesta tela fazia
 * duas ao mesmo tempo — categorias e, aninhados dentro delas, os produtos de
 * cada uma. Grupo de arrasto dentro de item arrastável, scroll dentro de
 * scroll: arrastar um produto arrastava a categoria junto. Aqui só se ordena
 * categoria, numa lista plana com um único container de rolagem.
 *
 * Desktop vira Radix Dialog e mobile vira Drawer vaul sozinho, porque é o que o
 * `Dialog variant="responsive"` do projeto já faz — inclusive o empilhamento de
 * overlay, resolvido por `overlay-layer`.
 *
 * Spec: specs/ordem-categorias-modal.md
 */
export function ModalOrdemCategorias({
  aberto,
  aoFechar,
  categorias,
  contarProdutos,
  iconeDaCategoria,
  aoSalvar,
}: ModalOrdemCategoriasProps) {
  const ehMobile = useIsMobile()
  const [rascunho, setRascunho] = useState<string[]>(categorias)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)

  // O retrato de referência é o de quando o modal ABRIU. Sincronizar com
  // `categorias` a cada render sobrescreveria o rascunho no meio da edição.
  useEffect(() => {
    if (!aberto) return
    setRascunho(categorias)
    setConfirmandoDescarte(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const mudou = ordemMudou(categorias, rascunho)

  /**
   * Fechar com alteração pendente pede confirmação — mas **dentro do rodapé**,
   * não num segundo diálogo. Empilhar um AlertDialog sobre um Drawer é
   * exatamente a classe de bug de overlay que este modal existe para não ter.
   */
  const tentarFechar = useCallback(() => {
    if (salvando) return
    if (mudou && !confirmandoDescarte) {
      setConfirmandoDescarte(true)
      return
    }
    setConfirmandoDescarte(false)
    aoFechar()
  }, [aoFechar, confirmandoDescarte, mudou, salvando])

  const salvar = async () => {
    setSalvando(true)
    try {
      await aoSalvar(rascunho)
      aoFechar()
    } finally {
      // O modal continua aberto quando falha: fechar engoliria o erro e a
      // pessoa acharia que salvou.
      setSalvando(false)
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        if (!proximo) tentarFechar()
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={!salvando}
      >
        <DialogHeader className="space-y-1 border-b border-border/60 px-4 py-4 text-left sm:px-5">
          <DialogTitle className="text-base font-semibold">Ordem das categorias</DialogTitle>
          <DialogDescription className="text-sm">
            Define a sequência em que o cliente vê as categorias no catálogo.
            {ehMobile ? ' Use as setas para reposicionar.' : ' Arraste pelo punho ou use as setas.'}
          </DialogDescription>
        </DialogHeader>

        {rascunho.length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-5">
            <p className="text-sm font-medium text-foreground">Nenhuma categoria com produtos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre produtos para que as categorias apareçam aqui.
            </p>
          </div>
        ) : (
          // Um único container de rolagem. A lista antiga tinha scroll dentro de
          // scroll, e no toque o gesto era capturado pelo container errado.
          <Reorder.Group
            axis="y"
            as="ul"
            values={rascunho}
            onReorder={setRascunho}
            className="flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5"
          >
            {rascunho.map((categoria, indice) => (
              <LinhaCategoria
                key={categoria}
                categoria={categoria}
                posicao={indice}
                total={rascunho.length}
                quantidade={contarProdutos(categoria)}
                icone={iconeDaCategoria(categoria)}
                arrastavel={!ehMobile}
                aoSubir={() => setRascunho((atual) => moverParaCima(atual, indice))}
                aoDescer={() => setRascunho((atual) => moverParaBaixo(atual, indice))}
              />
            ))}
          </Reorder.Group>
        )}

        <div className="border-t border-border/60 px-4 py-3 sm:px-5">
          {confirmandoDescarte ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Descartar a nova ordem?</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 flex-1 sm:flex-none"
                  onClick={() => setConfirmandoDescarte(false)}
                >
                  Continuar editando
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-10 flex-1 sm:flex-none"
                  onClick={aoFechar}
                >
                  Descartar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-10"
                onClick={tentarFechar}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className={cn('h-10 gap-2')}
                onClick={() => void salvar()}
                disabled={!mudou || salvando}
              >
                {salvando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" strokeWidth={1.8} />
                )}
                Salvar ordem
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
