import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isTokenExpired, refreshAccessToken, getQBBaseUrl } from '@/lib/quickbooks'

export async function POST(
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

    // Get the PO with items
    const { data: po, error: poError } = await supabase
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

    if (poError || !po) {
      return NextResponse.json({ error: 'PO not found' }, { status: 404 })
    }

    // Check if customer has QB ID
    if (!po.customer?.qb_customer_id) {
      return NextResponse.json(
        { error: 'Customer must be synced to QuickBooks first' },
        { status: 400 }
      )
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

    // Prepare estimate data for QuickBooks
    const estimateData: any = {
      CustomerRef: {
        value: po.customer.qb_customer_id
      },
      TxnDate: po.po_date,
      ExpirationDate: po.due_date,
      DocNumber: po.po_number,
      Line: po.items.map((item: any, index: number) => ({
        Id: String(index + 1),
        LineNum: index + 1,
        Description: item.description || item.product?.name,
        Amount: item.total_amount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: item.product?.qb_item_id || "1" // Default to generic item if not synced
          },
          Qty: item.quantity,
          UnitPrice: item.unit_price
        }
      })),
      CustomField: [
        {
          DefinitionId: "1", // First custom field - PO Number
          Name: "PO Number",
          Type: "StringType",
          StringValue: po.po_number
        },
        {
          DefinitionId: "2", // Second custom field - Production Status
          Name: "Production Status",
          Type: "StringType",
          StringValue: po.production_status.replace(/_/g, ' ').toUpperCase()
        },
        {
          DefinitionId: "3", // Third custom field - Due Date
          Name: "Production Due",
          Type: "StringType",
          StringValue: po.due_date || ''
        }
      ]
    }

    // Add Memo for additional info
    if (po.description || po.production_notes) {
      estimateData.PrivateNote = [
        po.description,
        po.production_notes ? `Production Notes: ${po.production_notes}` : null
      ].filter(Boolean).join('\n')
    }

    const baseUrl = getQBBaseUrl()
    let response

    if (po.qb_estimate_id) {
      // Update existing estimate
      // First, get the current estimate to preserve sync token
      const getUrl = `${baseUrl}/v3/company/${connection.realm_id}/estimate/${po.qb_estimate_id}`
      const getResponse = await fetch(getUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!getResponse.ok) {
        throw new Error('Failed to fetch existing estimate from QuickBooks')
      }

      const existingEstimate = await getResponse.json()
      estimateData.Id = po.qb_estimate_id
      estimateData.SyncToken = existingEstimate.Estimate.SyncToken

      // Update estimate
      const updateUrl = `${baseUrl}/v3/company/${connection.realm_id}/estimate`
      response = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(estimateData)
      })
    } else {
      // Create new estimate
      const createUrl = `${baseUrl}/v3/company/${connection.realm_id}/estimate`
      response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(estimateData)
      })
    }

    if (!response.ok) {
      const error = await response.text()
      console.error('QuickBooks API error:', error)
      return NextResponse.json(
        { error: `QuickBooks API error: ${error}` },
        { status: response.status }
      )
    }

    const result = await response.json()
    const qbEstimate = result.Estimate

    // Update PO with QB estimate info
    const { error: updateError } = await supabase
      .from('customer_pos')
      .update({
        qb_estimate_id: qbEstimate.Id,
        qb_estimate_number: qbEstimate.DocNumber,
        qb_sync_token: qbEstimate.SyncToken,
        qb_customer_id: po.customer.qb_customer_id,
        updated_by: user.id
      })
      .eq('id', resolvedParams.id)

    if (updateError) {
      console.error('Error updating PO with QB info:', updateError)
    }

    return NextResponse.json({
      success: true,
      message: po.qb_estimate_id ? 'Estimate updated in QuickBooks' : 'Estimate created in QuickBooks',
      estimate: {
        id: qbEstimate.Id,
        number: qbEstimate.DocNumber,
        status: qbEstimate.TxnStatus,
        total: qbEstimate.TotalAmt
      }
    })
  } catch (error) {
    console.error('Error syncing estimate:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync estimate' },
      { status: 500 }
    )
  }
}