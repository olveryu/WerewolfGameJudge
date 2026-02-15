import type { Browser } from '@playwright/test';
import { expect, Page } from '@playwright/test';

import { createPlayerContexts, MultiPlayerFixture } from '../fixtures/app.fixture';
import { ConfigPage } from '../pages/ConfigPage';
import { RoomPage } from '../pages/RoomPage';
import { enterRoomCodeViaNumPad, extractRoomNumber } from './home';
import { getVisibleText } from './ui';
import { waitForRoomScreenReady } from './waits';

/**
 * Multi-player orchestration helpers.
 *
 * Provides high-level flows for setting up N-player games:
 * - Host creates room with a template
 * - Joiners join, take seats
 * - Prepare roles, view roles, start game
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SetupGameOptions {
  /** Number of players (first = host). Default: 2. */
  playerCount?: number;
  /** Template configurator called on ConfigPage before creating room. */
  configureTemplate?: (config: ConfigPage) => Promise<void>;
  /** Whether to start the game (prepare → view roles → start). Default: true. */
  startGame?: boolean;
  /** Suppress verbose PW console output (useful for multi-page tests). Default: false. */
  quietConsole?: boolean;
}

export interface GameSetupResult {
  fixture: MultiPlayerFixture;
  roomNumber: string;
  hostPage: Page;
  joinerPages: Page[];
}

// ---------------------------------------------------------------------------
// Presence stabilization
// ---------------------------------------------------------------------------

/** Max poll attempts before hard-failing. Total timeout ≈ PRESENCE_MAX_ATTEMPTS × PRESENCE_INTERVAL_MS. */
const PRESENCE_MAX_ATTEMPTS = 30;
/** Interval between poll attempts (ms). */
const PRESENCE_INTERVAL_MS = 500;

/**
 * Hard gate: Wait for all joiner presence to be reflected on the host page.
 *
 * Polls for "准备看牌" button visibility (only appears when all seats are filled).
 * Throws with diagnostic info if presence does not stabilize within the timeout.
 *
 * @param hostPage - The host's Playwright page
 * @param joinerPages - All joiner pages (used for keep-alive pings)
 * @param roomCode - Room code for diagnostic messages
 */
async function waitForPresenceStable(
  hostPage: Page,
  joinerPages: Page[],
  roomCode: string,
): Promise<void> {
  for (let attempt = 1; attempt <= PRESENCE_MAX_ATTEMPTS; attempt++) {
    // Ping joiner pages to keep WebSocket connections alive
    for (const joinerPage of joinerPages) {
      await joinerPage.locator('body').count();
    }
    await hostPage.waitForTimeout(PRESENCE_INTERVAL_MS);

    const isPrepareVisible = await hostPage
      .getByText('准备看牌')
      .isVisible()
      .catch(() => false);
    if (isPrepareVisible) return;
  }

  // Hard fail: collect diagnostics for debugging
  const visibleTexts: string[] = [];
  for (const text of ['准备看牌', '等待玩家', '开始游戏']) {
    const visible = await hostPage
      .getByText(text)
      .isVisible()
      .catch(() => false);
    if (visible) visibleTexts.push(text);
  }
  const seatCount = await hostPage
    .locator('[data-testid^="seat-tile-pressable-"]')
    .count()
    .catch(() => -1);

  throw new Error(
    `waitForPresenceStable FAILED after ${PRESENCE_MAX_ATTEMPTS} attempts (room=${roomCode}). ` +
      `Expected ${joinerPages.length + 1} players seated. ` +
      `Visible seat tiles: ${seatCount}. ` +
      `Visible UI texts: [${visibleTexts.join(', ')}]. ` +
      `"准备看牌" button never appeared — presence not stable.`,
  );
}

// ---------------------------------------------------------------------------
// View roles for all players
// ---------------------------------------------------------------------------

async function viewRolesForAll(pages: Page[]): Promise<void> {
  for (const page of pages) {
    await viewRoleWithRetry(page);
  }
  // No fixed timeout needed here — startGame() uses auto-retrying assertion
  // to wait for "开始游戏" button which appears after all VIEWED_ROLE broadcasts.
}

