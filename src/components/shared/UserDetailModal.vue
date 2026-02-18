<script setup lang="ts">
import { ref, watch } from 'vue'
import { supabase } from '../../../utils/supabase'

/**
 * A generic user-detail modal used on the admin side.
 *
 * Props:
 *   - modelValue: controls open/close
 *   - record: the raw row from the table (booking / appointment / order / registration)
 *   - recordType: one of 'booking' | 'appointment' | 'order' | 'registration'
 */

type RecordType = 'booking' | 'appointment' | 'order' | 'registration'

interface Props {
  modelValue: boolean
  record: Record<string, any> | null
  recordType: RecordType
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const close = () => emit('update:modelValue', false)

// Extended profile from user_profiles table
const extProfile = ref<{
  sex: string | null
  address: string | null
  contact_number: string | null
} | null>(null)
const loadingProfile = ref(false)

const sexLabel = (val: string | null) => {
  if (!val) return '—'
  return val === 'male' ? 'Male' : val === 'female' ? 'Female' : 'Prefer not to say'
}

// Derive user_id from the record based on type
const getUserId = (): string | null => {
  if (!props.record) return null
  return props.record.user_id || null
}

// Fetch extended profile from user_profiles
const fetchProfile = async () => {
  const uid = getUserId()
  if (!uid) {
    extProfile.value = null
    return
  }

  loadingProfile.value = true
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('sex, address, contact_number')
      .eq('id', uid)
      .single()
    if (error) {
      console.error('user_profiles fetch error:', error.message)
    }
    extProfile.value = data ?? null
  } catch (e) {
    console.error('user_profiles fetch exception:', e)
    extProfile.value = null
  } finally {
    loadingProfile.value = false
  }
}

// Re-fetch whenever modal opens or the record changes (different row clicked)
watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      extProfile.value = null
      return
    }
    fetchProfile()
  },
)

watch(
  () => props.record,
  () => {
    if (props.modelValue) fetchProfile()
  },
)

// ── helpers to render record detail rows ────────────────────────────────────

interface DetailRow {
  label: string
  value: string | null | undefined
  icon?: string
  chip?: string
}

const statusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'confirmed':
      return 'success'
    case 'completed':
      return 'teal'
    case 'pending':
      return 'warning'
    case 'cancelled':
      return 'error'
    default:
      return 'grey'
  }
}

const recordDetails = (): DetailRow[] => {
  const r = props.record
  if (!r) return []

  if (props.recordType === 'booking') {
    return [
      { label: 'Activity', value: r.activity_name, icon: 'mdi-calendar-check' },
      { label: 'Booking Date', value: r.booking_date, icon: 'mdi-calendar' },
      { label: 'Status', value: r.status, icon: 'mdi-tag', chip: r.status },
    ]
  }
  if (props.recordType === 'appointment') {
    return [
      { label: 'Type', value: r.appointment_type, icon: 'mdi-calendar-clock' },
      { label: 'Date', value: r.date, icon: 'mdi-calendar' },
      { label: 'Time', value: r.time, icon: 'mdi-clock-outline' },
      { label: 'Note', value: r.note || '—', icon: 'mdi-note-text' },
      { label: 'Status', value: r.status, icon: 'mdi-tag', chip: r.status },
    ]
  }
  if (props.recordType === 'order') {
    return [
      { label: 'Product', value: r.product_name, icon: 'mdi-package-variant' },
      { label: 'Quantity', value: String(r.quantity), icon: 'mdi-counter' },
      {
        label: 'Total Price',
        value: `₱${Number(r.total_price).toFixed(2)}`,
        icon: 'mdi-currency-php',
      },
      {
        label: 'Date Ordered',
        value: r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
        icon: 'mdi-calendar',
      },
      { label: 'Status', value: r.order_status, icon: 'mdi-tag', chip: r.order_status },
    ]
  }
  if (props.recordType === 'registration') {
    return [
      { label: 'Training', value: r.training_name, icon: 'mdi-school' },
      {
        label: 'Registered On',
        value: r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
        icon: 'mdi-calendar',
      },
      { label: 'Status', value: r.status, icon: 'mdi-tag', chip: r.status },
    ]
  }
  return []
}

const recordTitle: Record<RecordType, string> = {
  booking: 'Booking Details',
  appointment: 'Appointment Details',
  order: 'Order Details',
  registration: 'Registration Details',
}

const recordIcon: Record<RecordType, string> = {
  booking: 'mdi-calendar-check',
  appointment: 'mdi-calendar-clock',
  order: 'mdi-cart',
  registration: 'mdi-school',
}

// Derive display name
const displayName = (): string => {
  if (!props.record) return '—'
  const r = props.record
  return r.full_name || r.user_name || r.buyer_name || '—'
}

const displayEmail = (): string => {
  if (!props.record) return '—'
  const r = props.record
  return r.email || r.user_email || r.buyer_email || '—'
}

