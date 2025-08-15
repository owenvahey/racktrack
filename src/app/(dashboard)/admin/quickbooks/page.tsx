'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { QBConnection } from '@/types/quickbooks.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, AlertCircle, XCircle, RefreshCw, Plug } from 'lucide-react'
import { format } from 'date-fns'

export default function QuickBooksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [connection, setConnection] = useState<QBConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  // Check for OAuth callback parameters
  const success = searchParams.get('success')
  const error = searchParams.get('error')

  useEffect(() => {
    fetchConnection()
  }, [])

  async function fetchConnection() {
    try {
      const { data, error } = await supabase
        .from('qb_connections')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') { // Not found is ok
        console.error('Error fetching QB connection:', error)
      }

      setConnection(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    router.push('/api/quickbooks/connect')
  }

  async function handleDisconnect() {
    if (!connection || !confirm('Are you sure you want to disconnect QuickBooks?')) {
      return
    }

    setDisconnecting(true)
    try {
      const response = await fetch('/api/quickbooks/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id })
      })

      if (response.ok) {
        setConnection(null)
        router.refresh()
      } else {
        const error = await response.json()
        console.error('Disconnect error:', error)
      }
    } catch (error) {
      console.error('Error disconnecting:', error)
    } finally {
      setDisconnecting(false)
    }
  }

  function getConnectionStatus() {
    if (!connection) return 'disconnected'
    
    const expiresAt = new Date(connection.token_expires_at)
    const now = new Date()
    
    if (expiresAt < now) return 'expired'
    if (connection.last_error && connection.error_count > 3) return 'error'
    return 'connected'
  }

  const status = getConnectionStatus()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">QuickBooks Integration</h1>
        <p className="text-muted-foreground mt-2">
          Connect your QuickBooks account to sync customers, create purchase orders, and generate invoices
        </p>
      </div>

      {/* Status Messages */}
      {success === 'connected' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Successfully connected to QuickBooks!
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error === 'oauth_error' && 'QuickBooks authorization was cancelled or failed'}
            {error === 'missing_params' && 'Missing required parameters from QuickBooks'}
            {error === 'invalid_state' && 'Invalid security state - please try connecting again'}
            {error === 'unauthorized' && 'You must be logged in to connect QuickBooks'}
            {error === 'update_failed' && 'Failed to update QuickBooks connection'}
            {error === 'create_failed' && 'Failed to create QuickBooks connection'}
            {error === 'callback_error' && 'An error occurred during QuickBooks callback'}
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connection Status</CardTitle>
              <CardDescription>
                Manage your QuickBooks connection and sync settings
              </CardDescription>
            </div>
            <div>
              {status === 'connected' && (
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              )}
              {status === 'expired' && (
                <Badge variant="secondary">Token Expired</Badge>
              )}
              {status === 'error' && (
                <Badge variant="destructive">Error</Badge>
              )}
              {status === 'disconnected' && (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {connection ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Company</p>
                  <p className="font-medium">{connection.company_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Environment</p>
                  <p className="font-medium">
                    {connection.base_url.includes('sandbox') ? 'Sandbox' : 'Production'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Connected Since</p>
                  <p className="font-medium">
                    {format(new Date(connection.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Sync</p>
                  <p className="font-medium">
                    {connection.last_sync_at 
                      ? format(new Date(connection.last_sync_at), 'MMM d, yyyy h:mm a')
                      : 'Never'
                    }
                  </p>
                </div>
              </div>

              {connection.last_error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Last error: {connection.last_error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    'Disconnect'
                  )}
                </Button>
                {status === 'expired' && (
                  <Button onClick={handleConnect} variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reconnect
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Plug className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Not Connected</h3>
              <p className="text-muted-foreground mb-4">
                Connect your QuickBooks account to enable sync features
              </p>
              <Button onClick={handleConnect}>
                Connect QuickBooks
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Settings Card (only show when connected) */}
      {connection && status === 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Settings</CardTitle>
            <CardDescription>
              Configure how data syncs between RackTrack and QuickBooks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Automatic Sync</p>
                  <p className="text-sm text-muted-foreground">
                    Sync data automatically every {connection.sync_frequency_hours} hours
                  </p>
                </div>
                <Badge variant={connection.sync_enabled ? 'default' : 'secondary'}>
                  {connection.sync_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push('/admin/quickbooks/test')}>
                  Test Integration
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/quickbooks/customers')}>
                  Manage Customers
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/quickbooks/sync')}>
                  Sync Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}