import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/hooks/use-auth'

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  setUser: (user: User | null) => void
  initialize: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),

  initialize: async () => {
    if (get().initialized) return

    const supabase = createClient()
    
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (profile) {
          set({
            user: {
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name,
              role: profile.role,
              warehouse_id: profile.warehouse_id,
              avatar_url: profile.avatar_url,
            },
            loading: false,
            initialized: true,
          })
        } else {
          set({ user: null, loading: false, initialized: true })
        }
      } else {
        set({ user: null, loading: false, initialized: true })
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error)
      set({ user: null, loading: false, initialized: true })
    }
  },

  signOut: async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    set({ user: null })
  },
}))