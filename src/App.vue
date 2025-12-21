<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900">Trackd</h1>
          <nav class="flex gap-4">
            <RouterLink to="/" class="text-gray-600 hover:text-gray-900">Home</RouterLink>
            <RouterLink to="/about" class="text-gray-600 hover:text-gray-900">About</RouterLink>
          </nav>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <RouterView />
    </main>
  </div>
</template>
