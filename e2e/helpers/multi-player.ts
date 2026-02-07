import { Page, expect } from '@playwright/test';
import { getVisibleText } from './ui';
import { extractRoomNumber, enterRoomCodeViaNumPad } from './home';
import { waitForRoomScreenReady } from './waits';
import { ConfigPage } from '../pages/ConfigPage';
import { RoomPage } from '../pages/RoomPage';
import { MultiPlayerFixture, createPlayerContexts } from '../fixtures/app.fixture';
import type { Browser } from '@playwright/test';

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

/**
 * Wait for all joiner presence to be reflected on the host page.
 * Polls for "准备看牌" button visibility (only visible when all seats filled).
 */
async function waitForPresenceStable(
  hostPage: Page,
  joinerPages: Page[],
  maxAttempts = 10,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Ping joiner pages to keep connections alive
    for (const joinerPage of joinerPages) {
      await joinerPage.locator('body').count();
    }
    await hostPage.waitForTimeout(200);

    const isPrepareVisible = await hostPage
      .getByText('准备看牌')
      .isVisible()
      .catch(() => false);
    if (isPrepareVisible) return;
  }
  // Not a hard failure — the button may just take a moment
}

// ---------------------------------------------------------------------------
// View roles for all players
// ---------------------------------------------------------------------------

async function viewRolesForAll(pages: Page[]): Promise<void> {
  for (const page of pages) {
    const viewBtn = page.getByText('查看身份', { exact: true });
    await expect(viewBtn).toBeVisible({ timeout: 5000 });
    await viewBtn.click();
    await page.waitForTimeout(500);
    // With animation set to 'none', the static RoleCardSimple appears with "我知道了"
    // If animation is enabled, wait longer for it to auto-complete first
    const okBtn = page.getByText('我知道了', { exact: true });
    await expect(okBtn).toBeVisible({ timeout: 10_000 });
    await okBtn.click();
    await page.waitForTimeout(300);
  }
  // Wait for VIEWED_ROLE messages to propagate
  await pages[0].waitForTimeout(1000);
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

  // Step 3: Joiners join and take seats
  for (let i = 0; i < joinerPages.length; i++) {
    const joinerPage = joinerPages[i];
    const seatIndex = i + 1; // Seats 2, 3, 4, ...

    await getVisibleText(joinerPage, '进入房间').first().click();
    await expect(joinerPage.getByText('加入房间')).toBeVisible({ timeout: 5000 });

    await enterRoomCodeViaNumPad(joinerPage, roomNumber);
    await joinerPage.getByText('加入', { exact: true }).click();
    await waitForRoomScreenReady(joinerPage, { role: 'joiner' });

    // Take seat
    const room = new RoomPage(joinerPage);
    await room.seatAt(seatIndex);
    await expect(joinerPage.getByText('我')).toBeVisible({ timeout: 3000 });
  }

  if (!startGame) {
    return { fixture, roomNumber, hostPage, joinerPages };
  }

  // Step 4: Presence stabilization
  await waitForPresenceStable(hostPage, joinerPages);

  // Step 5: Prepare roles
  const hostRoom = new RoomPage(hostPage);
  await hostRoom.prepareRoles();

  // Step 6: All view roles
  await viewRolesForAll(fixture.pages);

  // Step 7: Start game
  await hostRoom.startGame();

  return { fixture, roomNumber, hostPage, joinerPages };
}
