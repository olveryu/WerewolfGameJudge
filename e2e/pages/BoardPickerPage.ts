import { expect, Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';

/**
 * BoardPickerPage Page Object
 *
 * Encapsulates BoardPicker screen interactions:
 * - Waiting for the screen to be visible
 * - Selecting a preset template by name
 * - Navigating to custom config
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
    await expect(this.page.locator(`[data-testid="${TESTIDS.boardPickerScreenRoot}"]`)).toBeVisible(
      { timeout: 10000 },
    );
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Select a preset template by name.
   *
   * Clicks the template card header (which navigates to Config with that preset).
   * The card title is a TouchableOpacity that expands/collapses. Since we want
   * to navigate, we need to expand first, then click "选择此模板".
   */
  async selectTemplate(name: string) {
    const root = this.page.locator(`[data-testid="${TESTIDS.boardPickerScreenRoot}"]`);
    // Click the card to expand it
    const cardTitle = root.getByText(name, { exact: true }).first();
    await cardTitle.scrollIntoViewIfNeeded();
    await expect(cardTitle).toBeVisible({ timeout: 5000 });
    await cardTitle.click();

    // Click the "选择此模板" button in the expanded card
    const selectButton = root.getByText('选择此模板').first();
    await expect(selectButton).toBeVisible({ timeout: 3000 });
    await selectButton.click();
  }

  /**
   * Select the default template ("预女猎白") — convenience shortcut.
   */
  async selectDefaultTemplate() {
    await this.selectTemplate('预女猎白');
  }

  /**
   * Click the custom config entry at the bottom.
   */
  async clickCustomConfig() {
    const root = this.page.locator(`[data-testid="${TESTIDS.boardPickerScreenRoot}"]`);
    const customBtn = root.getByText('从零开始自定义配置');
    await expect(customBtn).toBeVisible({ timeout: 5000 });
    await customBtn.click();
  }
}
