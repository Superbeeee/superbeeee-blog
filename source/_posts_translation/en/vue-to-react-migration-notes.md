---
title: "From Vue to React: Notes on Crossing the Framework Divide"
date: 2026-06-04 10:00:00
lang: en
translation_key: vue-to-react-migration-notes
description: A Vue developer's first serious attempt at learning React, written as a side-by-side migration guide. From reactivity philosophy, JSX, and useEffect to state management — each topic maps Vue to React and flags the traps Vue folks fall into first.
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

Ever since I switched careers into frontend, I've been using Vue the whole way. This year, with AI Agents taking off, I kept feeling I should grow a few more branches on my skill tree. While job hunting recently, I noticed the companies hiring for React roles all looked pretty decent — or maybe that's just my imagination, ha. And since AI has made "learning something new" so much less daunting, I figured I'd properly get to know the frontend's second framework.

My main driver is still Vue 3's `<script setup>`. Recently I started seriously picking up React for work. People often say React has a steeper learning curve, and going through it myself, sure enough there were plenty of ideas I had to re-learn from the ground up.

This is my notebook from reading the official docs while mapping the implementation differences between React and Vue side by side. It's written as a migration guide for fellow Vue veterans: every section starts from a Vue angle and flags the spots where I'm most likely to get it wrong.

<!-- more -->

## 0. The biggest difference first: the mental model is inverted

If I could only remember one thing, it would be this:

- **Vue**: you describe "relationships between data," the framework **tracks them automatically**, and when data changes the matching part of the UI updates on its own (two-way binding, love it!).
- **React**: you describe "what the UI looks like for a given state." When state changes, the entire component function **runs again top to bottom** and recomputes the UI.

In Vue, you change a `ref`, the `computed` recomputes, and the view updates — that chain is wired up for you by the framework. In React there's no such invisible tracking; **you call `setState` to tell React "the state changed, please re-render,"** and only then does React run the whole function again.

Almost every comparison below is just an extension of this one sentence. Keep it in mind and the rest gets a lot easier.

## 1. Quick reference table

The big picture first, details after:

| What you use in Vue | React equivalent | One-line difference |
| --- | --- | --- |
| `ref` / `reactive` | `useState` | React state is immutable; swap the whole value via the setter |
| `computed` | `useMemo` | React makes you list dependencies; no auto-tracking |
| `watch` | `useEffect` | useEffect is a "side effect that runs after render," not a watcher |
| `onMounted` / `onUnmounted` | `useEffect` (`[]` + return) | An empty dependency array `[]` runs once on mount; the return handles unmount cleanup |
| `methods` / functions | `useCallback` (when needed) | Usually just write a plain function |
| `v-if` | `{cond && ...}` or ternary | JSX uses JS expressions, no directives |
| `v-for` | `.map()` + `key` | key matters just as much |
| `:class` / `:style` | `className` / `style={{}}` | style takes an object; props are camelCase |
| `@click` | `onClick` | Event names are camelCase; you pass a function |
| `v-model` | `value` + `onChange` | No two-way binding in React; wire it back yourself |
| `props` | `props` | Nearly identical concept |
| `emit` | pass a callback function as a prop | No event mechanism; you pass functions down |
| `provide` / `inject` | `Context` | Passing values across layers |
| Pinia | Zustand / Redux / Context | Many options, no officially blessed one |

## 2. Reactivity: automatic tracking vs. manual declaration

### `ref` ↔ `useState`

In Vue you change `.value` and the view follows:

```vue
<script setup>
import { ref } from 'vue'

const count = ref(0)
// Just mutate the value — Vue tracks it and updates the view automatically
function increment() {
  count.value++
}
</script>
```

React's version looks similar but is fundamentally different:

```jsx
import { useState } from 'react'

function Counter() {
  // useState returns "the current value" and a setter that replaces it
  const [count, setCount] = useState(0)

  function increment() {
    // You can't mutate count directly — call the setter
    setCount(count + 1)
  }

  return <button onClick={increment}>{count}</button>
}
```

**This is the first big trap for Vue folks**: React state is immutable. You can't `count++`, and you can't push directly onto an array — React won't know, and the view won't update. What you do instead is "**compute a new value and hand it to the setter**," letting the setter trigger a re-render.

