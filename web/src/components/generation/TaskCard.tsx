'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { GenerationTask, TaskImage } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { createImageRecord } from '@/lib/firestore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Loader2,
  Check,
  X,
  AlertCircle,
  Ban,
  ImageIcon,
  RefreshCw,
  Edit3,
  Expand,
} from 'lucide-react'
import { useState, useMemo, useCallback } from 'react'
import { ImageDetailDialog } from './ImageDetailDialog'

interface TaskCardProps {
  task: GenerationTask
  onCancel: (taskId: string) => void
  onRegenerate?: (prompt: string) => void
  onEdit?: (image: TaskImage, prompt: string) => void
}

interface SaveState {
  [imageId: string]: {
    saving: boolean
    saved: boolean
  }
}

// Parse size string like "1536x2048" to get aspect ratio
function parseAspectRatio(sizeStr: string): number {
  if (!sizeStr) return 1
  const match = sizeStr.match(/(\d+)[x×](\d+)/i)
  if (match) {
    const width = parseInt(match[1], 10)
    const height = parseInt(match[2], 10)
    if (width > 0 && height > 0) {
      return width / height
    }
  }
  return 1
}

// Get CSS aspect ratio style
function getAspectRatioStyle(ratio: number): React.CSSProperties {
  return { aspectRatio: ratio.toString() }
}

