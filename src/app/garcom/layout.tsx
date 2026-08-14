'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GarcomRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  void children
  return null
}
