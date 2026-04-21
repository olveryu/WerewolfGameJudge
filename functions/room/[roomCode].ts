/**
 * Cloudflare Pages Function — /room/:roomCode 动态 OG 预览
 *
 * 对所有 /room/:roomCode 请求，用 HTMLRewriter 将 SPA index.html 中的
 * OG meta 和 <title> 替换为包含动态房间号的版本。
 * 不依赖 UA 检测，所有客户端（爬虫/浏览器）都拿到正确的 OG 标签，
 * 浏览器端 JS 正常接管 SPA 路由。
 * 不含业务逻辑或数据库查询。
 */

/** Max room code length to prevent abuse in OG output. */
const MAX_ROOM_CODE_LENGTH = 10;

interface Env {
  ASSETS: Fetcher;
}

/** OG property → replacement content value mapping. */
const OG_REPLACEMENTS: Record<string, (roomCode: string, ogUrl: string) => string> = {
  'og:title': (roomCode) => `狼人杀房间 ${roomCode} · 加入游戏`,
  'og:description': () => '点击链接加入狼人杀房间',
  'og:url': (_roomNumber, ogUrl) => ogUrl,
};

/**
 * HTMLRewriter handler that rewrites <meta property="og:*"> and <title> tags.
 */
class OGMetaRewriter implements HTMLRewriterElementContentHandlers {
  constructor(
    private roomCode: string,
    private ogUrl: string,
  ) {}

  element(element: Element): void {
    const property = element.getAttribute('property');
    if (property && property in OG_REPLACEMENTS) {
      element.setAttribute('content', OG_REPLACEMENTS[property](this.roomCode, this.ogUrl));
    }
  }
}

class TitleRewriter implements HTMLRewriterElementContentHandlers {
  private replaced = false;
  constructor(private roomCode: string) {}

  text(text: Text): void {
    if (!this.replaced) {
      text.replace(`狼人杀房间 ${this.roomCode}`);
      this.replaced = true;
    } else {
      text.remove();
    }
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;

  // Validate & sanitize room code
  const raw = String(params.roomCode ?? '').slice(0, MAX_ROOM_CODE_LENGTH);
  // Only allow alphanumeric room codes
  const roomCode = raw.replace(/[^a-zA-Z0-9]/g, '');
  if (!roomCode) {
    return context.next();
  }

  const url = new URL(request.url);
  const ogUrl = `${url.origin}/room/${encodeURIComponent(roomCode)}`;

  // Fetch the SPA index.html from static assets
  const assetResponse = await env.ASSETS.fetch(new URL('/', url.origin));
  if (!assetResponse.ok) {
    return context.next();
  }

  return new HTMLRewriter()
    .on('meta[property]', new OGMetaRewriter(roomCode, ogUrl))
    .on('title', new TitleRewriter(roomCode))
    .transform(assetResponse);
};
