import { expect, test } from '@playwright/test';

import { AUDIO_WAITING_LABEL } from '../../packages/web/src/features/room/model/RoomBottomActions';
import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { gateCommandFrames } from '../helpers/command-frames';
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
    // Hold the host's audio-ack COMMAND frame at the socket so the
    // announcement state stays visible while the viewports are checked.
    // The gate must be installed before the host enters the room: the
    // socket is created on room entry, and later routes miss it.
    const ackGate = await gateCommandFrames(hostPage);
    const heldAckPromise = ackGate.waitForHeld(`${gameId}.audio.ack`);

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
          await hostPage.getByTestId(TESTIDS.gameConfigSubmit('avalon')).click();
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
          await new RoomPage(page).viewRole();
        }
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
          const narration = page.getByTestId(TESTIDS.audioWaitingMessage);
          await expect(narration).toHaveText(AUDIO_WAITING_LABEL);
          await expect(narration).toBeInViewport({ ratio: 1 });
          const roomText = await page.getByTestId(TESTIDS.roomScreenRoot).textContent();
          expect(
            roomText?.split(AUDIO_WAITING_LABEL).length,
            'The narration label renders exactly once in the room',
          ).toBe(2);
          await expect(page.getByTestId(TESTIDS.roomProgressIndicator)).toContainText(
            /第\d+步 \/ 共\d+步/,
          );
          await testInfo.attach(`${gameId}-${name}`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        }
      });

      if (gameId === 'avalon') {
        await test.step('播报期间仍能确认夜晚信息', async () => {
          const counts = await Promise.all(
            playerPages.map((page) => page.getByTestId(TESTIDS.avalonNightInfo).count()),
          );
          const participantIndex = counts.findIndex((count) => count === 1);
          expect(participantIndex).toBeGreaterThanOrEqual(0);
          const page = playerPages[participantIndex]!;
          await expect(page.getByTestId(TESTIDS.audioWaitingMessage)).toHaveText(
            AUDIO_WAITING_LABEL,
          );
          await page.getByTestId(TESTIDS.avalonNightInfo).click();
          await expect(page.getByTestId(TESTIDS.alertTitle)).toHaveText('坏人互认');
          await page.getByTestId(TESTIDS.alertButton(0)).click();
          await expect(page.getByTestId(TESTIDS.alertModal)).toBeHidden();
          await expect(page.getByTestId(TESTIDS.actionMessage)).toHaveText('等待本步玩家确认');
          await expect(page.getByTestId(TESTIDS.audioWaitingMessage)).toHaveText(
            AUDIO_WAITING_LABEL,
          );
        });
      }

      await test.step('真实播报 ack 后各视角移除状态', async () => {
        const heldAck = await heldAckPromise;
        heldAck.release();
        for (const page of [hostPage, playerPages[1]!, spectatorPage]) {
          await expect(page.getByTestId(TESTIDS.audioWaitingMessage)).toHaveCount(0, {
            timeout: 45_000,
          });
        }
      });
    } finally {
      await ackGate.stop();
      await closeAll(fixture);
    }
  });
}
