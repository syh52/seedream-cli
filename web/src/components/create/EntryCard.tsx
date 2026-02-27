'use client'

import { memo, useState } from 'react'
import Image from 'next/image'
import { Trash2, Copy, RotateCcw, X, Loader2 } from 'lucide-react'
import type { Entry, EntryImage } from '@/types'

interface EntryCardProps {
  entry: Entry
  onImageClick: (entry: Entry, imageIndex: number) => void
  onDelete: (entry: Entry) => void
  onCopyPrompt: (prompt: string) => void
  onRemix: (entry: Entry) => void
}

export const EntryCard = memo(function EntryCard({ entry, onImageClick, onDelete, onCopyPrompt, onRemix }: EntryCardProps) {
  const isActive = entry.status === 'active'
  const isDone = entry.status === 'done'

  const dotClass = isActive
    ? 'bg-emerald-400 animate-pulse'
    : isDone
      ? 'bg-emerald-500'
      : 'bg-red-500'

  const labelClass = isActive
    ? 'text-emerald-400'
    : isDone
      ? 'text-emerald-500'
      : 'text-red-400'

  const doneCount = entry.images.filter(i => i.status === 'done').length
  const pendingCount = entry.images.filter(i => i.status === 'pending').length

  return (
    <div className="bg-zinc-900/50 rounded-lg p-3 space-y-2">
      {/* Header: status + prompt + actions */}
      <div className="flex items-start gap-2">
        <span className={`h-2 w-2 rounded-full flex-shrink-0 mt-1.5 ${dotClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-medium flex-shrink-0 ${labelClass}`}>
              Imagine
            </span>
            <span className="text-[10px] text-zinc-600">
              {entry.size} · {entry.mode}
              {entry.strength !== undefined && ` · str ${entry.strength}`}
            </span>
          </div>
          <p className="text-sm text-zinc-300 line-clamp-1">{entry.prompt}</p>
        </div>

        {/* Compact action buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onCopyPrompt(entry.prompt)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 transition-colors"
            title="Copy prompt"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            onClick={() => {
              onRemix(entry)
              setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100)
            }}
            className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 active:scale-90 active:text-emerald-400 transition-all"
            title="Remix"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(entry)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Horizontal thumbnail strip — fixed height, scrollable */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {entry.images.map((img, index) => (
          <ThumbCell
            key={img.id}
            image={img}
            onClick={() => onImageClick(entry, index)}
          />
        ))}
        {/* Progress indicator for active entries */}
        {isActive && pendingCount > 0 && (
          <div className="h-16 w-16 flex-shrink-0 rounded-md bg-zinc-800/50 flex flex-col items-center justify-center gap-1">
            <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
            <span className="text-[9px] text-zinc-500">{doneCount}/{entry.images.length}</span>
          </div>
        )}
      </div>
    </div>
  )
})

function ThumbCell({ image, onClick }: {
  image: EntryImage
  onClick: () => void
}) {
  const [loaded, setLoaded] = useState(false)

  if (image.status === 'pending') {
    return (
      <div className="h-16 w-16 flex-shrink-0 rounded-md bg-zinc-800 animate-pulse" />
    )
  }

  if (image.status === 'failed') {
    return (
      <div className="h-16 w-16 flex-shrink-0 rounded-md bg-zinc-800 flex items-center justify-center">
        <X className="h-3.5 w-3.5 text-red-500/60" />
      </div>
    )
  }

  return (
    <button
      className="h-16 w-16 flex-shrink-0 rounded-md overflow-hidden relative cursor-pointer hover:ring-1 hover:ring-emerald-500/50 transition-all"
      onClick={onClick}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
      )}
      <Image
        src={image.url}
        alt="Generated"
        fill
        className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        sizes="64px"
      />
    </button>
  )
}
