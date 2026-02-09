import { Page, TestInfo } from '@playwright/test';

/**
 * NightFlowPage Page Object
 *
 * Encapsulates the night flow loop: polling for buttons, clicking targets,
 * and detecting night-end indicators.
 *
 * This is the "generic night runner" — it does NOT assert specific role
 * actions (that's Jest integration tests' job). It only verifies the night
 * runs to completion (smoke test).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NightFlowState {
  wolfVotedPages: Set<string>;
  expectedWolfCount: number;
  wolfVoteStuckIterations: number;
  lastWolfVoteCount: number;
  noProgressIterations: number;
  lastActionMessage: string;
}

interface NightFlowResult {
  resultText: string;
  turnLog: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Chinese UI text constants used for night flow detection.
 *
 * Centralised here so i18n changes only need one update.
 * Sources: RoomScreen action messages, AlertModal titles,
 * NightProgressIndicator, and death result banners.
 */
const UI_TEXT = {
  /** Texts that signal the night phase has ended */
  nightEnd: ['平安夜', '玩家死亡', '昨天晚上', '查看昨晚信息'] as const,

  /** Texts indicating a role's turn is active */
  roleTurn: [
    '请睁眼',
    '请行动',
    '狼人',
    '预言家',
    '女巫',
    '守卫',
    '猎人',
    '请选择',
    '请选择猎杀对象',
    '请选择查验对象',
  ] as const,

  /** Button labels that advance the night flow */
  advanceButtons: [
    '知道了',
    '确定',
    '不使用技能',
    '投票空刀',
    '空刀',
    '查看发动状态',
    '查看技能状态',
  ] as const,

  /** Action message patterns indicating a seat-target selection is needed */
  targetSelection: [
    '请选择要猎杀的玩家',
    '请选择猎杀对象',
    '请选择查验对象',
    '请选择守护对象',
    '请选择救人',
    '请选择毒杀',
    '请选择使用解药',
    '如要使用毒药，请点击座位。',
    '点击选择',
    '选择目标',
  ] as const,

  /**
   * Wolf vote confirm AlertModal title (data-testid="alert-title").
   *
   * Reliability note: we detect the wolf vote confirm dialog by its *title*
   * (`alertTitle === '狼人投票'`) rather than by the button text ('确定'),
   * because '确定' also appears in non-wolf-vote alerts (e.g. action prompts).
   * The title is rendered via a dedicated `alert-title` testID inside
   * `AlertModal`, which is stable across layouts.
   */
  wolfVoteConfirmTitle: '狼人投票',
} as const;

/** Regex pattern for wolf vote progress (e.g. "1/2 狼人已投票"). */
const VOTE_COUNT_PATTERN = String.raw`\d+/\d+ 狼人已投票`;

const WOLF_VOTE_STUCK_THRESHOLD = 8;
const NO_PROGRESS_THRESHOLD = 35;

// ---------------------------------------------------------------------------
// Logging control
// ---------------------------------------------------------------------------

/** Module-level verbose flag. Set via `opts.verbose` in `runNightFlowLoop`. */
let _verbose = false;

