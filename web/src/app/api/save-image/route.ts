import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy API to fetch image from external URL (bypasses CORS)
 * Returns base64 data that client can upload to Firebase Storage
 */
export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    // Fetch image from temporary URL (server-side, no CORS issues)
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${imageResponse.statusText}` },
        { status: 500 }
      )
    }

    const arrayBuffer = await imageResponse.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const contentType = imageResponse.headers.get('content-type') || 'image/png'

    return NextResponse.json({
      success: true,
      data: base64,
      contentType,
    })
  } catch (error) {
    console.error('Proxy image error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch image' },
      { status: 500 }
    )
  }
}
