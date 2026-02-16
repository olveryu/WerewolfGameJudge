import type { Page } from '@playwright/test';

/**
 * Shared diagnostic helpers for E2E.
 *
 * Follows Playwright community pattern: browser console is NOT forwarded
 * by default. Only errors (`pageerror`, failed requests, 4xx/5xx responses)
 * and explicit `[DIAG]` logs are printed. For full console output, use
 * Playwright trace / artifacts instead.
 *
 * NOTE: This intentionally uses console.* because it's E2E-only tooling.
 */

/** Collected diagnostic data */
export interface DiagnosticData {
  consoleLogs: string[];
  pageErrors: string[];
  failedRequests: string[];
  errorResponses: string[];
}

/**
 * Setup diagnostic listeners on a page.
 * Returns a DiagnosticData object that accumulates data.
 *
 * Only forwards `[DIAG]` console messages and `error`-level logs.
 * All other browser console output is silently collected but not printed.
 * Use Playwright trace viewer for full debugging.
 *
 * @param page - Playwright Page instance
 * @param label - Label for log lines
 */
export function setupDiagnostics(page: Page, label: string): DiagnosticData {
  const data: DiagnosticData = {
    consoleLogs: [],
    pageErrors: [],
    failedRequests: [],
    errorResponses: [],
  };

  // Only forward [DIAG] and error-level console messages
  page.on('console', (msg) => {
    const text = msg.text();
    const logLine = `[${label}] ${text}`;
    data.consoleLogs.push(logLine);

    if (text.includes('[DIAG]') || msg.type() === 'error') {
      console.log('[PW console]', logLine);
    }
  });

  // Capture page errors
  page.on('pageerror', (err) => {
    const errLine = `[${label}] PageError: ${err.message}`;
    data.pageErrors.push(errLine);
    console.error('[PW pageerror]', errLine);
  });

  // Capture failed requests
  page.on('requestfailed', (req) => {
    const failLine = `[${label}] RequestFailed: ${req.url()} - ${req.failure()?.errorText}`;
    data.failedRequests.push(failLine);
    console.error('[PW requestfailed]', failLine);
  });

  // Capture 4xx/5xx responses
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      const errLine = `[${label}] HTTP ${resp.status()}: ${resp.url()}`;
      data.errorResponses.push(errLine);
      console.warn('[PW response]', errLine);
    }
  });

  return data;
}
