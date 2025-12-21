<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import TabNav from '@/components/TabNav.vue'
import type { BodyMetric, ProteinIntake, Goal } from '@/lib/database.types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const router = useRouter()
const auth = useAuthStore()

// Body metrics for chart
const metrics = ref<BodyMetric[]>([])
const activeGraph = ref<'fat' | 'muscle'>('fat')

// Protein intake for today
const todayProtein = ref<number | null>(null)

// Goals
const goals = ref<Goal[]>([])

// Load active goals
async function loadGoals() {
  if (!auth.user?.id) return
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', auth.user.id)
      .is('completed_at', null)
      .order('target_date', { ascending: true })

    if (error) throw error
    goals.value = (data ?? []) as Goal[]
  } catch (e) {
    console.error('Failed to load goals:', e)
  }
}

// Calculate goal progress
function getGoalProgress(goal: Goal): { daysLeft: number; progress: number } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(goal.target_date)
  const created = new Date(goal.created_at)
  created.setHours(0, 0, 0, 0)

  const totalDays = Math.ceil((target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  const daysLeft = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const daysPassed = totalDays - daysLeft
  const progress = totalDays > 0 ? Math.min(100, Math.max(0, (daysPassed / totalDays) * 100)) : 100

  return { daysLeft, progress }
}

// Load today's protein intake
async function loadTodayProtein() {
  if (!auth.user?.id) return
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data, error } = await supabase
      .from('protein_intake')
      .select('grams')
      .eq('user_id', auth.user.id)
      .gte('recorded_at', today.toISOString())
      .lt('recorded_at', tomorrow.toISOString())

    if (error) throw error

    const intakes = (data ?? []) as ProteinIntake[]
    todayProtein.value = intakes.length > 0
      ? intakes.reduce((sum, i) => sum + i.grams, 0)
      : null
  } catch (e) {
    console.error('Failed to load protein intake:', e)
  }
}

// Calculate trend for body metrics (last 4 weigh-ins)
const metricsTrend = computed(() => {
  if (metrics.value.length < 2) return null

  const last4 = metrics.value.slice(-4)
  if (last4.length < 2) return null

  const first = last4[0]!
  const last = last4[last4.length - 1]!

  const firstFat = (first.fat_st || 0) * 14 + (first.fat_lbs || 0)
  const lastFat = (last.fat_st || 0) * 14 + (last.fat_lbs || 0)
  const fatChange = lastFat - firstFat

  const firstMuscle = (first.muscle_st || 0) * 14 + (first.muscle_lbs || 0)
  const lastMuscle = (last.muscle_st || 0) * 14 + (last.muscle_lbs || 0)
  const muscleChange = lastMuscle - firstMuscle

  return {
    fat: fatChange,
    muscle: muscleChange,
  }
})

const proteinSubtitle = computed(() => {
  if (todayProtein.value === null) return 'Missing'
  return `${todayProtein.value}g today`
})

const dataSubtitle = computed(() => {
  if (!metricsTrend.value) return 'No data yet'

  const { fat, muscle } = metricsTrend.value
  const fatTrend = fat > 0 ? `+${fat.toFixed(1)}` : fat.toFixed(1)
  const muscleTrend = muscle > 0 ? `+${muscle.toFixed(1)}` : muscle.toFixed(1)

  return `Fat ${fatTrend}lbs, Muscle ${muscleTrend}lbs`
})

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
  const padding = 5

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
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
        grid: { color: '#334155' },
        ticks: { color: '#94a3b8' },
      },
      y: {
        min: Math.max(0, minVal - padding),
        max: maxVal + padding,
        grid: { color: '#334155' },
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
  }
}

// Current date and time
const currentDateTime = ref(new Date())
let timeInterval: number | null = null

