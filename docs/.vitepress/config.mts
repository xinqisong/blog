import { defineConfig } from 'vitepress'

const categoryLinks = [
  { text: 'Java 与并发', link: '/java/' },
  { text: 'Web 开发', link: '/web/' },
  { text: '数据与持久化', link: '/data/' },
  { text: '消息中间件', link: '/messaging/' },
  { text: '工程实践', link: '/engineering/' },
  { text: '日常资料', link: '/reference/' },
]

const categorySidebar = [
  { text: '分类索引', items: categoryLinks },
  {
    text: 'Java 与并发',
    items: [
      { text: 'Java 基础语法', link: '/ProjectMD/java基础语法' },
      { text: 'Java 核心技术', link: '/ProjectMD/Java核心技术' },
      { text: 'JUC 初级', link: '/ProjectMD/JUC初级' },
    ],
  },
  { text: 'Web 开发', items: [{ text: 'JavaScript', link: '/ProjectMD/JS' }] },
  {
    text: '数据与持久化',
    items: [
      { text: 'MySQL 数据库', link: '/ProjectMD/MySQL数据库笔记' },
      { text: 'Redis', link: '/ProjectMD/Redis' },
      { text: 'MongoDB', link: '/ProjectMD/mongo' },
      { text: 'MyBatis-Plus', link: '/ProjectMD/MybatisPlus' },
    ],
  },
  { text: '消息中间件', items: [{ text: 'ActiveMQ', link: '/ProjectMD/ActiveMQ' }] },
  {
    text: '工程实践',
    items: [
      { text: 'Git 基本操作', link: '/ProjectMD/Git基本操作' },
      { text: 'Docker 常用命令', link: '/ProjectMD/Docker常用命令' },
      { text: 'Nginx', link: '/ProjectMD/Nginx' },
      { text: 'IDEA 使用技巧', link: '/ProjectMD/idea使用技巧' },
      { text: 'Hexo 博客搭建', link: '/ProjectMD/hexo博客搭建' },
    ],
  },
  {
    text: '日常资料',
    items: [
      { text: '常用', link: '/usefull/常用' },
      { text: '每日分享', link: '/usefull/每日分享' },
    ],
  },
]

// Keep the published article URLs stable while the Markdown sources live in topic folders.
const rewrites = {
  'java/Java核心技术.md': 'ProjectMD/Java核心技术.md',
  'java/java基础语法.md': 'ProjectMD/java基础语法.md',
  'java/JUC初级.md': 'ProjectMD/JUC初级.md',
  'web/JS.md': 'ProjectMD/JS.md',
  'data/MySQL数据库笔记.md': 'ProjectMD/MySQL数据库笔记.md',
  'data/Redis.md': 'ProjectMD/Redis.md',
  'data/mongo.md': 'ProjectMD/mongo.md',
  'data/MybatisPlus.md': 'ProjectMD/MybatisPlus.md',
  'messaging/ActiveMQ.md': 'ProjectMD/ActiveMQ.md',
  'engineering/Docker常用命令.md': 'ProjectMD/Docker常用命令.md',
  'engineering/Nginx.md': 'ProjectMD/Nginx.md',
  'engineering/Git基本操作.md': 'ProjectMD/Git基本操作.md',
  'engineering/idea使用技巧.md': 'ProjectMD/idea使用技巧.md',
  'engineering/hexo博客搭建.md': 'ProjectMD/hexo博客搭建.md',
  'interview/面试题大全.md': 'ProjectMD/面试题大全.md',
  'interview/面试题总结.md': 'ProjectMD/面试题总结.md',
  'reference/常用.md': 'usefull/常用.md',
  'reference/每日分享.md': 'usefull/每日分享.md',
}

export default defineConfig({
  title: 'Xinqisong · 技术笔记',
  description: '记录 Java 后端、数据库与工程实践的个人技术空间。',
  lang: 'zh-CN',
  appearance: { disableTransition: false },
  base: '/blog/',
  cleanUrls: true,
  srcExclude: ['interview/index.md'],
  rewrites,
  markdown: {
    html: false,
    image: { lazyLoading: true },
  },
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    logo: '/myicon.ico',
    nav: [
      { text: '首页', link: '/' },
      { text: '全部分类', link: '/categories/' },
      { text: '关于我', link: '/#about' },
    ],
    sidebar: {
      '/': [{ text: '笔记分类', items: categoryLinks }],
      '/java/': categorySidebar,
      '/web/': categorySidebar,
      '/data/': categorySidebar,
      '/messaging/': categorySidebar,
      '/engineering/': categorySidebar,
      '/reference/': categorySidebar,
      '/ProjectMD/': categorySidebar,
      '/usefull/': categorySidebar,
    },
    outline: 'deep',
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/xinqisong/blog' },
    ],
    footer: {
      message: '用 Markdown 记录，用时间沉淀',
      copyright: 'Copyright © xinqisong',
    },
  },
})
