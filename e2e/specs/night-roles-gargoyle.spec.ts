import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
import {
  clickSeatAndConfirm,
  dismissAlert,
  driveWolfVote,
  findRolePageIndex,
  isTextVisible,
  tryClickAdvanceButton,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { ConfigPage } from '../pages/ConfigPage';

/**
 * Night Roles E2E — Awakened Gargoyle (觉醒石像鬼) coverage.
 *
 * Tests chooseSeat convert and groupConfirm reveal:
 * - Gargoyle converts adjacent non-wolf → all players ack → night ends
 * - Verify personal messages: converted player sees "转化为狼人阵营", others see "未被转化"
 *
 * The awakened gargoyle is a wolf role with mandatory convert (canSkip: false).
 * Night step order: wolfKill → awakenedGargoyleConvert → awakenedGargoyleConvertReveal → ...
 * Does not modify game state directly or import services/models.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

// ============================================================================
// Helpers local to this file
// ============================================================================

async function withSetup(
  browser: import('@playwright/test').Browser,
  opts: {
    playerCount: number;
    configure: (config: ConfigPage) => Promise<void>;
  },
  body: (ctx: {
    setup: GameSetupWithRolesResult;
    pages: import('@playwright/test').Page[];
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

/**
 * Drive a single player through the groupConfirm ack flow for convert reveal:
 * dismiss any existing alert → click "转化状态" → read personal message alert → click "我知道了".
 *
 * Returns the personal message text shown in the alert.
 */
async function driveConvertRevealAck(page: import('@playwright/test').Page): Promise<string> {
  // Dismiss any existing alert (e.g. action prompt)
  await dismissAlert(page);

  // Click "转化状态" button in bottom panel
  const panel = page.locator('[data-testid="bottom-action-panel"]');
  const statusBtn = panel.getByText('转化状态', { exact: true }).first();
  await statusBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await statusBtn.click({ force: true });

  // Read the personal message alert
  const alertModal = page.locator('[data-testid="alert-modal"]');
  await alertModal.waitFor({ state: 'visible', timeout: 5000 });
  const alertText = (await alertModal.textContent().catch(() => '')) ?? '';

  // Click "我知道了" to ack
  const ackBtn = alertModal.getByText('我知道了', { exact: true }).first();
  if (await ackBtn.isVisible().catch(() => false)) {
    await ackBtn.click({ force: true });
    await alertModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }

  return alertText;
}

/**
 * Wait for awakenedGargoyleConvertReveal groupConfirm step to be active.
 * Detects by checking for "转化状态" button visibility.
 * While waiting, advances audio gates and other intermediate steps.
 */
async function waitForConvertRevealStep(
  pages: import('@playwright/test').Page[],
  maxIter = 120,
): Promise<boolean> {
  for (let i = 0; i < maxIter; i++) {
    // Check if any page shows the "转化状态" button
    for (const page of pages) {
      const panel = page.locator('[data-testid="bottom-action-panel"]');
      const statusBtn = panel.getByText('转化状态', { exact: true }).first();
      if (await statusBtn.isVisible().catch(() => false)) {
        return true;
      }
    }
    // Advance any intermediate alerts/buttons on all pages (alert modal + bottom action panel)
    for (const page of pages) {
      await tryClickAdvanceButton(page);
    }
    await pages[0].waitForTimeout(300);
  }
  return false;
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Night Roles — Awakened Gargoyle (觉醒石像鬼)', () => {
  // --------------------------------------------------------------------------
  // Gargoyle converts adjacent villager → all ack → night ends with death
  // --------------------------------------------------------------------------
  test('gargoyle converts villager → groupConfirm reveals → night ends', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 0,
            villagers: 2,
            wolfRoles: ['awakenedGargoyle'],
          }),
      },
      async ({ pages, roleMap }) => {
        const gargoyleIdx = findRolePageIndex(roleMap, '觉醒石像鬼');
        expect(gargoyleIdx).not.toBe(-1);

        // Find villager seats (non-gargoyle players)
        const villagerEntries = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        expect(villagerEntries.length).toBe(2);

        const killTargetSeat = villagerEntries[0][1].seat;
        const convertTargetSeat = villagerEntries[1][1].seat;

        // === Wolf (gargoyle) kills villager ===
        await test.step('gargoyle kills villager via wolf vote', async () => {
          const wolfTurn = await waitForRoleTurn(pages[gargoyleIdx], ['猎杀', '选择'], pages, 120);
          expect(wolfTurn, 'Wolf turn should be detected').toBe(true);
          await driveWolfVote(pages, [gargoyleIdx], killTargetSeat);
        });

        // === Gargoyle converts adjacent non-wolf villager ===
        await test.step('gargoyle converts villager', async () => {
          const gargoyleTurn = await waitForRoleTurn(pages[gargoyleIdx], ['转化'], pages, 120);
          expect(gargoyleTurn, 'Gargoyle convert turn should be detected').toBe(true);
          const confirmed = await clickSeatAndConfirm(pages[gargoyleIdx], convertTargetSeat);
          expect(confirmed, 'Gargoyle should have confirmed convert').toBe(true);
        });

        // === GroupConfirm: all players ack convert reveal ===
        await test.step('all players ack convert reveal', async () => {
          const groupReady = await waitForConvertRevealStep(pages, 60);
          expect(groupReady, 'ConvertReveal step should become active').toBe(true);

          for (let i = 0; i < pages.length; i++) {
            const role = roleMap.get(i);
            if (!role) continue;

            const msg = await driveConvertRevealAck(pages[i]);

            if (role.seat === convertTargetSeat) {
              // Converted player sees conversion message
              expect(msg).toContain('转化为狼人阵营');
            } else {
              // Everyone else (including gargoyle) sees "未被转化"
              expect(msg).toContain('未被转化');
            }
          }
        });

        // === Night ends ===
        await test.step('night ends with death', async () => {
          const ended = await waitForNightEnd(pages, 120);
          expect(ended, 'Night should have ended').toBe(true);

          await viewLastNightInfo(pages[0]);
          const hasDeath = await isTextVisible(pages[0], '死亡');
          expect(hasDeath, 'Killed villager should have died').toBe(true);
        });
      },
    );
  });

  // --------------------------------------------------------------------------
  // Verify correct personal messages for all players
  // --------------------------------------------------------------------------
  test('converted player sees 转化 message, others see 未被转化', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            wolfRoles: ['awakenedGargoyle'],
          }),
      },
      async ({ pages, roleMap }) => {
        const gargoyleIdx = findRolePageIndex(roleMap, '觉醒石像鬼');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(gargoyleIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Find villager entries
        const villagerEntries = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        expect(villagerEntries.length).toBe(2);

        const killTargetSeat = villagerEntries[0][1].seat;
        // Pick the other villager for conversion — must be adjacent to wolf faction
        // With circular seating, in a 4-player game all seats are within 2 hops,
        // but AdjacentToWolfFaction requires direct adjacency. Pick a villager
        // adjacent to gargoyle or wolf.
        const gargoyleSeat = roleMap.get(gargoyleIdx)!.seat;
        const wolfSeat = roleMap.get(wolfIdx)!.seat;

        // Find a villager adjacent to any wolf-faction player
        const convertCandidate = villagerEntries.find(([, info]) => {
          const seat = info.seat;
          const totalPlayers = 4;
          for (const wolfFactionSeat of [gargoyleSeat, wolfSeat]) {
            const diff = Math.abs(seat - wolfFactionSeat);
            if (diff === 1 || diff === totalPlayers - 1) return true;
          }
          return false;
        });
        expect(convertCandidate, 'Should find an adjacent villager to convert').toBeDefined();
        const convertTargetSeat = convertCandidate![1].seat;

        // === Wolves kill villager ===
        await test.step('wolves kill villager', async () => {
          const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
          expect(wolfTurn).toBe(true);
          // Both wolf-faction players participate in wolf meeting
          await driveWolfVote(pages, [wolfIdx, gargoyleIdx], killTargetSeat);
        });

        // === Gargoyle converts ===
        await test.step('gargoyle converts adjacent villager', async () => {
          const gargoyleTurn = await waitForRoleTurn(pages[gargoyleIdx], ['转化'], pages, 120);
          expect(gargoyleTurn).toBe(true);
          const confirmed = await clickSeatAndConfirm(pages[gargoyleIdx], convertTargetSeat);
          expect(confirmed).toBe(true);
        });

        // === GroupConfirm: verify exact messages ===
        await test.step('verify personal messages for all players', async () => {
          const groupReady = await waitForConvertRevealStep(pages, 60);
          expect(groupReady).toBe(true);

          const messages: string[] = [];
          for (let i = 0; i < pages.length; i++) {
            const msg = await driveConvertRevealAck(pages[i]);
            messages.push(msg);

            const role = roleMap.get(i);
            if (!role) continue;

            if (role.seat === convertTargetSeat) {
              expect(msg).toContain('转化为狼人阵营');
              expect(msg).not.toContain('未被转化');
            } else {
              expect(msg).toContain('未被转化');
              expect(msg).not.toContain('转化为狼人阵营');
            }
          }
        });

        // === Night ends ===
        await test.step('night ends', async () => {
          const ended = await waitForNightEnd(pages, 120);
          expect(ended).toBe(true);
        });
      },
    );
  });
});
