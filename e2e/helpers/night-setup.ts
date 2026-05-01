import type { Browser, Page } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { type ConfigPage } from '../pages/ConfigPage';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from './multi-player';

/**
 * Shared setup/teardown harness for night-role E2E specs.
 *
 * Creates an N-player game via `setupNPlayerGameWithRoles`, runs the test
 * body, then unconditionally closes all browser contexts. Each call creates
 * an independent room — tests using this helper are fully isolated.
 */
export async function withSetup(
  browser: Browser,
  opts: {
    playerCount: number;
    configure: (config: ConfigPage) => Promise<void>;
  },
  body: (ctx: {
    setup: GameSetupWithRolesResult;
    pages: Page[];
    roleMap: GameSetupWithRolesResult['roleMap'];
  }) => Promise<void>,
): Promise<void> {
  let setup: GameSetupWithRolesResult | undefined;
  try {
    setup = await setupNPlayerGameWithRoles(browser, {
      playerCount: opts.playerCount,
      configureTemplate: opts.configure,
    });
    await body({
      setup,
      pages: setup.fixture.pages,
      roleMap: setup.roleMap,
    });
  } finally {
    if (setup) await closeAll(setup.fixture);
  }
}
