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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'

const workCenterTypes = [
  { value: 'printing', label: 'Printing' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'heat_press', label: 'Heat Press' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'sewing', label: 'Sewing' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'quality_control', label: 'Quality Control' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'other', label: 'Other' }
]

export default function NewWorkCenterPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    type: 'other',
    capacity_per_hour: '',
    cost_per_hour: '',
    is_active: true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.code || !formData.name || !formData.type) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('work_centers')
        .insert({
          code: formData.code.toUpperCase(),
          name: formData.name,
          description: formData.description || null,
          type: formData.type,
          capacity_per_hour: formData.capacity_per_hour ? parseFloat(formData.capacity_per_hour) : null,
          cost_per_hour: formData.cost_per_hour ? parseFloat(formData.cost_per_hour) : null,
          is_active: formData.is_active
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          toast.error('A work center with this code already exists')
        } else {
          toast.error('Failed to create work center')
        }
        console.error('Error creating work center:', error)
        return
      }

      toast.success('Work center created successfully')
      router.push(`/admin/work-centers/${data.id}`)
    } catch (error) {
      console.error('Error:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/work-centers')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Work Center</h1>
          <p className="text-muted-foreground mt-1">
            Create a new production work center
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Work Center Details</CardTitle>
            <CardDescription>
              Enter the information for the new work center
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="WC001"
                  className="uppercase"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier for the work center
                </p>
              </div>
              
              <div>
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workCenterTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Main Printing Station"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the work center's capabilities and equipment..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="capacity">Capacity per Hour</Label>
                <Input
                  id="capacity"
                  type="number"
                  step="0.01"
                  value={formData.capacity_per_hour}
                  onChange={(e) => setFormData({ ...formData, capacity_per_hour: e.target.value })}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Units this work center can process per hour
                </p>
              </div>
              
              <div>
                <Label htmlFor="cost">Cost per Hour ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost_per_hour}
                  onChange={(e) => setFormData({ ...formData, cost_per_hour: e.target.value })}
                  placeholder="50.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Operating cost per hour
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="active" className="flex flex-col gap-1">
                <span>Active</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Enable this work center for production
                </span>
              </Label>
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/work-centers')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Create Work Center
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}