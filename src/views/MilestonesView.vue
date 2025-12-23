<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TabNav from '@/components/TabNav.vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import type { Milestone } from '@/lib/database.types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

const milestones = ref<Milestone[]>([])
const isLoading = ref(true)
const showForm = ref(false)
const newMilestoneName = ref('')
const newMilestoneDate = ref('')
const isSubmitting = ref(false)

// Get today's date in YYYY-MM-DD format for min date
const today = new Date().toISOString().split('T')[0]

async function loadMilestones() {
  if (!auth.user?.id) return
  isLoading.value = true
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
  } finally {
    isLoading.value = false
  }
}

function getMilestoneProgress(milestone: Milestone) {
  const created = new Date(milestone.created_at)
  const target = new Date(milestone.target_date)
  const now = new Date()

  // Set times to midnight for accurate day calculations
  created.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)

  const totalMs = target.getTime() - created.getTime()
  const elapsedMs = now.getTime() - created.getTime()
  const remainingMs = target.getTime() - now.getTime()

  const totalDays = Math.max(1, Math.ceil(totalMs / (1000 * 60 * 60 * 24)))
  const daysLeft = Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
  const percentage = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))

  return { daysLeft, percentage, totalDays }
}

// Sorted milestones by days left
const sortedMilestones = computed(() => {
  return [...milestones.value].sort((a, b) => {
    const aProgress = getMilestoneProgress(a)
    const bProgress = getMilestoneProgress(b)
    return aProgress.daysLeft - bProgress.daysLeft
  })
})

async function createMilestone() {
  if (!auth.user?.id || !newMilestoneName.value.trim() || !newMilestoneDate.value) return
  isSubmitting.value = true

  try {
    const { error } = await supabase.from('milestones').insert({
      user_id: auth.user.id,
      name: newMilestoneName.value.trim(),
      target_date: newMilestoneDate.value,
    })

    if (error) throw error

    newMilestoneName.value = ''
    newMilestoneDate.value = ''
    showForm.value = false
    await loadMilestones()
    toast.success('Milestone created!')
  } catch (e) {
    console.error('Failed to create milestone:', e)
    toast.error('Failed to create milestone')
  } finally {
    isSubmitting.value = false
  }
}

async function deleteMilestone(id: string) {
  const confirmed = await confirmDialog.value?.open({
    title: 'Delete Milestone',
    message: 'Are you sure you want to delete this milestone?',
    confirmText: 'Delete',
    destructive: true,
  })

  if (!confirmed) return

  try {
    const { error } = await supabase.from('milestones').delete().eq('id', id)

    if (error) throw error
    await loadMilestones()
    toast.success('Milestone deleted')
  } catch (e) {
    console.error('Failed to delete milestone:', e)
    toast.error('Failed to delete milestone')
  }
}

async function completeMilestone(id: string) {
  try {
    const { error } = await supabase
      .from('milestones')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    await loadMilestones()
    toast.success('Milestone completed!')
  } catch (e) {
    console.error('Failed to complete milestone:', e)
    toast.error('Failed to complete milestone')
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
  loadMilestones()
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="bg-slate-800 px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="w-20"></div>
        <h1 class="text-xl font-bold text-emerald-400">Trak</h1>
        <div class="flex items-center gap-1 w-24 justify-end">
          <button
            @click="router.push('/milestones')"
            class="text-emerald-400 p-1"
            title="Milestones"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>
          <button
            @click="router.push('/rewards')"
            class="text-slate-400 hover:text-white p-1"
            title="Rewards"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </button>
          <button
            @click="router.push('/settings')"
            class="text-slate-400 hover:text-white p-1"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <TabNav />

    <main class="p-4 pb-20">
      <h2 class="text-2xl font-bold mb-4">Milestones</h2>

      <!-- Add Milestone button -->
      <button
        v-if="!showForm"
        @click="showForm = true"
        class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-colors mb-4"
      >
        Add Milestone
      </button>

      <!-- New Milestone form -->
      <div v-else class="bg-slate-800 rounded-xl p-4 mb-4">
        <h3 class="font-semibold mb-4">New Milestone</h3>

        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-300 mb-2">Name</label>
          <input
            v-model="newMilestoneName"
            type="text"
            placeholder="e.g. Summer Holiday, Competition Day"
            class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-300 mb-2">Target Date</label>
          <input
            v-model="newMilestoneDate"
            type="date"
            :min="today"
            class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div class="flex gap-2">
          <button
            @click="showForm = false; newMilestoneName = ''; newMilestoneDate = ''"
            class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="createMilestone"
            :disabled="isSubmitting || !newMilestoneName.trim() || !newMilestoneDate"
            class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {{ isSubmitting ? 'Creating...' : 'Create' }}
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <LoadingSpinner v-if="isLoading" text="Loading milestones..." />

      <!-- Empty state -->
      <EmptyState
        v-else-if="milestones.length === 0"
        icon="calendar"
        title="No milestones yet"
        description="Set a target date for something you're working towards"
      />

      <!-- Milestones list -->
      <div v-else class="space-y-3">
        <div
          v-for="milestone in sortedMilestones"
          :key="milestone.id"
          class="bg-slate-800 rounded-xl p-4"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1">
              <h3 class="font-semibold text-lg">{{ milestone.name }}</h3>
              <p class="text-sm text-slate-400">{{ formatDate(milestone.target_date) }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="getMilestoneProgress(milestone).daysLeft <= 0"
                @click="completeMilestone(milestone.id)"
                class="text-emerald-400 hover:text-emerald-300 transition-colors p-1"
                title="Mark Complete"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
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
              <button
                @click="deleteMilestone(milestone.id)"
                class="text-slate-500 hover:text-red-400 transition-colors p-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
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

          <!-- Progress bar -->
          <div class="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
            <div
              class="h-full bg-blue-500 transition-all duration-300"
              :style="{ width: `${getMilestoneProgress(milestone).percentage}%` }"
            />
          </div>

          <!-- Days left -->
          <p class="text-sm text-slate-400">
            <template v-if="getMilestoneProgress(milestone).daysLeft > 0">
              {{ getMilestoneProgress(milestone).daysLeft }} days left
            </template>
            <template v-else-if="getMilestoneProgress(milestone).daysLeft === 0">
              <span class="text-emerald-400">Today!</span>
            </template>
            <template v-else>
              <span class="text-amber-400">{{ Math.abs(getMilestoneProgress(milestone).daysLeft) }} days overdue</span>
            </template>
          </p>
        </div>
      </div>
    </main>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
