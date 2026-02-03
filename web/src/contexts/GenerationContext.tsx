'use client'

/**
 * Generation Context - 图片生成任务状态管理
 *
 * 新架构（Cloud Function 后台处理）：
 * - 前端提交任务到 /api/submit-task，立即返回
 * - Cloud Function (processGenerationTask) 在后台执行生成
 * - 前端通过 Firestore 实时订阅获取进度更新
 *
 * 优势：
 * - 页面刷新、退出登录不影响任务执行
 * - 无需维护 SSE 长连接
 * - 任务状态天然持久化
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import type {
  GenerationTask,
  TaskImage,
  GenerateMode,
  TaskRecord,
} from '@/types'
import { saveTask, updateTaskStatus, deleteTasks, subscribeToUserTasks } from '@/lib/firestore'
import { uploadBase64Image } from '@/lib/storage'

export const MAX_CONCURRENT_TASKS = 3

interface StartGenerationParams {
  prompt: string
  mode: GenerateMode
  size: string
  referenceImages?: string[]
  strength?: number
  expectedCount?: number
  userId: string
  userName: string
}

interface GenerationContextType {
  tasks: GenerationTask[]
  activeTaskCount: number
  canStartNewTask: boolean
  isLoading: boolean
  startGeneration: (params: StartGenerationParams) => Promise<string | null>
  cancelTask: (taskId: string) => void
  clearCompletedTasks: () => void
  clearAllTasks: () => void
  setUserId: (userId: string | null) => void
}

const GenerationContext = createContext<GenerationContextType | undefined>(undefined)

const MAX_TASKS = 3
const MAX_TASK_HISTORY = 10

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const [userId, setUserIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // 设置用户 ID（用于切换用户时恢复/清空任务）
  const setUserId = useCallback((newUserId: string | null) => {
    setUserIdState(newUserId)
    if (!newUserId) {
      setTasks([])
    }
  }, [])

  // 订阅用户任务（实时同步）
  // Cloud Function 更新 Firestore → 自动同步到前端
  useEffect(() => {
    if (!userId) {
      setTasks([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const unsubscribe = subscribeToUserTasks(userId, (firestoreTasks) => {
      // 将 Firestore TaskRecord 转换为前端 GenerationTask
      const convertedTasks: GenerationTask[] = firestoreTasks.map((fsTask) => {
        // 处理 processing 状态的显示（映射为 generating）
        let displayStatus = fsTask.status
        if (fsTask.status === 'processing' as unknown) {
          displayStatus = 'generating'
        }

        // 使用 storageUrl 作为首选显示 URL
        const displayImages: TaskImage[] = fsTask.images.map((img) => ({
          ...img,
          // 优先使用永久 Storage URL
          url: img.storageUrl || img.url,
        }))

        return {
          id: fsTask.id,
          status: displayStatus,
          prompt: fsTask.prompt,
          mode: fsTask.mode,
          size: fsTask.size,
          strength: fsTask.strength,
          expectedCount: fsTask.expectedCount,
          images: displayImages,
          createdAt: fsTask.createdAt,
          completedAt: fsTask.completedAt,
          error: fsTask.error,
          usage: fsTask.usage,
        }
      })

      // 按创建时间升序排序（新任务在底部）
      convertedTasks.sort((a, b) => a.createdAt - b.createdAt)

      setTasks(convertedTasks.slice(0, MAX_TASK_HISTORY))
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [userId])

  // 计算活跃任务数（pending + generating/processing）
  const activeTaskCount = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'generating'
  ).length

  const canStartNewTask = activeTaskCount < MAX_TASKS

  /**
   * 提交新的生成任务
   * - 直接使用客户端 Firestore SDK 创建任务文档
   * - Cloud Function 监听到新文档后自动执行
   * - 返回 taskId，前端通过订阅获取后续更新
   */
  const startGeneration = useCallback(
    async (params: StartGenerationParams): Promise<string | null> => {
      if (!canStartNewTask) {
        console.warn('[Generation] Cannot start new task: max concurrent tasks reached')
        return null
      }

      if (!params.userId || !params.userName) {
        console.error('[Generation] userId and userName are required')
        return null
      }

      try {
        console.log('[Generation] Creating task...')

        // 生成任务 ID
        const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        const createdAt = Date.now()
        const expectedCount = params.expectedCount || 4

        // 如果有参考图片，先上传到 Storage
        let referenceImageUrls: string[] | undefined

        if (params.referenceImages && params.referenceImages.length > 0) {
          console.log(`[Generation] Uploading ${params.referenceImages.length} reference images...`)
          referenceImageUrls = await Promise.all(
            params.referenceImages.map((base64, index) =>
              uploadBase64Image(base64, params.userId, taskId, index)
            )
          )
          console.log(`[Generation] Reference images uploaded`)
        }

        // 创建任务记录（使用客户端 SDK）
        const taskRecord: TaskRecord = {
          id: taskId,
          userId: params.userId,
          userName: params.userName,
          status: 'pending',
          prompt: params.prompt,
          mode: params.mode,
          size: params.size,
          expectedCount,
          images: [],
          createdAt,
          retryCount: 0,
          maxRetries: 2,
          // 可选字段
          ...(params.strength !== undefined && { strength: params.strength }),
          ...(referenceImageUrls && { referenceImageUrls }),
        }

        // 保存到 Firestore（触发 Cloud Function）
        await saveTask(taskRecord)

        console.log(`[Generation] Task ${taskId} created, Cloud Function will process it`)

        // 任务会通过 Firestore 订阅自动出现在 tasks 列表中
        return taskId

      } catch (error) {
        console.error('[Generation] Failed to create task:', error)
        return null
      }
    },
    [canStartNewTask]
  )

  /**
   * 取消任务
   * - 只能取消 pending 状态的任务（尚未被 Cloud Function 处理）
   * - processing 状态的任务无法中断（Cloud Function 已在执行）
   */
  const cancelTask = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)

    if (!task) {
      console.warn(`[Generation] Task ${taskId} not found`)
      return
    }

    // 只能取消 pending 状态的任务
    if (task.status !== 'pending') {
      console.warn(`[Generation] Cannot cancel task in ${task.status} status`)
      return
    }

    const completedAt = Date.now()

    // 更新 Firestore 状态为 cancelled
    updateTaskStatus(taskId, {
      status: 'cancelled',
      completedAt,
    }).catch(console.error)

    // 乐观更新本地状态（Firestore 订阅也会同步）
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: 'cancelled' as const, completedAt }
          : t
      )
    )
  }, [tasks])

  /**
   * 清除已完成的任务
   */
  const clearCompletedTasks = useCallback(() => {
    const tasksToDelete = tasks.filter(
      (t) => t.status !== 'pending' && t.status !== 'generating'
    )

    if (tasksToDelete.length > 0) {
      deleteTasks(tasksToDelete.map((t) => t.id)).catch(console.error)
    }

    setTasks((prev) =>
      prev.filter((t) => t.status === 'pending' || t.status === 'generating')
    )
  }, [tasks])

  /**
   * 清除所有任务
   */
  const clearAllTasks = useCallback(() => {
    if (tasks.length > 0) {
      deleteTasks(tasks.map((t) => t.id)).catch(console.error)
    }
    setTasks([])
  }, [tasks])

  return (
    <GenerationContext.Provider
      value={{
        tasks,
        activeTaskCount,
        canStartNewTask,
        isLoading,
        startGeneration,
        cancelTask,
        clearCompletedTasks,
        clearAllTasks,
        setUserId,
      }}
    >
      {children}
    </GenerationContext.Provider>
  )
}

export function useGeneration() {
  const context = useContext(GenerationContext)
  if (context === undefined) {
    throw new Error('useGeneration must be used within a GenerationProvider')
  }
  return context
}
