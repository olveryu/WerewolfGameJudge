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
    // Always capture [DIAG] logs for debugging; also capture known prefixes
    const isDiag = text.includes('[DIAG]');
    if (isDiag || LOG_PREFIXES.some((p) => text.includes(p))) {
      const logLine = `[${label}] ${text}`;
      data.consoleLogs.push(logLine);
      // [DIAG] logs always print; others only in non-quiet mode
      if (isDiag || !quiet) {
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
