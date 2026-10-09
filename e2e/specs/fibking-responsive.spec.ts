import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { startRoomCreation } from '../helpers/home';
import { FibConfigPage } from '../pages/FibConfigPage';
import { FibRoomPage } from '../pages/FibRoomPage';

test.setTimeout(180_000);

const MOBILE_VIEWPORT = { width: 320, height: 640 };

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('Responsive Fib test requires an explicit viewport');
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  if (documentWidth > viewport.width) {
    const overflow = await page.evaluate(
      (viewportWidth) =>
        Array.from(document.querySelectorAll<HTMLElement>('*'))
          .map((element) => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              testID: element.dataset.testid ?? null,
              tag: element.tagName,
              className: element.className,
              text: element.textContent?.trim().slice(0, 80) ?? '',
              position: style.position,
              cssRight: style.right,
              transform: style.transform,
              left: box.left,
              right: box.right,
              width: box.width,
            };
          })
          .filter((box) => box.left < 0 || box.right > viewportWidth)
          .sort((left, right) => right.right - left.right)
          .slice(0, 10),
      viewport.width,
    );
    throw new Error(
      `Horizontal overflow ${documentWidth}px > ${viewport.width}px: ${JSON.stringify(overflow)}`,
    );
  }
}

async function expectInsideViewport(
  page: import('@playwright/test').Page,
  testID: string,
): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('Responsive Fib test requires an explicit viewport');
  const box = await page.getByTestId(testID).boundingBox();
  if (box === null) throw new Error(`Responsive Fib element ${testID} has no layout box`);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

test('FibKing config, room, rules, and identity fit the small-mobile viewport', async ({
  browser,
}, testInfo) => {
  const fixture = await createPlayerContexts(browser, 4);
  const [hostPage, ...joinerPages] = fixture.pages;
  try {
    for (const page of fixture.pages) await page.setViewportSize(MOBILE_VIEWPORT);
    await startRoomCreation(hostPage, 'fibking');
    const config = new FibConfigPage(hostPage);
    await config.waitForCreateMode();
    await config.setPlayerCount(4);
    await expectNoHorizontalOverflow(hostPage);
    await expectInsideViewport(hostPage, TESTIDS.fibConfigSubmitButton);
    await testInfo.attach('fibking-mobile-config.png', {
      body: await hostPage.screenshot(),
      contentType: 'image/png',
    });
    await config.createRoom();

    const hostRoom = new FibRoomPage(hostPage);
    await hostRoom.waitForReady('host');
    await hostRoom.seatAt(0);
    const roomCode = await hostRoom.getRoomCode();
    const joinerRooms = joinerPages.map((page) => new FibRoomPage(page));
    for (let i = 0; i < joinerRooms.length; i += 1) {
      await joinerRooms[i]!.joinViaCode(roomCode);
      await joinerRooms[i]!.seatAt(i + 1);
    }
    await expect(hostPage.getByText('等待入座 · 4/4', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoHorizontalOverflow(hostPage);
    await expectInsideViewport(hostPage, TESTIDS.roomHeader);
    await expectInsideViewport(hostPage, TESTIDS.bottomActionPanel);
    await testInfo.attach('fibking-mobile-lobby.png', {
      body: await hostPage.screenshot(),
      contentType: 'image/png',
    });

    await hostRoom.openRules();
    await expectNoHorizontalOverflow(hostPage);
    await expect(hostPage.getByRole('heading', { name: '三个身份', level: 2 })).toBeVisible();
    await testInfo.attach('fibking-mobile-guide.png', {
      body: await hostPage.screenshot(),
      contentType: 'image/png',
    });
    await hostRoom.returnFromRules();

    await hostRoom.startRound();
    // Every real player views their own identity; the modal must fit on each page.
    const allRooms = [hostRoom, ...joinerRooms];
    for (let i = 0; i < allRooms.length; i += 1) {
      const page = fixture.pages[i]!;
      await allRooms[i]!.viewIdentity();
      await expectInsideViewport(page, TESTIDS.fibIdentityModal);
      if (i === 0) {
        await testInfo.attach('fibking-mobile-identity.png', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
      await allRooms[i]!.confirmIdentityView();
    }
  } finally {
    await closeAll(fixture);
  }
});
