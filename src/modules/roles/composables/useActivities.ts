// src/modules/roles/composables/useActivities.ts

import { ref, computed, onUnmounted } from 'vue'

import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '../../../../utils/supabase'

export interface Activity {
  id: number
  name: string
  description: string
  image_url: string | null
  type: string
  capacity: number
  location: string
  duration?: string | null
  date: string
  time: string
  end_date?: string | null
  end_time?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  manually_archived?: boolean
  booked_count?: number
  confirmed_count?: number
  user_booking_status?: 'pending' | 'confirmed' | 'cancelled' | null
  user_party_size?: number
}

export interface Booking {
  id: number
  activity_id: number
  activity_name: string
  user_id: string
  user_name: string
  user_email: string
  booking_date: string
  party_size: number
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
  updated_at: string
  activities?: { date: string; time: string } | null
}

export interface Appointment {
  id: number
  user_id: string
  full_name: string
  email: string
  contact_number: string
  appointment_type: string
  date: string
  time_slot: 'AM' | 'PM'
  party_size: number
  note: string | null
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
  updated_at: string
  archived_at: string | null
  manually_archived?: boolean
}

export interface AppointmentSlot {
  id: number
  date: string // YYYY-MM-DD
  time_slot: 'AM' | 'PM'
  available_slots: number
  created_at: string
}

