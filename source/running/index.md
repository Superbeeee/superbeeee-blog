---
title: 跑步
date: 2026-05-06
comments: false
lang: zh-TW
translation_key: page-running
description: 馬拉松、半馬與訓練紀錄。包含個人 PB、賽事心得 timeline、訓練筆記與裝備使用心得。
---

{% raw %}
<link rel="stylesheet" href="/css/marathon-chart.css">
<link rel="stylesheet" href="/css/marathon-3d.css">

<section class="marathon-stats">
  <h2 class="marathon-stats__title">全馬成績紀錄</h2>
  <p class="marathon-stats__subtitle">全馬軌跡線圖。<strong>金色底線</strong>的賽事可以點開 3D 心率軌跡。</p>
  <div class="marathon-stats__pb-badge">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 2l2.9 6.9L22 9.7l-5.3 4.6L18.3 22 12 18.3 5.7 22l1.6-7.7L2 9.7l7.1-.8z"/>
    </svg>
    <span data-pb-badge>PB</span>
  </div>

  <div class="marathon-stats__hint">‹ 滑動看更早成績</div>

  <div id="marathon-chart"></div>

  <script type="application/json" id="marathon-data">
[
  { "name": "福岡馬", "year": "2024", "time": "3:38:11", "minutes": 218.18, "isMajor": false },
  { "name": "台北馬", "year": "2024", "time": "3:28:37", "minutes": 208.62, "isMajor": false },
  { "name": "國道馬", "year": "2025", "time": "3:34:35", "minutes": 214.58, "isMajor": false },
  { "name": "台北馬", "year": "2025", "time": "3:30:40", "minutes": 210.67, "isMajor": false },
  { "name": "東京馬", "year": "2026", "time": "3:22:01", "minutes": 202.02, "isMajor": true, "track": "/tracks/20260301-tokyo.json" },
  { "name": "CT226",  "year": "2026", "time": "3:56:50", "minutes": 236.83, "isMajor": false }
]
  </script>
</section>

<script src="/js/marathon-chart.js" defer></script>
<script type="module" src="/js/marathon-3d.js"></script>
{% endraw %}

---

{% raw %}
<div class="posts-collapse">
  <div class="post-block">
    <div class="post-content">

      <div class="collection-title">
        <h2 class="collection-header">跑步文章</h2>
      </div>

      <div class="collection-year">
        <span class="collection-header">2026</span>
      </div>

      <article itemscope itemtype="http://schema.org/Article">
        <header class="post-header">
          <div class="post-meta-container">
            <time datetime="2026-03-18">03-18</time>
          </div>
          <div class="post-title">
            <a class="post-title-link" href="/post/2026/03/on-run-club-tokyo-cloudmonster-3/" itemprop="url">
              <span itemprop="name">【體驗】東京 On Run Club & 銀座旗艦店 試跑｜On Cloudmonster 3</span>
            </a>
          </div>
        </header>
      </article>

      <div class="collection-year">
        <span class="collection-header">2024</span>
      </div>

      <article itemscope itemtype="http://schema.org/Article">
        <header class="post-header">
          <div class="post-meta-container">
            <time datetime="2024-12-22">12-22</time>
          </div>
          <div class="post-title">
            <a class="post-title-link" href="/post/2024/12/fukuoka-marathon-2024-debut/" itemprop="url">
              <span itemprop="name">人生初馬｜開箱2024福岡馬｜體驗抽籤的海外馬</span>
            </a>
          </div>
        </header>
      </article>

      <article itemscope itemtype="http://schema.org/Article">
        <header class="post-header">
          <div class="post-meta-container">
            <time datetime="2024-11-02">11-02</time>
          </div>
          <div class="post-title">
            <a class="post-title-link" href="/post/2024/11/on-evergreen-half-marathon-camp/" itemprop="url">
              <span itemprop="name">破PB啦！充實的夏天｜瑞士 On 昂跑長榮馬拉松半馬初心訓練營</span>
            </a>
          </div>
        </header>
      </article>

    </div>
  </div>
</div>
{% endraw %}
