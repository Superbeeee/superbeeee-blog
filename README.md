# superbeeee.dev

個人部落格，使用 Hexo + NexT 主題（Muse 版型）。

---

## 環境設定（第一次安裝）

```bash
# 1. 安裝依賴
npm install

# 2. 本地預覽
npx hexo server
# 開啟 http://localhost:4000
```

### 建議的 zsh alias（一次設定，永久受惠）

加到 `~/.zshrc`：

```bash
alias hb="cd ~/superbeeee-blog"
alias hnew='() { cd ~/superbeeee-blog && npx hexo new post "$1"; }'
alias hs="cd ~/superbeeee-blog && npx hexo server"
alias hpub='() { cd ~/superbeeee-blog && git add source/_posts && git commit -m "post: $1" && git push; }'
```

之後新文章流程：

```bash
hnew "tokyo-marathon-2025"   # 建檔
hs                           # 預覽
hpub "東京馬拉松心得"        # 推上線
```

---

## 新增文章：完整流程

### 1. 建檔（一行指令）

```bash
npx hexo new post "english-slug"
```

- **slug 用英文**：URL 會直接吃這個字串（permalink 是 `/post/:year/:month/:title/`），中文檔名會變成 URL 編碼難看又難分享。
- **slug 訂下來就別改**：未來改檔名等於改 URL，會壞外連。
- 指令會同時建出 `source/_posts/english-slug.md` 和同名資料夾（圖片放這）。

### 2. 改 front matter

```yaml
---
title: 文章正式標題（中文 OK）
date: 2026-01-01 10:00:00
categories:
  - 跑步        # 跑步 / 技術 / 跑鞋 / 職涯
tags:
  - 馬拉松
  - On Running
---
```

### 3. 寫內文（推薦工作流）

用 **VS Code 開整個 repo**（不要單開一個 .md）：

- 左側可以同時看舊文當參考
- 預覽按 `Cmd + K` 後 `V`
- 裝 **Paste Image** 套件後，貼圖會自動存到 asset folder + 寫好 `![]()` 標記

### 4. 圖片處理

#### 從手機拿照片

iPhone 拍的照片 → **AirDrop 到 Mac**（不要寄 iCloud Photos 連結，會收成超連結而不是檔案）。

#### 命名與放置

照片用語意化檔名（`finish-line.jpg`、`gear-flatlay.jpg`），放到對應 post 的 asset folder：

```
source/_posts/english-slug/
├── cover.jpg
├── finish-line.jpg
└── gear-flatlay.jpg
```

markdown 中用相對路徑引用即可：

```markdown
![完賽合照](finish-line.jpg)
```

#### 壓圖（重要）

iPhone 拍的圖動輒 4MB，行動版讀很慢。建議壓到 ~300KB：

```bash
brew install imagemagick

# 在 asset folder 裡批次壓
cd source/_posts/english-slug
mogrify -resize 1600x1600\> -quality 82 *.jpg
```

### 5. 邊寫邊預覽

開另一個 terminal 跑：

```bash
npx hexo server
```

存檔後瀏覽器**自動 reload**（改 markdown 不用重啟 server）。

### 6. 上線

```bash
git add source/_posts/english-slug*
git commit -m "post: 你的標題"
git push

# 部署到 Cloudflare Worker
npm run clean && npm run build && npx wrangler deploy
```

詳細部署流程見下方「部署」章節。

---

## 目錄結構

```
superbeeee-blog/
├── _config.yml              # 主要設定（含 marked 圖片解析設定）
├── _config.next.yml         # NexT 主題設定
├── scaffolds/
│   └── post.md              # 新文章模板（hexo new 用的）
├── source/
│   ├── _posts/              # 文章 + 同名 asset folder
│   │   ├── article-slug.md
│   │   └── article-slug/    # 對應文章的圖片
│   ├── about/               # 關於我
│   ├── navigation/          # 文章導覽
│   └── images/
│       └── avatar.png       # 頭像（請替換）
└── package.json
```

