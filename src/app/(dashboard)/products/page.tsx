'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { 
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Archive,
  Box,
  Package,
  Layers,
  Loader2,
  FileText,
  DollarSign,
  BarChart3
} from 'lucide-react'

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
  qb_item_id: string | null
  is_active: boolean
  inventory_summary?: {
    total_quantity: number
    total_cases: number
    location_count: number
  }
  active_bom_count?: number
}

const productTypeConfig = {
  raw_material: { label: 'Raw Material', icon: Box, color: 'bg-blue-500' },
  finished_good: { label: 'Finished Good', icon: Package, color: 'bg-green-500' },
  component: { label: 'Component', icon: Layers, color: 'bg-purple-500' },
  packaging: { label: 'Packaging', icon: Archive, color: 'bg-yellow-500' }
}

export default function ProductsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    fetchProducts()
  }, [typeFilter, categoryFilter])

  async function fetchProducts() {
    try {
      // Build query
      let query = supabase
        .from('products')
        .select(`
          *,
          inventory:inventory_movements(
            quantity,
            transaction_type
          ),
          boms:product_boms(
            id,
            status
          )
        `)
        .eq('is_active', true)
        .order('name')

      // Apply filters
      if (typeFilter !== 'all') {
        query = query.eq('product_type', typeFilter)
      }
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter)
      }
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
      }

      const { data, error } = await query

      if (error) throw error

      // Process inventory summary
      const productsWithSummary = (data || []).map(product => {
        const inventory = product.inventory || []
        const totalQuantity = inventory.reduce((sum: number, mov: any) => {
          if (['receipt', 'production', 'adjustment_increase'].includes(mov.transaction_type)) {
            return sum + mov.quantity
          } else {
            return sum - mov.quantity
          }
        }, 0)

        const activeBoms = (product.boms || []).filter((bom: any) => bom.status === 'active')

        return {
          ...product,
          inventory_summary: {
            total_quantity: totalQuantity,
            total_cases: Math.floor(totalQuantity / (product.units_per_case || 1)),
            location_count: 0 // This would need a join with pallets/locations
          },
          active_bom_count: activeBoms.length
        }
      })

      setProducts(productsWithSummary)

      // Get unique categories
      const uniqueCategories = [...new Set(data?.map(p => p.category).filter(Boolean))] as string[]
      setCategories(uniqueCategories.sort())

    } catch (error) {
      console.error('Error fetching products:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function toggleProductStatus(productId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', productId)

      if (error) throw error

      await fetchProducts()
      toast({
        title: 'Success',
        description: `Product ${currentStatus ? 'archived' : 'activated'} successfully`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update product status',
        variant: 'destructive',
      })
    }
  }

  const getProductTypeBadge = (type: string) => {
    const config = productTypeConfig[type as keyof typeof productTypeConfig]
    if (!config) return null
    
    const Icon = config.icon
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    )
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground mt-2">
            Manage your product catalog and bill of materials
          </p>
        </div>
        <Button onClick={() => router.push('/products/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Product
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">Active products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Raw Materials</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.product_type === 'raw_material').length}
            </div>
            <p className="text-xs text-muted-foreground">For production</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Finished Goods</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.product_type === 'finished_good').length}
            </div>
            <p className="text-xs text-muted-foreground">Ready to ship</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">With BOMs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.active_bom_count && p.active_bom_count > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">Bill of materials defined</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Product Catalog</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
                  className="pl-8 w-[200px]"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="raw_material">Raw Materials</SelectItem>
                  <SelectItem value="finished_good">Finished Goods</SelectItem>
                  <SelectItem value="component">Components</SelectItem>
                  <SelectItem value="packaging">Packaging</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Case Size</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>BOM</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.sku}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-muted-foreground">{product.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getProductTypeBadge(product.product_type)}</TableCell>
                  <TableCell>{product.category || '-'}</TableCell>
                  <TableCell>{product.unit_of_measure}</TableCell>
                  <TableCell>{product.units_per_case}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{product.inventory_summary?.total_quantity || 0} units</p>
                      {product.units_per_case > 1 && (
                        <p className="text-muted-foreground">
                          {product.inventory_summary?.total_cases || 0} cases
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.cost_per_unit ? `$${product.cost_per_unit.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>
                    {product.sell_price ? `$${product.sell_price.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>
                    {product.active_bom_count ? (
                      <Badge variant="outline" className="text-xs">
                        {product.active_bom_count} active
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => router.push(`/products/${product.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/products/${product.id}/edit`)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/products/${product.id}/bom`)}>
                          <FileText className="mr-2 h-4 w-4" />
                          Manage BOM
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => toggleProductStatus(product.id, product.is_active)}
                          className="text-destructive"
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive Product
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}