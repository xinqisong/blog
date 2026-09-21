<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'
import { VPNavBarSearch } from 'vitepress/theme'

const props = defineProps<{
  hasSidebar: boolean
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  toggleSidebar: []
}>()

const { theme } = useData()
const route = useRoute()
const menuOpen = ref(false)
const homeLink = withBase('/')

const navItems = computed(() =>
  (theme.value.nav ?? []).filter(
    (item): item is { text: string; link: string } => 'link' in item,
  ),
)

const isExternal = (link: string) => /^https?:\/\//.test(link)

const resolveLink = (link: string) => (isExternal(link) ? link : withBase(link))

const isActive = (link: string) => {
  if (isExternal(link)) return false
  const current = route.path.replace(/\/$/, '') || '/'
  const target = resolveLink(link).replace(/\/$/, '') || '/'
  return current === target || current.startsWith(`${target}/`)
}

const closeMenu = () => {
  menuOpen.value = false
}

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
}

const toggleSidebar = () => {
  emit('toggleSidebar')
  closeMenu()
}
</script>

<template>
  <header class="site-nav" :class="{ 'site-nav--sidebar': props.hasSidebar }">
    <div class="site-nav__inner">
      <a class="site-nav__brand" :href="homeLink" @click="closeMenu">
        <img :src="withBase('/myicon.ico')" alt="" />
        <span>技术笔记</span>
      </a>

      <nav class="site-nav__links" aria-label="主导航">
        <a
          v-for="item in navItems"
          :key="item.text"
          :href="resolveLink(item.link)"
          :class="{ active: isActive(item.link) }"
          :target="isExternal(item.link) ? '_blank' : undefined"
          :rel="isExternal(item.link) ? 'noreferrer' : undefined"
        >
          {{ item.text }}
        </a>
      </nav>

      <div class="site-nav__actions">
        <VPNavBarSearch />
        <a class="site-nav__github" href="https://github.com/xinqisong/blog" target="_blank" rel="noreferrer">GitHub</a>
      </div>

      <button
        class="site-nav__toggle"
        type="button"
        aria-label="打开导航菜单"
        :aria-expanded="menuOpen"
        @click="toggleMenu"
      >
        <span></span><span></span><span></span>
      </button>
    </div>

    <div v-if="menuOpen" class="site-nav__mobile-panel">
      <a
        v-for="item in navItems"
        :key="`mobile-${item.text}`"
        :href="resolveLink(item.link)"
        :class="{ active: isActive(item.link) }"
        @click="closeMenu"
      >
        {{ item.text }}
      </a>
      <button v-if="props.hasSidebar" type="button" @click="toggleSidebar">
        {{ props.sidebarOpen ? '关闭当前目录' : '打开当前目录' }}
      </button>
    </div>
  </header>
</template>
