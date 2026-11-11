import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { readAlertText } from '../helpers/alerts';
import {
  chooseFirstEnabledBottomCard,
  clickNightButton,
  clickSeatAndConfirm,
  clickSeatAndReadNotice,
  dismissAlert,
  driveGroupConfirmAck,
  driveMultiSelect,
  driveWolfDisabledEmptyVote,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  viewLastNightInfo,
  waitForGroupConfirmStep,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Werewolf Night E2E — Special roles: bottom cards & lovers.
 *
 * - TreasureMaster picks a bottom card (unchosen-card steps auto-skip)
 * - Thief picks a bottom card; Cupid links two lovers (groupConfirm
 *   reveal) and a wolf kill on a lover triggers the lover death chain
 *
 * Formerly night-roles-treasure.spec.ts and
 * night-roles-thief-cupid.spec.ts.
 */

test.setTimeout(180_000);
/**
 * Night Roles E2E — TreasureMaster (Treasure Master)
 *
 * Verifies the treasureMaster bottom-card selection flow and subsequent
 * unchosen-bottom-card step auto-skip. Uses a 4-player template:
 *
 *   wolf(2) + villager(2) + seer + poisoner + treasureMaster = 7 roles
 *   → 4 players + 3 bottom cards
 *
 * Bottom card constraints guarantee TM and at least 1 wolf are always players.
 * Night step order: treasureMasterChoose → wolfKill → poisonerPoison → seerCheck.
 */

test.describe('Werewolf Night — Special Roles: TreasureMaster', () => {
  // --------------------------------------------------------------------------
  // TreasureMaster picks a card → night completes
  // --------------------------------------------------------------------------
  test('treasureMaster picks bottom card → night completes', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 2,
            villagers: 2,
            goodRoles: ['seer', 'poisoner'],
            specialRoles: ['treasureMaster'],
          }),
      },
      async ({ pages, roleMap }) => {
        const tmIdx = findRolePageIndex(roleMap, '盗宝大师');
        const wolfIndices = findAllRolePageIndices(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const poisonerIdx = findRolePageIndex(roleMap, '毒师');

        // TM and wolf are guaranteed to be players (bottom card constraints)
        expect(tmIdx, 'treasureMaster must be a player').not.toBe(-1);
        expect(wolfIndices.length, 'wolf must be a player').toBeGreaterThan(0);

        // === Step 1: TreasureMaster's turn — pick a bottom card ===
        await test.step('TreasureMaster turn should be detected', () =>
          waitForRoleTurn(pages[tmIdx]!, 'treasureMasterChoose', pages));

        // Dismiss the "盗宝大师行动" info alert
        await dismissAlert(pages[tmIdx]!);

        // Click "选择底牌" button in bottom action panel
        await clickNightButton(pages[tmIdx]!, 'chooseCard', '选择底牌');

        await chooseFirstEnabledBottomCard(pages[tmIdx]!);

        // === Step 2: Wolf's turn — forced empty kill (poisoner in template) ===
        // All wolf players must confirm the empty kill.
        await test.step('Wolf turn should be detected', () =>
          waitForRoleTurn(pages[wolfIndices[0]!]!, 'wolfKill', pages));

        await driveWolfDisabledEmptyVote(pages, wolfIndices);

        // === Step 3: Poisoner & Seer (if they are players, not bottom cards) ===
        if (poisonerIdx !== -1) {
          await waitForRoleTurn(pages[poisonerIdx]!, 'poisonerPoison', pages, 60_000);
          await dismissAlert(pages[poisonerIdx]!);
          await clickNightButton(pages[poisonerIdx]!, 'skip', '不用技能');
          await dismissAlert(pages[poisonerIdx]!);
        }
        if (seerIdx !== -1) {
          await waitForRoleTurn(pages[seerIdx]!, 'seerCheck', pages, 60_000);
          await dismissAlert(pages[seerIdx]!);
          await clickNightButton(pages[seerIdx]!, 'skip', '不用技能');
          await dismissAlert(pages[seerIdx]!);
        }

        // === Step 4: Night should end ===
        await test.step('Night should complete with treasureMaster', () => waitForNightEnd(pages));
      },
    );
  });
});

