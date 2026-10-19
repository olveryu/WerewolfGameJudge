import { type Locator, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { RoomPage } from '../pages/RoomPage';
import type { CapturedRole } from './multi-player';
import { ensureConnected } from './waits';

/**
 * Night Driver — role-aware night flow helpers.
 *
 * Shared utilities for E2E tests that need to drive specific role actions
 * during the night phase, verify reveal dialogs, and check death outcomes.
 * Provides role lookup, seat click, advance buttons, poll loops, and wolf vote
 * driving. Does not modify game state directly or import services/models.
 */

// ---------------------------------------------------------------------------
// Action logger — prints every E2E action with timestamp for debugging
// ---------------------------------------------------------------------------

function pageId(page: Page, allPages?: Page[]): string {
  if (allPages) {
    const idx = allPages.indexOf(page);
    if (idx !== -1) return `P${idx}`;
  }
  // Fallback: use last 4 chars of page URL hash
  const url = page.url();
  return `P(${url.slice(-20)})`;
}

/** Log an E2E action. Uses console.log (E2E tooling, not app code). */
// eslint-disable-next-line no-console
const log = (msg: string) => console.log(`[night-driver ${Date.now()}] ${msg}`);

// ---------------------------------------------------------------------------
// Time budgets — every wait is a wall-clock deadline, every click capped
// ---------------------------------------------------------------------------

/**
 * Per-click cap. A click that cannot complete (element covered, page
 * mid-transition) must fail within seconds and let the caller move on;
 * an uncapped click once blocked a night spec for four minutes while
 * the game was healthy (the click's actionability check never passed
 * and nothing ever timed it out).
 */
const CLICK_TIMEOUT_MS = 5_000;
/** Confirm dialogs can trail a slow broadcast; the window is generous. */
const CONFIRM_TIMEOUT_MS = 10_000;
/** Poll cadence for the deadline loops below. */
const POLL_INTERVAL_MS = 300;
/** Heartbeat cadence: long waits report every page's anchors. */
const HEARTBEAT_INTERVAL_MS = 15_000;
/** Default budget for step waits (measured: full night cases run 1.7–1.8 min). */
const DEFAULT_STEP_WAIT_MS = 120_000;
/** Default budget for the wolf-step wait inside the vote drivers. */
const WOLF_STEP_WAIT_MS = 30_000;

// ---------------------------------------------------------------------------
// Role lookup
// ---------------------------------------------------------------------------

/** Find the page index for a given role displayName. Returns -1 if not found. */
export function findRolePageIndex(roleMap: Map<number, CapturedRole>, roleName: string): number {
  for (const [idx, info] of roleMap) {
    if (info.displayName === roleName) return idx;
  }
  return -1;
}

/** Find ALL page indices for a given role displayName. */
export function findAllRolePageIndices(
  roleMap: Map<number, CapturedRole>,
  roleName: string,
): number[] {
  const indices: number[] = [];
  for (const [idx, info] of roleMap) {
    if (info.displayName === roleName) indices.push(idx);
  }
  return indices;
}

// ---------------------------------------------------------------------------
// UI reading
// ---------------------------------------------------------------------------

/**
 * Read the shell phase anchor: the game's current phase, verbatim from
 * the shell header's `data-phase` attribute (see RoomShellModel.phase).
 */
export async function readRoomPhase(page: Page): Promise<string | null> {
  return page
    .locator(`[data-testid="${TESTIDS.roomHeader}"]`)
    .getAttribute('data-phase', { timeout: 200 })
    .catch(() => null);
}

/**
 * Read the shell step anchor: the game's current step inside its phase,
 * verbatim from the shell header's `data-step` attribute (see
 * RoomShellModel.step). Null when the game has no step in its current
 * phase (the attribute is absent then).
 */
export async function readRoomStep(page: Page): Promise<string | null> {
  return page
    .locator(`[data-testid="${TESTIDS.roomHeader}"]`)
    .getAttribute('data-step', { timeout: 200 })
    .catch(() => null);
}

/** One heartbeat line: every page's (phase, step) anchors. */
async function logHeartbeat(pages: Page[], waitingFor: string): Promise<void> {
  const parts: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const phase = await readRoomPhase(pages[i]!);
    const step = await readRoomStep(pages[i]!);
    parts.push(`P${i}=${phase ?? '?'}/${step ?? '-'}`);
  }
  log(`heartbeat waitingFor=${waitingFor} ${parts.join(' ')}`);
}

