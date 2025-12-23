<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useSettingsStore } from '@/stores/settings'
import type { Reward, ProteinIntake, CalorieIntake } from '@/lib/database.types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()
const settings = useSettingsStore()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

// Tab state
const activeTab = ref<'view' | 'create'>('view')

// Data
const rewards = ref<Reward[]>([])
const proteinIntakes = ref<ProteinIntake[]>([])
const calorieIntakes = ref<CalorieIntake[]>([])
const isLoading = ref(true)

// Form fields for creating
const rewardName = ref('')
const trackingType = ref<'protein' | 'calories'>('protein')
const streakType = ref<'consecutive' | 'accumulative'>('consecutive')
const targetDays = ref('')
const isSubmitting = ref(false)

function resetForm() {
  rewardName.value = ''
  trackingType.value = 'protein'
  streakType.value = 'consecutive'
  targetDays.value = ''
}

// Calculate daily totals for nutrition data
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

// Calculate progress for a reward
function calculateRewardProgress(reward: Reward): { current: number; percentage: number } {
  const goal = reward.tracking_type === 'protein' ? settings.proteinGoal : settings.calorieGoal
  const totals = reward.tracking_type === 'protein' ? proteinTotalsByDate.value : calorieTotalsByDate.value

  const startDate = new Date(reward.created_at)
  startDate.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (reward.streak_type === 'consecutive') {
    // Count consecutive days from today backwards (or from completion date if completed)
    let streak = 0
    const checkDate = reward.completed_at ? new Date(reward.completed_at) : new Date()
    checkDate.setHours(0, 0, 0, 0)

    // Check from today/completion backwards
    for (let i = 0; i <= 365; i++) {
      const d = new Date(checkDate)
      d.setDate(d.getDate() - i)

      // Don't count days before the reward was created
      if (d < startDate) break

      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const dayTotal = totals[dateKey] || 0

      if (dayTotal >= goal) {
        streak++
      } else if (i > 0) {
        // Break the streak (but don't break on today if not met yet)
        break
      }
    }

    return {
      current: streak,
      percentage: Math.min(100, (streak / reward.target_days) * 100),
    }
  } else {
    // Accumulative: count all days that met goal since creation
    let daysMetGoal = 0
    const d = new Date(startDate)

    while (d <= today) {
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const dayTotal = totals[dateKey] || 0

      if (dayTotal >= goal) {
        daysMetGoal++
      }

      d.setDate(d.getDate() + 1)
    }

    return {
      current: daysMetGoal,
      percentage: Math.min(100, (daysMetGoal / reward.target_days) * 100),
    }
  }
}

// Check if reward is complete
function isRewardComplete(reward: Reward): boolean {
  const progress = calculateRewardProgress(reward)
  return progress.current >= reward.target_days
}

// Sorted rewards: active first, then completed
const sortedRewards = computed(() => {
  const active = rewards.value.filter((r) => !r.completed_at)
  const completed = rewards.value.filter((r) => r.completed_at)
  return [...active, ...completed]
})

const activeRewards = computed(() => rewards.value.filter((r) => !r.completed_at))

async function loadData() {
  if (!auth.user?.id) return
  isLoading.value = true

  try {
    const [rewardsRes, proteinRes, calorieRes] = await Promise.all([
      supabase
        .from('rewards')
        .select('*')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('protein_intake')
        .select('*')
        .eq('user_id', auth.user.id),
      supabase
        .from('calorie_intake')
        .select('*')
        .eq('user_id', auth.user.id),
    ])

    if (rewardsRes.error) throw rewardsRes.error
    if (proteinRes.error) throw proteinRes.error
    if (calorieRes.error) throw calorieRes.error

    rewards.value = (rewardsRes.data ?? []) as Reward[]
    proteinIntakes.value = (proteinRes.data ?? []) as ProteinIntake[]
    calorieIntakes.value = (calorieRes.data ?? []) as CalorieIntake[]

    // Check and auto-complete any rewards that have reached their target
    for (const reward of rewards.value) {
      if (!reward.completed_at && isRewardComplete(reward)) {
        await supabase
          .from('rewards')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', reward.id)
      }
    }

    // Reload if any were auto-completed
    const hadCompletions = rewards.value.some((r) => !r.completed_at && isRewardComplete(r))
    if (hadCompletions) {
      const { data } = await supabase
        .from('rewards')
        .select('*')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })
      rewards.value = (data ?? []) as Reward[]
    }
  } catch (e) {
    console.error('Failed to load rewards:', e)
  } finally {
    isLoading.value = false
  }
}

