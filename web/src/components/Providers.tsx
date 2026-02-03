'use client'

import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { GenerationProvider, useGeneration } from '@/contexts/GenerationContext'
import { ReactNode, useEffect } from 'react'

// 同步 Auth 和 Generation 上下文的用户状态
function AuthGenerationSync({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { setUserId } = useGeneration()

  useEffect(() => {
    setUserId(user?.uid || null)
  }, [user, setUserId])

  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <GenerationProvider>
        <AuthGenerationSync>{children}</AuthGenerationSync>
      </GenerationProvider>
    </AuthProvider>
  )
}
