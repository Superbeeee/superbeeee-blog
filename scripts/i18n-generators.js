'use strict';

// i18n generators（移植自 tigercosmos.xyz）
// 覆寫 hexo 內建的 index / tag / archive generator，
// 為每個語言獨立生成首頁、標籤頁與歸檔頁。

const pagination = require('hexo-pagination');
const { getDefaultLang, getLanguages } = require('./lib/i18n-lang');

function normalizeDir(input) {
  if (!input) return '';
  let dir = String(input);
  if (dir === '/') return '';
  if (dir.startsWith('/')) dir = dir.slice(1);
  if (dir && !dir.endsWith('/')) dir += '/';
  return dir;
}

function getPostLang(post, defaultLang) {
  return (post && post.lang) ? post.lang : defaultLang;
}

function filterPostsByLang(posts, lang, defaultLang) {
  return posts.filter((post) => getPostLang(post, defaultLang) === lang);
}

const fmtNum = (num) => (num < 10 ? `0${num}` : String(num));

// 各語言對應的 meta description（fallback）。
// 沒設定就回 undefined，OG helper 自然 fallback 到 config.description。
function getLangDescription(config, lang) {
  const map = config.i18n_descriptions;
  if (!map || typeof map !== 'object') return undefined;
  return map[lang];
}

hexo.extend.generator.register('index', function i18nIndexGenerator(locals) {
  const config = this.config;
  const defaultLang = getDefaultLang(config);
  const languages = getLanguages(config);

  const indexConfig = config.index_generator || {};
  const perPage = indexConfig.per_page;
  const orderBy = indexConfig.order_by || '-date';
  const paginationDir = config.pagination_dir || 'page';

  const basePath = normalizeDir(indexConfig.path || '');
  const allPosts = locals.posts.sort(orderBy);

  const pages = [];

  for (const lang of languages) {
    const langPrefix = lang === defaultLang ? '' : `${lang}/`;
    const langBase = `${langPrefix}${basePath}`;
    const langPosts = filterPostsByLang(allPosts, lang, defaultLang);
    if (!langPosts.length) continue;

    const description = getLangDescription(config, lang);
    pages.push(...pagination(langBase, langPosts, {
      perPage,
      layout: ['index', 'archive'],
      format: `${paginationDir}/%d/`,
      data: { __index: true, lang, description }
    }));
  }

  return pages;
});

hexo.extend.generator.register('category', function i18nCategoryGenerator(locals) {
  const config = this.config;
  const defaultLang = getDefaultLang(config);
  const languages = getLanguages(config);

  const catConfig = config.category_generator || {};
  const perPage = catConfig.per_page;
  const paginationDir = config.pagination_dir || 'page';
  const orderBy = catConfig.order_by || '-date';
  const categories = locals.categories;

  const pages = [];

  // 每個 category 只排序一次，不用每個語言重排一遍
  const sortedPosts = new Map();
  categories.forEach((category) => {
    if (!category.length) return;
    sortedPosts.set(category._id, category.posts.sort(orderBy));
  });

  for (const lang of languages) {
    const langPrefix = lang === defaultLang ? '' : `${lang}/`;
    const description = getLangDescription(config, lang);
    categories.forEach((category) => {
      const sorted = sortedPosts.get(category._id);
      if (!sorted) return;

      const posts = filterPostsByLang(sorted, lang, defaultLang);
      if (!posts.length) return;

      const path = `${langPrefix}${category.path}`;
      pages.push(...pagination(path, posts, {
        perPage,
        layout: ['category', 'archive', 'index'],
        format: `${paginationDir}/%d/`,
        data: { category: category.name, lang, description }
      }));
    });
  }

  return pages;
});

