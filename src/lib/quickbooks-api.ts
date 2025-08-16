import { createClient } from '@/lib/supabase/server'
import { getQBBaseUrl, isTokenExpired, refreshAccessToken } from './quickbooks'

interface QBApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  maxRetries?: number
}

export async function quickbooksApiCall(
  connectionId: string,
  endpoint: string,
  options: QBApiOptions = {}
) {
  const { method = 'GET', body, headers = {}, maxRetries = 1 } = options
  const supabase = await createClient()

  // Get connection details
  const { data: connection, error: connError } = await supabase
    .from('qb_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (connError || !connection) {
    throw new Error('QuickBooks connection not found')
  }

  let accessToken = connection.access_token
  let retries = 0

  while (retries <= maxRetries) {
    try {
      // Check if token needs refresh
      if (isTokenExpired(connection.token_expires_at)) {
        const tokenData = await refreshAccessToken(connection.refresh_token)
        if (!tokenData) {
          throw new Error('Failed to refresh access token')
        }

        // Update tokens in database
        const { error: updateError } = await supabase
          .from('qb_connections')
          .update({
            access_token: tokenData.accessToken,
            refresh_token: tokenData.refreshToken,
            token_expires_at: tokenData.expiresAt
          })
          .eq('id', connectionId)

        if (updateError) {
          throw new Error('Failed to update tokens in database')
        }

        accessToken = tokenData.accessToken
      }

      // Make API call
      const baseUrl = getQBBaseUrl()
      const url = `${baseUrl}/v3/company/${connection.realm_id}${endpoint}`
      
      const response = await fetch(url, {
        method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
      })

      // If successful, return response
      if (response.ok) {
        return response
      }

      // If 401 and we haven't retried yet, try refreshing token
      if (response.status === 401 && retries < maxRetries) {
        console.log('Got 401, attempting token refresh...')
        const tokenData = await refreshAccessToken(connection.refresh_token)
        if (tokenData) {
          // Update tokens
          await supabase
            .from('qb_connections')
            .update({
              access_token: tokenData.accessToken,
              refresh_token: tokenData.refreshToken,
              token_expires_at: tokenData.expiresAt
            })
            .eq('id', connectionId)

          accessToken = tokenData.accessToken
          retries++
          continue
        }
      }

      // If not 401 or retry failed, throw error
      const errorText = await response.text()
      throw new Error(`QuickBooks API error: ${response.status} ${errorText}`)

    } catch (error) {
      if (retries >= maxRetries) {
        throw error
      }
      retries++
    }
  }

  throw new Error('Max retries exceeded')
}

// Helper to get connection by company
export async function getConnectionByCompany() {
  const supabase = await createClient()
  
  const { data: connection, error } = await supabase
    .from('qb_connections')
    .select('*')
    .eq('is_active', true)
    .single()

  if (error || !connection) {
    throw new Error('No active QuickBooks connection found')
  }

  return connection
}