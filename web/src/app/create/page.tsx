'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Button } from '@/components/ui/button'
import { TaskCard } from '@/components/generation/TaskCard'
import { FloatingInputBar } from '@/components/generation/FloatingInputBar'
import { useGeneration, MAX_CONCURRENT_TASKS } from '@/contexts/GenerationContext'
import {
  Trash2,
  Sparkles,
} from 'lucide-react'
import type { GenerateMode, TaskImage } from '@/types'

export default function CreatePage() {
  const { user, signOut } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1728x2304')
  const [strength, setStrength] = useState(0.5)
  const [error, setError] = useState<string | null>(null)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputBarRef = useRef<HTMLDivElement>(null)
  const tasksEndRef = useRef<HTMLDivElement>(null)

  // 自动推断生成模式
  const inferredMode = useMemo((): GenerateMode => {
    if (referenceImages.length === 0) return 'text'
    if (referenceImages.length === 1) return 'image'
    return 'multi'
  }, [referenceImages.length])

  const {
    tasks,
    activeTaskCount,
    canStartNewTask,
    startGeneration,
    cancelTask,
    clearCompletedTasks,
  } = useGeneration()

  // 首次加载时滚动到底部（只执行一次）
  const hasScrolledRef = useRef(false)
  useEffect(() => {
    if (tasks.length > 0 && !hasScrolledRef.current) {
      hasScrolledRef.current = true
      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        tasksEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [tasks.length])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入提示词')
      return
    }

    setError(null)

    if (!canStartNewTask) {
      setError(`最多同时运行 ${MAX_CONCURRENT_TASKS} 个任务，请等待当前任务完成`)
      return
    }

    if (!user) {
      setError('请先登录后再生成图片')
      return
    }

    const taskId = await startGeneration({
      prompt,
      mode: inferredMode,
      size,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      strength: inferredMode !== 'text' ? strength : undefined,
      expectedCount: 4,
      userId: user.uid,
      userName: user.displayName || user.email || 'Anonymous',
    })

    if (!taskId) {
      setError('启动生成任务失败')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const maxFiles = 14
    const selectedFiles = Array.from(files).slice(0, maxFiles - referenceImages.length)

    selectedFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setReferenceImages(prev => {
          if (prev.length >= maxFiles) return prev
          return [...prev, base64]
        })
      }
      reader.readAsDataURL(file)
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImageUploadClick = () => {
    fileInputRef.current?.click()
  }

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index))
  }

  // 重新编辑：将图片作为参考图，保留 prompt
  const handleEdit = useCallback((image: TaskImage, taskPrompt: string) => {
    // 将图片 URL 转换为参考图片
    // 由于图片已是 URL，我们直接使用它作为参考
    setReferenceImages([image.url])
    setPrompt(taskPrompt)
    // 滚动到输入框
    inputBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [])

  // 再次生成：使用相同 prompt
  const handleRegenerate = useCallback(async (taskPrompt: string) => {
    setPrompt(taskPrompt)

    if (canStartNewTask && user) {
      await startGeneration({
        prompt: taskPrompt,
        mode: inferredMode,
        size,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        strength: inferredMode !== 'text' ? strength : undefined,
        expectedCount: 4,
        userId: user.uid,
        userName: user.displayName || user.email || 'Anonymous',
      })
    }
  }, [canStartNewTask, user, inferredMode, size, referenceImages, strength, startGeneration])

  const remainingSlots = MAX_CONCURRENT_TASKS - activeTaskCount
  const hasCompletedTasks = tasks.some(
    t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
  )

  return (
    <div className="flex min-h-dvh md:h-dvh">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <Sidebar
        user={user ? {
          displayName: user.displayName || 'User',
          email: user.email || '',
          photoURL: user.photoURL || undefined,
        } : null}
        onLogout={signOut}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-4 md:px-6 bg-zinc-950/50">
          <MobileNav
            user={user ? {
              displayName: user.displayName || 'User',
              email: user.email || '',
              photoURL: user.photoURL || undefined,
            } : null}
            onLogout={signOut}
          />
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">Create</h1>
              <p className="text-[10px] text-zinc-500 sd-mono">seedream 4.5</p>
            </div>
          </div>

          {/* Clear completed button */}
          {hasCompletedTasks && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-zinc-500 hover:text-zinc-300"
              onClick={clearCompletedTasks}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              清除已完成
            </Button>
          )}
        </div>

        {/* Results area - full width with bottom padding for input bar */}
        <div className="flex-1 overflow-auto bg-zinc-950 p-4 md:p-6 pb-48 md:pb-40 relative sd-noise">
          <div className="relative z-10 max-w-5xl mx-auto">
            {/* Error message */}
            {error && (
              <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {tasks.length > 0 ? (
              <div className="space-y-6">
                {tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onCancel={cancelTask}
                    onRegenerate={handleRegenerate}
                    onEdit={handleEdit}
                  />
                ))}
                {/* 滚动定位锚点 */}
                <div ref={tasksEndRef} />
              </div>
            ) : null}
          </div>
        </div>

        {/* Floating Input Bar */}
        <div ref={inputBarRef}>
          <FloatingInputBar
            prompt={prompt}
            onPromptChange={setPrompt}
            size={size}
            onSizeChange={setSize}
            strength={strength}
            onStrengthChange={setStrength}
            referenceImages={referenceImages}
            onAddImages={handleImageUploadClick}
            onRemoveImage={removeReferenceImage}
            onGenerate={handleGenerate}
            isGenerating={activeTaskCount > 0}
            canGenerate={canStartNewTask}
            activeTaskCount={activeTaskCount}
            remainingSlots={remainingSlots}
          />
        </div>
      </main>
    </div>
  )
}
