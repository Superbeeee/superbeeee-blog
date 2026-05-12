---
title: "Vue 3 Composable Best Practices: From Component Extraction to Reusable Logic"
date: 2026-04-15 10:00:00
lang: en
translation_key: vue3-composable-best-practice
categories:
  - 技術
tags:
  - Vue.js
  - 前端
  - Composable
---

When building IoT-style admin dashboards, you quickly run into heavy component logic — device state management, map integrations, form validation — that turns components into hard-to-maintain fat blobs.

This post shares the composable extraction patterns I've settled on after shipping these features in production.

<!-- more -->

## When should you extract a composable?

Pull logic out into a composable when one of the following is true:

1. Your `<script setup>` is over 100 lines.
2. The same logic shows up in two or more components.
3. The logic isn't tied to UI rendering (API calls, computations, etc.).

## Basic structure

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

## Naming conventions

Always prefix composables with `use` and keep them in a dedicated `composables/` folder:

```
composables/
├── useResourceList.js
├── useMapIntegration.js
└── useFormValidation.js
```

## Wrap-up

Composables are not a silver bullet — over-extracting actually makes code harder to follow. The rule of thumb: **extract only when the logic is genuinely reusable, or when pulling it out makes the component easier to read.**
