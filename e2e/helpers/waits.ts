import { expect, Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';

/** Text shown in the disconnected banner */
const DISCONNECTED_BANNER_TEXT = '连接断开，正在重连...';

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

  // Step 2: For joiner only, wait for live status
  if (role !== 'joiner') {
    return; // Host doesn't have connection status bar
  }

  await waitForJoinerLive(page, liveTimeoutMs);
}
