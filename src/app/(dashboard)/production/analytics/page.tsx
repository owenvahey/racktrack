'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer
} from 'recharts'
import { 
  Factory,
  TrendingUp,
  Clock,
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle,
  Activity,
  Loader2
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subDays } from 'date-fns'

interface WorkCenterStats {
  id: string
  name: string
  type: string
  utilization: number
  activeJobs: number
  completedToday: number
  totalHours: number
  efficiency: number
  revenue: number
}

interface DailyProduction {
  date: string
  completed: number
  target: number
  efficiency: number
}

interface ActivityStats {
  name: string
  count: number
  avgDuration: number
  totalDuration: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function ProductionAnalyticsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('week')
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string>('all')
  
  // Data states
  const [workCenters, setWorkCenters] = useState<WorkCenterStats[]>([])
  const [dailyProduction, setDailyProduction] = useState<DailyProduction[]>([])
  const [activityStats, setActivityStats] = useState<ActivityStats[]>([])
  const [overallStats, setOverallStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    avgEfficiency: 0,
    totalRevenue: 0,
    totalDowntime: 0,
    onTimeDelivery: 0
  })

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange, selectedWorkCenter])

  async function fetchAnalytics() {
    setLoading(true)
    try {
      // Calculate date range
      const endDate = new Date()
      let startDate: Date
      
      switch (dateRange) {
        case 'today':
          startDate = new Date()
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate = startOfWeek(new Date())
          break
        case 'month':
          startDate = new Date()
          startDate.setDate(1)
          break
        default:
          startDate = subDays(new Date(), 7)
      }

      // Fetch work center stats
      const { data: wcData } = await supabase
        .from('work_centers')
        .select(`
          *,
          job_routes!inner(
            id,
            status,
            quantity_target,
            quantity_completed,
            actual_start,
            actual_complete,
            job:jobs(
              job_value
            )
          )
        `)
        .eq('is_active', true)
        .gte('job_routes.created_at', startDate.toISOString())
        .lte('job_routes.created_at', endDate.toISOString())

      // Process work center statistics
      const wcStats: WorkCenterStats[] = []
      const wcMap = new Map<string, any>()

      wcData?.forEach(wc => {
        if (!wcMap.has(wc.id)) {
          wcMap.set(wc.id, {
            id: wc.id,
            name: wc.name,
            type: wc.type,
            capacity_per_hour: wc.capacity_per_hour || 0,
            cost_per_hour: wc.cost_per_hour || 0,
            routes: []
          })
        }
        const wcEntry = wcMap.get(wc.id)
        wcEntry.routes.push(...wc.job_routes)
      })

      // Calculate statistics for each work center
      for (const [wcId, wc] of wcMap) {
        const completedRoutes = wc.routes.filter((r: any) => r.status === 'completed')
        const activeRoutes = wc.routes.filter((r: any) => 
          ['in_progress', 'setup', 'ready'].includes(r.status)
        )

        // Calculate total hours worked
        let totalHours = 0
        completedRoutes.forEach((r: any) => {
          if (r.actual_start && r.actual_complete) {
            const hours = (new Date(r.actual_complete).getTime() - 
                          new Date(r.actual_start).getTime()) / (1000 * 60 * 60)
            totalHours += hours
          }
        })

        // Calculate utilization
        const hoursInPeriod = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
        const utilization = wc.capacity_per_hour > 0 
          ? (totalHours / hoursInPeriod) * 100 
          : 0

        // Calculate efficiency
        const totalCompleted = completedRoutes.reduce((sum: number, r: any) => 
          sum + (r.quantity_completed || 0), 0
        )
        const totalTarget = completedRoutes.reduce((sum: number, r: any) => 
          sum + (r.quantity_target || 0), 0
        )
        const efficiency = totalTarget > 0 ? (totalCompleted / totalTarget) * 100 : 0

        // Calculate revenue (simplified - would need more complex calculation in real app)
        const revenue = completedRoutes.reduce((sum: number, r: any) => {
          const jobValue = r.job?.job_value || 0
          const completionRatio = r.quantity_target > 0 
            ? r.quantity_completed / r.quantity_target 
            : 0
          return sum + (jobValue * completionRatio)
        }, 0)

        wcStats.push({
          id: wcId,
          name: wc.name,
          type: wc.type,
          utilization: Math.round(utilization),
          activeJobs: activeRoutes.length,
          completedToday: completedRoutes.filter((r: any) => {
            const completeDate = new Date(r.actual_complete)
            const today = new Date()
            return completeDate.toDateString() === today.toDateString()
          }).length,
          totalHours: Math.round(totalHours * 10) / 10,
          efficiency: Math.round(efficiency),
          revenue: Math.round(revenue)
        })
      }

      setWorkCenters(wcStats)

      // Fetch daily production data
      const days = eachDayOfInterval({ start: startDate, end: endDate })
      const dailyData: DailyProduction[] = []

      for (const day of days) {
        const dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)

        const { data: dayRoutes } = await supabase
          .from('job_routes')
          .select('quantity_completed, quantity_target')
          .eq('status', 'completed')
          .gte('actual_complete', dayStart.toISOString())
          .lte('actual_complete', dayEnd.toISOString())

        const completed = dayRoutes?.reduce((sum, r) => sum + (r.quantity_completed || 0), 0) || 0
        const target = dayRoutes?.reduce((sum, r) => sum + (r.quantity_target || 0), 0) || 0

        dailyData.push({
          date: format(day, 'MMM d'),
          completed,
          target,
          efficiency: target > 0 ? Math.round((completed / target) * 100) : 0
        })
      }

      setDailyProduction(dailyData)

      // Fetch activity statistics
      const { data: activityData } = await supabase
        .from('job_routes')
        .select(`
          activity:activities!inner(name),
          actual_start,
          actual_complete
        `)
        .eq('status', 'completed')
        .gte('actual_complete', startDate.toISOString())
        .lte('actual_complete', endDate.toISOString())

      // Process activity stats
      const activityMap = new Map<string, { count: number, totalDuration: number }>()
      
      activityData?.forEach(route => {
        if (route.actual_start && route.actual_complete) {
          const duration = (new Date(route.actual_complete).getTime() - 
                           new Date(route.actual_start).getTime()) / (1000 * 60) // minutes
          const activity = Array.isArray(route.activity) ? route.activity[0] : route.activity
          const activityName = activity?.name || 'Unknown'
          
          if (!activityMap.has(activityName)) {
            activityMap.set(activityName, { count: 0, totalDuration: 0 })
          }
          
          const stats = activityMap.get(activityName)!
          stats.count += 1
          stats.totalDuration += duration
        }
      })

      const actStats: ActivityStats[] = []
      for (const [name, stats] of activityMap) {
        actStats.push({
          name,
          count: stats.count,
          avgDuration: Math.round(stats.totalDuration / stats.count),
          totalDuration: Math.round(stats.totalDuration)
        })
      }

      setActivityStats(actStats.sort((a, b) => b.count - a.count).slice(0, 10))

      // Calculate overall statistics
      const totalCompleted = wcStats.reduce((sum, wc) => sum + wc.completedToday, 0)
      const avgEfficiency = wcStats.length > 0
        ? wcStats.reduce((sum, wc) => sum + wc.efficiency, 0) / wcStats.length
        : 0
      const totalRevenue = wcStats.reduce((sum, wc) => sum + wc.revenue, 0)

      setOverallStats({
        totalJobs: dailyData.reduce((sum, d) => sum + d.completed, 0),
        completedJobs: totalCompleted,
        avgEfficiency: Math.round(avgEfficiency),
        totalRevenue,
        totalDowntime: 0, // Would need downtime tracking
        onTimeDelivery: 95 // Would need deadline tracking
      })

    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const typeColors = {
    printing: '#3b82f6',
    embroidery: '#8b5cf6',
    heat_press: '#f59e0b',
    cutting: '#ef4444',
    sewing: '#ec4899',
    packaging: '#10b981',
    quality_control: '#eab308',
    shipping: '#6366f1',
    other: '#6b7280'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Production Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Monitor work center performance and production metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Total Jobs</CardDescription>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overallStats.totalJobs}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Completed Today</CardDescription>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overallStats.completedJobs}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Avg Efficiency</CardDescription>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overallStats.avgEfficiency}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Revenue</CardDescription>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${overallStats.totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Downtime</CardDescription>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overallStats.totalDowntime}h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>On-Time</CardDescription>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overallStats.onTimeDelivery}%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="utilization" className="space-y-4">
        <TabsList>
          <TabsTrigger value="utilization">Work Center Utilization</TabsTrigger>
          <TabsTrigger value="production">Production Trends</TabsTrigger>
          <TabsTrigger value="activities">Activity Analysis</TabsTrigger>
          <TabsTrigger value="performance">Performance Details</TabsTrigger>
        </TabsList>

        <TabsContent value="utilization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Work Center Utilization</CardTitle>
              <CardDescription>
                Current utilization rates across all work centers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workCenters.map(wc => (
                  <div key={wc.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: typeColors[wc.type as keyof typeof typeColors] || typeColors.other }}
                        />
                        <span className="font-medium">{wc.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({wc.activeJobs} active)
                        </span>
                      </div>
                      <span className="font-medium">{wc.utilization}%</span>
                    </div>
                    <Progress value={wc.utilization} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Utilization by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={workCenters}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, utilization }) => `${name}: ${utilization}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="utilization"
                    >
                      {workCenters.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={typeColors[entry.type as keyof typeof typeColors] || typeColors.other} 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Efficiency by Work Center</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={workCenters}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="efficiency" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Production</CardTitle>
              <CardDescription>
                Production output and efficiency over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dailyProduction}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="completed" 
                    stroke="#3b82f6" 
                    name="Completed"
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="target" 
                    stroke="#10b981" 
                    name="Target"
                    strokeDasharray="5 5"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="efficiency" 
                    stroke="#f59e0b" 
                    name="Efficiency %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Activities</CardTitle>
              <CardDescription>
                Most performed activities and their average duration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Avg Duration</TableHead>
                    <TableHead className="text-right">Total Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityStats.map((activity, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{activity.name}</TableCell>
                      <TableCell className="text-right">{activity.count}</TableCell>
                      <TableCell className="text-right">{activity.avgDuration} min</TableCell>
                      <TableCell className="text-right">
                        {Math.round(activity.totalDuration / 60)} hours
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Work Center Performance Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Work Center</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Active Jobs</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Efficiency</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workCenters.map(wc => (
                    <TableRow key={wc.id}>
                      <TableCell className="font-medium">{wc.name}</TableCell>
                      <TableCell>{wc.type.replace('_', ' ')}</TableCell>
                      <TableCell className="text-right">{wc.activeJobs}</TableCell>
                      <TableCell className="text-right">{wc.completedToday}</TableCell>
                      <TableCell className="text-right">{wc.totalHours}h</TableCell>
                      <TableCell className="text-right">{wc.efficiency}%</TableCell>
                      <TableCell className="text-right">${wc.revenue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}