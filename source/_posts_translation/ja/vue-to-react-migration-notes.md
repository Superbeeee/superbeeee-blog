---
title: "Vue から React へ：フレームワークを越える移行ノート"
date: 2026-06-04 10:00:00
lang: ja
translation_key: vue-to-react-migration-notes
description: Vue 開発者が初めて本気で React を学んだ対照移行ノート。リアクティビティの哲学、JSX、useEffect から状態管理まで、Vue と React を項目ごとに対照し、Vue 経験者が最初に踏みやすい落とし穴を示す。
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

転職してフロントエンドエンジニアになってから、今までずっと Vue を使ってきた。今年は AI Agent が一気に盛り上がり、自分のスキルツリーをもう少し伸ばしておきたいと感じていた。先日、履歴書を送っていて気づいたのだが、React の求人を出している会社はどこも良さげに見えた——まあ、ただの錯覚かもしれないけど（笑）。ちょうど AI のおかげで「新しいことを学ぶ」のがそこまで大変ではなくなったので、いっそフロントエンドの二つ目のフレームワークをちゃんと知っておこうと思った。

メインはやはり Vue 3 の `<script setup>` だ。最近、仕事の都合で本気で React を触り始めた。React は学習曲線が急だとよく言われるが、実際にやってみると、確かに作り直して理解し直すロジックが少なくなかった。

これは公式ドキュメントを読みながら、React と Vue の実装上の違いを一通り対照したノートだ。位置づけは「同じく Vue 熟練者の人」向けの対照移行ガイド。各セクションを Vue の視点から切り込み、自分が誤解しやすかった箇所を示していく。

<!-- more -->

## 0. まず最大の違い：メンタルモデルは逆向き

一つだけ覚えるなら、これを覚える：

- **Vue**：あなたは「データ同士の関係」を記述し、フレームワークが**自動で追跡**する。データが変われば対応する画面が自動で更新される（双方向バインディング最高！）。
- **React**：あなたは「ある state のとき、UI がどう見えるか」を記述する。state が変わると、コンポーネント関数が**頭から最後まで丸ごと再実行**され、新しい画面を再計算する。

Vue では `ref` を変えれば `computed` が自動で再計算し、画面が自動更新される。この連鎖はフレームワークが繋いでくれている。React にはこの見えない追跡がない。**`setState` を呼んで React に「state が変わった、再 render してくれ」と伝える**ことで、ようやく React が関数全体を再実行する。

以下の対照のほとんどは、この一文の派生にすぎない。これを頭に入れておくと、後の話がぐっと楽になる。

## 1. クイックリファレンス表

まず全体像、詳細は後で：

| Vue で使うもの | React の対応 | 一言での違い |
| --- | --- | --- |
| `ref` / `reactive` | `useState` | React の state は不変。setter で値ごと差し替える |
| `computed` | `useMemo` | React は依存を自分で列挙。自動追跡なし |
| `watch` | `useEffect` | useEffect は「render 後に走る副作用」であって watcher ではない |
| `onMounted` / `onUnmounted` | `useEffect`（`[]` + return） | 空の依存配列 `[]` はマウント時に一度だけ実行、return がアンマウント時のクリーンアップを担当 |
| `methods` / 関数 | `useCallback`（必要時） | 普通はそのまま function を書けばいい |
| `v-if` | `{cond && ...}` または三項演算子 | JSX は JS の式を使う。ディレクティブはない |
| `v-for` | `.map()` + `key` | key は同じく重要 |
| `:class` / `:style` | `className` / `style={{}}` | style はオブジェクトを取り、プロパティは camelCase |
| `@click` | `onClick` | イベント名は camelCase、渡すのは function |
| `v-model` | `value` + `onChange` | React に双方向バインディングはない。自分で書き戻す |
| `props` | `props` | 概念はほぼ同じ |
| `emit` | callback function を prop として渡す | イベント機構はない。関数を下に渡す |
| `provide` / `inject` | `Context` | 階層を越えて値を渡す |
| Pinia | Zustand / Redux / Context | 選択肢は多く、公式の定番はない |

## 2. リアクティビティ：自動追跡 vs 手動宣言

### `ref` ↔ `useState`

Vue では `.value` を変えれば画面が追従する：

```vue
<script setup>
import { ref } from 'vue'

const count = ref(0)
// 値を変えるだけ。Vue が自動で追跡して画面を更新する
function increment() {
  count.value++
}
</script>
```

React の書き方は似ているが、本質は異なる：

```jsx
import { useState } from 'react'

function Counter() {
  // useState は「現在の値」と「それを差し替える setter」を返す
  const [count, setCount] = useState(0)

  function increment() {
    // count を直接変えてはいけない。setter を呼ぶ
    setCount(count + 1)
  }

  return <button onClick={increment}>{count}</button>
}
```

**ここが Vue 経験者の最初の大きな落とし穴**：React の state は不変（immutable）だ。`count++` もできないし、配列に直接 push してもいけない。React は気づかず、画面は更新されない。やるべきは「**新しい値を計算して setter に渡す**」こと。setter が再 render をトリガーする。

