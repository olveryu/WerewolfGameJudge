import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

test.setTimeout(180_000);

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`Undercover offline reveal and blank victory at ${viewport.width}px`, async ({
    browser,
  }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 1);
    const [page] = fixture.pages;
    await page.setViewportSize(viewport);
    const room = new RoomPage(page);
    try {
      await new HomePage(page).clickCreateRoom('undercover');
      await page.getByTestId('undercover-category').click();
      await expect(page.getByRole('radio', { name: '吃喝美食', exact: true })).toBeVisible();
      await expect(page.getByRole('radio', { name: '自然世界', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(page.getByRole('button', { name: '关闭', exact: true })).toHaveCount(0);
      await page.getByTestId('undercover-player-count').fill('6');
      await expect(page.getByTestId('undercover-player-count')).toHaveValue('6');
      await page.getByRole('switch', { name: '启用白板' }).click();
      await expect(page.getByRole('switch', { name: '测试模式' })).toHaveCount(0);
      await page.getByTestId('undercover-config-submit').click();
      await room.waitForReady('host');
      await expect(page.getByRole('button', { name: '查看谁是卧底玩法说明' })).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath(`undercover-lobby-${viewport.width}.png`),
      });
      await page.getByRole('button', { name: '查看谁是卧底玩法说明' }).click();
      await expect(page.getByRole('heading', { name: '三个身份', level: 2 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`undercover-guide-${viewport.width}.png`),
      });
      await page.getByRole('button', { name: '返回', exact: true }).click();
      await room.waitForReady('host');
      await room.expectNotSeated();
      await room.openHostManagement();
      await page.getByTestId('undercover-fill-bots').click();
      await page.getByText('确定', { exact: true }).click();
      await expect(page.getByText('等待入座 · 6/6', { exact: true })).toBeVisible();
      await room.openHostManagement();
      await page.getByTestId('undercover-clear-bots').click();
      await page.getByText('确定', { exact: true }).click();
      await expect(page.getByText('等待入座 · 0/6', { exact: true })).toBeVisible();
      await room.seatAt(0);
      await room.openHostManagement();
      await page.getByTestId('undercover-fill-bots').click();
      await page.getByText('确定', { exact: true }).click();
      await expect(page.getByText('等待入座 · 6/6', { exact: true })).toBeVisible();
      await room.openHostManagement();
      await page.getByTestId('undercover-start').click();
      await expect(page.getByTestId('undercover-view-word')).toBeVisible();
      const speakingHint = page.getByText(/^首轮随机由 [1-6] 号开始发言$/);
      await expect(speakingHint).toHaveCount(0);
      await expect(page.getByTestId('undercover-word')).toHaveCount(0);
      const cards: string[] = [];
      for (let seat = 0; seat < 6; seat += 1) {
        if (seat > 0) {
          await room.getSeatTile(seat).click({ delay: 650 });
          await expect(page.getByTestId(TESTIDS.controlledSeatBanner)).toBeVisible();
        }
        await page.getByTestId('undercover-view-word').click();
        cards.push(await page.getByTestId('undercover-word').innerText());
        await page.getByText('隐藏词卡', { exact: true }).click();
        await expect(page.getByTestId('undercover-word')).toHaveCount(0);
        if (seat > 0) await page.getByTestId(TESTIDS.controlledSeatReleaseButton).click();
      }
      expect(cards.filter((word) => word === '你是白板')).toHaveLength(1);
      await room.openHostManagement();
      await page.getByTestId('undercover-mark-all-bots-viewed').click();
      await expect(page.getByText('确认词卡 · 5/6', { exact: true })).toBeVisible();
      await page.getByTestId('undercover-view-word').click();
      await page.getByTestId('undercover-confirm').click();
      await expect(page.getByText('游戏进行中 · 存活 6 人', { exact: true })).toBeVisible();
      await expect(speakingHint).toBeVisible();
      const initialSpeakingHint = await speakingHint.innerText();
      await page.getByTestId('undercover-view-word').click();
      await expect(page.getByTestId('undercover-word')).toHaveText(cards[0]!);
      await page.reload();
      await room.waitForReady('host');
      await expect(page.getByTestId('undercover-word')).toHaveCount(0);
      await expect(speakingHint).toHaveText(initialSpeakingHint);
      await page.screenshot({
        path: testInfo.outputPath(`undercover-speaking-${viewport.width}.png`),
      });
      await expect(page.getByTestId(TESTIDS.controlledSeatBanner)).toHaveCount(0);
      const civilians = cards
        .map((word, seat) => ({ word, seat }))
        .filter(
          ({ word }) => word !== '你是白板' && cards.filter((other) => other === word).length > 1,
        );
      expect(civilians).toHaveLength(4);
      for (const { seat } of civilians) {
        await room.openHostManagement();
        await page.getByTestId('undercover-select-player').click();
        if (seat !== civilians[0]!.seat) {
          await room.getSeatTile(civilians[0]!.seat).click();
          await expect(page.getByTestId('undercover-reveal-modal')).toHaveCount(0);
        }
        await room.getSeatTile(seat).click();
        const modal = page.getByTestId('undercover-reveal-modal');
        await expect(modal).toBeVisible();
        await expect(modal.getByText(`${seat + 1} 号`, { exact: true })).toBeVisible();
        await expect(page.getByTestId('undercover-reveal-player')).not.toBeEmpty();
        await expect(modal).not.toContainText(/平民|卧底|白板/);
        if (seat === civilians[0]!.seat) {
          await page.getByTestId('undercover-reveal-cancel').click();
          await expect(modal).toHaveCount(0);
          await expect(page.getByText('取消选择', { exact: true })).toBeVisible();
          await expect(page.getByText('游戏进行中 · 存活 6 人', { exact: true })).toBeVisible();
          await room.getSeatTile(seat).click();
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
          await page.screenshot({
            path: testInfo.outputPath(`undercover-confirm-${viewport.width}.png`),
            animations: 'disabled',
          });
          await page.route(
            '**/room/command',
            async (route) => {
              await expect(page.getByTestId('undercover-reveal')).toBeDisabled();
              await expect(page.getByTestId('undercover-reveal-cancel')).toBeDisabled();
              await route.continue();
            },
            { times: 1 },
          );
        }
        await page.getByTestId('undercover-reveal').click();
        await expect(modal).toHaveCount(0);
        await expect(page.getByText('已出局 · 平民', { exact: true })).toHaveCount(
          civilians.findIndex((civilian) => civilian.seat === seat) + 1,
        );
        if (seat === 0 && civilians[civilians.length - 1]?.seat !== 0) {
          await page.getByTestId('undercover-view-word').click();
          await expect(page.getByTestId('undercover-word')).toHaveText(cards[0]!);
          await page.getByText('隐藏词卡', { exact: true }).click();
        }
      }
      await expect(page.getByText('白板获胜', { exact: true })).toBeVisible();
      await expect(page.getByTestId('undercover-view-word')).toHaveCount(0);
      // Open the host panel once and reuse it: on narrow viewports the panel is a
      // modal sheet that covers the management entry button, so opening it again
      // while it is already open leaves Playwright retrying the entry click
      // until the test timeout.
      const endedManagement = await room.openHostManagement();
      await expect(endedManagement.getByTestId('undercover-restart')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`undercover-ended-${viewport.width}.png`),
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await endedManagement.getByTestId('undercover-restart').click();
      await expect(page.getByText('确认词卡 · 0/6', { exact: true })).toBeVisible();
      await expect(speakingHint).toHaveCount(0);
      await expect(page.getByTestId('undercover-results')).toHaveCount(0);
      await expect(page.getByText('已出局 · 平民', { exact: true })).toHaveCount(0);
      await room.openHostManagement();
      await page.getByTestId('undercover-mark-all-bots-viewed').click();
      await page.getByTestId('undercover-view-word').click();
      await page.getByTestId('undercover-confirm').click();
      await expect(speakingHint).toBeVisible();
      await room.openHostManagement();
      await page.getByTestId('undercover-restart').click();
      await expect(page.getByText('重新开始？', { exact: true })).toBeVisible();
      await page.getByText('取消', { exact: true }).click();
      await expect(page.getByText('游戏进行中 · 存活 6 人', { exact: true })).toBeVisible();
      await room.openHostManagement();
      await page.getByTestId('undercover-restart').click();
      await page.getByText('确定', { exact: true }).click();
      await expect(page.getByText('确认词卡 · 0/6', { exact: true })).toBeVisible();
      await expect(speakingHint).toHaveCount(0);
      await room.openHostManagement();
      await page.getByTestId('undercover-abort').click();
      await page.getByText('确定', { exact: true }).click();
      await expect(page.getByText('本局已中止', { exact: true })).toBeVisible();
      await room.openHostManagement();
      await page.getByTestId('undercover-return-lobby').click();
      await expect(page.getByText('等待入座 · 6/6', { exact: true })).toBeVisible();
    } finally {
      await closeAll(fixture);
    }
  });
}
