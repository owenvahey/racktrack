'use client'

import { useState, useEffect } from 'react'
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
import { Loader2, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Product, Pallet } from '@/types/inventory.types'
import { useQuery } from '@tanstack/react-query'

const formSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  pallet_id: z.string().optional(),
  quantity: z.string().refine(val => parseInt(val) >= 1, 'Quantity must be at least 1'),
  lot_number: z.string().optional(),
  batch_number: z.string().optional(),
  unit_cost: z.string().optional(),
  expiration_date: z.string().optional(),
  quality_status: z.enum(['pending', 'approved', 'rejected', 'quarantine']),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface ReceiveFormProps {
  preselectedProduct?: Product | null
  onComplete?: () => void
}

export function ReceiveForm({ preselectedProduct, onComplete }: ReceiveFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [createNewPallet, setCreateNewPallet] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name')
      return data || []
    },
  })

  // Fetch pallets
  const { data: pallets = [] } = useQuery({
    queryKey: ['pallets'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pallets')
        .select('*')
        .in('status', ['receiving', 'stored'])
        .order('pallet_number', { ascending: false })
      return data || []
    },
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_id: preselectedProduct?.id || '',
      pallet_id: '',
      quantity: '1',
      lot_number: '',
      batch_number: '',
      unit_cost: '',
      expiration_date: '',
      quality_status: 'pending' as const,
      notes: '',
    },
  })

  // Update form when preselected product changes
  useEffect(() => {
    if (preselectedProduct) {
      form.setValue('product_id', preselectedProduct.id)
      if (preselectedProduct.cost_per_unit) {
        form.setValue('unit_cost', preselectedProduct.cost_per_unit.toString())
      }
    }
  }, [preselectedProduct, form])

  async function onSubmit(data: FormData) {
    setIsLoading(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      let palletId = data.pallet_id

      // Create new pallet if needed
      if (createNewPallet || !palletId) {
        const { data: newPallet, error: palletError } = await supabase
          .from('pallets')
          .insert({
            status: 'receiving',
            created_by: user.id,
            received_date: new Date().toISOString(),
          })
          .select()
          .single()

        if (palletError) throw palletError
        palletId = newPallet.id
      }

      // Create inventory record
      const { data: inventory, error: inventoryError } = await supabase
        .from('inventory')
        .insert({
          product_id: data.product_id,
          pallet_id: palletId,
          quantity: parseInt(data.quantity),
          lot_number: data.lot_number || null,
          batch_number: data.batch_number || null,
          unit_cost: data.unit_cost ? parseFloat(data.unit_cost) : null,
          expiration_date: data.expiration_date || null,
          quality_status: data.quality_status,
          received_date: new Date().toISOString(),
        })
        .select()
        .single()

      if (inventoryError) throw inventoryError

      // Record movement
      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          inventory_id: inventory.id,
          pallet_id: palletId,
          movement_type: 'receive',
          quantity_before: 0,
          quantity_change: parseInt(data.quantity),
          quantity_after: parseInt(data.quantity),
          performed_by: user.id,
          notes: data.notes || null,
          reason: 'Initial receipt',
        })

      if (movementError) throw movementError

      toast.success('Inventory received successfully')
      
      if (onComplete) {
        onComplete()
      } else {
        form.reset()
      }
    } catch (error: any) {
      console.error('Error receiving inventory:', error)
      toast.error(error.message || 'Failed to receive inventory')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="product_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product *</FormLabel>
              <Select
                disabled={isLoading || !!preselectedProduct}
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product">
                      {field.value && (
                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-2" />
                          {products.find(p => p.id === field.value)?.name}
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center">
                        <Package className="h-4 w-4 mr-2" />
                        {product.name} ({product.sku})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Button
              type="button"
              variant={createNewPallet ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCreateNewPallet(true)}
            >
              Create New Pallet
            </Button>
            <Button
              type="button"
              variant={!createNewPallet ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCreateNewPallet(false)}
            >
              Use Existing Pallet
            </Button>
          </div>

          {!createNewPallet && (
            <FormField
              control={form.control}
              name="pallet_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Pallet</FormLabel>
                  <Select
                    disabled={isLoading}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a pallet" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pallets.map((pallet) => (
                        <SelectItem key={pallet.id} value={pallet.id}>
                          {pallet.pallet_number} - {pallet.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    placeholder="1"
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
            name="unit_cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit Cost ($)</FormLabel>
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
            name="lot_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lot Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="LOT-001"
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
            name="batch_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="BATCH-001"
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
            name="expiration_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expiration Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
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
            name="quality_status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quality Status</FormLabel>
                <Select
                  disabled={isLoading}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">Pending Inspection</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="quarantine">Quarantine</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes..."
                  disabled={isLoading}
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
            Receive Inventory
          </Button>
        </div>
      </form>
    </Form>
  )
}