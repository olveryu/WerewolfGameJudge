import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { waitForRoomScreenReady } from '../helpers/waits';
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

  async joinViaCode(roomCode: string): Promise<void> {
    await this.page.getByTestId(TESTIDS.homeEnterRoomButton).click();
    await expect(this.page.getByText('加入房间', { exact: true })).toBeVisible();
    await enterRoomCodeViaNumPad(this.page, roomCode);
    await this.page.getByText('加入', { exact: true }).click();
    await waitForRoomScreenReady(this.page, { role: 'joiner' });
  }

  async expectNoWerewolfOverlay(): Promise<void> {
    await expect(this.page.getByText('小助手', { exact: true })).toHaveCount(0);
  }

  async expectPlayerCountHeading(playerCount: number): Promise<void> {
    await expect(this.page.getByText(`瞎掰王 · ${playerCount}人局`, { exact: true })).toBeVisible();
  }

  async expectPaginationVisible(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.roomSeatPagination)).toBeVisible();
  }

  async expectShareRoomCode(roomCode: string): Promise<void> {
    await expect(this.page.getByText(`房间号 ${roomCode}`, { exact: true })).toBeVisible();
  }

  async openUserSettings(): Promise<void> {
    const userSettingsButton = this.page.getByTestId(TESTIDS.roomUserSettingsButton);
    await expect(userSettingsButton).toBeVisible();
    await userSettingsButton.click();
    await expect(this.page.getByText('设置', { exact: true })).toBeVisible();
  }

  async returnFromUserSettings(): Promise<void> {
    await this.page.getByRole('button', { name: '返回' }).click();
    await this.waitForReady('host');
  }

  async expectOngoing(): Promise<void> {
    await expect(this.page.getByText('描述进行中', { exact: true })).toBeVisible();
  }

  async openRules(): Promise<void> {
    await this.page.getByTestId(TESTIDS.fibRulesButton).click();
    await expect(this.page.getByTestId(TESTIDS.fibRulesScreenRoot)).toBeVisible();
  }

  async returnFromRules(): Promise<void> {
    await this.page.getByRole('button', { name: '返回' }).click();
    await expect(this.page.getByTestId(TESTIDS.roomScreenRoot)).toBeVisible();
  }

  async openShare(): Promise<void> {
    await this.page.getByTestId(TESTIDS.roomShareButton).click();
    await expect(this.page.getByTestId(TESTIDS.qrCodeModal)).toBeVisible();
  }

  async closeShare(): Promise<void> {
    await this.page.getByTestId(TESTIDS.qrCodeModal).getByRole('button', { name: '关闭' }).click();
    await expect(this.page.getByTestId(TESTIDS.qrCodeModal)).not.toBeVisible();
  }

  async openConfig(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.fibConfigureButton).click();
    await expect(this.page.getByTestId(TESTIDS.configScreenRoot)).toBeVisible();
  }

  async fillEmptySeatsWithBots(playerCount: number): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.roomFillBotsButton).click();
    await this.expectHostManagementClosed();
    await expect(this.page.getByText('填充机器人？', { exact: true })).toBeVisible();
    await this.page.getByText('确定', { exact: true }).click();
    await expect(
      this.page.getByText(`等待入座 · ${playerCount}/${playerCount}`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async startRound(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.fibStartRoundButton).click();
    await this.expectHostManagementClosed();
    await expect(this.page.getByTestId(TESTIDS.fibViewIdentityButton)).toBeVisible({
      timeout: 15_000,
    });
  }

  async viewIdentity(): Promise<FibIdentity> {
    await this.page.getByTestId(TESTIDS.fibViewIdentityButton).click();
    return this.readOpenIdentity();
  }

  async viewResult(): Promise<FibWordDetails> {
    await this.page.getByTestId(TESTIDS.fibViewResultButton).click();
    const modal = this.page.getByTestId(TESTIDS.fibIdentityModal);
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId(TESTIDS.fibIdentityRole)).toHaveText('公开结果');
    return this.readOpenWordDetails();
  }

  async closeIdentity(): Promise<void> {
    const modal = this.page.getByTestId(TESTIDS.fibIdentityModal);
    await modal.getByText('知道了', { exact: true }).click();
    await expect(modal).not.toBeVisible();
  }

  async takeOverBot(seat: number): Promise<void> {
    await this.getSeatTile(seat).click({ delay: 650 });
    await expect(this.page.getByTestId(TESTIDS.controlledSeatBanner)).toBeVisible();
  }

  async releaseBot(): Promise<void> {
    await this.page.getByTestId(TESTIDS.controlledSeatReleaseButton).click();
    await expect(this.page.getByTestId(TESTIDS.controlledSeatBanner)).not.toBeVisible();
  }

  async revealRound(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.fibRevealRoundButton).click();
    await this.expectHostManagementClosed();
    await expect(this.page.getByText('公布答案？', { exact: true })).toBeVisible();
    await this.page.getByText('确定', { exact: true }).click();
    await expect(this.page.getByTestId(TESTIDS.fibViewResultButton)).toBeVisible({
      timeout: 15_000,
    });
  }

  async startNextRound(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.fibNextRoundButton).click();
    await this.expectHostManagementClosed();
    await expect(this.page.getByTestId(TESTIDS.fibViewIdentityButton)).toBeVisible({
      timeout: 15_000,
    });
  }

  async endGame(): Promise<void> {
    await this.openHostManagement();
    await this.page.getByTestId(TESTIDS.fibEndGameButton).click();
    await this.expectHostManagementClosed();
    await expect(this.page.getByText('结束游戏？', { exact: true })).toBeVisible();
    await this.page.getByText('确定', { exact: true }).click();
    await expect(
      this.page.getByRole('button', {
        name: '主持管理，下一步：开始本轮',
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });
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
