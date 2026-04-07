/**
 * Cloudflare Pages Function — /room/:roomNumber 动态 OG 预览
 *
 * 社交爬虫（微信/QQ/Telegram/Twitter/Facebook 等）访问房间链接时，
 * 返回包含动态房间号的 OG meta 标签 HTML，让聊天 app 展示富预览卡片。
 * 普通浏览器请求直接透传到 SPA。
 * 不含业务逻辑或数据库查询。
 */

const CRAWLER_UA =
  /facebookexternalhit|Facebot|Twitterbot|TelegramBot|LinkedInBot|WhatsApp|Slackbot|Discordbot|MicroMessenger|QQBrowser|DingTalk|Applebot|Googlebot|bingbot/i;

/** Max room code length to prevent abuse in OG output. */
const MAX_ROOM_CODE_LENGTH = 10;

interface Env {
  ASSETS: Fetcher;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return ch;
    }
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params } = context;
  const ua = request.headers.get('user-agent') ?? '';

  // Non-crawler → fall through to SPA (_redirects handles SPA fallback)
  if (!CRAWLER_UA.test(ua)) {
    return context.next();
  }

  // Validate & sanitize room code
  const raw = String(params.roomNumber ?? '');
  const roomNumber = escapeHtml(raw.slice(0, MAX_ROOM_CODE_LENGTH));

  const url = new URL(request.url);
  const ogUrl = `${url.origin}/room/${encodeURIComponent(raw.slice(0, MAX_ROOM_CODE_LENGTH))}`;
  const ogImage = `${url.origin}/assets/pwa/icon-512.png`;

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="狼人杀房间 ${roomNumber} · 加入游戏" />
  <meta property="og:description" content="点击链接加入狼人杀房间" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:url" content="${ogUrl}" />
  <meta property="og:locale" content="zh_CN" />
  <meta property="og:site_name" content="狼人杀电子法官" />
  <title>狼人杀房间 ${roomNumber}</title>
</head>
<body></body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
};
