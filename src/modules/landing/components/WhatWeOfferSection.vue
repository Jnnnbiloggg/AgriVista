<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../../../utils/supabase'

interface OfferCard {
  title: string
  subtitle: string
  description: string
  icon: string
  image: string
  buttonText: string
  previewType: 'products' | 'activities' | 'trainings' | 'announcements'
  action: () => void
}

const router = useRouter()

// Preview dialog state
const showPreviewDialog = ref(false)
const previewTitle = ref('')
const previewItems = ref<any[]>([])
const previewLoading = ref(false)
const previewType = ref<'products' | 'activities' | 'trainings' | 'announcements'>('products')

// Fetch preview data from Supabase
async function fetchPreviewProducts() {
  previewLoading.value = true
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, images, stock')
      .gt('stock', 0)
      .order('created_at', { ascending: false })
      .limit(6)
    if (error) {
      console.error('Error fetching products preview:', error)
    }
    previewItems.value = data || []
  } catch (err) {
    console.error('Error fetching products preview:', err)
    previewItems.value = []
  } finally {
    previewLoading.value = false
  }
}

async function fetchPreviewActivities() {
  previewLoading.value = true
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('activities')
      .select('id, name, description, type, location, date, time, image_url, capacity')
      .or(`archived_at.gt.${now},archived_at.is.null`)
      .order('date', { ascending: true })
      .limit(6)
    if (error) {
      console.error('Error fetching activities preview:', error)
    }
    previewItems.value = data || []
  } catch (err) {
    console.error('Error fetching activities preview:', err)
    previewItems.value = []
  } finally {
    previewLoading.value = false
  }
}

async function fetchPreviewTrainings() {
  previewLoading.value = true
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('trainings')
      .select(
        'id, name, description, location, start_date_time, end_date_time, capacity, image_url, topics',
      )
      .or(`archived_at.gt.${now},archived_at.is.null`)
      .order('start_date_time', { ascending: true })
      .limit(6)
    if (error) {
      console.error('Error fetching trainings preview:', error)
    }
    previewItems.value = data || []
  } catch (err) {
    console.error('Error fetching trainings preview:', err)
    previewItems.value = []
  } finally {
    previewLoading.value = false
  }
}

async function fetchPreviewAnnouncements() {
  previewLoading.value = true
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, description, duration, image_url, created_at')
      .or(`visible_until.gt.${now},visible_until.is.null`)
      .order('created_at', { ascending: false })
      .limit(6)
    if (error) {
      console.error('Error fetching announcements preview:', error)
    }
    previewItems.value = data || []
  } catch (err) {
    console.error('Error fetching announcements preview:', err)
    previewItems.value = []
  } finally {
    previewLoading.value = false
  }
}

// Open preview dialog
function openPreview(type: 'products' | 'activities' | 'trainings' | 'announcements') {
  previewType.value = type
  previewItems.value = []

  switch (type) {
    case 'products':
      previewTitle.value = 'Farm Products'
      fetchPreviewProducts()
      break
    case 'activities':
      previewTitle.value = 'Farm Activities'
      fetchPreviewActivities()
      break
    case 'trainings':
      previewTitle.value = 'Training Programs'
      fetchPreviewTrainings()
      break
    case 'announcements':
      previewTitle.value = 'Announcements'
      fetchPreviewAnnouncements()
      break
  }

  showPreviewDialog.value = true
}

// Navigation helpers
function goToProducts() {
  openPreview('products')
}

function goToAnnouncements() {
  openPreview('announcements')
}

function goToActivities() {
  openPreview('activities')
}

function goToSchedule() {
  router.push({ name: 'user-activities', query: { tab: 'appointments' } })
}

function goToPrograms() {
  openPreview('trainings')
}

// Navigate to full page from preview
function navigateToSection() {
  showPreviewDialog.value = false
  switch (previewType.value) {
    case 'products':
      router.push({ name: 'user-products' })
      break
    case 'activities':
      router.push({ name: 'user-activities' })
      break
    case 'trainings':
      router.push({ name: 'user-trainings' })
      break
    case 'announcements':
      router.push({ name: 'user-announcements' })
      break
  }
}