export interface PaginationOptions {
  page: number
  itemsPerPage: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export const useActivities = () => {
  const authStore = useAuthStore()

  // State
  const activities = ref<Activity[]>([])
  const bookings = ref<Booking[]>([])
  const appointments = ref<Appointment[]>([])
  const appointmentSlots = ref<AppointmentSlot[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Pagination state
  const activitiesTotal = ref(0)
  const bookingsTotal = ref(0)
  const appointmentsTotal = ref(0)

  const activitiesPage = ref(1)
  const bookingsPage = ref(1)
  const appointmentsPage = ref(1)

  const itemsPerPage = ref(10)
  const activitiesSearchQuery = ref('')
  const bookingsSearchQuery = ref('')
  const appointmentsSearchQuery = ref('')

  const showArchivedActivities = ref(false)
  const showArchivedAppointments = ref(false)

  let activitiesChannel: RealtimeChannel | null = null
  let bookingsChannel: RealtimeChannel | null = null
  let appointmentsChannel: RealtimeChannel | null = null
  let appointmentSlotsChannel: RealtimeChannel | null = null

  // Computed pagination info
  const activitiesTotalPages = computed(() => Math.ceil(activitiesTotal.value / itemsPerPage.value))
  const bookingsTotalPages = computed(() => Math.ceil(bookingsTotal.value / itemsPerPage.value))
  const appointmentsTotalPages = computed(() =>
    Math.ceil(appointmentsTotal.value / itemsPerPage.value),
  )

  // ============================================
  // ACTIVITIES
  // ============================================

  const fetchActivities = async (options?: Partial<PaginationOptions> & { append?: boolean }) => {
    loading.value = true
    error.value = null

    if (options?.page) activitiesPage.value = options.page
    if (options?.itemsPerPage) itemsPerPage.value = options.itemsPerPage

    try {
      const from = (activitiesPage.value - 1) * itemsPerPage.value
      const to = from + itemsPerPage.value - 1

      let query = supabase
        .from('activities')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      const now = new Date().toISOString()
      if (authStore.isAdmin) {
        if (showArchivedActivities.value) {
          // Show items that are archived: auto-archived (archived_at <= now) OR manually archived
          query = query.or(`archived_at.lte.${now},manually_archived.eq.true`)
        } else {
          // Show items that are NOT archived: auto-archive time hasn't passed AND not manually archived
          query = query
            .or(`archived_at.gt.${now},archived_at.is.null`)
            .eq('manually_archived', false)
        }
      } else {
        // Users should only see unarchived activities
        query = query.or(`archived_at.gt.${now},archived_at.is.null`).eq('manually_archived', false)
      }

      // Search functionality
      if (activitiesSearchQuery.value) {
        query = query.or(
          `name.ilike.%${activitiesSearchQuery.value}%,description.ilike.%${activitiesSearchQuery.value}%,type.ilike.%${activitiesSearchQuery.value}%`,
        )
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      // Fetch booked count (sum of party_size for non-cancelled) and user's booking status
      const activitiesWithBookingInfo = await Promise.all(
        (data || []).map(async (activity) => {
          // Get total booked count (pending + confirmed) by summing party_size
          const { data: activeBookings } = await supabase
            .from('bookings')
            .select('party_size')
            .eq('activity_id', activity.id)
            .in('status', ['pending', 'confirmed'])

          const bookedCount = activeBookings?.reduce((sum, b) => sum + (b.party_size || 1), 0) || 0

          // Get confirmed count only
          const { data: confirmedBookings } = await supabase
            .from('bookings')
            .select('party_size')
            .eq('activity_id', activity.id)
            .eq('status', 'confirmed')

          const confirmedCount =
            confirmedBookings?.reduce((sum, b) => sum + (b.party_size || 1), 0) || 0

          // Get user's booking status if not admin
          let userBookingStatus = null
          let userPartySize = 0
          if (!authStore.isAdmin) {
            const { data: userBooking } = await supabase
              .from('bookings')
              .select('status, party_size')
              .eq('activity_id', activity.id)
              .eq('user_id', authStore.userId)
              .maybeSingle()

            userBookingStatus = userBooking?.status || null
            userPartySize = userBooking?.party_size || 0
          }

          return {
            ...activity,
            booked_count: bookedCount,
            confirmed_count: confirmedCount,
            user_booking_status: userBookingStatus,
            user_party_size: userPartySize,
          }
        }),
      )

      // Append or replace data based on options
      if (options?.append) {
        activities.value = [...activities.value, ...activitiesWithBookingInfo]
      } else {
        activities.value = activitiesWithBookingInfo
      }
      activitiesTotal.value = count || 0
    } catch (err: any) {
      error.value = err.message
      console.error('Error fetching activities:', err)
    } finally {
      loading.value = false
    }
  }

  const loadMoreActivities = async () => {
    if (activitiesPage.value < activitiesTotalPages.value) {
      activitiesPage.value += 1
      await fetchActivities({ append: true })
    }
  }

  const searchActivities = async (query: string) => {
    activitiesSearchQuery.value = query
    activitiesPage.value = 1
    await fetchActivities()
  }

  const clearActivitiesSearch = async () => {
    activitiesSearchQuery.value = ''
    activitiesPage.value = 1
    await fetchActivities()
  }

  const createActivity = async (
    activity: Omit<Activity, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'archived_at'>,
    imageFile: File | null = null,
  ) => {
    loading.value = true
    error.value = null

    try {
      let imageUrl = activity.image_url

      if (imageFile) {
        imageUrl = await uploadImage(imageFile)
      }

      // Sanitize optional fields: convert empty strings to null
      // Also exclude computed properties that aren't in the database
      const { confirmed_count, user_booking_status, booked_count, user_party_size, ...dbActivity } =
        activity as any

      const sanitizedActivity = {
        ...dbActivity,
        image_url: imageUrl,
        created_by: authStore.userId,
        end_date: activity.end_date || null,
        end_time: activity.end_time || null,
      }

      const { data, error: createError } = await supabase
        .from('activities')
        .insert([sanitizedActivity])
        .select()
        .single()

      if (createError) throw createError

      await fetchActivities()
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      console.error('Error creating activity:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const updateActivity = async (
    id: number,
    updates: Partial<
      Omit<Activity, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'archived_at'>
    >,
    imageFile: File | null = null,
  ) => {
    loading.value = true
    error.value = null

    try {
      let imageUrl = updates.image_url

      if (imageFile) {
        // Delete old image if exists
        if (updates.image_url) {
          await deleteImage(updates.image_url)
        }
        imageUrl = await uploadImage(imageFile)
      }

      // Sanitize optional fields: convert empty strings to null
      // Also exclude computed properties that aren't in the database
      const { confirmed_count, user_booking_status, booked_count, user_party_size, ...dbUpdates } =
        updates as any

      const sanitizedUpdates = {
        ...dbUpdates,
        image_url: imageUrl,
        end_date: updates.end_date || null,
        end_time: updates.end_time || null,
      }

      const { data, error: updateError } = await supabase
        .from('activities')
        .update(sanitizedUpdates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      await fetchActivities()
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      console.error('Error updating activity:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const deleteActivity = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      // Get activity to delete image
      const { data: activity } = await supabase
        .from('activities')
        .select('image_url')
        .eq('id', id)
        .single()

      // Delete image if exists
      if (activity?.image_url) {
        await deleteImage(activity.image_url)
      }

      const { error: deleteError } = await supabase.from('activities').delete().eq('id', id)

      if (deleteError) throw deleteError

      await fetchActivities()
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error deleting activity:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Manually archive an activity (admin only).
   * Sets manually_archived = true so it is hidden from users immediately.
   */
  const manuallyArchiveActivity = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      const { error: updateError } = await supabase
        .from('activities')
        .update({ manually_archived: true })
        .eq('id', id)

      if (updateError) throw updateError

      await fetchActivities()
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error manually archiving activity:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Unarchive a manually-archived activity (admin only).
   * Only allowed if the auto-archive time (archived_at) hasn't been reached yet.
   */
  const unarchiveActivity = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      // Fetch the latest archived_at to check if auto-archive has already fired
      const { data: activityData, error: fetchError } = await supabase
        .from('activities')
        .select('archived_at, manually_archived')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const now = new Date()
      const autoArchiveTime = activityData?.archived_at ? new Date(activityData.archived_at) : null

      if (autoArchiveTime && autoArchiveTime <= now) {
        return {
          success: false,
          error: 'Cannot unarchive: the auto-archive time has already passed.',
        }
      }

      const { error: updateError } = await supabase
        .from('activities')
        .update({ manually_archived: false })
        .eq('id', id)

      if (updateError) throw updateError

      await fetchActivities()
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error unarchiving activity:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // BOOKINGS
  // ============================================

  const fetchBookings = async (options?: Partial<PaginationOptions>) => {
    loading.value = true
    error.value = null

    if (options?.page) bookingsPage.value = options.page
    if (options?.itemsPerPage) itemsPerPage.value = options.itemsPerPage

    try {
      const from = (bookingsPage.value - 1) * itemsPerPage.value
      const to = from + itemsPerPage.value - 1

      let query = supabase
        .from('bookings')
        .select('*, activities(date, time)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      // If user is not admin, only show their bookings
      if (!authStore.isAdmin) {
        query = query.eq('user_id', authStore.userId)
      }

      // Search functionality
      if (bookingsSearchQuery.value) {
        query = query.or(
          `activity_name.ilike.%${bookingsSearchQuery.value}%,user_name.ilike.%${bookingsSearchQuery.value}%,user_email.ilike.%${bookingsSearchQuery.value}%`,
        )
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      bookings.value = data || []
      bookingsTotal.value = count || 0
    } catch (err: any) {
      error.value = err.message
      console.error('Error fetching bookings:', err)
    } finally {
      loading.value = false
    }
  }

  const searchBookings = async (query: string) => {
    bookingsSearchQuery.value = query
    bookingsPage.value = 1
    await fetchBookings()
  }

  const clearBookingsSearch = async () => {
    bookingsSearchQuery.value = ''
    bookingsPage.value = 1
    await fetchBookings()
  }

  const createBooking = async (
    booking: Omit<
      Booking,
      'id' | 'created_at' | 'updated_at' | 'user_id' | 'user_name' | 'user_email'
    >,
  ) => {
    loading.value = true
    error.value = null

    try {
      const partySize = booking.party_size || 1

      // Check current capacity before creating booking
      const { data: activeBookings } = await supabase
        .from('bookings')
        .select('party_size')
        .eq('activity_id', booking.activity_id)
        .in('status', ['pending', 'confirmed'])

      const currentBooked = activeBookings?.reduce((sum, b) => sum + (b.party_size || 1), 0) || 0

      // Get activity capacity
      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('capacity')
        .eq('id', booking.activity_id)
        .single()

      if (activityError) throw activityError

      if (currentBooked + partySize > activityData.capacity) {
        throw new Error(
          `Not enough capacity. Only ${Math.max(0, activityData.capacity - currentBooked)} spot(s) remaining.`,
        )
      }

      const { data, error: createError } = await supabase
        .from('bookings')
        .insert([
          {
            ...booking,
            party_size: partySize,
            user_id: authStore.userId,
            user_name: authStore.fullName,
            user_email: authStore.userEmail,
          },
        ])
        .select()
        .single()

      if (createError) throw createError

      await fetchBookings()
      await fetchActivities() // Refresh activities to show updated capacity
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      console.error('Error creating booking:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const updateBooking = async (id: number, updates: Partial<Booking>) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: updateError } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      await fetchBookings()
      await fetchActivities() // Refresh activities to update capacity counts
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      console.error('Error updating booking:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const deleteBooking = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      const { error: deleteError } = await supabase.from('bookings').delete().eq('id', id)

      if (deleteError) throw deleteError

      await fetchBookings()
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error deleting booking:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // APPOINTMENTS
  // ============================================

  const fetchAppointments = async (options?: Partial<PaginationOptions>) => {
    loading.value = true
    error.value = null

    if (options?.page) appointmentsPage.value = options.page
    if (options?.itemsPerPage) itemsPerPage.value = options.itemsPerPage

    try {
      const from = (appointmentsPage.value - 1) * itemsPerPage.value
      const to = from + itemsPerPage.value - 1

      let query = supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      const now = new Date().toISOString()
      if (authStore.isAdmin) {
        if (showArchivedAppointments.value) {
          // Show items that are archived: auto-archived (archived_at <= now) OR manually archived
          query = query.or(`archived_at.lte.${now},manually_archived.eq.true`)
        } else {
          // Show items that are NOT archived: auto-archive time hasn't passed AND not manually archived
          query = query
            .or(`archived_at.gt.${now},archived_at.is.null`)
            .eq('manually_archived', false)
        }
      } else {
        query = query.eq('user_id', authStore.userId)
        query = query.or(`archived_at.gt.${now},archived_at.is.null`).eq('manually_archived', false)
      }

      // Search functionality
      if (appointmentsSearchQuery.value) {
        query = query.or(
          `full_name.ilike.%${appointmentsSearchQuery.value}%,email.ilike.%${appointmentsSearchQuery.value}%,appointment_type.ilike.%${appointmentsSearchQuery.value}%`,
        )
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      appointments.value = data || []
      appointmentsTotal.value = count || 0
    } catch (err: any) {
      error.value = err.message
      console.error('Error fetching appointments:', err)
    } finally {
      loading.value = false
    }
  }

  const searchAppointments = async (query: string) => {
    appointmentsSearchQuery.value = query
    appointmentsPage.value = 1
    await fetchAppointments()
  }

  const clearAppointmentsSearch = async () => {
    appointmentsSearchQuery.value = ''
    appointmentsPage.value = 1
    await fetchAppointments()
  }

  const createAppointment = async (
    appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'archived_at'>,
  ) => {
    loading.value = true
    error.value = null

    try {
      const partySize = appointment.party_size || 1

      // Check available slots before creating appointment
      const slot = appointmentSlots.value.find(
        (s) => s.date === appointment.date && s.time_slot === appointment.time_slot,
      )

      if (!slot || slot.available_slots < partySize) {
        throw new Error(
          `Not enough slots available. Only ${slot?.available_slots || 0} slot(s) remaining.`,
        )
      }

      const { data, error: createError } = await supabase
        .from('appointments')
        .insert([
          {
            ...appointment,
            party_size: partySize,
            user_id: authStore.userId,
          },
        ])
        .select()
        .single()

      if (createError) throw createError

      await fetchAppointments()
      await fetchAppointmentSlots() // Refresh slots to show updated availability
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      console.error('Error creating appointment:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const updateAppointment = async (id: number, updates: Partial<Appointment>) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: updateError } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      await fetchAppointments()
      await fetchAppointmentSlots() // Refresh slots to show updated availability
      return { success: true, data }
    } catch (err: any) {
      error.value = err.message
      console.error('Error updating appointment:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const deleteAppointment = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      const { error: deleteError } = await supabase.from('appointments').delete().eq('id', id)

      if (deleteError) throw deleteError

      await fetchAppointments()
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error deleting appointment:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Manually archive an appointment (admin only).
   * Sets manually_archived = true so it is hidden from users immediately.
   */
  const manuallyArchiveAppointment = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ manually_archived: true })
        .eq('id', id)

      if (updateError) throw updateError

      await fetchAppointments()
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error manually archiving appointment:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Unarchive a manually-archived appointment (admin only).
   * Only allowed if the auto-archive time (archived_at) hasn't been reached yet.
   */
  const unarchiveAppointment = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      // Fetch the latest archived_at to check if auto-archive has already fired
      const { data: appointmentData, error: fetchError } = await supabase
        .from('appointments')
        .select('archived_at, manually_archived')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const now = new Date()
      const autoArchiveTime = appointmentData?.archived_at
        ? new Date(appointmentData.archived_at)
        : null

      if (autoArchiveTime && autoArchiveTime <= now) {
        return {
          success: false,
          error: 'Cannot unarchive: the auto-archive time has already passed.',
        }
      }

      const { error: updateError } = await supabase
        .from('appointments')
        .update({ manually_archived: false })
        .eq('id', id)

      if (updateError) throw updateError

      await fetchAppointments()
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error unarchiving appointment:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // APPOINTMENT SLOTS
  // ============================================

  const fetchAppointmentSlots = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('appointment_slots')
        .select('*')
        .order('date', { ascending: true })
        .order('time_slot', { ascending: true })

      if (fetchError) throw fetchError
      appointmentSlots.value = data || []
    } catch (err: any) {
      console.error('Error fetching appointment slots:', err)
    }
  }

  const createAppointmentSlot = async (slot: Omit<AppointmentSlot, 'id' | 'created_at'>) => {
    try {
      const { data, error: createError } = await supabase
        .from('appointment_slots')
        .insert([slot])
        .select()
        .single()

      if (createError) throw createError
      await fetchAppointmentSlots()
      return { success: true, data }
    } catch (err: any) {
      console.error('Error creating appointment slot:', err)
      return { success: false, error: err.message }
    }
  }

  const updateAppointmentSlot = async (
    id: number,
    updates: Partial<Omit<AppointmentSlot, 'id' | 'created_at'>>,
  ) => {
    try {
      const { data, error: updateError } = await supabase
        .from('appointment_slots')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      await fetchAppointmentSlots()
      return { success: true, data }
    } catch (err: any) {
      console.error('Error updating appointment slot:', err)
      return { success: false, error: err.message }
    }
  }

  const deleteAppointmentSlot = async (id: number) => {
    try {
      const { error: deleteError } = await supabase.from('appointment_slots').delete().eq('id', id)

      if (deleteError) throw deleteError
      await fetchAppointmentSlots()
      return { success: true }
    } catch (err: any) {
      console.error('Error deleting appointment slot:', err)
      return { success: false, error: err.message }
    }
  }

  // ============================================
  // IMAGE HANDLING
  // ============================================

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('activities')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('activities').getPublicUrl(filePath)

      return publicUrl
    } catch (err: any) {
      console.error('Error uploading image:', err)
      return null
    }
  }

  const deleteImage = async (imageUrl: string): Promise<boolean> => {
    try {
      const path = imageUrl.split('/activities/').pop()
      if (!path) return false

      const { error: deleteError } = await supabase.storage.from('activities').remove([path])

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
    // Activities subscription
    activitiesChannel = supabase
      .channel('activities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activities',
        },
        async (payload) => {
          // console.log('Activities change received:', payload)
          await fetchActivities()
        },
      )
      .subscribe()

    // Bookings subscription
    bookingsChannel = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        async (payload) => {
          console.log('Bookings change received:', payload)
          await fetchBookings()
          // Also refresh activities to update confirmed counts and booking statuses
          await fetchActivities()
        },
      )
      .subscribe()

    // Appointments subscription
    appointmentsChannel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
        },
        async (payload) => {
          console.log('Appointments change received:', payload)
          await fetchAppointments()
        },
      )
      .subscribe()

    // Appointment slots subscription
    appointmentSlotsChannel = supabase
      .channel('appointment-slots-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_slots',
        },
        async (payload) => {
          // console.log('Appointment slots change received:', payload)
          await fetchAppointmentSlots()
        },
      )
      .subscribe()
  }

  const unsubscribeRealtime = () => {
    if (activitiesChannel) {
      supabase.removeChannel(activitiesChannel)
      activitiesChannel = null
    }
    if (bookingsChannel) {
      supabase.removeChannel(bookingsChannel)
      bookingsChannel = null
    }
    if (appointmentsChannel) {
      supabase.removeChannel(appointmentsChannel)
      appointmentsChannel = null
    }
    if (appointmentSlotsChannel) {
      supabase.removeChannel(appointmentSlotsChannel)
      appointmentSlotsChannel = null
    }
  }

  /**
   * Change page for activities
   */
  const goToActivitiesPage = async (page: number) => {
    if (page >= 1 && page <= activitiesTotalPages.value) {
      activitiesPage.value = page
      await fetchActivities()
    }
  }

  /**
   * Change page for bookings
   */
  const goToBookingsPage = async (page: number) => {
    if (page >= 1 && page <= bookingsTotalPages.value) {
      bookingsPage.value = page
      await fetchBookings()
    }
  }

  /**
   * Change page for appointments
   */
  const goToAppointmentsPage = async (page: number) => {
    if (page >= 1 && page <= appointmentsTotalPages.value) {
      appointmentsPage.value = page
      await fetchAppointments()
    }
  }

  return {
    // State
    activities,
    bookings,
    appointments,
    appointmentSlots,
    loading,
    error,

    // Pagination
    activitiesTotal,
    bookingsTotal,
    appointmentsTotal,
    activitiesPage,
    bookingsPage,
    appointmentsPage,
    itemsPerPage,
    activitiesSearchQuery,
    bookingsSearchQuery,
    appointmentsSearchQuery,
    activitiesTotalPages,
    bookingsTotalPages,
    appointmentsTotalPages,
    showArchivedActivities,
    showArchivedAppointments,

    // Activities methods
    fetchActivities,
    loadMoreActivities,
    searchActivities,
    clearActivitiesSearch,
    createActivity,
    updateActivity,
    deleteActivity,
    manuallyArchiveActivity,
    unarchiveActivity,
    goToActivitiesPage,

    // Bookings methods
    fetchBookings,
    searchBookings,
    clearBookingsSearch,
    createBooking,
    updateBooking,
    deleteBooking,
    goToBookingsPage,

    // Appointments methods
    fetchAppointments,
    fetchAppointmentSlots,
    searchAppointments,
    clearAppointmentsSearch,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    manuallyArchiveAppointment,
    unarchiveAppointment,
    goToAppointmentsPage,

    // Appointment slot methods
    createAppointmentSlot,
    updateAppointmentSlot,
    deleteAppointmentSlot,

    // Realtime
    setupRealtimeSubscriptions,
    unsubscribeRealtime,
  }
}
