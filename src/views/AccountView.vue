<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <header class="bg-slate-900 px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="w-20">
          <button @click="router.push('/')" class="text-slate-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div class="w-20"></div>
        <div class="w-20"></div>
      </div>
    </header>

    <main class="p-4">
      <h2 class="text-2xl font-bold mb-6">Account</h2>

      <!-- User Info -->
      <section class="mb-6">
        <div class="bg-slate-800 rounded-xl overflow-hidden">
          <div class="px-4 py-4 border-b border-slate-700">
            <p class="text-sm text-slate-400 mb-1">First Name</p>
            <p class="text-white text-lg">{{ auth.firstName || 'Not set' }}</p>
          </div>
          <div class="px-4 py-4">
            <p class="text-sm text-slate-400 mb-1">Email</p>
            <p class="text-white text-lg">{{ auth.user?.email }}</p>
          </div>
        </div>
      </section>

      <!-- Sign Out -->
      <section>
        <button
          @click="auth.signOut()"
          class="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>Sign Out</span>
        </button>
      </section>
    </main>
  </div>
</template>
