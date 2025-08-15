'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Package2, MapPin, ScanLine, Loader2 } from 'lucide-react'
import { BarcodeScanner } from '@/components/scanning/barcode-scanner'

export default function MovePalletPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanMode, setScanMode] = useState<'pallet' | 'location'>('pallet')
  
  const [selectedPallet, setSelectedPallet] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [notes, setNotes] = useState('')

  // Fetch available pallets
  const { data: pallets = [] } = useQuery({
    queryKey: ['pallets-for-move'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pallets')
        .select(`
          id,
          pallet_number,
          status,
          current_location_id
        `)
        .in('status', ['receiving', 'stored', 'in_transit'])
        .order('pallet_number')

      return data || []
    },
  })

  // Fetch available locations
  const { data: locations = [] } = useQuery({
    queryKey: ['available-locations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('storage_slots')
        .select(`
          id,
          code,
          is_occupied,
          shelf:shelves(
            code,
            aisle:aisles(
              code,
              warehouse:warehouses(name)
            )
          )
        `)
        .eq('is_active', true)
        .eq('is_occupied', false)
        .order('code')

      return data || []
    },
  })

  const handleScan = (result: string) => {
    setShowScanner(false)
    
    if (scanMode === 'pallet') {
      // Try to find pallet by pallet number
      const pallet = pallets.find(p => 
        p.pallet_number === result
      )
      if (pallet) {
        setSelectedPallet(pallet.id)
        toast.success(`Pallet ${pallet.pallet_number} selected`)
      } else {
        toast.error('Pallet not found')
      }
    } else {
      // Try to find location by code
      const location = locations.find(l => l.code === result)
      if (location) {
        setSelectedLocation(location.id)
        toast.success(`Location ${location.code} selected`)
      } else {
        toast.error('Location not found')
      }
    }
  }

  const handleMove = async () => {
    if (!selectedPallet || !selectedLocation) {
      toast.error('Please select both a pallet and a destination')
      return
    }

    setIsLoading(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Get pallet details
      const { data: pallet } = await supabase
        .from('pallets')
        .select('current_location_id, pallet_number')
        .eq('id', selectedPallet)
        .single()

      if (!pallet) throw new Error('Pallet not found')

      // Update pallet location
      const { error: palletError } = await supabase
        .from('pallets')
        .update({
          current_location_id: selectedLocation,
          previous_location_id: pallet.current_location_id,
          status: 'stored',
          last_moved: new Date().toISOString(),
        })
        .eq('id', selectedPallet)

      if (palletError) throw palletError

      // Update old location if exists
      if (pallet.current_location_id) {
        await supabase
          .from('storage_slots')
          .update({
            is_occupied: false,
            current_pallet_id: null,
          })
          .eq('id', pallet.current_location_id)
      }

      // Update new location
      const { error: locationError } = await supabase
        .from('storage_slots')
        .update({
          is_occupied: true,
          current_pallet_id: selectedPallet,
        })
        .eq('id', selectedLocation)

      if (locationError) throw locationError

      // Record movement
      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          pallet_id: selectedPallet,
          movement_type: 'move',
          from_location_id: pallet.current_location_id,
          to_location_id: selectedLocation,
          performed_by: user.id,
          notes: notes || null,
          reason: 'Manual pallet movement',
        })

      if (movementError) throw movementError

      toast.success(`Pallet ${pallet.pallet_number} moved successfully`)
      router.push('/inventory/pallets')
    } catch (error: any) {
      console.error('Error moving pallet:', error)
      toast.error(error.message || 'Failed to move pallet')
    } finally {
      setIsLoading(false)
    }
  }

  const getLocationString = (location: any) => {
    if (!location.shelf) return location.code
    const warehouse = location.shelf.aisle?.warehouse?.name || ''
    const aisle = location.shelf.aisle?.code || ''
    const shelf = location.shelf.code || ''
    return `${warehouse} - ${aisle}${shelf}${location.code}`
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
          <h1 className="text-3xl font-bold">Move Pallet</h1>
          <p className="text-muted-foreground">
            Move a pallet to a new storage location
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Movement Details</CardTitle>
            <CardDescription>
              Select the pallet to move and its destination
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pallet">Select Pallet</Label>
              <div className="flex gap-2">
                <Select
                  disabled={isLoading}
                  value={selectedPallet}
                  onValueChange={setSelectedPallet}
                >
                  <SelectTrigger id="pallet">
                    <SelectValue placeholder="Choose a pallet to move">
                      {selectedPallet && (
                        <div className="flex items-center gap-2">
                          <Package2 className="h-4 w-4" />
                          {pallets.find(p => p.id === selectedPallet)?.pallet_number}
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {pallets.map((pallet) => (
                      <SelectItem key={pallet.id} value={pallet.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{pallet.pallet_number}</span>
                          {pallet.current_location_id && (
                            <span className="text-sm text-muted-foreground ml-2">
                              Has location
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setScanMode('pallet')
                    setShowScanner(true)
                  }}
                  disabled={isLoading}
                >
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Destination Location</Label>
              <div className="flex gap-2">
                <Select
                  disabled={isLoading}
                  value={selectedLocation}
                  onValueChange={setSelectedLocation}
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Choose destination location">
                      {selectedLocation && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {getLocationString(locations.find(l => l.id === selectedLocation))}
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {getLocationString(location)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setScanMode('location')
                    setShowScanner(true)
                  }}
                  disabled={isLoading}
                >
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this movement..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleMove}
                disabled={isLoading || !selectedPallet || !selectedLocation}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Move Pallet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Scan {scanMode === 'pallet' ? 'Pallet' : 'Location'} Code
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowScanner(false)}
              >
                Close
              </Button>
            </div>
            <BarcodeScanner
              onScan={handleScan}
            />
          </div>
        </div>
      )}
    </div>
  )
}