function nightLog(msg: string): void {
  if (_verbose) console.log(msg);
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

async function isTextVisible(page: Page, text: string, exact = false): Promise<boolean> {
  return page
    .getByText(text, { exact })
    .first()
    .isVisible({ timeout: 300 })
    .catch(() => false);
}

async function parseWolfVoteCount(page: Page): Promise<{ current: number; total: number } | null> {
  const loc = page.locator(`text=/${VOTE_COUNT_PATTERN}/`);
  if (!(await loc.isVisible({ timeout: 100 }).catch(() => false))) return null;
  const text = await loc.textContent().catch(() => null);
  if (!text) return null;
  const match = /(\d+)\/(\d+)/.exec(text);
  return match
    ? { current: Number.parseInt(match[1], 10), total: Number.parseInt(match[2], 10) }
    : null;
}

async function getMySeatIndex(page: Page): Promise<number | null> {
  const myBadge = page.getByText('我', { exact: true }).first();
  if (!(await myBadge.isVisible({ timeout: 500 }).catch(() => false))) return null;

  for (let i = 0; i < 12; i++) {
    const tile = page.locator(`[data-testid="seat-tile-${i}"]`);
    if (
      await tile
        .locator('text="我"')
        .isVisible({ timeout: 100 })
        .catch(() => false)
    )
      return i;
  }
  return null;
}

function getSeatTileLocator(page: Page, seatIndex: number) {
  const byTestId = page.locator(`[data-testid="seat-tile-${seatIndex}"]`);
  const displayNumber = seatIndex + 1;
  const byText = page
    .locator(`text="${displayNumber}"`)
    .locator('..')
    .filter({
      has: page.locator('text=/^(空|我)$/').or(page.locator(`text="${displayNumber}"`)),
    })
    .first()
    .locator('..');
  return byTestId.or(byText).first();
}

async function isNightEnded(page: Page): Promise<boolean> {
  for (const kw of UI_TEXT.nightEnd) {
    if (await isTextVisible(page, kw)) return true;
  }
  return false;
}

async function captureNightResult(page: Page): Promise<string> {
  if (await isTextVisible(page, '平安夜')) return '昨天晚上是平安夜。';
  const deathMsg = page.locator(String.raw`text=/\d+号.*玩家死亡/`);
  if (await deathMsg.isVisible({ timeout: 500 }).catch(() => false)) {
    return (await deathMsg.textContent()) || '玩家死亡';
  }
  return 'Night ended (result text not captured)';
}

async function captureDiagnostics(
  page: Page,
  state: NightFlowState,
): Promise<Record<string, unknown>> {
  const diag: Record<string, unknown> = {
    wolfVotedPages: Array.from(state.wolfVotedPages),
    expectedWolfCount: state.expectedWolfCount,
    pageUrl: page.url(),
  };
  const actionMsg = page.locator('[data-testid="action-message"]');
  if (await actionMsg.isVisible({ timeout: 100 }).catch(() => false)) {
    diag.actionMessage = await actionMsg.textContent().catch(() => null);
  }
  return diag;
}

async function getActionMessageText(page: Page): Promise<string> {
  const loc = page.locator('[data-testid="action-message"]');
  return (await loc.textContent({ timeout: 100 }).catch(() => '')) ?? '';
}

// ---------------------------------------------------------------------------
// Action execution (split for complexity reduction)
// ---------------------------------------------------------------------------

async function shouldSkipWolfVoteButton(
  page: Page,
  state: NightFlowState,
  pageLabel: string,
): Promise<boolean> {
  const vc = await parseWolfVoteCount(page);
  if (!vc) return false;
  if (state.expectedWolfCount === 0) state.expectedWolfCount = vc.total;
  if (state.wolfVotedPages.has(pageLabel)) return true;
  return vc.current >= vc.total;
}

async function handlePostClick(
  page: Page,
  buttonText: string,
  state: NightFlowState,
  pageLabel: string,
): Promise<boolean> {
  if (buttonText === '投票空刀') {
    // After clicking '投票空刀', a wolf vote confirm AlertModal should appear.
    // We just return true; the next iteration will pick up the alert and click '确定'.
    await page.waitForTimeout(300);
    return true;
  }

  const btn = page.getByText(buttonText, { exact: true }).first();
  if (buttonText === '确定') {
    const vc = await parseWolfVoteCount(page);
    await btn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    if (vc) state.wolfVotedPages.add(pageLabel);
    await page.waitForTimeout(500);
    return true;
  }

  await btn.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => page.waitForTimeout(300));
  return true;
}

async function executeAction(
  page: Page,
  buttonText: string,
  state: NightFlowState,
  pageLabel: string,
): Promise<boolean> {
  const isVoteButton = buttonText === '投票空刀' || buttonText === '确定';
  if (isVoteButton && (await shouldSkipWolfVoteButton(page, state, pageLabel))) {
    return false;
  }

  nightLog(`[NightFlow] ${pageLabel}: executeAction clicking "${buttonText}"`);
  // Strategy: try within bottom-action-panel first (for buttons like 投票空刀),
  // then try page-level getByText.
  // RN Web renders Text as <div>, so locator('text=') may not work with exact match.
  const panel = page.locator('[data-testid="bottom-action-panel"]');
  const panelBtn = panel.getByText(buttonText, { exact: true }).first();
  const pageBtn = page.getByText(buttonText, { exact: true }).first();

  let clicked = false;
  for (const loc of [panelBtn, pageBtn]) {
    try {
      await loc.click({ force: true, timeout: 2000 });
      clicked = true;
      break;
    } catch {
      // Try next locator
    }
  }
  if (!clicked) {
    // Diagnostic: dump bottom-action-panel inner HTML to understand DOM structure
    const panelHtml = await panel.innerHTML().catch(() => 'N/A');
    nightLog(
      `[NightFlow] ${pageLabel}: could not click "${buttonText}". Panel HTML: ${panelHtml.slice(0, 500)}`,
    );
    return false;
  }
  return handlePostClick(page, buttonText, state, pageLabel);
}

