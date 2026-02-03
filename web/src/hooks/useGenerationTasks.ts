'use client'

import { useState, useCallback, useRef } from 'react'
import type {
  GenerationTask,
  TaskImage,
  GenerateMode,
  SSEEvent,
} from '@/types'
import { uploadImageFromUrl } from '@/lib/storage'
import { createImageRecord } from '@/lib/firestore'

// Re-export constant for use in components
export { MAX_CONCURRENT_TASKS } from '@/types'

interface StartGenerationParams {
  prompt: string
  mode: GenerateMode
  size: string
  referenceImages?: string[]
  strength?: number  // 0-1, image reference strength
  expectedCount?: number
  userId: string
  userName: string
}

interface UseGenerationTasksReturn {
  tasks: GenerationTask[]
  activeTaskCount: number
  canStartNewTask: boolean
  startGeneration: (params: StartGenerationParams) => string | null
  cancelTask: (taskId: string) => void
  clearCompletedTasks: () => void
  clearAllTasks: () => void
}

const MAX_TASKS = 3 // MAX_CONCURRENT_TASKS value
const MAX_TASK_HISTORY = 10 // Limit task history to prevent memory leaks

export function useGenerationTasks(): UseGenerationTasksReturn {
  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  // Track which images have been saved to prevent duplicates
  const savedImagesRef = useRef<Set<string>>(new Set())

  // Calculate active tasks
  const activeTaskCount = tasks.filter(
    t => t.status === 'pending' || t.status === 'generating'
  ).length

  const canStartNewTask = activeTaskCount < MAX_TASKS

  // Generate unique task ID
  const generateTaskId = useCallback(() => {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }, [])

  // Save a single image to Firebase (async, doesn't block UI)
  const saveImageToFirebase = useCallback(
    async (
      imageUrl: string,
      taskId: string,
      imageIndex: number,
      params: { userId: string; userName: string; prompt: string; size: string; mode: GenerateMode }
    ) => {
      const saveKey = `${taskId}-${imageIndex}`

      // Prevent duplicate saves
      if (savedImagesRef.current.has(saveKey)) {
        return
      }
      savedImagesRef.current.add(saveKey)

      try {
        // Upload to Firebase Storage for permanent URL
        const permanentUrl = await uploadImageFromUrl(imageUrl, params.userId)

        // Save record to Firestore
        await createImageRecord({
          userId: params.userId,
          userName: params.userName,
          prompt: params.prompt,
          imageUrl: permanentUrl,
          originalUrl: imageUrl,
          size: params.size,
          mode: params.mode,
        })

        console.log(`Saved image ${imageIndex} from task ${taskId} to Firebase`)
      } catch (error) {
        console.error(`Failed to save image ${imageIndex} from task ${taskId}:`, error)
        // Remove from saved set so it can be retried
        savedImagesRef.current.delete(saveKey)
      }
    },
    []
  )

  // Process SSE stream
  const processSSEStream = useCallback(
    async (
      response: Response,
      taskId: string,
      signal: AbortSignal,
      saveParams: { userId: string; userName: string; prompt: string; size: string; mode: GenerateMode }
    ) => {
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          if (signal.aborted) {
            reader.cancel()
            break
          }

          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parse SSE events
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (!data || data === '[DONE]') continue

              try {
                const event: SSEEvent = JSON.parse(data)

                if (event.taskId !== taskId) continue

                setTasks(prev =>
                  prev.map(task => {
                    if (task.id !== taskId) return task

                    switch (event.type) {
                      case 'image': {
                        const newImage: TaskImage = {
                          id: `img-${event.index}`,
                          url: event.url,
                          size: event.size,
                          status: 'ready',
                        }
                        // Create array with proper size to handle out-of-order arrivals
                        const updatedImages = [...task.images]
                        // Extend array if needed to accommodate the index
                        while (updatedImages.length <= event.index) {
                          updatedImages.push({
                            id: `img-${updatedImages.length}`,
                            url: '',
                            size: '',
                            status: 'pending',
                          } as TaskImage)
                        }
                        // Now safely set at the correct index
                        updatedImages[event.index] = newImage

                        // Save this image to Firebase immediately (async, non-blocking)
                        saveImageToFirebase(event.url, taskId, event.index, saveParams)

                        return {
                          ...task,
                          status: 'generating' as const,
                          images: updatedImages,
                        }
                      }

                      case 'error': {
                        if (event.index !== undefined) {
                          // Single image error
                          const errorImage: TaskImage = {
                            id: `img-${event.index}`,
                            url: '',
                            size: '',
                            status: 'error',
                            error: event.message,
                          }
                          // Handle out-of-order arrivals (same as image case)
                          const updatedImages = [...task.images]
                          while (updatedImages.length <= event.index) {
                            updatedImages.push({
                              id: `img-${updatedImages.length}`,
                              url: '',
                              size: '',
                              status: 'pending',
                            } as TaskImage)
                          }
                          updatedImages[event.index] = errorImage
                          return { ...task, images: updatedImages }
                        }
                        // Task-level error
                        return {
                          ...task,
                          status: 'failed' as const,
                          error: event.message,
                          completedAt: Date.now(),
                        }
                      }

                      case 'completed': {
                        return {
                          ...task,
                          usage: event.usage,
                        }
                      }

                      case 'done': {
                        return {
                          ...task,
                          status: 'completed' as const,
                          completedAt: Date.now(),
                        }
                      }

                      default:
                        return task
                    }
                  })
                )
              } catch {
                // Ignore JSON parse errors
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    },
    [saveImageToFirebase]
  )

  // Start a new generation task
  const startGeneration = useCallback(
    (params: StartGenerationParams): string | null => {
      if (!canStartNewTask) {
        return null
      }

      if (!params.userId || !params.userName) {
        console.error('userId and userName are required for generation')
        return null
      }

      const taskId = generateTaskId()
      const expectedCount = params.expectedCount || 4

      // Create initial task state
      const newTask: GenerationTask = {
        id: taskId,
        status: 'pending',
        prompt: params.prompt,
        mode: params.mode,
        size: params.size,
        referenceImages: params.referenceImages,
        strength: params.strength,
        expectedCount,
        images: [],
        createdAt: Date.now(),
      }

      // Add task to list (and trim history)
      setTasks(prev => {
        const updated = [newTask, ...prev]
        // Keep only recent tasks to prevent memory leaks
        return updated.slice(0, MAX_TASK_HISTORY)
      })

      // Create abort controller for this task
      const abortController = new AbortController()
      abortControllersRef.current.set(taskId, abortController)

      // Params for saving images
      const saveParams = {
        userId: params.userId,
        userName: params.userName,
        prompt: params.prompt,
        size: params.size,
        mode: params.mode,
      }

      // Start generation in background
      const runGeneration = async () => {
        try {
          // Update to generating status
          setTasks(prev =>
            prev.map(t =>
              t.id === taskId ? { ...t, status: 'generating' as const } : t
            )
          )

          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              prompt: params.prompt,
              mode: params.mode,
              size: params.size,
              images: params.referenceImages,
              strength: params.strength,
              batchCount: expectedCount,
            }),
            signal: abortController.signal,
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Generation failed')
          }

          // Process SSE stream
          await processSSEStream(response, taskId, abortController.signal, saveParams)

          // Mark as completed if not already failed/cancelled
          setTasks(prev =>
            prev.map(t => {
              if (t.id !== taskId) return t
              if (t.status === 'generating') {
                return {
                  ...t,
                  status: 'completed' as const,
                  completedAt: Date.now(),
                }
              }
              return t
            })
          )
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // Cancelled - already handled
            return
          }

          setTasks(prev =>
            prev.map(t =>
              t.id === taskId
                ? {
                    ...t,
                    status: 'failed' as const,
                    error: err instanceof Error ? err.message : 'Unknown error',
                    completedAt: Date.now(),
                  }
                : t
            )
          )
        } finally {
          abortControllersRef.current.delete(taskId)
        }
      }

      runGeneration()
      return taskId
    },
    [canStartNewTask, generateTaskId, processSSEStream]
  )

  // Cancel a task
  const cancelTask = useCallback((taskId: string) => {
    const controller = abortControllersRef.current.get(taskId)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(taskId)
    }

    setTasks(prev =>
      prev.map(t =>
        t.id === taskId && (t.status === 'pending' || t.status === 'generating')
          ? { ...t, status: 'cancelled' as const, completedAt: Date.now() }
          : t
      )
    )
  }, [])

  // Clear completed/failed/cancelled tasks
  const clearCompletedTasks = useCallback(() => {
    setTasks(prev =>
      prev.filter(
        t =>
          t.status === 'pending' ||
          t.status === 'generating'
      )
    )
  }, [])

  // Clear all tasks (cancel active ones first)
  const clearAllTasks = useCallback(() => {
    // Cancel all active tasks
    abortControllersRef.current.forEach(controller => controller.abort())
    abortControllersRef.current.clear()
    setTasks([])
  }, [])

  return {
    tasks,
    activeTaskCount,
    canStartNewTask,
    startGeneration,
    cancelTask,
    clearCompletedTasks,
    clearAllTasks,
  }
}
