<script setup lang="ts">
import { withBase } from 'vitepress'

const categories = [
  { title: 'Java 与并发', link: '/java/' },
  { title: 'Web 开发', link: '/web/' },
  { title: '数据与持久化', link: '/data/' },
  { title: '消息中间件', link: '/messaging/' },
  { title: '工程实践', link: '/engineering/' },
  { title: '日常资料', link: '/reference/' },
]

const featuredNotes = [
  {
    number: '01',
    category: 'JAVA',
    title: 'Java 核心技术',
    description: '从语言基础到常用机制，建立一份可以持续补充的知识索引。',
    link: '/ProjectMD/Java核心技术',
  },
  {
    number: '02',
    category: 'DATABASE',
    title: 'MySQL 数据库笔记',
    description: '整理数据库原理、日常使用与开发中常见的问题。',
    link: '/ProjectMD/MySQL数据库笔记',
  },
  {
    number: '03',
    category: 'MIDDLEWARE',
    title: 'Redis 学习笔记',
    description: '记录 Redis 的核心概念、使用方式和实践要点。',
    link: '/ProjectMD/Redis',
  },
]
</script>

<template>
  <div class="profile-home">
    <section id="about" class="profile-intro" aria-labelledby="profile-intro-title">
      <div class="profile-intro__copy">
        <span class="profile-eyebrow">ABOUT / XINQISONG</span>
        <h2 id="profile-intro-title">你好，这里是我的<br />个人技术空间。</h2>
        <p>
          我持续整理 Java 后端、数据库、中间件与日常开发实践，把学习中遇到的问题、验证过的做法和可复用的资料留在这里。
        </p>
        <nav class="profile-tags" aria-label="笔记分类">
          <a
            v-for="category in categories"
            :key="category.title"
            :href="withBase(category.link)"
          >
            {{ category.title }}
          </a>
        </nav>
        <a class="profile-text-link" :href="withBase('/ProjectMD/java基础语法')">
          从技术笔记开始 <span aria-hidden="true">↗</span>
        </a>
      </div>

      <div class="profile-art" aria-label="持续学习、实践和记录的视觉插画">
        <span class="profile-art__spark profile-art__spark--one" aria-hidden="true">✳</span>
        <span class="profile-art__spark profile-art__spark--two" aria-hidden="true">✦</span>
        <div class="profile-art__orbit" aria-hidden="true"></div>
        <div class="profile-art__monogram" aria-hidden="true">X</div>
        <div class="profile-art__note">
          <span>LEARN</span>
          <span>BUILD</span>
          <span>SHARE</span>
        </div>
        <p>持续学习，持续记录</p>
      </div>
    </section>

    <section class="profile-reading" aria-labelledby="profile-reading-title">
      <div class="profile-reading__heading">
        <div>
          <span class="profile-eyebrow">A GOOD PLACE TO START</span>
          <h2 id="profile-reading-title">从这里开始</h2>
        </div>
        <a :href="withBase('/categories/')">浏览全部笔记 <span aria-hidden="true">↗</span></a>
      </div>

      <div class="profile-reading__list">
        <a
          v-for="note in featuredNotes"
          :key="note.number"
          class="profile-reading__item"
          :href="withBase(note.link)"
        >
          <span class="profile-reading__number">{{ note.number }}</span>
          <div class="profile-reading__main">
            <span class="profile-reading__category">{{ note.category }}</span>
            <h3>{{ note.title }}</h3>
            <p>{{ note.description }}</p>
          </div>
          <span class="profile-reading__arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  </div>
</template>
