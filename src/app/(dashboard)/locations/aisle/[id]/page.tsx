'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { 
  ArrowLeft,
  Grid3x3,
  Package,
  Edit,
  Plus,
  Loader2,
  MapPin,
  Weight,
  Ruler,
  Thermometer,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Move,
  Trash2
} from 'lucide-react'
import Link from 'next/link'

interface AisleData {
  id: string
  code: string
  name: string | null
  description: string | null
  warehouse: {
    id: string
    name: string
    code: string
  }
}

interface Shelf {
  id: string
  code: string
  level_number: number
  height_cm: number
  weight_capacity_kg: number
  storage_slots: StorageSlot[]
}

interface StorageSlot {
  id: string
  code: string
  position_number: number
  is_occupied: boolean
  current_pallet_id: string | null
  zone: string | null
  temperature_controlled: boolean
  hazmat_approved: boolean
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  weight_capacity_kg: number | null
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

interface SlotDetails {
  slot: StorageSlot
  shelf: Shelf
}

export default function AisleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const resolvedParams = use(params)
  const [aisle, setAisle] = useState<AisleData | null>(null)
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<SlotDetails | null>(null)
  const [showSlotDialog, setShowSlotDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterZone, setFilterZone] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Stats
  const [stats, setStats] = useState({
    totalSlots: 0,
    occupiedSlots: 0,
    availableSlots: 0,
    occupancyRate: 0,
    zones: [] as string[],
    temperatureControlled: 0,
    hazmatApproved: 0
  })

  useEffect(() => {
    fetchAisleData()
  }, [resolvedParams.id])

