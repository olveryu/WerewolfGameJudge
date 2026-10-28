/**
 * Network / lifecycle fault injection for resilience specs.
 *
 * Every helper here produces a real condition the RoomLink reducer reacts to:
 * - `setOffline` cuts the browser network (socket dies, `online` flips).
 * - `setPageHidden` drives `document.visibilityState` + `visibilitychange`, the
 *   same signals PlatformEnvironment listens to on web.
 * - `dropRoomSockets` asks the E2E Worker to close every room socket with a
 *   code, as a deploy or edge restart would.
 */
import type { BrowserContext, Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';

/** wrangler dev --local, see playwright.config.ts webServer[API]. */
const LOCAL_CF_API_URL = 'http://127.0.0.1:8787';

export async function setOffline(context: BrowserContext, offline: boolean): Promise<void> {
  await context.setOffline(offline);
}

/**
 * Emulate backgrounding/foregrounding the tab. Overrides `document.visibilityState`
 * (read-only in browsers) and dispatches `visibilitychange`; `pageshow`/`focus` are
 * not involved, matching a tab switch rather than a navigation.
 */
export async function setPageHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (isHidden ? 'hidden' : 'visible'),
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => isHidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

/** Close every socket of a room on the server with a given close code. */
export async function dropRoomSockets(
  page: Page,
  roomCode: string,
  options: { code: number; reason: string },
): Promise<number> {
  const url = new URL(`/e2e/rooms/${encodeURIComponent(roomCode)}/close-sockets`, LOCAL_CF_API_URL);
  url.searchParams.set('code', String(options.code));
  url.searchParams.set('reason', options.reason);
  const response = await page.request.post(url.toString());
  if (!response.ok()) {
    throw new Error(`dropRoomSockets ${roomCode} failed: HTTP ${response.status()}`);
  }
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('closed' in body)) {
    throw new Error('dropRoomSockets: unexpected response body');
  }
  const closed = body.closed;
  if (typeof closed !== 'number') throw new Error('dropRoomSockets: closed must be a number');
  return closed;
}

/** The seat-level offline dot other players see for `seat`. */
export function seatOfflineDot(page: Page, seat: number) {
  return page.getByTestId(TESTIDS.seatOfflineDot(seat));
}
