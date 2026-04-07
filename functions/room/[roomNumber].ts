/**
 * Cloudflare Pages Function — /room/:roomNumber 动态 OG 预览
 *
 * 对所有 /room/:roomNumber 请求，用 HTMLRewriter 将 SPA index.html 中的
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
const OG_REPLACEMENTS: Record<string, (roomNumber: string, ogUrl: string) => string> = {
  'og:title': (roomNumber) => `狼人杀房间 ${roomNumber} · 加入游戏`,
  'og:description': () => '点击链接加入狼人杀房间',
  'og:url': (_roomNumber, ogUrl) => ogUrl,
};

/**
 * HTMLRewriter handler that rewrites <meta property="og:*"> and <title> tags.
 */
class OGMetaRewriter implements HTMLRewriterElementContentHandlers {
  constructor(
    private roomNumber: string,
    private ogUrl: string,
  ) {}

  element(element: Element): void {
    const property = element.getAttribute('property');
    if (property && property in OG_REPLACEMENTS) {
      element.setAttribute('content', OG_REPLACEMENTS[property](this.roomNumber, this.ogUrl));
    }
  }
}

class TitleRewriter implements HTMLRewriterElementContentHandlers {
  private replaced = false;
  constructor(private roomNumber: string) {}

  text(text: Text): void {
    if (!this.replaced) {
      text.replace(`狼人杀房间 ${this.roomNumber}`);
      this.replaced = true;
    } else {
      text.remove();
    }
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;

  // Validate & sanitize room code
  const raw = String(params.roomNumber ?? '').slice(0, MAX_ROOM_CODE_LENGTH);
  // Only allow alphanumeric room codes
  const roomNumber = raw.replace(/[^a-zA-Z0-9]/g, '');
  if (!roomNumber) {
    return context.next();
  }

  const url = new URL(request.url);
  const ogUrl = `${url.origin}/room/${encodeURIComponent(roomNumber)}`;

  // Fetch the SPA index.html from static assets
  const assetResponse = await env.ASSETS.fetch(new URL('/', url.origin));
  if (!assetResponse.ok) {
    return context.next();
  }

  return new HTMLRewriter()
    .on('meta[property]', new OGMetaRewriter(roomNumber, ogUrl))
    .on('title', new TitleRewriter(roomNumber))
    .transform(assetResponse);
};
