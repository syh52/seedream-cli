'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Compass,
  Sparkles,
  FolderOpen,
  User,
  LogOut,
  Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
} from '@/components/ui/sheet'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  description: string
}

const navItems: NavItem[] = [
  { href: '/', label: 'Explore', icon: <Compass className="h-5 w-5" />, description: 'Discover' },
  { href: '/create', label: 'Create', icon: <Sparkles className="h-5 w-5" />, description: 'Generate' },
  { href: '/organize', label: 'Organize', icon: <FolderOpen className="h-5 w-5" />, description: 'Manage' },
]

interface MobileNavProps {
  user?: {
    displayName: string
    email: string
    photoURL?: string
  } | null
  onLogout?: () => void
}

export function MobileNav({ user, onLogout }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[75vw] max-w-64 p-0 bg-zinc-950 border-r border-white/5" showCloseButton={false}>
        {/* Accessible title for screen readers */}
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

        {/* Logo */}
        <div className="relative flex h-16 items-center px-4 border-b border-white/5">
          <SheetClose asChild>
            <Link href="/" className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/30 blur-lg rounded-lg" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight">SeeDream</span>
                <p className="text-[10px] text-zinc-600 sd-mono tracking-wider">AI IMAGE STUDIO</p>
              </div>
            </Link>
          </SheetClose>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <SheetClose key={item.href} asChild>
                <Link
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                  )}
                >
                  <span className={cn(
                    'transition-transform duration-200',
                    isActive ? '' : 'group-hover:scale-110'
                  )}>
                    {item.icon}
                  </span>
                  <div>
                    <span className="block">{item.label}</span>
                    <span className={cn(
                      'text-[10px] sd-mono transition-opacity',
                      isActive ? 'text-white/60' : 'text-zinc-600 group-hover:text-zinc-500'
                    )}>
                      {item.description}
                    </span>
                  </div>
                </Link>
              </SheetClose>
            )
          })}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/5 p-4 bg-zinc-950">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10 ring-2 ring-white/10">
                  <AvatarImage src={user.photoURL} />
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-semibold">
                    {user.displayName?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {user.displayName}
                </p>
                <p className="truncate text-xs text-zinc-500 sd-mono">{user.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                className="h-9 w-9 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <SheetClose asChild>
              <Link href="/login">
                <Button className="w-full bg-zinc-800 hover:bg-zinc-700 border border-white/5 h-11">
                  <User className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              </Link>
            </SheetClose>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
