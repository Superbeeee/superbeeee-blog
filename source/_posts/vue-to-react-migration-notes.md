---
title: 從 Vue 到 React：跨越框架的筆記
date: 2026-06-04 10:00:00
lang: zh-TW
translation_key: vue-to-react-migration-notes
description: 一個 Vue 開發者第一次認真學 React 的對照遷移筆記。從響應式哲學、JSX、useEffect 到狀態管理，逐項對照 Vue 與 React 的差異，並標出 Vue 人最容易踩的雷。
categories:
  - 技術
tags:
  - React
  - Vue.js
  - 前端
  - 框架對照
  - Composition API
  - Hooks
---

從轉職成前端工程師到現在，我一直都用 Vue。今年 AI Agent 大崛起，總覺得該幫自己多長幾個技能樹。前陣子投履歷時發現，開 React 缺的公司感覺都還不錯——也可能是我的錯覺啦哈哈。剛好趁著 AI 讓「學新東西」這件事不再那麼難，乾脆好好認識前端的第二個框架。

目前主力還是 Vue 3 的 `<script setup>`。最近因為工作需要開始認真碰 React，很多人都說 React 的學習曲線比較陡，實際學下來，確實有不少邏輯要重新理解一番。

這篇就是我一邊讀官方文件、一邊把 React 和 Vue 在實作上的差異對照一遍的筆記。定位是「給同樣是 Vue 熟手的人」的對照遷移指南：每個段落都從 Vue 的角度切入，標出自己最容易誤會的地方。

<!-- more -->

## 0. 先講最大的差異：心智模型是反過來的

如果只能記一句話，我會記這個：

- **Vue**：你描述「資料之間的關係」，框架幫你**自動追蹤**，資料一變就自動更新對應的畫面（雙向綁定讚啦！）。
- **React**：你描述「在某個 state 下，UI 長什麼樣子」。state 一變，整個元件 function **從頭到尾重跑一遍**，重算出新的畫面。

在 Vue，`ref` 改了、`computed` 自動重算、畫面自動更新，這條鏈路是框架幫你連好的。在 React，沒有這種隱形的追蹤；**是你呼叫 `setState` 去告訴 React「狀態變了，請重新 render」**，React 才重新執行整個 function。

後面每一個對照，幾乎都是這句話的延伸。先把它放在心裡，往下看會輕鬆很多。

## 1. 速查總表

先給全貌，後面再逐項展開：

| 你在 Vue 用的 | React 對應 | 一句話差異 |
| --- | --- | --- |
| `ref` / `reactive` | `useState` | React state 不可變，要用 setter 換掉整個值 |
| `computed` | `useMemo` | React 要自己列依賴，不會自動追蹤 |
| `watch` | `useEffect` | useEffect 是「render 後的副作用」，不是 watcher |
| `onMounted` / `onUnmounted` | `useEffect`（`[]` + return） | 空的依賴陣列 `[]` 只在掛載時跑一次，return 負責卸載清理 |
| `methods` / 函式 | `useCallback`（必要時） | 一般直接寫 function 就好 |
| `v-if` | `{cond && ...}` 或三元 | JSX 裡用 JS 表達式，沒有指令 |
| `v-for` | `.map()` + `key` | key 一樣重要 |
| `:class` / `:style` | `className` / `style={{}}` | style 吃物件，屬性是 camelCase |
| `@click` | `onClick` | 事件名 camelCase，傳的是 function |
| `v-model` | `value` + `onChange` | React 沒有雙向綁定，要自己接回去 |
| `props` | `props` | 概念幾乎一樣 |
| `emit` | 傳 callback function 當 prop | React 沒有事件機制，靠把函式傳下去 |
| `provide` / `inject` | `Context` | 跨層傳值 |
| Pinia | Zustand / Redux / Context | 生態系選項多，沒有官方欽定 |

## 2. 響應式：自動追蹤 vs 手動宣告

### `ref` ↔ `useState`

Vue 裡你改 `.value`，畫面就跟著動：

```vue
<script setup>
import { ref } from 'vue'

const count = ref(0)
// 直接改值就好，Vue 會自動追蹤並更新畫面
function increment() {
  count.value++
}
</script>
```

React 的寫法看起來像，但本質不同：

```jsx
import { useState } from 'react'

function Counter() {
  // useState 回傳「目前的值」和「換掉它的 setter」
  const [count, setCount] = useState(0)

  function increment() {
    // 不能直接改 count，要呼叫 setter
    setCount(count + 1)
  }

  return <button onClick={increment}>{count}</button>
}
```

**這裡是 Vue 人第一個大雷**：React 的 state 是不可變（immutable）的。你不能 `count++`、也不能直接 push 一個陣列，那樣 React 不會知道、畫面不會更新。你要做的是「**算出新的值，丟給 setter**」，由 setter 去觸發重新 render。

