---
title: "Vue 3 Composable ベストプラクティス：コンポーネント分離から再利用ロジックへ"
date: 2026-04-15 10:00:00
lang: ja
translation_key: vue3-composable-best-practice
categories:
  - 技術
tags:
  - Vue.js
  - 前端
  - Composable
---

IoT 系の管理画面を作っていると、デバイス状態管理・地図連携・フォームバリデーションといった複雑なロジックがコンポーネントに溜まり、すぐにメンテ困難な fat component になってしまう。

本記事では、現場で整理してきた Composable 抽出のパターンを紹介する。

<!-- more -->

## どんなときに Composable へ切り出すか？

次のいずれかに当てはまったら切り出しのタイミング。

1. `<script setup>` が 100 行を超えた。
2. 同じロジックが 2 つ以上のコンポーネントで重複している。
3. UI 描画に直接関係しないロジック（API 呼び出し、計算ロジックなど）。

## 基本構造

```javascript
// composables/useResourceList.js
import { ref, computed, onMounted } from 'vue'
import { fetchResources } from '@/api/resource'

export function useResourceList() {
  const items = ref([])
  const isLoading = ref(false)

  const activeCount = computed(
    () => items.value.filter(item => item.status === 'active').length
  )

  async function loadItems() {
    isLoading.value = true
    items.value = await fetchResources()
    isLoading.value = false
  }

  onMounted(loadItems)

  return { items, isLoading, activeCount, loadItems }
}
```

## 命名ルール

Composable は必ず `use` で始め、`composables/` ディレクトリにまとめて置く。

```
composables/
├── useResourceList.js
├── useMapIntegration.js
└── useFormValidation.js
```

## まとめ

Composable は万能薬ではない。切り出しすぎるとコードを追いづらくなる。判断基準はシンプルに：**ロジックに再利用ニーズがある、またはコンポーネントを読みやすくできるときだけ切り出す。**
