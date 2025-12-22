<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import type { Goal } from '@/lib/database.types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

// Sort options
const sortBy = ref<'date' | 'name'>('date')

const goals = ref<Goal[]>([])
const isLoading = ref(true)
const showForm = ref(false)

// Form fields
const description = ref('')
const reward = ref('')
const targetDate = ref('')
const isSubmitting = ref(false)

// Edit mode
const editingId = ref<string | null>(null)

function resetForm() {
  description.value = ''
  reward.value = ''
  targetDate.value = ''
  editingId.value = null
}

function startEdit(goal: Goal) {
  editingId.value = goal.id
  description.value = goal.description
  reward.value = goal.reward || ''
  targetDate.value = goal.target_date
  showForm.value = true
}

function cancelEdit() {
  resetForm()
  showForm.value = false
}

// Calculate days remaining and progress
function getDaysRemaining(targetDate: string, createdAt: string): { daysLeft: number; totalDays: number; progress: number } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  const created = new Date(createdAt)
  created.setHours(0, 0, 0, 0)

  const totalDays = Math.ceil((target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  const daysLeft = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const daysPassed = totalDays - daysLeft
  const progress = totalDays > 0 ? Math.min(100, Math.max(0, (daysPassed / totalDays) * 100)) : 100

  return { daysLeft, totalDays, progress }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Sort goals: active first (by target date or name), then completed
const sortedGoals = computed(() => {
  const active = goals.value
    .filter((g) => !g.completed_at)
    .sort((a, b) => {
      if (sortBy.value === 'name') {
        return a.description.localeCompare(b.description)
      }
      return new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
    })

  const completed = goals.value
    .filter((g) => g.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())

  return [...active, ...completed]
})

const activeGoals = computed(() => goals.value.filter((g) => !g.completed_at))

async function loadGoals() {
  if (!auth.user?.id) return
  isLoading.value = true
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('target_date', { ascending: true })

    if (error) throw error
    goals.value = (data ?? []) as Goal[]
  } catch (e) {
    console.error('Failed to load goals:', e)
  } finally {
    isLoading.value = false
  }
}

async function submitGoal() {
  if (!auth.user?.id || !description.value.trim() || !targetDate.value) return
  isSubmitting.value = true

  try {
    if (editingId.value) {
      const { error } = await supabase
        .from('goals')
        .update({
          description: description.value.trim(),
          reward: reward.value.trim() || null,
          target_date: targetDate.value,
        })
        .eq('id', editingId.value)

      if (error) throw error
      toast.success('Goal updated!')
    } else {
      const { error } = await supabase.from('goals').insert({
        user_id: auth.user.id,
        description: description.value.trim(),
        reward: reward.value.trim() || null,
        target_date: targetDate.value,
      } as Goal)

      if (error) throw error
      toast.success('Goal created!')
    }

    resetForm()
    showForm.value = false
    await loadGoals()
  } catch (e) {
    console.error('Failed to save goal:', e)
    toast.error('Failed to save goal')
  } finally {
    isSubmitting.value = false
  }
}

async function toggleComplete(goal: Goal) {
  try {
    const isCompleting = !goal.completed_at
    const { error } = await supabase
      .from('goals')
      .update({
        completed_at: goal.completed_at ? null : new Date().toISOString(),
      })
      .eq('id', goal.id)

    if (error) throw error
    await loadGoals()
    toast.success(isCompleting ? 'Goal completed!' : 'Goal reopened')
  } catch (e) {
    console.error('Failed to update goal:', e)
    toast.error('Failed to update goal')
  }
}

async function deleteGoal(id: string) {
  const confirmed = await confirmDialog.value?.open({
    title: 'Delete Goal',
    message: 'Are you sure you want to delete this goal? This action cannot be undone.',
    confirmText: 'Delete',
    destructive: true,
  })

  if (!confirmed) return

  try {
    const { error } = await supabase.from('goals').delete().eq('id', id)

    if (error) throw error
    await loadGoals()
    toast.success('Goal deleted')
  } catch (e) {
    console.error('Failed to delete goal:', e)
    toast.error('Failed to delete goal')
  }
}

onMounted(() => {
  loadGoals()
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="bg-slate-800 border-b border-slate-700 px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="w-20">
          <button @click="router.push('/')" class="text-slate-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <h1 class="text-xl font-bold text-emerald-400">Goals</h1>
        <div class="w-20 flex justify-end">
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

    <main class="p-4">
      <!-- Summary -->
      <div class="bg-slate-800 rounded-xl p-4 mb-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-400 mb-1">Active Goals</p>
            <p class="text-3xl font-bold text-emerald-400">{{ activeGoals.length }}</p>
          </div>
          <select
            v-model="sortBy"
            class="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      <!-- Add goal button -->
      <button
        v-if="!showForm"
        @click="resetForm(); showForm = true"
        class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-colors mb-4"
      >
        Add Goal
      </button>

      <!-- Goal form -->
      <div v-if="showForm" class="bg-slate-800 rounded-xl p-4 mb-4">
        <h2 class="font-semibold mb-4">{{ editingId ? 'Edit Goal' : 'New Goal' }}</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Description</label>
            <input
              v-model="description"
              type="text"
              placeholder="e.g. Lose 10 lbs, Run a 5K"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Reward</label>
            <input
              v-model="reward"
              type="text"
              placeholder="e.g. New trainers, Spa day"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Target Date</label>
            <input
              v-model="targetDate"
              type="date"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
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
            @click="submitGoal"
            :disabled="isSubmitting || !description.trim() || !targetDate"
            class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {{ isSubmitting ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <LoadingSpinner v-if="isLoading" text="Loading goals..." />

      <!-- Empty state -->
      <EmptyState
        v-else-if="goals.length === 0"
        icon="goals"
        title="No goals yet"
        description="Set your first goal to start tracking your progress"
      />

      <!-- Goals list -->
      <div v-else class="space-y-3">
        <div
          v-for="goal in sortedGoals"
          :key="goal.id"
          class="bg-slate-800 rounded-xl p-4"
          :class="{ 'opacity-60': goal.completed_at }"
        >
          <div class="flex items-start gap-3">
            <!-- Checkbox -->
            <button
              @click="toggleComplete(goal)"
              class="mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
              :class="goal.completed_at ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 hover:border-emerald-400'"
            >
              <svg
                v-if="goal.completed_at"
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-white"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <button
                @click="startEdit(goal)"
                class="text-left w-full"
              >
                <p
                  class="font-medium"
                  :class="goal.completed_at ? 'line-through text-slate-400' : ''"
                >
                  {{ goal.description }}
                </p>
                <p v-if="goal.reward" class="text-sm text-amber-400 mt-1">
                  Reward: {{ goal.reward }}
                </p>
                <p class="text-sm text-slate-500 mt-1">
                  Target: {{ formatDate(goal.target_date) }}
                </p>
              </button>

              <!-- Progress bar (only for active goals) -->
              <div v-if="!goal.completed_at" class="mt-3">
                <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    class="h-full transition-all duration-300"
                    :class="getDaysRemaining(goal.target_date, goal.created_at).daysLeft <= 0 ? 'bg-red-500' : 'bg-emerald-500'"
                    :style="{ width: `${getDaysRemaining(goal.target_date, goal.created_at).progress}%` }"
                  />
                </div>
                <p class="text-xs mt-1" :class="getDaysRemaining(goal.target_date, goal.created_at).daysLeft <= 0 ? 'text-red-400' : 'text-slate-500'">
                  <template v-if="getDaysRemaining(goal.target_date, goal.created_at).daysLeft > 0">
                    {{ getDaysRemaining(goal.target_date, goal.created_at).daysLeft }} days remaining
                  </template>
                  <template v-else-if="getDaysRemaining(goal.target_date, goal.created_at).daysLeft === 0">
                    Due today!
                  </template>
                  <template v-else>
                    {{ Math.abs(getDaysRemaining(goal.target_date, goal.created_at).daysLeft) }} days overdue
                  </template>
                </p>
              </div>

              <!-- Completed date -->
              <p v-if="goal.completed_at" class="text-xs text-emerald-400 mt-2">
                Completed {{ formatDate(goal.completed_at) }}
              </p>
            </div>

            <!-- Delete button -->
            <button
              @click="deleteGoal(goal.id)"
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
    </main>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
