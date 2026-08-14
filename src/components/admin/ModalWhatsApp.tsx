'use client'

import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { toast } from 'sonner'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
import { ModalSheet } from '@/components/ui/modal-sheet'

type Pedido = {
  id: string
  nome_cliente: string
  telefone?: string
  total: number
  status: string
}

type ModalWhatsAppProps = {
  pedido: Pedido | null
  aberto: boolean
  onFechar: () => void
}

const mensagensPredefinidas = [
  {
    titulo: 'Pedido Confirmado',
    template: (pedido: Pedido) => 
      `Olá ${pedido.nome_cliente}! 😊\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} foi confirmado!\n\n💰 Valor: R$ ${pedido.total.toFixed(2)}\n\nEstamos preparando com muito carinho! 🍔`
  },
  {
    titulo: 'Pedido em Preparo',
    template: (pedido: Pedido) => 
      `Oi ${pedido.nome_cliente}! 👨‍🍳\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} está sendo preparado agora!\n\nEm breve estará prontinho! ⏰`
  },
  {
    titulo: 'Pedido Pronto',
    template: (pedido: Pedido) => 
      `${pedido.nome_cliente}, tudo pronto! 🎉\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} está prontinho e quentinho!\n\nPode vir buscar! 😋`
  },
  {
    titulo: 'Saiu para Entrega',
    template: (pedido: Pedido) => 
      `Olá ${pedido.nome_cliente}! 🚗\n\nSeu pedido #${pedido.id.slice(0, 8).toUpperCase()} saiu para entrega!\n\nChega aí rapidinho! 🍔💨`
  },
  {
    titulo: 'Agradecimento',
    template: (pedido: Pedido) => 
      `Muito obrigado pela preferência, ${pedido.nome_cliente}! 🙏\n\nEsperamos que tenha gostado do seu pedido!\n\nVolte sempre! ❤️🍔`
  },
  {
    titulo: 'Mensagem Personalizada',
    template: () => ''
  }
]

export default function ModalWhatsApp({ pedido, aberto, onFechar }: ModalWhatsAppProps) {
  const [mensagemSelecionada, setMensagemSelecionada] = useState(0)
  const [mensagemCustom, setMensagemCustom] = useState('')

  if (!pedido) return null

  const handleEnviarWhatsApp = () => {
    const mensagem = mensagemSelecionada === mensagensPredefinidas.length - 1
      ? mensagemCustom
      : mensagensPredefinidas[mensagemSelecionada].template(pedido)

    if (!mensagem.trim()) {
      toast.warning('Por favor, escreva uma mensagem')
      return
    }

    // Remove caracteres especiais do telefone
    const telefone = (pedido.telefone || '').replace(/\D/g, '')
    if (!telefone) {
      toast.error('Telefone não disponível para este pedido')
      return
    }
    const telefoneCompleto = telefone.startsWith('55') ? telefone : `55${telefone}`

    // Abre WhatsApp
    window.open(
      `https://wa.me/${telefoneCompleto}?text=${encodeURIComponent(mensagem)}`,
      '_blank'
    )

    onFechar()
  }

  const mensagemAtual = mensagemSelecionada === mensagensPredefinidas.length - 1
    ? mensagemCustom
    : mensagensPredefinidas[mensagemSelecionada].template(pedido)

  return (
    <ModalSheet
      open={aberto}
      onOpenChange={(proximo) => {
        if (!proximo) onFechar()
      }}
      title="Enviar WhatsApp"
      description={`Escolha ou escreva a mensagem para ${pedido.nome_cliente}.`}
      showCloseButton={false}
      className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
    >
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-green-500 to-green-600 p-4 text-white md:p-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="rounded-lg bg-white/20 p-1.5 backdrop-blur-sm md:p-2">
              <IconeWhatsApp className="h-5 w-5 text-white md:h-6 md:w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold md:text-xl">Enviar WhatsApp</h3>
              <p className="text-xs text-green-50 md:text-sm">
                {pedido.nome_cliente} • {pedido.telefone}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="inline-flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 [-webkit-overflow-scrolling:touch] md:space-y-6 md:p-6">
        {/* Mensagens Predefinidas */}
        <div>
          <label className="mb-3 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Escolha uma mensagem:
          </label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {mensagensPredefinidas.map((msg, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setMensagemSelecionada(index)
                  if (index === mensagensPredefinidas.length - 1) {
                    setMensagemCustom('')
                  }
                }}
                className={`min-h-11 rounded-lg p-3 text-xs font-medium transition-all md:text-sm ${
                  mensagemSelecionada === index
                    ? 'scale-105 bg-green-500 text-white shadow-lg'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {msg.titulo}
              </button>
            ))}
          </div>
        </div>

        {/* Preview/Editor da Mensagem */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {mensagemSelecionada === mensagensPredefinidas.length - 1
              ? 'Escreva sua mensagem:'
              : 'Preview da mensagem:'}
          </label>
          {mensagemSelecionada === mensagensPredefinidas.length - 1 ? (
            <textarea
              value={mensagemCustom}
              onChange={(e) => setMensagemCustom(e.target.value)}
              placeholder="Digite sua mensagem personalizada..."
              className="h-40 w-full resize-none rounded-lg border border-zinc-300 bg-white p-4 text-sm text-zinc-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white md:h-48"
            />
          ) : (
            <div className="min-h-[10rem] w-full whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white md:min-h-[12rem]">
              {mensagemAtual}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-shrink-0 gap-3 border-t border-zinc-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-800 md:p-6 md:pb-6">
        <button
          type="button"
          onClick={onFechar}
          className="min-h-11 flex-1 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 md:py-3 md:text-base"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleEnviarWhatsApp}
          disabled={!mensagemAtual.trim()}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:from-green-600 hover:to-green-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 md:py-3 md:text-base"
        >
          <Send className="h-4 w-4 md:h-5 md:w-5" />
          Enviar WhatsApp
        </button>
      </div>
    </ModalSheet>
  )
}
