import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';

/** FibKing-owned config interactions over the shared GameConfig route. */
export class FibConfigPage {
  constructor(private readonly page: Page) {}

  async waitForCreateMode(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.configScreenRoot)).toBeVisible({
      timeout: 10_000,
    });
    await expect(this.page.getByText('瞎掰王设置', { exact: true })).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.fibPlayerCountInput)).toHaveValue('8');
    await expect(this.page.getByTestId(TESTIDS.fibConfigSubmitButton)).toHaveText('创建房间');
  }

  async setPlayerCount(count: number): Promise<void> {
    if (!Number.isSafeInteger(count) || count < 4) {
      throw new Error(`FibConfigPage requires a safe player count >= 4, received ${count}`);
    }
    const input = this.page.getByTestId(TESTIDS.fibPlayerCountInput);
    await input.fill(String(count));
    await expect(input).toHaveValue(String(count));
  }

  async increment(): Promise<void> {
    await this.page.getByRole('button', { name: '增加人数' }).click();
  }

  async expectPlayerCount(count: number): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.fibPlayerCountInput)).toHaveValue(String(count));
  }

  async createRoom(): Promise<void> {
    await this.page.getByTestId(TESTIDS.fibConfigSubmitButton).click();
  }

  async save(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.fibConfigSubmitButton)).toHaveText('保存设置');
    await this.page.getByTestId(TESTIDS.fibConfigSubmitButton).click();
  }

  async saveExpectingRejectedShrink(): Promise<void> {
    await this.save();
    await expect(this.page.getByText('更新房间设置失败', { exact: true })).toBeVisible();
    await expect(
      this.page.getByText('目标人数之外仍有真人入座，请先让这些玩家离座或换到保留座位', {
        exact: true,
      }),
    ).toBeVisible();
    await this.page.getByText('确定', { exact: true }).click();
    await expect(this.page.getByTestId(TESTIDS.alertModalOverlay)).not.toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.configScreenRoot)).toBeVisible();
  }
}
