import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contato | Fortes Fios',
  description: 'Entre em contato com a Fortes Fios.',
}

export default function ContatoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
