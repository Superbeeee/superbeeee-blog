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
```

Vercel 接好後 push 即自動 build & deploy。

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

### Vercel（推薦）

1. push repo 到 GitHub
2. Vercel → New Project → Import repo
3. **Build Command**：`npx hexo generate`
4. **Output Directory**：`public`
5. **Install Command**：`npm install`
6. Settings → Domains 加自訂網域

之後每次 push 自動 build。

### GitHub Pages（備用）

```bash
npx hexo generate
npx hexo deploy
```
