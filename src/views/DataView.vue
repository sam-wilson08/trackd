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
const activeGraph = ref<'weight' | 'fat' | 'muscle'>('weight')

// Form mode: 'simple' for just overall weight, 'detailed' for fat/muscle breakdown
const entryMode = ref<'simple' | 'detailed'>('simple')

// Form data
const weightSt = ref('')
const weightLbs = ref('')
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
  weightSt.value = ''
  weightLbs.value = ''
  fatSt.value = ''
  fatLbs.value = ''
  muscleSt.value = ''
  muscleLbs.value = ''
  recordedDate.value = getTodayDate()
  editingId.value = null
  entryMode.value = 'simple'
}

// Start editing a metric
function startEdit(metric: BodyMetric) {
  editingId.value = metric.id
  weightSt.value = metric.weight_st?.toString() || ''
  weightLbs.value = metric.weight_lbs?.toString() || ''
  fatSt.value = metric.fat_st?.toString() || ''
  fatLbs.value = metric.fat_lbs?.toString() || ''
  muscleSt.value = metric.muscle_st?.toString() || ''
  muscleLbs.value = metric.muscle_lbs?.toString() || ''
  recordedDate.value = new Date(metric.recorded_at).toISOString().split('T')[0] ?? ''
  // Detect entry mode based on what was filled in
  const hasBreakdown = metric.fat_st || metric.fat_lbs || metric.muscle_st || metric.muscle_lbs
  entryMode.value = hasBreakdown ? 'detailed' : 'simple'
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
  return (st || 0) * 14 + (lbs || 0)
}

// Helper to get effective weight (direct weight or sum of fat + muscle)
function getEffectiveWeight(m: BodyMetric): { st: number; lbs: number } {
  // If weight is directly entered, use it
  if (m.weight_st || m.weight_lbs) {
    return { st: m.weight_st || 0, lbs: m.weight_lbs || 0 }
  }
  // Otherwise calculate from fat + muscle
  const fatLbsTotal = (m.fat_st || 0) * 14 + (m.fat_lbs || 0)
  const muscleLbsTotal = (m.muscle_st || 0) * 14 + (m.muscle_lbs || 0)
  const totalLbs = fatLbsTotal + muscleLbsTotal
  return { st: Math.floor(totalLbs / 14), lbs: totalLbs % 14 }
}

// Get effective weight for display in history
function getEffectiveWeightDisplay(metric: BodyMetric): string {
  const effective = getEffectiveWeight(metric)
  return formatStLbs(effective.st, effective.lbs)
}

// Get trend compared to previous entry (returns 'up', 'down', or 'same')
function getTrend(
  currentIndex: number,
  type: 'weight' | 'fat' | 'muscle',
): 'up' | 'down' | 'same' | null {
  // sortedMetrics is newest first, so previous entry is at currentIndex + 1
  if (currentIndex >= sortedMetrics.value.length - 1) return null

  const current = sortedMetrics.value[currentIndex]
  const previous = sortedMetrics.value[currentIndex + 1]

  if (!current || !previous) return null

  let currentVal: number
  let previousVal: number

  if (type === 'weight') {
    const currentWeight = getEffectiveWeight(current)
    const previousWeight = getEffectiveWeight(previous)
    currentVal = currentWeight.st * 14 + currentWeight.lbs
    previousVal = previousWeight.st * 14 + previousWeight.lbs
  } else if (type === 'fat') {
    currentVal = toTotalLbs(current.fat_st, current.fat_lbs)
    previousVal = toTotalLbs(previous.fat_st, previous.fat_lbs)
  } else {
    currentVal = toTotalLbs(current.muscle_st, current.muscle_lbs)
    previousVal = toTotalLbs(previous.muscle_st, previous.muscle_lbs)
  }

  if (currentVal > previousVal) return 'up'
  if (currentVal < previousVal) return 'down'
  return 'same'
}