  async function fetchAisleData() {
    try {
      // Fetch aisle details
      const { data: aisleData, error: aisleError } = await supabase
        .from('aisles')
        .select(`
          *,
          warehouse:warehouses(id, name, code)
        `)
        .eq('id', resolvedParams.id)
        .single()

      if (aisleError) throw aisleError
      setAisle(aisleData)

      // Fetch shelves with slots and pallet info
      const { data: shelvesData, error: shelvesError } = await supabase
        .from('shelves')
        .select(`
          *,
          storage_slots(
            *,
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
        .eq('aisle_id', resolvedParams.id)
        .eq('is_active', true)
        .order('level_number')

      if (shelvesError) throw shelvesError

      setShelves(shelvesData || [])

      // Calculate stats
      let totalSlots = 0
      let occupiedSlots = 0
      let temperatureControlled = 0
      let hazmatApproved = 0
      const zonesSet = new Set<string>()

      shelvesData?.forEach(shelf => {
        shelf.storage_slots?.forEach((slot: StorageSlot) => {
          totalSlots++
          if (slot.is_occupied) occupiedSlots++
          if (slot.temperature_controlled) temperatureControlled++
          if (slot.hazmat_approved) hazmatApproved++
          if (slot.zone) zonesSet.add(slot.zone)
        })
      })

      setStats({
        totalSlots,
        occupiedSlots,
        availableSlots: totalSlots - occupiedSlots,
        occupancyRate: totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0,
        zones: Array.from(zonesSet),
        temperatureControlled,
        hazmatApproved
      })

    } catch (error) {
      console.error('Error fetching aisle data:', error)
      toast.error('Failed to fetch aisle details')
    } finally {
      setLoading(false)
    }
  }

  function getSlotColor(slot: StorageSlot) {
    if (!slot.is_occupied) return 'bg-green-100 hover:bg-green-200 border-green-300'
    if (slot.pallet?.status === 'picking') return 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300'
    if (slot.pallet?.status === 'staged') return 'bg-blue-100 hover:bg-blue-200 border-blue-300'
    return 'bg-orange-100 hover:bg-orange-200 border-orange-300'
  }

  function getSlotIcon(slot: StorageSlot) {
    if (!slot.is_occupied) return null
    if (slot.temperature_controlled) return '❄️'
    if (slot.hazmat_approved) return '⚠️'
    return '📦'
  }

  function openSlotDetails(slot: StorageSlot, shelf: Shelf) {
    setSelectedSlot({ slot, shelf })
    setShowSlotDialog(true)
  }

  async function toggleSlotOccupancy() {
    if (!selectedSlot) return

    try {
      const { error } = await supabase
        .from('storage_slots')
        .update({ 
          is_occupied: !selectedSlot.slot.is_occupied,
          current_pallet_id: null 
        })
        .eq('id', selectedSlot.slot.id)

      if (error) throw error

      toast.success(`Slot marked as ${selectedSlot.slot.is_occupied ? 'available' : 'occupied'}`)

      setShowSlotDialog(false)
      fetchAisleData()
    } catch (error) {
      toast.error('Failed to update slot status')
    }
  }

  const filteredShelves = shelves.map(shelf => ({
    ...shelf,
    storage_slots: shelf.storage_slots.filter(slot => {
      // Search filter
      if (searchTerm && !slot.code.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      // Zone filter
      if (filterZone !== 'all' && slot.zone !== filterZone) {
        return false
      }
      // Status filter
      if (filterStatus === 'available' && slot.is_occupied) return false
      if (filterStatus === 'occupied' && !slot.is_occupied) return false
      
      return true
    })
  })).filter(shelf => shelf.storage_slots.length > 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!aisle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Grid3x3 className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">Aisle not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/locations')}
        >
          Back to Locations
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/locations/warehouse/${aisle.warehouse.id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Aisle {aisle.code}</h1>
              {aisle.name && (
                <Badge variant="outline">{aisle.name}</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {aisle.warehouse.name} ({aisle.warehouse.code}) {aisle.description && `• ${aisle.description}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit Aisle
          </Button>
          <Link href={`/locations/aisle/${aisle.id}/configure`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Configure Shelves
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Slots</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSlots}</div>
            <p className="text-xs text-muted-foreground">
              {shelves.length} shelves
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Occupancy</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.occupancyRate}%</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-600">{stats.availableSlots} free</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-orange-600">{stats.occupiedSlots} used</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Zones</CardTitle>
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.zones.length || 1}</div>
            <p className="text-xs text-muted-foreground">
              {stats.zones.join(', ') || 'storage'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Temperature</CardTitle>
              <Thermometer className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.temperatureControlled}</div>
            <p className="text-xs text-muted-foreground">
              controlled slots
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Hazmat</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.hazmatApproved}</div>
            <p className="text-xs text-muted-foreground">
              approved slots
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Slot Management</CardTitle>
          <CardDescription>
            Click on any slot to view details or manage inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search slot code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              className="px-3 py-2 border rounded-md"
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
            >
              <option value="all">All Zones</option>
              {stats.zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 border rounded-md"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="available">Available Only</option>
              <option value="occupied">Occupied Only</option>
            </select>
          </div>

          <div className="flex items-center gap-4 text-sm mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded" />
              <span>Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" />
              <span>Picking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded" />
              <span>Staged</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Shelf Grid */}
      <div className="space-y-6">
        {filteredShelves.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No slots match your filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredShelves
            .sort((a, b) => b.level_number - a.level_number)
            .map((shelf) => (
              <Card key={shelf.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Level {shelf.level_number}</span>
                      Shelf {shelf.code}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Ruler className="h-3 w-3" />
                        {shelf.height_cm}cm
                      </span>
                      <span className="flex items-center gap-1">
                        <Weight className="h-3 w-3" />
                        {shelf.weight_capacity_kg}kg
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    <TooltipProvider>
                      {shelf.storage_slots
                        .sort((a, b) => a.position_number - b.position_number)
                        .map((slot) => (
                          <Tooltip key={slot.id}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => openSlotDetails(slot, shelf)}
                                className={`
                                  relative p-3 rounded-lg border-2 transition-all
                                  ${getSlotColor(slot)}
                                  flex flex-col items-center justify-center
                                  hover:shadow-md hover:scale-105
                                `}
                              >
                                <div className="text-xs font-bold">{slot.code}</div>
                                {slot.is_occupied && (
                                  <div className="text-lg mt-1">{getSlotIcon(slot)}</div>
                                )}
                                {slot.is_occupied && slot.pallet && (
                                  <div className="text-xs mt-1 text-center truncate w-full">
                                    {slot.pallet.pallet_number.split('-').pop()}
                                  </div>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-medium">{slot.code}</p>
                                {slot.is_occupied ? (
                                  <>
                                    <p>Pallet: {slot.pallet?.pallet_number}</p>
                                    <p>Status: {slot.pallet?.status}</p>
                                    {slot.pallet?.contents?.[0] && (
                                      <p>Product: {slot.pallet.contents[0].product.name}</p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-green-600">Available</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>

      {/* Slot Details Dialog */}
      <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Slot {selectedSlot?.slot.code}</DialogTitle>
            <DialogDescription>
              Shelf {selectedSlot?.shelf.code} • Level {selectedSlot?.shelf.level_number}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSlot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={selectedSlot.slot.is_occupied ? 'secondary' : 'default'}>
                      {selectedSlot.slot.is_occupied ? 'Occupied' : 'Available'}
                    </Badge>
                    {selectedSlot.slot.temperature_controlled && (
                      <Badge variant="outline">
                        <Thermometer className="h-3 w-3 mr-1" />
                        Temp Controlled
                      </Badge>
                    )}
                    {selectedSlot.slot.hazmat_approved && (
                      <Badge variant="outline">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Hazmat
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Zone</Label>
                  <p className="capitalize">{selectedSlot.slot.zone || 'storage'}</p>
                </div>
              </div>

              {selectedSlot.slot.is_occupied && selectedSlot.slot.pallet && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Current Pallet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pallet Number</span>
                        <span className="font-medium">{selectedSlot.slot.pallet.pallet_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge>{selectedSlot.slot.pallet.status}</Badge>
                      </div>
                      {selectedSlot.slot.pallet.contents?.map((content, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            {content.product.name} ({content.product.sku})
                          </span>
                          <span className="font-medium">{content.total_units} units</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Slot Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Dimensions (L×W×H)</span>
                      <p className="font-medium">
                        {selectedSlot.slot.length_cm || selectedSlot.shelf.height_cm} × 
                        {selectedSlot.slot.width_cm || '-'} × 
                        {selectedSlot.slot.height_cm || selectedSlot.shelf.height_cm} cm
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Weight Capacity</span>
                      <p className="font-medium">
                        {selectedSlot.slot.weight_capacity_kg || 
                         Math.floor(selectedSlot.shelf.weight_capacity_kg / selectedSlot.shelf.storage_slots.length)} kg
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSlotDialog(false)}>
              Close
            </Button>
            {selectedSlot?.slot.is_occupied ? (
              <>
                <Link href={`/inventory/pallets/${selectedSlot.slot.current_pallet_id}`}>
                  <Button variant="outline">
                    <Eye className="mr-2 h-4 w-4" />
                    View Pallet
                  </Button>
                </Link>
                <Link href={`/inventory/pallets/move?pallet=${selectedSlot.slot.current_pallet_id}`}>
                  <Button variant="outline">
                    <Move className="mr-2 h-4 w-4" />
                    Move Pallet
                  </Button>
                </Link>
                <Button onClick={toggleSlotOccupancy} variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Mark as Empty
                </Button>
              </>
            ) : (
              <Button onClick={toggleSlotOccupancy}>
                <Package className="mr-2 h-4 w-4" />
                Mark as Occupied
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}