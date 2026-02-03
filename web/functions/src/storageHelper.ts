/**
 * Firebase Storage 辅助工具
 * 服务端直接上传图片到 Storage（无 CORS 限制）
 */

import * as admin from 'firebase-admin'

/**
 * 从 URL 下载图片并上传到 Firebase Storage
 * @param imageUrl 临时图片 URL（SeeDream API 生成，24h 有效）
 * @param userId 用户 ID（用于组织存储路径）
 * @param filename 可选的自定义文件名
 * @returns Firebase Storage 永久下载 URL
 */
export async function uploadImageToStorage(
  imageUrl: string,
  userId: string,
  filename?: string
): Promise<string> {
  console.log('[Storage] Fetching image from:', imageUrl.substring(0, 100) + '...')

  // 下载图片
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || 'image/png'
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  console.log('[Storage] Image downloaded, size:', buffer.length)

  // 生成文件名
  const name = filename || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.png`
  const filePath = `images/${userId}/${name}`

  // 上传到 Firebase Storage
  const bucket = admin.storage().bucket()
  const file = bucket.file(filePath)

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        source: 'seedream-cloud-function',
        uploadedAt: new Date().toISOString(),
      },
    },
  })

  // 设置文件为公开可读（或使用签名 URL）
  await file.makePublic()

  // 获取公开访问 URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`
  console.log('[Storage] Image uploaded:', publicUrl)

  return publicUrl
}

/**
 * 批量上传参考图片到 Storage
 * @param base64Images base64 编码的图片数组
 * @param userId 用户 ID
 * @param taskId 任务 ID
 * @returns Storage URL 数组
 */
export async function uploadReferenceImages(
  base64Images: string[],
  userId: string,
  taskId: string
): Promise<string[]> {
  const bucket = admin.storage().bucket()
  const urls: string[] = []

  for (let i = 0; i < base64Images.length; i++) {
    const base64 = base64Images[i]

    // 解析 base64 数据
    let buffer: Buffer
    let contentType = 'image/png'

    if (base64.startsWith('data:')) {
      // data URL 格式
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
          source: 'seedream-reference-upload',
          taskId,
        },
      },
    })

    await file.makePublic()
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`
    urls.push(publicUrl)

    console.log(`[Storage] Reference image ${i + 1}/${base64Images.length} uploaded`)
  }

  return urls
}
