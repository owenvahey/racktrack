'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { 
  ArrowLeft,
  Save,
  Loader2,
  Box,
  Package,
  Layers,
  Archive
} from 'lucide-react'

const productTypes = [
  { value: 'raw_material', label: 'Raw Material', icon: Box, description: 'Materials consumed in production' },
  { value: 'finished_good', label: 'Finished Good', icon: Package, description: 'Products ready for sale' },
  { value: 'component', label: 'Component', icon: Layers, description: 'Parts used in assembly' },
  { value: 'packaging', label: 'Packaging', icon: Archive, description: 'Packaging materials' }
]

const commonCategories = [
  'Apparel', 'Chemicals', 'Components', 'Electronics', 'Equipment',
  'Food & Beverage', 'Materials', 'Packaging', 'Paper', 'Plastics',
  'Raw Materials', 'Supplies', 'Textiles', 'Tools', 'Other'
]

const unitsOfMeasure = [
  'Each', 'Box', 'Case', 'Pallet', 'Roll', 'Sheet', 'Yard', 'Meter',
  'Pound', 'Kilogram', 'Ounce', 'Gram', 'Gallon', 'Liter', 'Quart', 'Pint',
  'Dozen', 'Gross', 'Ream', 'Bundle', 'Pack', 'Set', 'Pair', 'Kit'
]

