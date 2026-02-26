'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToGallery } from '@/lib/firestore'
import type { Entry } from '@/types'

export function useEntries(filter: 'all' | 'liked') {
  const { user } = useAuth()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeToGallery(filter, user?.uid ?? null, (data) => {
      setEntries(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [filter, user?.uid])

  return { entries, loading }
}
