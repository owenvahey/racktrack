'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Layers, Loader2, Grid3x3 } from 'lucide-react'

interface ShelfForm {
  code: string
  level_number: number
  height_cm: number
  weight_capacity_kg: number
  slots_per_shelf: number
}

export default function ConfigureAislePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const aisleId = params.id as string

  const [isAddingShelf, setIsAddingShelf] = useState(false)
  const [shelfForm, setShelfForm] = useState<ShelfForm>({
    code: '',
    level_number: 1,
    height_cm: 200,
    weight_capacity_kg: 1000,
    slots_per_shelf: 4,
  })

  // Fetch aisle details
  const { data: aisle } = useQuery({
    queryKey: ['aisle', aisleId],
    queryFn: async () => {
      const { data } = await supabase
        .from('aisles')
        .select(`
          *,
          warehouse:warehouses(name, code)
        `)
        .eq('id', aisleId)
        .single()

      return data
    },
  })

  // Fetch shelves
  const { data: shelves = [] } = useQuery({
    queryKey: ['shelves', aisleId],
    queryFn: async () => {
      const { data } = await supabase
        .from('shelves')
        .select(`
          *,
          storage_slots(
            id,
            code,
            is_occupied,
            current_pallet_id
          )
        `)
        .eq('aisle_id', aisleId)
        .order('level_number')

      return data || []
    },
  })

  // Add shelf with slots mutation
  const addShelfMutation = useMutation({
    mutationFn: async (form: ShelfForm) => {
      // Create shelf
      const { data: shelf, error: shelfError } = await supabase
        .from('shelves')
        .insert({
          aisle_id: aisleId,
          code: form.code,
          level_number: form.level_number,
          height_cm: form.height_cm,
          weight_capacity_kg: form.weight_capacity_kg,
        })
        .select()
        .single()

      if (shelfError) throw shelfError

      // Create storage slots for the shelf
      const slots = Array.from({ length: form.slots_per_shelf }, (_, i) => ({
        shelf_id: shelf.id,
        code: `${aisle?.code}${form.code}${(i + 1).toString().padStart(2, '0')}`,
        position_number: i + 1,
        height_cm: form.height_cm,
        weight_capacity_kg: Math.floor(form.weight_capacity_kg / form.slots_per_shelf),
      }))

      const { error: slotsError } = await supabase
        .from('storage_slots')
        .insert(slots)

      if (slotsError) throw slotsError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelves', aisleId] })
      toast.success('Shelf and slots created successfully')
      setIsAddingShelf(false)
      setShelfForm({
        code: '',
        level_number: shelves.length + 1,
        height_cm: 200,
        weight_capacity_kg: 1000,
        slots_per_shelf: 4,
      })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create shelf')
    },
  })

  const handleAddShelf = () => {
    if (!shelfForm.code) {
      toast.error('Shelf code is required')
      return
    }
    addShelfMutation.mutate(shelfForm)
  }

  const toggleSlotStatus = async (slotId: string, isOccupied: boolean) => {
    const { error } = await supabase
      .from('storage_slots')
      .update({ is_occupied: !isOccupied })
      .eq('id', slotId)

    if (error) {
      toast.error('Failed to update slot status')
    } else {
      queryClient.invalidateQueries({ queryKey: ['shelves', aisleId] })
      toast.success('Slot status updated')
    }
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
          <h1 className="text-3xl font-bold">Configure Aisle {aisle?.code}</h1>
          <p className="text-muted-foreground">
            {aisle?.warehouse?.name} - {aisle?.name || 'Manage shelves and storage slots'}
          </p>
        </div>
      </div>

      {/* Add Shelf Button */}
      <div className="flex justify-end">
        <Button onClick={() => setIsAddingShelf(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Shelf
        </Button>
      </div>

      {/* Shelves Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shelves.map((shelf) => {
          const occupiedSlots = shelf.storage_slots?.filter((s: any) => s.is_occupied).length || 0
          const totalSlots = shelf.storage_slots?.length || 0
          const occupancyRate = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0

          return (
            <Card key={shelf.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Shelf {shelf.code}
                  </CardTitle>
                  <span className="text-sm font-medium">
                    Level {shelf.level_number}
                  </span>
                </div>
                <CardDescription>
                  {occupiedSlots} of {totalSlots} slots occupied ({occupancyRate}%)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Height</p>
                      <p className="font-medium">{shelf.height_cm} cm</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Capacity</p>
                      <p className="font-medium">{shelf.weight_capacity_kg} kg</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Storage Slots</p>
                    <div className="grid grid-cols-2 gap-2">
                      {shelf.storage_slots?.map((slot: any) => (
                        <button
                          key={slot.id}
                          onClick={() => toggleSlotStatus(slot.id, slot.is_occupied)}
                          className={`
                            p-2 rounded border text-xs font-medium transition-colors
                            ${slot.is_occupied 
                              ? 'bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200' 
                              : 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200'
                            }
                          `}
                        >
                          {slot.code}
                          <span className="block text-xs mt-1">
                            {slot.is_occupied ? 'Occupied' : 'Available'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Add Shelf Dialog */}
      <Dialog open={isAddingShelf} onOpenChange={setIsAddingShelf}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Shelf</DialogTitle>
            <DialogDescription>
              Configure a new shelf with storage slots for aisle {aisle?.code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shelf-code">Shelf Code *</Label>
                <Input
                  id="shelf-code"
                  value={shelfForm.code}
                  onChange={(e) => setShelfForm({ ...shelfForm, code: e.target.value.toUpperCase() })}
                  placeholder="S01"
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Level Number</Label>
                <Input
                  id="level"
                  type="number"
                  min="1"
                  value={shelfForm.level_number}
                  onChange={(e) => setShelfForm({ ...shelfForm, level_number: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  min="1"
                  value={shelfForm.height_cm}
                  onChange={(e) => setShelfForm({ ...shelfForm, height_cm: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Weight Capacity (kg)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={shelfForm.weight_capacity_kg}
                  onChange={(e) => setShelfForm({ ...shelfForm, weight_capacity_kg: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slots">Number of Storage Slots</Label>
              <Input
                id="slots"
                type="number"
                min="1"
                max="10"
                value={shelfForm.slots_per_shelf}
                onChange={(e) => setShelfForm({ ...shelfForm, slots_per_shelf: parseInt(e.target.value) || 1 })}
              />
              <p className="text-sm text-muted-foreground">
                This will create {shelfForm.slots_per_shelf} storage slots on this shelf
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="text-sm space-y-1">
                <p>Shelf Code: {aisle?.code}{shelfForm.code}</p>
                <p>Slot Codes: {Array.from({ length: shelfForm.slots_per_shelf }, (_, i) => 
                  `${aisle?.code}${shelfForm.code}${(i + 1).toString().padStart(2, '0')}`
                ).join(', ')}</p>
                <p>Capacity per slot: {Math.floor(shelfForm.weight_capacity_kg / shelfForm.slots_per_shelf)} kg</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddingShelf(false)}
              disabled={addShelfMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddShelf}
              disabled={addShelfMutation.isPending}
            >
              {addShelfMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Shelf & Slots
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}