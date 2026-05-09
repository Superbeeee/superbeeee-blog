'use strict';

// Menu localizer：依當前頁的 lang 改寫主選單 URL
// 解決 NeXT 主選單寫死中文路徑、在 EN/JA 頁面點選會跳回中文站的問題
//
// 只改寫「我們有產出多語言版本」的路徑：
//   /                  →  /<lang>/
//   /categories/<x>/   →  /<lang>/categories/<x>/
//   /tags/<x>/         →  /<lang>/tags/<x>/
//   /archives/...      →  /<lang>/archives/...
// 其他路徑（/about/、/running/、/navigation/ 等靜態頁）不改寫，
// 因為目前還沒有它們的多語言版本，改寫只會 404。

function getDefaultLang(config) {
  const lang = config.language;
  if (Array.isArray(lang)) return lang[0];
  if (typeof lang === 'string') return lang.split(',')[0].trim();
  return 'en';
}

function getLanguages(config) {
  const lang = config.language;
  const raw = Array.isArray(lang)
    ? lang
    : (typeof lang === 'string' ? lang.split(',') : []);
  const seen = new Set();
  const result = [];
  raw.forEach((item) => {
    const normalized = String(item || '').trim();
    if (!normalized || normalized === 'default' || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

const LOCALIZABLE_PATTERNS = [
  /^\/$/,
  /^\/categories\//,
  /^\/tags\//,
  /^\/archives(\/|$)/
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
    return match.replace(`href="${href}"`, `href="${localize(href, pageLang)}"`);
  });
});
