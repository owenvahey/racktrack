import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthorizationUrl } from '@/lib/quickbooks'
import { Database } from '@/types/database.types'

export async function GET(request: NextRequest) {
  try {
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