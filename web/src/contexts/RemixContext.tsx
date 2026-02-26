'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { Entry, GenerateMode } from '@/types'

export interface RemixData {
  prompt: string
  referenceImageUrls?: string[]
  size: string
  strength?: number
  mode: GenerateMode
}

interface RemixContextValue {
  remixData: RemixData | null
  startRemix: (entry: Entry) => void
  clearRemix: () => void
}

const RemixContext = createContext<RemixContextValue>({
  remixData: null,
  startRemix: () => {},
  clearRemix: () => {},
})

export function RemixProvider({ children }: { children: ReactNode }) {
  const [remixData, setRemixData] = useState<RemixData | null>(null)

  const startRemix = useCallback((entry: Entry) => {
    setRemixData({
      prompt: entry.prompt,
      referenceImageUrls: entry.referenceImageUrls,
      size: entry.size,
      strength: entry.strength,
      mode: entry.mode,
    })
  }, [])

  const clearRemix = useCallback(() => {
    setRemixData(null)
  }, [])

  return (
    <RemixContext value={{ remixData, startRemix, clearRemix }}>
      {children}
    </RemixContext>
  )
}

export function useRemix() {
  return useContext(RemixContext)
}
