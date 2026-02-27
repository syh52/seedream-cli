/**
 * Migration script: images + tasks → entries
 *
 * Idempotent: checks for existing entries before creating.
 * Run with: npx tsx scripts/migrate-to-entries.ts
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_PATH
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'

// Initialize Firebase Admin
const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  || process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!saPath) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS')
  process.exit(1)
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'))
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function migrate() {
  console.log('Starting migration...')

  // 1. Migrate completed images
  const imagesSnap = await db.collection('images').get()
  console.log(`Found ${imagesSnap.size} images`)

  let imagesMigrated = 0
  let imagesSkipped = 0

  for (const doc of imagesSnap.docs) {
    const data = doc.data()
    const entryId = `migrated_img_${doc.id}`

    // Skip if already migrated
    const existing = await db.collection('entries').doc(entryId).get()
    if (existing.exists) {
      imagesSkipped++
      continue
    }

    await db.collection('entries').doc(entryId).set({
      id: entryId,
      userId: data.userId || 'unknown',
      userName: data.userName || 'Unknown',
      status: 'done',
      prompt: data.prompt || '',
      mode: data.mode || 'text',
      size: data.size || '2K',
      images: [{
        id: 'img-0',
        url: data.imageUrl || '',
        originalUrl: data.originalUrl || '',
        width: 0,
        height: 0,
        status: 'done',
      }],
      createdAt: data.createdAt?.toMillis?.() || Date.now(),
      completedAt: data.createdAt?.toMillis?.() || Date.now(),
      liked: data.liked || false,
      deleted: data.deleted || false,
      source: data.source || 'web',
    })
    imagesMigrated++
  }

  console.log(`Images: ${imagesMigrated} migrated, ${imagesSkipped} skipped`)

  // 2. Migrate tasks (that aren't already represented as images)
  const tasksSnap = await db.collection('tasks').get()
  console.log(`Found ${tasksSnap.size} tasks`)

  let tasksMigrated = 0
  let tasksSkipped = 0

  for (const doc of tasksSnap.docs) {
    const data = doc.data()
    const entryId = `migrated_task_${doc.id}`

    const existing = await db.collection('entries').doc(entryId).get()
    if (existing.exists) {
      tasksSkipped++
      continue
    }

    // Map old status to new
    let status: 'active' | 'done' | 'failed'
    if (data.status === 'completed') status = 'done'
    else if (data.status === 'failed' || data.status === 'cancelled') status = 'failed'
    else status = 'active'

    // Map old image statuses
    const images = (data.images || []).map((img: Record<string, unknown>, i: number) => {
      const mapped: Record<string, unknown> = {
        id: img.id || `img-${i}`,
        url: img.storageUrl || img.url || '',
        originalUrl: img.url || '',
        width: 0,
        height: 0,
        status: img.status === 'ready' ? 'done' : img.status === 'error' ? 'failed' : 'pending',
      }
      if (img.error !== undefined) mapped.error = img.error
      return mapped
    })

    const entryData: Record<string, unknown> = {
      id: entryId,
      userId: data.userId || 'unknown',
      userName: data.userName || 'Unknown',
      status,
      prompt: data.prompt || '',
      mode: data.mode === 'batch' ? 'text' : (data.mode || 'text'),
      size: data.size || '2K',
      images,
      createdAt: data.createdAt || Date.now(),
      liked: false,
      deleted: false,
      source: data.source || 'web',
    }

    if (data.completedAt !== undefined) entryData.completedAt = data.completedAt
    if (data.error !== undefined) entryData.error = data.error

    if (data.strength !== undefined) entryData.strength = data.strength
    if (data.referenceImageUrls) entryData.referenceImageUrls = data.referenceImageUrls

    await db.collection('entries').doc(entryId).set(entryData)
    tasksMigrated++
  }

  console.log(`Tasks: ${tasksMigrated} migrated, ${tasksSkipped} skipped`)
  console.log('Migration complete!')
}

migrate().catch(console.error)
