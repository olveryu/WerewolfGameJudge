import type { Browser } from '@playwright/test';
import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { createPlayerContexts, type MultiPlayerFixture } from '../fixtures/app.fixture';
import { BoardPickerPage } from '../pages/BoardPickerPage';
import { ConfigPage } from '../pages/ConfigPage';
import { RoomPage } from '../pages/RoomPage';
import { extractRoomCode, startRoomCreation } from './home';
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

interface SetupGameOptions {
  /** Number of players (first = host). Default: 2. */
  playerCount?: number;
  /** Template configurator called on ConfigPage before creating room. */
  configureTemplate?: (config: ConfigPage) => Promise<void>;
  /** Whether to start the game (prepare → view roles → start). Default: true. */
  startGame?: boolean;
  /** Whether the night flow should continue into the default-on sheriff election. Default: false. */
  isSheriffElectionEnabled?: boolean;
}

interface GameSetupResult {
  fixture: MultiPlayerFixture;
  roomCode: string;
  hostPage: Page;
  joinerPages: Page[];
}

/** Role info captured during viewRole phase. */
export interface CapturedRole {
  /** Chinese display name, e.g. "狼人", "预言家" */
  displayName: string;
  /** 0-based seat index */
  seat: number;
}

export interface GameSetupWithRolesResult extends GameSetupResult {
  /**
   * Map from page index (0 = host, 1..N-1 = joiners) to captured role info.
   * Only populated when using setupNPlayerGameWithRoles.
   */
  roleMap: Map<number, CapturedRole>;
}

// ---------------------------------------------------------------------------
// Seat readiness
// ---------------------------------------------------------------------------

/** Time for every joiner's seat to reach the host. */
const SEATS_READY_TIMEOUT_MS = 24_000;

/**
 * Hard gate: wait until the host's next-step button offers 分配角色, which it
 * does once every seat is taken.
 */
async function waitForSeatsReady(hostPage: Page): Promise<void> {
  await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName('分配角色', {
    timeout: SEATS_READY_TIMEOUT_MS,
  });
}

// ---------------------------------------------------------------------------
// Room creation and seating
// ---------------------------------------------------------------------------

/**
 * Create N logged-in contexts, have the host create a werewolf room from the
 * default template (optionally reconfigured), and seat every player in page order.
 */
async function createRoomAndSeatAll(
  browser: Browser,
  opts: {
    readonly playerCount: number;
    readonly configureTemplate: ((config: ConfigPage) => Promise<void>) | undefined;
    readonly isSheriffElectionDisabled: boolean;
  },
): Promise<GameSetupResult & { hostRoom: RoomPage }> {
  const fixture = await createPlayerContexts(browser, opts.playerCount);
  const [hostPage, ...joinerPages] = fixture.pages;

  await startRoomCreation(hostPage, 'werewolf');
  const boardPicker = new BoardPickerPage(hostPage);
  await boardPicker.waitForReady();
  await boardPicker.selectDefaultTemplate();
  const config = new ConfigPage(hostPage);
  await config.waitForReady();
  if (opts.configureTemplate) {
    await opts.configureTemplate(config);
  }
  const rules = await config.clickNext();
  if (opts.isSheriffElectionDisabled) {
    await rules.setSheriffElectionEnabled(false);
  }
  await rules.clickCreate();
  await waitForRoomScreenReady(hostPage, { role: 'host' });

  const roomCode = await extractRoomCode(hostPage);

  // Host manually takes seat 0 (no longer auto-seated on room creation)
  const hostRoom = new RoomPage(hostPage);
  await hostRoom.seatAt(0);

  for (const [index, joinerPage] of joinerPages.entries()) {
    const room = new RoomPage(joinerPage);
    await room.joinViaCode(roomCode);
    await room.seatAt(index + 1);
  }

  return { fixture, roomCode, hostPage, joinerPages, hostRoom };
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
  const {
    playerCount = 2,
    configureTemplate,
    startGame = true,
    isSheriffElectionEnabled = false,
  } = opts;

  const { hostRoom, ...setup } = await createRoomAndSeatAll(browser, {
    playerCount,
    configureTemplate,
    isSheriffElectionDisabled: startGame && !isSheriffElectionEnabled,
  });
  if (!startGame) return setup;

  await waitForSeatsReady(setup.hostPage);
  await hostRoom.prepareRoles();
  for (const page of setup.fixture.pages) {
    await new RoomPage(page).viewRole();
  }
  await hostRoom.startGame();
  return setup;
}

// ---------------------------------------------------------------------------
// Role-aware game setup
// ---------------------------------------------------------------------------

/**
 * Same as setupNPlayerGame but captures each player's role during the
 * viewRole phase. Returns a roleMap mapping page index → CapturedRole.
 *
 * The game is always started (startGame is forced to true).
 */
export async function setupNPlayerGameWithRoles(
  browser: Browser,
  opts: Omit<SetupGameOptions, 'startGame'> = {},
): Promise<GameSetupWithRolesResult> {
  const { playerCount = 2, configureTemplate, isSheriffElectionEnabled = false } = opts;

  const { hostRoom, ...setup } = await createRoomAndSeatAll(browser, {
    playerCount,
    configureTemplate,
    isSheriffElectionDisabled: !isSheriffElectionEnabled,
  });

  await waitForSeatsReady(setup.hostPage);
  await hostRoom.prepareRoles();

  const roleMap = new Map<number, CapturedRole>();
  for (const [index, page] of setup.fixture.pages.entries()) {
    const displayName = await new RoomPage(page).viewRoleAndCapture();
    roleMap.set(index, { displayName, seat: index });
  }

  await hostRoom.startGame();
  return { ...setup, roleMap };
}
