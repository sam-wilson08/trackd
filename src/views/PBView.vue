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
const isSubmitting = ref(false)

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
      })
    )

    personalBests.value = pbsWithRecords
  } catch (e) {
    console.error('Failed to load personal bests:', e)
  } finally {
    isLoading.value = false
  }
}

// Sorted PBs
const sortedPBs = computed(() => {
  return [...personalBests.value].sort((a, b) => {
    if (sortBy.value === 'name') {
      return a.name.localeCompare(b.name)
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
})

async function createPB() {
  if (!auth.user?.id || !newPBName.value.trim()) return
  isSubmitting.value = true

  try {
    const { error } = await supabase.from('personal_bests').insert({
      user_id: auth.user.id,
      name: newPBName.value.trim(),
    } as PersonalBest)

    if (error) throw error

    newPBName.value = ''
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
            @keyup.enter="createPB"
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

      <!-- PB list -->
      <div v-else class="space-y-3">
        <div
          v-for="pb in sortedPBs"
          :key="pb.id"
          class="bg-slate-800 rounded-xl p-4"
        >
          <div class="flex items-center justify-between">
            <button
              @click="router.push(`/pb/${pb.id}`)"
              class="flex-1 text-left"
            >
              <h3 class="font-semibold text-lg">{{ pb.name }}</h3>
              <p v-if="pb.latestRecord" class="text-slate-400 text-sm">
                {{ pb.latestRecord.sets }} sets x {{ pb.latestRecord.reps }} reps @ {{ pb.latestRecord.weight }}kg
              </p>
              <p v-else class="text-slate-500 text-sm">No records yet</p>
            </button>
            <button
              @click.stop="deletePB(pb.id)"
              class="text-slate-500 hover:text-red-400 transition-colors p-2"
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
