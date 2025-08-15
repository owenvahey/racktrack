'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { useToast } from '@/hooks/use-toast'
import { 
  Plus,
  Search,
  MoreHorizontal,
  Eye,
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
  Clock
} from 'lucide-react'
import { format } from 'date-fns'

interface CustomerPO {
  id: string
  po_number: string
  customer: {
    id: string
    name: string
    company_name?: string
  }
  production_status: string
  total_amount: number
  po_date: string
  due_date?: string
  qb_estimate_id?: string
  qb_invoice_id?: string
  items: any[]
  created_at: string
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

export default function CustomerPOsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [pos, setPOs] = useState<CustomerPO[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  useEffect(() => {
    fetchPOs()
  }, [statusFilter])

  async function fetchPOs() {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/customer-pos?${params}`)
      if (!response.ok) throw new Error('Failed to fetch POs')

      const data = await response.json()
      setPOs(data)
    } catch (error) {
      console.error('Error fetching POs:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch customer POs',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function updatePOStatus(poId: string, newStatus: string, reason?: string) {
    setUpdatingStatus(poId)
    try {
      const response = await fetch(`/api/customer-pos/${poId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reason })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update status')
      }

      await fetchPOs()
      toast({
        title: 'Status Updated',
        description: `PO status changed to ${statusConfig[newStatus].label}`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      })
    } finally {
      setUpdatingStatus(null)
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

  const getNextActions = (po: CustomerPO) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Purchase Orders</h1>
          <p className="text-muted-foreground mt-2">
            Manage customer POs and track production status
          </p>
        </div>
        <Button onClick={() => router.push('/customer-pos/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New PO
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active POs</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pos.filter(po => ['in_production', 'quality_check'].includes(po.production_status)).length}
            </div>
            <p className="text-xs text-muted-foreground">Currently in production</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pos.filter(po => po.production_status === 'pending_approval').length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting customer approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Ready to Invoice</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pos.filter(po => po.production_status === 'ready_for_invoice').length}
            </div>
            <p className="text-xs text-muted-foreground">Completed production</p>
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
              ${pos.reduce((sum, po) => sum + po.total_amount, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">All active POs</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Purchase Orders</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search POs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchPOs()}
                  className="pl-8 w-[200px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>QB</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{po.customer.name}</p>
                      {po.customer.company_name && (
                        <p className="text-sm text-muted-foreground">{po.customer.company_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(po.po_date), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    {po.due_date ? format(new Date(po.due_date), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>{po.items.length}</TableCell>
                  <TableCell>${po.total_amount.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(po.production_status)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {po.qb_estimate_id && (
                        <Badge variant="outline" className="text-xs">Est</Badge>
                      )}
                      {po.qb_invoice_id && (
                        <Badge variant="outline" className="text-xs">Inv</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          {updatingStatus === po.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => router.push(`/customer-pos/${po.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/customer-pos/${po.id}/edit`)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                        {getNextActions(po).map((action) => (
                          <DropdownMenuItem
                            key={action.status}
                            onClick={() => updatePOStatus(po.id, action.status)}
                          >
                            <action.icon className="mr-2 h-4 w-4" />
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}