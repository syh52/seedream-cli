'use client'

import type { GenerateMode } from '@/types'

interface PillBadgeProps {
  label: string
}

export function PillBadge({ label }: PillBadgeProps) {
  return (
    <span className="bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5 text-xs">
      {label}
    </span>
  )
}

export function EntryPills({ size, mode, strength }: {
  size: string
  mode: GenerateMode
  strength?: number
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <PillBadge label={size} />
      <PillBadge label={mode} />
      {mode !== 'text' && strength !== undefined && (
        <PillBadge label={`str ${strength}`} />
      )}
    </div>
  )
}