It's most obvious with objects and arrays:

```jsx
const [user, setUser] = useState({ name: 'Eason', age: 30 })

// ❌ Won't update the view (mutating the original object)
user.age = 31

// ✅ Build a new object and hand it back
setUser({ ...user, age: 31 })
```

In Vue you'd just write `user.age = 31` because `reactive` intercepts it for you. React has no such interception, so "producing a new value" is on you.

### `computed` ↔ `useMemo`

Vue's `computed` automatically tracks the reactive sources it uses:

```js
const firstName = ref('Eason')
const lastName = ref('Tang')
// Vue knows what you used; when either changes, it recomputes
const fullName = computed(() => `${firstName.value} ${lastName.value}`)
```

React's `useMemo` makes you **list the dependencies manually** in the trailing array:

```jsx
const fullName = useMemo(
  () => `${firstName} ${lastName}`,
  [firstName, lastName] // List deps yourself; miss one and it won't recompute
)
```

The difference comes back to section 0: Vue tracks dependencies for you, React makes you declare them. This "dependency array" idea shows up again with `useEffect` in the next section — and it bites harder there.

> Note: a lot of the time in React you **don't need** `useMemo`. Since the component recomputes on every render, a simple derived value can just be a plain variable; `useMemo` exists to "avoid re-running an expensive computation." That's different from Vue's "reach for `computed` whenever you can" habit.

## 3. JSX vs. template: stop looking for directives

When I first hit JSX, I kept reflexively searching for `v-if` and `v-for`. The thing is — **there are no directives in JSX, because JSX is just JavaScript**. Any JS expression you know works here.

### Conditional rendering: `v-if` ↔ `&&` / ternary

```vue
<!-- Vue -->
<p v-if="isLoading">Loading…</p>
<p v-else>{{ data }}</p>
```

```jsx
// React: use JS logical operators
{isLoading ? <p>Loading…</p> : <p>{data}</p>}

// When it's just "show if present," && is cleaner
{isLoading && <p>Loading…</p>}
```

### List rendering: `v-for` ↔ `.map()`

```vue
<!-- Vue -->
<li v-for="item in items" :key="item.id">{{ item.name }}</li>
```

```jsx
// React: it's just the array's .map(), and key is still required
{items.map(item => (
  <li key={item.id}>{item.name}</li>
))}
```

`key` does exactly what it does in Vue — it helps React tell which node is which. Don't use the index as the key. Vue folks know this well and can bring the habit straight over.

### Attributes and events

```jsx
// class becomes className (because class is a JS reserved word)
<div className="card" />

// style takes an object, properties in camelCase
<div style={{ fontSize: '14px', color: 'red' }} />

// Event names are camelCase, and you pass the function itself (not a string)
<button onClick={handleClick}>Submit</button>
```

### `v-model` ↔ controlled components

Vue's `v-model` wires up "read" and "write" two-way for you:

```vue
<input v-model="text" />
```

React has no two-way binding. You **bind the value yourself and read it back via an event** — this is a "controlled component":

```jsx
const [text, setText] = useState('')

<input
  value={text}                              // value comes from state
  onChange={e => setText(e.target.value)}   // on change, write back to state yourself
/>
```

It feels verbose at first, but it's really just `v-model` with the sugar peeled off so you can see inside: data always flows one way down, and user input is reported back up via events. Once you internalize this "one-way data flow," a lot of React's design clicks.

## 4. useEffect: the biggest misconception for Vue folks

This is where I got stuck the longest. At first I treated `useEffect` as "`watch` plus lifecycle hooks combined" — and that misunderstanding ran deep.

**The correct understanding is**: `useEffect` is not a watcher and not a lifecycle hook. Its purpose is to "**synchronize your component with an external system**" — subscribing to events, setting up timers, manually touching the DOM, calling an API. Only side effects *outside* of rendering belong in `useEffect`.

### Mapping to lifecycle

```js
// Vue
onMounted(() => { /* after mount */ })
onUnmounted(() => { /* clean up before unmount */ })
```

```jsx
// React: mount and cleanup live in the same useEffect
useEffect(() => {
  const timer = setInterval(tick, 1000)

  // The returned function = cleanup (runs on unmount, or before a re-run)
  return () => clearInterval(timer)
}, []) // Empty dependency array = run once on mount
```

