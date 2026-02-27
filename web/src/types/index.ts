/**
 * SeeDream Unified Types
 *
 * Single `entries` collection replaces both `images` and `tasks`.
 * An Entry starts as a generation task (status: 'active') and becomes
 * a gallery item once complete (status: 'done').
 */

// Generation modes per BytePlus SeeDream 4.5 docs
export type GenerateMode = 'text' | 'image' | 'multi'

export interface EntryImage {
  id: string
  url: string                // Firebase Storage URL (permanent)
  originalUrl?: string       // SeeDream API URL (temporary, 24h)
  width: number
  height: number
  status: 'pending' | 'done' | 'failed'
  error?: string
}

export interface Entry {
  id: string
  userId: string
  userName: string
  status: 'active' | 'done' | 'failed'
  prompt: string
  mode: GenerateMode
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

// API response parsing types (used by Cloud Function & MCP)
export interface GenerationResult {
  url: string
  size: string
}

export interface GenerationResponse {
  model: string
  created: number
  data: GenerationResult[]
  usage: {
    generated_images: number
    output_tokens: number
    total_tokens: number
  }
}

export interface User {
  id: string
  email: string
  displayName: string
  photoURL?: string
}

export const MAX_CONCURRENT_ENTRIES = 3
