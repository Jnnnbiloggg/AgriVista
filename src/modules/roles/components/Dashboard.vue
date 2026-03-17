<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, inject, type Ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRouter } from 'vue-router'
import { useDashboard } from '../composables/useDashboard'
import { useAnnouncements } from '../composables/useAnnouncements'
import StatusBadge from './shared/StatusBadge.vue'
import PageHeader from './shared/PageHeader.vue'
import AppSnackbar from '@/components/shared/AppSnackbar.vue'
import { useSnackbar } from '@/composables/useSnackbar'
import { usePageActions } from '@/composables/usePageActions'
import { formatDate } from '@/utils/formatters'

interface Props {
  userType: 'admin' | 'user'
}

const props = defineProps<Props>()

const router = useRouter()
const drawer = inject<Ref<boolean>>('drawer')

const {
  activities,
  loading: dashboardLoading,
  error: dashboardError,
  fetchDashboardActivities,
  setupRealtimeSubscription: setupDashboardRealtime,
} = useDashboard()

const {
  announcements,
  fetchAnnouncements,
  setupRealtimeSubscription: setupAnnouncementsRealtime,
} = useAnnouncements()

const { snackbar, snackbarMessage, snackbarColor, showSnackbar } = useSnackbar()

const { handleSettingsClick } = usePageActions({
  userType: props.userType,
})

const isHovering = ref(false)

const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null

const farmLocation = ref({
  lat: 9.00785805205403,
  lng: 125.69000590658155,
  name: "Robrosa's Farm",
  address: 'Purok 4-Sitio Tagkiling, Brgy. Anticala 8600 Butuan City, Philippines',
})

const initializeMap = () => {
  if (!mapContainer.value) return

  map = L.map(mapContainer.value).setView([farmLocation.value.lat, farmLocation.value.lng], 17)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)

  const customIcon = L.icon({
    iconUrl: '/logo-cropped.png',
    iconSize: [55, 55], // Size of the icon
    iconAnchor: [27, 55], // Point of the icon which will correspond to marker's location
    popupAnchor: [0, -55], // Point from which the popup should open relative to the iconAnchor
  })

  const marker = L.marker([farmLocation.value.lat, farmLocation.value.lng], {
    icon: customIcon,
  }).addTo(map)

  marker.bindPopup(`
    <div style="text-align: center;">
      <strong>${farmLocation.value.name}</strong><br/>
      <span style="font-size: 0.9em;">${farmLocation.value.address}</span>
    </div>
  `)
}

onMounted(async () => {
  await Promise.all([fetchAnnouncements(), fetchDashboardActivities()])
  setupDashboardRealtime()
  setupAnnouncementsRealtime()

  setTimeout(() => {
    initializeMap()
  }, 100)
})

onBeforeUnmount(() => {
  if (userMarker) userMarker.remove()
  if (routeLine) routeLine.remove()
  if (map) {
    map.remove()
    map = null
  }
})

const goToAnnouncement = (id: number) => {
  const prefix = props.userType === 'admin' ? '/admin' : '/user'
  router.push(`${prefix}/announcements?id=${id}`)
}

const pageTitle = computed(() => (props.userType === 'admin' ? 'Admin Dashboard' : 'Welcome Back!'))

const pageSubtitle = computed(() =>
  props.userType === 'admin'
    ? "Manage Robrosa's Farm operations and analytics"
    : "Here's what's happening at Robrosa's Farm",
)

const getStatusColor = (status: string) => {
  switch (status) {
    case 'upcoming':
      return 'info'
    case 'ongoing':
      return 'warning'
    case 'completed':
      return 'success'
    default:
      return 'grey'
  }
}

const carouselCycle = computed(() => !isHovering.value)

const userLocation = ref<{ lat: number; lng: number } | null>(null)
const isLocating = ref(false)
const locationError = ref<string | null>(null)
let userMarker: L.Marker | null = null
let routeLine: L.Polyline | null = null

const directionsUrl = computed(() => {
  if (userLocation.value) {
    return `https://www.openstreetmap.org/directions?from=${userLocation.value.lat}%2C${userLocation.value.lng}&to=${farmLocation.value.lat}%2C${farmLocation.value.lng}`
  }
  return `https://www.openstreetmap.org/?mlat=${farmLocation.value.lat}&mlon=${farmLocation.value.lng}#map=15/${farmLocation.value.lat}/${farmLocation.value.lng}`
})

