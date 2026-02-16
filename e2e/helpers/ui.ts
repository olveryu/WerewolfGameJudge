import * as path from 'node:path';

import { Locator, Page } from '@playwright/test';

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
 * Get the E2E base URL from environment.
 *
 * Single source of truth: process.env.E2E_BASE_URL (set by run-e2e-web.mjs)
 * REQUIRED: E2E_BASE_URL must be set. Throws if not set (fail-fast, never silent fallback).
 */
function getBaseURL(): string {
  const envBaseURL = process.env.E2E_BASE_URL;
  if (!envBaseURL) {
    throw new Error(
      '[gotoWithRetry] E2E_BASE_URL not set. ' +
        'Run via `pnpm run e2e:core` or set E2E_BASE_URL explicitly. ' +
        'No hardcoded fallback allowed.',
    );
  }
  return envBaseURL;
}

/**
 * Health probe result for evidence-based logging
 */
type HealthProbeResult = {
  ready: boolean;
  category: 'ok' | 'refused' | 'timeout' | 'dns' | 'unknown';
  message: string;
};

/**
 * Probe server readiness using Playwright's request API (same network stack as page.goto).
 *
 * IMPORTANT: We probe /favicon.ico (static asset) instead of / (root) because:
 * - Root may trigger heavy first-compile or redirects on Expo web cold start
 * - favicon.ico is a small static file, fast to respond if server is up
 * - TODO: Replace with /health endpoint when app provides one
 *
 * @param page - Playwright Page (uses page.request for consistent network stack)
 * @param baseURL - Base URL to probe
 * @param timeoutMs - Timeout for the probe (default 10s, Expo cold start can be slow)
 */
async function probeServerHealth(
  page: Page,
  baseURL: string,
  timeoutMs: number = 10000,
): Promise<HealthProbeResult> {
  // Probe favicon.ico - small static file, fast if server is up
  // TODO: Replace with /health endpoint when app provides one
  const probeURL = `${baseURL}/favicon.ico`;

  try {
    const response = await page.request.get(probeURL, { timeout: timeoutMs });
    // Any HTTP response means server is ready (even 404 is fine - server responded)
    return { ready: true, category: 'ok', message: `HTTP ${response.status()}` };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    const msg = error.message;

    // Categorize error for evidence-based logging
    if (msg.includes('ECONNREFUSED') || msg.includes('ERR_CONNECTION_REFUSED')) {
      return { ready: false, category: 'refused', message: msg };
    }

    if (msg.includes('Timeout') || error.name === 'TimeoutError') {
      return { ready: false, category: 'timeout', message: msg };
    }

    if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      return { ready: false, category: 'dns', message: msg };
    }

    // Unknown error - treat as not ready (never assume success)
    return { ready: false, category: 'unknown', message: `[${error.name}] ${msg}` };
  }
}

/** Log detailed info about a navigation failure */
/** Collect evidence on final failure (screenshot for trace attachment) */
async function collectNavigationFailureEvidence(page: Page): Promise<void> {
  await screenshotOnFail(page, 'goto-refused');
}

/**
 * Navigate to a URL with automatic retry on connection errors.
 *
 * TRUE MITIGATION: Before each navigation attempt, we verify the server is
 * actually responding to HTTP requests (not just port-reachable) using
 * Playwright's request API (same network stack as page.goto).
 *
 * Handles net::ERR_CONNECTION_REFUSED by:
 * 1. Probing server with HTTP GET to /favicon.ico until it responds
 * 2. Only then attempting page.goto()
 * 3. Using exponential backoff for retries
 *
 * EVIDENCE ON FAILURE (grep-friendly categories):
 * - `REFUSED`: Connection refused - server not listening
 * - `TIMEOUT`: Server slow to respond (cold start/compile)
 * - `DNS`: DNS resolution failed
 * - `UNKNOWN`: Other network error
 * - Screenshot: saved to test-results/fail-goto-refused-*.png
 * - Final error message contains ERR_CONNECTION_REFUSED signature for grep
 *
 * @param page - Playwright Page
 * @param url - URL to navigate to (or '/' for baseURL)
 * @param opts - Retry and timeout options
 */
export async function gotoWithRetry(
  page: Page,
  url: string = '/',
  opts: {
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    probeTimeoutMs?: number;
  } = {},
): Promise<void> {
  const {
    maxRetries = 5,
    retryDelayMs = 2000,
    timeoutMs = 30000,
    probeTimeoutMs = 10000, // 10s for cold start scenarios
  } = opts;
  let lastError: Error | undefined;
  let lastProbeResult: HealthProbeResult | undefined;
  const baseURL = getBaseURL();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const isLastAttempt = attempt === maxRetries;

    // Exponential backoff: 2s, 4s, 8s, 16s (capped)
    const backoffMs = Math.min(retryDelayMs * Math.pow(2, attempt - 1), 16000);

    // Step 1: Probe server health using Playwright's request API
    const probeResult = await probeServerHealth(page, baseURL, probeTimeoutMs);
    lastProbeResult = probeResult;

    if (!probeResult.ready) {
      lastError = new Error(`Server at ${baseURL} health probe failed: ${probeResult.message}`);

      // Timeout/unknown are "maybe slow" - don't burn retries too fast
      if (!isLastAttempt) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
      continue;
    }

    // Step 2: Server is up, attempt navigation
    const navResult = await attemptNavigation(page, url, timeoutMs);
    if (navResult.success) {
      return;
    }

    lastError = navResult.error!;

    if (navResult.isRefused && !isLastAttempt) {
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }

    // Non-retryable error (not connection refused) - fail immediately
    if (!navResult.isRefused) {
      break;
    }
  }

  // Failed after all attempts - collect evidence
  await collectNavigationFailureEvidence(page);

  // Include last probe result category for grep-friendly evidence
  const probeInfo = lastProbeResult ? ` [probe: ${lastProbeResult.category}]` : '';
  const finalMessage = `[gotoWithRetry] ${CONNECTION_REFUSED_SIGNATURE}: Failed to navigate to ${url} after ${maxRetries} attempts.${probeInfo} ${lastError?.message || 'Unknown error'}`;
  throw new Error(finalMessage);
}

/** Attempt a single navigation, return structured result */
async function attemptNavigation(
  page: Page,
  url: string,
  timeoutMs: number,
): Promise<{ success: boolean; error?: Error; isRefused: boolean }> {
  try {
    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    return { success: true, isRefused: false };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    const isRefused =
      error.message.includes('ERR_CONNECTION_REFUSED') || error.message.includes('ECONNREFUSED');
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
  opts: { exact?: boolean; timeout?: number } = {},
): Promise<boolean> {
  const { exact = false, timeout = 500 } = opts;

  try {
    const locator = typeof target === 'string' ? page.getByText(target, { exact }) : target;

    const isVisible = await locator
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
    if (isVisible) {
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
    return screenshotPath;
  } catch {
    return null;
  }
}
