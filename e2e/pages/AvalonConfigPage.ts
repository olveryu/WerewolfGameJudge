import { expect, type Page } from '@playwright/test';

/**
 * Avalon-owned config interactions over the shared GameConfig route.
 *
 * Player count is a stepper (GameSettingsStepper), not a text input:
 * the count testID sits on the value Text, +/- buttons carry the
 * accessibility labels 增加人数 / 减少人数.
 */
export class AvalonConfigPage {
  constructor(private readonly page: Page) {}

  async waitForCreateMode(): Promise<void> {
    await expect(this.page.getByTestId('avalon-config')).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByTestId('avalon-player-count')).toHaveText('6');
    await expect(this.page.getByTestId('avalon-config-submit')).toHaveText('创建房间');
  }

  /** Step the player count to the target (default config is 6 players). */
  async setPlayerCount(target: number): Promise<void> {
    const value = this.page.getByTestId('avalon-player-count');
    const currentText = await value.textContent();
    const current = Number(currentText?.trim());
    if (!Number.isSafeInteger(current)) {
      throw new Error(`AvalonConfigPage: unreadable player count "${currentText}"`);
    }
    const diff = target - current;
    const buttonName = diff > 0 ? '增加人数' : '减少人数';
    for (let i = 0; i < Math.abs(diff); i += 1) {
      await this.page.getByRole('button', { name: buttonName }).click();
    }
    await expect(value).toHaveText(String(target));
    // Board preview follows the count (fixed board per player count).
    await expect(this.page.getByText(`本局板子（${target} 人）`, { exact: true })).toBeVisible();
  }

  /** Public vote mode is the config default; click anyway to pin it explicitly. */
  async selectPublicVoteMode(): Promise<void> {
    await this.page.getByTestId('avalon-vote-mode-public').click();
  }

  async createRoom(): Promise<void> {
    await this.page.getByTestId('avalon-config-submit').click();
  }
}
