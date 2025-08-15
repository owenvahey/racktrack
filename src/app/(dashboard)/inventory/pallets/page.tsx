'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Search, Package2, MapPin, Calendar, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

type PalletStatus = 'receiving' | 'in_transit' | 'stored' | 'picking' | 'staged' | 'shipped'

const statusColors: Record<PalletStatus, string> = {
  receiving: 'bg-yellow-100 text-yellow-800',
  in_transit: 'bg-blue-100 text-blue-800',
  stored: 'bg-green-100 text-green-800',
  picking: 'bg-orange-100 text-orange-800',
  staged: 'bg-purple-100 text-purple-800',
  shipped: 'bg-gray-100 text-gray-800',
}

export default function PalletsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const supabase = createClient()

  // Fetch pallets with location info
  const { data: pallets = [], isLoading } = useQuery({
    queryKey: ['pallets', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('pallets')
        .select(`
          *,
          current_location:storage_slots!pallets_current_location_id_fkey(
            id,
            code,
            shelf:shelves(
              code,
              aisle:aisles(
                code,
                warehouse:warehouses(name)
              )
            )
          ),
          inventory(
            id,
            quantity,
            product:products(name, sku)
          )
        `)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data } = await query
      return data || []
    },
  })

  // Filter pallets based on search
  const filteredPallets = pallets.filter(pallet => {
    const searchLower = search.toLowerCase()
    return (
      pallet.pallet_number.toLowerCase().includes(searchLower) ||
      pallet.qr_code?.toLowerCase().includes(searchLower) ||
      pallet.inventory?.some((inv: any) => 
        inv.product?.name.toLowerCase().includes(searchLower) ||
        inv.product?.sku.toLowerCase().includes(searchLower)
      )
    )
  })

  const getLocationString = (pallet: any) => {
    if (!pallet.current_location) return 'Unassigned'
    const loc = pallet.current_location
    const warehouse = loc.shelf?.aisle?.warehouse?.name || ''
    const aisle = loc.shelf?.aisle?.code || ''
    const shelf = loc.shelf?.code || ''
    const slot = loc.code || ''
    return `${warehouse} - ${aisle}${shelf}${slot}`
  }

  const getTotalItems = (inventory: any[]) => {
    if (!inventory || inventory.length === 0) return 0
    return inventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0)
  }

  const getProductList = (inventory: any[]) => {
    if (!inventory || inventory.length === 0) return 'Empty'
    return inventory
      .map(inv => `${inv.product?.name || 'Unknown'} (${inv.quantity})`)
      .join(', ')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pallets</h1>
          <p className="text-muted-foreground">
            Manage warehouse pallets and their contents
          </p>
        </div>
        <Link href="/inventory/pallets/move">
          <Button>Move Pallet</Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by pallet number, QR code, or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="receiving">Receiving</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="stored">Stored</SelectItem>
            <SelectItem value="picking">Picking</SelectItem>
            <SelectItem value="staged">Staged</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pallet Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Contents</TableHead>
              <TableHead>Total Items</TableHead>
              <TableHead>Last Moved</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Loading pallets...
                </TableCell>
              </TableRow>
            ) : filteredPallets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  No pallets found
                </TableCell>
              </TableRow>
            ) : (
              filteredPallets.map((pallet) => (
                <TableRow key={pallet.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Package2 className="h-4 w-4 text-muted-foreground" />
                      {pallet.pallet_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[pallet.status as PalletStatus]}>
                      {pallet.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {getLocationString(pallet)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    {getProductList(pallet.inventory)}
                  </TableCell>
                  <TableCell>
                    {getTotalItems(pallet.inventory)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {pallet.last_moved ? 
                        format(new Date(pallet.last_moved), 'MMM d, yyyy') : 
                        'Never'
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link href={`/inventory/pallets/${pallet.id}`}>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filteredPallets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <Package2 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Pallets</p>
                <p className="text-2xl font-bold">{filteredPallets.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Stored Pallets</p>
                <p className="text-2xl font-bold">
                  {filteredPallets.filter(p => p.status === 'stored').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">In Transit</p>
                <p className="text-2xl font-bold">
                  {filteredPallets.filter(p => p.status === 'in_transit').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}