import { expect } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { test } from '../fixtures/app.fixture';
import { startRoomCreation } from '../helpers/home';
import { FibConfigPage } from '../pages/FibConfigPage';
import { FibRoomPage } from '../pages/FibRoomPage';

test.setTimeout(90_000);

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
  app: { page },
}, testInfo) => {
  await startRoomCreation(page, 'fibking');
  const config = new FibConfigPage(page);
  await config.waitForCreateMode();
  await config.setPlayerCount(4);
  await expectNoHorizontalOverflow(page);
  await expectInsideViewport(page, TESTIDS.fibConfigSubmitButton);
  await testInfo.attach('fibking-mobile-config.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await config.createRoom();

  const room = new FibRoomPage(page);
  await room.waitForReady('host');
  await room.seatAt(0);
  await expectNoHorizontalOverflow(page);
  await expectInsideViewport(page, TESTIDS.roomHeader);
  await expectInsideViewport(page, TESTIDS.bottomActionPanel);
  await testInfo.attach('fibking-mobile-lobby.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await room.openRules();
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText('三个身份', { exact: true })).toBeVisible();
  await room.returnFromRules();

  await room.fillEmptySeatsWithBots(4);
  await room.startRound();
  await room.viewIdentity();
  await expectInsideViewport(page, TESTIDS.fibIdentityModal);
  await testInfo.attach('fibking-mobile-identity.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
