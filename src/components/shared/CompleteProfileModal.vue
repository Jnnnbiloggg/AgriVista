<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '../../../utils/supabase'

const authStore = useAuthStore()

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const sexOptions = [
  { title: 'Male', value: 'male' },
  { title: 'Female', value: 'female' },
  { title: 'Prefer not to say', value: 'prefer_not_to_say' },
]

const form = ref({
  sex: authStore.userProfile?.sex || '',
  address: authStore.userProfile?.address || '',
  contactNumber: authStore.userProfile?.contactNumber || '',
})

// Keep form in sync if the store updates (e.g. after re-login)
watch(
  () => authStore.userProfile,
  (profile) => {
    if (profile) {
      form.value.sex = profile.sex || ''
      form.value.address = profile.address || ''
      form.value.contactNumber = profile.contactNumber || ''
    }
  },
)

const handleSave = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!form.value.sex) {
    errorMessage.value = 'Please select your sex.'
    return
  }
  if (!form.value.address.trim()) {
    errorMessage.value = 'Please enter your address.'
    return
  }
  if (!form.value.contactNumber.trim()) {
    errorMessage.value = 'Please enter your contact number.'
    return
  }

  loading.value = true
  try {
    const userId = authStore.userId
    const payload = {
      id: userId,
      sex: form.value.sex,
      address: form.value.address.trim(),
      contact_number: form.value.contactNumber.trim(),
    }

    const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' })

    if (error) throw error

    // Update auth store so modal goes away
    if (authStore.userProfile) {
      authStore.setUserProfile({
        ...authStore.userProfile,
        sex: payload.sex,
        address: payload.address,
        contactNumber: payload.contact_number,
      })
    }

    successMessage.value = 'Profile completed successfully!'
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to save profile. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="!authStore.isProfileComplete"
    persistent
    max-width="520"
    :close-on-back="false"
    :close-on-content-click="false"
  >
    <v-card rounded="xl" elevation="8">
      <!-- Header -->
      <div class="modal-header pa-6 pb-4">
        <div class="d-flex align-center mb-2">
          <v-avatar color="primary" size="44" class="mr-3">
            <v-icon color="white" size="24">mdi-account-edit</v-icon>
          </v-avatar>
          <div>
            <div class="text-h6 font-weight-bold">Complete Your Profile</div>
            <div class="text-caption text-grey-darken-1">Help us personalize your experience</div>
          </div>
        </div>
        <v-alert
          v-if="!successMessage"
          type="info"
          variant="tonal"
          density="compact"
          class="mt-3"
          border="start"
        >
          Please provide the following details to continue using AgriVista.
        </v-alert>
      </div>

      <v-divider />

      <v-card-text class="pa-6">
        <!-- Success state -->
        <div v-if="successMessage" class="text-center py-4">
          <v-icon color="success" size="56" class="mb-3">mdi-check-circle</v-icon>
          <div class="text-h6 font-weight-medium text-success">{{ successMessage }}</div>
        </div>

        <!-- Form -->
        <v-form v-else @submit.prevent="handleSave">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-select
            v-model="form.sex"
            :items="sexOptions"
            item-title="title"
            item-value="value"
            label="Sex *"
            variant="outlined"
            rounded="lg"
            class="mb-4"
          />

          <v-text-field
            v-model="form.contactNumber"
            label="Contact Number *"
            variant="outlined"
            rounded="lg"
            prepend-inner-icon="mdi-phone"
            placeholder="e.g. 09XX-XXX-XXXX"
            class="mb-4"
          />

          <v-text-field
            v-model="form.address"
            label="Address *"
            variant="outlined"
            rounded="lg"
            prepend-inner-icon="mdi-map-marker"
            placeholder="e.g. Barangay, Municipality, Province"
          />
        </v-form>
      </v-card-text>

      <v-divider v-if="!successMessage" />

      <v-card-actions v-if="!successMessage" class="pa-4">
        <v-spacer />
        <v-btn
          color="primary"
          variant="elevated"
          :loading="loading"
          size="large"
          rounded="lg"
          min-width="140"
          @click="handleSave"
        >
          <v-icon start>mdi-check</v-icon>
          Save & Continue
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.modal-header {
  background: linear-gradient(135deg, #f0f9f0 0%, #e8f5e9 100%);
}
</style>
