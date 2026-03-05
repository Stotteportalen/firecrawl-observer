'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleCardProps {
  title: string
  defaultOpen?: boolean
  badge?: ReactNode
  children: ReactNode
  className?: string
}

export function CollapsibleCard({
  title,
  defaultOpen = false,
  badge,
  children,
  className,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm',
        className
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold leading-none tracking-tight">
            {title}
          </h3>
          {badge}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-zinc-400 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-in-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
