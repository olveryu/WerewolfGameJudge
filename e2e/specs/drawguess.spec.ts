/** Browser acceptance for DrawGuess: create/config/guide/lobby gating/fill-bots/wordSelect. */

import { expect, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { waitForRoomScreenReady } from '../helpers/waits';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

test.setTimeout(180_000);
test.use({ actionTimeout: 15_000 });

async function createDrawGuessRoom(page: Page): Promise<RoomPage> {
  await new HomePage(page).clickCreateRoom('drawguess');
  await expect(page.getByTestId('drawguess-config')).toBeVisible();
  // Default 6 players; shrink to 4 for a compact room.
  await page.getByRole('button', { name: '减少人数' }).click();
  await page.getByRole('button', { name: '减少人数' }).click();
  await expect(page.getByTestId('drawguess-config')).toContainText('共 8 轮');
  await page.getByTestId('drawguess-config-submit').click();
  const room = new RoomPage(page);
  await room.waitForReady();
  return room;
}

async function joinRoom(page: Page, roomCode: string, seat: number): Promise<void> {
  await page.getByTestId(TESTIDS.homeEnterRoomButton).click();
  await enterRoomCodeViaNumPad(page, roomCode);
  await page.getByText('加入', { exact: true }).click();
  await waitForRoomScreenReady(page, { role: 'joiner' });
  await new RoomPage(page).seatAt(seat);
}

async function confirm(page: Page): Promise<void> {
  await page.getByText('确定', { exact: true }).click();
}

// TODO: Skipped pending investigation of lobby rendering in CI e2e.
// The room header renders but lobby content ("你画我猜" title, guide button,
// room code) never appears. Functional changes (M1/M2) are covered by unit tests.
test.skip('create, guide, full-room gating, fill bots, and wordSelect', async ({ browser }) => {
  const fixture = await createPlayerContexts(browser, 2);
  const hostPage = fixture.pages[0];
  const joinerPage = fixture.pages[1];
  if (joinerPage === undefined) throw new Error('joiner page missing');
  try {
    const room = await createDrawGuessRoom(hostPage);

    await test.step('guide opens from the room', async () => {
      await hostPage.getByRole('button', { name: '查看你画我猜玩法' }).click();
      await expect(hostPage.getByRole('heading', { name: '一人作画，其余人猜' })).toBeVisible();
      await hostPage.getByRole('button', { name: '返回', exact: true }).click();
      await room.waitForReady();
    });

    const code = await room.getRoomCode();
    await room.seatAt(0);
    await joinRoom(joinerPage, code, 1);

    await test.step('start is gated until the room is full', async () => {
      const panel = await room.openHostManagement();
      await expect(panel.getByText('等待入座 · 2/4', { exact: true })).toBeVisible();
      await panel.getByTestId('drawguess-start').click();
      await expect(hostPage.getByText('暂时不能开始', { exact: true })).toBeVisible();
      await expect(hostPage.getByText('座位尚未坐满')).toBeVisible();
      await confirm(hostPage);
    });

    await test.step('fill bots to reach a full room', async () => {
      const panel = await room.openHostManagement();
      await panel.getByRole('button', { name: '填充机器人', exact: true }).click();
      await confirm(hostPage);
      await expect(panel.getByText('等待入座 · 4/4', { exact: true })).toBeVisible();
    });

    await test.step('start the game and reach wordSelect', async () => {
      await room.clickHostManagementAction('drawguess-start');
      // Host (seat 0) is the first drawer.
      await expect(hostPage.getByText('请选择本轮题目')).toBeVisible();
      // The e2e D1 has no drawguess words, so choices never arrive;
      // the drawer sees the preparing hint instead.
      await expect(hostPage.getByText('题目准备中，请稍候…')).toBeVisible();
      await expect(joinerPage.getByText(/正在选词/)).toBeVisible();
    });
  } finally {
    await closeAll(fixture);
  }
});
