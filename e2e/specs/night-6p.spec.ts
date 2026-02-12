import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { setupNPlayerGame } from '../helpers/multi-player';
import { runNightFlowLoop } from '../pages/NightFlowPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * 6-Player Night Smoke E2E
 *
 * Template: 2 wolves + seer + witch + hunter + 1 villager = 6
 * Validates multi-wolf voting and full role flow.
 * Does NOT assert exact death results.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

test.describe('Night 6-Player', () => {
  test('6-player night flow with 2 wolves', async ({ browser }, testInfo) => {
    const { fixture, roomNumber, hostPage } = await setupNPlayerGame(browser, {
      playerCount: 6,
      configureTemplate: async (config) => config.configure6Player(),
      quietConsole: true,
    });

    try {
      const nightResult = await runNightFlowLoop(fixture.pages, testInfo, {
        maxIterations: 200,
        screenshotInterval: 20,
      });

      const room = new RoomPage(hostPage);
      const hasLastNightBtn = await room.isLastNightInfoVisible();

      const nightEnded =
        hasLastNightBtn ||
        nightResult.resultText.includes('平安夜') ||
        nightResult.resultText.includes('死亡');

      expect(nightEnded, '6-player night should complete').toBe(true);

      await room.screenshot(testInfo, 'night-6p-ended.png');

      await testInfo.attach('night-6p.txt', {
        body: [
          `Room: ${roomNumber}`,
          `Template: 2狼 + 预言家 + 女巫 + 猎人 + 1村民`,
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
