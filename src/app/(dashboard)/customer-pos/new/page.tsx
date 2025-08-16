'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  Plus,
  Trash2,
  Save,
  Send,
  Loader2,
  Package,
  Calendar,
  Building2,
  Search
} from 'lucide-react'
import { format } from 'date-fns'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Customer {
  id: string
  name: string
  company_name?: string
  qb_customer_id?: string
}

interface Product {
  id: string
  name: string
  sku: string
  description?: string
  cost_per_unit: number
  sell_price: number
  unit_of_measure: string
}

interface POItem {
  product_id?: string
  product?: Product
  description: string
  quantity: number
  unit_price: number
  unit_of_measure: string
}

export default function NewCustomerPOPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [searchingProducts, setSearchingProducts] = useState(false)
  
  // Form state
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [poDate, setPODate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dueDate, setDueDate] = useState('')
  const [items, setItems] = useState<POItem[]>([])

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    setLoading(true)
    try {
      // Fetch customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name, company_name, qb_customer_id')
        .eq('is_active', true)
        .order('name')

      setCustomers(customersData || [])

      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name')

      setProducts(productsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  function addItem() {
    setItems([...items, {
      description: '',
      quantity: 1,
      unit_price: 0,
      unit_of_measure: 'Each'
    }])
  }

  function updateItem(index: number, field: keyof POItem, value: any) {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // If product is selected, auto-fill details
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === value)
      if (product) {
        newItems[index].product = product
        newItems[index].description = product.name
        newItems[index].unit_price = product.sell_price || product.cost_per_unit
        newItems[index].unit_of_measure = product.unit_of_measure
      }
    }
    
    setItems(newItems)
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  async function handleSave(sendForApproval = false) {
    if (!customerId) {
      toast.error('Error', {
        description: 'Please select a customer',
      })
      return
    }

    if (items.length === 0) {
      toast.error('Error', {
        description: 'Please add at least one item',
      })
      return
    }

    setSaving(true)
    try {
      const poData = {
        customer_id: customerId,
        description,
        po_date: poDate,
        due_date: dueDate || null,
        production_status: sendForApproval ? 'pending_approval' : 'draft',
        total_amount: calculateTotal()
      }

      const response = await fetch('/api/customer-pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...poData,
          items: items.map(item => ({
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            unit_of_measure: item.unit_of_measure
          }))
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create PO')
      }

      const newPO = await response.json()

      // If customer has QB ID and sending for approval, sync to QB
      const customer = customers.find(c => c.id === customerId)
      if (sendForApproval && customer?.qb_customer_id) {
        await syncToQuickBooks(newPO.id)
      }

      toast.success('Success', {
        description: `PO ${newPO.po_number} created successfully`,
      })

      router.push(`/customer-pos/${newPO.id}`)
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to create PO',
      })
    } finally {
      setSaving(false)
    }
  }

  async function syncToQuickBooks(poId: string) {
    try {
      await fetch(`/api/customer-pos/${poId}/sync-estimate`, {
        method: 'POST'
      })
    } catch (error) {
      console.error('QB sync error:', error)
      // Don't show error to user, QB sync is not critical
    }
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
          onClick={() => router.push('/customer-pos')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Customer PO</h1>
          <p className="text-muted-foreground mt-2">
            Create a new customer purchase order
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>PO Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerOpen}
                        className="w-full justify-between"
                      >
                        {customerId
                          ? customers.find(c => c.id === customerId)?.name
                          : "Select customer..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Search customers..." 
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                        />
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customers
                            .filter(c => 
                              c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                              c.company_name?.toLowerCase().includes(customerSearch.toLowerCase())
                            )
                            .slice(0, 10)
                            .map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.id}
                                onSelect={(value) => {
                                  setCustomerId(value)
                                  setCustomerOpen(false)
                                  setCustomerSearch('')
                                }}
                              >
                                <div>
                                  <p className="font-medium">{customer.name}</p>
                                  {customer.company_name && (
                                    <p className="text-sm text-muted-foreground">{customer.company_name}</p>
                                  )}
                                </div>
                                {!customer.qb_customer_id && (
                                  <span className="ml-auto text-xs text-muted-foreground">Not in QB</span>
                                )}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>PO Date</Label>
                  <Input
                    type="date"
                    value={poDate}
                    onChange={(e) => setPODate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ship Date</Label>
                  <Input
                    type="date"
                    disabled
                    placeholder="Set after production"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description / Notes</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Any special instructions or notes..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                <Button size="sm" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => updateItem(index, 'product_id', value)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Custom Item</SelectItem>
                            {products.map(product => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.sku} - {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Item description..."
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-20"
                          min="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.unit_of_measure}
                          onChange={(e) => updateItem(index, 'unit_of_measure', e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-24"
                          min="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No items added. Click "Add Item" to begin.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${calculateTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>$0.00</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Save as draft or send for customer approval
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save as Draft
              </Button>
              <Button
                className="w-full"
                variant="default"
                onClick={() => handleSave(true)}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send for Approval
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                {customerId && customers.find(c => c.id === customerId)?.qb_customer_id
                  ? 'Will create estimate in QuickBooks when sent for approval'
                  : 'Customer must be synced to QuickBooks first for estimate creation'
                }
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}