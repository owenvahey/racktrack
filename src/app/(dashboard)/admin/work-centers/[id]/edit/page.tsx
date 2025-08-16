'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WorkCenter } from '@/types/production.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { ArrowLeft, Save, Loader2, Trash2, AlertCircle } from 'lucide-react'

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

export default function EditWorkCenterPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const resolvedParams = use(params)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [workCenter, setWorkCenter] = useState<WorkCenter | null>(null)
  const [hasActiveJobs, setHasActiveJobs] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    type: 'other',
    capacity_per_hour: '',
    cost_per_hour: '',
    is_active: true
  })

  useEffect(() => {
    fetchWorkCenter()
    checkActiveJobs()
  }, [resolvedParams.id])

  async function fetchWorkCenter() {
    try {
      const { data, error } = await supabase
        .from('work_centers')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (error) throw error
      
      setWorkCenter(data)
      setFormData({
        code: data.code,
        name: data.name,
        description: data.description || '',
        type: data.type,
        capacity_per_hour: data.capacity_per_hour?.toString() || '',
        cost_per_hour: data.cost_per_hour?.toString() || '',
        is_active: data.is_active
      })
    } catch (error) {
      console.error('Error fetching work center:', error)
      toast.error('Failed to load work center')
    } finally {
      setLoading(false)
    }
  }

  async function checkActiveJobs() {
    try {
      const { data, error } = await supabase
        .from('job_routes')
        .select('id')
        .eq('work_center_id', resolvedParams.id)
        .in('status', ['pending', 'ready', 'setup', 'in_progress', 'paused'])
        .limit(1)

      if (!error && data && data.length > 0) {
        setHasActiveJobs(true)
      }
    } catch (error) {
      console.error('Error checking active jobs:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.code || !formData.name || !formData.type) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('work_centers')
        .update({
          code: formData.code.toUpperCase(),
          name: formData.name,
          description: formData.description || null,
          type: formData.type,
          capacity_per_hour: formData.capacity_per_hour ? parseFloat(formData.capacity_per_hour) : null,
          cost_per_hour: formData.cost_per_hour ? parseFloat(formData.cost_per_hour) : null,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', resolvedParams.id)

      if (error) {
        if (error.code === '23505') {
          toast.error('A work center with this code already exists')
        } else {
          toast.error('Failed to update work center')
        }
        console.error('Error updating work center:', error)
        return
      }

      toast.success('Work center updated successfully')
      router.push(`/admin/work-centers/${resolvedParams.id}`)
    } catch (error) {
      console.error('Error:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (hasActiveJobs) {
      toast.error('Cannot delete work center with active jobs')
      return
    }

    setDeleting(true)
    
    try {
      const { error } = await supabase
        .from('work_centers')
        .delete()
        .eq('id', resolvedParams.id)

      if (error) {
        toast.error('Failed to delete work center')
        console.error('Error deleting work center:', error)
        return
      }

      toast.success('Work center deleted successfully')
      router.push('/admin/work-centers')
    } catch (error) {
      console.error('Error:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!workCenter) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Work center not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/admin/work-centers/${resolvedParams.id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Work Center</h1>
          <p className="text-muted-foreground mt-1">
            Update work center information
          </p>
        </div>
      </div>

      {hasActiveJobs && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This work center has active jobs. Some actions may be restricted.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Work Center Details</CardTitle>
            <CardDescription>
              Update the information for this work center
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
                disabled={hasActiveJobs && formData.is_active}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                type="button" 
                variant="destructive"
                disabled={hasActiveJobs || deleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Work Center?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  work center and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/work-centers/${resolvedParams.id}`)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}