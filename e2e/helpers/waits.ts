import { expect, Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';

const ROOM_STATUS_TEXT = {
  live: '🟢 已连接',
  disconnected: '🔴 连接断开',
  connecting: '⏳ 连接中...',
  forceSync: '强制同步',
} as const;

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
    const liveIndicator = page.getByText(ROOM_STATUS_TEXT.live, { exact: true });
    if (await liveIndicator.isVisible().catch(() => false)) {
      return;
    }

    const disconnectedIndicator = page.getByText(ROOM_STATUS_TEXT.disconnected, { exact: true });
    const connectingIndicator = page.getByText(ROOM_STATUS_TEXT.connecting, { exact: true });
    const isNotLive =
      (await disconnectedIndicator.isVisible().catch(() => false)) ||
      (await connectingIndicator.isVisible().catch(() => false));
    if (isNotLive) {
      const forceSyncBtn = page.locator(`[data-testid="${TESTIDS.forceSyncButton}"]`);
      if (await forceSyncBtn.isVisible().catch(() => false)) {
        await forceSyncBtn.click();
        // Wait a moment for the sync to take effect
        await page.waitForTimeout(1000);
      }
    }

    await page.waitForTimeout(pollInterval);
  }

  throw new Error(`[waitForRoomScreenReady] Joiner not live after ${liveTimeoutMs}ms`);
}

/**
 * Wait for RoomScreen to be ready.
 *
 * For host: Just waits for room header "房间 XXXX" to be visible.
 * For joiner: Also waits for connection status to be "🟢 已连接",
 *             with automatic retry via "强制同步" if disconnected.
 *
 * @param page - Playwright page
 * @param opts - Options for role, retries, and timeouts
 */
export async function waitForRoomScreenReady(
  page: Page,
  opts: WaitForRoomScreenReadyOptions = {},
): Promise<void> {
  const { role = 'host', maxRetries = 3, liveTimeoutMs = 20000 } = opts;

  await waitForRoomHeaderOrRetry(page, maxRetries);

  // Step 2: For joiner only, wait for live status
  if (role !== 'joiner') {
    return; // Host doesn't have connection status bar
  }

  await waitForJoinerLive(page, liveTimeoutMs);
}
