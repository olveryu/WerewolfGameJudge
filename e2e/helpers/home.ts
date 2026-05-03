import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { clickIfVisible, screenshotOnFail } from './ui';

/**
 * Register auto-dismiss handlers for overlays that may appear at any time.
 *
 * Uses Playwright's `addLocatorHandler` so the handler fires automatically
 * before every actionability check — no manual dismiss timing needed.
 */
export async function registerAutoDismissers(page: Page): Promise<void> {
  // Announcement / What's New modal — trigger on version title (blocking content),
  // dismiss via role-based button locator. .first() avoids strict-mode violation
  // when multiple version entries are visible in the scrollable list.
  await page.addLocatorHandler(page.getByText(/^v\d+\.\d+\.\d+ 更新内容$/).first(), async () => {
    await page.getByRole('button', { name: '我知道了' }).click();
  });
}

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
const TRANSIENT_PATTERNS = ['创建中', '加载中', '连接中'];

/** Modal/overlay patterns that block interaction */
const BLOCKING_MODAL_PATTERNS = [
  '请先登录',
  '👤 匿名登录',
  '登录失败',
  '加载超时',
  '提示',
  '加入房间',
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
  await page.waitForSelector('text=狼人面杀电子裁判助手', { timeout: timeoutMs });
}

/**
 * Handle error recovery dialogs if present.
 * Returns true if a dialog was handled.
 */
async function handleErrorRecovery(page: Page): Promise<boolean> {
  for (const pattern of ERROR_RECOVERY_PATTERNS) {
    const hasError = await page
      .getByText(pattern.text)
      .isVisible()
      .catch(() => false);
    if (hasError) {
      await clickIfVisible(page, pattern.action, { timeout: 1000 });
      // Wait for error dialog to disappear after clicking recovery action
      await page
        .getByText(pattern.text)
        .waitFor({ state: 'hidden', timeout: 3000 })
        .catch(() => {});
      return true;
    }
  }
  return false;
}

/**
 * Wait for transient states to clear.
 *
 * Uses Playwright's event-driven `waitFor({ state: 'hidden' })` instead of
 * polling `.isVisible()` — avoids TOCTOU races and reduces test flakiness.
 * Returns true if any transient state was observed.
 */
async function waitForTransientToClear(page: Page, maxWaitMs = 10000): Promise<boolean> {
  let sawTransient = false;

  for (const pattern of TRANSIENT_PATTERNS) {
    const locator = page.getByText(pattern);
    const visible = await locator.isVisible().catch(() => false);
    if (visible) {
      sawTransient = true;
      await locator.waitFor({ state: 'hidden', timeout: maxWaitMs }).catch(() => {});
    }
  }

  return sawTransient;
}

/**
 * Check if we're on the home screen in a stable state.
 * Must see home buttons AND no blocking modals AND no transient states.
 */
