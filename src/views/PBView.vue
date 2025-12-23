<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TabNav from '@/components/TabNav.vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import type { PersonalBest, PersonalBestRecord } from '@/lib/database.types'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()
const confirmDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null)

// Sort options
const sortBy = ref<'date' | 'name'>('date')

const personalBests = ref<(PersonalBest & { latestRecord?: PersonalBestRecord })[]>([])
const isLoading = ref(true)
const showForm = ref(false)
const newPBName = ref('')
const newPBGroup = ref('')
const isSubmitting = ref(false)

// Group management
const expandedGroups = ref<Set<string>>(new Set())
const showGroupSuggestions = ref(false)

// Get unique group names from existing PBs
const existingGroups = computed(() => {
  const groups = new Set<string>()
  personalBests.value.forEach((pb) => {
    if (pb.group_name) groups.add(pb.group_name)
  })
  return Array.from(groups).sort()
})

// Filter suggestions based on input
const filteredGroupSuggestions = computed(() => {
  if (!newPBGroup.value.trim()) return existingGroups.value
  const search = newPBGroup.value.toLowerCase()
  return existingGroups.value.filter((g) => g.toLowerCase().includes(search))
})

// Group PBs for display
const groupedPBs = computed(() => {
  const ungrouped: (PersonalBest & { latestRecord?: PersonalBestRecord })[] = []
  const groups: Record<string, (PersonalBest & { latestRecord?: PersonalBestRecord })[]> = {}

  // Sort PBs first
  const sorted = [...personalBests.value].sort((a, b) => {
    if (sortBy.value === 'name') {
      return a.name.localeCompare(b.name)
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Organize into groups
  sorted.forEach((pb) => {
    if (pb.group_name) {
      if (!groups[pb.group_name]) {
        groups[pb.group_name] = []
      }
      groups[pb.group_name]!.push(pb)
    } else {
      ungrouped.push(pb)
    }
  })

  return { ungrouped, groups }
})

// Get sorted group names
const sortedGroupNames = computed(() => {
  return Object.keys(groupedPBs.value.groups).sort()
})

function toggleGroup(groupName: string) {
  if (expandedGroups.value.has(groupName)) {
    expandedGroups.value.delete(groupName)
  } else {
    expandedGroups.value.add(groupName)
  }
}

function selectGroupSuggestion(group: string) {
  newPBGroup.value = group
  showGroupSuggestions.value = false
}

function hideGroupSuggestionsDelayed() {
  setTimeout(() => {
    showGroupSuggestions.value = false
  }, 150)
}

async function loadPersonalBests() {
  if (!auth.user?.id) return
  isLoading.value = true
  try {
    // Load personal bests
    const { data: pbs, error: pbError } = await supabase
      .from('personal_bests')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })

    if (pbError) throw pbError

    // Load latest record for each PB
    const pbsWithRecords = await Promise.all(
      ((pbs ?? []) as PersonalBest[]).map(async (pb) => {
        const { data: records } = await supabase
          .from('personal_best_records')
          .select('*')
          .eq('personal_best_id', pb.id)
          .order('recorded_at', { ascending: false })
          .limit(1)

        return {
          ...pb,
          latestRecord: (records?.[0] as PersonalBestRecord) || undefined,
        }
      }),
    )

    personalBests.value = pbsWithRecords
  } catch (e) {
    console.error('Failed to load personal bests:', e)
  } finally {
    isLoading.value = false
  }
}

async function createPB() {
  if (!auth.user?.id || !newPBName.value.trim()) return
  isSubmitting.value = true

  try {
    const { error } = await supabase.from('personal_bests').insert({
      user_id: auth.user.id,
      name: newPBName.value.trim(),
      group_name: newPBGroup.value.trim() || null,
    })

    if (error) throw error

    newPBName.value = ''
    newPBGroup.value = ''
    showForm.value = false
    await loadPersonalBests()
    toast.success('Personal best created!')
  } catch (e) {
    console.error('Failed to create personal best:', e)
    toast.error('Failed to create personal best')
  } finally {
    isSubmitting.value = false
  }
}

async function deletePB(id: string) {
  const confirmed = await confirmDialog.value?.open({
    title: 'Delete Personal Best',
    message: 'Are you sure? This will also delete all records for this exercise.',
    confirmText: 'Delete',
    destructive: true,
  })

  if (!confirmed) return

  try {
    const { error } = await supabase.from('personal_bests').delete().eq('id', id)

    if (error) throw error
    await loadPersonalBests()
    toast.success('Personal best deleted')
  } catch (e) {
    console.error('Failed to delete personal best:', e)
    toast.error('Failed to delete personal best')
  }
}

onMounted(() => {
  loadPersonalBests()
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

    <main class="p-4 pb-20">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold">Personal Bests</h2>
        <select
          v-model="sortBy"
          class="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="date">Sort by Date</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      <!-- Add PB button -->
      <button
        v-if="!showForm"
        @click="showForm = true"
        class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-colors mb-4"
      >
        Add New PB
      </button>

      <!-- New PB form -->
      <div v-else class="bg-slate-800 rounded-xl p-4 mb-4">
        <h3 class="font-semibold mb-4">New Personal Best</h3>

        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-300 mb-2">Exercise Name</label>
          <input
            v-model="newPBName"
            type="text"
            placeholder="e.g. Bench Press, Squat, Deadlift"
            class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div class="mb-4 relative">
          <label class="block text-sm font-medium text-slate-300 mb-2">Group (optional)</label>
          <input
            v-model="newPBGroup"
            type="text"
            placeholder="e.g. Upper Body, Legs, Olympic Lifts"
            class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            @focus="showGroupSuggestions = true"
            @blur="hideGroupSuggestionsDelayed"
            @keyup.enter="createPB"
          />
          <!-- Group suggestions dropdown -->
          <div
            v-if="showGroupSuggestions && filteredGroupSuggestions.length > 0"
            class="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg overflow-hidden"
          >
            <button
              v-for="group in filteredGroupSuggestions"
              :key="group"
              @mousedown.prevent="selectGroupSuggestion(group)"
              class="w-full px-3 py-2 text-left text-white hover:bg-slate-600 transition-colors"
            >
              {{ group }}
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            @click="showForm = false; newPBName = ''; newPBGroup = ''"
            class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="createPB"
            :disabled="isSubmitting || !newPBName.trim()"
            class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {{ isSubmitting ? 'Creating...' : 'Create' }}
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <LoadingSpinner v-if="isLoading" text="Loading personal bests..." />

      <!-- Empty state -->
      <EmptyState
        v-else-if="personalBests.length === 0"
        icon="pb"
        title="No personal bests yet"
        description="Start tracking your lifting progress by adding your first exercise"
      />

      <!-- PB list with groups -->
      <div v-else class="space-y-3">
        <!-- Ungrouped PBs (shown at top level) -->
        <div v-for="pb in groupedPBs.ungrouped" :key="pb.id" class="bg-slate-800 rounded-xl p-4">
          <div class="flex items-center justify-between">
            <button @click="router.push(`/pb/${pb.id}`)" class="flex-1 text-left">
              <h3 class="font-semibold text-lg">{{ pb.name }}</h3>
              <p v-if="pb.latestRecord" class="text-slate-400 text-sm">
                {{ pb.latestRecord.sets }} sets x {{ pb.latestRecord.reps }} reps @
                {{ pb.latestRecord.weight }}kg
              </p>
              <p v-else class="text-slate-500 text-sm">No records yet</p>
            </button>
            <button
              @click.stop="deletePB(pb.id)"
              class="text-slate-500 hover:text-red-400 transition-colors p-2"
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

        <!-- Grouped PBs (collapsible sections) -->
        <div v-for="groupName in sortedGroupNames" :key="groupName" class="space-y-2">
          <!-- Group header -->
          <button
            @click="toggleGroup(groupName)"
            class="w-full flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 rounded-xl p-3 transition-colors"
          >
            <div class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-slate-400 transition-transform"
                :class="{ 'rotate-90': expandedGroups.has(groupName) }"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="font-medium text-slate-300">{{ groupName }}</span>
            </div>
            <span class="text-sm text-slate-500">{{ groupedPBs.groups[groupName]?.length }}</span>
          </button>

          <!-- Group items (collapsed/expanded) -->
          <div v-if="expandedGroups.has(groupName)" class="pl-4 space-y-2">
            <div
              v-for="pb in groupedPBs.groups[groupName]"
              :key="pb.id"
              class="bg-slate-800 rounded-xl p-4"
            >
              <div class="flex items-center justify-between">
                <button @click="router.push(`/pb/${pb.id}`)" class="flex-1 text-left">
                  <h3 class="font-semibold text-lg">{{ pb.name }}</h3>
                  <p v-if="pb.latestRecord" class="text-slate-400 text-sm">
                    {{ pb.latestRecord.sets }} sets x {{ pb.latestRecord.reps }} reps @
                    {{ pb.latestRecord.weight }}kg
                  </p>
                  <p v-else class="text-slate-500 text-sm">No records yet</p>
                </button>
                <button
                  @click.stop="deletePB(pb.id)"
                  class="text-slate-500 hover:text-red-400 transition-colors p-2"
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
          </div>
        </div>
      </div>
    </main>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
