/**
 * Complete a WebSocket upgrade only to close it with a typed 4xxx code. Browsers surface a
 * refused upgrade (HTTP 4xx/5xx) as an opaque 1006, which the client treats as a transient drop;
 * a completed-then-closed socket carries the terminal reason instead.
 */

import type { RealtimeCloseCode } from '@game-judge/game-engine/platform/realtime/closeCodes';

export function rejectUpgrade(code: RealtimeCloseCode, reason: string): Response {
  const pair = new WebSocketPair();
  pair[1].accept();
  pair[1].close(code, reason);
  return new Response(null, { status: 101, webSocket: pair[0] });
}
