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
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Globe, X, ArrowLeft } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { useGrantProviders, useCreateGrantProvider } from '@/hooks/use-data'
import { useToast } from '@/hooks/use-toast'
import { mutate } from 'swr'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  discovering: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-gray-100 text-gray-800',
  error: 'bg-red-100 text-red-800',
}

export default function ProvidersPage() {
  const { data: session } = useSession()
  const { data: providers, isLoading } = useGrantProviders()
  const { trigger: createProvider, isMutating } = useCreateGrantProvider()
  const { addToast } = useToast()

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    websiteUrl: '',
    knownListingUrls: '',
    checkFrequency: 'weekly',
    notes: '',
  })

  if (!session) {
    return (
      <Layout>
        <Header />
        <MainContent maxWidth="7xl">
          <div className="py-16 text-center text-zinc-500">Sign in to manage providers.</div>
        </MainContent>
      </Layout>
    )
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.domain) {
      addToast({ title: 'Name and domain are required', variant: 'error' })
      return
    }

    try {
      await createProvider({
        name: formData.name,
        domain: formData.domain,
        websiteUrl: formData.websiteUrl || `https://${formData.domain}`,
        knownListingUrls: formData.knownListingUrls
          ? formData.knownListingUrls.split('\n').map(u => u.trim()).filter(Boolean)
          : [],
        checkFrequency: formData.checkFrequency,
        notes: formData.notes || undefined,
      })
      addToast({ title: 'Provider created' })
      setShowForm(false)
      setFormData({ name: '', domain: '', websiteUrl: '', knownListingUrls: '', checkFrequency: 'weekly', notes: '' })
      mutate('/api/data/grants/providers')
    } catch (err) {
      addToast({ title: (err as Error).message, variant: 'error' })
    }
  }

  return (
    <Layout>
      <Header />
      <MainContent maxWidth="7xl">
        <div className="py-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/grants">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">Grant Providers</h1>
                <p className="text-sm text-zinc-500 mt-1">Manage domains to discover grants from</p>
              </div>
            </div>
            <Button size="sm" className="gap-2" onClick={() => setShowForm(!showForm)}>
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? 'Cancel' : 'Add Provider'}
            </Button>
          </div>

          {/* Add Provider Form */}
          {showForm && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      placeholder="e.g. Innovasjon Norge"
                      value={formData.name}
                      onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Domain</Label>
                    <Input
                      placeholder="e.g. innovasjonnorge.no"
                      value={formData.domain}
                      onChange={e => setFormData(d => ({ ...d, domain: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Website URL (optional)</Label>
                    <Input
                      placeholder="https://innovasjonnorge.no"
                      value={formData.websiteUrl}
                      onChange={e => setFormData(d => ({ ...d, websiteUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Check Frequency</Label>
                    <Select
                      value={formData.checkFrequency}
                      onChange={e => setFormData(d => ({ ...d, checkFrequency: e.target.value }))}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Known Listing URLs (one per line, optional)</Label>
                  <textarea
                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm min-h-[80px]"
                    placeholder="https://innovasjonnorge.no/tjenester/"
                    value={formData.knownListingUrls}
                    onChange={e => setFormData(d => ({ ...d, knownListingUrls: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Input
                    placeholder="Any notes about this provider..."
                    value={formData.notes}
                    onChange={e => setFormData(d => ({ ...d, notes: e.target.value }))}
                  />
                </div>
                <Button onClick={handleCreate} disabled={isMutating} className="gap-2">
                  {isMutating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Provider
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Provider List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : !providers || providers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-zinc-500">
                No providers yet. Add one to start discovering grants.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {providers.map(provider => (
                <Link key={provider.id} href={`/grants/providers/${provider.id}`}>
                  <Card className="hover:border-zinc-300 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Globe className="h-5 w-5 text-zinc-400" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-900">{provider.name}</span>
                              <Badge className={STATUS_COLORS[provider.status] || STATUS_COLORS.pending}>
                                {provider.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-zinc-500">{provider.domain}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-zinc-500">
                          <div className="text-center">
                            <div className="font-semibold text-zinc-700">{provider._count?.discoveredPages || provider.totalPagesFound}</div>
                            <div className="text-xs">Pages</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-zinc-700">{provider._count?.grantSchemes || provider.totalGrantsFound}</div>
                            <div className="text-xs">Grants</div>
                          </div>
                          <div className="text-xs text-zinc-400">
                            {provider.lastDiscoveryAt
                              ? `Checked ${new Date(provider.lastDiscoveryAt).toLocaleDateString('nb-NO')}`
                              : 'Not checked yet'}
                          </div>
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
