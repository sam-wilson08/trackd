<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import ToastContainer from '@/components/ToastContainer.vue'

const auth = useAuthStore()
const settings = useSettingsStore()

onMounted(() => {
  auth.initialize()
  settings.initialize()
})
</script>

<template>
  <RouterView />
  <ToastContainer />
</template>
