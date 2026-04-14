import { expect, Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';

/** Text shown in the disconnected banner */
export const DISCONNECTED_BANNER_TEXT = '连接断开，正在重连';

// ---------------------------------------------------------------------------
// Disconnect recovery (used inside poll loops)
// ---------------------------------------------------------------------------

/** Max time to wait for SDK auto-reconnect before forcing a page reload. */
const RECONNECT_TIMEOUT_MS = 30_000;

/**
 * Check if a page shows the disconnected banner.
 * Returns false for pages not on the room screen (banner component returns null).
 */
async function isDisconnected(page: Page): Promise<boolean> {
  return page
    .getByText(DISCONNECTED_BANNER_TEXT, { exact: true })
    .isVisible()
    .catch(() => false);
}

/**
 * Wait for a single page to reconnect (banner disappears).
 * If the banner doesn't disappear within `RECONNECT_TIMEOUT_MS`, reload the page
 * to trigger DB recovery, then wait for room screen ready.
 */
async function waitForPageReconnect(page: Page): Promise<void> {
  const start = Date.now();
  const pollInterval = 500;

  while (Date.now() - start < RECONNECT_TIMEOUT_MS) {
    if (!(await isDisconnected(page))) return;
    await page.waitForTimeout(pollInterval);
  }

  // SDK reconnect failed — force reload for DB recovery
  await page.reload();
  await waitForRoomScreenReady(page, { role: 'joiner', liveTimeoutMs: 30_000 });
}

/**
 * Ensure all pages are connected. If any page shows the disconnected banner,
 * pause and wait for reconnection before returning.
 *
 * Designed to be called inside poll loops (pollUntil, waitForRoleTurn, etc.)
 * with near-zero overhead when all pages are connected (~1ms per page).
 */
export async function ensureConnected(pages: Page[]): Promise<void> {
  const disconnected: Page[] = [];
  for (const page of pages) {
    if (await isDisconnected(page)) {
      disconnected.push(page);
    }
  }
  if (disconnected.length === 0) return;

  // Wait for all disconnected pages to reconnect in parallel
  await Promise.all(disconnected.map((p) => waitForPageReconnect(p)));
}

/**
 * Options for waitForRoomScreenReady
 */
interface WaitForRoomScreenReadyOptions {
  /** Role of the page: 'host' or 'joiner'. Host skips live check. */
  role?: 'host' | 'joiner';
  /** Max retries for room header + retry button flow */
  maxRetries?: number;
  /** Timeout for joiner to reach live state (ms) */
  liveTimeoutMs?: number;
}

async function waitForRoomHeaderOrRetry(page: Page, maxRetries: number): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await expect(page.locator(`[data-testid="${TESTIDS.roomHeader}"]`)).toBeVisible({
        timeout: 10000,
      });
      return;
    } catch {
      const retryBtn = page.getByText('重试');
      if (
        await retryBtn
          .waitFor({ state: 'visible', timeout: 1000 })
          .then(() => true)
          .catch(() => false)
      ) {
        await retryBtn.click();
        continue;
      }
      if (attempt === maxRetries - 1) {
        throw new Error(
          `[waitForRoomScreenReady] Room screen not ready after ${maxRetries} attempts`,
        );
      }
    }
  }
}

async function waitForJoinerLive(page: Page, liveTimeoutMs: number): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 300;

  while (Date.now() - startTime < liveTimeoutMs) {
    // Live = disconnected banner is not visible (component returns null)
    const disconnectedBanner = page.getByText(DISCONNECTED_BANNER_TEXT, { exact: true });
    if (!(await disconnectedBanner.isVisible().catch(() => false))) {
      return;
    }

    await page.waitForTimeout(pollInterval);
  }

  throw new Error(`[waitForRoomScreenReady] Joiner not live after ${liveTimeoutMs}ms`);
}

/**
 * Wait for RoomScreen to be ready.
 *
 * For host: Just waits for room header "房间 XXXX" to be visible.
 * For joiner: Also waits for the disconnected banner to disappear
 *             (i.e. connection is live and banner is not rendered).
 *
 * @param page - Playwright page
 * @param opts - Options for role, retries, and timeouts
 */
export async function waitForRoomScreenReady(
  page: Page,
  opts: WaitForRoomScreenReadyOptions = {},
): Promise<void> {
  const { role = 'host', maxRetries = 3, liveTimeoutMs = 30000 } = opts;

  await waitForRoomHeaderOrRetry(page, maxRetries);

  // Host: dismiss auto-shown QR invite modal (if visible)
  if (role === 'host') {
    const qrOverlay = page.locator(`[data-testid="${TESTIDS.qrCodeModal}"]`);
    const visible = await qrOverlay
      .waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (visible) {
      await qrOverlay.click({ position: { x: 5, y: 5 }, force: true });
      await qrOverlay.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
    return;
  }

  await waitForJoinerLive(page, liveTimeoutMs);
}
