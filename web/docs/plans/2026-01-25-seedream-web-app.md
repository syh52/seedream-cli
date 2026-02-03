# SeeDream Web App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a MidJourney-style AI image generation web app for team use, powered by SeeDream API.

**Architecture:** Next.js 15 App Router + Firebase (Auth, Firestore, Storage) + SeeDream API. Server-side API routes protect credentials. Real-time updates via Firestore subscriptions.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Firebase SDK, SeeDream API

---

## Project Status

### Completed ✅
- [x] Next.js project initialization
- [x] shadcn/ui components setup
- [x] Firebase configuration file (`src/lib/firebase.ts`)
- [x] SeeDream API route (`src/app/api/generate/route.ts`)
- [x] Basic layout with Sidebar
- [x] Placeholder pages (Home, Create, Organize)
- [x] Type definitions (`src/types/index.ts`)

### Remaining Tasks

---

## Phase 1: Firebase Integration & Auth

### Task 1.1: Configure Firebase Environment

**Files:**
- Create: `web/.env.local`

**Step 1: Create environment file**

Copy from template and fill in Firebase credentials:
```bash
cp .env.local.example .env.local
```

**Step 2: Get Firebase config from console**

1. Go to Firebase Console → Project Settings → Your Apps
2. Copy the config object values
3. Fill in `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
ARK_API_KEY=xxx
```

**Step 3: Verify dev server starts**

Run: `npm run dev`
Expected: Server starts at http://localhost:3000

---

### Task 1.2: Create Auth Context Provider

**Files:**
- Create: `src/contexts/AuthContext.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create AuthContext**

```typescript
// src/contexts/AuthContext.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

**Step 2: Wrap app with AuthProvider**

Modify `src/app/layout.tsx`:
```typescript
import { AuthProvider } from '@/contexts/AuthContext'

// In RootLayout, wrap children:
<AuthProvider>{children}</AuthProvider>
```

**Step 3: Verify no build errors**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Firebase auth context provider"
```

---

### Task 1.3: Create Login Page

**Files:**
- Create: `src/app/login/page.tsx`

**Step 1: Create login page**

```typescript
// src/app/login/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { Sparkles, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !loading) {
      router.push('/')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <Sparkles className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">SeeDream</h1>
          <p className="mt-2 text-zinc-400">AI Image Generator for Teams</p>
        </div>

        <Button
          onClick={signInWithGoogle}
          className="w-full bg-white text-black hover:bg-zinc-200"
          size="lg"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>
      </Card>
    </div>
  )
}
```

**Step 2: Test login flow**

Run: `npm run dev`
1. Navigate to http://localhost:3000/login
2. Click "Continue with Google"
3. Verify redirect to home after login

**Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add Google sign-in login page"
```

---

### Task 1.4: Update Sidebar with Auth

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Update Sidebar to use auth**

The Sidebar already accepts user prop. Update pages to pass real auth data.

**Step 2: Update Home page**

```typescript
// In src/app/page.tsx, add:
import { useAuth } from '@/contexts/AuthContext'

// Inside component:
const { user, signOut } = useAuth()

// Pass to Sidebar:
<Sidebar
  user={user ? {
    displayName: user.displayName || 'User',
    email: user.email || '',
    photoURL: user.photoURL || undefined,
  } : null}
  onLogout={signOut}
/>
```

**Step 3: Apply same pattern to Create and Organize pages**

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: integrate auth into sidebar and pages"
```

---

## Phase 2: Firestore Database

### Task 2.1: Create Firestore Service

**Files:**
- Create: `src/lib/firestore.ts`

**Step 1: Create Firestore helper functions**

```typescript
// src/lib/firestore.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  getDocs,
} from 'firebase/firestore'
import { db } from './firebase'
import type { ImageRecord, GenerateMode } from '@/types'

const IMAGES_COLLECTION = 'images'

