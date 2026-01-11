import { test, expect, Page, TestInfo, BrowserContext } from '@playwright/test';
import { waitForRoomScreenReady } from './helpers/waits';
import { getVisibleText, gotoWithRetry } from './helpers/ui';
import { waitForAppReady, ensureAnonLogin, extractRoomNumber } from './helpers/home';

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
// Diagnostic Infrastructure (reused from seating.basic.spec.ts)
// =============================================================================

/** Prefixes to filter from console logs */
const LOG_PREFIXES = [
  '[useGameRoom]',
  '[GameStateService]',
  '[SeatService]',
  '[RoomService]',
  '[BroadcastService]',
  '[AudioService]',
  '[NightFlowController]',
];

/** Collected diagnostic data */
interface DiagnosticData {
  consoleLogs: string[];
  pageErrors: string[];
  failedRequests: string[];
  errorResponses: string[];
}

/**
 * Setup diagnostic listeners on a page.
 */
function setupDiagnostics(page: Page, label: string): DiagnosticData {
  const data: DiagnosticData = {
    consoleLogs: [],
    pageErrors: [],
    failedRequests: [],
    errorResponses: [],
  };

  page.on('console', msg => {
    const text = msg.text();
    if (LOG_PREFIXES.some(p => text.includes(p))) {
      const logLine = `[${label}] ${text}`;
      data.consoleLogs.push(logLine);
      console.log('[PW console]', logLine);
    }
  });

  page.on('pageerror', err => {
    const errLine = `[${label}] PageError: ${err.message}`;
    data.pageErrors.push(errLine);
    console.error('[PW pageerror]', errLine);
  });

  page.on('requestfailed', req => {
    const failLine = `[${label}] RequestFailed: ${req.url()} - ${req.failure()?.errorText}`;
    data.failedRequests.push(failLine);
    console.error('[PW requestfailed]', failLine);
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      const errLine = `[${label}] HTTP ${resp.status()}: ${resp.url()}`;
      data.errorResponses.push(errLine);
      console.warn('[PW response]', errLine);
    }
  });

  return data;
}

// =============================================================================
// Helpers (Seat-specific only - shared helpers imported from home.ts)
// =============================================================================

/**
 * Get a precise locator for a seat tile by its 0-based seat index.
 */
