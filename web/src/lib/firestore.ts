import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Entry } from '@/types'

const ENTRIES = 'entries'

// Create a new entry (generation task)
export async function createEntry(entry: Entry): Promise<void> {
  await setDoc(doc(db, ENTRIES, entry.id), entry)
}

// Toggle like
export async function toggleEntryLike(entryId: string, liked: boolean): Promise<void> {
  await updateDoc(doc(db, ENTRIES, entryId), { liked })
}

// Soft delete
export async function softDeleteEntry(entryId: string): Promise<void> {
  await updateDoc(doc(db, ENTRIES, entryId), { deleted: true })
}

// Permanent delete
export async function permanentDeleteEntry(entryId: string): Promise<void> {
  await deleteDoc(doc(db, ENTRIES, entryId))
}

// Get single entry by ID (for remix)
export async function getEntryById(entryId: string): Promise<Entry | null> {
  const snap = await getDoc(doc(db, ENTRIES, entryId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Entry
}

// Gallery subscription with filter
export function subscribeToGallery(
  filter: 'all' | 'liked',
  userId: string | null,
  callback: (entries: Entry[]) => void
): () => void {
  let q

  if (filter === 'liked') {
    q = query(
      collection(db, ENTRIES),
      where('liked', '==', true),
      where('deleted', '==', false),
      orderBy('createdAt', 'desc')
    )
  } else {
    // "all" - show done + not deleted
    q = query(
      collection(db, ENTRIES),
      where('status', '==', 'done'),
      where('deleted', '==', false),
      orderBy('createdAt', 'desc')
    )
  }

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Entry[]
    callback(entries)
  })
}

// Active entries subscription for Create page
export function subscribeToActiveEntries(
  userId: string,
  callback: (entries: Entry[]) => void
): () => void {
  const q = query(
    collection(db, ENTRIES),
    where('userId', '==', userId),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Entry[]
    callback(entries)
  })
}
