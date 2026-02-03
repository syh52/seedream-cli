'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Masonry from 'react-masonry-css'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { ImageDetailSheet } from '@/components/gallery/ImageDetailSheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Heart,
  Download,
  Link as LinkIcon,
  MoreHorizontal,
  ImageIcon,
  Loader2,
  Sparkles,
} from 'lucide-react'
import {
  subscribeToAllImages,
  toggleLike,
} from '@/lib/firestore'
import type { ImageRecord } from '@/types'
import Link from 'next/link'

// Masonry breakpoint columns configuration
const masonryBreakpoints = {
  default: 5,  // xl and above
  1280: 4,     // lg
  1024: 3,     // md
  768: 2,      // sm and below
}

type FilterType = 'all' | 'liked'

export default function OrganizePage() {
  const { user, signOut, loading: authLoading } = useAuth()
  const router = useRouter()
  const [filter, setFilter] = useState<FilterType>('all')
  const [images, setImages] = useState<ImageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    // Subscribe to all images (shared gallery)
    const unsubscribe = subscribeToAllImages((imgs) => {
      if (isMounted) {
        // Apply local filter
        const filtered = filter === 'liked'
          ? imgs.filter(img => img.liked)
          : imgs
        setImages(filtered)
        setLoading(false)

        // Update selected image if it's still in the list (for real-time like updates)
        if (selectedImage) {
          const updated = imgs.find(img => img.id === selectedImage.id)
          if (updated) setSelectedImage(updated)
        }
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [filter, selectedImage?.id])

  const handleLike = useCallback(async (image: ImageRecord) => {
    if (!user) {
      router.push('/login')
      return
    }
    await toggleLike(image.id, !image.liked)
  }, [user, router])

  const handleDownload = useCallback(async (image: ImageRecord) => {
    const url = image.imageUrl || image.originalUrl

    try {
      // Fetch the image and create a blob for proper download
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `seedream-${image.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch {
      // Fallback to direct link
      const link = document.createElement('a')
      link.href = url
      link.download = `seedream-${image.id}.png`
      link.target = '_blank'
      link.click()
    }
  }, [])

  const handleCopyUrl = useCallback(async (image: ImageRecord) => {
    await navigator.clipboard.writeText(image.imageUrl || image.originalUrl)
  }, [])

  const handleImageClick = useCallback((image: ImageRecord) => {
    setSelectedImage(image)
    setSheetOpen(true)
  }, [])

  const handleRegenerate = useCallback((prompt: string) => {
    // Navigate to create page with the prompt
    router.push(`/create?prompt=${encodeURIComponent(prompt)}`)
  }, [router])

  const filterOptions = [
    { value: 'all', label: 'All', icon: ImageIcon, count: null },
    { value: 'liked', label: 'Liked', icon: Heart, count: null },
  ]

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
        <header className="sticky top-0 z-10 flex h-auto md:h-20 flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0 border-b border-white/5 bg-zinc-950/90 px-4 md:px-8 py-3 md:py-0 backdrop-blur-xl">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <MobileNav
              user={user ? {
                displayName: user.displayName || 'User',
                email: user.email || '',
                photoURL: user.photoURL || undefined,
              } : null}
              onLogout={signOut}
            />
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Gallery</h1>
              <p className="text-xs md:text-sm text-zinc-500 sd-mono">shared collection</p>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-1 md:gap-2 bg-zinc-900/50 p-1 rounded-xl border border-white/5 w-full md:w-auto">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(option.value as FilterType)}
                className={`flex-1 md:flex-none rounded-lg px-2 md:px-4 h-9 text-xs md:text-sm transition-all ${
                  filter === option.value
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <option.icon className="mr-1 md:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{option.label}</span>
                <span className="sm:hidden">{option.label.slice(0, 3)}</span>
              </Button>
            ))}
          </div>
        </header>

        {/* Content */}
        <div className="p-4 md:p-8 relative z-10">
          {loading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : images.length > 0 ? (
            <>
              {/* Stats */}
              <div className="mb-6 md:mb-8 flex items-center gap-6 text-sm text-zinc-500">
                <span className="sd-mono">{images.length} images</span>
              </div>

              {/* Image Grid - Masonry layout (row-first ordering) */}
              <Masonry
                breakpointCols={masonryBreakpoints}
                className="masonry-grid"
                columnClassName="masonry-grid-column"
              >
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className={`sd-animate-in sd-stagger-${(index % 6) + 1} mb-3 md:mb-4`}
                  >
                    <button
                      className="group relative w-full overflow-hidden rounded-xl md:rounded-2xl border border-white/5 bg-zinc-900 md:sd-image-glow cursor-pointer text-left transition-transform active:scale-[0.98] md:active:scale-100"
                      onClick={() => handleImageClick(image)}
                    >
                      <img
                        src={image.imageUrl || image.originalUrl}
                        alt={image.prompt}
                        className="w-full h-auto"
                        loading="lazy"
                      />

                      {/* Hover Overlay - Desktop only */}
                      <div className="absolute inset-0 flex-col justify-between bg-gradient-to-t from-black/90 via-black/20 to-black/40 opacity-0 transition-all duration-300 group-hover:opacity-100 hidden md:flex">
                        {/* Top Actions */}
                        <div className="flex justify-end gap-2 p-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleLike(image)
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110"
                          >
                            <Heart
                              className={`h-4 w-4 transition-colors ${
                                image.liked ? 'fill-red-500 text-red-500' : 'text-white'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Bottom Menu */}
                        <div className="p-3">
                          <p className="line-clamp-2 text-xs text-white/80 mb-3">
                            {image.prompt}
                          </p>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full justify-start bg-black/50 hover:bg-black/70 text-xs h-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="mr-2 h-3 w-3" />
                                More options
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 bg-zinc-900 border-zinc-800">
                              <DropdownMenuItem onClick={() => handleDownload(image)} className="cursor-pointer">
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyUrl(image)} className="cursor-pointer">
                                <LinkIcon className="mr-2 h-4 w-4" />
                                Copy URL
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Liked Badge */}
                      {image.liked && (
                        <div className="absolute left-2 top-2 flex h-6 w-6 md:h-auto md:w-auto items-center justify-center md:gap-1 rounded-full bg-red-500/90 md:px-2 md:py-1 text-xs font-medium backdrop-blur-sm">
                          <Heart className="h-3 w-3 fill-white" />
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </Masonry>
            </>
          ) : (
            /* Empty State */
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <div className="mb-8 relative">
                <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full" />
                <div className="relative rounded-full bg-zinc-900 p-8 border border-white/5">
                  {filter === 'liked' ? (
                    <Heart className="h-16 w-16 text-zinc-600" />
                  ) : (
                    <ImageIcon className="h-16 w-16 text-zinc-600" />
                  )}
                </div>
              </div>
              <h2 className="mb-3 text-3xl font-bold">
                {filter === 'liked'
                  ? 'No liked images'
                  : 'No images yet'}
              </h2>
              <p className="mb-8 max-w-md text-zinc-400">
                {filter === 'liked'
                  ? 'Like some images to see them here.'
                  : 'Generate images via Web App or MCP to see them here.'}
              </p>
              {filter === 'all' && (
                <Link href="/create">
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 sd-btn-glow h-12 px-8">
                    <Sparkles className="mr-2 h-5 w-5" />
                    Create Your First Image
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Image Detail Sheet */}
      <ImageDetailSheet
        image={selectedImage}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onLike={handleLike}
        onDownload={handleDownload}
        onRegenerate={handleRegenerate}
      />
    </div>
  )
}