/**
 * Click with the shared cap; a failed click is logged, never thrown, so
 * a stuck element degrades to a missed sweep instead of a hung test.
 */
async function clickCapped(locator: Locator, label: string): Promise<boolean> {
  try {
    await locator.click({ timeout: CLICK_TIMEOUT_MS });
    return true;
  } catch {
    log(`clickCapped — "${label}" did not complete within ${CLICK_TIMEOUT_MS}ms`);
    return false;
  }
}

/** Phases in which a werewolf night is over: day has broken or the game ended. */
const NIGHT_END_PHASES: ReadonlySet<string> = new Set(['Day', 'Ended']);

/**
 * A night has ended when the room's authoritative phase has left the
 * night. This reads the phase anchor — never display copy — so copy
 * redesigns cannot silently break night-end detection (they did once:
 * the host's Ended guide sentence carried the keyword the old text scan
 * depended on, and removing the sentence stalled every night spec while
 * the games themselves completed normally).
 */
export async function isNightEnded(page: Page): Promise<boolean> {
  const phase = await readRoomPhase(page);
  return phase !== null && NIGHT_END_PHASES.has(phase);
}

/** Check if a specific Chinese text is visible on the page. */
export async function isTextVisible(page: Page, text: string, exact = false): Promise<boolean> {
  return page
    .getByText(text, { exact })
    .first()
    .isVisible()
    .catch(() => false);
}

// ---------------------------------------------------------------------------
// Seat interaction
// ---------------------------------------------------------------------------

/**
 * Click a seat tile and confirm via alert. Returns true if confirmed.
 *
 * One bounded re-click is allowed when the confirm dialog never
 * appeared AND the room step has not moved: for single-target steps a
 * seat click only opens the confirm dialog (a fresh dialog replaces
 * the previous one; the submission itself is guarded against
 * duplicates), so a re-click cannot double-submit. If the step HAS
 * moved, the click landed and something else went wrong — fail
 * instead of clicking into the next step. Multi-target (draft) steps
 * do not use this helper.
 */
export async function clickSeatAndConfirm(page: Page, seatIdx: number): Promise<boolean> {
  log(`clickSeatAndConfirm seat=${seatIdx}`);
  // Dismiss any existing alert (e.g. "夜间行动" action prompt) before clicking
  await dismissAlert(page);

  const stepBefore = await readRoomStep(page);
  const tile = page.locator(`[data-testid="seat-tile-pressable-${seatIdx}"]`);
  await tile.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT_MS });

  const alertModal = page.locator('[data-testid="alert-modal"]');
  let appeared = false;
  for (let attempt = 0; attempt < 2 && !appeared; attempt++) {
    if (!(await clickCapped(tile, `seat tile ${seatIdx}`))) return false;
    log(`clickSeatAndConfirm seat=${seatIdx} — tile clicked (attempt ${attempt + 1})`);
    appeared = await alertModal
      .waitFor({ state: 'visible', timeout: CONFIRM_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    if (!appeared) {
      const stepNow = await readRoomStep(page);
      if (stepNow !== stepBefore) {
        log(
          `clickSeatAndConfirm seat=${seatIdx} — step moved ${stepBefore} -> ${stepNow} without a confirm dialog; not retrying`,
        );
        return false;
      }
      log(`clickSeatAndConfirm seat=${seatIdx} — no confirm alert appeared, step unchanged`);
    }
  }
  if (!appeared) return false;

  const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    if (!(await clickCapped(confirmBtn, 'seat confirm'))) return false;
    log(`clickSeatAndConfirm seat=${seatIdx} — confirmed`);
    // Wait for the confirm dialog content to be replaced by React.
    // Confirm dialogs have a "取消" button; subsequent alerts (reveal/info) don't.
    // Once "取消" disappears, the old dialog content has been processed.
    await alertModal
      .getByText('取消', { exact: true })
      .first()
      .waitFor({ state: 'hidden', timeout: CLICK_TIMEOUT_MS });
    return true;
  }
  log(`clickSeatAndConfirm seat=${seatIdx} — confirm btn not visible`);
  return false;
}

