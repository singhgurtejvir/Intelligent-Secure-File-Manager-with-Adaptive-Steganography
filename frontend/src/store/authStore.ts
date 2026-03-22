import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  userId: string | null
  email: string | null
  recoveryKey: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  setToken: (token: string, userId: string, email: string) => void
  setRecoveryKey: (key: string) => void
  logout: () => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      email: null,
      recoveryKey: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setToken: (token, userId, email) =>
        set({
          token,
          userId,
          email,
          isAuthenticated: true,
          error: null,
        }),

      setRecoveryKey: (key) =>
        set({
          recoveryKey: key,
        }),

      logout: () =>
        set({
          token: null,
          userId: null,
          email: null,
          recoveryKey: null,
          isAuthenticated: false,
        }),

      setError: (error) =>
        set({
          error,
        }),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),
    }),
    {
      name: 'auth-storage',
    },
  ),
)
