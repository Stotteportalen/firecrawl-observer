'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Layout, MainContent } from '@/components/layout/layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Loader2, ArrowLeft, Search, CheckCircle2, XCircle, ExternalLink, Sparkles, X, Plus, Ban, Brain, Zap, ThumbsDown } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import {
  useGrantProvider,
  useDiscoveredPages,
  useTriggerDiscovery,
  useReviewPages,
  useAddIgnorePattern,
  useRemoveIgnorePattern,
  useClassifySinglePage,
  useAddDiscoveredPage,
  useTriageProvider,
  type TriageRecommendation,
} from '@/hooks/use-data'
import { useToast } from '@/hooks/use-toast'
import { mutate } from 'swr'

const CLASSIFICATION_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  classified: 'bg-blue-100 text-blue-800',
  confirmed_grant: 'bg-green-100 text-green-800',
  confirmed_not_grant: 'bg-gray-100 text-gray-600',
}

function suggestPattern(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      return `/${segments[0]}/*`
    }
  } catch {
    // ignore
  }
  return '/*'
}

function RelevanceScore({ score }: { score?: number }) {
  if (score === null || score === undefined) return null
  const color = score >= 60 ? 'text-green-600' : score <= 30 ? 'text-red-500' : 'text-zinc-400'
  return <span className={`text-xs font-medium ${color}`}>R:{score}</span>
}

