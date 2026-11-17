import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { closeReviewDialog } from '../helpers/image-sharing';
import { waitForRoomScreenReady } from '../helpers/waits';
import { SpotmatchRoomPage } from '../pages/SpotmatchRoomPage';

test.setTimeout(120_000);

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
]) {
  test(`Spotmatch two real players finish on ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    try {
      const hostPage = fixture.pages[0];
      const playerPage = fixture.pages[1]!;
      await Promise.all(fixture.pages.map((page) => page.setViewportSize(viewport)));
      const host = new SpotmatchRoomPage(hostPage);
      const player = new SpotmatchRoomPage(playerPage);
      await test.step('create and join with independent human contexts', async () => {
        await host.createTwoPlayerRoom();
        await host.seatAt(0);
        await player.joinViaCode(await host.getRoomCode());
        await player.seatAt(1);
        await host.startGame();
        await waitForRoomScreenReady(hostPage);
        await expect(hostPage.getByTestId(TESTIDS.spotmatchOwnCard)).toBeVisible();
        await expect(playerPage.getByTestId(TESTIDS.spotmatchOwnCard)).toBeVisible();
      });
      await test.step('two landscape cards fit, with eight separated accessible targets each', async () => {
        await host.expectCardsFit();
        await player.expectCardsFit();
        const screenshot = testInfo.outputPath(`cards-${viewport.width}.png`);
        await hostPage.screenshot({ path: screenshot });
        await testInfo.attach(`cards-${viewport.width}`, {
          path: screenshot,
          contentType: 'image/png',
        });
      });
      await test.step('one player updates the shared central without replacing the other top', async () => {
        const otherTop = await host.ownInstance();
        await player.playCorrectCard();
        await expect.poll(() => host.ownInstance()).toBe(otherTop);
      });
      await test.step('first empty shows final results for both viewers after the success pause', async () => {
        for (let index = 0; index < 4; index++) await host.playCorrectCard();
        const old = await hostPage
          .getByTestId(TESTIDS.spotmatchCentralCard)
          .getAttribute('data-instance-id');
        // The last play replaces the entire stage rather than exposing another card.
        const central = hostPage.getByTestId(TESTIDS.spotmatchCentralCard);
        const own = hostPage.getByTestId(TESTIDS.spotmatchOwnCard);
        const centralNames = await central.evaluate((element) =>
          Array.from(element.querySelectorAll('[data-symbol-id]'), (node) =>
            Number(node.getAttribute('data-symbol-id')),
          ),
        );
        const targets = await own.evaluate((element) =>
          Array.from(element.querySelectorAll('button'), (button) => ({
            symbol: Number(button.dataset.symbolId),
            name: button.getAttribute('aria-label'),
          })),
        );
        const match = targets.find((target) => centralNames.includes(target.symbol));
        if (match === undefined || old === null) throw new Error('No final visible match');
        await own.getByTestId(TESTIDS.spotmatchSymbol(match.symbol)).click();
        await expect(hostPage.getByTestId(TESTIDS.spotmatchResult)).toContainText('率先出完');
        await expect(playerPage.getByTestId(TESTIDS.spotmatchResult)).toContainText('率先出完');
        await host.expectResultsFit();
        await player.expectResultsFit();
        const screenshot = testInfo.outputPath(`results-${viewport.width}.png`);
        await hostPage.screenshot({ path: screenshot });
        await testInfo.attach(`results-${viewport.width}`, {
          path: screenshot,
          contentType: 'image/png',
        });
      });
      await test.step('standard terminal management returns the room to lobby', async () => {
        await playerPage.getByTestId(TESTIDS.roomReviewOpenButton).click();
        await expect(playerPage.getByTestId(TESTIDS.roomReviewDialog)).toContainText('率先出完');
        await expect(
          playerPage
            .getByTestId(TESTIDS.roomReviewDialog)
            .getByTestId(TESTIDS.roomReviewRosterRow(0)),
        ).toContainText('出对 5');
        await closeReviewDialog(playerPage);
        await host.returnToLobby();
        await host.expectSeatCount(2);
      });
    } finally {
      await closeAll(fixture);
    }
  });
}
