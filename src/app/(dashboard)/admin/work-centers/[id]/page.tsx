'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WorkCenter, WorkCenterActivity, Activity } from '@/types/production.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  ArrowLeft,
  Edit,
  Factory,
  Clock,
  DollarSign,
  Activity as ActivityIcon,
  TrendingUp,
  Package,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'

interface WorkCenterWithActivities extends WorkCenter {
  activities: (WorkCenterActivity & { activity: Activity })[]
}

interface JobRoute {
  id: string
  status: string
  job: {
    job_number: string
    job_name: string
  }
  activity: {
    name: string
  }
  quantity_target: number
  quantity_completed: number
  estimated_start?: string
  estimated_complete?: string
}

export default function WorkCenterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const resolvedParams = use(params)
  
  const [workCenter, setWorkCenter] = useState<WorkCenterWithActivities | null>(null)
  const [activeJobs, setActiveJobs] = useState<JobRoute[]>([])
  const [completedJobs, setCompletedJobs] = useState<JobRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalActivities: 0,
    activeJobs: 0,
    completedToday: 0,
    utilizationRate: 0
  })

  useEffect(() => {
    fetchWorkCenter()
    fetchJobs()
  }, [resolvedParams.id])

  async function fetchWorkCenter() {
    try {
      const { data, error } = await supabase
        .from('work_centers')
        .select(`
          *,
          activities:work_center_activities(
            *,
            activity:activities(*)
          )
        `)
        .eq('id', resolvedParams.id)
        .single()

      if (error) throw error
      
      setWorkCenter(data)
      setStats(prev => ({ ...prev, totalActivities: data.activities?.length || 0 }))
    } catch (error) {
      console.error('Error fetching work center:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchJobs() {
    try {
      // Fetch active jobs
      const { data: activeData } = await supabase
        .from('job_routes')
        .select(`
          id,
          status,
          quantity_target,
          quantity_completed,
          estimated_start,
          estimated_complete,
          job:jobs(job_number, job_name),
          activity:activities(name)
        `)
        .eq('work_center_id', resolvedParams.id)
        .in('status', ['pending', 'ready', 'setup', 'in_progress', 'paused'])
        .order('estimated_start', { ascending: true })

      // Fetch completed jobs from today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { data: completedData } = await supabase
        .from('job_routes')
        .select(`
          id,
          status,
          quantity_target,
          quantity_completed,
          estimated_start,
          estimated_complete,
          job:jobs(job_number, job_name),
          activity:activities(name)
        `)
        .eq('work_center_id', resolvedParams.id)
        .eq('status', 'completed')
        .gte('actual_complete', today.toISOString())
        .order('actual_complete', { ascending: false })

      const formattedActive = activeData?.map(job => ({
        ...job,
        job: Array.isArray(job.job) ? job.job[0] : job.job,
        activity: Array.isArray(job.activity) ? job.activity[0] : job.activity
      })) || []
      
      const formattedCompleted = completedData?.map(job => ({
        ...job,
        job: Array.isArray(job.job) ? job.job[0] : job.job,
        activity: Array.isArray(job.activity) ? job.activity[0] : job.activity
      })) || []
      
      setActiveJobs(formattedActive)
      setCompletedJobs(formattedCompleted)
      
      setStats(prev => ({
        ...prev,
        activeJobs: activeData?.length || 0,
        completedToday: completedData?.length || 0
      }))

      // Calculate utilization
      if (workCenter?.capacity_per_hour) {
        const totalCompleted = completedData?.reduce((sum, job) => 
          sum + (job.quantity_completed || 0), 0) || 0
        const hoursToday = new Date().getHours()
        const expectedCapacity = workCenter.capacity_per_hour * hoursToday
        const utilization = expectedCapacity > 0 
          ? Math.round((totalCompleted / expectedCapacity) * 100)
          : 0
        setStats(prev => ({ ...prev, utilizationRate: utilization }))
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
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

  const typeColors = {
    printing: 'bg-blue-100 text-blue-800',
    embroidery: 'bg-purple-100 text-purple-800',
    heat_press: 'bg-orange-100 text-orange-800',
    cutting: 'bg-red-100 text-red-800',
    sewing: 'bg-pink-100 text-pink-800',
    packaging: 'bg-green-100 text-green-800',
    quality_control: 'bg-yellow-100 text-yellow-800',
    shipping: 'bg-indigo-100 text-indigo-800',
    other: 'bg-gray-100 text-gray-800'
  }

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    ready: 'bg-blue-100 text-blue-800',
    setup: 'bg-orange-100 text-orange-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    paused: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/work-centers')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{workCenter.name}</h1>
            <p className="text-muted-foreground mt-1">
              {workCenter.code} • {workCenter.type.replace('_', ' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={workCenter.is_active ? 'default' : 'secondary'}>
            {workCenter.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Button onClick={() => router.push(`/admin/work-centers/${workCenter.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Activities</CardTitle>
              <ActivityIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActivities}</div>
            <p className="text-xs text-muted-foreground">Assigned activities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeJobs}</div>
            <p className="text-xs text-muted-foreground">In queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedToday}</div>
            <p className="text-xs text-muted-foreground">Jobs finished</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Utilization</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.utilizationRate}%</div>
            <p className="text-xs text-muted-foreground">Of capacity</p>
          </CardContent>
        </Card>
      </div>

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Work Center Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Type</dt>
              <dd className="mt-1">
                <Badge className={typeColors[workCenter.type] || typeColors.other}>
                  {workCenter.type.replace('_', ' ')}
                </Badge>
              </dd>
            </div>
            {workCenter.capacity_per_hour && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Capacity</dt>
                <dd className="mt-1 flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {workCenter.capacity_per_hour} units/hour
                </dd>
              </div>
            )}
            {workCenter.cost_per_hour && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Cost</dt>
                <dd className="mt-1 flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  ${workCenter.cost_per_hour}/hour
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1">
                {format(new Date(workCenter.created_at), 'MMM d, yyyy')}
              </dd>
            </div>
          </dl>
          {workCenter.description && (
            <div className="mt-4 pt-4 border-t">
              <dt className="text-sm font-medium text-muted-foreground">Description</dt>
              <dd className="mt-1">{workCenter.description}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="activities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activities">
            Activities ({workCenter.activities.length})
          </TabsTrigger>
          <TabsTrigger value="active-jobs">
            Active Jobs ({activeJobs.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed Today ({completedJobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          {workCenter.activities.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <ActivityIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No activities assigned to this work center</p>
                <Button 
                  className="mt-4"
                  onClick={() => router.push('/admin/work-centers/activities')}
                >
                  Assign Activities
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Setup Time</TableHead>
                    <TableHead>Run Time/Unit</TableHead>
                    <TableHead>Efficiency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workCenter.activities.map((wca) => (
                    <TableRow key={wca.id}>
                      <TableCell className="font-medium">
                        {wca.activity.name}
                      </TableCell>
                      <TableCell>{wca.activity.code}</TableCell>
                      <TableCell>{wca.activity.activity_type}</TableCell>
                      <TableCell>{wca.setup_time_minutes} min</TableCell>
                      <TableCell>
                        {wca.run_time_per_unit ? `${wca.run_time_per_unit} min` : '-'}
                      </TableCell>
                      <TableCell>{(wca.efficiency_factor * 100).toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="active-jobs">
          {activeJobs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active jobs at this work center</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Scheduled Start</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{job.job.job_number}</p>
                          <p className="text-sm text-muted-foreground">{job.job.job_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{job.activity.name}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[job.status as keyof typeof statusColors]}>
                          {job.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {job.quantity_completed} / {job.quantity_target}
                      </TableCell>
                      <TableCell>
                        {job.estimated_start 
                          ? format(new Date(job.estimated_start), 'MMM d, h:mm a')
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedJobs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No jobs completed today</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Completed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{job.job.job_number}</p>
                          <p className="text-sm text-muted-foreground">{job.job.job_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{job.activity.name}</TableCell>
                      <TableCell>{job.quantity_completed} units</TableCell>
                      <TableCell>
                        {job.estimated_complete 
                          ? format(new Date(job.estimated_complete), 'h:mm a')
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}