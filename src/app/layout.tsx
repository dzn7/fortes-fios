import type { Metadata } from 'next'
import './globals.css'
import ThemeProvider from '@/providers/ThemeProvider'
import { CarrinhoProvider } from '@/contexts/CarrinhoContext'
import PWAManager from '@/components/PWAManager'
import ManifestManager from '@/components/ManifestManager'
import { AppToaster } from '@/components/AppToaster'
import { geist, quicheSans, ralewayExtraLight } from '@/lib/fonts'

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
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#636B2F' },
    { media: '(prefers-color-scheme: dark)', color: '#3D4127' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
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
        className={`${geist.variable} ${quicheSans.variable} ${ralewayExtraLight.variable} ${geist.className} antialiased`}
      >
        <ThemeProvider>
          <CarrinhoProvider>
            <ManifestManager />
            <PWAManager />
            <AppToaster />
            {children}
          </CarrinhoProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
