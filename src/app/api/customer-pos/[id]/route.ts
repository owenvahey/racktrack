import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: po, error } = await supabase
      .from('customer_pos')
      .select(`
        *,
        customer:customers(*),
        items:customer_po_items(
          *,
          product:products(*)
        ),
        status_history:customer_po_status_history(
          *,
          changed_by_user:profiles!customer_po_status_history_changed_by_fkey(name)
        ),
        created_by_user:profiles!customer_pos_created_by_fkey(name),
        updated_by_user:profiles!customer_pos_updated_by_fkey(name)
      `)
      .eq('id', resolvedParams.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'PO not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(po)
  } catch (error) {
    console.error('Error fetching customer PO:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer PO' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { items, ...poData } = body

    // Update the PO
    const { data: po, error: poError } = await supabase
      .from('customer_pos')
      .update({
        ...poData,
        updated_by: user.id
      })
      .eq('id', resolvedParams.id)
      .select()
      .single()

    if (poError) {
      return NextResponse.json({ error: poError.message }, { status: 500 })
    }

    // Update items if provided
    if (items !== undefined) {
      // Delete existing items
      await supabase
        .from('customer_po_items')
        .delete()
        .eq('po_id', resolvedParams.id)

      // Insert new items
      if (items.length > 0) {
        const poItems = items.map((item: any, index: number) => ({
          ...item,
          po_id: resolvedParams.id,
          line_number: index + 1
        }))

        const { error: itemsError } = await supabase
          .from('customer_po_items')
          .insert(poItems)

        if (itemsError) {
          return NextResponse.json({ error: itemsError.message }, { status: 500 })
        }
      }
    }

    // Fetch the updated PO with all relations
    const { data: updatedPO } = await supabase
      .from('customer_pos')
      .select(`
        *,
        customer:customers(*),
        items:customer_po_items(
          *,
          product:products(*)
        )
      `)
      .eq('id', resolvedParams.id)
      .single()

    return NextResponse.json(updatedPO)
  } catch (error) {
    console.error('Error updating customer PO:', error)
    return NextResponse.json(
      { error: 'Failed to update customer PO' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Check if PO can be deleted (not in production or invoiced)
    const { data: po } = await supabase
      .from('customer_pos')
      .select('production_status')
      .eq('id', resolvedParams.id)
      .single()

    if (po && ['in_production', 'invoiced'].includes(po.production_status)) {
      return NextResponse.json(
        { error: 'Cannot delete PO that is in production or invoiced' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('customer_pos')
      .delete()
      .eq('id', resolvedParams.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting customer PO:', error)
    return NextResponse.json(
      { error: 'Failed to delete customer PO' },
      { status: 500 }
    )
  }
}