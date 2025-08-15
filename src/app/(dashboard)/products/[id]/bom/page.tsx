'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProductBOM, BOMMaterial, BOMActivity, Activity, WorkCenter } from '@/types/production.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus,
  Save,
  Copy,
  Trash2,
  ArrowLeft,
  Package,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Clock,
  Activity as ActivityIcon
} from 'lucide-react'

export default function ProductBOMPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const productId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [product, setProduct] = useState<any>(null)
  const [boms, setBoms] = useState<ProductBOM[]>([])
  const [selectedBom, setSelectedBom] = useState<ProductBOM | null>(null)
  const [materials, setMaterials] = useState<BOMMaterial[]>([])
  const [bomActivities, setBomActivities] = useState<BOMActivity[]>([])
  
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [allActivities, setAllActivities] = useState<Activity[]>([])
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([])

  useEffect(() => {
    fetchData()
  }, [productId])

  async function fetchData() {
    try {
      // Fetch product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()
      
      if (productError) throw productError
      setProduct(productData)

      // Fetch BOMs for this product
      const { data: bomsData, error: bomsError } = await supabase
        .from('product_boms')
        .select('*')
        .eq('product_id', productId)
        .order('version_number', { ascending: false })
      
      if (bomsError) throw bomsError
      setBoms(bomsData || [])
      
      // Select the active BOM or the latest draft
      const activeBom = bomsData?.find(b => b.status === 'active') || bomsData?.[0]
      if (activeBom) {
        setSelectedBom(activeBom)
        await fetchBomDetails(activeBom.id)
      }

      // Fetch reference data
      const [productsRes, activitiesRes, workCentersRes] = await Promise.all([
        supabase.from('products').select('id, name, sku, unit_of_measure').order('name'),
        supabase.from('activities').select('*').eq('is_active', true).order('name'),
        supabase.from('work_centers').select('*').eq('is_active', true).order('name')
      ])

      setAllProducts(productsRes.data || [])
      setAllActivities(activitiesRes.data || [])
      setWorkCenters(workCentersRes.data || [])
      
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to load BOM data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchBomDetails(bomId: string) {
    try {
      const [materialsRes, activitiesRes] = await Promise.all([
        supabase
          .from('bom_materials')
          .select('*, material_product:products(*)')
          .eq('bom_id', bomId)
          .order('created_at'),
        supabase
          .from('bom_activities')
          .select('*, activity:activities(*), work_center:work_centers(*)')
          .eq('bom_id', bomId)
          .order('sequence_number')
      ])

      setMaterials(materialsRes.data || [])
      setBomActivities(activitiesRes.data || [])
    } catch (error) {
      console.error('Error fetching BOM details:', error)
    }
  }

  async function createNewBom() {
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('product_boms')
        .insert({
          product_id: productId,
          status: 'draft'
        })
        .select()
        .single()

      if (error) throw error
      
      setBoms([data, ...boms])
      setSelectedBom(data)
      setMaterials([])
      setBomActivities([])
    } catch (error) {
      console.error('Error creating BOM:', error)
      setError('Failed to create new BOM')
    } finally {
      setSaving(false)
    }
  }

  async function activateBom() {
    if (!selectedBom || selectedBom.status === 'active') return
    
    setSaving(true)
    try {
      const { error } = await supabase.rpc('activate_bom', {
        bom_id: selectedBom.id
      })

      if (error) throw error
      
      await fetchData()
    } catch (error) {
      console.error('Error activating BOM:', error)
      setError('Failed to activate BOM')
    } finally {
      setSaving(false)
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    pending_approval: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    obsolete: 'bg-red-100 text-red-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
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
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Bill of Materials</h1>
          <p className="text-muted-foreground mt-1">
            {product?.name} ({product?.sku})
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* BOM Version Selector */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>BOM Versions</CardTitle>
              <CardDescription>
                Select or create a BOM version
              </CardDescription>
            </div>
            <Button onClick={createNewBom} disabled={saving}>
              <Plus className="mr-2 h-4 w-4" />
              New Version
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {boms.map(bom => (
              <div
                key={bom.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedBom?.id === bom.id ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  setSelectedBom(bom)
                  fetchBomDetails(bom.id)
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Version {bom.version_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(bom.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={statusColors[bom.status]}>
                    {bom.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedBom && (
        <Tabs defaultValue="materials" className="space-y-4">
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="materials">
                Materials ({materials.length})
              </TabsTrigger>
              <TabsTrigger value="activities">
                Activities ({bomActivities.length})
              </TabsTrigger>
              <TabsTrigger value="settings">
                Settings
              </TabsTrigger>
            </TabsList>
            
            {selectedBom.status === 'draft' && (
              <Button onClick={activateBom} disabled={saving}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Activate BOM
              </Button>
            )}
          </div>
          
          <TabsContent value="materials" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Materials & Components</CardTitle>
                <CardDescription>
                  Raw materials and components required for this product
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {materials.map((material) => (
                    <div key={material.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">
                          {(material as any).material_product?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {material.quantity_required} {material.unit_of_measure}
                          {material.waste_percentage > 0 && ` (+${material.waste_percentage}% waste)`}
                        </p>
                      </div>
                      {selectedBom.status === 'draft' && (
                        <Button size="sm" variant="ghost">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  {selectedBom.status === 'draft' && (
                    <Button variant="outline" className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Material
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="activities" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Production Activities</CardTitle>
                <CardDescription>
                  Step-by-step production process
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bomActivities.map((bomActivity) => (
                    <div key={bomActivity.id} className="flex items-start gap-4 p-3 border rounded-lg">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium">
                        {bomActivity.sequence_number}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {(bomActivity as any).activity?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(bomActivity as any).work_center?.name}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          {bomActivity.setup_time_minutes > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Setup: {bomActivity.setup_time_minutes}min
                            </span>
                          )}
                          {bomActivity.run_time_per_unit && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Run: {bomActivity.run_time_per_unit}min/unit
                            </span>
                          )}
                        </div>
                        {bomActivity.instructions && (
                          <p className="text-sm mt-2">{bomActivity.instructions}</p>
                        )}
                      </div>
                      {selectedBom.status === 'draft' && (
                        <Button size="sm" variant="ghost">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  {selectedBom.status === 'draft' && (
                    <Button variant="outline" className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Activity
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>BOM Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={selectedBom.notes || ''}
                    onChange={(e) => {
                      // Update notes
                    }}
                    disabled={selectedBom.status !== 'draft'}
                    rows={4}
                  />
                </div>
                
                {selectedBom.status === 'active' && (
                  <div className="space-y-2">
                    <div>
                      <Label>Effective Date</Label>
                      <p className="text-sm">
                        {selectedBom.effective_date 
                          ? new Date(selectedBom.effective_date).toLocaleDateString()
                          : 'Immediately'
                        }
                      </p>
                    </div>
                    {selectedBom.approved_by && (
                      <div>
                        <Label>Approved By</Label>
                        <p className="text-sm">
                          User {selectedBom.approved_by} on{' '}
                          {selectedBom.approved_at && new Date(selectedBom.approved_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}