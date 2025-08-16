'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
  ArrowLeft,
  Plus,
  Edit,
  Copy,
  Trash2,
  Save,
  Loader2,
  FileText,
  Package,
  Factory,
  AlertCircle,
  CheckCircle,
  Clock,
  Search
} from 'lucide-react'
import { format } from 'date-fns'

interface Product {
  id: string
  sku: string
  name: string
  product_type: string
  unit_of_measure?: string
}

interface Material {
  id?: string
  material_id: string
  product?: Product
  quantity: number
  unit_of_measure: string
  notes?: string
}

interface Activity {
  id?: string
  activity_id: string
  activity?: {
    id: string
    name: string
    work_center: { name: string }
  }
  sequence_number: number
  duration_minutes: number
  setup_minutes?: number
  notes?: string
}

interface BOM {
  id: string
  version_number: number
  status: 'draft' | 'pending_approval' | 'active' | 'obsolete'
  is_default: boolean
  effective_date?: string
  obsolete_date?: string
  notes?: string
  created_at: string
  materials: Material[]
  activities: Activity[]
}

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-500' },
  pending_approval: { label: 'Pending Approval', color: 'bg-yellow-500' },
  active: { label: 'Active', color: 'bg-green-500' },
  obsolete: { label: 'Obsolete', color: 'bg-red-500' }
}

