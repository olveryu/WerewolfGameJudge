import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { setupNPlayerGame } from '../helpers/multi-player';
import { waitForRoomScreenReady } from '../helpers/waits';
import { runNightFlowLoop } from '../pages/NightFlowPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * DB Recovery E2E Tests
 *
 * Verifies that a player can recover game state from DB after a network
 * interruption (simulated via Playwright's `context.setOffline(true/false)`).
 *
 * Flow:
 * 1. Setup 2-player game, start night
 * 2. Advance night partially (wolf votes, etc.)
 * 3. Simulate player network disconnect (setOffline)
 * 4. Wait, then restore network
 * 5. Player should auto-recover state from DB (fetchStateFromDB)
 * 6. Night should complete normally
 *
 * This is distinct from rejoin.spec.ts which tests full page reload.
 * This test exercises the auto-heal path: network drops → WebSocket reconnects
 * → stale state detected → fetchStateFromDB → state restored.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test.describe('DB state recovery after network interruption', () => {
  test('player recovers state after temporary network loss', async ({ browser }, testInfo) => {
    // Step 1: Setup 2-player game and start night
    const { fixture, roomNumber, hostPage, joinerPages } = await setupNPlayerGame(browser, {
      playerCount: 2,
      configureTemplate: async (config) => config.configure2Player(),
    });
    const joinerPage = joinerPages[0];
    const joinerContext = fixture.contexts[1]; // joiner's BrowserContext

    try {
      // Step 2: Advance night partially — submit some actions
      try {
        await runNightFlowLoop(fixture.pages, testInfo, {
          maxIterations: 25,
          screenshotInterval: 25,
        });
        // If night finished in 25 iterations, skip the disconnect test —
        // the game is already over. This is rare for 2p but possible.
        const room = new RoomPage(hostPage);
        const hasLastNightBtn = await room.isLastNightInfoVisible();
        if (hasLastNightBtn) {
          return;
        }
      } catch {
        // Expected — night didn't complete yet
      }

      await joinerPage.screenshot().then((s) =>
        testInfo.attach('db-recovery-01-pre-disconnect.png', {
          body: s,
          contentType: 'image/png',
        }),
      );

      // Step 3: Simulate network disconnect on the player
      await joinerContext.setOffline(true);

      // Step 4: Wait for the disconnect to register
      const disconnectedBanner = joinerPage.getByText('连接断开，正在重连...', { exact: true });
      const isDisconnected = await disconnectedBanner
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);

      await joinerPage.screenshot().then((s) =>
        testInfo.attach('db-recovery-02-disconnected.png', {
          body: s,
          contentType: 'image/png',
        }),
      );

      // Step 5: Restore network
      await joinerContext.setOffline(false);

      // Step 6: Wait for reconnection — player should auto-recover from DB
      // waitForRoomScreenReady polls for live status and clicks force-sync if needed
      await waitForRoomScreenReady(joinerPage, { role: 'joiner', liveTimeoutMs: 30_000 });

      await joinerPage.screenshot().then((s) =>
        testInfo.attach('db-recovery-03-reconnected.png', {
          body: s,
          contentType: 'image/png',
        }),
      );

      // Step 7: Continue night flow to completion
      const nightResult = await runNightFlowLoop(fixture.pages, testInfo, {
        maxIterations: 80,
        screenshotInterval: 10,
      });

      // Step 8: Verify night ended
      const room = new RoomPage(hostPage);
      const hasLastNightBtn = await room.isLastNightInfoVisible();
      const nightEnded =
        hasLastNightBtn ||
        nightResult.resultText.includes('平安夜') ||
        nightResult.resultText.includes('死亡');

      expect(nightEnded, 'Night should complete after player DB recovery').toBe(true);

      await room.screenshot(testInfo, 'db-recovery-04-night-ended.png');

      await testInfo.attach('db-recovery-result.txt', {
        body: [
          `Room: ${roomNumber}`,
          `Disconnect indicator shown: ${isDisconnected}`,
          `Result: ${nightResult.resultText}`,
          `Turns: ${nightResult.turnLog.join(' → ')}`,
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      // Ensure network is restored before cleanup
      await joinerContext.setOffline(false).catch(() => {});
      await closeAll(fixture);
    }
  });

  test('both host and player recover after simultaneous offline', async ({ browser }, testInfo) => {
    // Step 1: Setup 2-player game and start night
    const { fixture, roomNumber, hostPage, joinerPages } = await setupNPlayerGame(browser, {
      playerCount: 2,
      configureTemplate: async (config) => config.configure2Player(),
    });
    const joinerPage = joinerPages[0];
    const hostContext = fixture.contexts[0];
    const joinerContext = fixture.contexts[1];

    try {
      // Step 2: Advance night partially — submit some actions
      try {
        await runNightFlowLoop(fixture.pages, testInfo, {
          maxIterations: 25,
          screenshotInterval: 25,
        });
        // If night finished in 25 iterations, skip — game already over
        const room = new RoomPage(hostPage);
        if (await room.isLastNightInfoVisible()) return;
      } catch {
        // Expected — night didn't complete yet
      }

      await test.step('screenshot: pre-disconnect state', async () => {
        await hostPage.screenshot().then((s) =>
          testInfo.attach('dual-offline-01-host-pre.png', {
            body: s,
            contentType: 'image/png',
          }),
        );
        await joinerPage.screenshot().then((s) =>
          testInfo.attach('dual-offline-01-joiner-pre.png', {
            body: s,
            contentType: 'image/png',
          }),
        );
      });

      // Step 3: Disconnect BOTH host and joiner simultaneously
      await test.step('disconnect both host and player', async () => {
        await hostContext.setOffline(true);
        await joinerContext.setOffline(true);

        // Soft check: disconnect banner may take time to appear
        const joinerBanner = joinerPage.getByText('连接断开，正在重连...', { exact: true });
        const joinerSawDisconnect = await joinerBanner
          .waitFor({ state: 'visible', timeout: 15_000 })
          .then(() => true)
          .catch(() => false);

        await hostPage.screenshot().then((s) =>
          testInfo.attach('dual-offline-02-host-disconnected.png', {
            body: s,
            contentType: 'image/png',
          }),
        );
        await joinerPage.screenshot().then((s) =>
          testInfo.attach('dual-offline-02-joiner-disconnected.png', {
            body: s,
            contentType: 'image/png',
          }),
        );

        await testInfo.attach('dual-offline-disconnect-status.txt', {
          body: `Joiner disconnect banner visible: ${joinerSawDisconnect}`,
          contentType: 'text/plain',
        });
      });

      // Step 4: Wait 5s while both are offline
      await test.step('wait 5s while both offline', async () => {
        await hostPage.waitForTimeout(5_000);
      });

      // Step 5: Restore network on both
      await test.step('reconnect both host and player', async () => {
        await hostContext.setOffline(false);
        await joinerContext.setOffline(false);

        // Wait for both to reach live state
        await waitForRoomScreenReady(hostPage, { role: 'host', liveTimeoutMs: 30_000 });
        await waitForRoomScreenReady(joinerPage, { role: 'joiner', liveTimeoutMs: 30_000 });

        await hostPage.screenshot().then((s) =>
          testInfo.attach('dual-offline-03-host-reconnected.png', {
            body: s,
            contentType: 'image/png',
          }),
        );
        await joinerPage.screenshot().then((s) =>
          testInfo.attach('dual-offline-03-joiner-reconnected.png', {
            body: s,
            contentType: 'image/png',
          }),
        );
      });

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

      expect(nightEnded, 'Night should complete after dual offline recovery').toBe(true);

      await room.screenshot(testInfo, 'dual-offline-04-night-ended.png');

      await testInfo.attach('dual-offline-result.txt', {
        body: [
          `Room: ${roomNumber}`,
          `Result: ${nightResult.resultText}`,
          `Turns: ${nightResult.turnLog.join(' → ')}`,
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      // Ensure network is restored before cleanup
      await hostContext.setOffline(false).catch(() => {});
      await joinerContext.setOffline(false).catch(() => {});
      await closeAll(fixture);
    }
  });
});
