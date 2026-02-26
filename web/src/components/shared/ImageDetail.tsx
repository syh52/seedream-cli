'use client'

import { useState, useEffect } from 'react'
import { X, Heart, Download, MoreHorizontal, Copy, RotateCcw, Trash2 } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import type { Entry } from '@/types'

interface ImageDetailProps {
  entry?: Entry
  initialIndex?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onLike?: (entry: Entry) => void
  onDelete?: (entry: Entry) => void
  onRemix?: (entry: Entry) => void
}

export function ImageDetail({
  entry,
  initialIndex = 0,
  open,
  onOpenChange,
  onLike,
  onDelete,
  onRemix,
}: ImageDetailProps) {
  const [index, setIndex] = useState(initialIndex)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Derive animation class from open prop with a micro-delay for enter transition.
  // The component mounts with opacity-0 and transitions to opacity-100 via CSS
  // animation-fill-mode: forwards on the keyframe, no extra state needed.
  const [animState, setAnimState] = useState<'entering' | 'visible' | 'exiting' | 'hidden'>('hidden')

  useEffect(() => {
    if (open) {
      setAnimState('entering')
      const id = requestAnimationFrame(() => setAnimState('visible'))
      return () => cancelAnimationFrame(id)
    } else {
      setAnimState('hidden')
    }
  }, [open])

  // Reset index when entry changes
  useEffect(() => {
    setIndex(initialIndex)
  }, [entry?.id, initialIndex])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  const doneImages = entry?.images.filter((i) => i.status === 'done') ?? []
  const current = doneImages[index]
  const currentUrl = current?.url
  const currentId = current?.id

  function handleClose() {
    setAnimState('exiting')
    setTimeout(() => {
      setAnimState('hidden')
      onOpenChange(false)
    }, 200)
  }

  async function handleDownload() {
    if (!currentUrl || !currentId) return
    try {
      const res = await fetch(currentUrl)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `seedream-${currentId}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(currentUrl, '_blank')
    }
  }

  function handleCopyPrompt() {
    if (!entry) return
    navigator.clipboard.writeText(entry.prompt)
    setSheetOpen(false)
  }

  function handleRemixAction() {
    if (!entry || !onRemix) return
    setSheetOpen(false)
    onRemix(entry)
  }

  function handleDeleteAction() {
    if (!entry || !onDelete) return
    setSheetOpen(false)
    onDelete(entry)
  }

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        setIndex((i) => (i > 0 ? i - 1 : doneImages.length - 1))
      } else if (e.key === 'ArrowRight') {
        setIndex((i) => (i < doneImages.length - 1 ? i + 1 : 0))
      } else if (e.key === 'Escape' && !sheetOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (!open || !entry || !current) return null

  const isVisible = animState === 'visible'

  return (
    <div
      className={`fixed inset-0 z-[60] bg-[#0d0e12] transition-all duration-300 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      {/* Scrollable content */}
      <div className="h-full overflow-y-auto">
        <div className="flex min-h-full flex-col px-4 pt-4 pb-24">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Thumbnail strip */}
          {doneImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-3 pt-1 mb-3">
              {doneImages.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setIndex(i)}
                  className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded-md transition-all ${
                    i === index
                      ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-[#0d0e12]'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  <img
                    src={img.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Main image */}
          <div className="flex items-center justify-center flex-1 min-h-0 mb-4">
            <img
              src={current.url}
              alt={entry.prompt}
              className="max-h-[50vh] w-full object-contain rounded-lg"
            />
          </div>

          {/* Prompt */}
          <p className="text-sm text-zinc-300 leading-relaxed mb-3">
            {entry.prompt}
          </p>

          {/* Parameter pills */}
          <div className="flex gap-1.5 flex-wrap mb-6">
            <span className="bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5 text-xs">
              {entry.size}
            </span>
            <span className="bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5 text-xs">
              {entry.mode} mode
            </span>
            {entry.strength !== undefined && (
              <span className="bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5 text-xs">
                str {entry.strength}
              </span>
            )}
            {doneImages.length > 1 && (
              <span className="bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5 text-xs">
                {index + 1}/{doneImages.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Fixed bottom action bar */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-6 py-5 bg-gradient-to-t from-[#0d0e12] via-[#0d0e12] to-transparent pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {/* Like */}
        {onLike && (
          <button
            onClick={() => onLike(entry)}
            className="h-12 w-12 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Like"
          >
            <Heart
              className={`h-5 w-5 ${
                entry.liked ? 'fill-red-500 text-red-500' : ''
              }`}
            />
          </button>
        )}

        {/* Download */}
        <button
          onClick={handleDownload}
          className="h-12 w-12 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Download"
        >
          <Download className="h-5 w-5" />
        </button>

        {/* More */}
        <button
          onClick={() => setSheetOpen(true)}
          className="h-12 w-12 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          title="More"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Bottom Sheet menu */}
      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {/* Header: thumbnail + prompt summary */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md">
            <img
              src={current.url}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-200 line-clamp-1">
              {entry.prompt}
            </p>
            <p className="text-xs text-zinc-500">
              by {entry.userName}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="py-1">
          <button
            onClick={handleCopyPrompt}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-zinc-200 hover:bg-white/5 transition-colors"
          >
            <Copy className="h-4 w-4 text-zinc-400" />
            Copy prompt
          </button>

          {onRemix && (
            <button
              onClick={handleRemixAction}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-zinc-200 hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="h-4 w-4 text-zinc-400" />
              Remix
            </button>
          )}

          {onDelete && (
            <button
              onClick={handleDeleteAction}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
