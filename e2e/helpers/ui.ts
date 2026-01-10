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

/**
 * Navigate to a URL with automatic retry on connection errors.
 * 
 * Handles net::ERR_CONNECTION_REFUSED by waiting and retrying.
 * Collects evidence (screenshot + logs) on persistent failure.
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
  const { maxRetries = 3, retryDelayMs = 2000, timeoutMs = 30000 } = opts;
  let lastError: Error | undefined;
  
  // Get baseURL from page context for logging
  const baseURL = page.context().browser()?.version() ? 'http://localhost:8081' : 'unknown';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
      console.log(`[gotoWithRetry] Navigation successful on attempt ${attempt}`);
      return;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isConnectionRefused = lastError.message.includes('ERR_CONNECTION_REFUSED') ||
                                   lastError.message.includes('ECONNREFUSED');
      
      // Detailed logging for each attempt
      console.log(`[gotoWithRetry] Attempt ${attempt}/${maxRetries} failed`);
      console.log(`  URL: ${url}`);
      console.log(`  baseURL: ${baseURL}`);
      console.log(`  page.url(): ${page.url()}`);
      console.log(`  Error: ${lastError.message}`);
      
      if (isConnectionRefused) {
        console.log(`  Signature: ${CONNECTION_REFUSED_SIGNATURE}`);
      }

      if (isConnectionRefused && attempt < maxRetries) {
        // Retry delay with clear justification
        console.log(`[gotoWithRetry] Server not ready, waiting ${retryDelayMs}ms before retry...`);
        console.log(`  (Reason: webServer may still be starting - this is expected on cold start)`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        continue;
      }

      // Last attempt or non-recoverable error - collect evidence
      if (attempt === maxRetries) {
        console.log(`\n[gotoWithRetry] ❌ FAILED after ${maxRetries} attempts - collecting evidence...`);
        
        // Screenshot
        const screenshotPath = await screenshotOnFail(page, 'goto-refused');
        console.log(`  Screenshot: ${screenshotPath || 'failed to capture'}`);
        
        // Debug probe
        await debugProbe(page, 'goto-refused');
        
        // Diagnostic hints
        console.log('\n[gotoWithRetry] Diagnostic hints:');
        console.log('  1. Is dev server running? Run: npx expo start --web --port 8081');
        console.log('  2. Port conflict? Run: lsof -i :8081');
        console.log('  3. Check Playwright webServer logs above (stdout/stderr piped)');
        console.log('  4. Try: pkill -f "expo" && npm run e2e:core');
      }
    }
  }

  // Throw with grep-friendly signature
  const finalMessage = `[gotoWithRetry] ${CONNECTION_REFUSED_SIGNATURE}: Failed to navigate to ${url} after ${maxRetries} attempts. ${lastError?.message || 'Unknown error'}`;
  throw new Error(finalMessage);
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
