'use client'

import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package2, MapPin, Calendar, QrCode, Weight, Ruler } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
const QRCode = require('qrcode.react')

type PalletStatus = 'receiving' | 'in_transit' | 'stored' | 'picking' | 'staged' | 'shipped'

const statusColors: Record<PalletStatus, string> = {
  receiving: 'bg-yellow-100 text-yellow-800',
  in_transit: 'bg-blue-100 text-blue-800',
  stored: 'bg-green-100 text-green-800',
  picking: 'bg-orange-100 text-orange-800',
  staged: 'bg-purple-100 text-purple-800',
  shipped: 'bg-gray-100 text-gray-800',
}

export default function PalletDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const palletId = params.id as string

  // Fetch pallet details
  const { data: pallet, isLoading } = useQuery({
    queryKey: ['pallet', palletId],
    queryFn: async () => {
      const { data } = await supabase
        .from('pallets')
        .select(`
          *,
          current_location:storage_slots!pallets_current_location_id_fkey(
            id,
            code,
            shelf:shelves(
              code,
              level_number,
              aisle:aisles(
                code,
                name,
                warehouse:warehouses(name, code)
              )
            )
          ),
          created_by_user:profiles!pallets_created_by_fkey(
            full_name,
            email
          ),
          inventory(
            id,
            quantity,
            lot_number,
            batch_number,
            expiration_date,
            unit_cost,
            quality_status,
            received_date,
            product:products(
              name,
              sku,
              category,
              unit_of_measure,
              barcode
            )
          )
        `)
        .eq('id', palletId)
        .single()

      return data
    },
  })

  // Fetch movement history
  const { data: movements = [] } = useQuery({
    queryKey: ['pallet-movements', palletId],
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          from_location:storage_slots!inventory_movements_from_location_id_fkey(code),
          to_location:storage_slots!inventory_movements_to_location_id_fkey(code),
          performed_by_user:profiles!inventory_movements_performed_by_fkey(full_name)
        `)
        .eq('pallet_id', palletId)
        .order('created_at', { ascending: false })
        .limit(10)

      return data || []
    },
  })

  if (isLoading || !pallet) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading pallet details...</p>
      </div>
    )
  }

  const getLocationString = () => {
    if (!pallet.current_location) return 'Unassigned'
    const loc = pallet.current_location
    const warehouse = loc.shelf?.aisle?.warehouse?.name || ''
    const aisle = loc.shelf?.aisle?.code || ''
    const shelf = loc.shelf?.code || ''
    const slot = loc.code || ''
    return `${warehouse} - ${aisle}${shelf}${slot}`
  }

  const getTotalValue = () => {
    if (!pallet.inventory || pallet.inventory.length === 0) return 0
    return pallet.inventory.reduce((sum: number, inv: any) => {
      const cost = inv.unit_cost || 0
      const quantity = inv.quantity || 0
      return sum + (cost * quantity)
    }, 0)
  }

  const getTotalItems = () => {
    if (!pallet.inventory || pallet.inventory.length === 0) return 0
    return pallet.inventory.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Pallet {pallet.pallet_number}</h1>
          <p className="text-muted-foreground">
            View and manage pallet details
          </p>
        </div>
        <Link href={`/inventory/pallets/${palletId}/move`}>
          <Button>Move Pallet</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Pallet Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className={statusColors[pallet.status as PalletStatus]}>
                  {pallet.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{getLocationString()}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pallet Type</p>
                <p className="font-medium">{pallet.pallet_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created By</p>
                <p className="font-medium">{pallet.created_by_user?.full_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Received Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {pallet.received_date ? 
                      format(new Date(pallet.received_date), 'MMM d, yyyy') : 
                      'Not set'
                    }
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Moved</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {pallet.last_moved ? 
                      format(new Date(pallet.last_moved), 'MMM d, yyyy') : 
                      'Never'
                    }
                  </span>
                </div>
              </div>
            </div>

            {pallet.notes && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="font-medium">{pallet.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QR Code</CardTitle>
            <CardDescription>Scan to identify this pallet</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <QRCode 
              value={pallet.qr_code || pallet.pallet_number} 
              size={200}
              level="H"
            />
            <p className="text-sm text-muted-foreground text-center">
              {pallet.qr_code || pallet.pallet_number}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pallet Contents</CardTitle>
          <CardDescription>
            {pallet.inventory?.length || 0} different products • {getTotalItems()} total items • ${getTotalValue().toFixed(2)} total value
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Lot/Batch</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!pallet.inventory || pallet.inventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No items on this pallet
                  </TableCell>
                </TableRow>
              ) : (
                pallet.inventory.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {inv.product?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>{inv.product?.sku || '-'}</TableCell>
                    <TableCell>
                      {inv.quantity} {inv.product?.unit_of_measure}
                    </TableCell>
                    <TableCell>
                      {inv.lot_number || inv.batch_number || '-'}
                    </TableCell>
                    <TableCell>
                      {inv.expiration_date ? 
                        format(new Date(inv.expiration_date), 'MMM d, yyyy') : 
                        '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        inv.quality_status === 'approved' ? 'default' :
                        inv.quality_status === 'rejected' ? 'destructive' :
                        'secondary'
                      }>
                        {inv.quality_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      ${(inv.unit_cost || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      ${((inv.unit_cost || 0) * inv.quantity).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
          <CardDescription>
            Recent movements and transactions for this pallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No movement history
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((movement: any) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      {format(new Date(movement.created_at), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {movement.movement_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {movement.from_location?.code || '-'}
                    </TableCell>
                    <TableCell>
                      {movement.to_location?.code || '-'}
                    </TableCell>
                    <TableCell>
                      {movement.quantity_change || '-'}
                    </TableCell>
                    <TableCell>
                      {movement.performed_by_user?.full_name || 'System'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {movement.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}