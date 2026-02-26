'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRemix } from '@/contexts/RemixContext'
import { useEntries } from '@/hooks/useEntries'
import { ImageDetail } from '@/components/shared/ImageDetail'
import { toggleEntryLike, softDeleteEntry } from '@/lib/firestore'
import { Heart, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Entry, EntryImage } from '@/types'

type Filter = 'all' | 'liked'

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'liked', label: 'Liked' },
]

export default function GalleryPage() {
  const { user } = useAuth()
  const { startRemix } = useRemix()
  const [filter, setFilter] = useState<Filter>('all')
  const { entries, loading } = useEntries(filter)

  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  const firstDoneImage = (entry: Entry): EntryImage | undefined =>
    entry.images.find((i) => i.status === 'done')

  const handleImageClick = useCallback((entry: Entry) => {
    setSelectedEntry(entry)
    setViewerOpen(true)
  }, [])

  const handleLike = useCallback(async (entry: Entry) => {
    if (!user) return
    await toggleEntryLike(entry.id, !entry.liked)
  }, [user])

  const handleDelete = useCallback(async (entry: Entry) => {
    await softDeleteEntry(entry.id)
    setViewerOpen(false)
    setSelectedEntry(null)
  }, [])

  const handleRemix = useCallback((entry: Entry) => {
    setViewerOpen(false)
    setSelectedEntry(null)
    startRemix(entry)
  }, [startRemix])

  return (
    <div className="min-h-dvh sd-noise relative">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/90 backdrop-blur-xl px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold tracking-tight mb-3">
          <span className="sd-text-gradient">SeeDream</span>
        </h1>
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1 w-fit">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === key
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="p-1 relative z-10">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : entries.length > 0 ? (
          <div className="columns-2 md:columns-4 gap-1">
            {entries.map((entry, index) => {
              const img = firstDoneImage(entry)
              if (!img) return null
              return (
                <div
                  key={entry.id}
                  className={`mb-1 break-inside-avoid sd-animate-in sd-stagger-${(index % 6) + 1}`}
                >
                  <button
                    className="relative w-full overflow-hidden rounded-lg border border-white/5 bg-zinc-900 cursor-pointer text-left"
                    onClick={() => handleImageClick(entry)}
                  >
                    <img
                      src={img.url}
                      alt={entry.prompt}
                      className="w-full object-cover"
                      loading="lazy"
                    />

                    {/* Liked badge */}
                    {entry.liked && (
                      <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 backdrop-blur-sm">
                        <Heart className="h-3 w-3 fill-white text-white" />
                      </div>
                    )}

                    {/* Multi-image badge */}
                    {entry.images.filter((i) => i.status === 'done').length > 1 && (
                      <div className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm sd-mono">
                        {entry.images.filter((i) => i.status === 'done').length}
                      </div>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
              <div className="relative rounded-full bg-zinc-900 p-8 border border-white/5">
                <Sparkles className="h-16 w-16 text-emerald-500" />
              </div>
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-tight">
              Welcome to <span className="sd-text-gradient">SeeDream</span>
            </h2>
            <p className="mb-8 max-w-md text-zinc-400">
              Transform your imagination into stunning visuals.
            </p>
            <Link href="/create">
              <Button className="bg-emerald-600 hover:bg-emerald-500 sd-btn-glow h-12 px-6 font-semibold">
                <Sparkles className="mr-2 h-4 w-4" />
                Create Your First Image
              </Button>
            </Link>
            <p className="mt-6 text-sm text-zinc-600 sd-mono">powered by seedream 5.0</p>
          </div>
        )}
      </div>

      {/* Image Detail */}
      <ImageDetail
        entry={selectedEntry ?? undefined}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        onLike={handleLike}
        onRemix={handleRemix}
        onDelete={user && selectedEntry && user.uid === selectedEntry.userId ? handleDelete : undefined}
      />
    </div>
  )
}
