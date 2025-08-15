import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthorizationUrl, validateQBConfig } from '@/lib/quickbooks'
import { Database } from '@/types/database.types'

export async function GET(request: NextRequest) {
  try {
    // Validate QuickBooks configuration first
    const configValidation = validateQBConfig()
    if (!configValidation.valid) {
      console.error('QuickBooks configuration errors:', configValidation.errors)
      return NextResponse.redirect(
        `/admin/quickbooks?error=config_error&details=${encodeURIComponent(configValidation.errors.join(', '))}`
      )
    }

    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomUUID()
    
    // Log the redirect URI for debugging
    console.log('QuickBooks Connect - Redirect URI:', process.env.QB_REDIRECT_URI || process.env.QUICKBOOKS_REDIRECT_URI || 'not set')
    console.log('QuickBooks Connect - All QB env vars:', {
      QB_CLIENT_ID: process.env.QB_CLIENT_ID ? 'set' : 'not set',
      QB_CLIENT_SECRET: process.env.QB_CLIENT_SECRET ? 'set' : 'not set',
      QB_REDIRECT_URI: process.env.QB_REDIRECT_URI || 'not set',
      VERCEL_URL: process.env.VERCEL_URL || 'not set',
      VERCEL_ENV: process.env.VERCEL_ENV || 'not set'
    })
    
    // Store state in cookies for verification
    const response = NextResponse.redirect(getAuthorizationUrl(state))
    response.cookies.set('qb_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutes
    })

    return response
  } catch (error) {
    console.error('QuickBooks connect error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate QuickBooks connection' },
      { status: 500 }
    )
  }
}