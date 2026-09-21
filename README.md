# xinqisong-tech-notes

基于 VitePress 的个人技术笔记。

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
