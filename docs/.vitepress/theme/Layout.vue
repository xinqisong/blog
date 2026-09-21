<script setup lang="ts">
import { useRoute } from 'vitepress'
import { computed, provide, useSlots, watch } from 'vue'
import VPBackdrop from 'vitepress/dist/client/theme-default/components/VPBackdrop.vue'
import VPContent from 'vitepress/dist/client/theme-default/components/VPContent.vue'
import VPFooter from 'vitepress/dist/client/theme-default/components/VPFooter.vue'
import VPSidebar from 'vitepress/dist/client/theme-default/components/VPSidebar.vue'
import VPSkipLink from 'vitepress/dist/client/theme-default/components/VPSkipLink.vue'
import { useData } from 'vitepress/dist/client/theme-default/composables/data'
import {
  useCloseSidebarOnEscape,
  useSidebar,
} from 'vitepress/dist/client/theme-default/composables/sidebar'
import NotesGallery from './components/NotesGallery.vue'
import NotFound from './components/NotFound.vue'
import SiteNav from './components/SiteNav.vue'

const route = useRoute()
const { frontmatter } = useData()
const {
  isOpen: isSidebarOpen,
  hasSidebar,
  close: closeSidebar,
  toggle: toggleSidebar,
} = useSidebar()
const slots = useSlots()
const heroImageSlotExists = computed(() => !!slots['home-hero-image'])

watch(() => route.path, closeSidebar)
useCloseSidebarOnEscape(isSidebarOpen, closeSidebar)
provide('hero-image-slot-exists', heroImageSlotExists)
</script>

<template>
  <div
    v-if="frontmatter.layout !== false"
    class="Layout site-layout"
    :class="frontmatter.pageClass"
  >
    <slot name="layout-top" />
    <VPSkipLink />
    <VPBackdrop
      class="backdrop"
      :show="isSidebarOpen"
      @click="closeSidebar"
    />

    <SiteNav
      :has-sidebar="hasSidebar"
      :sidebar-open="isSidebarOpen"
      @toggle-sidebar="toggleSidebar"
    />

    <VPSidebar :open="isSidebarOpen">
      <template #sidebar-nav-before><slot name="sidebar-nav-before" /></template>
      <template #sidebar-nav-after><slot name="sidebar-nav-after" /></template>
    </VPSidebar>

    <VPContent>
      <template #page-top><slot name="page-top" /></template>
      <template #page-bottom><slot name="page-bottom" /></template>
      <template #not-found><NotFound /></template>
      <template #home-hero-before><slot name="home-hero-before" /></template>
      <template #home-hero-info-before><slot name="home-hero-info-before" /></template>
      <template #home-hero-info><slot name="home-hero-info" /></template>
      <template #home-hero-info-after><slot name="home-hero-info-after" /></template>
      <template #home-hero-actions-after><slot name="home-hero-actions-after" /></template>
      <template #home-hero-image><slot name="home-hero-image" /></template>
      <template #home-hero-after><slot name="home-hero-after" /></template>
      <template #home-features-before><slot name="home-features-before" /></template>
      <template #home-features-after><NotesGallery /></template>
      <template #doc-footer-before><slot name="doc-footer-before" /></template>
      <template #doc-before><slot name="doc-before" /></template>
      <template #doc-after><slot name="doc-after" /></template>
      <template #doc-top><slot name="doc-top" /></template>
      <template #doc-bottom><slot name="doc-bottom" /></template>
      <template #aside-top><slot name="aside-top" /></template>
      <template #aside-bottom><slot name="aside-bottom" /></template>
      <template #aside-outline-before><slot name="aside-outline-before" /></template>
      <template #aside-outline-after><slot name="aside-outline-after" /></template>
      <template #aside-ads-before><slot name="aside-ads-before" /></template>
      <template #aside-ads-after><slot name="aside-ads-after" /></template>
    </VPContent>

    <VPFooter />
    <slot name="layout-bottom" />
  </div>
  <Content v-else />
</template>
