import { expect, Page, TestInfo } from '@playwright/test';
import { ROLE_SPECS } from '@werewolf/game-engine/models/roles';

import { extractRoomNumber } from '../helpers/home';
import { waitForRoomScreenReady } from '../helpers/waits';

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

  /** Precise locator for a seat tile by 0-based seat number. */
  getSeatTile(seat: number) {
    return this.page.locator(`[data-testid="seat-tile-pressable-${seat}"]`);
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
    const tiles = this.page.locator('[data-testid^="seat-tile-pressable-"]');
    return tiles.count();
  }

  // ---------------------------------------------------------------------------
  // Seat Actions
  // ---------------------------------------------------------------------------

  /** Click a seat and confirm the "入座" dialog. Waits for green seat badge to confirm seat taken. */
  async seatAt(seat: number) {
    await this.getSeatTile(seat).click();
    await expect(this.page.getByText('入座', { exact: true })).toBeVisible({ timeout: 5000 });
    await this.page.getByText('确定', { exact: true }).click();
    // Wait for seat broadcast to arrive — green seat badge confirms the seat is taken
    await expect(this.page.locator('[data-testid="my-seat-badge"]')).toBeVisible({
      timeout: 10_000,
    });
  }

  /** Click own seat and confirm "离座" dialog. */
  async standUp(seat: number) {
    await this.getSeatTile(seat).click();
    await expect(this.page.getByText('离座', { exact: true })).toBeVisible({ timeout: 5000 });
    await this.page.getByText('确定', { exact: true }).click();
    // Wait for green seat badge to disappear, confirming stand-up broadcast arrived
    await expect(this.page.locator('[data-testid="my-seat-badge"]')).not.toBeVisible({
      timeout: 5000,
    });
  }

  /** Check if green seat badge (my seat) is visible anywhere. */
  async expectMyBadgeVisible() {
    await expect(this.page.locator('[data-testid="my-seat-badge"]')).toBeVisible({ timeout: 3000 });
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

  /** Click "分配角色" and confirm the dialog. Wait for role assignment to propagate. */
  async prepareRoles() {
    const btn = this.page.getByTestId('prepare-to-flip-button');
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await expect(this.page.getByText('分配角色？')).toBeVisible({ timeout: 3000 });
    await this.page.getByText('确定', { exact: true }).click();
    // Wait for role assignment broadcast to arrive ("查看身份" becomes enabled)
    // instead of fixed timeout — server-authoritative mode has variable latency.
    await expect(this.page.getByRole('button', { name: '查看身份' })).toBeEnabled({
      timeout: 15_000,
    });
  }

  /** Click "查看身份" → wait for flip → click "知道了". */
  async viewAndDismissRole() {
    const viewBtn = this.page.getByRole('button', { name: '查看身份' });
    await expect(viewBtn).toBeVisible({ timeout: 15_000 });

    for (let attempt = 1; attempt <= 50; attempt++) {
      await viewBtn.click();

      const okBtn = this.page.getByText('知道了', { exact: true });
      const waitAlert = this.page.getByText('等待房主分配角色…');

      const appeared = await Promise.race([
        okBtn.waitFor({ state: 'visible', timeout: 2000 }).then(() => 'roleCard' as const),
        waitAlert.waitFor({ state: 'visible', timeout: 2000 }).then(() => 'waitAlert' as const),
      ]).catch(() => 'neither' as const);

      if (appeared === 'roleCard') {
        await okBtn.click();
        return;
      }
      if (appeared === 'waitAlert') {
        await this.page.getByText('确定', { exact: true }).click();
        // Wait for alert to disappear before retrying
        await waitAlert.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
        continue;
      }
      // Poll cadence for retry loop
      await this.page.waitForTimeout(300);
    }
    throw new Error('viewAndDismissRole: "知道了" never appeared after retries.');
  }

  /**
   * Click "查看身份" → capture role displayName from RoleCardSimple → click "知道了".
   *
   * Same retry logic as viewAndDismissRole but reads the visible role name
   * before dismissing. Returns the Chinese displayName (e.g. "狼人", "预言家").
   */
  async viewRoleAndCapture(): Promise<string> {
    const KNOWN_ROLES = Object.values(ROLE_SPECS).map((s) => s.displayName);

    const viewBtn = this.page.getByRole('button', { name: '查看身份' });
    await expect(viewBtn).toBeVisible({ timeout: 15_000 });

    for (let attempt = 1; attempt <= 50; attempt++) {
      await viewBtn.click();

      const okBtn = this.page.getByText('知道了', { exact: true });
      const waitAlert = this.page.getByText('等待房主分配角色…');

      const appeared = await Promise.race([
        okBtn.waitFor({ state: 'visible', timeout: 2000 }).then(() => 'roleCard' as const),
        waitAlert.waitFor({ state: 'visible', timeout: 2000 }).then(() => 'waitAlert' as const),
      ]).catch(() => 'neither' as const);

      if (appeared === 'roleCard') {
        // Capture role name before dismissing — check longest names first
        // to avoid "狼人" matching before "狼美人" (sorted by length desc)
        //
        // IMPORTANT: Scope search to the modal card container, NOT the entire page.
        // The RoomScreen's BoardInfoCard shows role composition text (e.g. "守卫")
        // behind the modal overlay, which would cause false matches if we
        // searched the full page.
        const sorted = [...KNOWN_ROLES].sort((a, b) => b.length - a.length);
        const modalCard = this.page.locator('[data-testid="role-card-modal"]');
        let capturedRole = 'unknown';
        for (const name of sorted) {
          const visible = await modalCard
            .getByText(name, { exact: true })
            .first()
            .isVisible()
            .catch(() => false);
          if (visible) {
            capturedRole = name;
            break;
          }
        }
        // evaluate click bypasses all Playwright viewport/actionability checks
        // — role card modal may overflow the viewport on smaller screens
        await okBtn.evaluate((el) => (el as HTMLElement).click());
        return capturedRole;
      }

      if (appeared === 'waitAlert') {
        await this.page.getByText('确定', { exact: true }).click();
        // Wait for alert to disappear before retrying
        await waitAlert.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
        continue;
      }
      // Poll cadence for retry loop
      await this.page.waitForTimeout(300);
    }
    throw new Error('viewRoleAndCapture: "知道了" never appeared after retries.');
  }

  /** Click "开始游戏" and confirm dialog. */
  async startGame() {
    const btn = this.page.getByTestId('start-game-button');
    // All players must complete viewRole before this button appears —
    // server-authoritative broadcast propagation can take several seconds.
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    await expect(this.page.getByText('开始游戏？', { exact: true })).toBeVisible({ timeout: 3000 });
    await this.page.getByText('确定', { exact: true }).click();
  }

  /** Click "重新开始" (重开) and confirm dialog. */
  async restart() {
    const btn = this.page.getByTestId('restart-button');
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await expect(this.page.getByText('重新开始游戏？', { exact: true })).toBeVisible({
      timeout: 3000,
    });
    await this.page.getByText('确定', { exact: true }).click();
    // Wait for restart broadcast — "分配角色" reappears when status resets
    await expect(this.page.getByTestId('prepare-to-flip-button')).toBeVisible({ timeout: 15_000 });
  }

  /** Click the settings button to open config in edit mode. */
  async openSettings() {
    await this.page.locator('[data-testid="room-settings-button"]').click();
  }

  /**
   * Disable role reveal animation so E2E tests see the static "知道了" card.
   *
   * Opens HostMenuDropdown → clicks "游戏设置" → selects "无动画" → closes sheet.
   * Uses stable testID selectors where available, text selector for menu item.
   */
  async setAnimationNone() {
    // Open host menu via ⋯ button
    const menuBtn = this.page.locator('[data-testid="room-menu-button"]');
    await menuBtn.waitFor({ state: 'visible', timeout: 3000 });
    await menuBtn.click();

    // Click "游戏设置" in dropdown menu → opens SettingsSheet
    const settingsItem = this.page.getByText('游戏设置', { exact: true });
    await settingsItem.waitFor({ state: 'visible', timeout: 3000 });
    await settingsItem.click();

    // Click the "无动画" option
    const noneOption = this.page.locator('[data-testid="settings-animation-option-none"]');
    await noneOption.waitFor({ state: 'visible', timeout: 3000 });
    await noneOption.click();

    // Close settings sheet by clicking the overlay backdrop
    const overlay = this.page.locator('[data-testid="room-settings-overlay"]');
    await overlay.click({ position: { x: 5, y: 5 }, force: true });
    await overlay.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }

  /** Check if "昨夜信息" button is visible (night ended indicator). */
  async isLastNightInfoVisible(): Promise<boolean> {
    return this.page
      .getByTestId('last-night-info-button')
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
  }

  /** Take a screenshot and attach to test info. */
  async screenshot(testInfo: TestInfo, name: string) {
    const screenshot = await this.page.screenshot();
    await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
  }
}
