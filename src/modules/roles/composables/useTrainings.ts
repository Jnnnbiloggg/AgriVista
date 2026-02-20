// src/modules/roles/composables/useTrainings.ts

import { ref, computed, onUnmounted } from 'vue'

import { useAuthStore } from '@/stores/auth'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../../../utils/supabase'

export interface Training {
  id: number
  name: string
  description: string | null
  location: string
  start_date_time: string
  end_date_time: string
  topics: string[]
  capacity: number
  image_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at?: string | null
  confirmed_count?: number
  user_registration_status?: 'pending' | 'confirmed' | 'cancelled' | null
}

export interface TrainingRegistration {
  id: number
  training_id: number
  training_name: string
  user_id: string
  user_name: string
  user_email: string
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface PaginationOptions {
  page: number
  itemsPerPage: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

function useTrainings() {
  const authStore = useAuthStore()

  // State
  const trainings = ref<Training[]>([])
  const registrations = ref<TrainingRegistration[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Pagination state
  const trainingsTotal = ref(0)
  const registrationsTotal = ref(0)

  const trainingsPage = ref(1)
  const registrationsPage = ref(1)

  const itemsPerPage = ref(10)
  const trainingsSearchQuery = ref('')
  const registrationsSearchQuery = ref('')

  const showArchivedTrainings = ref(false)

  let trainingsChannel: RealtimeChannel | null = null
  let registrationsChannel: RealtimeChannel | null = null

  // Computed pagination info
  const trainingsTotalPages = computed(() => Math.ceil(trainingsTotal.value / itemsPerPage.value))
  const registrationsTotalPages = computed(() =>
    Math.ceil(registrationsTotal.value / itemsPerPage.value),
  )

  // ============================================
  // TRAININGS
  // ============================================

  const fetchTrainings = async (options?: Partial<PaginationOptions> & { append?: boolean }) => {
    loading.value = true
    error.value = null

    try {
      const page = options?.page || trainingsPage.value
      const limit = options?.itemsPerPage || itemsPerPage.value
      const sortBy = options?.sortBy || 'start_date_time'
      const sortOrder = options?.sortOrder || 'desc'

      const from = (page - 1) * limit
      const to = from + limit - 1

      let query = supabase.from('trainings').select('*', { count: 'exact' })

      // Handle visibility and archiving based on role
      const now = new Date().toISOString()

      if (authStore.isAdmin) {
        if (showArchivedTrainings.value) {
          query = query.lte('archived_at', now)
        } else {
          query = query.or(`archived_at.gt.${now},archived_at.is.null`)
        }
      } else {
        // For regular users, only show unarchived items
        query = query.or(`archived_at.gt.${now},archived_at.is.null`)
      }

      // Apply search filter if exists
      if (trainingsSearchQuery.value) {
        query = query.or(
          `name.ilike.%${trainingsSearchQuery.value}%,description.ilike.%${trainingsSearchQuery.value}%`,
        )
      }

      // Apply sorting and pagination
      query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to)

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      // Fetch confirmed registration counts and user's registration status for each training
      const trainingsWithInfo = await Promise.all(
        (data || []).map(async (training) => {
          // Get confirmed registrations count
          const { count: confirmedCount } = await supabase
            .from('training_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('training_id', training.id)
            .eq('status', 'confirmed')

          // Get user's registration status if user is logged in and not admin
          let userRegistrationStatus = null
          if (!authStore.isAdmin && authStore.userId) {
            const { data: userReg } = await supabase
              .from('training_registrations')
              .select('status')
              .eq('training_id', training.id)
              .eq('user_id', authStore.userId)
              .maybeSingle()

            userRegistrationStatus = userReg?.status || null
          }

          return {
            ...training,
            confirmed_count: confirmedCount || 0,
            user_registration_status: userRegistrationStatus,
          }
        }),
      )

      // Append or replace data based on options
      if (options?.append) {
        trainings.value = [...trainings.value, ...trainingsWithInfo]
      } else {
        trainings.value = trainingsWithInfo
      }
      trainingsTotal.value = count || 0
      trainingsPage.value = page

      return { success: true, data: trainings.value }
    } catch (err: any) {
      error.value = err.message
      console.error('Error fetching trainings:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  const loadMoreTrainings = async () => {
    if (trainingsPage.value < trainingsTotalPages.value) {
      trainingsPage.value += 1
      await fetchTrainings({ append: true })
    }
  }

  const searchTrainings = async (query: string) => {
    trainingsSearchQuery.value = query
    trainingsPage.value = 1
    await fetchTrainings()
  }

  const clearTrainingsSearch = async () => {
    trainingsSearchQuery.value = ''
    await fetchTrainings()
  }

  const createTraining = async (
    training: Omit<Training, 'id' | 'created_at' | 'updated_at' | 'created_by'>,
    imageFile: File | null = null,
  ) => {
    loading.value = true
    error.value = null

    try {
      let imageUrl = training.image_url

      // Upload image if provided
      if (imageFile) {
        imageUrl = await uploadImage(imageFile)
      }

      const { data, error: insertError } = await supabase
        .from('trainings')
        .insert([
          {
            ...training,
            image_url: imageUrl,
            created_by: authStore.userId,
          },
        ])
        .select()
        .single()

      if (insertError) throw insertError

      await fetchTrainings()
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      console.error('Error creating training:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  const updateTraining = async (
    id: number,
    updates: Partial<Omit<Training, 'id' | 'created_at' | 'updated_at' | 'created_by'>>,
    imageFile: File | null = null,
  ) => {
    loading.value = true
    error.value = null

    try {
      let imageUrl = updates.image_url

      // Upload new image if provided
      if (imageFile) {
        // Delete old image if exists
        const training = trainings.value.find((t) => t.id === id)
        if (training?.image_url) {
          await deleteImage(training.image_url)
        }

        imageUrl = await uploadImage(imageFile)
      }

      const { data, error: updateError } = await supabase
        .from('trainings')
        .update({
          ...updates,
          image_url: imageUrl,
        })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      await fetchTrainings()
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      console.error('Error updating training:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  const deleteTraining = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      // Get training to delete its image
      const training = trainings.value.find((t) => t.id === id)
      if (training?.image_url) {
        await deleteImage(training.image_url)
      }

      const { error: deleteError } = await supabase.from('trainings').delete().eq('id', id)

      if (deleteError) throw deleteError

      await fetchTrainings()
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error deleting training:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // TRAINING REGISTRATIONS
  // ============================================

  const fetchRegistrations = async (options?: Partial<PaginationOptions>) => {
    loading.value = true
    error.value = null

    try {
      const page = options?.page || registrationsPage.value
      const limit = options?.itemsPerPage || itemsPerPage.value
      const sortBy = options?.sortBy || 'created_at'
      const sortOrder = options?.sortOrder || 'desc'

      const from = (page - 1) * limit
      const to = from + limit - 1

      let query = supabase.from('training_registrations').select('*', { count: 'exact' })

      // If user is not admin, only show their registrations
      if (!authStore.isAdmin) {
        query = query.eq('user_id', authStore.userId)
      }

      // Apply search filter if exists
      if (registrationsSearchQuery.value) {
        query = query.or(
          `training_name.ilike.%${registrationsSearchQuery.value}%,user_name.ilike.%${registrationsSearchQuery.value}%`,
        )
      }

      // Apply sorting and pagination
      query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to)

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      registrations.value = data || []
      registrationsTotal.value = count || 0
      registrationsPage.value = page

      return { success: true, data: registrations.value }
    } catch (err: any) {
      error.value = err.message
      console.error('Error fetching registrations:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  const searchRegistrations = async (query: string) => {
    registrationsSearchQuery.value = query
    registrationsPage.value = 1
    await fetchRegistrations()
  }

  const clearRegistrationsSearch = async () => {
    registrationsSearchQuery.value = ''
    await fetchRegistrations()
  }

  const createRegistration = async (
    registration: Omit<
      TrainingRegistration,
      'id' | 'created_at' | 'updated_at' | 'user_id' | 'user_name' | 'user_email'
    >,
  ) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: insertError } = await supabase
        .from('training_registrations')
        .insert([
          {
            ...registration,
            user_id: authStore.userId,
            user_name: authStore.fullName,
            user_email: authStore.userEmail,
          },
        ])
        .select()
        .single()

      if (insertError) throw insertError

      await fetchRegistrations()
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      console.error('Error creating registration:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  const updateRegistration = async (
    id: number,
    updates: Partial<Omit<TrainingRegistration, 'id' | 'created_at' | 'updated_at' | 'user_id'>>,
  ) => {
    loading.value = true
    error.value = null

    try {
      // If confirming a registration, check if training is still in progress and has capacity
      if (updates.status === 'confirmed') {
        // Get the registration details
        const { data: regData, error: regError } = await supabase
          .from('training_registrations')
          .select('training_id')
          .eq('id', id)
          .single()

        if (regError) throw regError

        // Get the training details
        const { data: trainingData, error: trainingError } = await supabase
          .from('trainings')
          .select('capacity, end_date_time')
          .eq('id', regData.training_id)
          .single()

        if (trainingError) throw trainingError

        // Check if training is still in progress
        const isInProgress = new Date(trainingData.end_date_time) >= new Date()

        if (isInProgress) {
          // Check current confirmed count
          const { count: confirmedCount } = await supabase
            .from('training_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('training_id', regData.training_id)
            .eq('status', 'confirmed')

          // Check if there's available capacity
          if ((confirmedCount || 0) >= trainingData.capacity) {
            throw new Error('Training is at full capacity')
          }
        }
      }

      const { data, error: updateError } = await supabase
        .from('training_registrations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      await fetchRegistrations()
      await fetchTrainings() // Refresh trainings to show updated confirmed count
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      console.error('Error updating registration:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  const deleteRegistration = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      const { error: deleteError } = await supabase
        .from('training_registrations')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      await fetchRegistrations()
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error deleting registration:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // IMAGE MANAGEMENT
  // ============================================

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage.from('trainings').upload(filePath, file)

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('trainings').getPublicUrl(filePath)

      return publicUrl
    } catch (err: any) {
      console.error('Error uploading image:', err)
      return null
    }
  }

  const deleteImage = async (imageUrl: string): Promise<boolean> => {
    try {
      const urlParts = imageUrl.split('/trainings/')
      if (urlParts.length < 2) return false

      const filePath = urlParts[1]

      const { error: deleteError } = await supabase.storage.from('trainings').remove([filePath])

      if (deleteError) throw deleteError

      return true
    } catch (err: any) {
      console.error('Error deleting image:', err)
      return false
    }
  }

  // ============================================
  // REALTIME SUBSCRIPTIONS
  // ============================================

  const setupRealtimeSubscriptions = () => {
    // Trainings subscription
    trainingsChannel = supabase
      .channel('trainings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trainings' },
        async (payload) => {
          console.log('Trainings change received!', payload)
          await fetchTrainings()
          await fetchRegistrations()
        },
      )
      .subscribe()

    // Registrations subscription
    registrationsChannel = supabase
      .channel('registrations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'training_registrations' },
        async (payload) => {
          console.log('Registrations change received!', payload)
          await fetchRegistrations()
          // Also refresh trainings to update confirmed counts and user registration status
          await fetchTrainings()
        },
      )
      .subscribe()
  }

  const unsubscribeRealtime = () => {
    if (trainingsChannel) {
      supabase.removeChannel(trainingsChannel)
      trainingsChannel = null
    }
    if (registrationsChannel) {
      supabase.removeChannel(registrationsChannel)
      registrationsChannel = null
    }
  }

  /**
   * Change page for trainings
   */
  const goToTrainingsPage = async (page: number) => {
    if (page >= 1 && page <= trainingsTotalPages.value) {
      trainingsPage.value = page
      await fetchTrainings()
    }
  }

  /**
   * Change page for registrations
   */
  const goToRegistrationsPage = async (page: number) => {
    if (page >= 1 && page <= registrationsTotalPages.value) {
      registrationsPage.value = page
      await fetchRegistrations()
    }
  }

  return {
    // State
    trainings,
    registrations,
    loading,
    error,
    trainingsTotal,
    registrationsTotal,
    trainingsPage,
    registrationsPage,
    itemsPerPage,
    trainingsTotalPages,
    registrationsTotalPages,
    showArchivedTrainings,
    // Trainings
    fetchTrainings,
    loadMoreTrainings,
    searchTrainings,
    clearTrainingsSearch,
    createTraining,
    updateTraining,
    deleteTraining,
    goToTrainingsPage,
    // Registrations
    fetchRegistrations,
    searchRegistrations,
    clearRegistrationsSearch,
    createRegistration,
    updateRegistration,
    deleteRegistration,
    goToRegistrationsPage,
    // Realtime
    setupRealtimeSubscriptions,
    unsubscribeRealtime,
  }
}

export { useTrainings }
