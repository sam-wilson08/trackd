<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TabNav from '@/components/TabNav.vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useSettingsStore } from '@/stores/settings'
import type { ProteinIntake } from '@/lib/database.types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

const router = useRouter()

const auth = useAuthStore()
const toast = useToastStore()
const settings = useSettingsStore()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

const intakes = ref<ProteinIntake[]>([])
const isLoading = ref(true)
const showForm = ref(false)
const grams = ref('')
const isSubmitting = ref(false)
const editingId = ref<string | null>(null)

// Protein goal from settings
const showGoalEdit = ref(false)
const newGoal = ref('')

// Calendar state
const currentMonth = ref(new Date())

// Use settings for protein goal
const proteinGoal = computed(() => settings.proteinGoal)

function saveGoal() {
  if (newGoal.value) {
    settings.setProteinGoal(parseInt(newGoal.value))
    toast.success('Goal updated!')
  }
  showGoalEdit.value = false
  newGoal.value = ''
}

function resetForm() {
  grams.value = ''
  editingId.value = null
}

function startEdit(intake: ProteinIntake) {
  editingId.value = intake.id
  grams.value = intake.grams.toString()
  showForm.value = true
}

function cancelEdit() {
  resetForm()
  showForm.value = false
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
  if (!auth.user?.id) return
  isLoading.value = true
  try {
    const { data, error } = await supabase
      .from('protein_intake')
      .select('*')
      .eq('user_id', auth.user.id)
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
    if (editingId.value) {
      const { error } = await supabase
        .from('protein_intake')
        .update({ grams: parseInt(grams.value) })
        .eq('id', editingId.value)

      if (error) throw error
      toast.success('Entry updated!')
    } else {
      const { error } = await supabase.from('protein_intake').insert({
        user_id: auth.user.id,
        grams: parseInt(grams.value),
      } as ProteinIntake)

      if (error) throw error
      toast.success('Protein logged!')
    }

    resetForm()
    showForm.value = false
    await loadIntakes()
  } catch (e) {
    console.error('Failed to save protein intake:', e)
    toast.error('Failed to save entry')
  } finally {
    isSubmitting.value = false
  }
}

async function deleteIntake(id: string) {
  const confirmed = await confirmDialog.value?.open({
    title: 'Delete Entry',
    message: 'Are you sure you want to delete this protein entry?',
    confirmText: 'Delete',
    destructive: true,
  })

  if (!confirmed) return

  try {
    const { error } = await supabase.from('protein_intake').delete().eq('id', id)

    if (error) throw error
    await loadIntakes()
    toast.success('Entry deleted')
  } catch (e) {
    console.error('Failed to delete entry:', e)
    toast.error('Failed to delete entry')
  }
}

// Get today's entries for the list
const todayEntries = computed(() => {
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return intakes.value
    .filter(intake => {
      const date = new Date(intake.recorded_at)
      const intakeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return intakeKey === dateKey
    })
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
})

onMounted(() => {
  loadIntakes()
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
        <h2 class="font-semibold mb-4">{{ editingId ? 'Edit Protein' : 'Add Protein' }}</h2>

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
            @click="cancelEdit"
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

      <!-- Today's entries -->
      <div v-if="todayEntries.length > 0" class="bg-slate-800 rounded-xl p-4 mb-4">
        <h3 class="text-sm font-medium text-slate-400 mb-3">Today's Entries</h3>
        <div class="space-y-2">
          <div
            v-for="entry in todayEntries"
            :key="entry.id"
            class="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
          >
            <button @click="startEdit(entry)" class="flex-1 text-left">
              <span class="font-medium">{{ entry.grams }}g</span>
              <span class="text-xs text-slate-500 ml-2">
                {{ new Date(entry.recorded_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }}
              </span>
            </button>
            <button
              @click="deleteIntake(entry.id)"
              class="text-slate-500 hover:text-red-400 transition-colors p-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
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
        <LoadingSpinner v-if="isLoading" size="sm" />
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

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