### Mapping to watch

```js
// Vue: watch a source
watch(userId, (id) => { fetchUser(id) })
```

```jsx
// React: put userId in the dependency array
useEffect(() => {
  fetchUser(userId)
}, [userId]) // Re-runs only when userId changes
```

### Three traps I hit

**Trap 1: missing dependencies.** If the deps aren't complete, the effect captures stale values and your view drifts out of sync with your data. React's ESLint plugin (`react-hooks/exhaustive-deps`) warns you — **install it, and actually listen to it**.

**Trap 2: stale closures.** Because every render is a brand-new function, the effect captures "the value as of that particular render." It's especially easy to get bitten inside long-lived callbacks like `setInterval`:

```jsx
// ❌ count is always 0, because this effect is created once on mount,
//    and the count inside is "frozen" at the initial value
useEffect(() => {
  const timer = setInterval(() => setCount(count + 1), 1000)
  return () => clearInterval(timer)
}, [])

// ✅ Use the functional form of the setter to always get the latest value
useEffect(() => {
  const timer = setInterval(() => setCount(c => c + 1), 1000)
  return () => clearInterval(timer)
}, [])
```

**Trap 3: infinite loops.** The effect calls `setState` and also lists that state in its deps → the update triggers a re-run → which calls `setState` again → infinite loop. Usually this means "this thing shouldn't be in an effect at all."

> React's official docs have a page literally titled [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) that talks you out of overusing useEffect. People coming from Vue tend to want to "watch" everything, so it's worth a read.

## 5. State management and component communication

### Props go down, callbacks go up

The `props` concept is nearly identical on both sides: a parent passes values to a child, flowing one way down.

The difference is "child notifies parent." Vue uses `emit`:

```vue
<!-- Child component: Vue -->
<script setup>
const emit = defineEmits(['submit'])
emit('submit', formData)
</script>
```

React has no event mechanism. The approach is **the parent passes a function down as a prop, and the child calls it**:

```jsx
// Parent component
<Form onSubmit={(data) => handleSubmit(data)} />

// Child component: treat onSubmit as a plain prop and call it when needed
function Form({ onSubmit }) {
  return <button onClick={() => onSubmit(formData)}>Submit</button>
}
```

Under the hood Vue's `emit` is the same idea — React just doesn't wrap it in syntactic sugar, letting you pass functions up and down directly.

### `provide` / `inject` ↔ Context

For passing values across many layers, Vue uses `provide` / `inject`, React uses Context. The concepts line up neatly:

```jsx
const ThemeContext = createContext('light')

// Provide (maps to provide)
<ThemeContext.Provider value="dark">
  <App />
</ThemeContext.Provider>

// Consume (maps to inject)
const theme = useContext(ThemeContext)
```

### Global state: Pinia ↔ ?

Here Vue folks will feel a slight disorientation: React **has no officially blessed state management library**. Pinia is practically the default answer in the Vue world, but on the React side it's a free-for-all — Redux (established, lots of boilerplate), Zustand (lightweight, closest in feel to Pinia's intuition), Jotai, or just plain Context.

For "coming from Pinia and wanting the lowest learning cost," my current pick is to start with **Zustand**: define a store, return a hook, consume it in components — the overall feel is closest to Pinia.

## 6. One sentence for Vue folks

To boil the whole thing down to one sentence:

> **In Vue you describe relationships between states and the framework tracks and updates them for you; in React you describe what the UI looks like for a given state, and when state changes everything recomputes.**

Vue's "magic" is that layer of automatic tracking — very convenient, but sometimes you don't know *why* something updated. React removes that layer and asks you to declare dependencies explicitly, call the setter explicitly, and pass data up and down explicitly. It feels verbose at first, but what you get in return is that "how data flows is laid out right in front of you."

Writing this up had an unexpected payoff: I'd often seen interview write-ups where the interviewer loves asking about `useState`, `useMemo`, and `useEffect`, and back then I never quite got what they were really testing — now it finally all makes sense!

These are my comparison notes from just starting out. Once I've actually built something with state, APIs, and forms in React, I'll come back and write a hands-on follow-up.

If you're also a Vue veteran making the jump to React, I hope this comparison table saves you a few detours.
