import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

test.setTimeout(300_000);

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`Undercover offline reveal and blank victory at ${viewport.width}px`, async ({
    browser,
  }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 6);
    const [hostPage, ...joinerPages] = fixture.pages;
    for (const page of fixture.pages) await page.setViewportSize(viewport);
    const hostRoom = new RoomPage(hostPage);
    const joinerRooms = joinerPages.map((page) => new RoomPage(page));
    const allPages = [hostPage, ...joinerPages];
    try {
      await new HomePage(hostPage).clickCreateRoom('undercover');
      await hostPage.getByTestId('undercover-category').click();
      await expect(hostPage.getByRole('radio', { name: '吃喝美食', exact: true })).toBeVisible();
      await expect(hostPage.getByRole('radio', { name: '自然世界', exact: true })).toHaveCount(0);
      await hostPage.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(hostPage.getByRole('button', { name: '关闭', exact: true })).toHaveCount(0);
      await hostPage.getByTestId('undercover-player-count').fill('6');
      await expect(hostPage.getByTestId('undercover-player-count')).toHaveValue('6');
      await hostPage.getByRole('switch', { name: '启用白板' }).click();
      await expect(hostPage.getByRole('switch', { name: '测试模式' })).toHaveCount(0);
      await hostPage.getByTestId('undercover-config-submit').click();
      await hostRoom.waitForReady('host');
      await expect(hostPage.getByRole('button', { name: '查看谁是卧底玩法说明' })).toBeInViewport();
      await hostPage.screenshot({
        path: testInfo.outputPath(`undercover-lobby-${viewport.width}.png`),
      });
      await hostPage.getByRole('button', { name: '查看谁是卧底玩法说明' }).click();
      await expect(hostPage.getByRole('heading', { name: '三个身份', level: 2 })).toBeVisible();
      expect(
        await hostPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await hostPage.screenshot({
        path: testInfo.outputPath(`undercover-guide-${viewport.width}.png`),
      });
      await hostPage.getByRole('button', { name: '返回', exact: true }).click();
      await hostRoom.waitForReady('host');

      // Six real players take seats; no bots involved.
      const roomCode = await hostRoom.getRoomCode();
      await hostRoom.expectNotSeated();
      await hostRoom.seatAt(0);
      for (let i = 0; i < joinerRooms.length; i += 1) {
        await joinerRooms[i]!.joinViaCode(roomCode);
        await joinerRooms[i]!.seatAt(i + 1);
      }
      await expect(hostPage.getByText('等待入座 · 6/6', { exact: true })).toBeVisible({
        timeout: 15_000,
      });

      // Clearing seats unseats everyone but keeps them in the room; all six re-seat.
      await hostRoom.openHostManagement();
      await hostPage.getByTestId(TESTIDS.roomClearSeatsButton).click();
      // Destructive alert has [Cancel, 清空座位]; the confirm is alert-button-1.
      await hostPage.getByTestId(TESTIDS.alertButton(1)).click();
      await expect(hostPage.getByText('等待入座 · 0/6', { exact: true })).toBeVisible();
      await hostRoom.seatAt(0);
      for (let i = 0; i < joinerRooms.length; i += 1) {
        await joinerRooms[i]!.seatAt(i + 1);
      }
      await expect(hostPage.getByText('等待入座 · 6/6', { exact: true })).toBeVisible({
        timeout: 15_000,
      });

      await hostRoom.openHostManagement();
      await hostPage.getByTestId('undercover-start').click();
      await expect(hostPage.getByTestId('undercover-view-word')).toBeVisible();
      const speakingHint = hostPage.getByText(/^首轮从 [1-6] 号开始发言（随机）$/);
      await expect(speakingHint).toHaveCount(0);
      await expect(hostPage.getByTestId('undercover-word')).toHaveCount(0);
      // Every real player views their own word card on their own page.
      const cards: string[] = [];
      for (const page of allPages) {
        await page.getByTestId('undercover-view-word').click();
        cards.push(await page.getByTestId('undercover-word').innerText());
        await page.getByText('隐藏词卡', { exact: true }).click();
        await expect(page.getByTestId('undercover-word')).toHaveCount(0);
      }
      expect(cards.filter((word) => word === '你是白板')).toHaveLength(1);
      // Five players confirm first, then the host confirms last.
      for (const page of joinerPages) {
        await page.getByTestId('undercover-view-word').click();
        await page.getByTestId('undercover-confirm').click();
      }
      await expect(hostPage.getByText('确认词卡 · 5/6', { exact: true })).toBeVisible();
      await hostPage.getByTestId('undercover-view-word').click();
      await hostPage.getByTestId('undercover-confirm').click();
      await expect(hostPage.getByText('游戏进行中 · 存活 6 人', { exact: true })).toBeVisible();
      await expect(speakingHint).toBeVisible();
      const initialSpeakingHint = await speakingHint.innerText();
      await hostPage.getByTestId('undercover-view-word').click();
      await expect(hostPage.getByTestId('undercover-word')).toHaveText(cards[0]!);
      await hostPage.reload();
      await hostRoom.waitForReady('host');
      await expect(hostPage.getByTestId('undercover-word')).toHaveCount(0);
      await expect(speakingHint).toHaveText(initialSpeakingHint);
      await hostPage.screenshot({
        path: testInfo.outputPath(`undercover-speaking-${viewport.width}.png`),
      });
      const civilians = cards
        .map((word, seat) => ({ word, seat }))
        .filter(
          ({ word }) => word !== '你是白板' && cards.filter((other) => other === word).length > 1,
        );
      expect(civilians).toHaveLength(4);
      for (const { seat } of civilians) {
        await hostRoom.openHostManagement();
        await hostPage.getByTestId('undercover-select-player').click();
        if (seat !== civilians[0]!.seat) {
          await hostRoom.getSeatTile(civilians[0]!.seat).click();
          await expect(hostPage.getByTestId('undercover-reveal-modal')).toHaveCount(0);
        }
        await hostRoom.getSeatTile(seat).click();
        const modal = hostPage.getByTestId('undercover-reveal-modal');
        await expect(modal).toBeVisible();
        await expect(modal.getByText(`${seat + 1} 号`, { exact: true })).toBeVisible();
        await expect(hostPage.getByTestId('undercover-reveal-player')).not.toBeEmpty();
        await expect(modal).not.toContainText(/平民|卧底|白板/);
        if (seat === civilians[0]!.seat) {
          await hostPage.getByTestId('undercover-reveal-cancel').click();
          await expect(modal).toHaveCount(0);
          await expect(hostPage.getByText('取消选择', { exact: true })).toBeVisible();
          await expect(hostPage.getByText('游戏进行中 · 存活 6 人', { exact: true })).toBeVisible();
          await hostRoom.getSeatTile(seat).click();
          await expect(modal).toBeVisible();
          await expect(async () => {
            const bounds = await modal.boundingBox();
            if (bounds === null) throw new Error('Missing confirmation panel');
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
            if (viewport.width < 1100)
              expect(Math.abs(bounds.y + bounds.height - viewport.height)).toBeLessThan(2);
            else
              expect(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2)).toBeLessThan(2);
          }).toPass({ timeout: 5000 });
          await hostPage.screenshot({
            path: testInfo.outputPath(`undercover-confirm-${viewport.width}.png`),
            animations: 'disabled',
          });
          await hostPage.route(
            '**/room/command',
            async (route) => {
              await expect(hostPage.getByTestId('undercover-reveal')).toBeDisabled();
              await expect(hostPage.getByTestId('undercover-reveal-cancel')).toBeDisabled();
              await route.continue();
            },
            { times: 1 },
          );
        }
        await hostPage.getByTestId('undercover-reveal').click();
        await expect(modal).toHaveCount(0);
        await expect(hostPage.getByText('已出局 · 平民', { exact: true })).toHaveCount(
          civilians.findIndex((civilian) => civilian.seat === seat) + 1,
        );
        if (seat === 0 && civilians[civilians.length - 1]?.seat !== 0) {
          await hostPage.getByTestId('undercover-view-word').click();
          await expect(hostPage.getByTestId('undercover-word')).toHaveText(cards[0]!);
          await hostPage.getByText('隐藏词卡', { exact: true }).click();
        }
      }
      await expect(hostPage.getByText('白板获胜', { exact: true })).toBeVisible();
      await expect(hostPage.getByTestId('undercover-view-word')).toHaveCount(0);
      // Open the host panel once and reuse it: on narrow viewports the panel is a
      // modal sheet that covers the management entry button, so opening it again
      // while it is already open leaves Playwright retrying the entry click
      // until the test timeout.
      const endedManagement = await hostRoom.openHostManagement();
      await expect(endedManagement.getByTestId('undercover-restart')).toBeVisible();
      await hostPage.screenshot({
        path: testInfo.outputPath(`undercover-ended-${viewport.width}.png`),
      });
      expect(
        await hostPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await endedManagement.getByTestId('undercover-restart').click();
      await expect(hostPage.getByText('确认词卡 · 0/6', { exact: true })).toBeVisible();
      await expect(speakingHint).toHaveCount(0);
      await expect(hostPage.getByTestId('undercover-results')).toHaveCount(0);
      await expect(hostPage.getByText('已出局 · 平民', { exact: true })).toHaveCount(0);
      // NB: do NOT open the host management panel here. On narrow viewports it
      // is a modal bottom sheet that covers the host's own view-word button,
      // hanging the first confirm click until the test timeout.
      for (const page of allPages) {
        await page.getByTestId('undercover-view-word').click();
        await page.getByTestId('undercover-confirm').click();
      }
      await expect(speakingHint).toBeVisible();
      await hostRoom.openHostManagement();
      await hostPage.getByTestId('undercover-restart').click();
      await expect(hostPage.getByText('重新开始？', { exact: true })).toBeVisible();
      await hostPage.getByText('取消', { exact: true }).click();
      await expect(hostPage.getByText('游戏进行中 · 存活 6 人', { exact: true })).toBeVisible();
      await hostRoom.openHostManagement();
      await hostPage.getByTestId('undercover-restart').click();
      await hostPage.getByText('确定', { exact: true }).click();
      await expect(hostPage.getByText('确认词卡 · 0/6', { exact: true })).toBeVisible();
      await expect(speakingHint).toHaveCount(0);
      await hostRoom.openHostManagement();
      await hostPage.getByTestId('undercover-abort').click();
      await hostPage.getByText('确定', { exact: true }).click();
      await expect(hostPage.getByText('本局已中止', { exact: true })).toBeVisible();
      await hostRoom.openHostManagement();
      await hostPage.getByTestId('undercover-return-lobby').click();
      await expect(hostPage.getByText('等待入座 · 6/6', { exact: true })).toBeVisible();
    } finally {
      await closeAll(fixture);
    }
  });
}
