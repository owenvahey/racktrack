'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Calendar as CalendarIcon,
  Clock,
  Factory,
  Package,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Loader2
} from 'lucide-react'
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns'
import { useRouter } from 'next/navigation'

interface JobRoute {
  id: string
  job_id: string
  activity_id: string
  work_center_id: string
  sequence_number: number
  status: string
  estimated_start?: string
  estimated_complete?: string
  actual_start?: string
  actual_complete?: string
  quantity_target: number
  quantity_completed: number
  job: {
    job_number: string
    job_name: string
    customer?: {
      name: string
    }
  }
  activity: {
    name: string
    code: string
  }
  work_center: {
    name: string
    code: string
    capacity_per_hour?: number
  }
}

interface WorkCenterSchedule {
  id: string
  name: string
  routes: JobRoute[]
}

interface TimeSlot {
  start: Date
  end: Date
  route?: JobRoute
  utilization: number
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

export default function ProductionSchedulePage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'day' | 'week' | 'month'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string>('all')
  const [workCenters, setWorkCenters] = useState<WorkCenterSchedule[]>([])
  const [selectedRoute, setSelectedRoute] = useState<JobRoute | null>(null)
  const [showRouteDialog, setShowRouteDialog] = useState(false)
  const [draggedRoute, setDraggedRoute] = useState<JobRoute | null>(null)

  useEffect(() => {
    fetchScheduleData()
  }, [currentDate, view])

  async function fetchScheduleData() {
    setLoading(true)
    try {
      let startDate: Date
      let endDate: Date

      switch (view) {
        case 'day':
          startDate = new Date(currentDate)
          startDate.setHours(0, 0, 0, 0)
          endDate = new Date(currentDate)
          endDate.setHours(23, 59, 59, 999)
          break
        case 'week':
          startDate = startOfWeek(currentDate)
          endDate = endOfWeek(currentDate)
          break
        case 'month':
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
          endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
          break
      }

      // Fetch job routes with their relationships
      const { data: routesData, error } = await supabase
        .from('job_routes')
        .select(`
          *,
          job:jobs (
            job_number,
            job_name,
            customer:qb_customers (
              name
            )
          ),
          activity:activities (
            name,
            code
          ),
          work_center:work_centers (
            id,
            name,
            code,
            capacity_per_hour
          )
        `)
        .or(`estimated_start.gte.${startDate.toISOString()},estimated_complete.lte.${endDate.toISOString()}`)
        .not('status', 'eq', 'completed')
        .order('estimated_start', { ascending: true })

      if (error) throw error

      // Group routes by work center
      const wcMap = new Map<string, WorkCenterSchedule>()
      
      routesData?.forEach(route => {
        const wcId = route.work_center.id
        if (!wcMap.has(wcId)) {
          wcMap.set(wcId, {
            id: wcId,
            name: route.work_center.name,
            routes: []
          })
        }
        wcMap.get(wcId)!.routes.push(route)
      })

      setWorkCenters(Array.from(wcMap.values()))
    } catch (error) {
      console.error('Error fetching schedule:', error)
      toast.error('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  function navigateDate(direction: 'prev' | 'next') {
    const newDate = new Date(currentDate)
    
    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
        break
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
        break
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
        break
    }
    
    setCurrentDate(newDate)
  }

  function getDateRange() {
    switch (view) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy')
      case 'week':
        const weekStart = startOfWeek(currentDate)
        const weekEnd = endOfWeek(currentDate)
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
      case 'month':
        return format(currentDate, 'MMMM yyyy')
    }
  }

  function getTimeSlots(): Date[] {
    const slots: Date[] = []
    const startHour = 6 // 6 AM
    const endHour = 20 // 8 PM
    
    for (let hour = startHour; hour <= endHour; hour++) {
      const slot = new Date(currentDate)
      slot.setHours(hour, 0, 0, 0)
      slots.push(slot)
    }
    
    return slots
  }

  function getDaysInView(): Date[] {
    switch (view) {
      case 'day':
        return [currentDate]
      case 'week':
        return eachDayOfInterval({
          start: startOfWeek(currentDate),
          end: endOfWeek(currentDate)
        })
      case 'month':
        const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        return eachDayOfInterval({ start, end })
    }
  }

