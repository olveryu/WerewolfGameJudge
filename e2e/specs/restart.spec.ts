import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { setupNPlayerGame, viewRoleWithRetry } from '../helpers/multi-player';
import { runNightFlowLoop } from '../pages/NightFlowPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Restart & Settings E2E Tests
 *
 * - restart: After first night → 重新开始 → second night completes
 * - settings: Template change via settings affects seat count
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test.describe('Restart & Settings', () => {
  test('restart after first night completes successfully', async ({ browser }, testInfo) => {
    const { fixture, hostPage } = await setupNPlayerGame(browser, {
      playerCount: 2,
      configureTemplate: async (config) => config.configure2Player(),
    });

    try {
      // Run first night
      const firstNight = await runNightFlowLoop(fixture.pages, testInfo, {
        maxIterations: 60,
        screenshotInterval: 10,
      });

      const room = new RoomPage(hostPage);
      await room.screenshot(testInfo, 'restart-01-first-night-done.png');

      // Restart
      await room.restart();
      await room.screenshot(testInfo, 'restart-02-after-restart.png');

      // Wait for both pages to stabilize (seat grid visible)
      for (const page of fixture.pages) {
        await expect(page.locator('[data-testid^="seat-tile-pressable-"]').first()).toBeVisible({
          timeout: 5000,
        });
      }

      // Re-run the full game setup: prepare → view → start
      await room.prepareRoles();

      for (const page of fixture.pages) {
        await viewRoleWithRetry(page);
      }

      await room.startGame();

      // Run second night
      const secondNight = await runNightFlowLoop(fixture.pages, testInfo, {
        maxIterations: 60,
        screenshotInterval: 10,
      });

      await room.screenshot(testInfo, 'restart-03-second-night-done.png');

      const hasLastNight = await room.isLastNightInfoVisible();
      const secondNightEnded =
        hasLastNight ||
        secondNight.resultText.includes('平安夜') ||
        secondNight.resultText.includes('死亡');

      expect(secondNightEnded, 'Second night after restart should complete').toBe(true);

      await testInfo.attach('restart.txt', {
        body: [
          '=== FIRST NIGHT ===',
          `Result: ${firstNight.resultText}`,
          `Turns: ${firstNight.turnLog.join(' → ')}`,
          '',
          '=== SECOND NIGHT ===',
          `Result: ${secondNight.resultText}`,
          `Turns: ${secondNight.turnLog.join(' → ')}`,
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      await closeAll(fixture);
    }
  });

  test('settings change affects seat count', async ({ browser }, testInfo) => {
    // Create with 2-player, then change to 3-player via settings
    const { fixture, hostPage } = await setupNPlayerGame(browser, {
      playerCount: 1, // solo host for settings test
      configureTemplate: async (config) => config.configure2Player(),
      startGame: false,
    });

    try {
      const room = new RoomPage(hostPage);

      // Verify initial seat count
      const initialSeats = await room.getSeatCount();
      expect(initialSeats).toBe(2);

      // Open settings
      await room.openSettings();

      // Wait for save mode (edit config)
      const { ConfigPage } = await import('../pages/ConfigPage');
      const config = new ConfigPage(hostPage);
      await config.waitForSaveMode();

      // Add 1 villager to go from 2 → 3 players
      // Villager is a bulk-stepper role; use increase stepper
      await config.increaseStepper('villager', 1);

      // Save
      await config.clickSave();
      await room.waitForReady('host');

      // Verify seat count changed
      const updatedSeats = await room.getSeatCount();
      expect(updatedSeats).toBe(3);

      await room.screenshot(testInfo, 'settings-seat-count.png');

      await testInfo.attach('settings.txt', {
        body: [
          `Initial seats: ${initialSeats}`,
          `After settings change: ${updatedSeats}`,
          'Change: +1 villager (villager1)',
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      await closeAll(fixture);
    }
  });
});
