/** Browser acceptance for DrawGuess setup, guessing, host abort and return to the same lobby. */

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
  await expect(page.getByTestId(TESTIDS.gameConfigScreenRoot('drawguess'))).toBeVisible();
  // Default 6 players; shrink to 4 for a compact room.
  await page.getByRole('button', { name: '减少人数' }).click();
  await page.getByRole('button', { name: '减少人数' }).click();
  await expect(page.getByTestId(TESTIDS.gameConfigScreenRoot('drawguess'))).toContainText(
    '共 8 轮',
  );
  await page.getByTestId(TESTIDS.gameConfigSubmit('drawguess')).click();
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

test('create, guess, cancel or confirm host abort, and restart without losing seats', async ({
  browser,
}) => {
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
      // The gate reason renders once, on the console primary in the bottom
      // bar — asserted before the management panel opens.
      const gateReason = hostPage
        .getByTestId(TESTIDS.bottomActionPanel)
        .getByText('座位尚未坐满（还差 2 人）', { exact: true });
      await expect(gateReason).toHaveCount(1);
      await expect(gateReason).toBeVisible();
      const panel = await room.openHostManagement();
      // The panel row for the primary action carries no caption: its reason
      // stays on the console only, so it appears zero times in the panel.
      await expect(panel.getByText('座位尚未坐满（还差 2 人）', { exact: true })).toHaveCount(0);
      const startButton = panel.getByTestId('start-game-button');
      await expect(startButton).toBeDisabled();
      // Force the press attempt: a plain click() waits forever for the
      // button to become enabled, which is exactly what must not happen.
      await startButton.click({ force: true });
      // Pressing the disabled action fires nothing: no popup, still gated.
      await expect(hostPage.getByText('暂时不能开始', { exact: true })).toHaveCount(0);
      await expect(panel.getByTestId('start-game-button')).toBeDisabled();
      await room.closeHostManagement();
    });

    await test.step('fill bots to reach a full room', async () => {
      const panel = await room.openHostManagement();
      await panel.getByRole('button', { name: '填充机器人', exact: true }).click();
      await confirm(hostPage);
      // The host management panel closes after fill bots; the full room
      // shows through the console primary in the lobby.
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
        '开始游戏',
      );
    });

    await test.step('start the game and reach wordSelect', async () => {
      await room.clickHostManagementActionAndConfirm('start-game-button', '开始游戏？');
      // Host (seat 0) is the first drawer.
      await expect(hostPage.getByText('请选择本轮题目')).toBeVisible();
      // E2E seeds 20 drawguess words, so 3 choices should arrive (not "preparing").
      // Words are dealt randomly; don't assert a specific word.
      await expect(hostPage.getByText('请选择本轮题目（3 选 1）')).toBeVisible({
        timeout: 30000,
      });
      await expect(joinerPage.getByText(/正在选词…/)).toBeVisible();
    });

    await test.step('drawer selects a word and drawing begins', async () => {
      const word = await hostPage.getByTestId('drawguess-word-choice-0').innerText();
      // Click the first word choice button (words are dealt randomly).
      // Use testID for reliable targeting (getByRole was flaky with RNW Pressable).
      await hostPage.getByTestId('drawguess-word-choice-0').click();
      // After word selection, drawer should see the drawing canvas.
      // (Exact drawing-phase assertions depend on the phase transition;
      // at minimum the word choices should disappear.)
      await expect(hostPage.getByText('请选择本轮题目')).not.toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByTestId('drawguess-drawing-canvas')).toBeVisible();
      for (const page of fixture.pages)
        await expect(page.getByRole('button', { name: '放弃本轮', exact: true })).toHaveCount(0);
      await expect(joinerPage.getByTestId(TESTIDS.roomHostManagementButton)).toHaveCount(0);
      await joinerPage.getByLabel('猜词输入框', { exact: true }).fill(word);
      await joinerPage.getByRole('button', { name: '发送猜词', exact: true }).click();
      await expect(joinerPage.getByLabel('已猜中，等待本轮结束', { exact: true })).toBeVisible();
    });

    await test.step('cancel keeps the current game and confirmation returns everyone to the lobby', async () => {
      await room.clickHostManagementAction(TESTIDS.abortGameButton);
      const dialog = hostPage.getByTestId(TESTIDS.alertModal);
      await expect(dialog.getByText('中止本局？', { exact: true })).toBeVisible();
      await expect(dialog).toContainText('本局不发完成奖励');
      await dialog.getByText('取消', { exact: true }).click();
      await expect(hostPage.getByTestId('drawguess-drawing-canvas')).toBeVisible();
      await expect(joinerPage.getByLabel('已猜中，等待本轮结束', { exact: true })).toBeVisible();

      await room.clickHostManagementActionAndConfirm(TESTIDS.abortGameButton, '中止本局？');
      for (const page of fixture.pages) {
        await expect(page.getByText('你画我猜 · 4人局', { exact: true })).toBeVisible();
        await expect(page.getByTestId('drawguess-drawing-canvas')).toHaveCount(0);
        await expect(page.getByLabel('猜词消息', { exact: true })).toHaveCount(0);
        await expect(page.getByTestId(TESTIDS.mySeatBadge)).toBeVisible();
      }
      expect(await room.getRoomCode()).toBe(code);
      expect(await room.getSeatCount()).toBe(4);
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
        '开始游戏',
      );
      await joinerPage.reload();
      await waitForRoomScreenReady(joinerPage, { role: 'joiner' });
      await expect(joinerPage.getByText('你画我猜 · 4人局', { exact: true })).toBeVisible();
      await expect(joinerPage.getByTestId(TESTIDS.mySeatBadge)).toBeVisible();
    });

    await test.step('the preserved room starts again and can also abort during word selection', async () => {
      await room.clickHostManagementActionAndConfirm(TESTIDS.startGameButton, '开始游戏？');
      await expect(hostPage.getByText('请选择本轮题目（3 选 1）')).toBeVisible({
        timeout: 30_000,
      });
      await room.clickHostManagementActionAndConfirm(TESTIDS.abortGameButton, '中止本局？');
      for (const page of fixture.pages)
        await expect(page.getByText('你画我猜 · 4人局', { exact: true })).toBeVisible();
    });
  } finally {
    await closeAll(fixture);
  }
});
