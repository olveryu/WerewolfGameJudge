import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { openJoinRoomDialog, startRoomCreation } from '../helpers/home';

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
  // Selectors (single source of truth for testIDs)
  // ---------------------------------------------------------------------------

  private get enterRoomButton() {
    return this.page.getByTestId(TESTIDS.homeEnterRoomButton);
  }

  private get createRoomButton() {
    return this.page.getByTestId(TESTIDS.homeCreateRoomButton);
  }

  private get recentRoomsButton() {
    return this.page.getByTestId(TESTIDS.homeReturnLastGameButton);
  }

  private get settingsButton() {
    return this.page.getByTestId(TESTIDS.homeSettingsButton);
  }

  // ---------------------------------------------------------------------------
  // Assertions
  // ---------------------------------------------------------------------------

  async expectNavigationTilesVisible() {
    await expect(this.enterRoomButton).toContainText('进入房间', { timeout: 10000 });
    await expect(this.createRoomButton).toBeVisible();
    await expect(this.recentRoomsButton).toContainText('最近房间');
    await expect(this.settingsButton).toBeVisible();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async clickCreateRoom(gameType: GameType) {
    await startRoomCreation(this.page, gameType);
  }

  async clickJoinRoom() {
    await openJoinRoomDialog(this.page);
  }

  async clickSettings() {
    await this.settingsButton.click();
  }
}
