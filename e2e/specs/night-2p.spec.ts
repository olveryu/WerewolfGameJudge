import { expect,test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { setupNPlayerGame } from '../helpers/multi-player';
import { runNightFlowLoop } from '../pages/NightFlowPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * 2-Player Night Smoke E2E
 *
 * Verifies the simplest night flow (1 wolf + 1 villager) runs to completion.
 * Does NOT assert exact death results — that's covered by Jest integration tests.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test.describe('Night 2-Player', () => {
  test('first night runs to completion', async ({ browser }, testInfo) => {
    const { fixture, roomNumber, hostPage } = await setupNPlayerGame(browser, {
      playerCount: 2,
      configureTemplate: async (config) => config.configure2Player(),
    });

    try {
      const nightResult = await runNightFlowLoop(fixture.pages, testInfo, {
        maxIterations: 80,
        screenshotInterval: 10,
      });

      // Verify night ended
      const room = new RoomPage(hostPage);
      const hasLastNightBtn = await room.isLastNightInfoVisible();

      const nightEnded =
        hasLastNightBtn ||
        nightResult.resultText.includes('平安夜') ||
        nightResult.resultText.includes('死亡');

      expect(nightEnded, 'Night should complete').toBe(true);

      await room.screenshot(testInfo, 'night-2p-ended.png');

      // Attach diagnostic report
      await testInfo.attach('night-2p.txt', {
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
