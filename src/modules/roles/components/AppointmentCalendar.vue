<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '../../../../utils/supabase'

interface AppointmentSlot {
  id?: number
  date: string
  time_slot: 'AM' | 'PM'
  available_slots: number
}

export interface DayInMonth {
  empty: boolean
  date?: number
  dateStr?: string
  isToday?: boolean
  isPast?: boolean
  totalRem?: number
  remAM?: number
  remPM?: number
  bookedAM?: number
  bookedPM?: number
  AM?: AppointmentSlot
  PM?: AppointmentSlot
}

const props = defineProps<{
  isAdmin: boolean
  availableSlots: AppointmentSlot[] // slots defined by admin
}>()

const emit = defineEmits<{
  (e: 'date-selected', date: string, amItem: any, pmItem: any): void
  (e: 'save-slots', date: string, amSlots: number, pmSlots: number): void
  (e: 'request-booking', date: string, time_slot: 'AM' | 'PM'): void
}>()

const currentDate = ref(new Date())
const selectedDate = ref<string | null>(null)

const getSlotsForDate = (dateStr: string) => {
  const am = props.availableSlots.find((s) => s.date === dateStr && s.time_slot === 'AM')
  const pm = props.availableSlots.find((s) => s.date === dateStr && s.time_slot === 'PM')

  return {
    AM: am,
    PM: pm,
    remAM: am ? Math.max(0, am.available_slots) : 0,
    remPM: pm ? Math.max(0, pm.available_slots) : 0,
  }
}

const daysInMonth = computed<DayInMonth[]>(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const days: DayInMonth[] = []

  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push({ empty: true })
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const slots = getSlotsForDate(dateStr)
    const totalRem = slots.remAM + slots.remPM

    days.push({
      empty: false,
      date: d,
      dateStr,
      isToday: dateStr === new Date().toISOString().split('T')[0],
      isPast: new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0)),
      totalRem,
      remAM: slots.remAM,
      remPM: slots.remPM,
      AM: slots.AM,
      PM: slots.PM,
    })
  }

  return days
})

const nextMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}
const prevMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}
const setToday = () => {
  currentDate.value = new Date()
}

const selectDate = (day: any) => {
  if (day.empty || (day.isPast && !props.isAdmin)) return
  selectedDate.value = day.dateStr

  if (props.isAdmin) {
    adminForm.value.am = day.AM?.available_slots || 0
    adminForm.value.pm = day.PM?.available_slots || 0
  }

  emit('date-selected', day.dateStr, day.AM, day.PM)
}

const monthName = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// Admin Form state
const adminForm = ref({ am: 0, pm: 0 })
const saveAdminForm = () => {
  if (selectedDate.value) {
    emit('save-slots', selectedDate.value, adminForm.value.am, adminForm.value.pm)
  }
}

const selectedDayData = computed(() => {
  if (!selectedDate.value) return null
  return daysInMonth.value.find((d) => !d.empty && d.dateStr === selectedDate.value)
})
</script>