const locateUser = () => {
  if (!navigator.geolocation) {
    locationError.value = 'Geolocation is not supported by your browser'
    return
  }

  isLocating.value = true
  locationError.value = null

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords
      userLocation.value = { lat: latitude, lng: longitude }
      isLocating.value = false

      if (!map) return

      // Remove existing user marker and route line
      if (userMarker) {
        userMarker.remove()
        userMarker = null
      }
      if (routeLine) {
        routeLine.remove()
        routeLine = null
      }

      // Add user location marker
      const userIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 16px; height: 16px;
          background: #1976D2;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

      userMarker = L.marker([latitude, longitude], { icon: userIcon })
        .addTo(map)
        .bindPopup('<strong>Your Location</strong>')
        .openPopup()

      // Draw a dashed line from user to farm
      routeLine = L.polyline(
        [
          [latitude, longitude],
          [farmLocation.value.lat, farmLocation.value.lng],
        ],
        { color: '#1976D2', weight: 2, dashArray: '6, 8', opacity: 0.8 },
      ).addTo(map)

      // Fit map to show both points
      const bounds = L.latLngBounds(
        [latitude, longitude],
        [farmLocation.value.lat, farmLocation.value.lng],
      )
      map.fitBounds(bounds, { padding: [40, 40] })
    },
    (err) => {
      isLocating.value = false
      switch (err.code) {
        case err.PERMISSION_DENIED:
          locationError.value = 'Location access denied. Please allow location in browser settings.'
          break
        case err.POSITION_UNAVAILABLE:
          locationError.value = 'Location information is unavailable.'
          break
        case err.TIMEOUT:
          locationError.value = 'Location request timed out.'
          break
        default:
          locationError.value = 'Failed to get your location.'
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  )
}

const resetMapView = () => {
  if (map) {
    map.setView([farmLocation.value.lat, farmLocation.value.lng], 17)
  }
}
</script>

