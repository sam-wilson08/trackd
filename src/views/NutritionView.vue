<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import TabNav from '@/components/TabNav.vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useSettingsStore } from '@/stores/settings'
import type { ProteinIntake, CalorieIntake } from '@/lib/database.types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

const router = useRouter()

const auth = useAuthStore()
const toast = useToastStore()
const settings = useSettingsStore()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

// Active view toggle (for "both" mode)
const activeView = ref<'protein' | 'calories'>('protein')

// Data
const proteinIntakes = ref<ProteinIntake[]>([])
const calorieIntakes = ref<CalorieIntake[]>([])
const isLoading = ref(true)

// Form state
const showProteinForm = ref(false)
const showCalorieForm = ref(false)
const proteinGrams = ref('')
const calorieAmount = ref('')
const isSubmitting = ref(false)
const editingProteinId = ref<string | null>(null)
const editingCalorieId = ref<string | null>(null)

// Goal editing
const showProteinGoalEdit = ref(false)
const showCalorieGoalEdit = ref(false)
const newProteinGoal = ref('')
const newCalorieGoal = ref('')

// Calendar state - separate for each type
const proteinMonth = ref(new Date())
const calorieMonth = ref(new Date())

// Computed settings
const proteinGoal = computed(() => settings.proteinGoal)
const calorieGoal = computed(() => settings.calorieGoal)
const isBothMode = computed(() => settings.nutritionTracking === 'both')
const showProteinSection = computed(() => {
  if (isBothMode.value) return activeView.value === 'protein'
  return settings.nutritionTracking === 'protein'
})
const showCalorieSection = computed(() => {
  if (isBothMode.value) return activeView.value === 'calories'
  return settings.nutritionTracking === 'calories'
})

// Form helpers
function resetProteinForm() {
  proteinGrams.value = ''
  editingProteinId.value = null
}

function resetCalorieForm() {
  calorieAmount.value = ''
  editingCalorieId.value = null
}

function startEditProtein(intake: ProteinIntake) {
  editingProteinId.value = intake.id
  proteinGrams.value = intake.grams.toString()
  showProteinForm.value = true
}

function startEditCalorie(intake: CalorieIntake) {
  editingCalorieId.value = intake.id
  calorieAmount.value = intake.calories.toString()
  showCalorieForm.value = true
}

function cancelProteinEdit() {
  resetProteinForm()
  showProteinForm.value = false
}

function cancelCalorieEdit() {
  resetCalorieForm()
  showCalorieForm.value = false
}

// Goal saving
function saveProteinGoal() {
  if (newProteinGoal.value) {
    settings.setProteinGoal(parseInt(newProteinGoal.value))
    toast.success('Protein goal updated!')
  }
  showProteinGoalEdit.value = false
  newProteinGoal.value = ''
}

function saveCalorieGoal() {
  if (newCalorieGoal.value) {
    settings.setCalorieGoal(parseInt(newCalorieGoal.value))
    toast.success('Calorie goal updated!')
  }
  showCalorieGoalEdit.value = false
  newCalorieGoal.value = ''
}

// Calendar helpers for protein
const proteinMonthName = computed(() => {
  return proteinMonth.value.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})

const proteinDaysInMonth = computed(() => {
  const year = proteinMonth.value.getFullYear()
  const month = proteinMonth.value.getMonth()
  return new Date(year, month + 1, 0).getDate()
})

const proteinFirstDayOfMonth = computed(() => {
  const year = proteinMonth.value.getFullYear()
  const month = proteinMonth.value.getMonth()
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
})

const proteinCalendarDays = computed(() => {
  const days: (number | null)[] = []
  for (let i = 0; i < proteinFirstDayOfMonth.value; i++) {
    days.push(null)
  }
  for (let i = 1; i <= proteinDaysInMonth.value; i++) {
    days.push(i)
  }
  return days
})

// Calendar helpers for calories
const calorieMonthName = computed(() => {
  return calorieMonth.value.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})

const calorieDaysInMonth = computed(() => {
  const year = calorieMonth.value.getFullYear()
  const month = calorieMonth.value.getMonth()
  return new Date(year, month + 1, 0).getDate()
})

