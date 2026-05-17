---
title: PM 視角拆解 AI Workflow：以好願書 v2 為例
date: 2026-05-17 14:30:00
lang: zh-TW
translation_key: haoyuanshu-v2-pm-ai-workflow
description: 以「好願書 v2」為例，拆解一條 PM 真正能跑通的 AI workflow：NotebookLM 跑競品分析、人腦判讀 gap、openspec 寫死邊界、Claude 出畫面、Claude Code 對著 tasks.md 寫 code、Notion 同步給人。記錄哪些節點能丟給 AI、哪些必須是人做的。
categories:
  - 技術
tags:
  - AI
  - PM
  - Claude
  - NotebookLM
  - openspec
  - Product Management
---

> 以「好願書 v2」為例，拆解一條 PM 真正能跑通的 AI workflow

## 1. 從 v1 開始：先有痛點，才有產品

「好願書」是一款做給自己的 app。我每天念心經，但常常忘記今天念到第幾遍、上個月有沒有持續。市面上的念佛計數器要嘛太醜（90 年代 UI）、要嘛太複雜（綁帳號、社群、廣告），所以我做了 v1。

v1 解決的核心痛點很單純：

- **念誦計數**：±1 按鈕 + 木魚音效（`woodfish.wav`）
- **發願計劃**：可以設定「為家人念 108 遍 × 49 天」這種有目標的修行
- **本地持久化**：AsyncStorage，重開 app 進度不掉
- **禪意 UI**：宣紙米色調、Noto Serif TC、無廣告

技術棧很乾淨：Expo SDK 54、React Native、TypeScript、Zustand。9 個畫面（`src/screens/`），全部本地優先。

問題是——**v1 解了我的痛點，但這只代表 N=1**。要長到 v2，PM 工作正式開始。

<!-- more -->

## 2. 市場研究：NotebookLM 跑競品分析

PM 第一個會犯的錯，是憑感覺加功能。「啊我覺得應該加一個共修圈」——這是 founder mode，不是 PM mode。

我把 App Store 上前 10 名念佛/冥想/修行類 app 的官網、評論、Reddit 討論串、PTT 佛版相關貼文，全部丟進 **NotebookLM**，跑兩份報告：

**Source 一覽（餵給 NotebookLM）：**

- Insight Timer、Calm、Headspace 的功能頁
- 念佛機、佛緣、禪心 App Store 中文評論前 200 則
- r/Buddhism、佛版「修行記錄 app」討論串
- 蘋果開發者大會 Mindfulness 類別獎項說明

**Prompt 1：競品功能矩陣**

> 列出每個 app 的核心功能、收費模式、目標受眾，輸出成 markdown table。

**Prompt 2：使用者抱怨的功能缺口**

> 從評論與討論串中，找出使用者反覆抱怨「希望有但目前沒有」的功能，依出現頻率排序。

NotebookLM 的價值不在於它「會分析」，而在於它**讀完一百份資料後還能引用原文**。它不會幻想出一個 Reddit 評論——每個結論都點得到出處。

報告丟出三個重複出現的 gap：

1. 「換手機進度就沒了」（提到 28 次）
2. 「沒有人陪我念」（共修需求，提到 19 次）
3. 「想送功德給特定的人但介面太死板」（提到 14 次）

## 3. PM 判讀：這一步不能丟給 AI

報告有了，**但 NotebookLM 不會幫我決定 v2 要做什麼**。

這裡是 PM 工作不可外包的部分——你要對齊「使用者抱怨」「產品哲學」「實作成本」三件事。

舉例：第 2 名的「共修圈」呼聲很高，但好願書的核心定位是「**本地優先、不收集、不註冊**」（`README.md` 寫得很清楚）。一旦做共修，就要有帳號、有伺服器、有審核——整個產品 DNA 變了。

我的判讀結論，v2 只做三件事：

| v2 改動 | 來自哪個 gap | 為什麼選它 |
|---|---|---|
| **跨裝置同步（end-to-end 加密）** | gap #1 | 痛點最強，但堅持加密以維持「不收集」原則 |
| **回向對象資料夾化** | gap #3 | 低實作成本，強化現有功德封存體驗 |
| **語音引導念誦（離線 TTS）** | 自己觀察 | 念到累的時候想閉眼，現有 UI 只能盯著看 |

砍掉的：共修、社群、訂閱制。**這是人做的決策，AI 給的是輸入，不是輸出。**

## 4. 寫 Spec：openspec proposal.md

決策定了，下一步是把它寫死。我用 **openspec** 這套輕量規格流程（`openspec/changes/<date>-<slug>/proposal.md`）。

格式就三段：

```markdown
## Why
v1 完成本地念誦記錄體驗，但使用者換裝置進度全失、回向對象難以管理、
長時間念誦時需要更少視覺干擾。v2 解決三件事，不擴張產品邊界。

## What Changes
- 新增 `sync` capability：透過 iCloud / Google Drive 端對端加密同步 plans + dailyLogs
- 擴充 `completion-flow`：回向類別改為使用者自訂資料夾（family / self / 眾生 / 亡者 / custom）
- 新增 `voice-guidance` capability：離線 TTS 引導念誦（expo-speech），可與木魚音效並存

## Out of scope
- 帳號系統（同步使用平台 cloud，無自有帳號）
- 社群、共修圈
- 訂閱制收費
```

**Out of scope 比 What Changes 更重要**。它是 PM 對工程師、設計師、未來的自己劃下的邊界。少了這段，三個月後一定有人問「欸要不要順便加個分享按鈕」。

寫 spec 本身可以丟給 Claude 起草，但 **Out of scope 必須人寫**——AI 不知道哪些東西碰了會死。

## 5. 設計：Claude 拿 spec 出畫面

