import { type Locator, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
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

/** Read the action-message testID text content, empty string if not visible. */
async function getActionMsg(page: Page): Promise<string> {
  const loc = page.locator('[data-testid="action-message"]');
  return (await loc.textContent({ timeout: 200 }).catch(() => '')) ?? '';
}

/** Check if any night-end keyword is visible on the page. */
async function isNightEnded(page: Page): Promise<boolean> {
  for (const kw of ['平安夜', '玩家死亡', '昨夜信息']) {
    const visible = await page
      .getByText(kw)
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) return true;
  }
  return false;
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

/** Click a seat tile and confirm via alert. Returns true if confirmed. */
export async function clickSeatAndConfirm(page: Page, seatIdx: number): Promise<boolean> {
  log(`clickSeatAndConfirm seat=${seatIdx}`);
  // Dismiss any existing alert (e.g. "夜间行动" action prompt) before clicking
  await dismissAlert(page);

  const tile = page.locator(`[data-testid="seat-tile-pressable-${seatIdx}"]`);
  await tile.waitFor({ state: 'visible', timeout: 5000 });
  await tile.click();
  log(`clickSeatAndConfirm seat=${seatIdx} — tile clicked`);

  // Wait for confirmation alert
  const alertModal = page.locator('[data-testid="alert-modal"]');
  const appeared = await alertModal
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) {
    log(`clickSeatAndConfirm seat=${seatIdx} — no confirm alert appeared`);
    return false;
  }

  const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    log(`clickSeatAndConfirm seat=${seatIdx} — confirmed`);
    // Wait for the confirm dialog content to be replaced by React.
    // Confirm dialogs have a "取消" button; subsequent alerts (reveal/info) don't.
    // Once "取消" disappears, the old dialog content has been processed.
    await alertModal
      .getByText('取消', { exact: true })
      .first()
      .waitFor({ state: 'hidden', timeout: 5000 });
    return true;
  }
  log(`clickSeatAndConfirm seat=${seatIdx} — confirm btn not visible`);
  return false;
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
        await btn.click();
        log(`tryClickAdvanceButton${tag} — alert "${text}" clicked`);
        return true;
      }
    }
  }

  // Check bottom action panel
  const panel = page.locator('[data-testid="bottom-action-panel"]');
  for (const text of buttons) {
    const btn = panel.getByText(text, { exact: true }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      log(`tryClickAdvanceButton${tag} — panel "${text}" clicked`);
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Poll / wait helpers
// ---------------------------------------------------------------------------

/**
 * Generic poll loop: advance night on all pages until condition is met.
 * Uses simple skip-all strategy (clicks advance buttons, no seat selection).
 */
async function pollUntil(
  pages: Page[],
  condition: () => Promise<boolean>,
  maxIter = 60,
): Promise<void> {
  for (let i = 0; i < maxIter; i++) {
    if (await condition()) return;
    await ensureConnected(pages);
    for (const page of pages) {
      const pIdx = pages.indexOf(page);
      await tryClickAdvanceButton(page, true, ` poll-P${pIdx}`);
    }
    // Poll cadence for retry loop
    await pages[0]!.waitForTimeout(300);
  }
}

/**
 * Wait for a specific role's turn by detecting action message keywords.
 * While waiting, advances other pages' skip buttons.
 *
 * @param rolePage - The page belonging to the role we're waiting for
 * @param keywords - Action message substrings that signal the role's turn
 * @param allPages - All pages (used to advance other roles' skip buttons)
 * @param maxIter - Maximum poll iterations
 * @returns true if the role's turn was detected
 */
export async function waitForRoleTurn(
  rolePage: Page,
  keywords: string[],
  allPages: Page[],
  maxIter = 120,
): Promise<boolean> {
  log(`waitForRoleTurn keywords=[${keywords}] rolePage=${pageId(rolePage, allPages)}`);
  for (let i = 0; i < maxIter; i++) {
    // Check action-message text (bottom panel)
    const msg = await getActionMsg(rolePage);
    if (keywords.some((kw) => msg.includes(kw))) {
      log(`waitForRoleTurn — detected "${msg}" on iter ${i}`);
      return true;
    }

    // Also check alert-modal text (compound steps like witch show prompts as alerts)
    const alertVisible = await rolePage
      .locator('[data-testid="alert-modal"]')
      .isVisible()
      .catch(() => false);
    if (alertVisible) {
      const alertText =
        (await rolePage
          .locator('[data-testid="alert-modal"]')
          .textContent()
          .catch(() => '')) ?? '';
      if (keywords.some((kw) => alertText.includes(kw))) {
        log(`waitForRoleTurn — detected in alert on iter ${i}`);
        return true;
      }
    }

    if (await isNightEnded(allPages[0]!)) {
      log(`waitForRoleTurn — night ended on iter ${i}`);
      return false;
    }

    // Ensure all pages are connected before advancing
    await ensureConnected(allPages);

    // Advance other pages — skip the target role's own page to preserve
    // its alerts for detection. For other pages, include skip buttons to
    // advance past intermediate roles (e.g. seer before gargoyle).
    for (const p of allPages) {
      if (p === rolePage) continue;
      const pIdx = allPages.indexOf(p);
      await tryClickAdvanceButton(p, /* includeSkip */ true, ` P${pIdx}`);
    }
    // Poll cadence for retry loop
    await allPages[0]!.waitForTimeout(300);
  }
  log(`waitForRoleTurn — exhausted ${maxIter} iterations`);
  return false;
}

/** Wait for night to end across all pages. */
export async function waitForNightEnd(pages: Page[], maxIter = 80): Promise<boolean> {
  log('waitForNightEnd — start');
  await pollUntil(
    pages,
    async () => {
      for (const p of pages) {
        if (await isNightEnded(p)) return true;
      }
      return false;
    },
    maxIter,
  );
  return isNightEnded(pages[0]!);
}

/**
 * After night ends, click "昨夜信息" to reveal the night result text.
 * The flow: click "昨夜信息" → confirmation dialog ("请在警长竞选结束后再查看，请勿作弊")
 * → click "确定查看" → info alert.
 * Call this before asserting on '平安夜' or '玩家死亡'.
 */
export async function viewLastNightInfo(hostPage: Page): Promise<void> {
  const alertModal = hostPage.locator('[data-testid="alert-modal"]');

  // Dismiss any stale alert, then click "昨夜信息"
  for (let i = 0; i < 3; i++) {
    await dismissAlert(hostPage);
    // Check if "昨夜信息" is visible now
    const infoBtn = hostPage.getByTestId('last-night-info-button');
    if (await infoBtn.isVisible().catch(() => false)) {
      await infoBtn.click();
      // Wait for confirmation dialog ("请在警长竞选结束后再查看，请勿作弊")
      await alertModal.waitFor({ state: 'visible', timeout: 3000 });
      // Click "确定查看" to proceed to the info alert
      const confirmBtn = alertModal.getByText('确定查看', { exact: true }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
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
    // Wait for "昨夜信息" button to appear before next attempt
    await hostPage
      .getByTestId('last-night-info-button')
      .waitFor({ state: 'visible', timeout: 2000 })
      .catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Wolf voting
// ---------------------------------------------------------------------------

/**
 * Drive all wolves to vote on a specific target seat.
 * Waits for each wolf's action message before voting.
 */
export async function driveWolfVote(
  pages: Page[],
  wolfIndices: number[],
  targetSeat: number,
): Promise<void> {
  log(`driveWolfVote wolfIndices=[${wolfIndices}] targetSeat=${targetSeat}`);
  for (const wIdx of wolfIndices) {
    const wPage = pages[wIdx]!;
    log(`driveWolfVote — P${wIdx} waiting for action-message`);
    await wPage
      .locator('[data-testid="action-message"]')
      .waitFor({ state: 'visible', timeout: 10_000 });
    log(`driveWolfVote — P${wIdx} action-message visible, clicking seat`);
    await clickSeatAndConfirm(wPage, targetSeat);
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

    log(`driveWolfEmptyVote — P${wIdx} waiting for action-message`);
    await wPage
      .locator('[data-testid="action-message"]')
      .waitFor({ state: 'visible', timeout: 10_000 });

    // Click skip attack button
    const panel = wPage.locator('[data-testid="bottom-action-panel"]');
    const emptyBtn = panel.getByText('放弃袭击', { exact: true }).first();
    await emptyBtn.waitFor({ state: 'visible', timeout: 5000 });
    await emptyBtn.click();
    log(`driveWolfEmptyVote — P${wIdx} clicked 放弃袭击`);

    // Confirm the wolf vote alert
    const alertModal = wPage.locator('[data-testid="alert-modal"]');
    const appeared = await alertModal
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) {
      const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
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
      await btn.click();
      log(`dismissAlert — clicked "${text}"`);
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
      await btn.click();
      return true;
    }
    await page.waitForTimeout(300);
  }
  return false;
}

async function isAriaDisabled(option: Locator): Promise<boolean> {
  return option
    .evaluate((element) => element.getAttribute('aria-disabled') === 'true')
    .catch(() => false);
}

/**
 * Choose the first enabled bottom card matching one of the candidate display names.
 * Selection is scoped to the active bottom-card modal so hidden screens cannot win
 * a global text lookup.
 */
export async function chooseEnabledBottomCard(
  page: Page,
  candidateNames: readonly string[],
): Promise<string | null> {
  const modal = page.locator(`[data-testid="${TESTIDS.chooseBottomCardModal}"]`);
  await modal.waitFor({ state: 'visible', timeout: 5000 });

  const options = modal.locator('[data-testid^="choose-bottom-card-option-"]');
  await options.first().waitFor({ state: 'visible', timeout: 5000 });
  const optionCount = await options.count();

  for (const candidateName of candidateNames) {
    for (let index = 0; index < optionCount; index++) {
      const optionTestID = TESTIDS.chooseBottomCardOption(index);
      const option = modal.locator(`[data-testid="${optionTestID}"]`);
      const hasCandidateName = await option
        .getByText(candidateName, { exact: true })
        .isVisible()
        .catch(() => false);
      if (!hasCandidateName) continue;
      if (await isAriaDisabled(option)) continue;

      await option.click();

      const alertModal = page.locator(`[data-testid="${TESTIDS.alertModal}"]`);
      await alertModal.waitFor({ state: 'visible', timeout: 5000 });
      const confirmButton = alertModal.getByText('确定', { exact: true }).first();
      await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
      await confirmButton.click();
      return candidateName;
    }
  }

  return null;
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

  // Click first seat → triggers "已选择第一位玩家" info alert
  const tile1 = page.locator(`[data-testid="seat-tile-pressable-${seat1}"]`);
  await tile1.waitFor({ state: 'visible', timeout: 5000 });
  await tile1.click();

  // Dismiss "已选择第一位玩家" alert before clicking second seat
  await dismissAlert(page);

  // Click second seat → triggers "确认交换" confirm dialog
  const tile2 = page.locator(`[data-testid="seat-tile-pressable-${seat2}"]`);
  await tile2.waitFor({ state: 'visible', timeout: 5000 });
  await tile2.click();

  // Confirm swap alert ("交换这两名玩家？")
  const alertModal = page.locator('[data-testid="alert-modal"]');
  const appeared = await alertModal
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;

  const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    return true;
  }
  return false;
}
