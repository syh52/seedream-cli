/**
 * POST /api/submit-task
 * 提交图片生成任务到 Firestore，由 Cloud Function 后台处理
 *
 * 与原有的 /api/generate SSE 流式接口不同：
 * - 任务创建后立即返回 taskId
 * - 生成过程由 Cloud Function 独立执行
 * - 前端通过 Firestore 实时订阅获取进度更新
 */

import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

// 初始化 Firebase Admin SDK（服务端）
function getAdminApp() {
  if (getApps().length === 0) {
    // 在 Cloud Functions/Cloud Run 环境中，会自动使用默认凭证
    // 在本地开发时，需要设置 GOOGLE_APPLICATION_CREDENTIALS 环境变量
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    })
  }
  return getApps()[0]
}

// Per official docs: batch generation is part of 'text' mode, not a separate mode
type GenerateMode = 'text' | 'image' | 'multi'

interface SubmitTaskRequest {
  prompt: string
  mode: GenerateMode
  size?: string
  referenceImages?: string[]  // base64 数据
  strength?: number
  expectedCount?: number
  userId: string
  userName: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitTaskRequest = await request.json()
    const {
      prompt,
      mode,
      size = '3:4',
      referenceImages,
      strength,
      expectedCount = 4,
      userId,
      userName,
    } = body

    // 参数验证
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!userId || !userName) {
      return NextResponse.json({ error: 'User authentication required' }, { status: 401 })
    }

    // 验证模式和参考图片的组合
    if (mode === 'image' && (!referenceImages || referenceImages.length !== 1)) {
      return NextResponse.json(
        { error: 'Image mode requires exactly 1 reference image' },
        { status: 400 }
      )
    }

    if (mode === 'multi' && (!referenceImages || referenceImages.length < 2)) {
      return NextResponse.json(
        { error: 'Multi mode requires at least 2 reference images' },
        { status: 400 }
      )
    }

    getAdminApp()
    const db = getFirestore()
    const storage = getStorage()

    // 生成任务 ID
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const createdAt = Date.now()

    // 如果有参考图片，先上传到 Storage
    let referenceImageUrls: string[] | undefined

    if (referenceImages && referenceImages.length > 0) {
      console.log(`[SubmitTask] Uploading ${referenceImages.length} reference images...`)
      referenceImageUrls = await uploadReferenceImages(
        storage.bucket(),
        referenceImages,
        userId,
        taskId
      )
      console.log(`[SubmitTask] Reference images uploaded:`, referenceImageUrls.length)
    }

    // 创建任务文档
    const taskData = {
      id: taskId,
      userId,
      userName,
      status: 'pending',
      prompt,
      mode,
      size,
      expectedCount,
      images: [],
      createdAt,
      retryCount: 0,
      maxRetries: 2,
      // 可选字段
      ...(strength !== undefined && { strength }),
      ...(referenceImageUrls && { referenceImageUrls }),
    }

    await db.collection('tasks').doc(taskId).set(taskData)

    console.log(`[SubmitTask] Task ${taskId} created, Cloud Function will process it`)

    return NextResponse.json({
      taskId,
      status: 'submitted',
    })

  } catch (error) {
    console.error('[SubmitTask] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * 上传参考图片到 Firebase Storage
 */
async function uploadReferenceImages(
  bucket: ReturnType<typeof getStorage>['bucket'] extends () => infer R ? R : never,
  base64Images: string[],
  userId: string,
  taskId: string
): Promise<string[]> {
  const urls: string[] = []

  for (let i = 0; i < base64Images.length; i++) {
    const base64 = base64Images[i]

    // 解析 base64 数据
    let buffer: Buffer
    let contentType = 'image/png'

    if (base64.startsWith('data:')) {
      // data URL 格式: data:image/png;base64,xxxxx
      const matches = base64.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        contentType = matches[1]
        buffer = Buffer.from(matches[2], 'base64')
      } else {
        throw new Error(`Invalid base64 data URL at index ${i}`)
      }
    } else {
      // 纯 base64 字符串
      buffer = Buffer.from(base64, 'base64')
    }

    const filename = `${Date.now()}-ref-${i}.png`
    const filePath = `references/${userId}/${taskId}/${filename}`

    const file = bucket.file(filePath)
    await file.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          source: 'seedream-submit-task',
          taskId,
        },
      },
    })

    // 设置文件为公开可读
    await file.makePublic()

    // 构建公开 URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`
    urls.push(publicUrl)
  }

  return urls
}