function getSeatTileLocator(page: Page, seatIndex: number) {
  const displayNumber = seatIndex + 1;
  return page.locator(`text="${displayNumber}"`)
    .locator('..')
    .filter({ has: page.locator('text=/^(空|我)$/').or(page.locator(`text="${displayNumber}"`)) })
    .first()
    .locator('..');
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
 */
async function configure2PlayerTemplate(page: Page): Promise<void> {
  console.log('[NIGHT] Configuring 2-player template...');
  
  // Deselect god roles
  const godRolesToDeselect = ['预言家', '女巫', '猎人', '白痴'];
  for (const chipText of godRolesToDeselect) {
    const chip = page.getByText(chipText, { exact: true });
    if (await chip.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log(`[NIGHT] Deselecting: ${chipText}`);
      await chip.click();
      await page.waitForTimeout(100);
    }
  }
  
  // Deselect extra wolves (keep only 1) - UI label is "普狼" not "狼人"
  const wolfChips = await page.getByText('普狼', { exact: true }).all();
  console.log(`[NIGHT] Found ${wolfChips.length} wolf chips (普狼)`);
  for (let i = 1; i < Math.min(wolfChips.length, 4); i++) {
    console.log(`[NIGHT] Deselecting wolf chip ${i + 1}`);
    await wolfChips[i].click();
    await page.waitForTimeout(100);
  }
  
  // Deselect extra villagers (keep only 1)
  const villagerChips = await page.getByText('村民', { exact: true }).all();
  console.log(`[NIGHT] Found ${villagerChips.length} villager chips`);
  for (let i = 1; i < Math.min(villagerChips.length, 4); i++) {
    console.log(`[NIGHT] Deselecting villager chip ${i + 1}`);
    await villagerChips[i].click();
    await page.waitForTimeout(100);
  }
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
  
  // Deselect 白痴 (idiot)
  const idiotChip = page.getByText('白痴', { exact: true });
  if (await idiotChip.isVisible({ timeout: 500 }).catch(() => false)) {
    console.log('[NIGHT] Deselecting: 白痴');
    await idiotChip.click();
    await page.waitForTimeout(100);
  }
  
  // Deselect extra wolves (keep 2, deselect wolf3/wolf4)
  // ConfigScreen has wolf, wolf1, wolf2, wolf3, wolf4 chips - all labeled "普狼"
  const wolfChips = await page.getByText('普狼', { exact: true }).all();
  console.log(`[NIGHT] Found ${wolfChips.length} wolf chips, keeping first 2`);
  for (let i = 2; i < wolfChips.length; i++) {
    console.log(`[NIGHT] Deselecting wolf chip ${i + 1}`);
    await wolfChips[i].click();
    await page.waitForTimeout(100);
  }
  
  // Deselect extra villagers (keep 1)
  const villagerChips = await page.getByText('村民', { exact: true }).all();
  console.log(`[NIGHT] Found ${villagerChips.length} villager chips, keeping first 1`);
  for (let i = 1; i < villagerChips.length; i++) {
    console.log(`[NIGHT] Deselecting villager chip ${i + 1}`);
    await villagerChips[i].click();
    await page.waitForTimeout(100);
  }
  
  // Verify total = 6 (should see "6人" or similar in UI)
  console.log('[NIGHT] 6-player template configured: 2狼 + 预言家 + 女巫 + 猎人 + 1村民');
}

// =============================================================================
// Night Flow Helpers
// =============================================================================

/**
 * Night end keywords that indicate first night has completed
 */
const NIGHT_END_KEYWORDS = [
  '平安夜',
  '玩家死亡',
  '昨天晚上',
  '查看昨晚信息',  // Button visible after night ends
  '重新开始',       // Button visible after night ends
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
const ADVANCE_BUTTONS = ['好', '确定', '跳过', '不使用技能', '投票空刀'];

/**
 * Check if any night end indicator is visible
 */
async function isNightEnded(page: Page): Promise<boolean> {
  for (const keyword of NIGHT_END_KEYWORDS) {
    const isVisible = await page.getByText(keyword).first().isVisible({ timeout: 100 }).catch(() => false);
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
  pageLabel: string
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
  return tryClickSeatTarget(page);
}

async function detectRoleTurnIndicators(page: Page, turnLog: string[]): Promise<void> {
  for (const keyword of ROLE_TURN_KEYWORDS) {
    const isVisible = await page.getByText(keyword).first().isVisible({ timeout: 100 }).catch(() => false);
    if (isVisible) {
      const text = await page.getByText(keyword).first().textContent().catch(() => keyword);
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
    const isVisible = await btn.first().isVisible({ timeout: 100 }).catch(() => false);
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
}

/**
 * Parse wolf vote count from page: "X/Y 狼人已投票" → { current, total }
 */
async function parseWolfVoteCount(page: Page): Promise<{ current: number; total: number } | null> {
  const voteCountLoc = page.locator(`text=/${VOTE_COUNT_PATTERN}/`);
  if (!await voteCountLoc.isVisible({ timeout: 100 }).catch(() => false)) {
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
 * Check if page is in wolf voting context.
 * Only returns true if actionMessage contains wolf-related text OR vote count is visible.
 */
async function isWolfVoteContext(page: Page): Promise<boolean> {
  // Check for wolf vote count pattern "X/Y 狼人已投票"
  const voteCount = await parseWolfVoteCount(page);
  if (voteCount) return true;
  
  // Check for wolf-specific action message
  const actionMsgLoc = page.locator('[class*="actionMessage"]');
  if (!await actionMsgLoc.isVisible({ timeout: 100 }).catch(() => false)) {
    return false;
  }
  const msgText = await actionMsgLoc.textContent().catch(() => '') || '';
  // Wolf-specific keywords in action message
  const wolfKeywords = ['狼人', '猎杀', '投票空刀'];
  return wolfKeywords.some(kw => msgText.includes(kw));
}

/**
 * Execute a single action and wait for observable state change.
 * Returns true if an action was taken and state changed.
 */
async function executeActionWithStateWait(
  page: Page, 
  buttonText: string,
  state: NightFlowState,
  pageLabel: string
): Promise<boolean> {
  const btn = page.getByText(buttonText, { exact: true }).first();
  
  // For wolf vote context, check if THIS page already voted
  // ONLY count as wolf vote if we're actually in wolf context
  if (buttonText === '投票空刀' || buttonText === '确定') {
    const inWolfContext = await isWolfVoteContext(page);
    if (inWolfContext) {
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
  }
  
  console.log(`[Night] [${pageLabel}] Clicking button: "${buttonText}"`);
  await btn.click();
  
  // Wait for observable state change based on button type
  if (buttonText === '投票空刀') {
    // After clicking 投票空刀, a confirm dialog should appear
    const confirmVisible = await page.getByText('确定', { exact: true }).first()
      .waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false);
    return confirmVisible;
  }
  
  if (buttonText === '确定') {
    // Check if this was a wolf vote confirm - only if in wolf context
    const inWolfContext = await isWolfVoteContext(page);
    const voteCount = inWolfContext ? await parseWolfVoteCount(page) : null;
    
    // Wait for button to be hidden (dialog dismissed)
    await btn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    
    if (voteCount) {
      console.log(`[Night] [${pageLabel}] Wolf vote confirmed - count was ${voteCount.current}/${voteCount.total}`);
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
  const disappeared = await btn.waitFor({ state: 'hidden', timeout: 1000 }).then(() => true).catch(() => false);
  if (!disappeared) {
    await page.waitForTimeout(300);
  }
  return true;
}

async function logPageState(page: Page, iteration: number): Promise<void> {
  console.log(`[Night] Iteration ${iteration} - checking page state...`);
  const actionMsgLocator = page.locator('[class*="actionMessage"]');
  if (await actionMsgLocator.isVisible({ timeout: 100 }).catch(() => false)) {
    const msgText = await actionMsgLocator.textContent().catch(() => '(unknown)');
    console.log(`[Night] Action message text: "${msgText}"`);
  }
}

async function tryClickSeatTarget(page: Page): Promise<boolean> {
  const actionMsgVisible = await page.locator('[class*="actionMessage"]').isVisible({ timeout: 100 }).catch(() => false);
  if (!actionMsgVisible) return false;

  // Check if any skip button is available first - prefer skip over targeting
  const skipButtons = ['不使用技能', '跳过'];
  for (const skipText of skipButtons) {
    const skipBtn = page.getByText(skipText, { exact: true });
    if (await skipBtn.first().isVisible({ timeout: 100 }).catch(() => false)) {
      console.log(`[Night] Found skip option "${skipText}", preferring skip over target selection`);
      return false; // Let the main loop handle the skip button
    }
  }

  // Find which seat has "我" badge to avoid self-targeting
  let mySeatIdx = -1;
  for (let i = 0; i < 12; i++) {
    const seatTile = getSeatTileLocator(page, i);
    const isVisible = await seatTile.isVisible({ timeout: 50 }).catch(() => false);
    if (!isVisible) continue;
    // Check if this seat has the "我" badge
    const hasMeBadge = await seatTile.locator('text="我"').isVisible({ timeout: 50 }).catch(() => false);
    if (hasMeBadge) {
      mySeatIdx = i;
      break;
    }
  }

  // Prefer higher seat numbers to avoid early players
  // Try seat 6 first (index 5), then 5, 4, 3, 2 as fallbacks - skip self
  const seatIndicesToTry = [5, 4, 3, 2, 1, 0].filter(idx => idx !== mySeatIdx);
  
  console.log(`[Night] Action message visible, my seat: ${mySeatIdx + 1}, trying safe targets...`);
  for (const seatIdx of seatIndicesToTry) {
    try {
      const seatTile = getSeatTileLocator(page, seatIdx);
      const isVisible = await seatTile.isVisible({ timeout: 100 }).catch(() => false);
      if (!isVisible) continue;
      
      await seatTile.click();
      await page.waitForTimeout(300);
      
      const confirmBtn = page.getByText('确定', { exact: true });
      if (await confirmBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
        console.log(`[Night] Selected seat ${seatIdx + 1}, confirming...`);
        await confirmBtn.first().click();
        await page.waitForTimeout(300);
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
  if (await page.getByText('平安夜').isVisible({ timeout: 500 }).catch(() => false)) {
    return '昨天晚上是平安夜。';
  }
  
  const deathMsg = page.locator(String.raw`text=/\d+号.*玩家死亡/`);
  if (await deathMsg.isVisible({ timeout: 500 }).catch(() => false)) {
    return await deathMsg.textContent() || '玩家死亡';
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
  screenshotInterval = 5
): Promise<{ resultText: string; turnLog: string[] }> {
  const turnLog: string[] = [];
  const primaryPage = pages[0]; // Use first page for result checking
  
  // State tracking across iterations - supports multi-wolf voting
  const state: NightFlowState = {
    wolfVotedPages: new Set(),
    expectedWolfCount: 0,
  };
  
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    // Check if night has ended (on primary page)
    if (await isNightEnded(primaryPage)) {
      console.log(`[Night] Night ended at iteration ${iteration}`);
      const resultText = await captureNightResult(primaryPage);
      return { resultText, turnLog };
    }
    
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
    
    await primaryPage.waitForTimeout(advanced ? 200 : 500);
  }
  
  console.log(`[Night] Max iterations (${maxIterations}) reached without night end`);
  return { resultText: 'TIMEOUT: Night did not complete', turnLog };
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
      
      const input = pageB.locator('input').first();
      await input.fill(roomNumber);
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
        await lastNightBtn.click();
        
        // Wait for confirmation dialog
        await expect(pageA.getByText('确定查看昨夜信息？')).toBeVisible({ timeout: 3000 });
        await pageA.getByText('确定', { exact: true }).click();
        await pageA.waitForTimeout(500);
        
        await takeScreenshot(pageA, testInfo, '07-last-night-info.png');
        
        // Capture the result text from alert
        const alertText = await pageA.locator('text=/平安夜|玩家死亡/').first().textContent().catch(() => null);
        if (alertText) {
          nightResult.resultText = alertText;
          console.log(`[NIGHT] Last night info: ${alertText}`);
        }
        
        // Dismiss alert
        const dismissBtn = pageA.getByText('确定', { exact: true });
        if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await dismissBtn.click();
        }
      }
      
      // ===================== Assertions =====================
      const nightEnded = hasLastNightBtn || hasRestartBtn || 
        nightResult.resultText.includes('平安夜') || 
        nightResult.resultText.includes('死亡');
      
      expect(nightEnded, 'First night should complete with result').toBe(true);
      
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
        
        const input = joinerPage.locator('input').first();
        await input.fill(roomNumber);
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
      
      // Wait for all players to stabilize (presence sync can take time with 6 players)
      console.log('[6P] Waiting for presence to stabilize...');
      await hostPage.waitForTimeout(2000);
      
      await takeScreenshot(hostPage, testInfo, '6p-03-all-seated.png');

      // ===================== HOST: Prepare to flip roles =====================
      console.log('\n[6P] HOST clicking 准备看牌...');
      
      // Verify all seats are occupied from host perspective before proceeding
      for (let i = 0; i < 6; i++) {
        const seat = getSeatTileLocator(hostPage, i);
        const isEmpty = await seat.locator('text="空"').isVisible({ timeout: 100 }).catch(() => false);
        if (isEmpty) {
          console.log(`[6P] WARNING: Seat ${i + 1} is empty on host view, waiting...`);
          await hostPage.waitForTimeout(1000);
        }
      }
      
      const prepareBtn = hostPage.getByText('准备看牌');
      await expect(prepareBtn).toBeVisible({ timeout: 10000 }); // Increased timeout
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
      const nightEnded = hasLastNightBtn || hasRestartBtn || 
        nightResult.resultText.includes('平安夜') || 
        nightResult.resultText.includes('死亡');
      
      expect(nightEnded, '6-player first night should complete').toBe(true);
      
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
      await pageB.locator('input').first().fill(roomNumber);
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

      // ===================== Restart =====================
      console.log('\n[RESTART] === Clicking 重新开始 ===');
      
      const restartBtn = pageA.getByText('重新开始');
      await expect(restartBtn).toBeVisible({ timeout: 5000 });
      await restartBtn.click();
      
      // Confirm restart dialog
      const confirmDialog = pageA.getByText('确定重新开始');
      const confirmVisible = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);
      if (confirmVisible) {
        await pageA.getByText('确定', { exact: true }).click();
      }
      
      await pageA.waitForTimeout(1000);
      console.log('[RESTART] Game restarted');
      await takeScreenshot(pageA, testInfo, 'restart-02-after-restart.png');

      // ===================== Second Night: Re-run the flow =====================
      console.log('\n[RESTART] === Running Second Night ===');
      
      // 准备看牌 should be visible again
      const prepareBtn2 = pageA.getByText('准备看牌');
      await expect(prepareBtn2).toBeVisible({ timeout: 5000 });
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
      
      const secondNightEnded = hasLastNight || hasRestart || 
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

      // ===================== Count initial seats =====================
      // With 2-player template: wolf + villager = 2 seats
      // Count seats by finding seat number elements (1, 2, 3, ...) that are part of seat tiles
      // Each seat tile has: seat number + ("空" if empty, or player info)
      const countVisibleSeats = async (): Promise<number> => {
        let count = 0;
        for (let i = 0; i < 12; i++) {
          const seatNumber = i + 1;
          // Look for seat tile: parent container with seat number AND either "空" or "我" or avatar
          const seatTile = getSeatTileLocator(page, i);
          const isVisible = await seatTile.isVisible({ timeout: 50 }).catch(() => false);
          if (isVisible) {
            // Double-check by verifying the seat number text is inside
            const hasNumber = await seatTile.locator(`text="${seatNumber}"`).isVisible({ timeout: 50 }).catch(() => false);
            if (hasNumber) count++;
          }
        }
        return count;
      };
      
      const initialSeats = await countVisibleSeats();
      console.log(`[SETTINGS] Initial seat count: ${initialSeats}`);
      expect(initialSeats).toBe(2);

      // ===================== Open settings and change template =====================
      console.log('\n[SETTINGS] === Changing template via settings ===');
      
      const settingsBtn = page.getByText('⚙️ 设置');
      await expect(settingsBtn).toBeVisible({ timeout: 5000 });
      await settingsBtn.click();
      
      // Should navigate to Config screen
      await expect(getVisibleText(page, '创建')).toBeVisible({ timeout: 10000 });
      console.log('[SETTINGS] Config screen opened');
      
      await takeScreenshot(page, testInfo, 'settings-02-config-screen.png');
      
      // Add one more villager (click 村民 chip to increase count)
      // The chip shows current count - clicking it should cycle/add
      const villagerChip = page.getByText('村民', { exact: false }).first();
      await expect(villagerChip).toBeVisible({ timeout: 3000 });
      await villagerChip.click();
      await page.waitForTimeout(300);
      
      console.log('[SETTINGS] Added one villager');
      await takeScreenshot(page, testInfo, 'settings-03-added-villager.png');
      
      // Apply changes (click 创建 button - in edit mode it applies to existing room)
      await getVisibleText(page, '创建').click();
      await waitForRoomScreenReady(page, { role: 'host' });
      
      console.log('[SETTINGS] Settings applied, back in room');

      // ===================== Verify seat count changed =====================
      const updatedSeats = await countVisibleSeats();
      console.log(`[SETTINGS] Updated seat count: ${updatedSeats}`);
      
      await takeScreenshot(page, testInfo, 'settings-04-updated-room.png');
      
      // Seat count should have increased (was 2, now should be 3)
      expect(updatedSeats).toBeGreaterThan(initialSeats);
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