/**
 * Night Roles E2E — Thief & Cupid coverage.
 *
 * Single comprehensive test covering the full thief + cupid night flow:
 * - Thief picks a bottom card
 * - Cupid links two players as lovers → groupConfirm reveal
 * - Wolf kills one of the lovers → couple death (lover suicide)
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

test.describe('Werewolf Night — Special Roles: Thief & Cupid', () => {
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
          await test.step('Thief turn should be detected', () =>
            waitForRoleTurn(pages[thiefIdx]!, 'thiefChoose', pages));

          await dismissAlert(pages[thiefIdx]!);

          // Click "选择底牌" in bottom action panel
          await clickNightButton(pages[thiefIdx]!, 'chooseCard', '选择底牌');

          const selectedCard = await chooseFirstEnabledBottomCard(pages[thiefIdx]!);
          thiefPickedWolf = selectedCard === '狼人';
        });

        // === Step 2: Cupid's turn — link 2 lovers ===
        await test.step('cupid links two lovers', async () => {
          await test.step('Cupid turn should be detected', () =>
            waitForRoleTurn(pages[cupidIdx]!, 'cupidChooseLovers', pages));

          // Pick two non-cupid players as lovers
          const nonCupidEntries = [...roleMap.entries()].filter(([idx]) => idx !== cupidIdx);
          const lover1Seat = nonCupidEntries[0]![1].seat;
          const lover2Seat = nonCupidEntries[1]![1].seat;

          await driveMultiSelect(pages[cupidIdx]!, [lover1Seat, lover2Seat], '确认连接（2人）');
        });

        // === Step 3: CupidLoversReveal groupConfirm — all players ack ===
        await test.step('all players ack cupidLoversReveal', async () => {
          await test.step('CupidLoversReveal step should become active', () =>
            waitForGroupConfirmStep(pages, '情侣状态', 60));

          const nonCupidEntries = [...roleMap.entries()].filter(([idx]) => idx !== cupidIdx);
          const lover1Seat = nonCupidEntries[0]![1].seat;
          const lover2Seat = nonCupidEntries[1]![1].seat;
          const loverSeats = [lover1Seat, lover2Seat];

          for (let i = 0; i < pages.length; i++) {
            const role = roleMap.get(i);
            if (!role) continue;

            const msg = await driveGroupConfirmAck(pages[i]!, '情侣状态', '我知道了');

            if (loverSeats.includes(role.seat)) {
              expect(msg).toContain('情侣');
            } else {
              expect(msg).toContain('不是情侣');
            }
          }
        });

        // === Step 4: Wolf's turn — kill a lover to trigger lover suicide ===
        await test.step('wolf kills a lover', async () => {
          await test.step('Wolf turn should be detected', () =>
            waitForRoleTurn(pages[wolfIndices[0]!]!, 'wolfKill', pages));

          // If thief picked wolf, they participate in wolf vote
          const effectiveWolfIndices = thiefPickedWolf ? [...wolfIndices, thiefIdx] : wolfIndices;

          // Kill a non-wolf, non-cupid player (villager/seer)
          const wolfIdxSet = new Set(effectiveWolfIndices);
          const killCandidates = [...roleMap.entries()].filter(
            ([idx]) => idx !== cupidIdx && !wolfIdxSet.has(idx),
          );
          const killTarget = killCandidates[0]![1].seat;

          await driveWolfVote(pages, effectiveWolfIndices, killTarget);
        });

        // === Step 5: Seer checks the thief → faction depends on picked card ===
        if (seerIdx !== -1) {
          const expectedFaction = thiefPickedWolf ? '狼人' : '好人';
          await test.step(`seer checks thief → ${expectedFaction}`, async () => {
            await test.step('Seer turn should be detected', () =>
              waitForRoleTurn(pages[seerIdx]!, 'seerCheck', pages));

            const thiefSeat = roleMap.get(thiefIdx)!.seat;
            await clickSeatAndConfirm(pages[seerIdx]!, thiefSeat);

            const revealText = await readAlertText(pages[seerIdx]!);
            expect(revealText).toContain(formatSeat(thiefSeat));
            expect(revealText).toContain(expectedFaction);
            await dismissAlert(pages[seerIdx]!);
          });
        }

        // === Step 6: Night should end with death ===
        await test.step('night ends with death', async () => {
          await test.step('Night should complete', () => waitForNightEnd(pages));

          const nightInfo = await viewLastNightInfo(pages[0]!);
          expect(nightInfo, 'Someone should have died').toContain('昨夜死亡');
        });
      },
    );
  });
});

// ============================================================================
// Poisoner override feedback (wolfkill-override fix)
// ============================================================================

/**
 * Poisoner board: the wolf step is kill-disabled by the poisoner override.
 *
 * - Tapping a seat shows the kill-disabled hint as a dismiss alert
 *   (no "确定袭击" confirm dialog, no vote submitted).
 * - After every wolf confirms the empty vote, the 5-second settle
 *   countdown stays visible in the bottom action panel.
 * - The night then completes through the poisoner and seer steps.
 *
 * Uses a 6-player template with no bottom cards so every role is seated:
 *   wolf(2) + villager(2) + seer + poisoner = 6 roles.
 */

