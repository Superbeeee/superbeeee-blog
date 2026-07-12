'use strict';

// i18n post-count fixer：
// site.posts.length 是「所有語言加總」，在多語站會把篇數 ×N 顯示
// （目前 zh-TW / en / ja 三語 → 10 篇被算成 30）。
// 這個 script 做兩件事：
//   1. 覆寫 NexT 的 post_count(year) helper：歸檔年份篇數依當前語言過濾
//   2. after_render:html filter：改寫渲染後 HTML 中兩個位置的數字
//      - 側邊欄 .site-state-posts 的 count
//      - 歸檔頁 .collection-header 內「N 篇文章 / N posts / N ポスト」
// 改寫依賴 NexT 的 markup，若主題升版改了 class 或字樣導致 regex 沒 match，
// 會發出 warning（而不是無聲顯示錯誤數字）。

const { getDefaultLang, normalizeLang } = require('./lib/i18n-lang');

// 每語言篇數快取：全站掃一次就好，不用每渲染一頁重算一次
let countCache = null;

function getCounts() {
  if (countCache) return countCache;
  const defaultLang = getDefaultLang(hexo.config);
  const counts = new Map();
  let total = 0;
  const posts = hexo.locals.get('posts');
  if (posts) {
    posts.forEach((p) => {
      const lang = normalizeLang(p.lang || defaultLang);
      counts.set(lang, (counts.get(lang) || 0) + 1);
      total += 1;
    });
  }
  countCache = { counts, total };
  return countCache;
}

hexo.on('generateBefore', () => {
  // 每次重新產生（含 hexo server watch）都重算
  countCache = null;

  // 覆寫 post_count helper：依當前頁 lang 過濾
  // 放在 generateBefore 確保在 NexT 自己註冊完之後再覆寫
  // （/scripts/ 內 user scripts 比 node_modules theme scripts 先載入）
  hexo.extend.helper.register('post_count', function (year) {
    const defaultLang = getDefaultLang(hexo.config);
    const pageLang = normalizeLang((this.page && this.page.lang) || defaultLang);
    return this.site.posts
      .filter((post) => this.date(post.date, 'YYYY') === year)
      .filter((post) => normalizeLang(post.lang || defaultLang) === pageLang)
      .count();
  });
});

const SIDEBAR_RE = /(<div class="site-state-item site-state-posts">[\s\S]*?<span class="site-state-item-count">)\d+(<\/span>)/;
const HEADER_RES = [
  // 例：<span class="collection-header">嗯..! 目前共有 27 篇文章。 繼續努力。</span>
  // [^<]*? 保證不會跨到其他標籤（避開年份 header 的 <span class="collection-year-count">）
  /(<span class="collection-header">[^<]*?)\d+(\s*篇文章[^<]*?<\/span>)/,
  /(<span class="collection-header">[^<]*?)\d+(\s*posts?\b[^<]*?<\/span>)/i,
  /(<span class="collection-header">[^<]*?)\d+(\s*ポスト[^<]*?<\/span>)/,
];

hexo.extend.filter.register('after_render:html', function (str, data) {
  const defaultLang = getDefaultLang(hexo.config);
  const pageLang = normalizeLang((data && data.page && data.page.lang) || defaultLang);

  const { counts, total } = getCounts();
  if (!total) return str;

  const langCount = counts.get(pageLang) || 0;
  if (langCount === total) return str;

  const pagePath = (data && data.path) || '(unknown)';
  let result = str;

  // 1) 側邊欄 site-state-posts 的數字
  if (SIDEBAR_RE.test(result)) {
    result = result.replace(SIDEBAR_RE, `$1${langCount}$2`);
  } else if (result.includes('site-state-posts')) {
    hexo.log.warn(
      `[i18n-post-count] ${pagePath}: 側欄有 site-state-posts 但 regex 沒 match，` +
      'NexT markup 可能改版，篇數會顯示成全語言加總'
    );
  }

  // 2) 歸檔頁 collection-header 的總篇數描述（三語版本）。
  //    tag/category 頁也有 collection-header 但只放年份標題、沒有計數字樣，
  //    所以只對歸檔頁（page.archive）檢查有沒有 match 到。
  const matched = HEADER_RES.some((re) => re.test(result));
  if (matched) {
    for (const re of HEADER_RES) {
      result = result.replace(re, `$1${langCount}$2`);
    }
  } else if (data && data.page && data.page.archive) {
    hexo.log.warn(
      `[i18n-post-count] ${pagePath}: 歸檔頁的總篇數字樣三個語言的 regex 都沒 match，` +
      'NexT markup 或字樣可能改版，篇數會顯示成全語言加總'
    );
  }

  return result;
});
