import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { waitForRoomScreenReady } from '../helpers/waits';
import { RoomPage } from './RoomPage';

export type FibIdentity = {
  readonly role: '大聪明' | '老实人' | '瞎掰王';
  readonly word: string;
  readonly definition: string | null;
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
    await this.page.getByTestId(TESTIDS.roomMenuButton).click();
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
    await this.page.getByTestId(TESTIDS.roomMenuButton).click();
    await this.page.getByText('分享房间', { exact: true }).click();
    await expect(this.page.getByTestId(TESTIDS.qrCodeModal)).toBeVisible();
  }

  async closeShare(): Promise<void> {
    await this.page.getByTestId(TESTIDS.qrCodeModal).getByRole('button', { name: '关闭' }).click();
    await expect(this.page.getByTestId(TESTIDS.qrCodeModal)).not.toBeVisible();
  }

  async openConfig(): Promise<void> {
    await this.page.getByTestId(TESTIDS.fibConfigureButton).click();
    await expect(this.page.getByTestId(TESTIDS.configScreenRoot)).toBeVisible();
  }

  async fillEmptySeatsWithBots(playerCount: number): Promise<void> {
    await this.page.getByTestId(TESTIDS.roomMenuButton).click();
    await this.page.getByText('填充机器人', { exact: true }).click();
    await expect(this.page.getByText('填充机器人？', { exact: true })).toBeVisible();
    await this.page.getByText('确定', { exact: true }).click();
    await expect(
      this.page.getByText(`等待入座 · ${playerCount}/${playerCount}`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async startRound(): Promise<void> {
    await this.page.getByTestId(TESTIDS.fibStartRoundButton).click();
    await expect(this.page.getByText('正在准备本轮词语', { exact: true })).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.fibViewIdentityButton)).toBeVisible({
      timeout: 30_000,
    });
  }

  async viewIdentity(): Promise<FibIdentity> {
    await this.page.getByTestId(TESTIDS.fibViewIdentityButton).click();
    return this.readOpenIdentity();
  }

  async viewResult(): Promise<FibIdentity> {
    await this.page.getByTestId(TESTIDS.fibViewResultButton).click();
    return this.readOpenIdentity();
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
    await this.page.getByTestId(TESTIDS.fibRevealRoundButton).click();
    await expect(this.page.getByText('公布答案？', { exact: true })).toBeVisible();
    await this.page.getByText('确定', { exact: true }).click();
    await expect(this.page.getByTestId(TESTIDS.fibNextRoundButton)).toBeVisible({
      timeout: 15_000,
    });
  }

  async startNextRound(): Promise<void> {
    await this.page.getByTestId(TESTIDS.fibNextRoundButton).click();
    await expect(this.page.getByTestId(TESTIDS.fibViewIdentityButton)).toBeVisible({
      timeout: 30_000,
    });
  }

  private async readOpenIdentity(): Promise<FibIdentity> {
    const modal = this.page.getByTestId(TESTIDS.fibIdentityModal);
    await expect(modal).toBeVisible();
    const roleText = await modal.getByTestId(TESTIDS.fibIdentityRole).textContent();
    if (roleText !== '大聪明' && roleText !== '老实人' && roleText !== '瞎掰王') {
      throw new Error(`Unknown Fib identity role: ${roleText ?? '<missing>'}`);
    }
    const word = await modal.getByTestId(TESTIDS.fibIdentityWord).textContent();
    if (word === null || word.trim().length === 0) {
      throw new Error('Fib identity modal did not render a word');
    }
    const definitionLocator = modal.getByTestId(TESTIDS.fibIdentityDefinition);
    const definition =
      (await definitionLocator.count()) === 0 ? null : await definitionLocator.textContent();
    if (definition !== null && definition.trim().length === 0) {
      throw new Error('Fib identity modal rendered an empty definition');
    }
    return { role: roleText, word, definition };
  }
}
