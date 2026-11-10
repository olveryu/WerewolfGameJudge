import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';

/**
 * Home Screen Helpers
 *
 * Entry into the app: Home readiness, anonymous login, game-mode selection and the
 * join-room dialog. Every element is located by its test id; visible copy is asserted
 * on the located element.
 */

/**
 * Register an auto-dismiss handler for the version announcement, which opens on its own
 * once auth settles. The handler fires before every actionability check, and its trigger
 * is the close button itself, so it disappears after the click.
 */
export async function registerAutoDismissers(page: Page): Promise<void> {
  const closeAnnouncement = page.getByTestId(TESTIDS.homeAnnouncementCloseButton);
  await page.addLocatorHandler(closeAnnouncement, async () => {
    await expect(closeAnnouncement).toHaveAccessibleName('关闭公告');
    await closeAnnouncement.click();
  });
}

/** Wait for Home to render with its auth state settled (the entry buttons enable then). */
export async function waitForAppReady(page: Page, timeoutMs = 15000): Promise<void> {
  await expect(page.getByTestId(TESTIDS.homeScreenRoot)).toBeVisible({ timeout: timeoutMs });
  await expect(page.getByTestId(TESTIDS.homeEnterRoomButton)).toBeEnabled({
    timeout: timeoutMs,
  });
}

/** Complete the explicit Home create-room mode selection. */
export async function startRoomCreation(page: Page, gameType: GameType): Promise<void> {
  await page.getByTestId(TESTIDS.homeCreateRoomButton).click();
  await selectGameMode(page, gameType);
}

/** Select a visible catalog-backed game mode. */
export async function selectGameMode(page: Page, gameType: GameType): Promise<void> {
  await expect(page.getByTestId(TESTIDS.gameModePickerModal)).toBeVisible();
  await page.getByTestId(TESTIDS.gameModePickerOption(gameType)).click();
}

/**
 * Sign in anonymously from Home. A page whose session already restored returns at once.
 * Otherwise 进入房间 asks for a login; after the anonymous login the pending action opens
 * the join-room dialog, which is cancelled to leave Home idle.
 */
export async function ensureAnonLogin(page: Page): Promise<void> {
  await waitForAppReady(page);
  const userName = page.getByTestId(TESTIDS.homeUserName);
  if ((await userName.count()) > 0) return;

  await page.getByTestId(TESTIDS.homeEnterRoomButton).click();
  const loginDialog = page.getByTestId(TESTIDS.loginDialog);
  await expect(loginDialog).toHaveAccessibleName('登录');
  await page.getByTestId(TESTIDS.homeAnonLoginButton).click();
  await expect(userName).toBeVisible({ timeout: 15000 });

  const joinDialog = await openedJoinRoomDialog(page);
  await page.getByTestId(TESTIDS.joinRoomCancelButton).click();
  await expect(joinDialog).toBeHidden();
}

/**
 * Extract room number from room screen header.
 * Assumes we're on a room screen.
 */
export async function extractRoomCode(page: Page): Promise<string> {
  const headerLocator = page.getByTestId(TESTIDS.roomHeader);
  await expect(headerLocator).toBeVisible({ timeout: 15_000 });
  const headerText = await headerLocator.textContent();
  // Match "房间 XXXX" pattern - room number follows "房间 " text
  const match = headerText?.match(/房间\s*(\d{4})/);
  if (!match) throw new Error(`Could not extract room number from: ${headerText}`);
  return match[1]!;
}

/** The join-room dialog, asserted open with its title. */
async function openedJoinRoomDialog(page: Page) {
  const dialog = page.getByTestId(TESTIDS.joinRoomDialog);
  await expect(dialog).toHaveAccessibleName('加入房间', { timeout: 5000 });
  return dialog;
}

/** Open the join-room dialog from Home (进入房间). */
export async function openJoinRoomDialog(page: Page): Promise<void> {
  const entry = page.getByTestId(TESTIDS.homeEnterRoomButton);
  await expect(entry).toContainText('进入房间');
  await entry.click();
  await openedJoinRoomDialog(page);
}

/**
 * Enter a room code using the NumPad component.
 * Call this after the join room dialog is visible.
 *
 * @param page - Playwright Page
 * @param roomCode - 4-digit room code string
 */
export async function enterRoomCodeViaNumPad(page: Page, roomCode: string): Promise<void> {
  await page.getByTestId(TESTIDS.numpadKey('clear')).click();
  for (const digit of roomCode) {
    await page.getByTestId(TESTIDS.numpadKey(digit)).click();
  }
}

/** Press 加入 in the join-room dialog. */
export async function submitJoinRoom(page: Page): Promise<void> {
  const submit = page.getByTestId(TESTIDS.joinRoomSubmitButton);
  await expect(submit).toHaveText('加入');
  await submit.click();
}
