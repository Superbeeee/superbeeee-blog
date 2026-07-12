'use strict';

// 每個語言各自產生 atom feed 與 search DB。
// hexo-generator-feed / hexo-generator-searchdb 都不分語言、直接吃整個
// Post collection，而翻譯文章是真的 Post 文件，造成：
//   - atom.xml 同一篇文章 zh/en/ja 三份重複，limit 被重複條目吃掉
//   - 站內搜尋在 EN/JA 頁面混出其他語言的結果
// 這裡用同名 generator（'atom' / 'xml'）覆寫掉原套件的註冊，
// 產出：zh → /atom.xml、/search.xml；en/ja → /<lang>/atom.xml、/<lang>/search.xml

const feedFn = require('hexo-generator-feed/lib/generator');
const searchXmlFn = require('hexo-generator-searchdb/lib/xml_generator');
const { getDefaultLang, getLanguages } = require('./lib/i18n-lang');

function filterByLang(collection, lang, defaultLang) {
  return collection.filter((item) => (item.lang || defaultLang) === lang);
}

hexo.extend.generator.register('atom', function (locals) {
  const config = this.config;
  const defaultLang = getDefaultLang(config);
  const results = [];

  for (const lang of getLanguages(config)) {
    const posts = filterByLang(locals.posts, lang, defaultLang);
    if (!posts.length) continue;

    const prefix = lang === defaultLang ? '' : `${lang}/`;
    const langLocals = Object.assign(Object.create(locals), { posts });
    const result = feedFn.call(hexo, langLocals, 'atom', `${prefix}atom.xml`);
    if (result) results.push(result);
  }

  return results;
});

hexo.extend.generator.register('xml', function (locals) {
  const config = this.config;
  const defaultLang = getDefaultLang(config);
  const results = [];

  for (const lang of getLanguages(config)) {
    const posts = filterByLang(locals.posts, lang, defaultLang);
    const pages = filterByLang(locals.pages, lang, defaultLang);
    if (!posts.length && !pages.length) continue;

    const prefix = lang === defaultLang ? '' : `${lang}/`;
    const langLocals = Object.assign(Object.create(locals), { posts, pages });
    const result = searchXmlFn.call(hexo, langLocals);
    result.path = `${prefix}${config.search.path}`;
    results.push(result);
  }

  return results;
});

// EN/JA 頁面上，把 search DB 路徑（NexT 埋在 next-config JSON 的 "path"）
// 和 RSS 連結（autodiscovery <link> + 側欄 <a>）改指到該語言自己的檔案
hexo.extend.filter.register('after_render:html', function (str, data) {
  const config = hexo.config;
  const defaultLang = getDefaultLang(config);
  const langs = getLanguages(config);
  const pageLang = (data && data.page && data.page.lang) || defaultLang;
  if (pageLang === defaultLang) return str;
  if (!langs.includes(pageLang)) return str;

  const root = config.root || '/';
  let out = str;
  if (config.search && typeof config.search.path === 'string') {
    const needle = `"path":"${root}${config.search.path}"`;
    const replacement = `"path":"${root}${pageLang}/${config.search.path}"`;
    out = out.split(needle).join(replacement);
  }
  if (config.feed && typeof config.feed.path === 'string') {
    const needle = `href="${root}${config.feed.path}"`;
    const replacement = `href="${root}${pageLang}/${config.feed.path}"`;
    out = out.split(needle).join(replacement);
  }
  return out;
});
