import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { setupNPlayerGame } from '../helpers/multi-player';
import { waitForHostAudioAck } from '../helpers/night-driver';
import { runNightFlowLoop } from '../pages/NightFlowPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Restart & Settings E2E Tests
 *
 * - restart: After first night -> restart -> second night completes
 * - settings: Template change via settings affects seat count
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test.describe('Resilience — Restart & Settings', () => {
  test('restart after first night completes successfully', async ({ browser }, testInfo) => {
    const { fixture, hostPage, hostCommands } = await setupNPlayerGame(browser, {
      playerCount: 2,
      configureTemplate: async (config) => config.configure2Player(),
    });

    try {
      // Run first night
      const firstNight = await runNightFlowLoop(fixture.pages, testInfo, {
        screenshotInterval: 10,
      });

      const room = new RoomPage(hostPage);
      await room.screenshot(testInfo, 'restart-01-first-night-done.png');

      // The phase flip queued the night-end announcement in the same
      // state write, so it is still playing now — and the engine
      // rejects terminal commands while audio plays, with no client
      // retry. Wait for the host's audio ack (the server-side gate
      // lifting) before clicking, like a host who waits out the
      // announcement.
      await waitForHostAudioAck(hostCommands);

      // Return to the lobby (terminal flow), then set the game up again
      await room.returnToLobby();
      await room.screenshot(testInfo, 'restart-02-after-restart.png');

      // Wait for both pages to stabilize (seat grid visible)
      for (const page of fixture.pages) {
        await expect(new RoomPage(page).getSeatTile(0)).toBeVisible({ timeout: 5000 });
      }

      // Re-run the full game setup: prepare -> view -> start
      await room.prepareRoles();

      for (const page of fixture.pages) {
        await new RoomPage(page).viewRole();
      }

      await room.startGame();

      // Run second night
      const secondNight = await runNightFlowLoop(fixture.pages, testInfo, {
        screenshotInterval: 10,
      });

      await room.screenshot(testInfo, 'restart-03-second-night-done.png');

      expect(['Day', 'Ended'], 'Second night after restart should complete').toContain(
        secondNight.phase,
      );

      await testInfo.attach('restart.txt', {
        body: [
          '=== FIRST NIGHT ===',
          `Phase: ${firstNight.phase}`,
          `Steps: ${firstNight.stepLog.join(' → ')}`,
          '',
          '=== SECOND NIGHT ===',
          `Phase: ${secondNight.phase}`,
          `Steps: ${secondNight.stepLog.join(' → ')}`,
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
      await room.expectSeatCount(2);

      // Open settings
      await room.openSettings();

      // Wait for save mode (edit config)
      const { ConfigPage } = await import('../pages/ConfigPage');
      const config = new ConfigPage(hostPage);
      await config.waitForReady();

      // Add 1 villager to go from 2 -> 3 players
      // Villager is a bulk-stepper role; use increase stepper
      await config.increaseStepper('villager', 1);

      // Save
      await config.clickSave();
      await room.waitForReady('host');

      // Verify seat count changed
      await room.expectSeatCount(3);

      await room.screenshot(testInfo, 'settings-seat-count.png');

      await testInfo.attach('settings.txt', {
        body: [
          'Initial seats: 2',
          'After settings change: 3',
          'Change: +1 villager (villager1)',
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      await closeAll(fixture);
    }
  });
});
