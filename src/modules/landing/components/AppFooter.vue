<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../../../../utils/supabase'

interface NavigationItem {
  title: string
  id: string
  route?: string
}

const props = defineProps<{
  navigationItems: NavigationItem[]
}>()

const emit = defineEmits<{
  navigate: [section: string]
}>()

const email = ref('')
const isSubscribing = ref(false)
const subscriptionMessage = ref('')
const showMessage = ref(false)

const handleNavigation = (item: NavigationItem) => {
  if (item.route) {
    // For router navigation in the future
    // router.push(item.route)
  } else if (item.id) {
    // For section scrolling
    emit('navigate', item.id)
  }
}

const handleSubscribe = async () => {
  if (!email.value || !email.value.includes('@')) {
    subscriptionMessage.value = 'Please enter a valid email address'
    showMessage.value = true
    setTimeout(() => {
      showMessage.value = false
    }, 3000)
    return
  }

  isSubscribing.value = true

  try {
    // Check if email already exists
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .eq('email', email.value.toLowerCase())
      .single()

    if (existing) {
      if (existing.is_active) {
        subscriptionMessage.value = 'You are already subscribed to our newsletter!'
      } else {
        // Reactivate subscription
        const { error: updateError } = await supabase
          .from('newsletter_subscribers')
          .update({ is_active: true, unsubscribed_at: null })
          .eq('email', email.value.toLowerCase())

        if (updateError) throw updateError

        subscriptionMessage.value = 'Welcome back! Your subscription has been reactivated.'
      }
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('newsletter_subscribers')
        .insert([{ email: email.value.toLowerCase() }])

      if (insertError) throw insertError

      subscriptionMessage.value =
        'Thank you for subscribing! You will receive updates about new announcements.'
    }

    showMessage.value = true
    email.value = ''

    setTimeout(() => {
      showMessage.value = false
    }, 5000)
  } catch (err: any) {
    console.error('Error subscribing to newsletter:', err)
    subscriptionMessage.value = 'Oops! Something went wrong. Please try again later.'
    showMessage.value = true

    setTimeout(() => {
      showMessage.value = false
    }, 3000)
  } finally {
    isSubscribing.value = false
  }
}
</script>

<template>
  <footer class="footer-section">
    <v-container class="footer-container">
      <v-row>
        <!-- Left Column - Logo -->
        <v-col cols="12" md="4" class="text-center">
          <img
            src="/logo-cropped.png"
            alt="AgriVista"
            class="mb-4"
            style="max-height: 80px; width: auto"
          />
          <p class="text-body-2 text-primary">
            Connecting you with Robrosa's Strawberry & Herbs Farm
          </p>
        </v-col>

        <!-- Center Column - Navigation Links -->
        <v-col cols="12" md="4" class="text-center">
          <h4 class="text-h6 font-weight-bold mb-4 text-primary">Our Links</h4>
          <div class="d-flex flex-column">
            <a
              v-for="item in navigationItems"
              :key="item.id"
              @click="handleNavigation(item)"
              class="nav-link mb-2"
            >
              {{ item.title }}
            </a>
          </div>
        </v-col>

        <!-- Right Column - Newsletter -->
        <v-col cols="12" md="4" class="text-center text-md-left">
          <h4 class="text-h6 font-weight-bold mb-4 text-primary">Newsletter</h4>
          <p class="text-body-2 text-primary mb-4 text-left">Receive news straight to your inbox</p>

          <!-- Subscription Form -->
          <div class="d-flex align-center" style="gap: 12px">
            <v-text-field
              v-model="email"
              placeholder="Enter your email"
              variant="outlined"
              density="compact"
              hide-details
              class="flex-grow-1"
              :disabled="isSubscribing"
              @keyup.enter="handleSubscribe"
            ></v-text-field>
            <v-btn
              color="primary"
              variant="elevated"
              rounded
              :loading="isSubscribing"
              :disabled="isSubscribing"
              @click="handleSubscribe"
              class="flex-shrink-0"
            >
              Subscribe
            </v-btn>
          </div>

          <!-- Subscription Message -->
          <v-fade-transition>
            <v-alert
              v-if="showMessage"
              :type="
                subscriptionMessage.includes('already') ||
                subscriptionMessage.includes('Thank you') ||
                subscriptionMessage.includes('Welcome')
                  ? 'success'
                  : 'error'
              "
              variant="tonal"
              density="compact"
              class="mt-3"
              closable
              @click:close="showMessage = false"
            >
              {{ subscriptionMessage }}
            </v-alert>
          </v-fade-transition>
        </v-col>
      </v-row>

      <v-divider class="my-6"></v-divider>

      <v-row>
        <v-col cols="12" class="text-center">
          <p class="text-body-2 text-primary">
            © 2025 AgriVista. All rights reserved. | Robrosa's Strawberry & Herbs Farm
          </p>
        </v-col>
      </v-row>
    </v-container>
  </footer>
</template>

<style scoped>
.footer-section {
  background-color: #f5f5f5;
  padding: 60px 0 40px 0;
  margin-top: 0;
}

.footer-container {
  max-width: 1200px;
  padding: 0 24px;
}

.nav-link {
  color: #4caf50;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.3s ease;
  padding: 4px 0;
}

.nav-link:hover {
  color: #388e3c;
  text-decoration: none;
}
</style>
