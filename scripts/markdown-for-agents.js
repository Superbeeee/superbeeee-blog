'use strict';

// Markdown for Agents：為每篇 post 產出 index.md 伴隨檔，
// 讓 Cloudflare Worker 在 Accept: text/markdown 時回 markdown 版本。
// 內容直接用 post.raw（包含 frontmatter + 原文），保留 LLM 需要的脈絡。

hexo.extend.generator.register('markdown-for-agents', function (locals) {
  const posts = locals.posts.toArray();
  const pages = [];

  for (const post of posts) {
    if (!post.path || !post.raw) continue;

    // post.path 形如 "post/2026/04/slug/" 或 "en/post/2026/04/slug/"
    // 把伴隨檔放在同路徑下：post/2026/04/slug/index.md
    const base = post.path.endsWith('/') ? post.path : `${post.path}/`;
    pages.push({
      path: `${base}index.md`,
      data: post.raw,
    });
  }

  return pages;
});
