'use client'

import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { FOLLOWUPS_CLIENTE, linkWhatsApp, montarFollowUp } from '@/lib/whatsapp.mjs'

type SeletorFollowUpProps = {
  telefone: string
  nome: string | null
  /** `completo` é o botão verde da ficha; `compacto` é o do cabeçalho. */
  variante?: 'completo' | 'compacto'
  className?: string
}

/**
 * Abre o WhatsApp do cliente com uma mensagem pronta.
 *
 * Três opções e nada mais: o atendente escolhe de relance e manda. Cada linha
 * mostra o rótulo **e** quando usar aquela mensagem — sem isso, a escolha vira
 * adivinhação e a pessoa acaba escrevendo tudo do zero, que é o que a lista
 * existe para evitar.
 *
 * A navegação acontece no clique, de forma síncrona: Safari no iOS bloqueia
 * `window.open` disparado depois de um `await`, por não reconhecer mais o gesto
 * do usuário. Nada de assíncrono entre o clique e a abertura.
 */
export function SeletorFollowUp({
  telefone,
  nome,
  variante = 'completo',
  className,
}: SeletorFollowUpProps) {
  const abrir = (idFollowUp: string) => {
    const mensagem = montarFollowUp(idFollowUp, { nome: nome ?? undefined })
    const url = mensagem ? linkWhatsApp(telefone, mensagem) : null

    if (!url) {
      toast.error('Telefone inválido para WhatsApp', {
        description: 'Confira o número cadastrado deste cliente.',
      })
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const abrirConversaVazia = () => {
    const url = linkWhatsApp(telefone, '')
    if (!url) {
      toast.error('Telefone inválido para WhatsApp')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variante === 'completo' ? (
          <button
            type="button"
            className={cn(
              'flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1ebe57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              className,
            )}
          >
            <IconeWhatsApp className="size-4" />
            Conversar no WhatsApp
            <ChevronDown className="size-4 opacity-80" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Abrir WhatsApp"
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-[#25D366] transition-colors hover:bg-[#25D366]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              className,
            )}
          >
            <IconeWhatsApp className="size-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
            <ChevronDown className="size-3.5 opacity-70" aria-hidden />
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[19rem]">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Mensagem pronta
        </DropdownMenuLabel>

        {FOLLOWUPS_CLIENTE.map((followup) => (
          <DropdownMenuItem
            key={followup.id}
            onSelect={() => abrir(followup.id)}
            className="flex-col items-start gap-0.5 py-2.5"
          >
            <span className="text-sm font-medium text-foreground">{followup.rotulo}</span>
            <span className="text-xs text-muted-foreground">{followup.descricao}</span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={abrirConversaVazia} className="py-2.5">
          <span className="text-sm text-muted-foreground">Abrir conversa em branco</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
