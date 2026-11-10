import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { confirmAlert, pressAlertButton } from '../helpers/alerts';
import {
  enterRoomCodeViaNumPad,
  extractRoomCode,
  openJoinRoomDialog,
  submitJoinRoom,
} from '../helpers/home';
import { waitForRoomScreenReady } from '../helpers/waits';

/** How long a seat change takes to reach every client. */
const SEAT_BROADCAST_TIMEOUT_MS = 10_000;
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
    return this.page.getByTestId(TESTIDS.seatTilePressable(seat));
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

  /** Join a room from the home screen by entering the room code on the numpad. */
  async joinViaCode(roomCode: string): Promise<void> {
    await openJoinRoomDialog(this.page);
    await enterRoomCodeViaNumPad(this.page, roomCode);
    await submitJoinRoom(this.page);
    await waitForRoomScreenReady(this.page, { role: 'joiner' });
  }

  /** Assert the seat grid renders exactly `count` seats (seat numbers are contiguous from 0). */
  async expectSeatCount(count: number): Promise<void> {
    await expect(this.getSeatTile(count - 1)).toBeVisible();
    await expect(this.getSeatTile(count)).toHaveCount(0);
  }

  // ---------------------------------------------------------------------------
  // Seat Actions
  // ---------------------------------------------------------------------------

  /** Click a seat and confirm the "入座" dialog. Waits for green seat badge to confirm seat taken. */
  async seatAt(seat: number) {
    await this.getSeatTile(seat).click();
    await expect(this.page.getByTestId(TESTIDS.seatConfirmTitle)).toHaveText('入座', {
      timeout: 5000,
    });
    await this.page.getByTestId(TESTIDS.seatConfirmOk).click();
    // Wait for seat broadcast to arrive — green seat badge confirms the seat is taken
    await expect(this.page.getByTestId(TESTIDS.mySeatBadge)).toBeVisible({
      timeout: 10_000,
    });
  }

  /** Move from the current seat and confirm the explicit "换座" intent. */
  async moveToSeat(seat: number) {
    await this.getSeatTile(seat).click();
    await expect(this.page.getByTestId(TESTIDS.seatConfirmTitle)).toHaveText('换座', {
      timeout: 5000,
    });
    await this.page.getByTestId(TESTIDS.seatConfirmOk).click();
    await expect(this.page.getByTestId(TESTIDS.mySeatBadge)).toBeVisible({
      timeout: 10_000,
    });
  }

  /** Click own seat and leave directly from the profile. */
  async standUp(seat: number) {
    await this.getSeatTile(seat).click();
    await expect(this.page.getByTestId(TESTIDS.playerProfileCard)).toBeVisible({ timeout: 5000 });
    const leaveSeat = this.page.getByTestId(TESTIDS.playerProfileLeaveSeatButton);
    await expect(leaveSeat).toHaveText('离座');
    await leaveSeat.click();
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
    await expect(this.page.getByTestId(TESTIDS.playerProfileCard)).toBeVisible({ timeout: 5000 });
    // "移出座位" inside the profile card kicks directly
    const kick = this.page.getByTestId(TESTIDS.playerProfileKickButton);
    await expect(kick).toHaveText('移出座位');
    await kick.click();
    await expect(this.page.getByTestId(TESTIDS.seatConfirmModal)).not.toBeVisible();
    await this.expectSeatEmpty(seat);
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

  /** Assert the 0-based seat holds a player, waiting for the broadcast to arrive. */
  async expectSeatOccupied(seat: number): Promise<void> {
    await expect(this.getSeatTile(seat)).toHaveAttribute('data-empty', 'false', {
      timeout: SEAT_BROADCAST_TIMEOUT_MS,
    });
  }

  /** Assert the 0-based seat is empty, waiting for the broadcast to arrive. */
  async expectSeatEmpty(seat: number): Promise<void> {
    await expect(this.getSeatTile(seat)).toHaveAttribute('data-empty', 'true', {
      timeout: SEAT_BROADCAST_TIMEOUT_MS,
    });
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
    const close = this.page.getByTestId(TESTIDS.roomHostManagementCloseButton);
    await expect(close).toHaveAccessibleName('关闭主持管理');
    await close.click();
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

  /** Confirm the dialog a Host action opens: wait for its title, then press 确定. */
  async confirmHostActionDialog(dialogTitle: string): Promise<void> {
    await confirmAlert(this.page, dialogTitle);
  }

  /** Run a Host action that asks for confirmation, and confirm its dialog. */
  async clickHostManagementActionAndConfirm(
    actionTestID: string,
    dialogTitle: string,
  ): Promise<void> {
    await this.clickHostManagementAction(actionTestID);
    await this.confirmHostActionDialog(dialogTitle);
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
    await this.clickHostManagementActionAndConfirm(TESTIDS.assignRolesButton, '分配角色？');
    // The view-identity button renders once the assignment broadcast arrives.
    await expect(this.viewIdentityButton()).toBeEnabled({ timeout: 15_000 });
  }

  /** The bottom view-identity button, shared by every game. */
  viewIdentityButton(): Locator {
    return this.page.getByTestId(TESTIDS.roomViewIdentityButton);
  }

  /** Open the own role card through 查看身份 and return the dialog. */
  async openRoleCard(): Promise<Locator> {
    const viewButton = this.viewIdentityButton();
    await expect(viewButton).toHaveText('查看身份', { timeout: 15_000 });
    await viewButton.click();
    const modal = this.page.getByTestId(TESTIDS.roleCardModal);
    // The first view may play the viewer's reveal effect before the card shows.
    await expect(modal).toBeVisible({ timeout: 15_000 });
    return modal;
  }

  /** Close the open role card through its 知道了 button. */
  async closeRoleCard(): Promise<void> {
    const confirm = this.page.getByTestId(TESTIDS.roleCardConfirmButton);
    await expect(confirm).toHaveText('知道了');
    // The card may overflow a short viewport; a DOM click skips the viewport check.
    await confirm.evaluate((element: HTMLElement) => element.click());
    await expect(this.page.getByTestId(TESTIDS.roleCardModal)).toBeHidden();
  }

  /** View the own role card and close it. */
  async viewRole(): Promise<void> {
    await this.openRoleCard();
    await this.closeRoleCard();
  }

  /** View the own role card, returning the role's display name (e.g. "狼人", "预言家"). */
  async viewRoleAndCapture(): Promise<string> {
    const modal = await this.openRoleCard();
    const displayName = await modal.getByTestId(TESTIDS.roleCardName).innerText();
    await this.closeRoleCard();
    return displayName;
  }

  /** Click "开始游戏" and confirm dialog. */
  async startGame() {
    // All players must complete viewRole before this button appears —
    // server-authoritative broadcast propagation can take several seconds.
    await this.clickHostManagementActionAndConfirm(TESTIDS.startGameButton, '开始游戏？');
  }

  /** Click "返回大厅" (terminal return-to-lobby) and pass the share-report ritual. */
  async returnToLobby() {
    await this.clickHostManagementAction(TESTIDS.returnLobbyButton);
    // Three buttons render as [分享战报, 返回大厅, 取消].
    await pressAlertButton(this.page, {
      title: '返回大厅',
      buttonIndex: 1,
      buttonLabel: '返回大厅',
    });
    // Wait for restart broadcast — the console primary returns when the room is ready again.
    await expect(this.page.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
      '分配角色',
      { timeout: 15_000 },
    );
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