オブジェクトと配列で特に顕著だ：

```jsx
const [user, setUser] = useState({ name: 'Eason', age: 30 })

// ❌ 画面は更新されない（元のオブジェクトを直接変更）
user.age = 31

// ✅ 新しいオブジェクトを作って返す
setUser({ ...user, age: 31 })
```

Vue なら `user.age = 31` と書くだけだ。`reactive` がインターセプトしてくれるから。React にはこの層がないので、「新しい値を作る」のは自分の仕事になる。

### `computed` ↔ `useMemo`

Vue の `computed` は使っているリアクティブなソースを自動で追跡する：

```js
const firstName = ref('Eason')
const lastName = ref('Tang')
// 何を使ったか Vue が把握している。どちらか変われば再計算
const fullName = computed(() => `${firstName.value} ${lastName.value}`)
```

React の `useMemo` は、後ろの配列に**依存を手動で列挙**させる：

```jsx
const fullName = useMemo(
  () => `${firstName} ${lastName}`,
  [firstName, lastName] // 依存は自分で列挙。漏らすと再計算されない
)
```

違いはやはりセクション 0 に戻る。Vue は依存を追跡してくれ、React は宣言させる。この「依存配列」の概念は次のセクションの `useEffect` でもう一度登場し、しかもそこではもっと厄介だ。

> 補足：React では多くの場合 `useMemo` は**不要**だ。コンポーネントは render のたびに再計算するので、単純な派生値はただの変数で書けばいい。`useMemo` は「高コストな計算の再実行を避ける」ために使う。Vue の「computed にできるなら computed」という習慣とは少し違う。

## 3. JSX vs template：ディレクティブを探すのはやめよう

JSX を触り始めた頃、反射的に `v-if` や `v-for` を探していた。だが——**JSX にディレクティブはない。JSX は JavaScript そのものだから**。知っている JS の式はすべてここで使える。

### 条件レンダリング：`v-if` ↔ `&&` / 三項演算子

```vue
<!-- Vue -->
<p v-if="isLoading">読み込み中…</p>
<p v-else>{{ data }}</p>
```

```jsx
// React：JS の論理演算子を使う
{isLoading ? <p>読み込み中…</p> : <p>{data}</p>}

// 「あれば表示」だけなら && が簡潔
{isLoading && <p>読み込み中…</p>}
```

### リストレンダリング：`v-for` ↔ `.map()`

```vue
<!-- Vue -->
<li v-for="item in items" :key="item.id">{{ item.name }}</li>
```

```jsx
// React：配列の .map() そのもの。key も同じく必須
{items.map(item => (
  <li key={item.id}>{item.name}</li>
))}
```

`key` の役割は Vue と全く同じ——どのノードがどれかを React に識別させる。index を key にしてはいけない。Vue 経験者にはお馴染みなので、そのまま持ち込める。

### 属性とイベント

```jsx
// class は className になる（class が JS の予約語だから）
<div className="card" />

// style はオブジェクトを取り、プロパティは camelCase
<div style={{ fontSize: '14px', color: 'red' }} />

// イベント名は camelCase、渡すのは function 本体（文字列ではない）
<button onClick={handleClick}>送信</button>
```

### `v-model` ↔ 制御コンポーネント

Vue の `v-model` は「読み取り」と「書き込み」を双方向に繋いでくれる：

```vue
<input v-model="text" />
```

React に双方向バインディングはない。**値を自分でバインドし、イベントで読み戻す**必要がある。これを「制御コンポーネント（controlled component）」と呼ぶ：

```jsx
const [text, setText] = useState('')

<input
  value={text}                              // 値は state から
  onChange={e => setText(e.target.value)}   // 変化時に自分で state へ書き戻す
/>
```

最初は冗長に感じるが、これは `v-model` の糖衣を剥がして中身を見せているだけだ。データは常に一方向に下へ流れ、ユーザーの入力はイベントで上へ報告される。この「単方向データフロー」を理解すると、React の多くの設計が腑に落ちる。

## 4. useEffect：Vue 経験者の最大の誤解

ここが一番長く詰まった。最初は `useEffect` を「`watch` + ライフサイクルの合体」だと思い込んでいた——この誤解がかなり大きかった。

**正しい理解はこうだ**：`useEffect` は watcher でもライフサイクル hook でもない。その用途は「**コンポーネントを外部システムと同期させる**」こと——イベントの購読、タイマーの設定、DOM の手動操作、API の呼び出し。render の*外側*の「副作用」だけが `useEffect` に入る。

### ライフサイクルへの対応

```js
// Vue
onMounted(() => { /* マウント後 */ })
onUnmounted(() => { /* アンマウント前にクリーンアップ */ })
```

```jsx
// React：マウントとクリーンアップが同じ useEffect 内
useEffect(() => {
  const timer = setInterval(tick, 1000)

  // return する関数 = クリーンアップ（アンマウント時、または再実行前に走る）
  return () => clearInterval(timer)
}, []) // 空の依存配列 = マウント時に一度だけ実行
```

