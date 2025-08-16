'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { 
  Search, 
  Filter,
  MapPin,
  Package,
  ArrowLeft,
  Loader2,
  Download,
  Eye,
  Edit,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'

interface LocationResult {
  id: string
  full_location: string
  is_occupied: boolean
  current_pallet_id: string | null
  zone: string | null
  warehouse_id: string
  warehouse_name: string
  aisle_id: string
  aisle_code: string
  shelf_id: string
  shelf_code: string
  level_number: number
  slot_code: string
  position_number: number
  temperature_controlled?: boolean
  hazmat_approved?: boolean
  pallet?: {
    pallet_number: string
    status: string
    contents?: Array<{
      product: {
        name: string
        sku: string
      }
      total_units: number
    }>
  }
}

export default function LocationSearchPage() {
  const router = useRouter()
  const supabase = createClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    warehouse_id: '',
    zone: 'all',
    occupancy: 'all',
    temperature_controlled: false,
    hazmat_approved: false,
  })
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-search'],
    queryFn: async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('*')
        .eq('is_active', true)
        .order('name')

      return data || []
    },
  })

  // Search locations
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['location-search', debouncedSearch, filters],
    queryFn: async () => {
      let query = supabase
        .from('storage_locations')
        .select(`
          *,
          storage_slots!inner(
            temperature_controlled,
            hazmat_approved,
            current_pallet_id,
            pallet:pallets(
              pallet_number,
              status,
              pallet_contents(
                total_units,
                product:products(name, sku)
              )
            )
          )
        `)

      // Apply search filter
      if (debouncedSearch) {
        query = query.or(`
          full_location.ilike.%${debouncedSearch}%,
          aisle_code.ilike.%${debouncedSearch}%,
          shelf_code.ilike.%${debouncedSearch}%,
          slot_code.ilike.%${debouncedSearch}%
        `)
      }

      // Apply warehouse filter
      if (filters.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id)
      }

      // Apply zone filter
      if (filters.zone !== 'all') {
        query = query.eq('zone', filters.zone)
      }

      // Apply occupancy filter
      if (filters.occupancy === 'available') {
        query = query.eq('is_occupied', false)
      } else if (filters.occupancy === 'occupied') {
        query = query.eq('is_occupied', true)
      }

      // Apply special storage filters
      if (filters.temperature_controlled) {
        query = query.eq('storage_slots.temperature_controlled', true)
      }
      if (filters.hazmat_approved) {
        query = query.eq('storage_slots.hazmat_approved', true)
      }

      const { data, error } = await query
        .order('full_location')
        .limit(100)

      if (error) throw error

      // Map the results to include nested data
      return (data || []).map(location => ({
        ...location,
        temperature_controlled: location.storage_slots?.temperature_controlled,
        hazmat_approved: location.storage_slots?.hazmat_approved,
        pallet: location.storage_slots?.pallet
      }))
    },
    enabled: debouncedSearch.length > 0 || Object.values(filters).some(v => v !== '' && v !== 'all' && v !== false),
  })

  const exportResults = () => {
    const csv = [
      ['Location', 'Warehouse', 'Aisle', 'Shelf', 'Slot', 'Status', 'Zone', 'Pallet', 'Product'],
      ...results.map(loc => [
        loc.full_location,
        loc.warehouse_name,
        loc.aisle_code,
        loc.shelf_code,
        loc.slot_code,
        loc.is_occupied ? 'Occupied' : 'Available',
        loc.zone || 'N/A',
        loc.pallet?.pallet_number || '',
        loc.pallet?.contents?.[0]?.product.name || ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `locations-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
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
        <div>
          <h1 className="text-3xl font-bold">Location Search</h1>
          <p className="text-muted-foreground">
            Search and filter storage locations across all warehouses
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by location code, aisle, shelf, or slot..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Select
                value={filters.warehouse_id}
                onValueChange={(value) => setFilters({ ...filters, warehouse_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Zone</Label>
              <Select
                value={filters.zone}
                onValueChange={(value) => setFilters({ ...filters, zone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All zones</SelectItem>
                  <SelectItem value="receiving">Receiving</SelectItem>
                  <SelectItem value="storage">Storage</SelectItem>
                  <SelectItem value="picking">Picking</SelectItem>
                  <SelectItem value="shipping">Shipping</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Occupancy</Label>
              <Select
                value={filters.occupancy}
                onValueChange={(value) => setFilters({ ...filters, occupancy: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  <SelectItem value="available">Available only</SelectItem>
                  <SelectItem value="occupied">Occupied only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Special Storage</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="temp"
                    checked={filters.temperature_controlled}
                    onCheckedChange={(checked) => 
                      setFilters({ ...filters, temperature_controlled: checked as boolean })
                    }
                  />
                  <Label htmlFor="temp" className="text-sm cursor-pointer">
                    Temperature Controlled
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hazmat"
                    checked={filters.hazmat_approved}
                    onCheckedChange={(checked) => 
                      setFilters({ ...filters, hazmat_approved: checked as boolean })
                    }
                  />
                  <Label htmlFor="hazmat" className="text-sm cursor-pointer">
                    Hazmat Approved
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Search Results</CardTitle>
              <CardDescription>
                {results.length > 0 
                  ? `Found ${results.length} locations${results.length === 100 ? ' (limited to 100)' : ''}`
                  : 'Enter search criteria to find locations'
                }
              </CardDescription>
            </div>
            {results.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportResults}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : results.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pallet/Product</TableHead>
                    <TableHead>Special</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-mono font-medium">
                        {location.full_location}
                      </TableCell>
                      <TableCell>{location.warehouse_name}</TableCell>
                      <TableCell>Level {location.level_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {location.zone || 'storage'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={location.is_occupied ? "secondary" : "default"}
                        >
                          {location.is_occupied ? 'Occupied' : 'Available'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {location.pallet ? (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{location.pallet.pallet_number}</p>
                            {location.pallet.contents?.[0] && (
                              <p className="text-xs text-muted-foreground">
                                {location.pallet.contents[0].product.name}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {location.temperature_controlled && (
                            <Badge variant="outline" className="text-xs">❄️</Badge>
                          )}
                          {location.hazmat_approved && (
                            <Badge variant="outline" className="text-xs">⚠️</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/locations/aisle/${location.aisle_id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {location.current_pallet_id && (
                            <Link href={`/inventory/pallets/${location.current_pallet_id}`}>
                              <Button variant="ghost" size="sm">
                                <Package className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : !isLoading && (searchTerm || Object.values(filters).some(v => v !== '' && v !== 'all' && v !== false)) ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p className="text-lg">No locations found</p>
              <p className="text-sm">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mb-4" />
              <p className="text-lg">Search for locations</p>
              <p className="text-sm">Enter a search term or select filters to begin</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}