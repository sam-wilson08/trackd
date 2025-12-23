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
import { useSettingsStore } from '@/stores/settings'
import { supabase } from '@/lib/supabase'
import TabNav from '@/components/TabNav.vue'
import type { BodyMetric, ProteinIntake, CalorieIntake, Reward, Milestone } from '@/lib/database.types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()

// Body metrics for chart
const metrics = ref<BodyMetric[]>([])
const activeGraph = ref<'fat' | 'muscle'>('fat')

// Protein intake for today and this week
const todayProtein = ref<number | null>(null)
const allProteinIntakes = ref<ProteinIntake[]>([])

// Rewards
const rewards = ref<Reward[]>([])
const calorieIntakes = ref<CalorieIntake[]>([])

// Milestones
const milestones = ref<Milestone[]>([])

// Calculate protein streak (consecutive days meeting goal)
const proteinStreak = computed(() => {
  if (allProteinIntakes.value.length === 0) return 0

  // Group by date
  const dailyTotals: { [dateKey: string]: number } = {}
  allProteinIntakes.value.forEach((intake) => {
    const date = new Date(intake.recorded_at)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + intake.grams
  })

  // Count consecutive days from yesterday backwards
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check if today's goal is met
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if ((dailyTotals[todayKey] || 0) >= settings.proteinGoal) {
    streak++
  }

  // Count backwards from yesterday
  for (let i = 1; i <= 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    const dateKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`

    if ((dailyTotals[dateKey] || 0) >= settings.proteinGoal) {
      streak++
    } else {
      break
    }
  }

  return streak
})

// Weekly summary
const weeklyStats = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  // Count weigh-ins this week
  const weighInsThisWeek = metrics.value.filter((m) => {
    const date = new Date(m.recorded_at)
    return date >= weekAgo && date <= today
  }).length

  // Count days protein goal met this week
  const dailyTotals: { [dateKey: string]: number } = {}
  allProteinIntakes.value.forEach((intake) => {
    const date = new Date(intake.recorded_at)
    if (date >= weekAgo && date <= today) {
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + intake.grams
    }
  })

  const daysProteinGoalMet = Object.values(dailyTotals).filter(
    (total) => total >= settings.proteinGoal,
  ).length

  return {
    weighIns: weighInsThisWeek,
    proteinDays: daysProteinGoalMet,
  }
})

// Load active rewards
async function loadRewards() {
  if (!auth.user?.id) return
  try {
    const [rewardsRes, calorieRes] = await Promise.all([
      supabase
        .from('rewards')
        .select('*')
        .eq('user_id', auth.user.id)
        .is('completed_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('calorie_intake')
        .select('*')
        .eq('user_id', auth.user.id),
    ])

    if (rewardsRes.error) throw rewardsRes.error
    rewards.value = (rewardsRes.data ?? []) as Reward[]
    calorieIntakes.value = (calorieRes.data ?? []) as CalorieIntake[]
  } catch (e) {
    console.error('Failed to load rewards:', e)
  }
}

// Load milestones
async function loadMilestones() {
  if (!auth.user?.id) return
  try {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('user_id', auth.user.id)
      .is('completed_at', null)
      .order('target_date', { ascending: true })

    if (error) throw error
    milestones.value = (data ?? []) as Milestone[]
  } catch (e) {
    console.error('Failed to load milestones:', e)
  }
}

// Calculate milestone progress
function getMilestoneProgress(milestone: Milestone) {
  const created = new Date(milestone.created_at)
  const target = new Date(milestone.target_date)
  const now = new Date()

  created.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)

  const totalMs = target.getTime() - created.getTime()
  const elapsedMs = now.getTime() - created.getTime()
  const remainingMs = target.getTime() - now.getTime()

  const daysLeft = Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
  const percentage = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))

  return { daysLeft, percentage }
}

// Calculate reward progress
function getRewardProgress(reward: Reward): { current: number; percentage: number } {
  const goal = reward.tracking_type === 'protein' ? settings.proteinGoal : settings.calorieGoal

  // Build daily totals
  const totals: { [dateKey: string]: number } = {}
  if (reward.tracking_type === 'protein') {
    allProteinIntakes.value.forEach((intake) => {
      const date = new Date(intake.recorded_at)
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      totals[dateKey] = (totals[dateKey] || 0) + intake.grams
    })
  } else {
    calorieIntakes.value.forEach((intake) => {
      const date = new Date(intake.recorded_at)
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      totals[dateKey] = (totals[dateKey] || 0) + intake.calories
    })
  }

  const startDate = new Date(reward.created_at)
  startDate.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (reward.streak_type === 'consecutive') {
    let streak = 0
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      if (d < startDate) break
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if ((totals[dateKey] || 0) >= goal) {
        streak++
      } else if (i > 0) {
        break
      }
    }
    return { current: streak, percentage: Math.min(100, (streak / reward.target_days) * 100) }
  } else {
    let daysMetGoal = 0
    const d = new Date(startDate)
    while (d <= today) {
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if ((totals[dateKey] || 0) >= goal) daysMetGoal++
      d.setDate(d.getDate() + 1)
    }
    return { current: daysMetGoal, percentage: Math.min(100, (daysMetGoal / reward.target_days) * 100) }
  }
}

// Load protein intake (all for streak, filtered for today)
async function loadProteinData() {
  if (!auth.user?.id) return
  try {
    // Load all intakes for streak calculation
    const { data, error } = await supabase
      .from('protein_intake')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('recorded_at', { ascending: false })

    if (error) throw error

    allProteinIntakes.value = (data ?? []) as ProteinIntake[]

    // Calculate today's total
    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const todayIntakes = allProteinIntakes.value.filter((intake) => {
      const date = new Date(intake.recorded_at)
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return dateKey === todayKey
    })

    todayProtein.value =
      todayIntakes.length > 0 ? todayIntakes.reduce((sum, i) => sum + i.grams, 0) : null
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
    activeGraph.value === 'fat' ? d.fatSt * 14 + d.fatLbs : d.muscleSt * 14 + d.muscleLbs,
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
  await loadProteinData()
  await loadRewards()
  await loadMilestones()
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
        <h1 class="text-xl font-bold text-emerald-400">Trak</h1>
        <div class="flex items-center gap-1 w-24 justify-end">
          <button
            @click="router.push('/milestones')"
            class="text-slate-400 hover:text-white p-1"
            title="Milestones"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
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
              class="h-5 w-5"
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
              class="h-5 w-5"
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

    <!-- Main content -->
    <main class="p-4">
      <!-- Date and time -->
      <p class="text-slate-400 mb-1">{{ formattedDate() }}</p>
      <p class="text-2xl font-semibold text-slate-300 mb-4">{{ formattedTime() }}</p>

      <!-- Greeting -->
      <h2 class="text-4xl font-bold mb-4">{{ greeting }}</h2>

      <!-- Weekly stats & streak -->
      <div class="grid grid-cols-3 gap-3 mb-6">
        <div class="bg-slate-800 rounded-xl p-3 text-center">
          <p class="text-2xl font-bold text-emerald-400">{{ weeklyStats.proteinDays }}/7</p>
          <p class="text-xs text-slate-500">Protein days</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-3 text-center">
          <p class="text-2xl font-bold text-amber-400">{{ proteinStreak }}</p>
          <p class="text-xs text-slate-500">Day streak</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-3 text-center">
          <p class="text-2xl font-bold text-blue-400">{{ weeklyStats.weighIns }}</p>
          <p class="text-xs text-slate-500">Weigh-ins</p>
        </div>
      </div>

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

      <!-- Rewards section -->
      <div v-if="rewards.length > 0" class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold text-slate-300">Rewards</h3>
          <button
            @click="router.push('/rewards')"
            class="text-sm text-emerald-400 hover:text-emerald-300"
          >
            View all
          </button>
        </div>
        <div class="space-y-3">
          <div v-for="reward in rewards.slice(0, 3)" :key="reward.id" class="bg-slate-800 rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <p class="font-medium">{{ reward.name }}</p>
              <span
                class="text-xs px-2 py-0.5 rounded-full"
                :class="
                  reward.tracking_type === 'protein'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-orange-500/20 text-orange-400'
                "
              >
                {{ reward.tracking_type === 'protein' ? 'Protein' : 'Calories' }}
              </span>
            </div>
            <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                class="h-full transition-all duration-300"
                :class="reward.tracking_type === 'protein' ? 'bg-emerald-500' : 'bg-orange-500'"
                :style="{ width: `${getRewardProgress(reward).percentage}%` }"
              />
            </div>
            <p class="text-xs text-slate-500 mt-2">
              {{ getRewardProgress(reward).current }} / {{ reward.target_days }} days
              ({{ reward.streak_type === 'consecutive' ? 'streak' : 'total' }})
            </p>
          </div>
        </div>
      </div>

      <!-- Milestones section -->
      <div v-if="milestones.length > 0" class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold text-slate-300">Milestones</h3>
          <button
            @click="router.push('/milestones')"
            class="text-sm text-emerald-400 hover:text-emerald-300"
          >
            View all
          </button>
        </div>
        <div class="space-y-3">
          <div v-for="milestone in milestones.slice(0, 3)" :key="milestone.id" class="bg-slate-800 rounded-xl p-4">
            <div class="flex items-center justify-between mb-2">
              <p class="font-medium">{{ milestone.name }}</p>
              <span
                class="text-sm"
                :class="getMilestoneProgress(milestone).daysLeft <= 0 ? 'text-amber-400' : 'text-slate-400'"
              >
                <template v-if="getMilestoneProgress(milestone).daysLeft > 0">
                  {{ getMilestoneProgress(milestone).daysLeft }} days left
                </template>
                <template v-else-if="getMilestoneProgress(milestone).daysLeft === 0">
                  Today!
                </template>
                <template v-else>
                  {{ Math.abs(getMilestoneProgress(milestone).daysLeft) }} days overdue
                </template>
              </span>
            </div>
            <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-blue-500 transition-all duration-300"
                :style="{ width: `${getMilestoneProgress(milestone).percentage}%` }"
              />
            </div>
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
          @click="router.push('/rewards')"
          class="py-4 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-left transition-colors"
        >
          <span class="block text-sm font-medium">Rewards</span>
          <span class="block text-xs text-slate-400 mt-1">{{ rewards.length }} active</span>
        </button>
      </div>
    </main>
  </div>
</template>
