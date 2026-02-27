'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
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

  useEffect(() => {
    setIndex(initialIndex)
  }, [entry?.id, initialIndex])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
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
  }, [open, doneImages.length, sheetOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !entry || !current) return null

  const isVisible = animState === 'visible'

  return (
    <div
      className={`fixed inset-0 z-[60] bg-black transition-all duration-300 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      {/* Full-screen image — fills entire viewport */}
      <div className="absolute inset-0">
        <Image
          src={current.url}
          alt={entry.prompt}
          fill
          className="object-contain"
          sizes="100vw"
          priority
        />
      </div>

      {/* Top bar: close + thumbnails */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center gap-2 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={handleClose}
          className="h-9 w-9 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Inline thumbnail strip */}
        {doneImages.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto ml-2">
            {doneImages.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setIndex(i)}
                className={`h-8 w-8 flex-shrink-0 overflow-hidden rounded transition-all ${
                  i === index
                    ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-black'
                    : 'opacity-40 hover:opacity-70'
                }`}
              >
                <Image
                  src={img.url}
                  alt=""
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                  sizes="32px"
                />
              </button>
            ))}
          </div>
        )}

        {/* Counter */}
        {doneImages.length > 1 && (
          <span className="ml-auto text-xs text-white/50 font-mono flex-shrink-0">
            {index + 1}/{doneImages.length}
          </span>
        )}
      </div>

      {/* Bottom overlay: prompt + actions */}
      <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-16 pb-[calc(1rem+env(safe-area-inset-bottom))] px-4">
        {/* Prompt text */}
        <p className="text-sm text-white/80 leading-relaxed line-clamp-2 mb-1">
          {entry.prompt}
        </p>

        {/* Parameter chips */}
        <div className="flex gap-1.5 mb-4">
          <span className="text-[10px] text-white/40">
            {entry.size} · {entry.mode}
            {entry.strength !== undefined && ` · str ${entry.strength}`}
          </span>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-center gap-4">
          {onLike && (
            <button
              onClick={() => onLike(entry)}
              className="h-11 w-11 rounded-full flex items-center justify-center text-white/60 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
              title="Like"
            >
              <Heart
                className={`h-5 w-5 ${
                  entry.liked ? 'fill-red-500 text-red-500' : ''
                }`}
              />
            </button>
          )}

          <button
            onClick={handleDownload}
            className="h-11 w-11 rounded-full flex items-center justify-center text-white/60 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </button>

          <button
            onClick={() => setSheetOpen(true)}
            className="h-11 w-11 rounded-full flex items-center justify-center text-white/60 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
            title="More"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Bottom Sheet menu */}
      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md relative">
            <Image
              src={current.url}
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-cover"
              sizes="40px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-200 line-clamp-1">{entry.prompt}</p>
            <p className="text-xs text-zinc-500">by {entry.userName}</p>
          </div>
        </div>

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
