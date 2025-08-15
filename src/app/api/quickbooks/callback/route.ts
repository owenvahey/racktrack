import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens, getCompanyInfo, getQBBaseUrl } from '@/lib/quickbooks'
import { Database } from '@/types/database.types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const realmId = searchParams.get('realmId')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      console.error('QuickBooks OAuth error:', error)
      return NextResponse.redirect(
        new URL('/admin/quickbooks?error=oauth_error', request.url)
      )
    }

    // Verify required parameters
    if (!code || !state || !realmId) {
      return NextResponse.redirect(
        new URL('/admin/quickbooks?error=missing_params', request.url)
      )
    }

    // Verify state parameter
    const cookieStore = await cookies()
    const savedState = cookieStore.get('qb_oauth_state')?.value

    if (!savedState || savedState !== state) {
      return NextResponse.redirect(
        new URL('/admin/quickbooks?error=invalid_state', request.url)
      )
    }

    // Clear state cookie
    cookieStore.delete('qb_oauth_state')

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, realmId)

    // Get company info
    const companyInfo = await getCompanyInfo(tokens.accessToken, realmId)

    // Store connection in database
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.redirect(
        new URL('/admin/quickbooks?error=unauthorized', request.url)
      )
    }

    // Check for existing connection
    const { data: existingConnection } = await supabase
      .from('qb_connections')
      .select('id')
      .eq('company_id', companyInfo.Id)
      .single()

    if (existingConnection) {
      // Update existing connection
      const { error: updateError } = await supabase
        .from('qb_connections')
        .update({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt,
          realm_id: realmId,
          company_name: companyInfo.CompanyName,
          base_url: getQBBaseUrl(),
          last_error: null,
          error_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id)

      if (updateError) {
        console.error('Failed to update QB connection:', updateError)
        return NextResponse.redirect(
          new URL('/admin/quickbooks?error=update_failed', request.url)
        )
      }
    } else {
      // Create new connection
      const { error: insertError } = await supabase
        .from('qb_connections')
        .insert({
          company_id: companyInfo.Id,
          company_name: companyInfo.CompanyName,
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt,
          realm_id: realmId,
          base_url: getQBBaseUrl()
        })

      if (insertError) {
        console.error('Failed to create QB connection:', insertError)
        return NextResponse.redirect(
          new URL('/admin/quickbooks?error=create_failed', request.url)
        )
      }
    }

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/admin/quickbooks?success=connected', request.url)
    )

  } catch (error) {
    console.error('QuickBooks callback error:', error)
    return NextResponse.redirect(
      new URL('/admin/quickbooks?error=callback_error', request.url)
    )
  }
}