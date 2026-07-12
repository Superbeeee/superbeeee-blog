'use strict';

// Menu localizer：依當前頁的 lang 改寫主選單 URL
// 解決 NeXT 主選單寫死中文路徑、在 EN/JA 頁面點選會跳回中文站的問題
//
// 只改寫「我們有產出多語言版本」的路徑：
//   /                  →  /<lang>/
//   /categories/<x>/   →  /<lang>/categories/<x>/
//   /tags/<x>/         →  /<lang>/tags/<x>/
//   /archives/...      →  /<lang>/archives/...
//   /about/            →  /<lang>/about/
//   /running/          →  /<lang>/running/
//   /navigation/       →  /<lang>/navigation/

const { getDefaultLang, getLanguages } = require('./lib/i18n-lang');

const LOCALIZABLE_PATTERNS = [
  /^\/$/,
  /^\/categories\//,
  /^\/tags\//,
  /^\/archives(\/|$)/,
  /^\/about(\/|$)/,
  /^\/running(\/|$)/,
  /^\/navigation(\/|$)/
];

function shouldLocalize(href, langs) {
  if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('#') || href.startsWith('mailto:')) return false;
  if (!href.startsWith('/')) return false;
  // 已經有語言前綴就跳過
  for (const l of langs) {
    if (href === `/${l}` || href === `/${l}/` || href.startsWith(`/${l}/`)) return false;
  }
  return LOCALIZABLE_PATTERNS.some((re) => re.test(href));
}

function localize(href, lang) {
  if (href === '/') return `/${lang}/`;
  return `/${lang}${href}`;
}

// 查 hexo route 確認改寫後的目標頁真的有被產生。
// i18n generator 對「該語言零篇文章」的 category/tag 不會產生頁面，
// 這種情況保留原本的中文版連結，總比改寫成 404 好。
// HTML 裡的 href 是 percent-encoded，route 名稱是未編碼字串，查之前先 decode。
function localizedRouteExists(href) {
  // 根路徑「/」去掉斜線後是空字串，對應的 route 是 index.html
  const clean = String(href || '').replace(/^\/+/, '') || 'index.html';
  let decoded = clean;
  try {
    decoded = decodeURI(clean);
  } catch (err) {
    // 解碼失敗就用原字串查
  }
  return Boolean(hexo.route.get(decoded));
}

hexo.extend.filter.register('after_render:html', function (str, data) {
  const config = hexo.config;
  const defaultLang = getDefaultLang(config);
  const langs = getLanguages(config);
  const pageLang = (data && data.page && data.page.lang) || defaultLang;
  if (pageLang === defaultLang) return str;
  if (!langs.includes(pageLang)) return str;

  // 改寫整份 HTML 中符合 LOCALIZABLE_PATTERNS 的連結（首頁、categories、tags、archives）
  // 文章內頁的 /post/.../ 不在 pattern 裡，且 EN/JA post 的 URL 已被 permalink filter 加好 /lang/
  // 所以這裡的改寫是安全的
  //
  // 例外：跳過 <a lang="xxx"> 這種明確標示目標語言的連結（語言切換器用），
  // 否則 ZH 連結會被改成 /<currentLang>/，導致切回中文時跑回原本語言的首頁。
  return str.replace(/<a\b[^>]*\shref="([^"]+)"[^>]*>/g, (match, href) => {
    if (!shouldLocalize(href, langs)) return match;
    if (/\slang="[^"]+"/.test(match)) return match;
    const localized = localize(href, pageLang);
    if (!localizedRouteExists(localized)) return match;
    return match.replace(`href="${href}"`, `href="${localized}"`);
  });
});
