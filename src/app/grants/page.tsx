'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Layout, MainContent } from '@/components/layout/layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Loader2, Search, ExternalLink, Calendar, Building2, FileText, ArrowUpDown } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { useGrantSchemes, useGrantProviders } from '@/hooks/use-data'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  closed: 'bg-red-100 text-red-800',
  upcoming: 'bg-blue-100 text-blue-800',
  unknown: 'bg-gray-100 text-gray-800',
}

const FUNDING_TYPE_LABELS: Record<string, string> = {
  grant: 'Tilskudd',
  loan: 'Lån',
  guarantee: 'Garanti',
}

export default function GrantsDashboard() {
  const { data: session } = useSession()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [fundingTypeFilter, setFundingTypeFilter] = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [sortBy, setSortBy] = useState('updatedAt')

  const filters: Record<string, string> = {}
  if (statusFilter) filters.status = statusFilter
  if (fundingTypeFilter) filters.fundingType = fundingTypeFilter
  if (providerFilter) filters.provider = providerFilter
  if (search) filters.search = search
  if (sortBy) filters.sortBy = sortBy

  const { data: schemes, isLoading } = useGrantSchemes(filters)
  const { data: providers } = useGrantProviders()

  if (!session) {
    return (
      <Layout>
        <Header />
        <MainContent maxWidth="7xl">
          <div className="py-16 text-center text-zinc-500">Sign in to view grants.</div>
        </MainContent>
      </Layout>
    )
  }

  const activeCount = schemes?.filter(s => s.status === 'active').length || 0
  const totalCount = schemes?.length || 0
  const upcomingDeadlines = schemes?.filter(s => s.applicationDeadline && new Date(s.applicationDeadline) > new Date()).length || 0

  return (
    <Layout>
      <Header />
      <MainContent maxWidth="7xl">
        <div className="py-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Grant Schemes</h1>
              <p className="text-sm text-zinc-500 mt-1">Discover and monitor Norwegian grant schemes</p>
            </div>
            <div className="flex gap-2">
              <Link href="/grants/providers">
                <Button variant="outline" size="sm" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Providers
                </Button>
              </Link>
              <Link href="/grants/changes">
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Changes
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{providers?.length || 0}</div>
                <div className="text-xs text-zinc-500">Providers</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{totalCount}</div>
                <div className="text-xs text-zinc-500">Total Grants</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{activeCount}</div>
                <div className="text-xs text-zinc-500">Active</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{upcomingDeadlines}</div>
                <div className="text-xs text-zinc-500">Upcoming Deadlines</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search grants..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="upcoming">Upcoming</option>
              <option value="unknown">Unknown</option>
            </Select>
            <Select value={fundingTypeFilter} onChange={e => setFundingTypeFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="grant">Tilskudd / Grant</option>
              <option value="loan">Lån / Loan</option>
              <option value="guarantee">Garanti / Guarantee</option>
            </Select>
            {providers && providers.length > 0 && (
              <Select value={providerFilter} onChange={e => setProviderFilter(e.target.value)}>
                <option value="">All providers</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setSortBy(sortBy === 'deadline' ? 'updatedAt' : 'deadline')}
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortBy === 'deadline' ? 'By Deadline' : 'By Updated'}
            </Button>
          </div>

          {/* Grant List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : !schemes || schemes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-zinc-500">
                <p>No grants found.</p>
                <p className="text-sm mt-2">
                  <Link href="/grants/providers" className="text-orange-600 hover:underline">
                    Add a provider
                  </Link>
                  {' '}to start discovering grants.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {schemes.map(scheme => (
                <Link key={scheme.id} href={`/grants/schemes/${scheme.id}`}>
                  <Card className="hover:border-zinc-300 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-zinc-900 truncate">{scheme.name}</h3>
                            <Badge className={STATUS_COLORS[scheme.status] || STATUS_COLORS.unknown}>
                              {scheme.status}
                            </Badge>
                            {scheme.fundingType && (
                              <Badge variant="outline" className="text-xs">
                                {FUNDING_TYPE_LABELS[scheme.fundingType] || scheme.fundingType}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-zinc-500 mb-1">{scheme.providerName}</div>
                          {scheme.summary && (
                            <p className="text-sm text-zinc-600 line-clamp-2">{scheme.summary}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-xs text-zinc-400 shrink-0">
                          {scheme.applicationDeadline ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(scheme.applicationDeadline).toLocaleDateString('nb-NO')}
                            </div>
                          ) : scheme.isRollingDeadline ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Løpende
                            </div>
                          ) : null}
                          <ExternalLink className="h-3 w-3" />
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
