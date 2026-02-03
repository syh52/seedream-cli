/**
 * Task Worker - Firestore 触发器
 * 监听 tasks 集合的新任务，自动在后台执行图片生成
 */

import * as admin from 'firebase-admin'
import {
  onDocumentCreated,
  FirestoreEvent,
  QueryDocumentSnapshot,
} from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { generateImages, type GeneratedImage } from './seedreamClient'
import { uploadImageToStorage } from './storageHelper'

// 从 Firebase Secret Manager 获取 API Key
const arkApiKey = defineSecret('ARK_API_KEY')

// 任务状态类型
type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

interface TaskImage {
  id: string
  url: string
  storageUrl?: string
  size: string
  status: 'pending' | 'ready' | 'error'
  error?: string
  processedAt?: number
}

interface TaskRecord {
  id: string
  userId: string
  userName: string
  status: TaskStatus
  prompt: string
  mode: 'text' | 'image' | 'multi' | 'batch'
  size: string
  strength?: number
  expectedCount: number
  images: TaskImage[]
  createdAt: number
  completedAt?: number
  error?: string
  usage?: { generated_images: number; total_tokens: number }
  workerId?: string
  startedAt?: number
  lastHeartbeat?: number
  retryCount: number
  maxRetries: number
  referenceImageUrls?: string[]
}

/**
 * 主要的任务处理 Cloud Function
 * 当 tasks 集合中创建新文档时自动触发
 */
export const processGenerationTask = onDocumentCreated(
  {
    document: 'tasks/{taskId}',
    region: 'asia-east1',
    secrets: [arkApiKey],
    timeoutSeconds: 540, // 9 分钟超时（Cloud Functions 最大 540 秒）
    memory: '512MiB',
  },
  async (event: FirestoreEvent<QueryDocumentSnapshot | undefined>) => {
    const snapshot = event.data
    if (!snapshot) {
      console.log('[TaskWorker] No data in event')
      return
    }

    const taskId = event.params.taskId
    const task = snapshot.data() as TaskRecord

    console.log(`[TaskWorker] Processing task ${taskId}`, {
      status: task.status,
      mode: task.mode,
      expectedCount: task.expectedCount,
    })

    // 只处理 pending 状态的任务
    if (task.status !== 'pending') {
      console.log(`[TaskWorker] Task ${taskId} is not pending, skipping`)
      return
    }

    const db = admin.firestore()
    const taskRef = db.collection('tasks').doc(taskId)
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    try {
      // 使用事务原子更新状态为 processing（防止重复处理）
      const acquired = await db.runTransaction(async (transaction) => {
        const taskDoc = await transaction.get(taskRef)
        const currentTask = taskDoc.data() as TaskRecord | undefined

        if (!currentTask || currentTask.status !== 'pending') {
          console.log(`[TaskWorker] Task ${taskId} already being processed`)
          return false
        }

        transaction.update(taskRef, {
          status: 'processing' as TaskStatus,
          workerId,
          startedAt: Date.now(),
          lastHeartbeat: Date.now(),
        })

        return true
      })

      if (!acquired) {
        return
      }

      console.log(`[TaskWorker] Task ${taskId} acquired by ${workerId}`)

      // 获取 API Key
      const apiKey = arkApiKey.value()
      if (!apiKey) {
        throw new Error('ARK_API_KEY not configured')
      }

      // 初始化图片数组
      const images: TaskImage[] = []
      for (let i = 0; i < task.expectedCount; i++) {
        images.push({
          id: `img-${i}`,
          url: '',
          size: '',
          status: 'pending',
        })
      }
      await taskRef.update({ images })

      // 用于收集生成的图片（避免并行回调导致的竞态条件）
      const generatedImages: Map<number, GeneratedImage> = new Map()

      // 调用 SeeDream API 生成图片
      const result = await generateImages(
        {
          prompt: task.prompt,
          mode: task.mode,
          size: task.size,
          referenceImageUrls: task.referenceImageUrls,
          strength: task.strength,
          expectedCount: task.expectedCount,
        },
        apiKey,
        // 每张图片生成后的回调 - 只收集数据，不更新 Firestore
        async (generatedImage: GeneratedImage) => {
          generatedImages.set(generatedImage.index, generatedImage)
          console.log(`[TaskWorker] Image ${generatedImage.index + 1}/${task.expectedCount} received`)
        }
      )

      // 所有 API 调用完成后，批量处理图片
      console.log(`[TaskWorker] Processing ${generatedImages.size} images...`)

      // 并行上传到 Storage（但顺序更新 Firestore）
      const finalImages: TaskImage[] = [...images]
      const uploadPromises: Promise<void>[] = []

      for (const [index, genImg] of generatedImages) {
        const uploadTask = (async () => {
          let storageUrl: string | undefined
          try {
            storageUrl = await uploadImageToStorage(genImg.url, task.userId)
          } catch (uploadError) {
            console.error(`[TaskWorker] Failed to upload image ${index}:`, uploadError)
          }

          // 更新到最终数组
          finalImages[index] = {
            id: `img-${index}`,
            url: genImg.url,
            storageUrl,
            size: genImg.size,
            status: 'ready',
            processedAt: Date.now(),
          }

          // 创建 images 集合记录
          if (storageUrl) {
            await createImageRecord({
              userId: task.userId,
              userName: task.userName,
              prompt: task.prompt,
              imageUrl: storageUrl,
              originalUrl: genImg.url,
              size: genImg.size,
              mode: task.mode,
            })
          }

          console.log(`[TaskWorker] Image ${index + 1}/${task.expectedCount} uploaded`)
        })()
        uploadPromises.push(uploadTask)
      }

      await Promise.all(uploadPromises)

      // 处理失败的图片
      for (const error of result.errors) {
        if (finalImages[error.index]) {
          finalImages[error.index] = {
            ...finalImages[error.index],
            status: 'error',
            error: error.message,
            processedAt: Date.now(),
          }
        }
      }

      // 一次性更新所有图片到 Firestore（避免竞态条件）
      await taskRef.update({
        images: finalImages,
        lastHeartbeat: Date.now(),
      })

      // 标记任务完成
      await taskRef.update({
        status: 'completed' as TaskStatus,
        completedAt: Date.now(),
        usage: result.usage,
      })

      console.log(`[TaskWorker] Task ${taskId} completed successfully`)

    } catch (error) {
      console.error(`[TaskWorker] Task ${taskId} failed:`, error)

      // 检查是否需要重试
      if (task.retryCount < task.maxRetries) {
        console.log(`[TaskWorker] Retrying task ${taskId} (${task.retryCount + 1}/${task.maxRetries})`)
        await taskRef.update({
          status: 'pending' as TaskStatus,
          retryCount: task.retryCount + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
          workerId: null,
          startedAt: null,
        })
      } else {
        await taskRef.update({
          status: 'failed' as TaskStatus,
          completedAt: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }
)

/**
 * 创建图片记录到 images 集合
 */
async function createImageRecord(data: {
  userId: string
  userName: string
  prompt: string
  imageUrl: string
  originalUrl: string
  size: string
  mode: string
}): Promise<void> {
  const db = admin.firestore()
  await db.collection('images').add({
    ...data,
    liked: false,
    deleted: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}
