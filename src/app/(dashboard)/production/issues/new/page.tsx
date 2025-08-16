'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ArrowLeft,
  Save,
  AlertCircle,
  Loader2,
  Package2,
  Wrench,
  AlertTriangle,
  Camera,
  Upload
} from 'lucide-react'

export default function NewIssuePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Pre-populated values from URL params
  const jobRouteId = searchParams.get('jobRouteId')
  const jobId = searchParams.get('jobId')
  
  // Lists for dropdowns
  const [workCenters, setWorkCenters] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [jobRouteDetails, setJobRouteDetails] = useState<any>(null)
  
  // Form data
  const [formData, setFormData] = useState({
    issue_type: 'process' as 'raw_material' | 'process' | 'equipment' | 'other',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    title: '',
    description: '',
    
    // Material tracking
    material_product_id: '',
    lot_number: '',
    supplier_info: '',
    
    // Process tracking
    work_center_id: '',
    activity_id: '',
    
    // Metrics
    quantity_affected: 0,
    downtime_minutes: 0,
    cost_impact: 0
  })

  useEffect(() => {
    fetchInitialData()
  }, [jobRouteId])

  async function fetchInitialData() {
    setLoading(true)
    try {
      // Fetch work centers
      const { data: workCentersData } = await supabase
        .from('work_centers')
        .select('*')
        .eq('is_active', true)
        .order('name')
      
      setWorkCenters(workCentersData || [])
      
      // Fetch activities
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('*')
        .eq('is_active', true)
        .order('name')
      
      setActivities(activitiesData || [])
      
      // Fetch materials
      const { data: materialsData } = await supabase
        .from('products')
        .select('*')
        .eq('product_type', 'raw_material')
        .order('name')
      
      setMaterials(materialsData || [])
      
      // If job route ID provided, fetch details
      if (jobRouteId) {
        const { data: routeData } = await supabase
          .from('job_routes')
          .select(`
            *,
            job:jobs (
              job_number,
              job_name
            ),
            activity:activities (
              id,
              name
            ),
            work_center:work_centers (
              id,
              name
            )
          `)
          .eq('id', jobRouteId)
          .single()
        
        if (routeData) {
          setJobRouteDetails(routeData)
          setFormData(prev => ({
            ...prev,
            work_center_id: routeData.work_center_id,
            activity_id: routeData.activity_id
          }))
        }
      }
      
    } catch (error) {
      console.error('Error fetching initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data: user } = await supabase.auth.getUser()
      
      const issueData = {
        job_route_id: jobRouteId,
        job_id: jobId || jobRouteDetails?.job_id,
        issue_type: formData.issue_type,
        severity: formData.severity,
        title: formData.title,
        description: formData.description,
        
        // Only include relevant fields based on issue type
        ...(formData.issue_type === 'raw_material' && {
          material_product_id: formData.material_product_id || null,
          lot_number: formData.lot_number || null,
          supplier_info: formData.supplier_info || null,
        }),
        
        work_center_id: formData.work_center_id || null,
        activity_id: formData.activity_id || null,
        operator_id: user.user?.id,
        
        quantity_affected: formData.quantity_affected || null,
        downtime_minutes: formData.downtime_minutes || null,
        cost_impact: formData.cost_impact || null,
        
        reported_by: user.user?.id,
        status: 'open'
      }
      
      const { data, error } = await supabase
        .from('production_issues')
        .insert(issueData)
        .select()
        .single()
      
      if (error) throw error
      
      // Redirect to issue detail page
      router.push(`/production/issues/${data.id}`)
    } catch (error) {
      console.error('Error creating issue:', error)
      setError('Failed to create issue')
    } finally {
      setSaving(false)
    }
  }

  const issueTypeConfig = {
    raw_material: {
      icon: Package2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      label: 'Raw Material Issue',
      description: 'Problem with incoming materials, quality, or supplier'
    },
    process: {
      icon: Wrench,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      label: 'Process Issue',
      description: 'Problem with production process or procedures'
    },
    equipment: {
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      label: 'Equipment Issue',
      description: 'Machine malfunction or equipment failure'
    },
    other: {
      icon: AlertTriangle,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      label: 'Other Issue',
      description: 'Any other production-related issue'
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Report Production Issue</h1>
          <p className="text-muted-foreground mt-1">
            Document any issues encountered during production
          </p>
        </div>
      </div>

      {jobRouteDetails && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Reporting issue for Job {jobRouteDetails.job.job_number} - {jobRouteDetails.activity.name}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Issue Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Issue Type</CardTitle>
            <CardDescription>
              Select the category that best describes the issue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(issueTypeConfig).map(([type, config]) => {
                const Icon = config.icon
                const isSelected = formData.issue_type === type
                
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, issue_type: type as any })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? `border-${config.color.split('-')[1]}-500 ${config.bgColor}`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`h-8 w-8 mx-auto mb-2 ${config.color}`} />
                    <p className="font-medium text-sm">{config.label}</p>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Issue Details */}
        <Card>
          <CardHeader>
            <CardTitle>Issue Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="title">Issue Title*</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Brief description of the issue"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="severity">Severity*</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value: any) => setFormData({ ...formData, severity: value })}
                >
                  <SelectTrigger id="severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Minor impact</SelectItem>
                    <SelectItem value="medium">Medium - Moderate impact</SelectItem>
                    <SelectItem value="high">High - Significant impact</SelectItem>
                    <SelectItem value="critical">Critical - Production stopped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="quantity_affected">Quantity Affected</Label>
                <Input
                  id="quantity_affected"
                  type="number"
                  min="0"
                  value={formData.quantity_affected}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    quantity_affected: parseInt(e.target.value) || 0 
                  })}
                  placeholder="Units affected"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="description">Detailed Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Provide detailed information about the issue..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Context Information */}
        <Card>
          <CardHeader>
            <CardTitle>Context Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="work_center_id">Work Center</Label>
                <Select
                  value={formData.work_center_id}
                  onValueChange={(value) => setFormData({ ...formData, work_center_id: value })}
                  disabled={!!jobRouteDetails}
                >
                  <SelectTrigger id="work_center_id">
                    <SelectValue placeholder="Select work center" />
                  </SelectTrigger>
                  <SelectContent>
                    {workCenters.map(wc => (
                      <SelectItem key={wc.id} value={wc.id}>
                        {wc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="activity_id">Activity</Label>
                <Select
                  value={formData.activity_id}
                  onValueChange={(value) => setFormData({ ...formData, activity_id: value })}
                  disabled={!!jobRouteDetails}
                >
                  <SelectTrigger id="activity_id">
                    <SelectValue placeholder="Select activity" />
                  </SelectTrigger>
                  <SelectContent>
                    {activities.map(activity => (
                      <SelectItem key={activity.id} value={activity.id}>
                        {activity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Material Information (for raw material issues) */}
        {formData.issue_type === 'raw_material' && (
          <Card>
            <CardHeader>
              <CardTitle>Material Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="material_product_id">Material</Label>
                  <Select
                    value={formData.material_product_id}
                    onValueChange={(value) => setFormData({ ...formData, material_product_id: value })}
                  >
                    <SelectTrigger id="material_product_id">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map(material => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name} ({material.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="lot_number">Lot Number</Label>
                  <Input
                    id="lot_number"
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                    placeholder="Material lot number"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="supplier_info">Supplier Information</Label>
                  <Textarea
                    id="supplier_info"
                    value={formData.supplier_info}
                    onChange={(e) => setFormData({ ...formData, supplier_info: e.target.value })}
                    rows={2}
                    placeholder="Any relevant supplier details..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Impact Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Impact Metrics</CardTitle>
            <CardDescription>
              Estimate the impact of this issue on production
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="downtime_minutes">Downtime (minutes)</Label>
                <Input
                  id="downtime_minutes"
                  type="number"
                  min="0"
                  value={formData.downtime_minutes}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    downtime_minutes: parseInt(e.target.value) || 0 
                  })}
                  placeholder="0"
                />
              </div>
              
              <div>
                <Label htmlFor="cost_impact">Estimated Cost Impact ($)</Label>
                <Input
                  id="cost_impact"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost_impact}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    cost_impact: parseFloat(e.target.value) || 0 
                  })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !formData.title}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Report Issue
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}