hexo.extend.generator.register('tag', function i18nTagGenerator(locals) {
  const config = this.config;
  const defaultLang = getDefaultLang(config);
  const languages = getLanguages(config);

  const tagConfig = config.tag_generator || {};
  const perPage = tagConfig.per_page;
  const paginationDir = config.pagination_dir || 'page';
  const orderBy = tagConfig.order_by || '-date';
  const tags = locals.tags;

  const pages = [];

  // 每個 tag 只排序一次，不用每個語言重排一遍
  const sortedPosts = new Map();
  tags.forEach((tag) => {
    if (!tag.length) return;
    sortedPosts.set(tag._id, tag.posts.sort(orderBy));
  });

  for (const lang of languages) {
    const langPrefix = lang === defaultLang ? '' : `${lang}/`;
    const description = getLangDescription(config, lang);
    tags.forEach((tag) => {
      const sorted = sortedPosts.get(tag._id);
      if (!sorted) return;

      const posts = filterPostsByLang(sorted, lang, defaultLang);
      if (!posts.length) return;

      const path = `${langPrefix}${tag.path}`;
      pages.push(...pagination(path, posts, {
        perPage,
        layout: ['tag', 'archive', 'index'],
        format: `${paginationDir}/%d/`,
        data: { tag: tag.name, lang, description }
      }));
    });
  }

  return pages;
});

hexo.extend.generator.register('archive', function i18nArchiveGenerator(locals) {
  const config = this.config;
  const defaultLang = getDefaultLang(config);
  const languages = getLanguages(config);

  const archiveConfig = config.archive_generator || {};
  const paginationDir = config.pagination_dir || 'page';
  const orderBy = archiveConfig.order_by || '-date';
  const perPage = archiveConfig.per_page;
  const baseArchiveDir = normalizeDir(config.archive_dir);
  const allPosts = locals.posts.sort(orderBy);

  const Query = this.model('Post').Query;
  const pages = [];

  for (const lang of languages) {
    const langPosts = filterPostsByLang(allPosts, lang, defaultLang);
    if (!langPosts.length) continue;

    const langPrefix = lang === defaultLang ? '' : `${lang}/`;
    const archiveDir = `${langPrefix}${baseArchiveDir}`;
    const description = getLangDescription(config, lang);

    function generate(path, posts, options) {
      const data = Object.assign({ archive: true, lang, description }, options);
      pages.push(...pagination(path, posts, {
        perPage,
        layout: ['archive', 'index'],
        format: `${paginationDir}/%d/`,
        data
      }));
    }

    generate(archiveDir, langPosts);

    if (!archiveConfig.yearly) continue;

    const postsByYear = {};
    langPosts.forEach((post) => {
      const date = post.date;
      const year = date.year();
      const month = date.month() + 1;

      if (!Object.prototype.hasOwnProperty.call(postsByYear, year)) {
        postsByYear[year] = Array.from({ length: 13 }, () => []);
      }
      postsByYear[year][0].push(post);
      postsByYear[year][month].push(post);

      if (archiveConfig.daily) {
        const day = date.date();
        if (!Object.prototype.hasOwnProperty.call(postsByYear[year][month], 'day')) {
          postsByYear[year][month].day = {};
        }
        (postsByYear[year][month].day[day] || (postsByYear[year][month].day[day] = [])).push(post);
      }
    });

    const years = Object.keys(postsByYear);
    for (let i = 0, len = years.length; i < len; i++) {
      const year = +years[i];
      const yearData = postsByYear[year];
      const yearUrl = `${archiveDir}${year}/`;
      if (!yearData[0].length) continue;

      generate(yearUrl, new Query(yearData[0]), { year });

      if (!archiveConfig.monthly && !archiveConfig.daily) continue;

      for (let month = 1; month <= 12; month++) {
        const monthData = yearData[month];
        if (!monthData.length) continue;

        if (archiveConfig.monthly) {
          generate(`${yearUrl}${fmtNum(month)}/`, new Query(monthData), { year, month });
        }
        if (!archiveConfig.daily) continue;

        for (let day = 1; day <= 31; day++) {
          const dayData = monthData.day && monthData.day[day];
          if (!dayData || !dayData.length) continue;
          generate(`${yearUrl}${fmtNum(month)}/${fmtNum(day)}/`, new Query(dayData), { year, month, day });
        }
      }
    }
  }

  return pages;
});