const calorieFirstDayOfMonth = computed(() => {
  const year = calorieMonth.value.getFullYear()
  const month = calorieMonth.value.getMonth()
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
})

const calorieCalendarDays = computed(() => {
  const days: (number | null)[] = []
  for (let i = 0; i < calorieFirstDayOfMonth.value; i++) {
    days.push(null)
  }
  for (let i = 1; i <= calorieDaysInMonth.value; i++) {
    days.push(i)
  }
  return days
})

// Daily totals by date
const proteinTotalsByDate = computed(() => {
  const totals: { [dateKey: string]: number } = {}
  proteinIntakes.value.forEach((intake) => {
    const date = new Date(intake.recorded_at)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    totals[dateKey] = (totals[dateKey] || 0) + intake.grams
  })
  return totals
})

const calorieTotalsByDate = computed(() => {
  const totals: { [dateKey: string]: number } = {}
  calorieIntakes.value.forEach((intake) => {
    const date = new Date(intake.recorded_at)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    totals[dateKey] = (totals[dateKey] || 0) + intake.calories
  })
  return totals
})

// Calendar day checks for protein
function getProteinDateKey(day: number): string {
  const year = proteinMonth.value.getFullYear()
  const month = proteinMonth.value.getMonth()
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function proteinDayMetGoal(day: number): boolean {
  const dateKey = getProteinDateKey(day)
  return (proteinTotalsByDate.value[dateKey] || 0) >= proteinGoal.value
}

function proteinDayHasData(day: number): boolean {
  const dateKey = getProteinDateKey(day)
  return (proteinTotalsByDate.value[dateKey] || 0) > 0
}

function isProteinToday(day: number): boolean {
  const today = new Date()
  return (
    day === today.getDate() &&
    proteinMonth.value.getMonth() === today.getMonth() &&
    proteinMonth.value.getFullYear() === today.getFullYear()
  )
}

function isProteinFuture(day: number): boolean {
  const today = new Date()
  const checkDate = new Date(proteinMonth.value.getFullYear(), proteinMonth.value.getMonth(), day)
  today.setHours(0, 0, 0, 0)
  return checkDate > today
}

// Calendar day checks for calories
function getCalorieDateKey(day: number): string {
  const year = calorieMonth.value.getFullYear()
  const month = calorieMonth.value.getMonth()
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function calorieDayMetGoal(day: number): boolean {
  const dateKey = getCalorieDateKey(day)
  return (calorieTotalsByDate.value[dateKey] || 0) >= calorieGoal.value
}

function calorieDayHasData(day: number): boolean {
  const dateKey = getCalorieDateKey(day)
  return (calorieTotalsByDate.value[dateKey] || 0) > 0
}

function isCalorieToday(day: number): boolean {
  const today = new Date()
  return (
    day === today.getDate() &&
    calorieMonth.value.getMonth() === today.getMonth() &&
    calorieMonth.value.getFullYear() === today.getFullYear()
  )
}

function isCalorieFuture(day: number): boolean {
  const today = new Date()
  const checkDate = new Date(calorieMonth.value.getFullYear(), calorieMonth.value.getMonth(), day)
  today.setHours(0, 0, 0, 0)
  return checkDate > today
}

// Navigation for protein calendar
function prevProteinMonth() {
  const newDate = new Date(proteinMonth.value)
  newDate.setMonth(newDate.getMonth() - 1)
  proteinMonth.value = newDate
}

function nextProteinMonth() {
  const newDate = new Date(proteinMonth.value)
  newDate.setMonth(newDate.getMonth() + 1)
  proteinMonth.value = newDate
}

// Navigation for calorie calendar
function prevCalorieMonth() {
  const newDate = new Date(calorieMonth.value)
  newDate.setMonth(newDate.getMonth() - 1)
  calorieMonth.value = newDate
}

function nextCalorieMonth() {
  const newDate = new Date(calorieMonth.value)
  newDate.setMonth(newDate.getMonth() + 1)
  calorieMonth.value = newDate
}

const proteinDaysMetGoalThisMonth = computed(() => {
  let count = 0
  for (let day = 1; day <= proteinDaysInMonth.value; day++) {
    if (proteinDayMetGoal(day)) count++
  }
  return count
})

const calorieDaysMetGoalThisMonth = computed(() => {
  let count = 0
  for (let day = 1; day <= calorieDaysInMonth.value; day++) {
    if (calorieDayMetGoal(day)) count++
  }
  return count
})

// Today's totals
const todayProtein = computed(() => {
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return proteinTotalsByDate.value[dateKey] || 0
})

const todayCalories = computed(() => {
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return calorieTotalsByDate.value[dateKey] || 0
})

// Load data
async function loadData() {
  if (!auth.user?.id) return
  isLoading.value = true
  try {
    const promises: Promise<unknown>[] = []

    // Always load both if in "both" mode, otherwise load the selected one
    const loadProtein = settings.nutritionTracking === 'protein' || settings.nutritionTracking === 'both'
    const loadCalories = settings.nutritionTracking === 'calories' || settings.nutritionTracking === 'both'

    if (loadProtein) {
      promises.push(
        (async () => {
          const { data, error } = await supabase
            .from('protein_intake')
            .select('*')
            .eq('user_id', auth.user!.id)
            .order('recorded_at', { ascending: false })
          if (error) throw error
          proteinIntakes.value = (data ?? []) as ProteinIntake[]
        })()
      )
    }

    if (loadCalories) {
      promises.push(
        (async () => {
          const { data, error } = await supabase
            .from('calorie_intake')
            .select('*')
            .eq('user_id', auth.user!.id)
            .order('recorded_at', { ascending: false })
          if (error) throw error
          calorieIntakes.value = (data ?? []) as CalorieIntake[]
        })()
      )
    }

    await Promise.all(promises)
  } catch (e) {
    console.error('Failed to load nutrition data:', e)
  } finally {
    isLoading.value = false
  }
}

// Submit protein
async function submitProtein() {
  if (!auth.user?.id || !proteinGrams.value) return
  isSubmitting.value = true

  try {
    if (editingProteinId.value) {
      const { error } = await supabase
        .from('protein_intake')
        .update({ grams: parseInt(proteinGrams.value) })
        .eq('id', editingProteinId.value)
      if (error) throw error
      toast.success('Entry updated!')
    } else {
      const { error } = await supabase.from('protein_intake').insert({
        user_id: auth.user.id,
        grams: parseInt(proteinGrams.value),
      } as ProteinIntake)
      if (error) throw error
      toast.success('Protein logged!')
    }

    resetProteinForm()
    showProteinForm.value = false
    await loadData()
  } catch (e) {
    console.error('Failed to save protein:', e)
    toast.error('Failed to save entry')
  } finally {
    isSubmitting.value = false
  }
}

// Submit calories
async function submitCalories() {
  if (!auth.user?.id || !calorieAmount.value) return
  isSubmitting.value = true

  try {
    if (editingCalorieId.value) {
      const { error } = await supabase
        .from('calorie_intake')
        .update({ calories: parseInt(calorieAmount.value) })
        .eq('id', editingCalorieId.value)
      if (error) throw error
      toast.success('Entry updated!')
    } else {
      const { error } = await supabase.from('calorie_intake').insert({
        user_id: auth.user.id,
        calories: parseInt(calorieAmount.value),
      } as CalorieIntake)
      if (error) throw error
      toast.success('Calories logged!')
    }

    resetCalorieForm()
    showCalorieForm.value = false
    await loadData()
  } catch (e) {
    console.error('Failed to save calories:', e)
    toast.error('Failed to save entry')
  } finally {
    isSubmitting.value = false
  }
}

// Delete entries
async function deleteProtein(id: string) {
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
    await loadData()
    toast.success('Entry deleted')
  } catch (e) {
    console.error('Failed to delete entry:', e)
    toast.error('Failed to delete entry')
  }
}

async function deleteCalorie(id: string) {
  const confirmed = await confirmDialog.value?.open({
    title: 'Delete Entry',
    message: 'Are you sure you want to delete this calorie entry?',
    confirmText: 'Delete',
    destructive: true,
  })
  if (!confirmed) return

  try {
    const { error } = await supabase.from('calorie_intake').delete().eq('id', id)
    if (error) throw error
    await loadData()
    toast.success('Entry deleted')
  } catch (e) {
    console.error('Failed to delete entry:', e)
    toast.error('Failed to delete entry')
  }
}

// Today's entries
const todayProteinEntries = computed(() => {
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return proteinIntakes.value
    .filter((intake) => {
      const date = new Date(intake.recorded_at)
      const intakeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return intakeKey === dateKey
    })
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
})

const todayCalorieEntries = computed(() => {
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return calorieIntakes.value
    .filter((intake) => {
      const date = new Date(intake.recorded_at)
      const intakeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return intakeKey === dateKey
    })
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
})

// Close forms when switching views
watch(activeView, () => {
  showProteinForm.value = false
  showCalorieForm.value = false
  showProteinGoalEdit.value = false
  showCalorieGoalEdit.value = false
})

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
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

    <main class="p-4">
      <!-- Toggle tabs for "both" mode -->
      <div v-if="isBothMode" class="flex gap-2 mb-4">
        <button
          @click="activeView = 'protein'"
          class="flex-1 py-2 rounded-lg font-medium transition-colors"
          :class="
            activeView === 'protein'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          "
        >
          Protein
        </button>
        <button
          @click="activeView = 'calories'"
          class="flex-1 py-2 rounded-lg font-medium transition-colors"
          :class="
            activeView === 'calories'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          "
        >
          Calories
        </button>
      </div>

      <!-- ==================== PROTEIN SECTION ==================== -->
      <template v-if="showProteinSection">
        <!-- Protein Summary -->
        <div class="bg-slate-800 rounded-xl p-4 mb-4">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-slate-400 mb-1">Today's Protein</p>
              <p
                class="text-3xl font-bold"
                :class="todayProtein >= proteinGoal ? 'text-emerald-400' : 'text-white'"
              >
                {{ todayProtein }}g
                <span v-if="todayProtein >= proteinGoal" class="text-lg ml-1">✓</span>
              </p>
            </div>
            <div class="text-right">
              <button
                @click="showProteinGoalEdit = !showProteinGoalEdit; newProteinGoal = proteinGoal.toString()"
                class="text-sm text-slate-400 hover:text-white"
              >
                Goal: {{ proteinGoal }}g
              </button>
            </div>
          </div>

          <!-- Goal edit form -->
          <div v-if="showProteinGoalEdit" class="mt-3 pt-3 border-t border-slate-700">
            <label class="block text-sm text-slate-400 mb-2">Daily Goal (grams)</label>
            <div class="flex gap-2">
              <input
                v-model="newProteinGoal"
                type="number"
                class="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                @click="saveProteinGoal"
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
                :class="todayProtein >= proteinGoal ? 'bg-emerald-500' : 'bg-emerald-600'"
                :style="{ width: `${Math.min(100, (todayProtein / proteinGoal) * 100)}%` }"
              />
            </div>
            <p class="text-xs text-slate-500 mt-1">
              {{ Math.max(0, proteinGoal - todayProtein) }}g remaining
            </p>
          </div>
        </div>

        <!-- Add protein button -->
        <button
          v-if="!showProteinForm"
          @click="showProteinForm = true"
          class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-colors mb-4"
        >
          Add Protein
        </button>

        <!-- Protein form -->
        <div v-if="showProteinForm" class="bg-slate-800 rounded-xl p-4 mb-4">
          <h2 class="font-semibold mb-4">{{ editingProteinId ? 'Edit Protein' : 'Add Protein' }}</h2>
          <div class="mb-4">
            <label class="block text-sm font-medium text-slate-300 mb-2">Amount (grams)</label>
            <input
              v-model="proteinGrams"
              type="number"
              placeholder="e.g. 30"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              @keyup.enter="submitProtein"
            />
          </div>
          <div class="flex gap-2">
            <button
              @click="cancelProteinEdit"
              class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="submitProtein"
              :disabled="isSubmitting || !proteinGrams"
              class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {{ isSubmitting ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>

        <!-- Today's protein entries -->
        <div v-if="todayProteinEntries.length > 0" class="bg-slate-800 rounded-xl p-4 mb-4">
          <h3 class="text-sm font-medium text-slate-400 mb-3">Today's Entries</h3>
          <div class="space-y-2">
            <div
              v-for="entry in todayProteinEntries"
              :key="entry.id"
              class="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
            >
              <button @click="startEditProtein(entry)" class="flex-1 text-left">
                <span class="font-medium">{{ entry.grams }}g</span>
                <span class="text-xs text-slate-500 ml-2">
                  {{
                    new Date(entry.recorded_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }}
                </span>
              </button>
              <button
                @click="deleteProtein(entry.id)"
                class="text-slate-500 hover:text-red-400 transition-colors p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Protein Calendar -->
        <div class="bg-slate-800 rounded-xl p-4">
          <div class="flex items-center justify-between mb-4">
            <button @click="prevProteinMonth" class="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 class="font-semibold">{{ proteinMonthName }}</h3>
            <button @click="nextProteinMonth" class="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div class="text-center text-sm text-slate-400 mb-4">
            <span class="text-emerald-400 font-medium">{{ proteinDaysMetGoalThisMonth }}</span> days goal met this month
          </div>

          <div class="grid grid-cols-7 gap-1 mb-2">
            <div v-for="day in ['M', 'T', 'W', 'T', 'F', 'S', 'S']" :key="day" class="text-center text-xs text-slate-500 py-1">
              {{ day }}
            </div>
          </div>

          <LoadingSpinner v-if="isLoading" size="sm" />
          <div v-else class="grid grid-cols-7 gap-1">
            <div v-for="(day, index) in proteinCalendarDays" :key="index" class="aspect-square flex items-center justify-center relative">
              <template v-if="day !== null">
                <div
                  class="w-full h-full flex items-center justify-center rounded-lg text-sm transition-colors"
                  :class="{
                    'bg-emerald-500/20 text-emerald-400': proteinDayMetGoal(day),
                    'bg-slate-700/50 text-slate-400': proteinDayHasData(day) && !proteinDayMetGoal(day),
                    'text-slate-500': !proteinDayHasData(day) && !isProteinFuture(day),
                    'text-slate-600': isProteinFuture(day),
                    'ring-2 ring-emerald-400': isProteinToday(day),
                  }"
                >
                  <span v-if="proteinDayMetGoal(day)" class="text-emerald-400">✓</span>
                  <span v-else>{{ day }}</span>
                </div>
              </template>
            </div>
          </div>

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
      </template>

      <!-- ==================== CALORIES SECTION ==================== -->
      <template v-if="showCalorieSection">
        <!-- Calorie Summary -->
        <div class="bg-slate-800 rounded-xl p-4 mb-4">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-slate-400 mb-1">Today's Calories</p>
              <p
                class="text-3xl font-bold"
                :class="todayCalories >= calorieGoal ? 'text-orange-400' : 'text-white'"
              >
                {{ todayCalories }}
                <span v-if="todayCalories >= calorieGoal" class="text-lg ml-1">✓</span>
              </p>
            </div>
            <div class="text-right">
              <button
                @click="showCalorieGoalEdit = !showCalorieGoalEdit; newCalorieGoal = calorieGoal.toString()"
                class="text-sm text-slate-400 hover:text-white"
              >
                Goal: {{ calorieGoal }}
              </button>
            </div>
          </div>

          <!-- Goal edit form -->
          <div v-if="showCalorieGoalEdit" class="mt-3 pt-3 border-t border-slate-700">
            <label class="block text-sm text-slate-400 mb-2">Daily Goal (calories)</label>
            <div class="flex gap-2">
              <input
                v-model="newCalorieGoal"
                type="number"
                class="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                @click="saveCalorieGoal"
                class="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium"
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
                :class="todayCalories >= calorieGoal ? 'bg-orange-500' : 'bg-orange-600'"
                :style="{ width: `${Math.min(100, (todayCalories / calorieGoal) * 100)}%` }"
              />
            </div>
            <p class="text-xs text-slate-500 mt-1">
              {{ Math.max(0, calorieGoal - todayCalories) }} remaining
            </p>
          </div>
        </div>

        <!-- Add calories button -->
        <button
          v-if="!showCalorieForm"
          @click="showCalorieForm = true"
          class="w-full py-3 bg-orange-600 hover:bg-orange-500 rounded-xl font-medium transition-colors mb-4"
        >
          Add Calories
        </button>

        <!-- Calorie form -->
        <div v-if="showCalorieForm" class="bg-slate-800 rounded-xl p-4 mb-4">
          <h2 class="font-semibold mb-4">{{ editingCalorieId ? 'Edit Calories' : 'Add Calories' }}</h2>
          <div class="mb-4">
            <label class="block text-sm font-medium text-slate-300 mb-2">Amount (calories)</label>
            <input
              v-model="calorieAmount"
              type="number"
              placeholder="e.g. 500"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              @keyup.enter="submitCalories"
            />
          </div>
          <div class="flex gap-2">
            <button
              @click="cancelCalorieEdit"
              class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="submitCalories"
              :disabled="isSubmitting || !calorieAmount"
              class="flex-1 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {{ isSubmitting ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>

        <!-- Today's calorie entries -->
        <div v-if="todayCalorieEntries.length > 0" class="bg-slate-800 rounded-xl p-4 mb-4">
          <h3 class="text-sm font-medium text-slate-400 mb-3">Today's Entries</h3>
          <div class="space-y-2">
            <div
              v-for="entry in todayCalorieEntries"
              :key="entry.id"
              class="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
            >
              <button @click="startEditCalorie(entry)" class="flex-1 text-left">
                <span class="font-medium">{{ entry.calories }}</span>
                <span class="text-xs text-slate-500 ml-2">
                  {{
                    new Date(entry.recorded_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }}
                </span>
              </button>
              <button
                @click="deleteCalorie(entry.id)"
                class="text-slate-500 hover:text-red-400 transition-colors p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Calorie Calendar -->
        <div class="bg-slate-800 rounded-xl p-4">
          <div class="flex items-center justify-between mb-4">
            <button @click="prevCalorieMonth" class="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 class="font-semibold">{{ calorieMonthName }}</h3>
            <button @click="nextCalorieMonth" class="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div class="text-center text-sm text-slate-400 mb-4">
            <span class="text-orange-400 font-medium">{{ calorieDaysMetGoalThisMonth }}</span> days goal met this month
          </div>

          <div class="grid grid-cols-7 gap-1 mb-2">
            <div v-for="day in ['M', 'T', 'W', 'T', 'F', 'S', 'S']" :key="day" class="text-center text-xs text-slate-500 py-1">
              {{ day }}
            </div>
          </div>

          <LoadingSpinner v-if="isLoading" size="sm" />
          <div v-else class="grid grid-cols-7 gap-1">
            <div v-for="(day, index) in calorieCalendarDays" :key="index" class="aspect-square flex items-center justify-center relative">
              <template v-if="day !== null">
                <div
                  class="w-full h-full flex items-center justify-center rounded-lg text-sm transition-colors"
                  :class="{
                    'bg-orange-500/20 text-orange-400': calorieDayMetGoal(day),
                    'bg-slate-700/50 text-slate-400': calorieDayHasData(day) && !calorieDayMetGoal(day),
                    'text-slate-500': !calorieDayHasData(day) && !isCalorieFuture(day),
                    'text-slate-600': isCalorieFuture(day),
                    'ring-2 ring-orange-400': isCalorieToday(day),
                  }"
                >
                  <span v-if="calorieDayMetGoal(day)" class="text-orange-400">✓</span>
                  <span v-else>{{ day }}</span>
                </div>
              </template>
            </div>
          </div>

          <div class="flex justify-center gap-4 mt-4 text-xs text-slate-500">
            <div class="flex items-center gap-1">
              <div class="w-3 h-3 rounded bg-orange-500/20" />
              <span>Goal met</span>
            </div>
            <div class="flex items-center gap-1">
              <div class="w-3 h-3 rounded bg-slate-700/50" />
              <span>Logged</span>
            </div>
            <div class="flex items-center gap-1">
              <div class="w-3 h-3 rounded ring-2 ring-orange-400" />
              <span>Today</span>
            </div>
          </div>
        </div>
      </template>
    </main>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
