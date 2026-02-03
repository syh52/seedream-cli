'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Button } from '@/components/ui/button'
import { Sparkles, Heart, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { subscribeToAllImages, toggleLike } from '@/lib/firestore'
import type { ImageRecord } from '@/types'

export default function Home() {
  const { user, signOut } = useAuth()
  const [images, setImages] = useState<ImageRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const unsubscribe = subscribeToAllImages((imgs) => {
      if (isMounted) {
        setImages(imgs)
        setLoading(false)
      }
    })
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const handleLike = async (image: ImageRecord) => {
    if (!user) return
    await toggleLike(image.id, !image.liked)
  }

  return (
    <div className="flex h-dvh">
      <Sidebar
        user={user ? {
          displayName: user.displayName || 'User',
          email: user.email || '',
          photoURL: user.photoURL || undefined,
        } : null}
        onLogout={signOut}
      />

      <main className="flex-1 overflow-auto relative sd-noise">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-16 md:h-20 items-center justify-between border-b border-white/5 bg-zinc-950/90 px-4 md:px-8 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <MobileNav
              user={user ? {
                displayName: user.displayName || 'User',
                email: user.email || '',
                photoURL: user.photoURL || undefined,
              } : null}
              onLogout={signOut}
            />
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Explore</h1>
              <p className="text-xs md:text-sm text-zinc-500 sd-mono">discover • inspire • create</p>
            </div>
          </div>
          <Link href="/create">
            <Button className="bg-emerald-600 hover:bg-emerald-500 sd-btn-glow h-11 px-6 font-semibold">
              <Sparkles className="mr-2 h-4 w-4" />
              Create
            </Button>
          </Link>
        </header>

        {/* Content */}
        <div className="p-4 md:p-8 relative z-10">
          {loading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : images.length > 0 ? (
            <>
              {/* Stats bar */}
              <div className="mb-8 flex items-center gap-6 text-sm text-zinc-500">
                <span className="sd-mono">{images.length} creations</span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span className="sd-mono">community gallery</span>
              </div>

              {/* Masonry-style grid */}
              <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className={`mb-6 break-inside-avoid sd-animate-in sd-stagger-${(index % 6) + 1}`}
                  >
                    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900 sd-image-glow">
                      <img
                        src={image.imageUrl || image.originalUrl}
                        alt={image.prompt}
                        className="w-full object-cover"
                        loading="lazy"
                      />

                      {/* Hover overlay */}
                      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-all duration-300 group-hover:opacity-100">
                        {/* Top: Like button */}
                        <div className="flex justify-end p-4">
                          <button
                            onClick={() => handleLike(image)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110"
                          >
                            <Heart
                              className={`h-5 w-5 transition-colors ${
                                image.liked ? 'fill-red-500 text-red-500' : 'text-white'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Bottom: Info */}
                        <div className="p-4">
                          <p className="line-clamp-2 text-sm text-white/90 mb-2">
                            {image.prompt}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xs font-bold">
                              {image.userName?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <span className="text-xs text-zinc-400 sd-mono">
                              {image.userName || 'Anonymous'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Liked indicator */}
                      {image.liked && (
                        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-1 text-xs font-medium backdrop-blur-sm">
                          <Heart className="h-3 w-3 fill-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <div className="mb-8 relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                <div className="relative rounded-full bg-zinc-900 p-8 border border-white/5">
                  <Sparkles className="h-16 w-16 text-emerald-500" />
                </div>
              </div>
              <h2 className="mb-3 text-4xl font-bold tracking-tight">
                Welcome to <span className="sd-text-gradient">SeeDream</span>
              </h2>
              <p className="mb-8 max-w-md text-zinc-400 text-lg">
                The gallery awaits your first creation. Transform your imagination into stunning visuals.
              </p>
              <Link href="/create">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 sd-btn-glow h-14 px-8 text-lg font-semibold">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Create Your First Image
                </Button>
              </Link>
              <p className="mt-6 text-sm text-zinc-600 sd-mono">
                powered by seedream 4.5
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
