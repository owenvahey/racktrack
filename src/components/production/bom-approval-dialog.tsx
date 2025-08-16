'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Check, X } from 'lucide-react'

interface BOMApprovalDialogProps {
  bomId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onApproved?: () => void
  onRejected?: () => void
}

export function BOMApprovalDialog({ 
  bomId, 
  open, 
  onOpenChange,
  onApproved,
  onRejected
}: BOMApprovalDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [comments, setComments] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)

  async function handleApproval(approved: boolean) {
    setLoading(true)
    setAction(approved ? 'approve' : 'reject')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (approved) {
        // Approve the BOM
        const { error } = await supabase
          .from('product_boms')
          .update({
            status: 'active',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            effective_date: new Date().toISOString()
          })
          .eq('id', bomId)

        if (error) throw error

        // Add approval comment if provided
        if (comments.trim()) {
          await supabase
            .from('bom_approval_history')
            .insert({
              bom_id: bomId,
              action: 'approved',
              comments: comments.trim(),
              created_by: user.id
            })
        }

        toast.success('BOM approved and activated')
        onApproved?.()
      } else {
        // Reject the BOM
        const { error } = await supabase
          .from('product_boms')
          .update({
            status: 'draft'
          })
          .eq('id', bomId)

        if (error) throw error

        // Add rejection comment
        if (comments.trim()) {
          await supabase
            .from('bom_approval_history')
            .insert({
              bom_id: bomId,
              action: 'rejected',
              comments: comments.trim(),
              created_by: user.id
            })
        }

        toast.error('BOM rejected and returned to draft')
        onRejected?.()
      }

      onOpenChange(false)
      setComments('')
    } catch (error) {
      console.error('Error processing approval:', error)
      toast.error(`Failed to ${approved ? 'approve' : 'reject'} BOM`)
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>BOM Approval</DialogTitle>
          <DialogDescription>
            Review and approve or reject this bill of materials
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="comments">Comments (Optional)</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any comments about your decision..."
              rows={4}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => handleApproval(false)}
            disabled={loading}
          >
            {loading && action === 'reject' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                Reject
              </>
            )}
          </Button>
          <Button
            onClick={() => handleApproval(true)}
            disabled={loading}
          >
            {loading && action === 'approve' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Approve & Activate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}