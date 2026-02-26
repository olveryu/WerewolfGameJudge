import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
import {
  clickBottomButton,
  dismissAlert,
  driveWolfVote,
  findRolePageIndex,
  isTextVisible,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { ConfigPage } from '../pages/ConfigPage';

/**
 * Night Roles E2E — Piper (吹笛者) coverage.
 *
 * Tests multiChooseSeat hypnotize and groupConfirm reveal:
 * - Piper hypnotizes 1 target → all players confirm → night ends with death
 * - Piper hypnotizes 2 targets → verify reveal text for both hypnotized and non-hypnotized
 * - Piper skips → night ends normally
 *
 * Covers the first multiChooseSeat schema in E2E (no single-confirm alert;
 * seats toggle selection, then bottom-panel "确认催眠(N人)" submits).
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
 * Drive piper's multiChooseSeat hypnotize action.
 *
 * Unlike single chooseSeat (click seat → alert confirm), multiChooseSeat
 * toggles seat selection on click (no alert), then the player clicks the
 * bottom-panel "确认催眠(N人)" button to confirm.
 */
async function drivePiperHypnotize(
  page: import('@playwright/test').Page,
  targetSeats: number[],
): Promise<boolean> {
  // Dismiss any existing alert (e.g. "行动提示" action prompt)
  await dismissAlert(page);

  // Click each target seat to toggle selection
  for (const seat of targetSeats) {
    const tile = page.locator(`[data-testid="seat-tile-pressable-${seat}"]`);
    await tile.waitFor({ state: 'visible', timeout: 5000 });
    await tile.click({ force: true });
    // Brief wait for selection state to update
    await page.waitForTimeout(200);
  }

  // Click the confirm button: "确认催眠(N人)"
  const confirmLabel = `确认催眠(${targetSeats.length}人)`;
  const panel = page.locator('[data-testid="bottom-action-panel"]');
  const confirmBtn = panel.getByText(confirmLabel, { exact: true }).first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
  await confirmBtn.click({ force: true });

  // Wait for confirm alert ("确认催眠 / 确定要催眠选中的玩家吗？")
  const alertModal = page.locator('[data-testid="alert-modal"]');
  const appeared = await alertModal
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;

  const okBtn = alertModal.getByText('确定', { exact: true }).first();
  if (await okBtn.isVisible().catch(() => false)) {
    await okBtn.click({ force: true });
    await alertModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Drive a single player through the groupConfirm ack flow:
 * dismiss any existing alert → click "催眠状态" → read personal message alert → click "我知道了".
 *
 * Returns the personal message text shown in the alert.
 */
async function driveGroupConfirmAck(page: import('@playwright/test').Page): Promise<string> {
  // Dismiss any existing alert (e.g. piper's "行动提示" actionPrompt)
  await dismissAlert(page);

  // Click "催眠状态" button in bottom panel
  const panel = page.locator('[data-testid="bottom-action-panel"]');
  const statusBtn = panel.getByText('催眠状态', { exact: true }).first();
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
 * Wait for piperHypnotizedReveal groupConfirm step to be active on a page.
 * Detects by checking for "催眠状态" button visibility.
 * While waiting, advances audio gates and other intermediate steps.
 */
async function waitForGroupConfirmStep(
  pages: import('@playwright/test').Page[],
  maxIter = 60,
): Promise<boolean> {
  for (let i = 0; i < maxIter; i++) {
    // Check if any page shows the "催眠状态" button
    for (const page of pages) {
      const panel = page.locator('[data-testid="bottom-action-panel"]');
      const statusBtn = panel.getByText('催眠状态', { exact: true }).first();
      if (await statusBtn.isVisible().catch(() => false)) {
        return true;
      }
    }
    // Advance any intermediate alerts/buttons on all pages
    // (e.g. audio gate "知道了" / "确定" progress buttons)
    for (const page of pages) {
      const alertModal = page.locator('[data-testid="alert-modal"]');
      if (await alertModal.isVisible().catch(() => false)) {
        for (const text of ['知道了', '确定']) {
          const btn = alertModal.getByText(text, { exact: true }).first();
          if (await btn.isVisible().catch(() => false)) {
            await btn.click({ force: true });
            await alertModal.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
            break;
          }
        }
      }
    }
    await pages[0].waitForTimeout(300);
  }
  return false;
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Night Roles — Piper (吹笛者)', () => {
  // --------------------------------------------------------------------------
  // Piper hypnotizes 1 target → all ack → night ends with death
  // --------------------------------------------------------------------------
  test('piper hypnotizes 1 target → groupConfirm reveals → night ends', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            specialRoles: ['piper'],
          }),
      },
      async ({ pages, roleMap }) => {
        const piperIdx = findRolePageIndex(roleMap, '吹笛者');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const villagerIdx = findRolePageIndex(roleMap, '普通村民');
        expect(piperIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const villagerSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;

        // === Wolf kills villager ===
        await test.step('wolf kills villager', async () => {
          const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
          expect(wolfTurn, 'Wolf turn should be detected').toBe(true);
          await driveWolfVote(pages, [wolfIdx], villagerSeat);
        });

        // === Piper hypnotizes wolf ===
        const wolfSeat = roleMap.get(wolfIdx)!.seat;
        await test.step('piper hypnotizes wolf', async () => {
          const piperTurn = await waitForRoleTurn(pages[piperIdx], ['催眠', '选择'], pages, 120);
          expect(piperTurn, 'Piper turn should be detected').toBe(true);
          const hypnotized = await drivePiperHypnotize(pages[piperIdx], [wolfSeat]);
          expect(hypnotized, 'Piper should have confirmed hypnotize').toBe(true);
        });

        // === GroupConfirm: all players ack ===
        await test.step('all players ack groupConfirm', async () => {
          const groupReady = await waitForGroupConfirmStep(pages, 60);
          expect(groupReady, 'GroupConfirm step should become active').toBe(true);

          // Each player acks — check personal messages
          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const role = roleMap.get(i);
            if (!role) continue;

            const msg = await driveGroupConfirmAck(page);
            const seat = role.seat;

            if (seat === wolfSeat) {
              // Wolf was hypnotized → should see hypnotized message
              expect(msg).toContain('催眠');
            } else if (seat === roleMap.get(piperIdx)!.seat) {
              // Piper itself — not hypnotized (NotSelf constraint)
              expect(msg).toContain('未被催眠');
            }
          }
        });

        // === Night ends ===
        await test.step('night ends with death', async () => {
          const ended = await waitForNightEnd(pages, 120);
          expect(ended, 'Night should have ended').toBe(true);

          await viewLastNightInfo(pages[0]);
          const hasDeath = await isTextVisible(pages[0], '死亡');
          expect(hasDeath, 'Villager should have died').toBe(true);
        });
      },
    );
  });

  // --------------------------------------------------------------------------
  // Piper hypnotizes 2 targets → verify hypnotized & non-hypnotized text
  // --------------------------------------------------------------------------
  test('piper hypnotizes 2 targets → correct reveal messages', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            specialRoles: ['piper'],
          }),
      },
      async ({ pages, roleMap }) => {
        const piperIdx = findRolePageIndex(roleMap, '吹笛者');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(piperIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Find two non-piper targets to hypnotize
        const nonPiperEntries = [...roleMap.entries()].filter(([idx]) => idx !== piperIdx);
        const target1Seat = nonPiperEntries[0][1].seat;
        const target2Seat = nonPiperEntries[1][1].seat;

        // Pick a villager for wolf to kill
        const villagerEntry = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );
        const killTarget = villagerEntry ? villagerEntry[1].seat : 0;

        // === Wolf kills ===
        await test.step('wolf kills villager', async () => {
          const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
          expect(wolfTurn).toBe(true);
          await driveWolfVote(pages, [wolfIdx], killTarget);
        });

        // === Piper hypnotizes 2 targets ===
        await test.step('piper hypnotizes 2 targets', async () => {
          const piperTurn = await waitForRoleTurn(pages[piperIdx], ['催眠', '选择'], pages, 120);
          expect(piperTurn).toBe(true);
          const hypnotized = await drivePiperHypnotize(pages[piperIdx], [target1Seat, target2Seat]);
          expect(hypnotized, 'Piper should have confirmed hypnotize 2 targets').toBe(true);
        });

        // === GroupConfirm: verify messages ===
        await test.step('groupConfirm reveals correct messages', async () => {
          const groupReady = await waitForGroupConfirmStep(pages, 60);
          expect(groupReady).toBe(true);

          const hypnotizedSeats = [target1Seat, target2Seat];

          for (let i = 0; i < pages.length; i++) {
            const role = roleMap.get(i);
            if (!role) continue;

            const msg = await driveGroupConfirmAck(pages[i]);

            if (hypnotizedSeats.includes(role.seat)) {
              // Hypnotized player sees seat list
              expect(msg).toContain('催眠');
              expect(msg).toContain(`${target1Seat + 1}号`);
              expect(msg).toContain(`${target2Seat + 1}号`);
            } else {
              // Non-hypnotized (piper or other players)
              expect(msg).toContain('未被催眠');
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

  // --------------------------------------------------------------------------
  // Piper skips (不用技能) → night ends normally
  // --------------------------------------------------------------------------
  test('piper skips → night ends normally', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            specialRoles: ['piper'],
          }),
      },
      async ({ pages, roleMap }) => {
        const piperIdx = findRolePageIndex(roleMap, '吹笛者');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const villagerIdx = findRolePageIndex(roleMap, '普通村民');
        expect(piperIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const villagerSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;

        // === Wolf kills villager ===
        await test.step('wolf kills villager', async () => {
          const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
          expect(wolfTurn).toBe(true);
          await driveWolfVote(pages, [wolfIdx], villagerSeat);
        });

        // === Piper skips ===
        await test.step('piper skips with 不用技能', async () => {
          const piperTurn = await waitForRoleTurn(pages[piperIdx], ['催眠', '选择'], pages, 120);
          expect(piperTurn).toBe(true);
          // Dismiss action prompt alert first
          await dismissAlert(pages[piperIdx]);
          // Click "不用技能" skip button
          const skipped = await clickBottomButton(pages[piperIdx], '不用技能');
          expect(skipped, 'Should find 不用技能 button').toBe(true);

          // Confirm skip alert ("确认跳过" dialog with "确定" button)
          const alertModal = pages[piperIdx].locator('[data-testid="alert-modal"]');
          await alertModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
          await dismissAlert(pages[piperIdx]);
        });

        // === GroupConfirm: even when skipped, all ack (0 hypnotized) ===
        await test.step('all players ack groupConfirm (no one hypnotized)', async () => {
          const groupReady = await waitForGroupConfirmStep(pages, 60);
          expect(groupReady).toBe(true);

          for (let i = 0; i < pages.length; i++) {
            const msg = await driveGroupConfirmAck(pages[i]);
            // Everyone should see "未被催眠" since piper skipped
            expect(msg).toContain('未被催眠');
          }
        });

        // === Night ends with death ===
        await test.step('night ends with death', async () => {
          const ended = await waitForNightEnd(pages, 120);
          expect(ended).toBe(true);

          await viewLastNightInfo(pages[0]);
          const hasDeath = await isTextVisible(pages[0], '死亡');
          expect(hasDeath, 'Villager should have died').toBe(true);
        });
      },
    );
  });
});
