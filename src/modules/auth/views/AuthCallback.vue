<!-- src/modules/auth/views/AuthCallback.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { handleOAuthCallback, error: authError } = useAuth()

const isLoading = ref(true)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    // Handle the OAuth callback (Google OAuth is only for regular users)
    const result = await handleOAuthCallback()

    if (!result?.success) {
      errorMessage.value = result?.error || authError.value || 'Authentication failed'
      // Redirect to account page with error after a delay
      setTimeout(() => {
        router.push({ name: 'account', query: { error: 'auth_failed' } })
      }, 3000)
    }
    // If successful, handleOAuthCallback will redirect to the user dashboard
  } catch (err) {
    console.error('Auth callback error:', err)
    errorMessage.value = 'An unexpected error occurred'
    setTimeout(() => {
      router.push({ name: 'account', query: { error: 'auth_failed' } })
    }, 3000)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <v-app>
    <v-main class="callback-page">
      <v-container class="fill-height">
        <v-row align="center" justify="center">
          <v-col cols="12" md="6" class="text-center">
            <!-- Loading State -->
            <div v-if="isLoading" class="loading-container">
              <v-progress-circular
                indeterminate
                color="green-darken-2"
                size="64"
                width="6"
              ></v-progress-circular>
              <h2 class="text-h5 mt-6 font-weight-medium">Completing sign in...</h2>
              <p class="text-body-2 text-grey-darken-1 mt-2">
                Please wait while we verify your account
              </p>
            </div>

            <!-- Error State -->
            <div v-else-if="errorMessage" class="error-container">
              <v-avatar size="80" color="red-lighten-5" class="mb-4">
                <v-icon size="48" color="red-darken-2">mdi-alert-circle-outline</v-icon>
              </v-avatar>
              <h2 class="text-h5 font-weight-medium mb-2">Authentication Failed</h2>
              <p class="text-body-1 text-grey-darken-1 mb-4">{{ errorMessage }}</p>
              <p class="text-body-2 text-grey-darken-1">Redirecting you back to sign in...</p>
            </div>

            <!-- Success State (brief) -->
            <div v-else class="success-container">
              <v-avatar size="80" color="green-lighten-5" class="mb-4">
                <v-icon size="48" color="green-darken-2">mdi-check-circle-outline</v-icon>
              </v-avatar>
              <h2 class="text-h5 font-weight-medium">Success!</h2>
              <p class="text-body-2 text-grey-darken-1 mt-2">Redirecting to dashboard...</p>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.callback-page {
  background: linear-gradient(135deg, #f0f9f0 0%, #e8f5e9 50%, #c8e6c9 100%);
  min-height: 100vh;
}

.loading-container,
.error-container,
.success-container {
  padding: 40px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
</style>
