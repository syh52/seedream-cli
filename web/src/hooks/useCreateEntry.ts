'use client'

import { useAuth } from '@/contexts/AuthContext'
import { createEntry } from '@/lib/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import type { GenerateMode, Entry } from '@/types'

/** Convert a data URL or raw base64 string to a Blob. */
function dataUrlToBlob(data: string): Blob {
  const dataUrl = data.startsWith('data:') ? data : `data:image/png;base64,${data}`
  const [header, b64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
  const bytes = atob(b64)
  const buf = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
  return new Blob([buf], { type: mime })
}

/**
 * Process reference images for submission.
 * - URLs (http/https) are kept as-is (e.g. Remix reusing existing images)
 * - Data URLs / raw base64 are uploaded to Firebase Storage
 */
async function processReferenceImages(
  images: string[],
  userId: string,
  entryId: string
): Promise<string[]> {
  const urls: string[] = []

  for (let i = 0; i < images.length; i++) {
    const img = images[i]

    // Already a URL — reuse directly (Remix case)
    if (img.startsWith('http://') || img.startsWith('https://')) {
      urls.push(img)
      continue
    }

    // Data URL or raw base64 — upload to Storage
    const blob = dataUrlToBlob(img)
    const filename = `${Date.now()}-ref-${i}.png`
    const storagePath = `references/${userId}/${entryId}/${filename}`
    const storageRef = ref(storage, storagePath)

    await uploadBytes(storageRef, blob, { contentType: blob.type })

    const downloadUrl = await getDownloadURL(storageRef)
    urls.push(downloadUrl)
  }

  return urls
}

export function useCreateEntry() {
  const { user } = useAuth()

  const submitEntry = async (params: {
    prompt: string
    mode: GenerateMode
    size: string
    referenceImages?: string[]
    strength?: number
  }) => {
    if (!user) throw new Error('Not authenticated')

    const entryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    // Upload reference images if present
    let referenceImageUrls: string[] | undefined
    if (params.referenceImages && params.referenceImages.length > 0) {
      referenceImageUrls = await processReferenceImages(
        params.referenceImages,
        user.uid,
        entryId
      )
    }

    // Build pending images array
    const expectedCount = 4
    const images = Array.from({ length: expectedCount }, (_, i) => ({
      id: `img-${i}`,
      url: '',
      width: 0,
      height: 0,
      status: 'pending' as const,
    }))

    // Create entry directly in Firestore
    const entry: Entry = {
      id: entryId,
      userId: user.uid,
      userName: user.displayName || user.email || 'Anonymous',
      status: 'active',
      prompt: params.prompt,
      mode: params.mode,
      size: params.size,
      images,
      createdAt: Date.now(),
      liked: false,
      deleted: false,
      source: 'web',
      _cf: {
        retryCount: 0,
        maxRetries: 2,
      },
      ...(params.strength !== undefined && { strength: params.strength }),
      ...(referenceImageUrls && { referenceImageUrls }),
    }

    await createEntry(entry)

    return entryId
  }

  return { submitEntry, user }
}
