'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { 
  ArrowLeft,
  Edit,
  Archive,
  Box,
  Package,
  Layers,
  FileText,
  Loader2,
  MapPin,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'

interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  product_type: 'raw_material' | 'finished_good' | 'component' | 'packaging'
  category: string | null
  subcategory: string | null
  unit_of_measure: string
  units_per_case: number
  cost_per_unit: number | null
  sell_price: number | null
  min_stock_level: number
  max_stock_level: number | null
  barcode: string | null
  weight_per_unit: number | null
  packaging_type: string | null
  qb_item_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface InventoryMovement {
  id: string
  quantity: number
  transaction_type: string
  reference_number: string | null
  notes: string | null
  created_at: string
  from_location?: { full_location: string }
  to_location?: { full_location: string }
  user?: { full_name: string }
}

interface ProductBOM {
  id: string
  version_number: number
  status: string
  is_default: boolean
  created_at: string
  materials: Array<{
    product: { name: string; sku: string }
    quantity: number
    unit_of_measure: string
  }>
  activities: Array<{
    activity: { name: string; work_center: { name: string } }
    sequence_number: number
    duration_minutes: number
  }>
}

interface StockLocation {
  location: { full_location: string }
  quantity: number
  cases: number
}

const productTypeConfig = {
  raw_material: { label: 'Raw Material', icon: Box, color: 'bg-blue-500' },
  finished_good: { label: 'Finished Good', icon: Package, color: 'bg-green-500' },
  component: { label: 'Component', icon: Layers, color: 'bg-purple-500' },
  packaging: { label: 'Packaging', icon: Archive, color: 'bg-yellow-500' }
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const resolvedParams = use(params)
  const [product, setProduct] = useState<Product | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [boms, setBOMs] = useState<ProductBOM[]>([])
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchProductData()
  }, [resolvedParams.id])

  async function fetchProductData() {
    try {
      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (productError) throw productError
      setProduct(productData)

      // Fetch inventory movements
      const { data: movementsData } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          from_location:from_location_id(full_location),
          to_location:to_location_id(full_location),
          user:created_by(full_name)
        `)
        .eq('product_id', resolvedParams.id)
        .order('created_at', { ascending: false })
        .limit(20)

      setMovements(movementsData || [])

      // Fetch BOMs
      const { data: bomsData } = await supabase
        .from('product_boms')
        .select(`
          *,
          materials:product_bom_materials(
            quantity,
            unit_of_measure,
            product:material_id(name, sku)
          ),
          activities:product_bom_activities(
            sequence_number,
            duration_minutes,
            activity:activity_id(
              name,
              work_center:work_center_id(name)
            )
          )
        `)
        .eq('product_id', resolvedParams.id)
        .order('version_number', { ascending: false })

      setBOMs(bomsData || [])

      // Fetch current stock by location
      const { data: palletData } = await supabase
        .from('pallet_contents')
        .select(`
          quantity:total_units,
          cases:case_count,
          pallet:pallet_id!inner(
            location:location_id(full_location)
          )
        `)
        .eq('product_id', resolvedParams.id)
        .gt('total_units', 0)

      // Aggregate by location
      const locationMap = new Map<string, StockLocation>()
      palletData?.forEach((item: any) => {
        const location = item.pallet.location.full_location
        const existing = locationMap.get(location)
        if (existing) {
          existing.quantity += item.quantity
          existing.cases += item.cases
        } else {
          locationMap.set(location, {
            location: { full_location: location },
            quantity: item.quantity,
            cases: item.cases
          })
        }
      })
      setStockLocations(Array.from(locationMap.values()))

    } catch (error) {
      console.error('Error fetching product data:', error)
      toast.error('Failed to fetch product details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">Product not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/products')}
        >
          Back to Products
        </Button>
      </div>
    )
  }

  const config = productTypeConfig[product.product_type]
  const Icon = config.icon

  // Calculate stock metrics
  const totalStock = stockLocations.reduce((sum, loc) => sum + loc.quantity, 0)
  const totalCases = stockLocations.reduce((sum, loc) => sum + loc.cases, 0)
  const stockStatus = totalStock < product.min_stock_level ? 'low' : 
                     product.max_stock_level && totalStock > product.max_stock_level ? 'high' : 'normal'

  // Calculate recent movements
  const recentReceipts = movements.filter(m => 
    ['receipt', 'production', 'adjustment_increase'].includes(m.transaction_type)
  ).slice(0, 5)
  const recentIssues = movements.filter(m => 
    ['issue', 'consumption', 'adjustment_decrease'].includes(m.transaction_type)
  ).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/products')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{product.name}</h1>
              <Badge variant="outline" className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${config.color}`} />
                {config.label}
              </Badge>
              {!product.is_active && (
                <Badge variant="destructive">Archived</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">SKU: {product.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/products/${product.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          {product.product_type === 'finished_good' && (
            <Button
              onClick={() => router.push(`/products/${product.id}/bom`)}
            >
              <FileText className="mr-2 h-4 w-4" />
              Manage BOM
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Current Stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock}</div>
            <p className="text-xs text-muted-foreground">
              {totalCases} cases × {product.units_per_case} units
            </p>
            {stockStatus === 'low' && (
              <p className="text-xs text-destructive mt-1">Below minimum level</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Stock Locations</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockLocations.length}</div>
            <p className="text-xs text-muted-foreground">Active locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Unit Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {product.cost_per_unit ? `$${product.cost_per_unit.toFixed(2)}` : '-'}
            </div>
            {product.sell_price && (
              <p className="text-xs text-muted-foreground">
                Sells for ${product.sell_price.toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">BOM Versions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{boms.length}</div>
            <p className="text-xs text-muted-foreground">
              {boms.filter(b => b.status === 'active').length} active
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stock">Stock Locations</TabsTrigger>
          <TabsTrigger value="movements">Movement History</TabsTrigger>
          <TabsTrigger value="bom">Bill of Materials</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">{product.category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subcategory</p>
                    <p className="font-medium">{product.subcategory || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Unit of Measure</p>
                    <p className="font-medium">{product.unit_of_measure}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Units per Case</p>
                    <p className="font-medium">{product.units_per_case}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Weight per Unit</p>
                    <p className="font-medium">
                      {product.weight_per_unit ? `${product.weight_per_unit} kg` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Barcode</p>
                    <p className="font-medium">{product.barcode || '-'}</p>
                  </div>
                </div>
                {product.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="mt-1">{product.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stock Levels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Stock</span>
                    <span className="font-medium">{totalStock} units</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Minimum Level</span>
                    <span className="font-medium">{product.min_stock_level} units</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Maximum Level</span>
                    <span className="font-medium">{product.max_stock_level || 'No limit'}</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Stock Status</p>
                  <div className="flex items-center gap-2">
                    {stockStatus === 'low' && (
                      <>
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        <span className="text-destructive">Below minimum - reorder needed</span>
                      </>
                    )}
                    {stockStatus === 'high' && (
                      <>
                        <TrendingUp className="h-4 w-4 text-warning" />
                        <span className="text-warning">Above maximum</span>
                      </>
                    )}
                    {stockStatus === 'normal' && (
                      <>
                        <BarChart3 className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">Normal levels</span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Receipts</CardTitle>
              </CardHeader>
              <CardContent>
                {recentReceipts.length > 0 ? (
                  <div className="space-y-3">
                    {recentReceipts.map((movement) => (
                      <div key={movement.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">+{movement.quantity} units</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(movement.created_at), 'MMM d, yyyy')}
                            {movement.reference_number && ` • ${movement.reference_number}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {movement.transaction_type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No recent receipts</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Issues</CardTitle>
              </CardHeader>
              <CardContent>
                {recentIssues.length > 0 ? (
                  <div className="space-y-3">
                    {recentIssues.map((movement) => (
                      <div key={movement.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-destructive">-{movement.quantity} units</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(movement.created_at), 'MMM d, yyyy')}
                            {movement.reference_number && ` • ${movement.reference_number}`}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {movement.transaction_type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No recent issues</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>Stock by Location</CardTitle>
              <CardDescription>
                Current inventory levels across all warehouse locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Cases</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockLocations.map((location) => (
                    <TableRow key={location.location.full_location}>
                      <TableCell className="font-medium">
                        {location.location.full_location}
                      </TableCell>
                      <TableCell>{location.cases}</TableCell>
                      <TableCell>{location.quantity}</TableCell>
                      <TableCell>
                        {totalStock > 0 
                          ? `${((location.quantity / totalStock) * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                  {stockLocations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No stock in any location
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>Movement History</CardTitle>
              <CardDescription>
                Recent inventory transactions for this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        {format(new Date(movement.created_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{movement.transaction_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={
                          ['receipt', 'production', 'adjustment_increase'].includes(movement.transaction_type)
                            ? 'text-green-600' : 'text-destructive'
                        }>
                          {['receipt', 'production', 'adjustment_increase'].includes(movement.transaction_type) ? '+' : '-'}
                          {movement.quantity}
                        </span>
                      </TableCell>
                      <TableCell>{movement.from_location?.full_location || '-'}</TableCell>
                      <TableCell>{movement.to_location?.full_location || '-'}</TableCell>
                      <TableCell>{movement.reference_number || '-'}</TableCell>
                      <TableCell>{movement.user?.full_name || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {movements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No movement history
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bom">
          {product.product_type === 'finished_good' ? (
            <div className="space-y-6">
              {boms.map((bom) => (
                <Card key={bom.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Version {bom.version_number}</CardTitle>
                        <CardDescription>
                          Created on {format(new Date(bom.created_at), 'MMM d, yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={bom.status === 'active' ? 'default' : 'outline'}>
                          {bom.status}
                        </Badge>
                        {bom.is_default && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Materials</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Unit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bom.materials.map((material, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                {material.product.name} ({material.product.sku})
                              </TableCell>
                              <TableCell>{material.quantity}</TableCell>
                              <TableCell>{material.unit_of_measure}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {bom.activities.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Production Activities</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Seq</TableHead>
                              <TableHead>Activity</TableHead>
                              <TableHead>Work Center</TableHead>
                              <TableHead>Duration</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bom.activities
                              .sort((a, b) => a.sequence_number - b.sequence_number)
                              .map((activity, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{activity.sequence_number}</TableCell>
                                  <TableCell>{activity.activity.name}</TableCell>
                                  <TableCell>{activity.activity.work_center.name}</TableCell>
                                  <TableCell>{activity.duration_minutes} min</TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              
              {boms.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg text-muted-foreground mb-4">No bill of materials defined</p>
                    <Button onClick={() => router.push(`/products/${product.id}/bom`)}>
                      Create BOM
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              <div className="flex justify-end">
                <Button onClick={() => router.push(`/products/${product.id}/bom`)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Manage BOMs
                </Button>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">
                  Bill of materials is only available for finished goods
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}