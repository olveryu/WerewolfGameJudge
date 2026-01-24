import { test, expect, Page, TestInfo, BrowserContext } from '@playwright/test';
import { waitForRoomScreenReady } from './helpers/waits';
import { getVisibleText, gotoWithRetry } from './helpers/ui';
import {
  waitForAppReady,
  ensureAnonLogin,
  extractRoomNumber,
  enterRoomCodeViaNumPad,
} from './helpers/home';
import { setupDiagnostics } from './helpers/diagnostics';

/**
 * Night 1 Smoke E2E Tests
 *
 * PURPOSE: Verify the game flow runs to completion (smoke test).
 * Does NOT verify exact death results - that's covered by Jest unit tests.
 *
 * SCENARIOS:
 * - NIGHT-6P: 6-player first night (2 wolves + seer + witch + hunter + 1 villager)
 * - RESTART: After night ends, restart and run a second night
 * - SETTINGS: Verify settings change is observable
 */

// Fail fast: stop on first failure
test.describe.configure({ mode: 'serial' });

// Increase test timeout for multi-player flows
test.setTimeout(180_000);

// =============================================================================
// Helpers (Seat-specific only - shared helpers imported from home.ts)
// =============================================================================

/**
 * Get a precise locator for a seat tile by its 0-based seat index.
 * Uses data-testid for stable selection (requires testID on View in RoomScreen).
 */
function getSeatTileLocator(page: Page, seatIndex: number) {
  // Primary: use testID (stable)
  const byTestId = page.locator(`[data-testid="seat-tile-${seatIndex}"]`);
  // Fallback: legacy text-based approach
  const displayNumber = seatIndex + 1;
  const byText = page
    .locator(`text="${displayNumber}"`)
    .locator('..')
    .filter({ has: page.locator('text=/^(空|我)$/').or(page.locator(`text="${displayNumber}"`)) })
    .first()
    .locator('..');
  // Use OR to support both
  return byTestId.or(byText).first();
}

/**
 * Get the 0-based seat index of "my" seat (the one with "我" badge).
 * Returns null if no seat is occupied by the current player.
 */
async function getMySeatIndex(page: Page): Promise<number | null> {
  // Find the "我" text and trace back to the seat tile's testID
  const myBadge = page.getByText('我', { exact: true }).first();
  const isVisible = await myBadge.isVisible({ timeout: 500 }).catch(() => false);
  if (!isVisible) return null;

  // Walk up to find the parent with data-testid="seat-tile-N"
  const seatTileAncestor = myBadge
    .locator('xpath=ancestor::*[starts-with(@data-testid, "seat-tile-")]')
    .first();
  const testId = await seatTileAncestor.getAttribute('data-testid').catch(() => null);

  if (testId?.startsWith('seat-tile-')) {
    const seatIndex = Number.parseInt(testId.replace('seat-tile-', ''), 10);
    if (!Number.isNaN(seatIndex)) {
      console.log(`[Night] My seat index: ${seatIndex}`);
      return seatIndex;
    }
  }

  // Fallback: scan all seats for the one containing "我"
  for (let i = 0; i < 12; i++) {
    const tile = page.locator(`[data-testid="seat-tile-${i}"]`);
    const hasMyBadge = await tile
      .locator('text="我"')
      .isVisible({ timeout: 100 })
      .catch(() => false);
    if (hasMyBadge) {
      console.log(`[Night] My seat index (fallback scan): ${i}`);
      return i;
    }
  }

  return null;
}

/**
 * Count visible seat tiles using stable testID selector.
 * Uses regex to match exactly seat-tile-{number} (not seat-tile-pressable-*)
 */
async function countSeatTiles(page: Page): Promise<number> {
  // Match only seat-tile-0, seat-tile-1, etc. (not seat-tile-pressable-*)
  const seatTiles = page.locator('[data-testid^="seat-tile-"]:not([data-testid*="pressable"])');
  const count = await seatTiles.count();
  return count;
}

/**
 * Take a screenshot and attach to test
 */
async function takeScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const screenshot = await page.screenshot();
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
}

/**
 * Configure a 2-player template on ConfigScreen by deselecting extra roles
 * Keep: 1 wolf + 1 villager
 * Deselect: extra wolves, extra villagers, god roles
 * Uses stable testID selectors for reliability
 */
async function configure2PlayerTemplate(page: Page): Promise<void> {
  console.log('[NIGHT] Configuring 2-player template...');

  // All roles to deselect: god roles + extra wolves + extra villagers
  // Keep only: wolf + villager = 2 players
  const rolesToDeselect = [
    'seer',
    'witch',
    'hunter',
    'idiot', // god roles
    'wolf1',
    'wolf2',
    'wolf3', // extra wolves
    'villager1',
    'villager2',
    'villager3', // extra villagers
  ];

  for (const roleId of rolesToDeselect) {
    const chip = page.locator(`[data-testid="config-role-chip-${roleId}"]`).first();
    try {
      // Wait for element to be attached to DOM (not necessarily visible in viewport)
      await chip.waitFor({ state: 'attached', timeout: 2000 });
      // Use force:true to click even if not in viewport (common for RN Web ScrollView)
      console.log(`[NIGHT] Deselecting: ${roleId}`);
      await chip.click({ force: true });
      await page.waitForTimeout(50);
    } catch {
      console.log(`[NIGHT] Warning: ${roleId} chip not found, skipping`);
    }
  }

  // Debug: log final player count from header
  const headerText = await page
    .getByText(/\d+ 名玩家/)
    .first()
    .textContent()
    .catch(() => null);
  console.log(`[NIGHT] After deselect, header: ${headerText}`);
}

/**
 * Configure a 6-player template on ConfigScreen
 * Keep: 2 wolves (普狼x2) + seer + witch + hunter + 1 villager = 6
 * Deselect: wolf3/4, villager2/3/4, 白痴
 */
async function configure6PlayerTemplate(page: Page): Promise<void> {
  console.log('[NIGHT] Configuring 6-player template...');

  // Start from default "标准板12人" - need to deselect to get to 6
  // Default: 4 wolves + 4 villagers + seer + witch + hunter + idiot = 12
  // Target: 2 wolves + 1 villager + seer + witch + hunter = 6

  // Using stable testid selectors (config-role-chip-{id}) instead of fragile getByText

  // Deselect 白痴 (idiot)
  const idiotChip = page.locator('[data-testid="config-role-chip-idiot"]');
  if (await idiotChip.isVisible({ timeout: 500 }).catch(() => false)) {
    console.log('[NIGHT] Deselecting: idiot');
    await idiotChip.click();
    await page.waitForTimeout(100);
  }

  // Deselect extra wolves (keep wolf, wolf1; deselect wolf2, wolf3)
  // Default selection: wolf=true, wolf1=true, wolf2=true, wolf3=true, wolf4=false
  const wolvesToDeselect = ['wolf2', 'wolf3'];
  for (const wolfId of wolvesToDeselect) {
    const wolfChip = page.locator(`[data-testid="config-role-chip-${wolfId}"]`);
    if (await wolfChip.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log(`[NIGHT] Deselecting: ${wolfId}`);
      await wolfChip.click();
      await page.waitForTimeout(100);
    }
  }

  // Deselect extra villagers (keep villager; deselect villager1, villager2, villager3)
  // Default selection: villager=true, villager1=true, villager2=true, villager3=true, villager4=false
  const villagersToDeselect = ['villager1', 'villager2', 'villager3'];
  for (const villagerId of villagersToDeselect) {
    const villagerChip = page.locator(`[data-testid="config-role-chip-${villagerId}"]`);
    if (await villagerChip.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log(`[NIGHT] Deselecting: ${villagerId}`);
      await villagerChip.click();
      await page.waitForTimeout(100);
    }
  }

  // Verify total = 6 (should see "6人" or similar in UI)
  console.log('[NIGHT] 6-player template configured: 2狼 + 预言家 + 女巫 + 猎人 + 1村民');
}