async function createReward() {
  if (!auth.user?.id || !rewardName.value.trim() || !targetDays.value) return
  isSubmitting.value = true

  try {
    const { error } = await supabase.from('rewards').insert({
      user_id: auth.user.id,
      name: rewardName.value.trim(),
      tracking_type: trackingType.value,
      streak_type: streakType.value,
      target_days: parseInt(targetDays.value),
    } as Reward)

    if (error) throw error

    toast.success('Reward created!')
    resetForm()
    activeTab.value = 'view'
    await loadData()
  } catch (e) {
    console.error('Failed to create reward:', e)
    toast.error('Failed to create reward')
  } finally {
    isSubmitting.value = false
  }
}

async function claimReward(reward: Reward) {
  try {
    const { error } = await supabase
      .from('rewards')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', reward.id)

    if (error) throw error
    toast.success('Reward claimed! Enjoy!')
    await loadData()
  } catch (e) {
    console.error('Failed to claim reward:', e)
    toast.error('Failed to claim reward')
  }
}

async function deleteReward(id: string) {
  const confirmed = await confirmDialog.value?.open({
    title: 'Delete Reward',
    message: 'Are you sure you want to delete this reward? This action cannot be undone.',
    confirmText: 'Delete',
    destructive: true,
  })

  if (!confirmed) return

  try {
    const { error } = await supabase.from('rewards').delete().eq('id', id)

    if (error) throw error
    await loadData()
    toast.success('Reward deleted')
  } catch (e) {
    console.error('Failed to delete reward:', e)
    toast.error('Failed to delete reward')
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="bg-slate-900 px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="w-20">
          <button @click="router.push('/')" class="text-slate-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
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
            <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>
          <button
            @click="router.push('/rewards')"
            class="text-emerald-400 p-1"
            title="Rewards"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </button>
          <button
            @click="router.push('/settings')"
            class="text-slate-400 hover:text-white p-1"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <main class="p-4">
      <!-- Tabs -->
      <div class="flex gap-2 mb-4">
        <button
          @click="activeTab = 'view'"
          class="flex-1 py-2 rounded-lg font-medium transition-colors"
          :class="
            activeTab === 'view'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          "
        >
          View
        </button>
        <button
          @click="activeTab = 'create'"
          class="flex-1 py-2 rounded-lg font-medium transition-colors"
          :class="
            activeTab === 'create'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          "
        >
          Create
        </button>
      </div>

      <!-- VIEW TAB -->
      <template v-if="activeTab === 'view'">
        <!-- Summary -->
        <div class="bg-slate-800 rounded-xl p-4 mb-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-slate-400 mb-1">Active Rewards</p>
              <p class="text-3xl font-bold text-emerald-400">{{ activeRewards.length }}</p>
            </div>
          </div>
        </div>

        <!-- Loading state -->
        <LoadingSpinner v-if="isLoading" text="Loading rewards..." />

        <!-- Empty state -->
        <EmptyState
          v-else-if="rewards.length === 0"
          icon="goals"
          title="No rewards yet"
          description="Create your first reward to start tracking your nutrition streaks"
        />

        <!-- Rewards list -->
        <div v-else class="space-y-3">
          <div
            v-for="reward in sortedRewards"
            :key="reward.id"
            class="bg-slate-800 rounded-xl p-4"
            :class="{ 'opacity-60': reward.claimed_at }"
          >
            <div class="flex items-start gap-3">
              <!-- Status indicator -->
              <div
                class="mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                :class="
                  reward.claimed_at
                    ? 'bg-slate-600'
                    : reward.completed_at
                      ? 'bg-amber-500'
                      : 'bg-slate-700'
                "
              >
                <svg
                  v-if="reward.claimed_at"
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
                <svg
                  v-else-if="reward.completed_at"
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-white"
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
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <p
                  class="font-medium text-lg"
                  :class="reward.claimed_at ? 'line-through text-slate-400' : ''"
                >
                  {{ reward.name }}
                </p>
                <div class="flex flex-wrap gap-2 mt-1">
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
                  <span class="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                    {{ reward.streak_type === 'consecutive' ? 'Streak' : 'Total' }}
                  </span>
                </div>

                <!-- Progress (only for active rewards) -->
                <div v-if="!reward.claimed_at" class="mt-3">
                  <div class="flex justify-between text-sm mb-1">
                    <span class="text-slate-400">
                      {{ calculateRewardProgress(reward).current }} / {{ reward.target_days }} days
                    </span>
                    <span
                      :class="reward.completed_at ? 'text-amber-400' : 'text-slate-500'"
                    >
                      {{ Math.round(calculateRewardProgress(reward).percentage) }}%
                    </span>
                  </div>
                  <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      class="h-full transition-all duration-300"
                      :class="
                        reward.completed_at
                          ? 'bg-amber-500'
                          : reward.tracking_type === 'protein'
                            ? 'bg-emerald-500'
                            : 'bg-orange-500'
                      "
                      :style="{ width: `${calculateRewardProgress(reward).percentage}%` }"
                    />
                  </div>
                </div>

                <!-- Claim button for completed rewards -->
                <button
                  v-if="reward.completed_at && !reward.claimed_at"
                  @click="claimReward(reward)"
                  class="mt-3 w-full py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-medium transition-colors text-sm"
                >
                  Claim Reward!
                </button>

                <!-- Claimed date -->
                <p v-if="reward.claimed_at" class="text-xs text-slate-500 mt-2">
                  Claimed {{ formatDate(reward.claimed_at) }}
                </p>

                <!-- Created date -->
                <p class="text-xs text-slate-500 mt-1">
                  Created {{ formatDate(reward.created_at) }}
                </p>
              </div>

              <!-- Delete button -->
              <button
                @click="deleteReward(reward.id)"
                class="text-slate-500 hover:text-red-400 transition-colors p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
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
      </template>

      <!-- CREATE TAB -->
      <template v-if="activeTab === 'create'">
        <div class="bg-slate-800 rounded-xl p-4">
          <h2 class="font-semibold mb-4">New Reward</h2>

          <div class="space-y-4">
            <!-- Reward name -->
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Reward Name</label>
              <input
                v-model="rewardName"
                type="text"
                placeholder="e.g. New trainers, Spa day, Cheat meal"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <!-- Tracking type -->
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Track</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  @click="trackingType = 'protein'"
                  class="py-2 px-3 rounded-lg font-medium transition-colors"
                  :class="
                    trackingType === 'protein'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  "
                >
                  Protein
                </button>
                <button
                  type="button"
                  @click="trackingType = 'calories'"
                  class="py-2 px-3 rounded-lg font-medium transition-colors"
                  :class="
                    trackingType === 'calories'
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  "
                >
                  Calories
                </button>
              </div>
              <p class="text-xs text-slate-500 mt-1">
                Goal: {{ trackingType === 'protein' ? `${settings.proteinGoal}g protein` : `${settings.calorieGoal} calories` }} per day
              </p>
            </div>

            <!-- Streak type -->
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Mode</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  @click="streakType = 'consecutive'"
                  class="py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                  :class="
                    streakType === 'consecutive'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  "
                >
                  Consecutive
                </button>
                <button
                  type="button"
                  @click="streakType = 'accumulative'"
                  class="py-2 px-3 rounded-lg font-medium transition-colors text-sm"
                  :class="
                    streakType === 'accumulative'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  "
                >
                  Accumulative
                </button>
              </div>
              <p class="text-xs text-slate-500 mt-1">
                {{ streakType === 'consecutive' ? 'Must hit goal X days in a row (resets if you miss)' : 'Total days goal met (any days count)' }}
              </p>
            </div>

            <!-- Target days -->
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Target Days</label>
              <input
                v-model="targetDays"
                type="number"
                min="1"
                placeholder="e.g. 30"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <button
            @click="createReward"
            :disabled="isSubmitting || !rewardName.trim() || !targetDays"
            class="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
          >
            {{ isSubmitting ? 'Creating...' : 'Create Reward' }}
          </button>
        </div>
      </template>
    </main>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
