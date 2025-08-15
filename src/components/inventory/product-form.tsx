'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Product } from '@/types/inventory.types'

const formSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  name: z.string().min(1, 'Product name is required').max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  unit_of_measure: z.string().min(1, 'Unit of measure is required'),
  weight_per_unit: z.coerce.number().optional(),
  cost_per_unit: z.coerce.number().optional(),
  sell_price: z.coerce.number().optional(),
  barcode: z.string().optional(),
  min_stock_level: z.coerce.number().min(0).default(0),
  max_stock_level: z.coerce.number().optional(),
})

type FormData = z.infer<typeof formSchema>

interface ProductFormProps {
  product?: Product
}

const categories = [
  'Apparel',
  'Accessories',
  'Promotional Items',
  'Packaging',
  'Raw Materials',
  'Other',
]

const units = [
  'each',
  'box',
  'case',
  'pallet',
  'pound',
  'kilogram',
  'meter',
  'yard',
  'liter',
  'gallon',
]

export function ProductForm({ product }: ProductFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: product?.sku || '',
      name: product?.name || '',
      description: product?.description || '',
      category: product?.category || '',
      subcategory: product?.subcategory || '',
      unit_of_measure: product?.unit_of_measure || 'each',
      weight_per_unit: product?.weight_per_unit || undefined,
      cost_per_unit: product?.cost_per_unit || undefined,
      sell_price: product?.sell_price || undefined,
      barcode: product?.barcode || '',
      min_stock_level: product?.min_stock_level || 0,
      max_stock_level: product?.max_stock_level || undefined,
    },
  })

  async function onSubmit(data: FormData) {
    setIsLoading(true)

    try {
      if (product) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id)

        if (error) throw error
        toast.success('Product updated successfully')
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert([data])

        if (error) throw error
        toast.success('Product created successfully')
      }

      router.push('/inventory/products')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save product')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="PROD-001"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Unique stock keeping unit identifier
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="barcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Barcode</FormLabel>
                <FormControl>
                  <Input
                    placeholder="123456789012"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  UPC, EAN, or custom barcode
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name *</FormLabel>
              <FormControl>
                <Input
                  placeholder="T-Shirt - Large - Blue"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Product details and specifications..."
                  disabled={isLoading}
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select
                  disabled={isLoading}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subcategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subcategory</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Optional subcategory"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="unit_of_measure"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit of Measure *</FormLabel>
                <Select
                  disabled={isLoading}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weight_per_unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight per Unit (kg)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="0.0000"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="cost_per_unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cost per Unit ($)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sell_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sell Price ($)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="min_stock_level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Stock Level</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Alert when stock falls below this level
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="max_stock_level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum Stock Level</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Optional"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Maximum quantity to keep in stock
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {product ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Form>
  )
}