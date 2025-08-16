'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  ArrowLeft,
  MapPin,
  Package,
  Loader2,
  Edit,
  AlertCircle,
  Thermometer,
  AlertTriangle,
  Move,
  Grid3x3,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'

interface ZoneStats {
  zone: string
  warehouse_id: string
  warehouse_name: string
  total_slots: number
  occupied_slots: number
  available_slots: number
  occupancy_rate: number
  temperature_controlled: number
  hazmat_approved: number
}

interface BulkUpdateForm {
  warehouse_id: string
  from_zone: string
  to_zone: string
  filter_occupied: 'all' | 'occupied' | 'available'
}

const ZONE_CONFIG = {
  receiving: {
    icon: '📥',
    color: 'bg-blue-100 text-blue-700',
    description: 'Incoming goods staging area'
  },
  storage: {
    icon: '📦',
    color: 'bg-green-100 text-green-700',
    description: 'Long-term storage area'
  },
  picking: {
    icon: '🏭',
    color: 'bg-yellow-100 text-yellow-700',
    description: 'Order fulfillment staging'
  },
  shipping: {
    icon: '📤',
    color: 'bg-purple-100 text-purple-700',
    description: 'Outbound goods staging area'
  }
}

export default function ZonesPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [showBulkUpdate, setShowBulkUpdate] = useState(false)
  const [bulkUpdateForm, setBulkUpdateForm] = useState<BulkUpdateForm>({
    warehouse_id: '',
    from_zone: '',
    to_zone: '',
    filter_occupied: 'all'
  })

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-zones'],
    queryFn: async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('*')
        .eq('is_active', true)
        .order('name')

      return data || []
    },
  })

  // Fetch zone statistics
  const { data: zoneStats = [], isLoading } = useQuery({
    queryKey: ['zone-stats', selectedWarehouse],
    queryFn: async () => {
      let query = supabase
        .from('storage_slots')
        .select(`
          zone,
          is_occupied,
          temperature_controlled,
          hazmat_approved,
          shelf:shelves!inner(
            aisle:aisles!inner(
              warehouse_id,
              warehouse:warehouses(name)
            )
          )
        `)
        .eq('is_active', true)

      if (selectedWarehouse) {
        query = query.eq('shelf.aisle.warehouse_id', selectedWarehouse)
      }

      const { data, error } = await query

      if (error) throw error

      // Process data into zone statistics
      const statsMap = new Map<string, ZoneStats>()

      data?.forEach(slot => {
        const zone = slot.zone || 'storage'
        const warehouseId = slot.shelf.aisle.warehouse_id
        const warehouseName = slot.shelf.aisle.warehouse.name
        const key = `${warehouseId}-${zone}`

        if (!statsMap.has(key)) {
          statsMap.set(key, {
            zone,
            warehouse_id: warehouseId,
            warehouse_name: warehouseName,
            total_slots: 0,
            occupied_slots: 0,
            available_slots: 0,
            occupancy_rate: 0,
            temperature_controlled: 0,
            hazmat_approved: 0
          })
        }

        const stats = statsMap.get(key)!
        stats.total_slots++
        if (slot.is_occupied) stats.occupied_slots++
        if (slot.temperature_controlled) stats.temperature_controlled++
        if (slot.hazmat_approved) stats.hazmat_approved++
      })

      // Calculate final stats
      return Array.from(statsMap.values()).map(stats => ({
        ...stats,
        available_slots: stats.total_slots - stats.occupied_slots,
        occupancy_rate: stats.total_slots > 0 
          ? Math.round((stats.occupied_slots / stats.total_slots) * 100)
          : 0
      }))
    },
  })

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (form: BulkUpdateForm) => {
      // First get the slots to update
      let query = supabase
        .from('storage_slots')
        .select('id, shelf:shelves!inner(aisle:aisles!inner(warehouse_id))')
        .eq('zone', form.from_zone)
        .eq('shelf.aisle.warehouse_id', form.warehouse_id)

      if (form.filter_occupied === 'occupied') {
        query = query.eq('is_occupied', true)
      } else if (form.filter_occupied === 'available') {
        query = query.eq('is_occupied', false)
      }

      const { data: slots, error: fetchError } = await query
      if (fetchError) throw fetchError

      if (!slots || slots.length === 0) {
        throw new Error('No slots found matching criteria')
      }

      // Update the slots
      const slotIds = slots.map(s => s.id)
      const { error: updateError } = await supabase
        .from('storage_slots')
        .update({ zone: form.to_zone })
        .in('id', slotIds)

      if (updateError) throw updateError

      return slots.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['zone-stats'] })
      toast.success(`Updated ${count} locations to new zone`)
      setShowBulkUpdate(false)
      setBulkUpdateForm({
        warehouse_id: '',
        from_zone: '',
        to_zone: '',
        filter_occupied: 'all'
      })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update zones')
    },
  })

  // Group stats by warehouse
  const statsByWarehouse = zoneStats.reduce((acc, stat) => {
    if (!acc[stat.warehouse_id]) {
      acc[stat.warehouse_id] = {
        warehouse_name: stat.warehouse_name,
        zones: []
      }
    }
    acc[stat.warehouse_id].zones.push(stat)
    return acc
  }, {} as Record<string, { warehouse_name: string; zones: ZoneStats[] }>)

  // Calculate overall zone totals
  const overallStats = Object.keys(ZONE_CONFIG).map(zone => {
    const stats = zoneStats.filter(s => s.zone === zone)
    return {
      zone,
      total_slots: stats.reduce((sum, s) => sum + s.total_slots, 0),
      occupied_slots: stats.reduce((sum, s) => sum + s.occupied_slots, 0),
      available_slots: stats.reduce((sum, s) => sum + s.available_slots, 0),
      occupancy_rate: 0
    }
  }).map(stat => ({
    ...stat,
    occupancy_rate: stat.total_slots > 0 
      ? Math.round((stat.occupied_slots / stat.total_slots) * 100)
      : 0
  }))

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
          <h1 className="text-3xl font-bold">Zone Management</h1>
          <p className="text-muted-foreground">
            Manage warehouse zones and location assignments
          </p>
        </div>
        <Button onClick={() => setShowBulkUpdate(true)}>
          <Move className="h-4 w-4 mr-2" />
          Bulk Zone Update
        </Button>
      </div>

      {/* Zone Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {overallStats.map(stat => {
          const config = ZONE_CONFIG[stat.zone as keyof typeof ZONE_CONFIG]
          return (
            <Card key={stat.zone}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium capitalize">
                    {stat.zone} Zone
                  </CardTitle>
                  <span className="text-2xl">{config.icon}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">{stat.total_slots}</div>
                <p className="text-xs text-muted-foreground mb-3">{config.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Available</span>
                    <span className="font-medium">{stat.available_slots}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-600">Occupied</span>
                    <span className="font-medium">{stat.occupied_slots}</span>
                  </div>
                  <Progress value={stat.occupancy_rate} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filter by Warehouse */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Zone Distribution by Warehouse</CardTitle>
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger className="w-[200px]">
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : Object.entries(statsByWarehouse).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p className="text-lg">No zone data found</p>
              <p className="text-sm">Configure storage locations to see zone distribution</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(statsByWarehouse).map(([warehouseId, data]) => (
                <div key={warehouseId} className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {data.warehouse_name}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.zones.map(zone => {
                      const config = ZONE_CONFIG[zone.zone as keyof typeof ZONE_CONFIG] || {
                        icon: '📍',
                        color: 'bg-gray-100 text-gray-700',
                        description: 'Custom zone'
                      }
                      return (
                        <Card key={`${warehouseId}-${zone.zone}`} className="border-l-4" style={{borderLeftColor: config.color.includes('blue') ? '#3b82f6' : config.color.includes('green') ? '#10b981' : config.color.includes('yellow') ? '#f59e0b' : '#8b5cf6'}}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base capitalize flex items-center gap-2">
                                <span>{config.icon}</span>
                                {zone.zone}
                              </CardTitle>
                              <Badge variant="outline">
                                {zone.occupancy_rate}%
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Total</p>
                                  <p className="font-medium">{zone.total_slots}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Available</p>
                                  <p className="font-medium text-green-600">{zone.available_slots}</p>
                                </div>
                              </div>
                              <Progress value={zone.occupancy_rate} className="h-2" />
                              {(zone.temperature_controlled > 0 || zone.hazmat_approved > 0) && (
                                <div className="flex gap-2 text-xs">
                                  {zone.temperature_controlled > 0 && (
                                    <Badge variant="secondary" className="gap-1">
                                      <Thermometer className="h-3 w-3" />
                                      {zone.temperature_controlled}
                                    </Badge>
                                  )}
                                  {zone.hazmat_approved > 0 && (
                                    <Badge variant="secondary" className="gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      {zone.hazmat_approved}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Update Dialog */}
      <Dialog open={showBulkUpdate} onOpenChange={setShowBulkUpdate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Zone Update</DialogTitle>
            <DialogDescription>
              Move multiple locations from one zone to another
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Select
                value={bulkUpdateForm.warehouse_id}
                onValueChange={(value) => setBulkUpdateForm({ ...bulkUpdateForm, warehouse_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Zone</Label>
                <Select
                  value={bulkUpdateForm.from_zone}
                  onValueChange={(value) => setBulkUpdateForm({ ...bulkUpdateForm, from_zone: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ZONE_CONFIG).map(zone => (
                      <SelectItem key={zone} value={zone} className="capitalize">
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>To Zone</Label>
                <Select
                  value={bulkUpdateForm.to_zone}
                  onValueChange={(value) => setBulkUpdateForm({ ...bulkUpdateForm, to_zone: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ZONE_CONFIG)
                      .filter(zone => zone !== bulkUpdateForm.from_zone)
                      .map(zone => (
                        <SelectItem key={zone} value={zone} className="capitalize">
                          {zone}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Filter Locations</Label>
              <Select
                value={bulkUpdateForm.filter_occupied}
                onValueChange={(value) => setBulkUpdateForm({ ...bulkUpdateForm, filter_occupied: value as any })}
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

            {bulkUpdateForm.warehouse_id && bulkUpdateForm.from_zone && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will update all {bulkUpdateForm.filter_occupied !== 'all' ? bulkUpdateForm.filter_occupied : ''} 
                  {' '}locations in the {bulkUpdateForm.from_zone} zone to {bulkUpdateForm.to_zone || 'the selected'} zone.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkUpdate(false)}
              disabled={bulkUpdateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => bulkUpdateMutation.mutate(bulkUpdateForm)}
              disabled={
                !bulkUpdateForm.warehouse_id || 
                !bulkUpdateForm.from_zone || 
                !bulkUpdateForm.to_zone ||
                bulkUpdateMutation.isPending
              }
            >
              {bulkUpdateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Zones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}