export default function NewProductPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    product_type: 'raw_material',
    category: '',
    subcategory: '',
    unit_of_measure: 'Each',
    units_per_case: 1,
    cost_per_unit: '',
    sell_price: '',
    min_stock_level: 0,
    max_stock_level: '',
    barcode: '',
    weight_per_unit: '',
    packaging_type: ''
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validation
    if (!formData.sku || !formData.name) {
      toast.error('SKU and name are required')
      return
    }

    setLoading(true)
    try {
      // Check if SKU already exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', formData.sku)
        .single()

      if (existing) {
        toast.error('A product with this SKU already exists')
        return
      }

      // Create product
      const { data, error } = await supabase
        .from('products')
        .insert({
          sku: formData.sku,
          name: formData.name,
          description: formData.description || null,
          product_type: formData.product_type,
          category: formData.category || null,
          subcategory: formData.subcategory || null,
          unit_of_measure: formData.unit_of_measure,
          units_per_case: formData.units_per_case,
          cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
          sell_price: formData.sell_price ? parseFloat(formData.sell_price) : null,
          min_stock_level: formData.min_stock_level,
          max_stock_level: formData.max_stock_level ? parseInt(formData.max_stock_level) : null,
          barcode: formData.barcode || null,
          weight_per_unit: formData.weight_per_unit ? parseFloat(formData.weight_per_unit) : null,
          packaging_type: formData.packaging_type || null
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Product created successfully')

      // Redirect to product details or BOM page
      if (formData.product_type === 'finished_good') {
        router.push(`/products/${data.id}/bom`)
      } else {
        router.push(`/products/${data.id}`)
      }
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error('Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  const selectedType = productTypes.find(t => t.value === formData.product_type)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/products')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Product</h1>
          <p className="text-muted-foreground mt-2">
            Add a new product to your catalog
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => handleInputChange('sku', e.target.value.toUpperCase())}
                      placeholder="e.g., RAW-INK-BLK-01"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => handleInputChange('barcode', e.target.value)}
                      placeholder="Scan or enter barcode"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Black Screen Printing Ink"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    placeholder="Product description..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Product Type *</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {productTypes.map((type) => {
                      const Icon = type.icon
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => handleInputChange('product_type', type.value)}
                          className={`p-4 rounded-lg border-2 transition-colors ${
                            formData.product_type === type.value
                              ? 'border-primary bg-primary/5'
                              : 'border-muted hover:border-muted-foreground/50'
                          }`}
                        >
                          <Icon className="h-6 w-6 mb-2 mx-auto" />
                          <p className="font-medium">{type.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {commonCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">Subcategory</Label>
                    <Input
                      id="subcategory"
                      value={formData.subcategory}
                      onChange={(e) => handleInputChange('subcategory', e.target.value)}
                      placeholder="Optional subcategory"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Units & Packaging</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit_of_measure">Unit of Measure</Label>
                    <Select value={formData.unit_of_measure} onValueChange={(value) => handleInputChange('unit_of_measure', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unitsOfMeasure.map(unit => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="units_per_case">Units per Case</Label>
                    <Input
                      id="units_per_case"
                      type="number"
                      value={formData.units_per_case}
                      onChange={(e) => handleInputChange('units_per_case', parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight_per_unit">Weight per Unit (kg)</Label>
                    <Input
                      id="weight_per_unit"
                      type="number"
                      value={formData.weight_per_unit}
                      onChange={(e) => handleInputChange('weight_per_unit', e.target.value)}
                      step="0.0001"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {formData.product_type === 'packaging' && (
                  <div className="space-y-2">
                    <Label htmlFor="packaging_type">Packaging Type</Label>
                    <Select value={formData.packaging_type} onValueChange={(value) => handleInputChange('packaging_type', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="bag">Bag</SelectItem>
                        <SelectItem value="bottle">Bottle</SelectItem>
                        <SelectItem value="can">Can</SelectItem>
                        <SelectItem value="jar">Jar</SelectItem>
                        <SelectItem value="drum">Drum</SelectItem>
                        <SelectItem value="pail">Pail</SelectItem>
                        <SelectItem value="roll">Roll</SelectItem>
                        <SelectItem value="sheet">Sheet</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing & Stock Levels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cost_per_unit">Cost per Unit ($)</Label>
                    <Input
                      id="cost_per_unit"
                      type="number"
                      value={formData.cost_per_unit}
                      onChange={(e) => handleInputChange('cost_per_unit', e.target.value)}
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sell_price">Selling Price ($)</Label>
                    <Input
                      id="sell_price"
                      type="number"
                      value={formData.sell_price}
                      onChange={(e) => handleInputChange('sell_price', e.target.value)}
                      step="0.01"
                      placeholder="0.00"
                      disabled={formData.product_type !== 'finished_good'}
                    />
                    {formData.product_type !== 'finished_good' && (
                      <p className="text-xs text-muted-foreground">Only for finished goods</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_stock_level">Minimum Stock Level</Label>
                    <Input
                      id="min_stock_level"
                      type="number"
                      value={formData.min_stock_level}
                      onChange={(e) => handleInputChange('min_stock_level', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_stock_level">Maximum Stock Level</Label>
                    <Input
                      id="max_stock_level"
                      type="number"
                      value={formData.max_stock_level}
                      onChange={(e) => handleInputChange('max_stock_level', e.target.value)}
                      min="0"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Type</CardTitle>
                <CardDescription>
                  {selectedType?.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {formData.product_type === 'raw_material' && (
                    <>
                      <p>• Can only be consumed by production jobs</p>
                      <p>• Tracked at case and unit level</p>
                      <p>• Used in bill of materials</p>
                    </>
                  )}
                  {formData.product_type === 'finished_good' && (
                    <>
                      <p>• Can only be consumed by shipments</p>
                      <p>• Requires bill of materials</p>
                      <p>• Has selling price</p>
                    </>
                  )}
                  {formData.product_type === 'component' && (
                    <>
                      <p>• Used in assembly operations</p>
                      <p>• Can be part of BOMs</p>
                      <p>• Consumed in production</p>
                    </>
                  )}
                  {formData.product_type === 'packaging' && (
                    <>
                      <p>• Used for packing products</p>
                      <p>• Consumed in shipping</p>
                      <p>• Tracked by unit</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Create Product
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/products')}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>

            {formData.product_type === 'finished_good' && (
              <Card>
                <CardHeader>
                  <CardTitle>Next Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    After creating this finished good, you'll be redirected to create its bill of materials (BOM).
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}