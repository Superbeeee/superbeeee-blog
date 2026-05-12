---
title: Running
date: 2026-05-06
comments: false
lang: en
translation_key: page-running
description: Marathon, half-marathon, and training log — personal bests, race reports timeline, training notes, and gear impressions.
---

{% raw %}
<link rel="stylesheet" href="/css/marathon-chart.css">

<section class="marathon-stats">
  <h2 class="marathon-stats__title">Marathon Race Log</h2>
  <p class="marathon-stats__subtitle">Full marathon trajectory</p>
  <div class="marathon-stats__pb-badge">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 2l2.9 6.9L22 9.7l-5.3 4.6L18.3 22 12 18.3 5.7 22l1.6-7.7L2 9.7l7.1-.8z"/>
    </svg>
    <span data-pb-badge>PB</span>
  </div>

  <div class="marathon-stats__hint">‹ Swipe for older races</div>

  <div id="marathon-chart"></div>

  <script type="application/json" id="marathon-data">
[
  { "name": "Fukuoka",   "year": "2024", "time": "3:38:11", "minutes": 218.18, "isMajor": false },
  { "name": "Taipei",    "year": "2024", "time": "3:28:37", "minutes": 208.62, "isMajor": false },
  { "name": "Freeway",   "year": "2025", "time": "3:34:35", "minutes": 214.58, "isMajor": false },
  { "name": "Taipei",    "year": "2025", "time": "3:30:40", "minutes": 210.67, "isMajor": false },
  { "name": "Tokyo",     "year": "2026", "time": "3:22:01", "minutes": 202.02, "isMajor": true },
  { "name": "CT226",     "year": "2026", "time": "3:56:50", "minutes": 236.83, "isMajor": false }
]
  </script>
</section>

<script src="/js/marathon-chart.js" defer></script>
{% endraw %}

---

{% raw %}
<div class="posts-collapse">
  <div class="post-block">
    <div class="post-content">

      <div class="collection-title">
        <h2 class="collection-header">Running Posts</h2>
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
            <a class="post-title-link" href="/en/post/2026/03/on-run-club-tokyo-cloudmonster-3/" itemprop="url">
              <span itemprop="name">[Experience] Tokyo On Run Club & Ginza Flagship Trial Run | On Cloudmonster 3</span>
            </a>
          </div>
        </header>
      </article>

      <article itemscope itemtype="http://schema.org/Article">
        <header class="post-header">
          <div class="post-meta-container">
            <time datetime="2026-03-05">03-05</time>
          </div>
          <div class="post-title">
            <a class="post-title-link" href="/en/post/2026/03/tokyo-marathon-race-report/" itemprop="url">
              <span itemprop="name">Tokyo Marathon Race Report: Pacing Strategy and Course Analysis for Sub 3:10</span>
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
            <a class="post-title-link" href="/en/post/2024/12/fukuoka-marathon-2024-debut/" itemprop="url">
              <span itemprop="name">My First Marathon | Unboxing Fukuoka 2024 | Going Through the Lottery for an Overseas Race</span>
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
            <a class="post-title-link" href="/en/post/2024/11/on-evergreen-half-marathon-camp/" itemprop="url">
              <span itemprop="name">PB Smashed! A Summer of Substance | Swiss On × EVA Air Half-Marathon Beginners Camp</span>
            </a>
          </div>
        </header>
      </article>

    </div>
  </div>
</div>
{% endraw %}