test.describe('Werewolf Night — Special Roles: Poisoner Override Feedback', () => {
  test('seat tap shows kill-disabled hint → empty votes show settle countdown → night completes', async ({
    browser,
  }) => {
    await withSetup(
      browser,
      {
        playerCount: 6,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 2,
            villagers: 2,
            goodRoles: ['seer', 'poisoner'],
            specialRoles: [],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIndices = findAllRolePageIndices(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const poisonerIdx = findRolePageIndex(roleMap, '毒师');
        expect(wolfIndices.length, 'both wolves must be players').toBe(2);
        expect(seerIdx, 'seer must be a player').not.toBe(-1);
        expect(poisonerIdx, 'poisoner must be a player').not.toBe(-1);

        const wolfSet = new Set(wolfIndices);
        const targetSeat = [...roleMap.entries()].find(([idx]) => !wolfSet.has(idx))![1].seat;

        // === Step 1: Wolf's turn — seat tap shows the hint, not a confirm ===
        await test.step('seat tap shows the kill-disabled hint', async () => {
          await test.step('Wolf turn should be detected', () =>
            waitForRoleTurn(pages[wolfIndices[0]!]!, 'wolfKill', pages));

          const wolfPage = pages[wolfIndices[0]!]!;
          const alertText = await clickSeatAndReadNotice(wolfPage, targetSeat, '首夜无法袭击');
          expect(alertText).toContain('本局有毒师在场，首夜无法袭击');
          expect(alertText).not.toContain('确定袭击');
          await expect(wolfPage.getByTestId(TESTIDS.alertButton(0))).toHaveText('知道了');
          await expect(wolfPage.getByTestId(TESTIDS.alertButton(1))).toHaveCount(0);
          await dismissAlert(wolfPage);
        });

        // === Step 2: All wolves confirm the empty vote → countdown visible ===
        await test.step('settle countdown stays visible after all empty votes', async () => {
          await driveWolfDisabledEmptyVote(pages, wolfIndices);

          await expect(
            pages[wolfIndices[0]!]!.getByTestId(TESTIDS.actionMessage),
            'Settle countdown should be visible after all empty votes',
          ).toContainText('秒后确认', { timeout: 4_500 });
        });

        // === Step 3: Poisoner & Seer skip their skills ===
        if (poisonerIdx !== -1) {
          await waitForRoleTurn(pages[poisonerIdx]!, 'poisonerPoison', pages, 60_000);
          await dismissAlert(pages[poisonerIdx]!);
          await clickNightButton(pages[poisonerIdx]!, 'skip', '不用技能');
          await dismissAlert(pages[poisonerIdx]!);
        }
        if (seerIdx !== -1) {
          await waitForRoleTurn(pages[seerIdx]!, 'seerCheck', pages, 60_000);
          await dismissAlert(pages[seerIdx]!);
          await clickNightButton(pages[seerIdx]!, 'skip', '不用技能');
          await dismissAlert(pages[seerIdx]!);
        }

        // === Step 4: Night should end ===
        await test.step('Night should complete with the poisoner override', () =>
          waitForNightEnd(pages));
      },
    );
  });
});
