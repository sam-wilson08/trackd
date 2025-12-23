<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore, CONFIGURABLE_PAGES } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { supabase } from '@/lib/supabase'
import type { Reward, BodyMetric, ProteinIntake, CalorieIntake, PersonalBest } from '@/lib/database.types'

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()
const toast = useToastStore()

const isExporting = ref(false)

// Export data to CSV
async function exportData() {
  if (!auth.user?.id) return
  isExporting.value = true

  try {
    // Fetch all user data
    const [rewardsRes, metricsRes, proteinRes, caloriesRes, pbsRes] = await Promise.all([
      supabase.from('rewards').select('*').eq('user_id', auth.user.id),
      supabase.from('body_metrics').select('*').eq('user_id', auth.user.id),
      supabase.from('protein_intake').select('*').eq('user_id', auth.user.id),
      supabase.from('calorie_intake').select('*').eq('user_id', auth.user.id),
      supabase.from('personal_bests').select('*').eq('user_id', auth.user.id),
    ])

    // Create CSV content
    let csv = '=== Trak DATA EXPORT ===\n'
    csv += `Exported: ${new Date().toISOString()}\n\n`

    // Rewards
    csv += '=== REWARDS ===\n'
    csv += 'Name,Tracking Type,Streak Type,Target Days,Created,Completed,Claimed\n'
    for (const reward of (rewardsRes.data || []) as Reward[]) {
      csv += `"${reward.name}",${reward.tracking_type},${reward.streak_type},${reward.target_days},${reward.created_at},${reward.completed_at || ''},${reward.claimed_at || ''}\n`
    }

    // Body Metrics
    csv += '\n=== BODY METRICS ===\n'
    csv += 'Date,Fat (st),Fat (lbs),Muscle (st),Muscle (lbs)\n'
    for (const metric of (metricsRes.data || []) as BodyMetric[]) {
      csv += `${metric.recorded_at},${metric.fat_st || ''},${metric.fat_lbs || ''},${metric.muscle_st || ''},${metric.muscle_lbs || ''}\n`
    }

    // Protein Intake
    csv += '\n=== PROTEIN INTAKE ===\n'
    csv += 'Date,Grams\n'
    for (const intake of (proteinRes.data || []) as ProteinIntake[]) {
      csv += `${intake.recorded_at},${intake.grams}\n`
    }

    // Calorie Intake
    csv += '\n=== CALORIE INTAKE ===\n'
    csv += 'Date,Calories\n'
    for (const intake of (caloriesRes.data || []) as CalorieIntake[]) {
      csv += `${intake.recorded_at},${intake.calories}\n`
    }

    // Personal Bests
    csv += '\n=== PERSONAL BESTS ===\n'
    csv += 'Name,Created\n'
    for (const pb of (pbsRes.data || []) as PersonalBest[]) {
      csv += `"${pb.name}",${pb.created_at}\n`
    }

    // Download file
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Trak-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    toast.success('Data exported successfully!')
  } catch (e) {
    console.error('Failed to export data:', e)
    toast.error('Failed to export data')
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="bg-slate-800 border-b border-slate-700 px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="w-20">
          <button @click="router.push('/')" class="text-slate-400 hover:text-white">
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        </div>
        <h1 class="text-xl font-bold text-emerald-400">Settings</h1>
        <div class="w-20"></div>
      </div>
    </header>

    <main class="p-4">
      <!-- Appearance -->
      <section class="mb-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Appearance
        </h2>
        <div class="bg-slate-800 rounded-xl overflow-hidden">
          <button
            @click="settings.toggleTheme()"
            class="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700 transition-colors"
          >
            <div class="flex items-center gap-3">
              <svg
                class="w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  v-if="settings.theme === 'dark'"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
                <path
                  v-else
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <span>Theme</span>
            </div>
            <span class="text-slate-400 capitalize">{{ settings.theme }}</span>
          </button>
        </div>
      </section>

      <!-- Configure Pages -->
      <section class="mb-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Pages
        </h2>
        <div class="bg-slate-800 rounded-xl overflow-hidden">
          <div class="px-4 py-3">
            <p class="text-sm text-slate-400 mb-3">
              Select which pages to show (1-3)
            </p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="page in CONFIGURABLE_PAGES"
                :key="page.id"
                @click="settings.togglePage(page.id)"
                class="py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                :class="
                  settings.isPageEnabled(page.id)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                "
              >
                {{ page.name }}
              </button>
            </div>
            <p class="text-xs text-slate-500 mt-2">
              {{ settings.enabledPages.length }}/3 pages enabled (+ Home)
            </p>
          </div>
        </div>
      </section>

      <!-- Nutrition Tracking -->
      <section class="mb-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Nutrition Tracking
        </h2>
        <div class="bg-slate-800 rounded-xl overflow-hidden">
          <div class="px-4 py-3">
            <p class="text-sm text-slate-400 mb-3">What do you want to track?</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                @click="settings.setNutritionTracking('protein')"
                class="py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                :class="
                  settings.nutritionTracking === 'protein'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                "
              >
                Protein
              </button>
              <button
                @click="settings.setNutritionTracking('calories')"
                class="py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                :class="
                  settings.nutritionTracking === 'calories'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                "
              >
                Calories
              </button>
              <button
                @click="settings.setNutritionTracking('both')"
                class="py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                :class="
                  settings.nutritionTracking === 'both'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                "
              >
                Both
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Units -->
      <section class="mb-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Units</h2>
        <div class="bg-slate-800 rounded-xl overflow-hidden">
          <div class="px-4 py-3">
            <p class="text-sm text-slate-400 mb-3">Weight Unit</p>
            <div class="flex gap-2">
              <button
                @click="settings.setWeightUnit('imperial')"
                class="flex-1 py-2 rounded-lg font-medium transition-colors"
                :class="
                  settings.weightUnit === 'imperial'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                "
              >
                Imperial (st/lbs)
              </button>
              <button
                @click="settings.setWeightUnit('metric')"
                class="flex-1 py-2 rounded-lg font-medium transition-colors"
                :class="
                  settings.weightUnit === 'metric'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                "
              >
                Metric (kg)
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Data -->
      <section class="mb-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Data</h2>
        <div class="bg-slate-800 rounded-xl overflow-hidden">
          <button
            @click="exportData"
            :disabled="isExporting"
            class="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <div class="flex items-center gap-3">
              <svg
                class="w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span>{{ isExporting ? 'Exporting...' : 'Export Data (CSV)' }}</span>
            </div>
            <svg
              class="w-5 h-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </section>

      <!-- Account -->
      <section class="mb-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Account</h2>
        <div class="bg-slate-800 rounded-xl overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-700">
            <p class="text-sm text-slate-400">Email</p>
            <p class="text-white">{{ auth.user?.email }}</p>
          </div>
          <button
            @click="auth.signOut()"
            class="w-full px-4 py-3 flex items-center gap-3 text-red-400 hover:bg-slate-700 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
