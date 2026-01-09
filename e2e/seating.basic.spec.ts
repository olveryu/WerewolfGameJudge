import { test, expect, Page, TestInfo } from '@playwright/test';

/**
 * Seating Diagnostic E2E Tests
 * 
 * PURPOSE: Collect evidence to diagnose the bug where:
 * - After seating, "我" badge does not appear
 * - Clicking same seat shows "入座" modal instead of "站起"
 * 
 * This is NOT a pass/fail test - it's a diagnostic tool.
 */

// Fail fast: stop on first failure
test.describe.configure({ mode: 'serial' });

// =============================================================================
// Diagnostic Infrastructure
// =============================================================================

/** Prefixes to filter from console logs */
const LOG_PREFIXES = [
  '[useGameRoom]',
  '[GameStateService]',
  '[SeatService]',
  '[RoomService]',
  '[BroadcastService]',
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
 * Returns a DiagnosticData object that accumulates data.
 */
function setupDiagnostics(page: Page, label: string): DiagnosticData {
  const data: DiagnosticData = {
    consoleLogs: [],
    pageErrors: [],
    failedRequests: [],
    errorResponses: [],
  };

  // Filter console logs by prefix
  page.on('console', msg => {
    const text = msg.text();
    if (LOG_PREFIXES.some(p => text.includes(p))) {
      const logLine = `[${label}] ${text}`;
      data.consoleLogs.push(logLine);
      console.log('[PW console]', logLine);
    }
  });

  // Capture page errors
  page.on('pageerror', err => {
    const errLine = `[${label}] PageError: ${err.message}`;
    data.pageErrors.push(errLine);
    console.error('[PW pageerror]', errLine);
  });

  // Capture failed requests
  page.on('requestfailed', req => {
    const failLine = `[${label}] RequestFailed: ${req.url()} - ${req.failure()?.errorText}`;
    data.failedRequests.push(failLine);
    console.error('[PW requestfailed]', failLine);
  });

  // Capture 4xx/5xx responses (only log, don't spam)
  page.on('response', resp => {
    if (resp.status() >= 400) {
      const errLine = `[${label}] HTTP ${resp.status()}: ${resp.url()}`;
      data.errorResponses.push(errLine);
      console.warn('[PW response]', errLine);
    }
  });

  return data;
}

/**
 * Print diagnostic summary
 */
function printDiagnosticSummary(label: string, data: DiagnosticData) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DIAGNOSTIC SUMMARY: ${label}`);
  console.log('='.repeat(60));
  
  console.log(`\n--- Console Logs (${data.consoleLogs.length}) ---`);
  data.consoleLogs.forEach(log => console.log(log));
  
  if (data.pageErrors.length > 0) {
    console.log(`\n--- Page Errors (${data.pageErrors.length}) ---`);
    data.pageErrors.forEach(err => console.log(err));
  }
  
  if (data.failedRequests.length > 0) {
    console.log(`\n--- Failed Requests (${data.failedRequests.length}) ---`);
    data.failedRequests.forEach(req => console.log(req));
  }
  
  if (data.errorResponses.length > 0) {
    console.log(`\n--- Error Responses (${data.errorResponses.length}) ---`);
    data.errorResponses.forEach(resp => console.log(resp));
  }
  
  console.log('='.repeat(60) + '\n');
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
  // Use "房间 XXXX" header which is visible to all players (not ⚙️ 设置 which is host-only)
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
 * 
 * Strategy: Seat tiles are identified by containing BOTH:
 * 1. A seat number (1, 2, 3, ...)
 * 2. A seat indicator (空 for empty, 我 for self, or player name)
 * 
 * We filter elements that contain "空" (empty seat indicator) to find seat tiles,
 * then use nth() to get the specific seat by index.
 */
function getSeatTileLocator(page: Page, seatIndex: number) {
  // All seat tiles that are empty contain "空"
  // All seat tiles that are occupied contain the seat number
  // Find containers that have "空" text - these are definitely seat tiles
  // Then we can use nth() to get by position
  
  // For occupied seats: find by seat number pattern "N我" or "N<playerName>"
  // For any seat: the tileWrapper always contains the seat number as a child
  const displayNumber = seatIndex + 1;
  
  // Use a more specific locator: find text that is EXACTLY the seat number
  // In the seat tile, the number is in its own Text element
  // Filter by parent containing either "空" or "我" to ensure it's a seat tile
  return page.locator(`text="${displayNumber}"`)
    .locator('..')  // parent (playerTile or similar)
    .filter({ has: page.locator('text=/^(空|我)$/').or(page.locator(`text="${displayNumber}"`)) })
    .first()
    .locator('..');  // go up to tileWrapper
}

/**
 * Collect seat UI state for diagnostics.
 * Uses getSeatTileLocator for consistent targeting.
 */
async function collectSeatUIState(page: Page, seatDisplayNumber: number): Promise<{
  seatContent: string | null;
  hasPlayerName: boolean;
  isEmpty: boolean;
}> {
  const seatIndex = seatDisplayNumber - 1;
  const tile = getSeatTileLocator(page, seatIndex);
  const fullText = await tile.textContent().catch(() => null);
  
  return {
    seatContent: fullText?.trim() ?? null,
    hasPlayerName: fullText !== null && !fullText.includes('空'),
    isEmpty: fullText?.includes('空') ?? true,
  };
}

/**
 * Take a screenshot and attach to test
 */
async function takeScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const screenshot = await page.screenshot();
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
}

// =============================================================================
// Diagnostic Tests
// =============================================================================

test.describe('Seating Diagnostic', () => {

  test('DIAG-1: Single player seat → collect evidence', async ({ page }, testInfo) => {
    console.log('\n🔍 DIAGNOSTIC TEST: Single player seating\n');
    
    // Setup diagnostics
    const diag = setupDiagnostics(page, 'HOST');

    // 1) Navigate and login
    await page.goto('/');
    await waitForAppReady(page);
    await ensureAnonLogin(page);
    console.log('[DIAG] Login complete');

    // 2) Create room (HOST auto-takes seat 0)
    await page.getByText('创建房间').click();
    await expect(getVisibleText(page, '创建')).toBeVisible({ timeout: 10000 });
    await getVisibleText(page, '创建').click();
    await waitForRoomScreenReady(page);
    
    const roomNumber = await extractRoomNumber(page);
    console.log(`[DIAG] Room created: ${roomNumber}`);
    
    await takeScreenshot(page, testInfo, '01-room-created.png');

    // 3) Collect seat 1 state - HOST should already be seated here (auto-take seat 0)
    const seat1State = await collectSeatUIState(page, 1);
    console.log(`[DIAG] Seat 1 state: ${JSON.stringify(seat1State)}`);

    // =================================================================
    // LAYER A: Objective evidence - HOST auto-seated at seat 0 (displayed as "1")
    // =================================================================
    console.log('\n--- LAYER A: Objective Evidence ---');
    
    const layerA_seated = seat1State.hasPlayerName && !seat1State.isEmpty;
    console.log(`[DIAG] Layer A - Seat 1 occupied: ${layerA_seated}`);
    expect(layerA_seated, 'Seat 1 should be occupied (HOST auto-takes seat 0)').toBe(true);

    // =================================================================
    // LAYER B: BUG-1 verification - "我" should now be visible
    // =================================================================
    console.log('\n--- LAYER B: BUG-1 Fix Verification ---');
    
    // B1: Check if "我" is visible
    const hasWo = await page.getByText('我').isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`[DIAG] B1 - "我" visible: ${hasWo}`);
    
    // This should now PASS after the fix
    expect(hasWo, '"我" should be visible after HOST takes seat').toBe(true);
    
    // B2: Click seat 1 and check modal shows "站起" (not "入座")
    console.log('[DIAG] Clicking seat 1 to check modal...');
    await getSeatTileLocator(page, 0).click();
    await page.waitForTimeout(500);
    
    await takeScreenshot(page, testInfo, '02-seat-modal.png');
    
    const modalTitleZhanQi = await page.getByText('站起', { exact: true }).isVisible({ timeout: 2000 }).catch(() => false);
    const modalTitleRuZuo = await page.getByText('入座', { exact: true }).isVisible({ timeout: 1000 }).catch(() => false);
    
    console.log(`[DIAG] B2 - Modal: 站起=${modalTitleZhanQi}, 入座=${modalTitleRuZuo}`);
    
    // This should now show "站起" since HOST is already seated
    expect(modalTitleZhanQi, 'Modal should show 站起 for own seat').toBe(true);
    expect(modalTitleRuZuo, 'Modal should NOT show 入座 for own seat').toBe(false);
    
    // Close modal
    await page.getByText('取消').click().catch(() => {});
    
    // =================================================================
    // DIAGNOSTIC SUMMARY
    // =================================================================
    printDiagnosticSummary('Single Player Seating', diag);
    
    // Attach diagnostic data to test report
    await testInfo.attach('diagnostic-logs.txt', {
      body: [
        '=== CONSOLE LOGS ===',
        ...diag.consoleLogs,
        '',
        '=== LAYER A ===',
        `Seat 1 occupied: ${layerA_seated}`,
        `State: ${JSON.stringify(seat1State)}`,
        '',
        '=== LAYER B (BUG-1 Fix Verification) ===',
        `"我" visible: ${hasWo}`,
        `Click shows 站起: ${modalTitleZhanQi}`,
        `Click shows 入座: ${modalTitleRuZuo}`,
        '',
        '=== RESULT ===',
        hasWo && modalTitleZhanQi ? '✅ BUG-1 FIXED - "我" shows and modal shows 站起' : '❌ BUG-1 NOT FIXED',
      ].join('\n'),
      contentType: 'text/plain',
    });

    console.log('\n🔍 DIAGNOSTIC COMPLETE - Check attached logs and screenshots\n');
  });

  test('DIAG-2: Two players → seat conflict detection', async ({ browser }, testInfo) => {
    console.log('\n🔍 DIAGNOSTIC TEST: Two player seat conflict\n');
    
    // Create two isolated contexts
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const diagA = setupDiagnostics(pageA, 'HOST-A');
    const diagB = setupDiagnostics(pageB, 'JOINER-B');

    try {
      // ===================== HOST A: Create room (auto-takes seat 0) =====================
      console.log('[DIAG] === HOST A Setup ===');
      
      await pageA.goto('/');
      await waitForAppReady(pageA);
      await ensureAnonLogin(pageA);
      
      await pageA.getByText('创建房间').click();
      await expect(getVisibleText(pageA, '创建')).toBeVisible({ timeout: 10000 });
      await getVisibleText(pageA, '创建').click();
      await waitForRoomScreenReady(pageA);
      
      const roomNumber = await extractRoomNumber(pageA);
      console.log(`[DIAG] HOST A created room: ${roomNumber}`);
      
      // HOST auto-takes seat 0 (displayed as "1"), verify it
      await takeScreenshot(pageA, testInfo, 'A-01-host-auto-seated.png');
      
      const hostSeat1 = await collectSeatUIState(pageA, 1);
      console.log(`[DIAG] HOST A seat 1 state: ${JSON.stringify(hostSeat1)}`);
      
      // Verify HOST is seated
      expect(hostSeat1.hasPlayerName, 'HOST should be auto-seated at seat 1').toBe(true);

      // ===================== JOINER B: Join room =====================
      console.log('\n[DIAG] === JOINER B Setup ===');
      
      await pageB.goto('/');
      await waitForAppReady(pageB);
      await ensureAnonLogin(pageB);
      
      // Click 进入房间
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      
      // Enter room code
      const input = pageB.locator('input').first();
      await input.fill(roomNumber);
      
      await takeScreenshot(pageB, testInfo, 'B-00-before-join.png');
      
      await pageB.getByText('加入', { exact: true }).click();
      
      // Wait a bit for navigation
      await pageB.waitForTimeout(2000);
      
      await takeScreenshot(pageB, testInfo, 'B-00a-after-join-click.png');
      
      // Check for errors first
      const hasError = await pageB.getByText(/房间不存在|无效|错误/).isVisible({ timeout: 1000 }).catch(() => false);
      if (hasError) {
        console.log('[DIAG] ERROR: Room join failed - room may not exist');
        await takeScreenshot(pageB, testInfo, 'B-00b-join-error.png');
      }
      
      // Wait for room screen
      await waitForRoomScreenReady(pageB);
      console.log(`[DIAG] JOINER B joined room ${roomNumber}`);
      
      await takeScreenshot(pageB, testInfo, 'B-01-joined-room.png');
      
      // Check if B sees seat 1 as occupied
      const joinerSeat1View = await collectSeatUIState(pageB, 1);
      console.log(`[DIAG] JOINER B sees seat 1: ${JSON.stringify(joinerSeat1View)}`);

      // ===================== JOINER B: Try to take seat 1 (conflict) =====================
      console.log('\n[DIAG] JOINER B attempting to take seat 1 (should conflict)...');
      
      await getSeatTileLocator(pageB, 0).click();
      await pageB.waitForTimeout(500);
      
      await takeScreenshot(pageB, testInfo, 'B-02-click-occupied-seat.png');
      
      // Check what modal appears
      const hasConflictMsg = await pageB.getByText('已被占用').isVisible({ timeout: 2000 }).catch(() => false);
      const hasEnterModal = await pageB.getByText('入座', { exact: true }).isVisible({ timeout: 1000 }).catch(() => false);
      
      console.log(`[DIAG] Conflict detection: hasConflictMsg=${hasConflictMsg}, hasEnterModal=${hasEnterModal}`);
      
      // Close any modal
      await pageB.getByText('取消').click().catch(() => {});
      await pageB.getByText('确定').click().catch(() => {}); // In case it's an alert

      // ===================== JOINER B: Take seat 2 =====================
      console.log('\n[DIAG] JOINER B taking seat 2...');
      
      await getSeatTileLocator(pageB, 1).click();
      await expect(pageB.getByText('入座', { exact: true })).toBeVisible({ timeout: 5000 });
      await pageB.getByText('确定', { exact: true }).click();
      await pageB.waitForTimeout(1000);
      
      await takeScreenshot(pageB, testInfo, 'B-03-seated-at-2.png');
      
      const joinerSeat2 = await collectSeatUIState(pageB, 2);
      console.log(`[DIAG] JOINER B seat 2 state: ${JSON.stringify(joinerSeat2)}`);

      // Check B's Layer B symptoms
      const bHasWo = await pageB.getByText('我').isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`[DIAG] JOINER B "我" visible: ${bHasWo}`);

      // ===================== HOST A: Check if they see B =====================
      console.log('\n[DIAG] Checking HOST A view of seat 2...');
      await pageA.waitForTimeout(1000); // Wait for broadcast
      
      await takeScreenshot(pageA, testInfo, 'A-02-after-b-joins.png');
      
      const hostSeat2View = await collectSeatUIState(pageA, 2);
      console.log(`[DIAG] HOST A sees seat 2: ${JSON.stringify(hostSeat2View)}`);

      // ===================== DIAGNOSTIC SUMMARY =====================
      printDiagnosticSummary('HOST A', diagA);
      printDiagnosticSummary('JOINER B', diagB);
      
      // Attach combined diagnostics
      await testInfo.attach('multi-player-diagnostic.txt', {
        body: [
          '=== SCENARIO ===',
          `Room: ${roomNumber}`,
          'HOST A: creates room, takes seat 1',
          'JOINER B: joins room, tries seat 1 (conflict), takes seat 2',
          '',
          '=== HOST A LOGS ===',
          ...diagA.consoleLogs,
          '',
          '=== JOINER B LOGS ===',
          ...diagB.consoleLogs,
          '',
          '=== SEAT STATE ===',
          `Host seat 1: ${JSON.stringify(hostSeat1)}`,
          `Joiner sees seat 1: ${JSON.stringify(joinerSeat1View)}`,
          `Joiner seat 2: ${JSON.stringify(joinerSeat2)}`,
          `Host sees seat 2: ${JSON.stringify(hostSeat2View)}`,
          '',
          '=== CONFLICT DETECTION ===',
          `Joiner clicked occupied seat 1:`,
          `  - Shows conflict message: ${hasConflictMsg}`,
          `  - Shows 入座 modal anyway: ${hasEnterModal}`,
          '',
          '=== BUG SYMPTOMS ===',
          `Joiner "我" visible: ${bHasWo}`,
          '',
          '=== PRELIMINARY DIAGNOSIS ===',
          hasConflictMsg || !hasEnterModal 
            ? '✅ Seat conflict properly detected'
            : '❌ Seat conflict not detected - possible state sync issue or protocol missing',
          bHasWo
            ? '✅ Joiner "我" showing correctly'
            : '❌ Joiner "我" not showing - possible mySeatNumber not synced',
        ].join('\n'),
        contentType: 'text/plain',
      });

      // Layer A assertions only
      expect(hostSeat1.hasPlayerName, 'Host seat 1 should be occupied').toBe(true);
      expect(joinerSeat2.hasPlayerName, 'Joiner seat 2 should be occupied').toBe(true);
      
      console.log('\n🔍 DIAGNOSTIC COMPLETE - Check attached logs and screenshots\n');
      
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

});
