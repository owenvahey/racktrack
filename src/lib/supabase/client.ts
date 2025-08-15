import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookieStore = document.cookie.split('; ')
          const cookie = cookieStore.find(row => row.startsWith(`${name}=`))
          return cookie ? decodeURIComponent(cookie.split('=')[1]) : undefined
        },
        set(name: string, value: string, options?: any) {
          document.cookie = `${name}=${encodeURIComponent(value)}; path=/; ${options?.maxAge ? `max-age=${options.maxAge};` : ''}`
        },
        remove(name: string) {
          document.cookie = `${name}=; path=/; max-age=0`
        },
      },
    }
  )
}