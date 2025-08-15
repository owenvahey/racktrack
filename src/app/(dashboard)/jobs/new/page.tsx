'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react'

export default function NewJobPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    job_name: '',
    description: '',
    priority: 3,
    work_center: '',
    estimated_start_date: '',
    estimated_completion_date: '',
    estimated_hours: '',
    production_notes: '',
    quality_requirements: '',
    special_instructions: '',
    proof_required: false
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create the job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          job_name: formData.job_name,
          description: formData.description || null,
          priority: formData.priority,
          work_center: formData.work_center || null,
          estimated_start_date: formData.estimated_start_date || null,
          estimated_completion_date: formData.estimated_completion_date || null,
          estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
          production_notes: formData.production_notes || null,
          quality_requirements: formData.quality_requirements || null,
          special_instructions: formData.special_instructions || null,
          proof_required: formData.proof_required
        })
        .select()
        .single()

      if (jobError) throw jobError

      // Redirect to the job details page
      router.push(`/jobs/${job.id}`)
    } catch (error) {
      console.error('Error creating job:', error)
      setError(error instanceof Error ? error.message : 'Failed to create job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create New Job</h1>
          <p className="text-muted-foreground mt-2">
            Create a new production job
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the basic details for this job
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="job_name">Job Name *</Label>
              <Input
                id="job_name"
                required
                value={formData.job_name}
                onChange={(e) => setFormData({ ...formData, job_name: e.target.value })}
                placeholder="Enter job name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter job description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                >
                  <option value={1}>1 - Urgent</option>
                  <option value={2}>2 - High</option>
                  <option value={3}>3 - Normal</option>
                  <option value={4}>4 - Low</option>
                  <option value={5}>5 - Very Low</option>
                </select>
              </div>

              <div>
                <Label htmlFor="work_center">Work Center</Label>
                <select
                  id="work_center"
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.work_center}
                  onChange={(e) => setFormData({ ...formData, work_center: e.target.value })}
                >
                  <option value="">Select work center</option>
                  <option value="printing">Printing</option>
                  <option value="embroidery">Embroidery</option>
                  <option value="fulfillment">Fulfillment</option>
                  <option value="packaging">Packaging</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>
              Set the timeline for this job
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimated_start_date">Estimated Start Date</Label>
                <Input
                  id="estimated_start_date"
                  type="date"
                  value={formData.estimated_start_date}
                  onChange={(e) => setFormData({ ...formData, estimated_start_date: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="estimated_completion_date">Estimated Completion Date</Label>
                <Input
                  id="estimated_completion_date"
                  type="date"
                  value={formData.estimated_completion_date}
                  onChange={(e) => setFormData({ ...formData, estimated_completion_date: e.target.value })}
                  min={formData.estimated_start_date}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="estimated_hours">Estimated Hours</Label>
              <Input
                id="estimated_hours"
                type="number"
                step="0.5"
                min="0"
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                placeholder="0.0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Production Details */}
        <Card>
          <CardHeader>
            <CardTitle>Production Details</CardTitle>
            <CardDescription>
              Add production notes and requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="production_notes">Production Notes</Label>
              <Textarea
                id="production_notes"
                value={formData.production_notes}
                onChange={(e) => setFormData({ ...formData, production_notes: e.target.value })}
                placeholder="Enter production notes"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="quality_requirements">Quality Requirements</Label>
              <Textarea
                id="quality_requirements"
                value={formData.quality_requirements}
                onChange={(e) => setFormData({ ...formData, quality_requirements: e.target.value })}
                placeholder="Enter quality requirements"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="special_instructions">Special Instructions</Label>
              <Textarea
                id="special_instructions"
                value={formData.special_instructions}
                onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                placeholder="Enter special instructions"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="proof_required"
                checked={formData.proof_required}
                onChange={(e) => setFormData({ ...formData, proof_required: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="proof_required" className="cursor-pointer">
                Proof required before production
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Job'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}