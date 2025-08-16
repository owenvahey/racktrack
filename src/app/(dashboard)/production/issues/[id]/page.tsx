'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProductionIssue, IssueComment } from '@/types/production.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ArrowLeft,
  Package2,
  Wrench,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  User,
  Calendar,
  MessageSquare,
  Edit,
  Save,
  X,
  Loader2,
  FileText,
  Download
} from 'lucide-react'
import { format } from 'date-fns'

interface IssueDetails extends Omit<ProductionIssue, 'job_route' | 'work_center' | 'material_product' | 'reporter' | 'resolver' | 'operator'> {
  job_route?: {
    id: string
    sequence_number: number
    activity: {
      name: string
      code: string
    }
    job: {
      job_number: string
      job_name: string
      customer?: {
        name: string
      }
    }
  }
  work_center?: {
    id: string
    name: string
    code: string
  }
  material_product?: {
    id: string
    name: string
    sku: string
  }
  reporter?: {
    full_name: string
    email: string
  }
  resolver?: {
    full_name: string
    email: string
  }
  operator?: {
    full_name: string
  }
}

export default function IssueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const issueId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [issue, setIssue] = useState<IssueDetails | null>(null)
  const [comments, setComments] = useState<IssueComment[]>([])
  const [editMode, setEditMode] = useState(false)
  const [addingComment, setAddingComment] = useState(false)
  const [newComment, setNewComment] = useState('')
  
  // Edit form data
  const [editData, setEditData] = useState({
    status: '',
    severity: '',
    root_cause: '',
    resolution: '',
    downtime_minutes: 0,
    cost_impact: 0
  })

  useEffect(() => {
    fetchIssue()
    fetchComments()
  }, [issueId])

  async function fetchIssue() {
    try {
      const { data, error } = await supabase
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
              job_name,
              customer:qb_customers (
                name
              )
            )
          ),
          work_center:work_centers (
            id,
            name,
            code
          ),
          material_product:products (
            id,
            name,
            sku
          ),
          reporter:profiles!production_issues_reported_by_fkey (
            full_name,
            email
          ),
          resolver:profiles!production_issues_resolved_by_fkey (
            full_name,
            email
          ),
          operator:profiles!production_issues_operator_id_fkey (
            full_name
          )
        `)
        .eq('id', issueId)
        .single()

      if (error) throw error
      
      setIssue(data)
      setEditData({
        status: data.status,
        severity: data.severity || 'medium',
        root_cause: data.root_cause || '',
        resolution: data.resolution || '',
        downtime_minutes: data.downtime_minutes || 0,
        cost_impact: data.cost_impact || 0
      })
    } catch (error) {
      console.error('Error fetching issue:', error)
      setError('Failed to load issue details')
    } finally {
      setLoading(false)
    }
  }

  async function fetchComments() {
    try {
      const { data, error } = await supabase
        .from('issue_comments')
        .select(`
          *,
          creator:profiles!issue_comments_created_by_fkey (
            full_name
          )
        `)
        .eq('issue_id', issueId)
        .order('created_at', { ascending: true })

      if (error) throw error
      
      setComments(data || [])
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  async function handleUpdate() {
    if (!issue) return
    
    setSaving(true)
    setError(null)

    try {
      const { data: user } = await supabase.auth.getUser()
      
      const updateData: any = {
        status: editData.status,
        severity: editData.severity,
        root_cause: editData.root_cause,
        resolution: editData.resolution,
        downtime_minutes: editData.downtime_minutes,
        cost_impact: editData.cost_impact,
        updated_at: new Date().toISOString()
      }
      
      // If resolving, add resolver and timestamp
      if (editData.status === 'resolved' && issue.status !== 'resolved') {
        updateData.resolved_by = user.user?.id
        updateData.resolved_at = new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('production_issues')
        .update(updateData)
        .eq('id', issueId)

      if (error) throw error
      
      // Refresh issue data
      await fetchIssue()
      setEditMode(false)
    } catch (error) {
      console.error('Error updating issue:', error)
      setError('Failed to update issue')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return
    
    setAddingComment(true)
    
    try {
      const { data: user } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('issue_comments')
        .insert({
          issue_id: issueId,
          comment: newComment,
          created_by: user.user?.id
        })

      if (error) throw error
      
      setNewComment('')
      await fetchComments()
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setAddingComment(false)
    }
  }

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

  if (!issue) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Issue not found</p>
        </div>
      </div>
    )
  }

  const Icon = typeIcons[issue.issue_type]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/production/issues')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{issue.title}</h1>
            <p className="text-muted-foreground mt-1">
              Issue #{issue.id.slice(0, 8)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!editMode ? (
            <Button onClick={() => setEditMode(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Issue
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditMode(false)
                  setEditData({
                    status: issue.status,
                    severity: issue.severity || 'medium',
                    root_cause: issue.root_cause || '',
                    resolution: issue.resolution || '',
                    downtime_minutes: issue.downtime_minutes || 0,
                    cost_impact: issue.cost_impact || 0
                  })
                }}
                disabled={saving}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Issue Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Issue Details</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={typeColors[issue.issue_type]}>
                    <Icon className="mr-1 h-3 w-3" />
                    {issue.issue_type.replace('_', ' ')}
                  </Badge>
                  {editMode ? (
                    <Select
                      value={editData.severity}
                      onValueChange={(value: any) => setEditData({ ...editData, severity: value })}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    issue.severity && (
                      <Badge className={severityColors[issue.severity]}>
                        {issue.severity}
                      </Badge>
                    )
                  )}
                  {editMode ? (
                    <Select
                      value={editData.status}
                      onValueChange={(value: any) => setEditData({ ...editData, status: value })}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={statusColors[issue.status]}>
                      {issue.status}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {issue.description && (
                <div>
                  <h4 className="font-medium mb-1">Description</h4>
                  <p className="text-muted-foreground">{issue.description}</p>
                </div>
              )}
              
              {(editMode || issue.root_cause) && (
                <div>
                  <Label htmlFor="root_cause">Root Cause</Label>
                  {editMode ? (
                    <Textarea
                      id="root_cause"
                      value={editData.root_cause}
                      onChange={(e) => setEditData({ ...editData, root_cause: e.target.value })}
                      rows={3}
                      placeholder="What caused this issue?"
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-muted-foreground mt-1">{issue.root_cause}</p>
                  )}
                </div>
              )}
              
              {(editMode || issue.resolution) && (
                <div>
                  <Label htmlFor="resolution">Resolution</Label>
                  {editMode ? (
                    <Textarea
                      id="resolution"
                      value={editData.resolution}
                      onChange={(e) => setEditData({ ...editData, resolution: e.target.value })}
                      rows={3}
                      placeholder="How was this issue resolved?"
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-muted-foreground mt-1">{issue.resolution}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Context Information */}
          {(issue.job_route || issue.work_center || issue.material_product) && (
            <Card>
              <CardHeader>
                <CardTitle>Context Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {issue.job_route && (
                    <>
                      <div>
                        <dt className="font-medium text-muted-foreground">Job</dt>
                        <dd className="mt-1">
                          {issue.job_route.job.job_number} - {issue.job_route.job.job_name}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-muted-foreground">Customer</dt>
                        <dd className="mt-1">
                          {issue.job_route.job.customer?.name || 'N/A'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-muted-foreground">Activity</dt>
                        <dd className="mt-1">
                          {issue.job_route.activity.name} (Step {issue.job_route.sequence_number})
                        </dd>
                      </div>
                    </>
                  )}
                  
                  {issue.work_center && (
                    <div>
                      <dt className="font-medium text-muted-foreground">Work Center</dt>
                      <dd className="mt-1">
                        {issue.work_center.name}
                      </dd>
                    </div>
                  )}
                  
                  {issue.material_product && (
                    <>
                      <div>
                        <dt className="font-medium text-muted-foreground">Material</dt>
                        <dd className="mt-1">
                          {issue.material_product.name} ({issue.material_product.sku})
                        </dd>
                      </div>
                      {issue.lot_number && (
                        <div>
                          <dt className="font-medium text-muted-foreground">Lot Number</dt>
                          <dd className="mt-1">{issue.lot_number}</dd>
                        </div>
                      )}
                    </>
                  )}
                  
                  {issue.supplier_info && (
                    <div className="md:col-span-2">
                      <dt className="font-medium text-muted-foreground">Supplier Info</dt>
                      <dd className="mt-1">{issue.supplier_info}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Comments & Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.length === 0 && !addingComment && (
                <p className="text-muted-foreground text-center py-4">
                  No comments yet
                </p>
              )}
              
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {comment.creator?.full_name || 'Unknown User'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm">{comment.comment}</p>
                  </div>
                </div>
              ))}
              
              <Separator />
              
              <div className="space-y-3">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handleAddComment} 
                    disabled={addingComment || !newComment.trim()}
                  >
                    {addingComment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Add Comment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Impact Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Impact Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="quantity_affected">Quantity Affected</Label>
                {editMode ? (
                  <Input
                    id="quantity_affected"
                    type="number"
                    min="0"
                    value={issue.quantity_affected || 0}
                    disabled
                    className="mt-1"
                  />
                ) : (
                  <p className="text-2xl font-bold">
                    {issue.quantity_affected || 0} units
                  </p>
                )}
              </div>
              
              <Separator />
              
              <div>
                <Label htmlFor="downtime_minutes">Downtime</Label>
                {editMode ? (
                  <Input
                    id="downtime_minutes"
                    type="number"
                    min="0"
                    value={editData.downtime_minutes}
                    onChange={(e) => setEditData({ 
                      ...editData, 
                      downtime_minutes: parseInt(e.target.value) || 0 
                    })}
                    className="mt-1"
                  />
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <p className="text-2xl font-bold">
                      {issue.downtime_minutes ? `${issue.downtime_minutes} min` : 'None'}
                    </p>
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div>
                <Label htmlFor="cost_impact">Cost Impact</Label>
                {editMode ? (
                  <Input
                    id="cost_impact"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editData.cost_impact}
                    onChange={(e) => setEditData({ 
                      ...editData, 
                      cost_impact: parseFloat(e.target.value) || 0 
                    })}
                    className="mt-1"
                  />
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <p className="text-2xl font-bold">
                      ${(issue.cost_impact || 0).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* People */}
          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Reported by</p>
                <p className="font-medium">
                  {issue.reporter?.full_name || 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(issue.reported_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              
              {issue.operator && (
                <div>
                  <p className="text-sm text-muted-foreground">Operator</p>
                  <p className="font-medium">{issue.operator.full_name}</p>
                </div>
              )}
              
              {issue.resolver && issue.resolved_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Resolved by</p>
                  <p className="font-medium">{issue.resolver.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(issue.resolved_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          {issue.job_route && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/jobs/${issue.job_route!.job.job_number}`)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Job Details
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/production/complete/${issue.job_route_id}`)}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Go to Production
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}