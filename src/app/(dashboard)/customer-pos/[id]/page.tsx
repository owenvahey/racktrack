'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { 
  ArrowLeft,
  Edit,
  Send,
  Pause,
  Play,
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  Package,
  Calendar,
  DollarSign,
  Building2,
  Clock,
  AlertCircle,
  RefreshCw,
  Download,
  Printer,
  Search
} from 'lucide-react'
import { format } from 'date-fns'

interface CustomerPO {
  id: string
  po_number: string
  customer: {
    id: string
    name: string
    company_name?: string
    email?: string
    phone?: string
  }
  production_status: string
  total_amount: number
  po_date: string
  due_date?: string
  ship_date?: string
  description?: string
  production_notes?: string
  hold_reason?: string
  production_started_at?: string
  production_completed_at?: string
  qb_estimate_id?: string
  qb_estimate_number?: string
  qb_invoice_id?: string
  items: Array<{
    id: string
    line_number: number
    description: string
    quantity: number
    unit_price: number
    unit_of_measure: string
    total_amount: number
    quantity_produced: number
    quantity_shipped: number
    product?: {
      id: string
      name: string
      sku: string
    }
  }>
  status_history: Array<{
    id: string
    from_status?: string
    to_status: string
    change_reason?: string
    notes?: string
    changed_at: string
    changed_by_user?: {
      name: string
    }
  }>
  created_at: string
  created_by_user?: { name: string }
  updated_at: string
  updated_by_user?: { name: string }
}

