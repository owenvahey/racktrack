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

    // Fetch customers from QuickBooks
    const baseUrl = getQBBaseUrl()
    const customersUrl = `${baseUrl}/v3/company/${connection.realm_id}/query?query=select * from Customer maxresults 20`
    
    const response = await fetch(customersUrl, {
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
    const customers = data.QueryResponse?.Customer || []

    // Sync customers to database
    let synced = 0
    let errors = []

    for (const customer of customers) {
      try {
        const customerData = {
          qb_customer_id: customer.Id,
          qb_sync_token: customer.SyncToken,
          name: customer.DisplayName || customer.CompanyName || customer.GivenName + ' ' + customer.FamilyName,
          display_name: customer.DisplayName,
          company_name: customer.CompanyName,
          email: customer.PrimaryEmailAddr?.Address,
          phone: customer.PrimaryPhone?.FreeFormNumber,
          mobile: customer.Mobile?.FreeFormNumber,
          billing_address: customer.BillAddr ? {
            line1: customer.BillAddr.Line1,
            line2: customer.BillAddr.Line2,
            city: customer.BillAddr.City,
            state: customer.BillAddr.CountrySubDivisionCode,
            postal_code: customer.BillAddr.PostalCode,
            country: customer.BillAddr.Country
          } : null,
          shipping_address: customer.ShipAddr ? {
            line1: customer.ShipAddr.Line1,
            line2: customer.ShipAddr.Line2,
            city: customer.ShipAddr.City,
            state: customer.ShipAddr.CountrySubDivisionCode,
            postal_code: customer.ShipAddr.PostalCode,
            country: customer.ShipAddr.Country
          } : null,
          is_active: customer.Active,
          qb_created_time: customer.MetaData?.CreateTime,
          qb_last_updated_time: customer.MetaData?.LastUpdatedTime,
          last_synced_at: new Date().toISOString()
        }

        // Upsert customer
        const { error: upsertError } = await supabase
          .from('qb_customers')
          .upsert(customerData, {
            onConflict: 'qb_customer_id'
          })

        if (upsertError) throw upsertError
        synced++
      } catch (error) {
        errors.push({
          customer: customer.DisplayName,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Update last sync
    await supabase
      .from('qb_connections')
      .update({
        last_sync_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} customers`,
      total: customers.length,
      synced,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Customer sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}