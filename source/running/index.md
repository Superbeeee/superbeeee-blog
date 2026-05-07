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
  { "name": "福岡馬", "year": "2024", "time": "3:38:11", "minutes": 218.18, "isMajor": false },
  { "name": "台北馬",   "year": "2024", "time": "3:28:37", "minutes": 208.62, "isMajor": false },
  { "name": "國道馬",   "year": "2025", "time": "3:34:35", "minutes": 214.58, "isMajor": false },
  { "name": "台北馬",   "year": "2025", "time": "3:30:40", "minutes": 210.67, "isMajor": false },
  { "name": "東京馬",   "year": "2026", "time": "3:22:01", "minutes": 202.02, "isMajor": true, "isPB": true },
  { "name": "CT226",   "year": "2026", "time": "3:56:50", "minutes": 236.83, "isMajor": false }
]
  </script>
</section>

<script src="/js/marathon-chart.js" defer></script>
{% endraw %}

---

## 跑步文章

- [東京馬拉松賽場心得：sub 3:10 的配速策略與賽道分析](/post/2026/03/tokyo-marathon-race-report/)

[看所有跑步文章 →](/categories/跑步/)
