'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Search, Package, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  sku: string
  name: string
  category: string | null
  barcode: string | null
  min_stock_level: number
  total_quantity: number
  available_quantity: number
  unit_of_measure: string
  is_active: boolean
}

interface ProductListProps {
  products: Product[]
}

export function ProductList({ products }: ProductListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.barcode && product.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const getStockStatus = (product: Product) => {
    if (product.total_quantity === 0) {
      return { label: 'Out of Stock', variant: 'destructive' as const }
    }
    if (product.total_quantity <= product.min_stock_level) {
      return { label: 'Low Stock', variant: 'secondary' as const }
    }
    return { label: 'In Stock', variant: 'outline' as const }
  }

  return (
    <div>
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by name, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">SKU</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stock Status</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  {searchQuery ? 'No products found matching your search.' : 'No products found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const stockStatus = getStockStatus(product)
                const isLowStock = product.total_quantity <= product.min_stock_level
                
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <Link 
                          href={`/inventory/products/${product.id}`}
                          className="hover:underline"
                        >
                          {product.name}
                        </Link>
                        {isLowStock && product.total_quantity > 0 && (
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{product.category || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={stockStatus.variant}>
                        {stockStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      product.total_quantity === 0 && "text-red-600"
                    )}>
                      {product.total_quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.available_quantity}
                    </TableCell>
                    <TableCell>{product.unit_of_measure}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/inventory/products/${product.id}`}>
                              View details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/inventory/products/${product.id}/edit`}>
                              Edit product
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/inventory/receive?product=${product.id}`}>
                              Receive inventory
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            Deactivate product
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}