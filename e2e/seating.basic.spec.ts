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

  test('DIAG-3: BUG-2 verification → Joiner gets rejection alert when taking occupied seat', async ({ browser }, testInfo) => {
    console.log('\n🔍 DIAGNOSTIC TEST: BUG-2 - Seat rejection alert\n');
    
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
      
      await takeScreenshot(pageA, testInfo, 'A-01-host-seated.png');

      // ===================== JOINER B: Join room =====================
      console.log('\n[DIAG] === JOINER B Setup ===');
      
      await pageB.goto('/');
      await waitForAppReady(pageB);
      await ensureAnonLogin(pageB);
      
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      
      const input = pageB.locator('input').first();
      await input.fill(roomNumber);
      await pageB.getByText('加入', { exact: true }).click();
      
      await waitForRoomScreenReady(pageB);
      console.log(`[DIAG] JOINER B joined room ${roomNumber}`);
      
      await takeScreenshot(pageB, testInfo, 'B-01-joined.png');

      // ===================== JOINER B: Try to take seat 0 (occupied by HOST) =====================
      console.log('\n[DIAG] JOINER B attempting to take occupied seat 1...');
      
      // Click on seat 1 (index 0)
      await getSeatTileLocator(pageB, 0).click();
      await pageB.waitForTimeout(500);
      
      await takeScreenshot(pageB, testInfo, 'B-02-clicked-occupied-seat.png');
      
      // Check if "入座" modal appears (BUG: it shouldn't for occupied seats)
      const hasRuZuoModal = await pageB.getByText('入座', { exact: true }).isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`[DIAG] "入座" modal visible: ${hasRuZuoModal}`);
      
      if (hasRuZuoModal) {
        // BUG behavior: modal appeared, try to confirm
        console.log('[DIAG] Clicking 确定 to attempt seat...');
        await pageB.getByText('确定', { exact: true }).click();
        await pageB.waitForTimeout(1000);
        
        await takeScreenshot(pageB, testInfo, 'B-03-after-confirm.png');
      }
      
      // ===================== Check for rejection alert =====================
      // After fix: should show "入座失败" alert
      const hasRejectionAlert = await pageB.getByText('入座失败').isVisible({ timeout: 3000 }).catch(() => false);
      const hasSeatTakenMsg = await pageB.getByText('该座位已被占用').isVisible({ timeout: 1000 }).catch(() => false);
      
      console.log(`[DIAG] Rejection alert visible: ${hasRejectionAlert}`);
      console.log(`[DIAG] "该座位已被占用" message: ${hasSeatTakenMsg}`);
      
      await takeScreenshot(pageB, testInfo, 'B-04-rejection-check.png');
      
      // Dismiss rejection alert - must explicitly click the button on the alert
      if (hasRejectionAlert) {
        console.log('[DIAG] Dismissing rejection alert...');
        // The alert has a single "确定" button - click it
        await pageB.getByRole('button', { name: '确定' }).click({ timeout: 2000 }).catch(() => {
          console.log('[DIAG] Could not click 确定 button by role, trying text...');
        });
        await pageB.waitForTimeout(300);
      }

      // ===================== DIAGNOSTIC SUMMARY =====================
      printDiagnosticSummary('HOST A', diagA);
      printDiagnosticSummary('JOINER B', diagB);
      
      await testInfo.attach('bug2-diagnostic.txt', {
        body: [
          '=== BUG-2: Seat Rejection Alert ===',
          `Room: ${roomNumber}`,
          '',
          '=== EVIDENCE ===',
          `入座 modal appeared for occupied seat: ${hasRuZuoModal}`,
          `Rejection alert shown: ${hasRejectionAlert}`,
          `"该座位已被占用" message: ${hasSeatTakenMsg}`,
          '',
          '=== DIAGNOSIS ===',
          hasRejectionAlert && hasSeatTakenMsg
            ? '✅ BUG-2 FIXED - Rejection alert shown correctly'
            : '❌ BUG-2 NOT FIXED - No rejection alert for occupied seat',
          '',
          '=== HOST A LOGS ===',
          ...diagA.consoleLogs,
          '',
          '=== JOINER B LOGS ===',
          ...diagB.consoleLogs,
        ].join('\n'),
        contentType: 'text/plain',
      });

      // Assertion: After fix, rejection alert must be shown
      expect(hasRejectionAlert, 'Joiner should see rejection alert when taking occupied seat').toBe(true);
      expect(hasSeatTakenMsg, 'Rejection message should mention seat is taken').toBe(true);
      
      console.log('\n🔍 DIAGNOSTIC COMPLETE\n');
      
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('DIAG-4: BUG-3 verification → Host sees joiner seat update', async ({ browser }, testInfo) => {
    console.log('\n🔍 DIAGNOSTIC TEST: BUG-3 - Host visibility of joiner seating\n');
    
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const diagA = setupDiagnostics(pageA, 'HOST-A');
    const diagB = setupDiagnostics(pageB, 'JOINER-B');

    // Warm-up helper: poll for "Channel status: SUBSCRIBED" in console logs
    const waitForChannelSubscribed = async (
      diag: { consoleLogs: string[] },
      timeoutMs: number = 5000
    ): Promise<boolean> => {
      const startTime = Date.now();
      while (Date.now() - startTime < timeoutMs) {
        if (diag.consoleLogs.some(log => log.includes('Channel status: SUBSCRIBED'))) {
          return true;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    };

    let hostSubscribed = false;
    let joinerSubscribed = false;

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

      // Warm-up: wait for Host channel subscription
      hostSubscribed = await waitForChannelSubscribed(diagA, 5000);
      console.log(`[DIAG] HOST A channel subscribed: ${hostSubscribed}`);
      
      const roomNumber = await extractRoomNumber(pageA);
      console.log(`[DIAG] HOST A created room: ${roomNumber}`);
      
      // Capture HOST's view of seat 2 BEFORE joiner
      const hostSeat2Before = await collectSeatUIState(pageA, 2);
      console.log(`[DIAG] HOST A seat 2 BEFORE: ${JSON.stringify(hostSeat2Before)}`);
      await takeScreenshot(pageA, testInfo, 'A-01-seat2-before.png');

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
      await pageB.getByText('加入', { exact: true }).click();
      
      await waitForRoomScreenReady(pageB);
      console.log(`[DIAG] JOINER B joined room ${roomNumber}`);

      // Warm-up: wait for Joiner channel subscription
      joinerSubscribed = await waitForChannelSubscribed(diagB, 5000);
      console.log(`[DIAG] JOINER B channel subscribed: ${joinerSubscribed}`);

      // ===================== JOINER B: Take seat 2 =====================
      console.log('\n[DIAG] JOINER B taking seat 2...');
      
      await getSeatTileLocator(pageB, 1).click(); // seat index 1 = display "2"
      await expect(pageB.getByText('入座', { exact: true })).toBeVisible({ timeout: 5000 });
      await pageB.getByText('确定', { exact: true }).click();
      
      // Wait for seat confirmation
      await pageB.waitForTimeout(500);
      
      // Dismiss any alert that might appear
      await pageB.getByRole('button', { name: '确定' }).click({ timeout: 1000 }).catch(() => {});
      
      const joinerSeat2 = await collectSeatUIState(pageB, 2);
      console.log(`[DIAG] JOINER B seat 2: ${JSON.stringify(joinerSeat2)}`);
      await takeScreenshot(pageB, testInfo, 'B-01-seated-at-2.png');
      
      // Verify joiner is seated
      expect(joinerSeat2.hasPlayerName, 'Joiner should be seated at seat 2').toBe(true);

      // ===================== HOST A: Poll for seat 2 update =====================
      console.log('\n[DIAG] Polling HOST A for seat 2 update...');
      
      let hostSeat2After = hostSeat2Before;
      const maxPollTime = 10000;  // Extended timeout for cold-start scenarios
      const pollInterval = 250;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxPollTime) {
        hostSeat2After = await collectSeatUIState(pageA, 2);
        if (!hostSeat2After.isEmpty && hostSeat2After.hasPlayerName) {
          console.log(`[DIAG] HOST A seat 2 updated after ${Date.now() - startTime}ms`);
          break;
        }
        await pageA.waitForTimeout(pollInterval);
      }
      
      console.log(`[DIAG] HOST A seat 2 AFTER: ${JSON.stringify(hostSeat2After)}`);
      await takeScreenshot(pageA, testInfo, 'A-02-seat2-after.png');

      // ===================== DIAGNOSTIC SUMMARY =====================
      printDiagnosticSummary('HOST A', diagA);
      printDiagnosticSummary('JOINER B', diagB);
      
      const hostSawUpdate = !hostSeat2After.isEmpty && hostSeat2After.hasPlayerName;
      
      // Enhanced evidence with warm-up status and truncated logs
      const hostLast30 = diagA.consoleLogs.slice(-30);
      const joinerLast30 = diagB.consoleLogs.slice(-30);
      
      await testInfo.attach('diag4-evidence.txt', {
        body: [
          '=== DIAG-4: Host Visibility of Joiner Seating ===',
          `Timestamp: ${new Date().toISOString()}`,
          `Room: ${roomNumber}`,
          '',
          '=== CHANNEL SUBSCRIPTION ===',
          `Host channel subscribed: ${hostSubscribed}`,
          `Joiner channel subscribed: ${joinerSubscribed}`,
          '',
          '=== SEAT 2 STATE ===',
          `HOST A seat 2 BEFORE joiner: ${JSON.stringify(hostSeat2Before)}`,
          `HOST A seat 2 AFTER joiner:  ${JSON.stringify(hostSeat2After)}`,
          `JOINER B seat 2:             ${JSON.stringify(joinerSeat2)}`,
          '',
          '=== DIAGNOSIS ===',
          hostSawUpdate
            ? '✅ PASS - Host sees joiner seat update'
            : '❌ FAIL - Host does not see joiner in seat 2',
          '',
          '=== HOST A LOGS (last 30) ===',
          ...hostLast30,
          '',
          '=== JOINER B LOGS (last 30) ===',
          ...joinerLast30,
        ].join('\n'),
        contentType: 'text/plain',
      });

      // Assertion: Host must see the joiner's seat update
      expect(hostSawUpdate, 'Host should see joiner seated at seat 2').toBe(true);
      
      console.log('\n🔍 DIAGNOSTIC COMPLETE\n');
      
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('DIAG-5: Seat switching → old seat becomes empty', async ({ browser }, testInfo) => {
    console.log('\n🔍 DIAGNOSTIC TEST: Seat switching clears old seat\n');
    
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const diagA = setupDiagnostics(pageA, 'HOST-A');
    const diagB = setupDiagnostics(pageB, 'JOINER-B');

    try {
      // ===================== HOST A: Create room =====================
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

      // ===================== JOINER B: Join room =====================
      console.log('\n[DIAG] === JOINER B Setup ===');
      
      await pageB.goto('/');
      await waitForAppReady(pageB);
      await ensureAnonLogin(pageB);
      
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      
      const input = pageB.locator('input').first();
      await input.fill(roomNumber);
      await pageB.getByText('加入', { exact: true }).click();
      
      await waitForRoomScreenReady(pageB);
      console.log(`[DIAG] JOINER B joined room ${roomNumber}`);

      // ===================== JOINER B: Take seat 2 =====================
      console.log('\n[DIAG] JOINER B taking seat 2...');
      
      await getSeatTileLocator(pageB, 1).click(); // seat index 1 = display "2"
      await expect(pageB.getByText('入座', { exact: true })).toBeVisible({ timeout: 5000 });
      await pageB.getByText('确定', { exact: true }).click();
      await pageB.waitForTimeout(500);
      
      // Dismiss any alert
      await pageB.getByRole('button', { name: '确定' }).click({ timeout: 1000 }).catch(() => {});
      
      const joinerSeat2After = await collectSeatUIState(pageB, 2);
      console.log(`[DIAG] JOINER B seat 2: ${JSON.stringify(joinerSeat2After)}`);
      expect(joinerSeat2After.hasPlayerName, 'Joiner should be seated at seat 2').toBe(true);
      
      await takeScreenshot(pageB, testInfo, 'B-01-seated-at-2.png');

      // ===================== JOINER B: Switch to seat 5 =====================
      console.log('\n[DIAG] JOINER B switching to seat 5...');
      
      await getSeatTileLocator(pageB, 4).click(); // seat index 4 = display "5"
      await expect(pageB.getByText('入座', { exact: true })).toBeVisible({ timeout: 5000 });
      await pageB.getByText('确定', { exact: true }).click();
      await pageB.waitForTimeout(500);
      
      // Dismiss any alert
      await pageB.getByRole('button', { name: '确定' }).click({ timeout: 1000 }).catch(() => {});
      
      const joinerSeat5After = await collectSeatUIState(pageB, 5);
      const joinerSeat2AfterSwitch = await collectSeatUIState(pageB, 2);
      
      console.log(`[DIAG] JOINER B seat 5: ${JSON.stringify(joinerSeat5After)}`);
      console.log(`[DIAG] JOINER B seat 2 (should be empty): ${JSON.stringify(joinerSeat2AfterSwitch)}`);
      
      await takeScreenshot(pageB, testInfo, 'B-02-switched-to-5.png');

      // ===================== HOST A: Verify seat states =====================
      console.log('\n[DIAG] Polling HOST A for seat updates...');
      
      // Poll for Host to see seat 5 occupied
      let hostSeat5 = await collectSeatUIState(pageA, 5);
      const maxPollTime = 5000;
      const pollInterval = 250;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxPollTime) {
        hostSeat5 = await collectSeatUIState(pageA, 5);
        if (!hostSeat5.isEmpty && hostSeat5.hasPlayerName) {
          break;
        }
        await pageA.waitForTimeout(pollInterval);
      }
      
      const hostSeat2 = await collectSeatUIState(pageA, 2);
      
      console.log(`[DIAG] HOST A seat 5: ${JSON.stringify(hostSeat5)}`);
      console.log(`[DIAG] HOST A seat 2 (should be empty): ${JSON.stringify(hostSeat2)}`);
      
      await takeScreenshot(pageA, testInfo, 'A-01-after-switch.png');

      // ===================== DIAGNOSTIC SUMMARY =====================
      printDiagnosticSummary('HOST A', diagA);
      printDiagnosticSummary('JOINER B', diagB);
      
      await testInfo.attach('seat-switch-diagnostic.txt', {
        body: [
          '=== Seat Switch Test ===',
          `Room: ${roomNumber}`,
          '',
          '=== JOINER B VIEW ===',
          `Seat 5 (new): ${JSON.stringify(joinerSeat5After)}`,
          `Seat 2 (old, should be empty): ${JSON.stringify(joinerSeat2AfterSwitch)}`,
          '',
          '=== HOST A VIEW ===',
          `Seat 5 (new): ${JSON.stringify(hostSeat5)}`,
          `Seat 2 (old, should be empty): ${JSON.stringify(hostSeat2)}`,
          '',
          '=== DIAGNOSIS ===',
          joinerSeat2AfterSwitch.isEmpty && hostSeat2.isEmpty
            ? '✅ FIXED - Old seat properly cleared on switch'
            : '❌ BUG - Old seat not cleared on switch',
          '',
          '=== HOST A LOGS ===',
          ...diagA.consoleLogs,
          '',
          '=== JOINER B LOGS ===',
          ...diagB.consoleLogs,
        ].join('\n'),
        contentType: 'text/plain',
      });

      // Assertions
      expect(joinerSeat5After.hasPlayerName, 'Joiner seat 5 should have player').toBe(true);
      expect(joinerSeat2AfterSwitch.isEmpty, 'Joiner old seat 2 should be empty').toBe(true);
      expect(hostSeat5.hasPlayerName, 'Host sees seat 5 occupied').toBe(true);
      expect(hostSeat2.isEmpty, 'Host sees old seat 2 empty').toBe(true);
      
      console.log('\n🔍 DIAGNOSTIC COMPLETE\n');
      
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('DIAG-6: Player stand up → seat becomes empty on both views', async ({ browser }, testInfo) => {
    console.log('\n🔍 DIAGNOSTIC TEST: Stand up / leave seat\n');
    
    // Create two isolated contexts
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const diagA = setupDiagnostics(pageA, 'HOST-A');
    const diagB = setupDiagnostics(pageB, 'JOINER-B');

    try {
      // ===================== HOST A: Create room =====================
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

      // ===================== JOINER B: Join room =====================
      console.log('\n[DIAG] === JOINER B Setup ===');
      
      await pageB.goto('/');
      await waitForAppReady(pageB);
      await ensureAnonLogin(pageB);
      
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      
      const input = pageB.locator('input').first();
      await input.fill(roomNumber);
      await pageB.getByText('加入', { exact: true }).click();
      
      await waitForRoomScreenReady(pageB);
      console.log(`[DIAG] JOINER B joined room ${roomNumber}`);

      // ===================== JOINER B: Take seat 2 =====================
      console.log('\n[DIAG] JOINER B taking seat 2...');
      
      await getSeatTileLocator(pageB, 1).click(); // seat index 1 = display "2"
      await expect(pageB.getByText('入座', { exact: true })).toBeVisible({ timeout: 5000 });
      await pageB.getByText('确定', { exact: true }).click();
      await pageB.waitForTimeout(500);
      
      // Dismiss any alert
      await pageB.getByRole('button', { name: '确定' }).click({ timeout: 1000 }).catch(() => {});
      
      const joinerSeat2After = await collectSeatUIState(pageB, 2);
      console.log(`[DIAG] JOINER B seat 2: ${JSON.stringify(joinerSeat2After)}`);
      expect(joinerSeat2After.hasPlayerName, 'Joiner should be seated at seat 2').toBe(true);
      
      await takeScreenshot(pageB, testInfo, 'B-01-seated-at-2.png');

      // ===================== Wait for HOST A to see JOINER B =====================
      console.log('\n[DIAG] Waiting for HOST A to see seat 2 occupied...');
      
      let hostSeat2Before = await collectSeatUIState(pageA, 2);
      const maxPollTime = 5000;
      const pollInterval = 250;
      let startTime = Date.now();
      
      while (Date.now() - startTime < maxPollTime) {
        hostSeat2Before = await collectSeatUIState(pageA, 2);
        if (!hostSeat2Before.isEmpty && hostSeat2Before.hasPlayerName) {
          break;
        }
        await pageA.waitForTimeout(pollInterval);
      }
      
      console.log(`[DIAG] HOST A seat 2 before stand up: ${JSON.stringify(hostSeat2Before)}`);
      expect(hostSeat2Before.hasPlayerName, 'Host should see seat 2 occupied').toBe(true);
      
      await takeScreenshot(pageA, testInfo, 'A-01-sees-joiner-seated.png');

      // ===================== JOINER B: Stand up from seat 2 =====================
      console.log('\n[DIAG] JOINER B standing up from seat 2...');
      
      await getSeatTileLocator(pageB, 1).click(); // Click own seat
      
      // Modal should show "站起" since it's own seat
      await expect(pageB.getByText('站起', { exact: true })).toBeVisible({ timeout: 5000 });
      console.log('[DIAG] JOINER B sees 站起 modal');
      
      // Click confirm button in the modal (use text locator - RN Web TouchableOpacity is not a button role)
      await pageB.getByText('确定', { exact: true }).click();
      await pageB.waitForTimeout(500);
      
      await takeScreenshot(pageB, testInfo, 'B-02-after-stand-up.png');

      // ===================== Verify: JOINER B sees seat 2 empty =====================
      const joinerSeat2AfterStandUp = await collectSeatUIState(pageB, 2);
      console.log(`[DIAG] JOINER B seat 2 after stand up: ${JSON.stringify(joinerSeat2AfterStandUp)}`);
      
      expect(joinerSeat2AfterStandUp.isEmpty, 'Joiner seat 2 should be empty after stand up').toBe(true);

      // ===================== Verify: HOST A sees seat 2 empty =====================
      console.log('\n[DIAG] Polling HOST A for seat 2 empty...');
      
      let hostSeat2After = await collectSeatUIState(pageA, 2);
      startTime = Date.now();
      
      while (Date.now() - startTime < maxPollTime) {
        hostSeat2After = await collectSeatUIState(pageA, 2);
        if (hostSeat2After.isEmpty) {
          break;
        }
        await pageA.waitForTimeout(pollInterval);
      }
      
      console.log(`[DIAG] HOST A seat 2 after stand up: ${JSON.stringify(hostSeat2After)}`);
      
      await takeScreenshot(pageA, testInfo, 'A-02-sees-joiner-left.png');

      // ===================== DIAGNOSTIC SUMMARY =====================
      printDiagnosticSummary('HOST A', diagA);
      printDiagnosticSummary('JOINER B', diagB);
      
      await testInfo.attach('stand-up-diagnostic.txt', {
        body: [
          '=== Stand Up Test ===',
          `Room: ${roomNumber}`,
          '',
          '=== JOINER B VIEW ===',
          `Seat 2 after sit: ${JSON.stringify(joinerSeat2After)}`,
          `Seat 2 after stand up: ${JSON.stringify(joinerSeat2AfterStandUp)}`,
          '',
          '=== HOST A VIEW ===',
          `Seat 2 before stand up: ${JSON.stringify(hostSeat2Before)}`,
          `Seat 2 after stand up: ${JSON.stringify(hostSeat2After)}`,
          '',
          '=== DIAGNOSIS ===',
          joinerSeat2AfterStandUp.isEmpty && hostSeat2After.isEmpty
            ? '✅ PASS - Stand up properly broadcasts empty seat'
            : '❌ FAIL - Stand up not properly broadcast',
          '',
          '=== HOST A LOGS ===',
          ...diagA.consoleLogs,
          '',
          '=== JOINER B LOGS ===',
          ...diagB.consoleLogs,
        ].join('\n'),
        contentType: 'text/plain',
      });

      // Final assertions
      expect(hostSeat2After.isEmpty, 'Host sees seat 2 empty after joiner stands up').toBe(true);
      
      console.log('\n🔍 DIAGNOSTIC COMPLETE\n');
      
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

});
