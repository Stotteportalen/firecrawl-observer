'use client'

import { Layout, MainContent, Footer } from '@/components/layout/layout'
import { Header } from '@/components/layout/header'
import { Hero } from '@/components/layout/hero'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Monitor, 
  Bell, 
  Code, 
  Key, 
  Webhook, 
  Clock, 
  Shield, 
  Download, 
  Eye,
  AlertCircle,
  GitBranch,
  FileText,
  BookOpen,
  Settings
} from 'lucide-react'
import Link from 'next/link'

export default function DocsPage() {
  return (
    <Layout>
      <Header showCTA={false} />
      
      <Hero 
        title="Documentation"
        subtitle="Complete guide to monitoring websites with Firecrawl Observer"
      />
      
      <MainContent maxWidth="7xl" className="py-12">
        <div className="max-w-6xl mx-auto space-y-12">
          
          {/* Overview */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Overview</h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-lg text-gray-600 mb-6">
                Firecrawl Observer is a powerful website monitoring tool that helps you track changes on any website. 
                Built with Next.js, PostgreSQL, and the Firecrawl API, it provides real-time monitoring with customizable 
                intervals, visual diff viewing, and multiple notification options.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-orange-500" />
                      Real-time Monitoring
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      Track unlimited websites with customizable check intervals from 1 minute to 7 days.
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-orange-500" />
                      Visual Diff Viewer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      See exactly what changed with side-by-side diff comparisons and highlighted changes.
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-orange-500" />
                      Smart Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      Get notified via email or webhooks when important changes are detected.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <Separator />

          {/* Getting Started */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Getting Started</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  1. Set up Firecrawl Auth
                </h3>
                <p className="text-gray-600 mb-4">
                  First, you&apos;ll need a Firecrawl API key to start monitoring websites. This is required for all scraping operations.
                </p>
                <Button variant="orange" asChild>
                  <Link href="/settings?section=firecrawl">
                    Configure API Key
                  </Link>
                </Button>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  2. Add Your First Website
                </h3>
                <p className="text-gray-600 mb-4">
                  Add a website URL to start monitoring. The system will automatically detect changes and track them over time.
                </p>
                <Button variant="outline" asChild>
                  <Link href="/">
                    Start Monitoring
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* Features */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    Custom Intervals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">
                    Set check intervals from 1 minute to 7 days based on your monitoring needs.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">1 min</Badge>
                    <Badge variant="secondary">5 min</Badge>
                    <Badge variant="secondary">1 hour</Badge>
                    <Badge variant="secondary">1 day</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-green-500" />
                    Monitor Types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">
                    Choose between single page monitoring or full site crawling with configurable depth.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">Single Page</Badge>
                    <Badge variant="secondary">Full Crawl</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-purple-500" />
                    Export Options
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">
                    Download scraped content as markdown files for offline analysis or archival.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">Markdown</Badge>
                    <Badge variant="secondary">Raw HTML</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-yellow-500" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">
                    Get notified when changes are detected via email or webhook integrations.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">Email</Badge>
                    <Badge variant="secondary">Webhook</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-500" />
                    Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">
                    Secure authentication with API key management and user-scoped access controls.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">Auth</Badge>
                    <Badge variant="secondary">API Keys</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-indigo-500" />
                    API Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">
                    Programmatically manage websites via REST API with full CRUD operations.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">REST API</Badge>
                    <Badge variant="secondary">OpenAPI</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator />

          {/* Configuration */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Configuration</h2>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Website Settings
                </h3>
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-medium mb-3">Monitor Configuration</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li><strong>Check Interval:</strong> How often to check for changes (1 min - 7 days)</li>
                    <li><strong>Monitor Type:</strong> Single page or full site crawl</li>
                    <li><strong>Crawl Depth:</strong> How deep to crawl (1-10 levels)</li>
                    <li><strong>Crawl Limit:</strong> Maximum pages to crawl per check</li>
                    <li><strong>Notifications:</strong> Email or webhook alerts on changes</li>
                  </ul>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Webhook Integration
                </h3>
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-medium mb-3">Webhook Payload</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    When changes are detected, a POST request is sent to your webhook URL with the following structure:
                  </p>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono overflow-x-auto">
                    <pre>{`{
  "event": "website_changed",
  "timestamp": "2024-01-20T10:30:00Z",
  "website": {
    "id": "k57m3...",
    "name": "Example Website",
    "url": "https://example.com/page"
  },
  "change": {
    "detectedAt": "2024-01-20T10:30:00Z",
    "changeType": "content_changed",
    "summary": "Page content has changed"
  }
}`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* API Documentation */}
          <section>
            <h2 className="text-2xl font-bold mb-6">API Documentation</h2>
            
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Code className="h-6 w-6 text-orange-600" />
                <h3 className="text-xl font-semibold">REST API</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Access the full REST API to programmatically manage your website monitoring. 
                Create API keys, add websites, and retrieve monitoring data.
              </p>
              <div className="flex gap-3">
                <Button variant="orange" asChild>
                  <Link href="/api-docs">
                    <FileText className="h-4 w-4 mr-2" />
                    View API Docs
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/settings?section=api">
                    <Key className="h-4 w-4 mr-2" />
                    Manage API Keys
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* Troubleshooting */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Troubleshooting</h2>
            
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Common Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Website not being monitored</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Check that your Firecrawl API key is configured and valid. Also ensure the website URL is accessible.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Changes not detected</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Some websites use dynamic content that may not be captured. Try adjusting the monitor type or check interval.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Webhook not receiving notifications</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Verify your webhook URL is publicly accessible and returns a 200 status code. Test it using the webhook playground.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator />

          {/* Support */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Support</h2>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-semibold">Need Help?</h3>
              </div>
              <p className="text-gray-600 mb-4">
                If you&apos;re having trouble with Firecrawl Observer, check out these resources:
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <Link href="https://github.com/mendableai/firecrawl-observer" target="_blank">
                    GitHub Repository
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="https://docs.firecrawl.dev/" target="_blank">
                    Firecrawl Documentation
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/webhook-playground">
                    Webhook Playground
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </MainContent>
      
      <Footer />
    </Layout>
  )
}
