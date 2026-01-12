import { Page, expect } from '@playwright/test';
import { clickIfVisible, screenshotOnFail, getVisibleText } from './ui';
import { TESTIDS } from '../../src/testids';

/**
 * Home Screen Helpers (首页/登录稳定化层)
 * 
 * These helpers ensure stable entry to the app by handling:
 * - App hydration (React Native Web)
 * - Transient states (loading, "创建中...")
 * - Login flows (anonymous login)
 * - Error recovery (retry dialogs)
 * 
 * NOTE: Generic UI primitives (getVisibleText, gotoWithRetry, etc.) live in ui.ts.
 * Import them directly from './helpers/ui' in specs — do NOT import from here.
 */

// =============================================================================
// Constants
// =============================================================================

/** Stable selectors for home screen ready state (composite condition) */
const HOME_READY_SELECTORS = [
  `[data-testid="${TESTIDS.homeEnterRoomButton}"]`,
  `[data-testid="${TESTIDS.homeCreateRoomButton}"]`,
];

/** Transient/loading states to wait out */
const TRANSIENT_PATTERNS = [
  '创建中',
  '加载中',
  '连接中',
];

/** Modal/overlay patterns that block interaction */
const BLOCKING_MODAL_PATTERNS = [
  '需要登录',
  '请先登录',
  '👤 匿名登录',
  '登录失败',
  '加载超时',
  '提示',
];

/** Error states that need recovery action */
const ERROR_RECOVERY_PATTERNS = [
  { text: '加载超时', action: '重试' },
  { text: '连接失败', action: '重试' },
  { text: '网络错误', action: '重试' },
  { text: '登录失败', action: '确定' },
];

// =============================================================================
// Core Helpers
// =============================================================================

/**
 * Wait for app to be ready (React Native Web hydration).
 * Uses app title as hydration indicator.
 */
export async function waitForAppReady(page: Page, timeoutMs = 15000): Promise<void> {
  await page.waitForSelector('text=狼人杀法官', { timeout: timeoutMs });
}

/**
 * Handle error recovery dialogs if present.
 * Returns true if a dialog was handled.
 */
