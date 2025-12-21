<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import TabNav from '@/components/TabNav.vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { ProteinIntake } from '@/lib/database.types'

const auth = useAuthStore()

const intakes = ref<ProteinIntake[]>([])
const isLoading = ref(true)
const showForm = ref(false)
const grams = ref('')
const isSubmitting = ref(false)

// Protein goal (stored in localStorage for now)
const proteinGoal = ref(150)
const showGoalEdit = ref(false)
const newGoal = ref('')

// Calendar state
const currentMonth = ref(new Date())

// Load protein goal from localStorage
function loadGoal() {
  const saved = localStorage.getItem('proteinGoal')
  if (saved) {
    proteinGoal.value = parseInt(saved)
  }
}

function saveGoal() {
  if (newGoal.value) {
    proteinGoal.value = parseInt(newGoal.value)
    localStorage.setItem('proteinGoal', proteinGoal.value.toString())
  }
  showGoalEdit.value = false
  newGoal.value = ''
}

// Calendar helpers
const monthName = computed(() => {
  return currentMonth.value.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})

const daysInMonth = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  return new Date(year, month + 1, 0).getDate()
})

const firstDayOfMonth = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  // getDay() returns 0 for Sunday, we want Monday = 0
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
})

const calendarDays = computed(() => {
  const days: (number | null)[] = []

  // Add empty slots for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth.value; i++) {
    days.push(null)
  }

  // Add the days of the month
  for (let i = 1; i <= daysInMonth.value; i++) {
    days.push(i)
  }

  return days
})

// Get daily totals by date key (YYYY-MM-DD)
const dailyTotalsByDate = computed(() => {
  const totals: { [dateKey: string]: number } = {}

  intakes.value.forEach((intake) => {
    const date = new Date(intake.recorded_at)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    totals[dateKey] = (totals[dateKey] || 0) + intake.grams
  })

  return totals
})

// Check if a day in the current month met the goal
function dayMetGoal(day: number): boolean {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return (dailyTotalsByDate.value[dateKey] || 0) >= proteinGoal.value
}

// Check if a day has any protein logged
function dayHasProtein(day: number): boolean {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return (dailyTotalsByDate.value[dateKey] || 0) > 0
}

// Get protein amount for a day
function getDayProtein(day: number): number {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return dailyTotalsByDate.value[dateKey] || 0
}

// Check if day is today
function isToday(day: number): boolean {
  const today = new Date()
  return (
    day === today.getDate() &&
    currentMonth.value.getMonth() === today.getMonth() &&
    currentMonth.value.getFullYear() === today.getFullYear()
  )
}

// Check if day is in the future
function isFuture(day: number): boolean {
  const today = new Date()
  const checkDate = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), day)
  today.setHours(0, 0, 0, 0)
  return checkDate > today
}

// Navigation
function prevMonth() {
  const newDate = new Date(currentMonth.value)
  newDate.setMonth(newDate.getMonth() - 1)
  currentMonth.value = newDate
}

function nextMonth() {
  const newDate = new Date(currentMonth.value)
  newDate.setMonth(newDate.getMonth() + 1)
  currentMonth.value = newDate
}

// Count days that met goal this month
const daysMetGoalThisMonth = computed(() => {
  let count = 0
  for (let day = 1; day <= daysInMonth.value; day++) {
    if (dayMetGoal(day)) count++
  }
  return count
})

// Today's total
const todayTotal = computed(() => {
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return dailyTotalsByDate.value[dateKey] || 0
})

async function loadIntakes() {
  isLoading.value = true
  try {
    const { data, error } = await supabase
      .from('protein_intake')
      .select('*')
      .order('recorded_at', { ascending: false })

    if (error) throw error
    intakes.value = (data ?? []) as ProteinIntake[]
  } catch (e) {
    console.error('Failed to load protein intake:', e)
  } finally {
    isLoading.value = false
  }
}

