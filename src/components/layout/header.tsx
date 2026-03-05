'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Github, LogOut, User, Loader2, ChevronDown, Code, BookOpen, Settings, Coins, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSession, signOut } from '@/lib/auth-client'
import { useFirecrawlKey, useTokenUsage } from '@/hooks/use-data'

interface HeaderProps {
  showCTA?: boolean
  ctaText?: string
  ctaHref?: string
}

export function Header({ showCTA = true, ctaText = "Use this template", ctaHref = "#" }: HeaderProps) {
  const { data: session } = useSession()
  const isAuthenticated = !!session
  const [isSigningOut, setIsSigningOut] = useState(false)
  useFirecrawlKey()
  const { data: tokenUsageData } = useTokenUsage()

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header className="px-4 sm:px-6 lg:px-8 py-4 border-b border-zinc-200 bg-white">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center">
          <img src="/firecrawl-logo-with-fire.webp" alt="Firecrawl" className="h-8 w-auto" />
        </Link>

        <div className="flex items-center gap-4">
          {isAuthenticated && tokenUsageData?.remaining_tokens !== undefined && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
              <Coins className="h-4 w-4" />
              <span>{tokenUsageData.remaining_tokens.toLocaleString()} credits remaining</span>
            </div>
          )}
          {isAuthenticated ? (
            <>
              <Link href="/grants">
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Grants</span>
                </Button>
              </Link>
              <Link href="/api-docs">
                <Button variant="orange" size="sm" className="gap-2">
                  <Code className="h-4 w-4" />
                  <span className="hidden sm:inline">API</span>
                </Button>
              </Link>
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="code" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline-block">{session?.user?.email || 'Account'}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Account</p>
                    <p className="text-xs leading-none text-zinc-500">
                      {session?.user?.email || ''}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/docs" className="flex items-center cursor-pointer">
                    <BookOpen className="mr-2 h-4 w-4" />
                    <span>Documentation</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="cursor-pointer"
                >
                  {isSigningOut ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Logging out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            showCTA && (
              <Button
                variant="code"
                asChild
              >
                <Link href={ctaHref} target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  {ctaText}
                </Link>
              </Button>
            )
          )}
        </div>
      </div>
    </header>
  )
}
