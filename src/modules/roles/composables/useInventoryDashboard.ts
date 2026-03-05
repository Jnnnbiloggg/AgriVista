// src/modules/roles/composables/useInventoryDashboard.ts

import { ref, computed, onUnmounted } from 'vue'
import { supabase } from '../../../../utils/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface RevenueStats {
  today: number
  thisWeek: number
  thisMonth: number
  thisYear: number
}

export interface OrderStats {
  total: number
  pending: number
  confirmed: number
  completed: number
  cancelled: number
}

export interface ProductStockSummary {
  total: number
  inStock: number
  outOfStock: number
  lowStock: number // stock <= 5
}

export interface TopProduct {
  product_id: number
  product_name: string
  total_quantity: number
  total_revenue: number
}

export interface LowStockProduct {
  id: number
  name: string
  category: string
  stock: number
  price: number
}

export interface DailySalePoint {
  date: string
  revenue: number
  orders: number
}

export interface MonthlySalePoint {
  month: string
  revenue: number
  orders: number
}

export interface CategoryStat {
  category: string
  total_products: number
  total_stock: number
  total_revenue: number
}

export const useInventoryDashboard = () => {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const revenueStats = ref<RevenueStats>({ today: 0, thisWeek: 0, thisMonth: 0, thisYear: 0 })
  const orderStats = ref<OrderStats>({
    total: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  })
  const stockSummary = ref<ProductStockSummary>({
    total: 0,
    inStock: 0,
    outOfStock: 0,
    lowStock: 0,
  })
  const topProducts = ref<TopProduct[]>([])
  const lowStockProducts = ref<LowStockProduct[]>([])
  const dailySales = ref<DailySalePoint[]>([])
  const monthlySales = ref<MonthlySalePoint[]>([])
  const categoryStats = ref<CategoryStat[]>([])
  const recentOrders = ref<any[]>([])

  // Selected period for chart
  const chartPeriod = ref<'week' | 'month' | 'year'>('month')

  let dashboardChannel: RealtimeChannel | null = null

  // ============================================
  // DATE HELPERS
  // ============================================

  const getDateRange = (period: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date()
    const start = new Date()

    if (period === 'today') {
      start.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      const day = now.getDay()
      start.setDate(now.getDate() - day)
      start.setHours(0, 0, 0, 0)
    } else if (period === 'month') {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
    } else if (period === 'year') {
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
    }

    return { start: start.toISOString(), end: now.toISOString() }
  }

  // ============================================
  // REVENUE STATS
  // ============================================

  const fetchRevenueStats = async () => {
    try {
      const ranges = {
        today: getDateRange('today'),
        thisWeek: getDateRange('week'),
        thisMonth: getDateRange('month'),
        thisYear: getDateRange('year'),
      }

      const [todayRes, weekRes, monthRes, yearRes] = await Promise.all([
        supabase
          .from('orders')
          .select('total_price')
          .eq('order_status', 'completed')
          .gte('created_at', ranges.today.start),
        supabase
          .from('orders')
          .select('total_price')
          .eq('order_status', 'completed')
          .gte('created_at', ranges.thisWeek.start),
        supabase
          .from('orders')
          .select('total_price')
          .eq('order_status', 'completed')
          .gte('created_at', ranges.thisMonth.start),
        supabase
          .from('orders')
          .select('total_price')
          .eq('order_status', 'completed')
          .gte('created_at', ranges.thisYear.start),
      ])

      const sum = (data: any[] | null) =>
        (data || []).reduce((acc, row) => acc + Number(row.total_price), 0)

      revenueStats.value = {
        today: sum(todayRes.data),
        thisWeek: sum(weekRes.data),
        thisMonth: sum(monthRes.data),
        thisYear: sum(yearRes.data),
      }
    } catch (err: any) {
      console.error('Error fetching revenue stats:', err)
    }
  }

  // ============================================
  // ORDER STATS
  // ============================================

  const fetchOrderStats = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('order_status', { count: 'exact' })

      if (fetchError) throw fetchError

      const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 }
      ;(data || []).forEach((row) => {
        const s = row.order_status as keyof typeof counts
        if (s in counts) counts[s]++
      })

      orderStats.value = {
        total: (data || []).length,
        ...counts,
      }
    } catch (err: any) {
      console.error('Error fetching order stats:', err)
    }
  }

  // ============================================
  // STOCK SUMMARY
  // ============================================

  const fetchStockSummary = async () => {
    try {
      const { data, error: fetchError } = await supabase.from('products').select('id, stock')

      if (fetchError) throw fetchError

      const products = data || []
      stockSummary.value = {
        total: products.length,
        inStock: products.filter((p) => p.stock > 5).length,
        outOfStock: products.filter((p) => p.stock === 0).length,
        lowStock: products.filter((p) => p.stock > 0 && p.stock <= 5).length,
      }
    } catch (err: any) {
      console.error('Error fetching stock summary:', err)
    }
  }

  // ============================================
  // TOP SELLING PRODUCTS
  // ============================================

  const fetchTopProducts = async (limit = 5) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('product_id, product_name, quantity, total_price')
        .eq('order_status', 'completed')

      if (fetchError) throw fetchError

      const grouped: Record<
        number,
        { product_id: number; product_name: string; total_quantity: number; total_revenue: number }
      > = {}

      ;(data || []).forEach((row) => {
        if (!grouped[row.product_id]) {
          grouped[row.product_id] = {
            product_id: row.product_id,
            product_name: row.product_name,
            total_quantity: 0,
            total_revenue: 0,
          }
        }
        grouped[row.product_id].total_quantity += row.quantity
        grouped[row.product_id].total_revenue += Number(row.total_price)
      })

      topProducts.value = Object.values(grouped)
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, limit)
    } catch (err: any) {
      console.error('Error fetching top products:', err)
    }
  }

  // ============================================
  // LOW STOCK PRODUCTS
  // ============================================

  const fetchLowStockProducts = async (threshold = 5) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('id, name, category, stock, price')
        .lte('stock', threshold)
        .order('stock', { ascending: true })
        .limit(10)

      if (fetchError) throw fetchError

      lowStockProducts.value = data || []
    } catch (err: any) {
      console.error('Error fetching low stock products:', err)
    }
  }

  // ============================================
  // DAILY SALES (current month, per day)
  // ============================================

  const fetchDailySales = async () => {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('total_price, created_at, order_status')
        .gte('created_at', startOfMonth.toISOString())
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      // Group by day
      const grouped: Record<string, { revenue: number; orders: number }> = {}

      // Populate all days of the current month so far
      const today = new Date()
      for (let d = new Date(startOfMonth); d <= today; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0]
        grouped[key] = { revenue: 0, orders: 0 }
      }

      ;(data || []).forEach((row) => {
        const day = row.created_at.split('T')[0]
        if (!grouped[day]) grouped[day] = { revenue: 0, orders: 0 }
        grouped[day].orders++
        if (row.order_status === 'completed') {
          grouped[day].revenue += Number(row.total_price)
        }
      })

      dailySales.value = Object.entries(grouped).map(([date, stats]) => ({
        date,
        ...stats,
      }))
    } catch (err: any) {
      console.error('Error fetching daily sales:', err)
    }
  }

  // ============================================
  // MONTHLY SALES (current year, per month)
  // ============================================

  const fetchMonthlySales = async () => {
    try {
      const now = new Date()
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('total_price, created_at, order_status')
        .gte('created_at', startOfYear.toISOString())
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ]

      // Initialize all months of the year
      const grouped: Record<number, { revenue: number; orders: number }> = {}
      for (let m = 0; m <= now.getMonth(); m++) {
        grouped[m] = { revenue: 0, orders: 0 }
      }

      ;(data || []).forEach((row) => {
        const m = new Date(row.created_at).getMonth()
        if (grouped[m] !== undefined) {
          grouped[m].orders++
          if (row.order_status === 'completed') {
            grouped[m].revenue += Number(row.total_price)
          }
        }
      })

      monthlySales.value = Object.entries(grouped).map(([m, stats]) => ({
        month: months[Number(m)],
        ...stats,
      }))
    } catch (err: any) {
      console.error('Error fetching monthly sales:', err)
    }
  }

  // ============================================
  // CATEGORY STATS
  // ============================================

  const fetchCategoryStats = async () => {
    try {
      const [productsRes, ordersRes] = await Promise.all([
        supabase.from('products').select('category, stock'),
        supabase
          .from('orders')
          .select('product_id, total_price, order_status')
          .eq('order_status', 'completed'),
      ])

      if (productsRes.error) throw productsRes.error

      const catMap: Record<
        string,
        { total_products: number; total_stock: number; total_revenue: number }
      > = {}

      ;(productsRes.data || []).forEach((p) => {
        const cat = p.category || 'Other'
        if (!catMap[cat]) catMap[cat] = { total_products: 0, total_stock: 0, total_revenue: 0 }
        catMap[cat].total_products++
        catMap[cat].total_stock += p.stock
      })

      // We'd need to join products to orders for category revenue; this is a best-effort approach
      categoryStats.value = Object.entries(catMap).map(([category, stats]) => ({
        category,
        ...stats,
      }))
    } catch (err: any) {
      console.error('Error fetching category stats:', err)
    }
  }

  // ============================================
  // RECENT ORDERS
  // ============================================

  const fetchRecentOrders = async (limit = 8) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (fetchError) throw fetchError

      recentOrders.value = data || []
    } catch (err: any) {
      console.error('Error fetching recent orders:', err)
    }
  }

  // ============================================
  // COMBINED FETCH
  // ============================================

  const fetchAll = async () => {
    loading.value = true
    error.value = null
    try {
      await Promise.all([
        fetchRevenueStats(),
        fetchOrderStats(),
        fetchStockSummary(),
        fetchTopProducts(),
        fetchLowStockProducts(),
        fetchDailySales(),
        fetchMonthlySales(),
        fetchCategoryStats(),
        fetchRecentOrders(),
      ])
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // REALTIME
  // ============================================

  const setupRealtimeSubscription = () => {
    dashboardChannel = supabase
      .channel('inventory-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchAll()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchStockSummary()
        fetchLowStockProducts()
        fetchCategoryStats()
      })
      .subscribe()
  }

  const unsubscribeRealtime = () => {
    if (dashboardChannel) {
      supabase.removeChannel(dashboardChannel)
      dashboardChannel = null
    }
  }

  onUnmounted(() => {
    unsubscribeRealtime()
  })

  // ============================================
  // COMPUTED
  // ============================================

  const chartData = computed(() => {
    if (chartPeriod.value === 'month' || chartPeriod.value === 'week') {
      const source = chartPeriod.value === 'week' ? dailySales.value.slice(-7) : dailySales.value
      return {
        labels: source.map((d) => d.date.slice(5)), // MM-DD
        revenue: source.map((d) => d.revenue),
        orders: source.map((d) => d.orders),
      }
    } else {
      return {
        labels: monthlySales.value.map((d) => d.month),
        revenue: monthlySales.value.map((d) => d.revenue),
        orders: monthlySales.value.map((d) => d.orders),
      }
    }
  })

  return {
    // State
    loading,
    error,
    revenueStats,
    orderStats,
    stockSummary,
    topProducts,
    lowStockProducts,
    dailySales,
    monthlySales,
    categoryStats,
    recentOrders,
    chartPeriod,
    chartData,

    // Methods
    fetchAll,
    fetchRevenueStats,
    fetchOrderStats,
    fetchStockSummary,
    fetchTopProducts,
    fetchLowStockProducts,
    fetchDailySales,
    fetchMonthlySales,
    fetchCategoryStats,
    fetchRecentOrders,
    setupRealtimeSubscription,
    unsubscribeRealtime,
  }
}
