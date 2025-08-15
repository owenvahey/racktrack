'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { JobRoute, JobMaterialConsumption } from '@/types/production.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  CheckCircle,
  Package,
  AlertCircle,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react'

interface RouteDetails extends Omit<JobRoute, 'activity' | 'work_center'> {
  job: {
    job_number: string
    job_name: string
    job_line_items?: Array<{
      po_line_item?: {
        item_name: string
      }
    }>
  }
  activity: {
    name: string
    code: string
  }
  work_center: {
    name: string
  }
}

interface MaterialConsumptionInput {
  material_product_id: string
  quantity_consumed: number
  lot_number: string
  inventory_id?: string
}

export default function ProductionCompletePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const routeId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [route, setRoute] = useState<RouteDetails | null>(null)
  const [plannedMaterials, setPlannedMaterials] = useState<JobMaterialConsumption[]>([])
  const [availableInventory, setAvailableInventory] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    quantity_completed: 0,
    quantity_scrapped: 0,
    production_notes: '',
    quality_notes: ''
  })
  
  const [materialInputs, setMaterialInputs] = useState<MaterialConsumptionInput[]>([])

  useEffect(() => {
    fetchRouteDetails()
  }, [routeId])

  async function fetchRouteDetails() {
    try {
      // Fetch route details
      const { data: routeData, error: routeError } = await supabase
        .from('job_routes')
        .select(`
          *,
          job:jobs!inner (
            job_number,
            job_name,
            job_line_items (
              po_line_item:po_line_items (
                item_name
              )
            )
          ),
          activity:activities (
            name,
            code
          ),
          work_center:work_centers (
            name
          )
        `)
        .eq('id', routeId)
        .single()

      if (routeError) throw routeError
      setRoute(routeData)
      
      // Set initial quantity to remaining
      const remaining = routeData.quantity_target - routeData.quantity_completed
      setFormData(prev => ({
        ...prev,
        quantity_completed: remaining
      }))

      // Fetch planned materials
      const { data: materialsData, error: materialsError } = await supabase
        .from('job_material_consumption')
        .select(`
          *,
          material_product:products (
            id,
            name,
            sku,
            unit_of_measure,
            units_per_case,
            product_type
          )
        `)
        .eq('job_id', routeData.job_id)
        .is('consumed_at', null)

      if (materialsError) throw materialsError
      setPlannedMaterials(materialsData || [])
      
      // Initialize material inputs
      const inputs = (materialsData || []).map(mat => ({
        material_product_id: mat.material_product_id,
        quantity_consumed: mat.quantity_planned,
        lot_number: '',
        inventory_id: undefined
      }))
      setMaterialInputs(inputs)

      // Fetch available pallet contents for materials
      if (materialsData && materialsData.length > 0) {
        const productIds = materialsData.map(m => m.material_product_id)
        const { data: palletContents } = await supabase
          .from('pallet_contents')
          .select(`
            *,
            product:products (
              name,
              sku,
              units_per_case
            ),
            pallet:pallets (
              pallet_number,
              current_location:storage_slots (
                code
              )
            )
          `)
          .in('product_id', productIds)
          .gt('total_units_remaining', 0)
          .order('lot_number')

        setAvailableInventory(palletContents || [])
      }

    } catch (error) {
      console.error('Error fetching route details:', error)
      setError('Failed to load production details')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!route) return

    setSaving(true)
    setError(null)

    try {
      // Update job route
      const { error: routeError } = await supabase
        .from('job_routes')
        .update({
          quantity_completed: route.quantity_completed + formData.quantity_completed,
          quantity_scrapped: route.quantity_scrapped + formData.quantity_scrapped,
          status: 'completed',
          actual_complete: new Date().toISOString(),
          production_notes: formData.production_notes,
          quality_notes: formData.quality_notes,
          operator_id: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', routeId)

      if (routeError) throw routeError

      // Prepare material consumptions for new system
      const materialConsumptions = []
      
      for (const input of materialInputs) {
        if (input.quantity_consumed > 0 && input.inventory_id) {
          // Convert total units to cases and units
          const unitsPerCase = availableInventory.find(inv => inv.id === input.inventory_id)?.units_per_case || 1
          const cases = Math.floor(input.quantity_consumed / unitsPerCase)
          const units = input.quantity_consumed % unitsPerCase
          
          materialConsumptions.push({
            pallet_content_id: input.inventory_id,
            cases: cases,
            units: units,
            notes: input.lot_number ? `Lot: ${input.lot_number}` : null
          })
        }
      }

      // Consume materials using the new function
      if (materialConsumptions.length > 0) {
        const { data: consumeResult, error: consumeError } = await supabase.rpc(
          'consume_job_materials',
          {
            p_job_route_id: routeId,
            p_material_consumptions: materialConsumptions
          }
        )

        if (consumeError) throw consumeError
        
        if (consumeResult && !consumeResult.success) {
          throw new Error(`Material consumption failed: ${consumeResult.error_messages?.join(', ')}`)
        }
      }

      // Check if this completes the job
      const { data: remainingRoutes } = await supabase
        .from('job_routes')
        .select('id')
        .eq('job_id', route.job_id)
        .neq('status', 'completed')
        .neq('status', 'skipped')

      if (!remainingRoutes || remainingRoutes.length === 0) {
        // Update job status to completed
        await supabase
          .from('jobs')
          .update({
            status: 'completed',
            actual_completion_date: new Date().toISOString(),
            progress_percentage: 100
          })
          .eq('id', route.job_id)
      }

      // Redirect back to production page
      router.push('/production')
    } catch (error) {
      console.error('Error completing production:', error)
      setError('Failed to complete production')
    } finally {
      setSaving(false)
    }
  }

  function updateMaterialInput(index: number, field: keyof MaterialConsumptionInput, value: any) {
    setMaterialInputs(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!route) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Production route not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Complete Production</h1>
          <p className="text-muted-foreground mt-1">
            {route.job.job_number} - {route.activity.name}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job Information */}
        <Card>
          <CardHeader>
            <CardTitle>Job Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Job Number</p>
                <p className="font-medium">{route.job.job_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Work Center</p>
                <p className="font-medium">{route.work_center.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Activity</p>
                <p className="font-medium">{route.activity.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Product</p>
                <p className="font-medium">
                  {route.job.job_line_items?.[0]?.po_line_item?.item_name || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Production Quantities */}
        <Card>
          <CardHeader>
            <CardTitle>Production Quantities</CardTitle>
            <CardDescription>
              Target: {route.quantity_target} units 
              (Already completed: {route.quantity_completed})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity_completed">Quantity Completed</Label>
                <Input
                  id="quantity_completed"
                  type="number"
                  min="0"
                  max={route.quantity_target - route.quantity_completed}
                  value={formData.quantity_completed}
                  onChange={(e) => setFormData({
                    ...formData,
                    quantity_completed: parseInt(e.target.value) || 0
                  })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="quantity_scrapped">Quantity Scrapped</Label>
                <Input
                  id="quantity_scrapped"
                  type="number"
                  min="0"
                  value={formData.quantity_scrapped}
                  onChange={(e) => setFormData({
                    ...formData,
                    quantity_scrapped: parseInt(e.target.value) || 0
                  })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Material Consumption */}
        {plannedMaterials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Material Consumption</CardTitle>
              <CardDescription>
                Track materials used in production
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {plannedMaterials.map((material, index) => (
                <div key={material.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <p className="font-medium">
                      {(material as any).material_product?.name}
                    </p>
                    <Badge variant="outline">
                      Planned: {material.quantity_planned} {material.unit_of_measure}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Quantity Used</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={materialInputs[index]?.quantity_consumed || 0}
                        onChange={(e) => updateMaterialInput(
                          index, 
                          'quantity_consumed', 
                          parseFloat(e.target.value) || 0
                        )}
                      />
                    </div>
                    <div>
                      <Label>Lot Number</Label>
                      <Input
                        value={materialInputs[index]?.lot_number || ''}
                        onChange={(e) => updateMaterialInput(
                          index,
                          'lot_number',
                          e.target.value
                        )}
                        placeholder="Enter lot #"
                      />
                    </div>
                    <div>
                      <Label>From Inventory</Label>
                      <select
                        className="w-full px-3 py-2 border rounded-md"
                        value={materialInputs[index]?.inventory_id || ''}
                        onChange={(e) => updateMaterialInput(
                          index,
                          'inventory_id',
                          e.target.value
                        )}
                      >
                        <option value="">Select inventory</option>
                        {availableInventory
                          .filter(pc => pc.product_id === material.material_product_id)
                          .map(pc => {
                            const displayQty = pc.cases_remaining > 0 && pc.loose_units_remaining > 0
                              ? `${pc.cases_remaining} cases + ${pc.loose_units_remaining} units`
                              : pc.cases_remaining > 0
                              ? `${pc.cases_remaining} cases`
                              : `${pc.loose_units_remaining} units`
                            
                            return (
                              <option key={pc.id} value={pc.id}>
                                Lot: {pc.lot_number || 'N/A'} - {displayQty} ({pc.total_units_remaining} total)
                                {pc.pallet?.current_location?.code && 
                                  ` - ${pc.pallet.current_location.code}`}
                              </option>
                            )
                          })}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="production_notes">Production Notes</Label>
              <Textarea
                id="production_notes"
                value={formData.production_notes}
                onChange={(e) => setFormData({
                  ...formData,
                  production_notes: e.target.value
                })}
                rows={3}
                placeholder="Any notes about the production process..."
              />
            </div>
            <div>
              <Label htmlFor="quality_notes">Quality Notes</Label>
              <Textarea
                id="quality_notes"
                value={formData.quality_notes}
                onChange={(e) => setFormData({
                  ...formData,
                  quality_notes: e.target.value
                })}
                rows={3}
                placeholder="Any quality issues or observations..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Production
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}