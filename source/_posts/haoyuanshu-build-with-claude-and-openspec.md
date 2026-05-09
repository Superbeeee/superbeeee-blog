---
title: SDD 開發流：AI 工具製作 誦經紀錄 App-好願書（IOS）
date: 2026-05-08 14:30:00
lang: zh-TW
translation_key: haoyuanshu-build-with-claude-and-openspec
categories:
  - 技術
tags:
  - AI
  - Claude Code
  - Claude Design
  - openspec
  - React Native
  - Expo
---

還記得小時候奶奶都會拿著念珠在念經時轉動，並且用計數器記錄唸的次數，長大後因緣際會下自己有時也會念誦心經，因為回向的對象不同，或是目的不同，覺得可以做一款App來做這方面的紀錄嬰，因此有此篇文章的分享。
不想跳進 React Native 的學習曲線，於是用了兩個週末，把腦袋裡那個「禪意配色 + 木魚音效 + 熱力圖」的想像，透過 Claude Design 發想、openspec 規格化、再交給 Claude Code 實作，最後跑在我的 iPhone 上。

另一個動機，是想拿這個專案實際試一下 **SDD（Spec-Driven Development，規格驅動開發）** 這套流程 —— 先把要做什麼寫成 spec、再讓 AI 照 spec 實作 —— 看看是不是真的能比直接 vibe coding 更穩定、更可追蹤。好願書算是一個練習題。

這篇紀錄整段流程，以及 AI 協作下的踩雷與取捨。

<!-- more -->

## 為什麼是「好願書」

先講一下這個 app 解決什麼問題。

念誦類的 app 市面上不少，但大多有兩個問題：一是介面設計往往很「繁華」，金光閃閃的按鈕、彈跳的計數器、塞滿廣告，跟「靜心」這件事完全相反；二是計數的邏輯跟實際紀錄對不上 —— 念誦者真正在意的是「為誰、為了什麼、發了多少願、迴向給誰」，而不只是一個跳動的數字。

如果有一個「電子化的功德簿」那就太好了！

- **雙模式**：有人喜歡發願（每日 108 遍持續 49 天），有人偏好自由記錄，兩種都要支援
- **沉浸念誦**：點木魚會出聲、會有漣漪動畫，但**木魚不計數**，遍數透過 ±1 按鈕主動加減 —— 因為念錯、念漏是常態，自動計數反而綁手綁腳
- **功德封存**：完成的發願要有儀式感地「歸檔」，而不是被洗掉
- **本地優先**：不註冊、不上傳，所有資料留在裝置上(或許之後再補上線上同步功能)

技術最後決定使用 React Native + Expo SDK 54、TypeScript、Zustand、AsyncStorage、expo-av、expo-notifications。但這篇不講技術選型，重點放在 **AI 怎麼參與整個流程**。

## 三段式 AI 工作流

把專案切成三段，每段配一個工具：

| 階段 | 工具 | 產出 |
|---|---|---|
| 發想 UI/UX | Claude Design | 10 個 HTML 原型畫面 |
| 規格化 | openspec | proposal / design / tasks 三份文件 |
| 實作 | Claude Code | Expo + RN 跑 code |

最後第四段：**iPhone 實機驗收**，這段沒辦法交給 AI。

關鍵心法：**每一段 AI 都負責一件事，但沒有任何一段是 AI 全自動**。需要自己一直確認功能方向。

## Stage 1：Claude Design 把腦中的「禪意」變成 HTML

我的第一個 prompt 是：

> 我想做一款念誦 app，視覺要走禪意素雅路線：宣紙白底色、墨黑、朱砂紅點綴、思源宋體。請先設計 10 個畫面：onboarding、首頁、建立計劃、今日念誦、沉浸模式、圓滿迴向、功德封存、設定、日常記錄、心經抽屜。每個畫面用 HTML 原型呈現。

Claude Design 跑完，給了 10 個 HTML 導案畫面，配色和字體大致不錯。整體的設計概念視覺化得相當好 —— 用紅色印章（Seal）+ 黑色細邊框（Hairline）+ 宣紙紋理背景的組合，AI 應該有做相關的功課^0^。

{% asset_img 01-onboarding.png 模式選擇畫面 %}

但 Claude Design 也有一些小問題：

1. **HTML 純淨太，互動有限**。木魚點擊的漣漪動畫、bottom sheet 的拖曳，只能呈現靜態的畫面。
2. **設計 token 不會自動延續**。我在第三個畫面強調的「朱砂紅 #B7332B」，到第七個畫面就被改成「朱紅 #C04A3D」。原型階段這沒差，但要交給 Claude Code 時就會出錯，細節自己要再對一下。


我的解法是把草稿「翻譯」成一份 design token 表：

```ts
// 從 10 個 HTML 收斂出的設計 token，後續所有 RN 元件都吃這份
export const lightTokens = {
  bg: '#F5EFE3',           // 宣紙底色
  ink: '#1F1A14',          // 墨黑
  cinnabar: '#B7332B',     // 朱砂（印章 / 強調）
  goldLeaf: '#C8A75A',     // 金箔（次要強調）
  moss: '#5C7757',         // 苔蘚綠（成功狀態）
  hairline: '#1F1A1422',   // 半透明黑（細線）
  paper: '#EFE6D2',        // 卡片紙色
  fontSerif: 'NotoSerifTC_400Regular',
};
```