<template>
  <v-row>
    <!-- Left: Calendar -->
    <v-col cols="12" md="8">
      <v-card class="calendar-card fill-height">
        <v-card-title class="calendar-header bg-primary text-white pa-4">
          <div class="d-flex align-center justify-space-between w-100">
            <h2 class="text-h5 font-weight-bold mb-0 text-uppercase">{{ monthName }}</h2>
            <div class="d-flex align-center gap-2">
              <v-btn
                variant="flat"
                color="white"
                class="text-primary font-weight-bold"
                prepend-icon="mdi-calendar-today"
                @click="setToday"
                >Today</v-btn
              >
              <div class="d-flex bg-white rounded">
                <v-btn
                  icon="mdi-chevron-left"
                  variant="text"
                  density="comfortable"
                  color="primary"
                  @click="prevMonth"
                ></v-btn>
                <v-btn
                  icon="mdi-chevron-right"
                  variant="text"
                  density="comfortable"
                  color="primary"
                  @click="nextMonth"
                ></v-btn>
              </div>
            </div>
          </div>
        </v-card-title>

        <v-card-text class="pa-0">
          <div class="calendar-grid">
            <div class="calendar-row header-row bg-green-darken-3 text-white font-weight-bold">
              <div class="calendar-cell">SUN</div>
              <div class="calendar-cell">MON</div>
              <div class="calendar-cell">TUE</div>
              <div class="calendar-cell">WED</div>
              <div class="calendar-cell">THU</div>
              <div class="calendar-cell">FRI</div>
              <div class="calendar-cell">SAT</div>
            </div>

            <div class="calendar-body">
              <div
                class="calendar-row"
                v-for="weekObj in Math.ceil(daysInMonth.length / 7)"
                :key="weekObj"
              >
                <div
                  v-for="dayIdx in 7"
                  :key="dayIdx"
                  class="calendar-cell day-cell"
                  :class="{
                    'empty-cell': daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.empty,
                    'past-cell': daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.isPast,
                    'selected-cell':
                      selectedDate === daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.dateStr,
                    'today-cell': daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.isToday,
                  }"
                  @click="selectDate(daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)])"
                >
                  <template v-if="!daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.empty">
                    <div
                      class="day-number font-weight-black text-h5"
                      :class="
                        daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.isToday
                          ? 'text-primary'
                          : 'text-blue-grey-darken-3'
                      "
                    >
                      {{ daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.date }}
                    </div>

                    <div
                      class="day-status font-weight-bold text-caption text-uppercase mt-1"
                      :class="
                        (daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.totalRem ?? 0) > 0
                          ? 'text-blue-grey-darken-2'
                          : 'text-error'
                      "
                      v-if="!daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.isPast || isAdmin"
                    >
                      <template
                        v-if="(daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.totalRem ?? 0) > 0"
                      >
                        {{ daysInMonth[(weekObj - 1) * 7 + (dayIdx - 1)]?.totalRem }}
                        AVAILABLE
                      </template>
                      <template v-else> NOT AVAILABLE </template>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-col>

    <!-- Right: Details panel -->
    <v-col cols="12" md="4">
      <v-card class="fill-height detail-card" elevation="2">
        <v-card-title class="bg-blue-grey-lighten-5 pa-4">
          <v-icon icon="mdi-calendar-check" color="primary" class="mr-2"></v-icon>
          <span class="text-h6 text-primary font-weight-bold">
            {{
              selectedDate
                ? new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Select a Date'
            }}
          </span>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text class="pa-6">
          <template v-if="!selectedDate">
            <div class="text-center text-grey-darken-1 py-12">
              <v-icon
                icon="mdi-cursor-default-click"
                size="64"
                class="mb-4 text-grey-lighten-1"
              ></v-icon>
              <p class="text-body-1">
                Click on a date in the calendar to view details
                {{ isAdmin ? 'and manage slots' : 'and schedule an appointment' }}.
              </p>
            </div>
          </template>
          <template v-else>
            <div v-if="isAdmin" class="admin-panel">
              <p class="text-body-2 text-grey-darken-1 mb-4">
                Set total available office slots for this day.
              </p>

              <v-text-field
                v-model.number="adminForm.am"
                label="Total AM Slots (Morning)"
                type="number"
                min="0"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="mdi-white-balance-sunny"
                color="primary"
                class="mb-2"
                hide-details
              ></v-text-field>

              <v-text-field
                v-model.number="adminForm.pm"
                label="Total PM Slots (Afternoon)"
                type="number"
                min="0"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="mdi-weather-night"
                color="secondary"
                class="mb-6 mt-4"
                hide-details
              ></v-text-field>

              <v-btn
                color="primary"
                block
                size="large"
                prepend-icon="mdi-content-save"
                @click="saveAdminForm"
              >
                Save Slots
              </v-btn>

              <v-divider class="my-6"></v-divider>
              <h4 class="text-subtitle-1 font-weight-bold mb-3">Available Unbooked Slots</h4>
              <v-list density="compact" class="bg-transparent pa-0">
                <v-list-item class="px-0">
                  <template v-slot:prepend
                    ><v-icon color="success" icon="mdi-account-clock mr-2"></v-icon
                  ></template>
                  <v-list-item-title>AM Available</v-list-item-title>
                  <template v-slot:append
                    ><span class="font-weight-bold">{{
                      selectedDayData?.remAM || 0
                    }}</span></template
                  >
                </v-list-item>
                <v-list-item class="px-0">
                  <template v-slot:prepend
                    ><v-icon color="success" icon="mdi-account-clock mr-2"></v-icon
                  ></template>
                  <v-list-item-title>PM Available</v-list-item-title>
                  <template v-slot:append
                    ><span class="font-weight-bold">{{
                      selectedDayData?.remPM || 0
                    }}</span></template
                  >
                </v-list-item>
              </v-list>
            </div>

            <div v-else class="user-panel">
              <div v-if="selectedDayData?.isPast && false" class="text-center py-6">
                <!-- Disabled -->
              </div>
              <div v-else>
                <div class="mb-8">
                  <div class="d-flex flex-column gap-4 justify-space-between">
                    <v-alert
                      :color="(selectedDayData?.remAM ?? 0) > 0 ? 'success' : 'grey'"
                      :icon="(selectedDayData?.remAM ?? 0) > 0 ? 'mdi-check-circle' : 'mdi-cancel'"
                      variant="tonal"
                      class="d-flex align-center justify-space-between py-3 px-4 rounded-lg"
                    >
                      <div class="d-flex flex-column" style="width: 100%">
                        <div class="d-flex justify-space-between align-center mb-1">
                          <span class="font-weight-bold text-subtitle-1"
                            ><v-icon
                              icon="mdi-white-balance-sunny"
                              size="small"
                              class="mr-1"
                            ></v-icon>
                            AM Slots</span
                          >
                          <v-chip
                            size="small"
                            :color="(selectedDayData?.remAM ?? 0) > 0 ? 'success' : 'grey'"
                          >
                            {{ selectedDayData?.remAM ?? 0 }} Left
                          </v-chip>
                        </div>
                        <div class="d-flex justify-space-between align-center mt-1">
                          <span class="text-caption">Morning Appointments</span>
                          <v-btn
                            v-if="(selectedDayData?.remAM ?? 0) > 0"
                            size="small"
                            color="success"
                            variant="elevated"
                            @click="$emit('request-booking', selectedDate, 'AM')"
                          >
                            Schedule AM
                          </v-btn>
                        </div>
                      </div>
                    </v-alert>

                    <v-alert
                      :color="(selectedDayData?.remPM ?? 0) > 0 ? 'success' : 'grey'"
                      :icon="(selectedDayData?.remPM ?? 0) > 0 ? 'mdi-check-circle' : 'mdi-cancel'"
                      variant="tonal"
                      class="d-flex align-center justify-space-between py-3 px-4 rounded-lg"
                    >
                      <div class="d-flex flex-column" style="width: 100%">
                        <div class="d-flex justify-space-between align-center mb-1">
                          <span class="font-weight-bold text-subtitle-1"
                            ><v-icon icon="mdi-weather-night" size="small" class="mr-1"></v-icon> PM
                            Slots</span
                          >
                          <v-chip
                            size="small"
                            :color="(selectedDayData?.remPM ?? 0) > 0 ? 'success' : 'grey'"
                          >
                            {{ selectedDayData?.remPM ?? 0 }} Left
                          </v-chip>
                        </div>
                        <div class="d-flex justify-space-between align-center mt-1">
                          <span class="text-caption">Afternoon Appointments</span>
                          <v-btn
                            v-if="(selectedDayData?.remPM ?? 0) > 0"
                            size="small"
                            color="success"
                            variant="elevated"
                            @click="$emit('request-booking', selectedDate, 'PM')"
                          >
                            Schedule PM
                          </v-btn>
                        </div>
                      </div>
                    </v-alert>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
.calendar-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}
.calendar-header {
  border-bottom: 2px solid #2e7d32;
}
.calendar-grid {
  display: flex;
  flex-direction: column;
}
.calendar-row {
  display: flex;
  width: 100%;
}
.header-row {
  background-color: #1b5e20;
}
.calendar-cell {
  flex: 1;
  text-align: center;
  padding: 12px 4px;
  border-right: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
}
.calendar-cell:last-child {
  border-right: none;
}
.day-cell {
  min-height: 100px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  background-color: #fff;
}
.day-cell:hover:not(.empty-cell) {
  background-color: #f1f8e9;
}
.empty-cell {
  background-color: #fafafa;
  cursor: default;
}
.past-cell {
  background-color: #f5f5f5;
  opacity: 0.7;
}
.selected-cell {
  background-color: #e8f5e9;
  border: 2px solid #4caf50;
  box-shadow: inset 0 0 0 1px #4caf50;
}
.today-cell {
  position: relative;
}
.today-cell::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  background-color: #1976d2;
  border-radius: 50%;
}
.detail-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}
</style>
