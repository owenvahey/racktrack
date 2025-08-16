'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Activity, WorkCenterActivity, WorkCenter } from '@/types/production.types'
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
  Activity as ActivityIcon,
  Clock,
  Factory,
  AlertCircle,
  Loader2,
  Users,
  GitBranch
} from 'lucide-react'
import { format } from 'date-fns'

interface ActivityWithWorkCenters extends Activity {
  work_centers: (WorkCenterActivity & { work_center: WorkCenter })[]
}

interface ActivityDependency {
  id: string
  depends_on: Activity
  dependency_type: string
  offset_minutes: number
}

interface DependentActivity {
  id: string
  activity: Activity
  dependency_type: string
  offset_minutes: number
}

export default function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const resolvedParams = use(params)
  
  const [activity, setActivity] = useState<ActivityWithWorkCenters | null>(null)
  const [dependencies, setDependencies] = useState<ActivityDependency[]>([])
  const [dependents, setDependents] = useState<DependentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeJobs, setActiveJobs] = useState(0)

  useEffect(() => {
    fetchActivity()
    fetchDependencies()
    fetchActiveJobs()
  }, [resolvedParams.id])

  async function fetchActivity() {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          work_centers:work_center_activities(
            *,
            work_center:work_centers(*)
          )
        `)
        .eq('id', resolvedParams.id)
        .single()

      if (error) throw error
      
      setActivity(data)
    } catch (error) {
      console.error('Error fetching activity:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchDependencies() {
    try {
      // Fetch activities this depends on
      const { data: deps } = await supabase
        .from('activity_dependencies')
        .select(`
          id,
          dependency_type,
          offset_minutes,
          depends_on:activities!activity_dependencies_depends_on_activity_id_fkey(*)
        `)
        .eq('activity_id', resolvedParams.id)

      const formattedDeps: ActivityDependency[] = deps?.map(d => ({
        id: d.id,
        depends_on: Array.isArray(d.depends_on) ? d.depends_on[0] : d.depends_on,
        dependency_type: d.dependency_type,
        offset_minutes: d.offset_minutes
      })) || []

      setDependencies(formattedDeps)

      // Fetch activities that depend on this
      const { data: dependents } = await supabase
        .from('activity_dependencies')
        .select(`
          id,
          dependency_type,
          offset_minutes,
          activity:activities!activity_dependencies_activity_id_fkey(*)
        `)
        .eq('depends_on_activity_id', resolvedParams.id)

      const formattedDependents: DependentActivity[] = dependents?.map(d => ({
        id: d.id,
        activity: Array.isArray(d.activity) ? d.activity[0] : d.activity,
        dependency_type: d.dependency_type,
        offset_minutes: d.offset_minutes
      })) || []

      setDependents(formattedDependents)
    } catch (error) {
      console.error('Error fetching dependencies:', error)
    }
  }

  async function fetchActiveJobs() {
    try {
      const { count } = await supabase
        .from('job_routes')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', resolvedParams.id)
        .in('status', ['pending', 'ready', 'setup', 'in_progress', 'paused'])

      setActiveJobs(count || 0)
    } catch (error) {
      console.error('Error fetching active jobs:', error)
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

  const activityTypeColors = {
    setup: 'bg-orange-100 text-orange-800',
    production: 'bg-blue-100 text-blue-800',
    quality_check: 'bg-yellow-100 text-yellow-800',
    packaging: 'bg-green-100 text-green-800',
    cleanup: 'bg-gray-100 text-gray-800',
    maintenance: 'bg-red-100 text-red-800'
  }

  const dependencyTypeLabels = {
    finish_to_start: 'Finish to Start',
    start_to_start: 'Start to Start',
    finish_to_finish: 'Finish to Finish',
    start_to_finish: 'Start to Finish'
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
            <h1 className="text-3xl font-bold">{activity.name}</h1>
            <p className="text-muted-foreground mt-1">
              {activity.code} • {activity.activity_type.replace('_', ' ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={activity.is_active ? 'default' : 'secondary'}>
            {activity.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Button onClick={() => router.push(`/admin/activities/${activity.id}/edit`)}>
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
              <CardTitle className="text-sm font-medium">Work Centers</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activity.work_centers.length}</div>
            <p className="text-xs text-muted-foreground">Can perform this activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeJobs}</div>
            <p className="text-xs text-muted-foreground">Currently using this activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Skill Level</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activity.requires_skill_level}/5</div>
            <p className="text-xs text-muted-foreground">Required expertise</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Dependencies</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dependencies.length + dependents.length}</div>
            <p className="text-xs text-muted-foreground">Related activities</p>
          </CardContent>
        </Card>
      </div>

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Type</dt>
              <dd className="mt-1">
                <Badge className={activityTypeColors[activity.activity_type]}>
                  {activity.activity_type.replace('_', ' ')}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Required Skill Level</dt>
              <dd className="mt-1">
                Level {activity.requires_skill_level} / 5
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Status</dt>
              <dd className="mt-1">
                {activity.is_active ? 'Active' : 'Inactive'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1">
                {format(new Date(activity.created_at), 'MMM d, yyyy')}
              </dd>
            </div>
          </dl>
          {activity.description && (
            <div className="mt-4 pt-4 border-t">
              <dt className="text-sm font-medium text-muted-foreground">Description</dt>
              <dd className="mt-1">{activity.description}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="work-centers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="work-centers">
            Work Centers ({activity.work_centers.length})
          </TabsTrigger>
          <TabsTrigger value="dependencies">
            Dependencies ({dependencies.length})
          </TabsTrigger>
          <TabsTrigger value="dependents">
            Dependent Activities ({dependents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="work-centers">
          {activity.work_centers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Factory className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No work centers assigned to this activity</p>
                <Button 
                  className="mt-4"
                  onClick={() => router.push('/admin/work-centers/activities')}
                >
                  Assign Work Centers
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Work Center</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Setup Time</TableHead>
                    <TableHead>Run Time/Unit</TableHead>
                    <TableHead>Min Batch</TableHead>
                    <TableHead>Max Batch</TableHead>
                    <TableHead>Efficiency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.work_centers.map((wca) => (
                    <TableRow key={wca.id}>
                      <TableCell className="font-medium">
                        {wca.work_center.name}
                      </TableCell>
                      <TableCell>{wca.work_center.code}</TableCell>
                      <TableCell>{wca.work_center.type.replace('_', ' ')}</TableCell>
                      <TableCell>{wca.setup_time_minutes} min</TableCell>
                      <TableCell>
                        {wca.run_time_per_unit ? `${wca.run_time_per_unit} min` : '-'}
                      </TableCell>
                      <TableCell>{wca.min_batch_size}</TableCell>
                      <TableCell>{wca.max_batch_size || '-'}</TableCell>
                      <TableCell>{(wca.efficiency_factor * 100).toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="dependencies">
          {dependencies.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <GitBranch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">This activity has no dependencies</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">This activity depends on:</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Dependency Type</TableHead>
                    <TableHead>Offset</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dependencies.map((dep) => (
                    <TableRow key={dep.id}>
                      <TableCell className="font-medium">
                        {dep.depends_on.name}
                      </TableCell>
                      <TableCell>{dep.depends_on.code}</TableCell>
                      <TableCell>
                        {dependencyTypeLabels[dep.dependency_type as keyof typeof dependencyTypeLabels]}
                      </TableCell>
                      <TableCell>
                        {dep.offset_minutes > 0 ? `+${dep.offset_minutes}` : dep.offset_minutes} min
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="dependents">
          {dependents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <GitBranch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No activities depend on this one</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activities that depend on this:</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Dependency Type</TableHead>
                    <TableHead>Offset</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dependents.map((dep) => (
                    <TableRow key={dep.id}>
                      <TableCell className="font-medium">
                        {dep.activity.name}
                      </TableCell>
                      <TableCell>{dep.activity.code}</TableCell>
                      <TableCell>
                        {dependencyTypeLabels[dep.dependency_type as keyof typeof dependencyTypeLabels]}
                      </TableCell>
                      <TableCell>
                        {dep.offset_minutes > 0 ? `+${dep.offset_minutes}` : dep.offset_minutes} min
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