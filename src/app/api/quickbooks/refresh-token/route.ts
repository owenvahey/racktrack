import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken } from '@/lib/quickbooks'

export async function POST(request: NextRequest) {
  try {
    // Verify this is coming from Vercel Cron
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    
    // Get all active QuickBooks connections
    const { data: connections, error: fetchError } = await supabase
      .from('qb_connections')
      .select('*')
      .eq('is_active', true)

    if (fetchError) {
      console.error('Error fetching connections:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: 'No active connections found' }, { status: 200 })
    }

    const results = []

    // Refresh tokens for each connection
    for (const connection of connections) {
      try {
        // Check if token expires in the next 30 minutes
        const tokenExpiry = new Date(connection.token_expires_at)
        const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000)
        
        if (tokenExpiry > thirtyMinutesFromNow) {
          results.push({
            companyId: connection.company_id,
            status: 'skipped',
            message: 'Token still valid'
          })
          continue
        }

        // Refresh the token
        const tokenData = await refreshAccessToken(connection.refresh_token)
        
        if (!tokenData) {
          results.push({
            companyId: connection.company_id,
            status: 'error',
            message: 'Failed to refresh token'
          })
          continue
        }

        // Update the connection with new tokens
        const { error: updateError } = await supabase
          .from('qb_connections')
          .update({
            access_token: tokenData.accessToken,
            refresh_token: tokenData.refreshToken,
            token_expires_at: tokenData.expiresAt,
            last_sync_at: new Date().toISOString()
          })
          .eq('id', connection.id)

        if (updateError) {
          console.error('Error updating connection:', updateError)
          results.push({
            companyId: connection.company_id,
            status: 'error',
            message: 'Failed to update tokens in database'
          })
        } else {
          results.push({
            companyId: connection.company_id,
            status: 'success',
            message: 'Token refreshed successfully'
          })
        }
      } catch (error) {
        console.error(`Error refreshing token for company ${connection.company_id}:`, error)
        results.push({
          companyId: connection.company_id,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({ 
      message: 'Token refresh completed',
      results 
    }, { status: 200 })
  } catch (error) {
    console.error('Error in token refresh:', error)
    return NextResponse.json({ 
      error: 'Failed to refresh tokens',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint for manual testing or health checks
export async function GET() {
  return NextResponse.json({ 
    message: 'QuickBooks token refresh endpoint',
    usage: 'Send POST request to refresh tokens'
  })
}