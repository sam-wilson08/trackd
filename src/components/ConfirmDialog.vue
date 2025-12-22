<script setup lang="ts">
import { ref } from 'vue'

const isOpen = ref(false)
const title = ref('')
const message = ref('')
const confirmText = ref('Delete')
const cancelText = ref('Cancel')
const isDestructive = ref(true)
let resolvePromise: ((value: boolean) => void) | null = null

function open(options: {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}): Promise<boolean> {
  title.value = options.title
  message.value = options.message
  confirmText.value = options.confirmText || 'Delete'
  cancelText.value = options.cancelText || 'Cancel'
  isDestructive.value = options.destructive ?? true
  isOpen.value = true

  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

function confirm() {
  isOpen.value = false
  resolvePromise?.(true)
}

function cancel() {
  isOpen.value = false
  resolvePromise?.(false)
}

defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60" @click="cancel" />

        <!-- Dialog -->
        <div class="relative bg-slate-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
          <h3 class="text-lg font-semibold text-white mb-2">{{ title }}</h3>
          <p class="text-slate-400 mb-6">{{ message }}</p>

          <div class="flex gap-3">
            <button
              @click="cancel"
              class="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              {{ cancelText }}
            </button>
            <button
              @click="confirm"
              class="flex-1 py-2.5 rounded-lg font-medium transition-colors"
              :class="isDestructive ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
