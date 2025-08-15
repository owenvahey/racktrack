'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function TestAuthPage() {
  const [user, setUser] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Auth Debug Page</h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-100 rounded">
          <h2 className="font-semibold mb-2">Auth Status</h2>
          <p>Logged in: {user ? 'Yes' : 'No'}</p>
          {user && (
            <>
              <p>Email: {user.email}</p>
              <p>ID: {user.id}</p>
            </>
          )}
        </div>

        <div className="p-4 bg-gray-100 rounded">
          <h2 className="font-semibold mb-2">Session</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        <div className="p-4 bg-gray-100 rounded">
          <h2 className="font-semibold mb-2">Cookies</h2>
          <pre className="text-xs overflow-auto">
            {typeof document !== 'undefined' ? document.cookie : 'N/A'}
          </pre>
        </div>

        <div className="flex gap-4">
          {user ? (
            <>
              <Button onClick={handleSignOut}>Sign Out</Button>
              <Link href="/dashboard">
                <Button variant="outline">Go to Dashboard</Button>
              </Link>
            </>
          ) : (
            <Link href="/login">
              <Button>Go to Login</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}