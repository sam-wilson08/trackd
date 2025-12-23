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

// Icon mapping for each page
const icons: Record<string, string> = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  data: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  nutrition: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  pb: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-50 pb-safe pb-4">
    <div class="flex">
      <button
        v-for="tab in tabs"
        :key="tab.path"
        @click="navigate(tab.path)"
        class="flex-1 py-3 flex flex-col items-center gap-1 transition-colors relative"
        :class="
          currentTab === tab.path
            ? 'text-emerald-400'
            : 'text-slate-400 hover:text-slate-200'
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            :d="icons[tab.id]"
          />
        </svg>
        <span class="text-xs font-medium">{{ tab.name }}</span>
        <span
          v-if="currentTab === tab.path"
          class="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400"
        />
      </button>
    </div>
  </nav>
</template>