export default function ProviderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const { data: provider, isLoading: providerLoading } = useGrantProvider(id)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data: pages, isLoading: pagesLoading } = useDiscoveredPages(id, statusFilter || undefined)
  const { trigger: triggerDiscovery, isMutating: discovering } = useTriggerDiscovery(id)
  const { trigger: reviewPages, isMutating: reviewing } = useReviewPages(id)
  const { trigger: addIgnorePattern } = useAddIgnorePattern(id)
  const { trigger: removeIgnorePattern } = useRemoveIgnorePattern(id)
  const { trigger: classifySinglePage } = useClassifySinglePage(id)
  const { trigger: addDiscoveredPage } = useAddDiscoveredPage(id)
  const { addToast } = useToast()

  const { trigger: triageTrigger, isMutating: triaging } = useTriageProvider(id)
  const [triageModel, setTriageModel] = useState<string>('claude-sonnet-4')
  const [triageResults, setTriageResults] = useState<TriageRecommendation[] | null>(null)
  const [triageApplied, setTriageApplied] = useState<Set<string>>(new Set())
  const [triageDismissed, setTriageDismissed] = useState<Set<string>>(new Set())
  const [applyingPattern, setApplyingPattern] = useState<string | null>(null)

  const [newPattern, setNewPattern] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [classifyingPageId, setClassifyingPageId] = useState<string | null>(null)

  if (!session) {
    return (
      <Layout>
        <Header />
        <MainContent maxWidth="7xl">
          <div className="py-16 text-center text-zinc-500">Sign in to view provider details.</div>
        </MainContent>
      </Layout>
    )
  }

  if (providerLoading) {
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

  if (!provider) {
    return (
      <Layout>
        <Header />
        <MainContent maxWidth="7xl">
          <div className="py-16 text-center text-zinc-500">Provider not found.</div>
        </MainContent>
      </Layout>
    )
  }

  const handleDiscover = async () => {
    try {
      await triggerDiscovery({})
      addToast({ title: 'Discovery started. This may take a few minutes.' })
      setTimeout(() => mutate(`/api/data/grants/providers/${id}`), 5000)
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  const handleClassify = async () => {
    try {
      await triggerDiscovery({ action: 'classify', batchSize: 20 })
      addToast({ title: 'Classification batch started' })
      setTimeout(() => mutate(`/api/data/grants/providers/${id}/pages`), 3000)
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  const handleReview = async (pageId: string, decision: 'grant' | 'not_grant') => {
    try {
      await reviewPages({ pageId, decision })
      addToast({ title: decision === 'grant' ? 'Confirmed as grant' : 'Marked as not a grant' })
      mutate(`/api/data/grants/providers/${id}/pages`)
      mutate(`/api/data/grants/providers/${id}`)
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  const handleBulkConfirm = async (minScore: number) => {
    if (!pages) return
    const toConfirm = pages.filter(p =>
      p.classificationStatus === 'classified' &&
      p.isGrantPage &&
      (p.classificationScore || 0) >= minScore
    )
    if (toConfirm.length === 0) {
      addToast({ title: 'No pages match the criteria' })
      return
    }
    try {
      await reviewPages({
        reviews: toConfirm.map(p => ({ pageId: p.id, decision: 'grant' as const }))
      })
      addToast({ title: `Confirmed ${toConfirm.length} pages as grants` })
      mutate(`/api/data/grants/providers/${id}/pages`)
      mutate(`/api/data/grants/providers/${id}`)
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  const handleAddPattern = async () => {
    const pattern = newPattern.trim()
    if (!pattern) return
    try {
      const result = await addIgnorePattern({ pattern }) as { added: boolean; retroactivelyIgnored: number }
      if (result.added) {
        addToast({ title: `Pattern added. ${result.retroactivelyIgnored} pages retroactively ignored.` })
        setNewPattern('')
        mutate(`/api/data/grants/providers/${id}`)
        mutate(`/api/data/grants/providers/${id}/pages`)
      } else {
        addToast({ title: 'Pattern already exists' })
      }
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  const handleRemovePattern = async (pattern: string) => {
    try {
      await removeIgnorePattern({ pattern })
      addToast({ title: 'Pattern removed' })
      mutate(`/api/data/grants/providers/${id}`)
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  const handleIgnoreLikeThis = async (url: string) => {
    const pattern = suggestPattern(url)
    try {
      const result = await addIgnorePattern({ pattern }) as { added: boolean; retroactivelyIgnored: number }
      if (result.added) {
        addToast({ title: `Pattern "${pattern}" added. ${result.retroactivelyIgnored} pages retroactively ignored.` })
        mutate(`/api/data/grants/providers/${id}`)
        mutate(`/api/data/grants/providers/${id}/pages`)
      } else {
        addToast({ title: 'Pattern already exists' })
      }
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  const handleClassifySingle = async (pageId: string) => {
    setClassifyingPageId(pageId)
    try {
      await classifySinglePage({ pageId })
      addToast({ title: 'Page classified' })
      mutate(`/api/data/grants/providers/${id}/pages`)
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    } finally {
      setClassifyingPageId(null)
    }
  }

  const handleAddUrl = async () => {
    const url = newUrl.trim()
    if (!url) return
    try {
      await addDiscoveredPage({ url })
      addToast({ title: 'URL added' })
      setNewUrl('')
      mutate(`/api/data/grants/providers/${id}/pages`)
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  const handleRunTriage = async () => {
    try {
      setTriageResults(null)
      setTriageApplied(new Set())
      setTriageDismissed(new Set())
      const result = await triageTrigger({ action: 'analyze', model: triageModel }) as { recommendations: TriageRecommendation[] }
      setTriageResults(result.recommendations)
      if (result.recommendations.length === 0) {
        addToast({ title: 'No URL patterns to triage' })
      }
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  const handleTriageAcceptGrants = async (rec: TriageRecommendation) => {
    setApplyingPattern(rec.pattern)
    try {
      const result = await triageTrigger({ action: 'apply_grants', pageIds: rec.pageIds }) as unknown as { results: Array<{ success: boolean }> }
      const successCount = result.results.filter(r => r.success).length
      addToast({ title: `${successCount} pages confirmed as grants` })
      setTriageApplied(prev => new Set(prev).add(rec.pattern))
      mutate(`/api/data/grants/providers/${id}/pages`)
      mutate(`/api/data/grants/providers/${id}`)
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    } finally {
      setApplyingPattern(null)
    }
  }

  const handleTriageIgnorePattern = async (rec: TriageRecommendation) => {
    setApplyingPattern(rec.pattern)
    try {
      const result = await triageTrigger({ action: 'apply_ignore', pattern: rec.pattern }) as unknown as { added: boolean; retroactivelyIgnored: number }
      if (result.added) {
        addToast({ title: `Pattern "${rec.pattern}" added. ${result.retroactivelyIgnored} pages ignored.` })
        setTriageApplied(prev => new Set(prev).add(rec.pattern))
        mutate(`/api/data/grants/providers/${id}`)
        mutate(`/api/data/grants/providers/${id}/pages`)
      } else {
        addToast({ title: 'Pattern already exists' })
      }
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    } finally {
      setApplyingPattern(null)
    }
  }

  const handleTriageDismiss = (pattern: string) => {
    setTriageDismissed(prev => new Set(prev).add(pattern))
  }

  // When viewing "All", hide confirmed_not_grant (auto-ignored) pages
  const filteredPages = !statusFilter
    ? pages?.filter(p => p.classificationStatus !== 'confirmed_not_grant')
    : pages

  const pendingCount = pages?.filter(p => p.classificationStatus === 'pending').length || 0
  const classifiedCount = pages?.filter(p => p.classificationStatus === 'classified').length || 0
  const confirmedCount = pages?.filter(p => p.classificationStatus === 'confirmed_grant').length || 0
  const ignoredCount = pages?.filter(p => p.classificationStatus === 'confirmed_not_grant').length || 0

  return (
    <Layout>
      <Header />
      <MainContent maxWidth="7xl">
        <div className="py-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/grants/providers">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-zinc-900">{provider.name}</h1>
                  <Badge className={CLASSIFICATION_COLORS[provider.status] || 'bg-gray-100 text-gray-800'}>
                    {provider.status}
                  </Badge>
                </div>
                <p className="text-sm text-zinc-500 mt-1">{provider.domain} &middot; Discovery limit: {provider.discoveryLimit || 5000}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDiscover} disabled={discovering}>
                {discovering ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Discover Pages
              </Button>
              {pendingCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleClassify} disabled={reviewing}>
                  Classify ({pendingCount})
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{pages?.length || 0}</div>
                <div className="text-xs text-zinc-500">Pages Found</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{classifiedCount}</div>
                <div className="text-xs text-zinc-500">Classified</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
                <div className="text-xs text-zinc-500">Confirmed Grants</div>
              </CardContent>
            </Card>
          </div>

          {/* Ignore Patterns */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-700">Ignore Patterns</span>
              </div>
              {provider.ignorePatterns && provider.ignorePatterns.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {provider.ignorePatterns.map(pattern => (
                    <Badge key={pattern} variant="secondary" className="gap-1 pr-1">
                      {pattern}
                      <button
                        onClick={() => handleRemovePattern(pattern)}
                        className="ml-1 hover:text-red-600 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="/artikkel/*"
                  value={newPattern}
                  onChange={e => setNewPattern(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddPattern()}
                  className="max-w-xs text-sm"
                />
                <Button variant="outline" size="sm" onClick={handleAddPattern}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Pattern
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI URL Pattern Triage */}
          {pendingCount > 0 && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-zinc-700">AI URL Pattern Triage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={triageModel}
                      onChange={e => setTriageModel(e.target.value)}
                      className="w-48 h-8 text-xs"
                    >
                      <option value="claude-sonnet-4">Claude Sonnet 4</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRunTriage}
                      disabled={triaging}
                      className="gap-1"
                    >
                      {triaging ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3" />
                      )}
                      {triaging ? 'Analyzing...' : 'Run Triage'}
                    </Button>
                  </div>
                </div>

                {triageResults && triageResults.length > 0 && (
                  <div className="space-y-4">
                    {/* Grant subpages */}
                    {triageResults.filter(r => r.category === 'grant').length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-xs font-medium text-green-700 uppercase tracking-wide">These are grant subpages</span>
                        </div>
                        <div className="space-y-2">
                          {triageResults
                            .filter(r => r.category === 'grant')
                            .map(rec => {
                              const applied = triageApplied.has(rec.pattern)
                              const dismissed = triageDismissed.has(rec.pattern)
                              return (
                                <div
                                  key={rec.pattern}
                                  className={`border rounded-lg p-3 ${applied ? 'bg-green-50 border-green-200' : dismissed ? 'opacity-40' : 'border-zinc-200'}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-mono font-medium">{rec.pattern}</span>
                                      <Badge variant="secondary" className="text-xs">{rec.count} pages</Badge>
                                      <span className="text-xs text-zinc-400">{rec.confidence}% confidence</span>
                                    </div>
                                    {!applied && !dismissed && (
                                      <div className="flex gap-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleTriageAcceptGrants(rec)}
                                          disabled={applyingPattern === rec.pattern}
                                          className="gap-1 text-green-600 hover:text-green-700 hover:border-green-300 text-xs"
                                        >
                                          {applyingPattern === rec.pattern ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                          Accept as Grants
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleTriageDismiss(rec.pattern)}
                                          className="text-xs text-zinc-500"
                                        >
                                          Dismiss
                                        </Button>
                                      </div>
                                    )}
                                    {applied && <Badge className="bg-green-100 text-green-700">Applied</Badge>}
                                  </div>
                                  <p className="text-xs text-zinc-500 mb-1">{rec.reasoning}</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {rec.examples.map(ex => (
                                      <span key={ex} className="text-xs text-zinc-400 font-mono">{new URL(ex).pathname}</span>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}

                    {/* Not grant subpages */}
                    {triageResults.filter(r => r.category === 'not_grant').length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                          <span className="text-xs font-medium text-red-600 uppercase tracking-wide">These are definitely not grant subpages</span>
                        </div>
                        <div className="space-y-2">
                          {triageResults
                            .filter(r => r.category === 'not_grant')
                            .map(rec => {
                              const applied = triageApplied.has(rec.pattern)
                              const dismissed = triageDismissed.has(rec.pattern)
                              return (
                                <div
                                  key={rec.pattern}
                                  className={`border rounded-lg p-3 ${applied ? 'bg-gray-50 border-gray-300' : dismissed ? 'opacity-40' : 'border-zinc-200'}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-mono font-medium">{rec.pattern}</span>
                                      <Badge variant="secondary" className="text-xs">{rec.count} pages</Badge>
                                      <span className="text-xs text-zinc-400">{rec.confidence}% confidence</span>
                                    </div>
                                    {!applied && !dismissed && (
                                      <div className="flex gap-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleTriageIgnorePattern(rec)}
                                          disabled={applyingPattern === rec.pattern}
                                          className="gap-1 text-red-600 hover:text-red-700 hover:border-red-300 text-xs"
                                        >
                                          {applyingPattern === rec.pattern ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                                          Ignore Pattern
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleTriageDismiss(rec.pattern)}
                                          className="text-xs text-zinc-500"
                                        >
                                          Dismiss
                                        </Button>
                                      </div>
                                    )}
                                    {applied && <Badge className="bg-gray-100 text-gray-600">Ignored</Badge>}
                                  </div>
                                  <p className="text-xs text-zinc-500 mb-1">{rec.reasoning}</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {rec.examples.map(ex => (
                                      <span key={ex} className="text-xs text-zinc-400 font-mono">{new URL(ex).pathname}</span>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}

                    {/* Uncertain */}
                    {triageResults.filter(r => r.category === 'uncertain').length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Search className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">I&apos;m uncertain about these</span>
                        </div>
                        <div className="space-y-2">
                          {triageResults
                            .filter(r => r.category === 'uncertain')
                            .map(rec => {
                              const dismissed = triageDismissed.has(rec.pattern)
                              return (
                                <div
                                  key={rec.pattern}
                                  className={`border rounded-lg p-3 ${dismissed ? 'opacity-40' : 'border-amber-200 bg-amber-50/50'}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-mono font-medium">{rec.pattern}</span>
                                      <Badge variant="secondary" className="text-xs">{rec.count} pages</Badge>
                                      <span className="text-xs text-zinc-400">{rec.confidence}% confidence</span>
                                    </div>
                                    {!dismissed && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleTriageDismiss(rec.pattern)}
                                        className="text-xs text-zinc-500"
                                      >
                                        Dismiss
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-500 mb-1">{rec.reasoning}</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {rec.examples.map(ex => (
                                      <span key={ex} className="text-xs text-zinc-400 font-mono">{new URL(ex).pathname}</span>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {triageResults && triageResults.length === 0 && (
                  <p className="text-xs text-zinc-500">No URL patterns to triage. All pending pages may already match ignore patterns.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bulk Actions */}
          {classifiedCount > 0 && (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-zinc-500">Bulk actions:</span>
              <Button variant="outline" size="sm" onClick={() => handleBulkConfirm(90)}>
                Confirm all &gt;90% confidence
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkConfirm(70)}>
                Confirm all &gt;70%
              </Button>
            </div>
          )}

          {/* Manual URL input + Filter tabs */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/grant-page"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
                className="w-72 text-sm"
              />
              <Button variant="outline" size="sm" onClick={handleAddUrl}>
                <Plus className="h-3 w-3 mr-1" />
                Add URL
              </Button>
            </div>
            <div className="flex gap-2">
              {['', 'pending', 'classified', 'confirmed_grant', 'confirmed_not_grant'].map(s => (
                <Button
                  key={s}
                  variant={statusFilter === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                >
                  {s === '' ? 'All' : s === 'confirmed_not_grant' ? `Ignored (${ignoredCount})` : s}
                </Button>
              ))}
            </div>
          </div>

          {/* Pages Table */}
          {pagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : !filteredPages || filteredPages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-zinc-500">
                {pages && pages.length > 0
                  ? 'All pages are filtered out. Try a different filter or check the Ignored tab.'
                  : 'No pages discovered yet. Click \u201cDiscover Pages\u201d to start.'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredPages.map(page => (
                <Card key={page.id} className="hover:border-zinc-300 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-zinc-900 truncate">
                            {page.title || page.url}
                          </span>
                          <Badge className={CLASSIFICATION_COLORS[page.classificationStatus] || ''}>
                            {page.classificationStatus}
                          </Badge>
                          {page.classificationScore !== null && page.classificationScore !== undefined && (
                            <span className="text-xs text-zinc-400">{page.classificationScore}%</span>
                          )}
                          {page.classificationStatus === 'pending' && (
                            <RelevanceScore score={page.urlRelevanceScore} />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-400 hover:text-zinc-600 truncate flex items-center gap-1"
                            onClick={e => e.stopPropagation()}
                          >
                            {page.url}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </div>
                        {page.classificationReason && (
                          <p className="text-xs text-zinc-500 mt-1">{page.classificationReason}</p>
                        )}
                        {page.grantScheme && (
                          <Link
                            href={`/grants/schemes/${page.grantScheme.id}`}
                            className="text-xs text-orange-600 hover:underline mt-1 inline-block"
                          >
                            Grant: {page.grantScheme.name}
                          </Link>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {/* Actions for pending pages: classify, confirm, reject, ignore */}
                        {page.classificationStatus === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleClassifySingle(page.id)}
                              disabled={classifyingPageId === page.id}
                              className="gap-1 text-purple-600 hover:text-purple-700 hover:border-purple-300"
                            >
                              {classifyingPageId === page.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              Classify
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReview(page.id, 'grant')}
                              disabled={reviewing}
                              className="gap-1 text-green-600 hover:text-green-700 hover:border-green-300"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Grant
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReview(page.id, 'not_grant')}
                              disabled={reviewing}
                              className="gap-1 text-red-600 hover:text-red-700 hover:border-red-300"
                            >
                              <XCircle className="h-3 w-3" />
                              Not Grant
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleIgnoreLikeThis(page.url)}
                              className="gap-1 text-zinc-500 hover:text-zinc-700"
                              title={`Ignore ${suggestPattern(page.url)}`}
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {/* Review buttons for classified pages */}
                        {page.classificationStatus === 'classified' && !page.humanVerified && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReview(page.id, 'grant')}
                              disabled={reviewing}
                              className="gap-1 text-green-600 hover:text-green-700 hover:border-green-300"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Grant
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReview(page.id, 'not_grant')}
                              disabled={reviewing}
                              className="gap-1 text-red-600 hover:text-red-700 hover:border-red-300"
                            >
                              <XCircle className="h-3 w-3" />
                              Not Grant
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleIgnoreLikeThis(page.url)}
                              className="gap-1 text-zinc-500 hover:text-zinc-700"
                              title={`Ignore ${suggestPattern(page.url)}`}
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </MainContent>
    </Layout>
  )
}
