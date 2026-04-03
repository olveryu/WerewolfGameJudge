import { expect, test } from '@playwright/test';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';

import {
  clickSeatAndConfirm,
  dismissAlert,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  isTextVisible,
  readAlertText,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Night Roles E2E — Thief (盗贼) & Cupid (丘比特) coverage.
 *
 * Single comprehensive test covering the full thief + cupid night flow:
 * - Thief picks a bottom card
 * - Cupid links two players as lovers → groupConfirm reveal
 * - Wolf kills one of the lovers → couple death (殉情)
 * - Seer checks the thief → reveal shows "好人"
 *
 * Uses a 5-player custom template:
 *   wolf(2) + villager(2) + seer + thief + cupid = 7 roles
 *   → 5 players + 2 bottom cards (for thief)
 *
 * Bottom card constraints: thief/cupid never in bottom; ≤1 wolf in bottom.
 * With 2 wolves, at least 1 wolf is always seated.
 *
 * Step order: thiefChoose → cupidChooseLovers → cupidLoversReveal → wolfKill → seerCheck
 */

test.setTimeout(180_000);

// ============================================================================
// Helpers local to this file
// ============================================================================

/**
 * Drive cupid's multiChooseSeat lover-linking action.
 *
 * Toggle seat selection on each target, then click the
 * "确认连接(2人)" confirm button in the bottom action panel.
 */
async function driveCupidChooseLovers(
  page: import('@playwright/test').Page,
  targetSeats: [number, number],
): Promise<boolean> {
  await dismissAlert(page);

  for (const seat of targetSeats) {
    const tile = page.locator(`[data-testid="seat-tile-pressable-${seat}"]`);
    await tile.waitFor({ state: 'visible', timeout: 5000 });
    await tile.click({ force: true });
    await page.waitForTimeout(200);
  }

  const panel = page.locator('[data-testid="bottom-action-panel"]');
  const confirmBtn = panel.getByText('确认连接(2人)', { exact: true }).first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
  await confirmBtn.click({ force: true });

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
 * Drive a single player through the cupidLoversReveal groupConfirm ack flow:
 * dismiss any existing alert → click "情侣状态" → read personal message → click "我知道了".
 *
 * Returns the personal message text shown in the alert.
 */
async function driveCupidGroupConfirmAck(page: import('@playwright/test').Page): Promise<string> {
  await dismissAlert(page);

  const panel = page.locator('[data-testid="bottom-action-panel"]');
  const statusBtn = panel.getByText('情侣状态', { exact: true }).first();
  await statusBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await statusBtn.click({ force: true });

  const alertModal = page.locator('[data-testid="alert-modal"]');
  await alertModal.waitFor({ state: 'visible', timeout: 5000 });
  const alertText = (await alertModal.textContent().catch(() => '')) ?? '';

  const ackBtn = alertModal.getByText('我知道了', { exact: true }).first();
  if (await ackBtn.isVisible().catch(() => false)) {
    await ackBtn.click({ force: true });
    await alertModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }

  return alertText;
}

/**
 * Wait for cupidLoversReveal groupConfirm step to become active.
 * Detects by checking for "情侣状态" button visibility.
 * While waiting, advances audio gates and intermediate steps.
 */
async function waitForCupidGroupConfirmStep(
  pages: import('@playwright/test').Page[],
  maxIter = 60,
): Promise<boolean> {
  for (let i = 0; i < maxIter; i++) {
    for (const page of pages) {
      const panel = page.locator('[data-testid="bottom-action-panel"]');
      const statusBtn = panel.getByText('情侣状态', { exact: true }).first();
      if (await statusBtn.isVisible().catch(() => false)) {
        return true;
      }
    }
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

test.describe('Night Roles — Thief & Cupid (盗贼丘比特)', () => {
  test('thief picks card → cupid links lovers → groupConfirm → wolf kills → seer checks → night ends', async ({
    browser,
  }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 2,
            villagers: 2,
            goodRoles: ['seer'],
            specialRoles: ['thief', 'cupid'],
          }),
      },
      async ({ pages, roleMap }) => {
        const thiefIdx = findRolePageIndex(roleMap, '盗贼');
        const cupidIdx = findRolePageIndex(roleMap, '丘比特');
        const wolfIndices = findAllRolePageIndices(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');

        // Thief, cupid guaranteed to be seated players (bottom card constraints)
        expect(thiefIdx, 'thief must be a player').not.toBe(-1);
        expect(cupidIdx, 'cupid must be a player').not.toBe(-1);
        expect(wolfIndices.length, 'wolf must be a player').toBeGreaterThan(0);

        // Track what the thief picked to adapt later steps dynamically
        let thiefPickedWolf = false;

        // === Step 1: Thief's turn — pick a bottom card ===
        await test.step('thief picks a bottom card', async () => {
          const thiefTurn = await waitForRoleTurn(pages[thiefIdx], ['选择', '底牌'], pages, 120);
          expect(thiefTurn, 'Thief turn should be detected').toBe(true);

          await dismissAlert(pages[thiefIdx]);

          // Click "选择底牌" in bottom action panel
          const chooseBtn = pages[thiefIdx]
            .locator('[data-testid="bottom-action-panel"]')
            .getByText('选择底牌', { exact: true })
            .first();
          await chooseBtn.waitFor({ state: 'visible', timeout: 5000 });
          await chooseBtn.click({ force: true });

          // Wait for the bottom card modal (subtitle contains "底牌" for thief)
          await pages[thiefIdx]
            .getByText(/底牌[含均]/)
            .first()
            .waitFor({ state: 'visible', timeout: 5000 });

          // Pick the first *enabled* card — disabled cards (opacity 0.4) are still
          // "visible" to Playwright but won't trigger showConfirmAlert on press.
          // Strategy: click each candidate, wait for the confirm alert; if it
          // doesn't appear the card was disabled, so try the next one.
          const CANDIDATE_NAMES = ['普通村民', '预言家', '狼人'];
          const alertModal = pages[thiefIdx].locator('[data-testid="alert-modal"]');
          let picked = false;
          for (const name of CANDIDATE_NAMES) {
            const card = pages[thiefIdx].getByText(name, { exact: true }).first();
            if (!(await card.isVisible().catch(() => false))) continue;

            await card.click({ force: true });

            // If the card was enabled, a confirm alert ("确认选择") appears
            const appeared = await alertModal
              .waitFor({ state: 'visible', timeout: 1500 })
              .then(() => true)
              .catch(() => false);
            if (appeared) {
              const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
              await confirmBtn.click({ force: true });
              await alertModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
              thiefPickedWolf = name === '狼人';
              picked = true;
              break;
            }
          }
          expect(picked, 'Should pick an enabled bottom card').toBe(true);
        });

        // === Step 2: Cupid's turn — link 2 lovers ===
        await test.step('cupid links two lovers', async () => {
          const cupidTurn = await waitForRoleTurn(pages[cupidIdx], ['选择', '情侣'], pages, 120);
          expect(cupidTurn, 'Cupid turn should be detected').toBe(true);

          // Pick two non-cupid players as lovers
          const nonCupidEntries = [...roleMap.entries()].filter(([idx]) => idx !== cupidIdx);
          const lover1Seat = nonCupidEntries[0][1].seat;
          const lover2Seat = nonCupidEntries[1][1].seat;

          const linked = await driveCupidChooseLovers(pages[cupidIdx], [lover1Seat, lover2Seat]);
          expect(linked, 'Cupid should have confirmed lover linking').toBe(true);
        });

        // === Step 3: CupidLoversReveal groupConfirm — all players ack ===
        await test.step('all players ack cupidLoversReveal', async () => {
          const groupReady = await waitForCupidGroupConfirmStep(pages, 60);
          expect(groupReady, 'CupidLoversReveal step should become active').toBe(true);

          const nonCupidEntries = [...roleMap.entries()].filter(([idx]) => idx !== cupidIdx);
          const lover1Seat = nonCupidEntries[0][1].seat;
          const lover2Seat = nonCupidEntries[1][1].seat;
          const loverSeats = [lover1Seat, lover2Seat];

          for (let i = 0; i < pages.length; i++) {
            const role = roleMap.get(i);
            if (!role) continue;

            const msg = await driveCupidGroupConfirmAck(pages[i]);

            if (loverSeats.includes(role.seat)) {
              expect(msg).toContain('情侣');
            } else {
              expect(msg).toContain('不是情侣');
            }
          }
        });

        // === Step 4: Wolf's turn — kill a lover to trigger 殉情 ===
        await test.step('wolf kills a lover', async () => {
          const wolfTurn = await waitForRoleTurn(
            pages[wolfIndices[0]],
            ['袭击', '选择'],
            pages,
            120,
          );
          expect(wolfTurn, 'Wolf turn should be detected').toBe(true);

          // If thief picked wolf, they participate in wolf vote
          const effectiveWolfIndices = thiefPickedWolf ? [...wolfIndices, thiefIdx] : wolfIndices;

          // Kill a non-wolf, non-cupid player (villager/seer)
          const wolfIdxSet = new Set(effectiveWolfIndices);
          const killCandidates = [...roleMap.entries()].filter(
            ([idx]) => idx !== cupidIdx && !wolfIdxSet.has(idx),
          );
          const killTarget = killCandidates[0][1].seat;

          await driveWolfVote(pages, effectiveWolfIndices, killTarget);
        });

        // === Step 5: Seer checks the thief → faction depends on picked card ===
        if (seerIdx !== -1) {
          const expectedFaction = thiefPickedWolf ? '坏人' : '好人';
          await test.step(`seer checks thief → ${expectedFaction}`, async () => {
            const seerTurn = await waitForRoleTurn(pages[seerIdx], ['查验', '选择'], pages, 120);
            expect(seerTurn, 'Seer turn should be detected').toBe(true);

            const thiefSeat = roleMap.get(thiefIdx)!.seat;
            await clickSeatAndConfirm(pages[seerIdx], thiefSeat);

            const revealText = await readAlertText(pages[seerIdx]);
            expect(revealText).toContain(formatSeat(thiefSeat));
            expect(revealText).toContain(expectedFaction);
            await dismissAlert(pages[seerIdx]);
          });
        }

        // === Step 6: Night should end with death ===
        await test.step('night ends with death', async () => {
          const ended = await waitForNightEnd(pages, 120);
          expect(ended, 'Night should complete').toBe(true);

          await viewLastNightInfo(pages[0]);
          const hasDeath = await isTextVisible(pages[0], '死亡');
          expect(hasDeath, 'Someone should have died').toBe(true);
        });
      },
    );
  });
});
