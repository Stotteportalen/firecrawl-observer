'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Layout, MainContent } from '@/components/layout/layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, ExternalLink, RefreshCw, Copy, Calendar, Building2, Clock, TrendingUp, Tag } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { useGrantScheme, useTriggerExtraction } from '@/hooks/use-data'
import { useToast } from '@/hooks/use-toast'
import { mutate } from 'swr'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  closed: 'bg-red-100 text-red-800',
  upcoming: 'bg-blue-100 text-blue-800',
  unknown: 'bg-gray-100 text-gray-800',
}

const CHANGE_TYPE_COLORS: Record<string, string> = {
  content_updated: 'bg-blue-100 text-blue-800',
  deadline_changed: 'bg-orange-100 text-orange-800',
  status_changed: 'bg-purple-100 text-purple-800',
  new_grant: 'bg-green-100 text-green-800',
  grant_removed: 'bg-red-100 text-red-800',
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-zinc-400 uppercase">{label}</div>
      <div className="text-sm font-medium mt-0.5">{children}</div>
    </div>
  )
}

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') {
    const d = Date.parse(value)
    if (!isNaN(d) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(value).toLocaleString('nb-NO')
    }
    return value
  }
  if (typeof value === 'number') return value.toLocaleString()
  return JSON.stringify(value)
}

function scoreColor(score?: number | null): string {
  if (score == null) return 'text-zinc-400'
  if (score >= 0.8) return 'text-green-600'
  if (score >= 0.5) return 'text-yellow-600'
  return 'text-red-500'
}

