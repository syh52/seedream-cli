import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  limit,
  getDocs,
} from 'firebase/firestore'
import { db } from './firebase'
import type { ImageRecord, GenerateMode, TaskRecord, TaskStatus, TaskImage } from '@/types'

const IMAGES_COLLECTION = 'images'

// Create a new image record
export async function createImageRecord(data: {
  userId: string
  userName: string
  prompt: string
  imageUrl: string
  originalUrl: string
  size: string
  mode: GenerateMode
}): Promise<string> {
  const docRef = await addDoc(collection(db, IMAGES_COLLECTION), {
    ...data,
    liked: false,
    deleted: false,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

// Toggle like status
export async function toggleLike(imageId: string, liked: boolean): Promise<void> {
  const docRef = doc(db, IMAGES_COLLECTION, imageId)
  await updateDoc(docRef, { liked })
}

// Soft delete (move to trash)
export async function softDeleteImage(imageId: string): Promise<void> {
  const docRef = doc(db, IMAGES_COLLECTION, imageId)
  await updateDoc(docRef, { deleted: true })
}

// Restore from trash
export async function restoreImage(imageId: string): Promise<void> {
  const docRef = doc(db, IMAGES_COLLECTION, imageId)
  await updateDoc(docRef, { deleted: false })
}

// Permanent delete
export async function permanentDeleteImage(imageId: string): Promise<void> {
  const docRef = doc(db, IMAGES_COLLECTION, imageId)
  await deleteDoc(docRef)
}

// Subscribe to user's images (real-time)
export function subscribeToUserImages(
  userId: string,
  filter: 'all' | 'liked' | 'deleted',
  callback: (images: ImageRecord[]) => void
): () => void {
  let q = query(
    collection(db, IMAGES_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  )

  if (filter === 'liked') {
    q = query(
      collection(db, IMAGES_COLLECTION),
      where('userId', '==', userId),
      where('liked', '==', true),
      where('deleted', '==', false),
      orderBy('createdAt', 'desc')
    )
  } else if (filter === 'deleted') {
    q = query(
      collection(db, IMAGES_COLLECTION),
      where('userId', '==', userId),
      where('deleted', '==', true),
      orderBy('createdAt', 'desc')
    )
  } else {
    q = query(
      collection(db, IMAGES_COLLECTION),
      where('userId', '==', userId),
      where('deleted', '==', false),
      orderBy('createdAt', 'desc')
    )
  }

  return onSnapshot(q, (snapshot) => {
    const images: ImageRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ImageRecord[]
    callback(images)
  })
}

// Subscribe to all public images (for Explore page)
export function subscribeToAllImages(
  callback: (images: ImageRecord[]) => void
): () => void {
  const q = query(
    collection(db, IMAGES_COLLECTION),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
    const images: ImageRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ImageRecord[]
    callback(images)
  })
}

// ===== Generation Tasks Persistence =====

const TASKS_COLLECTION = 'tasks'
const MAX_TASK_HISTORY = 10

// 创建或更新任务记录
export async function saveTask(task: TaskRecord): Promise<void> {
  const docRef = doc(db, TASKS_COLLECTION, task.id)
  await setDoc(docRef, {
    ...task,
    updatedAt: serverTimestamp(),
  })
}

// 更新任务状态
export async function updateTaskStatus(
  taskId: string,
  updates: Partial<Pick<TaskRecord, 'status' | 'images' | 'completedAt' | 'error' | 'usage'>>
): Promise<void> {
  const docRef = doc(db, TASKS_COLLECTION, taskId)
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

// 删除任务
export async function deleteTask(taskId: string): Promise<void> {
  const docRef = doc(db, TASKS_COLLECTION, taskId)
  await deleteDoc(docRef)
}

// 批量删除任务
export async function deleteTasks(taskIds: string[]): Promise<void> {
  await Promise.all(taskIds.map(id => deleteTask(id)))
}

// 获取用户最近的任务（一次性获取，用于初始化）
export async function getUserTasks(userId: string): Promise<TaskRecord[]> {
  const q = query(
    collection(db, TASKS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(MAX_TASK_HISTORY)
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  })) as TaskRecord[]
}

// 订阅用户任务（实时更新）
export function subscribeToUserTasks(
  userId: string,
  callback: (tasks: TaskRecord[]) => void
): () => void {
  const q = query(
    collection(db, TASKS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(MAX_TASK_HISTORY)
  )

  return onSnapshot(q, (snapshot) => {
    const tasks: TaskRecord[] = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    })) as TaskRecord[]
    callback(tasks)
  })
}
