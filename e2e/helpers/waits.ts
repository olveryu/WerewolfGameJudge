import { expect, type Locator, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';

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
 * Wait until the not-live banner appears; fails when the link stays live.
 * Needed after forcing a disconnect (e.g. setOffline) before acting on the
 * offline state: the socket close is async, and an action dispatched while
 * the client still believes the link is live goes in-flight instead of
 * failing fast.
 */
export async function waitForLinkOffline(
  page: Page,
  timeoutMs = RECONNECT_TIMEOUT_MS,
): Promise<void> {
  await expect(linkStatusBanner(page)).toBeVisible({ timeout: timeoutMs });
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
  /** Timeout for joiner to reach live state (ms) */
  liveTimeoutMs?: number;
}

/**
 * Wait for RoomScreen to be ready.
 *
 * For host: waits for the room header, then closes the share dialog that opens
 *           on its own right after the host creates the room.
 * For joiner: also waits for the disconnected banner to disappear
 *             (i.e. connection is live and banner is not rendered).
 *
 * @param page - Playwright page
 * @param opts - Options for role and timeouts
 */
export async function waitForRoomScreenReady(
  page: Page,
  opts: WaitForRoomScreenReadyOptions = {},
): Promise<void> {
  const { role = 'host', liveTimeoutMs = 30000 } = opts;

  await expect(page.getByTestId(TESTIDS.roomHeader)).toBeVisible({ timeout: 30_000 });

  if (role === 'host') {
    const qrModal = page.getByTestId(TESTIDS.qrCodeModal);
    const visible = await qrModal
      .waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (visible) {
      const close = qrModal.getByTestId(TESTIDS.qrCodeCloseButton);
      await expect(close).toHaveText('关闭');
      await close.click();
      await expect(qrModal).toBeHidden();
    }
    return;
  }

  await waitForLinkLive(page, liveTimeoutMs);
}
