// src/composables/useAuth.ts

import { ref } from 'vue'
import { supabase } from '../../utils/supabase'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import type { AuthError, AuthChangeEvent, Session } from '@supabase/supabase-js'

export function useAuth() {
  const authStore = useAuthStore()
  const router = useRouter()
  const error = ref<string | null>(null)
  const loading = ref(false)

  /**
   * Initialize auth state by checking for existing session
   */
  async function initializeAuth() {
    authStore.setLoading(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (session) {
        authStore.setSession(session)
        authStore.setUser(session.user)

        // Determine user type based on email
        const userType = authStore.determineUserType(session.user.email || '')
        authStore.setUserProfile({
          id: session.user.id,
          email: session.user.email || '',
          fullName:
            session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          userType,
        })
      }
    } catch (err) {
      console.error('Error initializing auth:', err)
      authStore.clearAuth()
    } finally {
      authStore.setLoading(false)
    }
  }

  /**
   * Sign in with email and password
   */
  async function signIn(email: string, password: string, selectedRole?: 'admin' | 'user') {
    loading.value = true
    error.value = null

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      if (data.session && data.user) {
        // Determine user type based on email
        const actualUserType = authStore.determineUserType(data.user.email || '')

        // Validate if selected role matches actual user type
        if (selectedRole && selectedRole !== actualUserType) {
          error.value =
            actualUserType === 'admin'
              ? 'This email is registered as an admin. Please use the admin login.'
              : 'This email is not registered as an admin. Please use the user login.'

          // Sign out to prevent session creation
          await supabase.auth.signOut()
          authStore.clearAuth()

          return { success: false, error: error.value }
        }

        authStore.setSession(data.session)
        authStore.setUser(data.user)
        authStore.setUserProfile({
          id: data.user.id,
          email: data.user.email || '',
          fullName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
          userType: actualUserType,
        })

        // Redirect based on user type
        if (actualUserType === 'admin') {
          await router.push('/admin/dashboard')
        } else {
          await router.push('/user/dashboard')
        }

        return { success: true }
      }
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || 'An error occurred during sign in'
      console.error('Sign in error:', authError)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign up a new user (only for regular users, not admins)
   */
  async function signUp(email: string, password: string, fullName: string) {
    loading.value = true
    error.value = null

    try {
      // Check if trying to register as admin
      const userType = authStore.determineUserType(email)
      if (userType === 'admin') {
        error.value =
          'Admin accounts cannot be created through registration. Please contact an administrator.'
        return { success: false, error: error.value }
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (signUpError) throw signUpError

      if (data.user) {
        // Check if email confirmation is required
        if (data.session) {
          // Auto-confirmed, set up auth state
          authStore.setSession(data.session)
          authStore.setUser(data.user)
          authStore.setUserProfile({
            id: data.user.id,
            email: data.user.email || '',
            fullName: fullName,
            userType: 'user',
          })

          // Redirect to user dashboard
          await router.push('/user/dashboard')
          return { success: true, requiresConfirmation: false }
        } else {
          // Email confirmation required
          return {
            success: true,
            requiresConfirmation: true,
            message: 'Please check your email to confirm your account before signing in.',
          }
        }
      }
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || 'An error occurred during sign up'
      console.error('Sign up error:', authError)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign in with Google OAuth (Only for regular users, not admins)
   * Admins must use email/password authentication for security
   */
  async function signInWithGoogle() {
    loading.value = true
    error.value = null

    try {
      // Google OAuth is only available for regular users
      const redirectUrl = `${window.location.origin}/auth/callback?role=user`

      const { data, error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (googleError) throw googleError

      // The user will be redirected to Google for authentication
      return { success: true, url: data.url }
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || 'An error occurred during Google sign in'
      console.error('Google sign in error:', authError)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Handle OAuth callback - processes the session after OAuth redirect
   * This is only used for regular users (admins must use email/password)
   */
  async function handleOAuthCallback() {
    loading.value = true
    error.value = null

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      if (session) {
        authStore.setSession(session)
        authStore.setUser(session.user)

        const userEmail = session.user.email || ''
        const actualUserType = authStore.determineUserType(userEmail)

        authStore.setUserProfile({
          id: session.user.id,
          email: userEmail,
          fullName:
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            userEmail.split('@')[0] ||
            'User',
          userType: actualUserType,
        })

        // Redirect to user dashboard (Google OAuth is only for regular users)
        await router.push('/user/dashboard')

        return { success: true }
      }

      return { success: false, error: 'No session found' }
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || 'An error occurred during authentication'
      console.error('OAuth callback error:', authError)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign out the current user
   */
  async function signOut() {
    loading.value = true
    error.value = null

    try {
      const { error: signOutError } = await supabase.auth.signOut()

      if (signOutError) throw signOutError

      authStore.clearAuth()
      await router.push('/')
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || 'An error occurred during sign out'
      console.error('Sign out error:', authError)
    } finally {
      loading.value = false
    }
  }

  /**
   * Set up auth state change listener
   */
  function setupAuthListener() {
    supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        authStore.setSession(session)
        authStore.setUser(session.user)

        const userType = authStore.determineUserType(session.user.email || '')
        authStore.setUserProfile({
          id: session.user.id,
          email: session.user.email || '',
          fullName:
            session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          userType,
        })
      } else if (event === 'SIGNED_OUT') {
        authStore.clearAuth()
      } else if (event === 'TOKEN_REFRESHED' && session) {
        authStore.setSession(session)
      }
    })
  }

  /**
   * Check if user has access to admin routes
   */
  function canAccessAdmin(): boolean {
    return authStore.isAdmin
  }

  /**
   * Check if user has access to user routes
   */
  function canAccessUser(): boolean {
    return authStore.isAuthenticated
  }

  /**
   * Get the current user's role
   */
  function getUserRole(): 'admin' | 'user' | null {
    if (!authStore.isAuthenticated) return null
    return authStore.userProfile?.userType || null
  }

  /**
   * Check if current user is an admin
   */
  function isUserAdmin(): boolean {
    return authStore.isAdmin
  }

  return {
    // State
    error,
    loading,
    // Methods
    initializeAuth,
    signIn,
    signUp,
    signInWithGoogle,
    handleOAuthCallback,
    signOut,
    setupAuthListener,
    canAccessAdmin,
    canAccessUser,
    getUserRole,
    isUserAdmin,
  }
}
