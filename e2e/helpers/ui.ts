import { Page, Locator, expect } from '@playwright/test';
import * as path from 'node:path';

/**
 * UI Helpers (通用原语层，纯工具)
 * 
 * Generic UI interaction primitives for Playwright tests.
 * These are low-level utilities with no app-specific logic.
 * 
 * NOTE: This is the CANONICAL location for all generic UI utilities.
 * Domain helpers (home.ts, waits.ts) import from here.
 */

// =============================================================================
// Navigation Helpers
// =============================================================================

/** Signature for connection refused errors (grep-friendly) */
const CONNECTION_REFUSED_SIGNATURE = 'ERR_CONNECTION_REFUSED';

/** Default fallback for E2E_BASE_URL (only used if env not set) */
const DEFAULT_BASE_URL_FALLBACK = 'http://localhost:8081';

/**
 * Get the E2E base URL from environment.
 * 
 * Single source of truth: process.env.E2E_BASE_URL (set by run-e2e-web.mjs)
 * Logs warning if falling back to default (never silent).
 */
function getBaseURL(): string {
  const envBaseURL = process.env.E2E_BASE_URL;
  if (envBaseURL) {
    return envBaseURL;
  }
  console.log(`[gotoWithRetry] E2E_BASE_URL not set, fallback to ${DEFAULT_BASE_URL_FALLBACK}`);
  return DEFAULT_BASE_URL_FALLBACK;
}

/**
 * Check if the server is ready by making an HTTP GET request.
 * Returns true if we get any HTTP response (even 4xx/5xx means server is up).
 * Returns false if connection is refused.
 */
async function isServerReady(baseURL: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(baseURL, { 
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    // Any HTTP response means server is ready (even 404 is fine)
    console.log(`[isServerReady] Server responded with HTTP ${response.status}`);
    return true;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    // Connection refused = not ready
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('fetch failed') ||
        error.name === 'AbortError') {
      return false;
    }
    // Other errors (e.g., DNS) - treat as ready to fail fast
    console.log(`[isServerReady] Unexpected error: ${error.message}`);
    return true;
  }
}

/** Log detailed info about a navigation failure */
function logNavigationFailure(
  attempt: number,
  maxRetries: number,
  url: string,
  baseURL: string,
  pageUrl: string,
  error: Error,
  isConnectionRefused: boolean
): void {
  console.log(`[gotoWithRetry] Attempt ${attempt}/${maxRetries} navigation failed`);
  console.log(`  URL: ${url}`);
  console.log(`  baseURL: ${baseURL}`);
  console.log(`  page.url(): ${pageUrl}`);
  console.log(`  Error: ${error.message}`);
  if (isConnectionRefused) {
    console.log(`  Signature: ${CONNECTION_REFUSED_SIGNATURE}`);
  }
}

/** Collect evidence and log diagnostic hints on final failure */
async function collectNavigationFailureEvidence(
  page: Page,
  maxRetries: number
): Promise<void> {
  console.log(`\n[gotoWithRetry] ❌ FAILED after ${maxRetries} attempts - collecting evidence...`);
  
  const screenshotPath = await screenshotOnFail(page, 'goto-refused');
  console.log(`  Screenshot: ${screenshotPath || 'failed to capture'}`);
  
  await debugProbe(page, 'goto-refused');
  
  console.log('\n[gotoWithRetry] Diagnostic hints:');
  console.log('  1. Is dev server running? Run: npx expo start --web --port 8081');
  console.log('  2. Port conflict? Run: lsof -i :8081');
  console.log('  3. Check Playwright webServer logs above (stdout/stderr piped)');
  console.log('  4. Try: pkill -f "expo" && npm run e2e:core');
}

/**
 * Navigate to a URL with automatic retry on connection errors.
 * 
 * TRUE MITIGATION: Before each navigation attempt, we verify the server is 
 * actually responding to HTTP requests (not just port-reachable).
 * 
 * Handles net::ERR_CONNECTION_REFUSED by:
 * 1. Polling server with HTTP GET until it responds
 * 2. Only then attempting page.goto()
 * 
 * EVIDENCE ON FAILURE:
 * - Logs: attempt number, baseURL, current page.url(), error message
 * - Screenshot: saved to test-results/fail-goto-refused-*.png
 * - Debug probe: page state dump
 * - Final error message contains ERR_CONNECTION_REFUSED signature for grep
 * 
 * @param page - Playwright Page
 * @param url - URL to navigate to (or '/' for baseURL)
 * @param opts - Retry and timeout options
 */