物件和陣列尤其明顯：

```jsx
const [user, setUser] = useState({ name: 'Eason', age: 30 })

// ❌ 不會更新畫面（直接改原物件）
user.age = 31

// ✅ 建一個新物件丟回去
setUser({ ...user, age: 31 })
```

在 Vue 你會直接 `user.age = 31`，因為 `reactive` 幫你攔截了。React 沒有這層攔截，所以「產生新值」這件事得你自己來。

### `computed` ↔ `useMemo`

Vue 的 `computed` 會自動追蹤它用到的響應式來源：

```js
const firstName = ref('Eason')
const lastName = ref('Tang')
// 用到誰，Vue 自己知道；任一個變了就重算
const fullName = computed(() => `${firstName.value} ${lastName.value}`)
```

React 的 `useMemo` 要你**手動把依賴列在後面的陣列**：

```jsx
const fullName = useMemo(
  () => `${firstName} ${lastName}`,
  [firstName, lastName] // 依賴要自己列，漏了就不會重算
)
```

差別還是回到第 0 節：Vue 幫你追蹤依賴，React 要你自己宣告。這個「依賴陣列」的概念，下一節的 `useEffect` 還會再出現一次，而且更容易出包。

> 補充：React 裡很多時候你**不需要** `useMemo`。因為元件每次 render 都會重算，單純的衍生值直接寫成一般變數就好，`useMemo` 是為了「避免昂貴計算重複執行」才用。這跟 Vue「能 computed 就 computed」的習慣不太一樣。

## 3. JSX vs template：別再找指令了

剛上手 JSX，我一直反射性地找 `v-if`、`v-for`。結果是——**JSX 裡沒有指令，因為 JSX 就是 JavaScript**。你會的 JS 表達式，在這裡全部能用。

### 條件渲染：`v-if` ↔ `&&` / 三元

```vue
<!-- Vue -->
<p v-if="isLoading">載入中…</p>
<p v-else>{{ data }}</p>
```

```jsx
// React：用 JS 的邏輯運算子
{isLoading ? <p>載入中…</p> : <p>{data}</p>}

// 只有「有就顯示」時，用 && 更簡潔
{isLoading && <p>載入中…</p>}
```

### 列表渲染：`v-for` ↔ `.map()`

```vue
<!-- Vue -->
<li v-for="item in items" :key="item.id">{{ item.name }}</li>
```

```jsx
// React：就是陣列的 .map()，key 一樣要給
{items.map(item => (
  <li key={item.id}>{item.name}</li>
))}
```

`key` 的作用和 Vue 完全一樣——幫 React 辨識哪個節點是哪個，不要用 index 當 key。這點 Vue 人很熟，可以直接帶過來。

### 屬性與事件

```jsx
// class 變 className（因為 class 是 JS 保留字）
<div className="card" />

// style 吃的是物件，屬性 camelCase
<div style={{ fontSize: '14px', color: 'red' }} />

// 事件名 camelCase，傳的是 function 本身（不是字串）
<button onClick={handleClick}>送出</button>
```

### `v-model` ↔ 受控元件

Vue 的 `v-model` 幫你把「讀值」和「寫值」雙向綁好：

```vue
<input v-model="text" />
```

React 沒有雙向綁定。你要**自己把值綁上去、再用事件接回來**，這叫「受控元件」（controlled component）：

```jsx
const [text, setText] = useState('')

<input
  value={text}                              // 值由 state 來
  onChange={e => setText(e.target.value)}   // 變動時自己寫回 state
/>
```

一開始會覺得囉嗦，但它其實就是把 `v-model` 的糖衣拆開來給你看：資料永遠單向往下流，使用者的輸入透過事件往上回報。理解這條「單向資料流」，React 的很多設計就通了。

## 4. useEffect：Vue 人最大的誤解

這是我卡最久的地方。一開始我把 `useEffect` 當成「`watch` + 生命週期的合體」，這個誤解可大了。

**正確的理解是**：`useEffect` 不是 watcher、也不是生命週期 hook。它的用途是「**把元件和外部系統同步**」——例如訂閱事件、設定 timer、手動操作 DOM、打 API。只要是 render 之外的「副作用」，才放進 `useEffect`。

### 對應生命週期

```js
// Vue
onMounted(() => { /* 掛載後 */ })
onUnmounted(() => { /* 卸載前清理 */ })
```

```jsx
// React：掛載與清理在同一個 useEffect
useEffect(() => {
  const timer = setInterval(tick, 1000)

  // return 的函式 = 清理（卸載時、或重跑前執行）
  return () => clearInterval(timer)
}, []) // 空依賴陣列 = 只在掛載時跑一次
```