async function isHomeReady(page: Page): Promise<boolean> {
  // Root must be present (stable screen gate)
  const hasRoot = await page
    .locator(`[data-testid="${TESTIDS.homeScreenRoot}"]`)
    .isVisible()
    .catch(() => false);
  if (!hasRoot) {
    return false;
  }

  // First check no blocking modals are visible
  for (const pattern of BLOCKING_MODAL_PATTERNS) {
    const isBlocking = await page
      .getByText(pattern)
      .isVisible()
      .catch(() => false);
    if (isBlocking) {
      return false;
    }
  }

  // Check no transient states (loading indicators)
  for (const pattern of TRANSIENT_PATTERNS) {
    const isTransient = await page
      .getByText(pattern)
      .isVisible()
      .catch(() => false);
    if (isTransient) {
      return false;
    }
  }

  // Must see at least one home screen action button
  for (const selector of HOME_READY_SELECTORS) {
    const isVisible = await page
      .locator(selector)
      .isVisible()
      .catch(() => false);
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
 * - Login modal ("登录") shown directly when auth is required
 * - "点击登录" → "👤 匿名登录" flow
 *
 * Returns true if login was performed.
 */
async function completeAnonLoginIfNeeded(page: Page): Promise<boolean> {
  // Already logged in? Check for user name display via testID
  const userNameLocator = page.locator(`[data-testid="${TESTIDS.homeUserName}"]`);
  if (
    await userNameLocator
      .waitFor({ state: 'visible', timeout: 500 })
      .then(() => true)
      .catch(() => false)
  ) {
    return false;
  }

  // Check for login modal overlay (title text in LoginOptions / AuthGateOverlay)
  const loginPrompts = ['登录'];
  let needsLogin = false;
  for (const prompt of loginPrompts) {
    if (
      await page
        .getByText(prompt)
        .waitFor({ state: 'visible', timeout: 500 })
        .then(() => true)
        .catch(() => false)
    ) {
      needsLogin = true;
      break;
    }
  }

  if (!needsLogin) {
    return false;
  }

  // Click login trigger via text fallback
  await clickIfVisible(page, '点击登录', { timeout: 1000 });
  await clickIfVisible(page, '登录', { exact: true, timeout: 1000 });

  // Wait for and click anonymous login via testID
  const anonLoginBtn = page.locator(`[data-testid="${TESTIDS.homeAnonLoginButton}"]`);
  await expect(anonLoginBtn).toBeVisible({ timeout: 5000 });
  await anonLoginBtn.click();

  // Wait for login to complete - check for user name display
  await expect(userNameLocator).toBeVisible({ timeout: 15000 });

  // Dismiss any remaining login dialogs
  for (const prompt of loginPrompts) {
    if (
      await page
        .getByText(prompt)
        .isVisible()
        .catch(() => false)
    ) {
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
  let foundPattern: string | null = null;
  for (const pattern of BLOCKING_MODAL_PATTERNS) {
    if (
      await page
        .getByText(pattern)
        .isVisible()
        .catch(() => false)
    ) {
      foundPattern = pattern;
      break;
    }
  }

  if (!foundPattern) {
    return false;
  }

  // Try common dismiss buttons
  const dismissed =
    (await clickIfVisible(page, '我知道了', { exact: true, timeout: 300 })) ||
    (await clickIfVisible(page, '取消', { exact: true, timeout: 300 })) ||
    (await clickIfVisible(page, '确定', { exact: true, timeout: 300 })) ||
    (await clickIfVisible(page, '关闭', { exact: true, timeout: 300 }));

  if (dismissed) {
    // Wait for blocking modal to actually disappear
    await page
      .getByText(foundPattern)
      .waitFor({ state: 'hidden', timeout: 2000 })
      .catch(() => {});
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
async function ensureHomeReady(
  page: Page,
  opts: { maxRetries?: number; timeoutMs?: number } = {},
): Promise<void> {
  const { maxRetries = 5, timeoutMs = 30000 } = opts;
  const startTime = Date.now();

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
      return;
    }

    // Short wait before retry (poll cadence)
    await page.waitForTimeout(300);
  }

  // Final check after all retries
  if (await isHomeReady(page)) {
    return;
  }

  await screenshotOnFail(page, 'ensureHomeReady-failed');
  throw new Error(
    `[ensureHomeReady] Could not reach stable home state after ${maxRetries} attempts`,
  );
}

/**
 * Ensure anonymous login is completed, then return to stable home state.
 *
 * Strategy:
 * 1. If already logged in (user name visible), verify home is stable
 * 2. Otherwise click "进入房间" to trigger requireAuth → login modal
 * 3. Complete login flow and dismiss any leftover modals
 * 4. Wait for home to be stable
 *
 * @param page - Playwright Page
 */
export async function ensureAnonLogin(page: Page): Promise<void> {
  // First ensure we're on a stable screen
  await waitForAppReady(page);

  // Already logged in? Check via testID
  const userNameLocator = page.locator(`[data-testid="${TESTIDS.homeUserName}"]`);
  const alreadyLoggedIn = await userNameLocator
    .waitFor({ state: 'visible', timeout: 1000 })
    .then(() => true)
    .catch(() => false);
  if (alreadyLoggedIn) {
    await ensureHomeReady(page);
    return;
  }

  // Check if a login modal is already showing
  const loginCompleted = await completeAnonLoginIfNeeded(page);
  if (loginCompleted) {
    await ensureHomeReady(page);
    return;
  }

  // Trigger login via "进入房间" button (calls requireAuth → shows login modal)
  const enterRoomBtn = page.locator(`[data-testid="${TESTIDS.homeEnterRoomButton}"]`);
  const hasEnterBtn = await enterRoomBtn
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (hasEnterBtn) {
    await enterRoomBtn.click({ timeout: 2000 });

    // Wait for login modal to appear
    const anonLoginBtn = page.locator(`[data-testid="${TESTIDS.homeAnonLoginButton}"]`);
    const hasAnonBtn = await anonLoginBtn
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (hasAnonBtn) {
      await anonLoginBtn.click();
      await expect(userNameLocator).toBeVisible({ timeout: 15000 });
    } else {
      await completeAnonLoginIfNeeded(page);
    }

    // Dismiss any leftover modals (e.g. join room modal from pending action)
    await dismissBlockingModals(page);
    await ensureHomeReady(page);
    return;
  }

  // Last resort: trigger login via create room button (testID)
  const createRoomBtn = page.locator(`[data-testid="${TESTIDS.homeCreateRoomButton}"]`);
  await expect(createRoomBtn).toBeVisible({ timeout: 5000 });
  await createRoomBtn.click();
  // Wait for login modal to appear after triggering create room
  await page
    .locator(`[data-testid="${TESTIDS.homeAnonLoginButton}"]`)
    .or(page.getByText('登录', { exact: true }))
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => {});

  await completeAnonLoginIfNeeded(page);
  await waitForPostLoginStable(page);
  await navigateBackToHome(page);
}

/**
 * Wait for post-login state to stabilize.
 * After login, the app might be in various states.
 */
async function waitForPostLoginStable(page: Page, maxWaitMs = 15000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // Check if we're on a stable screen using testIDs (preferred) or fallback regex
    const onBoardPicker = await page
      .locator(`[data-testid="${TESTIDS.boardPickerScreenRoot}"]`)
      .isVisible()
      .catch(() => false);
    const onConfig = await page
      .locator(`[data-testid="${TESTIDS.configScreenRoot}"]`)
      .isVisible()
      .catch(() => false);
    const onRoom = await page
      .locator(`[data-testid="${TESTIDS.roomScreenRoot}"]`)
      .isVisible()
      .catch(() => false);
    const onHome = await page
      .locator(`[data-testid="${TESTIDS.homeScreenRoot}"]`)
      .isVisible()
      .catch(() => false);

    if (onBoardPicker || onConfig || onRoom || onHome) {
      return;
    }

    // Wait for any stable screen to appear
    await page
      .locator(`[data-testid="${TESTIDS.boardPickerScreenRoot}"]`)
      .or(page.locator(`[data-testid="${TESTIDS.configScreenRoot}"]`))
      .or(page.locator(`[data-testid="${TESTIDS.roomScreenRoot}"]`))
      .or(page.locator(`[data-testid="${TESTIDS.homeScreenRoot}"]`))
      .first()
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(() => {});
  }
}

/**
 * Navigate back to home screen from wherever we are.
 * Uses ensureHomeReady at the end to verify stable state.
 */
async function navigateBackToHome(page: Page): Promise<void> {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check if we're on ConfigScreen using testID
    const onConfig = await page
      .locator(`[data-testid="${TESTIDS.configScreenRoot}"]`)
      .isVisible()
      .catch(() => false);
    if (onConfig) {
      const backBtn = page.locator('[data-testid="config-back-button"]');
      if (await backBtn.isVisible().catch(() => false)) {
        await backBtn.click();
        // Wait for config screen to disappear
        await page
          .locator(`[data-testid="${TESTIDS.configScreenRoot}"]`)
          .waitFor({ state: 'hidden', timeout: 3000 })
          .catch(() => {});
        continue;
      }
    }

    // Check if we're on BoardPickerScreen using testID
    const onBoardPicker = await page
      .locator(`[data-testid="${TESTIDS.boardPickerScreenRoot}"]`)
      .isVisible()
      .catch(() => false);
    if (onBoardPicker) {
      // Press browser back or the header back button to return to Home
      await page.goBack();
      await page
        .locator(`[data-testid="${TESTIDS.boardPickerScreenRoot}"]`)
        .waitFor({ state: 'hidden', timeout: 3000 })
        .catch(() => {});
      continue;
    }

    // Check if we're on RoomScreen using testID
    const onRoom = await page
      .locator(`[data-testid="${TESTIDS.roomScreenRoot}"]`)
      .isVisible()
      .catch(() => false);
    if (onRoom) {
      // This is a more complex case - for now just return and let the caller handle
      // The test might need to leave the room explicitly
      return;
    }

    // Check if home is truly ready (no transient states)
    if (await isHomeReady(page)) {
      return;
    }

    // Try back button anyway
    const backBtn = page.locator('[data-testid="config-back-button"]');
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      // Wait for back button to disappear (screen transition)
      await backBtn.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      continue;
    }

    // Poll cadence for retry loop
    await page.waitForTimeout(300);
  }

  // Final check - use ensureHomeReady which handles transient states
  await ensureHomeReady(page);
}

