import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

/**
 * Upload base64 image data to Firebase Storage
 * Used for uploading reference images before task creation
 *
 * @param base64Data - Base64 encoded image (with or without data URL prefix)
 * @param userId - The user's ID for organizing storage
 * @param taskId - The task ID for organizing storage
 * @param index - Image index for filename
 * @returns The permanent Firebase Storage download URL
 */
export async function uploadBase64Image(
  base64Data: string,
  userId: string,
  taskId: string,
  index: number
): Promise<string> {
  const filename = `${Date.now()}-ref-${index}.png`
  const storagePath = `references/${userId}/${taskId}/${filename}`
  const storageRef = ref(storage, storagePath)

  // Upload as data URL (base64)
  if (base64Data.startsWith('data:')) {
    await uploadString(storageRef, base64Data, 'data_url')
  } else {
    await uploadString(storageRef, `data:image/png;base64,${base64Data}`, 'data_url')
  }

  // Get the permanent download URL
  const downloadUrl = await getDownloadURL(storageRef)
  return downloadUrl
}

/**
 * Upload an image from URL to Firebase Storage
 * Uses server-side proxy to bypass CORS restrictions
 *
 * @param imageUrl - The temporary URL from SeeDream API (24h valid)
 * @param userId - The user's ID for organizing storage
 * @param filename - Optional custom filename
 * @returns The permanent Firebase Storage download URL
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  userId: string,
  filename?: string
): Promise<string> {
  // Use proxy API to fetch image (bypasses CORS)
  const proxyResponse = await fetch('/api/save-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  })

  if (!proxyResponse.ok) {
    const error = await proxyResponse.json()
    throw new Error(error.error || 'Failed to fetch image via proxy')
  }

  const { data: base64, contentType } = await proxyResponse.json()

  // Convert base64 to Blob
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: contentType })

  // Generate filename if not provided
  const name = filename || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.png`
  const storageRef = ref(storage, `images/${userId}/${name}`)

  // Upload to Firebase Storage
  await uploadBytes(storageRef, blob, {
    contentType: contentType || 'image/png',
  })

  // Get the permanent download URL
  const downloadUrl = await getDownloadURL(storageRef)
  return downloadUrl
}