---

## 重要設定備忘

### 圖片解析（已在 `_config.yml` 設定）

```yaml
post_asset_folder: true
marked:
  prependRoot: true
  postAsset: true
```

這組設定讓 markdown 的 `![](filename.jpg)` 能正確解析到對應 post 的 asset folder。**不要動這組**，動了所有舊文章的圖片都會壞掉。

### 改 `_config.yml` 後一定要全清

`hexo server` 會 cache config 在記憶體 + cache db 在磁碟，改了 config 後不全清會看到舊狀態：

```bash
pkill -f hexo && npx hexo clean && npx hexo server
```

只有改 markdown 不用，server 會自動 watch source 重 render。

---

## 上線前 checklist

- [ ] 放入頭像：`source/images/avatar.png`
- [ ] 更新 `source/about/index.md` 的 Email 和社群連結
- [ ] 更新 `_config.next.yml` 的社群連結
- [ ] `_config.yml` 的 `url` 改成正式網域

---

## 部署

### Cloudflare Worker（目前正用）

靜態站由 Worker（`src/worker.js`）serve `public/`，並支援 `Accept: text/markdown` 回傳同路徑 `.md` 原始內容（給 LLM 用）。設定在 `wrangler.jsonc`。

```bash
# 一次性：登入
npx wrangler login

# 每次更新內容
npm run clean              # 清 Hexo 快取
npm run build              # 產生 public/
npx wrangler deploy        # 部署到 Cloudflare
```

常用維護指令：

```bash
npx wrangler whoami                  # 確認登入狀態
npx wrangler deployments list        # 看過去部署
npx wrangler rollback                # 回滾上一版
```

### GitHub Pages（備用）

```bash
npx hexo generate
npx hexo deploy
```

---

## AI 流量追蹤

Worker 會偵測 AI bot User-Agent（GPTBot、ClaudeBot、ChatGPT-User、PerplexityBot 等）與 AI 服務 referrer（chatgpt.com、perplexity.ai、claude.ai 等），命中時寫進 D1 database `ai_traffic` 的 `hits` table，永久保留。

### 查詢工具

`bin/ai-stats.sh` 包裝了常用查詢：

```bash
./bin/ai-stats.sh today        # 最近 24 小時的 AI 訪問
./bin/ai-stats.sh 7d           # 過去 7 天 AI 來源排行
./bin/ai-stats.sh 30d          # 過去 30 天 AI 來源排行
./bin/ai-stats.sh top-posts    # 哪篇文章被 AI 抓最多
./bin/ai-stats.sh referrals    # 真人從 AI 對話點連結進來（最有價值）
./bin/ai-stats.sh total        # 總筆數 + 第一筆/最新時間
./bin/ai-stats.sh live         # 即時 stream（wrangler tail）
./bin/ai-stats.sh raw "<SQL>"  # 任意 SQL
```

### D1 直接操作

```bash
npx wrangler d1 list                                              # 列出所有 DB
npx wrangler d1 execute ai_traffic --remote --command="..."        # 任意 SQL
npx wrangler d1 execute ai_traffic --remote --file=src/schema.sql  # 重跑 schema（idempotent）
```

### 重點欄位說明

`hits` table 的 `kind` 欄位有三種值，含義不同：

- `training` — AI 訓練/索引爬蟲（GPTBot、ClaudeBot、CCBot 等），表示內容被抓去當訓練資料或索引
- `realtime` — AI 即時抓取（ChatGPT-User、Claude-User、PerplexityBot 等），表示「有人正在 AI 對話中問問題，AI 即時抓你頁面要回答他」**← 高機率被引用**
- `referral` — 從 AI 服務的 referer 進來，表示「有人從 AI 對話直接點連結來」**← 確定被引用**

`realtime` 跟 `referral` 是最有價值的訊號，代表你的內容真的被 AI 秀給使用者看了。
