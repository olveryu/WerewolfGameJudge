import { ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { extractRoomCode } from '../helpers/home';
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
  constructor(protected readonly page: Page) {}

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

  async getRoomCode(): Promise<string> {
    return extractRoomCode(this.page);
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
    await expect(this.page.getByTestId('seat-confirm-title')).toHaveText('入座', {
      timeout: 5000,
    });
    await this.page.getByTestId('seat-confirm-ok').click();
    // Wait for seat broadcast to arrive — green seat badge confirms the seat is taken
    await expect(this.page.getByTestId(TESTIDS.mySeatBadge)).toBeVisible({
      timeout: 10_000,
    });
  }

  /** Move from the current seat and confirm the explicit "换座" intent. */
  async moveToSeat(seat: number) {
    await this.getSeatTile(seat).click();
    await expect(this.page.getByTestId('seat-confirm-title')).toHaveText('换座', {
      timeout: 5000,
    });
    await this.page.getByTestId('seat-confirm-ok').click();
    await expect(this.page.getByTestId(TESTIDS.mySeatBadge)).toBeVisible({
      timeout: 10_000,
    });
  }

  /** Click own seat and leave directly from the profile. */
  async standUp(seat: number) {
    await this.getSeatTile(seat).click();
    await expect(this.page.getByTestId('player-profile-card')).toBeVisible({ timeout: 5000 });
    await this.page.getByText('离座', { exact: true }).click();
    await expect(this.page.getByTestId(TESTIDS.seatConfirmModal)).not.toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.mySeatBadge)).not.toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * Host kicks a player from their seat.
   * Taps the occupied seat → profile card opens → clicks "移出座位" → directly kicks (no confirm dialog).
   */
  async kickPlayer(seat: number) {
    await this.getSeatTile(seat).click();
    // Profile card should appear
    await expect(this.page.getByTestId('player-profile-card')).toBeVisible({ timeout: 5000 });
    // Click "移出座位" button inside the profile card — directly executes kick
    await this.page.getByText('移出座位', { exact: true }).click();
    await expect(this.page.getByTestId(TESTIDS.seatConfirmModal)).not.toBeVisible();
    // Wait for kicked seat to show as empty via broadcast
    const tile = this.getSeatTile(seat);
    await expect
      .poll(() => tile.textContent().then((t) => t?.includes('+') ?? false), {
        timeout: 10_000,
        intervals: [250],
        message: `Seat ${seat} did not become empty after kick within 10s`,
      })
      .toBeTruthy();
  }

  /** Check if green seat badge (my seat) is visible anywhere. */
  async expectMyBadgeVisible() {
    await expect(this.page.getByTestId(TESTIDS.mySeatBadge)).toBeVisible({ timeout: 3000 });
  }

  async expectNotSeated(): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.mySeatBadge)).not.toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * Collect seat UI state for a given display number (1-based).
   */
  async collectSeatState(displayNumber: number) {
    const tile = this.getSeatTile(displayNumber - 1);
    const fullText = await tile.textContent().catch(() => null);
    return {
      seatContent: fullText?.trim() ?? null,
      hasPlayerName: fullText !== null && !fullText.includes('+'),
      isEmpty: fullText?.includes('+') ?? true,
    };
  }

  // ---------------------------------------------------------------------------
  // Host Management
  // ---------------------------------------------------------------------------

  /** Open the shared Host-management surface and return its visible panel. */
  async openHostManagement(): Promise<Locator> {
    const entry = this.page.getByTestId(TESTIDS.roomHostManagementButton);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    await entry.click();
    const panel = this.page.getByTestId(TESTIDS.roomHostManagementPanel);
    await expect(panel).toBeVisible();
    return panel;
  }

  /** Close the shared Host-management surface. */
  async closeHostManagement(): Promise<void> {
    await this.page.getByRole('button', { name: '关闭主持管理' }).click();
    await expect(this.page.getByTestId(TESTIDS.roomHostManagementPanel)).not.toBeVisible();
  }

  /** Run an enabled Host action and wait for the management surface to close. */
  async clickHostManagementAction(actionTestID: string): Promise<void> {
    const panel = await this.openHostManagement();
    const action = panel.getByTestId(actionTestID);
    await expect(action).toBeVisible({ timeout: 15_000 });
    await action.click();
    await expect(panel).not.toBeVisible();
  }

  /** Probe whether a Host action is currently exposed, then close the management surface. */
  async isHostManagementActionVisible(actionTestID: string): Promise<boolean> {
    const panel = await this.openHostManagement();
    const isVisible = await panel
      .getByTestId(actionTestID)
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    await this.closeHostManagement();
    return isVisible;
  }

  /** Click a Host action when available, closing the management surface when absent. */
  async tryClickHostManagementAction(actionTestID: string): Promise<boolean> {
    const panel = await this.openHostManagement();
    const action = panel.getByTestId(actionTestID);
    const isVisible = await action
      .waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (!isVisible) {
      await this.closeHostManagement();
      return false;
    }
    await action.click();
    await expect(panel).not.toBeVisible();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Game Flow
  // ---------------------------------------------------------------------------

  /** Click "分配角色" and confirm the dialog. Wait for role assignment to propagate. */
  async prepareRoles() {
    await this.clickHostManagementAction(TESTIDS.prepareToFlipButton);
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
    // All players must complete viewRole before this button appears —
    // server-authoritative broadcast propagation can take several seconds.
    await this.clickHostManagementAction(TESTIDS.startGameButton);
    await expect(this.page.getByText('开始游戏？', { exact: true })).toBeVisible({ timeout: 3000 });
    await this.page.getByText('确定', { exact: true }).click();
  }

  /** Click "重新开始" (restart) and confirm dialog. */
  async restart() {
    await this.clickHostManagementAction(TESTIDS.restartButton);
    await expect(this.page.getByText('重新开始游戏？', { exact: true })).toBeVisible({
      timeout: 3000,
    });
    // After first night, dialog offers "分享战报" / "直接开始" / "取消"
    await this.page.getByText('直接开始', { exact: true }).click();
    // Wait for restart broadcast — the Host preview changes when the room is ready again.
    await expect(
      this.page.getByRole('button', {
        name: '主持管理，下一步：分配角色',
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });
  }

  /** Click the settings button to open config in edit mode. */
  async openSettings() {
    await this.clickHostManagementAction(TESTIDS.roomSettingsButton);
  }

  /** Check if "昨夜信息" button is visible (night ended indicator). */
  async isLastNightInfoVisible(): Promise<boolean> {
    return this.isHostManagementActionVisible(TESTIDS.lastNightInfoButton);
  }

  /** Take a screenshot and attach to test info. */
  async screenshot(testInfo: TestInfo, name: string) {
    const screenshot = await this.page.screenshot();
    await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
  }
}
