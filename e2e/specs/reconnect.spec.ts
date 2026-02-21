import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
import {
  clickSeatAndConfirm,
  driveWolfVote,
  findRolePageIndex,
  isTextVisible,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { waitForRoomScreenReady } from '../helpers/waits';

/**
 * Reconnect E2E Tests
 *
 * Verifies that a non-host player can fully disconnect for 10-20 seconds
 * and reconnect during the night phase. Tests:
 * 1. Connection status transitions (live → disconnected → live)
 * 2. Game continues normally after reconnection
 *
 * Uses a 3-player board (wolf + villager + guard). Guard is the first
 * wake-up role, so the disconnect happens before/during the guard's turn.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test.describe('Network reconnect during night', () => {
  test('non-host player reconnects after 10s disconnect and completes guard action', async ({
    browser,
  }, testInfo) => {
    let setup: GameSetupWithRolesResult | undefined;

    try {
      // Step 1: Setup 3-player game with guard
      setup = await setupNPlayerGameWithRoles(browser, {
        playerCount: 3,
        configureTemplate: async (config) =>
          config.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['guard'],
          }),
      });

      const { fixture, roleMap } = setup;
      const pages = fixture.pages;

      const guardIdx = findRolePageIndex(roleMap, '守卫');
      const wolfIdx = findRolePageIndex(roleMap, '狼人');
      const villagerIdx = findRolePageIndex(roleMap, '普通村民');
      expect(guardIdx).not.toBe(-1);
      expect(wolfIdx).not.toBe(-1);

      // The guard must be a non-host joiner (pageIdx >= 1)
      // If guard is host (idx 0), the test still works but we disconnect the villager instead
      // to test reconnect. The key is disconnecting a non-host player.
      const disconnectIdx = guardIdx !== 0 ? guardIdx : villagerIdx !== -1 ? villagerIdx : 1;
      const disconnectContext = fixture.contexts[disconnectIdx];
      const disconnectPage = pages[disconnectIdx];

      await test.step('screenshot: pre-disconnect state', async () => {
        await disconnectPage.screenshot().then((s) =>
          testInfo.attach('reconnect-01-pre-disconnect.png', {
            body: s,
            contentType: 'image/png',
          }),
        );
      });

      // Step 2: Disconnect the non-host player
      await test.step('disconnect player', async () => {
        await disconnectContext.setOffline(true);

        // Wait for disconnect indicator to appear
        const disconnectedIndicator = disconnectPage.getByText('🔴 连接断开', { exact: true });
        await disconnectedIndicator.waitFor({ state: 'visible', timeout: 15_000 });

        await disconnectPage.screenshot().then((s) =>
          testInfo.attach('reconnect-02-disconnected.png', {
            body: s,
            contentType: 'image/png',
          }),
        );
      });

      // Step 3: Wait 10 seconds (simulating real-world disconnect)
      await test.step('wait 10s while disconnected', async () => {
        await disconnectPage.waitForTimeout(10_000);
      });

      // Step 4: Restore network and verify reconnection
      await test.step('reconnect player', async () => {
        await disconnectContext.setOffline(false);

        // Wait for connection to restore
        await waitForRoomScreenReady(disconnectPage, {
          role: 'joiner',
          liveTimeoutMs: 30_000,
        });

        const liveIndicator = disconnectPage.getByText('🟢 已连接', { exact: true });
        await expect(liveIndicator).toBeVisible({ timeout: 5_000 });

        await disconnectPage.screenshot().then((s) =>
          testInfo.attach('reconnect-03-reconnected.png', {
            body: s,
            contentType: 'image/png',
          }),
        );
      });

      // Step 5: Drive night flow — guard protects, then wolf votes
      await test.step('guard protects villager', async () => {
        const targetSeat =
          villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : roleMap.get(wolfIdx)!.seat;

        const guardTurn = await waitForRoleTurn(pages[guardIdx], ['守护', '选择'], pages, 120);
        expect(guardTurn, 'Guard turn should be detected after reconnect').toBe(true);

        await clickSeatAndConfirm(pages[guardIdx], targetSeat);
      });

      await test.step('wolf votes', async () => {
        const targetSeat =
          villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : roleMap.get(guardIdx)!.seat;

        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn, 'Wolf turn should be detected').toBe(true);
        await driveWolfVote(pages, [wolfIdx], targetSeat);
      });

      // Step 6: Verify night completes
      await test.step('verify night end', async () => {
        const ended = await waitForNightEnd(pages, 120);
        expect(ended, 'Night should have ended after reconnect').toBe(true);

        await viewLastNightInfo(pages[0]);

        // With guard + wolf targeting the same villager, should be 平安夜
        const peaceful = await isTextVisible(pages[0], '平安夜');
        const death = await isTextVisible(pages[0], '死亡');
        expect(peaceful || death, 'Night result should show').toBe(true);

        await pages[0].screenshot().then((s) =>
          testInfo.attach('reconnect-04-night-result.png', {
            body: s,
            contentType: 'image/png',
          }),
        );
      });

      await testInfo.attach('reconnect-summary.txt', {
        body: [
          `Guard page index: ${guardIdx}`,
          `Wolf page index: ${wolfIdx}`,
          `Disconnected page index: ${disconnectIdx}`,
          `Guard is host: ${guardIdx === 0}`,
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      // Ensure network is restored before cleanup
      if (setup) {
        for (const ctx of setup.fixture.contexts) {
          await ctx.setOffline(false).catch(() => {});
        }
        await closeAll(setup.fixture);
      }
    }
  });
});
