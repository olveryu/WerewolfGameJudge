import type { Page } from '@playwright/test';
import { expect, test, TestInfo } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { ensureAnonLogin, enterRoomCodeViaNumPad } from '../helpers/home';
import { setupNPlayerGame } from '../helpers/multi-player';
import { gotoWithRetry } from '../helpers/ui';
import { waitForRoomScreenReady } from '../helpers/waits';
import { runNightFlowLoop } from '../pages/NightFlowPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Rejoin E2E Tests (Host & Player)
 *
 * Verifies that both host and player can:
 * 1. Rejoin an ongoing game after page reload (simulates browser close/reopen)
 * 2. Continue and complete the first night after rejoin
 *
 * Host rejoin path:  reload → home → "返回上局" → RoomScreen → (ContinueGameOverlay) → night completes
 * Player rejoin path: reload → home → "进入房间" → enter code → RoomScreen → night completes
 *
 * Strategy:
 * - Run a few iterations of the night flow loop BEFORE reload to advance the night past the
 *   audio-gate phase. This ensures the game state has at least one action submitted.
 * - Then reload the page, re-enter the room, and run the night flow loop again to completion.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for night flow to reach a point where at least one action prompt
 * or night indicator is visible, meaning the night is actively running.
 */
async function waitForNightActive(pages: Page[], maxWaitMs = 15_000): Promise<void> {
  const startTime = Date.now();
  const indicators = ['请睁眼', '请行动', '狼人', '请选择', '投票空刀', '不使用技能'];

  while (Date.now() - startTime < maxWaitMs) {
    for (const page of pages) {
      for (const text of indicators) {
        const visible = await page
          .getByText(text)
          .first()
          .isVisible({ timeout: 200 })
          .catch(() => false);
        if (visible) return;
      }
    }
    await pages[0].waitForTimeout(500);
  }
  // Don't throw — night might still be progressing even without these texts
  console.log('[waitForNightActive] No night indicator found within timeout, continuing anyway');
}

/**
 * Dismiss the "继续游戏" overlay if it appears.
 * Returns true if the overlay was visible and dismissed.
 */