spec 進 Claude，要求它根據 `proposal.md` 的 What Changes 產出畫面。

我的 prompt 不是「畫一個漂亮的同步設定頁」，而是：

> 根據 `openspec/changes/2026-05-17-v2/proposal.md` 的同步功能描述，在 `src/screens/SettingsScreen.tsx` 既有「資料管理」區塊下方，新增「跨裝置同步」section。
>
> 必須符合：
> - 視覺風格延續 `src/theme/tokens.ts` 既有 light/dark token
> - 不引入新的設計語言（沿用 `Seal`、`Hairline`、`PaperBg`）
> - 同步狀態三態：未啟用 / 同步中 / 最近同步時間
>
> 不要實作邏輯，只要 UI。

關鍵在於——**spec 是設計的約束，不是建議**。

AI 會試圖「優化」你的 spec。它會說「我幫你加了一個進度條更好」「我加了一個 toggle 更直覺」。每多一個它自作主張的東西，後面對齊成本就多一份。所以 prompt 寫明「**根據 spec，不要擴張**」。

## 6. 對齊：PM 看畫面對 spec

這一步又是人類工作。

我把 AI 產出的 SettingsScreen 改動拿來逐項對：

- ✅ 三態同步狀態 → 有
- ✅ 沿用 Hairline 分隔 → 有
- ❌ AI 多加了一個「立即同步」按鈕 → spec 沒寫，砍掉
- ❌ AI 把「最近同步時間」用 `toLocaleString()` 顯示 → app 整體用農曆/中文日期，要改成 `src/utils/date.ts` 既有的格式化

**AI 給的畫面對的 spec 有 80% 準**。剩下 20% 是它沒看見的全局約束（既有 utils、既有設計語言慣例、產品調性）。這 20% 是 PM 在守的東西。

## 7. 開發：Claude Code + tasks.md

對齊完成後，最後一段才是工程師的活——而工程師可以是 Claude Code。

openspec 的好處是它強迫你寫 `tasks.md`。原本的 v1 任務拆解我留著當範本（`openspec/changes/archive/2026-05-16-haoyuanshu-expo-app/tasks.md`），17 個區塊、每個區塊 4–9 個 checkbox。

v2 的 `tasks.md` 結構：

```markdown
## 1. 同步基礎設施
- [ ] 1.1 src/utils/sync.ts：iCloud KVS / Google Drive AppData 抽象層
- [ ] 1.2 src/store/sync.ts：Zustand slice，三態狀態機
- [ ] 1.3 加密層：libsodium secretbox，金鑰存 Keychain

## 2. SettingsScreen 同步區塊
- [ ] 2.1 整合步驟 6 設計稿
- [ ] 2.2 串接 useSyncStore selectors
...
```

Claude Code 拿到 `proposal.md + design.md + tasks.md + 設計稿截圖`，可以**逐項勾選任務直接寫 code**。它不會憑空發明 API、不會亂改既有 store 結構，因為它要對著 spec 跑。

我這邊只做一件事：**code review，確認沒越界**。每寫完一個 task block 就 commit，commit message 引用 task 編號（`feat(sync): 1.1 add sync abstraction layer`）。

## 8. 文件：Notion 同步給所有人

最後一步：把 `proposal.md` + 最終決策 + 對齊紀錄，全部丟到 Notion。

我不會把整份 markdown 複製貼上——那等於把開發中倉作為單一資訊源的優勢丟掉。我做的是：

- **Notion 上只放結論性文件**：v2 目標、What / Why / Out of scope、預計上線時間
- **連結回 GitHub**：`openspec/changes/2026-05-17-v2/` 是 single source of truth
- **設計稿、截圖、決策紀錄**放 Notion，因為這些東西進 git 太重

Notion 是給「不寫 code 的人」看的視窗。git repo 是給「會 checkout 的人」用的真相。**不要混。**

## 總結：哪些是 AI 做的，哪些必須是人做的

| 流程節點 | 工具 | 能丟 AI | 不能丟 AI |
|---|---|---|---|
| **市場研究** | NotebookLM | ✅ 讀完幾百份資料、提煉重複出現的抱怨、生競品矩陣 | ❌ 決定哪份資料值得餵進去 |
| **判讀報告** | 人腦 + 一杯咖啡 | — | ❌ **全部**。對齊產品哲學、實作成本、使用者強度是 PM 的核心工作 |
| **寫 Spec** | Claude（草稿）+ openspec | ✅ 起草 Why / What 段落、找格式錯字 | ❌ **Out of scope**。AI 不知道哪些東西碰了會死 |
| **設計畫面** | Claude（多模態） | ✅ 根據 spec + 既有 token 生成元件 UI | ❌ 框定「不要擴張 spec」、捕捉 AI 自作主張的多餘元素 |
| **對齊設計** | 人眼逐項對 spec | — | ❌ **全部**。20% 的全局約束 AI 看不到 |
| **拆 tasks.md** | Claude（草稿） | ✅ 把 spec 拆成 checkbox 列表 | ❌ 任務粒度、依賴順序、誰先做 |
| **寫 Code** | Claude Code | ✅ 對著 `tasks.md` 逐項實作、commit、跑型別檢查 | ❌ Code review、確認沒越界、處理 spec 沒寫但會崩的 edge case |
| **同步文件** | Notion + GitHub | ✅ 格式轉換、產截圖、做 TOC | ❌ 決定什麼資訊放哪裡、誰能看 |

**一句話總結**：AI 把每個節點的「執行成本」壓到趨近於零。但**節點之間的判斷、邊界、優先級**——也就是 PM 真正在做的事——還是只有人能做。

工具讓你跑得更快，但跑去哪裡還是你決定。
