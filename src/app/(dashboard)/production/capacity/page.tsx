'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { 
  Factory,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Package,
  Zap,
  Calendar,
  Loader2
} from 'lucide-react'
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'

interface WorkCenterCapacity {
  id: string
  name: string
  type: string
  capacity_per_hour: number
  currentLoad: number
  plannedLoad: number
  utilization: number
  available: number
}

interface DailyCapacity {
  date: string
  totalCapacity: number
  totalLoad: number
  utilization: number
  workCenters: {
    name: string
    capacity: number
    load: number
  }[]
}

interface BottleneckAlert {
  workCenter: string
  date: string
  utilization: number
  message: string
}

export default function CapacityPlanningPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('week')
  const [workCenters, setWorkCenters] = useState<WorkCenterCapacity[]>([])
  const [dailyCapacity, setDailyCapacity] = useState<DailyCapacity[]>([])
  const [bottlenecks, setBottlenecks] = useState<BottleneckAlert[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    fetchCapacityData()
  }, [timeframe])

  async function fetchCapacityData() {
    setLoading(true)
    try {
      // Calculate date range
      const startDate = new Date()
      let endDate: Date
      
      switch (timeframe) {
        case 'week':
          endDate = endOfWeek(startDate)
          break
        case '2weeks':
          endDate = addDays(startDate, 14)
          break
        case 'month':
          endDate = addDays(startDate, 30)
          break
        default:
          endDate = addDays(startDate, 7)
      }

      // Fetch work centers with their capacity
      const { data: wcData } = await supabase
        .from('work_centers')
        .select(`
          *,
          job_routes!inner(
            id,
            estimated_start,
            estimated_complete,
            quantity_target,
            status
          )
        `)
        .eq('is_active', true)
        .gte('job_routes.estimated_start', startDate.toISOString())
        .lte('job_routes.estimated_start', endDate.toISOString())
        .not('job_routes.status', 'eq', 'completed')

      // Process work center capacity
      const wcCapacityMap = new Map<string, WorkCenterCapacity>()
      const hoursPerDay = 8 // Assuming 8-hour work day
      const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      
      // Initialize work centers
      const { data: allWCs } = await supabase
        .from('work_centers')
        .select('*')
        .eq('is_active', true)

      allWCs?.forEach(wc => {
        const totalCapacity = (wc.capacity_per_hour || 0) * hoursPerDay * daysInPeriod
        wcCapacityMap.set(wc.id, {
          id: wc.id,
          name: wc.name,
          type: wc.type,
          capacity_per_hour: wc.capacity_per_hour || 0,
          currentLoad: 0,
          plannedLoad: 0,
          utilization: 0,
          available: totalCapacity
        })
      })

      // Calculate load from job routes
      wcData?.forEach(wc => {
        const wcCapacity = wcCapacityMap.get(wc.id)
        if (!wcCapacity) return

        wc.job_routes.forEach((route: any) => {
          if (route.estimated_start && route.estimated_complete) {
            const duration = (new Date(route.estimated_complete).getTime() - 
                             new Date(route.estimated_start).getTime()) / (1000 * 60 * 60) // hours
            
            if (route.status === 'in_progress' || route.status === 'setup') {
              wcCapacity.currentLoad += duration
            } else {
              wcCapacity.plannedLoad += duration
            }
          }
        })

        const totalLoad = wcCapacity.currentLoad + wcCapacity.plannedLoad
        wcCapacity.utilization = wcCapacity.available > 0 
          ? Math.round((totalLoad / wcCapacity.available) * 100)
          : 0
        wcCapacity.available = Math.max(0, wcCapacity.available - totalLoad)
      })

      setWorkCenters(Array.from(wcCapacityMap.values()))

      // Calculate daily capacity
      const days = eachDayOfInterval({ start: startDate, end: endDate })
      const dailyData: DailyCapacity[] = []
      const bottleneckList: BottleneckAlert[] = []

      for (const day of days) {
        const dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)

        let totalDayCapacity = 0
        let totalDayLoad = 0
        const wcDayData: { name: string; capacity: number; load: number }[] = []

        for (const [wcId, wc] of wcCapacityMap) {
          const dayCapacity = wc.capacity_per_hour * hoursPerDay
          totalDayCapacity += dayCapacity

          // Get routes for this day
          const { data: dayRoutes } = await supabase
            .from('job_routes')
            .select('*')
            .eq('work_center_id', wcId)
            .gte('estimated_start', dayStart.toISOString())
            .lte('estimated_start', dayEnd.toISOString())
            .not('status', 'eq', 'completed')

          let wcLoad = 0
          dayRoutes?.forEach((route: any) => {
            if (route.estimated_start && route.estimated_complete) {
              const duration = Math.min(
                (new Date(route.estimated_complete).getTime() - 
                 new Date(route.estimated_start).getTime()) / (1000 * 60 * 60),
                hoursPerDay // Cap at daily hours
              )
              wcLoad += duration
            }
          })

          totalDayLoad += wcLoad
          wcDayData.push({
            name: wc.name,
            capacity: dayCapacity,
            load: wcLoad
          })

          // Check for bottlenecks
          const utilization = dayCapacity > 0 ? (wcLoad / dayCapacity) * 100 : 0
          if (utilization > 90) {
            bottleneckList.push({
              workCenter: wc.name,
              date: format(day, 'MMM d'),
              utilization: Math.round(utilization),
              message: utilization > 100 
                ? 'Over capacity - consider rescheduling'
                : 'Near capacity - monitor closely'
            })
          }
        }

        dailyData.push({
          date: format(day, 'MMM d'),
          totalCapacity: totalDayCapacity,
          totalLoad: totalDayLoad,
          utilization: totalDayCapacity > 0 
            ? Math.round((totalDayLoad / totalDayCapacity) * 100)
            : 0,
          workCenters: wcDayData
        })
      }

      setDailyCapacity(dailyData)
      setBottlenecks(bottleneckList)

      // Generate suggestions
      const newSuggestions: string[] = []
      
      // Check overall utilization
      const avgUtilization = dailyData.reduce((sum, d) => sum + d.utilization, 0) / dailyData.length
      if (avgUtilization < 50) {
        newSuggestions.push('Overall capacity utilization is low. Consider consolidating work centers or accepting more orders.')
      } else if (avgUtilization > 85) {
        newSuggestions.push('Capacity is nearly full. Consider adding shifts or expanding work center capacity.')
      }

      // Check for unbalanced load
      const wcUtilizations = Array.from(wcCapacityMap.values()).map(wc => wc.utilization)
      const maxUtil = Math.max(...wcUtilizations)
      const minUtil = Math.min(...wcUtilizations)
      if (maxUtil - minUtil > 50) {
        newSuggestions.push('Work center loads are unbalanced. Consider redistributing jobs to underutilized centers.')
      }

      // Check for bottlenecks
      if (bottleneckList.length > 0) {
        const uniqueWCs = new Set(bottleneckList.map(b => b.workCenter))
        newSuggestions.push(`${uniqueWCs.size} work center(s) are experiencing bottlenecks. Review scheduling for ${Array.from(uniqueWCs).join(', ')}.`)
      }

      setSuggestions(newSuggestions)

    } catch (error) {
      console.error('Error fetching capacity data:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleLoadBalancing() {
    // In a real implementation, this would run an optimization algorithm
    // to redistribute jobs for better load balancing
    toast.success('Load balancing analysis started. Results will be available shortly.')
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
          <h1 className="text-3xl font-bold">Capacity Planning</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and optimize work center capacity utilization
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Next 7 Days</SelectItem>
              <SelectItem value="2weeks">Next 14 Days</SelectItem>
              <SelectItem value="month">Next 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleLoadBalancing}>
            <Zap className="mr-2 h-4 w-4" />
            Balance Load
          </Button>
        </div>
      </div>

      {/* Alerts and Suggestions */}
      {(bottlenecks.length > 0 || suggestions.length > 0) && (
        <div className="space-y-4">
          {bottlenecks.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Capacity Alerts:</strong> {bottlenecks.length} potential bottlenecks detected
              </AlertDescription>
            </Alert>
          )}
          
          {suggestions.map((suggestion, idx) => (
            <Alert key={idx} className="border-blue-200 bg-blue-50">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                {suggestion}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Work Center Capacity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workCenters.map(wc => (
          <Card key={wc.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{wc.name}</CardTitle>
                <Badge 
                  variant={wc.utilization > 90 ? 'destructive' : wc.utilization > 70 ? 'default' : 'secondary'}
                >
                  {wc.utilization}%
                </Badge>
              </div>
              <CardDescription>{wc.type.replace('_', ' ')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={wc.utilization} className="h-2" />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Current</p>
                  <p className="font-medium">{wc.currentLoad.toFixed(1)}h</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Planned</p>
                  <p className="font-medium">{wc.plannedLoad.toFixed(1)}h</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Available</p>
                  <p className="font-medium text-green-600">{wc.available.toFixed(1)}h</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rate</p>
                  <p className="font-medium">{wc.capacity_per_hour}/hr</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Capacity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily Capacity Utilization</CardTitle>
            <CardDescription>
              Projected capacity usage over the selected timeframe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyCapacity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <ReferenceLine y={100} stroke="red" strokeDasharray="3 3" label="Max Capacity" />
                <ReferenceLine y={85} stroke="orange" strokeDasharray="3 3" label="Target" />
                <Line 
                  type="monotone" 
                  dataKey="utilization" 
                  stroke="#3b82f6" 
                  name="Utilization %"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Load Distribution</CardTitle>
            <CardDescription>
              Current and planned load across work centers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={workCenters}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="currentLoad" stackId="a" fill="#3b82f6" name="Current" />
                <Bar dataKey="plannedLoad" stackId="a" fill="#93c5fd" name="Planned" />
                <Bar dataKey="available" fill="#10b981" name="Available" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottleneck Details */}
      {bottlenecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bottleneck Analysis</CardTitle>
            <CardDescription>
              Work centers approaching or exceeding capacity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bottlenecks.map((bottleneck, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`h-5 w-5 ${
                      bottleneck.utilization > 100 ? 'text-red-500' : 'text-orange-500'
                    }`} />
                    <div>
                      <p className="font-medium">{bottleneck.workCenter}</p>
                      <p className="text-sm text-muted-foreground">
                        {bottleneck.date} - {bottleneck.message}
                      </p>
                    </div>
                  </div>
                  <Badge variant={bottleneck.utilization > 100 ? 'destructive' : 'default'}>
                    {bottleneck.utilization}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}