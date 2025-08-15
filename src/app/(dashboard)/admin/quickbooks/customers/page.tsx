'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Loader2,
  Search,
  RefreshCw,
  MoreHorizontal,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  AlertCircle,
  Clock,
  Filter
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

type QBCustomer = Database['public']['Tables']['qb_customers']['Row']

interface Address {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

export default function QuickBooksCustomersPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [customers, setCustomers] = useState<QBCustomer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<QBCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<QBCustomer | null>(null)
  const [connection, setConnection] = useState<any>(null)

  useEffect(() => {
    fetchConnection()
    fetchCustomers()
  }, [])

  useEffect(() => {
    filterCustomers()
  }, [customers, searchQuery, filterActive])

  async function fetchConnection() {
    try {
      const { data, error } = await supabase
        .from('qb_connections')
        .select('*')
        .single()

      if (!error && data) {
        setConnection(data)
      }
    } catch (error) {
      console.error('Error fetching connection:', error)
    }
  }

  async function fetchCustomers() {
    try {
      const response = await fetch('/api/quickbooks/customers')
      if (!response.ok) {
        throw new Error('Failed to fetch customers')
      }
      
      const data = await response.json()
      setCustomers(data)
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  async function syncCustomers() {
    setSyncing(true)
    try {
      const response = await fetch('/api/quickbooks/sync/customers', {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Sync failed')
      }

      const result = await response.json()
      toast.success(result.message || 'Customers synced successfully')
      
      // Refresh the customer list
      await fetchCustomers()
      await fetchConnection()
    } catch (error) {
      console.error('Error syncing customers:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to sync customers')
    } finally {
      setSyncing(false)
    }
  }

  function filterCustomers() {
    let filtered = [...customers]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(customer => 
        customer.name.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.company_name?.toLowerCase().includes(query) ||
        customer.phone?.includes(query)
      )
    }

    // Active filter
    if (filterActive !== null) {
      filtered = filtered.filter(customer => customer.is_active === filterActive)
    }

    setFilteredCustomers(filtered)
  }

  function formatAddress(address: Address | null): string {
    if (!address) return 'No address'
    
    const parts = []
    if (address.line1) parts.push(address.line1)
    if (address.line2) parts.push(address.line2)
    if (address.city || address.state || address.postal_code) {
      const cityStateZip = []
      if (address.city) cityStateZip.push(address.city)
      if (address.state) cityStateZip.push(address.state)
      if (address.postal_code) cityStateZip.push(address.postal_code)
      parts.push(cityStateZip.join(', '))
    }
    if (address.country) parts.push(address.country)
    
    return parts.join('\n')
  }

  function getLastSyncStatus() {
    if (!connection?.last_sync_at) return null
    
    const lastSync = new Date(connection.last_sync_at)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60))
    
    if (diffMinutes < 5) {
      return { icon: CheckCircle, text: 'Just synced', color: 'text-green-600' }
    } else if (diffMinutes < 60) {
      return { icon: Clock, text: `${diffMinutes} minutes ago`, color: 'text-blue-600' }
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60)
      return { icon: Clock, text: `${hours} hour${hours > 1 ? 's' : ''} ago`, color: 'text-yellow-600' }
    } else {
      return { icon: AlertCircle, text: format(lastSync, 'MMM d, yyyy'), color: 'text-orange-600' }
    }
  }

  const lastSyncStatus = getLastSyncStatus()

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">QuickBooks Customers</h1>
          <p className="text-muted-foreground mt-2">
            Manage and sync customer data from QuickBooks
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">QuickBooks Customers</h1>
          <p className="text-muted-foreground mt-2">
            Manage and sync customer data from QuickBooks
          </p>
        </div>
        
        <Button onClick={() => router.push('/admin/quickbooks')}>
          Back to Settings
        </Button>
      </div>

      {/* Sync Status Alert */}
      {connection && lastSyncStatus && (
        <Alert className="border-blue-200 bg-blue-50">
          <lastSyncStatus.icon className={`h-4 w-4 ${lastSyncStatus.color}`} />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Last synced: <span className="font-medium">{lastSyncStatus.text}</span>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={syncCustomers}
              disabled={syncing || !connection}
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Customer List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer List</CardTitle>
              <CardDescription>
                {customers.length} customers synced from QuickBooks
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  {filterActive === null ? 'All' : filterActive ? 'Active' : 'Inactive'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilterActive(null)}>
                  All Customers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterActive(true)}>
                  Active Only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterActive(false)}>
                  Inactive Only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Customer Table */}
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchQuery || filterActive !== null
                  ? 'No customers found matching your criteria'
                  : 'No customers synced yet'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            {customer.company_name && (
                              <p className="text-sm text-muted-foreground">{customer.company_name}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {customer.email && (
                            <div className="flex items-center text-sm">
                              <Mail className="mr-1 h-3 w-3 text-muted-foreground" />
                              {customer.email}
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center text-sm">
                              <Phone className="mr-1 h-3 w-3 text-muted-foreground" />
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start text-sm">
                          <MapPin className="mr-1 h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className="whitespace-pre-line">
                            {formatAddress(customer.billing_address as Address | null)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.is_active ? 'outline' : 'secondary'}>
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {customer.last_synced_at && (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(customer.last_synced_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setSelectedCustomer(customer)}>
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              View in QuickBooks
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              Create purchase order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedCustomer(null)}>
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{selectedCustomer.name}</CardTitle>
                {selectedCustomer.company_name && (
                  <CardDescription>{selectedCustomer.company_name}</CardDescription>
                )}
              </div>
              <Button variant="ghost" onClick={() => setSelectedCustomer(null)}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contact Information */}
              <div>
                <h3 className="font-semibold mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedCustomer.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedCustomer.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mobile</p>
                    <p className="font-medium">{selectedCustomer.mobile || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Website</p>
                    <p className="font-medium">{selectedCustomer.website || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div>
                <h3 className="font-semibold mb-3">Addresses</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Billing Address</p>
                    <p className="text-sm whitespace-pre-line">
                      {formatAddress(selectedCustomer.billing_address as Address | null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Shipping Address</p>
                    <p className="text-sm whitespace-pre-line">
                      {formatAddress(selectedCustomer.shipping_address as Address | null)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <h3 className="font-semibold mb-3">Additional Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Payment Terms</p>
                    <p className="font-medium">{selectedCustomer.payment_terms || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Credit Limit</p>
                    <p className="font-medium">
                      {selectedCustomer.credit_limit 
                        ? `$${selectedCustomer.credit_limit.toLocaleString()}`
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tax Exempt</p>
                    <p className="font-medium">{selectedCustomer.tax_exempt ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={selectedCustomer.is_active ? 'outline' : 'secondary'}>
                      {selectedCustomer.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* QuickBooks Metadata */}
              <div>
                <h3 className="font-semibold mb-3">QuickBooks Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Customer ID</p>
                    <p className="font-medium font-mono">{selectedCustomer.qb_customer_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sync Token</p>
                    <p className="font-medium font-mono">{selectedCustomer.qb_sync_token || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created in QB</p>
                    <p className="font-medium">
                      {selectedCustomer.qb_created_time 
                        ? format(new Date(selectedCustomer.qb_created_time), 'MMM d, yyyy')
                        : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Updated in QB</p>
                    <p className="font-medium">
                      {selectedCustomer.qb_last_updated_time 
                        ? format(new Date(selectedCustomer.qb_last_updated_time), 'MMM d, yyyy')
                        : 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}