'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Warehouse, Trash2, Edit2, Loader2 } from 'lucide-react'

export default function ConfigureLocationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false)
  const [isAddingAisle, setIsAddingAisle] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')

  // Form states
  const [warehouseForm, setWarehouseForm] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
  })

  const [aisleForm, setAisleForm] = useState({
    warehouse_id: '',
    code: '',
    name: '',
    description: '',
  })

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('*')
        .order('name')

      return data || []
    },
  })

  // Fetch aisles
  const { data: aisles = [] } = useQuery({
    queryKey: ['aisles-config', selectedWarehouse],
    queryFn: async () => {
      let query = supabase
        .from('aisles')
        .select(`
          *,
          warehouse:warehouses(name)
        `)
        .order('code')

      if (selectedWarehouse) {
        query = query.eq('warehouse_id', selectedWarehouse)
      }

      const { data } = await query
      return data || []
    },
  })

  // Add warehouse mutation
  const addWarehouseMutation = useMutation({
    mutationFn: async (data: typeof warehouseForm) => {
      const { error } = await supabase
        .from('warehouses')
        .insert([data])

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses-config'] })
      toast.success('Warehouse added successfully')
      setIsAddingWarehouse(false)
      setWarehouseForm({
        name: '',
        code: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
      })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add warehouse')
    },
  })

  // Add aisle mutation
  const addAisleMutation = useMutation({
    mutationFn: async (data: typeof aisleForm) => {
      const { error } = await supabase
        .from('aisles')
        .insert([data])

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aisles-config'] })
      toast.success('Aisle added successfully')
      setIsAddingAisle(false)
      setAisleForm({
        warehouse_id: '',
        code: '',
        name: '',
        description: '',
      })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add aisle')
    },
  })

  const handleAddWarehouse = () => {
    if (!warehouseForm.name || !warehouseForm.code) {
      toast.error('Name and code are required')
      return
    }
    addWarehouseMutation.mutate(warehouseForm)
  }

  const handleAddAisle = () => {
    if (!aisleForm.warehouse_id || !aisleForm.code) {
      toast.error('Warehouse and code are required')
      return
    }
    addAisleMutation.mutate(aisleForm)
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
        <div>
          <h1 className="text-3xl font-bold">Configure Locations</h1>
          <p className="text-muted-foreground">
            Set up warehouses, aisles, shelves, and storage slots
          </p>
        </div>
      </div>

      {/* Warehouses Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Warehouses</CardTitle>
              <CardDescription>
                Manage your warehouse locations
              </CardDescription>
            </div>
            <Dialog open={isAddingWarehouse} onOpenChange={setIsAddingWarehouse}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Warehouse
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Warehouse</DialogTitle>
                  <DialogDescription>
                    Enter the details for the new warehouse location
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={warehouseForm.name}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                        placeholder="Main Warehouse"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code">Code *</Label>
                      <Input
                        id="code"
                        value={warehouseForm.code}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })}
                        placeholder="WH01"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={warehouseForm.address}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={warehouseForm.city}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, city: e.target.value })}
                        placeholder="New York"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={warehouseForm.state}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, state: e.target.value })}
                        placeholder="NY"
                        maxLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP Code</Label>
                      <Input
                        id="zip"
                        value={warehouseForm.zip_code}
                        onChange={(e) => setWarehouseForm({ ...warehouseForm, zip_code: e.target.value })}
                        placeholder="10001"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddingWarehouse(false)}
                    disabled={addWarehouseMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddWarehouse}
                    disabled={addWarehouseMutation.isPending}
                  >
                    {addWarehouseMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Add Warehouse
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {warehouses.map((warehouse) => (
              <div
                key={warehouse.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Warehouse className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{warehouse.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {warehouse.code} • {warehouse.city}, {warehouse.state}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aisles Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Aisles</CardTitle>
              <CardDescription>
                Configure aisles within your warehouses
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={isAddingAisle} onOpenChange={setIsAddingAisle}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Aisle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Aisle</DialogTitle>
                    <DialogDescription>
                      Configure a new aisle in your warehouse
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="warehouse">Warehouse *</Label>
                      <Select
                        value={aisleForm.warehouse_id}
                        onValueChange={(value) => setAisleForm({ ...aisleForm, warehouse_id: value })}
                      >
                        <SelectTrigger id="warehouse">
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="aisle-code">Code *</Label>
                        <Input
                          id="aisle-code"
                          value={aisleForm.code}
                          onChange={(e) => setAisleForm({ ...aisleForm, code: e.target.value.toUpperCase() })}
                          placeholder="A01"
                          maxLength={5}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aisle-name">Name</Label>
                        <Input
                          id="aisle-name"
                          value={aisleForm.name}
                          onChange={(e) => setAisleForm({ ...aisleForm, name: e.target.value })}
                          placeholder="Aisle 1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={aisleForm.description}
                        onChange={(e) => setAisleForm({ ...aisleForm, description: e.target.value })}
                        placeholder="Description of what's stored in this aisle"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddingAisle(false)}
                      disabled={addAisleMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddAisle}
                      disabled={addAisleMutation.isPending}
                    >
                      {addAisleMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Add Aisle
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {aisles.map((aisle) => (
              <div
                key={aisle.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">
                    Aisle {aisle.code} {aisle.name && `- ${aisle.name}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {aisle.warehouse?.name} • {aisle.description || 'No description'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/locations/aisle/${aisle.id}/configure`)}
                  >
                    Configure Shelves
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}