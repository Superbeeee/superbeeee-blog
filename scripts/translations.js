'use strict';

// 自製 i18n filter + helper（移植自 tigercosmos.xyz）
// - post_permalink filter：非預設語言 post 加上 /{lang}/ 前綴
// - translation_entries(page) helper：給切換器拿到該頁所有翻譯版本

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
  return result.length ? result : [getDefaultLang(config)];
}

function getTranslationPosts(hexo, page) {
  if (!page || !page.translation_key) return [];
  const defaultLang = getDefaultLang(hexo.config);
  const matched = [];
  const posts = hexo.locals.get('posts');
  if (posts) {
    posts.forEach((post) => {
      if (post.translation_key === page.translation_key) matched.push(post);
    });
  }
  const pages = hexo.locals.get('pages');
  if (pages) {
    pages.forEach((p) => {
      if (p.translation_key === page.translation_key) matched.push(p);
    });
  }
  return matched.sort((a, b) => {
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

function getListTranslationEntries(ctx, page) {
  if (!page || !(page.__index || page.archive || page.tag)) return [];

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
  });
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
