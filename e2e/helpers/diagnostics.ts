import type { Page } from '@playwright/test';

/**
 * Shared diagnostic helpers for E2E.
 *
 * NOTE: This intentionally uses console.* because it's E2E-only tooling.
 */

/** Prefixes to filter from console logs */
export const LOG_PREFIXES = [
  // Legacy prefixes (for compatibility)
  '[useGameRoom]',
  '[GameStateService]',
  '[SeatService]',
  '[RoomService]',
  '[BroadcastService]',
  '[AudioService]',
  '[NightFlowController]',
  // legacy-style prefixes (some code still prints bracketed tags)
  '[GameFacade]',
  '[facade]',
  // react-native-logs extensions
  'Host',
  'Player',
  'NightFlow',
  'Broadcast',
  'Audio',
  'Auth',
  'Room',
  'GameRoom',
  'Config',
  'RoomScreen',
  'Home',
  'Facade',
  'GameStore',
] as const;

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
 * @param page - Playwright Page instance
 * @param label - Label for log lines
 * @param opts - Options: `quiet` suppresses real-time console.log to reduce output volume
 */
export function setupDiagnostics(
  page: Page,
  label: string,
  opts?: { quiet?: boolean },
): DiagnosticData {
  const data: DiagnosticData = {
    consoleLogs: [],
    pageErrors: [],
    failedRequests: [],
    errorResponses: [],
  };
  const quiet = opts?.quiet ?? false;

  // Filter console logs by prefix
  page.on('console', (msg) => {
    const text = msg.text();
    if (LOG_PREFIXES.some((p) => text.includes(p))) {
      const logLine = `[${label}] ${text}`;
      data.consoleLogs.push(logLine);
      // In quiet mode, only print errors/warnings; skip verbose broadcast/state logs
      if (!quiet) {
        console.log('[PW console]', logLine);
      }
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

/**
 * Print diagnostic summary
 */
export function printDiagnosticSummary(label: string, data: DiagnosticData): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DIAGNOSTIC SUMMARY: ${label}`);
  console.log('='.repeat(60));

  console.log(`\n--- Console Logs (${data.consoleLogs.length}) ---`);
  data.consoleLogs.forEach((log) => console.log(log));

  if (data.pageErrors.length > 0) {
    console.log(`\n--- Page Errors (${data.pageErrors.length}) ---`);
    data.pageErrors.forEach((err) => console.log(err));
  }

  if (data.failedRequests.length > 0) {
    console.log(`\n--- Failed Requests (${data.failedRequests.length}) ---`);
    data.failedRequests.forEach((req) => console.log(req));
  }

  if (data.errorResponses.length > 0) {
    console.log(`\n--- Error Responses (${data.errorResponses.length}) ---`);
    data.errorResponses.forEach((resp) => console.log(resp));
  }

  console.log('='.repeat(60) + '\n');
}