export default function GrantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const { data: scheme, isLoading } = useGrantScheme(id)
  const { trigger: triggerExtraction, isMutating: extracting } = useTriggerExtraction(id)
  const { addToast } = useToast()
  const [showAllContent, setShowAllContent] = useState(false)

  if (!session) {
    return (
      <Layout>
        <Header />
        <MainContent maxWidth="7xl">
          <div className="py-16 text-center text-zinc-500">Sign in to view grant details.</div>
        </MainContent>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <Header />
        <MainContent maxWidth="7xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        </MainContent>
      </Layout>
    )
  }

  if (!scheme) {
    return (
      <Layout>
        <Header />
        <MainContent maxWidth="7xl">
          <div className="py-16 text-center text-zinc-500">Grant not found.</div>
        </MainContent>
      </Layout>
    )
  }

  const handleExtract = async () => {
    try {
      await triggerExtraction({})
      addToast({ title: 'Extraction complete' })
      mutate(`/api/data/grants/schemes/${id}`)
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(scheme.sourceUrl)
      addToast({ title: 'URL copied to clipboard' })
    } catch {
      addToast({ title: 'Failed to copy URL', variant: 'error' })
    }
  }

  const deadlineText = scheme.applicationDeadline
    ? new Date(scheme.applicationDeadline).toLocaleDateString('nb-NO')
    : scheme.isRollingDeadline
      ? 'Rolling'
      : 'Not specified'

  const extractedEntries = scheme.extractedJson
    ? Object.entries(scheme.extractedJson).filter(
        ([key]) => key !== 'ragContent' && key !== 'summary'
      )
    : []

  return (
    <Layout>
      <Header />
      <MainContent maxWidth="7xl">
        <div className="py-8 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/grants">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-zinc-900">{scheme.name}</h1>
                  <Badge className={STATUS_COLORS[scheme.status] || STATUS_COLORS.unknown}>
                    {scheme.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Building2 className="h-3 w-3 text-zinc-400" />
                  <span className="text-sm text-zinc-500">{scheme.providerName}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={scheme.sourceUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-4 w-4" />
                  Source
                </Button>
              </a>
              <Button variant="outline" size="sm" onClick={handleExtract} disabled={extracting} className="gap-1">
                {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Re-extract
              </Button>
            </div>
          </div>

          {/* Source URL */}
          <div className="flex items-center gap-2 text-sm">
            <a
              href={scheme.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-700 truncate max-w-[600px]"
              title={scheme.sourceUrl}
            >
              {scheme.sourceUrl}
            </a>
            <button
              onClick={handleCopyUrl}
              className="shrink-0 p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"
              title="Copy URL"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Metadata Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <MetaItem label="Status">
                  <Badge className={STATUS_COLORS[scheme.status] || STATUS_COLORS.unknown}>
                    {scheme.status}
                  </Badge>
                </MetaItem>
                <MetaItem label="Deadline">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-zinc-400" />
                    {deadlineText}
                  </span>
                </MetaItem>
                <MetaItem label="Funding Type">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3 text-zinc-400" />
                    {scheme.fundingType || 'Not specified'}
                  </span>
                </MetaItem>
                <MetaItem label="Provider">
                  <Link href={`/grants/providers/${scheme.providerId}`} className="text-orange-600 hover:underline">
                    {scheme.providerName}
                  </Link>
                </MetaItem>
                <MetaItem label="Changes">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-zinc-400" />
                    {scheme.changeCount}
                  </span>
                </MetaItem>
                <MetaItem label="Last Change">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-zinc-400" />
                    {scheme.lastChangeAt
                      ? new Date(scheme.lastChangeAt).toLocaleDateString('nb-NO')
                      : 'Never'}
                  </span>
                </MetaItem>
              </div>
            </CardContent>
          </Card>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Summary */}
              {scheme.summary && (
                <CollapsibleCard title="Summary" defaultOpen>
                  <p className="text-sm text-zinc-700">{scheme.summary}</p>
                </CollapsibleCard>
              )}

              {/* RAG Content */}
              {scheme.ragContent && (
                <CollapsibleCard title="RAG Content" defaultOpen badge={
                  <Badge variant="secondary" className="text-xs font-normal">
                    {scheme.ragContent.length.toLocaleString()} chars
                  </Badge>
                }>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap">{scheme.ragContent}</p>
                </CollapsibleCard>
              )}

              {/* Full Content */}
              {scheme.fullMarkdown && (
                <CollapsibleCard
                  title="Full Content"
                  badge={
                    <Badge variant="secondary" className="text-xs font-normal">
                      {scheme.fullMarkdown.length.toLocaleString()} chars
                    </Badge>
                  }
                >
                  <div
                    className={
                      showAllContent
                        ? 'prose prose-sm max-w-none text-zinc-700 whitespace-pre-wrap'
                        : 'prose prose-sm max-w-none text-zinc-700 whitespace-pre-wrap max-h-[600px] overflow-y-auto'
                    }
                  >
                    {scheme.fullMarkdown}
                  </div>
                  {!showAllContent && scheme.fullMarkdown.length > 2000 && (
                    <button
                      onClick={() => setShowAllContent(true)}
                      className="mt-2 text-xs text-orange-600 hover:underline"
                    >
                      Show all
                    </button>
                  )}
                </CollapsibleCard>
              )}

              {/* Change History */}
              {scheme.changeEvents && scheme.changeEvents.length > 0 && (
                <CollapsibleCard
                  title="Change History"
                  defaultOpen
                  badge={
                    <Badge variant="secondary" className="text-xs font-normal">
                      {scheme.changeEvents.length}
                    </Badge>
                  }
                >
                  <div className="space-y-2">
                    {scheme.changeEvents.map(event => (
                      <div key={event.id} className="flex items-start gap-3 py-2 border-b border-zinc-100 last:border-0">
                        <Badge className={CHANGE_TYPE_COLORS[event.changeType] || 'bg-gray-100 text-gray-800'}>
                          {event.changeType.replace(/_/g, ' ')}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm text-zinc-700">{event.summary}</p>
                          <p className="text-xs text-zinc-400 mt-1">
                            {new Date(event.detectedAt).toLocaleString('nb-NO')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleCard>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Discovered Pages */}
              {scheme.discoveredPages && scheme.discoveredPages.length > 0 && (
                <CollapsibleCard
                  title="Discovered Pages"
                  defaultOpen
                  badge={
                    <Badge variant="secondary" className="text-xs font-normal">
                      {scheme.discoveredPages.length}
                    </Badge>
                  }
                >
                  <div className="space-y-2">
                    {scheme.discoveredPages.map(page => {
                      let label: string
                      try {
                        label = page.title || new URL(page.url).pathname
                      } catch {
                        label = page.url
                      }
                      return (
                        <div key={page.id} className="flex items-center justify-between gap-2 text-sm">
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-700 hover:text-zinc-900 truncate"
                            title={page.url}
                          >
                            {label}
                          </a>
                          {page.classificationScore != null && (
                            <span className={`text-xs font-mono shrink-0 ${scoreColor(page.classificationScore)}`}>
                              {(page.classificationScore * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CollapsibleCard>
              )}

              {/* Extracted Data */}
              {extractedEntries.length > 0 && (
                <CollapsibleCard
                  title="Extracted Data"
                  badge={
                    <Badge variant="secondary" className="text-xs font-normal">
                      {extractedEntries.length} fields
                    </Badge>
                  }
                >
                  <div className="space-y-2">
                    {extractedEntries.map(([key, value]) => (
                      <div key={key}>
                        <div className="text-xs text-zinc-400">{formatFieldName(key)}</div>
                        <div className="text-sm text-zinc-700 break-words">
                          {formatFieldValue(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleCard>
              )}

              {/* Timestamps */}
              <CollapsibleCard title="Timestamps">
                <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-xs text-zinc-400">Last Change</div>
                    <div className="text-zinc-600">
                      {scheme.lastChangeAt ? new Date(scheme.lastChangeAt).toLocaleString('nb-NO') : 'Never'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Last Extracted</div>
                    <div className="text-zinc-600">
                      {scheme.lastExtractedAt ? new Date(scheme.lastExtractedAt).toLocaleString('nb-NO') : 'Never'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Last Scraped</div>
                    <div className="text-zinc-600">
                      {scheme.lastScrapedAt ? new Date(scheme.lastScrapedAt).toLocaleString('nb-NO') : 'Never'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Created</div>
                    <div className="text-zinc-600">
                      {new Date(scheme.createdAt).toLocaleString('nb-NO')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Updated</div>
                    <div className="text-zinc-600">
                      {new Date(scheme.updatedAt).toLocaleString('nb-NO')}
                    </div>
                  </div>
                </div>
              </CollapsibleCard>

              {/* Archive card */}
              {scheme.isArchived && (
                <Card className="border-red-200">
                  <CardContent className="p-4">
                    <Badge className="bg-red-100 text-red-800">Archived</Badge>
                    {scheme.archivedReason && (
                      <p className="text-sm text-zinc-500 mt-2">{scheme.archivedReason}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </MainContent>
    </Layout>
  )
}
