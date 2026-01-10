import { expect, Page } from '@playwright/test';

/**
 * Options for waitForRoomScreenReady
 */
export interface WaitForRoomScreenReadyOptions {
  /** Role of the page: 'host' or 'joiner'. Host skips live check. */
  role?: 'host' | 'joiner';
  /** Max retries for room header + retry button flow */
  maxRetries?: number;
  /** Timeout for joiner to reach live state (ms) */
  liveTimeoutMs?: number;
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
  opts: WaitForRoomScreenReadyOptions = {}
): Promise<void> {
  const { role = 'host', maxRetries = 3, liveTimeoutMs = 20000 } = opts;

  // Step 1: Wait for room header to be visible
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await expect(page.locator(String.raw`text=/房间 \d{4}/`)).toBeVisible({ timeout: 10000 });
      break; // Success
    } catch {
      // Check for retry button (room loading timeout)
      const retryBtn = page.getByText('重试');
      if (await retryBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`[waitForRoomScreenReady] Retry attempt ${attempt + 1}...`);
        await retryBtn.click();
      } else if (attempt === maxRetries - 1) {
        throw new Error(`[waitForRoomScreenReady] Room screen not ready after ${maxRetries} attempts`);
      }
    }
  }

  // Step 2: For joiner only, wait for live status
  if (role !== 'joiner') {
    return; // Host doesn't have connection status bar
  }

  // Joiner must reach "🟢 已连接" status
  const startTime = Date.now();
  const pollInterval = 300; // ms

  while (Date.now() - startTime < liveTimeoutMs) {
    // Check for live status
    const liveIndicator = page.getByText('🟢 已连接', { exact: true });
    if (await liveIndicator.isVisible({ timeout: 100 }).catch(() => false)) {
      console.log('[waitForRoomScreenReady] Joiner is live');
      return;
    }

    // Check for disconnected status - may need to force sync
    const disconnectedIndicator = page.getByText('🔴 连接断开', { exact: true });
    if (await disconnectedIndicator.isVisible({ timeout: 100 }).catch(() => false)) {
      // Try to click force sync button if available
      const forceSyncBtn = page.getByText('强制同步', { exact: true });
      if (await forceSyncBtn.isVisible({ timeout: 100 }).catch(() => false)) {
        console.log('[waitForRoomScreenReady] Clicking force sync...');
        await forceSyncBtn.click();
        // Wait a bit for sync to start
        await page.waitForTimeout(500);
      }
      // If "同步中" is visible, just wait
    }

    // For connecting/syncing states, just wait
    // "⏳ 连接中..." or "🔄 同步中..." - continue polling
    await page.waitForTimeout(pollInterval);
  }

  // Timeout - joiner not live
  throw new Error(`[waitForRoomScreenReady] Joiner not live after ${liveTimeoutMs}ms`);
}
