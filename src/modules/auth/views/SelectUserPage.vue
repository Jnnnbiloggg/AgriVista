<template>
  <v-app>
    <v-main class="role-selection-page">
      <!-- Background Image -->
      <div class="background-image"></div>

      <!-- Main Content Card -->
      <v-container class="fill-height d-flex align-center justify-center">
        <v-card class="role-card pa-8 pa-md-12" elevation="8" rounded="xl" max-width="900">
          <!-- Logo -->
          <div class="text-center mb-8">
            <div
              @click="goToLanding"
              class="pa-2 d-flex align-center justify-center mx-auto cursor-pointer"
            >
              <img src="/logo-cropped.png" alt="AgriVista" class="logo-image" />
            </div>
          </div>

          <!-- Heading -->
          <h1 class="text-center mb-4 font-weight-bold">Choose your role to get started</h1>
          <p class="text-center text-grey-darken-1 mb-8">Select how you want to use AgriVista</p>

          <!-- Error Alert -->
          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            class="mb-6"
            closable
            @click:close="errorMessage = ''"
          >
            {{ errorMessage }}
          </v-alert>

          <!-- Role Selection Cards -->
          <div class="role-options d-flex flex-row justify-center flex-wrap" style="gap: 24px">
            <!-- User Card -->
            <v-card
              class="role-option-card pa-6"
              elevation="2"
              rounded="lg"
              style="flex: 0 1 auto; max-width: 350px; min-width: 280px"
            >
              <div class="d-flex flex-column align-center text-center">
                <v-avatar size="80" color="#E8F5E9" class="mb-4">
                  <v-icon size="48" color="#4CAF50">mdi-account-outline</v-icon>
                </v-avatar>

                <h2 class="text-h5 font-weight-bold mb-3">User</h2>

                <p class="text-body-1 text-medium-emphasis mb-4">
                  Explore and book Robrosa's Strawberry and Herb farm experiences
                </p>

                <!-- Google Sign In Button -->
                <!-- <v-btn
                  class="google-btn mb-3"
                  variant="outlined"
                  block
                  size="large"
                  rounded="lg"
                  :loading="isLoading && selectedRole === 'user'"
                  @click="signInWithGoogle"
                >
                  <template #prepend>
                    <v-img
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      width="20"
                      height="20"
                      class="mr-2"
                    ></v-img>
                  </template>
                  Continue with Google
                </v-btn> -->

                <!-- Divider -->
                <!-- <div class="divider-section w-100 mb-3">
                  <v-divider></v-divider>
                  <span class="divider-text px-3">or</span>
                  <v-divider></v-divider>
                </div> -->

                <!-- Email Sign In Button -->
                <v-btn
                  color="green-darken-2"
                  variant="tonal"
                  block
                  size="large"
                  rounded="lg"
                  @click="selectRole('user')"
                >
                  <v-icon start>mdi-email-outline</v-icon>
                  Sign in
                  <!-- with Email -->
                </v-btn>

                <!-- User Notice -->
                <v-chip color="blue-grey" variant="tonal" size="small" class="mt-3">
                  <v-icon start size="small">mdi-information</v-icon>
                  User access via email and Google Auth
                </v-chip>
              </div>
            </v-card>

            <!-- Admin Card -->
            <v-card
              class="role-option-card admin-card pa-6"
              elevation="2"
              rounded="lg"
              hover
              @click="selectRole('admin')"
              style="flex: 0 1 auto; max-width: 350px; min-width: 280px; cursor: pointer"
            >
              <div class="d-flex flex-column align-center text-center">
                <v-avatar size="80" color="#E8F5E9" class="mb-4">
                  <v-icon size="48" color="#4CAF50">mdi-account-cowboy-hat</v-icon>
                </v-avatar>

                <h2 class="text-h5 font-weight-bold mb-3">Admin</h2>

                <p class="text-body-1 text-medium-emphasis mb-4">
                  Manage Robrosa's Strawberry and Herb farm platform
                </p>

                <!-- Email Sign In Button -->
                <v-btn
                  color="green-darken-2"
                  variant="flat"
                  block
                  size="large"
                  rounded="lg"
                  @click.stop="selectRole('admin')"
                >
                  <v-icon start>mdi-email-outline</v-icon>
                  Sign in
                  <!-- with Email -->
                </v-btn>

                <!-- Admin Notice -->
                <v-chip color="blue-grey" variant="tonal" size="small" class="mt-3">
                  <v-icon start size="small">mdi-information</v-icon>
                  Admin access via email only
                </v-chip>
              </div>
            </v-card>
          </div>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { signInWithGoogle: googleSignIn, error: authError, loading: authLoading } = useAuth()

const selectedRole = ref<'user' | 'admin' | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')

const selectRole = (role: 'user' | 'admin') => {
  router.push({ name: 'account', query: { role } })
}

const signInWithGoogle = async () => {
  selectedRole.value = 'user'
  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await googleSignIn()
    if (!result?.success) {
      errorMessage.value = authError.value || 'Failed to initiate Google sign in'
    }
    // If successful, user will be redirected to Google
  } catch (err) {
    console.error('Google sign in error:', err)
    errorMessage.value = 'An unexpected error occurred'
  } finally {
    isLoading.value = false
  }
}

const goToLanding = () => {
  router.push('/')
}
</script>

<style scoped>
.role-selection-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

.background-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/auth/register-bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

.role-card {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(10px);
}

.logo-image {
  max-width: 120px;
  height: auto;
  object-fit: contain;
}

.logo-container {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.cursor-pointer {
  cursor: pointer;
}

.role-option-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
  height: 100%;
}

.role-option-card:hover {
  border-color: #4caf50;
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.2) !important;
}

.role-options {
  gap: 24px;
}

.google-btn {
  text-transform: none;
  font-weight: 500;
  border-color: #dadce0;
  color: #3c4043;
  transition: all 0.3s ease;
}

.google-btn:hover {
  background-color: #f7f8f8 !important;
  border-color: #dadce0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.divider-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.divider-text {
  color: #9e9e9e;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}
</style>
