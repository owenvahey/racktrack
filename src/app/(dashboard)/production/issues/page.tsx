'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProductionIssue } from '@/types/production.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertTriangle,
  Package2,
  Wrench,
  AlertCircle,
  Plus,
  Search,
  Filter,
  TrendingUp,
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

export default function ProductionIssuesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [issues, setIssues] = useState<ProductionIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  
  // Statistics
  const [stats, setStats] = useState({
    totalIssues: 0,
    openIssues: 0,
    rawMaterialIssues: 0,
    processIssues: 0,
    totalDowntime: 0,
    totalCostImpact: 0
  })

  useEffect(() => {
    fetchIssues()
  }, [])

  async function fetchIssues() {
    try {
      let query = supabase
        .from('production_issues')
        .select(`
          *,
          job_route:job_routes (
            id,
            sequence_number,
            activity:activities (
              name,
              code
            ),
            job:jobs (
              job_number,
              job_name
            )
          ),
          work_center:work_centers (
            name,
            code
          ),
          material_product:products (
            name,
            sku
          ),
          reporter:profiles!production_issues_reported_by_fkey (
            full_name
          )
        `)
        .order('reported_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error
      
      setIssues(data || [])
      calculateStats(data || [])
    } catch (error) {
      console.error('Error fetching issues:', error)
    } finally {
      setLoading(false)
    }
  }

  function calculateStats(issueData: ProductionIssue[]) {
    const stats = {
      totalIssues: issueData.length,
      openIssues: issueData.filter(i => i.status === 'open' || i.status === 'investigating').length,
      rawMaterialIssues: issueData.filter(i => i.issue_type === 'raw_material').length,
      processIssues: issueData.filter(i => i.issue_type === 'process').length,
      totalDowntime: issueData.reduce((sum, i) => sum + (i.downtime_minutes || 0), 0),
      totalCostImpact: issueData.reduce((sum, i) => sum + (i.cost_impact || 0), 0)
    }
    setStats(stats)
  }

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = searchTerm === '' || 
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.job_route?.job?.job_number?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = filterType === 'all' || issue.issue_type === filterType
    const matchesStatus = filterStatus === 'all' || issue.status === filterStatus
    const matchesSeverity = filterSeverity === 'all' || issue.severity === filterSeverity
    
    return matchesSearch && matchesType && matchesStatus && matchesSeverity
  })

  const typeIcons = {
    raw_material: Package2,
    process: Wrench,
    equipment: AlertCircle,
    other: AlertTriangle
  }

  const typeColors = {
    raw_material: 'bg-blue-100 text-blue-800',
    process: 'bg-purple-100 text-purple-800',
    equipment: 'bg-orange-100 text-orange-800',
    other: 'bg-gray-100 text-gray-800'
  }

  const severityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  }

  const statusColors = {
    open: 'bg-red-100 text-red-800',
    investigating: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800'
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
          <h1 className="text-3xl font-bold">Production Issues</h1>
          <p className="text-muted-foreground mt-2">
            Track and resolve production floor issues
          </p>
        </div>
        <Button onClick={() => router.push('/production/issues/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Report Issue
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Issues</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalIssues}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Issues</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{stats.openIssues}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Material Issues</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{stats.rawMaterialIssues}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Process Issues</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">{stats.processIssues}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Downtime</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Math.round(stats.totalDowntime / 60)}h</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cost Impact</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${stats.totalCostImpact.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search issues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Issue Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="raw_material">Raw Material</SelectItem>
                <SelectItem value="process">Process</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Issues List */}
      <div className="space-y-4">
        {filteredIssues.map((issue) => {
          const Icon = typeIcons[issue.issue_type]
          
          return (
            <Card 
              key={issue.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/production/issues/${issue.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className={`p-3 rounded-lg ${typeColors[issue.issue_type]} bg-opacity-20`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{issue.title}</h3>
                        {issue.severity && (
                          <Badge className={severityColors[issue.severity]}>
                            {issue.severity}
                          </Badge>
                        )}
                        <Badge className={statusColors[issue.status]}>
                          {issue.status}
                        </Badge>
                      </div>
                      
                      {issue.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {issue.description}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {issue.job_route?.job && (
                          <div className="flex items-center gap-1">
                            <span>Job:</span>
                            <span className="font-medium">
                              {issue.job_route.job.job_number}
                            </span>
                          </div>
                        )}
                        
                        {issue.work_center && (
                          <div className="flex items-center gap-1">
                            <span>Work Center:</span>
                            <span className="font-medium">
                              {issue.work_center.name}
                            </span>
                          </div>
                        )}
                        
                        {issue.material_product && (
                          <div className="flex items-center gap-1">
                            <span>Material:</span>
                            <span className="font-medium">
                              {issue.material_product.name}
                            </span>
                          </div>
                        )}
                        
                        {issue.lot_number && (
                          <div className="flex items-center gap-1">
                            <span>Lot:</span>
                            <span className="font-medium">
                              {issue.lot_number}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Reported by {issue.reporter?.full_name || 'Unknown'} • {' '}
                          {format(new Date(issue.reported_at), 'MMM d, yyyy h:mm a')}
                        </span>
                        
                        {issue.downtime_minutes && issue.downtime_minutes > 0 && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{issue.downtime_minutes} min downtime</span>
                          </div>
                        )}
                        
                        {issue.cost_impact && issue.cost_impact > 0 && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            <span>${issue.cost_impact}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        
        {filteredIssues.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No issues found matching your filters</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}