export async function gotoWithRetry(
  page: Page,
  url: string = '/',
  opts: { maxRetries?: number; retryDelayMs?: number; timeoutMs?: number } = {}
): Promise<void> {
  const { maxRetries = 5, retryDelayMs = 2000, timeoutMs = 30000 } = opts;
  let lastError: Error | undefined;
  const baseURL = getBaseURL();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const isLastAttempt = attempt === maxRetries;
    
    // Step 1: Wait for server to be ready (HTTP health check)
    const serverUp = await isServerReady(baseURL);
    if (!serverUp) {
      console.log(`[gotoWithRetry] Attempt ${attempt}/${maxRetries}: Server not ready`);
      lastError = new Error(`Server at ${baseURL} did not respond to HTTP health check`);
      if (!isLastAttempt) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
      continue;
    }

    // Step 2: Server is up, attempt navigation
    const navResult = await attemptNavigation(page, url, timeoutMs);
    if (navResult.success) {
      console.log(`[gotoWithRetry] Navigation successful on attempt ${attempt}`);
      return;
    }
    
    lastError = navResult.error!;
    logNavigationFailure(attempt, maxRetries, url, baseURL, page.url(), lastError, navResult.isRefused);
    
    if (navResult.isRefused && !isLastAttempt) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      continue;
    }
    
    // Non-retryable error (not connection refused) - fail immediately
    if (!navResult.isRefused) {
      break;
    }
  }

  // Failed after all attempts - collect evidence
  await collectNavigationFailureEvidence(page, maxRetries);
  
  const finalMessage = `[gotoWithRetry] ${CONNECTION_REFUSED_SIGNATURE}: Failed to navigate to ${url} after ${maxRetries} attempts. ${lastError?.message || 'Unknown error'}`;
  throw new Error(finalMessage);
}

/** Attempt a single navigation, return structured result */
async function attemptNavigation(
  page: Page,
  url: string,
  timeoutMs: number
): Promise<{ success: boolean; error?: Error; isRefused: boolean }> {
  try {
    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    return { success: true, isRefused: false };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    const isRefused = error.message.includes('ERR_CONNECTION_REFUSED') ||
                      error.message.includes('ECONNREFUSED');
    return { success: false, error, isRefused };
  }
}

// =============================================================================
// Visibility Helpers
// =============================================================================

/**
 * Helper to get a visible element on the current screen.
 *
 * React Navigation on Web keeps previous screens in the DOM with aria-hidden="true".
 * When navigating to the same screen type (e.g., Home -> Config -> Room -> Config),
 * there can be multiple elements matching the same selector.
 */
export function getVisibleText(page: Page, text: string) {
  return page.locator(`text="${text}" >> visible=true`);
}

/**
 * Wait for any of the given locators/texts to be visible.
 * Returns the index of the first one that becomes visible.
 * 
 * @param page - Playwright Page
 * @param targets - Array of locators or text strings
 * @param opts - Timeout and polling options
 * @returns Index of the first visible target
 */
export async function waitForAnyVisible(
  page: Page,
  targets: (Locator | string)[],
  opts: { timeoutMs?: number; pollMs?: number } = {}
): Promise<number> {
  const { timeoutMs = 10000, pollMs = 200 } = opts;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const locator = typeof target === 'string' ? page.getByText(target) : target;
      const isVisible = await locator.isVisible({ timeout: 50 }).catch(() => false);
      if (isVisible) {
        return i;
      }
    }
    await page.waitForTimeout(pollMs);
  }

  throw new Error(`[waitForAnyVisible] None of ${targets.length} targets became visible within ${timeoutMs}ms`);
}

/**
 * Wait for all of the given locators/texts to be visible.
 * 
 * @param page - Playwright Page
 * @param targets - Array of locators or text strings
 * @param opts - Timeout options
 */
export async function waitForAllVisible(
  page: Page,
  targets: (Locator | string)[],
  opts: { timeoutMs?: number } = {}
): Promise<void> {
  const { timeoutMs = 10000 } = opts;
  
  await Promise.all(
    targets.map(target => {
      const locator = typeof target === 'string' ? page.getByText(target) : target;
      return expect(locator).toBeVisible({ timeout: timeoutMs });
    })
  );
}

// =============================================================================
// Click Helpers
// =============================================================================

/**
 * Click on a locator or text if it's visible.
 * Does NOT throw if not visible - just returns false.
 * 
 * @param page - Playwright Page
 * @param target - Locator or text string
 * @param opts - Options for matching and timeout
 * @returns true if clicked, false if not visible
 */
