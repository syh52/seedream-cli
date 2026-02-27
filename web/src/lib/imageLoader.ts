/**
 * Custom image loader using wsrv.nl — a free, fast image proxy/CDN.
 * Automatically resizes and converts to WebP.
 * Used because Next.js static export (output: 'export') has no server-side image optimization.
 */

interface ImageLoaderParams {
  src: string
  width: number
  quality?: number
}

export default function imageLoader({ src, width, quality }: ImageLoaderParams): string {
  // Skip optimization for data URLs and relative paths
  if (src.startsWith('data:') || src.startsWith('/')) {
    return src
  }

  const params = new URLSearchParams({
    url: src,
    w: String(width),
    q: String(quality || 75),
    output: 'webp',
  })

  return `https://wsrv.nl/?${params.toString()}`
}
