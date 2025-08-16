'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { 
  Users, 
  Package, 
  FileText,
  ShoppingCart, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Loader2,
  ArrowLeft
} from 'lucide-react'

interface SyncItem {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  endpoint: string
  lastSync?: string
  itemCount?: number
  enabled: boolean
}

export default function QuickBooksSyncPage() {
  const router = useRouter()
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<{ [key: string]: number }>({})
  const [syncResults, setSyncResults] = useState<{ [key: string]: any }>({})

  const syncItems: SyncItem[] = [
    {
      id: 'customers',
      name: 'Customers',
      description: 'Sync customer data from QuickBooks',
      icon: <Users className="h-5 w-5" />,
      endpoint: '/api/quickbooks/sync/customers',
      enabled: true
    },
    {
      id: 'items',
      name: 'Products & Services',
      description: 'Sync inventory items and services',
      icon: <Package className="h-5 w-5" />,
      endpoint: '/api/quickbooks/sync/items',
      enabled: true
    },
    {
      id: 'purchase-orders',
      name: 'Purchase Orders',
      description: 'Sync purchase orders for inventory',
      icon: <ShoppingCart className="h-5 w-5" />,
      endpoint: '/api/quickbooks/sync/purchase-orders',
      enabled: false // Coming soon
    },
    {
      id: 'invoices',
      name: 'Invoices',
      description: 'Sync sales invoices and payments',
      icon: <FileText className="h-5 w-5" />,
      endpoint: '/api/quickbooks/sync/invoices',
      enabled: false // Coming soon
    }
  ]

  async function handleSync(item: SyncItem) {
    setSyncing(item.id)
    setSyncProgress({ ...syncProgress, [item.id]: 0 })
    
    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => ({
          ...prev,
          [item.id]: Math.min((prev[item.id] || 0) + 10, 90)
        }))
      }, 200)

      const response = await fetch(item.endpoint, {
        method: 'POST'
      })
      
      clearInterval(progressInterval)
      setSyncProgress({ ...syncProgress, [item.id]: 100 })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }
      
      setSyncResults(prev => ({
        ...prev,
        [item.id]: {
          success: true,
          ...data
        }
      }))
      
      toast.success(`${item.name} synced successfully`, {
        description: data.message || `Synced ${data.synced} items`,
      })
    } catch (error) {
      setSyncResults(prev => ({
        ...prev,
        [item.id]: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
      
      toast.error('Sync failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setSyncing(null)
      // Clear progress after a delay
      setTimeout(() => {
        setSyncProgress(prev => {
          const newProgress = { ...prev }
          delete newProgress[item.id]
          return newProgress
        })
      }, 1000)
    }
  }

  async function handleSyncAll() {
    for (const item of syncItems.filter(i => i.enabled)) {
      await handleSync(item)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/quickbooks')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">QuickBooks Sync</h1>
          <p className="text-muted-foreground mt-2">
            Manage data synchronization between RackTrack and QuickBooks
          </p>
        </div>
      </div>

      {/* Sync All Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bulk Sync</CardTitle>
              <CardDescription>
                Sync all enabled data types at once
              </CardDescription>
            </div>
            <Button 
              onClick={handleSyncAll}
              disabled={syncing !== null}
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync All
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Individual Sync Items */}
      <div className="grid gap-4">
        {syncItems.map((item) => (
          <Card key={item.id} className={!item.enabled ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {item.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      {!item.enabled && (
                        <Badge variant="secondary">Coming Soon</Badge>
                      )}
                    </div>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </div>
                <Button
                  onClick={() => handleSync(item)}
                  disabled={!item.enabled || syncing !== null}
                  variant={syncing === item.id ? 'secondary' : 'default'}
                >
                  {syncing === item.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            {(syncProgress[item.id] !== undefined || syncResults[item.id]) && (
              <CardContent className="pt-0">
                {syncProgress[item.id] !== undefined && (
                  <Progress value={syncProgress[item.id]} className="mb-4" />
                )}
                {syncResults[item.id] && (
                  <Alert className={syncResults[item.id].success ? 'border-green-200' : ''}>
                    {syncResults[item.id].success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {syncResults[item.id].success ? (
                        <div>
                          <p className="font-medium">{syncResults[item.id].message}</p>
                          {syncResults[item.id].total && (
                            <p className="text-sm mt-1">
                              Total: {syncResults[item.id].total} | 
                              Synced: {syncResults[item.id].synced}
                              {syncResults[item.id].created && ` | Created: ${syncResults[item.id].created}`}
                              {syncResults[item.id].updated && ` | Updated: ${syncResults[item.id].updated}`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p>{syncResults[item.id].error}</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>
            Recent synchronization activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="mx-auto h-12 w-12 mb-4" />
            <p>Sync history coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}