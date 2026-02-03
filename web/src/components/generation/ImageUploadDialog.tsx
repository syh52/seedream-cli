'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Upload,
  X,
  Check,
  Copy,
  Loader2,
  ImagePlus,
  Link2,
} from 'lucide-react'
import { uploadBase64Image } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'

interface ImageUploadDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface UploadedImage {
  url: string
  preview: string
  copied: boolean
}

export function ImageUploadDialog({ isOpen, onClose }: ImageUploadDialogProps) {
  const { user } = useAuth()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const processFiles = useCallback(async (files: FileList) => {
    if (!user) {
      setError('请先登录')
      return
    }

    const validFiles = Array.from(files).filter(file =>
      file.type.startsWith('image/')
    ).slice(0, 5) // 最多 5 张

    if (validFiles.length === 0) {
      setError('请选择图片文件')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const uploadPromises = validFiles.map(async (file, index) => {
        // 转换为 base64
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })

        // 上传到 Firebase Storage
        const taskId = `upload-${Date.now()}`
        const url = await uploadBase64Image(base64, user.uid, taskId, index)

        return {
          url,
          preview: base64,
          copied: false,
        }
      })

      const results = await Promise.all(uploadPromises)
      setUploadedImages(prev => [...results, ...prev])
    } catch (err) {
      console.error('Upload failed:', err)
      setError('上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
  }, [user])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }, [processFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files)
    }
    // 重置 input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [processFiles])

  const handleCopy = useCallback(async (index: number) => {
    const image = uploadedImages[index]
    if (!image) return

    try {
      await navigator.clipboard.writeText(image.url)
      setUploadedImages(prev =>
        prev.map((img, i) =>
          i === index ? { ...img, copied: true } : img
        )
      )
      // 2 秒后重置
      setTimeout(() => {
        setUploadedImages(prev =>
          prev.map((img, i) =>
            i === index ? { ...img, copied: false } : img
          )
        )
      }, 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }, [uploadedImages])

  const handleClose = useCallback(() => {
    setUploadedImages([])
    setError(null)
    onClose()
  }, [onClose])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-lg w-[95vw] p-0 gap-0 border-white/10 bg-zinc-900/95
                   backdrop-blur-xl overflow-hidden rounded-2xl"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">上传图片获取 URL</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20
                          flex items-center justify-center">
              <Link2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">上传图片</h2>
              <p className="text-[11px] text-zinc-500">获取公开 URL 用于 Claude.ai</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-white
                     hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Upload Area */}
        <div className="p-5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8
                      flex flex-col items-center justify-center gap-3
                      cursor-pointer transition-all duration-200
                      ${isDragging
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-zinc-700 hover:border-zinc-600 hover:bg-white/[0.02]'
                      }
                      ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                <p className="text-sm text-zinc-400">上传中...</p>
              </>
            ) : (
              <>
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center
                              transition-colors duration-200
                              ${isDragging
                                ? 'bg-emerald-500/20'
                                : 'bg-zinc-800'
                              }`}>
                  <ImagePlus className={`h-6 w-6 transition-colors duration-200
                                       ${isDragging ? 'text-emerald-400' : 'text-zinc-500'}`} />
                </div>
                <div className="text-center">
                  <p className="text-sm text-zinc-300">
                    拖拽图片到这里，或 <span className="text-emerald-400">点击选择</span>
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    支持 JPG、PNG、WebP，最多 5 张
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Uploaded Images */}
        {uploadedImages.length > 0 && (
          <div className="border-t border-white/5">
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                已上传 {uploadedImages.length} 张图片
              </span>
              <button
                onClick={() => setUploadedImages([])}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                清除全部
              </button>
            </div>

            <div className="px-5 pb-5 space-y-3 max-h-64 overflow-y-auto">
              {uploadedImages.map((image, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl bg-zinc-800/50 border border-white/5"
                >
                  {/* Top row: Preview + Copy button */}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      {/* Preview */}
                      <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.preview}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="text-xs text-zinc-400">公开 URL</span>
                    </div>

                    {/* Copy Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(index)}
                      className={`h-8 px-3 flex-shrink-0 transition-all ${
                        image.copied
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {image.copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          复制
                        </>
                      )}
                    </Button>
                  </div>

                  {/* URL - full width, can wrap */}
                  <div
                    className="text-[11px] text-zinc-300 font-mono bg-zinc-900/50
                             px-2 py-1.5 rounded-lg break-all select-all cursor-text"
                    onClick={(e) => {
                      e.stopPropagation()
                      // Select all text when clicked
                      const selection = window.getSelection()
                      const range = document.createRange()
                      range.selectNodeContents(e.currentTarget)
                      selection?.removeAllRanges()
                      selection?.addRange(range)
                    }}
                  >
                    {image.url}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-white/5 bg-zinc-900/50">
          <p className="text-[11px] text-zinc-600 text-center">
            复制 URL 后，在 Claude.ai 中说 "用这张图片作为参考..."
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
