'use client'

import { useRef, useCallback, KeyboardEvent } from 'react'
import Image from 'next/image'
import { Slider } from '@/components/ui/slider'
import {
  Plus,
  X,
  ArrowUp,
  Loader2,
  ImagePlus,
  Settings2,
  Link2,
} from 'lucide-react'
import { useState } from 'react'
import { ImageUploadDialog } from './ImageUploadDialog'

// Size options - simplified labels
const SIZE_OPTIONS = [
  { value: '1728x2304', label: '3:4' },
  { value: '2304x1728', label: '4:3' },
  { value: '1440x2560', label: '9:16' },
  { value: '2560x1440', label: '16:9' },
  { value: '2048x2048', label: '1:1' },
  { value: '2K', label: '2K' },
]

interface FloatingInputBarProps {
  prompt: string
  onPromptChange: (value: string) => void
  size: string
  onSizeChange: (value: string) => void
  strength: number
  onStrengthChange: (value: number) => void
  referenceImages: string[]
  onAddImages: () => void
  onRemoveImage: (index: number) => void
  onGenerate: () => void
  isGenerating: boolean
  canGenerate: boolean
  activeTaskCount: number
  remainingSlots: number
}

export function FloatingInputBar({
  prompt,
  onPromptChange,
  size,
  onSizeChange,
  strength,
  onStrengthChange,
  referenceImages,
  onAddImages,
  onRemoveImage,
  onGenerate,
  isGenerating,
  canGenerate,
}: FloatingInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)

  const hasReferenceImages = referenceImages.length > 0

  // Handle Enter key to submit (Shift+Enter for new line)
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canGenerate && prompt.trim()) {
        onGenerate()
      }
    }
  }, [canGenerate, prompt, onGenerate])

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target
    onPromptChange(target.value)
    target.style.height = 'auto'
    target.style.height = `${Math.min(target.scrollHeight, 160)}px`
  }, [onPromptChange])

  const canSubmit = canGenerate && prompt.trim()

  return (
    <div className="fixed bottom-0 left-0 right-0 md:left-64 z-30">
      {/* Subtle gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/98 to-zinc-950/90 backdrop-blur-2xl" />

      <div className="relative max-w-3xl mx-auto px-4 pt-3 pb-safe">
        {/* Main input card */}
        <div className="relative rounded-2xl bg-zinc-900/80 border border-white/[0.06] shadow-2xl shadow-black/20 overflow-hidden">

          {/* Reference images - compact inline display */}
          {hasReferenceImages && (
            <div className="flex items-center gap-1 px-3 pt-3 pb-1">
              <div className="flex items-center -space-x-2">
                {referenceImages.slice(0, 4).map((img, index) => (
                  <div
                    key={index}
                    className="relative h-8 w-8 rounded-lg overflow-hidden ring-2 ring-zinc-900
                             hover:ring-emerald-500/50 hover:z-10 transition-all cursor-pointer group"
                    onClick={() => onRemoveImage(index)}
                  >
                    <Image
                      src={img}
                      alt={`Ref ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
                                  flex items-center justify-center transition-opacity">
                      <X className="h-3 w-3 text-white" />
                    </div>
                  </div>
                ))}
                {referenceImages.length > 4 && (
                  <div className="h-8 w-8 rounded-lg bg-zinc-800 ring-2 ring-zinc-900
                                flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                    +{referenceImages.length - 4}
                  </div>
                )}
              </div>

              {referenceImages.length < 14 && (
                <button
                  onClick={onAddImages}
                  className="h-8 w-8 rounded-lg border border-dashed border-zinc-700
                           flex items-center justify-center text-zinc-500 hover:text-zinc-300
                           hover:border-zinc-500 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}

              <span className="text-[10px] text-zinc-600 ml-auto sd-mono">
                {referenceImages.length} ref
              </span>
            </div>
          )}

          {/* Input area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder=""
              className="w-full min-h-[56px] max-h-[160px] px-4 py-4 pr-28
                       bg-transparent text-[15px] text-white placeholder:text-zinc-600
                       resize-none focus:outline-none leading-relaxed"
              rows={1}
            />

            {/* Right side actions */}
            <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
              {/* Add image button */}
              <button
                onClick={onAddImages}
                className="h-9 w-9 rounded-xl flex items-center justify-center
                         text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all"
                title="添加参考图片"
              >
                <ImagePlus className="h-[18px] w-[18px]" />
              </button>

              {/* Upload for URL button */}
              <button
                onClick={() => setShowUploadDialog(true)}
                className="h-9 w-9 rounded-xl flex items-center justify-center
                         text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                title="上传图片获取URL"
              >
                <Link2 className="h-[18px] w-[18px]" />
              </button>

              {/* Options toggle */}
              <button
                onClick={() => setShowOptions(!showOptions)}
                className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all
                          ${showOptions
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                          }`}
                title="选项"
              >
                <Settings2 className="h-[18px] w-[18px]" />
              </button>

              {/* Submit button */}
              <button
                onClick={onGenerate}
                disabled={!canSubmit}
                className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all
                          ${canSubmit
                            ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/25'
                            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                          }`}
              >
                {isGenerating ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <ArrowUp className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>
          </div>

          {/* Options panel - elegant slide reveal */}
          <div
            className={`grid transition-all duration-200 ease-out
                      ${showOptions ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
          >
            <div className="overflow-hidden">
              <div className="px-4 py-3 border-t border-white/[0.04] flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
                {/* Size selector */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider shrink-0">Size</span>
                  <div className="flex bg-zinc-800/50 rounded-lg p-0.5 overflow-x-auto">
                    {SIZE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => onSizeChange(option.value)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0
                                  ${size === option.value
                                    ? 'bg-zinc-700 text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                  }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Strength slider - only when has reference images */}
                {hasReferenceImages && (
                  <>
                    <div className="hidden md:block w-px h-5 bg-zinc-800" />
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-zinc-500 uppercase tracking-wider shrink-0">Strength</span>
                      <Slider
                        value={[strength]}
                        onValueChange={([v]) => onStrengthChange(v)}
                        min={0}
                        max={1}
                        step={0.05}
                        className="flex-1 min-w-[100px]"
                      />
                      <span className="text-[11px] text-emerald-400 sd-mono w-8 shrink-0">
                        {Math.round(strength * 100)}%
                      </span>
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* Image Upload Dialog */}
        <ImageUploadDialog
          isOpen={showUploadDialog}
          onClose={() => setShowUploadDialog(false)}
        />

        {/* Subtle hint */}
        <p className="text-center text-[10px] text-zinc-700 mt-2 mb-1">
          Press <kbd className="px-1 py-0.5 rounded bg-zinc-800/50 text-zinc-500">Enter</kbd> to generate
        </p>
      </div>
    </div>
  )
}
