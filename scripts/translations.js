'use strict';

// 自製 i18n filter + helper（移植自 tigercosmos.xyz）
// - post_permalink filter：非預設語言 post 加上 /{lang}/ 前綴
// - translation_entries(page) helper：給切換器拿到該頁所有翻譯版本

const { getDefaultLang, getLanguages } = require('./lib/i18n-lang');

// translation_key → [posts/pages] 索引。
// helper 每頁會被呼叫 3 次（head / header / post-body-start），
// 沒有索引的話每次都要全量掃 posts + pages，建置成本 O(posts × pages)。
let translationIndex = null;

hexo.on('generateBefore', () => {
  // 每次重新產生（含 hexo server watch）都重建
  translationIndex = null;
});

function buildTranslationIndex() {
  const index = new Map();
  const add = (doc) => {
    if (!doc.translation_key) return;
    const list = index.get(doc.translation_key);
    if (list) list.push(doc);
    else index.set(doc.translation_key, [doc]);
  };
  const posts = hexo.locals.get('posts');
  if (posts) posts.forEach(add);
  const pages = hexo.locals.get('pages');
  if (pages) pages.forEach(add);
  return index;
}

function getTranslationPosts(hexo, page) {
  if (!page || !page.translation_key) return [];
  if (!translationIndex) translationIndex = buildTranslationIndex();

  const defaultLang = getDefaultLang(hexo.config);
  const matched = translationIndex.get(page.translation_key) || [];
  return matched.slice().sort((a, b) => {
    const langA = a.lang || defaultLang;
    const langB = b.lang || defaultLang;
    return langA.localeCompare(langB);
  });
}

function getPostSlugPath(post, lang) {
  if (!post || !post.source) return post.slug;
  const source = post.source.replace(/\\/g, '/');
  const translationDir = hexo.config.translation_post_dir || '_posts_translation';
  const translationPrefix = `${translationDir.replace(/\/$/, '')}/${lang}/`;
  const legacyJpPrefix = lang === 'ja'
    ? `${translationDir.replace(/\/$/, '')}/jp/`
    : null;
  let prefix = null;
  if (source.startsWith(translationPrefix)) prefix = translationPrefix;
  if (!prefix && legacyJpPrefix && source.startsWith(legacyJpPrefix)) prefix = legacyJpPrefix;
  if (!prefix) return post.slug;
  return source.slice(prefix.length).replace(/\.md$/i, '');
}

// 查 hexo route 確認該路徑真的有被產生。
// i18n generator 對「該語言零篇文章」的 category/tag 會跳過不產生頁面，
// 沒查就直接產 entry 會讓切換器連到 404。
function routeExists(path) {
  // 根路徑「/」去掉斜線後是空字串，對應的 route 是 index.html
  const clean = String(path || '').replace(/^\/+/, '') || 'index.html';
  let decoded = clean;
  try {
    decoded = decodeURI(clean);
  } catch (err) {
    // 解碼失敗就用原字串查
  }
  return Boolean(hexo.route.get(decoded));
}

function getListTranslationEntries(ctx, page) {
  if (!page || !(page.__index || page.archive || page.tag || page.category)) return [];

  const defaultLang = getDefaultLang(ctx.config);
  const languages = getLanguages(ctx.config);
  if (languages.length < 2) return [];

  const pageLang = page.lang || defaultLang;
  const currentUrlRaw = (typeof page.current_url === 'string') ? page.current_url : (page.path || '');
  const currentUrl = String(currentUrlRaw).replace(/^\/+/, '');
  let relativePath = currentUrl;

  if (pageLang !== defaultLang && relativePath.startsWith(`${pageLang}/`)) {
    relativePath = relativePath.slice(pageLang.length + 1);
  }

  const base = (ctx.config.url || '').replace(/\/$/, '');
  // 只保留真的有產生頁面的語言版本；被濾掉的語言由
  // translation_entries_with_fallback 補上「連回該語言首頁」的保底 entry
  return languages.map((lang) => {
    const withPrefix = lang === defaultLang ? `/${relativePath}` : `/${lang}/${relativePath}`;
    const path = withPrefix.replace(/\/{2,}/g, '/');
    return {
      lang,
      path,
      abs: `${base}${path}`,
      title: page.title || '',
      isCurrent: lang === pageLang,
      isDefault: lang === defaultLang,
    };
  }).filter((entry) => entry.isCurrent || routeExists(entry.path));
}

hexo.extend.helper.register('translation_entries', function (page) {
  const entries = getTranslationPosts(hexo, page);
  if (!entries.length) return getListTranslationEntries(this, page);

  const base = (this.config.url || '').replace(/\/$/, '');
  const defaultLang = getDefaultLang(hexo.config);

  return entries.map((post) => {
    const lang = post.lang || defaultLang;
    const isPost = post.layout === 'post';
    let path;
    if (isPost && lang !== defaultLang && post.slug && post.date && post.date.format) {
      const year = post.date.format('YYYY');
      const month = post.date.format('MM');
      const slugPath = getPostSlugPath(post, lang) || post.slug;
      path = `/${lang}/post/${year}/${month}/${slugPath}/`;
    } else {
      path = this.url_for(post.path);
    }
    return {
      lang,
      path,
      abs: `${base}${path}`,
      title: post.title,
      isCurrent: page._id === post._id,
      isDefault: lang === defaultLang,
    };
  });
});

// 給切換器一個保底用 helper：永遠回傳 3 個語言（即使該頁沒翻譯）
hexo.extend.helper.register('translation_entries_with_fallback', function (page) {
  const entries = (this.translation_entries && this.translation_entries(page)) || [];
  const langs = getLanguages(this.config);
  const defaultLang = getDefaultLang(this.config);
  const byLang = new Map(entries.map(e => [e.lang, e]));
  const pageLang = (page && page.lang) || defaultLang;

  return langs.map(lang => {
    if (byLang.has(lang)) return byLang.get(lang);
    // 沒翻譯：連結到該語言首頁
    const path = lang === defaultLang ? '/' : `/${lang}/`;
    return {
      lang,
      path,
      abs: `${(this.config.url || '').replace(/\/$/, '')}${path}`,
      title: '',
      isCurrent: lang === pageLang,
      isDefault: lang === defaultLang,
      isFallback: true
    };
  });
});

hexo.extend.filter.register('post_permalink', function (data) {
  const defaultLang = getDefaultLang(hexo.config);
  if (!data || data.layout !== 'post') return data;
  if (!data.lang || data.lang === defaultLang) return data;
  if (!data.slug && !data.source) return data;

  const year = data.date && data.date.format ? data.date.format('YYYY') : '';
  const month = data.date && data.date.format ? data.date.format('MM') : '';
  const slugPath = getPostSlugPath(data, data.lang) || data.slug;
  data.__permalink = `${data.lang}/post/${year}/${month}/${slugPath}/`;
  return data;
}, 1);

// hexo 內建的 post_permalink filter（priority 10）看到 __permalink 會硬加開頭斜線，
// 造成翻譯文章的 post.path（"/en/post/..."）和一般文章（"post/..."）格式不一致，
// 下游用 root + path 組 URL 的套件（如 search DB）會產出 "//en/post/..." 雙斜線。
// 這裡在內建 filter 之後把開頭斜線拿掉，統一成無開頭斜線的慣例。
hexo.extend.filter.register('post_permalink', function (permalink) {
  if (typeof permalink !== 'string') return permalink;
  return permalink.replace(/^\/+/, '');
}, 20);