const chartData = computed(() => {
  if (metrics.value.length === 0) return { labels: [], datasets: [] }

  const dataSource = metrics.value.map((m) => {
    const effectiveWeight = getEffectiveWeight(m)
    return {
      date: new Date(m.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      weightSt: effectiveWeight.st,
      weightLbs: effectiveWeight.lbs,
      fatSt: m.fat_st || 0,
      fatLbs: m.fat_lbs || 0,
      muscleSt: m.muscle_st || 0,
      muscleLbs: m.muscle_lbs || 0,
    }
  })

  const labels = dataSource.map((d) => d.date)
  // Convert to total lbs for graphing (1 stone = 14 lbs)
  const data = dataSource.map((d) => {
    if (activeGraph.value === 'weight') {
      return d.weightSt * 14 + d.weightLbs
    } else if (activeGraph.value === 'fat') {
      return d.fatSt * 14 + d.fatLbs
    } else {
      return d.muscleSt * 14 + d.muscleLbs
    }
  })

  const colors = {
    weight: { border: '#60a5fa', bg: '#60a5fa33' },
    fat: { border: '#f87171', bg: '#f8717133' },
    muscle: { border: '#34d399', bg: '#34d39933' },
  }

  return {
    labels,
    datasets: [
      {
        label:
          activeGraph.value === 'weight'
            ? 'Weight'
            : activeGraph.value === 'fat'
              ? 'Fat'
              : 'Muscle',
        data,
        borderColor: colors[activeGraph.value].border,
        backgroundColor: colors[activeGraph.value].bg,
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
      weight_st: weightSt.value ? parseInt(weightSt.value) : null,
      weight_lbs: weightLbs.value ? parseFloat(weightLbs.value) : null,
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
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  )
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="bg-slate-900 px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="w-20">
          <button @click="router.push('/account')" class="text-slate-400 hover:text-white p-1" title="Account">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
        <div class="w-20"></div>
        <div class="flex items-center gap-1 w-24 justify-end">
          <button
            @click="router.push('/milestones')"
            class="text-slate-400 hover:text-white p-1"
            title="Milestones"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
              />
            </svg>
          </button>
          <button
            @click="router.push('/rewards')"
            class="text-slate-400 hover:text-white p-1"
            title="Rewards"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
              />
            </svg>
          </button>
          <button
            @click="router.push('/settings')"
            class="text-slate-400 hover:text-white p-1"
            title="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <TabNav />

    <main class="p-4 pb-20">
      <!-- Toggle buttons -->
      <div class="flex gap-2 mb-4">
        <button
          @click="activeGraph = 'weight'"
          class="flex-1 py-2 rounded-lg font-medium transition-colors"
          :class="
            activeGraph === 'weight'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          "
        >
          Weight
        </button>
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
          {{
            activeGraph === 'weight'
              ? 'Overall Weight'
              : activeGraph === 'fat'
                ? 'Fat Weight'
                : 'Muscle Weight'
          }}
          Over Time
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

          <!-- Entry mode toggle -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Entry Type</label>
            <div class="flex gap-2">
              <button
                type="button"
                @click="entryMode = 'simple'"
                class="flex-1 py-2 rounded-lg font-medium transition-colors"
                :class="
                  entryMode === 'simple'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                    : 'bg-slate-700 text-slate-400 border border-slate-600'
                "
              >
                Simple
              </button>
              <button
                type="button"
                @click="entryMode = 'detailed'"
                class="flex-1 py-2 rounded-lg font-medium transition-colors"
                :class="
                  entryMode === 'detailed'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-slate-700 text-slate-400 border border-slate-600'
                "
              >
                Breakdown
              </button>
            </div>
          </div>

          <!-- Simple mode: Overall weight only -->
          <div v-if="entryMode === 'simple'">
            <label class="block text-sm font-medium text-slate-300 mb-2">Weight</label>
            <div class="flex gap-2">
              <div class="flex-1">
                <input
                  v-model="weightSt"
                  type="number"
                  placeholder="0"
                  class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span class="text-xs text-slate-500 mt-1 block">stone</span>
              </div>
              <div class="flex-1">
                <input
                  v-model="weightLbs"
                  type="number"
                  step="0.1"
                  placeholder="0"
                  class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span class="text-xs text-slate-500 mt-1 block">lbs</span>
              </div>
            </div>
          </div>

          <!-- Detailed mode: Fat and Muscle breakdown -->
          <template v-else>
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
          </template>
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
              <button @click="startEdit(metric)" class="flex-1 text-left">
                <p class="text-sm text-slate-500 mb-1">{{ formatDate(metric.recorded_at) }}</p>
                <div class="flex flex-wrap gap-x-4 gap-y-1">
                  <!-- Always show weight (calculated or direct) -->
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-blue-400">Weight:</span>
                    <span class="ml-1 font-medium">{{ getEffectiveWeightDisplay(metric) }}</span>
                    <svg
                      v-if="getTrend(index, 'weight') === 'down'"
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-emerald-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <svg
                      v-else-if="getTrend(index, 'weight') === 'up'"
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </div>
                  <!-- Only show fat/muscle if they were entered -->
                  <div v-if="metric.fat_st || metric.fat_lbs" class="flex items-center gap-1">
                    <span class="text-xs text-red-400">Fat:</span>
                    <span class="ml-1 font-medium">{{
                      formatStLbs(metric.fat_st, metric.fat_lbs)
                    }}</span>
                    <svg
                      v-if="getTrend(index, 'fat') === 'down'"
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-emerald-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <svg
                      v-else-if="getTrend(index, 'fat') === 'up'"
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </div>
                  <div v-if="metric.muscle_st || metric.muscle_lbs" class="flex items-center gap-1">
                    <span class="text-xs text-emerald-400">Muscle:</span>
                    <span class="ml-1 font-medium">{{
                      formatStLbs(metric.muscle_st, metric.muscle_lbs)
                    }}</span>
                    <svg
                      v-if="getTrend(index, 'muscle') === 'up'"
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-emerald-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <svg
                      v-else-if="getTrend(index, 'muscle') === 'down'"
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </button>
              <button
                @click.stop="deleteMetric(metric.id)"
                class="text-slate-500 hover:text-red-400 transition-colors p-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-7 w-7"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
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
