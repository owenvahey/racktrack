'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Warehouse, MapPin, Package2, AlertCircle, Plus, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function LocationsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const supabase = createClient()

  // Fetch warehouse data
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('warehouses')
        .select(`
          *,
          aisles(count),
          profiles(count)
        `)
        .eq('is_active', true)
        .order('name')

      return data || []
    },
  })

  // Fetch location statistics
  const { data: stats } = useQuery({
    queryKey: ['location-stats'],
    queryFn: async () => {
      // Get total locations and occupied locations
      const { data: slots } = await supabase
        .from('storage_slots')
        .select('is_occupied')
        .eq('is_active', true)

      const total = slots?.length || 0
      const occupied = slots?.filter(s => s.is_occupied).length || 0
      const available = total - occupied

      // Get aisles count
      const { count: aisleCount } = await supabase
        .from('aisles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      // Get shelves count
      const { count: shelfCount } = await supabase
        .from('shelves')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      return {
        totalSlots: total,
        occupiedSlots: occupied,
        availableSlots: available,
        occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
        totalAisles: aisleCount || 0,
        totalShelves: shelfCount || 0,
      }
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Location Management</h1>
          <p className="text-muted-foreground">
            Manage warehouse locations, aisles, and storage capacity
          </p>
        </div>
        <Link href="/locations/configure">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Configure Locations
          </Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSlots || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across {stats?.totalAisles || 0} aisles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Package2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.availableSlots || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for storage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupied</CardTitle>
            <Package2 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.occupiedSlots || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently in use
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.occupancyRate || 0}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${stats?.occupancyRate || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Warehouse Overview</TabsTrigger>
          <TabsTrigger value="aisles">Aisles</TabsTrigger>
          <TabsTrigger value="map">Location Map</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((warehouse) => (
              <Card key={warehouse.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Warehouse className="h-5 w-5" />
                      {warehouse.name}
                    </CardTitle>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {warehouse.code}
                    </span>
                  </div>
                  <CardDescription>
                    {warehouse.address && `${warehouse.address}, `}
                    {warehouse.city}, {warehouse.state} {warehouse.zip_code}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aisles:</span>
                      <span className="font-medium">{warehouse.aisles?.[0]?.count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Staff:</span>
                      <span className="font-medium">{warehouse.profiles?.[0]?.count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium text-green-600">Active</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link href={`/locations/warehouse/${warehouse.id}`}>
                      <Button variant="outline" className="w-full">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {warehouses.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Warehouse className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Warehouses Found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Get started by adding your first warehouse location.
                </p>
                <Link href="/locations/configure" className="mt-4">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Warehouse
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="aisles" className="space-y-4">
          <AislesList />
        </TabsContent>

        <TabsContent value="map" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Map</CardTitle>
              <CardDescription>
                Visual representation of warehouse layout
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-4" />
                  <p>Interactive warehouse map coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Aisles list component
function AislesList() {
  const supabase = createClient()
  
  const { data: aisles = [], isLoading } = useQuery({
    queryKey: ['aisles-with-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('aisles')
        .select(`
          *,
          warehouse:warehouses(name, code),
          shelves(
            id,
            storage_slots(
              id,
              is_occupied
            )
          )
        `)
        .eq('is_active', true)
        .order('code')

      return data || []
    },
  })

  const getAisleStats = (aisle: any) => {
    let totalSlots = 0
    let occupiedSlots = 0

    aisle.shelves?.forEach((shelf: any) => {
      shelf.storage_slots?.forEach((slot: any) => {
        totalSlots++
        if (slot.is_occupied) occupiedSlots++
      })
    })

    return { totalSlots, occupiedSlots, availableSlots: totalSlots - occupiedSlots }
  }

  if (isLoading) {
    return <div>Loading aisles...</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {aisles.map((aisle) => {
        const stats = getAisleStats(aisle)
        const occupancyRate = stats.totalSlots > 0 
          ? Math.round((stats.occupiedSlots / stats.totalSlots) * 100) 
          : 0

        return (
          <Card key={aisle.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Aisle {aisle.code}</CardTitle>
                <Badge variant={occupancyRate > 80 ? "destructive" : "default"}>
                  {occupancyRate}% Full
                </Badge>
              </div>
              <CardDescription>
                {aisle.warehouse?.name} • {aisle.name || 'No description'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Slots:</span>
                  <span className="font-medium">{stats.totalSlots}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available:</span>
                  <span className="font-medium text-green-600">{stats.availableSlots}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Occupied:</span>
                  <span className="font-medium text-orange-600">{stats.occupiedSlots}</span>
                </div>
              </div>
              <div className="mt-4">
                <Link href={`/locations/aisle/${aisle.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Details
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// Add missing Badge import
import { Badge } from '@/components/ui/badge'