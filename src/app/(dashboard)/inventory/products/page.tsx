import { createClient } from '@/lib/supabase/server'
import { ProductList } from '@/components/inventory/product-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function ProductsPage() {
  const supabase = await createClient()
  
  // Fetch products with inventory totals
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      inventory (
        quantity,
        reserved_quantity,
        available_quantity
      )
    `)
    .eq('is_active', true)
    .order('name')

  // Transform data to include totals
  const productsWithTotals = products?.map(product => {
    const inventory = product.inventory || []
    const totalQuantity = inventory.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0)
    const availableQuantity = inventory.reduce((sum: number, inv: any) => sum + (inv.available_quantity || 0), 0)
    
    return {
      ...product,
      total_quantity: totalQuantity,
      available_quantity: availableQuantity,
      inventory: undefined // Remove raw inventory data
    }
  }) || []

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product catalog and inventory levels
          </p>
        </div>
        <Link href="/inventory/products/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      <ProductList products={productsWithTotals} />
    </div>
  )
}