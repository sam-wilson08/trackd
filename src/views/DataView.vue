<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import TabNav from '@/components/TabNav.vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useSettingsStore } from '@/stores/settings'
import type { BodyMetric } from '@/lib/database.types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()
const settings = useSettingsStore()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

const metrics = ref<BodyMetric[]>([])
const isLoading = ref(true)
const showForm = ref(false)
const activeGraph = ref<'fat' | 'muscle'>('fat')

// Form data
const fatSt = ref('')
const fatLbs = ref('')
const muscleSt = ref('')
const muscleLbs = ref('')
const recordedDate = ref('')
const isSubmitting = ref(false)

// Edit mode
const editingId = ref<string | null>(null)

// Get today's date in YYYY-MM-DD format for the date input
function getTodayDate() {
  const today = new Date()
  return today.toISOString().split('T')[0] ?? ''
}

// Initialize date with today
function resetForm() {
  fatSt.value = ''
  fatLbs.value = ''
  muscleSt.value = ''
  muscleLbs.value = ''
  recordedDate.value = getTodayDate()
  editingId.value = null
}

// Start editing a metric
function startEdit(metric: BodyMetric) {
  editingId.value = metric.id
  fatSt.value = metric.fat_st?.toString() || ''
  fatLbs.value = metric.fat_lbs?.toString() || ''
  muscleSt.value = metric.muscle_st?.toString() || ''
  muscleLbs.value = metric.muscle_lbs?.toString() || ''
  recordedDate.value = new Date(metric.recorded_at).toISOString().split('T')[0] ?? ''
  showForm.value = true
}

// Cancel editing
function cancelEdit() {
  resetForm()
  showForm.value = false
}

// Format st/lbs for display
function formatStLbs(st: number | null, lbs: number | null): string {
  const stVal = st || 0
  const lbsVal = lbs || 0
  if (stVal === 0 && lbsVal === 0) return '0'
  if (stVal === 0) return `${lbsVal} lbs`
  if (lbsVal === 0) return `${stVal} st`
  return `${stVal} st ${lbsVal} lbs`
}

// Convert st/lbs to total lbs for comparison
function toTotalLbs(st: number | null, lbs: number | null): number {
  return ((st || 0) * 14) + (lbs || 0)
}

// Get trend compared to previous entry (returns 'up', 'down', or 'same')
function getTrend(currentIndex: number, type: 'fat' | 'muscle'): 'up' | 'down' | 'same' | null {
  // sortedMetrics is newest first, so previous entry is at currentIndex + 1
  if (currentIndex >= sortedMetrics.value.length - 1) return null

  const current = sortedMetrics.value[currentIndex]
  const previous = sortedMetrics.value[currentIndex + 1]

  if (!current || !previous) return null

  const currentVal = type === 'fat'
    ? toTotalLbs(current.fat_st, current.fat_lbs)
    : toTotalLbs(current.muscle_st, current.muscle_lbs)
  const previousVal = type === 'fat'
    ? toTotalLbs(previous.fat_st, previous.fat_lbs)
    : toTotalLbs(previous.muscle_st, previous.muscle_lbs)

  if (currentVal > previousVal) return 'up'
  if (currentVal < previousVal) return 'down'
  return 'same'
}

