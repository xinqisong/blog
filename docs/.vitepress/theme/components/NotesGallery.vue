<script setup lang="ts">
import { withBase } from 'vitepress'

const cards = [
  {
    key: 'java',
    number: '01',
    title: 'Java 与并发',
    label: 'JAVA / CONCURRENCY',
    mark: 'JVM',
    description: 'Java 语法、核心技术与 JUC 并发编程。',
    link: '/java/',
  },
  {
    key: 'web',
    number: '02',
    title: 'Web 开发',
    label: 'WEB / JAVASCRIPT',
    mark: 'JS',
    description: 'JavaScript 组成、数据类型与基础语法。',
    link: '/web/',
  },
  {
    key: 'data',
    number: '03',
    title: '数据与持久化',
    label: 'DATA / PERSISTENCE',
    mark: 'SQL',
    description: 'MySQL、Redis、MongoDB 与数据访问框架。',
    link: '/data/',
  },
  {
    key: 'messaging',
    number: '04',
    title: '消息中间件',
    label: 'MESSAGING / MQ',
    mark: 'MQ',
    description: 'ActiveMQ、JMS、消息模型与持久化。',
    link: '/messaging/',
  },
  {
    key: 'engineering',
    number: '05',
    title: '工程实践',
    label: 'ENGINEERING / TOOLS',
    mark: 'DEV',
    description: 'Git、Docker、Nginx、IDEA 与博客部署。',
    link: '/engineering/',
  },
  {
    key: 'reference',
    number: '06',
    title: '日常资料',
    label: 'REFERENCE / DAILY',
    mark: 'NOTE',
    description: '常用命令、安装部署备忘与每日记录。',
    link: '/reference/',
  },
]
</script>

<template>
<section class="notes-gallery" aria-labelledby="notes-gallery-title">
  <div class="notes-gallery-heading">
    <div>
      <span class="notes-sticker">6 TOPICS / ONE NOTEBOOK</span>
      <h2 id="notes-gallery-title">按主题浏览</h2>
    </div>
    <p>七个分类，覆盖语言基础、数据系统、工程实践和日常积累。</p>
  </div>

  <div class="notes-gallery-grid">
    <a
      v-for="card in cards"
      :key="card.key"
      class="notes-gallery-card"
      :class="`notes-gallery-card--${card.key}`"
      :href="withBase(card.link)"
    >
      <div class="notes-gallery-art" aria-hidden="true">
        <span class="notes-gallery-art__number">{{ card.number }}</span>
        <strong>{{ card.mark }}</strong>
        <span class="notes-gallery-art__label">{{ card.label }}</span>
      </div>
      <div class="notes-gallery-content">
        <span>{{ card.label }}</span>
        <h3>{{ card.title }}</h3>
        <p>{{ card.description }}</p>
        <strong>查看分类 <span aria-hidden="true">↗</span></strong>
      </div>
    </a>
  </div>
</section>
</template>
