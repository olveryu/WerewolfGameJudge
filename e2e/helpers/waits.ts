import { expect, type Locator, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';

/** Max time to wait for the link to return to live after a disconnect. */
const RECONNECT_TIMEOUT_MS = 30_000;

/** The not-live banner; absent while the link is live (even with pending durable commands). */
export function linkStatusBanner(page: Page): Locator {
  return page.getByTestId(TESTIDS.connectionStatusContainer);
}

/**
 * Whether a page's room link is not live. Pages that are not on the room screen
 * have no banner and read as connected.
 */
export async function isDisconnected(page: Page): Promise<boolean> {
  return linkStatusBanner(page)
    .isVisible()
    .catch(() => false);
}

/** Wait until the not-live banner is gone; fails when the link does not recover in time. */
export async function waitForLinkLive(page: Page, timeoutMs = RECONNECT_TIMEOUT_MS): Promise<void> {
  await expect(linkStatusBanner(page)).toBeHidden({ timeout: timeoutMs });
}

/**
 * Ensure all pages are connected. If any page shows the not-live banner, wait
 * for its link to recover before returning.
 *
 * Designed to be called inside poll loops (pollUntil, waitForRoleTurn, etc.)
 * with near-zero overhead when all pages are connected (~1ms per page).
 */
export async function ensureConnected(pages: Page[]): Promise<void> {
  const disconnected: Page[] = [];
  for (const page of pages) {
    if (await isDisconnected(page)) disconnected.push(page);
  }
  if (disconnected.length === 0) return;
  await Promise.all(disconnected.map((page) => waitForLinkLive(page)));
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
    const qrModal = page.locator(`[data-testid="${TESTIDS.qrCodeModal}"]`);
    const visible = await qrModal
      .waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (visible) {
      await qrModal.getByText('关闭', { exact: true }).click();
      await expect(qrModal).toBeHidden();
    }
    return;
  }

  await waitForLinkLive(page, liveTimeoutMs);
}
