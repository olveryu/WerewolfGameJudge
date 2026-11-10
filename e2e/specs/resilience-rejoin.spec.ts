import type { Page } from '@playwright/test';
import { expect, test, type TestInfo } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll } from '../fixtures/app.fixture';
import { pressAlertButton } from '../helpers/alerts';
import { ensureAnonLogin } from '../helpers/home';
import { setupNPlayerGame } from '../helpers/multi-player';
import { gotoWithRetry } from '../helpers/ui';
import { waitForRoomScreenReady } from '../helpers/waits';
import { runNightFlowFor, runNightFlowLoop } from '../pages/NightFlowPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Rejoin E2E Tests (Host & Player)
 *
 * Verifies that both host and player can:
 * 1. Rejoin an ongoing game after page reload (simulates browser close/reopen)
 * 2. Continue and complete the first night after rejoin
 *
 * Host rejoin path:  reload → home → "最近房间" → RoomScreen → (ContinueGameOverlay) → night completes
 * Player rejoin path: reload → home → "进入房间" → enter code → RoomScreen → night completes
 *
 * Strategy:
 * - Run a few iterations of the night flow loop BEFORE reload to advance the night past the
 *   audio-gate phase. This ensures the game state has at least one action submitted.
 * - Then reload the page, re-enter the room, and run the night flow loop again to completion.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

/** Night-drive window before the rejoin; a 2-player night outlasts it. */
const PARTIAL_NIGHT_MS = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Dismiss the "继续游戏" overlay if it appears.
 * Returns true if the overlay was visible and dismissed.
 */
async function dismissContinueOverlayIfVisible(page: Page): Promise<boolean> {
  const isVisible = await page
    .getByTestId(TESTIDS.alertButton(0))
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(
      () => true,
      () => false,
    );
  if (!isVisible) return false;
  await pressAlertButton(page, { title: '游戏已恢复', buttonIndex: 0, buttonLabel: '继续游戏' });
  return true;
}

/**
 * Drive the night for a short window — enough to advance past the initial
 * audio gate and act on the first step, but not to finish — so the game has
 * meaningful state before the rejoin.
 */
async function advanceNightPartially(pages: Page[], testInfo: TestInfo): Promise<void> {
  const result = await runNightFlowFor(pages, testInfo, {
    timeoutMs: PARTIAL_NIGHT_MS,
    screenshotInterval: 25,
  });
  expect(result, 'The night must still be running before the rejoin').toBeNull();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Resilience — Rejoin during ongoing game', () => {
  test('host rejoin: reload mid-night → 最近房间 → complete night', async ({
    browser,
  }, testInfo) => {
    // Step 1: Setup 2-player game and start night
    const { fixture, roomCode, hostPage } = await setupNPlayerGame(browser, {
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
      await gotoWithRetry(hostPage, '/');
      await ensureAnonLogin(hostPage);

      // Step 4: Click "最近房间" to open recent rooms modal, then click the room
      const returnBtn = hostPage.getByTestId(TESTIDS.homeReturnLastGameButton);
      await expect(returnBtn).toContainText('最近房间', { timeout: 5_000 });
      await returnBtn.click();

      // Wait for recent rooms modal and click the room's join button
      const joinBtn = hostPage.getByTestId(TESTIDS.recentRoomJoin(roomCode));
      await expect(joinBtn).toBeVisible({ timeout: 10_000 });
      await joinBtn.click();
      await waitForRoomScreenReady(hostPage, { role: 'host' });

      await hostPage
        .screenshot()
        .then((s) =>
          testInfo.attach('host-rejoin-02-back-in-room.png', { body: s, contentType: 'image/png' }),
        );

      // Step 5: Handle "继续游戏" overlay if present
      const hadOverlay = await dismissContinueOverlayIfVisible(hostPage);

      // Step 6: Continue night flow to completion
      const nightResult = await runNightFlowLoop(fixture.pages, testInfo, {
        screenshotInterval: 10,
      });

      // Step 7: Verify night ended
      const room = new RoomPage(hostPage);
      expect(['Day', 'Ended'], 'Night should complete after host rejoin').toContain(
        nightResult.phase,
      );

      await room.screenshot(testInfo, 'host-rejoin-03-night-ended.png');

      await testInfo.attach('host-rejoin.txt', {
        body: [
          `Room: ${roomCode}`,
          `ContinueGameOverlay shown: ${hadOverlay}`,
          `Phase: ${nightResult.phase}`,
          `Steps: ${nightResult.stepLog.join(' → ')}`,
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
    const { fixture, roomCode, hostPage, joinerPages } = await setupNPlayerGame(browser, {
      playerCount: 2,
      configureTemplate: async (config) => config.configure2Player(),
    });
    const joinerPage = joinerPages[0]!;

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
      await gotoWithRetry(joinerPage, '/');
      await ensureAnonLogin(joinerPage);

      // Step 4: Re-enter room via room code
      await new RoomPage(joinerPage).joinViaCode(roomCode);

      await joinerPage.screenshot().then((s) =>
        testInfo.attach('player-rejoin-02-back-in-room.png', {
          body: s,
          contentType: 'image/png',
        }),
      );

      // Step 5: Verify player is back on room screen
      const roomScreenRoot = joinerPage.getByTestId(TESTIDS.roomScreenRoot);
      await expect(roomScreenRoot).toBeVisible({ timeout: 5_000 });

      // Step 6: Continue night flow to completion
      const nightResult = await runNightFlowLoop(fixture.pages, testInfo, {
        screenshotInterval: 10,
      });

      // Step 7: Verify night ended
      const room = new RoomPage(hostPage);
      expect(['Day', 'Ended'], 'Night should complete after player rejoin').toContain(
        nightResult.phase,
      );

      await room.screenshot(testInfo, 'player-rejoin-03-night-ended.png');

      await testInfo.attach('player-rejoin.txt', {
        body: [
          `Room: ${roomCode}`,
          `Phase: ${nightResult.phase}`,
          `Steps: ${nightResult.stepLog.join(' → ')}`,
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      await closeAll(fixture);
    }
  });
});