const displayContact = (): string => {
  if (!props.record) return ''
  const r = props.record
  // appointment has contact_number directly
  const fromRecord = r.contact_number || ''
  // fallback to user_profiles
  const fromProfile = extProfile.value?.contact_number || ''
  return fromRecord || fromProfile || '—'
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="580" scrollable @update:model-value="close">
    <v-card rounded="xl">
      <!-- Header -->
      <div class="modal-header px-6 pt-6 pb-4 d-flex align-center justify-space-between">
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" size="44">
            <v-icon color="white" size="22">mdi-account-details</v-icon>
          </v-avatar>
          <div>
            <div class="text-h6 font-weight-bold">User Details</div>
            <div class="text-caption text-grey-darken-1">Full profile + {{ recordType }} info</div>
          </div>
        </div>
        <v-btn icon size="small" variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <v-divider />

      <v-card-text class="pa-6">
        <!-- User Information Section -->
        <div class="section-label mb-3">
          <v-icon size="16" color="primary" class="mr-1">mdi-account</v-icon>
          <span class="text-subtitle-2 font-weight-bold text-primary text-uppercase tracking-wide"
            >User Information</span
          >
        </div>

        <v-list density="compact" class="info-list rounded-lg mb-6">
          <v-list-item prepend-icon="mdi-account-circle" class="px-3">
            <template #title>
              <span class="text-caption text-grey">Full Name</span>
            </template>
            <template #subtitle>
              <span class="text-body-2 font-weight-medium">{{ displayName() }}</span>
            </template>
          </v-list-item>
          <v-divider inset />

          <v-list-item prepend-icon="mdi-email-outline" class="px-3">
            <template #title><span class="text-caption text-grey">Email</span></template>
            <template #subtitle>
              <span class="text-body-2 font-weight-medium">{{ displayEmail() }}</span>
            </template>
          </v-list-item>
          <v-divider inset />

          <v-list-item prepend-icon="mdi-phone-outline" class="px-3">
            <template #title><span class="text-caption text-grey">Contact Number</span></template>
            <template #subtitle>
              <div class="d-flex align-center">
                <span class="text-body-2 font-weight-medium">{{ displayContact() }}</span>
                <v-progress-circular
                  v-if="loadingProfile"
                  indeterminate
                  size="12"
                  width="2"
                  color="grey"
                  class="ml-2"
                />
              </div>
            </template>
          </v-list-item>
          <v-divider inset />

          <v-list-item prepend-icon="mdi-gender-male-female" class="px-3">
            <template #title><span class="text-caption text-grey">Sex</span></template>
            <template #subtitle>
              <v-skeleton-loader v-if="loadingProfile" type="text" width="80" class="mt-1" />
              <span v-else class="text-body-2 font-weight-medium">{{
                sexLabel(extProfile?.sex ?? null)
              }}</span>
            </template>
          </v-list-item>
          <v-divider inset />

          <v-list-item prepend-icon="mdi-map-marker-outline" class="px-3">
            <template #title><span class="text-caption text-grey">Address</span></template>
            <template #subtitle>
              <v-skeleton-loader v-if="loadingProfile" type="text" width="160" class="mt-1" />
              <span v-else class="text-body-2 font-weight-medium">{{
                extProfile?.address || '—'
              }}</span>
            </template>
          </v-list-item>
        </v-list>

        <!-- Record Details Section -->
        <div class="section-label mb-3">
          <v-icon size="16" color="primary" class="mr-1">{{ recordIcon[recordType] }}</v-icon>
          <span
            class="text-subtitle-2 font-weight-bold text-primary text-uppercase tracking-wide"
            >{{ recordTitle[recordType] }}</span
          >
        </div>

        <v-list density="compact" class="info-list rounded-lg">
          <template v-for="(row, i) in recordDetails()" :key="row.label">
            <v-divider v-if="i > 0" inset />
            <v-list-item :prepend-icon="row.icon" class="px-3">
              <template #title>
                <span class="text-caption text-grey">{{ row.label }}</span>
              </template>
              <template #subtitle>
                <v-chip
                  v-if="row.chip"
                  :color="statusColor(row.chip)"
                  size="small"
                  variant="tonal"
                  class="text-capitalize mt-1"
                >
                  {{ row.chip }}
                </v-chip>
                <span v-else class="text-body-2 font-weight-medium">{{ row.value }}</span>
              </template>
            </v-list-item>
          </template>
        </v-list>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="tonal" color="primary" rounded="lg" @click="close">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.modal-header {
  background: linear-gradient(135deg, #f0f9f0 0%, #e8f5e9 100%);
}

.section-label {
  display: flex;
  align-items: center;
}

.info-list {
  background: #fafafa;
  border: 1px solid #e0e0e0;
}

.tracking-wide {
  letter-spacing: 0.08em;
}

.gap-3 {
  gap: 12px;
}
</style>
