'use client'

import { useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useRemix } from '@/contexts/RemixContext'
import { useCreateEntry } from '@/hooks/useCreateEntry'
import { CompactInput } from '@/components/create/CompactInput'
import type { GenerateMode } from '@/types'

export function GlobalInputBar() {
  const { user, loading } = useAuth()
  const { submitEntry } = useCreateEntry()
  const { remixData, clearRemix } = useRemix()
  const router = useRouter()
  const pathname = usePathname()

  const handleSubmit = useCallback(async (params: {
    prompt: string; mode: GenerateMode; size: string;
    referenceImages?: string[]; strength?: number;
  }) => {
    await submitEntry(params)
    clearRemix()
    // Navigate to Create page to see progress
    if (pathname !== '/create') {
      router.push('/create')
    }
  }, [submitEntry, clearRemix, pathname, router])

  // Don't render on Create page — it has its own CompactInput
  // Also wait for auth to settle before deciding (prevents flash)
  if (loading || !user || pathname === '/create') return null

  return (
    <CompactInput
      onSubmit={handleSubmit}
      remixData={remixData}
      onRemixClear={clearRemix}
    />
  )
}