/** Select and confirm the first enabled card inside the bottom-card modal. */
export async function chooseFirstEnabledBottomCard(page: Page): Promise<string> {
  const modal = page.locator(`[data-testid="${TESTIDS.chooseBottomCardModal}"]`);
  await modal.waitFor({ state: 'visible', timeout: 5000 });

  const options = modal.locator('[data-testid^="choose-bottom-card-option-"]');
  const optionCount = await options.count();
  for (let cardIndex = 0; cardIndex < optionCount; cardIndex++) {
    const option = options.nth(cardIndex);
    if (!(await option.isEnabled())) continue;

    const selectedText = await option.textContent();
    if (selectedText === null || selectedText.trim().length === 0) {
      throw new Error(`Bottom-card option ${cardIndex} has no accessible text`);
    }
    const selectedName = selectedText.trim();
    await option.click({ timeout: CLICK_TIMEOUT_MS });

    const alertModal = page.locator('[data-testid="alert-modal"]');
    await alertModal.waitFor({ state: 'visible', timeout: CONFIRM_TIMEOUT_MS });
    await alertModal.getByText('确定', { exact: true }).click({ timeout: CLICK_TIMEOUT_MS });
    return selectedName;
  }

  throw new Error('Bottom-card modal has no enabled option');
}

// ---------------------------------------------------------------------------
// Advance buttons
// ---------------------------------------------------------------------------

/** Advance button labels used to skip / acknowledge steps.
 * Order matters: "确定" must come before "不用技能" because confirm dialogs
 * contain "不用技能" as body text — getByText would match the body instead
 * of the actual button.
 */
const ADVANCE_BUTTONS = [
  '知道了',
  '确定',
  '不用技能',
  '发动状态',
  '查看技能状态',
  '跳过（技能被封锁）', // nightmare-blocked roles
];

/**
 * Safe advance buttons — excludes "不用技能" to avoid accidentally
 * skipping a role's action step while waiting for its turn.
 */
const SAFE_ADVANCE_BUTTONS = ADVANCE_BUTTONS.filter((b) => b !== '不用技能');

/**
 * Try to click any advance button on a page.
 * Checks alert modal first, then bottom action panel.
 * Returns true if a button was clicked.
 *
 * @param includeSkip If false, excludes "不用技能" to prevent
 *   prematurely skipping a role step. Defaults to true.
 */
