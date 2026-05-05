# superbeeee.dev

個人部落格，使用 Hexo + NexT 主題（Muse 版型）。

## 快速開始

```bash
# 安裝依賴
npm install

# 本地預覽
npx hexo server
# 開啟 http://localhost:4000
```

## 新增文章

```bash
# 技術文章
npx hexo new post "文章標題"
```

文章 front matter 範例：
```yaml
---
title: 文章標題
date: 2026-01-01 10:00:00
categories:
  - 技術        # 技術 / 跑步 / 跑鞋
tags:
  - Vue.js
  - 馬拉松
---
```

## 目錄結構

```
superbeeee-blog/
├── _config.yml           # 主要設定
├── _config.next.yml      # NexT 主題設定
├── source/
│   ├── _posts/           # 文章（Markdown）
│   ├── about/            # 關於我
│   ├── navigation/       # 文章導覽
│   └── images/           # 圖片
│       └── avatar.png    # 頭像（請替換）
└── package.json
```

## 上線前要做的事

1. 放入頭像：`source/images/avatar.png`
2. 更新 `source/about/index.md` 的 Email 和社群連結
3. 更新 `_config.next.yml` 的社群連結
4. 部署到 Vercel：
   - Build Command: `npx hexo generate`
   - Output Directory: `public`

## 部署

```bash
npx hexo generate   # 產生靜態檔案
npx hexo deploy     # 部署到 GitHub Pages
```
