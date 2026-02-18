// src/stores/auth.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  email: string
  fullName: string
  userType: 'admin' | 'user'
  sex?: string | null
  address?: string | null
  contactNumber?: string | null
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const userProfile = ref<UserProfile | null>(null)
  const isLoading = ref(true)

  // Getters
  const isAuthenticated = computed(() => !!session.value && !!user.value)
  const isAdmin = computed(() => userProfile.value?.userType === 'admin')
  const isUser = computed(() => userProfile.value?.userType === 'user')
  const userEmail = computed(() => user.value?.email || '')
  const userId = computed(() => user.value?.id || '')
  const fullName = computed(() => userProfile.value?.fullName || 'User')
  const isProfileComplete = computed(() => {
    if (!userProfile.value || userProfile.value.userType !== 'user') return true
    return !!(userProfile.value.sex && userProfile.value.address && userProfile.value.contactNumber)
  })

  // Actions
  function setUser(newUser: User | null) {
    user.value = newUser
  }

  function setSession(newSession: Session | null) {
    session.value = newSession
  }

  function setUserProfile(profile: UserProfile | null) {
    userProfile.value = profile
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function determineUserType(email: string): 'admin' | 'user' {
    const adminEmails =
      import.meta.env.VITE_ADMIN_EMAILS?.split(',').map((e: string) => e.trim().toLowerCase()) || []
    return adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user'
  }

  function clearAuth() {
    user.value = null
    session.value = null
    userProfile.value = null
  }

  return {
    // State
    user,
    session,
    userProfile,
    isLoading,
    // Getters
    isAuthenticated,
    isAdmin,
    isUser,
    userEmail,
    userId,
    fullName,
    isProfileComplete,
    // Actions
    setUser,
    setSession,
    setUserProfile,
    setLoading,
    determineUserType,
    clearAuth,
  }
})
