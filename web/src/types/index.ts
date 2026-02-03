import { Timestamp } from 'firebase/firestore'

/**
 * Generation modes per official BytePlus docs:
 * - text: Text-to-Image (supports batch via sequential_image_generation)
 * - image: Image-to-Image editing (single reference image)
 * - multi: Multi-Image blending (2-14 reference images)
 *
 * Note: Batch generation is NOT a separate mode - it's enabled within
 * 'text' mode via sequential_image_generation parameter.
 * Reference: https://docs.byteplus.com/en/docs/ModelArk/1541523
 */
export type GenerateMode = 'text' | 'image' | 'multi'

export interface ImageRecord {
  id: string
  userId: string
  userName: string
  prompt: string
  imageUrl: string        // Firebase Storage URL (permanent)
  originalUrl: string     // SeeDream API URL (temporary, 24h)
  size: string
  mode: GenerateMode
  liked: boolean
  deleted: boolean
  createdAt: Timestamp
}

export interface User {
  id: string
  email: string
  displayName: string
  photoURL?: string
  createdAt: Timestamp
}

export interface GenerationResult {
  url: string
  size: string
}

export interface GenerationResponse {
  model: string
  created: number
  data: GenerationResult[]
  usage: {
    generated_images: number
    output_tokens: number
    total_tokens: number
  }
}

// ===== Streaming & Concurrent Generation Types =====

// 'processing' 是 Cloud Function 使用的状态，前端显示时映射为 'generating'
export type TaskStatus = 'pending' | 'generating' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface TaskImage {
  id: string
  url: string              // SeeDream API 临时 URL（24h 有效）
  storageUrl?: string      // Firebase Storage 永久 URL
  size: string
  status: 'pending' | 'ready' | 'error'
  error?: string
  processedAt?: number     // 处理完成时间
}

export interface GenerationTask {
  id: string
  status: TaskStatus
  prompt: string
  mode: GenerateMode
  size: string
  referenceImages?: string[]
  strength?: number  // 0-1, image reference strength (only for image/multi modes)
  expectedCount: number
  images: TaskImage[]
  createdAt: number
  completedAt?: number
  error?: string
  usage?: { generated_images: number; total_tokens: number }
}

export const MAX_CONCURRENT_TASKS = 3

// SSE Event Types
export interface SSEImageEvent {
  taskId: string
  type: 'image'
  index: number
  url: string
  size: string
}

export interface SSEErrorEvent {
  taskId: string
  type: 'error'
  index?: number
  message: string
}

export interface SSECompletedEvent {
  taskId: string
  type: 'completed'
  usage: { generated_images: number; total_tokens: number }
}

export interface SSEDoneEvent {
  taskId: string
  type: 'done'
}

export type SSEEvent = SSEImageEvent | SSEErrorEvent | SSECompletedEvent | SSEDoneEvent

// ===== Firestore Task Persistence Types =====

// Firestore 中存储的任务记录
// 使用 Cloud Function 后台处理，不再需要浏览器保持连接
export interface TaskRecord {
  id: string
  userId: string
  userName: string           // 用于创建图片记录
  status: TaskStatus
  prompt: string
  mode: GenerateMode
  size: string
  strength?: number
  expectedCount: number
  images: TaskImage[]
  createdAt: number
  completedAt?: number
  error?: string
  usage?: { generated_images: number; total_tokens: number }

  // Cloud Function 后台处理相关字段
  workerId?: string          // Cloud Function 实例 ID（用于调试）
  startedAt?: number         // 开始处理时间
  lastHeartbeat?: number     // 心跳时间（用于超时检测）
  retryCount: number         // 重试次数
  maxRetries: number         // 最大重试次数 (默认 2)

  // 参考图片 URL（上传到 Storage 后的永久 URL）
  referenceImageUrls?: string[]
}

// 提交任务的请求参数
export interface SubmitTaskRequest {
  prompt: string
  mode: GenerateMode
  size: string
  referenceImages?: string[]  // base64 数据
  strength?: number
  expectedCount?: number
}

// 提交任务的响应
export interface SubmitTaskResponse {
  taskId: string
  status: 'submitted'
}
