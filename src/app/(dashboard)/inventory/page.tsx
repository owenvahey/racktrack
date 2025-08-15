import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package, ScanLine, MapPin, Activity, Plus, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function InventoryPage() {
  const supabase = await createClient()
  
  // Get inventory stats
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const { count: palletCount } = await supabase
    .from('pallets')
    .select('*', { count: 'exact', head: true })

  const { data: recentMovements } = await supabase
    .from('inventory_movements')
    .select(`
      *,
      performed_by:profiles(full_name, email),
      inventory(
        product:products(name, sku)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Inventory Management</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active products in catalog
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pallets</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{palletCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active pallets in warehouse
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Storage locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movements Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Inventory transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common inventory operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/inventory/receive" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  Receive Inventory
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/scan" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center">
                  <ScanLine className="h-4 w-4 mr-2" />
                  Scan Items
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/inventory/products" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Manage Products
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/inventory/pallets" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  View Pallets
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Movements</CardTitle>
            <CardDescription>Latest inventory transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentMovements && recentMovements.length > 0 ? (
              <div className="space-y-3">
                {recentMovements.map((movement) => (
                  <div key={movement.id} className="text-sm">
                    <p className="font-medium">
                      {movement.movement_type.charAt(0).toUpperCase() + movement.movement_type.slice(1)}
                      {movement.inventory?.product && (
                        <span className="text-muted-foreground">
                          {' '}• {movement.inventory.product.name}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      by {movement.performed_by?.full_name || movement.performed_by?.email}
                      {' • '}
                      {new Date(movement.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent movements</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}