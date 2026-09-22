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
      await expect(page.getByRole('button', { name: '吃喝美食', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '自然世界', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(page.getByRole('button', { name: '关闭', exact: true })).toHaveCount(0);
      await page.getByTestId('undercover-player-count').fill('6');
      await expect(page.getByTestId('undercover-player-count')).toHaveValue('6');
      await page.getByRole('switch', { name: '启用白板' }).click();
      await page.getByRole('switch', { name: '测试模式' }).click();
      await page.getByTestId('undercover-config-submit').click();
      await room.waitForReady('host');
      await room.seatAt(0);
      await room.openHostManagement();
      await page.getByTestId('undercover-fill-bots').click();
      await page.getByText('确定', { exact: true }).click();
      await expect(page.getByText('测试模式 · 等待入座 · 6/6', { exact: true })).toBeVisible();
      await room.openHostManagement();
      await page.getByTestId('undercover-start').click();
      await expect(page.getByTestId('undercover-view-word')).toBeVisible();
      await expect(page.getByTestId('undercover-word')).toHaveCount(0);
      const cards: string[] = [];
      for (let seat = 0; seat < 6; seat += 1) {
        if (seat > 0) {
          await room.getSeatTile(seat).click({ delay: 650 });
          await expect(page.getByTestId(TESTIDS.controlledSeatBanner)).toBeVisible();
        }
        await page.getByTestId('undercover-view-word').click();
        cards.push(await page.getByTestId('undercover-word').innerText());
        await page.getByTestId('undercover-confirm').click();
        await expect(page.getByTestId('undercover-word')).toHaveCount(0);
        if (seat > 0) await page.getByTestId(TESTIDS.controlledSeatReleaseButton).click();
      }
      expect(cards.filter((word) => word === '你是白板')).toHaveLength(1);
      await expect(
        page.getByText('测试模式 · 游戏进行中 · 存活 6 人', { exact: true }),
      ).toBeVisible();
      await page.getByTestId('undercover-view-word').click();
      await expect(page.getByTestId('undercover-word')).toHaveText(cards[0]!);
      await page.reload();
      await room.waitForReady('host');
      await expect(page.getByTestId('undercover-word')).toHaveCount(0);
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
        await room.getSeatTile(seat).click();
        await page.getByTestId('undercover-reveal').click();
        await expect(page.getByText(`揭晓 ${seat + 1} 号并出局？`, { exact: true })).toBeVisible();
        await page.getByText('确定', { exact: true }).click();
        await expect(page.getByText('已出局 · 平民', { exact: true })).toHaveCount(
          civilians.findIndex((civilian) => civilian.seat === seat) + 1,
        );
        if (seat === 0 && civilians[civilians.length - 1]?.seat !== 0) {
          await page.getByTestId('undercover-view-word').click();
          await expect(page.getByTestId('undercover-word')).toHaveText(cards[0]!);
          await page.getByText('隐藏词卡', { exact: true }).click();
        }
      }
      await expect(page.getByText('测试模式 · 白板获胜', { exact: true })).toBeVisible();
      await expect(page.getByTestId('undercover-view-word')).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath(`undercover-ended-${viewport.width}.png`),
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await room.openHostManagement();
      await page.getByTestId('undercover-return-lobby').click();
      await expect(page.getByText('测试模式 · 等待入座 · 6/6', { exact: true })).toBeVisible();
    } finally {
      await closeAll(fixture);
    }
  });
}
