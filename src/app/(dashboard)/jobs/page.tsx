'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { Job } from '@/types/job.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Search, 
  Filter,
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

const statusColors = {
  created: 'bg-gray-100 text-gray-800',
  planned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  review: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  cancelled: 'bg-red-100 text-red-800'
}

const priorityColors: Record<number, string> = {
  1: 'bg-red-100 text-red-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-yellow-100 text-yellow-800',
  4: 'bg-blue-100 text-blue-800',
  5: 'bg-gray-100 text-gray-800'
}

export default function JobsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    try {
      let query = supabase
        .from('jobs')
        .select(`
          *,
          purchase_orders!jobs_po_id_fkey (
            po_number,
            customer_name
          ),
          profiles!jobs_assigned_to_fkey (
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error

      // Transform the data to match our Job type
      const transformedJobs = data?.map(job => ({
        ...job,
        purchase_order: job.purchase_orders,
        assigned_user: job.profiles
      })) || []

      setJobs(transformedJobs as Job[])
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.job_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.purchase_order?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const jobsByStatus = {
    active: filteredJobs.filter(j => ['created', 'planned', 'in_progress', 'review'].includes(j.status)),
    completed: filteredJobs.filter(j => ['completed', 'shipped'].includes(j.status)),
    cancelled: filteredJobs.filter(j => j.status === 'cancelled')
  }

  function JobCard({ job }: { job: Job }) {
    return (
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => router.push(`/jobs/${job.id}`)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{job.job_number}</CardTitle>
              <CardDescription>{job.job_name}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={priorityColors[job.priority]}>
                P{job.priority}
              </Badge>
              <Badge className={statusColors[job.status]}>
                {job.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{job.purchase_order?.customer_name || 'No customer'}</span>
            </div>
            
            {job.assigned_user && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Assigned to {job.assigned_user.full_name}</span>
              </div>
            )}
            
            {job.estimated_completion_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Due {format(new Date(job.estimated_completion_date), 'MMM d, yyyy')}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${job.progress_percentage}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{job.progress_percentage}%</span>
              </div>
              
              {job.customer_approved && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground mt-2">
            Manage production jobs and track progress
          </p>
        </div>
        <Button onClick={() => router.push('/jobs/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Job
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          className="px-4 py-2 border rounded-md"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="created">Created</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="completed">Completed</option>
          <option value="shipped">Shipped</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Job Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{jobsByStatus.active.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {jobs.filter(j => j.status === 'in_progress').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{jobsByStatus.completed.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {jobs.filter(j => j.priority <= 2).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Job Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Active ({jobsByStatus.active.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({jobsByStatus.completed.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({jobsByStatus.cancelled.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          {jobsByStatus.active.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active jobs found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobsByStatus.active.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4">
          {jobsByStatus.completed.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No completed jobs found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobsByStatus.completed.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="cancelled" className="space-y-4">
          {jobsByStatus.cancelled.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No cancelled jobs found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobsByStatus.cancelled.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}