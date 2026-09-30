# xinqisong-tech-notes

基于 VitePress 的个人技术笔记。

## 笔记目录

- `docs/java/`：Java 语法、核心技术与并发。
- `docs/web/`：Web 与 JavaScript。
- `docs/data/`：数据库、缓存与数据访问框架。
- `docs/messaging/`：消息中间件。
- `docs/engineering/`：开发工具、协作流程、容器和部署。
- `docs/interview/`：面试问答。
- `docs/reference/`：日常命令与短篇记录。

每个分类的 `index.md` 是该主题的目录页。新增笔记时，把 Markdown 文件放入对应分类，更新该分类的目录页和 `docs/.vitepress/config.mts` 中的侧边栏。现有文章通过 VitePress `rewrites` 保持旧网址；新文章默认使用分类目录对应的网址。

## 本地开发

```bash
npm install
npm run docs:dev
```

## 构建与预览

```bash
npm run docs:build
npm run docs:preview
```

部署产物位于 `docs/.vitepress/dist`，GitHub Actions 会在推送到 `main` 分支后自动发布到 GitHub Pages。
