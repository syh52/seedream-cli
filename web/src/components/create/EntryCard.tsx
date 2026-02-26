'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Trash2, Copy, RotateCcw, X } from 'lucide-react'
import { EntryPills } from '@/components/create/PillBadge'
import type { Entry, EntryImage } from '@/types'

interface EntryCardProps {
  entry: Entry
  onImageClick: (entry: Entry, imageIndex: number) => void
  onDelete: (entry: Entry) => void
  onCopyPrompt: (prompt: string) => void
  onRemix: (entry: Entry) => void
}

/** Convert an entry's size string to a CSS aspect-ratio value for skeleton placeholders. */
function sizeToAspectRatio(size: string): string {
  // Handle ratio formats like "3:4", "16:9", etc.
  const ratioMatch = size.match(/^(\d+):(\d+)$/)
  if (ratioMatch) {
    return `${ratioMatch[1]} / ${ratioMatch[2]}`
  }
  // Named sizes default to 1:1
  return '1 / 1'
}

export function EntryCard({ entry, onImageClick, onDelete, onCopyPrompt, onRemix }: EntryCardProps) {
  const isActive = entry.status === 'active'
  const isDone = entry.status === 'done'
  const isFailed = entry.status === 'failed'

  const aspectRatio = useMemo(() => sizeToAspectRatio(entry.size), [entry.size])

  // Status dot color
  const dotClass = isActive
    ? 'bg-emerald-400 animate-pulse'
    : isDone
      ? 'bg-emerald-500'
      : 'bg-red-500'

  // "Imagine" label color
  const labelClass = isActive
    ? 'text-emerald-400'
    : isDone
      ? 'text-emerald-500'
      : 'text-red-400'

  return (
    <div className="bg-zinc-900/50 rounded-lg p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2">
        {/* Status dot */}
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotClass}`} />

        {/* Imagine label */}
        <span className={`text-sm font-medium flex-shrink-0 ${labelClass}`}>
          Imagine
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <button
          onClick={() => onDelete(entry)}
          className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onCopyPrompt(entry.prompt)}
          className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Copy prompt"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onRemix(entry)}
          className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Remix"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Prompt */}
      <p className="text-sm text-zinc-300 line-clamp-2">{entry.prompt}</p>

      {/* Parameter pills */}
      <EntryPills size={entry.size} mode={entry.mode} strength={entry.strength} />

      {/* 2x2 image grid */}
      <div className="grid grid-cols-2 gap-1">
        {entry.images.map((img, index) => (
          <ImageCell
            key={img.id}
            image={img}
            aspectRatio={aspectRatio}
            onClick={() => onImageClick(entry, index)}
          />
        ))}
      </div>
    </div>
  )
}

function ImageCell({ image, aspectRatio, onClick }: {
  image: EntryImage
  aspectRatio: string
  onClick: () => void
}) {
  const [loaded, setLoaded] = useState(false)

  if (image.status === 'pending') {
    return (
      <div
        className="animate-pulse bg-zinc-800 rounded-lg"
        style={{ aspectRatio }}
      />
    )
  }

  if (image.status === 'failed') {
    return (
      <div
        className="bg-zinc-800 rounded-lg flex items-center justify-center"
        style={{ aspectRatio }}
      >
        <X className="h-5 w-5 text-red-500/60" />
      </div>
    )
  }

  // status === 'done'
  return (
    <div
      className="relative rounded-lg overflow-hidden cursor-pointer"
      style={{ aspectRatio }}
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
        unoptimized
      />
    </div>
  )
}
