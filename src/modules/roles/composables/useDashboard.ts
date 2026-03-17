// src/modules/roles/composables/useDashboard.ts

import { ref, computed, onUnmounted } from 'vue'
import { supabase } from '../../../../utils/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface DashboardActivity {
  id: number
  name: string
  description: string
  type: string
  date: string
  time: string
  location: string
  image_url: string | null
  capacity: number
  enrolled_count: number
  status: 'upcoming' | 'ongoing' | 'completed'
  created_at: string
}

export const useDashboard = () => {
  const activities = ref<DashboardActivity[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  let realtimeChannel: RealtimeChannel | null = null

  /**
   * Fetch dashboard activities (upcoming activities with enrollment counts)
   */
  const fetchDashboardActivities = async () => {
    loading.value = true
    error.value = null

    try {
      // Fetch activities with booking counts
      const { data, error: fetchError } = await supabase
        .from('activities')
        .select(
          `
          *,
          bookings:bookings(count)
        `,
        )
        .order('created_at', { ascending: false })
        .limit(6)

      if (fetchError) throw fetchError

      // Transform the data
      activities.value =
        data?.map((activity: any) => ({
          id: activity.id,
          name: activity.name,
          description: activity.description,
          type: activity.type,
          date: new Date().toISOString().split('T')[0], // You can add date field to activities table
          time: '10:00 AM', // You can add time field to activities table
          location: activity.location,
          image_url: activity.image_url,
          capacity: activity.capacity,
          enrolled_count: activity.bookings?.[0]?.count || 0,
          status: 'upcoming' as const,
          created_at: activity.created_at,
        })) || []
    } catch (err: any) {
      error.value = err.message
      console.error('Error fetching dashboard activities:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Setup real-time subscription
   */
  const setupRealtimeSubscription = () => {
    realtimeChannel = supabase
      .channel('dashboard-changes')

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activities',
        },
        async () => {
          await fetchDashboardActivities()
        },
      )
      .subscribe()
  }

  /**
   * Unsubscribe from real-time updates
   */
  const unsubscribeRealtime = () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  }

  // Cleanup on component unmount
  onUnmounted(() => {
    unsubscribeRealtime()
  })

  return {
    activities,
    loading,
    error,

    // Methods
    fetchDashboardActivities,
    setupRealtimeSubscription,
    unsubscribeRealtime,
  }
}
