'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  FileText,
  Calendar,
  Download,
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

interface SyncStats {
  customers: { total: number; synced: number; lastSync?: string }
  items: { total: number; synced: number; lastSync?: string }
  invoices: { total: number; synced: number; lastSync?: string }
  purchaseOrders: { total: number; synced: number; lastSync?: string }
}

interface RevenueData {
  month: string
  revenue: number
  invoices: number
  growth: number
}

export default function QuickBooksReportsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30')
  const [syncStats, setSyncStats] = useState<SyncStats>({
    customers: { total: 0, synced: 0 },
    items: { total: 0, synced: 0 },
    invoices: { total: 0, synced: 0 },
    purchaseOrders: { total: 0, synced: 0 }
  })
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])

  useEffect(() => {
    fetchReports()
  }, [dateRange])

  async function fetchReports() {
    try {
      // Fetch sync statistics
      const [customersRes, productsRes, ordersRes] = await Promise.all([
        supabase.from('qb_customers').select('id, last_synced_at'),
        supabase.from('products').select('id, qb_item_id'),
        supabase.from('orders').select('id, qb_invoice_id, total_amount, created_at')
      ])

      setSyncStats({
        customers: {
          total: customersRes.data?.length || 0,
          synced: customersRes.data?.length || 0,
          lastSync: customersRes.data?.[0]?.last_synced_at
        },
        items: {
          total: productsRes.data?.length || 0,
          synced: productsRes.data?.filter(p => p.qb_item_id).length || 0
        },
        invoices: {
          total: ordersRes.data?.length || 0,
          synced: ordersRes.data?.filter(o => o.qb_invoice_id).length || 0
        },
        purchaseOrders: { total: 0, synced: 0 } // Coming soon
      })

      // Calculate revenue data
      if (ordersRes.data) {
        const monthlyRevenue: { [key: string]: { revenue: number; count: number } } = {}
        
        ordersRes.data.forEach(order => {
          const month = format(new Date(order.created_at), 'yyyy-MM')
          if (!monthlyRevenue[month]) {
            monthlyRevenue[month] = { revenue: 0, count: 0 }
          }
          monthlyRevenue[month].revenue += order.total_amount || 0
          monthlyRevenue[month].count += 1
        })

        const revenueArray = Object.entries(monthlyRevenue)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-6) // Last 6 months
          .map(([month, data], index, array) => {
            const prevMonth = index > 0 ? array[index - 1][1].revenue : data.revenue
            const growth = prevMonth > 0 ? ((data.revenue - prevMonth) / prevMonth) * 100 : 0
            
            return {
              month: format(new Date(month + '-01'), 'MMM yyyy'),
              revenue: data.revenue,
              invoices: data.count,
              growth
            }
          })

        setRevenueData(revenueArray)
      }

    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSyncPercentage = (synced: number, total: number) => {
    if (total === 0) return 0
    return Math.round((synced / total) * 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const currentMonthRevenue = revenueData[revenueData.length - 1]?.revenue || 0
  const lastMonthRevenue = revenueData[revenueData.length - 2]?.revenue || 0
  const revenueGrowth = lastMonthRevenue > 0 
    ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
    : 0

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
          <h1 className="text-3xl font-bold">QuickBooks Reports</h1>
          <p className="text-muted-foreground mt-2">
            Analytics and insights for your QuickBooks integration
          </p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${currentMonthRevenue.toFixed(2)}
            </div>
            <div className="flex items-center text-xs mt-1">
              {revenueGrowth > 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                  <span className="text-green-600">+{revenueGrowth.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                  <span className="text-red-600">{revenueGrowth.toFixed(1)}%</span>
                </>
              )}
              <span className="text-muted-foreground ml-1">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Synced Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStats.customers.synced}</div>
            <Progress 
              value={getSyncPercentage(syncStats.customers.synced, syncStats.customers.total)} 
              className="mt-2 h-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {syncStats.customers.total} total customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Synced Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStats.items.synced}</div>
            <Progress 
              value={getSyncPercentage(syncStats.items.synced, syncStats.items.total)} 
              className="mt-2 h-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {syncStats.items.total} total products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Invoices Created</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStats.invoices.synced}</div>
            <Progress 
              value={getSyncPercentage(syncStats.invoices.synced, syncStats.invoices.total)} 
              className="mt-2 h-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {syncStats.invoices.total} total orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Analysis</TabsTrigger>
          <TabsTrigger value="sync">Sync Performance</TabsTrigger>
          <TabsTrigger value="errors">Error Log</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue Trend</CardTitle>
              <CardDescription>
                Revenue and invoice trends over the past 6 months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {revenueData.map((month) => (
                  <div key={month.month} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{month.month}</span>
                      <div className="flex items-center gap-4">
                        <span>${month.revenue.toFixed(2)}</span>
                        <Badge variant="secondary">{month.invoices} invoices</Badge>
                        {month.growth !== 0 && (
                          <div className={`flex items-center ${month.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {month.growth > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                            <span className="text-xs">{Math.abs(month.growth).toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Progress value={(month.revenue / Math.max(...revenueData.map(m => m.revenue))) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Performance</CardTitle>
              <CardDescription>
                Overview of data synchronization status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(syncStats).map(([key, stats]) => (
                    <div key={key} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                        <Badge variant={stats.synced === stats.total ? 'default' : 'secondary'}>
                          {getSyncPercentage(stats.synced, stats.total)}% synced
                        </Badge>
                      </div>
                      <Progress value={getSyncPercentage(stats.synced, stats.total)} className="mb-2" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{stats.synced} synced</span>
                        <span>{stats.total} total</span>
                      </div>
                      {stats.lastSync && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last sync: {format(new Date(stats.lastSync), 'MMM d, h:mm a')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Log</CardTitle>
              <CardDescription>
                Recent synchronization errors and issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="mx-auto h-12 w-12 mb-4" />
                <p>No errors to display</p>
                <p className="text-sm mt-2">Sync errors will appear here when they occur</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Export Reports</CardTitle>
              <CardDescription>
                Download reports for external analysis
              </CardDescription>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}