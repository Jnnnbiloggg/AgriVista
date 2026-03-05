<script setup lang="ts">
import { onMounted, computed, inject, type Ref } from 'vue'
import { useInventoryDashboard } from '../composables/useInventoryDashboard'
import PageHeader from './shared/PageHeader.vue'
import AppSnackbar from '@/components/shared/AppSnackbar.vue'
import { useSnackbar } from '@/composables/useSnackbar'
import { usePageActions } from '@/composables/usePageActions'

interface Props {
  userType: 'admin' | 'user'
}

const props = defineProps<Props>()
const drawer = inject<Ref<boolean>>('drawer')

const {
  loading,
  error,
  revenueStats,
  orderStats,
  stockSummary,
  topProducts,
  lowStockProducts,
  recentOrders,
  chartPeriod,
  chartData,
  dailySales,
  monthlySales,
  fetchAll,
  setupRealtimeSubscription,
} = useInventoryDashboard()

const { snackbar, snackbarMessage, snackbarColor, showSnackbar } = useSnackbar()
const { handleSettingsClick } = usePageActions({ userType: props.userType })

onMounted(async () => {
  await fetchAll()
  setupRealtimeSubscription()
})

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val)

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'confirmed':
      return 'info'
    case 'completed':
      return 'success'
    case 'cancelled':
      return 'error'
    default:
      return 'grey'
  }
}

const getStockColor = (stock: number) => {
  if (stock === 0) return 'error'
  if (stock <= 5) return 'warning'
  return 'success'
}

// Chart bar heights (normalized 0–100)
const chartBarsRevenue = computed(() => {
  const vals = chartData.value.revenue
  const max = Math.max(...vals, 1)
  return vals.map((v) => Math.round((v / max) * 100))
})

const chartBarsOrders = computed(() => {
  const vals = chartData.value.orders
  const max = Math.max(...vals, 1)
  return vals.map((v) => Math.round((v / max) * 100))
})

const maxRevenue = computed(() => Math.max(...chartData.value.revenue, 0))
const maxOrders = computed(() => Math.max(...chartData.value.orders, 0))

const totalChartRevenue = computed(() => chartData.value.revenue.reduce((a, b) => a + b, 0))
const totalChartOrders = computed(() => chartData.value.orders.reduce((a, b) => a + b, 0))

const recentOrderHeaders = [
  { title: 'Product', key: 'product_name' },
  { title: 'Buyer', key: 'buyer_name' },
  { title: 'Qty', key: 'quantity' },
  { title: 'Total', key: 'total_price' },
  { title: 'Date', key: 'created_at' },
  { title: 'Status', key: 'order_status' },
]

const topProductHeaders = [
  { title: '#', key: 'rank' },
  { title: 'Product', key: 'product_name' },
  { title: 'Units Sold', key: 'total_quantity' },
  { title: 'Revenue', key: 'total_revenue' },
]

const formatShortDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

const periodLabel = computed(() => {
  if (chartPeriod.value === 'week') return 'Last 7 Days'
  if (chartPeriod.value === 'month') return 'Current Month'
  return 'Current Year'
})
</script>