/**
 * Extract room number from room screen header.
 * Assumes we're on a room screen.
 */
export async function extractRoomCode(page: Page): Promise<string> {
  const headerLocator = page.locator(`[data-testid="${TESTIDS.roomHeader}"]`);
  await expect(headerLocator).toBeVisible({ timeout: 15_000 });
  const headerText = await headerLocator.textContent();
  // Match "房间 XXXX" pattern - room number follows "房间 " text
  const match = headerText?.match(/房间\s*(\d{4})/);
  if (!match) throw new Error(`Could not extract room number from: ${headerText}`);
  return match[1]!;
}

/**
 * Enter a room code using the NumPad component.
 * Call this after the join room dialog is visible.
 *
 * @param page - Playwright Page
 * @param roomCode - 4-digit room code string
 */
export async function enterRoomCodeViaNumPad(page: Page, roomCode: string): Promise<void> {
  // Clear any existing input first
  const clearBtn = page.locator('[data-testid="numpad-clear"]');
  if (
    await clearBtn
      .waitFor({ state: 'visible', timeout: 500 })
      .then(() => true)
      .catch(() => false)
  ) {
    await clearBtn.click();
  }

  // Press each digit
  for (const digit of roomCode) {
    const btn = page.locator(`[data-testid="numpad-${digit}"]`);
    await expect(btn).toBeVisible({ timeout: 2000 });
    await btn.click();
  }
}