這份 token 後來變成 Claude Code 唯一的視覺驗證 —— 原型截圖只用來「示意」，凡是顏色、間距、字級，全部 reference 這個檔案。**這個小動作後來省了很多視覺校稿時間**。

## Stage 2：openspec 是 spec 的版本控制

vibe coding 最大的問題：跟 AI 講「幫我做 X」，AI 給你一坨 code，你看了大概 OK 就 merge，三天後想做 Y，AI 又重新理解一次脈絡 —— 然後它的理解跟你的記憶不一樣。

openspec 解決這件事的方式是把「每一次要改什麼」寫成檔案：

```
openspec/changes/haoyuanshu-expo-app/
├── proposal.md   # Why + What changes（給人類讀）
├── design.md     # 技術決策、資料模型、互動細節
└── tasks.md      # 一條一條的 checkbox（給 AI 跑）
```

`proposal.md` 真實內容大致長這樣：

```markdown
## Why
好願書是一款以心經念誦為核心的 iOS 禪意 App，目前只有 HTML
原型（10 個畫面），需要轉換為 Expo + React Native + TypeScript
原生實作。

## What Changes
- 建立全新 Expo (SDK 52+) + React Native + TypeScript 專案
- 木魚點擊播放真實音效，**不計入遍數**；遍數由 ±1 按鈕控制
- 計劃資料全部以 AsyncStorage 本地儲存
- **暫時不實作**：雲端同步、帳號系統

## Capabilities
- woodfish-counter: 木魚元件 + 遍數計數邏輯
- plan-management: 發願計劃 CRUD + 90 日熱力圖
- ...
```

花了點時間才把 proposal + tasks 寫完，過程中等於把整個 app 在腦袋裡跑過一遍。但這個前置成本是值得的，因為：

1. **AI 讀 spec 比讀截圖準確**。截圖裡的細節（這個按鈕點下去要去哪、沒資料長怎樣、權限拒絕怎麼處理）很難一眼看完，spec 寫死了就不會走位。
2. **tasks.md 變成進度條**。我每次開 Claude Code 都跟它說「跑下一條未打勾的 task」，它做完打勾，我 review，git commit。可追蹤、可回溯。
3. **遇到 spec 跟程式有出入時，spec 是 source of truth**。這點之後 Claude 改 code 時讓錯誤降低許多。

說回來，openspec 的價值不在於那三個 markdown 格式有多神奇，而是它強迫你在動工之前誠實地**把問題想清楚**。

## Stage 3：Claude Code + tasks.md 的雙人組

實作階段的工作節奏大致是：

```
我：跑 tasks.md 第 5.X 系列（木魚元件）
Claude Code：[edit Woodfish.tsx, useWoodfishAudio hook, ...]
我：git diff 看一遍 → 在 simulator 跑 → 打勾或退回
```

這段最讓我有感的是 Zustand store 那段。我描述完「啟動時從 AsyncStorage 讀回、之後每次更新自動寫入」，AI 就生出這個結構，幾乎跟我心裡的版本一樣：

```ts
// src/store/index.ts（節錄）
const persist = (key: string, value: unknown) => {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch((e) => {
    console.warn(`[store] 寫入 ${key} 失敗:`, e);
  });
};

export const useStore = create<AppState>((set, get) => ({
  plans: [],
  hydrated: false,

  hydrate: async () => {
    const [plansStr, logsStr, settingsStr] = await Promise.all([
      AsyncStorage.getItem(KEYS.plans),
      AsyncStorage.getItem(KEYS.dailyLogs),
      AsyncStorage.getItem(KEYS.settings),
    ]);
    set({ plans: plansStr ? JSON.parse(plansStr) : [], /* ... */ hydrated: true });
  },

  addPlan: (plan) => {
    const plans = [...get().plans, plan];
    set({ plans });
    persist(KEYS.plans, plans);  // 每次寫入都同步寫回 storage
  },
}));
```

但更多時候，AI **會幻覺**。

我遇過最印象深刻的一次：tasks.md 第 7 條是「Onboarding 選完模式儲存到 store 並導航至主畫面」，Claude 回我「已完成」，我 git diff 一看 —— 它確實改了 OnboardingScreen.tsx，但**沒有真的呼叫 `updateSettings({ appMode })`**，只 console.log 了一行。在 simulator 跑下去，選了模式重啟還是回 onboarding。

從那次之後，我建立了一條規則：**git diff 才是 ground truth，AI 說「完成」不算完成**。每跑完一個 task，我一定看 diff，沒看就不打勾。

{% asset_img 03-create-plan.png 建立發願計劃 %}

### AI 協作下的設計取捨

過程中有兩個地方我跟 AI 的「預設」拉扯了一下，最後堅持自己的判斷：

**1. 木魚不計數**