<template>
  <div>
    <!-- Page Header -->
    <PageHeader
      title="Inventory Dashboard"
      subtitle="Sales performance, stock overview, and order analytics"
      :user-type="userType"
      :show-search="false"
      @settings-click="handleSettingsClick"
    />

    <!-- Loading overlay -->
    <div v-if="loading" class="text-center py-16">
      <v-progress-circular indeterminate color="primary" size="72" />
      <div class="text-h6 text-grey-darken-1 mt-4">Loading dashboard data…</div>
    </div>

    <template v-else>
      <!-- ======================================
           ROW 1: Revenue Cards
      ====================================== -->
      <v-row class="mb-4">
        <v-col cols="12" sm="6" lg="3">
          <v-card rounded="xl" class="pa-5 stat-card stat-today" elevation="2">
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="stat-icon-wrap bg-green-lighten-4">
                <v-icon icon="mdi-currency-php" color="success" size="22" />
              </div>
              <v-chip size="x-small" color="success" variant="tonal">TODAY</v-chip>
            </div>
            <div class="text-h4 font-weight-bold text-success mb-1">
              {{ formatCurrency(revenueStats.today) }}
            </div>
            <div class="text-body-2 text-grey-darken-1">Revenue Today</div>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" lg="3">
          <v-card rounded="xl" class="pa-5 stat-card" elevation="2">
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="stat-icon-wrap bg-blue-lighten-4">
                <v-icon icon="mdi-calendar-week" color="info" size="22" />
              </div>
              <v-chip size="x-small" color="info" variant="tonal">WEEK</v-chip>
            </div>
            <div class="text-h4 font-weight-bold text-info mb-1">
              {{ formatCurrency(revenueStats.thisWeek) }}
            </div>
            <div class="text-body-2 text-grey-darken-1">Revenue This Week</div>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" lg="3">
          <v-card rounded="xl" class="pa-5 stat-card" elevation="2">
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="stat-icon-wrap bg-purple-lighten-4">
                <v-icon icon="mdi-calendar-month" color="purple" size="22" />
              </div>
              <v-chip size="x-small" color="purple" variant="tonal">MONTH</v-chip>
            </div>
            <div class="text-h4 font-weight-bold mb-1" style="color: #7c3aed">
              {{ formatCurrency(revenueStats.thisMonth) }}
            </div>
            <div class="text-body-2 text-grey-darken-1">Revenue This Month</div>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" lg="3">
          <v-card rounded="xl" class="pa-5 stat-card" elevation="2">
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="stat-icon-wrap bg-orange-lighten-4">
                <v-icon icon="mdi-chart-line" color="warning" size="22" />
              </div>
              <v-chip size="x-small" color="warning" variant="tonal">YEAR</v-chip>
            </div>
            <div class="text-h4 font-weight-bold text-warning mb-1">
              {{ formatCurrency(revenueStats.thisYear) }}
            </div>
            <div class="text-body-2 text-grey-darken-1">Revenue This Year</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- ======================================
           ROW 2: Order Status + Stock Summary
      ====================================== -->
      <v-row class="mb-4">
        <!-- Order Status Breakdown -->
        <v-col cols="12" md="7">
          <v-card rounded="xl" elevation="2" class="pa-5 fill-height">
            <div class="d-flex align-center justify-space-between mb-5">
              <div>
                <div class="text-h6 font-weight-bold">Order Status</div>
                <div class="text-caption text-grey">All-time breakdown</div>
              </div>
              <v-icon icon="mdi-cart-outline" color="primary" size="28" />
            </div>

            <v-row>
              <v-col
                v-for="item in [
                  {
                    label: 'Total Orders',
                    value: orderStats.total,
                    color: 'primary',
                    icon: 'mdi-receipt',
                  },
                  {
                    label: 'Pending',
                    value: orderStats.pending,
                    color: 'warning',
                    icon: 'mdi-clock-outline',
                  },
                  {
                    label: 'Confirmed',
                    value: orderStats.confirmed,
                    color: 'info',
                    icon: 'mdi-check-circle-outline',
                  },
                  {
                    label: 'Completed',
                    value: orderStats.completed,
                    color: 'success',
                    icon: 'mdi-check-all',
                  },
                  {
                    label: 'Cancelled',
                    value: orderStats.cancelled,
                    color: 'error',
                    icon: 'mdi-close-circle-outline',
                  },
                ]"
                :key="item.label"
                cols="6"
                sm="4"
                md="4"
                class="mb-2"
              >
                <div class="order-stat-item pa-3 rounded-xl" :class="`bg-${item.color}-lighten-5`">
                  <v-icon :icon="item.icon" :color="item.color" size="20" class="mb-2" />
                  <div class="text-h5 font-weight-bold" :class="`text-${item.color}`">
                    {{ item.value }}
                  </div>
                  <div class="text-caption text-grey-darken-1">{{ item.label }}</div>
                </div>
              </v-col>
            </v-row>

            <!-- Progress bar breakdown -->
            <div class="mt-4" v-if="orderStats.total > 0">
              <div class="text-caption text-grey mb-2">Orders by status</div>
              <v-progress-linear
                :model-value="(orderStats.pending / orderStats.total) * 100"
                color="warning"
                height="8"
                rounded
                class="mb-1"
                :title="`Pending: ${orderStats.pending}`"
              />
              <v-progress-linear
                :model-value="(orderStats.confirmed / orderStats.total) * 100"
                color="info"
                height="8"
                rounded
                class="mb-1"
              />
              <v-progress-linear
                :model-value="(orderStats.completed / orderStats.total) * 100"
                color="success"
                height="8"
                rounded
                class="mb-1"
              />
              <v-progress-linear
                :model-value="(orderStats.cancelled / orderStats.total) * 100"
                color="error"
                height="8"
                rounded
              />
              <div class="d-flex flex-wrap gap-2 mt-3">
                <span
                  v-for="s in ['Pending', 'Confirmed', 'Completed', 'Cancelled']"
                  :key="s"
                  class="d-flex align-center text-caption text-grey-darken-1 mr-3"
                >
                  <v-icon
                    size="10"
                    :color="
                      s === 'Pending'
                        ? 'warning'
                        : s === 'Confirmed'
                          ? 'info'
                          : s === 'Completed'
                            ? 'success'
                            : 'error'
                    "
                    icon="mdi-circle"
                    class="mr-1"
                  />
                  {{ s }}
                </span>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Stock Summary -->
        <v-col cols="12" md="5">
          <v-card rounded="xl" elevation="2" class="pa-5 fill-height">
            <div class="d-flex align-center justify-space-between mb-5">
              <div>
                <div class="text-h6 font-weight-bold">Stock Overview</div>
                <div class="text-caption text-grey">Current inventory status</div>
              </div>
              <v-icon icon="mdi-package-variant-closed" color="primary" size="28" />
            </div>

            <v-row class="mb-2">
              <v-col
                v-for="item in [
                  {
                    label: 'Total Products',
                    value: stockSummary.total,
                    color: 'primary',
                    icon: 'mdi-package-variant',
                  },
                  {
                    label: 'In Stock',
                    value: stockSummary.inStock,
                    color: 'success',
                    icon: 'mdi-check',
                  },
                  {
                    label: 'Low Stock',
                    value: stockSummary.lowStock,
                    color: 'warning',
                    icon: 'mdi-alert',
                  },
                  {
                    label: 'Out of Stock',
                    value: stockSummary.outOfStock,
                    color: 'error',
                    icon: 'mdi-close',
                  },
                ]"
                :key="item.label"
                cols="6"
              >
                <div
                  class="stock-stat-item pa-3 rounded-xl text-center"
                  :class="`bg-${item.color}-lighten-5`"
                >
                  <v-icon :icon="item.icon" :color="item.color" size="22" class="mb-1" />
                  <div class="text-h5 font-weight-bold" :class="`text-${item.color}`">
                    {{ item.value }}
                  </div>
                  <div class="text-caption text-grey-darken-1">{{ item.label }}</div>
                </div>
              </v-col>
            </v-row>

            <!-- Stock alerts -->
            <div v-if="stockSummary.outOfStock > 0 || stockSummary.lowStock > 0" class="mt-4">
              <v-alert
                v-if="stockSummary.outOfStock > 0"
                type="error"
                variant="tonal"
                density="compact"
                class="mb-2"
                :text="`${stockSummary.outOfStock} product(s) are out of stock`"
              />
              <v-alert
                v-if="stockSummary.lowStock > 0"
                type="warning"
                variant="tonal"
                density="compact"
                :text="`${stockSummary.lowStock} product(s) have low stock (≤5)`"
              />
            </div>
            <div v-else class="mt-4">
              <v-alert
                type="success"
                variant="tonal"
                density="compact"
                text="All products are well-stocked"
              />
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- ======================================
           ROW 3: Sales Chart
      ====================================== -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card rounded="xl" elevation="2" class="pa-5">
            <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-5">
              <div>
                <div class="text-h6 font-weight-bold">Sales Trend</div>
                <div class="text-caption text-grey">{{ periodLabel }}</div>
              </div>
              <div class="d-flex align-center gap-3">
                <div class="text-right mr-4">
                  <div class="text-caption text-grey">Total Revenue</div>
                  <div class="text-subtitle-1 font-weight-bold text-success">
                    {{ formatCurrency(totalChartRevenue) }}
                  </div>
                </div>
                <div class="text-right mr-4">
                  <div class="text-caption text-grey">Total Orders</div>
                  <div class="text-subtitle-1 font-weight-bold text-primary">
                    {{ totalChartOrders }}
                  </div>
                </div>
                <v-btn-toggle
                  v-model="chartPeriod"
                  mandatory
                  density="compact"
                  variant="outlined"
                  color="primary"
                >
                  <v-btn value="week" size="small">Week</v-btn>
                  <v-btn value="month" size="small">Month</v-btn>
                  <v-btn value="year" size="small">Year</v-btn>
                </v-btn-toggle>
              </div>
            </div>

            <!-- Bar Chart -->
            <div v-if="chartData.labels.length > 0" class="chart-area">
              <!-- Revenue Bars -->
              <div class="chart-label text-caption text-grey mb-2 d-flex align-center">
                <span class="chart-legend-dot bg-green-darken-1 mr-2"></span>
                Revenue (completed orders)
              </div>
              <div class="bar-chart mb-4">
                <div v-for="(h, i) in chartBarsRevenue" :key="'rev-' + i" class="bar-col">
                  <v-tooltip
                    :text="`${chartData.labels[i]}: ${formatCurrency(chartData.revenue[i])}`"
                    location="top"
                  >
                    <template v-slot:activator="{ props: tp }">
                      <div v-bind="tp" class="bar-fill revenue-bar" :style="{ height: h + '%' }" />
                    </template>
                  </v-tooltip>
                  <div class="bar-label text-caption text-grey">{{ chartData.labels[i] }}</div>
                </div>
              </div>

              <!-- Orders Bars -->
              <div class="chart-label text-caption text-grey mb-2 d-flex align-center">
                <span class="chart-legend-dot bg-blue-darken-1 mr-2"></span>
                Number of Orders
              </div>
              <div class="bar-chart">
                <div v-for="(h, i) in chartBarsOrders" :key="'ord-' + i" class="bar-col">
                  <v-tooltip
                    :text="`${chartData.labels[i]}: ${chartData.orders[i]} orders`"
                    location="top"
                  >
                    <template v-slot:activator="{ props: tp }">
                      <div v-bind="tp" class="bar-fill orders-bar" :style="{ height: h + '%' }" />
                    </template>
                  </v-tooltip>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-8 text-grey">
              <v-icon icon="mdi-chart-bar" size="48" class="mb-2" />
              <div>No sales data available for this period</div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- ======================================
           ROW 4: Top Products + Low Stock
      ====================================== -->
      <v-row class="mb-4">
        <!-- Top Selling Products -->
        <v-col cols="12" md="6">
          <v-card rounded="xl" elevation="2" class="pa-5 fill-height">
            <div class="d-flex align-center justify-space-between mb-4">
              <div>
                <div class="text-h6 font-weight-bold">Top Selling Products</div>
                <div class="text-caption text-grey">Based on completed orders</div>
              </div>
              <v-icon icon="mdi-trophy-outline" color="warning" size="28" />
            </div>

            <div v-if="topProducts.length === 0" class="text-center py-6 text-grey">
              <v-icon icon="mdi-package-variant-closed-remove" size="40" class="mb-2" />
              <div class="text-body-2">No completed orders yet</div>
            </div>

            <div v-else>
              <div
                v-for="(product, index) in topProducts"
                :key="product.product_id"
                class="d-flex align-center py-3"
                :class="{ 'border-bottom': index < topProducts.length - 1 }"
              >
                <div
                  class="rank-badge mr-3 rounded-xl d-flex align-center justify-center text-caption font-weight-bold"
                  :class="
                    index === 0
                      ? 'bg-amber-lighten-3 text-amber-darken-3'
                      : index === 1
                        ? 'bg-grey-lighten-2 text-grey-darken-2'
                        : index === 2
                          ? 'bg-brown-lighten-3 text-brown-darken-2'
                          : 'bg-grey-lighten-3 text-grey'
                  "
                >
                  {{ index + 1 }}
                </div>
                <div class="flex-grow-1">
                  <div class="text-body-2 font-weight-medium text-truncate">
                    {{ product.product_name }}
                  </div>
                  <div class="text-caption text-grey">{{ product.total_quantity }} units sold</div>
                </div>
                <div class="text-right">
                  <div class="text-body-2 font-weight-bold text-success">
                    {{ formatCurrency(product.total_revenue) }}
                  </div>
                </div>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Low Stock Products -->
        <v-col cols="12" md="6">
          <v-card rounded="xl" elevation="2" class="pa-5 fill-height">
            <div class="d-flex align-center justify-space-between mb-4">
              <div>
                <div class="text-h6 font-weight-bold">Stock Alerts</div>
                <div class="text-caption text-grey">Products needing restocking</div>
              </div>
              <v-icon icon="mdi-alert-circle-outline" color="error" size="28" />
            </div>

            <div v-if="lowStockProducts.length === 0" class="text-center py-6 text-grey">
              <v-icon icon="mdi-check-circle-outline" size="40" color="success" class="mb-2" />
              <div class="text-body-2">No stock alerts — all good!</div>
            </div>

            <div v-else>
              <div
                v-for="(product, index) in lowStockProducts"
                :key="product.id"
                class="d-flex align-center py-2"
                :class="{ 'border-bottom': index < lowStockProducts.length - 1 }"
              >
                <div class="flex-grow-1">
                  <div class="text-body-2 font-weight-medium">{{ product.name }}</div>
                  <div class="text-caption text-grey">{{ product.category }}</div>
                </div>
                <div class="d-flex align-center gap-2">
                  <v-chip
                    :color="getStockColor(product.stock)"
                    size="small"
                    variant="tonal"
                    class="font-weight-bold"
                  >
                    {{ product.stock === 0 ? 'Out of Stock' : `${product.stock} left` }}
                  </v-chip>
                </div>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- ======================================
           ROW 5: Recent Orders
      ====================================== -->
      <v-row>
        <v-col cols="12">
          <v-card rounded="xl" elevation="2">
            <div class="pa-5">
              <div class="d-flex align-center justify-space-between">
                <div>
                  <div class="text-h6 font-weight-bold">Recent Orders</div>
                  <div class="text-caption text-grey">Latest 8 orders across all products</div>
                </div>
                <v-icon icon="mdi-receipt-text-outline" color="primary" size="28" />
              </div>
            </div>

            <v-data-table
              :headers="recentOrderHeaders"
              :items="recentOrders"
              :loading="loading"
              hide-default-footer
              density="comfortable"
            >
              <template v-slot:item.total_price="{ item }">
                <span class="font-weight-medium text-success">{{
                  formatCurrency(item.total_price)
                }}</span>
              </template>
              <template v-slot:item.created_at="{ item }">
                <span class="text-caption text-grey">{{ formatShortDate(item.created_at) }}</span>
              </template>
              <template v-slot:item.order_status="{ item }">
                <v-chip
                  :color="getStatusColor(item.order_status)"
                  size="small"
                  variant="tonal"
                  class="text-capitalize font-weight-medium"
                >
                  {{ item.order_status }}
                </v-chip>
              </template>
              <template v-slot:no-data>
                <div class="text-center py-8 text-grey">
                  <v-icon icon="mdi-cart-off" size="40" class="mb-2" />
                  <div>No orders found</div>
                </div>
              </template>
            </v-data-table>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- Snackbar -->
    <AppSnackbar
      v-model="snackbar"
      :message="snackbarMessage"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    />
  </div>
</template>

<style scoped>
.stat-card {
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1) !important;
}

.stat-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.order-stat-item,
.stock-stat-item {
  text-align: center;
}

/* ---- Bar Chart ---- */
.chart-area {
  padding: 0 4px;
}

.chart-legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 100px;
  padding-bottom: 20px; /* room for labels */
  position: relative;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  position: relative;
}

.bar-fill {
  width: 100%;
  min-height: 2px;
  border-radius: 3px 3px 0 0;
  transition: height 0.4s ease;
  cursor: pointer;
}

.revenue-bar {
  background: linear-gradient(180deg, #4caf50, #81c784);
}

.revenue-bar:hover {
  background: linear-gradient(180deg, #388e3c, #4caf50);
}

.orders-bar {
  background: linear-gradient(180deg, #2196f3, #64b5f6);
}

.orders-bar:hover {
  background: linear-gradient(180deg, #1565c0, #2196f3);
}

.bar-label {
  position: absolute;
  bottom: -18px;
  font-size: 9px;
  white-space: nowrap;
  transform: rotate(-30deg);
  transform-origin: top center;
}

/* Rank badge */
.rank-badge {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  font-size: 12px;
}

.border-bottom {
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
}
</style>
