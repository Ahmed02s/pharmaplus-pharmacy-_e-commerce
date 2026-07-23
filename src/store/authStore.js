import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      session: null,
      loading: true,

      setSession: (session) => set({ session, user: session?.user ?? null }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),

      initialize: async () => {
        set({ loading: true })
        const { data: { session } } = await supabase.auth.getSession()
        set({ session, user: session?.user ?? null })
        if (session?.user) {
          await get().fetchProfile(session.user.id)
        }
        set({ loading: false })
      },

      fetchProfile: async (userId) => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (data) set({ profile: data })
        return data
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, profile: null, session: null })
      },

      // Derived
      isAuthenticated: () => !!get().user,
      isCustomer: () => get().profile?.role === 'customer',
      isPharmacist: () => get().profile?.role === 'pharmacist',
      isAdmin: () => get().profile?.role === 'admin',
      isStaff: () => ['pharmacist', 'admin'].includes(get().profile?.role),
    }),
    {
      name: 'pharmaplus-auth',
      partialize: (state) => ({ user: state.user, profile: state.profile }),
    }
  )
)
