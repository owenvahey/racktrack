'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WorkCenter, JobRoute } from '@/types/production.types'
import { Job } from '@/types/job.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Factory,
  Clock,
  User,
  Package,
  PlayCircle,
  PauseCircle,
  CheckCircle,
  AlertCircle,
  ScanLine,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface JobRouteWithDetails extends Omit<JobRoute, 'activity' | 'work_center'> {
  job: Job & {
    customer?: { name: string }
    job_line_items?: Array<{
      po_line_item?: {
        item_name: string
        quantity: number
      }
    }>
  }
  activity: { name: string; code: string }
  work_center: WorkCenter
}

export default function ProductionPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([])
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<WorkCenter | null>(null)
  const [jobRoutes, setJobRoutes] = useState<JobRouteWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchWorkCenters()
  }, [])

  useEffect(() => {
    if (selectedWorkCenter) {
      fetchJobRoutes(selectedWorkCenter.id)
    }
  }, [selectedWorkCenter])

  async function fetchWorkCenters() {
    try {
      const { data, error } = await supabase
        .from('work_centers')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      
      setWorkCenters(data || [])
      if (data && data.length > 0) {
        setSelectedWorkCenter(data[0])
      }
    } catch (error) {
      console.error('Error fetching work centers:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchJobRoutes(workCenterId: string) {
    setRefreshing(true)
    try {
      const { data, error } = await supabase
        .from('job_routes')
        .select(`
          *,
          job:jobs!inner (
            *,
            customer:qb_customers (
              name
            ),
            job_line_items (
              po_line_item:po_line_items (
                item_name,
                quantity
              )
            )
          ),
          activity:activities (
            name,
            code
          ),
          work_center:work_centers (
            *
          )
        `)
        .eq('work_center_id', workCenterId)
        .in('status', ['pending', 'ready', 'setup', 'in_progress', 'paused'])
        .order('sequence_number')

      if (error) throw error
      
      setJobRoutes(data || [])
    } catch (error) {
      console.error('Error fetching job routes:', error)
    } finally {
      setRefreshing(false)
    }
  }

  async function updateRouteStatus(routeId: string, newStatus: string, notes?: string) {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      // Add timestamps based on status
      if (newStatus === 'setup' || newStatus === 'in_progress') {
        updateData.actual_start = new Date().toISOString()
      } else if (newStatus === 'completed') {
        updateData.actual_complete = new Date().toISOString()
      }

      if (notes) {
        updateData.production_notes = notes
      }

      const { error } = await supabase
        .from('job_routes')
        .update(updateData)
        .eq('id', routeId)

      if (error) throw error
      
      // Refresh the routes
      if (selectedWorkCenter) {
        fetchJobRoutes(selectedWorkCenter.id)
      }
    } catch (error) {
      console.error('Error updating route status:', error)
    }
  }

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    ready: 'bg-blue-100 text-blue-800',
    setup: 'bg-orange-100 text-orange-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    paused: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    skipped: 'bg-red-100 text-red-800'
  }

  const typeColors = {
    printing: 'bg-blue-500',
    embroidery: 'bg-purple-500',
    heat_press: 'bg-orange-500',
    cutting: 'bg-red-500',
    sewing: 'bg-pink-500',
    packaging: 'bg-green-500',
    quality_control: 'bg-yellow-500',
    shipping: 'bg-indigo-500',
    other: 'bg-gray-500'
  }

  function JobRouteCard({ route }: { route: JobRouteWithDetails }) {
    const canStart = route.status === 'ready' || route.status === 'pending'
    const canPause = route.status === 'in_progress'
    const canComplete = route.status === 'in_progress' || route.status === 'paused'

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{route.job.job_number}</CardTitle>
              <CardDescription>
                {route.job.customer?.name || 'No customer'}
              </CardDescription>
            </div>
            <Badge className={statusColors[route.status]}>
              {route.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Activity Info */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">{route.activity.name}</p>
              <p className="text-sm text-muted-foreground">
                Step {route.sequence_number} • {route.activity.code}
              </p>
            </div>

            {/* Product Info */}
            {route.job.job_line_items?.[0]?.po_line_item && (
              <div className="text-sm">
                <p className="font-medium">
                  {route.job.job_line_items[0].po_line_item.item_name}
                </p>
                <p className="text-muted-foreground">
                  Quantity: {route.quantity_target} units
                </p>
              </div>
            )}

            {/* Progress */}
            {route.quantity_completed > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>{route.quantity_completed} / {route.quantity_target}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ 
                      width: `${(route.quantity_completed / route.quantity_target) * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Time Info */}
            {route.actual_start && (
              <div className="text-sm text-muted-foreground">
                Started: {format(new Date(route.actual_start), 'h:mm a')}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {canStart && (
                <Button 
                  size="sm" 
                  onClick={() => updateRouteStatus(route.id, 'in_progress')}
                  className="flex-1"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Start
                </Button>
              )}
              
              {canPause && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => updateRouteStatus(route.id, 'paused')}
                  className="flex-1"
                >
                  <PauseCircle className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              )}
              
              {canComplete && (
                <Button 
                  size="sm"
                  onClick={() => router.push(`/production/complete/${route.id}`)}
                  className="flex-1"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Complete
                </Button>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => router.push(`/production/scan/${route.id}`)}
              >
                <ScanLine className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Production Floor</h1>
          <p className="text-muted-foreground mt-2">
            Track and manage production activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/production/issues')}>
            <AlertTriangle className="mr-2 h-4 w-4" />
            View Issues
          </Button>
        </div>
      </div>

      {/* Work Center Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {workCenters.map(wc => (
          <Button
            key={wc.id}
            variant={selectedWorkCenter?.id === wc.id ? 'default' : 'outline'}
            onClick={() => setSelectedWorkCenter(wc)}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <div className={`w-3 h-3 rounded-full ${typeColors[wc.type]}`} />
            {wc.name}
          </Button>
        ))}
      </div>

      {selectedWorkCenter && (
        <div className="space-y-6">
          {/* Work Center Info */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{selectedWorkCenter.name}</CardTitle>
                  <CardDescription>
                    {selectedWorkCenter.description || selectedWorkCenter.code}
                  </CardDescription>
                </div>
                <Badge className={typeColors[selectedWorkCenter.type] + ' text-white'}>
                  {selectedWorkCenter.type.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Active Jobs</p>
                  <p className="text-2xl font-bold">
                    {jobRoutes.filter(r => r.status === 'in_progress').length}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">
                    {jobRoutes.filter(r => ['pending', 'ready'].includes(r.status)).length}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">On Hold</p>
                  <p className="text-2xl font-bold">
                    {jobRoutes.filter(r => r.status === 'paused').length}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">In Setup</p>
                  <p className="text-2xl font-bold">
                    {jobRoutes.filter(r => r.status === 'setup').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Job Routes */}
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">
                In Progress ({jobRoutes.filter(r => ['in_progress', 'setup'].includes(r.status)).length})
              </TabsTrigger>
              <TabsTrigger value="ready">
                Ready ({jobRoutes.filter(r => ['pending', 'ready'].includes(r.status)).length})
              </TabsTrigger>
              <TabsTrigger value="paused">
                Paused ({jobRoutes.filter(r => r.status === 'paused').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {refreshing ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {jobRoutes
                    .filter(r => ['in_progress', 'setup'].includes(r.status))
                    .map(route => (
                      <JobRouteCard key={route.id} route={route} />
                    ))}
                </div>
              )}
              {jobRoutes.filter(r => ['in_progress', 'setup'].includes(r.status)).length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No active jobs at this work center</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ready" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobRoutes
                  .filter(r => ['pending', 'ready'].includes(r.status))
                  .map(route => (
                    <JobRouteCard key={route.id} route={route} />
                  ))}
              </div>
              {jobRoutes.filter(r => ['pending', 'ready'].includes(r.status)).length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">No jobs ready to start</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="paused" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobRoutes
                  .filter(r => r.status === 'paused')
                  .map(route => (
                    <JobRouteCard key={route.id} route={route} />
                  ))}
              </div>
              {jobRoutes.filter(r => r.status === 'paused').length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">No paused jobs</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}