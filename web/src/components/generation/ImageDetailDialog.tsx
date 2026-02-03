'use client'

import { useEffect, useCallback, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  RefreshCw,
  Edit3,
  Copy,
  Check,
} from 'lucide-react'
import type { TaskImage } from '@/types'

interface ImageDetailDialogProps {
  isOpen: boolean
  onClose: () => void
  images: TaskImage[]
  initialIndex: number
  prompt: string
  onDownload: (image: TaskImage) => void
  onSave?: (image: TaskImage) => void
  onRegenerate?: () => void
  onEdit?: (image: TaskImage) => void
}

export function ImageDetailDialog({
  isOpen,
  onClose,
  images,
  initialIndex,
  prompt,
  onDownload,
  onSave,
  onRegenerate,
  onEdit,
}: ImageDetailDialogProps) {
  const readyImages = images.filter(img => img.status === 'ready')

  // Use initialIndex directly, clamp to valid range
  const clampedInitialIndex = Math.max(0, Math.min(initialIndex, readyImages.length - 1))
  const [currentIndex, setCurrentIndex] = useState(clampedInitialIndex)
  const [copied, setCopied] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)

  // Sync currentIndex when initialIndex changes (dialog reopens with different image)
  // This is a controlled pattern - parent controls initial state
  const currentValidIndex = currentIndex >= 0 && currentIndex < readyImages.length
    ? currentIndex
    : clampedInitialIndex

  const currentImage = readyImages[currentValidIndex]
  const totalImages = readyImages.length

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setCurrentIndex(prev => (prev > 0 ? prev - 1 : totalImages - 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setCurrentIndex(prev => (prev < totalImages - 1 ? prev + 1 : 0))
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, totalImages, onClose])

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [prompt])

  const handleCopyUrl = useCallback(async () => {
    if (!currentImage?.url) return
    try {
      await navigator.clipboard.writeText(currentImage.url)
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }, [currentImage?.url])

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : totalImages - 1))
  }, [totalImages])

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev < totalImages - 1 ? prev + 1 : 0))
  }, [totalImages])

  if (!currentImage) return null

  // Parse aspect ratio from size string
  const getAspectRatio = (size?: string): number => {
    if (!size) return 1
    const match = size.match(/(\d+)[x×](\d+)/i)
    if (match) {
      return parseInt(match[1], 10) / parseInt(match[2], 10)
    }
    return 1
  }

  const aspectRatio = getAspectRatio(currentImage.size)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-6xl sm:max-w-6xl w-[95vw] h-[90vh] p-0 gap-0 border-white/10 bg-zinc-900/95
                 backdrop-blur-xl overflow-hidden"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">图片详情</DialogTitle>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full
                   bg-black/50 hover:bg-black/70 text-white/80 hover:text-white
                   transition-colors backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col md:flex-row h-full">
          {/* Left panel - Image preview */}
          <div className="relative flex-1 flex items-center justify-center bg-black/30 p-2 md:p-4 min-h-0">
            {/* Main image - use native img for proper sizing */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage.url}
              alt={`Generated image ${currentValidIndex + 1}`}
              className="max-w-full max-h-[calc(90vh-4rem)] object-contain"
            />

            {/* Navigation arrows - vertical stack on right edge */}
            {totalImages > 1 && (
              <div className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                <button
                  onClick={goToPrevious}
                  className="p-1 rounded bg-black/40 hover:bg-black/60
                           text-white/50 hover:text-white transition-colors"
                  title="上一张"
                >
                  <ChevronLeft className="h-3.5 w-3.5 rotate-90" />
                </button>
                <span className="text-[9px] text-white/40 sd-mono">
                  {currentValidIndex + 1}/{totalImages}
                </span>
                <button
                  onClick={goToNext}
                  className="p-1 rounded bg-black/40 hover:bg-black/60
                           text-white/50 hover:text-white transition-colors"
                  title="下一张"
                >
                  <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                </button>
              </div>
            )}
          </div>

          {/* Right panel - Info and actions */}
          <div className="w-full md:w-80 flex flex-col border-t md:border-t-0 md:border-l border-white/5
                       bg-zinc-900/50 max-h-[40vh] md:max-h-none overflow-y-auto">
            {/* Top actions */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDownload(currentImage)}
                  className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-white/10"
                  title="下载"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyUrl}
                  className={`h-9 w-9 transition-colors ${
                    urlCopied
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={urlCopied ? '已复制' : '复制图片 URL'}
                >
                  {urlCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                {onSave && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onSave(currentImage)}
                    className="h-9 w-9 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                    title="收藏"
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {currentImage.size && (
                <span className="text-xs text-zinc-500 sd-mono px-2 py-1 bg-white/5 rounded">
                  {currentImage.size}
                </span>
              )}
            </div>

            {/* Thumbnails */}
            {totalImages > 1 && (
              <div className="p-4 border-b border-white/5">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {readyImages.map((img, index) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentIndex(index)}
                      className={`relative flex-shrink-0 h-14 w-14 rounded-lg overflow-hidden
                               transition-all duration-200 ${
                                 index === currentValidIndex
                                   ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-900'
                                   : 'opacity-60 hover:opacity-100'
                               }`}
                    >
                      <Image
                        src={img.url}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt section */}
            <div className="flex-1 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Prompt
                </h3>
                <button
                  onClick={handleCopyPrompt}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs
                           transition-all duration-200 ${
                             copied
                               ? 'bg-emerald-500/20 text-emerald-400'
                               : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
                           }`}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      复制
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-zinc-800/50 border border-white/5
                           max-h-24 overflow-y-auto scrollbar-thin">
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {prompt}
                </p>
              </div>
            </div>

            {/* Bottom actions */}
            <div className="p-4 border-t border-white/5 space-y-2">
              {onEdit && (
                <Button
                  onClick={() => onEdit(currentImage)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white
                           h-11 rounded-xl font-medium shadow-lg shadow-emerald-900/30"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  重新编辑
                </Button>
              )}

              {onRegenerate && (
                <Button
                  onClick={onRegenerate}
                  variant="outline"
                  className="w-full border-white/10 bg-white/5 hover:bg-white/10
                           text-zinc-300 h-10 rounded-xl"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  再次生成
                </Button>
              )}
            </div>

            {/* Keyboard hints - desktop only */}
            <div className="hidden md:flex items-center justify-center gap-4 p-3
                         text-[10px] text-zinc-600 border-t border-white/5">
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 sd-mono">←</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 sd-mono ml-1">→</kbd>
                {' '}切换
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 sd-mono">ESC</kbd>
                {' '}关闭
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
