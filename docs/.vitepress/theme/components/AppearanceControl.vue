<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

type AppearanceMode = 'auto' | 'light' | 'dark'

const props = defineProps<{
  id: string
}>()

const appearanceKey = 'vitepress-theme-appearance'
const appearance = ref<AppearanceMode>('auto')
const { isDark } = useData()
const menuOpen = ref(false)
const root = ref<HTMLDivElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLDivElement | null>(null)

const options: { value: AppearanceMode; label: string }[] = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

const currentModeLabel = computed(() => {
  return appearance.value === 'auto'
    ? '跟随系统'
    : appearance.value === 'dark'
      ? '深色'
      : '浅色'
})

const toggleLabel = computed(() => `外观模式：${currentModeLabel.value}`)

const closeMenu = (restoreFocus = false) => {
  menuOpen.value = false
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) {
    nextTick(() => menu.value?.querySelector<HTMLButtonElement>('button')?.focus())
  }
}

const selectMode = (mode: AppearanceMode) => {
  appearance.value = mode
  try {
    const oldValue = window.localStorage.getItem(appearanceKey)
    window.localStorage.setItem(appearanceKey, mode)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: appearanceKey,
        oldValue,
        newValue: mode,
        storageArea: window.localStorage,
      }),
    )
  } catch {
    isDark.value = mode === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : mode === 'dark'
  }
  closeMenu(true)
}

const onPointerDown = (event: PointerEvent) => {
  if (!root.value?.contains(event.target as Node)) closeMenu()
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && menuOpen.value) {
    event.preventDefault()
    closeMenu(true)
  }
}

const onStorage = (event: StorageEvent) => {
  if (event.key !== appearanceKey) return
  appearance.value = event.newValue === 'light' || event.newValue === 'dark'
    ? event.newValue
    : 'auto'
}

const onFocusOut = (event: FocusEvent) => {
  const nextTarget = event.relatedTarget as Node | null
  if (!nextTarget || !root.value?.contains(nextTarget)) closeMenu()
}

onMounted(() => {
  try {
    const savedMode = window.localStorage.getItem(appearanceKey)
    if (savedMode === 'light' || savedMode === 'dark') appearance.value = savedMode
  } catch {
    appearance.value = 'auto'
  }

  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('storage', onStorage)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('storage', onStorage)
})
</script>

<template>
  <div
    ref="root"
    class="appearance-control"
    @focusout="onFocusOut"
  >
    <button
      :id="`${props.id}-trigger`"
      ref="trigger"
      class="appearance-control__trigger"
      type="button"
      :aria-label="toggleLabel"
      :aria-expanded="menuOpen"
      :aria-controls="`${props.id}-menu`"
      title="选择浅色或深色外观"
      @click="toggleMenu"
    >
      <svg
        class="appearance-control__sun"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
      <svg
        class="appearance-control__moon"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.6 8.6 0 1 0 20.2 15.3Z" />
      </svg>
    </button>

    <div
      v-if="menuOpen"
      :id="`${props.id}-menu`"
      ref="menu"
      class="appearance-control__menu"
      role="group"
      aria-label="选择外观模式"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :aria-pressed="appearance === option.value"
        @click="selectMode(option.value)"
      >
        <span>{{ option.label }}</span>
        <span v-if="appearance === option.value" aria-hidden="true">✓</span>
      </button>
    </div>
  </div>
</template>
