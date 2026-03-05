'use client'

import { useState, useEffect } from 'react'
import { Layout, MainContent, Footer } from '@/components/layout/layout'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Copy, Check, Code, Globe, Webhook, Clock, Network, BarChart3, Key, Plus, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '@/hooks/use-data'
import { mutate } from 'swr'

export default function ApiDocsPage() {
  const { data: session } = useSession()
  const isAuthenticated = !!session
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  // API Key state
  const [showNewApiKey, setShowNewApiKey] = useState(false)
  const [newApiKeyName, setNewApiKeyName] = useState('')
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null)
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  // API Key queries and mutations
  const { data: apiKeys = [] } = useApiKeys()
  const { trigger: createApiKeyTrigger } = useCreateApiKey()
  const { trigger: deleteApiKeyTrigger } = useDeleteApiKey()

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }
  
  const handleCreateApiKey = async () => {
    if (!newApiKeyName.trim()) return
    
    try {
      const result = await createApiKeyTrigger({ name: newApiKeyName })
      mutate('/api/data/api-keys')
      setCreatedApiKey(result.key)
      setNewApiKeyName('')
      setShowNewApiKey(false)
    } catch (error) {
      console.error('Failed to create API key:', error)
    }
  }
  
  const handleCopyApiKey = (key: string, keyId: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKeyId(keyId)
    setTimeout(() => setCopiedKeyId(null), 2000)
  }
  
  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return
    
    try {
      await deleteApiKeyTrigger({ id: keyId })
      mutate('/api/data/api-keys')
    } catch (error) {
      console.error('Failed to delete API key:', error)
    }
  }

  const [baseUrl, setBaseUrl] = useState('https://your-domain.com')
  const [defaultWebhook, setDefaultWebhook] = useState('https://your-webhook.com/endpoint')
  
  // Set baseUrl and default webhook after component mounts to avoid hydration issues
  useEffect(() => {
    setBaseUrl(window.location.origin)
    setDefaultWebhook(`${window.location.origin}/api/test-webhook`)
  }, [])

  // Get the first API key if available, or show placeholder
  const apiKeyToShow = createdApiKey || 'YOUR_API_KEY'

  const curlExample = `curl -X POST ${baseUrl}/api/websites \\
  -H "Authorization: Bearer ${apiKeyToShow}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://firecrawl.dev",
    "type": "scrape",
    "checkInterval": 0.25,
    "webhook": "${defaultWebhook}",
    "name": "Example Website"
  }'`

  const crawlExample = `curl -X POST ${baseUrl}/api/websites \\
  -H "Authorization: Bearer ${apiKeyToShow}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://firecrawl.dev/blog",
    "type": "crawl",
    "checkInterval": 360,
    "crawlLimit": 10,
    "crawlDepth": 2,
    "webhook": "${defaultWebhook}"
  }'`

  const batchExample = `curl -X POST ${baseUrl}/api/websites \\
  -H "Authorization: Bearer ${apiKeyToShow}" \\
  -H "Content-Type: application/json" \\
  -d '[
    {
      "url": "https://figma.com",
      "type": "scrape",
      "checkInterval": 30,
      "webhook": "${defaultWebhook}",
      "name": "Figma"
    },
    {
      "url": "https://firecrawl.dev",
      "type": "crawl",
      "checkInterval": 60,
      "crawlLimit": 10,
      "crawlDepth": 3,
      "webhook": "${defaultWebhook}",
      "name": "Firecrawl"
    },
    {
      "url": "https://apple.com",
      "type": "scrape",
      "checkInterval": 180,
      "webhook": "${defaultWebhook}",
      "name": "Apple"
    }
  ]'`
  
  const pauseExample = `curl -X POST ${baseUrl}/api/websites/pause \\
  -H "Authorization: Bearer ${apiKeyToShow}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "websiteId": "k57m3...",
    "paused": true
  }'`
  
  const deleteExample = `curl -X DELETE ${baseUrl}/api/websites/delete \\
  -H "Authorization: Bearer ${apiKeyToShow}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "websiteId": "k57m3..."
  }'`

  const batchResponseExample = `{
  "success": true,
  "message": "Batch request processed. 3 websites added successfully.",
  "results": [
    {
      "index": 0,
      "websiteId": "j47n2...",
      "url": "https://figma.com",
      "name": "Figma",
      "type": "single_page",
      "checkInterval": 30,
      "webhook": "${defaultWebhook}"
    },
    {
      "index": 1,
      "websiteId": "k92m4...",
      "url": "https://firecrawl.dev",
      "name": "Firecrawl",
      "type": "full_site",
      "checkInterval": 60,
      "webhook": "${defaultWebhook}",
      "crawlLimit": 10,
      "crawlDepth": 3
    },
    {
      "index": 2,
      "websiteId": "m83p5...",
      "url": "https://apple.com",
      "name": "Apple",
      "type": "single_page",
      "checkInterval": 180,
      "webhook": "${defaultWebhook}"
    }
  ],
  "total": 3,
  "successful": 3,
  "failed": 0
}`

  return (
    <Layout>
      <Header />
      
      <MainContent maxWidth="7xl" className="py-12">
        <div>
          <div className="flex items-center gap-4 mb-8">
            <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Code className="h-8 w-8 text-orange-500" />
              API
            </h1>
          </div>


          {/* API Keys Management */}
          {isAuthenticated && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Your API Keys</h2>
            
            {apiKeys === undefined ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
            
            {/* Created API key alert */}
            {createdApiKey && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
                <h4 className="font-medium text-gray-900 mb-2">API Key Created Successfully</h4>
                <p className="text-sm text-gray-700 mb-3">
                  Make sure to copy your API key now. You won&apos;t be able to see it again!
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 p-2 bg-white border rounded text-xs font-mono break-all">
                    {createdApiKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(createdApiKey)
                      setCreatedApiKey(null)
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">
                  API keys allow you to programmatically add websites to your monitoring list.
                </p>
                {!createdApiKey && (
                  <p className="text-xs text-gray-500 mt-1">
                    Create a new API key to see it automatically populated in the examples below.
                  </p>
                )}
              </div>
              <Button
                variant="orange"
                size="sm"
                onClick={() => setShowNewApiKey(true)}
                disabled={apiKeys && apiKeys.length >= 5}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create New Key
              </Button>
            </div>
            
            {showNewApiKey && (
              <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex gap-2">
                  <Input
                    placeholder="API key name (e.g., Production)"
                    value={newApiKeyName}
                    onChange={(e) => setNewApiKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateApiKey()}
                    className="flex-1"
                  />
                  <Button
                    variant="orange"
                    size="sm"
                    onClick={handleCreateApiKey}
                    disabled={!newApiKeyName.trim()}
                  >
                    Create
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewApiKey(false)
                      setNewApiKeyName('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {apiKeys && apiKeys.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {apiKeys.map((key: { id: string; name: string; keyPreview: string; createdAt: string; lastUsed?: string }) => (
                  <div
                    key={key.id}
                    className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{key.name}</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteApiKey(key.id)}
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      <code className="text-xs text-gray-500 font-mono flex-1 truncate">
                        {key.keyPreview}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyApiKey(key.keyPreview, key.id)}
                        className="h-6 w-6 p-0 border-0"
                      >
                        {copiedKeyId === key.id ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsed && (
                        <span className="block">Used: {new Date(key.lastUsed).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Key className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No API keys yet</p>
                <p className="text-xs mt-1">Create your first API key to get started</p>
              </div>
            )}
            
            {apiKeys && apiKeys.length >= 5 && (
              <p className="text-xs text-gray-500 mt-2">
                Maximum of 5 API keys allowed per account
              </p>
            )}
            </>
            )}
          </div>
          )}

          {/* Endpoint */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Add Website Endpoint</h2>
            
            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <code className="text-sm">POST {baseUrl}/api/websites</code>
                <Button
                  variant="code"
                  size="sm"
                  onClick={() => copyToClipboard(`POST ${baseUrl}/api/websites`, 'endpoint')}
                  className="text-xs"
                >
                  {copiedSection === 'endpoint' ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <h3 className="font-medium mb-2">Headers</h3>
            <table className="w-full mb-4">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Header</th>
                  <th className="text-left py-2">Value</th>
                  <th className="text-left py-2">Required</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b">
                  <td className="py-2 font-mono">Authorization</td>
                  <td className="py-2 font-mono">Bearer YOUR_API_KEY</td>
                  <td className="py-2">Yes</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">Content-Type</td>
                  <td className="py-2 font-mono">application/json</td>
                  <td className="py-2">Yes</td>
                </tr>
              </tbody>
            </table>

            <h3 className="font-medium mb-2">Request Body</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Field</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Required</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b">
                  <td className="py-2 font-mono">url</td>
                  <td className="py-2">string</td>
                  <td className="py-2">Yes</td>
                  <td className="py-2">The URL to monitor</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">type</td>
                  <td className="py-2">string</td>
                  <td className="py-2">No</td>
                  <td className="py-2">&quot;scrape&quot; for single page or &quot;crawl&quot; for full site (default: &quot;scrape&quot;)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">name</td>
                  <td className="py-2">string</td>
                  <td className="py-2">No</td>
                  <td className="py-2">Display name for the website (auto-generated if not provided)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">checkInterval</td>
                  <td className="py-2">number</td>
                  <td className="py-2">No</td>
                  <td className="py-2">Check interval in minutes (default: 60)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">webhook</td>
                  <td className="py-2">string</td>
                  <td className="py-2">No</td>
                  <td className="py-2">Webhook URL for change notifications</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">crawlLimit</td>
                  <td className="py-2">number</td>
                  <td className="py-2">No</td>
                  <td className="py-2">Max pages to crawl (only for type: &quot;crawl&quot;, default: 5)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">crawlDepth</td>
                  <td className="py-2">number</td>
                  <td className="py-2">No</td>
                  <td className="py-2">Max crawl depth (only for type: &quot;crawl&quot;, default: 3)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Examples */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Examples</h2>
            
            {/* Single Page Example */}
            <div className="mb-6">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Single Page Monitoring
              </h3>
              <div className="grid lg:grid-cols-2 gap-4">
                {/* cURL Example */}
                <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-gray-800">
                    <span className="text-xs font-medium">Request</span>
                    <Button
                      variant="code"
                      size="sm"
                      onClick={() => copyToClipboard(curlExample, 'curl-single')}
                      className="text-xs"
                    >
                      {copiedSection === 'curl-single' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 overflow-x-auto">
                    <code className="text-xs">{curlExample}</code>
                  </pre>
                </div>
                
                {/* Response Schema */}
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <div className="p-3 border-b border-gray-200">
                    <span className="text-xs font-medium text-gray-700">Response</span>
                  </div>
                  <pre className="p-4 overflow-x-auto">
                    <code className="text-xs text-gray-700">{`{
  "success": true,
  "message": "Website added successfully",
  "data": {
    "id": "k57m3...",
    "url": "https://firecrawl.dev",
    "name": "Firecrawl Website",
    "checkInterval": 15,
    "isActive": true
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Crawl Example */}
            <div className="mb-6">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Network className="h-4 w-4" />
                Full Site Crawling
              </h3>
              <div className="grid lg:grid-cols-2 gap-4">
                {/* cURL Example */}
                <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-gray-800">
                    <span className="text-xs font-medium">Request</span>
                    <Button
                      variant="code"
                      size="sm"
                      onClick={() => copyToClipboard(crawlExample, 'curl-crawl')}
                      className="text-xs"
                    >
                      {copiedSection === 'curl-crawl' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 overflow-x-auto">
                    <code className="text-xs">{crawlExample}</code>
                  </pre>
                </div>
                
                {/* Response Schema */}
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <div className="p-3 border-b border-gray-200">
                    <span className="text-xs font-medium text-gray-700">Response</span>
                  </div>
                  <pre className="p-4 overflow-x-auto">
                    <code className="text-xs text-gray-700">{`{
  "success": true,
  "message": "Website added successfully",
  "data": {
    "id": "j82n4...",
    "url": "https://firecrawl.dev/blog",
    "name": "Firecrawl Blog",
    "checkInterval": 360,
    "monitorType": "full_site",
    "crawlLimit": 10,
    "crawlDepth": 2,
    "isActive": true
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Batch Example */}
            <div className="mb-6">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Batch Request (Multiple Websites)
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Add multiple websites in a single API call by sending an array of website objects:
              </p>
              <div className="grid lg:grid-cols-2 gap-4">
                {/* cURL Example */}
                <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-gray-800">
                    <span className="text-xs font-medium">Request</span>
                    <Button
                      variant="code"
                      size="sm"
                      onClick={() => copyToClipboard(batchExample, 'curl-batch')}
                      className="text-xs"
                    >
                      {copiedSection === 'curl-batch' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 overflow-x-auto">
                    <code className="text-xs">{batchExample}</code>
                  </pre>
                </div>
                
                {/* Response Schema */}
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <div className="p-3 border-b border-gray-200">
                    <span className="text-xs font-medium text-gray-700">Response</span>
                  </div>
                  <pre className="p-4 overflow-x-auto">
                    <code className="text-xs text-gray-700">{batchResponseExample}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Pause/Resume Endpoint */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Pause/Resume Website Endpoint</h2>
            
            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <code className="text-sm">POST {baseUrl}/api/websites/pause</code>
                <Button
                  variant="code"
                  size="sm"
                  onClick={() => copyToClipboard(`POST ${baseUrl}/api/websites/pause`, 'pause-endpoint')}
                  className="text-xs"
                >
                  {copiedSection === 'pause-endpoint' ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <h3 className="font-medium mb-2">Request Body</h3>
            <table className="w-full mb-4">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Field</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Required</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b">
                  <td className="py-2 font-mono">websiteId</td>
                  <td className="py-2">string</td>
                  <td className="py-2">Yes</td>
                  <td className="py-2">The ID of the website to pause/resume</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">paused</td>
                  <td className="py-2">boolean</td>
                  <td className="py-2">Yes</td>
                  <td className="py-2">true to pause monitoring, false to resume</td>
                </tr>
              </tbody>
            </table>

            <div className="mb-6">
              <h3 className="font-medium mb-2">Example</h3>
              <div className="grid lg:grid-cols-2 gap-4">
                {/* cURL Example */}
                <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-gray-800">
                    <span className="text-xs font-medium">Request</span>
                    <Button
                      variant="code"
                      size="sm"
                      onClick={() => copyToClipboard(pauseExample, 'curl-pause')}
                      className="text-xs"
                    >
                      {copiedSection === 'curl-pause' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 overflow-x-auto">
                    <code className="text-xs">{pauseExample}</code>
                  </pre>
                </div>
                
                {/* Response Schema */}
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <div className="p-3 border-b border-gray-200">
                    <span className="text-xs font-medium text-gray-700">Response</span>
                  </div>
                  <pre className="p-4 overflow-x-auto">
                    <code className="text-xs text-gray-700">{`{
  "success": true,
  "message": "Website paused successfully"
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Delete Endpoint */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Delete Website Endpoint</h2>
            
            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <code className="text-sm">DELETE {baseUrl}/api/websites/delete</code>
                <Button
                  variant="code"
                  size="sm"
                  onClick={() => copyToClipboard(`DELETE ${baseUrl}/api/websites/delete`, 'delete-endpoint')}
                  className="text-xs"
                >
                  {copiedSection === 'delete-endpoint' ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <h3 className="font-medium mb-2">Request Body</h3>
            <table className="w-full mb-4">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Field</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Required</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b">
                  <td className="py-2 font-mono">websiteId</td>
                  <td className="py-2">string</td>
                  <td className="py-2">Yes</td>
                  <td className="py-2">The ID of the website to delete</td>
                </tr>
              </tbody>
            </table>

            <div className="mb-6">
              <h3 className="font-medium mb-2">Example</h3>
              <div className="grid lg:grid-cols-2 gap-4">
                {/* cURL Example */}
                <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-gray-800">
                    <span className="text-xs font-medium">Request</span>
                    <Button
                      variant="code"
                      size="sm"
                      onClick={() => copyToClipboard(deleteExample, 'curl-delete')}
                      className="text-xs"
                    >
                      {copiedSection === 'curl-delete' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 overflow-x-auto">
                    <code className="text-xs">{deleteExample}</code>
                  </pre>
                </div>
                
                {/* Response Schema */}
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <div className="p-3 border-b border-gray-200">
                    <span className="text-xs font-medium text-gray-700">Response</span>
                  </div>
                  <pre className="p-4 overflow-x-auto">
                    <code className="text-xs text-gray-700">{`{
  "success": true,
  "message": "Website deleted successfully"
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Check Intervals */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Available Check Intervals
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 0.25, label: '15 seconds (test)' },
                { value: 5, label: '5 minutes' },
                { value: 15, label: '15 minutes' },
                { value: 30, label: '30 minutes' },
                { value: 60, label: '1 hour' },
                { value: 180, label: '3 hours' },
                { value: 360, label: '6 hours' },
                { value: 720, label: '12 hours' },
                { value: 1440, label: '24 hours' },
                { value: 4320, label: '3 days' },
                { value: 10080, label: '7 days' },
              ].map((interval) => (
                <div key={interval.value} className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-mono text-sm font-medium">{interval.value}</div>
                  <div className="text-xs text-gray-600">{interval.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook Format */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook Payload Format
            </h2>
            <p className="text-gray-600 mb-4">
              When changes are detected, we&apos;ll send a POST request to your webhook URL with the following payload:
            </p>
            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs">
                <code>{`{
  "event": "website_changed",
  "timestamp": "2024-01-20T10:30:00Z",
  "website": {
    "id": "k57m3...",
    "name": "Example Website",
    "url": "https://firecrawl.dev/page"
  },
  "change": {
    "detectedAt": "2024-01-20T10:30:00Z",
    "changeType": "content_changed",
    "changeStatus": "changed",
    "summary": "Page content has changed",
    "diff": {
      "added": ["New content lines..."],
      "removed": ["Old content lines..."]
    }
  },
  "scrapeResult": {
    "id": "j92n4...",
    "title": "Page Title",
    "description": "Page description",
    "markdown": "# Page Content..."
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </MainContent>
      
      <Footer />
    </Layout>
  )
}