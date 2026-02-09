import { Page, expect, TestInfo } from '@playwright/test';
import { waitForRoomScreenReady } from '../helpers/waits';
import { extractRoomNumber } from '../helpers/home';

/**
 * RoomPage Page Object
 *
 * Encapsulates all Room Screen interactions:
 * - Seat management (sit / stand / switch)
 * - Room status
 * - Game flow triggers (prepare roles, view role, start game, restart)
 */
export class RoomPage {
  constructor(private readonly page: Page) {}

  // ---------------------------------------------------------------------------
  // Selectors
  // ---------------------------------------------------------------------------

  /** Precise locator for a seat tile by 0-based index. */
  getSeatTile(seatIndex: number) {
    const byTestId = this.page.locator(`[data-testid="seat-tile-${seatIndex}"]`);
    const displayNumber = seatIndex + 1;
    const byText = this.page
      .locator(`text="${displayNumber}"`)
      .locator('..')
      .filter({
        has: this.page.locator('text=/^(空|我)$/').or(this.page.locator(`text="${displayNumber}"`)),
      })
      .first()
      .locator('..');
    return byTestId.or(byText).first();
  }

  // ---------------------------------------------------------------------------
  // Waits
  // ---------------------------------------------------------------------------

  async waitForReady(role: 'host' | 'joiner' = 'host') {
    await waitForRoomScreenReady(this.page, { role });
  }

  // ---------------------------------------------------------------------------
  // Room Info
  // ---------------------------------------------------------------------------

  async getRoomNumber(): Promise<string> {
    return extractRoomNumber(this.page);
  }

  /** Count visible seat tiles (excludes pressable overlay). */
  async getSeatCount(): Promise<number> {
    const tiles = this.page.locator(
      '[data-testid^="seat-tile-"]:not([data-testid*="pressable"])',
    );
    return tiles.count();
  }

  // ---------------------------------------------------------------------------
  // Seat Actions
  // ---------------------------------------------------------------------------

  /** Click a seat and confirm the "入座" dialog. */
  async seatAt(seatIndex: number) {
    await this.getSeatTile(seatIndex).click();
    await expect(this.page.getByText('入座', { exact: true })).toBeVisible({ timeout: 5000 });
    await this.page.getByText('确定', { exact: true }).click();
    await this.page.waitForTimeout(500);
  }

  /** Click own seat and confirm "站起" dialog. */
  async standUp(seatIndex: number) {
    await this.getSeatTile(seatIndex).click();
    await expect(this.page.getByText('站起', { exact: true })).toBeVisible({ timeout: 5000 });
    await this.page.getByText('确定', { exact: true }).click();
    await this.page.waitForTimeout(500);
  }

  /** Check if "我" badge is visible anywhere. */
  async expectMyBadgeVisible() {
    await expect(this.page.getByText('我')).toBeVisible({ timeout: 3000 });
  }

  /**
   * Collect seat UI state for a given display number (1-based).
   */
  async collectSeatState(displayNumber: number) {
    const tile = this.getSeatTile(displayNumber - 1);
    const fullText = await tile.textContent().catch(() => null);
    return {
      seatContent: fullText?.trim() ?? null,
      hasPlayerName: fullText !== null && !fullText.includes('空'),
      isEmpty: fullText?.includes('空') ?? true,
    };
  }

  // ---------------------------------------------------------------------------
  // Game Flow
  // ---------------------------------------------------------------------------

  /** Click "准备看牌" and confirm the dialog. */
  async prepareRoles() {
    const btn = this.page.getByText('准备看牌');
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await expect(this.page.getByText('允许看牌？')).toBeVisible({ timeout: 3000 });
    await this.page.getByText('确定', { exact: true }).click();
    await this.page.waitForTimeout(1000);
  }

  /** Click "查看身份" → wait for flip → click "我知道了". */
  async viewAndDismissRole() {
    const viewBtn = this.page.getByText('查看身份', { exact: true });
    await expect(viewBtn).toBeVisible({ timeout: 5000 });
    await viewBtn.click();
    await this.page.waitForTimeout(500);
    const okBtn = this.page.getByText('我知道了', { exact: true });
    await expect(okBtn).toBeVisible({ timeout: 5000 });
    await okBtn.click();
    await this.page.waitForTimeout(300);
  }

  /** Click "开始游戏" and confirm dialog. */
  async startGame() {
    const btn = this.page.getByText('开始游戏');
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await expect(this.page.getByText('开始游戏？')).toBeVisible({ timeout: 3000 });
    await this.page.getByText('确定', { exact: true }).click();
  }

  /** Click "重新开始" (重开) and confirm dialog. */
  async restart() {
    const btn = this.page.getByText('重开');
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await expect(this.page.getByText('重新开始游戏？')).toBeVisible({ timeout: 3000 });
    await this.page.getByText('确定', { exact: true }).click();
    await this.page.waitForTimeout(1000);
  }

  /** Click the settings button to open config in edit mode. */
  async openSettings() {
    await this.page.locator('[data-testid="room-settings-button"]').click();
  }

  /** Check if "查看昨晚信息" button is visible (night ended indicator). */
  async isLastNightInfoVisible(): Promise<boolean> {
    return this.page
      .getByText('查看昨晚信息')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
  }

  /** Take a screenshot and attach to test info. */
  async screenshot(testInfo: TestInfo, name: string) {
    const screenshot = await this.page.screenshot();
    await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
  }
}