export function TaskCard({ task, onCancel, onRegenerate, onEdit }: TaskCardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [saveStates, setSaveStates] = useState<SaveState>({})
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    initialIndex: number
  }>({ isOpen: false, initialIndex: 0 })

  const completedImages = task.images.filter(img => img.status === 'ready').length
  const progress = task.expectedCount > 0
    ? Math.round((completedImages / task.expectedCount) * 100)
    : 0

  // Get the dominant aspect ratio from completed images
  const dominantAspectRatio = useMemo(() => {
    const readyImages = task.images.filter(img => img.status === 'ready' && img.size)
    if (readyImages.length > 0) {
      return parseAspectRatio(readyImages[0].size)
    }
    // Fallback to task size setting
    const sizeMap: Record<string, number> = {
      '3:4': 3 / 4,
      '4:3': 4 / 3,
      '9:16': 9 / 16,
      '16:9': 16 / 9,
      '1:1': 1,
      '2K': 2 / 3,
    }
    return sizeMap[task.size] || 1
  }, [task.images, task.size])

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: { label: '等待中', color: 'text-zinc-400', bgColor: 'bg-zinc-400' },
    generating: { label: '生成中', color: 'text-emerald-400', bgColor: 'bg-emerald-400' },
    processing: { label: '生成中', color: 'text-emerald-400', bgColor: 'bg-emerald-400' },
    completed: { label: '已完成', color: 'text-emerald-400', bgColor: 'bg-emerald-400' },
    failed: { label: '失败', color: 'text-red-400', bgColor: 'bg-red-400' },
    cancelled: { label: '已取消', color: 'text-zinc-500', bgColor: 'bg-zinc-500' },
  }

  const status = statusConfig[task.status]

  const handleSave = async (image: TaskImage) => {
    if (!user) {
      router.push('/login')
      return
    }

    const imageState = saveStates[image.id]
    if (imageState?.saved || imageState?.saving) return

    setSaveStates(prev => ({
      ...prev,
      [image.id]: { saving: true, saved: false },
    }))

    try {
      await createImageRecord({
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        prompt: task.prompt,
        imageUrl: image.url,
        originalUrl: image.url,
        size: task.size,
        mode: task.mode,
      })

      setSaveStates(prev => ({
        ...prev,
        [image.id]: { saving: false, saved: true },
      }))
    } catch (err) {
      console.error('Failed to save image:', err)
      setSaveStates(prev => ({
        ...prev,
        [image.id]: { saving: false, saved: false },
      }))
    }
  }

  const handleDownload = useCallback(async (image: TaskImage) => {
    try {
      const response = await fetch(image.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `seedream-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download:', err)
      window.open(image.url, '_blank')
    }
  }, [])

  const openDialog = useCallback((index: number) => {
    // Find the actual index among ready images
    const readyImages = task.images.filter(img => img.status === 'ready')
    const readyIndex = readyImages.findIndex(img => img.id === task.images[index]?.id)
    setDialogState({
      isOpen: true,
      initialIndex: readyIndex >= 0 ? readyIndex : 0,
    })
  }, [task.images])

  const closeDialog = useCallback(() => {
    setDialogState({ isOpen: false, initialIndex: 0 })
  }, [])

  const handleDialogRegenerate = useCallback(() => {
    closeDialog()
    onRegenerate?.(task.prompt)
  }, [closeDialog, onRegenerate, task.prompt])

  const handleDialogEdit = useCallback((image: TaskImage) => {
    closeDialog()
    onEdit?.(image, task.prompt)
  }, [closeDialog, onEdit, task.prompt])

  // Generate placeholder slots for pending images
  const placeholderCount = Math.max(0, task.expectedCount - task.images.length)
  const placeholders = Array(placeholderCount).fill(null)

  const isActive = task.status === 'pending' || task.status === 'generating'
  const isCompleted = task.status === 'completed'
  const readyImages = task.images.filter(img => img.status === 'ready')

  return (
    <>
      <Card className="overflow-hidden border-white/5 bg-zinc-900/50 rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              {task.status === 'generating' && (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              )}
              {task.status === 'completed' && (
                <Check className="h-4 w-4 text-emerald-400" />
              )}
              {task.status === 'failed' && (
                <AlertCircle className="h-4 w-4 text-red-400" />
              )}
              {task.status === 'cancelled' && (
                <Ban className="h-4 w-4 text-zinc-500" />
              )}
              {task.status === 'pending' && (
                <div className={`h-2 w-2 rounded-full ${status.bgColor} animate-pulse`} />
              )}
              <span className={`text-xs font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>

            {/* Prompt - show full text */}
            <p className="text-xs text-zinc-400 flex-1 break-words">
              {task.prompt}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Progress */}
            {isActive && (
              <span className="text-xs text-zinc-500 sd-mono">
                {completedImages}/{task.expectedCount}
              </span>
            )}

            {/* Cancel button */}
            {isActive && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                onClick={() => onCancel(task.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {isActive && (
          <div className="h-1 bg-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Error message */}
        {task.error && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
            <p className="text-xs text-red-400">{task.error}</p>
          </div>
        )}

        {/* Horizontal image grid */}
        <div className="p-4">
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory
                       scrollbar-thin md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
            {/* Ready images */}
            {task.images.map((image, index) => {
              const aspectRatio = image.size ? parseAspectRatio(image.size) : dominantAspectRatio

              if (image.status === 'error') {
                return (
                  <div
                    key={image.id}
                    className="flex-shrink-0 w-[calc(50%-6px)] md:w-auto snap-start
                             rounded-lg bg-red-500/10 border border-red-500/20
                             flex flex-col items-center justify-center p-2 gap-1"
                    style={getAspectRatioStyle(dominantAspectRatio)}
                    title={image.error || 'Generation failed'}
                  >
                    <AlertCircle className="h-6 w-6 text-red-400" />
                    {image.error && (
                      <p className="text-[10px] text-red-400 text-center line-clamp-2">
                        {image.error.length > 50 ? `${image.error.slice(0, 50)}...` : image.error}
                      </p>
                    )}
                  </div>
                )
              }

              if (image.status === 'pending') {
                return (
                  <div
                    key={image.id}
                    className="flex-shrink-0 w-[calc(50%-6px)] md:w-auto snap-start
                             rounded-lg bg-zinc-800/50 border border-zinc-700/30
                             flex items-center justify-center"
                    style={getAspectRatioStyle(dominantAspectRatio)}
                  >
                    <Loader2 className="h-6 w-6 text-zinc-600 animate-spin" />
                  </div>
                )
              }

              return (
                <div
                  key={image.id}
                  className={`flex-shrink-0 w-[calc(50%-6px)] md:w-auto snap-start
                            group relative rounded-lg overflow-hidden cursor-pointer
                            transition-transform duration-200 hover:scale-[1.02]
                            sd-animate-in sd-stagger-${(index % 4) + 1}`}
                  style={getAspectRatioStyle(aspectRatio)}
                  onClick={() => openDialog(index)}
                >
                  <Image
                    src={image.url}
                    alt={`Generated ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    priority={index < 2}
                    unoptimized
                  />
                  {/* Simple hover overlay with expand icon */}
                  <div className="absolute inset-0 flex items-center justify-center
                               bg-black/50 opacity-0 transition-opacity duration-200
                               group-hover:opacity-100">
                    <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
                      <Expand className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Placeholder slots */}
            {placeholders.map((_, index) => (
              <div
                key={`placeholder-${index}`}
                className="flex-shrink-0 w-[calc(50%-6px)] md:w-auto snap-start
                         rounded-lg bg-zinc-800/50 border border-zinc-700/30
                         flex items-center justify-center"
                style={getAspectRatioStyle(dominantAspectRatio)}
              >
                {isActive ? (
                  <Loader2 className="h-6 w-6 text-zinc-600 animate-spin" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-zinc-700" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer with actions */}
        {(isCompleted && readyImages.length > 0) && (
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between gap-2">
            {/* Usage info */}
            {task.usage && (
              <div className="text-xs text-zinc-500">
                <span className="sd-mono">{task.usage.generated_images}</span> 张 ·{' '}
                <span className="sd-mono">{task.usage.total_tokens.toLocaleString()}</span> tokens
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 ml-auto">
              {onEdit && readyImages.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10"
                  onClick={() => onEdit(readyImages[0], task.prompt)}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                  重新编辑
                </Button>
              )}
              {onRegenerate && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10"
                  onClick={() => onRegenerate(task.prompt)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  再次生成
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Image Detail Dialog */}
      <ImageDetailDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        images={task.images}
        initialIndex={dialogState.initialIndex}
        prompt={task.prompt}
        onDownload={handleDownload}
        onSave={user ? handleSave : undefined}
        onRegenerate={onRegenerate ? handleDialogRegenerate : undefined}
        onEdit={onEdit ? handleDialogEdit : undefined}
      />
    </>
  )
}
