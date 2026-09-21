import { defineConfig } from 'vitepress'

const projectMdItems = [
  { text: 'Java 基础语法', link: '/ProjectMD/java基础语法' },
  { text: 'Java 核心技术', link: '/ProjectMD/Java核心技术' },
  { text: 'JUC 初级', link: '/ProjectMD/JUC初级' },
  { text: 'Java 面试题大全', link: '/ProjectMD/面试题大全' },
  { text: 'Java 面试题总结', link: '/ProjectMD/面试题总结' },
  { text: 'MySQL 数据库', link: '/ProjectMD/MySQL数据库笔记' },
  { text: 'Redis', link: '/ProjectMD/Redis' },
  { text: 'MongoDB', link: '/ProjectMD/mongo' },
  { text: 'MyBatis-Plus', link: '/ProjectMD/MybatisPlus' },
  { text: 'ActiveMQ', link: '/ProjectMD/ActiveMQ' },
  { text: 'Nginx', link: '/ProjectMD/Nginx' },
  { text: 'Docker 常用命令', link: '/ProjectMD/Docker常用命令' },
  { text: 'Git 基本操作', link: '/ProjectMD/Git基本操作' },
  { text: 'JavaScript', link: '/ProjectMD/JS' },
  { text: 'IDEA 使用技巧', link: '/ProjectMD/idea使用技巧' },
  { text: 'Hexo 博客搭建', link: '/ProjectMD/hexo博客搭建' },
  { text: 'Redis 全套学习笔记', link: '/ProjectMD/Redis全套学习笔记.pdf' },
]

export default defineConfig({
  title: '技术笔记',
  description: 'Java 后端与开发实践笔记',
  lang: 'zh-CN',
  base: '/blog/',
  cleanUrls: true,
  markdown: {
    html: false,
  },
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    logo: '/myicon.ico',
    nav: [
      { text: '首页', link: '/' },
      { text: '项目笔记', link: '/ProjectMD/java基础语法' },
      { text: '常用资料', link: '/usefull/常用' },
      { text: 'GitHub', link: 'https://github.com/xinqisong/blog' },
    ],
    sidebar: {
      '/ProjectMD/': [
        { text: '项目笔记', items: projectMdItems },
      ],
      '/usefull/': [
        {
          text: '常用资料',
          items: [
            { text: '常用', link: '/usefull/常用' },
            { text: '每日分享', link: '/usefull/每日分享' },
          ],
        },
      ],
      '/': [
        {
          text: '快速入口',
          items: [
            { text: 'Java 基础语法', link: '/ProjectMD/java基础语法' },
            { text: 'Java 核心技术', link: '/ProjectMD/Java核心技术' },
            { text: '常用资料', link: '/usefull/常用' },
          ],
        },
      ],
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
