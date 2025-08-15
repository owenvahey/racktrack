import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isTokenExpired, refreshAccessToken, getQBBaseUrl } from '@/lib/quickbooks'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get QB connection
    const { data: connection, error: connError } = await supabase
      .from('qb_connections')
      .select('*')
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: 'No QuickBooks connection found' }, { status: 404 })
    }

    // Check and refresh token if needed
    let accessToken = connection.access_token
    if (isTokenExpired(connection.token_expires_at)) {
      const refreshed = await refreshAccessToken(connection.refresh_token)
      accessToken = refreshed.accessToken
      
      // Update stored tokens
      await supabase
        .from('qb_connections')
        .update({
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken,
          token_expires_at: refreshed.expiresAt
        })
        .eq('id', connection.id)
    }

    // Fetch items from QuickBooks
    const baseUrl = getQBBaseUrl()
    const itemsUrl = `${baseUrl}/v3/company/${connection.realm_id}/query?query=select * from Item maxresults 20`
    
    const response = await fetch(itemsUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: `QB API error: ${error}` }, { status: response.status })
    }

    const data = await response.json()
    const items = data.QueryResponse?.Item || []

    // Sync items to products
    let synced = 0
    let created = 0
    let updated = 0
    let errors = []

    for (const item of items) {
      try {
        // Skip non-inventory items for now
        if (item.Type !== 'Inventory' && item.Type !== 'NonInventory') {
          continue
        }

        // Check if product exists
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('qb_item_id', item.Id)
          .single()

        const productData = {
          name: item.Name,
          description: item.Description,
          sku: item.Sku || `QB-${item.Id}`,
          qb_item_id: item.Id,
          unit_of_measure: item.UnitOfMeasure || 'Each',
          cost_per_unit: item.PurchaseCost || 0,
          sell_price: item.UnitPrice || 0,
          min_stock_level: item.ReorderPoint || 0,
          is_active: item.Active,
          // Determine product type based on QB item type and tracking
          product_type: item.Type === 'Inventory' ? 'raw_material' : 'finished_good',
          units_per_case: 1 // Default, can be updated later
        }

        if (existingProduct) {
          // Update existing product
          const { error: updateError } = await supabase
            .from('products')
            .update(productData)
            .eq('id', existingProduct.id)

          if (updateError) throw updateError
          updated++
        } else {
          // Create new product
          const { error: insertError } = await supabase
            .from('products')
            .insert(productData)

          if (insertError) throw insertError
          created++
        }
        
        synced++
      } catch (error) {
        errors.push({
          item: item.Name,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} items (${created} created, ${updated} updated)`,
      total: items.length,
      synced,
      created,
      updated,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Item sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}