### watch への対応

```js
// Vue：あるソースを watch
watch(userId, (id) => { fetchUser(id) })
```

```jsx
// React：userId を依存配列に入れる
useEffect(() => {
  fetchUser(userId)
}, [userId]) // userId が変わったときだけ再実行
```

### 自分が踏んだ 3 つの落とし穴

**落とし穴 1：依存配列の漏れ。** 依存が揃っていないと、effect は古い値を掴み、画面とデータがずれる。React の ESLint プラグイン（`react-hooks/exhaustive-deps`）が警告してくれる。**必ず入れて、必ず従うこと**。

**落とし穴 2：クロージャが古い値を掴む（stale closure）。** render のたびに全く新しい function になるため、effect が掴むのは「その render 時点の値」だ。`setInterval` のような長寿命の callback では特に引っかかりやすい：

```jsx
// ❌ count は常に 0。この effect はマウント時に一度だけ作られ、
//    中の count が初期値で「凍結」されているため
useEffect(() => {
  const timer = setInterval(() => setCount(count + 1), 1000)
  return () => clearInterval(timer)
}, [])

// ✅ setter の関数形式を使えば、常に最新の値が得られる
useEffect(() => {
  const timer = setInterval(() => setCount(c => c + 1), 1000)
  return () => clearInterval(timer)
}, [])
```

**落とし穴 3：無限ループ。** effect の中で `setState` を呼び、その state を依存に入れる → 更新が再実行をトリガー → また setState → 無限ループ。たいていは「そもそも effect に入れるべきではない」ことを意味する。

> React 公式ドキュメントには [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) という、useEffect の濫用を直接諌めるページがある。Vue から来た人は何でも「watch しよう」としがちなので、一読の価値がある。

## 5. 状態管理とコンポーネント間通信

### props は下へ、callback は上へ

`props` の概念は両者でほぼ同じ。親が子に値を渡し、一方向に下へ流れる。

違いは「子が親に通知する」部分だ。Vue は `emit` を使う：

```vue
<!-- 子コンポーネント：Vue -->
<script setup>
const emit = defineEmits(['submit'])
emit('submit', formData)
</script>
```

React にイベント機構はない。やり方は**親が function を prop として下に渡し、子がそれを呼ぶ**：

```jsx
// 親コンポーネント
<Form onSubmit={(data) => handleSubmit(data)} />

// 子コンポーネント：onSubmit を普通の prop として扱い、必要時に呼ぶ
function Form({ onSubmit }) {
  return <button onClick={() => onSubmit(formData)}>送信</button>
}
```

実は Vue の `emit` も内部はこの概念だ。React はシンタックスシュガーで包まず、関数を上下に直接渡させているだけだ。

### `provide` / `inject` ↔ Context

複数階層を越えて値を渡すとき、Vue は `provide` / `inject`、React は Context を使う。概念はきれいに対応する：

```jsx
const ThemeContext = createContext('light')

// 提供（provide に対応）
<ThemeContext.Provider value="dark">
  <App />
</ThemeContext.Provider>

// 取得（inject に対応）
const theme = useContext(ThemeContext)
```

### グローバル状態：Pinia ↔ ？

ここで Vue 経験者は少し戸惑う：React には**公式の定番となる状態管理ライブラリがない**。Pinia は Vue エコシステムでほぼデフォルトの答えだが、React 側は群雄割拠だ——Redux（老舗、ボイラープレートが多い）、Zustand（軽量、Pinia の直感に最も近い書き味）、Jotai、あるいは素の Context。

「Pinia から来て、学習コストを最小にしたい」なら、自分の今の選択はまず **Zustand** を見ること。store を定義し、hook を返し、コンポーネントで取得する——全体の手触りが Pinia に最も近い。

## 6. Vue 経験者への一言

最後に、全体を一文に凝縮するなら：

> **Vue では、あなたは状態同士の関係を記述し、フレームワークが追跡して自動更新する。React では、あなたはある state のとき UI がどう見えるかを記述し、state が変われば丸ごと再計算される。**

Vue の「魔法」はあの自動追跡の層にある——とても便利だが、ときに何がなぜ動いたのか分からない。React はこの層を取り払い、依存を明示的に宣言させ、setter を明示的に呼ばせ、データを明示的に上下に渡させる。最初は冗長に感じるが、引き換えに得られるのは「データがどう流れるかが、すべて目の前に開かれている」ことだ。

まとめてみて思わぬ収穫もあった：以前から面接の体験談で、面接官が `useState`・`useMemo`・`useEffect` をよく聞くのを目にしていて、当時は何を試されているのかいまいち分からなかったのだが、これでようやく腑に落ちた！

これは学び始めたばかりの自分の対照ノートだ。React で state や API やフォームのある実際のものを作ったら、また実戦編を書きにこよう。

あなたも Vue 熟練者で React に移ろうとしているなら、この対照表が回り道を少しでも減らせれば嬉しい。
