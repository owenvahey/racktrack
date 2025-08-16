'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { 
  ArrowLeft,
  Warehouse,
  MapPin,
  Package,
  Users,
  Plus,
  Edit,
  Loader2,
  BarChart3,
  Thermometer,
  AlertTriangle,
  Grid3x3,
  Layers
} from 'lucide-react'
import Link from 'next/link'
import { WarehouseMap } from '@/components/warehouse-map'

interface WarehouseData {
  id: string
  name: string
  code: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  is_active: boolean
  created_at: string
}

interface AisleStats {
  id: string
  code: string
  name: string | null
  description: string | null
  total_shelves: number
  total_slots: number
  occupied_slots: number
  available_slots: number
  occupancy_rate: number
}

interface ZoneStats {
  zone: string
  total_slots: number
  occupied_slots: number
  occupancy_rate: number
}

export default function WarehouseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [warehouse, setWarehouse] = useState<WarehouseData | null>(null)
  const [aisleStats, setAisleStats] = useState<AisleStats[]>([])
  const [zoneStats, setZoneStats] = useState<ZoneStats[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Overall stats
  const [stats, setStats] = useState({
    totalAisles: 0,
    totalShelves: 0,
    totalSlots: 0,
    occupiedSlots: 0,
    availableSlots: 0,
    occupancyRate: 0,
    temperatureControlledSlots: 0,
    hazmatApprovedSlots: 0
  })

  useEffect(() => {
    fetchWarehouseData()
  }, [params.id])

  async function fetchWarehouseData() {
    try {
      // Fetch warehouse details
      const { data: warehouseData, error: warehouseError } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', params.id)
        .single()

      if (warehouseError) throw warehouseError
      setWarehouse(warehouseData)

      // Fetch aisle statistics
      const { data: aisles, error: aislesError } = await supabase
        .from('aisles')
        .select(`
          id,
          code,
          name,
          description,
          shelves(
            id,
            storage_slots(
              id,
              is_occupied,
              zone,
              temperature_controlled,
              hazmat_approved
            )
          )
        `)
        .eq('warehouse_id', params.id)
        .eq('is_active', true)
        .order('code')

      if (aislesError) throw aislesError

      // Process aisle stats
      const processedAisles = aisles?.map(aisle => {
        let totalSlots = 0
        let occupiedSlots = 0

        aisle.shelves?.forEach((shelf: any) => {
          shelf.storage_slots?.forEach((slot: any) => {
            totalSlots++
            if (slot.is_occupied) occupiedSlots++
          })
        })

        return {
          id: aisle.id,
          code: aisle.code,
          name: aisle.name,
          description: aisle.description,
          total_shelves: aisle.shelves?.length || 0,
          total_slots: totalSlots,
          occupied_slots: occupiedSlots,
          available_slots: totalSlots - occupiedSlots,
          occupancy_rate: totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0
        }
      }) || []

      setAisleStats(processedAisles)

      // Calculate overall stats and zone breakdown
      let totalSlots = 0
      let occupiedSlots = 0
      let temperatureControlled = 0
      let hazmatApproved = 0
      const zoneMap = new Map<string, { total: number; occupied: number }>()

      aisles?.forEach(aisle => {
        aisle.shelves?.forEach((shelf: any) => {
          shelf.storage_slots?.forEach((slot: any) => {
            totalSlots++
            if (slot.is_occupied) occupiedSlots++
            if (slot.temperature_controlled) temperatureControlled++
            if (slot.hazmat_approved) hazmatApproved++

            // Zone stats
            const zone = slot.zone || 'storage'
            const current = zoneMap.get(zone) || { total: 0, occupied: 0 }
            current.total++
            if (slot.is_occupied) current.occupied++
            zoneMap.set(zone, current)
          })
        })
      })

      // Convert zone map to array
      const zones = Array.from(zoneMap.entries()).map(([zone, data]) => ({
        zone,
        total_slots: data.total,
        occupied_slots: data.occupied,
        occupancy_rate: data.total > 0 ? Math.round((data.occupied / data.total) * 100) : 0
      }))

      setZoneStats(zones)

      setStats({
        totalAisles: aisles?.length || 0,
        totalShelves: aisles?.reduce((sum, a) => sum + (a.shelves?.length || 0), 0) || 0,
        totalSlots,
        occupiedSlots,
        availableSlots: totalSlots - occupiedSlots,
        occupancyRate: totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0,
        temperatureControlledSlots: temperatureControlled,
        hazmatApprovedSlots: hazmatApproved
      })

    } catch (error) {
      console.error('Error fetching warehouse data:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch warehouse details',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return 'text-red-600'
    if (rate >= 75) return 'text-orange-600'
    if (rate >= 50) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getOccupancyBadgeVariant = (rate: number): "default" | "secondary" | "destructive" | "outline" => {
    if (rate >= 90) return 'destructive'
    if (rate >= 75) return 'secondary'
    return 'default'
  }

  const getZoneIcon = (zone: string) => {
    switch (zone) {
      case 'receiving': return '📥'
      case 'storage': return '📦'
      case 'picking': return '🏭'
      case 'shipping': return '📤'
      default: return '📍'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!warehouse) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Warehouse className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">Warehouse not found</p>
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
            onClick={() => router.push('/locations')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{warehouse.name}</h1>
              <Badge variant="outline" className="font-mono">
                {warehouse.code}
              </Badge>
              {warehouse.is_active ? (
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              ) : (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </div>
            {warehouse.address && (
              <p className="text-muted-foreground mt-1">
                {warehouse.address}, {warehouse.city}, {warehouse.state} {warehouse.zip_code}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Link href="/locations/configure">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Configure Locations
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSlots}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalAisles} aisles • {stats.totalShelves} shelves
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getOccupancyColor(stats.occupancyRate)}`}>
              {stats.occupancyRate}%
            </div>
            <Progress value={stats.occupancyRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Available Slots</CardTitle>
              <Package className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.availableSlots}</div>
            <p className="text-xs text-muted-foreground">
              {stats.occupiedSlots} occupied
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Special Storage</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Thermometer className="h-3 w-3" />
                  Temp Control
                </span>
                <span className="font-medium">{stats.temperatureControlledSlots}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Hazmat
                </span>
                <span className="font-medium">{stats.hazmatApprovedSlots}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="aisles">Aisles ({stats.totalAisles})</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="map">Layout Map</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Zone Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Zone Breakdown</CardTitle>
                <CardDescription>
                  Storage distribution across warehouse zones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {zoneStats.map((zone) => (
                    <div key={zone.zone} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium capitalize">
                          <span className="text-lg">{getZoneIcon(zone.zone)}</span>
                          {zone.zone}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {zone.occupied_slots}/{zone.total_slots} slots
                        </span>
                      </div>
                      <Progress value={zone.occupancy_rate} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Utilized Aisles */}
            <Card>
              <CardHeader>
                <CardTitle>Aisle Utilization</CardTitle>
                <CardDescription>
                  Most and least utilized aisles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aisleStats
                    .sort((a, b) => b.occupancy_rate - a.occupancy_rate)
                    .slice(0, 5)
                    .map((aisle) => (
                      <div key={aisle.id} className="flex items-center justify-between">
                        <Link 
                          href={`/locations/aisle/${aisle.id}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <Grid3x3 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Aisle {aisle.code}</span>
                        </Link>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {aisle.occupied_slots}/{aisle.total_slots}
                          </span>
                          <Badge variant={getOccupancyBadgeVariant(aisle.occupancy_rate)}>
                            {aisle.occupancy_rate}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="aisles">
          <Card>
            <CardHeader>
              <CardTitle>All Aisles</CardTitle>
              <CardDescription>
                Complete list of aisles in {warehouse.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aisle Code</TableHead>
                    <TableHead>Name/Description</TableHead>
                    <TableHead>Shelves</TableHead>
                    <TableHead>Total Slots</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Occupied</TableHead>
                    <TableHead>Occupancy</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aisleStats.map((aisle) => (
                    <TableRow key={aisle.id}>
                      <TableCell className="font-medium">{aisle.code}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{aisle.name || '-'}</p>
                          {aisle.description && (
                            <p className="text-sm text-muted-foreground">{aisle.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{aisle.total_shelves}</TableCell>
                      <TableCell>{aisle.total_slots}</TableCell>
                      <TableCell className="text-green-600">{aisle.available_slots}</TableCell>
                      <TableCell className="text-orange-600">{aisle.occupied_slots}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={aisle.occupancy_rate} className="w-16" />
                          <span className="text-sm font-medium">{aisle.occupancy_rate}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/locations/aisle/${aisle.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          <Link href={`/locations/aisle/${aisle.id}/configure`}>
                            <Button variant="ghost" size="sm">
                              Configure
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zones">
          <Card>
            <CardHeader>
              <CardTitle>Zone Management</CardTitle>
              <CardDescription>
                Warehouse zones and their utilization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {zoneStats.map((zone) => (
                  <Card key={zone.zone}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 capitalize">
                          <span className="text-2xl">{getZoneIcon(zone.zone)}</span>
                          {zone.zone} Zone
                        </CardTitle>
                        <Badge variant={getOccupancyBadgeVariant(zone.occupancy_rate)}>
                          {zone.occupancy_rate}% Full
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Locations</span>
                          <span className="font-medium">{zone.total_slots}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Available</span>
                          <span className="font-medium text-green-600">
                            {zone.total_slots - zone.occupied_slots}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Occupied</span>
                          <span className="font-medium text-orange-600">{zone.occupied_slots}</span>
                        </div>
                        <Progress value={zone.occupancy_rate} className="mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Layout</CardTitle>
              <CardDescription>
                Visual representation of the warehouse floor plan with real-time occupancy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WarehouseMap warehouseId={params.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}