export default function BOMManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const resolvedParams = use(params)
  const [product, setProduct] = useState<Product | null>(null)
  const [boms, setBOMs] = useState<BOM[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showNewBOM, setShowNewBOM] = useState(false)
  const [editingBOM, setEditingBOM] = useState<BOM | null>(null)
  
  // Available materials and activities
  const [availableMaterials, setAvailableMaterials] = useState<Product[]>([])
  const [availableActivities, setAvailableActivities] = useState<any[]>([])
  
  // New/Edit BOM form state
  const [bomForm, setBOMForm] = useState({
    notes: '',
    effective_date: format(new Date(), 'yyyy-MM-dd'),
    materials: [] as Material[],
    activities: [] as Activity[]
  })

  useEffect(() => {
    fetchData()
  }, [resolvedParams.id])

  async function fetchData() {
    try {
      // Fetch product
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (!productData || productData.product_type !== 'finished_good') {
        toast.error('BOMs can only be created for finished goods')
        router.push('/products')
        return
      }

      setProduct(productData)

      // Fetch BOMs
      const { data: bomsData } = await supabase
        .from('product_boms')
        .select(`
          *,
          materials:product_bom_materials(
            *,
            product:material_id(id, sku, name)
          ),
          activities:product_bom_activities(
            *,
            activity:activity_id(
              id,
              name,
              work_center:work_center_id(name)
            )
          )
        `)
        .eq('product_id', resolvedParams.id)
        .order('version_number', { ascending: false })

      setBOMs(bomsData || [])

      // Fetch available materials (raw materials, components, packaging)
      const { data: materialsData } = await supabase
        .from('products')
        .select('*')
        .in('product_type', ['raw_material', 'component', 'packaging'])
        .eq('is_active', true)
        .order('name')

      setAvailableMaterials(materialsData || [])

      // Fetch available activities with work centers
      const { data: activitiesData } = await supabase
        .from('activities')
        .select(`
          *,
          work_center:work_center_id(name)
        `)
        .eq('is_active', true)
        .order('name')

      setAvailableActivities(activitiesData || [])

    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch BOM data')
    } finally {
      setLoading(false)
    }
  }

  function addMaterial() {
    setBOMForm(prev => ({
      ...prev,
      materials: [...prev.materials, {
        material_id: '',
        quantity: 1,
        unit_of_measure: 'Each'
      }]
    }))
  }

  function updateMaterial(index: number, field: keyof Material, value: any) {
    setBOMForm(prev => ({
      ...prev,
      materials: prev.materials.map((m, i) => {
        if (i === index) {
          const updated = { ...m, [field]: value }
          // Auto-fill unit of measure when material is selected
          if (field === 'material_id' && value) {
            const material = availableMaterials.find(p => p.id === value)
            if (material) {
              updated.product = material
              updated.unit_of_measure = material.unit_of_measure || ''
            }
          }
          return updated
        }
        return m
      })
    }))
  }

  function removeMaterial(index: number) {
    setBOMForm(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index)
    }))
  }

  function addActivity() {
    const nextSequence = Math.max(...bomForm.activities.map(a => a.sequence_number), 0) + 10
    setBOMForm(prev => ({
      ...prev,
      activities: [...prev.activities, {
        activity_id: '',
        sequence_number: nextSequence,
        duration_minutes: 0,
        setup_minutes: 0
      }]
    }))
  }

  function updateActivity(index: number, field: keyof Activity, value: any) {
    setBOMForm(prev => ({
      ...prev,
      activities: prev.activities.map((a, i) => {
        if (i === index) {
          const updated = { ...a, [field]: value }
          // Auto-fill activity details when selected
          if (field === 'activity_id' && value) {
            const activity = availableActivities.find(act => act.id === value)
            if (activity) {
              updated.activity = activity
            }
          }
          return updated
        }
        return a
      })
    }))
  }

  function removeActivity(index: number) {
    setBOMForm(prev => ({
      ...prev,
      activities: prev.activities.filter((_, i) => i !== index)
    }))
  }

  async function saveBOM() {
    if (!product) return

    // Validation
    if (bomForm.materials.length === 0) {
      toast.error('At least one material is required')
      return
    }

    setSaving(true)
    try {
      const nextVersion = editingBOM 
        ? editingBOM.version_number 
        : Math.max(...boms.map(b => b.version_number), 0) + 1

      // Create or update BOM
      const bomData = {
        product_id: product.id,
        version_number: nextVersion,
        status: 'draft',
        is_default: boms.length === 0, // First BOM is default
        effective_date: bomForm.effective_date || null,
        notes: bomForm.notes || null
      }

      let bomId: string
      
      if (editingBOM) {
        // Update existing
        const { data, error } = await supabase
          .from('product_boms')
          .update(bomData)
          .eq('id', editingBOM.id)
          .select()
          .single()

        if (error) throw error
        bomId = data.id

        // Delete existing materials and activities
        await supabase
          .from('product_bom_materials')
          .delete()
          .eq('bom_id', bomId)

        await supabase
          .from('product_bom_activities')
          .delete()
          .eq('bom_id', bomId)
      } else {
        // Create new
        const { data, error } = await supabase
          .from('product_boms')
          .insert(bomData)
          .select()
          .single()

        if (error) throw error
        bomId = data.id
      }

      // Insert materials
      if (bomForm.materials.length > 0) {
        const { error: matError } = await supabase
          .from('product_bom_materials')
          .insert(
            bomForm.materials.map((mat, index) => ({
              bom_id: bomId,
              material_id: mat.material_id,
              quantity: mat.quantity,
              unit_of_measure: mat.unit_of_measure,
              notes: mat.notes || null,
              sequence_number: (index + 1) * 10
            }))
          )

        if (matError) throw matError
      }

      // Insert activities
      if (bomForm.activities.length > 0) {
        const { error: actError } = await supabase
          .from('product_bom_activities')
          .insert(
            bomForm.activities.map(act => ({
              bom_id: bomId,
              activity_id: act.activity_id,
              sequence_number: act.sequence_number,
              duration_minutes: act.duration_minutes,
              setup_minutes: act.setup_minutes || 0,
              notes: act.notes || null
            }))
          )

        if (actError) throw actError
      }

      toast.success(`BOM version ${nextVersion} ${editingBOM ? 'updated' : 'created'} successfully`)

      // Reset form and refresh
      setShowNewBOM(false)
      setEditingBOM(null)
      setBOMForm({
        notes: '',
        effective_date: format(new Date(), 'yyyy-MM-dd'),
        materials: [],
        activities: []
      })
      fetchData()

    } catch (error) {
      console.error('Error saving BOM:', error)
      toast.error('Failed to save BOM')
    } finally {
      setSaving(false)
    }
  }

  async function updateBOMStatus(bomId: string, newStatus: string) {
    try {
      const updates: any = { status: newStatus }
      
      // Set dates based on status
      if (newStatus === 'active' && !editingBOM?.effective_date) {
        updates.effective_date = new Date().toISOString()
      } else if (newStatus === 'obsolete' && !editingBOM?.obsolete_date) {
        updates.obsolete_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('product_boms')
        .update(updates)
        .eq('id', bomId)

      if (error) throw error

      toast.success('BOM status updated')
      fetchData()
    } catch (error) {
      toast.error('Failed to update BOM status')
    }
  }

  async function setDefaultBOM(bomId: string) {
    try {
      // Remove default from all BOMs for this product
      await supabase
        .from('product_boms')
        .update({ is_default: false })
        .eq('product_id', resolvedParams.id)

      // Set new default
      const { error } = await supabase
        .from('product_boms')
        .update({ is_default: true })
        .eq('id', bomId)

      if (error) throw error

      toast.success('Default BOM updated')
      fetchData()
    } catch (error) {
      toast.error('Failed to set default BOM')
    }
  }

  function startEditBOM(bom: BOM) {
    setEditingBOM(bom)
    setBOMForm({
      notes: bom.notes || '',
      effective_date: bom.effective_date ? format(new Date(bom.effective_date), 'yyyy-MM-dd') : '',
      materials: bom.materials.map(m => ({
        ...m,
        material_id: m.product?.id || ''
      })),
      activities: bom.activities
    })
    setShowNewBOM(true)
  }

  function copyBOM(bom: BOM) {
    setBOMForm({
      notes: `Copied from version ${bom.version_number}`,
      effective_date: format(new Date(), 'yyyy-MM-dd'),
      materials: bom.materials.map(m => ({
        ...m,
        material_id: m.product?.id || ''
      })),
      activities: bom.activities
    })
    setShowNewBOM(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!product) return null

  const activeBOMs = boms.filter(b => b.status === 'active')
  const defaultBOM = boms.find(b => b.is_default)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/products/${product.id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Bill of Materials</h1>
            <p className="text-muted-foreground mt-1">
              {product.name} ({product.sku})
            </p>
          </div>
        </div>
        <Button onClick={() => setShowNewBOM(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New BOM Version
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Versions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{boms.length}</div>
            <p className="text-xs text-muted-foreground">BOM versions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active BOMs</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBOMs.length}</div>
            <p className="text-xs text-muted-foreground">Currently in use</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Default Version</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {defaultBOM ? `v${defaultBOM.version_number}` : 'None'}
            </div>
            <p className="text-xs text-muted-foreground">Used for production</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Latest Version</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              v{Math.max(...boms.map(b => b.version_number), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Most recent</p>
          </CardContent>
        </Card>
      </div>

      {/* BOM List */}
      <div className="space-y-4">
        {boms.map((bom) => {
          const config = statusConfig[bom.status]
          return (
            <Card key={bom.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <CardTitle>Version {bom.version_number}</CardTitle>
                      <CardDescription>
                        Created on {format(new Date(bom.created_at), 'MMM d, yyyy')}
                        {bom.effective_date && ` • Effective ${format(new Date(bom.effective_date), 'MMM d, yyyy')}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${config.color}`} />
                        {config.label}
                      </Badge>
                      {bom.is_default && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyBOM(bom)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditBOM(bom)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="materials">
                  <TabsList>
                    <TabsTrigger value="materials">
                      Materials ({bom.materials.length})
                    </TabsTrigger>
                    <TabsTrigger value="activities">
                      Activities ({bom.activities.length})
                    </TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="materials">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bom.materials.map((material, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{material.product?.name || 'Unknown'}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {material.product?.sku || '-'}
                            </TableCell>
                            <TableCell>{material.quantity}</TableCell>
                            <TableCell>{material.unit_of_measure}</TableCell>
                            <TableCell>{material.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                  
                  <TabsContent value="activities">
                    {bom.activities.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Seq</TableHead>
                            <TableHead>Activity</TableHead>
                            <TableHead>Work Center</TableHead>
                            <TableHead>Setup</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bom.activities
                            .sort((a, b) => a.sequence_number - b.sequence_number)
                            .map((activity, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{activity.sequence_number}</TableCell>
                                <TableCell>{activity.activity?.name || 'Unknown'}</TableCell>
                                <TableCell>{activity.activity?.work_center?.name || '-'}</TableCell>
                                <TableCell>{activity.setup_minutes || 0} min</TableCell>
                                <TableCell>{activity.duration_minutes} min</TableCell>
                                <TableCell>{activity.notes || '-'}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No production activities defined
                      </p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="actions">
                    <div className="flex items-center gap-2">
                      {bom.status === 'draft' && (
                        <Button
                          variant="outline"
                          onClick={() => updateBOMStatus(bom.id, 'pending_approval')}
                        >
                          Submit for Approval
                        </Button>
                      )}
                      {bom.status === 'pending_approval' && (
                        <>
                          <Button
                            onClick={() => updateBOMStatus(bom.id, 'active')}
                          >
                            Approve & Activate
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => updateBOMStatus(bom.id, 'draft')}
                          >
                            Return to Draft
                          </Button>
                        </>
                      )}
                      {bom.status === 'active' && (
                        <>
                          {!bom.is_default && (
                            <Button
                              variant="outline"
                              onClick={() => setDefaultBOM(bom.id)}
                            >
                              Set as Default
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => updateBOMStatus(bom.id, 'obsolete')}
                          >
                            Mark Obsolete
                          </Button>
                        </>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )
        })}

        {boms.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-4">
                No bill of materials defined yet
              </p>
              <Button onClick={() => setShowNewBOM(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First BOM
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* New/Edit BOM Dialog */}
      <Dialog open={showNewBOM} onOpenChange={setShowNewBOM}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBOM ? `Edit BOM Version ${editingBOM.version_number}` : 'Create New BOM Version'}
            </DialogTitle>
            <DialogDescription>
              Define the materials and production activities for this product
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={bomForm.notes}
                onChange={(e) => setBOMForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Version notes or description..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effective_date">Effective Date</Label>
              <Input
                id="effective_date"
                type="date"
                value={bomForm.effective_date}
                onChange={(e) => setBOMForm(prev => ({ ...prev, effective_date: e.target.value }))}
              />
            </div>

            <Tabs defaultValue="materials">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="materials">Materials</TabsTrigger>
                <TabsTrigger value="activities">Production Activities</TabsTrigger>
              </TabsList>

              <TabsContent value="materials" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Bill of Materials</h3>
                  <Button size="sm" onClick={addMaterial}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Material
                  </Button>
                </div>

                {bomForm.materials.map((material, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-5">
                          <Label>Material</Label>
                          <Select
                            value={material.material_id}
                            onValueChange={(value) => updateMaterial(index, 'material_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableMaterials.map(mat => (
                                <SelectItem key={mat.id} value={mat.id}>
                                  {mat.name} ({mat.sku})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            value={material.quantity}
                            onChange={(e) => updateMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.001"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Unit</Label>
                          <Input
                            value={material.unit_of_measure}
                            onChange={(e) => updateMaterial(index, 'unit_of_measure', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Notes</Label>
                          <Input
                            value={material.notes || ''}
                            onChange={(e) => updateMaterial(index, 'notes', e.target.value)}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="col-span-1 flex items-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMaterial(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {bomForm.materials.length === 0 && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <Package className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No materials added yet</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="activities" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Production Steps</h3>
                  <Button size="sm" onClick={addActivity}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Activity
                  </Button>
                </div>

                {bomForm.activities
                  .sort((a, b) => a.sequence_number - b.sequence_number)
                  .map((activity, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-12 gap-4">
                          <div className="col-span-1">
                            <Label>Seq</Label>
                            <Input
                              type="number"
                              value={activity.sequence_number}
                              onChange={(e) => updateActivity(index, 'sequence_number', parseInt(e.target.value) || 0)}
                              min="1"
                            />
                          </div>
                          <div className="col-span-4">
                            <Label>Activity</Label>
                            <Select
                              value={activity.activity_id}
                              onValueChange={(value) => updateActivity(index, 'activity_id', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select activity" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableActivities.map(act => (
                                  <SelectItem key={act.id} value={act.id}>
                                    {act.name} ({act.work_center.name})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Label>Setup (min)</Label>
                            <Input
                              type="number"
                              value={activity.setup_minutes || 0}
                              onChange={(e) => updateActivity(index, 'setup_minutes', parseInt(e.target.value) || 0)}
                              min="0"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label>Duration (min)</Label>
                            <Input
                              type="number"
                              value={activity.duration_minutes}
                              onChange={(e) => updateActivity(index, 'duration_minutes', parseInt(e.target.value) || 0)}
                              min="0"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label>Notes</Label>
                            <Input
                              value={activity.notes || ''}
                              onChange={(e) => updateActivity(index, 'notes', e.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                          <div className="col-span-1 flex items-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeActivity(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                {bomForm.activities.length === 0 && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <Factory className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No production activities added yet</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBOM(false)}>
              Cancel
            </Button>
            <Button onClick={saveBOM} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {editingBOM ? 'Update BOM' : 'Create BOM'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}