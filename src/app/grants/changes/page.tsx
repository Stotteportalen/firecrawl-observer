'use client'

import Link from 'next/link'
import { Layout, MainContent } from '@/components/layout/layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { useAllGrantChanges } from '@/hooks/use-data'

const CHANGE_TYPE_COLORS: Record<string, string> = {
  content_updated: 'bg-blue-100 text-blue-800',
  deadline_changed: 'bg-orange-100 text-orange-800',
  status_changed: 'bg-purple-100 text-purple-800',
  new_grant: 'bg-green-100 text-green-800',
  grant_removed: 'bg-red-100 text-red-800',
}

export default function ChangeFeedPage() {
  const { data: session } = useSession()
  const { data: changes, isLoading } = useAllGrantChanges()

  if (!session) {
    return (
      <Layout>
        <Header />
        <MainContent maxWidth="7xl">
          <div className="py-16 text-center text-zinc-500">Sign in to view changes.</div>
        </MainContent>
      </Layout>
    )
  }

  return (
    <Layout>
      <Header />
      <MainContent maxWidth="7xl">
        <div className="py-8 space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/grants">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Change Feed</h1>
              <p className="text-sm text-zinc-500 mt-1">Recent changes detected across all grants</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : !changes || changes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-zinc-500">
                No changes detected yet. Changes will appear here when monitored grants are updated.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {changes.map(event => (
                <Link key={event.id} href={`/grants/schemes/${event.grantScheme.id}`}>
                  <Card className="hover:border-zinc-300 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={CHANGE_TYPE_COLORS[event.changeType] || 'bg-gray-100 text-gray-800'}>
                              {event.changeType.replace(/_/g, ' ')}
                            </Badge>
                            <span className="font-semibold text-zinc-900 truncate">{event.grantScheme.name}</span>
                          </div>
                          <p className="text-sm text-zinc-600 line-clamp-2">{event.summary}</p>
                          <div className="text-xs text-zinc-400 mt-1">{event.grantScheme.providerName}</div>
                        </div>
                        <div className="text-xs text-zinc-400 shrink-0">
                          {new Date(event.detectedAt).toLocaleString('nb-NO')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </MainContent>
    </Layout>
  )
}
