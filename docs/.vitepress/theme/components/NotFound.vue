<script setup lang="ts">
import { withBase } from "vitepress";
const homeLink = withBase("/");
const notesLink = withBase("/ProjectMD/java基础语法");
</script>
<template>
  <main class="custom-not-found">
    <div class="custom-not-found__copy">
      <span class="custom-not-found__label">ERROR / 404</span>
      <div class="custom-not-found__code">404</div>
      <h1>这页笔记走丢了</h1>
      <p>你访问的内容不存在，或者它已经被移动到别的章节。</p>
      <div class="custom-not-found__actions">
        <a :href="homeLink">回到首页</a><a :href="notesLink">浏览笔记</a>
      </div>
    </div>
    <div class="custom-not-found__art" aria-hidden="true">
      <span class="custom-not-found__star">✦</span
      ><span class="custom-not-found__orb">?</span
      ><span class="custom-not-found__scribble">LOST<br />NOTE</span>
    </div>
  </main>
</template>
