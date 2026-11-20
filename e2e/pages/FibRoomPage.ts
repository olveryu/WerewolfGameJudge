import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { confirmAlert, pressAlertButton } from '../helpers/alerts';
import { RoomPage } from './RoomPage';

export type FibWordDetails = {
  readonly word: string;
  readonly definition: {
    readonly coreMeaning: string;
    readonly usageNote: string;
  } | null;
};

export type FibIdentity = FibWordDetails & {
  readonly role: '大聪明' | '老实人' | '瞎掰王';
};

/** FibKing-only actions layered over the shared room page object. */
export class FibRoomPage extends RoomPage {
  constructor(page: Page) {
    super(page);
  }

  async expectNoWerewolfOverlay(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.roomScreenRoot)).not.toContainText('小助手');
  }

  async expectPlayerCountHeading(playerCount: number): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.roomGameSummaryTitle)).toHaveText(
      `瞎掰王（${playerCount}人）`,
    );
  }

  async expectShareRoomCode(roomCode: string): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.qrCodeModal)).toContainText(`房间号 ${roomCode}`);
  }

  async openUserSettings(): Promise<void> {
    const userSettingsButton = this.page.getByTestId(TESTIDS.roomUserSettingsButton);
    await expect(userSettingsButton).toBeVisible();
    await userSettingsButton.click();
    await expect(this.page.getByTestId(TESTIDS.roomDialogCloseButton)).toBeVisible();
  }

  async returnFromUserSettings(): Promise<void> {
    await this.page.getByTestId(TESTIDS.roomDialogCloseButton).click();
    await this.waitForReady('host');
  }

  async expectOngoing(): Promise<void> {
    // The Ongoing phase has no status ribbon after the guidance redesign;
    // the host's reveal action in the management panel is the phase mark.
    const panel = await this.openHostManagement();
    await expect(panel.getByTestId(TESTIDS.fibRevealRoundButton)).toBeVisible();
    await this.closeHostManagement();
  }

  async openRules(): Promise<void> {
    const roomUrl = this.page.url();
    await this.page.getByTestId(TESTIDS.roomManualButton).click();
    await this.page.getByTestId(TESTIDS.fibRulesButton).click();
    await expect(this.page.getByTestId(TESTIDS.fibRulesScreenRoot)).toBeVisible();
    await expect(this.page).toHaveURL(roomUrl);
  }

  async returnFromRules(): Promise<void> {
    await this.page.getByTestId(TESTIDS.roomDialogCloseButton).click();
    await expect(this.page.getByTestId(TESTIDS.fibRulesScreenRoot)).not.toBeVisible();
    await this.page.getByTestId(TESTIDS.roomManualBackButton).click();
    await expect(this.page.getByTestId(TESTIDS.roomScreenRoot)).toBeVisible();
  }

  async openShare(): Promise<void> {
    await this.page.getByTestId(TESTIDS.roomShareButton).click();
    await expect(this.page.getByTestId(TESTIDS.qrCodeModal)).toBeVisible();
  }

  async closeShare(): Promise<void> {
    const closeButton = this.page.getByTestId(TESTIDS.qrCodeCloseButton);
    await expect(closeButton).toHaveAccessibleName('关闭');
    await closeButton.click();
    await expect(this.page.getByTestId(TESTIDS.qrCodeModal)).not.toBeVisible();
  }

  async openConfig(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.roomSettingsButton).click();
    await expect(
      this.page.getByTestId(TESTIDS.gameConfigField('fibking', 'numberOfPlayers')),
    ).toBeVisible();
  }

  async startRound(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.assignRolesButton).click();
    await this.confirmHostActionDialog('分配角色？');
    await this.closeHostManagement();
    await this.expectFocusedRoomActionVisible(TESTIDS.roomViewIdentityButton, '查看身份');
  }

  /** Viewing phase: the host begins play once every seat has viewed. */
  async beginGame(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.startGameButton).click();
    await this.confirmHostActionDialog('开始游戏？');
    await this.expectOngoing();
  }

  /** Ongoing phase: the host guesses a seat through the guess mode. */
  async guessSeat(seat: number): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.fibGuessSeatButton).click();
    await this.expectHostManagementClosed();
    await this.getSeatTile(seat).click();
    await confirmAlert(this.page, `确定选择 ${seat + 1} 号座位是老实人？`);
    await expect(this.page.getByTestId(TESTIDS.alertTitle)).not.toBeVisible();
  }

  async expectSeatRoleLabel(seat: number, label: string): Promise<void> {
    // The role label renders in the tile wrapper, outside the pressable.
    await expect(this.page.getByTestId(TESTIDS.seatTile(seat))).toContainText(label);
  }

  async viewIdentity(): Promise<FibIdentity> {
    await (await this.viewIdentityButton()).click();
    await pressAlertButton(this.page, { title: '查看身份？', buttonIndex: 1, buttonLabel: '查看' });
    return this.readOpenIdentity();
  }

  async viewResult(): Promise<FibWordDetails> {
    await this.clickRoomAction(TESTIDS.fibViewResultButton);
    const modal = this.page.getByTestId(TESTIDS.fibIdentityModal);
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId(TESTIDS.fibIdentityRole)).toHaveText('公开结果');
    return this.readOpenWordDetails();
  }

  async closeIdentity(): Promise<void> {
    const modal = this.page.getByTestId(TESTIDS.fibIdentityModal);
    const confirmButton = modal.getByTestId(TESTIDS.roleCardConfirmButton);
    await expect(confirmButton).toHaveText('知道了');
    await confirmButton.click();
    await expect(modal).not.toBeVisible();
  }

  /**
   * Viewing phase: closing the revealed card records the first view.
   */
  async confirmIdentityView(): Promise<void> {
    await this.closeIdentity();
  }

  async revealRound(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.fibRevealRoundButton).click();
    await this.confirmHostActionDialog('公布答案？');
    await this.closeHostManagement();
    await expect(this.page.getByTestId(TESTIDS.fibViewResultButton)).toBeVisible({
      timeout: 15_000,
    });
  }

  async redrawRound(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.fibRedrawRoundButton).click();
    await this.confirmHostActionDialog('重新抽词？');
    await expect(this.page.getByTestId(TESTIDS.fibPreparationStatus)).toBeVisible({
      timeout: 15_000,
    });
    await this.closeHostManagement();
    await this.expectFocusedRoomActionVisible(TESTIDS.roomViewIdentityButton, '查看身份');
  }

  async restartGame(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.restartButton).click();
    await pressAlertButton(this.page, {
      title: '重新开始？',
      buttonIndex: 1,
      buttonLabel: '重新开始',
    });
    await this.expectHostManagementAction(TESTIDS.assignRolesButton, '分配角色');
  }

  async expectLobbySeatOperations(): Promise<void> {
    await this.openHostManagement();
    await expect(this.page.getByTestId(TESTIDS.roomClearSeatsButton)).toBeVisible();
    await this.closeHostManagement();
    await expect(this.page.getByTestId(TESTIDS.roomShareButton)).toBeVisible();
  }

  private async expectHostManagementClosed(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.roomHostManagementPanel)).not.toBeVisible();
  }

  private async readOpenIdentity(): Promise<FibIdentity> {
    const modal = this.page.getByTestId(TESTIDS.fibIdentityModal);
    await expect(modal).toBeVisible();
    const roleText = await modal.getByTestId(TESTIDS.fibIdentityRole).textContent();
    if (roleText !== '大聪明' && roleText !== '老实人' && roleText !== '瞎掰王') {
      throw new Error(`Unknown Fib identity role: ${roleText ?? '<missing>'}`);
    }
    return { role: roleText, ...(await this.readOpenWordDetails()) };
  }

  private async readOpenWordDetails(): Promise<FibWordDetails> {
    const modal = this.page.getByTestId(TESTIDS.fibIdentityModal);
    const word = await modal.getByTestId(TESTIDS.fibIdentityWord).textContent();
    if (word === null || word.trim().length === 0) {
      throw new Error('Fib identity modal did not render a word');
    }
    const coreMeaningLocator = modal.getByTestId(TESTIDS.fibIdentityCoreMeaning);
    const usageNoteLocator = modal.getByTestId(TESTIDS.fibIdentityUsageNote);
    const [coreMeaningCount, usageNoteCount] = await Promise.all([
      coreMeaningLocator.count(),
      usageNoteLocator.count(),
    ]);
    if (coreMeaningCount !== usageNoteCount) {
      throw new Error('Fib identity modal rendered a partial definition');
    }
    if (coreMeaningCount === 0) {
      return { word, definition: null };
    }
    const [coreMeaning, usageNote] = await Promise.all([
      coreMeaningLocator.textContent(),
      usageNoteLocator.textContent(),
    ]);
    if (
      coreMeaning === null ||
      coreMeaning.trim().length === 0 ||
      usageNote === null ||
      usageNote.trim().length === 0
    ) {
      throw new Error('Fib identity modal rendered an empty definition field');
    }
    return { word, definition: { coreMeaning, usageNote } };
  }
}
