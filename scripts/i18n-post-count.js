'use strict';

// i18n post-count fixer：
// site.posts.length 是「所有語言加總」，在多語站會把篇數 ×N 顯示
// （目前 zh-TW / en / ja 三語 → 9 篇被算成 27）。
// 這個 script 做兩件事：
//   1. 覆寫 NexT 的 post_count(year) helper：歸檔年份篇數依當前語言過濾
//   2. after_render:html filter：改寫渲染後 HTML 中兩個位置的數字
//      - 側邊欄 .site-state-posts 的 count
//      - 歸檔頁 .collection-header 內「N 篇文章 / N posts / N ポスト」

function getDefaultLang(config) {
  const lang = config.language;
  if (Array.isArray(lang)) return lang[0];
  if (typeof lang === 'string') return lang.split(',')[0].trim();
  return 'en';
}

function normalizeLang(lang) {
  return lang === 'jp' ? 'ja' : lang;
}

// 覆寫 post_count helper：依當前頁 lang 過濾
// 用 generateBefore event 確保在 NexT 自己註冊完之後再覆寫
// （/scripts/ 內 user scripts 比 node_modules theme scripts 先載入）
hexo.on('generateBefore', () => {
  hexo.extend.helper.register('post_count', function (year) {
    const defaultLang = getDefaultLang(hexo.config);
    const pageLang = normalizeLang((this.page && this.page.lang) || defaultLang);
    return this.site.posts
      .filter((post) => this.date(post.date, 'YYYY') === year)
      .filter((post) => normalizeLang(post.lang || defaultLang) === pageLang)
      .count();
  });
});

hexo.extend.filter.register('after_render:html', function (str, data) {
  const defaultLang = getDefaultLang(hexo.config);
  const pageLang = normalizeLang((data && data.page && data.page.lang) || defaultLang);

  const posts = hexo.locals.get('posts');
  if (!posts) return str;
  const allPosts = posts.toArray();
  const total = allPosts.length;
  if (!total) return str;

  const langCount = allPosts.filter(
    (p) => normalizeLang(p.lang || defaultLang) === pageLang
  ).length;
  if (langCount === total) return str;

  let result = str;

  // 1) 側邊欄 site-state-posts 的數字
  result = result.replace(
    /(<div class="site-state-item site-state-posts">[\s\S]*?<span class="site-state-item-count">)\d+(<\/span>)/,
    `$1${langCount}$2`
  );

  // 2) 歸檔頁 collection-header 的總篇數描述（三語版本）
  //    例：<span class="collection-header">嗯..! 目前共有 27 篇文章。 繼續努力。</span>
  //    [^<]*? 保證不會跨到其他標籤（避開年份 header 的 <span class="collection-year-count">）
  result = result.replace(
    /(<span class="collection-header">[^<]*?)\d+(\s*篇文章[^<]*?<\/span>)/,
    `$1${langCount}$2`
  );
  result = result.replace(
    /(<span class="collection-header">[^<]*?)\d+(\s*posts?\b[^<]*?<\/span>)/i,
    `$1${langCount}$2`
  );
  result = result.replace(
    /(<span class="collection-header">[^<]*?)\d+(\s*ポスト[^<]*?<\/span>)/,
    `$1${langCount}$2`
  );

  return result;
});
