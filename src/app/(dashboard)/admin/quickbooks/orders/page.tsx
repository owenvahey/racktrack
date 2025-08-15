'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  ShoppingCart, 
  FileText,
  DollarSign,
  Calendar,
  Building2,
  Package,
  AlertCircle,
  Loader2,
  Search,
  ArrowLeft,
  Plus,
  Eye,
  Send
} from 'lucide-react'
import { format } from 'date-fns'

interface Order {
  id: string
  order_number: string
  customer_id: string
  customer?: {
    name: string
    company_name?: string
  }
  status: string
  total_amount: number
  created_at: string
  items_count: number
  qb_invoice_id?: string
  qb_sync_status?: string
}

export default function QuickBooksOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('pending')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [syncingOrder, setSyncingOrder] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [activeTab])

  async function fetchOrders() {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:customers(name, company_name),
          order_items(id)
        `)
        .order('created_at', { ascending: false })

      // Filter by status based on tab
      if (activeTab === 'pending') {
        query = query.is('qb_invoice_id', null)
      } else if (activeTab === 'synced') {
        query = query.not('qb_invoice_id', 'is', null)
      }

      const { data, error } = await query

      if (error) throw error

      // Transform data to include items count
      const transformedOrders = (data || []).map(order => ({
        ...order,
        items_count: order.order_items?.length || 0
      }))

      setOrders(transformedOrders)
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSyncOrder(orderId: string) {
    setSyncingOrder(orderId)
    try {
      const response = await fetch('/api/quickbooks/sync/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      })

      if (!response.ok) {
        throw new Error('Failed to sync order')
      }

      await fetchOrders()
    } catch (error) {
      console.error('Error syncing order:', error)
    } finally {
      setSyncingOrder(null)
    }
  }

  const filteredOrders = orders.filter(order => 
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (order: Order) => {
    if (order.qb_invoice_id) {
      return <Badge className="bg-green-100 text-green-800">Synced</Badge>
    }
    switch (order.status) {
      case 'completed':
        return <Badge>Ready to Sync</Badge>
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
      default:
        return <Badge variant="outline">{order.status}</Badge>
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
        <div className="flex-1">
          <h1 className="text-3xl font-bold">QuickBooks Orders & Invoices</h1>
          <p className="text-muted-foreground mt-2">
            Manage order synchronization and invoice generation
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Pending Sync</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(o => !o.qb_invoice_id && o.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">Ready for QuickBooks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Synced Today</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(o => {
                if (!o.qb_invoice_id) return false
                const today = new Date().toDateString()
                return new Date(o.created_at).toDateString() === today
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">Invoices created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${orders.reduce((sum, o) => sum + (o.total_amount || 0), 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">All orders shown</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Orders</CardTitle>
              <CardDescription>
                Manage order synchronization with QuickBooks
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[200px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending">Pending Sync</TabsTrigger>
              <TabsTrigger value="synced">Synced</TabsTrigger>
              <TabsTrigger value="all">All Orders</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm ? 'No orders found matching your search' : 'No orders to display'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customer?.name}</p>
                            {order.customer?.company_name && (
                              <p className="text-sm text-muted-foreground">{order.customer.company_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(order.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{order.items_count} items</TableCell>
                        <TableCell>${order.total_amount.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(order)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/orders/${order.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!order.qb_invoice_id && order.status === 'completed' && (
                              <Button
                                size="sm"
                                onClick={() => handleSyncOrder(order.id)}
                                disabled={syncingOrder === order.id}
                              >
                                {syncingOrder === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only completed orders can be synced to QuickBooks as invoices. 
          Orders are automatically marked as synced once an invoice is created.
        </AlertDescription>
      </Alert>
    </div>
  )
}