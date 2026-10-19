import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test as base,
} from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { type DiagnosticData, setupDiagnostics } from '../helpers/diagnostics';
import { ensureAnonLogin, registerAutoDismissers, waitForAppReady } from '../helpers/home';
import { gotoWithRetry } from '../helpers/ui';
import { waitForRoomScreenReady } from '../helpers/waits';

/**
 * App fixture: ensures a single logged-in page ready on the home screen.
 *
 * Eliminates the repeated gotoWithRetry → waitForAppReady → ensureAnonLogin
 * boilerplate from every spec.
 */
interface AppFixture {
  /** Page that is logged in and on the home screen. */
  page: Page;
  /** Diagnostic data collector attached to the page. */
  diag: DiagnosticData;
}

/**
 * Multi-player fixture: N isolated browser contexts, each logged in.
 */
export interface MultiPlayerFixture {
  /** All pages (index 0 = host). */
  pages: [Page, ...Page[]];
  /** Diagnostic data per page. */
  diags: DiagnosticData[];
  /** Contexts for cleanup. */
  contexts: BrowserContext[];
}

export interface ColdRoomFixture {
  readonly page: Page;
  readonly diag: DiagnosticData;
  readonly context: BrowserContext;
}

/**
 * Default timeouts for manually created contexts. Contexts created via
 * browser.newContext() do NOT inherit the playwright.config `use` block,
 * so without this every action without an explicit timeout runs with
 * timeout 0 — no timeout at all. One such click once blocked a night
 * spec for four minutes until the test-level timeout killed it, with
 * the game healthy on every page. The navigation default is pinned
 * separately so capping actions does not shorten page loads.
 */
const DEFAULT_ACTION_TIMEOUT_MS = 10_000;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;

export function applyContextTimeouts(context: BrowserContext): void {
  context.setDefaultTimeout(DEFAULT_ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(DEFAULT_NAVIGATION_TIMEOUT_MS);
}

export const test = base.extend<{
  app: AppFixture;
}>({
  app: async ({ page }, use) => {
    await registerAutoDismissers(page);
    await gotoWithRetry(page, '/');
    await waitForAppReady(page);
    await ensureAnonLogin(page);
    const diag = setupDiagnostics(page, 'default');
    await use({ page, diag });
  },
});

/**
 * Create N isolated player contexts, each logged in and on the home screen.
 *
 * @param browser - Playwright Browser instance
 * @param count - Number of players (first = host)
 * @returns MultiPlayerFixture with pages, diags, contexts
 */
export async function createPlayerContexts(
  browser: Browser,
  count: number,
): Promise<MultiPlayerFixture> {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  const diags: DiagnosticData[] = [];

  for (let i = 0; i < count; i++) {
    const ctx = await browser.newContext();
    applyContextTimeouts(ctx);
    const page = await ctx.newPage();
    const label = i === 0 ? 'HOST' : `JOINER-${i + 1}`;

    await registerAutoDismissers(page);
    await gotoWithRetry(page, '/');
    await waitForAppReady(page);
    await ensureAnonLogin(page);

    contexts.push(ctx);
    pages.push(page);
    diags.push(setupDiagnostics(page, label));
  }

  return { pages: pages as [Page, ...Page[]], diags, contexts };
}

/** Open a room URL in a brand-new context before any Home navigation or authentication. */
export async function createColdRoomContext(
  browser: Browser,
  roomCode: string,
): Promise<ColdRoomFixture> {
  const context = await browser.newContext();
  applyContextTimeouts(context);
  const page = await context.newPage();
  const diag = setupDiagnostics(page, 'COLD-DEEP-LINK');
  try {
    await registerAutoDismissers(page);
    await page.goto(`/room/${roomCode}`);
    const anonymousLogin = page.getByTestId(TESTIDS.homeAnonLoginButton);
    await expect(anonymousLogin).toBeVisible({ timeout: 15_000 });
    await anonymousLogin.click();
    await waitForRoomScreenReady(page, { role: 'joiner' });
    return { page, diag, context };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/**
 * Close all contexts in a MultiPlayerFixture. Safe to call in finally blocks.
 */
export async function closeAll(fixture: MultiPlayerFixture): Promise<void> {
  for (const ctx of fixture.contexts) {
    await ctx.close();
  }
}

export { expect } from '@playwright/test';
