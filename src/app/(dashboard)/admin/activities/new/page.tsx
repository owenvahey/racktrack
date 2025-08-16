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
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'

const activityTypes = [
  { value: 'setup', label: 'Setup' },
  { value: 'production', label: 'Production' },
  { value: 'quality_check', label: 'Quality Check' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'cleanup', label: 'Cleanup' },
  { value: 'maintenance', label: 'Maintenance' }
]

export default function NewActivityPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    activity_type: 'production',
    requires_skill_level: 1,
    is_active: true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.code || !formData.name || !formData.activity_type) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          code: formData.code.toUpperCase(),
          name: formData.name,
          description: formData.description || null,
          activity_type: formData.activity_type,
          requires_skill_level: formData.requires_skill_level,
          is_active: formData.is_active
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          toast.error('An activity with this code already exists')
        } else {
          toast.error('Failed to create activity')
        }
        console.error('Error creating activity:', error)
        return
      }

      toast.success('Activity created successfully')
      router.push(`/admin/activities/${data.id}`)
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
          <h1 className="text-3xl font-bold">New Activity</h1>
          <p className="text-muted-foreground mt-1">
            Create a new production activity
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Activity Details</CardTitle>
            <CardDescription>
              Enter the information for the new activity
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
                Create Activity
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}