  async function handleDrop(route: JobRoute, newDate: Date, workCenterId: string) {
    try {
      // Calculate duration
      const duration = route.estimated_complete && route.estimated_start
        ? new Date(route.estimated_complete).getTime() - new Date(route.estimated_start).getTime()
        : 2 * 60 * 60 * 1000 // Default 2 hours

      const newStart = new Date(newDate)
      const newEnd = new Date(newStart.getTime() + duration)

      const { error } = await supabase
        .from('job_routes')
        .update({
          estimated_start: newStart.toISOString(),
          estimated_complete: newEnd.toISOString(),
          work_center_id: workCenterId
        })
        .eq('id', route.id)

      if (error) throw error

      toast.success('Schedule updated')
      fetchScheduleData()
    } catch (error) {
      console.error('Error updating schedule:', error)
      toast.error('Failed to update schedule')
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
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Production Schedule</h1>
          <p className="text-muted-foreground mt-2">
            Plan and manage production activities across work centers
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={view} onValueChange={(v: any) => setView(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day View</SelectItem>
              <SelectItem value="week">Week View</SelectItem>
              <SelectItem value="month">Month View</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => router.push('/production/jobs/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Job
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDate('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-xl font-semibold">{getDateRange()}</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDate('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {view === 'month' ? (
            // Month View - Calendar Grid
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center font-medium text-sm text-muted-foreground p-2">
                  {day}
                </div>
              ))}
              {getDaysInView().map((day, idx) => {
                const dayRoutes = workCenters.flatMap(wc => 
                  wc.routes.filter(r => {
                    if (!r.estimated_start) return false
                    const routeDate = new Date(r.estimated_start)
                    return isSameDay(routeDate, day)
                  })
                )
                
                return (
                  <div
                    key={idx}
                    className={`min-h-[100px] border rounded p-2 ${
                      day.getMonth() !== currentDate.getMonth() 
                        ? 'bg-gray-50 text-gray-400' 
                        : ''
                    }`}
                  >
                    <div className="font-medium text-sm mb-1">
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayRoutes.slice(0, 3).map(route => (
                        <div
                          key={route.id}
                          className={`text-xs p-1 rounded truncate cursor-pointer ${
                            statusColors[route.status as keyof typeof statusColors]
                          }`}
                          onClick={() => {
                            setSelectedRoute(route)
                            setShowRouteDialog(true)
                          }}
                        >
                          {route.job.job_number}
                        </div>
                      ))}
                      {dayRoutes.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayRoutes.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            // Day/Week View - Timeline
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Time headers */}
                {view === 'day' && (
                  <div className="flex border-b pb-2 mb-4">
                    <div className="w-40 font-medium">Work Center</div>
                    {getTimeSlots().map((slot, idx) => (
                      <div key={idx} className="flex-1 text-center text-sm">
                        {format(slot, 'h a')}
                      </div>
                    ))}
                  </div>
                )}

                {/* Work center rows */}
                {workCenters.map(wc => (
                  <div key={wc.id} className="border-b pb-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Factory className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">{wc.name}</h3>
                      <Badge variant="outline">
                        {wc.routes.length} jobs
                      </Badge>
                    </div>
                    
                    {view === 'week' ? (
                      // Week view - show days
                      <div className="grid grid-cols-7 gap-2">
                        {getDaysInView().map((day, idx) => {
                          const dayRoutes = wc.routes.filter(r => {
                            if (!r.estimated_start) return false
                            const routeDate = new Date(r.estimated_start)
                            return isSameDay(routeDate, day)
                          })
                          
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="text-sm font-medium text-center">
                                {format(day, 'EEE d')}
                              </div>
                              <div className="min-h-[100px] border rounded p-1 space-y-1">
                                {dayRoutes.map(route => (
                                  <div
                                    key={route.id}
                                    className={`text-xs p-1 rounded cursor-pointer ${
                                      statusColors[route.status as keyof typeof statusColors]
                                    }`}
                                    onClick={() => {
                                      setSelectedRoute(route)
                                      setShowRouteDialog(true)
                                    }}
                                    draggable
                                    onDragStart={() => setDraggedRoute(route)}
                                    onDragEnd={() => setDraggedRoute(null)}
                                    onDrop={(e) => {
                                      e.preventDefault()
                                      if (draggedRoute) {
                                        handleDrop(draggedRoute, day, wc.id)
                                      }
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                  >
                                    <div className="font-medium truncate">
                                      {route.job.job_number}
                                    </div>
                                    <div className="truncate">
                                      {route.activity.name}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      // Day view - show timeline
                      <div className="flex">
                        <div className="w-40">
                          {wc.routes.map(route => (
                            <div
                              key={route.id}
                              className={`mb-1 p-1 rounded text-xs ${
                                statusColors[route.status as keyof typeof statusColors]
                              }`}
                            >
                              {route.job.job_number}
                            </div>
                          ))}
                        </div>
                        <div className="flex-1 relative h-[100px] bg-gray-50 rounded">
                          {/* Timeline visualization would go here */}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Route Details Dialog */}
      <Dialog open={showRouteDialog} onOpenChange={setShowRouteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Job Route Details</DialogTitle>
            <DialogDescription>
              View and edit production route information
            </DialogDescription>
          </DialogHeader>
          
          {selectedRoute && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Job</Label>
                  <p className="font-medium">{selectedRoute.job.job_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRoute.job.job_name}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Customer</Label>
                  <p className="font-medium">
                    {selectedRoute.job.customer?.name || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Activity</Label>
                  <p className="font-medium">{selectedRoute.activity.name}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Work Center</Label>
                  <p className="font-medium">{selectedRoute.work_center.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <Badge className={statusColors[selectedRoute.status as keyof typeof statusColors]}>
                    {selectedRoute.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Progress</Label>
                  <p className="font-medium">
                    {selectedRoute.quantity_completed} / {selectedRoute.quantity_target} units
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Scheduled Start</Label>
                  <p className="font-medium">
                    {selectedRoute.estimated_start 
                      ? format(new Date(selectedRoute.estimated_start), 'MMM d, h:mm a')
                      : 'Not scheduled'
                    }
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Scheduled End</Label>
                  <p className="font-medium">
                    {selectedRoute.estimated_complete
                      ? format(new Date(selectedRoute.estimated_complete), 'MMM d, h:mm a')
                      : 'Not scheduled'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRouteDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              if (selectedRoute) {
                router.push(`/production/routes/${selectedRoute.id}`)
              }
            }}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}