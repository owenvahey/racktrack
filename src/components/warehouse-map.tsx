'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { 
  MapPin, 
  Package, 
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Grid3x3,
  Layers
} from 'lucide-react'
import Link from 'next/link'

interface WarehouseMapProps {
  warehouseId: string
}

interface AisleData {
  id: string
  code: string
  name: string | null
  description: string | null
  shelves: {
    id: string
    code: string
    level_number: number
    storage_slots: {
      id: string
      is_occupied: boolean
      zone: string | null
    }[]
  }[]
}

export function WarehouseMap({ warehouseId }: WarehouseMapProps) {
  const supabase = createClient()
  const [zoom, setZoom] = useState(1)
  const [selectedAisle, setSelectedAisle] = useState<string | null>(null)

  // Fetch warehouse data with aisles
  const { data: warehouseData, isLoading } = useQuery({
    queryKey: ['warehouse-map', warehouseId],
    queryFn: async () => {
      const { data: warehouse } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', warehouseId)
        .single()

      const { data: aisles } = await supabase
        .from('aisles')
        .select(`
          *,
          shelves(
            id,
            code,
            level_number,
            storage_slots(
              id,
              is_occupied,
              zone
            )
          )
        `)
        .eq('warehouse_id', warehouseId)
        .eq('is_active', true)
        .order('code')

      return { warehouse, aisles: aisles || [] }
    },
  })

  const getAisleStats = (aisle: AisleData) => {
    let totalSlots = 0
    let occupiedSlots = 0
    const zones = new Set<string>()

    aisle.shelves?.forEach(shelf => {
      shelf.storage_slots?.forEach(slot => {
        totalSlots++
        if (slot.is_occupied) occupiedSlots++
        if (slot.zone) zones.add(slot.zone)
      })
    })

    const occupancyRate = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0

    return {
      totalSlots,
      occupiedSlots,
      availableSlots: totalSlots - occupiedSlots,
      occupancyRate,
      zones: Array.from(zones),
      shelfCount: aisle.shelves?.length || 0
    }
  }

  const getAisleColor = (occupancyRate: number) => {
    if (occupancyRate >= 90) return 'bg-red-500 hover:bg-red-600'
    if (occupancyRate >= 75) return 'bg-orange-500 hover:bg-orange-600'
    if (occupancyRate >= 50) return 'bg-yellow-500 hover:bg-yellow-600'
    return 'bg-green-500 hover:bg-green-600'
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5))
  const handleReset = () => {
    setZoom(1)
    setSelectedAisle(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const { warehouse, aisles } = warehouseData || { warehouse: null, aisles: [] }

  if (!warehouse || aisles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <MapPin className="h-12 w-12 mb-4" />
        <p className="text-lg">No aisles configured for this warehouse</p>
        <Link href="/locations/configure" className="mt-4">
          <Button>Configure Aisles</Button>
        </Link>
      </div>
    )
  }

  // Calculate grid dimensions based on aisle codes
  const aisleLetters = new Set(aisles.map(a => a.code.charAt(0)))
  const aisleNumbers = new Set(aisles.map(a => parseInt(a.code.slice(1)) || 1))
  const rows = aisleLetters.size
  const cols = Math.max(...Array.from(aisleNumbers))

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= 2}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground ml-2">
            Zoom: {Math.round(zoom * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span>0-50%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded" />
            <span>50-75%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded" />
            <span>75-90%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded" />
            <span>90%+</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="border rounded-lg p-8 bg-gray-50 overflow-auto">
        <div 
          className="mx-auto transition-transform duration-200"
          style={{ 
            transform: `scale(${zoom})`,
            transformOrigin: 'center top',
            maxWidth: '1200px'
          }}
        >
          {/* Warehouse Layout Grid */}
          <div className="relative">
            {/* Zone Labels */}
            <div className="absolute -top-6 left-0 right-0 flex justify-around text-sm text-muted-foreground">
              <span>Receiving</span>
              <span>Storage</span>
              <span>Picking</span>
              <span>Shipping</span>
            </div>

            {/* Main Grid */}
            <div 
              className="grid gap-4 p-8 bg-white rounded-lg shadow-sm"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(120px, 1fr))`,
              }}
            >
              <TooltipProvider>
                {aisles.map((aisle) => {
                  const stats = getAisleStats(aisle)
                  const isSelected = selectedAisle === aisle.id

                  return (
                    <Tooltip key={aisle.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSelectedAisle(aisle.id)}
                          className={`
                            relative p-4 rounded-lg border-2 transition-all
                            ${getAisleColor(stats.occupancyRate)}
                            ${isSelected ? 'ring-4 ring-blue-400 scale-105' : ''}
                            text-white font-medium
                          `}
                        >
                          <div className="text-lg font-bold">{aisle.code}</div>
                          <div className="text-sm opacity-90">{stats.occupancyRate}%</div>
                          <div className="absolute top-1 right-1">
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              {stats.shelfCount}
                            </Badge>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-medium">Aisle {aisle.code}</p>
                          {aisle.name && <p className="text-sm">{aisle.name}</p>}
                          <div className="text-xs space-y-1 pt-1 border-t">
                            <p>Shelves: {stats.shelfCount}</p>
                            <p>Total Slots: {stats.totalSlots}</p>
                            <p>Available: {stats.availableSlots}</p>
                            <p>Occupied: {stats.occupiedSlots}</p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </TooltipProvider>
            </div>

            {/* Dock doors indicator */}
            <div className="mt-4 flex justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-12 h-8 bg-gray-300 rounded flex items-center justify-center">
                  <span className="text-xs">IN</span>
                </div>
                <span>Receiving Docks</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Shipping Docks</span>
                <div className="w-12 h-8 bg-gray-300 rounded flex items-center justify-center">
                  <span className="text-xs">OUT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Aisle Details */}
      {selectedAisle && (
        <Card>
          <CardHeader>
            <CardTitle>Aisle Details</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const aisle = aisles.find(a => a.id === selectedAisle)
              if (!aisle) return null
              const stats = getAisleStats(aisle)

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Aisle Code</p>
                    <p className="text-lg font-medium">{aisle.code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Occupancy</p>
                    <p className="text-lg font-medium">{stats.occupancyRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Available Slots</p>
                    <p className="text-lg font-medium text-green-600">{stats.availableSlots}</p>
                  </div>
                  <div className="flex items-end">
                    <Link href={`/locations/aisle/${aisle.id}`} className="w-full">
                      <Button className="w-full">
                        View Aisle Details
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  )
}