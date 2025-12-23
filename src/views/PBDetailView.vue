<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TabNav from '@/components/TabNav.vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { PersonalBest, PersonalBestRecord } from '@/lib/database.types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const pbId = route.params.id as string
const personalBest = ref<PersonalBest | null>(null)
const records = ref<PersonalBestRecord[]>([])
const isLoading = ref(true)
const showForm = ref(false)

const latestRecord = computed(() => records.value[0])

// Form fields
const sets = ref('')
const reps = ref('')
const weight = ref('')
const isSubmitting = ref(false)

// Group editing
const showGroupEdit = ref(false)
const editGroup = ref('')
const isSavingGroup = ref(false)
const allGroups = ref<string[]>([])
const showGroupDropdown = ref(false)

// Filtered group suggestions
const filteredGroups = computed(() => {
  if (!editGroup.value.trim()) return allGroups.value
  const search = editGroup.value.toLowerCase()
  return allGroups.value.filter((g) => g.toLowerCase().includes(search))
})

async function loadData() {
  if (!auth.user?.id) return
  isLoading.value = true
  try {
    // Load personal best (also verify it belongs to this user)
    const { data: pb, error: pbError } = await supabase
      .from('personal_bests')
      .select('*')
      .eq('id', pbId)
      .eq('user_id', auth.user.id)
      .single()

    if (pbError) throw pbError
    personalBest.value = pb as PersonalBest

    // Load records
    const { data: recordsData, error: recordsError } = await supabase
      .from('personal_best_records')
      .select('*')
      .eq('personal_best_id', pbId)
      .eq('user_id', auth.user.id)
      .order('recorded_at', { ascending: false })

    if (recordsError) throw recordsError
    records.value = (recordsData ?? []) as PersonalBestRecord[]

    // Load all group names for suggestions
    const { data: allPbs } = await supabase
      .from('personal_bests')
      .select('group_name')
      .eq('user_id', auth.user.id)
      .not('group_name', 'is', null)

    const groups = new Set<string>()
    allPbs?.forEach((p) => {
      if (p.group_name) groups.add(p.group_name)
    })
    allGroups.value = Array.from(groups).sort()
  } catch (e) {
    console.error('Failed to load data:', e)
    router.push('/pb')
  } finally {
    isLoading.value = false
  }
}

async function addRecord() {
  if (!auth.user?.id || !sets.value || !reps.value || !weight.value) return
  isSubmitting.value = true

  try {
    const { error } = await supabase.from('personal_best_records').insert({
      personal_best_id: pbId,
      user_id: auth.user.id,
      sets: parseInt(sets.value),
      reps: parseInt(reps.value),
      weight: parseFloat(weight.value),
    } as PersonalBestRecord)

    if (error) throw error

    sets.value = ''
    reps.value = ''
    weight.value = ''
    showForm.value = false
    await loadData()
  } catch (e) {
    console.error('Failed to add record:', e)
  } finally {
    isSubmitting.value = false
  }
}

async function deleteRecord(id: string) {
  try {
    const { error } = await supabase.from('personal_best_records').delete().eq('id', id)

    if (error) throw error
    await loadData()
  } catch (e) {
    console.error('Failed to delete record:', e)
  }
}

function startGroupEdit() {
  editGroup.value = personalBest.value?.group_name || ''
  showGroupEdit.value = true
}

function hideGroupDropdownDelayed() {
  setTimeout(() => {
    showGroupDropdown.value = false
  }, 150)
}

async function saveGroup() {
  if (!personalBest.value) return
  isSavingGroup.value = true

  try {
    const { error } = await supabase
      .from('personal_bests')
      .update({ group_name: editGroup.value.trim() || null })
      .eq('id', pbId)

    if (error) throw error
    personalBest.value.group_name = editGroup.value.trim() || null
    showGroupEdit.value = false
  } catch (e) {
    console.error('Failed to update group:', e)
  } finally {
    isSavingGroup.value = false
  }
}

