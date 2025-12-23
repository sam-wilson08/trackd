import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type WeightUnit = 'imperial' | 'metric'
export type Theme = 'dark' | 'light'
export type NutritionTracking = 'protein' | 'calories' | 'both'

// Home page is always shown
export const HOME_PAGE = { id: 'home', name: 'Home', path: '/' } as const

// Configurable pages that can be shown/hidden (up to 3)
export const CONFIGURABLE_PAGES = [
  { id: 'data', name: 'Data', path: '/data' },
  { id: 'nutrition', name: 'Nutrition', path: '/nutrition' },
  { id: 'pb', name: 'PBs', path: '/pb' },
] as const

export type ConfigurablePageId = typeof CONFIGURABLE_PAGES[number]['id']

export const useSettingsStore = defineStore('settings', () => {
  const weightUnit = ref<WeightUnit>('imperial')
  const theme = ref<Theme>('dark')
  const proteinGoal = ref(150)
  const calorieGoal = ref(2000)
  const nutritionTracking = ref<NutritionTracking>('protein')
  const enabledPages = ref<ConfigurablePageId[]>(['data', 'nutrition', 'pb'])

  // Load from localStorage
  function initialize() {
    const savedUnit = localStorage.getItem('weightUnit')
    if (savedUnit === 'imperial' || savedUnit === 'metric') {
      weightUnit.value = savedUnit
    }

    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark' || savedTheme === 'light') {
      theme.value = savedTheme
    }

    const savedProteinGoal = localStorage.getItem('proteinGoal')
    if (savedProteinGoal) {
      proteinGoal.value = parseInt(savedProteinGoal)
    }

    const savedCalorieGoal = localStorage.getItem('calorieGoal')
    if (savedCalorieGoal) {
      calorieGoal.value = parseInt(savedCalorieGoal)
    }

    const savedNutritionTracking = localStorage.getItem('nutritionTracking')
    if (savedNutritionTracking === 'protein' || savedNutritionTracking === 'calories' || savedNutritionTracking === 'both') {
      nutritionTracking.value = savedNutritionTracking
    }

    const savedPages = localStorage.getItem('enabledPages')
    if (savedPages) {
      try {
        const parsed = JSON.parse(savedPages) as ConfigurablePageId[]
        // Validate that all parsed IDs are valid configurable page IDs
        const validIds = CONFIGURABLE_PAGES.map(p => p.id)
        const validParsed = parsed.filter(id => validIds.includes(id))
        if (Array.isArray(validParsed) && validParsed.length > 0 && validParsed.length <= 3) {
          enabledPages.value = validParsed
        }
      } catch {
        // Keep default pages
      }
    }

    applyTheme()
  }

  function setWeightUnit(unit: WeightUnit) {
    weightUnit.value = unit
    localStorage.setItem('weightUnit', unit)
  }

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)
    applyTheme()
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function setProteinGoal(goal: number) {
    proteinGoal.value = goal
    localStorage.setItem('proteinGoal', goal.toString())
  }

  function setCalorieGoal(goal: number) {
    calorieGoal.value = goal
    localStorage.setItem('calorieGoal', goal.toString())
  }

  function setNutritionTracking(tracking: NutritionTracking) {
    nutritionTracking.value = tracking
    localStorage.setItem('nutritionTracking', tracking)
  }

  // Page configuration
  function togglePage(pageId: ConfigurablePageId) {
    const index = enabledPages.value.indexOf(pageId)
    if (index > -1) {
      // Don't allow disabling if only one page left
      if (enabledPages.value.length > 1) {
        enabledPages.value.splice(index, 1)
      }
    } else {
      // Don't allow enabling if already at max (3)
      if (enabledPages.value.length < 3) {
        enabledPages.value.push(pageId)
      }
    }
    localStorage.setItem('enabledPages', JSON.stringify(enabledPages.value))
  }

  function isPageEnabled(pageId: ConfigurablePageId): boolean {
    return enabledPages.value.includes(pageId)
  }

  // Get enabled pages with their details for TabNav (Home is always first)
  const enabledPageDetails = computed(() => {
    const configuredPages = CONFIGURABLE_PAGES.filter(page => enabledPages.value.includes(page.id))
    return [HOME_PAGE, ...configuredPages]
  })

  function applyTheme() {
    if (theme.value === 'light') {
      document.documentElement.classList.add('light-theme')
    } else {
      document.documentElement.classList.remove('light-theme')
    }
  }

  // Convert between units
  function formatWeight(stoneOrKg: number | null, lbsOrNull: number | null): string {
    const st = stoneOrKg || 0
    const lbs = lbsOrNull || 0

    if (weightUnit.value === 'metric') {
      // Convert st/lbs to kg (1 stone = 6.35029 kg, 1 lb = 0.453592 kg)
      const totalKg = (st * 6.35029) + (lbs * 0.453592)
      return `${totalKg.toFixed(1)} kg`
    } else {
      if (st === 0 && lbs === 0) return '0'
      if (st === 0) return `${lbs} lbs`
      if (lbs === 0) return `${st} st`
      return `${st} st ${lbs} lbs`
    }
  }

  return {
    weightUnit,
    theme,
    proteinGoal,
    calorieGoal,
    nutritionTracking,
    enabledPages,
    enabledPageDetails,
    initialize,
    setWeightUnit,
    setTheme,
    toggleTheme,
    setProteinGoal,
    setCalorieGoal,
    setNutritionTracking,
    formatWeight,
    togglePage,
    isPageEnabled,
  }
})