const formattedDate = () => {
  return currentDateTime.value.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const formattedTime = () => {
  return currentDateTime.value.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Dynamic greeting based on time/day
const greeting = ref('')

function generateGreeting() {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()
  const name = auth.firstName || 'there'

  // Time-based greetings
  const morningGreetings = [
    `Good morning, ${name}!`,
    `Morning, ${name}!`,
    `Rise and shine, ${name}!`,
    `Top of the morning, ${name}!`,
  ]

  const afternoonGreetings = [
    `Good afternoon, ${name}!`,
    `Afternoon, ${name}!`,
    `Hope your day is going well, ${name}!`,
  ]

  const eveningGreetings = [
    `Good evening, ${name}!`,
    `Evening, ${name}!`,
    `Hope you had a great day, ${name}!`,
  ]

  // Day-specific greetings
  const mondayGreetings = [
    `Happy Monday, ${name}!`,
    `New week, new gains, ${name}!`,
    `Let's crush this week, ${name}!`,
  ]

  const fridayGreetings = [
    `Happy Friday, ${name}!`,
    `TGIF, ${name}!`,
    `Weekend's almost here, ${name}!`,
    `Friday vibes, ${name}!`,
  ]

  const weekendGreetings = [
    `Happy weekend, ${name}!`,
    `Enjoy your weekend, ${name}!`,
    `Weekend mode, ${name}!`,
  ]

  // Generic greetings (fallback variety)
  const genericGreetings = [
    `Hey ${name}!`,
    `Hi ${name}!`,
    `What's up, ${name}!`,
    `Hey there, ${name}!`,
    `Welcome back, ${name}!`,
  ]

  // Pick from appropriate pool
  let pool: string[] = []

  // 30% chance to use day-specific greeting if applicable
  const useDayGreeting = Math.random() < 0.3

  if (useDayGreeting) {
    if (day === 1) pool = mondayGreetings
    else if (day === 5) pool = fridayGreetings
    else if (day === 0 || day === 6) pool = weekendGreetings
  }

  // If no day-specific greeting selected, use time-based or generic
  if (pool.length === 0) {
    // 60% time-based, 40% generic
    if (Math.random() < 0.6) {
      if (hour >= 5 && hour < 12) pool = morningGreetings
      else if (hour >= 12 && hour < 17) pool = afternoonGreetings
      else pool = eveningGreetings
    } else {
      pool = genericGreetings
    }
  }

  // Pick random from pool
  greeting.value = pool[Math.floor(Math.random() * pool.length)]!
}

onMounted(async () => {
  generateGreeting()
  // Update time every minute
  timeInterval = window.setInterval(() => {
    currentDateTime.value = new Date()
  }, 60000)
  await loadMetrics()
  await loadTodayProtein()
  await loadGoals()
})

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
  }
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <!-- Header -->
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

    <!-- Main content -->
    <main class="p-4">
      <!-- Date and time -->
      <p class="text-slate-400 mb-1">{{ formattedDate() }}</p>
      <p class="text-2xl font-semibold text-slate-300 mb-4">{{ formattedTime() }}</p>

      <!-- Greeting -->
      <h2 class="text-4xl font-bold mb-6">{{ greeting }}</h2>

      <!-- Body metrics chart -->
      <div class="bg-slate-800 rounded-xl p-4 mb-6">
        <div class="flex gap-2 mb-3">
          <button
            @click="activeGraph = 'fat'"
            class="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="
              activeGraph === 'fat'
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : 'bg-slate-700 text-slate-400'
            "
          >
            Fat
          </button>
          <button
            @click="activeGraph = 'muscle'"
            class="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="
              activeGraph === 'muscle'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'bg-slate-700 text-slate-400'
            "
          >
            Muscle
          </button>
        </div>
        <div class="h-64">
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Goals section -->
      <div v-if="goals.length > 0" class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold text-slate-300">Goals</h3>
          <button
            @click="router.push('/goals')"
            class="text-sm text-emerald-400 hover:text-emerald-300"
          >
            View all
          </button>
        </div>
        <div class="space-y-3">
          <div
            v-for="goal in goals.slice(0, 3)"
            :key="goal.id"
            class="bg-slate-800 rounded-xl p-4"
          >
            <p class="font-medium mb-2">{{ goal.description }}</p>
            <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                class="h-full transition-all duration-300"
                :class="getGoalProgress(goal).daysLeft <= 0 ? 'bg-red-500' : 'bg-emerald-500'"
                :style="{ width: `${getGoalProgress(goal).progress}%` }"
              />
            </div>
            <p class="text-xs mt-2">
              <span v-if="goal.reward" class="text-amber-400">{{ goal.reward }}</span>
              <span v-if="goal.reward" class="text-slate-500"> - </span>
              <span :class="getGoalProgress(goal).daysLeft <= 0 ? 'text-red-400' : 'text-slate-500'">
                <template v-if="getGoalProgress(goal).daysLeft > 0">
                  {{ getGoalProgress(goal).daysLeft }} days remaining
                </template>
                <template v-else-if="getGoalProgress(goal).daysLeft === 0">
                  Due today!
                </template>
                <template v-else>
                  {{ Math.abs(getGoalProgress(goal).daysLeft) }} days overdue
                </template>
              </span>
            </p>
          </div>
        </div>
      </div>

      <!-- Quick action bubbles -->
      <div class="grid grid-cols-2 gap-3">
        <button
          @click="router.push('/protein')"
          class="py-4 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-left transition-colors"
        >
          <span class="block text-sm font-medium">Protein</span>
          <span class="block text-xs text-slate-400 mt-1">{{ proteinSubtitle }}</span>
        </button>
        <button
          @click="router.push('/data')"
          class="py-4 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-left transition-colors"
        >
          <span class="block text-sm font-medium">Data</span>
          <span class="block text-xs text-slate-400 mt-1">{{ dataSubtitle }}</span>
        </button>
        <button
          @click="router.push('/pb')"
          class="py-4 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-left transition-colors"
        >
          <span class="block text-sm font-medium">Personal Bests</span>
        </button>
        <button
          @click="router.push('/goals')"
          class="py-4 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-left transition-colors"
        >
          <span class="block text-sm font-medium">Goals</span>
          <span class="block text-xs text-slate-400 mt-1">{{ goals.length }} active</span>
        </button>
      </div>
    </main>
  </div>
</template>