const chartData = computed(() => {
  if (metrics.value.length === 0) return { labels: [], datasets: [] }

  const dataSource = metrics.value.map((m) => ({
    date: new Date(m.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    fatSt: m.fat_st || 0,
    fatLbs: m.fat_lbs || 0,
    muscleSt: m.muscle_st || 0,
    muscleLbs: m.muscle_lbs || 0,
  }))

  const labels = dataSource.map((d) => d.date)
  // Convert to total lbs for graphing (1 stone = 14 lbs)
  const data = dataSource.map((d) =>
    activeGraph.value === 'fat'
      ? d.fatSt * 14 + d.fatLbs
      : d.muscleSt * 14 + d.muscleLbs
  )

  return {
    labels,
    datasets: [
      {
        label: activeGraph.value === 'fat' ? 'Fat' : 'Muscle',
        data,
        borderColor: activeGraph.value === 'fat' ? '#f87171' : '#34d399',
        backgroundColor: activeGraph.value === 'fat' ? '#f8717133' : '#34d39933',
        tension: 0.3,
        fill: true,
      },
    ],
  }
})

const chartOptions = computed(() => {
  const dataset = chartData.value.datasets[0]
  const data = (dataset?.data ?? []) as number[]
  const minVal = data.length > 0 ? Math.min(...data) : 0
  const maxVal = data.length > 0 ? Math.max(...data) : 100
  const padding = 5 // 5 lbs padding either side

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: unknown) => {
            const ctx = context as { parsed: { y: number | null } }
            const totalLbs = ctx.parsed.y ?? 0
            const st = Math.floor(totalLbs / 14)
            const lbs = Math.round((totalLbs % 14) * 10) / 10
            return `${st} st ${lbs} lbs`
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: '#334155',
        },
        ticks: {
          color: '#94a3b8',
        },
      },
      y: {
        min: Math.max(0, minVal - padding),
        max: maxVal + padding,
        grid: {
          color: '#334155',
        },
        ticks: {
          color: '#94a3b8',
          callback: (value: string | number) => {
            const numValue = typeof value === 'string' ? parseFloat(value) : value
            const st = Math.floor(numValue / 14)
            const lbs = Math.round(numValue % 14)
            return `${st}st ${lbs}`
          },
        },
      },
    },
  }
})

async function loadMetrics() {
  if (!auth.user?.id) return
  isLoading.value = true
  try {
    const { data, error } = await supabase
      .from('body_metrics')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('recorded_at', { ascending: true })

    if (error) throw error
    metrics.value = (data ?? []) as BodyMetric[]
  } catch (e) {
    console.error('Failed to load metrics:', e)
  } finally {
    isLoading.value = false
  }
}

async function submitMetric() {
  if (!auth.user?.id) return
  isSubmitting.value = true

  try {
    const metricData = {
      user_id: auth.user.id,
      fat_st: fatSt.value ? parseInt(fatSt.value) : null,
      fat_lbs: fatLbs.value ? parseFloat(fatLbs.value) : null,
      muscle_st: muscleSt.value ? parseInt(muscleSt.value) : null,
      muscle_lbs: muscleLbs.value ? parseFloat(muscleLbs.value) : null,
      recorded_at: new Date(recordedDate.value).toISOString(),
    }

    if (editingId.value) {
      // Update existing
      const { error } = await supabase
        .from('body_metrics')
        .update(metricData)
        .eq('id', editingId.value)

      if (error) throw error
      toast.success('Entry updated!')
    } else {
      // Insert new
      const { error } = await supabase.from('body_metrics').insert(metricData as BodyMetric)

      if (error) throw error
      toast.success('Entry saved!')
    }

    // Reset form and reload
    resetForm()
    showForm.value = false
    await loadMetrics()
  } catch (e) {
    console.error('Failed to save metric:', e)
    toast.error('Failed to save entry')
  } finally {
    isSubmitting.value = false
  }
}

