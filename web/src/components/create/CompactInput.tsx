'use client'

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react'
import Image from 'next/image'
import { Slider } from '@/components/ui/slider'
import { Camera, ArrowUp, X, ChevronDown, ChevronsUpDown, Clipboard, Copy, Eraser } from 'lucide-react'
import type { GenerateMode } from '@/types'

const SIZE_OPTIONS = ['1:1', '3:4', '4:3', '9:16', '16:9', '3:2', '2:3', '21:9', '2K', '4K', '4K-9:16'] as const

/** Compress image to max 2048px longest side, JPEG quality 0.85 (~200-800KB output) */
function compressImage(file: File, maxDim = 2048, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

interface CompactInputProps {
  onSubmit: (params: {
    prompt: string
    mode: GenerateMode
    size: string
    referenceImages?: string[]
    strength?: number
  }) => Promise<void>
  disabled?: boolean
  activeCount?: number
  // Remix prefill
  remixData?: {
    prompt: string
    referenceImageUrls?: string[]
    size: string
    strength?: number
    mode: GenerateMode
  } | null
  onRemixClear?: () => void
}

export function CompactInput({ onSubmit, disabled, activeCount = 0, remixData, onRemixClear }: CompactInputProps) {
  const [prompt, setPrompt] = useState('')
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [size, setSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('seedream-size') || '3:4'
    }
    return '3:4'
  })
  const [showSizePicker, setShowSizePicker] = useState(false)
  const [strength, setStrength] = useState(0.5)
  const [textareaExpanded, setTextareaExpanded] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem('seedream-size', size)
  }, [size])

  // Remix prefill: when remixData changes (non-null), populate all fields
  useEffect(() => {
    if (!remixData) return
    setPrompt(remixData.prompt)
    setSize(remixData.size)
    if (remixData.strength !== undefined) setStrength(remixData.strength)
    if (remixData.referenceImageUrls && remixData.referenceImageUrls.length > 0) {
      setReferenceImages(remixData.referenceImageUrls)
    }
    // Focus the textarea so user can immediately edit
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [remixData])

  const mode: GenerateMode =
    referenceImages.length === 0 ? 'text' :
    referenceImages.length === 1 ? 'image' : 'multi'

  const canSubmit = !disabled && prompt.trim().length > 0

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    // Fire-and-forget: don't await, allow rapid consecutive sends
    onSubmit({
      prompt: prompt.trim(),
      mode,
      size,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      strength: mode !== 'text' ? strength : undefined,
    }).catch((err) => console.error('Submit failed:', err))
    onRemixClear?.()
    // Keep prompt and reference images for rapid re-submission
  }, [canSubmit, onSubmit, prompt, mode, size, referenceImages, strength, onRemixClear])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
    if (!textareaExpanded) {
      const el = e.target
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`
    }
  }, [textareaExpanded])

  const toggleTextareaExpand = useCallback(() => {
    setTextareaExpanded(prev => {
      const next = !prev
      if (textareaRef.current) {
        // Reset inline height so CSS min-h/max-h take effect
        textareaRef.current.style.height = ''
      }
      return next
    })
  }, [])

  const [copyFlash, setCopyFlash] = useState(false)

  const handlePaste = useCallback(async () => {
    // clipboard.readText() not supported on iOS Safari < 16.4
    if (navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          setPrompt(prev => prev + text)
          textareaRef.current?.focus()
          return
        }
      } catch { /* permission denied or not supported */ }
    }
    // Fallback: use execCommand('paste') via focused textarea
    textareaRef.current?.focus()
    document.execCommand('paste')
  }, [])

  const handleCopy = useCallback(async () => {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = prompt
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopyFlash(true)
    setTimeout(() => setCopyFlash(false), 600)
  }, [prompt])

  const handleClear = useCallback(() => {
    setPrompt('')
    if (textareaRef.current) {
      textareaRef.current.style.height = ''
    }
    textareaRef.current?.focus()
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const maxFiles = 14
    Array.from(files).slice(0, maxFiles - referenceImages.length).forEach(file => {
      compressImage(file).then(base64 => {
        setReferenceImages(prev => prev.length >= maxFiles ? prev : [...prev, base64])
      })
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [referenceImages.length])

  const removeImage = useCallback((index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div className="fixed bottom-14 left-0 right-0 z-30 bg-[#0d0e12] border-t border-white/5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="max-w-3xl mx-auto px-3 py-2">
        {/* Reference images strip */}
        {referenceImages.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
            {referenceImages.map((img, i) => (
              <div key={i} className="relative h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden group">
                <Image src={img} alt={`Ref ${i + 1}`} fill className="object-cover" unoptimized />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100
                           flex items-center justify-center transition-opacity"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            {referenceImages.length < 14 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-10 flex-shrink-0 rounded-lg border border-dashed border-zinc-700
                         flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <span className="text-lg">+</span>
              </button>
            )}
          </div>
        )}

        {/* Main input row */}
        <div className="flex items-end gap-2">
          {/* Camera button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center
                     text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
          >
            <Camera className="h-5 w-5" />
          </button>

          {/* Input area — always editable, no collapsed state */}
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="描述你想生成的图片..."
              className={`w-full px-3 py-2 pr-9 bg-zinc-800 rounded-xl
                       text-base text-white placeholder:text-zinc-600 resize-none
                       focus:outline-none focus:ring-1 focus:ring-emerald-500/30
                       transition-[min-height] duration-200
                       ${textareaExpanded ? 'min-h-[120px] max-h-[240px]' : 'min-h-[40px] max-h-[160px]'}`}
              rows={textareaExpanded ? 5 : 1}
            />
            {/* Expand/collapse toggle stays inside textarea */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleTextareaExpand() }}
              className="absolute right-1.5 top-1.5 h-7 w-7 flex items-center justify-center
                       rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
              title={textareaExpanded ? '收起' : '展开'}
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center transition-all
                      ${canSubmit
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/25'
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      }`}
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* Size badge / picker */}
            <div className="relative">
              <button
                onClick={() => setShowSizePicker(!showSizePicker)}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800
                         text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {size}
                <ChevronDown className={`h-3 w-3 transition-transform ${showSizePicker ? 'rotate-180' : ''}`} />
              </button>
              {showSizePicker && (
                <div className="absolute bottom-full mb-1 left-0 flex gap-0.5 p-1 bg-zinc-800 rounded-lg shadow-xl border border-white/10">
                  {SIZE_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setSize(s); setShowSizePicker(false) }}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all
                                ${size === s
                                  ? 'bg-zinc-700 text-white'
                                  : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Strength slider - only with reference images */}
            {referenceImages.length > 0 && (
              <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Strength</span>
                <Slider
                  value={[strength]}
                  onValueChange={([v]) => setStrength(v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="flex-1"
                />
                <span className="text-[10px] text-emerald-400 font-mono w-7">
                  {Math.round(strength * 100)}%
                </span>
              </div>
            )}

            {/* Active count indicator */}
            {activeCount > 0 && (
              <span className="text-[10px] text-zinc-600">
                {activeCount} active
              </span>
            )}

            {/* Prompt quick actions — pushed to the right */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={handlePaste}
                className="h-8 px-2 flex items-center gap-1 rounded-md
                         text-zinc-500 active:text-emerald-400 active:bg-white/5 transition-colors"
              >
                <Clipboard className="h-3.5 w-3.5" />
                <span className="text-[11px]">粘贴</span>
              </button>
              {prompt && (
                <>
                  <button
                    onClick={handleCopy}
                    className={`h-8 px-2 flex items-center gap-1 rounded-md
                             transition-colors ${copyFlash ? 'text-emerald-400' : 'text-zinc-500 active:text-emerald-400 active:bg-white/5'}`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-[11px]">{copyFlash ? '已复制' : '复制'}</span>
                  </button>
                  <button
                    onClick={handleClear}
                    className="h-8 px-2 flex items-center gap-1 rounded-md
                             text-zinc-500 active:text-red-400 active:bg-white/5 transition-colors"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    <span className="text-[11px]">清空</span>
                  </button>
                </>
              )}
            </div>
          </div>
      </div>
    </div>
  )
}
