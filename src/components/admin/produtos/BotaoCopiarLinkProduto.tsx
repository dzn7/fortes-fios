'use client'

import { useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { urlPublicaDoProduto } from '@/lib/link-produto.mjs'
import { cn } from '@/lib/utils'

type BotaoCopiarLinkProdutoProps = {
  produto: { id: string; nome: string }
  /** Produto oculto não tem página pública — o link cairia em 404. */
  publicado: boolean
  className?: string
}

/**
 * Copia o endereço público do produto.
 *
 * **Sempre visível no toque, só no hover no desktop.** No celular não existe
 * hover: esconder o botão atrás dele o tornaria inalcançável. O `sm:` inverte a
 * regra apenas onde há ponteiro, e `group-focus-within` traz o botão de volta
 * para quem navega por teclado — senão ele ficaria focável e invisível.
 *
 * O endereço sai de `window.location.origin`, e não de uma env: o link tem de
 * apontar para o domínio por onde a pessoa entrou, seja produção ou preview.
 *
 * Spec: specs/pagina-publica-produto.md
 */
export default function BotaoCopiarLinkProduto({
  produto,
  publicado,
  className,
}: BotaoCopiarLinkProdutoProps) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    const url = urlPublicaDoProduto(produto, window.location.origin)
    if (!url) return

    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      toast.success('Link copiado', { description: url })
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // `clipboard` falha sem HTTPS ou sem permissão; mostrar a URL deixa a
      // pessoa copiar à mão em vez de ficar sem saída.
      toast.error('Não foi possível copiar automaticamente', { description: url })
    }
  }

  if (!publicado) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className={cn('h-9 shrink-0 gap-1.5 shadow-none', className)}
        aria-label={`${produto.nome} está oculto e não tem link público`}
        title="Produto oculto não tem página pública"
      >
        <Link2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sem link</span>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void copiar()}
      className={cn(
        'h-9 shrink-0 gap-1.5 shadow-none transition-opacity',
        'sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100',
        className,
      )}
      aria-label={`Copiar link de ${produto.nome}`}
    >
      {copiado ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{copiado ? 'Copiado' : 'Copiar link'}</span>
    </Button>
  )
}
