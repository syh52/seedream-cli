'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRemix } from '@/contexts/RemixContext'
import { useCreateEntry } from '@/hooks/useCreateEntry'
import { subscribeToActiveEntries, toggleEntryLike, softDeleteEntry } from '@/lib/firestore'
import { CompactInput } from '@/components/create/CompactInput'
import { EntryCard } from '@/components/create/EntryCard'
import { ImageDetail } from '@/components/shared/ImageDetail'
import type { Entry, GenerateMode } from '@/types'
import { MAX_CONCURRENT_ENTRIES } from '@/types'

function CreateContent() {
  const { user } = useAuth()
  const { submitEntry } = useCreateEntry()
  const { remixData, startRemix, clearRemix } = useRemix()

  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState<string | null>(null)

  // Image detail state
  const [viewerEntry, setViewerEntry] = useState<Entry | null>(null)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)

  // Subscribe to entries
  useEffect(() => {
    if (!user) return
    const unsub = subscribeToActiveEntries(user.uid, (data) => {
      setEntries(data)
    })
    return unsub
  }, [user])

  const activeCount = entries.filter((e) => e.status === 'active').length
  const canSubmit = activeCount < MAX_CONCURRENT_ENTRIES && !!user

  const handleSubmit = useCallback(async (params: {
    prompt: string; mode: GenerateMode; size: string;
    referenceImages?: string[]; strength?: number;
  }) => {
    setError(null)
    try {
      await submitEntry(params)
      clearRemix()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    }
  }, [submitEntry, clearRemix])

  const handleImageClick = useCallback((entry: Entry, index: number) => {
    const doneImages = entry.images.filter((i) => i.status === 'done')
    if (doneImages.length === 0) return
    // Find the done-image index corresponding to the absolute index
    const doneIndex = entry.images.slice(0, index + 1).filter((i) => i.status === 'done').length - 1
    setViewerEntry(entry)
    setViewerIndex(Math.max(0, doneIndex))
    setViewerOpen(true)
  }, [])

  const handleLike = useCallback((entry: Entry) => {
    toggleEntryLike(entry.id, !entry.liked)
  }, [])

  const handleDelete = useCallback((entry: Entry) => {
    softDeleteEntry(entry.id)
    setViewerOpen(false)
  }, [])

  const handleCopyPrompt = useCallback((prompt: string) => {
    navigator.clipboard.writeText(prompt).catch(() => {
      // Fallback: silently fail if clipboard API is unavailable
    })
  }, [])

  const handleRemix = useCallback((entry: Entry) => {
    setViewerOpen(false)
    setViewerEntry(null)
    startRemix(entry)
  }, [startRemix])

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)]">
      {/* Header */}
      <header className="flex items-center gap-3 h-12 px-4 border-b border-white/5 flex-shrink-0">
        <Sparkles className="h-4 w-4 text-emerald-400" />
        <div>
          <h1 className="text-sm font-semibold">Create</h1>
          <p className="text-[9px] text-zinc-600 font-mono">seedream 5.0</p>
        </div>
      </header>

      {/* Entries list */}
      <div className="flex-1 overflow-auto p-4 space-y-3 pb-32">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {entries.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="h-8 w-8 text-zinc-800 mb-3" />
            <p className="text-sm text-zinc-600">输入 prompt 开始创作</p>
          </div>
        )}

        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onImageClick={handleImageClick}
            onDelete={handleDelete}
            onCopyPrompt={handleCopyPrompt}
            onRemix={handleRemix}
          />
        ))}
      </div>

      {/* Input bar */}
      <CompactInput
        onSubmit={handleSubmit}
        disabled={!canSubmit}
        activeCount={activeCount}
        remixData={remixData}
        onRemixClear={clearRemix}
      />

      {/* Image detail */}
      <ImageDetail
        entry={viewerEntry ?? undefined}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        onLike={handleLike}
        onDelete={handleDelete}
        onRemix={handleRemix}
      />
    </div>
  )
}

export default function CreatePage() {
  return <CreateContent />
}
