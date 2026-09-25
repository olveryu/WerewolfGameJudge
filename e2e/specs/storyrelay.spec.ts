/** Browser acceptance for plain-text Story Relay, using only production room and writing controls. */

import { readFile } from 'node:fs/promises';

import { type Download, expect, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { closeAll, createColdRoomContext, createPlayerContexts } from '../fixtures/app.fixture';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { waitForRoomScreenReady } from '../helpers/waits';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

test.setTimeout(180_000);
test.use({ actionTimeout: 15_000 });

async function createRoom(page: Page): Promise<RoomPage> {
  await new HomePage(page).clickCreateRoom('storyrelay');
  await expect(page.getByTestId('storyrelay-config')).toBeVisible();
  await page.getByRole('button', { name: '减少人数' }).click();
  await page.getByRole('button', { name: '减少人数' }).click();
  await page.getByRole('radio', { name: '写作时间 不限时', exact: true }).click();
  await page.getByRole('radio', { name: '每棒间隔 0 秒', exact: true }).click();
  await page.getByTestId('storyrelay-config-submit').click();
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

async function expectFixedTask(page: Page): Promise<void> {
  await expect(page.getByTestId('storyrelay-editor')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('storyrelay-ready')).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      page
        .getByTestId('storyrelay-task')
        .evaluate((element) => element.scrollHeight - element.clientHeight),
    )
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() => page.getByTestId('storyrelay-editor').evaluate((element) => element.clientHeight))
    .toBeGreaterThan(40);
  await expect
    .poll(() =>
      page
        .getByTestId('storyrelay-ready')
        .evaluate(
          (element) =>
            element.getBoundingClientRect().bottom -
            (window.visualViewport?.height ?? window.innerHeight),
        ),
    )
    .toBeLessThanOrEqual(1);
}

async function expectStoryImageExport(page: Page, scope: '本篇图片' | '全部图片', count: number) {
  await page.getByRole('button', { name: scope, exact: true }).click();
  const images = page.locator('[data-testid^="storyrelay-export-"]');
  await expect(images).toHaveCount(count);
  for (const image of await images.all()) {
    await expect(image).toContainText('第4棒的故事');
    await expect(image).toContainText('4.');
  }
  const downloads: Download[] = [];
  const collect = (download: Download) => downloads.push(download);
  page.on('download', collect);
  try {
    await page.getByRole('button', { name: '保存／分享图片', exact: true }).click();
    await expect.poll(() => downloads.length).toBe(count);
    for (const [index, download] of downloads.entries()) {
      expect(download.suggestedFilename()).toMatch(/^storyrelay-.*\.png$/);
      const filename = test.info().outputPath(`${scope}-${index}.png`);
      await download.saveAs(filename);
      const png = await readFile(filename);
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png.readUInt32BE(20)).toBeGreaterThan(png.readUInt32BE(16));
      expect(png.length).toBeGreaterThan(10_000);
      const hasTextAtBottom = await page.evaluate(
        async (dataUrl) => {
          const image = new Image();
          image.src = dataUrl;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          if (context === null) throw new Error('Image pixel check unavailable');
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(
            0,
            Math.floor(image.height * 0.75),
            image.width,
            Math.floor(image.height * 0.25),
          ).data;
          const background = pixels.slice(0, 3);
          return pixels.some(
            (value, offset) => offset % 4 < 3 && Math.abs(value - background[offset % 4]!) > 50,
          );
        },
        `data:image/png;base64,${png.toString('base64')}`,
      );
      expect(hasTextAtBottom).toBe(true);
    }
  } finally {
    page.off('download', collect);
  }
  await page.getByRole('button', { name: '关闭详情', exact: true }).click();
}

