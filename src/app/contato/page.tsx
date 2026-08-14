'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'

export default function ContatoPage() {
  useEffect(() => {
    document.body.classList.add('fortes-fios-public')
    return () => document.body.classList.remove('fortes-fios-public')
  }, [])

  return (
    <main className="fortes-fios-site min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center rounded-3xl border border-border bg-card p-6 text-center shadow-sm sm:p-10">
        <div className="mx-auto mb-6 relative h-24 w-24 overflow-hidden rounded-full border border-border bg-background">
          <Image src="/logo.webp" alt="Fortes Fios" fill sizes="96px" className="object-cover" priority />
        </div>

        <p className="mb-3 text-sm font-medium text-primary">Fortes Fios</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">Fortes Fios</h1>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-base">
          Tudo o que seu cabelo precisa em um só lugar. A loja de quem entende de cabelo.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao catálogo
        </Link>

        <p className="mt-8 text-xs text-muted-foreground">© {new Date().getFullYear()} Fortes Fios</p>
      </section>
    </main>
  )
}