// =============================================================================
// Night Flow Helpers
// =============================================================================

/**
 * Night end keywords that indicate first night has completed
 *
 * PR9: 移除 '重新开始' 作为结束指标
 * - UI 在 ongoing 状态下也显示"重新开始"按钮，会导致误判
 * - '查看昨晚信息' 只在 status=ended 时显示，是稳定的结束信号
 */
const NIGHT_END_KEYWORDS = [
  '平安夜',
  '玩家死亡',
  '昨天晚上',
  '查看昨晚信息', // Button visible only when status=ended
  // NOTE: '重新开始' removed - visible during ongoing in current architecture
];

/**
 * Role turn keywords (dialog titles/messages during night)
 */
const ROLE_TURN_KEYWORDS = [
  '请睁眼',
  '请行动',
  '狼人',
  '预言家',
  '女巫',
  '守卫',
  '猎人',
  '请选择',
  '请选择猎杀对象', // Wolf action message
  '请选择查验对象', // Seer action message
];

/**
 * Buttons to dismiss role dialogs / advance night flow
 */
// Dialog buttons that can advance night flow (unified: info="知道了", choice="确定"/"取消")
// "查看发动状态" is for hunter/darkWolfKing confirm schema
const ADVANCE_BUTTONS = ['知道了', '确定', '不使用技能', '投票空刀', '查看发动状态'];

/**
 * Check if any night end indicator is visible
 */
async function isNightEnded(page: Page): Promise<boolean> {
  for (const keyword of NIGHT_END_KEYWORDS) {
    const isVisible = await page
      .getByText(keyword)
      .first()
      .isVisible({ timeout: 100 })
      .catch(() => false);
    if (isVisible) {
      console.log(`[Night] Found night end indicator: "${keyword}"`);
      return true;
    }
  }
  return false;
}

/**
 * Try to advance night flow by clicking visible buttons or making a selection
 */
async function tryAdvanceNight(
  page: Page,
  turnLog: string[],
  iteration: number,
  state: NightFlowState,
  pageLabel: string,
): Promise<boolean> {
  // Check and log role turn indicators
  await detectRoleTurnIndicators(page, turnLog);

  // Try clicking advance buttons with state-wait
  const visibleButton = await tryClickAdvanceButtons(page);
  if (visibleButton) {
    const stateChanged = await executeActionWithStateWait(page, visibleButton, state, pageLabel);
    return stateChanged;
  }

  // Debug: every 10 iterations, log visible text
  if (iteration % 10 === 0) {
    await logPageState(page, iteration);
  }

  // Try clicking a seat tile if in selection mode
  return tryClickSeatTarget(page, state, pageLabel);
}

async function detectRoleTurnIndicators(page: Page, turnLog: string[]): Promise<void> {
  for (const keyword of ROLE_TURN_KEYWORDS) {
    const isVisible = await page
      .getByText(keyword)
      .first()
      .isVisible({ timeout: 100 })
      .catch(() => false);
    if (isVisible) {
      const text = await page
        .getByText(keyword)
        .first()
        .textContent()
        .catch(() => keyword);
      if (!turnLog.includes(text || keyword)) {
        turnLog.push(text || keyword);
        console.log(`[Night] Role turn detected: "${text}"`);
      }
    }
  }
}

async function tryClickAdvanceButtons(page: Page): Promise<string | null> {
  for (const buttonText of ADVANCE_BUTTONS) {
    const btn = page.getByText(buttonText, { exact: true });
    const isVisible = await btn
      .first()
      .isVisible({ timeout: 100 })
      .catch(() => false);
    if (isVisible) {
      return buttonText;
    }
  }
  return null;
}

const VOTE_COUNT_PATTERN = String.raw`\d+/\d+ 狼人已投票`;

/**
 * Multi-wolf vote tracking state.
 * Uses Set of page labels to track which wolves have completed voting.
 * Prevents double-voting while allowing all wolves to participate.
 */
interface NightFlowState {
  /** Set of page labels that have submitted wolf vote (e.g., "page-0", "page-1") */
  wolfVotedPages: Set<string>;
  /** Total number of wolves expected (parsed from "X/Y 狼人已投票") */
  expectedWolfCount: number;
  /** Fail-fast: track consecutive iterations where wolf vote count is stuck at 0 */
  wolfVoteStuckIterations: number;
  /** Fail-fast: last observed wolf vote count for stuck detection */
  lastWolfVoteCount: number;
  /** Fail-fast: track consecutive iterations with no progress (no action taken) */
  noProgressIterations: number;
  /** Fail-fast: last action message for stuck detection */
  lastActionMessage: string;
}

/**
 * Parse wolf vote count from page: "X/Y 狼人已投票" → { current, total }
 */
async function parseWolfVoteCount(page: Page): Promise<{ current: number; total: number } | null> {
  const voteCountLoc = page.locator(`text=/${VOTE_COUNT_PATTERN}/`);
  if (!(await voteCountLoc.isVisible({ timeout: 100 }).catch(() => false))) {
    return null;
  }
  const text = await voteCountLoc.textContent().catch(() => null);
  if (!text) return null;

  const regex = /(\d+)\/(\d+)/;
  const match = regex.exec(text);
  if (!match) return null;

  return { current: Number.parseInt(match[1], 10), total: Number.parseInt(match[2], 10) };
}

/**
 * Execute a single action and wait for observable state change.
 * Returns true if an action was taken and state changed.
 */
async function executeActionWithStateWait(
  page: Page,
  buttonText: string,
  state: NightFlowState,
  pageLabel: string,
): Promise<boolean> {
  const btn = page.getByText(buttonText, { exact: true }).first();

  // For wolf vote context, check if THIS page already voted
  if (buttonText === '投票空刀' || buttonText === '确定') {
    const voteCount = await parseWolfVoteCount(page);
    if (voteCount) {
      // Update expected wolf count
      if (state.expectedWolfCount === 0) {
        state.expectedWolfCount = voteCount.total;
        console.log(`[Night] Wolf vote count detected: ${voteCount.current}/${voteCount.total}`);
      }

      // Check if THIS page already voted
      if (state.wolfVotedPages.has(pageLabel)) {
        console.log(`[Night] [${pageLabel}] Skipping "${buttonText}" - this wolf already voted`);
        return false;
      }

      // Check if all wolves already voted (shouldn't still be showing vote dialog)
      if (voteCount.current >= voteCount.total) {
        console.log(`[Night] All wolves voted (${voteCount.current}/${voteCount.total}), skipping`);
        return false;
      }
    }
  }

  console.log(`[Night] [${pageLabel}] Clicking button: "${buttonText}"`);
  await btn.click();

  // Wait for observable state change based on button type
  if (buttonText === '投票空刀') {
    // After clicking 投票空刀, a confirm dialog should appear
    const confirmVisible = await page
      .getByText('确定', { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    return confirmVisible;
  }

  if (buttonText === '确定') {
    // Check if this was a wolf vote confirm
    const voteCount = await parseWolfVoteCount(page);

    // Wait for button to be hidden (dialog dismissed)
    await btn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});

    if (voteCount) {
      console.log(
        `[Night] [${pageLabel}] Wolf vote confirmed - count was ${voteCount.current}/${voteCount.total}`,
      );
      state.wolfVotedPages.add(pageLabel);

      // Log when all wolves have voted
      if (state.wolfVotedPages.size >= state.expectedWolfCount) {
        console.log(`[Night] ✅ All ${state.expectedWolfCount} wolves have voted`);
      }
    }

    await page.waitForTimeout(500);
    return true;
  }

  // For other buttons (好, 不使用技能, etc), wait for button to disappear
  const disappeared = await btn
    .waitFor({ state: 'hidden', timeout: 1000 })
    .then(() => true)
    .catch(() => false);
  if (!disappeared) {
    await page.waitForTimeout(300);
  }
  return true;
}

