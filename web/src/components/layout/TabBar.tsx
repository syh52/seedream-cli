'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Images, Sparkles } from 'lucide-react'

const tabs = [
  { href: '/', label: 'Gallery', icon: Images },
  { href: '/create', label: 'Create', icon: Sparkles },
]

export function TabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 flex h-14 items-center justify-around border-t border-white/5 bg-[#0d0e12] pb-[env(safe-area-inset-bottom)]">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 text-xs ${active ? 'text-emerald-500' : 'text-zinc-500'}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
