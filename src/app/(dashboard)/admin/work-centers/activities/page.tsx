'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WorkCenter, Activity, WorkCenterActivity } from '@/types/production.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
  ArrowLeft,
  Save,
  Loader2,
  Settings,
  Clock,
  Package,
  Zap
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface WorkCenterWithActivities extends WorkCenter {
  activities: (WorkCenterActivity & { activity: Activity })[]
}

interface AssignmentFormData {
  setup_time_minutes: number
  run_time_per_unit: number
  min_batch_size: number
  max_batch_size: number
  efficiency_factor: number
}

export default function WorkCenterActivitiesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [workCenters, setWorkCenters] = useState<WorkCenterWithActivities[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<WorkCenterWithActivities | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [configData, setConfigData] = useState<AssignmentFormData>({
    setup_time_minutes: 0,
    run_time_per_unit: 0,
    min_batch_size: 1,
    max_batch_size: 0,
    efficiency_factor: 1.0
  })

  // Track which activities are assigned to which work centers
  const [assignments, setAssignments] = useState<Record<string, Set<string>>>({})

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      // Fetch work centers with their activities
      const { data: wcData, error: wcError } = await supabase
        .from('work_centers')
        .select(`
          *,
          activities:work_center_activities(
            *,
            activity:activities(*)
          )
        `)
        .eq('is_active', true)
        .order('name')

      if (wcError) throw wcError

      // Fetch all activities
      const { data: actData, error: actError } = await supabase
        .from('activities')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (actError) throw actError

      setWorkCenters(wcData || [])
      setActivities(actData || [])

      // Build assignments map
      const assignmentMap: Record<string, Set<string>> = {}
      wcData?.forEach(wc => {
        assignmentMap[wc.id] = new Set(wc.activities.map((a: any) => a.activity_id))
      })
      setAssignments(assignmentMap)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function handleAssignmentToggle(workCenterId: string, activityId: string) {
    const isAssigned = assignments[workCenterId]?.has(activityId)
    
    if (isAssigned) {
      // Unassign
      try {
        const { error } = await supabase
          .from('work_center_activities')
          .delete()
          .eq('work_center_id', workCenterId)
          .eq('activity_id', activityId)

        if (error) throw error

        setAssignments(prev => ({
          ...prev,
          [workCenterId]: new Set([...prev[workCenterId]].filter(id => id !== activityId))
        }))
        
        toast.success('Activity unassigned')
      } catch (error) {
        toast.error('Failed to unassign activity')
      }
    } else {
      // Show config dialog for new assignment
      const wc = workCenters.find(w => w.id === workCenterId)
      const act = activities.find(a => a.id === activityId)
      
      if (wc && act) {
        setSelectedWorkCenter(wc)
        setSelectedActivity(act)
        setShowConfigDialog(true)
      }
    }
  }

  async function handleSaveAssignment() {
    if (!selectedWorkCenter || !selectedActivity) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('work_center_activities')
        .insert({
          work_center_id: selectedWorkCenter.id,
          activity_id: selectedActivity.id,
          setup_time_minutes: configData.setup_time_minutes,
          run_time_per_unit: configData.run_time_per_unit || null,
          min_batch_size: configData.min_batch_size,
          max_batch_size: configData.max_batch_size || null,
          efficiency_factor: configData.efficiency_factor
        })

      if (error) throw error

      setAssignments(prev => ({
        ...prev,
        [selectedWorkCenter.id]: new Set([...prev[selectedWorkCenter.id] || [], selectedActivity.id])
      }))

      toast.success('Activity assigned successfully')
      setShowConfigDialog(false)
      
      // Reset form
      setConfigData({
        setup_time_minutes: 0,
        run_time_per_unit: 0,
        min_batch_size: 1,
        max_batch_size: 0,
        efficiency_factor: 1.0
      })
    } catch (error) {
      console.error('Error assigning activity:', error)
      toast.error('Failed to assign activity')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const activityTypeColors = {
    setup: 'bg-orange-100 text-orange-800',
    production: 'bg-blue-100 text-blue-800',
    quality_check: 'bg-yellow-100 text-yellow-800',
    packaging: 'bg-green-100 text-green-800',
    cleanup: 'bg-gray-100 text-gray-800',
    maintenance: 'bg-red-100 text-red-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/work-centers')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Work Center Activities</h1>
          <p className="text-muted-foreground mt-1">
            Assign activities to work centers and configure parameters
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Assignment Matrix</CardTitle>
          <CardDescription>
            Check the boxes to assign activities to work centers. Click on assigned activities to configure parameters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b font-medium">Work Center</th>
                  {activities.map(activity => (
                    <th key={activity.id} className="text-center p-2 border-b border-l min-w-[120px]">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{activity.name}</p>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${activityTypeColors[activity.activity_type]}`}
                        >
                          {activity.activity_type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workCenters.map(workCenter => (
                  <tr key={workCenter.id} className="hover:bg-gray-50">
                    <td className="p-2 border-b font-medium">
                      <div>
                        <p>{workCenter.name}</p>
                        <p className="text-sm text-muted-foreground">{workCenter.code}</p>
                      </div>
                    </td>
                    {activities.map(activity => {
                      const isAssigned = assignments[workCenter.id]?.has(activity.id)
                      const assignment = workCenter.activities.find(a => a.activity_id === activity.id)
                      
                      return (
                        <td key={activity.id} className="text-center p-2 border-b border-l">
                          <div className="flex flex-col items-center gap-1">
                            <Checkbox
                              checked={isAssigned}
                              onCheckedChange={() => handleAssignmentToggle(workCenter.id, activity.id)}
                            />
                            {isAssigned && assignment && (
                              <div className="text-xs text-muted-foreground">
                                <p>{assignment.setup_time_minutes}m setup</p>
                                {assignment.run_time_per_unit && (
                                  <p>{assignment.run_time_per_unit}m/unit</p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Activity Assignment</DialogTitle>
            <DialogDescription>
              Set up parameters for {selectedActivity?.name} at {selectedWorkCenter?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="setup-time">Setup Time (minutes)</Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="setup-time"
                    type="number"
                    min="0"
                    value={configData.setup_time_minutes}
                    onChange={(e) => setConfigData({ 
                      ...configData, 
                      setup_time_minutes: parseInt(e.target.value) || 0 
                    })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="run-time">Run Time per Unit (minutes)</Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="run-time"
                    type="number"
                    min="0"
                    step="0.01"
                    value={configData.run_time_per_unit}
                    onChange={(e) => setConfigData({ 
                      ...configData, 
                      run_time_per_unit: parseFloat(e.target.value) || 0 
                    })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min-batch">Minimum Batch Size</Label>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="min-batch"
                    type="number"
                    min="1"
                    value={configData.min_batch_size}
                    onChange={(e) => setConfigData({ 
                      ...configData, 
                      min_batch_size: parseInt(e.target.value) || 1 
                    })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="max-batch">Maximum Batch Size</Label>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="max-batch"
                    type="number"
                    min="0"
                    value={configData.max_batch_size}
                    onChange={(e) => setConfigData({ 
                      ...configData, 
                      max_batch_size: parseInt(e.target.value) || 0 
                    })}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="efficiency">Efficiency Factor</Label>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="efficiency"
                  type="number"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={configData.efficiency_factor}
                  onChange={(e) => setConfigData({ 
                    ...configData, 
                    efficiency_factor: parseFloat(e.target.value) || 1.0 
                  })}
                />
                <span className="text-sm text-muted-foreground">
                  {(configData.efficiency_factor * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                1.0 = 100% efficiency, 0.8 = 80% efficiency, 1.2 = 120% efficiency
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfigDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveAssignment} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Assignment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}