async function submitIntake() {
  if (!auth.user?.id || !grams.value) return
  isSubmitting.value = true

  try {
    const { error } = await supabase.from('protein_intake').insert({
      user_id: auth.user.id,
      grams: parseInt(grams.value),
    } as ProteinIntake)

    if (error) throw error

    grams.value = ''
    showForm.value = false
    await loadIntakes()
  } catch (e) {
    console.error('Failed to save protein intake:', e)
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  loadGoal()
  loadIntakes()
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="bg-slate-800 border-b border-slate-700 px-4 py-4">
      <h1 class="text-xl font-bold text-emerald-400">Trackd</h1>
    </header>

    <TabNav />

    <main class="p-4">
      <!-- Today's summary -->
      <div class="bg-slate-800 rounded-xl p-4 mb-4">
        <div class="flex justify-between items-start">
          <div>
            <p class="text-sm text-slate-400 mb-1">Today's Protein</p>
            <p class="text-3xl font-bold" :class="todayTotal >= proteinGoal ? 'text-emerald-400' : 'text-white'">
              {{ todayTotal }}g
              <span v-if="todayTotal >= proteinGoal" class="text-lg ml-1">✓</span>
            </p>
          </div>
          <div class="text-right">
            <button
              @click="showGoalEdit = !showGoalEdit; newGoal = proteinGoal.toString()"
              class="text-sm text-slate-400 hover:text-white"
            >
              Goal: {{ proteinGoal }}g
            </button>
          </div>
        </div>

        <!-- Goal edit form -->
        <div v-if="showGoalEdit" class="mt-3 pt-3 border-t border-slate-700">
          <label class="block text-sm text-slate-400 mb-2">Daily Goal (grams)</label>
          <div class="flex gap-2">
            <input
              v-model="newGoal"
              type="number"
              class="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              @click="saveGoal"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium"
            >
              Save
            </button>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="mt-3">
          <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-300"
              :class="todayTotal >= proteinGoal ? 'bg-emerald-500' : 'bg-emerald-600'"
              :style="{ width: `${Math.min(100, (todayTotal / proteinGoal) * 100)}%` }"
            />
          </div>
          <p class="text-xs text-slate-500 mt-1">
            {{ Math.max(0, proteinGoal - todayTotal) }}g remaining
          </p>
        </div>
      </div>

      <!-- Add protein button -->
      <button
        v-if="!showForm"
        @click="showForm = true"
        class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-colors mb-4"
      >
        Add Protein
      </button>

      <!-- Entry form -->
      <div v-if="showForm" class="bg-slate-800 rounded-xl p-4 mb-4">
        <h2 class="font-semibold mb-4">Add Protein</h2>

        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-300 mb-2">Amount (grams)</label>
          <input
            v-model="grams"
            type="number"
            placeholder="e.g. 30"
            class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            @keyup.enter="submitIntake"
          />
        </div>

        <div class="flex gap-2">
          <button
            @click="showForm = false"
            class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="submitIntake"
            :disabled="isSubmitting || !grams"
            class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {{ isSubmitting ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>

      <!-- Calendar -->
      <div class="bg-slate-800 rounded-xl p-4">
        <!-- Calendar header -->
        <div class="flex items-center justify-between mb-4">
          <button
            @click="prevMonth"
            class="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 class="font-semibold">{{ monthName }}</h3>
          <button
            @click="nextMonth"
            class="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Month stats -->
        <div class="text-center text-sm text-slate-400 mb-4">
          <span class="text-emerald-400 font-medium">{{ daysMetGoalThisMonth }}</span> days goal met this month
        </div>

        <!-- Day names -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          <div v-for="day in ['M', 'T', 'W', 'T', 'F', 'S', 'S']" :key="day" class="text-center text-xs text-slate-500 py-1">
            {{ day }}
          </div>
        </div>

        <!-- Calendar grid -->
        <div v-if="isLoading" class="text-center py-8 text-slate-500">Loading...</div>
        <div v-else class="grid grid-cols-7 gap-1">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            class="aspect-square flex items-center justify-center relative"
          >
            <template v-if="day !== null">
              <div
                class="w-full h-full flex items-center justify-center rounded-lg text-sm transition-colors"
                :class="{
                  'bg-emerald-500/20 text-emerald-400': dayMetGoal(day),
                  'bg-slate-700/50 text-slate-400': dayHasProtein(day) && !dayMetGoal(day),
                  'text-slate-500': !dayHasProtein(day) && !isFuture(day),
                  'text-slate-600': isFuture(day),
                  'ring-2 ring-emerald-400': isToday(day),
                }"
                :title="getDayProtein(day) > 0 ? `${getDayProtein(day)}g` : ''"
              >
                <span v-if="dayMetGoal(day)" class="text-emerald-400">✓</span>
                <span v-else>{{ day }}</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex justify-center gap-4 mt-4 text-xs text-slate-500">
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded bg-emerald-500/20" />
            <span>Goal met</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded bg-slate-700/50" />
            <span>Logged</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded ring-2 ring-emerald-400" />
            <span>Today</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