// Get CTA button text based on type
function getCtaText(type: 'products' | 'activities' | 'trainings' | 'announcements') {
  switch (type) {
    case 'products':
      return 'Learn More'
    case 'activities':
      return 'Book Now'
    case 'trainings':
      return 'Register Now'
    case 'announcements':
      return 'Read More'
  }
}

// Get CTA icon based on type
function getCtaIcon(type: 'products' | 'activities' | 'trainings' | 'announcements') {
  switch (type) {
    case 'products':
      return 'mdi-arrow-right'
    case 'activities':
      return 'mdi-calendar-check'
    case 'trainings':
      return 'mdi-clipboard-edit'
    case 'announcements':
      return 'mdi-arrow-right'
  }
}

// Get preview dialog icon
function getPreviewIcon(type: 'products' | 'activities' | 'trainings' | 'announcements') {
  switch (type) {
    case 'products':
      return 'mdi-basket'
    case 'activities':
      return 'mdi-leaf'
    case 'trainings':
      return 'mdi-account-group'
    case 'announcements':
      return 'mdi-bullhorn'
  }
}

// Truncate description
function truncateText(text: string | null, maxLength: number = 100) {
  if (!text) return 'No description available'
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

// Format price
function formatPrice(price: number) {
  return `₱${price.toLocaleString()}`
}

// Format date
function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Get preview item title (handles different field names per type)
function getItemTitle(item: any, type: 'products' | 'activities' | 'trainings' | 'announcements') {
  if (type === 'announcements') return item.title
  return item.name
}

// Get preview item image — use actual image_url or images[0], else null (show icon fallback)
function getPreviewImage(
  item: any,
  type: 'products' | 'activities' | 'trainings' | 'announcements',
): string | null {
  switch (type) {
    case 'products':
      return item.images && item.images.length > 0 ? item.images[0] : null
    case 'activities':
      return item.image_url || null
    case 'trainings':
      return item.image_url || null
    case 'announcements':
      return item.image_url || null
  }
}

// Get fallback icon per type
function getFallbackIcon(type: 'products' | 'activities' | 'trainings' | 'announcements') {
  switch (type) {
    case 'products':
      return 'mdi-basket-outline'
    case 'activities':
      return 'mdi-leaf'
    case 'trainings':
      return 'mdi-school-outline'
    case 'announcements':
      return 'mdi-bullhorn-outline'
  }
}

const offerCards: OfferCard[] = [
  {
    title: 'Farm Products',
    subtitle: 'Fresh Harvests Straight from Our Farm',
    description:
      "Browse and order fresh strawberries, herbs, vegetables, and other farm-grown products from Robrosa's. Everything is locally grown, naturally cultivated, and delivered fresh from the field to your table.",
    icon: 'mdi-basket',
    image: '/landing-page/offer-2.jpg',
    buttonText: 'BROWSE PRODUCTS',
    previewType: 'products',
    action: goToProducts,
  },
  {
    title: 'Announcement',
    subtitle: 'Stay Updated with Farm News & Events',
    description:
      "Be the first to know about strawberry harvest dates, seasonal promos, farm tours, training schedules, and special community events happening at Robrosa's. Check this space regularly for fresh updates straight from the field.",
    icon: 'mdi-bullhorn',
    image: '/landing-page/offer-1.jpg',
    buttonText: 'VIEW ANNOUNCEMENTS',
    previewType: 'announcements',
    action: goToAnnouncements,
  },
  {
    title: 'Farm Activities',
    subtitle: 'Strawberry Picking, Herb Trails & More',
    description:
      "Enjoy hands-on experiences like strawberry picking, organic gardening, planting demos, and guided farm walks. Whether you're a tourist or a student, there's something for everyone.",
    icon: 'mdi-leaf',
    image: '/landing-page/offer-2.jpg',
    buttonText: 'JOIN AN ACTIVITY',
    previewType: 'activities',
    action: goToActivities,
  },
  {
    title: 'Set an Appointment',
    subtitle: 'Plan Your Visit or Training Session',
    description:
      "Schedule your tour, group visit, or workshop at Robrosa's. Select your date, specify your group size, and get ready for an unforgettable agri-learning experience.",
    icon: 'mdi-calendar-check',
    image: '/landing-page/offer-3.png',
    buttonText: 'SCHEDULE NOW',
    previewType: 'activities',
    action: goToSchedule,
  },
  {
    title: 'Community Extension',
    subtitle: 'Learn and Grow with the Community',
    description:
      "Robrosa's is more than just a farm—it's a hub for agricultural learning. As a certified Learning Site for Agriculture, we offer training, demo sessions, and outreach programs for students, farmers, and barangay leaders.",
    icon: 'mdi-account-group',
    image: '/landing-page/offer-4.png',
    buttonText: 'SEE PROGRAMS',
    previewType: 'trainings',
    action: goToPrograms,
  },
]
</script>

<template>
  <section id="what-we-offer" class="what-we-offer-section">
    <!-- Header Section with Background Image and Green Overlay -->
    <div class="hero-background">
      <v-img src="/landing-page/offer-5.jpg" cover class="fill-height hero-image">
        <!-- Green Overlay -->
        <div class="green-overlay"></div>

        <!-- Content Overlay -->
        <div class="hero-overlay d-flex align-center justify-center fill-height">
          <v-container fluid>
            <v-row align="center" justify="center" class="fill-height">
              <v-col cols="12" md="10" lg="8" class="text-center">
                <h1 class="display-1 font-weight-bold text-white mb-6">
                  DISCOVER, EXPLORE, AND EXPERIENCE THE FARM
                </h1>
                <p class="text-h6 text-white mx-auto" style="max-width: 800px">
                  Experience the full charm of Robrosa's Strawberry and Herbs Farm, the first of its
                  kind in Butuan City. From farm appointments to fresh products, we bring you closer
                  to nature, learning, and local goodness—all in one place.
                </p>
              </v-col>
            </v-row>
          </v-container>
        </div>
      </v-img>
    </div>

    <v-container fluid class="cards-container">
      <!-- Cards Section -->
      <v-row>
        <v-col
          v-for="card in offerCards"
          :key="card.title"
          cols="12"
          sm="6"
          :md="offerCards.length === 5 ? undefined : 3"
          :class="offerCards.length === 5 ? 'offer-col-5' : ''"
        >
          <v-card class="fill-height d-flex flex-column offer-card" elevation="4">
            <v-card-item class="pa-5">
              <div class="d-flex align-center">
                <v-icon :icon="card.icon" size="48" color="primary" class="mr-3"></v-icon>
                <div class="flex-grow-1 d-flex flex-column">
                  <v-card-title class="text-h6 font-weight-bold pa-0">{{
                    card.title
                  }}</v-card-title>
                  <v-card-subtitle class="text-body-2 pa-0">{{ card.subtitle }}</v-card-subtitle>
                </div>
              </div>
            </v-card-item>

            <v-img :src="card.image" height="300" cover></v-img>

            <v-card-text class="flex-grow-1">
              <p class="text-body-2">{{ card.description }}</p>
            </v-card-text>

            <v-card-actions class="pa-5 mt-auto">
              <v-btn color="primary" variant="elevated" block rounded="lg" @click="card.action">
                {{ card.buttonText }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Preview Dialog -->
    <v-dialog v-model="showPreviewDialog" max-width="1000" scrollable>
      <v-card class="preview-dialog-card">
        <!-- Dialog Header -->
        <v-card-title class="pa-6 d-flex align-center justify-space-between preview-header">
          <div class="d-flex align-center">
            <v-icon
              :icon="getPreviewIcon(previewType)"
              size="32"
              color="primary"
              class="mr-3"
            ></v-icon>
            <div>
              <div class="text-h5 font-weight-bold">{{ previewTitle }}</div>
              <div class="text-caption text-grey-darken-1">Showing latest available items</div>
            </div>
          </div>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="showPreviewDialog = false"
          ></v-btn>
        </v-card-title>

        <v-divider></v-divider>

        <!-- Loading State -->
        <v-card-text v-if="previewLoading" class="pa-12 text-center">
          <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
          <div class="text-h6 text-grey-darken-1 mt-4">Loading preview...</div>
        </v-card-text>

        <!-- Empty State -->
        <v-card-text v-else-if="previewItems.length === 0" class="pa-12 text-center">
          <v-icon size="80" color="grey-lighten-1">{{ getFallbackIcon(previewType) }}</v-icon>
          <div class="text-h6 text-grey-darken-1 mt-4">No items available yet</div>
          <div class="text-body-2 text-grey mt-2">
            Check back later for new {{ previewTitle.toLowerCase() }}!
          </div>
        </v-card-text>

        <!-- Preview Items -->
        <v-card-text v-else class="pa-6">
          <v-row>
            <v-col v-for="item in previewItems" :key="item.id" cols="12" sm="6" md="4">
              <v-card class="fill-height preview-item-card" variant="outlined" rounded="lg">
                <!-- Item Image (if available) -->
                <v-img
                  v-if="getPreviewImage(item, previewType)"
                  :src="getPreviewImage(item, previewType)!"
                  height="160"
                  cover
                  class="preview-item-image"
                >
                  <!-- Price badge for products -->
                  <div v-if="previewType === 'products'" class="price-badge">
                    {{ formatPrice(item.price) }}
                  </div>
                  <!-- Type badge for activities -->
                  <div v-if="previewType === 'activities' && item.type" class="type-badge">
                    {{ item.type }}
                  </div>
                </v-img>

                <!-- Fallback icon when no image -->
                <div v-else class="preview-item-fallback d-flex align-center justify-center">
                  <v-icon
                    :icon="getFallbackIcon(previewType)"
                    size="64"
                    color="grey-lighten-1"
                  ></v-icon>
                  <!-- Price badge for products even without image -->
                  <div v-if="previewType === 'products'" class="price-badge">
                    {{ formatPrice(item.price) }}
                  </div>
                  <!-- Type badge for activities even without image -->
                  <div v-if="previewType === 'activities' && item.type" class="type-badge">
                    {{ item.type }}
                  </div>
                </div>

                <v-card-item class="pb-1">
                  <v-card-title class="text-subtitle-1 font-weight-bold">
                    {{ getItemTitle(item, previewType) }}
                  </v-card-title>
                </v-card-item>

                <v-card-text class="pt-0 pb-2 flex-grow-1">
                  <p class="text-body-2 text-grey-darken-1 preview-description">
                    {{ truncateText(item.description, 80) }}
                  </p>

                  <!-- Meta info chips -->
                  <div class="mt-2 d-flex flex-wrap ga-1">
                    <v-chip
                      v-if="previewType === 'activities' && item.date"
                      size="x-small"
                      color="secondary"
                      variant="tonal"
                    >
                      <v-icon start size="x-small">mdi-calendar</v-icon>
                      {{ formatDate(item.date) }}
                    </v-chip>
                    <v-chip
                      v-if="previewType === 'activities' && item.location"
                      size="x-small"
                      color="info"
                      variant="tonal"
                    >
                      <v-icon start size="x-small">mdi-map-marker</v-icon>
                      {{ item.location }}
                    </v-chip>
                    <v-chip
                      v-if="previewType === 'trainings' && item.start_date_time"
                      size="x-small"
                      color="secondary"
                      variant="tonal"
                    >
                      <v-icon start size="x-small">mdi-calendar</v-icon>
                      {{ formatDate(item.start_date_time) }}
                    </v-chip>
                    <v-chip
                      v-if="previewType === 'trainings' && item.location"
                      size="x-small"
                      color="info"
                      variant="tonal"
                    >
                      <v-icon start size="x-small">mdi-map-marker</v-icon>
                      {{ item.location }}
                    </v-chip>
                    <v-chip
                      v-if="previewType === 'products' && item.stock"
                      size="x-small"
                      :color="item.stock > 10 ? 'success' : 'warning'"
                      variant="tonal"
                    >
                      {{ item.stock }} in stock
                    </v-chip>
                    <v-chip
                      v-if="previewType === 'announcements' && item.created_at"
                      size="x-small"
                      color="grey"
                      variant="tonal"
                    >
                      <v-icon start size="x-small">mdi-calendar</v-icon>
                      {{ formatDate(item.created_at) }}
                    </v-chip>
                    <v-chip
                      v-if="previewType === 'announcements' && item.duration"
                      size="x-small"
                      color="primary"
                      variant="tonal"
                    >
                      <v-icon start size="x-small">mdi-clock-outline</v-icon>
                      {{ item.duration }}
                    </v-chip>
                  </div>
                </v-card-text>

                <v-card-actions class="px-4 pb-4">
                  <v-btn
                    color="primary"
                    variant="tonal"
                    block
                    size="small"
                    rounded="lg"
                    :prepend-icon="getCtaIcon(previewType)"
                    @click="navigateToSection"
                  >
                    {{ getCtaText(previewType) }}
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>

        <v-divider></v-divider>

        <!-- Dialog Footer -->
        <v-card-actions class="pa-4 d-flex justify-space-between">
          <v-btn variant="text" @click="showPreviewDialog = false">Close</v-btn>
          <v-btn color="primary" variant="elevated" rounded="lg" @click="navigateToSection">
            View All {{ previewTitle }}
            <v-icon end>mdi-arrow-right</v-icon>
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<style scoped>
.what-we-offer-section {
  min-height: 100svh;
  position: relative;
  overflow: hidden;
  background-color: #fafafa;
}

.hero-background {
  height: 60vh;
  position: relative;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}

.hero-image {
  width: 100%;
  height: 100%;
}

.green-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    to bottom,
    rgba(76, 175, 80, 0.9),
    rgba(76, 175, 80, 0.6),
    rgba(76, 175, 80, 0.3)
  );
  z-index: 1;
}

.hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
}

.cards-container {
  padding-top: 80px;
  padding-bottom: 80px;
}

/* 5-column layout for offer cards */
.offer-col-5 {
  flex: 0 0 20%;
  max-width: 20%;
}

@media (max-width: 960px) {
  .offer-col-5 {
    flex: 0 0 50%;
    max-width: 50%;
  }
}

@media (max-width: 600px) {
  .offer-col-5 {
    flex: 0 0 100%;
    max-width: 100%;
  }
}

/* Offer card hover */
.offer-card {
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.offer-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
}

/* Preview dialog styles */
.preview-dialog-card {
  border-radius: 16px !important;
  overflow: hidden;
}

.preview-header {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.05), rgba(76, 175, 80, 0.02));
}

.preview-item-card {
  transition: all 0.3s ease;
  overflow: hidden;
}

.preview-item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border-color: rgba(76, 175, 80, 0.4) !important;
}

.preview-item-image {
  position: relative;
}

.preview-item-fallback {
  height: 160px;
  position: relative;
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
}

.price-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(76, 175, 80, 0.9);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.85rem;
  backdrop-filter: blur(4px);
}

.type-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(33, 150, 243, 0.85);
  color: white;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  backdrop-filter: blur(4px);
}

.preview-description {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .display-1 {
    font-size: 2.5rem !important;
  }

  .text-h4 {
    font-size: 1.8rem !important;
  }
}

@media (max-width: 600px) {
  .display-1 {
    font-size: 2rem !important;
  }

  .text-h4 {
    font-size: 1.5rem !important;
  }

  .text-h6 {
    font-size: 1.1rem !important;
  }
}
</style>
