/**
 * Cloudflare Pages Function — /room/:roomCode dynamic OG preview.
 *
 * For all /room/:roomCode requests, uses HTMLRewriter to replace the
 * OG meta and <title> in the SPA index.html with versions containing the dynamic room code.
 * Does not rely on UA detection; all clients (crawlers/browsers) receive correct OG tags,
 * while browser-side JS takes over SPA routing normally.
 * No business logic or database queries.
 */

import { isRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

/** OG property → replacement content value mapping. */
const OG_REPLACEMENTS: Record<string, (roomCode: string, ogUrl: string) => string> = {
  'og:title': (roomCode) => `游戏房间 ${roomCode} · 加入游戏`,
  'og:description': () => '点击链接加入游戏房间',
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
      text.replace(`游戏房间 ${this.roomCode}`);
      this.replaced = true;
    } else {
      text.remove();
    }
  }
}

export const onRequest: PagesFunction<PagesBindings> = async (context) => {
  const { request, params, env } = context;

  const roomCode = String(params.roomCode ?? '');
  if (!isRoomCode(roomCode)) {
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
