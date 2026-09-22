/** Pictionary configuration interactions used by browser-level game flows. */

import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';

/** Operates the Pictionary create-room configuration screen. */
export class PictionaryConfigPage {
  constructor(private readonly page: Page) {}

  /** Wait until the create form has loaded with its authoritative defaults. */
  async waitForCreateMode(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.configScreenRoot)).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText('你画我猜接龙设置', { exact: true })).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.pictionaryConfigPlayerCount)).toHaveText('6');
    await expect(
      this.page.getByTestId(TESTIDS.pictionaryConfigDurationOption('guess', 45)),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      this.page.getByTestId(TESTIDS.pictionaryConfigDurationOption('gallery', 5)),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(this.page.getByTestId(TESTIDS.pictionaryConfigSubmitButton)).toHaveText(
      '创建房间',
    );
  }

  /** Configure manual drawing while retaining default text and gallery deadlines. */
  async configureFourPlayerManualGame(): Promise<void> {
    const decrementButton = this.page.getByRole('button', { name: '减少人数' });
    await decrementButton.click();
    await decrementButton.click();
    await expect(this.page.getByTestId(TESTIDS.pictionaryConfigPlayerCount)).toHaveText('4');

    await this.selectDuration('drawing', 'unlimited');
    await this.selectDuration('transition', 0);
  }

  /** Submit the form and create the room. */
  async createRoom(): Promise<void> {
    await this.page.getByTestId(TESTIDS.pictionaryConfigSubmitButton).click();
  }

  private async selectDuration(
    setting: 'drawing' | 'guess' | 'transition' | 'gallery',
    value: number | 'unlimited',
  ): Promise<void> {
    const option = this.page.getByTestId(TESTIDS.pictionaryConfigDurationOption(setting, value));
    await option.click();
    await expect(option).toHaveAttribute('aria-checked', 'true');
  }
}