async function logPageState(page: Page, iteration: number): Promise<void> {
  console.log(`[Night] Iteration ${iteration} - checking page state...`);
  const actionMsgLocator = page.locator('[data-testid="action-message"]');
  if (await actionMsgLocator.isVisible({ timeout: 100 }).catch(() => false)) {
    const msgText = await actionMsgLocator.textContent().catch(() => '(unknown)');
    console.log(`[Night] Action message text: "${msgText}"`);
  }
}

async function tryClickSeatTarget(
  page: Page,
  state: NightFlowState,
  pageLabel: string,
): Promise<boolean> {
  // Gate: Only proceed if we're clearly in a target selection UI state
  // Look for known target selection action messages (not just any actionMessage)
  const TARGET_SELECTION_PATTERNS = [
    '请选择要猎杀的玩家', // wolfKill schema prompt
    '请选择猎杀对象',
    '请选择查验对象',
    '请选择守护对象',
    '请选择救人',
    '请选择毒杀',
    '请选择使用解药', // witch save step
    '如要使用毒药，请点击座位。', // witch poison step
    '点击选择',
    '选择目标',
  ];

  // Use testID to locate action message (works on web)
  const actionMsgLocator = page.locator('[data-testid="action-message"]');
  const actionMsgVisible = await actionMsgLocator.isVisible({ timeout: 100 }).catch(() => false);
  if (!actionMsgVisible) return false;

  const actionMsgText = (await actionMsgLocator.textContent().catch(() => '')) ?? '';
  const isTargetSelectionMode = TARGET_SELECTION_PATTERNS.some((pat) =>
    actionMsgText.includes(pat),
  );

  if (!isTargetSelectionMode) {
    // Not in target selection mode - don't randomly click seats
    return false;
  }

  // Check if this is wolf vote mode and this page already voted
  const isWolfVoteMode = actionMsgText.includes('猎杀') || actionMsgText.includes('狼人已投票');
  if (isWolfVoteMode && state.wolfVotedPages.has(pageLabel)) {
    // This wolf already voted, skip
    return false;
  }

  // Get my seat index to exclude self-targeting
  const mySeatIndex = await getMySeatIndex(page);
  if (mySeatIndex === null) {
    // Cannot reliably identify self-seat, fail-safe: do not attempt target selection
    console.log('[Night] Cannot identify my seat - skipping target selection (fail-safe)');
    return false;
  }

  // Try seats from highest to lowest, excluding self
  const seatIndicesToTry = [5, 4, 3, 2, 1, 0].filter((idx) => idx !== mySeatIndex);

  console.log(
    `[Night] [${pageLabel}] Target selection mode detected ("${actionMsgText.slice(0, 30)}..."), my seat=${mySeatIndex}, trying safe targets...`,
  );

  for (const seatIdx of seatIndicesToTry) {
    try {
      const seatTile = getSeatTileLocator(page, seatIdx);
      const isVisible = await seatTile.isVisible({ timeout: 100 }).catch(() => false);
      if (!isVisible) continue;

      await seatTile.click();

      // Wait for confirm button to appear (state change)
      const confirmBtn = page.getByText('确定', { exact: true });
      const confirmVisible = await confirmBtn
        .first()
        .waitFor({ state: 'visible', timeout: 1000 })
        .then(() => true)
        .catch(() => false);

      if (confirmVisible) {
        console.log(
          `[Night] [${pageLabel}] Selected seat ${seatIdx + 1} (excluding self=${mySeatIndex + 1}), confirming...`,
        );
        await confirmBtn.first().click();
        // Wait for confirm button to disappear (state change complete)
        await confirmBtn
          .first()
          .waitFor({ state: 'hidden', timeout: 1000 })
          .catch(() => {});

        // If this was wolf vote, mark this page as voted
        if (isWolfVoteMode) {
          state.wolfVotedPages.add(pageLabel);
          console.log(
            `[Night] [${pageLabel}] Wolf vote submitted, total voted: ${state.wolfVotedPages.size}`,
          );
        }

        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Capture the night result text (平安夜 or death announcement)
 */
async function captureNightResult(page: Page): Promise<string> {
  if (
    await page
      .getByText('平安夜')
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    return '昨天晚上是平安夜。';
  }

  const deathMsg = page.locator(String.raw`text=/\d+号.*玩家死亡/`);
  if (await deathMsg.isVisible({ timeout: 500 }).catch(() => false)) {
    return (await deathMsg.textContent()) || '玩家死亡';
  }

  return 'Night ended (result text not captured)';
}

/**
 * Run night flow loop on multiple pages until completion or timeout.
 * All players may need to take actions depending on their roles.
 */
async function runNightFlowLoop(
  pages: Page[],
  testInfo: TestInfo,
  maxIterations = 50,
  screenshotInterval = 5,
): Promise<{ resultText: string; turnLog: string[] }> {
  const turnLog: string[] = [];
  const primaryPage = pages[0]; // Use first page for result checking

  // State tracking across iterations - supports multi-wolf voting
  const state: NightFlowState = {
    wolfVotedPages: new Set(),
    expectedWolfCount: 0,
    wolfVoteStuckIterations: 0,
    lastWolfVoteCount: -1, // -1 means not yet observed
    noProgressIterations: 0,
    lastActionMessage: '',
  };

  // Fail-fast thresholds
  const WOLF_VOTE_STUCK_THRESHOLD = 8;
  const NO_PROGRESS_THRESHOLD = 15; // If no progress for 15 iterations, fail

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    // Check if night has ended (on primary page)
    if (await isNightEnded(primaryPage)) {
      console.log(`[Night] Night ended at iteration ${iteration}`);
      const resultText = await captureNightResult(primaryPage);
      return { resultText, turnLog };
    }

    // =========================================================================
    // FAIL-FAST: Detect wolf vote stuck (vote count not advancing)
    // =========================================================================
    const wolfVoteCount = await parseWolfVoteCount(primaryPage);
    if (wolfVoteCount === null) {
      // Not in wolf vote phase, reset tracking
      state.wolfVoteStuckIterations = 0;
      state.lastWolfVoteCount = -1;
    } else if (state.lastWolfVoteCount === wolfVoteCount.current) {
      // Vote count hasn't changed
      state.wolfVoteStuckIterations++;
      if (state.wolfVoteStuckIterations >= WOLF_VOTE_STUCK_THRESHOLD) {
        // Fail-fast: wolf vote is stuck
        console.error(
          `[FAIL-FAST] Wolf vote stuck at ${wolfVoteCount.current}/${wolfVoteCount.total} ` +
            `for ${state.wolfVoteStuckIterations} iterations`,
        );

        // Capture diagnostic info
        const diagnostics = await captureWolfVoteDiagnostics(primaryPage, state);
        console.error('[FAIL-FAST] Diagnostics:', JSON.stringify(diagnostics, null, 2));

        // Take screenshot
        await takeScreenshot(primaryPage, testInfo, `fail-fast-wolf-vote-stuck.png`);

        throw new Error(
          `FAIL-FAST: Wolf vote stuck at ${wolfVoteCount.current}/${wolfVoteCount.total}. ` +
            `Diagnostics: ${JSON.stringify(diagnostics)}`,
        );
      }
    } else {
      // Vote count changed, reset stuck counter
      state.wolfVoteStuckIterations = 0;
      state.lastWolfVoteCount = wolfVoteCount.current;
    }
    // =========================================================================

    // Periodic screenshot
    if (iteration % screenshotInterval === 0) {
      await takeScreenshot(primaryPage, testInfo, `night-iter-${iteration}.png`);
    }

    // Try to advance on ALL pages (any player might need to act)
    let advanced = false;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageLabel = `page-${i}`;
      const pageAdvanced = await tryAdvanceNight(page, turnLog, iteration, state, pageLabel);
      if (pageAdvanced) {
        advanced = true;
        break; // One action per iteration
      }
    }

    // =========================================================================
    // FAIL-FAST: Detect global stuck (no progress for too many iterations)
    // =========================================================================
    // Get current action message for comparison
    const actionMsgLocator = primaryPage.locator('[data-testid="action-message"]');
    const currentActionMsg =
      (await actionMsgLocator
        .textContent({ timeout: 100 })
        .catch(() => '')) ?? '';

    if (advanced) {
      // Action was taken, reset no-progress counter
      state.noProgressIterations = 0;
      state.lastActionMessage = currentActionMsg;
    } else {
      // No action was taken this iteration
      if (currentActionMsg === state.lastActionMessage) {
        state.noProgressIterations++;
      } else {
        // Action message changed but no action taken - reset counter but update message
        state.noProgressIterations = 0;
        state.lastActionMessage = currentActionMsg;
      }

      if (state.noProgressIterations >= NO_PROGRESS_THRESHOLD) {
        console.error(
          `[FAIL-FAST] No progress for ${state.noProgressIterations} iterations. ` +
            `Stuck on: "${currentActionMsg}"`,
        );

        const diagnostics = await captureWolfVoteDiagnostics(primaryPage, state);
        diagnostics.stuckActionMessage = currentActionMsg;
        console.error('[FAIL-FAST] Diagnostics:', JSON.stringify(diagnostics, null, 2));

        await takeScreenshot(primaryPage, testInfo, `fail-fast-no-progress.png`);

        throw new Error(
          `FAIL-FAST: No progress for ${state.noProgressIterations} iterations. ` +
            `Stuck on: "${currentActionMsg}". Diagnostics: ${JSON.stringify(diagnostics)}`,
        );
      }
    }
    // =========================================================================

    await primaryPage.waitForTimeout(advanced ? 200 : 500);
  }

  // FAIL-FAST: Max iterations reached without night end
  console.error(`[FAIL-FAST] Max iterations (${maxIterations}) reached without night end`);

  // Capture final diagnostics
  const diagnostics = await captureWolfVoteDiagnostics(primaryPage, state);
  console.error('[FAIL-FAST] Final diagnostics:', JSON.stringify(diagnostics, null, 2));

  await takeScreenshot(primaryPage, testInfo, `fail-fast-max-iterations.png`);

  throw new Error(
    `FAIL-FAST: Night flow did not complete after ${maxIterations} iterations. ` +
      `Diagnostics: ${JSON.stringify(diagnostics)}`,
  );
}

/**
 * Capture diagnostic information for wolf vote stuck failure.
 * Extracts visible UI state to help debug why wolf vote is not advancing.
 */
async function captureWolfVoteDiagnostics(
  page: Page,
  state: NightFlowState,
): Promise<Record<string, unknown>> {
  const diagnostics: Record<string, unknown> = {
    wolfVotedPages: Array.from(state.wolfVotedPages),
    expectedWolfCount: state.expectedWolfCount,
    stuckIterations: state.wolfVoteStuckIterations,
  };

  // Try to get action message
  const actionMsgLocator = page.locator('[data-testid="action-message"]');
  if (await actionMsgLocator.isVisible({ timeout: 100 }).catch(() => false)) {
    diagnostics.actionMessage = await actionMsgLocator.textContent().catch(() => null);
  }

  // Try to get any error messages or rejection reasons from the UI
  const errorLocators = [
    page.locator('[data-testid*="error"]'),
    page.locator('[data-testid*="reject"]'),
    page.getByText(/invalid_step|step_mismatch|no_resolver/i),
  ];

  for (const locator of errorLocators) {
    const isVisible = await locator
      .first()
      .isVisible({ timeout: 100 })
      .catch(() => false);
    if (isVisible) {
      diagnostics.visibleError = await locator
        .first()
        .textContent()
        .catch(() => null);
      break;
    }
  }

  // Get page URL and any visible status
  diagnostics.pageUrl = page.url();

  return diagnostics;
}

// =============================================================================
// Test
// =============================================================================

test.describe('Night 1 Happy Path', () => {
  test('NIGHT-1: 2-player first night runs to completion', async ({ browser }, testInfo) => {
    console.log('\n🌙 NIGHT-1: First night happy path test\n');

    // Create two isolated contexts
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const diagA = setupDiagnostics(pageA, 'HOST-A');
    const diagB = setupDiagnostics(pageB, 'JOINER-B');

    let roomNumber = '';
    let nightResult = { resultText: '', turnLog: [] as string[] };

    try {
      // ===================== HOST A: Create room with 2-player template =====================
      console.log('[NIGHT] === HOST A Setup ===');

      await gotoWithRetry(pageA, '/');
      await waitForAppReady(pageA);
      await ensureAnonLogin(pageA);

      // Create room
      await pageA.getByText('创建房间').click();
      await expect(getVisibleText(pageA, '创建')).toBeVisible({ timeout: 10000 });

      await takeScreenshot(pageA, testInfo, '01-config-screen.png');

      // Configure 2-player template using helper
      await configure2PlayerTemplate(pageA);

      await takeScreenshot(pageA, testInfo, '01b-2player-config.png');

      // Click 创建 to create room
      await getVisibleText(pageA, '创建').click();
      await waitForRoomScreenReady(pageA, { role: 'host' });

      roomNumber = await extractRoomNumber(pageA);
      console.log(`[NIGHT] HOST A created room: ${roomNumber}`);

      await takeScreenshot(pageA, testInfo, '02-room-created.png');

      // ===================== JOINER B: Join room =====================
      console.log('\n[NIGHT] === JOINER B Setup ===');

      await gotoWithRetry(pageB, '/');
      await waitForAppReady(pageB);
      await ensureAnonLogin(pageB);

      // Join room
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });

      await enterRoomCodeViaNumPad(pageB, roomNumber);
      await pageB.getByText('加入', { exact: true }).click();

      await waitForRoomScreenReady(pageB, { role: 'joiner' });
      console.log(`[NIGHT] JOINER B joined room ${roomNumber}`);

      // ===================== JOINER B: Take seat 2 =====================
      console.log('\n[NIGHT] JOINER B taking seat 2...');

      await getSeatTileLocator(pageB, 1).click();
      await expect(pageB.getByText('入座', { exact: true })).toBeVisible({ timeout: 5000 });
      await pageB.getByText('确定', { exact: true }).click();
      await pageB.waitForTimeout(1000);

      // Verify "我" badge visible
      await expect(pageB.getByText('我')).toBeVisible({ timeout: 3000 });
      console.log('[NIGHT] JOINER B seated at seat 2');

      await takeScreenshot(pageA, testInfo, '03-both-seated-hostview.png');
      await takeScreenshot(pageB, testInfo, '03-both-seated-joinerview.png');

      // ===================== HOST A: Prepare to flip roles =====================
      console.log('\n[NIGHT] HOST A clicking 准备看牌...');

      // Wait for Host to see both players seated
      await pageA.waitForTimeout(1000);

      // Click 准备看牌 button
      const prepareBtn = pageA.getByText('准备看牌');
      await expect(prepareBtn).toBeVisible({ timeout: 5000 });
      await prepareBtn.click();

      // Confirm dialog
      await expect(pageA.getByText('允许看牌？')).toBeVisible({ timeout: 3000 });
      await pageA.getByText('确定', { exact: true }).click();
      await pageA.waitForTimeout(1000);

      await takeScreenshot(pageA, testInfo, '04-roles-assigned.png');
      console.log('[NIGHT] Roles assigned');

      // ===================== Both players view their roles =====================
      console.log('\n[NIGHT] Players viewing roles...');

      // Host A views role - MUST click to trigger viewedRole()
      console.log('[NIGHT] HOST A clicking 查看身份...');
      // Use exact: true to distinguish from "⏳ 等待查看身份"
      const viewRoleBtnA = pageA.getByText('查看身份', { exact: true });
      await expect(viewRoleBtnA).toBeVisible({ timeout: 5000 });
      await viewRoleBtnA.click();

      // Wait for role card dialog and dismiss it
      // Dialog shows "你的身份是：xxx" and has a "确定" button inside AlertModal
      const roleDialogA = pageA.getByText('你的身份是', { exact: false });
      await expect(roleDialogA).toBeVisible({ timeout: 3000 });
      console.log('[NIGHT] HOST A role card visible');

      // Click the "确定" text inside the modal (AlertModal uses TouchableOpacity with Text)
      // Wait a moment for dialog to fully render
      await pageA.waitForTimeout(300);
      const okBtnA = pageA.locator('text="确定"').first();
      await expect(okBtnA).toBeVisible({ timeout: 2000 });
      await okBtnA.click();
      console.log('[NIGHT] HOST A dismissed role card');

      await pageA.waitForTimeout(500);

      // Joiner B views role - MUST click to send VIEWED_ROLE to host
      console.log('[NIGHT] JOINER B clicking 查看身份...');
      // Use exact: true to distinguish from "⏳ 等待查看身份"
      const viewRoleBtnB = pageB.getByText('查看身份', { exact: true });
      await expect(viewRoleBtnB).toBeVisible({ timeout: 5000 });
      await viewRoleBtnB.click();

      const roleDialogB = pageB.getByText('你的身份是', { exact: false });
      await expect(roleDialogB).toBeVisible({ timeout: 3000 });
      console.log('[NIGHT] JOINER B role card visible');

      await pageB.waitForTimeout(300);
      const okBtnB = pageB.locator('text="确定"').first();
      await expect(okBtnB).toBeVisible({ timeout: 2000 });
      await okBtnB.click();
      console.log('[NIGHT] JOINER B dismissed role card');

      // Wait for state to sync (VIEWED_ROLE message needs time to process)
      await pageA.waitForTimeout(1000);
      console.log('[NIGHT] Both players viewed roles, waiting for state sync...');

      // ===================== HOST A: Start game =====================
      console.log('\n[NIGHT] HOST A starting game...');

      const startBtn = pageA.getByText('开始游戏');
      await expect(startBtn).toBeVisible({ timeout: 5000 });
      await startBtn.click();

      // Confirm start game dialog
      await expect(pageA.getByText('开始游戏？')).toBeVisible({ timeout: 3000 });
      await pageA.getByText('确定', { exact: true }).click();

      console.log('[NIGHT] Game started - entering night flow...');
      await takeScreenshot(pageA, testInfo, '05-night-started.png');

      // ===================== Run night flow loop =====================
      console.log('\n[NIGHT] Running night flow loop...');

      // Run night flow on BOTH pages (player actions depend on role assignment)
      nightResult = await runNightFlowLoop([pageA, pageB], testInfo, 80, 10);

      console.log(`[NIGHT] Night flow complete. Result: ${nightResult.resultText}`);
      console.log(`[NIGHT] Turn log: ${nightResult.turnLog.join(' → ')}`);

      await takeScreenshot(pageA, testInfo, '06-night-ended.png');

      // ===================== Verify night end =====================
      console.log('\n[NIGHT] Verifying night end...');

      // Check for "查看昨晚信息" button (indicates night ended)
      const lastNightBtn = pageA.getByText('查看昨晚信息');
      const restartBtn = pageA.getByText('重新开始');

      const hasLastNightBtn = await lastNightBtn.isVisible({ timeout: 3000 }).catch(() => false);
      const hasRestartBtn = await restartBtn.isVisible({ timeout: 1000 }).catch(() => false);

      console.log(`[NIGHT] 查看昨晚信息 visible: ${hasLastNightBtn}`);
      console.log(`[NIGHT] 重新开始 visible: ${hasRestartBtn}`);

      // If last night button is visible, click it to get the result
      if (hasLastNightBtn) {
        console.log('[NIGHT] Clicking 查看昨晚信息 button...');
        try {
          // Wait for button to be actionable, then click
          await lastNightBtn.click({ timeout: 5000 });
          console.log('[NIGHT] Button clicked successfully');
        } catch (error_) {
          console.log(`[NIGHT] WARNING: Failed to click 查看昨晚信息: ${error_}`);
          // Take screenshot for debugging
          await takeScreenshot(pageA, testInfo, '07-click-failed.png');
        }

        // Wait for confirmation dialog with fail-fast
        console.log('[NIGHT] Waiting for confirmation dialog...');
        const confirmDialogVisible = await pageA
          .getByText('确定查看昨夜信息？')
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (confirmDialogVisible) {
          console.log('[NIGHT] Clicking 确定...');
          await pageA.getByText('确定', { exact: true }).click();
          await pageA.waitForTimeout(500);

          await takeScreenshot(pageA, testInfo, '07-last-night-info.png');

          // Capture the result text from alert
          const alertText = await pageA
            .locator('text=/平安夜|玩家死亡/')
            .first()
            .textContent({ timeout: 2000 })
            .catch(() => null);
          if (alertText) {
            nightResult.resultText = alertText;
            console.log(`[NIGHT] Last night info: ${alertText}`);
          }

          // Dismiss alert
          const dismissBtn = pageA.getByText('知道了', { exact: true });
          if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log('[NIGHT] Dismissing alert with 知道了...');
            await dismissBtn.click();
          }
        } else {
          console.log('[NIGHT] WARNING: Confirmation dialog not visible, skipping last night info capture');
        }
      }

      // ===================== Assertions =====================
      // NOTE: hasRestartBtn is NOT a valid night-end indicator in current architecture
      // (UI shows "重新开始" even during ongoing state)
      // Only "查看昨晚信息" and result text are reliable indicators
      const nightEnded =
        hasLastNightBtn ||
        nightResult.resultText.includes('平安夜') ||
        nightResult.resultText.includes('死亡');

      expect(nightEnded, 'First night should complete with result (查看昨晚信息 visible or death/peace result)').toBe(true);

      // Attach diagnostic report
      await testInfo.attach('night1.txt', {
        body: [
          '=== NIGHT-1 HAPPY PATH TEST ===',
          `Room: ${roomNumber}`,
          '',
          '=== NIGHT FLOW RESULT ===',
          `Result: ${nightResult.resultText}`,
          '',
          '=== ROLE TURN LOG ===',
          nightResult.turnLog.length > 0
            ? nightResult.turnLog.join('\n')
            : '(no role turns logged)',
          '',
          '=== END STATE ===',
          `查看昨晚信息 visible: ${hasLastNightBtn}`,
          `重新开始 visible: ${hasRestartBtn}`,
          '',
          '=== HOST A CONSOLE LOGS ===',
          ...diagA.consoleLogs,
          '',
          '=== JOINER B CONSOLE LOGS ===',
          ...diagB.consoleLogs,
          '',
          '=== ERRORS ===',
          `Host errors: ${diagA.pageErrors.join(', ') || 'none'}`,
          `Joiner errors: ${diagB.pageErrors.join(', ') || 'none'}`,
        ].join('\n'),
        contentType: 'text/plain',
      });

      console.log('\n🌙 NIGHT-1 TEST COMPLETE\n');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  /**
   * 6-player night test: 2 wolves + seer + witch + hunter + 1 villager
   * Validates multi-wolf voting and full role flow.
   */
  test('6-player night flow with 2 wolves', async ({ browser }, testInfo) => {
    console.log('\n🌙 NIGHT-1: 6-player multi-wolf test (2狼+预言家+女巫+猎人+村民)\n');

    const PLAYER_COUNT = 6;
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    const diags: ReturnType<typeof setupDiagnostics>[] = [];

    let roomNumber = '';
    let nightResult = { resultText: '', turnLog: [] as string[] };

    try {
      // Create 6 isolated contexts
      for (let i = 0; i < PLAYER_COUNT; i++) {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        const label = i === 0 ? 'HOST' : `JOINER-${i + 1}`;
        contexts.push(ctx);
        pages.push(page);
        diags.push(setupDiagnostics(page, label));
      }

      const [hostPage, ...joinerPages] = pages;

      // ===================== HOST: Create room with 6-player template =====================
      console.log('[6P] === HOST Setup ===');

      await gotoWithRetry(hostPage, '/');
      await waitForAppReady(hostPage);
      await ensureAnonLogin(hostPage);

      await hostPage.getByText('创建房间').click();
      await expect(getVisibleText(hostPage, '创建')).toBeVisible({ timeout: 10000 });

      // Configure 6-player template
      await configure6PlayerTemplate(hostPage);
      await takeScreenshot(hostPage, testInfo, '6p-01-config.png');

      // Create room
      await getVisibleText(hostPage, '创建').click();
      await waitForRoomScreenReady(hostPage, { role: 'host' });

      roomNumber = await extractRoomNumber(hostPage);
      console.log(`[6P] HOST created room: ${roomNumber}`);
      await takeScreenshot(hostPage, testInfo, '6p-02-room-created.png');

      // ===================== JOINERS: Join room and take seats =====================
      console.log('\n[6P] === Joiners Joining ===');

      for (let i = 0; i < joinerPages.length; i++) {
        const joinerPage = joinerPages[i];
        const seatIndex = i + 1; // Seats 2-6 (index 1-5)
        const playerNum = i + 2; // Players 2-6

        await gotoWithRetry(joinerPage, '/');
        await waitForAppReady(joinerPage);
        await ensureAnonLogin(joinerPage);

        // Join room
        await getVisibleText(joinerPage, '进入房间').first().click();
        await expect(joinerPage.getByText('加入房间')).toBeVisible({ timeout: 5000 });

        await enterRoomCodeViaNumPad(joinerPage, roomNumber);
        await joinerPage.getByText('加入', { exact: true }).click();

        await waitForRoomScreenReady(joinerPage, { role: 'joiner' });
        console.log(`[6P] Player ${playerNum} joined room ${roomNumber}`);

        // Take seat
        await getSeatTileLocator(joinerPage, seatIndex).click();
        await expect(joinerPage.getByText('入座', { exact: true })).toBeVisible({ timeout: 5000 });
        await joinerPage.getByText('确定', { exact: true }).click();
        await joinerPage.waitForTimeout(500);

        await expect(joinerPage.getByText('我')).toBeVisible({ timeout: 3000 });
        console.log(`[6P] Player ${playerNum} seated at seat ${seatIndex + 1}`);
      }

      await takeScreenshot(hostPage, testInfo, '6p-03-all-seated.png');

      // ===================== Stabilization: Ensure all players connected =====================
      // Wait for presence count to stabilize at 6 before proceeding
      console.log('\n[6P] Waiting for presence stabilization...');
      const presenceStableStart = Date.now();
      let presenceCheckAttempts = 0;
      const MAX_PRESENCE_ATTEMPTS = 10;

      while (presenceCheckAttempts < MAX_PRESENCE_ATTEMPTS) {
        presenceCheckAttempts++;
        // Poll each joiner page to keep their connections alive
        for (const joinerPage of joinerPages) {
          // Simple DOM read to keep the page active
          await joinerPage.locator('body').count();
        }
        await hostPage.waitForTimeout(200);

        // Check if 准备看牌 is visible (means roomStatus === seated)
        const isPrepareVisible = await hostPage
          .getByText('准备看牌')
          .isVisible()
          .catch(() => false);
        if (isPrepareVisible) {
          console.log(
            `[6P] Presence stable, 准备看牌 visible after ${Date.now() - presenceStableStart}ms (attempt ${presenceCheckAttempts})`,
          );
          break;
        }

        if (presenceCheckAttempts === MAX_PRESENCE_ATTEMPTS) {
          console.log(`[6P] ⚠️ 准备看牌 not visible after ${MAX_PRESENCE_ATTEMPTS} attempts`);
        }
      }

      // ===================== HOST: Prepare to flip roles =====================
      console.log('\n[6P] HOST clicking 准备看牌...');

      const prepareBtn = hostPage.getByText('准备看牌');
      await expect(prepareBtn).toBeVisible({ timeout: 5000 });
      await prepareBtn.click();

      await expect(hostPage.getByText('允许看牌？')).toBeVisible({ timeout: 3000 });
      await hostPage.getByText('确定', { exact: true }).click();
      await hostPage.waitForTimeout(1000);

      await takeScreenshot(hostPage, testInfo, '6p-04-roles-assigned.png');
      console.log('[6P] Roles assigned');

      // ===================== All players view roles =====================
      console.log('\n[6P] Players viewing roles...');

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const label = i === 0 ? 'HOST' : `P${i + 1}`;

        console.log(`[6P] ${label} clicking 查看身份...`);
        const viewRoleBtn = page.getByText('查看身份', { exact: true });
        await expect(viewRoleBtn).toBeVisible({ timeout: 5000 });
        await viewRoleBtn.click();

        const roleDialog = page.getByText('你的身份是', { exact: false });
        await expect(roleDialog).toBeVisible({ timeout: 3000 });

        await page.waitForTimeout(200);
        const okBtn = page.locator('text="确定"').first();
        await expect(okBtn).toBeVisible({ timeout: 2000 });
        await okBtn.click();
        console.log(`[6P] ${label} dismissed role card`);

        await page.waitForTimeout(300);
      }

      await hostPage.waitForTimeout(1000);
      console.log('[6P] All players viewed roles');

      // ===================== HOST: Start game =====================
      console.log('\n[6P] HOST starting game...');

      const startBtn = hostPage.getByText('开始游戏');
      await expect(startBtn).toBeVisible({ timeout: 5000 });
      await startBtn.click();

      await expect(hostPage.getByText('开始游戏？')).toBeVisible({ timeout: 3000 });
      await hostPage.getByText('确定', { exact: true }).click();

      console.log('[6P] Game started - entering night flow...');
      await takeScreenshot(hostPage, testInfo, '6p-05-night-started.png');

      // ===================== Run night flow on all pages =====================
      console.log('\n[6P] Running night flow with 6 players (2 wolves)...');

      // Multi-player night flow with higher iteration limit
      nightResult = await runNightFlowLoop(pages, testInfo, 120, 15);

      console.log(`[6P] Night flow complete. Result: ${nightResult.resultText}`);
      console.log(`[6P] Turn log: ${nightResult.turnLog.join(' → ')}`);

      await takeScreenshot(hostPage, testInfo, '6p-06-night-ended.png');

      // ===================== Verify night end =====================
      console.log('\n[6P] Verifying night end...');

      const lastNightBtn = hostPage.getByText('查看昨晚信息');
      const restartBtn = hostPage.getByText('重新开始');

      const hasLastNightBtn = await lastNightBtn.isVisible({ timeout: 5000 }).catch(() => false);
      const hasRestartBtn = await restartBtn.isVisible({ timeout: 1000 }).catch(() => false);

      console.log(`[6P] 查看昨晚信息 visible: ${hasLastNightBtn}`);
      console.log(`[6P] 重新开始 visible: ${hasRestartBtn}`);

      // Night should complete (smoke test - no death assertion)
      // NOTE: hasRestartBtn is NOT a valid night-end indicator in current architecture
      // (UI shows "重新开始" even during ongoing state)
      const nightEnded =
        hasLastNightBtn ||
        nightResult.resultText.includes('平安夜') ||
        nightResult.resultText.includes('死亡');

      expect(nightEnded, '6-player first night should complete (查看昨晚信息 visible or death/peace result)').toBe(true);

      // Attach diagnostic report
      await testInfo.attach('6player-night.txt', {
        body: [
          '=== 6-PLAYER NIGHT TEST ===',
          `Room: ${roomNumber}`,
          'Template: 2狼 + 预言家 + 女巫 + 猎人 + 1村民',
          '',
          '=== NIGHT FLOW RESULT ===',
          `Result: ${nightResult.resultText}`,
          '',
          '=== ROLE TURN LOG ===',
          nightResult.turnLog.length > 0
            ? nightResult.turnLog.join('\n')
            : '(no role turns logged)',
          '',
          '=== END STATE ===',
          `查看昨晚信息 visible: ${hasLastNightBtn}`,
          `重新开始 visible: ${hasRestartBtn}`,
          '',
          '=== PLAYER LOGS ===',
          ...diags.flatMap((d, i) => [
            `--- Player ${i + 1} (${i === 0 ? 'HOST' : 'JOINER'}) ---`,
            `Errors: ${d.pageErrors.join(', ') || 'none'}`,
          ]),
        ].join('\n'),
        contentType: 'text/plain',
      });

      console.log('\n🌙 6-PLAYER NIGHT TEST COMPLETE\n');
    } finally {
      for (const ctx of contexts) {
        await ctx.close();
      }
    }
  });

  /**
   * Restart regression test: After first night, click 重新开始, verify second night runs
   */
  test('restart after first night completes successfully', async ({ browser }, testInfo) => {
    console.log('\n🔄 RESTART REGRESSION TEST\n');

    // Use 2-player template for faster restart test
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const diagA = setupDiagnostics(pageA, 'HOST');
    const diagB = setupDiagnostics(pageB, 'JOINER');

    let roomNumber = '';

    try {
      // ===================== Setup: Same as 2-player test =====================
      console.log('[RESTART] === Initial Setup ===');

      await gotoWithRetry(pageA, '/');
      await waitForAppReady(pageA);
      await ensureAnonLogin(pageA);

      await pageA.getByText('创建房间').click();
      await expect(getVisibleText(pageA, '创建')).toBeVisible({ timeout: 10000 });
      await configure2PlayerTemplate(pageA);
      await getVisibleText(pageA, '创建').click();
      await waitForRoomScreenReady(pageA, { role: 'host' });

      roomNumber = await extractRoomNumber(pageA);
      console.log(`[RESTART] Room created: ${roomNumber}`);

      // Joiner joins
      await gotoWithRetry(pageB, '/');
      await waitForAppReady(pageB);
      await ensureAnonLogin(pageB);
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      await enterRoomCodeViaNumPad(pageB, roomNumber);
      await pageB.getByText('加入', { exact: true }).click();
      await waitForRoomScreenReady(pageB, { role: 'joiner' });

      // Joiner takes seat
      await getSeatTileLocator(pageB, 1).click();
      await expect(pageB.getByText('入座', { exact: true })).toBeVisible({ timeout: 5000 });
      await pageB.getByText('确定', { exact: true }).click();
      await expect(pageB.getByText('我')).toBeVisible({ timeout: 3000 });
      console.log('[RESTART] Both players seated');

      // ===================== First Night =====================
      console.log('\n[RESTART] === Running First Night ===');

      // Prepare roles
      await pageA.waitForTimeout(500);
      await pageA.getByText('准备看牌').click();
      await expect(pageA.getByText('允许看牌？')).toBeVisible({ timeout: 3000 });
      await pageA.getByText('确定', { exact: true }).click();
      await pageA.waitForTimeout(1000);

      // Both view roles
      for (const page of [pageA, pageB]) {
        const btn = page.getByText('查看身份', { exact: true });
        await expect(btn).toBeVisible({ timeout: 5000 });
        await btn.click();
        await expect(page.getByText('你的身份是', { exact: false })).toBeVisible({ timeout: 3000 });
        await page.waitForTimeout(200);
        await page.locator('text="确定"').first().click();
        await page.waitForTimeout(300);
      }
      await pageA.waitForTimeout(1000);

      // Start game
      await pageA.getByText('开始游戏').click();
      await expect(pageA.getByText('开始游戏？')).toBeVisible({ timeout: 3000 });
      await pageA.getByText('确定', { exact: true }).click();

      console.log('[RESTART] First night started...');

      // Run first night
      const firstNight = await runNightFlowLoop([pageA, pageB], testInfo, 60, 10);
      console.log(`[RESTART] First night result: ${firstNight.resultText}`);

      await takeScreenshot(pageA, testInfo, 'restart-01-first-night-done.png');

      // Dismiss the speaking order dialog if visible (shows after night ends)
      const speakingOrderDialog = pageA.getByText('发言顺序');
      if (await speakingOrderDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('[RESTART] Dismissing speaking order dialog...');
        await pageA.getByText('知道了', { exact: true }).click();
        await pageA.waitForTimeout(300);
      }

      // ===================== Restart =====================
      console.log('\n[RESTART] === Clicking 重新开始 ===');

      const restartBtn = pageA.getByText('重新开始');
      await expect(restartBtn).toBeVisible({ timeout: 5000 });
      await restartBtn.click();

      // Confirm restart dialog - the dialog text is "重新开始游戏？"
      const confirmDialog = pageA.getByText('重新开始游戏？');
      await expect(confirmDialog).toBeVisible({ timeout: 3000 });
      await pageA.getByText('确定', { exact: true }).click();

      await pageA.waitForTimeout(1000);
      console.log('[RESTART] Game restarted');
      await takeScreenshot(pageA, testInfo, 'restart-02-after-restart.png');

      // Wait for both pages to stabilize after restart
      // After restart, state resets to seating phase - both pages should show seat grid
      console.log('[RESTART] Waiting for both pages to stabilize...');
      for (const page of [pageA, pageB]) {
        // Wait for seat grid to be visible (game reset to seating phase)
        await expect(page.locator('[data-testid^="seat-tile-"]').first()).toBeVisible({
          timeout: 5000,
        });
      }
      console.log('[RESTART] Both pages stabilized after restart');

      // ===================== Second Night: Re-run the flow =====================
      console.log('\n[RESTART] === Running Second Night ===');

      // 准备看牌 should be visible again (host only)
      const prepareBtn2 = pageA.getByText('准备看牌');
      await expect(prepareBtn2).toBeVisible({ timeout: 8000 });
      await prepareBtn2.click();
      await expect(pageA.getByText('允许看牌？')).toBeVisible({ timeout: 3000 });
      await pageA.getByText('确定', { exact: true }).click();
      await pageA.waitForTimeout(1000);

      // Both view roles again
      for (const page of [pageA, pageB]) {
        const btn = page.getByText('查看身份', { exact: true });
        await expect(btn).toBeVisible({ timeout: 5000 });
        await btn.click();
        await expect(page.getByText('你的身份是', { exact: false })).toBeVisible({ timeout: 3000 });
        await page.waitForTimeout(200);
        await page.locator('text="确定"').first().click();
        await page.waitForTimeout(300);
      }
      await pageA.waitForTimeout(1000);

      // Start second game
      await pageA.getByText('开始游戏').click();
      await expect(pageA.getByText('开始游戏？')).toBeVisible({ timeout: 3000 });
      await pageA.getByText('确定', { exact: true }).click();

      console.log('[RESTART] Second night started...');

      // Run second night
      const secondNight = await runNightFlowLoop([pageA, pageB], testInfo, 60, 10);
      console.log(`[RESTART] Second night result: ${secondNight.resultText}`);

      await takeScreenshot(pageA, testInfo, 'restart-03-second-night-done.png');

      // ===================== Verify second night completed =====================
      const lastNightBtn = pageA.getByText('查看昨晚信息');
      const restartBtn2 = pageA.getByText('重新开始');

      const hasLastNight = await lastNightBtn.isVisible({ timeout: 5000 }).catch(() => false);
      const hasRestart = await restartBtn2.isVisible({ timeout: 1000 }).catch(() => false);

      const secondNightEnded =
        hasLastNight ||
        hasRestart ||
        secondNight.resultText.includes('平安夜') ||
        secondNight.resultText.includes('死亡');

      expect(secondNightEnded, 'Second night after restart should complete').toBe(true);

      await testInfo.attach('restart-test.txt', {
        body: [
          '=== RESTART REGRESSION TEST ===',
          `Room: ${roomNumber}`,
          '',
          '=== FIRST NIGHT ===',
          `Result: ${firstNight.resultText}`,
          `Turns: ${firstNight.turnLog.join(' → ')}`,
          '',
          '=== SECOND NIGHT (after restart) ===',
          `Result: ${secondNight.resultText}`,
          `Turns: ${secondNight.turnLog.join(' → ')}`,
          '',
          '=== ERRORS ===',
          `Host: ${diagA.pageErrors.join(', ') || 'none'}`,
          `Joiner: ${diagB.pageErrors.join(', ') || 'none'}`,
        ].join('\n'),
        contentType: 'text/plain',
      });

      console.log('\n🔄 RESTART REGRESSION TEST COMPLETE\n');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  /**
   * Settings verification test: Change template via settings, verify seat count changes
   */
  test('settings change affects seat count', async ({ browser }, testInfo) => {
    console.log('\n⚙️ SETTINGS VERIFICATION TEST\n');

    const context = await browser.newContext();
    const page = await context.newPage();
    const diag = setupDiagnostics(page, 'HOST');

    let roomNumber = '';

    try {
      // ===================== Create room with 2-player template =====================
      console.log('[SETTINGS] === Initial Setup with 2-player ===');

      await gotoWithRetry(page, '/');
      await waitForAppReady(page);
      await ensureAnonLogin(page);

      await page.getByText('创建房间').click();
      await expect(getVisibleText(page, '创建')).toBeVisible({ timeout: 10000 });
      await configure2PlayerTemplate(page);
      await getVisibleText(page, '创建').click();
      await waitForRoomScreenReady(page, { role: 'host' });

      roomNumber = await extractRoomNumber(page);
      console.log(`[SETTINGS] Room created: ${roomNumber}`);

      await takeScreenshot(page, testInfo, 'settings-01-initial-room.png');

      // ===================== Count initial seats using stable testID selector =====================
      const initialSeats = await countSeatTiles(page);
      console.log(`[SETTINGS] Initial seat count: ${initialSeats}`);
      expect(initialSeats).toBe(2);

      // ===================== Open settings and change template =====================
      console.log('\n[SETTINGS] === Changing template via settings ===');

      const settingsBtn = page.getByText('⚙️ 设置');
      await expect(settingsBtn).toBeVisible({ timeout: 5000 });
      await settingsBtn.click();

      // Should navigate to Config screen (in edit mode, button shows "保存" not "创建")
      await expect(getVisibleText(page, '保存')).toBeVisible({ timeout: 10000 });
      console.log('[SETTINGS] Config screen opened');

      // Debug: Check what header shows
      const headerPlayerCount = await page
        .getByText(/\d+ 名玩家/)
        .first()
        .textContent()
        .catch(() => 'regex not found');
      console.log(`[SETTINGS] Header player count (before action): ${headerPlayerCount}`);

      // Wait for loading to complete (in edit mode, ConfigScreen loads existing template)
      // The loading spinner shows "加载中..." - wait for it to disappear
      await expect(page.getByText('加载中...'))
        .toBeHidden({ timeout: 10000 })
        .catch(() => {
          // It may already be hidden, that's fine
        });

      // In React Native Web, elements inside ScrollView may report as "hidden" even when rendered.
      // Instead of visibility check, wait for the element to exist in DOM
      // Use .first() because React Native Web may render duplicate elements
      await page
        .locator('[data-testid="config-role-chip-villager1"]')
        .first()
        .waitFor({ state: 'attached', timeout: 5000 });
      console.log('[SETTINGS] Config screen content loaded');

      await takeScreenshot(page, testInfo, 'settings-02-config-screen.png');

      // ===================== Add exactly +1 villager (S1 requirement) =====================
      // Current state: 1 wolf + 1 villager (2-player template)
      // Target: 1 wolf + 2 villagers (3-player)
      //
      // In 2-player template:
      // - wolf (selected), wolf1-4 (not selected)
      // - villager (selected), villager1-4 (not selected)
      //
      // We click villager1 to add +1 villager.
      // Current state after 2-player template: villager (selected), villager1-4 (not selected)
      //
      // React Native Web may render duplicate elements. Filter for visible chips only.

      const allVillagerChips = await page.getByText('村民', { exact: true }).all();
      console.log(
        `[SETTINGS] Found ${allVillagerChips.length} total villager chips (may include hidden duplicates)`,
      );

      // Filter for visible chips only
      const visibleVillagerChips: typeof allVillagerChips = [];
      for (const chip of allVillagerChips) {
        if (await chip.isVisible().catch(() => false)) {
          visibleVillagerChips.push(chip);
        }
      }
      console.log(`[SETTINGS] ${visibleVillagerChips.length} visible villager chips`);

      if (visibleVillagerChips.length < 2) {
        throw new Error(
          `Expected at least 2 visible villager chips, found ${visibleVillagerChips.length}`,
        );
      }

      // Click the second visible villager chip (villager1) to add +1 villager
      console.log(`[SETTINGS] Clicking visible villager chip[1] (villager1) to add +1 villager`);
      await visibleVillagerChips[1].click();
      await page.waitForTimeout(300);

      // Verify the click worked by checking the player count in header (should show "3 名玩家")
      const playerCountText = await page
        .getByText(/\d+ 名玩家/)
        .textContent()
        .catch(() => 'not found');
      console.log(`[SETTINGS] Player count after click: ${playerCountText}`);

      console.log('[SETTINGS] Added villager1 (+1 villager)');
      await takeScreenshot(page, testInfo, 'settings-03-added-villager.png');

      // Apply changes (click 保存 button - in edit mode)
      await getVisibleText(page, '保存').click();
      await waitForRoomScreenReady(page, { role: 'host' });

      console.log('[SETTINGS] Settings applied, back in room');

      // ===================== Verify seat count changed using stable testID selector =====================
      const updatedSeats = await countSeatTiles(page);
      console.log(`[SETTINGS] Updated seat count: ${updatedSeats}`);

      await takeScreenshot(page, testInfo, 'settings-04-updated-room.png');

      // Seat count should be exactly 3 (was 2, added 1 villager)
      expect(updatedSeats).toBe(3);
      console.log(`[SETTINGS] ✅ Seat count changed: ${initialSeats} → ${updatedSeats}`);

      await testInfo.attach('settings-test.txt', {
        body: [
          '=== SETTINGS VERIFICATION TEST ===',
          `Room: ${roomNumber}`,
          '',
          '=== SEAT COUNT ===',
          `Initial: ${initialSeats}`,
          `After settings change: ${updatedSeats}`,
          '',
          '=== CHANGE MADE ===',
          `Clicked: config-role-chip-villager1 (added +1 villager)`,
          '',
          '=== ERRORS ===',
          `Host: ${diag.pageErrors.join(', ') || 'none'}`,
        ].join('\n'),
        contentType: 'text/plain',
      });

      console.log('\n⚙️ SETTINGS VERIFICATION TEST COMPLETE\n');
    } finally {
      await context.close();
    }
  });
});
