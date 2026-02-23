// src/composables/useNewsletter.ts

import { ref, computed } from 'vue'
import { supabase } from '../../utils/supabase'

export interface NewsletterSubscriber {
  id: number
  email: string
  is_active: boolean
  subscribed_at: string
  unsubscribed_at: string | null
  created_at: string
  updated_at: string
}

export interface EmailQueueItem {
  id: number
  announcement_id: number
  email: string
  sent: boolean
  sent_at: string | null
  error: string | null
  created_at: string
}

export const useNewsletter = () => {
  // State
  const subscribers = ref<NewsletterSubscriber[]>([])
  const emailQueue = ref<EmailQueueItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Pagination
  const subscribersTotal = ref(0)
  const emailQueueTotal = ref(0)
  const currentPage = ref(1)
  const itemsPerPage = ref(10)

  // Computed
  const totalPages = computed(() => Math.ceil(subscribersTotal.value / itemsPerPage.value))
  const activeSubscribersCount = computed(() => subscribers.value.filter((s) => s.is_active).length)
  const pendingEmailsCount = computed(() => emailQueue.value.filter((e) => !e.sent).length)

  /**
   * Fetch newsletter subscribers
   */
  const fetchSubscribers = async (options?: {
    page?: number
    itemsPerPage?: number
    activeOnly?: boolean
  }) => {
    loading.value = true
    error.value = null

    try {
      if (options?.page) currentPage.value = options.page
      if (options?.itemsPerPage) itemsPerPage.value = options.itemsPerPage

      const from = (currentPage.value - 1) * itemsPerPage.value
      const to = from + itemsPerPage.value - 1

      let query = supabase
        .from('newsletter_subscribers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (options?.activeOnly) {
        query = query.eq('is_active', true)
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      subscribers.value = data || []
      subscribersTotal.value = count || 0
    } catch (err: any) {
      error.value = err.message
      console.error('Error fetching subscribers:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch email queue
   */
  const fetchEmailQueue = async (options?: {
    page?: number
    itemsPerPage?: number
    pendingOnly?: boolean
  }) => {
    loading.value = true
    error.value = null

    try {
      const page = options?.page || 1
      const perPage = options?.itemsPerPage || itemsPerPage.value

      const from = (page - 1) * perPage
      const to = from + perPage - 1

      let query = supabase
        .from('announcement_email_queue')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (options?.pendingOnly) {
        query = query.eq('sent', false)
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      emailQueue.value = data || []
      emailQueueTotal.value = count || 0
    } catch (err: any) {
      error.value = err.message
      console.error('Error fetching email queue:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Unsubscribe a subscriber
   */
  const unsubscribeSubscriber = async (email: string) => {
    loading.value = true
    error.value = null

    try {
      const { error: updateError } = await supabase
        .from('newsletter_subscribers')
        .update({
          is_active: false,
          unsubscribed_at: new Date().toISOString(),
        })
        .eq('email', email)

      if (updateError) throw updateError

      // Update local state
      const subscriber = subscribers.value.find((s) => s.email === email)
      if (subscriber) {
        subscriber.is_active = false
        subscriber.unsubscribed_at = new Date().toISOString()
      }

      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error unsubscribing:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Reactivate a subscription
   */
  const reactivateSubscriber = async (email: string) => {
    loading.value = true
    error.value = null

    try {
      const { error: updateError } = await supabase
        .from('newsletter_subscribers')
        .update({
          is_active: true,
          unsubscribed_at: null,
        })
        .eq('email', email)

      if (updateError) throw updateError

      // Update local state
      const subscriber = subscribers.value.find((s) => s.email === email)
      if (subscriber) {
        subscriber.is_active = true
        subscriber.unsubscribed_at = null
      }

      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error reactivating subscription:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a subscriber
   */
  const deleteSubscriber = async (id: number) => {
    loading.value = true
    error.value = null

    try {
      const { error: deleteError } = await supabase
        .from('newsletter_subscribers')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      // Update local state
      subscribers.value = subscribers.value.filter((s) => s.id !== id)
      subscribersTotal.value -= 1

      return { success: true }
    } catch (err: any) {
      error.value = err.message
      console.error('Error deleting subscriber:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Manually trigger email sending
   */
  const triggerEmailSending = async () => {
    loading.value = true
    error.value = null

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/send-announcement-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send emails')
      }

      // Refresh email queue after sending
      await fetchEmailQueue()

      return {
        success: true,
        message: result.message,
        successCount: result.successCount,
        errorCount: result.errorCount,
      }
    } catch (err: any) {
      error.value = err.message
      console.error('Error triggering email sending:', err)
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Export subscribers to CSV
   */
  const exportSubscribers = () => {
    const csvContent = [
      ['Email', 'Status', 'Subscribed At', 'Unsubscribed At'],
      ...subscribers.value.map((s) => [
        s.email,
        s.is_active ? 'Active' : 'Inactive',
        new Date(s.subscribed_at).toLocaleDateString(),
        s.unsubscribed_at ? new Date(s.unsubscribed_at).toLocaleDateString() : '-',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `newsletter_subscribers_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return {
    // State
    subscribers,
    emailQueue,
    loading,
    error,
    subscribersTotal,
    emailQueueTotal,
    currentPage,
    itemsPerPage,

    // Computed
    totalPages,
    activeSubscribersCount,
    pendingEmailsCount,

    // Methods
    fetchSubscribers,
    fetchEmailQueue,
    unsubscribeSubscriber,
    reactivateSubscriber,
    deleteSubscriber,
    triggerEmailSending,
    exportSubscribers,
  }
}
