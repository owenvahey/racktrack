import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Define valid status transitions
const VALID_TRANSITIONS: { [key: string]: string[] } = {
  'draft': ['pending_approval', 'cancelled'],
  'pending_approval': ['approved', 'cancelled'],
  'approved': ['sent_to_production', 'cancelled'],
  'sent_to_production': ['in_production', 'on_hold', 'cancelled'],
  'in_production': ['quality_check', 'on_hold', 'cancelled'],
  'on_hold': ['in_production', 'cancelled'],
  'quality_check': ['ready_for_invoice', 'in_production'],
  'ready_for_invoice': ['invoiced'],
  'invoiced': [], // Terminal state
  'cancelled': [] // Terminal state
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { status, reason, notes } = await request.json()

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Get current PO status
    const { data: currentPO, error: fetchError } = await supabase
      .from('customer_pos')
      .select('production_status')
      .eq('id', params.id)
      .single()

    if (fetchError || !currentPO) {
      return NextResponse.json({ error: 'PO not found' }, { status: 404 })
    }

    // Validate status transition
    const validTransitions = VALID_TRANSITIONS[currentPO.production_status] || []
    if (!validTransitions.includes(status)) {
      return NextResponse.json(
        { 
          error: `Invalid status transition from ${currentPO.production_status} to ${status}`,
          validTransitions 
        },
        { status: 400 }
      )
    }

    // Update the status
    const updateData: any = {
      production_status: status,
      updated_by: user.id
    }

    // Add hold reason if going on hold
    if (status === 'on_hold' && reason) {
      updateData.hold_reason = reason
    } else if (status !== 'on_hold') {
      updateData.hold_reason = null
    }

    // Add production notes if provided
    if (notes) {
      updateData.production_notes = notes
    }

    const { data: updatedPO, error: updateError } = await supabase
      .from('customer_pos')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        customer:customers(name, company_name)
      `)
      .single()

    if (updateError) {
      console.error('Error updating PO status:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // The status history is automatically tracked by the database trigger

    return NextResponse.json({
      success: true,
      po: updatedPO,
      message: `PO status updated to ${status}`
    })
  } catch (error) {
    console.error('Error updating PO status:', error)
    return NextResponse.json(
      { error: 'Failed to update PO status' },
      { status: 500 }
    )
  }
}