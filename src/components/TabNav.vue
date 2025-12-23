<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()

// Get tabs from settings (filtered by enabled pages)
const tabs = computed(() => settings.enabledPageDetails)

const currentTab = computed(() => route.path)

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <nav class="bg-slate-800 border-b border-slate-700">
    <div class="flex">
      <button
        v-for="tab in tabs"
        :key="tab.path"
        @click="navigate(tab.path)"
        class="flex-1 py-3 text-sm font-medium transition-colors relative"
        :class="
          currentTab === tab.path
            ? 'text-emerald-400'
            : 'text-slate-400 hover:text-slate-200'
        "
      >
        {{ tab.name }}
        <span
          v-if="currentTab === tab.path"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"
        />
      </button>
    </div>
  </nav>
</template>
