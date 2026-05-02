import { expect, test } from '@playwright/test';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';

import {
  clickBottomButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveWolfVote,
  findRolePageIndex,
  readAlertText,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Night Roles E2E — EclipseWolfQueen (蚀时狼妃) shelter redirect coverage.
 *
 * Tests eclipseWolfQueen's core mechanic:
 * - Banish a player → seer check redirects to caster (reveals 好人)
 * - Skip banish → normal night flow (seer sees 狼人)
 * - Banish a player → witch poison redirects to caster (witch dies)
 *
 * Template: 4p custom (eclipseWolfQueen + wolf + seer/witch + villager)
 * Covers UI assertions on seer reveal text and death outcomes.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Night Roles — EclipseWolfQueen Shelter Redirect', () => {
  // --------------------------------------------------------------------------
  // eclipseWolfQueen banishes wolf, seer checks banished wolf → 好人 (redirect)
  // --------------------------------------------------------------------------
  test('eclipseWolfQueen banishes wolf, seer checks banished target → redirect reveals 好人', async ({
    browser,
  }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['seer'],
            wolfRoles: ['eclipseWolfQueen'],
          }),
      },
      async ({ pages, roleMap }) => {
        const ewqIdx = findRolePageIndex(roleMap, '蚀时狼妃');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        expect(ewqIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);
        expect(villagerIdx).not.toBe(-1);

        const wolfSeat = roleMap.get(wolfIdx)!.seat;
        const villagerSeat = roleMap.get(villagerIdx)!.seat;

        await test.step('eclipseWolfQueen banishes the regular wolf', async () => {
          const ewqTurn = await waitForRoleTurn(pages[ewqIdx]!, ['放逐', '选择'], pages, 120);
          expect(ewqTurn, 'EclipseWolfQueen turn should be detected').toBe(true);
          await clickSeatAndConfirm(pages[ewqIdx]!, wolfSeat);
        });

        await test.step('wolves kill villager', async () => {
          const wolfTurn = await waitForRoleTurn(pages[ewqIdx]!, ['袭击', '选择'], pages, 120);
          expect(wolfTurn, 'Wolf vote turn should be detected').toBe(true);
          await driveWolfVote(pages, [ewqIdx, wolfIdx], villagerSeat);
        });

        await test.step('seer checks banished wolf → redirect reveals 好人', async () => {
          const seerTurn = await waitForRoleTurn(pages[seerIdx]!, ['查验', '选择'], pages, 120);
          expect(seerTurn, 'Seer turn should be detected').toBe(true);
          await clickSeatAndConfirm(pages[seerIdx]!, wolfSeat);

          // Redirect: seer checked the banished wolf, but the check is
          // redirected to the seer themselves → reveal should show 好人
          const revealText = await readAlertText(pages[seerIdx]!);
          expect(revealText).toContain('好人');
          await dismissAlert(pages[seerIdx]!);
        });

        await test.step('night ends', async () => {
          const ended = await waitForNightEnd(pages, 120);
          expect(ended, 'Night should end').toBe(true);
        });
      },
    );
  });

  // --------------------------------------------------------------------------
  // eclipseWolfQueen skips → seer checks wolf → 狼人 (no redirect)
  // --------------------------------------------------------------------------
  test('eclipseWolfQueen skips → seer checks wolf → reveals 狼人', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['seer'],
            wolfRoles: ['eclipseWolfQueen'],
          }),
      },
      async ({ pages, roleMap }) => {
        const ewqIdx = findRolePageIndex(roleMap, '蚀时狼妃');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        expect(ewqIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);
        expect(villagerIdx).not.toBe(-1);

        const wolfSeat = roleMap.get(wolfIdx)!.seat;
        const villagerSeat = roleMap.get(villagerIdx)!.seat;

        await test.step('eclipseWolfQueen skips banish', async () => {
          const ewqTurn = await waitForRoleTurn(pages[ewqIdx]!, ['放逐', '选择'], pages, 120);
          expect(ewqTurn, 'EclipseWolfQueen turn should be detected').toBe(true);
          await dismissAlert(pages[ewqIdx]!);
          await clickBottomButton(pages[ewqIdx]!, '不用技能');
          // Confirm skip if alert appears
          await dismissAlert(pages[ewqIdx]!);
        });

        await test.step('wolves kill villager', async () => {
          const wolfTurn = await waitForRoleTurn(pages[ewqIdx]!, ['袭击', '选择'], pages, 120);
          expect(wolfTurn, 'Wolf vote turn should be detected').toBe(true);
          await driveWolfVote(pages, [ewqIdx, wolfIdx], villagerSeat);
        });

        await test.step('seer checks wolf → reveals 狼人 (no redirect)', async () => {
          const seerTurn = await waitForRoleTurn(pages[seerIdx]!, ['查验', '选择'], pages, 120);
          expect(seerTurn, 'Seer turn should be detected').toBe(true);
          await clickSeatAndConfirm(pages[seerIdx]!, wolfSeat);

          // No redirect active → checking wolf shows 狼人
          const revealText = await readAlertText(pages[seerIdx]!);
          expect(revealText).toContain('狼人');
          await dismissAlert(pages[seerIdx]!);
        });

        await test.step('night ends with death', async () => {
          const ended = await waitForNightEnd(pages, 120);
          expect(ended, 'Night should end').toBe(true);

          // Villager was killed → should not be 平安夜
          await viewLastNightInfo(pages[0]!);
          const alertText = await readAlertText(pages[0]!);
          expect(alertText).not.toContain('平安夜');
        });
      },
    );
  });

  // --------------------------------------------------------------------------
  // eclipseWolfQueen banishes villager, witch poisons banished → poison bounces to witch
  // --------------------------------------------------------------------------
  test('eclipseWolfQueen banishes villager, witch poisons banished target → witch dies', async ({
    browser,
  }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['witch'],
            wolfRoles: ['eclipseWolfQueen'],
          }),
      },
      async ({ pages, roleMap }) => {
        const ewqIdx = findRolePageIndex(roleMap, '蚀时狼妃');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        expect(ewqIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);
        expect(villagerIdx).not.toBe(-1);

        const villagerSeat = roleMap.get(villagerIdx)!.seat;
        const wolfSeat = roleMap.get(wolfIdx)!.seat;
        const witchSeat = roleMap.get(witchIdx)!.seat;

        await test.step('eclipseWolfQueen banishes the villager', async () => {
          const ewqTurn = await waitForRoleTurn(pages[ewqIdx]!, ['放逐', '选择'], pages, 120);
          expect(ewqTurn, 'EclipseWolfQueen turn should be detected').toBe(true);
          await clickSeatAndConfirm(pages[ewqIdx]!, villagerSeat);
        });

        await test.step('wolves self-knife', async () => {
          const wolfTurn = await waitForRoleTurn(pages[ewqIdx]!, ['袭击', '选择'], pages, 120);
          expect(wolfTurn, 'Wolf vote turn should be detected').toBe(true);
          await driveWolfVote(pages, [ewqIdx, wolfIdx], wolfSeat);
        });

        await test.step('witch poisons banished villager → redirects to witch', async () => {
          const witchTurn = await waitForRoleTurn(
            pages[witchIdx]!,
            ['被狼人袭击', '解药', '毒药'],
            pages,
            120,
          );
          expect(witchTurn, 'Witch turn should be detected').toBe(true);

          // Dismiss the witch info alert, then poison the banished villager
          await dismissAlert(pages[witchIdx]!);
          await clickSeatAndConfirm(pages[witchIdx]!, villagerSeat);
        });

        await test.step('night ends — wolf dies (self-knife), witch dies (redirected poison)', async () => {
          const ended = await waitForNightEnd(pages, 120);
          expect(ended, 'Night should end').toBe(true);

          await viewLastNightInfo(pages[0]!);
          const alertText = await readAlertText(pages[0]!);
          // Should NOT be 平安夜 — wolf + witch die
          expect(alertText).not.toContain('平安夜');
          // Assert specific seats died
          const wolfSeatDisplay = formatSeat(wolfSeat);
          const witchSeatDisplay = formatSeat(witchSeat);
          expect(alertText, `Wolf seat ${wolfSeatDisplay} should be in death list`).toContain(
            wolfSeatDisplay,
          );
          expect(alertText, `Witch seat ${witchSeatDisplay} should be in death list`).toContain(
            witchSeatDisplay,
          );
        });
      },
    );
  });
});