/**
 * Click "查看身份" with retry: handles the race condition where the
 * `assigned` status broadcast hasn't arrived on a joiner page yet.
 *
 * If clicking triggers the "等待房主" alert (disabled button), dismiss it
 * and retry after a brief wait for the next broadcast to arrive.
 */
export async function viewRoleWithRetry(page: Page, maxRetries = 30): Promise<void> {
  const viewBtn = page.getByText('查看身份', { exact: true });
  await expect(viewBtn).toBeVisible({ timeout: 15_000 });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await viewBtn.click();

    // Race: either "我知道了" (role card modal) or "等待房主" (disabled alert)
    const okBtn = page.getByText('我知道了', { exact: true });
    const waitAlert = page.getByText('等待房主点击"准备看牌"分配角色');

    const appeared = await Promise.race([
      okBtn.waitFor({ state: 'visible', timeout: 2000 }).then(() => 'roleCard' as const),
      waitAlert.waitFor({ state: 'visible', timeout: 2000 }).then(() => 'waitAlert' as const),
    ]).catch(() => 'neither' as const);

    if (appeared === 'roleCard') {
      await okBtn.click();
      return;
    }

    if (appeared === 'waitAlert') {
      // Dismiss the "等待房主" alert and retry after broadcast interval
      await page.getByText('确定', { exact: true }).click();
      await page.waitForTimeout(500);
      continue;
    }

    // Neither appeared — retry
    await page.waitForTimeout(500);
  }

  throw new Error(
    `viewRoleWithRetry: "我知道了" never appeared after ${maxRetries} attempts. ` +
      'The assigned status broadcast may not have arrived.',
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set up a complete N-player game ready for night flow.
 *
 * Steps:
 * 1. Create N isolated browser contexts, each logged in
 * 2. Host creates room with the given template
 * 3. Joiners join, take seats
 * 4. (Optionally) Prepare roles → view roles → start game
 *
 * @returns GameSetupResult with fixture, room number, and page references
 */
export async function setupNPlayerGame(
  browser: Browser,
  opts: SetupGameOptions = {},
): Promise<GameSetupResult> {
  const { playerCount = 2, configureTemplate, startGame = true, quietConsole = false } = opts;

  // Step 1: Create all player contexts
  const fixture = await createPlayerContexts(browser, playerCount, { quietConsole });
  const [hostPage, ...joinerPages] = fixture.pages;

  // Step 2: Host creates room
  await hostPage.getByText('创建房间').click();
  const config = new ConfigPage(hostPage);
  await config.waitForCreateMode();

  if (configureTemplate) {
    await configureTemplate(config);
  }

  await config.clickCreate();
  await waitForRoomScreenReady(hostPage, { role: 'host' });

  const roomNumber = await extractRoomNumber(hostPage);

  // Host manually takes seat 0 (no longer auto-seated on room creation)
  const hostRoom = new RoomPage(hostPage);
  await hostRoom.seatAt(0);

  // Step 3: Joiners join and take seats
  for (let i = 0; i < joinerPages.length; i++) {
    const joinerPage = joinerPages[i];
    const seat = i + 1; // Seats 2, 3, 4, ...

    await getVisibleText(joinerPage, '进入房间').first().click();
    await expect(joinerPage.getByText('加入房间')).toBeVisible({ timeout: 5000 });

    await enterRoomCodeViaNumPad(joinerPage, roomNumber);
    await joinerPage.getByText('加入', { exact: true }).click();
    await waitForRoomScreenReady(joinerPage, { role: 'joiner' });

    // Take seat (seatAt waits for "我" badge via auto-retrying assertion)
    const room = new RoomPage(joinerPage);
    await room.seatAt(seat);
  }

  if (!startGame) {
    return { fixture, roomNumber, hostPage, joinerPages };
  }

  // Step 4: Presence stabilization
  await waitForPresenceStable(hostPage, joinerPages, roomNumber);

  // Step 5: Prepare roles
  await hostRoom.prepareRoles();

  // Step 6: All view roles
  await viewRolesForAll(fixture.pages);

  // Step 7: Start game
  await hostRoom.startGame();

  return { fixture, roomNumber, hostPage, joinerPages };
}
