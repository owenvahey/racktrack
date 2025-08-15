'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WorkCenter, Activity, WorkCenterActivity } from '@/types/production.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Search, 
  Settings,
  Clock,
  DollarSign,
  Activity as ActivityIcon,
  Edit,
  Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function WorkCentersPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    Promise.all([fetchWorkCenters(), fetchActivities()])
      .finally(() => setLoading(false))
  }, [])

  async function fetchWorkCenters() {
    try {
      const { data, error } = await supabase
        .from('work_centers')
        .select('*')
        .order('name')

      if (error) throw error
      setWorkCenters(data || [])
    } catch (error) {
      console.error('Error fetching work centers:', error)
    }
  }

  async function fetchActivities() {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('name')

      if (error) throw error
      setActivities(data || [])
    } catch (error) {
      console.error('Error fetching activities:', error)
    }
  }

  const filteredWorkCenters = workCenters.filter(wc => 
    wc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wc.type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredActivities = activities.filter(act => 
    act.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    act.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    act.activity_type.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

  const activityTypeColors = {
    setup: 'bg-orange-100 text-orange-800',
    production: 'bg-blue-100 text-blue-800',
    quality_check: 'bg-yellow-100 text-yellow-800',
    packaging: 'bg-green-100 text-green-800',
    cleanup: 'bg-gray-100 text-gray-800',
    maintenance: 'bg-red-100 text-red-800'
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
          <h1 className="text-3xl font-bold">Production Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage work centers and production activities
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search work centers or activities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="work-centers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="work-centers">
            Work Centers ({filteredWorkCenters.length})
          </TabsTrigger>
          <TabsTrigger value="activities">
            Activities ({filteredActivities.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="work-centers" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => router.push('/admin/work-centers/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Work Center
            </Button>
          </div>
          
          {filteredWorkCenters.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No work centers found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkCenters.map(wc => (
                <Card 
                  key={wc.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/admin/work-centers/${wc.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{wc.name}</CardTitle>
                        <CardDescription className="text-xs">{wc.code}</CardDescription>
                      </div>
                      <Badge className={typeColors[wc.type] || typeColors.other}>
                        {wc.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {wc.description && (
                        <p className="text-muted-foreground">{wc.description}</p>
                      )}
                      <div className="flex items-center gap-4">
                        {wc.capacity_per_hour && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{wc.capacity_per_hour}/hr</span>
                          </div>
                        )}
                        {wc.cost_per_hour && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            <span>${wc.cost_per_hour}/hr</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <Badge variant={wc.is_active ? 'default' : 'secondary'}>
                          {wc.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/admin/work-centers/${wc.id}/edit`)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="activities" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => router.push('/admin/activities/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Activity
            </Button>
          </div>
          
          {filteredActivities.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No activities found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredActivities.map(activity => (
                <Card 
                  key={activity.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/admin/activities/${activity.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{activity.name}</CardTitle>
                        <CardDescription className="text-xs">{activity.code}</CardDescription>
                      </div>
                      <Badge className={activityTypeColors[activity.activity_type]}>
                        {activity.activity_type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {activity.description && (
                        <p className="text-muted-foreground">{activity.description}</p>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ActivityIcon className="h-3 w-3" />
                          <span>Skill Level {activity.requires_skill_level}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <Badge variant={activity.is_active ? 'default' : 'secondary'}>
                          {activity.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/admin/activities/${activity.id}/edit`)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}