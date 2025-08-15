import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// QuickBooks OAuth configuration
export const QB_CONFIG = {
  clientId: process.env.QB_CLIENT_ID || process.env.QUICKBOOKS_CLIENT_ID || '',
  clientSecret: process.env.QB_CLIENT_SECRET || process.env.QUICKBOOKS_CLIENT_SECRET || '',
  redirectUri: process.env.QB_REDIRECT_URI || process.env.QUICKBOOKS_REDIRECT_URI || 
    (process.env.VERCEL_ENV === 'production' 
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'racktrack.vercel.app'}/api/quickbooks/callback`
      : process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}/api/quickbooks/callback`
        : 'http://localhost:3000/api/quickbooks/callback'),
  scope: 'com.intuit.quickbooks.accounting',
  sandbox: process.env.QUICKBOOKS_SANDBOX === 'true',
  discoveryUrl: process.env.QUICKBOOKS_SANDBOX === 'true' 
    ? 'https://developer.api.intuit.com/.well-known/openid_sandbox_configuration'
    : 'https://developer.api.intuit.com/.well-known/openid_configuration'
}

// Validate configuration
export function validateQBConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!QB_CONFIG.clientId) {
    errors.push('QUICKBOOKS_CLIENT_ID is not configured')
  }
  
  if (!QB_CONFIG.clientSecret) {
    errors.push('QUICKBOOKS_CLIENT_SECRET is not configured')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// Get the base URL for QuickBooks API
export function getQBBaseUrl(sandbox: boolean = QB_CONFIG.sandbox): string {
  return sandbox 
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com'
}

// Generate OAuth authorization URL
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: QB_CONFIG.clientId,
    scope: QB_CONFIG.scope,
    redirect_uri: QB_CONFIG.redirectUri,
    response_type: 'code',
    state: state
  })

  const authEndpoint = QB_CONFIG.sandbox
    ? 'https://appcenter.intuit.com/connect/oauth2'
    : 'https://appcenter.intuit.com/connect/oauth2'

  // Log the redirect URI being used (helpful for debugging)
  console.log('QuickBooks redirect URI:', QB_CONFIG.redirectUri)
  console.log('Full auth URL:', `${authEndpoint}?${params.toString()}`)

  return `${authEndpoint}?${params.toString()}`
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string, realmId: string) {
  const tokenEndpoint = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
  
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: QB_CONFIG.redirectUri
  })

  const auth = Buffer.from(`${QB_CONFIG.clientId}:${QB_CONFIG.clientSecret}`).toString('base64')

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`
    },
    body: params.toString()
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const tokens = await response.json()
  
  // Calculate token expiration
  const expiresAt = new Date()
  expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in)

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: expiresAt.toISOString(),
    realmId
  }
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string) {
  const tokenEndpoint = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
  
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  })

  const auth = Buffer.from(`${QB_CONFIG.clientId}:${QB_CONFIG.clientSecret}`).toString('base64')

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`
    },
    body: params.toString()
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const tokens = await response.json()
  
  const expiresAt = new Date()
  expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in)

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: expiresAt.toISOString()
  }
}

// Get company info from QuickBooks
export async function getCompanyInfo(accessToken: string, realmId: string) {
  const baseUrl = getQBBaseUrl()
  const url = `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get company info: ${error}`)
  }

  const data = await response.json()
  return data.CompanyInfo
}

// Create a service client for server-side operations
export function createServiceClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Check if tokens need refresh
export function isTokenExpired(expiresAt: string): boolean {
  const expiry = new Date(expiresAt)
  const now = new Date()
  // Refresh 5 minutes before expiry
  return expiry.getTime() - now.getTime() < 5 * 60 * 1000
}