### 對應 watch

```js
// Vue：watch 某個來源
watch(userId, (id) => { fetchUser(id) })
```

```jsx
// React：把 userId 放進依賴陣列
useEffect(() => {
  fetchUser(userId)
}, [userId]) // userId 變了才重跑
```

### 三個我踩過的雷

**雷 1：依賴陣列漏列。** 依賴沒列齊，effect 抓到的會是舊的值，畫面跟資料對不起來。React 的 ESLint plugin（`react-hooks/exhaustive-deps`）會提醒你，**一定要裝、也一定要理它**。

**雷 2：closure 抓到舊值（stale closure）。** 因為每次 render 都是一個全新的 function，effect 裡抓到的是「那一次 render 當下的值」。在 `setInterval` 這種長壽命的 callback 裡特別容易中招：

```jsx
// ❌ count 永遠是 0，因為這個 effect 只在掛載時建立一次，
//    裡面的 count 被「凍結」在初始值
useEffect(() => {
  const timer = setInterval(() => setCount(count + 1), 1000)
  return () => clearInterval(timer)
}, [])

// ✅ 用 setter 的函式形式，拿到的永遠是最新值
useEffect(() => {
  const timer = setInterval(() => setCount(c => c + 1), 1000)
  return () => clearInterval(timer)
}, [])
```

**雷 3：無限迴圈。** effect 裡呼叫 `setState`、又把那個 state 放進依賴 → 更新觸發重跑 → 又 setState → 無限循環。通常代表「這件事根本不該放在 effect 裡」。

> React 官方文件有一篇 [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) 直接勸退濫用 useEffect。從 Vue 過來的人很容易看到什麼都想「watch 一下」，這篇值得讀。

## 5. 狀態管理與元件溝通

### props 往下、callback 往上

`props` 的概念兩邊幾乎一樣：父層傳值給子層、單向往下。

差別在「子層通知父層」。Vue 用 `emit`：

```vue
<!-- 子元件：Vue -->
<script setup>
const emit = defineEmits(['submit'])
emit('submit', formData)
</script>
```

React 沒有事件機制，做法是**父層把一個 function 當 prop 傳下去，子層呼叫它**：

```jsx
// 父元件
<Form onSubmit={(data) => handleSubmit(data)} />

// 子元件：把 onSubmit 當成一般 prop，需要時呼叫
function Form({ onSubmit }) {
  return <button onClick={() => onSubmit(formData)}>送出</button>
}
```

其實 Vue 的 `emit` 底層也是這個概念，React 只是沒有幫你包語法糖，直接讓你把函式傳上傳下。

### `provide` / `inject` ↔ Context

跨多層傳值，Vue 用 `provide` / `inject`，React 用 Context，概念對得很整齊：

```jsx
const ThemeContext = createContext('light')

// 提供（對應 provide）
<ThemeContext.Provider value="dark">
  <App />
</ThemeContext.Provider>

// 取用（對應 inject）
const theme = useContext(ThemeContext)
```

### 全域狀態：Pinia ↔ ？

這裡 Vue 人會有一點不適應：React **沒有官方欽定的狀態管理庫**。Pinia 在 Vue 生態幾乎是預設答案，但 React 這邊是百家爭鳴——Redux（老牌、樣板多）、Zustand（輕量、寫起來最接近 Pinia 的直覺）、Jotai、或乾脆用 Context。

以「從 Pinia 過來、想要最低學習成本」來說，我目前的選擇是先看 **Zustand**：定義 store、回傳 hook、在元件裡取用，整體手感跟 Pinia 最像。

## 6. 給 Vue 人的一句話

寫到最後，我會把整篇濃縮成一句話：

> **在 Vue，你描述狀態之間的關係，框架幫你追蹤、自動更新；在 React，你描述某個 state 下 UI 長什麼樣，state 一變就整段重算。**

Vue 的「魔法」在於那層自動追蹤——很方便，但有時你不知道東西為什麼動了。React 把這層拿掉，要你顯式宣告依賴、顯式呼叫 setter、顯式把資料傳上傳下。一開始覺得囉嗦，但換來的是「資料怎麼流動，全都攤在你眼前」。

整理完這篇還有個意外收穫：之前看別人的面試分享，常看到考官愛問 `useState`、`useMemo`、`useEffect`，當時不太懂到底在考什麼，現在總算真相大白！

這篇是我剛開始學的對照筆記。等之後真的用 React 做出一些有狀態、有 API、有表單的東西，再回來寫一篇實戰篇。

如果你也是 Vue 熟手要轉 React，希望這份對照表能幫你少繞一點路。
