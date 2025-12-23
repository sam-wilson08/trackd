<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const isSignUp = ref(false)
const email = ref('')
const password = ref('')
const firstName = ref('')
const error = ref('')
const isSubmitting = ref(false)

async function handleSubmit() {
  error.value = ''
  isSubmitting.value = true

  try {
    if (isSignUp.value) {
      await auth.signUp(email.value, password.value, firstName.value)
      error.value = 'Check your email to confirm your account!'
    } else {
      await auth.signIn(email.value, password.value)
      router.push('/')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'An error occurred'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-white">Trak</h1>
        <p class="text-slate-400 mt-2">Track your fitness journey</p>
      </div>

      <form @submit.prevent="handleSubmit" class="bg-slate-800 rounded-lg p-6 shadow-xl">
        <h2 class="text-xl font-semibold text-white mb-6">
          {{ isSignUp ? 'Create Account' : 'Welcome Back' }}
        </h2>

        <div
          v-if="error"
          class="mb-4 p-3 rounded text-sm"
          :class="
            error.includes('Check your email')
              ? 'bg-emerald-900/50 text-emerald-300'
              : 'bg-red-900/50 text-red-300'
          "
        >
          {{ error }}
        </div>

        <div class="space-y-4">
          <div v-if="isSignUp">
            <label for="firstName" class="block text-sm font-medium text-slate-300 mb-1"
              >First Name</label
            >
            <input
              id="firstName"
              v-model="firstName"
              type="text"
              required
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Your first name"
            />
          </div>

          <div>
            <label for="email" class="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-slate-300 mb-1"
              >Password</label
            >
            <input
              id="password"
              v-model="password"
              type="password"
              required
              minlength="6"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {{ isSubmitting ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In' }}
          </button>
        </div>

        <p class="mt-6 text-center text-sm text-slate-400">
          {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
          <button
            type="button"
            @click="isSignUp = !isSignUp; error = ''"
            class="text-emerald-400 hover:text-emerald-300 font-medium ml-1"
          >
            {{ isSignUp ? 'Sign In' : 'Sign Up' }}
          </button>
        </p>
      </form>
    </div>
  </div>
</template>
