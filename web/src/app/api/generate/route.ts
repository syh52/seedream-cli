import { NextRequest, NextResponse } from 'next/server'

const API_ENDPOINT = 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations'
// Use custom inference endpoint for dedicated quota and better rate limits
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

/**
 * Generation modes per official docs:
 * - text: Text-to-Image (batch generation with sequential_image_generation)
 * - image: Image-to-Image editing (single image reference)
 * - multi: Multi-Image blending (2-14 reference images, sequential_image_generation disabled)
 *
 * Reference: https://docs.byteplus.com/en/docs/ModelArk/1824121
 */
export type GenerateMode = 'text' | 'image' | 'multi'

interface GenerateRequest {
  taskId: string
  prompt: string
  mode: GenerateMode
  size?: string
  images?: string[]       // For image-to-image or multi-image
  strength?: number       // 0-1, image reference strength (unofficial param)
  batchCount?: number     // For batch generation (text mode only)
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ARK_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    )
  }

  try {
    const body: GenerateRequest = await request.json()
    const { taskId, prompt, mode, size: rawSize = '2K', images, strength, batchCount } = body

    // Map user-friendly size to API format
    const size = SIZE_MAP[rawSize] || rawSize

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const imageCount = batchCount || 4

    // Build base payload
    // Per official docs: https://docs.byteplus.com/en/docs/ModelArk/1541523
    const payload: Record<string, unknown> = {
      model: MODEL_ID,
      prompt, // Keep user prompt unchanged - model auto-detects batch keywords
      size,
      response_format: 'url',
      watermark: false,
      stream: true,
    }

    // Mode-specific configuration per official docs
    if (mode === 'image' && images?.length === 1) {
      // Image-to-Image editing: single reference image
      // Batch generation still works for edits
      payload.image = images[0]
      payload.sequential_image_generation = 'auto'
      payload.sequential_image_generation_options = {
        max_images: imageCount,
      }
      // Note: strength is not officially documented for Seedream 4.5
      // but may work for controlling reference influence
      if (strength !== undefined) {
        payload.strength = Math.max(0, Math.min(1, strength))
      }
    } else if (mode === 'multi' && images && images.length > 1) {
      // Multi-Image blending: 2-14 reference images
      // Per docs: MUST disable sequential_image_generation for multi-image
      payload.image = images
      payload.sequential_image_generation = 'disabled'
      if (strength !== undefined) {
        payload.strength = Math.max(0, Math.min(1, strength))
      }
    } else {
      // Text-to-Image: pure prompt-based generation
      // Enable batch generation for multiple outputs
      payload.sequential_image_generation = 'auto'
      payload.sequential_image_generation_options = {
        max_images: Math.min(imageCount, 15), // API limit: max 15
      }
    }

    // Call SeeDream API with streaming
    const apiResponse = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!apiResponse.ok) {
      const error = await apiResponse.json()
      return NextResponse.json(
        { error: error.error?.message || 'Generation failed' },
        { status: apiResponse.status }
      )
    }

    // Create transform stream to parse SeeDream SSE and convert to our format
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Process the streaming response
    const processStream = async () => {
      const reader = apiResponse.body?.getReader()
      if (!reader) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          taskId,
          type: 'error',
          message: 'No response body',
        })}\n\n`))
        await writer.close()
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let imageIndex = 0

      try {
        while (true) {
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
                const event = JSON.parse(data)

                // Handle SeeDream event types
                if (event.type === 'image_generation.partial_succeeded') {
                  // Single image generated successfully
                  await writer.write(encoder.encode(`data: ${JSON.stringify({
                    taskId,
                    type: 'image',
                    index: imageIndex,
                    url: event.url,
                    size: event.size || size,
                  })}\n\n`))
                  imageIndex++
                } else if (event.type === 'image_generation.partial_failed') {
                  // Single image failed
                  await writer.write(encoder.encode(`data: ${JSON.stringify({
                    taskId,
                    type: 'error',
                    index: imageIndex,
                    message: event.error?.message || 'Image generation failed',
                  })}\n\n`))
                  imageIndex++
                } else if (event.type === 'image_generation.completed') {
                  // All done - send usage info
                  await writer.write(encoder.encode(`data: ${JSON.stringify({
                    taskId,
                    type: 'completed',
                    usage: event.usage || {
                      generated_images: imageIndex,
                      total_tokens: imageIndex * 16384,
                    },
                  })}\n\n`))
                }
              } catch {
                // Ignore JSON parse errors
              }
            }
          }
        }

        // Send done event
        await writer.write(encoder.encode(`data: ${JSON.stringify({ taskId, type: 'done' })}\n\n`))
      } catch (err) {
        console.error('Stream processing error:', err)
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          taskId,
          type: 'error',
          message: err instanceof Error ? err.message : 'Stream processing failed',
        })}\n\n`))
      } finally {
        reader.releaseLock()
        await writer.close()
      }
    }

    // Start processing in background
    processStream()

    // Return SSE response
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
