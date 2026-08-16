'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

type LimiteDeErroProps = {
  children: ReactNode
  /** Nome da área, para o log dizer onde quebrou. */
  area: string
  /** O que renderizar no lugar. Omitido, mostra o aviso padrão. */
  fallback?: ReactNode
}

type LimiteDeErroState = {
  erro: Error | null
}

/**
 * Contém um erro de render à área que o causou.
 *
 * Sem isto, qualquer `throw` durante o render — uma data inválida em `format()`,
 * um `.toFixed` sobre `undefined` — desmonta a árvore inteira do React e o
 * cliente vê a página em branco, sem nem saber o que fazer. O erro continua
 * sendo erro; o que muda é que o resto do site continua de pé e a pessoa recebe
 * um caminho de volta.
 *
 * Não substitui corrigir a causa: é a rede embaixo do trapézio, não o trapézio.
 */
export class LimiteDeErro extends Component<LimiteDeErroProps, LimiteDeErroState> {
  state: LimiteDeErroState = { erro: null }

  static getDerivedStateFromError(erro: Error): LimiteDeErroState {
    return { erro }
  }

  componentDidCatch(erro: Error, info: { componentStack?: string | null }) {
    // Vai para o console do navegador do cliente: é onde o rastro aparece
    // quando alguém reporta "a página quebrou" de um aparelho que não temos.
    console.error(`[LimiteDeErro:${this.props.area}]`, erro, info?.componentStack)
  }

  private tentarDeNovo = () => {
    this.setState({ erro: null })
  }

  render() {
    if (!this.state.erro) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="size-6 text-muted-foreground" strokeWidth={1.6} />
        </span>
        <div className="max-w-sm">
          <p className="text-sm font-medium text-foreground">Algo deu errado por aqui</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Não conseguimos mostrar esta parte agora. O resto do site segue funcionando.
          </p>
        </div>
        <button
          type="button"
          onClick={this.tentarDeNovo}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border/70 bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <RotateCcw className="size-4" strokeWidth={1.8} />
          Tentar de novo
        </button>
      </div>
    )
  }
}
