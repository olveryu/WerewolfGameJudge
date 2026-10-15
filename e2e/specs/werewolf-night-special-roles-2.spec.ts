import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { expect, test } from '@playwright/test';

import {
  clickBottomButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  readAlertText,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Werewolf Night E2E — Special roles: redirect, disguise & curse.
 *
 * - EclipseWolfQueen banish shelter redirects seer checks and witch
 *   poison onto the caster
 * - HiddenWolf reveals as Good to the seer; Crow curses a target or
 *   skips the curse and the night completes
 *
 * Formerly night-roles-eclipse-wolf-queen.spec.ts and
 * night-roles-hidden-wolf-crow.spec.ts.
 */

test.setTimeout(180_000);
/**
 * Night Roles E2E - EclipseWolfQueen (Eclipse Wolf Queen) shelter redirect coverage.
 *
 * Tests eclipseWolfQueen's core mechanic:
 * - Banish a player -> seer check redirects to caster (reveals Good)
 * - Skip banish -> normal night flow (seer sees Wolf)
 * - Banish a player -> witch poison redirects to caster (witch dies)
 *
 * Template: 4p custom (eclipseWolfQueen + wolf + seer/witch + villager)
 * Covers UI assertions on seer reveal text and death outcomes.
 */

test.describe('Werewolf Night — Special Roles: Eclipse Wolf Queen Redirect', () => {
  // --------------------------------------------------------------------------
  // eclipseWolfQueen banishes wolf, seer checks banished wolf -> Good (redirect)
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
          const wolfTurn = await waitForRoleTurn(pages[ewqIdx]!, ['袭击'], pages, 120);
          expect(wolfTurn, 'Wolf vote turn should be detected').toBe(true);
          await driveWolfVote(pages, [ewqIdx, wolfIdx], villagerSeat);
        });

        await test.step('seer checks banished wolf → redirect reveals 好人', async () => {
          const seerTurn = await waitForRoleTurn(pages[seerIdx]!, ['查验', '选择'], pages, 120);
          expect(seerTurn, 'Seer turn should be detected').toBe(true);
          await clickSeatAndConfirm(pages[seerIdx]!, wolfSeat);

          // Redirect: seer checked the banished wolf, but the check is
          // redirected to the seer themselves -> reveal should show Good
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
  // eclipseWolfQueen skips -> seer checks wolf -> Wolf (no redirect)
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
          const wolfTurn = await waitForRoleTurn(pages[ewqIdx]!, ['袭击'], pages, 120);
          expect(wolfTurn, 'Wolf vote turn should be detected').toBe(true);
          await driveWolfVote(pages, [ewqIdx, wolfIdx], villagerSeat);
        });

        await test.step('seer checks wolf → reveals 狼人 (no redirect)', async () => {
          const seerTurn = await waitForRoleTurn(pages[seerIdx]!, ['查验', '选择'], pages, 120);
          expect(seerTurn, 'Seer turn should be detected').toBe(true);
          await clickSeatAndConfirm(pages[seerIdx]!, wolfSeat);

          // No redirect active -> checking wolf shows Wolf
          const revealText = await readAlertText(pages[seerIdx]!);
          expect(revealText).toContain('狼人');
          await dismissAlert(pages[seerIdx]!);
        });

        await test.step('night ends with death', async () => {
          const ended = await waitForNightEnd(pages, 120);
          expect(ended, 'Night should end').toBe(true);

          // Villager was killed -> should not be peaceful night
          await viewLastNightInfo(pages[0]!);
          const alertText = await readAlertText(pages[0]!);
          expect(alertText).not.toContain('平安夜');
        });
      },
    );
  });

  // --------------------------------------------------------------------------
  // eclipseWolfQueen banishes villager, witch poisons banished -> poison bounces to witch
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
          const wolfTurn = await waitForRoleTurn(pages[ewqIdx]!, ['袭击'], pages, 120);
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
          // Should NOT be peaceful night — wolf + witch die
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

/**
 * Night Roles E2E — HiddenWolf + Crow coverage.
 *
 * NIGHT_STEPS order: crowCurse -> wolfKill -> hiddenWolfReveal -> seerCheck
 *
 * Tests:
 * - Seer checks hiddenWolf -> reveals good (core mechanic)
 * - Crow curse action completes successfully
 * - Crow skips curse via "skip skill"
 */