async function deleteMetric(id: string) {
  const confirmed = await confirmDialog.value?.open({
    title: 'Delete Entry',
    message: 'Are you sure you want to delete this weigh-in? This action cannot be undone.',
    confirmText: 'Delete',
    destructive: true,
  })

  if (!confirmed) return

  try {
    const { error } = await supabase.from('body_metrics').delete().eq('id', id)

    if (error) throw error
    await loadMetrics()
    toast.success('Entry deleted')
  } catch (e) {
    console.error('Failed to delete metric:', e)
    toast.error('Failed to delete entry')
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

onMounted(() => {
  resetForm()
  loadMetrics()
})

// Metrics sorted by date descending for the list
const sortedMetrics = computed(() => {
  return [...metrics.value].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  )
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="bg-slate-800 border-b border-slate-700 px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="w-20"></div>
        <h1 class="text-xl font-bold text-emerald-400">Trackd</h1>
        <div class="flex items-center gap-3 w-20 justify-end">
          <button
            @click="router.push('/goals')"
            class="text-slate-400 hover:text-white p-1"
            title="Goals"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </button>
          <button
            @click="auth.signOut()"
            class="text-slate-400 hover:text-white p-1"
            title="Sign Out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <TabNav />

    <main class="p-4">
      <!-- Toggle buttons -->
      <div class="flex gap-2 mb-4">
        <button
          @click="activeGraph = 'fat'"
          class="flex-1 py-2 rounded-lg font-medium transition-colors"
          :class="
            activeGraph === 'fat'
              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          "
        >
          Fat
        </button>
        <button
          @click="activeGraph = 'muscle'"
          class="flex-1 py-2 rounded-lg font-medium transition-colors"
          :class="
            activeGraph === 'muscle'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          "
        >
          Muscle
        </button>
      </div>

      <!-- Chart -->
      <div class="bg-slate-800 rounded-xl p-4 mb-4">
        <h2 class="text-sm font-medium text-slate-400 mb-3">
          {{ activeGraph === 'fat' ? 'Fat Weight' : 'Muscle Weight' }} Over Time
        </h2>
        <div class="h-64">
          <Line :data="chartData" :options="chartOptions" />
        </div>
        <p v-if="metrics.length === 0" class="text-xs text-slate-500 mt-2 text-center">
          No data yet. Add your first entry below.
        </p>
      </div>

      <!-- Add entry button -->
      <button
        v-if="!showForm"
        @click="resetForm(); showForm = true"
        class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-colors mb-4"
      >
        Add Entry
      </button>

      <!-- Entry form -->
      <div v-if="showForm" class="bg-slate-800 rounded-xl p-4 mb-4">
        <h2 class="font-semibold mb-4">{{ editingId ? 'Edit Entry' : 'New Entry' }}</h2>

        <div class="space-y-4">
          <!-- Date -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Date</label>
            <input
              v-model="recordedDate"
              type="date"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Fat weight -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Fat Weight</label>
            <div class="flex gap-2">
              <div class="flex-1">
                <input
                  v-model="fatSt"
                  type="number"
                  placeholder="0"
                  class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span class="text-xs text-slate-500 mt-1 block">stone</span>
              </div>
              <div class="flex-1">
                <input
                  v-model="fatLbs"
                  type="number"
                  step="0.1"
                  placeholder="0"
                  class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span class="text-xs text-slate-500 mt-1 block">lbs</span>
              </div>
            </div>
          </div>

          <!-- Muscle weight -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Muscle Weight</label>
            <div class="flex gap-2">
              <div class="flex-1">
                <input
                  v-model="muscleSt"
                  type="number"
                  placeholder="0"
                  class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span class="text-xs text-slate-500 mt-1 block">stone</span>
              </div>
              <div class="flex-1">
                <input
                  v-model="muscleLbs"
                  type="number"
                  step="0.1"
                  placeholder="0"
                  class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span class="text-xs text-slate-500 mt-1 block">lbs</span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-2 mt-4">
          <button
            @click="cancelEdit"
            class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="submitMetric"
            :disabled="isSubmitting"
            class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {{ isSubmitting ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>

      <!-- Weigh-ins list -->
      <section>
        <h3 class="text-lg font-semibold mb-3 text-slate-300">History</h3>

        <LoadingSpinner v-if="isLoading" text="Loading entries..." />

        <EmptyState
          v-else-if="sortedMetrics.length === 0"
          icon="data"
          title="No weigh-ins yet"
          description="Track your body composition by adding your first entry"
        />

        <div v-else class="space-y-2">
          <div
            v-for="(metric, index) in sortedMetrics"
            :key="metric.id"
            class="bg-slate-800 rounded-xl p-4"
          >
            <div class="flex items-start justify-between">
              <button
                @click="startEdit(metric)"
                class="flex-1 text-left"
              >
                <p class="text-sm text-slate-500 mb-1">{{ formatDate(metric.recorded_at) }}</p>
                <div class="flex gap-4">
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-red-400">Fat:</span>
                    <span class="ml-1 font-medium">{{ formatStLbs(metric.fat_st, metric.fat_lbs) }}</span>
                    <svg v-if="getTrend(index, 'fat') === 'down'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    <svg v-else-if="getTrend(index, 'fat') === 'up'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-emerald-400">Muscle:</span>
                    <span class="ml-1 font-medium">{{ formatStLbs(metric.muscle_st, metric.muscle_lbs) }}</span>
                    <svg v-if="getTrend(index, 'muscle') === 'up'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                    </svg>
                    <svg v-else-if="getTrend(index, 'muscle') === 'down'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                </div>
              </button>
              <button
                @click.stop="deleteMetric(metric.id)"
                class="text-slate-500 hover:text-red-400 transition-colors p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