test('four humans write four turns without restoring unsubmitted input and reveal synchronized stories', async ({
  browser,
}) => {
  const fixture = await createPlayerContexts(browser, 4);
  const hostPage = fixture.pages[0];
  try {
    const room = await createRoom(hostPage);
    const code = await room.getRoomCode();
    await room.seatAt(0);
    for (let seat = 1; seat < 4; seat += 1) await joinRoom(fixture.pages[seat]!, code, seat);
    const spectator = await createColdRoomContext(browser, code);
    try {
      await fixture.pages[1]!.setViewportSize({ width: 390, height: 844 });
      await fixture.pages[2]!.setViewportSize({ width: 320, height: 640 });
      await room.clickHostManagementAction('storyrelay-start');
      for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
        await test.step(`write and collect turn ${stepIndex + 1}`, async () => {
          for (const page of fixture.pages) {
            await expect(page.getByTestId('storyrelay-editor')).toBeEditable();
            await expect(page.getByTestId('storyrelay-editor')).toHaveValue('');
            if (stepIndex === 0)
              await expect(page.getByTestId('storyrelay-previous-entry')).toHaveCount(0);
            else
              await expect(page.getByTestId('storyrelay-previous-entry')).toContainText(
                `第${stepIndex}棒的故事`,
              );
          }
          await expect(spectator.page.getByTestId('storyrelay-editor')).toHaveCount(0);
          await expect(spectator.page.getByTestId('storyrelay-previous-entry')).toHaveCount(0);
          for (const [seat, page] of fixture.pages.entries())
            await page
              .getByTestId('storyrelay-editor')
              .fill(` 第${stepIndex + 1}棒的故事，作者${seat}\n原始换行 ${'长正文'.repeat(100)}`);
          await Promise.all(fixture.pages.map(expectFixedTask));
          if (stepIndex === 0) {
            await hostPage.getByTestId('storyrelay-ready').click();
            await expect(hostPage.getByTestId('storyrelay-editor')).not.toBeEditable();
            await hostPage.getByTestId('storyrelay-ready').click();
            for (const [index, viewport] of ['desktop', 'mobile', 'small'].entries())
              await test.info().attach(`storyrelay-writing-${viewport}`, {
                body: await fixture.pages[index]!.screenshot(),
                contentType: 'image/png',
              });
          }
          if (stepIndex === 1) {
            const mobilePage = fixture.pages[1]!;
            await mobilePage.getByTestId('storyrelay-editor').focus();
            await mobilePage.evaluate(() => {
              const viewport = window.visualViewport;
              if (viewport === null) throw new Error('Visual viewport missing');
              Object.defineProperty(viewport, 'height', { configurable: true, value: 480 });
              viewport.dispatchEvent(new Event('resize'));
            });
            await expectFixedTask(mobilePage);
            await mobilePage.screenshot({
              path: test.info().outputPath('storyrelay-keyboard.png'),
            });
            await mobilePage.evaluate(() => {
              const viewport = window.visualViewport;
              if (viewport === null) throw new Error('Visual viewport missing');
              Reflect.deleteProperty(viewport, 'height');
              viewport.dispatchEvent(new Event('resize'));
            });
            await fixture.pages[1]!.reload();
            await waitForRoomScreenReady(fixture.pages[1]!, { role: 'joiner' });
            await expect(fixture.pages[1]!.getByTestId('storyrelay-editor')).toHaveValue('');
            await fixture.pages[1]!.getByTestId('storyrelay-editor').fill(
              ` 第2棒的故事，作者1\n原始换行 `,
            );
          }
          await Promise.all(
            fixture.pages.map((page) => page.getByTestId('storyrelay-ready').click()),
          );
          if (stepIndex < 3)
            await expect(hostPage.getByTestId('storyrelay-previous-entry')).toContainText(
              `第${stepIndex + 1}棒的故事`,
              { timeout: 20_000 },
            );
        });
      }
      for (const page of [...fixture.pages, spectator.page]) {
        await expect(page.getByTestId('storyrelay-gallery')).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId('storyrelay-entry-0')).toBeVisible();
        await expect(page.getByTestId('storyrelay-entry-1')).toHaveCount(0);
      }
      await hostPage.getByRole('button', { name: '下一段', exact: true }).click();
      await expect(spectator.page.getByTestId('storyrelay-entry-1')).toBeVisible();
      await hostPage.getByRole('button', { name: '上一段', exact: true }).click();
      await expect(hostPage.getByTestId('storyrelay-entry-1')).toBeVisible();
      await hostPage.getByRole('button', { name: '全部揭晓', exact: true }).click();
      await confirm(hostPage);
      await expect(
        spectator.page.getByRole('button', { name: '全部图片', exact: true }),
      ).toBeVisible();
      await expect(hostPage.getByTestId('storyrelay-entry-3')).toBeVisible();
      await expect(
        hostPage.getByTestId('storyrelay-gallery').getByRole('button', { name: /复制/ }),
      ).toHaveCount(0);
      await expectStoryImageExport(hostPage, '全部图片', 4);
      await expectStoryImageExport(fixture.pages[1]!, '本篇图片', 1);
      await hostPage.getByTestId('storyrelay-next-round').click();
      await confirm(hostPage);
      await expect(hostPage.getByTestId('storyrelay-editor')).toHaveValue('');
      await expect(hostPage.getByTestId('storyrelay-previous-entry')).toHaveCount(0);
    } finally {
      await spectator.context.close();
    }
  } finally {
    await closeAll(fixture);
  }
});

test('an unseated host writes independent bot inputs and an abort preserves submitted fragments', async ({
  browser,
}) => {
  const fixture = await createPlayerContexts(browser, 1);
  const page = fixture.pages[0];
  try {
    const room = await createRoom(page);
    const panel = await room.openHostManagement();
    await expect(panel.getByText('等待入座 · 0/4', { exact: true })).toBeVisible();
    await panel.getByTestId('storyrelay-start').click();
    await expect(page.getByText('暂时不能开始', { exact: true })).toBeVisible();
    await confirm(page);
    await expect(page.getByTestId('storyrelay-editor')).toHaveCount(0);
    await panel.getByRole('button', { name: '填充机器人', exact: true }).click();
    await confirm(page);
    await room.clickHostManagementAction('storyrelay-start');
    for (let seat = 0; seat < 4; seat += 1) {
      await page.getByTestId(`storyrelay-bot-${seat}`).click();
      await page.getByTestId('storyrelay-editor').fill(`机器人${seat}的独立稿件`);
    }
    await page.getByTestId('storyrelay-bot-0').click();
    await expect(page.getByTestId('storyrelay-editor')).toHaveValue('机器人0的独立稿件');
    await room.clickHostManagementAction('storyrelay-finish-step');
    await confirm(page);
    await expect(page.getByText('续写故事', { exact: true })).toBeVisible();
    await page.getByTestId('storyrelay-bot-0').click();
    await expect(page.getByTestId('storyrelay-previous-entry')).toContainText('独立稿件', {
      timeout: 20_000,
    });
    await (await room.openHostManagement())
      .getByRole('button', { name: '中止本局', exact: true })
      .click();
    await confirm(page);
    await expect(page.getByText('未完成的故事', { exact: false })).toBeVisible();
    await expect(page.getByTestId('storyrelay-next-round')).toHaveCount(0);
    await page.getByTestId('storyrelay-return-lobby').click();
    await confirm(page);
    await expect(page.getByTestId(TESTIDS.roomHostManagementButton)).toBeVisible();
  } finally {
    await closeAll(fixture);
  }
});
