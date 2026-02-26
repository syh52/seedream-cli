'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { RemixProvider } from '@/contexts/RemixContext'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RemixProvider>
        {children}
      </RemixProvider>
    </AuthProvider>
  )
}
