<script setup lang="ts">
const cards = [
  {
    title: 'Java 后端',
    label: 'JAVA / BACKEND',
    description: '基础语法、核心技术、JUC 与面试题。',
    image: '/blog/theme/java-backend.png',
    link: '/blog/ProjectMD/java基础语法',
  },
  {
    title: '数据与系统',
    label: 'DATA / SYSTEMS',
    description: 'MySQL、Redis、MongoDB 与分布式系统。',
    image: '/blog/theme/data-systems.png',
    link: '/blog/ProjectMD/MySQL数据库笔记',
  },
  {
    title: '工程工具',
    label: 'TOOLS / DEVOPS',
    description: 'Git、Docker、Nginx 和日常开发实践。',
    image: '/blog/theme/devops-tools.png',
    link: '/blog/ProjectMD/Docker常用命令',
  },
]
</script>

<template>

<section class="notes-gallery" aria-label="笔记主题">
  <div class="notes-gallery-heading">
    <div>
      <span class="notes-sticker">EXPLORE TOPICS</span>
      <h2>从一个主题开始</h2>
    </div>
    <p>把零散知识整理成可检索、可复用的长期资产。</p>
  </div>

  <div class="notes-gallery-grid">
    <a
      v-for="(card, index) in cards"
      :key="card.title"
      class="notes-gallery-card"
      :class="`notes-gallery-card--${index + 1}`"
      :href="card.link"
    >
      <div class="notes-gallery-image-wrap">
        <img :src="card.image" :alt="card.title" loading="lazy" />
      </div>
      <div class="notes-gallery-content">
        <span>{{ card.label }}</span>
        <h3>{{ card.title }}</h3>
        <p>{{ card.description }}</p>
        <strong>OPEN NOTES →</strong>
      </div>
    </a>
  </div>
</section>
</template>
