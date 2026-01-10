import { test, expect, Page, TestInfo } from '@playwright/test';

/**
 * Night 1 Happy Path E2E Test
 * 
 * PURPOSE: Verify Host-authoritative first night flow runs to completion,
 * ending with death announcement or "平安夜" result.
 * 
 * SCENARIO: 2 players (Host A + Joiner B) run through first night
 * - Host creates room, auto-takes seat 1
 * - Joiner joins and takes seat 2
 * - Host starts game → night flow begins
 * - Loop through role turns with minimal interaction (skip/confirm)
 * - Assert final result: "平安夜" or "玩家死亡"
 */

// Fail fast: stop on first failure
test.describe.configure({ mode: 'serial' });

// Increase test timeout for night flow (audio playback + network latency)
test.setTimeout(90_000);

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
// Helpers
// =============================================================================

async function waitForAppReady(page: Page) {
  await page.waitForSelector('text=狼人杀法官', { timeout: 15000 });
}

function getVisibleText(page: Page, text: string) {
  return page.locator(`text="${text}" >> visible=true`);
}

async function ensureAnonLogin(page: Page) {
  const anonUser = page.getByText('匿名用户');
  if (await anonUser.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }

  await page.getByText('创建房间').click();
  await page.waitForTimeout(500);

  const needLogin = page.getByText('需要登录');
  const configScreen = getVisibleText(page, '创建');

  if (await needLogin.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByText('登录', { exact: true }).first().click();
    await expect(page.getByText('👤 匿名登录')).toBeVisible({ timeout: 5000 });
    await page.getByText('👤 匿名登录').click();
    await expect(page.getByText('匿名用户')).toBeVisible({ timeout: 10000 });
  } else if (await configScreen.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByText('←').click();
    await expect(page.getByText('创建房间')).toBeVisible({ timeout: 5000 });
  }
}

async function waitForRoomScreenReady(page: Page, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await expect(page.locator(String.raw`text=/房间 \d{4}/`)).toBeVisible({ timeout: 10000 });
      return;
    } catch {
      const retryBtn = page.getByText('重试');
      if (await retryBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`[waitForRoomScreenReady] Retry attempt ${attempt + 1}...`);
        await retryBtn.click();
      } else {
        throw new Error('Room screen not ready and no retry button found');
      }
    }
  }
  throw new Error(`Room screen not ready after ${maxRetries} attempts`);
}

async function extractRoomNumber(page: Page): Promise<string> {
  const headerLocator = page.locator(String.raw`text=/房间 \d{4}/`);
  await expect(headerLocator).toBeVisible({ timeout: 5000 });
  const headerText = await headerLocator.textContent();
  const match = headerText?.match(/\b(\d{4})\b/);
  if (!match) throw new Error(`Could not extract room number from: ${headerText}`);
  return match[1];
}

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
  state: NightFlowState
): Promise<boolean> {
  // Check and log role turn indicators
  await detectRoleTurnIndicators(page, turnLog);

  // Try clicking advance buttons with state-wait
  const visibleButton = await tryClickAdvanceButtons(page);
  if (visibleButton) {
    const stateChanged = await executeActionWithStateWait(page, visibleButton, state);
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

interface NightFlowState {
  wolfVoteSubmitted: boolean;  // Track if wolf vote was already submitted
}

/**
 * Execute a single action and wait for observable state change.
 * Returns true if an action was taken and state changed.
 */
async function executeActionWithStateWait(
  page: Page, 
  buttonText: string,
  state: NightFlowState
): Promise<boolean> {
  const btn = page.getByText(buttonText, { exact: true }).first();
  
  // Skip wolf vote actions if already submitted
  if (state.wolfVoteSubmitted && (buttonText === '投票空刀' || buttonText === '确定')) {
    // Check if this is in a wolf voting context
    const isWolfVoteContext = await page.locator(`text=/${VOTE_COUNT_PATTERN}/`).isVisible({ timeout: 100 }).catch(() => false);
    if (isWolfVoteContext) {
      console.log(`[Night] Skipping "${buttonText}" - wolf vote already submitted`);
      return false;
    }
  }
  
  console.log(`[Night] Clicking button: "${buttonText}"`);
  await btn.click();
  
  // Wait for observable state change based on button type
  if (buttonText === '投票空刀') {
    // After clicking 投票空刀, a confirm dialog should appear
    // Wait for the confirm button to appear
    const confirmVisible = await page.getByText('确定', { exact: true }).first().waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false);
    return confirmVisible;
  }
  
  if (buttonText === '确定') {
    // Check if this was a wolf vote confirm (by looking for vote count text)
    const isWolfVoteConfirm = await page.locator(`text=/${VOTE_COUNT_PATTERN}/`).isVisible({ timeout: 100 }).catch(() => false);
    
    // Wait for button to be hidden (dialog dismissed)
    await btn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    
    if (isWolfVoteConfirm) {
      console.log('[Night] Wolf vote confirmed - marking as submitted');
      state.wolfVoteSubmitted = true;
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

  console.log('[Night] Action message visible, trying to select seat 2...');
  try {
    await getSeatTileLocator(page, 1).click();
    await page.waitForTimeout(300);
    
    const confirmBtn = page.getByText('确定', { exact: true });
    if (await confirmBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('[Night] Confirming seat selection...');
      await confirmBtn.first().click();
      await page.waitForTimeout(300);
    }
    return true;
  } catch {
    return false;
  }
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
 * Both players may need to take actions depending on their roles.
 */
async function runNightFlowLoop(
  pages: Page[],
  testInfo: TestInfo, 
  maxIterations = 50,
  screenshotInterval = 5
): Promise<{ resultText: string; turnLog: string[] }> {
  const turnLog: string[] = [];
  const primaryPage = pages[0]; // Use first page for result checking
  
  // State tracking across iterations
  const state: NightFlowState = {
    wolfVoteSubmitted: false,
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
    for (const page of pages) {
      const pageAdvanced = await tryAdvanceNight(page, turnLog, iteration, state);
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
      
      await pageA.goto('/');
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
      await waitForRoomScreenReady(pageA);
      
      roomNumber = await extractRoomNumber(pageA);
      console.log(`[NIGHT] HOST A created room: ${roomNumber}`);
      
      await takeScreenshot(pageA, testInfo, '02-room-created.png');

      // ===================== JOINER B: Join room =====================
      console.log('\n[NIGHT] === JOINER B Setup ===');
      
      await pageB.goto('/');
      await waitForAppReady(pageB);
      await ensureAnonLogin(pageB);
      
      // Join room
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      
      const input = pageB.locator('input').first();
      await input.fill(roomNumber);
      await pageB.getByText('加入', { exact: true }).click();
      
      await waitForRoomScreenReady(pageB);
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

});
