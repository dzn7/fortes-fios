import type { Metadata, Viewport } from 'next'
import './globals.css'
import ThemeProvider from '@/providers/ThemeProvider'
import { CarrinhoProvider } from '@/contexts/CarrinhoContext'
import ManifestManager from '@/components/ManifestManager'
import { AppToaster } from '@/components/AppToaster'
import {
  bricolageGrotesque,
  geist,
  quicheSans,
  ralewayExtraLight,
} from '@/lib/fonts'

export const metadata: Metadata = {
  title: 'Fortes Fios | Tudo para o seu cabelo',
  description: 'Tudo o que seu cabelo precisa em um só lugar. A loja de quem entende de cabelo.',
  keywords: 'cabelo, cosméticos capilares, kits capilares, pós-química, cacheados, Fortes Fios',
  authors: [{ name: 'Fortes Fios' }],
  creator: 'Fortes Fios',
  publisher: 'Fortes Fios',
  icons: {
    icon: [
      { url: '/assets/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/favicon.ico' },
    ],
    apple: [{ url: '/assets/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Fortes Fios',
    title: 'Fortes Fios | Tudo para o seu cabelo',
    description: 'Tudo o que seu cabelo precisa em um só lugar.',
  },
  twitter: {
    card: 'summary',
    title: 'Fortes Fios | Tudo para o seu cabelo',
    description: 'Tudo o que seu cabelo precisa em um só lugar.',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
}

/**
 * `viewport` e `themeColor` precisam de export próprio: dentro de `metadata` o
 * Next 16 descarta os dois, então nada disso chegava ao HTML.
 *
 * O `maximumScale: 1` anterior não é reintroduzido de propósito — bloquear o
 * pinch-zoom é anti-padrão de acessibilidade e não é o que evita o zoom ao
 * focar um campo no iOS; quem evita é a fonte computada de 16 px (globals.css).
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#636B2F' },
    { media: '(prefers-color-scheme: dark)', color: '#3D4127' },
  ],
}

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  /**
   * Slot da rota paralela `@modal`. Recebe a rota interceptada
   * `(.)produto/[slug]`, que abre o produto por cima do catálogo; em qualquer
   * outra rota, `@modal/default.tsx` devolve `null`.
   *
   * Spec: specs/pagina-publica-produto.md
   */
  modal: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Fortes Fios" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geist.variable} ${quicheSans.variable} ${ralewayExtraLight.variable} ${bricolageGrotesque.variable} ${geist.className} antialiased`}
      >
        <ThemeProvider>
          <CarrinhoProvider>
            {/* Sem service worker: o site registrava um que não entregava nada
                que o cache do navegador já não fizesse. `public/sw.js` virou
                lápide e desinstala o que ficou nos aparelhos. O manifest
                permanece — "adicionar à tela inicial" não depende de worker. */}
            <ManifestManager />
            <AppToaster />
            {children}
            {modal}
          </CarrinhoProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
