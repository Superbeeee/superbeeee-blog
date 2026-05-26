// Cloudflare Worker entry
// 預設行為：把所有請求轉給靜態資產（ASSETS）。
// 額外行為：當請求帶 Accept: text/markdown 且路徑屬於文章（/post/），
//          改 serve 同路徑下的 index.md，並設定 Content-Type: text/markdown。

const POST_PATH_PATTERN = /\/post\//;

// AI 流量偵測名單
const AI_USER_AGENTS = [
  // 訓練 / 索引爬蟲
  { re: /GPTBot/i, name: 'GPTBot', kind: 'training' },
  { re: /ClaudeBot/i, name: 'ClaudeBot', kind: 'training' },
  { re: /Google-Extended/i, name: 'Google-Extended', kind: 'training' },
  { re: /CCBot/i, name: 'CCBot', kind: 'training' },
  { re: /Applebot-Extended/i, name: 'Applebot-Extended', kind: 'training' },
  { re: /Bytespider/i, name: 'Bytespider', kind: 'training' },
  { re: /meta-externalagent/i, name: 'Meta-AI', kind: 'training' },
  { re: /Amazonbot/i, name: 'Amazonbot', kind: 'training' },
  // 即時抓取（AI 回答使用者問題時抓頁面）
  { re: /ChatGPT-User/i, name: 'ChatGPT-User', kind: 'realtime' },
  { re: /OAI-SearchBot/i, name: 'OAI-SearchBot', kind: 'realtime' },
  { re: /Claude-User/i, name: 'Claude-User', kind: 'realtime' },
  { re: /Claude-SearchBot/i, name: 'Claude-SearchBot', kind: 'realtime' },
  { re: /PerplexityBot/i, name: 'PerplexityBot', kind: 'realtime' },
  { re: /Perplexity-User/i, name: 'Perplexity-User', kind: 'realtime' },
  { re: /DuckAssistBot/i, name: 'DuckAssistBot', kind: 'realtime' },
];

// AI 服務的 referer 來源（使用者從 AI 對話點連結進來）
const AI_REFERRERS = [
  { re: /chatgpt\.com|chat\.openai\.com/i, name: 'ChatGPT' },
  { re: /perplexity\.ai/i, name: 'Perplexity' },
  { re: /claude\.ai/i, name: 'Claude' },
  { re: /gemini\.google\.com/i, name: 'Gemini' },
  { re: /copilot\.microsoft\.com/i, name: 'Copilot' },
  { re: /you\.com/i, name: 'You.com' },
  { re: /phind\.com/i, name: 'Phind' },
];

function detectAI(request) {
  const ua = request.headers.get('user-agent') || '';
  const referer = request.headers.get('referer') || '';

  for (const { re, name, kind } of AI_USER_AGENTS) {
    if (re.test(ua)) return { source: name, kind, via: 'user-agent' };
  }
  for (const { re, name } of AI_REFERRERS) {
    if (re.test(referer)) return { source: name, kind: 'referral', via: 'referer' };
  }
  return null;
}

function logAITraffic(env, ctx, request, url, ai) {
  const ua = (request.headers.get('user-agent') || '').slice(0, 300);
  const referer = (request.headers.get('referer') || '').slice(0, 300);
  const country = request.cf?.country || '';

  console.log(JSON.stringify({
    event: 'ai_traffic',
    ai_source: ai.source,
    kind: ai.kind,
    via: ai.via,
    path: url.pathname,
    country,
    ua,
    referer,
  }));

  if (env.AI_TRAFFIC_DB) {
    const insert = env.AI_TRAFFIC_DB
      .prepare(
        'INSERT INTO hits (ts, ai_source, kind, via, path, country, ua, referer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(new Date().toISOString(), ai.source, ai.kind, ai.via, url.pathname, country, ua, referer)
      .run();
    ctx.waitUntil(insert.catch((err) => console.error('AI_TRAFFIC_DB insert failed', err)));
  }
}

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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const ai = detectAI(request);
    if (ai) logAITraffic(env, ctx, request, url, ai);

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
