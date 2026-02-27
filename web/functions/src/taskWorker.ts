/**
 * Entry Worker - Firestore trigger
 * Monitors `entries` collection for new entries, processes image generation in background
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

const arkApiKey = defineSecret('ARK_API_KEY')

type EntryStatus = 'active' | 'done' | 'failed'

interface EntryImage {
  id: string
  url: string
  originalUrl?: string
  width: number
  height: number
  status: 'pending' | 'done' | 'failed'
  error?: string
}

interface EntryRecord {
  id: string
  userId: string
  userName: string
  status: EntryStatus
  prompt: string
  mode: 'text' | 'image' | 'multi'
  size: string
  strength?: number
  images: EntryImage[]
  referenceImageUrls?: string[]
  createdAt: number
  completedAt?: number
  error?: string
  liked: boolean
  deleted: boolean
  source?: 'web' | 'mcp'
  _cf?: {
    workerId?: string
    lastHeartbeat?: number
    retryCount?: number
    maxRetries?: number
  }
}

// Default expected count when not specified
const DEFAULT_EXPECTED_COUNT = 4

/**
 * Main Cloud Function: triggered when a new entry is created
 */
export const processGenerationTask = onDocumentCreated(
  {
    document: 'entries/{entryId}',
    region: 'asia-east1',
    secrets: [arkApiKey],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (event: FirestoreEvent<QueryDocumentSnapshot | undefined>) => {
    const snapshot = event.data
    if (!snapshot) {
      console.log('[EntryWorker] No data in event')
      return
    }

    const entryId = event.params.entryId
    const entry = snapshot.data() as EntryRecord

    console.log(`[EntryWorker] Processing entry ${entryId}`, {
      status: entry.status,
      mode: entry.mode,
      imageCount: entry.images?.length || 0,
    })

    // Only process active entries
    if (entry.status !== 'active') {
      console.log(`[EntryWorker] Entry ${entryId} is not active, skipping`)
      return
    }

    const db = admin.firestore()
    const entryRef = db.collection('entries').doc(entryId)
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const retryCount = entry._cf?.retryCount ?? 0
    const maxRetries = entry._cf?.maxRetries ?? 2

    try {
      // Atomically claim the entry via transaction
      const acquired = await db.runTransaction(async (transaction) => {
        const entryDoc = await transaction.get(entryRef)
        const current = entryDoc.data() as EntryRecord | undefined

        if (!current || current.status !== 'active' || current._cf?.workerId) {
          console.log(`[EntryWorker] Entry ${entryId} already being processed`)
          return false
        }

        transaction.update(entryRef, {
          '_cf.workerId': workerId,
          '_cf.lastHeartbeat': Date.now(),
        })

        return true
      })

      if (!acquired) return

      console.log(`[EntryWorker] Entry ${entryId} acquired by ${workerId}`)

      const apiKey = arkApiKey.value()
      if (!apiKey) throw new Error('ARK_API_KEY not configured')

      // Determine expected count from existing images array or default
      const expectedCount = entry.images.length > 0
        ? entry.images.length
        : DEFAULT_EXPECTED_COUNT

      // Initialize pending images
      const images: EntryImage[] = []
      for (let i = 0; i < expectedCount; i++) {
        images.push({
          id: `img-${i}`,
          url: '',
          width: 0,
          height: 0,
          status: 'pending',
        })
      }
      await entryRef.update({ images })

      // Collect generated images
      const generatedImages: Map<number, GeneratedImage> = new Map()

      const result = await generateImages(
        {
          prompt: entry.prompt,
          mode: entry.mode,
          size: entry.size,
          referenceImageUrls: entry.referenceImageUrls,
          strength: entry.strength,
          expectedCount,
        },
        apiKey,
        async (generatedImage: GeneratedImage) => {
          generatedImages.set(generatedImage.index, generatedImage)
          console.log(`[EntryWorker] Image ${generatedImage.index + 1}/${expectedCount} received`)
        }
      )

      console.log(`[EntryWorker] Processing ${generatedImages.size} images...`)

      // Upload to Storage in parallel
      const finalImages: EntryImage[] = [...images]
      const uploadPromises: Promise<void>[] = []

      for (const [index, genImg] of generatedImages) {
        const uploadTask = (async () => {
          let storageUrl: string | undefined
          try {
            storageUrl = await uploadImageToStorage(genImg.url, entry.userId)
          } catch (uploadError) {
            console.error(`[EntryWorker] Failed to upload image ${index}:`, uploadError)
          }

          // Parse dimensions from size string (e.g., "1728x2304")
          const [w, h] = (genImg.size || '0x0').split('x').map(Number)

          finalImages[index] = {
            id: `img-${index}`,
            url: storageUrl || genImg.url,
            originalUrl: genImg.url,
            width: w || 0,
            height: h || 0,
            status: 'done',
          }

          console.log(`[EntryWorker] Image ${index + 1}/${expectedCount} uploaded`)
        })()
        uploadPromises.push(uploadTask)
      }

      await Promise.all(uploadPromises)

      // Mark failed images
      for (const error of result.errors) {
        if (finalImages[error.index]) {
          finalImages[error.index] = {
            ...finalImages[error.index],
            status: 'failed',
            error: error.message,
          }
        }
      }

      // Batch update all images + mark done
      await entryRef.update({
        images: finalImages,
        status: 'done' as EntryStatus,
        completedAt: Date.now(),
        '_cf.lastHeartbeat': Date.now(),
      })

      console.log(`[EntryWorker] Entry ${entryId} completed successfully`)

    } catch (error) {
      console.error(`[EntryWorker] Entry ${entryId} failed:`, error)

      if (retryCount < maxRetries) {
        console.log(`[EntryWorker] Retrying entry ${entryId} (${retryCount + 1}/${maxRetries})`)
        await entryRef.update({
          status: 'active' as EntryStatus,
          '_cf.retryCount': retryCount + 1,
          '_cf.workerId': admin.firestore.FieldValue.delete(),
          '_cf.lastHeartbeat': Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      } else {
        await entryRef.update({
          status: 'failed' as EntryStatus,
          completedAt: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }
)