export async function saveImage(data: {
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
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function toggleLike(imageId: string, liked: boolean): Promise<void> {
  await updateDoc(doc(db, IMAGES_COLLECTION, imageId), { liked })
}

export async function softDelete(imageId: string): Promise<void> {
  await updateDoc(doc(db, IMAGES_COLLECTION, imageId), { deleted: true })
}

export async function restoreImage(imageId: string): Promise<void> {
  await updateDoc(doc(db, IMAGES_COLLECTION, imageId), { deleted: false })
}

export async function permanentDelete(imageId: string): Promise<void> {
  await deleteDoc(doc(db, IMAGES_COLLECTION, imageId))
}

export function subscribeToUserImages(
  userId: string,
  filter: 'all' | 'liked' | 'deleted',
  callback: (images: ImageRecord[]) => void
) {
  let q = query(
    collection(db, IMAGES_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  )

  if (filter === 'liked') {
    q = query(q, where('liked', '==', true), where('deleted', '==', false))
  } else if (filter === 'deleted') {
    q = query(q, where('deleted', '==', true))
  } else {
    q = query(q, where('deleted', '==', false))
  }

  return onSnapshot(q, (snapshot) => {
    const images = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ImageRecord[]
    callback(images)
  })
}

export function subscribeToAllImages(
  callback: (images: ImageRecord[]) => void
) {
  const q = query(
    collection(db, IMAGES_COLLECTION),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
    const images = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ImageRecord[]
    callback(images)
  })
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/firestore.ts
git commit -m "feat: add Firestore service for image CRUD"
```

---

### Task 2.2: Setup Firestore Indexes

**Files:**
- Create: `firestore.indexes.json` (in project root, not web/)

**Step 1: Create index configuration**

Firestore composite indexes needed for queries:

```json
{
  "indexes": [
    {
      "collectionGroup": "images",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "deleted", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "images",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "liked", "order": "ASCENDING" },
        { "fieldPath": "deleted", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "images",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "deleted", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Step 2: Deploy indexes (optional, can also create via console)**

```bash
firebase deploy --only firestore:indexes
```

---

## Phase 3: Image Generation Flow

### Task 3.1: Integrate Create Page with API

**Files:**
- Modify: `src/app/create/page.tsx`
- Modify: `src/lib/firestore.ts`

**Step 1: Add image saving after generation**

After successful API response, save to Firestore and download to Storage.

**Step 2: Update Create page to save images**

Add to handleGenerate function:
```typescript
// After getting result from API
for (const item of result.data) {
  await saveImage({
    userId: user.uid,
    userName: user.displayName || 'Anonymous',
    prompt,
    imageUrl: item.url,  // For now, use API URL directly
    originalUrl: item.url,
    size: item.size,
    mode,
  })
}
```

**Step 3: Test generation flow**

1. Login
2. Enter prompt
3. Click Generate
4. Verify image appears
5. Check Firestore console for new document

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: save generated images to Firestore"
```

---

### Task 3.2: Add Firebase Storage for Permanent URLs

**Files:**
- Create: `src/lib/storage.ts`
- Modify: `src/app/create/page.tsx`

**Step 1: Create storage helper**

```typescript
// src/lib/storage.ts
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

export async function uploadImageFromUrl(
  url: string,
  userId: string,
  fileName: string
): Promise<string> {
  // Fetch image from SeeDream URL
  const response = await fetch(url)
  const blob = await response.blob()

  // Upload to Firebase Storage
  const storageRef = ref(storage, `images/${userId}/${fileName}`)
  await uploadBytes(storageRef, blob)

  // Get permanent download URL
  return getDownloadURL(storageRef)
}
```

**Step 2: Update Create page to upload images**

```typescript
// In handleGenerate, after API response:
const permanentUrl = await uploadImageFromUrl(
  item.url,
  user.uid,
  `${Date.now()}-${index}.jpg`
)

await saveImage({
  // ... other fields
  imageUrl: permanentUrl,  // Use permanent Storage URL
  originalUrl: item.url,   // Keep original for reference
})
```

**Step 3: Test and commit**

---

## Phase 4: Explore Page (Gallery)

### Task 4.1: Implement Image Gallery Grid

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/ImageCard.tsx`

**Step 1: Create reusable ImageCard component**

```typescript
// src/components/ImageCard.tsx
'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Heart, Download } from 'lucide-react'
import type { ImageRecord } from '@/types'

interface ImageCardProps {
  image: ImageRecord
  onLike?: (id: string, liked: boolean) => void
  showAuthor?: boolean
}

export function ImageCard({ image, onLike, showAuthor = true }: ImageCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Card
      className="group relative overflow-hidden border-zinc-800 bg-zinc-900"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={image.imageUrl}
        alt={image.prompt}
        className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
        loading="lazy"
      />

      {/* Hover Overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 transition-opacity ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top - Author */}
        {showAuthor && (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-zinc-700 text-xs">
                {image.userName?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-white">{image.userName}</span>
          </div>
        )}

        {/* Bottom - Actions */}
        <div className="flex justify-end gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 bg-black/50 hover:bg-black/70"
            onClick={() => onLike?.(image.id, !image.liked)}
          >
            <Heart
              className={`h-4 w-4 ${
                image.liked ? 'fill-red-500 text-red-500' : 'text-white'
              }`}
            />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 bg-black/50 hover:bg-black/70"
            onClick={() => window.open(image.imageUrl, '_blank')}
          >
            <Download className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
```

**Step 2: Update Home page with real data**

```typescript
// src/app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { ImageCard } from '@/components/ImageCard'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToAllImages, toggleLike } from '@/lib/firestore'
import type { ImageRecord } from '@/types'

export default function Home() {
  const { user, signOut } = useAuth()
  const [images, setImages] = useState<ImageRecord[]>([])

  useEffect(() => {
    const unsubscribe = subscribeToAllImages(setImages)
    return unsubscribe
  }, [])

  const handleLike = async (id: string, liked: boolean) => {
    await toggleLike(id, liked)
  }

  return (
    <div className="flex h-screen">
      <Sidebar user={...} onLogout={signOut} />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header>...</header>

        {/* Image Grid */}
        <div className="p-6">
          {images.length > 0 ? (
            <div className="columns-2 gap-4 md:columns-3 lg:columns-4 xl:columns-5">
              {images.map((image) => (
                <div key={image.id} className="mb-4 break-inside-avoid">
                  <ImageCard image={image} onLike={handleLike} />
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
          )}
        </div>
      </main>
    </div>
  )
}
```

**Step 3: Test and commit**

---

## Phase 5: Organize Page

### Task 5.1: Implement Organize with Filters

**Files:**
- Modify: `src/app/organize/page.tsx`

**Step 1: Add real data subscription**

```typescript
useEffect(() => {
  if (!user) return
  const unsubscribe = subscribeToUserImages(user.uid, filter, setImages)
  return unsubscribe
}, [user, filter])
```

**Step 2: Add delete and restore handlers**

```typescript
const handleDelete = async (id: string) => {
  await softDelete(id)
}

const handleRestore = async (id: string) => {
  await restoreImage(id)
}

const handlePermanentDelete = async (id: string) => {
  if (confirm('Permanently delete this image?')) {
    await permanentDelete(id)
  }
}
```

**Step 3: Test all filter modes**

1. All - shows non-deleted images
2. Liked - shows only liked images
3. Trash - shows deleted images with restore option

**Step 4: Commit**

---

## Phase 6: Polish & Deploy

### Task 6.1: Add Loading States

**Files:**
- Modify: All pages

Add skeleton loaders and loading spinners for better UX.

---

### Task 6.2: Add Error Handling

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: API routes

Add proper error boundaries and toast notifications.

---

### Task 6.3: Firebase Deployment

**Files:**
- Create: `firebase.json`
- Modify: `next.config.ts`

**Step 1: Configure Firebase Hosting**

```json
{
  "hosting": {
    "source": ".",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "frameworksBackend": {
      "region": "asia-southeast1"
    }
  }
}
```

**Step 2: Deploy**

```bash
firebase deploy
```

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| **Phase 1** | Firebase Auth | ⬜ Pending |
| **Phase 2** | Firestore Database | ⬜ Pending |
| **Phase 3** | Image Generation | ⬜ Pending |
| **Phase 4** | Explore Gallery | ⬜ Pending |
| **Phase 5** | Organize Page | ⬜ Pending |
| **Phase 6** | Polish & Deploy | ⬜ Pending |

**Estimated Tasks:** 15-20 individual commits
