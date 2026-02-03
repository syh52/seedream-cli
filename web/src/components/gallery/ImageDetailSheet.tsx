'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Heart,
  Download,
  Copy,
  RefreshCw,
  X,
  Check,
  Share2,
} from 'lucide-react'
import type { ImageRecord } from '@/types'

interface ImageDetailSheetProps {
  image: ImageRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLike?: (image: ImageRecord) => void
  onDownload?: (image: ImageRecord) => void
  onRegenerate?: (prompt: string) => void
}

export function ImageDetailSheet({
  image,
  open,
  onOpenChange,
  onLike,
  onDownload,
  onRegenerate,
}: ImageDetailSheetProps) {
  const [copied, setCopied] = useState(false)

  if (!image) return null

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(image.prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    const url = image.imageUrl || image.originalUrl
    if (navigator.share) {
      await navigator.share({
        title: 'SeeDream Image',
        text: image.prompt,
        url: url,
      })
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[95dvh] rounded-t-3xl border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl p-0 overflow-hidden"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Image Details</SheetTitle>

        {/* Header with close button */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xs font-bold text-white">
              {image.userName?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-sm font-medium text-white/90">
              {image.userName || 'Anonymous'}
            </span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="h-full overflow-y-auto overscroll-contain pt-16 pb-safe">
          {/* Image container */}
          <div className="relative px-4 pt-2">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
              <img
                src={image.imageUrl || image.originalUrl}
                alt={image.prompt}
                className="w-full h-auto max-h-[55dvh] object-contain bg-black/50"
              />

              {/* Like badge */}
              {image.liked && (
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-500/90 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
                  <Heart className="h-3 w-3 fill-white" />
                  <span>Liked</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-4 py-5">
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => onLike?.(image)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-4 transition-all active:scale-95 ${
                  image.liked
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Heart className={`h-6 w-6 ${image.liked ? 'fill-current' : ''}`} />
                <span className="text-xs font-medium">
                  {image.liked ? 'Liked' : 'Like'}
                </span>
              </button>

              <button
                onClick={() => onDownload?.(image)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-zinc-400 transition-all hover:text-white hover:bg-white/10 active:scale-95"
              >
                <Download className="h-6 w-6" />
                <span className="text-xs font-medium">Save</span>
              </button>

              <button
                onClick={handleCopyPrompt}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-4 transition-all active:scale-95 ${
                  copied
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {copied ? (
                  <Check className="h-6 w-6" />
                ) : (
                  <Copy className="h-6 w-6" />
                )}
                <span className="text-xs font-medium">
                  {copied ? 'Copied!' : 'Copy'}
                </span>
              </button>

              <button
                onClick={handleShare}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-zinc-400 transition-all hover:text-white hover:bg-white/10 active:scale-95"
              >
                <Share2 className="h-6 w-6" />
                <span className="text-xs font-medium">Share</span>
              </button>
            </div>
          </div>

          {/* Prompt section */}
          <div className="px-4 pb-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Prompt
                </h3>
                <button
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">
                {image.prompt}
              </p>
            </div>
          </div>

          {/* Regenerate button */}
          {onRegenerate && (
            <div className="px-4 pb-8">
              <Button
                onClick={() => {
                  onRegenerate(image.prompt)
                  onOpenChange(false)
                }}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl transition-all active:scale-[0.98]"
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                Regenerate with this prompt
              </Button>
            </div>
          )}

          {/* Image info */}
          <div className="px-4 pb-8">
            <div className="flex items-center justify-center gap-4 text-xs text-zinc-600">
              <span className="sd-mono">{image.size || 'Unknown size'}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="sd-mono">
                {image.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
              </span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