async function handleErrorRecovery(page: Page): Promise<boolean> {
  for (const pattern of ERROR_RECOVERY_PATTERNS) {
    const hasError = await page.getByText(pattern.text).isVisible({ timeout: 300 }).catch(() => false);
    if (hasError) {
      console.log(`[handleErrorRecovery] Found "${pattern.text}", clicking "${pattern.action}"`);
      await clickIfVisible(page, pattern.action, { timeout: 1000 });
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

/**
 * Wait for transient states to clear.
 * Returns true if any transient state was observed.
 */
async function waitForTransientToClear(page: Page, maxWaitMs = 10000): Promise<boolean> {
  const startTime = Date.now();
  let sawTransient = false;

  while (Date.now() - startTime < maxWaitMs) {
    let foundTransient = false;
    for (const pattern of TRANSIENT_PATTERNS) {
      if (await page.getByText(pattern).isVisible({ timeout: 100 }).catch(() => false)) {
        foundTransient = true;
        sawTransient = true;
        break;
      }
    }
    
    if (!foundTransient) {
      return sawTransient;
    }
    
    await page.waitForTimeout(200);
  }

  console.log(`[waitForTransientToClear] Transient state still present after ${maxWaitMs}ms`);
  return sawTransient;
}

/**
 * Check if we're on the home screen in a stable state.
 * Must see home buttons AND no blocking modals AND no transient states.
 */
async function isHomeReady(page: Page): Promise<boolean> {
  // Root must be present (stable screen gate)
  const hasRoot = await page.locator(`[data-testid="${TESTIDS.homeScreenRoot}"]`).isVisible({ timeout: 200 }).catch(() => false);
  if (!hasRoot) {
    return false;
  }

  // First check no blocking modals are visible
  for (const pattern of BLOCKING_MODAL_PATTERNS) {
    const isBlocking = await page.getByText(pattern).isVisible({ timeout: 100 }).catch(() => false);
    if (isBlocking) {
      console.log(`[isHomeReady] Blocked by modal: "${pattern}"`);
      return false;
    }
  }

  // Check no transient states (loading indicators)
  for (const pattern of TRANSIENT_PATTERNS) {
    const isTransient = await page.getByText(pattern).isVisible({ timeout: 100 }).catch(() => false);
    if (isTransient) {
      console.log(`[isHomeReady] Transient state: "${pattern}"`);
      return false;
    }
  }

  // Must see at least one home screen action button
  for (const selector of HOME_READY_SELECTORS) {
    const isVisible = await page.locator(selector).isVisible({ timeout: 200 }).catch(() => false);
    if (isVisible) {
      return true;
    }
  }
  return false;
}

/**
 * Complete anonymous login flow if login is required.
 * 
 * Handles:
 * - "需要登录" / "请先登录后继续" dialogs
 * - "点击登录" → "👤 匿名登录" flow
 * 
 * Returns true if login was performed.
 */
async function completeAnonLoginIfNeeded(page: Page): Promise<boolean> {
  // Already logged in?
  if (await page.getByText('匿名用户').isVisible({ timeout: 500 }).catch(() => false)) {
    return false;
  }

  // Check for login-required overlay
  const loginPrompts = ['需要登录', '请先登录后继续', '请先登陆后继续'];
  let needsLogin = false;
  for (const prompt of loginPrompts) {
    if (await page.getByText(prompt).isVisible({ timeout: 500 }).catch(() => false)) {
      needsLogin = true;
      break;
    }
  }

  if (!needsLogin) {
    return false;
  }

  console.log('[completeAnonLoginIfNeeded] Login required, completing flow...');

  // Click "登录" or "点击登录" if visible
  await clickIfVisible(page, '点击登录', { timeout: 1000 });
  await clickIfVisible(page, '登录', { exact: true, timeout: 1000 });

  // Wait for and click anonymous login
  await expect(page.getByText('👤 匿名登录')).toBeVisible({ timeout: 5000 });
  await page.getByText('👤 匿名登录').click();

  // Wait for login to complete
  await expect(page.getByText('匿名用户')).toBeVisible({ timeout: 15000 });
  console.log('[completeAnonLoginIfNeeded] Login completed');

  // Dismiss any remaining login dialogs
  await page.waitForTimeout(300);
  for (const prompt of loginPrompts) {
    if (await page.getByText(prompt).isVisible({ timeout: 300 }).catch(() => false)) {
      await clickIfVisible(page, '取消', { exact: true, timeout: 500 });
      break;
    }
  }

  return true;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Try to dismiss any blocking modals.
 */
async function dismissBlockingModals(page: Page): Promise<boolean> {
  // Check if any blocking modal is visible
  let hasBlockingModal = false;
  for (const pattern of BLOCKING_MODAL_PATTERNS) {
    if (await page.getByText(pattern).isVisible({ timeout: 100 }).catch(() => false)) {
      hasBlockingModal = true;
      break;
    }
  }

  if (!hasBlockingModal) {
    return false;
  }

  // Try common dismiss buttons
  const dismissed = 
    await clickIfVisible(page, '取消', { exact: true, timeout: 300 }) ||
    await clickIfVisible(page, '确定', { exact: true, timeout: 300 }) ||
    await clickIfVisible(page, '关闭', { exact: true, timeout: 300 });
  
  if (dismissed) {
    await page.waitForTimeout(300);
  }
  return dismissed;
}

/**
 * Ensure the app is on a stable home screen state.
 * 
 * This function handles:
 * 1. App hydration (React Native Web)
 * 2. Error recovery dialogs (retry buttons)
 * 3. Transient states (loading indicators)
 * 4. Blocking modals (login dialogs, etc.)
 * 
 * Stable home state = can see "创建房间" or "进入房间" buttons with no modal blocking.
 * 
 * @param page - Playwright Page
 * @param opts - Options for timeout and retry behavior
 * @throws Error if stable state cannot be reached
 */
export async function ensureHomeReady(
  page: Page,
  opts: { maxRetries?: number; timeoutMs?: number } = {}
): Promise<void> {
  const { maxRetries = 5, timeoutMs = 30000 } = opts;
  const startTime = Date.now();

  console.log('[ensureHomeReady] Starting...');

  // Step 1: Wait for app hydration
  await waitForAppReady(page);

  // Step 2: Retry loop for stable state
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (Date.now() - startTime > timeoutMs) {
      await screenshotOnFail(page, 'ensureHomeReady-timeout');
      throw new Error(`[ensureHomeReady] Timeout after ${timeoutMs}ms`);
    }

    // Handle any error recovery dialogs
    await handleErrorRecovery(page);

    // Wait for transient states to clear
    await waitForTransientToClear(page, 5000);

    // Try to dismiss any blocking modals
    await dismissBlockingModals(page);

    // Check if we're ready
    if (await isHomeReady(page)) {
      console.log(`[ensureHomeReady] Stable state reached on attempt ${attempt}`);
      return;
    }

    // Short wait before retry
    await page.waitForTimeout(500);
  }

  // Final check after all retries
  if (await isHomeReady(page)) {
    console.log('[ensureHomeReady] Stable state reached after retries');
    return;
  }

  await screenshotOnFail(page, 'ensureHomeReady-failed');
  throw new Error(`[ensureHomeReady] Could not reach stable home state after ${maxRetries} attempts`);
}

/**
 * Ensure anonymous login is completed, then return to stable home state.
 * 
 * Strategy:
 * 1. If already logged in (匿名用户 visible), verify home is stable
 * 2. Otherwise click "点击登录" in header to trigger login
 * 3. Complete login flow
 * 4. Wait for home to be stable
 * 
 * IMPORTANT: We do NOT click "创建房间" to trigger login because that would 
 * also start a room creation flow after login completes.
 * 
 * @param page - Playwright Page
 */
export async function ensureAnonLogin(page: Page): Promise<void> {
  // First ensure we're on a stable screen
  await waitForAppReady(page);

  // Already logged in?
  const alreadyLoggedIn = await page.getByText('匿名用户').isVisible({ timeout: 1000 }).catch(() => false);
  if (alreadyLoggedIn) {
    console.log('[ensureAnonLogin] Already logged in');
    await ensureHomeReady(page);
    return;
  }

  // Check for "点击登录" button in header
  const hasLoginBtn = await page.getByText('点击登录').isVisible({ timeout: 2000 }).catch(() => false);
  if (hasLoginBtn) {
    console.log('[ensureAnonLogin] Clicking 点击登录...');
    // Use force:true because the element might be replaced during click
    try {
      await page.getByText('点击登录').click({ timeout: 2000 });
    } catch {
      // Element was replaced - login might have auto-completed
      console.log('[ensureAnonLogin] 点击登录 was replaced, checking if logged in...');
    }
    await page.waitForTimeout(500);
    
    // Complete login flow
    await completeAnonLoginIfNeeded(page);
    
    // Wait for home to be stable
    await ensureHomeReady(page);
    console.log('[ensureAnonLogin] Completed via 点击登录');
    return;
  }

  // Fallback: Maybe we're on a screen where login is required
  // Check for login-required prompts
  const loginCompleted = await completeAnonLoginIfNeeded(page);
  if (loginCompleted) {
    await ensureHomeReady(page);
    console.log('[ensureAnonLogin] Completed via login dialog');
    return;
  }

  // Last resort: trigger login via some action
  // This is not ideal but better than nothing
  console.log('[ensureAnonLogin] No login trigger found, trying 创建房间...');
  await expect(page.getByText('创建房间')).toBeVisible({ timeout: 5000 });
  await page.getByText('创建房间').click();
  await page.waitForTimeout(500);
  
  await completeAnonLoginIfNeeded(page);
  await waitForPostLoginStable(page);
  await navigateBackToHome(page);
  
  console.log('[ensureAnonLogin] Completed');
}

/**
 * Wait for post-login state to stabilize.
 * After login, the app might be in various states.
 */
async function waitForPostLoginStable(page: Page, maxWaitMs = 15000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    // Check if we're on a stable screen
    const onConfig = await page.getByText('快速模板').isVisible({ timeout: 200 }).catch(() => false);
    const onRoom = await page.locator(String.raw`text=/房间 \d{4}/`).isVisible({ timeout: 200 }).catch(() => false);
    const onHome = await page.getByText('创建房间').isVisible({ timeout: 200 }).catch(() => false);
    
    if (onConfig || onRoom || onHome) {
      return;
    }
    
    // Still in transient state, wait
    await page.waitForTimeout(300);
  }
  
  console.log('[waitForPostLoginStable] Timeout, continuing anyway');
}

/**
 * Navigate back to home screen from wherever we are.
 * Uses ensureHomeReady at the end to verify stable state.
 */
async function navigateBackToHome(page: Page): Promise<void> {
  const maxAttempts = 5;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check if we're on ConfigScreen (has "快速模板")
    const onConfig = await page.getByText('快速模板').isVisible({ timeout: 300 }).catch(() => false);
    if (onConfig) {
      console.log('[navigateBackToHome] On ConfigScreen, clicking back');
      const backBtn = getVisibleText(page, '←');
      if (await backBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(500);
        continue;
      }
    }
    
    // Check if we're on RoomScreen (has "房间 XXXX")
    const onRoom = await page.locator(String.raw`text=/房间 \d{4}/`).isVisible({ timeout: 300 }).catch(() => false);
    if (onRoom) {
      console.log('[navigateBackToHome] On RoomScreen, need to leave room');
      // This is a more complex case - for now just return and let the caller handle
      // The test might need to leave the room explicitly
      return;
    }
    
    // Check if home is truly ready (no transient states)
    if (await isHomeReady(page)) {
      console.log('[navigateBackToHome] Home is ready');
      return;
    }
    
    // Try back button anyway
    const backBtn = getVisibleText(page, '←');
    if (await backBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(500);
      continue;
    }
    
    // Maybe transient state - wait
    await page.waitForTimeout(500);
  }
  
  // Final check - use ensureHomeReady which handles transient states
  await ensureHomeReady(page);
}

/**
 * Check if currently in a room (sees "房间 XXXX" header).
 * If in room, returns the room code. Otherwise returns null.
 */
export async function getCurrentRoomCode(page: Page): Promise<string | null> {
  const roomHeader = page.locator(`[data-testid="${TESTIDS.roomHeader}"]`);
  if (await roomHeader.isVisible({ timeout: 500 }).catch(() => false)) {
    const text = await roomHeader.textContent();
    const match = text?.match(/\b(\d{4})\b/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Ensure we're either in a room or on a stable home screen.
 * 
 * If already in room (房间 XXXX visible), returns immediately.
 * Otherwise ensures home is ready.
 * 
 * @returns Room code if in room, null if on home
 */
export async function ensureInRoomOrHomeReady(page: Page): Promise<string | null> {
  await waitForAppReady(page);

  // Check if in room
  const roomCode = await getCurrentRoomCode(page);
  if (roomCode) {
    console.log(`[ensureInRoomOrHomeReady] Already in room ${roomCode}`);
    return roomCode;
  }

  // Not in room, ensure home is ready
  await ensureHomeReady(page);
  return null;
}

/**
 * Extract room number from room screen header.
 * Assumes we're on a room screen.
 */
export async function extractRoomNumber(page: Page): Promise<string> {
  const headerLocator = page.locator(`[data-testid="${TESTIDS.roomHeader}"]`);
  await expect(headerLocator).toBeVisible({ timeout: 5000 });
  const headerText = await headerLocator.textContent();
  const match = headerText?.match(/\b(\d{4})\b/);
  if (!match) throw new Error(`Could not extract room number from: ${headerText}`);
  return match[1];
}

// =============================================================================
// Room Creation/Join Actions
// =============================================================================

/**
 * Create a new room from home screen.
 * Assumes we're logged in and on home screen.
 * 
 * @param page - Playwright Page
 * @returns Room code of created room
 */
export async function createRoom(page: Page): Promise<string> {
  console.log('[createRoom] Starting...');
  
  // Click 创建房间
  await page.locator(`[data-testid="${TESTIDS.homeCreateRoomButton}"]`).click();
  
  // Wait for config screen
  await expect(page.locator(`[data-testid="${TESTIDS.configScreenRoot}"]`)).toBeVisible({ timeout: 10000 });
  
  // Click 创建 to create the room (header right button)
  await getVisibleText(page, '创建').click();
  
  // Wait for room to be created (room header visible)
  const { waitForRoomScreenReady } = await import('./waits');
  await waitForRoomScreenReady(page, { role: 'host' });
  
  // Extract and return room code
  const roomCode = await extractRoomNumber(page);
  console.log(`[createRoom] Room ${roomCode} created`);
  return roomCode;
}

/**
 * Join an existing room from home screen.
 * Assumes we're logged in and on home screen.
 * 
 * @param page - Playwright Page
 * @param roomCode - 4-digit room code
 */
export async function joinRoom(page: Page, roomCode: string): Promise<void> {
  console.log(`[joinRoom] Joining room ${roomCode}...`);
  
  // Click 进入房间
  await page.locator(`[data-testid="${TESTIDS.homeEnterRoomButton}"]`).click();
  
  // Wait for join dialog
  await expect(page.getByText('加入房间')).toBeVisible({ timeout: 5000 });
  
  // Enter room code
  const input = page.locator('input[placeholder*="房间号"]').or(
    page.locator('input').first()
  );
  await input.fill(roomCode);
  
  // Click 加入
  await page.getByText('加入', { exact: true }).click();
  
  // Wait for room to load
  const { waitForRoomScreenReady } = await import('./waits');
  await waitForRoomScreenReady(page, { role: 'joiner' });
  
  console.log(`[joinRoom] Joined room ${roomCode}`);
}
