import { Page, expect } from '@playwright/test';
import { getVisibleText } from '../helpers/ui';
import { TESTIDS } from '../../src/testids';

/**
 * HomePage Page Object
 *
 * Encapsulates all Home Screen interactions:
 * - Navigation tiles
 * - Login state verification
 * - Room creation / join entry points
 */
export class HomePage {
  constructor(private readonly page: Page) {}

  // ---------------------------------------------------------------------------
  // Selectors (single source of truth for UI text / testIDs)
  // ---------------------------------------------------------------------------

  private get enterRoomButton() {
    return this.page.locator(`[data-testid="${TESTIDS.homeEnterRoomButton}"]`);
  }

  private get createRoomButton() {
    return this.page.locator(`[data-testid="${TESTIDS.homeCreateRoomButton}"]`);
  }

  private get returnLastGameButton() {
    return this.page.locator(`[data-testid="${TESTIDS.homeReturnLastGameButton}"]`);
  }

  private get settingsButton() {
    return this.page.getByText('设置', { exact: true });
  }

  // ---------------------------------------------------------------------------
  // Assertions
  // ---------------------------------------------------------------------------

  async expectNavigationTilesVisible() {
    await expect(this.page.getByText('进入房间')).toBeVisible({ timeout: 10000 });
    await expect(this.page.getByText('创建房间')).toBeVisible();
    await expect(this.page.getByText('返回上局')).toBeVisible();
    await expect(this.settingsButton).toBeVisible();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async clickCreateRoom() {
    await this.page.getByText('创建房间').click();
  }

  async clickJoinRoom() {
    await getVisibleText(this.page, '进入房间').first().click();
  }

  async clickSettings() {
    await this.settingsButton.click();
  }
}