export async function tryClickAdvanceButton(
  page: Page,
  includeSkip = true,
  label?: string,
): Promise<boolean> {
  const tag = label ?? '';
  const buttons = includeSkip ? ADVANCE_BUTTONS : SAFE_ADVANCE_BUTTONS;
  // Check alert modal first
  const alertModal = page.locator('[data-testid="alert-modal"]');
  if (await alertModal.isVisible().catch(() => false)) {
    for (const text of buttons) {
      const btn = alertModal.getByText(text, { exact: true }).first();
      if (await btn.isVisible().catch(() => false)) {
        if (await clickCapped(btn, `advance alert "${text}"`)) {
          log(`tryClickAdvanceButton${tag} — alert "${text}" clicked`);
          return true;
        }
        return false;
      }
    }
  }

  // Check bottom action panel
  const panel = page.locator('[data-testid="bottom-action-panel"]');
  for (const text of buttons) {
    const btn = panel.getByText(text, { exact: true }).first();
    if (await btn.isVisible().catch(() => false)) {
      if (await clickCapped(btn, `advance panel "${text}"`)) {
        log(`tryClickAdvanceButton${tag} — panel "${text}" clicked`);
        return true;
      }
      return false;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Poll / wait helpers
// ---------------------------------------------------------------------------

/**
 * Generic poll loop: advance night on all pages until condition is met
 * or the deadline passes. Uses simple skip-all strategy (clicks advance
 * buttons, no seat selection). Returns whether the condition was met.
 */
async function pollUntil(
  pages: Page[],
  condition: () => Promise<boolean>,
  timeoutMs = DEFAULT_STEP_WAIT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let lastHeartbeat = 0;
  for (;;) {
    if (await condition()) return true;
    if (Date.now() >= deadline) return false;
    if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat = Date.now();
      await logHeartbeat(pages, 'pollUntil');
    }
    await ensureConnected(pages);
    for (const page of pages) {
      const pIdx = pages.indexOf(page);
      await tryClickAdvanceButton(page, true, ` poll-P${pIdx}`);
    }
    // Poll cadence for retry loop
    await pages[0]!.waitForTimeout(POLL_INTERVAL_MS);
  }
}

/**
 * Wait until a page's room reaches the given night step, polling the
 * step anchor. Returns false when the deadline passes.
 */
export async function waitForRoomStep(
  page: Page,
  stepId: string,
  timeoutMs = WOLF_STEP_WAIT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if ((await readRoomStep(page)) === stepId) return true;
    if (Date.now() >= deadline) return false;
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }
}

/**
 * Wait for a specific step of the night by reading the role page's step
 * anchor (data-step — the engine's current step, verbatim). Detection
 * binds only the anchor, never display copy: copy may be redesigned
 * freely without stalling night drivers.
 *
 * While waiting, advances other pages' skip buttons so intermediate
 * steps can complete.
 *
 * @param rolePage - The page belonging to the role we're waiting for
 * @param stepId - The night step id to wait for (engine step vocabulary)
 * @param allPages - All pages (used to advance other roles' skip buttons)
 * @param timeoutMs - Wall-clock budget
 * @returns true if the step was reached; false if the night ended first
 *   or the budget ran out
 */
export async function waitForRoleTurn(
  rolePage: Page,
  stepId: string,
  allPages: Page[],
  timeoutMs = DEFAULT_STEP_WAIT_MS,
): Promise<boolean> {
  log(`waitForRoleTurn step=${stepId} rolePage=${pageId(rolePage, allPages)}`);
  const deadline = Date.now() + timeoutMs;
  let lastHeartbeat = 0;
  for (;;) {
    if ((await readRoomStep(rolePage)) === stepId) {
      log(`waitForRoleTurn — step ${stepId} reached`);
      return true;
    }

    if (await isNightEnded(allPages[0]!)) {
      log('waitForRoleTurn — night ended');
      return false;
    }
    if (Date.now() >= deadline) {
      log(`waitForRoleTurn — timed out after ${timeoutMs}ms waiting for step ${stepId}`);
      return false;
    }
    if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat = Date.now();
      await logHeartbeat(allPages, stepId);
    }

    // Ensure all pages are connected before advancing
    await ensureConnected(allPages);

    // Advance other pages — skip the target role's own page so its own
    // pending step is never skipped past. For other pages, include skip
    // buttons to advance past intermediate roles (e.g. seer before
    // gargoyle).
    for (const p of allPages) {
      if (p === rolePage) continue;
      const pIdx = allPages.indexOf(p);
      await tryClickAdvanceButton(p, /* includeSkip */ true, ` P${pIdx}`);
    }
    // Poll cadence for retry loop
    await allPages[0]!.waitForTimeout(POLL_INTERVAL_MS);
  }
}

/** Wait for night to end across all pages. */
export async function waitForNightEnd(
  pages: Page[],
  timeoutMs = DEFAULT_STEP_WAIT_MS,
): Promise<boolean> {
  log('waitForNightEnd — start');
  const ended = await pollUntil(
    pages,
    async () => {
      for (const p of pages) {
        if (await isNightEnded(p)) return true;
      }
      return false;
    },
    timeoutMs,
  );
  if (!ended) return false;
  // Every client renders the same broadcast, but the host page's anchor
  // can land a beat after the first page that flipped; give it a brief
  // settle window before reporting.
  for (let i = 0; i < 10; i++) {
    if (await isNightEnded(pages[0]!)) return true;
    await pages[0]!.waitForTimeout(POLL_INTERVAL_MS);
  }
  return false;
}

