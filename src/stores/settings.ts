import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type WeightUnit = 'imperial' | 'metric'
export type Theme = 'dark' | 'light'

export const useSettingsStore = defineStore('settings', () => {
  const weightUnit = ref<WeightUnit>('imperial')
  const theme = ref<Theme>('dark')
  const proteinGoal = ref(150)

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
    initialize,
    setWeightUnit,
    setTheme,
    toggleTheme,
    setProteinGoal,
    formatWeight,
  }
})
