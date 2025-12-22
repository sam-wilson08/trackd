import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { guest: true },
    },
    {
      path: '/data',
      name: 'data',
      component: () => import('../views/DataView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/protein',
      name: 'protein',
      component: () => import('../views/ProteinView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pb',
      name: 'pb',
      component: () => import('../views/PBView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pb/:id',
      name: 'pb-detail',
      component: () => import('../views/PBDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/goals',
      name: 'goals',
      component: () => import('../views/GoalsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()

  // Wait for auth to initialize
  if (auth.isLoading) {
    await auth.initialize()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next('/login')
  } else if (to.meta.guest && auth.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
