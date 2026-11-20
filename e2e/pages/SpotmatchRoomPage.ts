import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { pressAlertButton } from '../helpers/alerts';
import { HomePage } from './HomePage';
import { RoomPage } from './RoomPage';

export class SpotmatchRoomPage extends RoomPage {
  constructor(page: Page) {
    super(page);
  }

  async createTwoPlayerRoom() {
    await new HomePage(this.page).clickCreateRoom('spotmatch');
    const decrement = this.page.getByTestId(
      TESTIDS.gameConfigFieldDecrement('spotmatch', 'numberOfPlayers'),
    );
    await decrement.click();
    await decrement.click();
    await this.page
      .getByTestId(TESTIDS.gameConfigFieldOption('spotmatch', 'cardsPerPlayer', '5'))
      .click();
    await this.page.getByTestId(TESTIDS.gameConfigSubmit('spotmatch')).click();
    await this.waitForReady();
  }

  async ownInstance() {
    return this.page.getByTestId(TESTIDS.spotmatchOwnCard).getAttribute('data-instance-id');
  }

  override async returnToLobby() {
    await this.clickHostManagementAction(TESTIDS.restartButton);
    await pressAlertButton(this.page, {
      title: '重新开始？',
      buttonIndex: 1,
      buttonLabel: '重新开始',
    });
    await this.expectHostManagementAction(TESTIDS.startGameButton, '开始游戏');
  }

  async playCorrectCard() {
    const central = this.page.getByTestId(TESTIDS.spotmatchCentralCard);
    const own = this.page.getByTestId(TESTIDS.spotmatchOwnCard);
    await expect
      .poll(() =>
        own.evaluate((card) =>
          Array.from(card.querySelectorAll('button')).every((button) => !button.disabled),
        ),
      )
      .toBe(true);
    const centralSymbols = await central.evaluate((card) =>
      Array.from(card.querySelectorAll('[data-symbol-id]'), (node) =>
        Number(node.getAttribute('data-symbol-id')),
      ),
    );
    const ownSymbols = await own.evaluate((card) =>
      Array.from(card.querySelectorAll('[data-symbol-id]'), (node) =>
        Number(node.getAttribute('data-symbol-id')),
      ),
    );
    const symbol = ownSymbols.find((value) => centralSymbols.includes(value));
    if (symbol === undefined) throw new Error('Rendered cards have no match');
    const old = await central.getAttribute('data-instance-id');
    await own.getByTestId(TESTIDS.spotmatchSymbol(symbol)).click();
    await expect(central).not.toHaveAttribute('data-instance-id', old ?? '');
  }

  async expectCardsFit() {
    for (const id of [TESTIDS.spotmatchCentralCard, TESTIDS.spotmatchOwnCard]) {
      const card = this.page.getByTestId(id);
      await expect(card).toBeInViewport({ ratio: 1 });
      const geometry = await card.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const symbols = Array.from(element.querySelectorAll('[data-symbol-id]'), (node) =>
          node.getBoundingClientRect(),
        );
        return {
          isLandscape: bounds.width > bounds.height,
          count: symbols.length,
          minTarget: Math.min(...symbols.map((box) => Math.min(box.width, box.height))),
          inBounds: symbols.every(
            (box) =>
              box.left >= bounds.left &&
              box.top >= bounds.top &&
              box.right <= bounds.right &&
              box.bottom <= bounds.bottom,
          ),
          overlap: symbols.some((a, index) =>
            symbols
              .slice(index + 1)
              .some(
                (b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
              ),
          ),
        };
      });
      expect(geometry.count).toBe(8);
      expect(geometry.minTarget).toBeGreaterThanOrEqual(44);
      expect(geometry.isLandscape).toBe(true);
      expect(geometry.inBounds).toBe(true);
      expect(geometry.overlap).toBe(false);
    }
  }

  async expectResultsFit() {
    const bottomPanel = await this.page.getByTestId(TESTIDS.bottomActionPanel).boundingBox();
    if (bottomPanel === null) throw new Error('Missing standard ended actions');
    const rows = await this.page.getByTestId(TESTIDS.spotmatchResult).evaluate((element) =>
      Array.from(element.querySelectorAll('li'), (row) => {
        const bounds = row.getBoundingClientRect();
        return { top: bounds.top, bottom: bounds.bottom };
      }),
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.top >= 0 && row.bottom <= bottomPanel.y)).toBe(true);
  }
}