export async function clickIfVisible(
  page: Page,
  target: Locator | string,
  opts: { exact?: boolean; timeout?: number } = {}
): Promise<boolean> {
  const { exact = false, timeout = 500 } = opts;
  
  try {
    const locator = typeof target === 'string' 
      ? page.getByText(target, { exact })
      : target;
    
    if (await locator.isVisible({ timeout })) {
      await locator.first().click({ timeout: 1000 });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// =============================================================================
// Wait Helpers
// =============================================================================

/**
 * Wait for a text or regex pattern to disappear from the page.
 * 
 * @param page - Playwright Page
 * @param textOrRegex - Text string or regex pattern to wait for disappearance
 * @param opts - Timeout options
 */
export async function waitForTextGone(
  page: Page,
  textOrRegex: string | RegExp,
  opts: { timeoutMs?: number } = {}
): Promise<void> {
  const { timeoutMs = 10000 } = opts;
  
  const locator = page.getByText(textOrRegex);
  
  await locator.waitFor({ state: 'hidden', timeout: timeoutMs });
}

// =============================================================================
// Retry Helpers
// =============================================================================

/**
 * Retry a function with exponential backoff.
 * 
 * @param fn - Async function to retry
 * @param opts - Retry options
 */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; backoffMs?: number; label?: string } = {}
): Promise<T> {
  const { retries = 3, backoffMs = 500, label = 'retry' } = opts;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.log(`[${label}] Attempt ${attempt}/${retries} failed: ${lastError.message}`);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, backoffMs * attempt));
      }
    }
  }

  throw lastError;
}

// =============================================================================
// Evidence Helpers
// =============================================================================

/**
 * Take a screenshot and save to test-results for debugging.
 * Never throws - safe to call in catch blocks.
 * 
 * @param page - Playwright Page
 * @param label - Label for the screenshot filename
 * @returns Path to screenshot if successful, null otherwise
 */
export async function screenshotOnFail(page: Page, label: string): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const safeName = label.replaceAll(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    const screenshotPath = path.join('test-results', `fail-${safeName}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`[screenshotOnFail] Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  } catch (e) {
    console.log(`[screenshotOnFail] Failed to take screenshot: ${e}`);
    return null;
  }
}

/**
 * Collect page state for debugging.
 * Useful to call when a test step fails.
 * 
 * @param page - Playwright Page
 * @param label - Label for debug output
 */
export async function debugProbe(page: Page, label: string): Promise<void> {
  console.log(`\n========== DEBUG PROBE: ${label} ==========`);
  console.log(`URL: ${page.url()}`);

  const checks = [
    { name: '房间号', selector: /房间 \d{4}/ },
    { name: '创建房间', selector: '创建房间' },
    { name: '进入房间', selector: '进入房间' },
    { name: '准备看牌', selector: '准备看牌' },
    { name: '查看身份', selector: '查看身份' },
    { name: '开始游戏', selector: '开始游戏' },
    { name: '重新开始', selector: '重新开始' },
    { name: '重试', selector: '重试' },
    { name: '确定', selector: '确定' },
  ];

  for (const check of checks) {
    try {
      const locator = typeof check.selector === 'string'
        ? page.getByText(check.selector, { exact: true })
        : page.getByText(check.selector);
      const visible = await locator.isVisible({ timeout: 100 }).catch(() => false);
      if (visible) console.log(`  ✓ ${check.name}`);
    } catch {
      // ignore
    }
  }

  try {
    const bodyText = await page.locator('body').textContent({ timeout: 1000 });
    console.log(`Body (first 500 chars): ${bodyText?.substring(0, 500)}`);
  } catch (e) {
    console.log(`Body text error: ${e}`);
  }
  console.log(`========== END PROBE ==========\n`);
}

/**
 * Wrap a step with fail-fast diagnostics and timeout.
 * On failure, takes screenshot and runs debug probe.
 * 
 * @param name - Step name for logging
 * @param page - Playwright Page
 * @param fn - Async function to execute
 * @param timeoutMs - Maximum time for the step (default 60s)
 */
export async function withStep<T>(
  name: string,
  page: Page,
  fn: () => Promise<T>,
  timeoutMs = 60000
): Promise<T> {
  console.log(`>> STEP: ${name}`);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Step "${name}" timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } catch (error) {
    await debugProbe(page, name);
    await screenshotOnFail(page, name);
    throw error;
  }
}
