'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, 
  Package, 
  FileText, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface TestResult {
  success: boolean
  data?: any
  error?: string
}

interface TestResults {
  customers?: TestResult
  items?: TestResult
}

export default function QuickBooksTestPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [results, setResults] = useState<TestResults>({})

  async function testCustomerSync() {
    setLoading('customers')
    try {
      const response = await fetch('/api/quickbooks/sync/customers', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }
      
      setResults(prev => ({
        ...prev,
        customers: {
          success: true,
          data
        }
      }))
    } catch (error) {
      setResults(prev => ({
        ...prev,
        customers: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    } finally {
      setLoading(null)
    }
  }

  async function testItemSync() {
    setLoading('items')
    try {
      const response = await fetch('/api/quickbooks/sync/items', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }
      
      setResults(prev => ({
        ...prev,
        items: {
          success: true,
          data
        }
      }))
    } catch (error) {
      setResults(prev => ({
        ...prev,
        items: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">QuickBooks Integration Testing</h1>
        <p className="text-muted-foreground mt-2">
          Test various QuickBooks integration features
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Make sure you're connected to QuickBooks before running these tests.
          These tests use your sandbox data.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Sync Test</CardTitle>
              <CardDescription>
                Fetch customers from QuickBooks and sync to database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testCustomerSync}
                disabled={loading === 'customers'}
              >
                {loading === 'customers' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Sync Customers
                  </>
                )}
              </Button>

              {results.customers && (
                <div className="mt-4">
                  {results.customers.success ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <p className="font-medium">{results.customers.data.message}</p>
                        <p className="text-sm mt-1">
                          Total: {results.customers.data.total} | 
                          Synced: {results.customers.data.synced}
                        </p>
                        {results.customers.data.errors && (
                          <div className="mt-2">
                            <p className="text-sm font-medium">Errors:</p>
                            {results.customers.data.errors.map((err: any, i: number) => (
                              <p key={i} className="text-xs">
                                {err.customer}: {err.error}
                              </p>
                            ))}
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {results.customers.error}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer List */}
          <Card>
            <CardHeader>
              <CardTitle>Synced Customers</CardTitle>
              <CardDescription>
                View customers that have been synced from QuickBooks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomersList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Item Sync Test</CardTitle>
              <CardDescription>
                Fetch items from QuickBooks and sync to products database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testItemSync}
                disabled={loading === 'items'}
              >
                {loading === 'items' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Sync Items
                  </>
                )}
              </Button>

              {results.items && (
                <div className="mt-4">
                  {results.items.success ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <p className="font-medium">{results.items.data.message}</p>
                        <p className="text-sm mt-1">
                          Total: {results.items.data.total} | 
                          Synced: {results.items.data.synced} | 
                          Created: {results.items.data.created} | 
                          Updated: {results.items.data.updated}
                        </p>
                        {results.items.data.errors && (
                          <div className="mt-2">
                            <p className="text-sm font-medium">Errors:</p>
                            {results.items.data.errors.map((err: any, i: number) => (
                              <p key={i} className="text-xs">
                                {err.item}: {err.error}
                              </p>
                            ))}
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {results.items.error}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items List */}
          <Card>
            <CardHeader>
              <CardTitle>Synced Products</CardTitle>
              <CardDescription>
                View products that have been synced from QuickBooks items
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ItemsList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Test</CardTitle>
              <CardDescription>
                Test creating and syncing invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Invoice sync coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CustomersList() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    try {
      const response = await fetch('/api/quickbooks/customers')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4">
        No customers synced yet. Click "Sync Customers" above.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {customers.map(customer => (
        <div key={customer.id} className="p-3 border rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{customer.name}</p>
              {customer.company_name && (
                <p className="text-sm text-muted-foreground">{customer.company_name}</p>
              )}
              {customer.email && (
                <p className="text-sm text-muted-foreground">{customer.email}</p>
              )}
            </div>
            <Badge variant={customer.is_active ? 'default' : 'secondary'}>
              {customer.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}

function ItemsList() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    try {
      const response = await fetch('/api/products?qb_synced=true')
      if (response.ok) {
        const data = await response.json()
        setItems(data)
      }
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4">
        No items synced yet. Click "Sync Items" above.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="p-3 border rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
              {item.description && (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              )}
              <div className="flex gap-4 mt-1">
                <span className="text-sm">
                  Type: <Badge variant="outline" className="ml-1">{item.product_type}</Badge>
                </span>
                <span className="text-sm text-muted-foreground">
                  Units/Case: {item.units_per_case || 1}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">${item.cost_per_unit.toFixed(2)}</p>
              {item.sell_price > 0 && (
                <p className="text-sm text-muted-foreground">Sell: ${item.sell_price.toFixed(2)}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}