// ---------------------------------------------------------------------------
// Target selection
// ---------------------------------------------------------------------------

async function tryConfirmSeatViaAlert(
  page: Page,
  pageLabel: string,
  seatIdx: number,
  isWolfVote: boolean,
  state: NightFlowState,
): Promise<boolean> {
  const alertModal = page.locator('[data-testid="alert-modal"]');
  const alertAppeared = await alertModal
    .waitFor({ state: 'visible', timeout: 2000 })
    .then(() => true)
    .catch(() => false);

  if (alertAppeared) {
    const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
    if (await confirmBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      nightLog(`[NightFlow] ${pageLabel}: confirming seat-${seatIdx} selection`);
      await confirmBtn.click({ force: true });
      await alertModal.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
      if (isWolfVote) state.wolfVotedPages.add(pageLabel);
      await page.waitForTimeout(300);
      return true;
    }
  }

  // Fallback: check for confirm button anywhere on page
  const fallbackBtn = page.getByText('确定', { exact: true }).first();
  const visible = await fallbackBtn
    .waitFor({ state: 'visible', timeout: 500 })
    .then(() => true)
    .catch(() => false);

  if (!visible) return false;

  await fallbackBtn.click({ force: true });
  await fallbackBtn.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});
  if (isWolfVote) state.wolfVotedPages.add(pageLabel);
  return true;
}

