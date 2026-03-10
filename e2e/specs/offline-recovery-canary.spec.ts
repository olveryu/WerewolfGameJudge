import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { setupNPlayerGame } from '../helpers/multi-player';
import { waitForRoomScreenReady } from '../helpers/waits';
import { RoomPage } from '../pages/RoomPage';

/**
 * Offline Recovery Canary
 *
 * 最小化回归用例：验证玩家短暂断网后可恢复到 Live 状态。
 * 该用例不覆盖完整夜晚流程，专注网络恢复链路健康检查。
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

test.describe('offline recovery canary', () => {
  test('joiner recovers to live after temporary offline', async ({ browser }, testInfo) => {
    const { fixture, hostPage, joinerPages } = await setupNPlayerGame(browser, {
      playerCount: 2,
      configureTemplate: async (config) => config.configure2Player(),
    });

    const joinerPage = joinerPages[0];
    const joinerContext = fixture.contexts[1];

    try {
      await test.step('joiner goes offline', async () => {
        await joinerContext.setOffline(true);
        await joinerPage
          .getByText('连接断开，正在重连...', { exact: true })
          .waitFor({ state: 'visible', timeout: 15_000 })
          .catch(() => {});
      });

      await test.step('joiner comes back online and reaches live', async () => {
        await joinerContext.setOffline(false);
        await waitForRoomScreenReady(joinerPage, { role: 'joiner', liveTimeoutMs: 30_000 });
      });

      await test.step('host view remains healthy', async () => {
        const room = new RoomPage(hostPage);
        const roomNumber = await room.getRoomNumber();
        expect(roomNumber).toMatch(/^\d{4}$/);
      });

      await testInfo.attach('offline-recovery-canary.txt', {
        body: 'Joiner offline -> online recovery succeeded',
        contentType: 'text/plain',
      });
    } finally {
      await joinerContext.setOffline(false).catch(() => {});
      await closeAll(fixture);
    }
  });
});
