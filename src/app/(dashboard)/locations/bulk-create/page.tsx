'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  Plus, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  Grid3x3,
  Layers,
  Package,
  Info
} from 'lucide-react'

interface BulkCreateForm {
  warehouse_id: string
  aisle_prefix: string
  aisle_start: number
  aisle_end: number
  shelves_per_aisle: number
  shelf_prefix: string
  slots_per_shelf: number
  shelf_height_cm: number
  shelf_weight_capacity_kg: number
  zone: string
  temperature_controlled: boolean
  hazmat_approved: boolean
}

export default function BulkCreatePage() {
  const router = useRouter()
  const supabase = createClient()
  const [preview, setPreview] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const [form, setForm] = useState<BulkCreateForm>({
    warehouse_id: '',
    aisle_prefix: 'A',
    aisle_start: 1,
    aisle_end: 1,
    shelves_per_aisle: 3,
    shelf_prefix: 'S',
    slots_per_shelf: 4,
    shelf_height_cm: 200,
    shelf_weight_capacity_kg: 1000,
    zone: 'storage',
    temperature_controlled: false,
    hazmat_approved: false,
  })

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-bulk'],
    queryFn: async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('*')
        .eq('is_active', true)
        .order('name')

      return data || []
    },
  })

  // Generate preview
  const generatePreview = () => {
    const locations: string[] = []
    const warehouseCode = warehouses.find(w => w.id === form.warehouse_id)?.code || 'WH'

    for (let aisleNum = form.aisle_start; aisleNum <= form.aisle_end; aisleNum++) {
      const aisleCode = `${form.aisle_prefix}${aisleNum.toString().padStart(2, '0')}`
      
      for (let shelfNum = 1; shelfNum <= form.shelves_per_aisle; shelfNum++) {
        const shelfCode = `${form.shelf_prefix}${shelfNum.toString().padStart(2, '0')}`
        
        for (let slotNum = 1; slotNum <= form.slots_per_shelf; slotNum++) {
          const slotCode = slotNum.toString().padStart(2, '0')
          const fullLocation = `${warehouseCode}-${aisleCode}-${shelfCode}-${slotCode}`
          locations.push(fullLocation)
        }
      }
    }

    setPreview(locations.slice(0, 20))
  }

  // Calculate totals
  const calculateTotals = () => {
    const totalAisles = form.aisle_end - form.aisle_start + 1
    const totalShelves = totalAisles * form.shelves_per_aisle
    const totalSlots = totalShelves * form.slots_per_shelf

    return { totalAisles, totalShelves, totalSlots }
  }

  // Bulk create mutation
  const createLocationsMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true)
      const warehouseCode = warehouses.find(w => w.id === form.warehouse_id)?.code || 'WH'
      let createdCount = 0

      try {
        // Create aisles
        for (let aisleNum = form.aisle_start; aisleNum <= form.aisle_end; aisleNum++) {
          const aisleCode = `${form.aisle_prefix}${aisleNum.toString().padStart(2, '0')}`
          
          // Insert aisle
          const { data: aisle, error: aisleError } = await supabase
            .from('aisles')
            .insert({
              warehouse_id: form.warehouse_id,
              code: aisleCode,
              name: `Aisle ${aisleCode}`,
              description: `Bulk created aisle`,
            })
            .select()
            .single()

          if (aisleError) throw aisleError

          // Create shelves for this aisle
          for (let shelfNum = 1; shelfNum <= form.shelves_per_aisle; shelfNum++) {
            const shelfCode = `${form.shelf_prefix}${shelfNum.toString().padStart(2, '0')}`
            
            // Insert shelf
            const { data: shelf, error: shelfError } = await supabase
              .from('shelves')
              .insert({
                aisle_id: aisle.id,
                code: shelfCode,
                level_number: shelfNum,
                height_cm: form.shelf_height_cm,
                weight_capacity_kg: form.shelf_weight_capacity_kg,
              })
              .select()
              .single()

            if (shelfError) throw shelfError

            // Create slots for this shelf
            const slots = []
            for (let slotNum = 1; slotNum <= form.slots_per_shelf; slotNum++) {
              const slotCode = slotNum.toString().padStart(2, '0')
              
              slots.push({
                shelf_id: shelf.id,
                code: `${aisleCode}${shelfCode}${slotCode}`,
                position_number: slotNum,
                zone: form.zone,
                temperature_controlled: form.temperature_controlled,
                hazmat_approved: form.hazmat_approved,
                height_cm: form.shelf_height_cm,
                weight_capacity_kg: Math.floor(form.shelf_weight_capacity_kg / form.slots_per_shelf),
              })
            }

            const { error: slotsError } = await supabase
              .from('storage_slots')
              .insert(slots)

            if (slotsError) throw slotsError
            
            createdCount += slots.length
          }
        }
      } finally {
        setIsGenerating(false)
      }

      return createdCount
    },
    onSuccess: (count) => {
      toast.success(`Successfully created ${count} storage locations`)
      router.push('/locations')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create locations')
    },
  })

  const totals = calculateTotals()
  const canCreate = form.warehouse_id && form.aisle_start <= form.aisle_end

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
          <h1 className="text-3xl font-bold">Bulk Create Locations</h1>
          <p className="text-muted-foreground">
            Quickly create multiple aisles, shelves, and storage slots
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse & Aisles</CardTitle>
              <CardDescription>
                Configure the warehouse and aisle parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="warehouse">Warehouse *</Label>
                <Select
                  value={form.warehouse_id}
                  onValueChange={(value) => {
                    setForm({ ...form, warehouse_id: value })
                    generatePreview()
                  }}
                >
                  <SelectTrigger id="warehouse">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aisle-prefix">Aisle Prefix</Label>
                  <Input
                    id="aisle-prefix"
                    value={form.aisle_prefix}
                    onChange={(e) => {
                      setForm({ ...form, aisle_prefix: e.target.value.toUpperCase() })
                      generatePreview()
                    }}
                    placeholder="A"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aisle-start">Start Number</Label>
                  <Input
                    id="aisle-start"
                    type="number"
                    min={1}
                    value={form.aisle_start}
                    onChange={(e) => {
                      setForm({ ...form, aisle_start: parseInt(e.target.value) || 1 })
                      generatePreview()
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aisle-end">End Number</Label>
                  <Input
                    id="aisle-end"
                    type="number"
                    min={form.aisle_start}
                    value={form.aisle_end}
                    onChange={(e) => {
                      setForm({ ...form, aisle_end: parseInt(e.target.value) || 1 })
                      generatePreview()
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shelves & Slots</CardTitle>
              <CardDescription>
                Configure shelf and slot parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shelves">Shelves per Aisle</Label>
                  <Input
                    id="shelves"
                    type="number"
                    min={1}
                    max={10}
                    value={form.shelves_per_aisle}
                    onChange={(e) => {
                      setForm({ ...form, shelves_per_aisle: parseInt(e.target.value) || 1 })
                      generatePreview()
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shelf-prefix">Shelf Prefix</Label>
                  <Input
                    id="shelf-prefix"
                    value={form.shelf_prefix}
                    onChange={(e) => {
                      setForm({ ...form, shelf_prefix: e.target.value.toUpperCase() })
                      generatePreview()
                    }}
                    placeholder="S"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slots">Slots per Shelf</Label>
                <Input
                  id="slots"
                  type="number"
                  min={1}
                  max={20}
                  value={form.slots_per_shelf}
                  onChange={(e) => {
                    setForm({ ...form, slots_per_shelf: parseInt(e.target.value) || 1 })
                    generatePreview()
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="height">Shelf Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    min={1}
                    value={form.shelf_height_cm}
                    onChange={(e) => setForm({ ...form, shelf_height_cm: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Weight Capacity (kg)</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={1}
                    value={form.shelf_weight_capacity_kg}
                    onChange={(e) => setForm({ ...form, shelf_weight_capacity_kg: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zone">Zone</Label>
                <Select
                  value={form.zone}
                  onValueChange={(value) => setForm({ ...form, zone: value })}
                >
                  <SelectTrigger id="zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receiving">Receiving</SelectItem>
                    <SelectItem value="storage">Storage</SelectItem>
                    <SelectItem value="picking">Picking</SelectItem>
                    <SelectItem value="shipping">Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="temp"
                    checked={form.temperature_controlled}
                    onCheckedChange={(checked) => 
                      setForm({ ...form, temperature_controlled: checked as boolean })
                    }
                  />
                  <Label htmlFor="temp" className="cursor-pointer">
                    Temperature Controlled
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hazmat"
                    checked={form.hazmat_approved}
                    onCheckedChange={(checked) => 
                      setForm({ ...form, hazmat_approved: checked as boolean })
                    }
                  />
                  <Label htmlFor="hazmat" className="cursor-pointer">
                    Hazmat Approved
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview and Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                Review what will be created
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This operation will create the following:
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{totals.totalAisles}</div>
                    <div className="text-sm text-muted-foreground">Aisles</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{totals.totalShelves}</div>
                    <div className="text-sm text-muted-foreground">Shelves</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{totals.totalSlots}</div>
                    <div className="text-sm text-muted-foreground">Storage Slots</div>
                  </div>
                </div>

                {totals.totalSlots > 1000 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Warning: Creating {totals.totalSlots} locations may take several minutes.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location Preview</CardTitle>
              <CardDescription>
                Sample of location codes that will be generated
              </CardDescription>
            </CardHeader>
            <CardContent>
              {preview.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {preview.map((location, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 bg-gray-50 rounded-md font-mono text-sm"
                      >
                        {location}
                      </div>
                    ))}
                  </div>
                  {totals.totalSlots > 20 && (
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      ... and {totals.totalSlots - 20} more
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2" />
                  <p>Configure parameters to see preview</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/locations')}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createLocationsMutation.mutate()}
              disabled={!canCreate || createLocationsMutation.isPending || isGenerating}
            >
              {(createLocationsMutation.isPending || isGenerating) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create {totals.totalSlots} Locations
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}