Claude Code 第一版實作，木魚點擊會播音效**並且自動 +1**。技術上很合理，但方向上不對 —— 真正在念的人會口誤、會重來、會跳念，自動計數反而讓人焦慮。我把這條改回 spec 寫的「木魚只負責出聲，計數獨立按鈕處理」，AI 跑了一圈也認同，但如果沒有確認，預設就會被吃掉。

**2. 沉浸模式不顯示其他 UI**

AI 預設想加 toolbar、字級調整、bottom tab，「方便使用者」。但沉浸模式的目的就是少干擾。最後砍掉 80% 的元素，只留木魚、遍數、暫停。這在 spec 的 design.md 裡寫死「沉浸模式 hide everything except: 木魚、遍數、暫停按鈕」，後續 AI 就不會自己亂加畫面。

{% asset_img 05-immersive.png 沉浸念誦模式 %}

## Stage 4：iPhone 實機踩雷三連擊

寫完 code 在 simulator 跑得很好，但到了實機就是另一個世界。

**踩雷 1：Apple ID 簽名**
第一次 `npx expo run:ios --device`，build 完安裝到 iPhone，打開 app **直接閃退**。原因是 Apple ID 開發者憑證沒被裝置信任 —— 要在「設定 → 一般 → VPN 與裝置管理」手動信任。這件事所有教學都會講，但沒有開發app經驗小卡了一下。

**踩雷 2：expo-av 首播延遲**
木魚在 simulator 點下去聲音瞬間出來，到了實機點下去**有 200ms 左右的延遲**。原因是 `Audio.Sound.createAsync()` 第一次會做 codec 解碼，這段在實機上明顯。解法是把 sound 物件 cache 在 ref 裡，App 啟動就預載：

```tsx
const soundRef = useRef<Audio.Sound | null>(null);

const loadAndPlay = useCallback(async () => {
  if (muted) return;
  if (!soundRef.current) {
    const { sound } = await Audio.Sound.createAsync(woodfishWav);
    soundRef.current = sound;
  }
  await soundRef.current.setPositionAsync(0);
  await soundRef.current.playAsync();
}, [muted]);
```

第一版 AI 沒做 cache（因為 simulator 上感覺不出來差別），實機跑了才發現問題。

**踩雷 3：expo-notifications 權限**
`Notifications.scheduleNotificationAsync()` 在 simulator 直接成功，實機要先 `requestPermissionsAsync()`，而且 iOS 不給你重新跳第二次 prompt，使用者拒絕一次就只能去設定打開。AI 第一版完全沒處理 permission flow，是我在實機點「啟用提醒」沒反應才發現。

這三個問題的共通點是：**simulator 不會跑出問題，AI 也看不到 simulator**。實機這關 AI 完全幫不上忙。

{% asset_img 06-complete.png 圓滿迴向畫面 %}

## 反思：AI 協作下，哪些事不能丟

兩個週末跑下來，做個小總結：

| 能丟給 AI | 不能丟給 AI |
|---|---|
| 樣板 code（component scaffold、type 定義） | 為什麼要做這個 app |
| 實作 spec 寫死的細節 | 寫 spec 本身（你才知道 user 要什麼） |
| Refactor、命名、TypeScript 型別 | Design system / token 的最終決定 |
| 修小 bug、加 console.log 排查 | 「完成」的定義（git diff 才算） |
| 寫單元測試（給定明確輸入輸出） | 實機驗收（AI 看不到） |

最重要的一條經驗是 **spec 的價值大於 prompt**。一份寫清楚的 proposal 加 tasks 清單，會讓 AI 在後續 N 次對話都保持同一個方向；反之，每次都用 prompt 重新解釋脈絡，AI 每次都會「重新理解一次」，然後給你不同的答案。

openspec 不是什麼魔法 framework，它的好處是逼你**在動工之前把問題想清楚**。這件事 AI 反過來幫不了你。

{% asset_img 07-archive.png 功德封存頁面 %}

## 結語

兩個週末做完一個能裝在 iPhone 上跑的 app，這在三年前是不可想像的。我自己平常寫的是 Vue 前端，React Native 接觸不深，Expo 完全沒碰過。但靠 Claude Design 處理 UI 發想、openspec 鎖定 spec、Claude Code 寫 RN 與 TypeScript 的細節，自己只需要**把方向握緊、看 git diff、上實機測試**。

當然，我不會說「AI 取代了我寫 code」—— 木魚不計數的取捨、簽名踩雷的解法、實機 200ms 延遲的優化，每一件 AI 都做不到。

但 AI 確實讓「想做、能做、做得完」這條路徑大幅縮短了。**現在最大的瓶頸不是「能不能寫」，而是「想不想做、知不知道該做什麼」**。

現在每天用 iPhone 開好願書念心經紀錄，解決了自己的痛點。下一步可能要做雲端備份，或是可以分享這個app功德給家人 —— 但那是下一個 openspec change 的故事了。

---

> 程式碼放在 GitHub: [haoyuanshu](https://github.com/superbeeee)（整理中）。如果你也想試這套 Claude Design + openspec + Claude Code 的工作流，歡迎來信交流。
