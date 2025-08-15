'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

export interface User {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'manager' | 'worker' | 'viewer'
  warehouse_id?: string
  avatar_url?: string
}

export function useAuth() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error(error.message)
        return { error }
      }

      toast.success('Welcome back!')
      
      // Force a hard redirect
      window.location.href = '/dashboard'
      
      return { error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      toast.error('An unexpected error occurred')
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()

      if (error) {
        toast.error(error.message)
        return { error }
      }

      toast.success('Signed out successfully')
      router.push('/login')
      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('An unexpected error occurred')
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })

      if (error) {
        toast.error(error.message)
        return { error }
      }

      toast.success('Check your email for the reset link')
      return { error: null }
    } catch (error) {
      console.error('Password reset error:', error)
      toast.error('An unexpected error occurred')
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const updatePassword = async (password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        toast.error(error.message)
        return { error }
      }

      toast.success('Password updated successfully')
      router.push('/dashboard')
      return { error: null }
    } catch (error) {
      console.error('Password update error:', error)
      toast.error('An unexpected error occurred')
      return { error }
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  }
}