<template>
  <div class="dashboard-container">
    <!-- Page Header -->
    <PageHeader
      :title="pageTitle"
      :subtitle="pageSubtitle"
      :user-type="userType"
      :show-search="false"
      @settings-click="handleSettingsClick"
    />

    <!-- Loading State -->
    <div v-if="dashboardLoading && announcements.length === 0" class="text-center py-12">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="text-h6 mt-4">Loading dashboard...</p>
    </div>

    <!-- Error State -->
    <v-alert v-if="dashboardError" type="error" class="mb-6" closable>
      {{ dashboardError }}
    </v-alert>

    <!-- Main Dashboard Content -->
    <v-row v-if="!dashboardLoading || announcements.length > 0">
      <!-- Left Column: Carousel and Map -->
      <v-col cols="12" md="6">
        <v-row>
          <v-col cols="12">
            <v-card class="modern-card fill-height">
              <v-card-title class="d-flex justify-space-between align-center pa-6">
                <!-- <span class="text-h6">Farm Highlights</span> -->
                <v-btn
                  v-if="userType === 'admin'"
                  color="primary"
                  variant="text"
                  size="small"
                  to="/admin/announcements"
                >
                  Manage
                </v-btn>
              </v-card-title>

              <v-divider></v-divider>

              <v-card-text class="pa-0">
                <!-- Carousel -->
                <div v-if="announcements.length > 0">
                  <v-carousel
                    height="580"
                    class="farm-highlights-carousel pointer-cursor"
                    :cycle="carouselCycle"
                    :show-arrows="announcements.length > 1"
                    hide-delimiter-background
                    @mouseenter="isHovering = true"
                    @mouseleave="isHovering = false"
                  >
                    <v-carousel-item
                      v-for="slide in announcements.slice(0, 5)"
                      :key="slide.id"
                      @click="goToAnnouncement(slide.id)"
                    >
                      <div class="d-flex flex-column h-100">
                        <v-img
                          :src="slide.image_url || '/placeholder.jpg'"
                          height="420"
                          cover
                        ></v-img>
                        <div
                          class="pa-6 bg-white flex-grow-1 d-flex flex-column justify-center align-start"
                        >
                          <h2 class="text-h5 font-weight-bold mb-2">{{ slide.title }}</h2>
                          <p
                            class="text-body-2 mb-0 text-grey-darken-2"
                            style="
                              display: -webkit-box;
                              -webkit-line-clamp: 2;
                              line-clamp: 2;
                              -webkit-box-orient: vertical;
                              overflow: hidden;
                              text-overflow: ellipsis;
                            "
                          >
                            {{ slide.description }}
                          </p>
                        </div>
                      </div>
                    </v-carousel-item>
                  </v-carousel>
                </div>

                <!-- Empty State -->
                <div v-else class="text-center py-12">
                  <v-icon icon="mdi-image-off" size="80" color="grey-lighten-1"></v-icon>
                  <p class="text-h6 mt-4">No announcements yet</p>
                  <p class="text-body-2 text-grey">Check back later</p>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>

      <!-- Right Column: Activities -->
      <v-col cols="12" md="6">
        <v-row>
          <!-- Farm Location Map -->
          <v-col cols="12">
            <v-card class="modern-card">
              <v-card-title class="pa-6">
                <v-icon icon="mdi-map-marker" class="mr-2" color="primary"></v-icon>
                <span class="text-h6">Farm Location</span>
              </v-card-title>

              <v-divider></v-divider>

              <v-card-text class="pa-4">
                <!-- Leaflet Map -->
                <div class="map-container position-relative">
                  <div ref="mapContainer" class="leaflet-map"></div>

                  <!-- Reset Map Button -->
                  <v-btn
                    icon="mdi-crosshairs-gps"
                    size="small"
                    color="white"
                    elevation="2"
                    class="map-reset-btn"
                    @click="resetMapView"
                  ></v-btn>

                  <!-- Locate Me Button -->
                  <v-btn
                    :icon="isLocating ? undefined : 'mdi-map-marker-account'"
                    size="small"
                    color="primary"
                    elevation="2"
                    class="map-locate-btn"
                    :loading="isLocating"
                    @click="locateUser"
                  ></v-btn>
                </div>

                <!-- Location Error -->
                <v-alert
                  v-if="locationError"
                  type="warning"
                  density="compact"
                  class="mt-2"
                  closable
                  @click:close="locationError = null"
                >
                  {{ locationError }}
                </v-alert>

                <div class="mt-4">
                  <div class="d-flex align-center mb-2">
                    <v-icon
                      icon="mdi-map-marker"
                      size="small"
                      color="primary"
                      class="mr-2"
                    ></v-icon>
                    <span class="text-subtitle-2 font-weight-bold">{{ farmLocation.name }}</span>
                  </div>
                  <div class="d-flex align-center text-grey-darken-1">
                    <v-icon icon="mdi-map-marker-radius" size="small" class="mr-2"></v-icon>
                    <span class="text-body-2">{{ farmLocation.address }}</span>
                  </div>
                  <v-btn
                    :href="directionsUrl"
                    target="_blank"
                    color="primary"
                    variant="outlined"
                    size="small"
                    class="mt-3"
                    prepend-icon="mdi-directions"
                  >
                    {{ userLocation ? 'Get Directions from My Location' : 'Get Directions' }}
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Farm Activities -->
          <v-col cols="12">
            <v-card class="modern-card">
              <v-card-title class="pa-6">
                <v-icon icon="mdi-leaf" class="mr-2" color="success"></v-icon>
                <span class="text-h6">Upcoming Farm Activities</span>
              </v-card-title>

              <v-divider></v-divider>

              <v-card-text class="pa-4">
                <!-- Activities List -->
                <div v-if="activities.length > 0">
                  <v-list lines="two" class="py-0">
                    <v-list-item
                      v-for="(activity, index) in activities.slice(0, 5)"
                      :key="activity.id"
                      class="modern-list-item px-4 mb-3"
                    >
                      <template v-slot:prepend>
                        <v-avatar size="60" rounded="lg">
                          <v-img v-if="activity.image_url" :src="activity.image_url" cover></v-img>
                          <v-icon v-else icon="mdi-leaf"></v-icon>
                        </v-avatar>
                      </template>

                      <v-list-item-title class="font-weight-medium mb-1">
                        {{ activity.name }}
                      </v-list-item-title>

                      <v-list-item-subtitle class="text-caption">
                        <div class="d-flex align-center flex-wrap gap-2 mt-1">
                          <v-chip size="x-small" :color="getStatusColor(activity.status)">
                            {{ activity.status }}
                          </v-chip>
                          <span class="text-grey-darken-1">
                            <v-icon icon="mdi-map-marker" size="x-small"></v-icon>
                            {{ activity.location }}
                          </span>
                          <span class="text-grey-darken-1">
                            <v-icon icon="mdi-account-group" size="x-small"></v-icon>
                            {{ activity.enrolled_count }}/{{ activity.capacity }}
                          </span>
                        </div>
                      </v-list-item-subtitle>
                    </v-list-item>
                  </v-list>

                  <v-btn
                    :to="userType === 'admin' ? '/admin/activities' : '/user/activities'"
                    color="primary"
                    variant="text"
                    block
                    class="mt-2"
                  >
                    View All Activities
                  </v-btn>
                </div>

                <!-- Empty State -->
                <div v-else class="text-center py-8">
                  <v-icon icon="mdi-sprout-outline" size="60" color="grey-lighten-1"></v-icon>
                  <p class="text-body-2 text-grey mt-2">No activities scheduled yet</p>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

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
.dashboard-container {
  width: 100%;
}

/* Map Container */
.map-container {
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
}

.leaflet-map {
  width: 100%;
  height: 300px;
  border-radius: 12px;
  z-index: 1;
}

.map-reset-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
}

.map-locate-btn {
  position: absolute;
  margin-top: 5px;
  top: 50px;
  right: 10px;
  z-index: 1000;
}

/* Modern List Item */
.modern-list-item {
  border-radius: var(--radius-md) !important;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all var(--transition-fast);
  background-color: white;
}

.modern-list-item:hover {
  border-color: rgba(76, 175, 80, 0.3);
  background-color: rgba(76, 175, 80, 0.02);
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.1);
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .carousel-overlay {
    padding: 1rem;
  }

  .carousel-content h2 {
    font-size: 1.5rem;
  }

  .carousel-content p {
    font-size: 0.9rem;
  }
}

@media (max-width: 600px) {
  .carousel-content h2 {
    font-size: 1.25rem;
  }

  .carousel-content p {
    font-size: 0.85rem;
  }
}

/* Farm Highlights Carousel Customization */
:deep(.farm-highlights-carousel .v-carousel__controls) {
  top: 0;
  bottom: auto;
}

.pointer-cursor {
  cursor: pointer;
}
</style>