const statusConfig: { [key: string]: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; icon: any } } = {
  draft: { label: 'Draft', variant: 'secondary', icon: FileText },
  pending_approval: { label: 'Pending Approval', variant: 'outline', className: 'border-yellow-500 text-yellow-700', icon: Clock },
  approved: { label: 'Approved', variant: 'default', icon: CheckCircle },
  sent_to_production: { label: 'Sent to Production', variant: 'outline', className: 'border-blue-500 text-blue-700', icon: Send },
  in_production: { label: 'In Production', variant: 'outline', className: 'border-blue-500 text-blue-700', icon: Play },
  on_hold: { label: 'On Hold', variant: 'outline', className: 'border-yellow-500 text-yellow-700', icon: Pause },
  quality_check: { label: 'Quality Check', variant: 'outline', className: 'border-purple-500 text-purple-700', icon: Search },
  ready_for_invoice: { label: 'Ready for Invoice', variant: 'outline', className: 'border-green-500 text-green-700', icon: DollarSign },
  invoiced: { label: 'Invoiced', variant: 'outline', className: 'border-green-500 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: XCircle }
}

export default function CustomerPODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const resolvedParams = use(params)
  const [po, setPO] = useState<CustomerPO | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    fetchPO()
  }, [resolvedParams.id])

  async function fetchPO() {
    try {
      const response = await fetch(`/api/customer-pos/${resolvedParams.id}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Not Found', {
            description: 'Customer PO not found',
          })
          router.push('/customer-pos')
          return
        }
        throw new Error('Failed to fetch PO')
      }

      const data = await response.json()
      setPO(data)
    } catch (error) {
      console.error('Error fetching PO:', error)
      toast.error('Error', {
        description: 'Failed to fetch customer PO',
      })
    } finally {
      setLoading(false)
    }
  }

  async function syncToQuickBooks() {
    setSyncing(true)
    try {
      const response = await fetch(`/api/customer-pos/${resolvedParams.id}/sync-estimate`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Sync failed')
      }

      const result = await response.json()
      await fetchPO()
      
      toast.success('Success', {
        description: result.message,
      })
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to sync with QuickBooks',
      })
    } finally {
      setSyncing(false)
    }
  }

  async function updateStatus(newStatus: string, reason?: string) {
    setUpdatingStatus(true)
    try {
      const response = await fetch(`/api/customer-pos/${resolvedParams.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reason })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update status')
      }

      await fetchPO()
      toast.success('Status Updated', {
        description: `PO status changed to ${statusConfig[newStatus].label}`,
      })
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to update status',
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.draft
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className || ''}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getNextActions = () => {
    if (!po) return []
    
    const actions = []
    
    switch (po.production_status) {
      case 'draft':
        actions.push({ label: 'Send for Approval', status: 'pending_approval', icon: Send })
        break
      case 'pending_approval':
        actions.push({ label: 'Approve', status: 'approved', icon: CheckCircle })
        break
      case 'approved':
        actions.push({ label: 'Send to Production', status: 'sent_to_production', icon: Send })
        break
      case 'sent_to_production':
        actions.push({ label: 'Start Production', status: 'in_production', icon: Play })
        actions.push({ label: 'Put on Hold', status: 'on_hold', icon: Pause })
        break
      case 'in_production':
        actions.push({ label: 'Quality Check', status: 'quality_check', icon: Search })
        actions.push({ label: 'Put on Hold', status: 'on_hold', icon: Pause })
        break
      case 'on_hold':
        actions.push({ label: 'Resume Production', status: 'in_production', icon: Play })
        break
      case 'quality_check':
        actions.push({ label: 'Ready for Invoice', status: 'ready_for_invoice', icon: DollarSign })
        actions.push({ label: 'Back to Production', status: 'in_production', icon: Play })
        break
      case 'ready_for_invoice':
        actions.push({ label: 'Create Invoice', status: 'invoiced', icon: FileText })
        break
    }

    if (!['invoiced', 'cancelled'].includes(po.production_status)) {
      actions.push({ label: 'Cancel PO', status: 'cancelled', icon: XCircle })
    }

    return actions
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!po) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/customer-pos')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">PO #{po.po_number}</h1>
            <p className="text-muted-foreground mt-1">
              Customer Purchase Order Details
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Printer className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/customer-pos/${po.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Order Information</CardTitle>
                {getStatusBadge(po.production_status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <div className="mt-1">
                    <p className="font-medium">{po.customer.name}</p>
                    {po.customer.company_name && (
                      <p className="text-sm text-muted-foreground">{po.customer.company_name}</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <div className="mt-1">
                    {po.customer.email && (
                      <p className="text-sm">{po.customer.email}</p>
                    )}
                    {po.customer.phone && (
                      <p className="text-sm">{po.customer.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">PO Date</p>
                  <p className="font-medium mt-1">
                    {format(new Date(po.po_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium mt-1">
                    {po.due_date ? format(new Date(po.due_date), 'MMM d, yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ship Date</p>
                  <p className="font-medium mt-1">
                    {po.ship_date ? format(new Date(po.ship_date), 'MMM d, yyyy') : '-'}
                  </p>
                </div>
              </div>

              {(po.description || po.production_notes) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    {po.description && (
                      <div>
                        <p className="text-sm text-muted-foreground">Description</p>
                        <p className="mt-1">{po.description}</p>
                      </div>
                    )}
                    {po.production_notes && (
                      <div>
                        <p className="text-sm text-muted-foreground">Production Notes</p>
                        <p className="mt-1">{po.production_notes}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.description}</p>
                          {item.product && (
                            <p className="text-sm text-muted-foreground">
                              SKU: {item.product.sku}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.quantity} {item.unit_of_measure}
                      </TableCell>
                      <TableCell>${item.unit_price.toFixed(2)}</TableCell>
                      <TableCell>${item.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>Produced: {item.quantity_produced}/{item.quantity}</p>
                          <p>Shipped: {item.quantity_shipped}/{item.quantity}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end">
                <div className="space-y-1">
                  <div className="flex justify-between gap-8">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${po.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-8 font-semibold">
                    <span>Total</span>
                    <span>${po.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="history">
            <TabsList>
              <TabsTrigger value="history">Status History</TabsTrigger>
              <TabsTrigger value="production">Production</TabsTrigger>
            </TabsList>
            
            <TabsContent value="history">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {po.status_history.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3">
                        <div className="mt-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">
                            Status changed from{' '}
                            <Badge variant="outline" className="mx-1">
                              {entry.from_status ? statusConfig[entry.from_status]?.label || entry.from_status : 'New'}
                            </Badge>
                            to
                            <Badge variant="outline" className="mx-1">
                              {statusConfig[entry.to_status]?.label || entry.to_status}
                            </Badge>
                          </p>
                          {entry.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(entry.changed_at), 'MMM d, yyyy h:mm a')}
                            {entry.changed_by_user && ` by ${entry.changed_by_user.name}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="production">
              <Card>
                <CardContent className="pt-6">
                  {po.production_status === 'on_hold' && po.hold_reason && (
                    <Alert className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>On Hold:</strong> {po.hold_reason}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Production Started</p>
                      <p className="font-medium">
                        {po.production_started_at 
                          ? format(new Date(po.production_started_at), 'MMM d, yyyy h:mm a')
                          : 'Not started'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Production Completed</p>
                      <p className="font-medium">
                        {po.production_completed_at 
                          ? format(new Date(po.production_completed_at), 'MMM d, yyyy h:mm a')
                          : 'In progress'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {getNextActions().map((action) => (
                <Button
                  key={action.status}
                  className="w-full justify-start"
                  variant={action.status === 'cancelled' ? 'destructive' : 'default'}
                  onClick={() => updateStatus(action.status)}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <action.icon className="mr-2 h-4 w-4" />
                  )}
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>QuickBooks Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {po.qb_estimate_id ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimate #</span>
                    <Badge variant="outline">{po.qb_estimate_number}</Badge>
                  </div>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={syncToQuickBooks}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Update Estimate
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Not synced to QuickBooks
                  </p>
                  <Button
                    className="w-full"
                    onClick={syncToQuickBooks}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Create Estimate
                  </Button>
                </div>
              )}
              
              {po.qb_invoice_id && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Invoice</span>
                    <Badge variant="outline" className="bg-green-50">Created</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(po.created_at), 'MMM d, h:mm a')}</span>
              </div>
              {po.created_by_user && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created by</span>
                  <span>{po.created_by_user.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{format(new Date(po.updated_at), 'MMM d, h:mm a')}</span>
              </div>
              {po.updated_by_user && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated by</span>
                  <span>{po.updated_by_user.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}