function selectGroupFromDropdown(group: string) {
  editGroup.value = group
  showGroupDropdown.value = false
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
  loadData()
})
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="bg-slate-900 px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="w-20">
          <button @click="router.push('/pb')" class="text-slate-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div class="w-20"></div>
        <div class="w-20"></div>
      </div>
    </header>

    <TabNav />

    <main class="p-4 pb-20">
      <div v-if="isLoading" class="text-center py-8 text-slate-500">Loading...</div>

      <template v-else-if="personalBest">
        <!-- Current PB summary -->
        <div v-if="latestRecord" class="bg-slate-800 rounded-xl p-4 mb-4">
          <p class="text-sm text-slate-400 mb-1">Current PB</p>
          <p class="text-2xl font-bold text-emerald-400">
            {{ latestRecord.sets }} sets x {{ latestRecord.reps }} reps @ {{ latestRecord.weight }}kg
          </p>
          <p class="text-sm text-slate-500 mt-1">{{ formatDate(latestRecord.recorded_at) }}</p>
        </div>

        <!-- Group section -->
        <div class="bg-slate-800 rounded-xl p-4 mb-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-slate-400 mb-1">Group</p>
              <p v-if="!showGroupEdit" class="text-white">
                {{ personalBest.group_name || 'No group' }}
              </p>
            </div>
            <button
              v-if="!showGroupEdit"
              @click="startGroupEdit"
              class="text-sm text-emerald-400 hover:text-emerald-300"
            >
              Edit
            </button>
          </div>

          <!-- Group edit form -->
          <div v-if="showGroupEdit" class="mt-3 relative">
            <input
              v-model="editGroup"
              type="text"
              placeholder="Enter group name"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              @focus="showGroupDropdown = true"
              @blur="hideGroupDropdownDelayed"
            />
            <!-- Group suggestions dropdown -->
            <div
              v-if="showGroupDropdown && filteredGroups.length > 0"
              class="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg overflow-hidden"
            >
              <button
                v-for="group in filteredGroups"
                :key="group"
                @mousedown.prevent="selectGroupFromDropdown(group)"
                class="w-full px-3 py-2 text-left text-white hover:bg-slate-600 transition-colors"
              >
                {{ group }}
              </button>
            </div>
            <div class="flex gap-2 mt-3">
              <button
                @click="showGroupEdit = false"
                class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                @click="saveGroup"
                :disabled="isSavingGroup"
                class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 rounded-lg font-medium transition-colors text-sm"
              >
                {{ isSavingGroup ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Update PB button -->
        <button
          v-if="!showForm"
          @click="showForm = true"
          class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-colors mb-4"
        >
          Update PB
        </button>

        <!-- New record form -->
        <div v-else class="bg-slate-800 rounded-xl p-4 mb-4">
          <h3 class="font-semibold mb-4">New Record</h3>

          <div class="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Sets</label>
              <input
                v-model="sets"
                type="number"
                placeholder="3"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Reps</label>
              <input
                v-model="reps"
                type="number"
                placeholder="10"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">Weight</label>
              <input
                v-model="weight"
                type="number"
                step="0.5"
                placeholder="60"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span class="text-xs text-slate-500 mt-1 block">kg</span>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              @click="showForm = false"
              class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="addRecord"
              :disabled="isSubmitting || !sets || !reps || !weight"
              class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {{ isSubmitting ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>

        <!-- History -->
        <section>
          <h3 class="text-lg font-semibold mb-3 text-slate-300">History</h3>

          <div v-if="records.length === 0" class="text-center py-8 text-slate-500">
            No records yet. Add your first one above.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="record in records"
              :key="record.id"
              class="bg-slate-800 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p class="font-medium">
                  {{ record.sets }} sets x {{ record.reps }} reps @ {{ record.weight }}kg
                </p>
                <p class="text-sm text-slate-500">{{ formatDate(record.recorded_at) }}</p>
              </div>
              <button
                @click="deleteRecord(record.id)"
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
        </section>
      </template>
    </main>
  </div>
</template>
