import {
  TEMPLATE_CATEGORY_LABELS,
  type TemplateCategory,
} from '@game-judge/game-engine/games/werewolf/public';
import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';

/**
 * BoardPickerPage Page Object
 *
 * Encapsulates BoardPicker screen interactions:
 * - Waiting for the screen to be visible
 * - Selecting a preset template by name
 *
 * The BoardPicker is the intermediate screen between Home and Config.
 * After clicking "创建房间", users land here to browse / select a preset.
 */
export class BoardPickerPage {
  constructor(private readonly page: Page) {}

  // ---------------------------------------------------------------------------
  // Assertions / Waits
  // ---------------------------------------------------------------------------

  /** Wait until the board picker screen is visible. */
  async waitForReady() {
    await expect(this.page.getByTestId(TESTIDS.boardPickerScreenRoot)).toBeVisible({
      timeout: 10000,
    });
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Select a preset template by name: expand its card, then press "以此为基础".
   *
   * The picker defaults to the Classic tab, so a card in another category is
   * rendered only after its `category` tab is pressed.
   */
  async selectTemplate(name: string, category?: TemplateCategory) {
    if (category !== undefined) {
      const tab = this.page.getByTestId(TESTIDS.boardPickerCategoryTab(category));
      await expect(tab).toContainText(TEMPLATE_CATEGORY_LABELS[category]);
      await tab.click();
      await expect(tab).toHaveAttribute('aria-pressed', 'true');
    }
    const cardHeader = this.page.getByTestId(TESTIDS.boardCardHeader(name));
    await expect(cardHeader).toContainText(name, { timeout: 5000 });
    await cardHeader.click();
    await expect(cardHeader).toHaveAttribute('aria-expanded', 'true');

    const selectButton = this.page.getByTestId(TESTIDS.boardCardSelectButton(name));
    await expect(selectButton).toHaveText('以此为基础');
    await selectButton.click();
  }

  /**
   * Select the default template ("预女猎白") — convenience shortcut.
   */
  async selectDefaultTemplate() {
    await this.selectTemplate('预女猎白');
  }
}
