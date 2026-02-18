import { Page } from '@playwright/test';

import type { CapturedRole } from './multi-player';

/**
 * Night Driver — role-aware night flow helpers.
 *
 * Shared utilities for E2E tests that need to drive specific role actions
 * during the night phase, verify reveal dialogs, and check death outcomes.
 * Provides role lookup, seat click, advance buttons, poll loops, and wolf vote
 * driving. Does not modify game state directly or import services/models.
 */

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
export async function getActionMsg(page: Page): Promise<string> {
  const loc = page.locator('[data-testid="action-message"]');
  return (await loc.textContent({ timeout: 200 }).catch(() => '')) ?? '';
}

/** Check if any night-end keyword is visible on the page. */
export async function isNightEnded(page: Page): Promise<boolean> {
  for (const kw of ['平安夜', '玩家死亡', '查看昨晚信息']) {
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
  // Dismiss any existing alert (e.g. "行动提示" action prompt) before clicking
  await dismissAlert(page);

  const tile = page.locator(`[data-testid="seat-tile-pressable-${seatIdx}"]`);
  await tile.waitFor({ state: 'visible', timeout: 5000 });
  await tile.click({ force: true });

  // Wait for confirmation alert
  const alertModal = page.locator('[data-testid="alert-modal"]');
  const appeared = await alertModal
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;

  const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click({ force: true });
    await alertModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Advance buttons
// ---------------------------------------------------------------------------

/** Advance button labels used to skip / acknowledge steps.
 * Order matters: "确定" must come before "不使用技能" because confirm dialogs
 * contain "不使用技能" as body text — getByText would match the body instead
 * of the actual button.
 */
const ADVANCE_BUTTONS = [
  '知道了',
  '确定',
  '不使用技能',
  '查看发动状态',
  '查看技能状态',
  '跳过（技能被封锁）', // nightmare-blocked roles
];

/**
 * Safe advance buttons — excludes "不使用技能" to avoid accidentally
 * skipping a role's action step while waiting for its turn.
 */
const SAFE_ADVANCE_BUTTONS = ADVANCE_BUTTONS.filter((b) => b !== '不使用技能');

/**
 * Try to click any advance button on a page.
 * Checks alert modal first, then bottom action panel.
 * Returns true if a button was clicked.
 *
 * @param includeSkip If false, excludes "不使用技能" to prevent
 *   prematurely skipping a role step. Defaults to true.
 */
export async function tryClickAdvanceButton(page: Page, includeSkip = true): Promise<boolean> {
  const buttons = includeSkip ? ADVANCE_BUTTONS : SAFE_ADVANCE_BUTTONS;
  // Check alert modal first
  const alertModal = page.locator('[data-testid="alert-modal"]');
  if (await alertModal.isVisible().catch(() => false)) {
    for (const text of buttons) {
      const btn = alertModal.getByText(text, { exact: true }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        await alertModal.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
        return true;
      }
    }
  }

  // Check bottom action panel
  const panel = page.locator('[data-testid="bottom-action-panel"]');
  for (const text of buttons) {
    const btn = panel.getByText(text, { exact: true }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      // Wait for the clicked button to disappear (step advanced)
      await btn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
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
export async function pollUntil(
  pages: Page[],
  condition: () => Promise<boolean>,
  maxIter = 60,
): Promise<void> {
  for (let i = 0; i < maxIter; i++) {
    if (await condition()) return;
    for (const page of pages) {
      await tryClickAdvanceButton(page);
    }
    // Poll cadence for retry loop
    await pages[0].waitForTimeout(300);
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
  for (let i = 0; i < maxIter; i++) {
    // Check action-message text (bottom panel)
    const msg = await getActionMsg(rolePage);
    if (keywords.some((kw) => msg.includes(kw))) return true;

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
      if (keywords.some((kw) => alertText.includes(kw))) return true;
    }

    if (await isNightEnded(allPages[0])) return false;

    // Advance other pages — skip the target role's own page to preserve
    // its alerts for detection. For other pages, include skip buttons to
    // advance past intermediate roles (e.g. seer before gargoyle).
    for (const p of allPages) {
      if (p === rolePage) continue;
      await tryClickAdvanceButton(p, /* includeSkip */ true);
    }
    // Poll cadence for retry loop
    await allPages[0].waitForTimeout(300);
  }
  return false;
}

/** Wait for night to end across all pages. */
export async function waitForNightEnd(pages: Page[], maxIter = 80): Promise<boolean> {
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
  return isNightEnded(pages[0]);
}

/**
 * After night ends, dismiss any alert (e.g. speak order dialog) and
 * click "查看昨晚信息" to reveal the night result text.
 * The flow: speak order dialog → dismiss → click "查看昨晚信息" →
 * confirmation dialog ("确定查看昨夜信息？") → click "确定" → info alert.
 * Call this before asserting on '平安夜' or '玩家死亡'.
 */
export async function viewLastNightInfo(hostPage: Page): Promise<void> {
  const alertModal = hostPage.locator('[data-testid="alert-modal"]');

  // Dismiss speak order dialog (or any other alert) up to 3 times
  for (let i = 0; i < 3; i++) {
    await dismissAlert(hostPage);
    // Check if "查看昨晚信息" is visible now
    const infoBtn = hostPage.getByText('查看昨晚信息').first();
    if (await infoBtn.isVisible().catch(() => false)) {
      await infoBtn.click({ force: true });
      // Wait for confirmation dialog ("确定查看昨夜信息？")
      await alertModal.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      // Click "确定" to proceed to the info alert
      const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        // Wait for alert to cycle (hidden then visible with info)
        await alertModal.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});
        await alertModal.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      }
      return;
    }
    await hostPage.waitForTimeout(300);
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
  for (const wIdx of wolfIndices) {
    const wPage = pages[wIdx];
    await wPage
      .locator('[data-testid="action-message"]')
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => {});
    await clickSeatAndConfirm(wPage, targetSeat);
  }
}

/**
 * Drive all wolves to vote 空刀 (empty kill).
 * Clicks the "空刀" button in the bottom action panel for each wolf.
 */
export async function driveWolfEmptyVote(pages: Page[], wolfIndices: number[]): Promise<void> {
  for (const wIdx of wolfIndices) {
    const wPage = pages[wIdx];
    // Dismiss any existing alert (e.g. "行动提示") before interacting
    await dismissAlert(wPage);

    await wPage
      .locator('[data-testid="action-message"]')
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => {});

    // Click 空刀 button
    const panel = wPage.locator('[data-testid="bottom-action-panel"]');
    const emptyBtn = panel.getByText('空刀', { exact: true }).first();
    await emptyBtn.waitFor({ state: 'visible', timeout: 5000 });
    await emptyBtn.click({ force: true });

    // Confirm the wolf vote alert
    const alertModal = wPage.locator('[data-testid="alert-modal"]');
    const appeared = await alertModal
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) {
      const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await alertModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
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
 */
export async function dismissAlert(page: Page): Promise<void> {
  const alertModal = page.locator('[data-testid="alert-modal"]');
  for (const text of ['知道了', '确定']) {
    const btn = alertModal.getByText(text, { exact: true }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await alertModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Bottom action panel
// ---------------------------------------------------------------------------

/**
 * Click a specific button in the bottom action panel.
 * Returns true if the button was found and clicked.
 */
export async function clickBottomButton(page: Page, label: string): Promise<boolean> {
  const panel = page.locator('[data-testid="bottom-action-panel"]');
  const btn = panel.getByText(label, { exact: true }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ force: true });
    // Wait for the button to disappear or alert to appear
    await btn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    return true;
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
  // Dismiss any existing alert (e.g. "行动提示") before interacting with seats
  await dismissAlert(page);

  // Click first seat → triggers "已选择第一位玩家" info alert
  const tile1 = page.locator(`[data-testid="seat-tile-pressable-${seat1}"]`);
  await tile1.waitFor({ state: 'visible', timeout: 5000 });
  await tile1.click({ force: true });

  // Dismiss "已选择第一位玩家" alert before clicking second seat
  await dismissAlert(page);

  // Click second seat → triggers "确认交换" confirm dialog
  const tile2 = page.locator(`[data-testid="seat-tile-pressable-${seat2}"]`);
  await tile2.waitFor({ state: 'visible', timeout: 5000 });
  await tile2.click({ force: true });

  // Confirm swap alert ("确定要交换这两名玩家吗？")
  const alertModal = page.locator('[data-testid="alert-modal"]');
  const appeared = await alertModal
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;

  const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click({ force: true });
    await alertModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    return true;
  }
  return false;
}