/**
 * After night ends, click "昨夜信息" to reveal the night result text.
 * The flow: click "昨夜信息" → confirmation dialog ("请在警长竞选结束后再查看，请勿作弊")
 * → click "确定查看" → info alert.
 * Call this before asserting on '平安夜' or '玩家死亡'.
 */
export async function viewLastNightInfo(hostPage: Page): Promise<void> {
  const alertModal = hostPage.locator('[data-testid="alert-modal"]');
  const room = new RoomPage(hostPage);

  // Dismiss any stale alert, then click "昨夜信息"
  for (let i = 0; i < 3; i++) {
    await dismissAlert(hostPage);
    if (await room.tryClickHostManagementAction(TESTIDS.lastNightInfoButton)) {
      // Wait for confirmation dialog ("请在警长竞选结束后再查看，请勿作弊")
      await alertModal.waitFor({ state: 'visible', timeout: CONFIRM_TIMEOUT_MS });
      // Click "确定查看" to proceed to the info alert
      const confirmBtn = alertModal.getByText('确定查看', { exact: true }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ timeout: CLICK_TIMEOUT_MS });
        // Poll for actual night-result content instead of visibility toggle
        // (avoids TOCTOU race where the confirmation dialog hasn't closed yet)
        const RESULT_KEYWORDS = ['平安夜', '玩家死亡', '死亡', '号玩家'];
        for (let j = 0; j < 20; j++) {
          const text = (await alertModal.textContent().catch(() => '')) ?? '';
          if (RESULT_KEYWORDS.some((kw) => text.includes(kw))) return;
          await hostPage.waitForTimeout(200);
        }
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Wolf voting
// ---------------------------------------------------------------------------

/**
 * Drive all wolves to vote on a specific target seat.
 * Waits for the wolfKill step anchor before each vote (the step is
 * shared by all wolves, so every wolf votes inside the same step).
 *
 * @throws {Error} When the wolf step is not reached or a vote
 *   confirmation is unavailable.
 */
export async function driveWolfVote(
  pages: Page[],
  wolfIndices: number[],
  targetSeat: number,
): Promise<void> {
  log(`driveWolfVote wolfIndices=[${wolfIndices}] targetSeat=${targetSeat}`);
  for (const wIdx of wolfIndices) {
    const wPage = pages[wIdx]!;
    log(`driveWolfVote — P${wIdx} waiting for step wolfKill`);
    if (!(await waitForRoomStep(wPage, 'wolfKill'))) {
      throw new Error(`Wolf step not reached for page ${wIdx}`);
    }
    log(`driveWolfVote — P${wIdx} wolfKill reached, clicking seat`);
    if (!(await clickSeatAndConfirm(wPage, targetSeat))) {
      throw new Error(`Wolf vote confirmation failed for page ${wIdx}, target seat ${targetSeat}`);
    }
    log(`driveWolfVote — P${wIdx} vote done`);
  }
}

/**
 * Drive all wolves to vote skip attack (empty kill).
 * Clicks the "放弃袭击" button in the bottom action panel for each wolf.
 */
export async function driveWolfEmptyVote(pages: Page[], wolfIndices: number[]): Promise<void> {
  log(`driveWolfEmptyVote wolfIndices=[${wolfIndices}]`);
  for (const wIdx of wolfIndices) {
    const wPage = pages[wIdx]!;
    // Dismiss any existing alert (e.g. "夜间行动") before interacting
    await dismissAlert(wPage);

    log(`driveWolfEmptyVote — P${wIdx} waiting for step wolfKill`);
    if (!(await waitForRoomStep(wPage, 'wolfKill'))) {
      throw new Error(`Wolf step not reached for page ${wIdx}`);
    }

    // Click skip attack button
    const panel = wPage.locator('[data-testid="bottom-action-panel"]');
    const emptyBtn = panel.getByText('放弃袭击', { exact: true }).first();
    await emptyBtn.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT_MS });
    await emptyBtn.click({ timeout: CLICK_TIMEOUT_MS });
    log(`driveWolfEmptyVote — P${wIdx} clicked 放弃袭击`);

    // Confirm the wolf vote alert
    const alertModal = wPage.locator('[data-testid="alert-modal"]');
    const appeared = await alertModal
      .waitFor({ state: 'visible', timeout: CONFIRM_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    if (appeared) {
      const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ timeout: CLICK_TIMEOUT_MS });
        log(`driveWolfEmptyVote — P${wIdx} confirmed`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Reveal dialog
// ---------------------------------------------------------------------------

/**
 * Read the alert modal text content (used for reveal dialogs).
 * Returns the full text of the currently visible alert.
 */
export async function readAlertText(page: Page): Promise<string> {
  const alertModal = page.locator('[data-testid="alert-modal"]');
  await alertModal.waitFor({ state: 'visible', timeout: 10_000 });
  return (await alertModal.textContent().catch(() => '')) ?? '';
}

/**
 * Dismiss the current alert modal by clicking '知道了' or '确定'.
 *
 * Does NOT wait for the modal to close — callers rely on Playwright's
 * built-in actionability checks (inert attribute) for subsequent interactions
 * with elements inside #root.
 */
export async function dismissAlert(page: Page): Promise<void> {
  const alertModal = page.locator('[data-testid="alert-modal"]');
  for (const text of ['知道了', '确定']) {
    const btn = alertModal.getByText(text, { exact: true }).first();
    if (await btn.isVisible().catch(() => false)) {
      if (await clickCapped(btn, `dismiss "${text}"`)) {
        log(`dismissAlert — clicked "${text}"`);
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Bottom action panel
// ---------------------------------------------------------------------------

/**
 * Click a specific button in the bottom action panel.
 * Retries up to 3 times, dismissing any stale alert that may obscure the panel.
 * Returns true if the button was found and clicked.
 */
export async function clickBottomButton(
  page: Page,
  label: string,
  maxRetries = 3,
): Promise<boolean> {
  const panel = page.locator('[data-testid="bottom-action-panel"]');
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Dismiss any stale alert that may cover the bottom panel
    if (attempt > 0) await dismissAlert(page);
    const btn = panel.getByText(label, { exact: true }).first();
    if (await btn.isVisible().catch(() => false)) {
      if (await clickCapped(btn, `bottom button "${label}"`)) return true;
    }
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Magician swap (two-target selection)
// ---------------------------------------------------------------------------

/**
 * Drive the magician to swap two seats.
 * Clicks seat1, confirms first target prompt, clicks seat2, confirms swap.
 */
export async function driveMagicianSwap(
  page: Page,
  seat1: number,
  seat2: number,
): Promise<boolean> {
  // Dismiss any existing alert (e.g. "夜间行动") before interacting with seats
  await dismissAlert(page);

  // Click first seat → triggers "已选择第一位玩家" info alert.
  // Draft (toggle) selection: a failed click is reported, never
  // blindly retried — re-clicking a seat would toggle the draft.
  const tile1 = page.locator(`[data-testid="seat-tile-pressable-${seat1}"]`);
  await tile1.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT_MS });
  if (!(await clickCapped(tile1, `magician seat ${seat1}`))) return false;

  // Dismiss "已选择第一位玩家" alert before clicking second seat
  await dismissAlert(page);

  // Click second seat → triggers "确认交换" confirm dialog
  const tile2 = page.locator(`[data-testid="seat-tile-pressable-${seat2}"]`);
  await tile2.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT_MS });
  if (!(await clickCapped(tile2, `magician seat ${seat2}`))) return false;

  // Confirm swap alert ("交换这两名玩家？")
  const alertModal = page.locator('[data-testid="alert-modal"]');
  const appeared = await alertModal
    .waitFor({ state: 'visible', timeout: CONFIRM_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;

  const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    return clickCapped(confirmBtn, 'magician swap confirm');
  }
  return false;
}
