// Cloudflare Worker entry
// 預設行為：把所有請求轉給靜態資產（ASSETS）。
// 額外行為：當請求帶 Accept: text/markdown 且路徑屬於文章（/post/），
//          改 serve 同路徑下的 index.md，並設定 Content-Type: text/markdown。

const POST_PATH_PATTERN = /\/post\//;

// 判斷 Accept header 是否要求 markdown。
// 不嚴格做 q-value parsing — 只要 client 明確列出 text/markdown 就算數。
function wantsMarkdown(accept) {
  if (!accept) return false;
  return /(^|,)\s*text\/markdown\b/i.test(accept);
}

function buildMarkdownUrl(url) {
  // 將 /post/foo/ 或 /post/foo 轉成 /post/foo/index.md
  let pathname = url.pathname;
  if (pathname.endsWith('/index.html')) {
    pathname = pathname.slice(0, -'index.html'.length);
  }
  if (!pathname.endsWith('/')) pathname += '/';
  pathname += 'index.md';

  const mdUrl = new URL(url.toString());
  mdUrl.pathname = pathname;
  return mdUrl;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const acceptMarkdown =
      wantsMarkdown(request.headers.get('accept')) &&
      POST_PATH_PATTERN.test(url.pathname);

    if (acceptMarkdown) {
      const mdUrl = buildMarkdownUrl(url);
      const mdResponse = await env.ASSETS.fetch(
        new Request(mdUrl.toString(), {
          method: 'GET',
          headers: request.headers,
        })
      );

      if (mdResponse.ok) {
        const headers = new Headers(mdResponse.headers);
        headers.set('Content-Type', 'text/markdown; charset=utf-8');
        headers.set('Vary', 'Accept');
        headers.set('X-Content-Negotiated', 'markdown');
        return new Response(mdResponse.body, {
          status: 200,
          headers,
        });
      }
      // .md 不存在就 fallthrough 走 HTML
    }

    const response = await env.ASSETS.fetch(request);

    // 對 /post/ 路徑統一加 Vary: Accept，避免 cache 把 HTML/MD 版本搞混
    if (POST_PATH_PATTERN.test(url.pathname)) {
      const headers = new Headers(response.headers);
      headers.append('Vary', 'Accept');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  },
};
