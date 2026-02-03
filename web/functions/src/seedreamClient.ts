/**
 * SeeDream API 客户端
 * 封装 BytePlus Ark SeeDream 4.5 模型调用，支持流式处理
 */

const API_ENDPOINT = 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations'
const MODEL_ID = 'ep-20260123220136-f8bx7'

// Map user-friendly size names to API format
// Reference: https://docs.byteplus.com/en/docs/ModelArk/1541523
const SIZE_MAP: Record<string, string> = {
  // Preset resolutions (recommended)
  "2K": "2K",
  "4K": "4K",
  // Aspect ratios with optimal pixel dimensions
  "1:1": "2048x2048",
  "4:3": "2304x1728",
  "3:4": "1728x2304",
  "16:9": "2560x1440",
  "9:16": "1440x2560",
  "3:2": "2496x1664",
  "2:3": "1664x2496",
  "21:9": "3024x1296",
}

export type GenerateMode = 'text' | 'image' | 'multi' | 'batch'

export interface GenerationParams {
  prompt: string
  mode: GenerateMode
  size: string
  referenceImageUrls?: string[]
  strength?: number
  expectedCount: number
}

export interface GeneratedImage {
  index: number
  url: string
  size: string
}

export interface GenerationResult {
  images: GeneratedImage[]
  errors: { index: number; message: string }[]
  usage?: { generated_images: number; total_tokens: number }
}

/**
 * 调用 SeeDream API 生成单张图片（流式处理）
 */
async function generateSingleImage(
  payload: Record<string, unknown>,
  apiKey: string,
  index: number,
  onImageGenerated?: (image: GeneratedImage) => Promise<void>
): Promise<GeneratedImage | null> {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error(`[SeeDream] API error for image ${index}:`, response.status, errorBody)
    return null
  }

  // 包装回调，将正确的 index 传递给调用者
  const wrappedCallback = onImageGenerated
    ? async (image: GeneratedImage) => {
        // 用传入的 index 替换内部计数器的 index
        await onImageGenerated({ ...image, index: index - 1 })
      }
    : undefined

  const result = await parseSSEStream(response, wrappedCallback)
  if (result.images[0]) {
    return { ...result.images[0], index: index - 1 }
  }
  return null
}

/**
 * 调用 SeeDream API 生成图片
 * 策略：为每张图片独立发起 API 调用（并行执行）
 * 这比依赖 sequential_image_generation: 'auto' 更可靠
 *
 * @param params 生成参数
 * @param apiKey ARK API Key
 * @param onImageGenerated 每张图片生成后的回调
 * @returns 最终生成结果
 */
export async function generateImages(
  params: GenerationParams,
  apiKey: string,
  onImageGenerated?: (image: GeneratedImage) => Promise<void>
): Promise<GenerationResult> {
  const { prompt, mode, size: rawSize, referenceImageUrls, strength, expectedCount } = params

  // Map user-friendly size to API format
  const size = SIZE_MAP[rawSize] || rawSize

  // 构建基础请求 payload
  const basePayload: Record<string, unknown> = {
    model: MODEL_ID,
    prompt,
    size,
    response_format: 'url',
    watermark: false,
    stream: true,
  }

  // Image-to-image 模式
  if (mode === 'image' && referenceImageUrls?.length === 1) {
    basePayload.image = referenceImageUrls[0]
    if (strength !== undefined) {
      basePayload.strength = Math.max(0, Math.min(1, strength))
    }
  }

  // Multi-image 模式
  if (mode === 'multi' && referenceImageUrls && referenceImageUrls.length > 1) {
    basePayload.image = referenceImageUrls
    // Per docs: disable sequential generation for multi-image blending
    basePayload.sequential_image_generation = 'disabled'
    if (strength !== undefined) {
      basePayload.strength = Math.max(0, Math.min(1, strength))
    }
  }

  console.log('[SeeDream] Starting generation:', { mode, size, expectedCount })

  const result: GenerationResult = {
    images: [],
    errors: [],
  }

  // 决定 API 调用次数
  // 所有模式都按 expectedCount 调用，每次生成一张图片
  // multi 模式虽然 API 要求 sequential_image_generation: 'disabled'，
  // 但我们可以多次调用来生成多张不同的融合结果
  const numCalls = expectedCount

  // 并行生成图片（限制并发数为 2 以避免超时）
  const MAX_CONCURRENT = 2
  const tasks: Promise<GeneratedImage | null>[] = []

  for (let i = 0; i < numCalls; i++) {
    const task = generateSingleImage(
      { ...basePayload },
      apiKey,
      i + 1,  // 传入 1-based index，内部会转换为 0-based
      onImageGenerated
    )
    tasks.push(task)

    // 控制并发数
    if (tasks.length >= MAX_CONCURRENT || i === numCalls - 1) {
      const results = await Promise.all(tasks)
      for (let j = 0; j < results.length; j++) {
        const img = results[j]
        if (img) {
          result.images.push(img)  // index 已经在 generateSingleImage 中设置好了
          console.log(`[SeeDream] Image ${img.index + 1}/${numCalls} generated`)
        } else {
          const errorIndex = i - tasks.length + j + 1
          result.errors.push({
            index: errorIndex,
            message: 'Image generation failed',
          })
          console.error(`[SeeDream] Image ${errorIndex + 1}/${numCalls} failed`)
        }
      }
      tasks.length = 0
    }
  }

  console.log('[SeeDream] Generation completed:', {
    imageCount: result.images.length,
    errorCount: result.errors.length,
  })

  result.usage = {
    generated_images: result.images.length,
    total_tokens: result.images.length * 16384,
  }

  return result
}

/**
 * 解析 SeeDream SSE 流响应
 */
async function parseSSEStream(
  response: Response,
  onImageGenerated?: (image: GeneratedImage) => Promise<void>
): Promise<GenerationResult> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let imageIndex = 0

  const result: GenerationResult = {
    images: [],
    errors: [],
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue

          try {
            const event = JSON.parse(data)

            if (event.type === 'image_generation.partial_succeeded') {
              const image: GeneratedImage = {
                index: imageIndex,
                url: event.url,
                size: event.size || '',
              }
              result.images.push(image)

              // 回调通知图片生成完成
              if (onImageGenerated) {
                await onImageGenerated(image)
              }

              imageIndex++
              console.log(`[SeeDream] Image ${imageIndex} generated`)

            } else if (event.type === 'image_generation.partial_failed') {
              result.errors.push({
                index: imageIndex,
                message: event.error?.message || 'Image generation failed',
              })
              imageIndex++
              console.warn(`[SeeDream] Image ${imageIndex} failed`)

            } else if (event.type === 'image_generation.completed') {
              result.usage = event.usage || {
                generated_images: imageIndex,
                total_tokens: imageIndex * 16384,
              }
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return result
}
