import { expect, test } from '@playwright/test';

import { AUDIO_WAITING_LABEL } from '../../src/features/room/model/RoomBottomActions';
import { TESTIDS } from '../../src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { BoardPickerPage } from '../pages/BoardPickerPage';
import { ConfigPage } from '../pages/ConfigPage';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

test.setTimeout(180_000);

for (const gameId of ['werewolf', 'avalon'] as const) {
  test(`${gameId}: shared narration for host, player and spectator`, async ({
    browser,
  }, testInfo) => {
    const playerCount = gameId === 'werewolf' ? 3 : 6;
    const fixture = await createPlayerContexts(browser, playerCount + 1);
    const hostPage = fixture.pages[0];
    const playerPages = fixture.pages.slice(0, playerCount);
    const spectatorPage = fixture.pages[playerCount]!;
    const hostRoom = new RoomPage(hostPage);
    const audioAckGate = Promise.withResolvers<void>();

    try {
      await test.step('建房、入座并查看身份', async () => {
        await hostPage.setViewportSize({ width: 1280, height: 900 });
        await new HomePage(hostPage).clickCreateRoom(gameId);
        if (gameId === 'werewolf') {
          const boardPicker = new BoardPickerPage(hostPage);
          await boardPicker.waitForReady();
          await boardPicker.selectDefaultTemplate();
          const config = new ConfigPage(hostPage);
          await config.waitForReady();
          await config.configureCustomTemplate({ wolves: 1, villagers: 2 });
          await config.clickCreate();
        } else {
          await hostPage.getByTestId('avalon-config-submit').click();
        }
        await hostRoom.waitForReady('host');
        const roomCode = await hostRoom.getRoomCode();
        await hostRoom.seatAt(0);
        for (let seat = 1; seat < playerCount; seat += 1) {
          const room = new RoomPage(playerPages[seat]!);
          await room.joinViaCode(roomCode);
          await room.seatAt(seat);
        }
        await new RoomPage(spectatorPage).joinViaCode(roomCode);
        await hostRoom.prepareRoles();
        for (const page of playerPages) {
          await page.getByRole('button', { name: '查看身份', exact: true }).click();
          const modal = page.getByTestId('role-card-modal');
          await expect(modal).toBeVisible();
          await modal.getByText('知道了', { exact: true }).click();
          await expect(modal).toBeHidden();
        }
      });

      await hostPage.route('**/room/command', async (route, request) => {
        if (request.method() === 'POST') {
          const body: unknown = request.postDataJSON();
          if (
            typeof body === 'object' &&
            body !== null &&
            'command' in body &&
            typeof body.command === 'object' &&
            body.command !== null &&
            'type' in body.command &&
            body.command.type === `${gameId}.audio.ack`
          ) {
            await audioAckGate.promise;
          }
        }
        await route.continue();
      });

      await hostRoom.startGame();
      await test.step('桌面房主与手机玩家、观察者显示同一播报状态', async () => {
        const viewers = [
          { page: hostPage, name: 'host-desktop', viewport: { width: 1280, height: 900 } },
          { page: playerPages[1]!, name: 'player-mobile', viewport: { width: 320, height: 640 } },
          { page: spectatorPage, name: 'spectator-mobile', viewport: { width: 390, height: 844 } },
        ];
        for (const { page, name, viewport } of viewers) {
          await page.setViewportSize(viewport);
          const narration = page.getByText(AUDIO_WAITING_LABEL, { exact: true });
          await expect(narration).toHaveCount(1);
          await expect(narration).toBeInViewport({ ratio: 1 });
          await expect(page.getByRole('button', { name: AUDIO_WAITING_LABEL })).toHaveCount(0);
          await expect(
            page.getByTestId(TESTIDS.bottomActionPanel).getByText(/第\d+步 \/ 共\d+步/),
          ).toBeVisible();
          await testInfo.attach(`${gameId}-${name}`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        }
      });

      if (gameId === 'avalon') {
        await test.step('播报期间仍能确认夜晚信息', async () => {
          const counts = await Promise.all(
            playerPages.map((page) => page.getByTestId('avalon-night-info').count()),
          );
          const participantIndex = counts.findIndex((count) => count === 1);
          expect(participantIndex).toBeGreaterThanOrEqual(0);
          const page = playerPages[participantIndex]!;
          await expect(page.getByText(AUDIO_WAITING_LABEL, { exact: true })).toBeVisible();
          await page.getByTestId('avalon-night-info').click();
          await expect(page.getByTestId(TESTIDS.alertTitle)).toHaveText('坏人互认');
          await page.getByTestId(TESTIDS.alertButton(0)).click();
          await expect(page.getByTestId(TESTIDS.alertModal)).toBeHidden();
          await expect(page.getByText('等待本步玩家确认', { exact: true })).toBeVisible();
          await expect(page.getByText(AUDIO_WAITING_LABEL, { exact: true })).toBeVisible();
        });
      }

      await test.step('真实播报 ack 后各视角移除状态', async () => {
        audioAckGate.resolve();
        for (const page of [hostPage, playerPages[1]!, spectatorPage]) {
          await expect(page.getByText(AUDIO_WAITING_LABEL, { exact: true })).toHaveCount(0, {
            timeout: 45_000,
          });
        }
      });
    } finally {
      audioAckGate.resolve();
      await hostPage.unrouteAll({ behavior: 'wait' });
      await closeAll(fixture);
    }
  });
}
