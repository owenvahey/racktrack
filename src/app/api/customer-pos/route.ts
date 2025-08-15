import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const customerId = searchParams.get('customer_id')
    const search = searchParams.get('search')

    let query = supabase
      .from('customer_pos')
      .select(`
        *,
        customer:customers(id, name, company_name),
        items:customer_po_items(
          id,
          line_number,
          description,
          quantity,
          unit_price,
          total_amount,
          product:products(id, name, sku)
        ),
        created_by_user:profiles!customer_pos_created_by_fkey(name),
        updated_by_user:profiles!customer_pos_updated_by_fkey(name)
      `)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('production_status', status)
    }

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    if (search) {
      query = query.or(`po_number.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: pos, error } = await query

    if (error) {
      console.error('Error fetching customer POs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(pos || [])
  } catch (error) {
    console.error('Error in GET /api/customer-pos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer POs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { items, ...poData } = body

    // Generate PO number if not provided
    if (!poData.po_number) {
      const { count } = await supabase
        .from('customer_pos')
        .select('*', { count: 'exact', head: true })

      poData.po_number = `PO-${String((count || 0) + 1).padStart(6, '0')}`
    }

    // Create the PO
    const { data: po, error: poError } = await supabase
      .from('customer_pos')
      .insert({
        ...poData,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .single()

    if (poError) {
      console.error('Error creating customer PO:', poError)
      return NextResponse.json({ error: poError.message }, { status: 500 })
    }

    // Add items if provided
    if (items && items.length > 0) {
      const poItems = items.map((item: any, index: number) => ({
        ...item,
        po_id: po.id,
        line_number: index + 1
      }))

      const { error: itemsError } = await supabase
        .from('customer_po_items')
        .insert(poItems)

      if (itemsError) {
        console.error('Error creating PO items:', itemsError)
        // Rollback by deleting the PO
        await supabase.from('customer_pos').delete().eq('id', po.id)
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }
    }

    // Fetch the complete PO with items
    const { data: completePO } = await supabase
      .from('customer_pos')
      .select(`
        *,
        customer:customers(id, name, company_name),
        items:customer_po_items(*)
      `)
      .eq('id', po.id)
      .single()

    return NextResponse.json(completePO)
  } catch (error) {
    console.error('Error in POST /api/customer-pos:', error)
    return NextResponse.json(
      { error: 'Failed to create customer PO' },
      { status: 500 }
    )
  }
}