async function attemptSeatSelection(
  page: Page,
  mySeat: number,
  isWolfVote: boolean,
  state: NightFlowState,
  pageLabel: string,
): Promise<boolean> {
  const targets = [5, 4, 3, 2, 1, 0].filter((i) => i !== mySeat);

  for (const idx of targets) {
    try {
      const tile = getSeatTileLocator(page, idx);
      if (!(await tile.isVisible({ timeout: 100 }).catch(() => false))) continue;

      nightLog(`[NightFlow] ${pageLabel}: clicking seat-${idx} (mySeat=${mySeat})`);
      await tile.click({ force: true, timeout: 3000 });

      const confirmed = await tryConfirmSeatViaAlert(page, pageLabel, idx, isWolfVote, state);
      if (confirmed) return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function tryClickSeatTarget(
  page: Page,
  state: NightFlowState,
  pageLabel: string,
): Promise<boolean> {
  const actionMsgLocator = page.locator('[data-testid="action-message"]');
  if (!(await actionMsgLocator.isVisible({ timeout: 100 }).catch(() => false))) return false;

  const text = (await actionMsgLocator.textContent().catch(() => '')) ?? '';
  if (!UI_TEXT.targetSelection.some((p) => text.includes(p))) return false;

  const isWolfVote = text.includes('猎杀') || text.includes('狼人已投票');
  if (isWolfVote && state.wolfVotedPages.has(pageLabel)) return false;

  const mySeat = await getMySeatIndex(page);
  if (mySeat === null) {
    nightLog(`[NightFlow] ${pageLabel}: target pattern matched but mySeat is null`);
    return false;
  }

  nightLog(
    `[NightFlow] ${pageLabel}: attempting seat selection (isWolfVote=${isWolfVote}, mySeat=${mySeat})`,
  );
  return attemptSeatSelection(page, mySeat, isWolfVote, state, pageLabel);
}

// ---------------------------------------------------------------------------
// Night advance (single iteration)
// ---------------------------------------------------------------------------

async function detectRoleTurns(page: Page, turnLog: string[]): Promise<void> {
  for (const keyword of UI_TEXT.roleTurn) {
    if (!(await isTextVisible(page, keyword))) continue;
    const text =
      (await page
        .getByText(keyword)
        .first()
        .textContent()
        .catch(() => keyword)) || keyword;
    if (!turnLog.includes(text)) turnLog.push(text);
  }
}

async function tryAdvanceNight(
  page: Page,
  turnLog: string[],
  state: NightFlowState,
  pageLabel: string,
): Promise<boolean> {
  // 1. Check alert modal first (most common action blocker)
  const alertModal = page.locator('[data-testid="alert-modal"]');
  const hasAlert = await alertModal.isVisible({ timeout: 200 }).catch(() => false);
  if (hasAlert) {
    // Use the alert TITLE (testid="alert-title") to detect wolf vote confirm.
    // See UI_TEXT.wolfVoteConfirmTitle for rationale on why title-based detection
    // is more reliable than button-text matching.
    const alertTitle =
      (await alertModal
        .locator('[data-testid="alert-title"]')
        .textContent()
        .catch(() => '')) ?? '';
    const isWolfVoteConfirm = alertTitle === UI_TEXT.wolfVoteConfirmTitle;

    // Find and click any button in the alert
    for (const text of UI_TEXT.advanceButtons) {
      const btn = alertModal.getByText(text, { exact: true }).first();
      if (await btn.isVisible({ timeout: 100 }).catch(() => false)) {
        nightLog(
          `[NightFlow] ${pageLabel}: alert title="${alertTitle}" clicking "${text}" (isWolfVoteConfirm=${isWolfVoteConfirm})`,
        );
        await btn.click({ force: true });
        await alertModal.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
        // Track wolf vote ONLY if this was the wolf vote confirm dialog ('狼人投票')
        if (isWolfVoteConfirm && text === '确定') {
          state.wolfVotedPages.add(pageLabel);
        }
        await page.waitForTimeout(300);
        return true;
      }
    }
  }

  await detectRoleTurns(page, turnLog);

  // 2. Check advance buttons outside alerts (exact match to avoid false positives)
  for (const text of UI_TEXT.advanceButtons) {
    if (await isTextVisible(page, text, true)) {
      return executeAction(page, text, state, pageLabel);
    }
  }

  // 3. Try seat target selection
  return tryClickSeatTarget(page, state, pageLabel);
}

// ---------------------------------------------------------------------------
// Fail-fast helpers (extracted from main loop)
// ---------------------------------------------------------------------------

function checkWolfVoteStuck(
  vc: { current: number; total: number } | null,
  state: NightFlowState,
): void {
  if (vc === null) {
    state.wolfVoteStuckIterations = 0;
    state.lastWolfVoteCount = -1;
    return;
  }
  if (state.lastWolfVoteCount === vc.current) {
    state.wolfVoteStuckIterations++;
  } else {
    state.wolfVoteStuckIterations = 0;
    state.lastWolfVoteCount = vc.current;
  }
}

function updateProgressTracking(
  advanced: boolean,
  currentMsg: string,
  state: NightFlowState,
): void {
  if (advanced) {
    state.noProgressIterations = 0;
    state.lastActionMessage = currentMsg;
    return;
  }
  if (currentMsg === state.lastActionMessage) {
    state.noProgressIterations++;
  } else {
    state.noProgressIterations = 0;
    state.lastActionMessage = currentMsg;
  }
}

function createInitialState(): NightFlowState {
  return {
    wolfVotedPages: new Set(),
    expectedWolfCount: 0,
    wolfVoteStuckIterations: 0,
    lastWolfVoteCount: -1,
    noProgressIterations: 0,
    lastActionMessage: '',
  };
}

// ---------------------------------------------------------------------------
// Loop iteration helpers (extracted to reduce cognitive complexity)
// ---------------------------------------------------------------------------

async function assertWolfVoteNotStuck(page: Page, state: NightFlowState): Promise<void> {
  checkWolfVoteStuck(await parseWolfVoteCount(page), state);
  if (state.wolfVoteStuckIterations >= WOLF_VOTE_STUCK_THRESHOLD) {
    const diag = await captureDiagnostics(page, state);
    throw new Error(`FAIL-FAST: Wolf vote stuck. ${JSON.stringify(diag)}`);
  }
}

async function maybeTakeScreenshot(
  page: Page,
  testInfo: TestInfo,
  iter: number,
  interval: number,
): Promise<void> {
  if (iter % interval !== 0) return;
  const shot = await page.screenshot();
  await testInfo.attach(`night-iter-${iter}.png`, { body: shot, contentType: 'image/png' });
}

async function maybeTakeAllScreenshots(
  pages: Page[],
  testInfo: TestInfo,
  iter: number,
  interval: number,
): Promise<void> {
  if (iter % interval !== 0) return;
  for (let i = 0; i < pages.length; i++) {
    const shot = await pages[i].screenshot();
    await testInfo.attach(`night-iter-${iter}-page-${i}.png`, {
      body: shot,
      contentType: 'image/png',
    });
  }
}

async function tryAdvanceAnyPage(
  pages: Page[],
  turnLog: string[],
  state: NightFlowState,
): Promise<boolean> {
  for (let i = 0; i < pages.length; i++) {
    try {
      // Guard: 10s max per page to prevent indefinite hanging
      const advanced = await Promise.race([
        tryAdvanceNight(pages[i], turnLog, state, `page-${i}`),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10_000)),
      ]);
      if (advanced) {
        nightLog(`[NightFlow] Advanced on page-${i}`);
        return true;
      }
    } catch (e) {
      console.error(
        `[NightFlow] ERROR on page-${i}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return false;
}

async function assertProgress(
  pages: Page[],
  advanced: boolean,
  state: NightFlowState,
): Promise<void> {
  // Check action messages across ALL pages, not just primary
  const msgs: string[] = [];
  for (const p of pages) {
    const msg = await getActionMessageText(p);
    if (msg) msgs.push(msg);
  }
  const currentMsg = msgs.join('|') || '';
  updateProgressTracking(advanced, currentMsg, state);
  if (state.noProgressIterations >= NO_PROGRESS_THRESHOLD) {
    const diag = await captureDiagnostics(pages[0], state);
    throw new Error(
      `FAIL-FAST: No progress for ${state.noProgressIterations} iters. ${JSON.stringify(diag)}`,
    );
  }
}

async function logIterationState(
  pages: Page[],
  iter: number,
  advanced: boolean,
  state: NightFlowState,
): Promise<void> {
  // Always log for first 10 iters, then every 3 iters (keep it frequent enough to diagnose issues)
  if (iter > 10 && iter % 3 !== 0 && !advanced) return;
  const actionMsgs: string[] = [];
  for (let p = 0; p < pages.length; p++) {
    const msg = await getActionMessageText(pages[p]);
    if (msg) actionMsgs.push(`p${p}="${msg.replaceAll('\n', ' ').slice(0, 60)}"`);
  }
  nightLog(
    `[NightFlow] iter=${iter} adv=${advanced} noP=${state.noProgressIterations} wVoted=[${Array.from(state.wolfVotedPages)}] msgs=[${actionMsgs.join(', ')}]`,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the night flow loop across multiple pages until the night ends or
 * a fail-fast condition triggers.
 */
export async function runNightFlowLoop(
  pages: Page[],
  testInfo: TestInfo,
  opts: { maxIterations?: number; screenshotInterval?: number; verbose?: boolean } = {},
): Promise<NightFlowResult> {
  const { maxIterations = 50, screenshotInterval = 5, verbose = false } = opts;
  _verbose = verbose;
  const turnLog: string[] = [];
  const primaryPage = pages[0];
  const state = createInitialState();

  for (let iter = 1; iter <= maxIterations; iter++) {
    if (await isNightEnded(primaryPage)) {
      console.log(`[NightFlow] Night ended at iteration ${iter}`);
      return { resultText: await captureNightResult(primaryPage), turnLog };
    }

    await assertWolfVoteNotStuck(primaryPage, state);
    await maybeTakeAllScreenshots(pages, testInfo, iter, iter <= 3 ? 1 : screenshotInterval);

    const advanced = await tryAdvanceAnyPage(pages, turnLog, state);

    await logIterationState(pages, iter, advanced, state);
    await assertProgress(pages, advanced, state);

    await primaryPage.waitForTimeout(advanced ? 200 : 500);
  }

  const diag = await captureDiagnostics(primaryPage, state);
  throw new Error(
    `FAIL-FAST: Night did not complete after ${maxIterations} iters. ${JSON.stringify(diag)}`,
  );
}
