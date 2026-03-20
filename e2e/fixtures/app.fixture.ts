import { Browser, BrowserContext, Page, test as base } from '@playwright/test';

import { ALL_GUIDE_DISMISSED_KEYS } from '../../src/config/storageKeys';
import { DiagnosticData, setupDiagnostics } from '../helpers/diagnostics';
import { ensureAnonLogin, waitForAppReady } from '../helpers/home';
import { gotoWithRetry } from '../helpers/ui';

/**
 * Build Playwright `storageState` that pre-dismisses all page guide modals.
 * AsyncStorage on web = window.localStorage, so seeding these keys prevents
 * onboarding modals from appearing during E2E tests.
 */
function guideStorageState(origin: string) {
  return {
    cookies: [] as never[],
    origins: [
      {
        origin,
        localStorage: ALL_GUIDE_DISMISSED_KEYS.map((key) => ({ name: key, value: '1' })),
      },
    ],
  };
}

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
  pages: Page[];
  /** Diagnostic data per page. */
  diags: DiagnosticData[];
  /** Contexts for cleanup. */
  contexts: BrowserContext[];
}

export const test = base.extend<{
  app: AppFixture;
}>({
  app: async ({ page }, use) => {
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

  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8081';

  for (let i = 0; i < count; i++) {
    const ctx = await browser.newContext({
      storageState: guideStorageState(baseURL),
    });
    const page = await ctx.newPage();
    const label = i === 0 ? 'HOST' : `JOINER-${i + 1}`;

    await gotoWithRetry(page, '/');
    await waitForAppReady(page);
    await ensureAnonLogin(page);

    contexts.push(ctx);
    pages.push(page);
    diags.push(setupDiagnostics(page, label));
  }

  return { pages, diags, contexts };
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