async function dismissContinueOverlayIfVisible(page: Page): Promise<boolean> {
  const continueBtn = page.locator('[data-testid="continue-game-button"]');
  const isVisible = await continueBtn.isVisible({ timeout: 5_000 }).catch(() => false);

  if (isVisible) {
    console.log('[rejoin] "继续游戏" overlay detected, clicking...');
    await continueBtn.click();
    await continueBtn.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Run a few iterations of the night flow loop — enough to advance past the initial
 * audio-gate phase and submit at least one wolf vote, but stop early (don't finish).
 * This ensures the game has meaningful state cached before we simulate rejoin.
 *
 * We use a small maxIterations and catch the "did not complete" error,
 * since we EXPECT the night to NOT finish in this mini-run.
 */
async function advanceNightPartially(pages: Page[], testInfo: TestInfo): Promise<void> {
  try {
    await runNightFlowLoop(pages, testInfo, {
      maxIterations: 25,
      screenshotInterval: 25,
    });
    // If night completes in 25 iterations, that's fine too (very fast 2p game)
    console.log('[rejoin] Night completed during partial advance (fast game)');
  } catch {
    // Expected — night didn't complete in 25 iterations, which is fine
    console.log('[rejoin] Partial advance done (night still in progress)');
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Rejoin during ongoing game', () => {
  test('host rejoin: reload mid-night → 返回上局 → complete night', async ({
    browser,
  }, testInfo) => {
    // Step 1: Setup 2-player game and start night
    const { fixture, roomNumber, hostPage } = await setupNPlayerGame(browser, {
      playerCount: 2,
      configureTemplate: async (config) => config.configure2Player(),
    });

    try {
      // Step 2: Advance night partially to get past initial audio phase
      await advanceNightPartially(fixture.pages, testInfo);

      await hostPage
        .screenshot()
        .then((s) =>
          testInfo.attach('host-rejoin-01-pre-reload.png', { body: s, contentType: 'image/png' }),
        );

      // Step 3: Simulate host page close & reopen (navigate to home)
      console.log('[rejoin] Host reloading page...');
      await gotoWithRetry(hostPage, '/');
      await ensureAnonLogin(hostPage);

      // Step 4: Click "返回上局" to rejoin
      const returnBtn = hostPage.locator('[data-testid="home-return-last-game-button"]');
      await expect(returnBtn).toBeVisible({ timeout: 5_000 });
      await returnBtn.click();
      await waitForRoomScreenReady(hostPage, { role: 'host' });

      await hostPage
        .screenshot()
        .then((s) =>
          testInfo.attach('host-rejoin-02-back-in-room.png', { body: s, contentType: 'image/png' }),
        );

      // Step 5: Handle "继续游戏" overlay if present
      const hadOverlay = await dismissContinueOverlayIfVisible(hostPage);
      console.log(
        `[rejoin] ContinueGameOverlay was ${hadOverlay ? 'shown and dismissed' : 'not shown'}`,
      );

      // Step 6: Continue night flow to completion
      const nightResult = await runNightFlowLoop(fixture.pages, testInfo, {
        maxIterations: 80,
        screenshotInterval: 10,
      });

      // Step 7: Verify night ended
      const room = new RoomPage(hostPage);
      const hasLastNightBtn = await room.isLastNightInfoVisible();
      const nightEnded =
        hasLastNightBtn ||
        nightResult.resultText.includes('平安夜') ||
        nightResult.resultText.includes('死亡');

      expect(nightEnded, 'Night should complete after host rejoin').toBe(true);

      await room.screenshot(testInfo, 'host-rejoin-03-night-ended.png');

      await testInfo.attach('host-rejoin.txt', {
        body: [
          `Room: ${roomNumber}`,
          `ContinueGameOverlay shown: ${hadOverlay}`,
          `Result: ${nightResult.resultText}`,
          `Turns: ${nightResult.turnLog.join(' → ')}`,
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      await closeAll(fixture);
    }
  });

  test('player rejoin: reload mid-night → enter room code → complete night', async ({
    browser,
  }, testInfo) => {
    // Step 1: Setup 2-player game and start night
    const { fixture, roomNumber, hostPage, joinerPages } = await setupNPlayerGame(browser, {
      playerCount: 2,
      configureTemplate: async (config) => config.configure2Player(),
    });
    const joinerPage = joinerPages[0];

    try {
      // Step 2: Advance night partially
      await advanceNightPartially(fixture.pages, testInfo);

      await joinerPage.screenshot().then((s) =>
        testInfo.attach('player-rejoin-01-pre-reload.png', {
          body: s,
          contentType: 'image/png',
        }),
      );

      // Step 3: Simulate player page close & reopen (navigate to home)
      console.log('[rejoin] Player reloading page...');
      await gotoWithRetry(joinerPage, '/');
      await ensureAnonLogin(joinerPage);

      // Step 4: Re-enter room via room code
      const enterRoomBtn = joinerPage.locator('[data-testid="home-enter-room-button"]');
      await expect(enterRoomBtn).toBeVisible({ timeout: 5_000 });
      await enterRoomBtn.click();
      await expect(joinerPage.getByText('加入房间')).toBeVisible({ timeout: 5_000 });
      await enterRoomCodeViaNumPad(joinerPage, roomNumber);
      await joinerPage.getByText('加入', { exact: true }).click();
      await waitForRoomScreenReady(joinerPage, { role: 'joiner' });

      await joinerPage.screenshot().then((s) =>
        testInfo.attach('player-rejoin-02-back-in-room.png', {
          body: s,
          contentType: 'image/png',
        }),
      );

      // Step 5: Verify player is back on room screen
      const roomScreenRoot = joinerPage.locator('[data-testid="room-screen-root"]');
      await expect(roomScreenRoot).toBeVisible({ timeout: 5_000 });

      // Step 6: Continue night flow to completion
      const nightResult = await runNightFlowLoop(fixture.pages, testInfo, {
        maxIterations: 80,
        screenshotInterval: 10,
      });

      // Step 7: Verify night ended
      const room = new RoomPage(hostPage);
      const hasLastNightBtn = await room.isLastNightInfoVisible();
      const nightEnded =
        hasLastNightBtn ||
        nightResult.resultText.includes('平安夜') ||
        nightResult.resultText.includes('死亡');

      expect(nightEnded, 'Night should complete after player rejoin').toBe(true);

      await room.screenshot(testInfo, 'player-rejoin-03-night-ended.png');

      await testInfo.attach('player-rejoin.txt', {
        body: [
          `Room: ${roomNumber}`,
          `Result: ${nightResult.resultText}`,
          `Turns: ${nightResult.turnLog.join(' → ')}`,
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      await closeAll(fixture);
    }
  });
});
