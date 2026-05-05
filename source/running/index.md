---
title: 跑步
date: 2026-05-06
comments: false
---

{% raw %}
<link rel="stylesheet" href="/css/marathon-chart.css">

<section class="marathon-stats">
  <h2 class="marathon-stats__title">全馬成績紀錄</h2>
  <p class="marathon-stats__subtitle">六場全馬，從 4 字頭到 sub 3:10 的進步軌跡</p>
  <div class="marathon-stats__pb-badge">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 2l2.9 6.9L22 9.7l-5.3 4.6L18.3 22 12 18.3 5.7 22l1.6-7.7L2 9.7l7.1-.8z"/>
    </svg>
    PB 3:08:51 / 東京馬拉松 2026
  </div>

  <div class="marathon-stats__hint">‹ 滑動看更早成績</div>

  <div id="marathon-chart"></div>

  <script type="application/json" id="marathon-data">
[
  { "name": "渣打台北", "year": "2022", "time": "4:15:32", "minutes": 255.53, "isMajor": false },
  { "name": "名古屋",   "year": "2023", "time": "3:45:18", "minutes": 225.30, "isMajor": false },
  { "name": "台北馬",   "year": "2023", "time": "3:32:05", "minutes": 212.08, "isMajor": false },
  { "name": "大阪馬",   "year": "2024", "time": "3:22:48", "minutes": 202.80, "isMajor": false },
  { "name": "柏林馬",   "year": "2025", "time": "3:12:15", "minutes": 192.25, "isMajor": true },
  { "name": "東京馬",   "year": "2026", "time": "3:08:51", "minutes": 188.85, "isMajor": true, "isPB": true }
]
  </script>
</section>

<script src="/js/marathon-chart.js" defer></script>
{% endraw %}

---

## 跑步文章

- [東京馬拉松賽場心得：sub 3:10 的配速策略與賽道分析](/post/2026/03/tokyo-marathon-race-report/)

[看所有跑步文章 →](/categories/跑步/)
