'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Activity } from '@/types/production.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
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

const activityTypes = [
  { value: 'setup', label: 'Setup' },
  { value: 'production', label: 'Production' },
  { value: 'quality_check', label: 'Quality Check' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'cleanup', label: 'Cleanup' },
  { value: 'maintenance', label: 'Maintenance' }
]

export default function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const resolvedParams = use(params)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activity, setActivity] = useState<Activity | null>(null)
  const [hasActiveJobs, setHasActiveJobs] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    activity_type: 'production',
    requires_skill_level: 1,
    is_active: true
  })

  useEffect(() => {
    fetchActivity()
    checkActiveJobs()
  }, [resolvedParams.id])

  async function fetchActivity() {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (error) throw error
      
      setActivity(data)
      setFormData({
        code: data.code,
        name: data.name,
        description: data.description || '',
        activity_type: data.activity_type,
        requires_skill_level: data.requires_skill_level,
        is_active: data.is_active
      })
    } catch (error) {
      console.error('Error fetching activity:', error)
      toast.error('Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  async function checkActiveJobs() {
    try {
      const { data, error } = await supabase
        .from('job_routes')
        .select('id')
        .eq('activity_id', resolvedParams.id)
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
    
    if (!formData.code || !formData.name || !formData.activity_type) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('activities')
        .update({
          code: formData.code.toUpperCase(),
          name: formData.name,
          description: formData.description || null,
          activity_type: formData.activity_type,
          requires_skill_level: formData.requires_skill_level,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', resolvedParams.id)

      if (error) {
        if (error.code === '23505') {
          toast.error('An activity with this code already exists')
        } else {
          toast.error('Failed to update activity')
        }
        console.error('Error updating activity:', error)
        return
      }

      toast.success('Activity updated successfully')
      router.push(`/admin/activities/${resolvedParams.id}`)
    } catch (error) {
      console.error('Error:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (hasActiveJobs) {
      toast.error('Cannot delete activity with active jobs')
      return
    }

    setDeleting(true)
    
    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', resolvedParams.id)

      if (error) {
        toast.error('Failed to delete activity')
        console.error('Error deleting activity:', error)
        return
      }

      toast.success('Activity deleted successfully')
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

  if (!activity) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Activity not found</p>
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
          onClick={() => router.push(`/admin/activities/${resolvedParams.id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Activity</h1>
          <p className="text-muted-foreground mt-1">
            Update activity information
          </p>
        </div>
      </div>

      {hasActiveJobs && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This activity has active jobs. Some actions may be restricted.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Activity Details</CardTitle>
            <CardDescription>
              Update the information for this activity
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
                  placeholder="ACT001"
                  className="uppercase"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier for the activity
                </p>
              </div>
              
              <div>
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.activity_type}
                  onValueChange={(value) => setFormData({ ...formData, activity_type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypes.map((type) => (
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
                placeholder="Screen Printing Setup"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this activity involves..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="skill">Required Skill Level</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="skill"
                  min={1}
                  max={5}
                  step={1}
                  value={[formData.requires_skill_level]}
                  onValueChange={(value) => setFormData({ ...formData, requires_skill_level: value[0] })}
                  className="flex-1"
                />
                <span className="w-12 text-center font-medium">
                  {formData.requires_skill_level}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                1 = Entry level, 5 = Expert level
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="active" className="flex flex-col gap-1">
                <span>Active</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Enable this activity for production
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
                <AlertDialogTitle>Delete Activity?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  activity and all associated data.
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
              onClick={() => router.push(`/admin/activities/${resolvedParams.id}`)}
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