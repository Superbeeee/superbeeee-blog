---
title: Vue 3 Composable 最佳實踐：從元件抽離到可複用邏輯
date: 2026-04-15 10:00:00
categories:
  - 技術
tags:
  - Vue.js
  - 前端
  - Composable
---

在開發 IoT 後台類型的應用時，常會遇到大量複雜的元件邏輯——裝置狀態管理、地圖整合、表單驗證——這些邏輯如果全堆在元件裡，很快就會變成難以維護的 fat component。

這篇分享我在實務中整理出來的 Composable 抽離策略。

<!-- more -->

## 什麼時候該抽 Composable？

當你的元件出現以下情況，就是抽離的時機：

1. `<script setup>` 超過 100 行
2. 同樣的邏輯在兩個以上的元件重複出現
3. 邏輯跟 UI 渲染沒有直接關係（例如 API 呼叫、計算邏輯）

## 基本結構

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

## 命名規範

Composable 統一用 `use` 開頭，放在 `composables/` 資料夾：

```
composables/
├── useResourceList.js
├── useMapIntegration.js
└── useFormValidation.js
```

## 小結

Composable 不是萬靈丹，過度抽離反而讓程式碼難追蹤。原則是：**邏輯有複用需求，或是讓元件更易讀，再抽。**