test.describe('Werewolf Night — Special Roles: Hidden Wolf & Crow', () => {
  // --------------------------------------------------------------------------
  // Seer checks hiddenWolf -> good
  // Night order for this config: wolfKill -> hiddenWolfReveal -> seerCheck
  // --------------------------------------------------------------------------
  test('seer checks hiddenWolf → reveal shows 好人', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['seer'],
            wolfRoles: ['hiddenWolf'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const hiddenWolfIdx = findRolePageIndex(roleMap, '隐狼');
        expect(wolfIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);
        expect(hiddenWolfIdx).not.toBe(-1);

        // Step 1: Wolf kill (wolfKill step)
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        const killTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Step 2: HiddenWolf confirm (hiddenWolfReveal step)
        // Confirm steps show an initial prompt alert → dismiss → then bottom button appears
        const hwTurn = await waitForRoleTurn(pages[hiddenWolfIdx]!, ['查看', '同伴'], pages, 120);
        expect(hwTurn, 'HiddenWolf turn should be detected').toBe(true);

        // Dismiss the initial "隐狼行动" prompt alert
        await dismissAlert(pages[hiddenWolfIdx]!);

        // Click "查看同伴" bottom button
        const clicked = await clickBottomButton(pages[hiddenWolfIdx]!, '查看同伴');
        expect(clicked).toBe(true);

        // Read the reveal — should show wolf teammate seat numbers (1-indexed display)
        const hwReveal = await readAlertText(pages[hiddenWolfIdx]!);
        const wolfSeat = roleMap.get(wolfIdx)!.seat;
        expect(hwReveal).toContain(`${wolfSeat + 1}号`);
        await dismissAlert(pages[hiddenWolfIdx]!);

        // Step 3: Seer check (seerCheck step)
        const seerTurn = await waitForRoleTurn(pages[seerIdx]!, ['查验', '选择'], pages, 120);
        expect(seerTurn, 'Seer turn should be detected').toBe(true);

        // Seer checks the hiddenWolf → should reveal Good
        const checkSeat = roleMap.get(hiddenWolfIdx)!.seat;
        await clickSeatAndConfirm(pages[seerIdx]!, checkSeat);

        // Read reveal — hiddenWolf should show as Good
        const revealText = await readAlertText(pages[seerIdx]!);
        expect(revealText).toContain(`${checkSeat + 1}号`);
        expect(revealText).toContain('好人');
        await dismissAlert(pages[seerIdx]!);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Crow curses a player successfully
  // Night order: crowCurse -> wolfKill (crow acts BEFORE wolf)
  // --------------------------------------------------------------------------
  test('crow curses a target -> action completes', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['crow'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const crowIdx = findRolePageIndex(roleMap, '乌鸦');
        expect(wolfIdx).not.toBe(-1);
        expect(crowIdx).not.toBe(-1);

        const villagerIndices = findAllRolePageIndices(roleMap, '平民');

        // Step 1: Crow curse (crowCurse step — BEFORE wolfKill)
        const crowTurn = await waitForRoleTurn(pages[crowIdx]!, ['诅咒', '选择'], pages, 120);
        expect(crowTurn, 'Crow turn should be detected').toBe(true);

        // Crow curses a villager
        const curseTarget = roleMap.get(villagerIndices[0]!)!.seat;
        await clickSeatAndConfirm(pages[crowIdx]!, curseTarget);

        // Step 2: Wolf kill (wolfKill step)
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        const killTarget = roleMap.get(villagerIndices[1]!)!.seat;
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Crow skips curse -> night completes normally
  // Night order: crowCurse -> wolfKill (crow acts BEFORE wolf)
  // --------------------------------------------------------------------------
  test('crow skips curse via 不用技能 → night completes', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['crow'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const crowIdx = findRolePageIndex(roleMap, '乌鸦');
        expect(wolfIdx).not.toBe(-1);
        expect(crowIdx).not.toBe(-1);

        // Step 1: Crow skip (crowCurse step — BEFORE wolfKill)
        const crowTurn = await waitForRoleTurn(pages[crowIdx]!, ['诅咒', '选择'], pages, 120);
        expect(crowTurn, 'Crow turn should be detected').toBe(true);

        // Dismiss initial prompt alert, then skip
        await dismissAlert(pages[crowIdx]!);
        const skipped = await clickBottomButton(pages[crowIdx]!, '不用技能');
        expect(skipped).toBe(true);

        // Confirm skip if alert appears
        await dismissAlert(pages[crowIdx]!);

        // Step 2: Wolf kill (wolfKill step)
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        const killTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });
});
