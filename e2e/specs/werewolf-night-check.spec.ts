import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { expect, test } from '@playwright/test';

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
 * Werewolf Night E2E — Check / Reveal basics.
 *
 * Base reveal coverage for every Night-1 check-type role acting alone:
 * - Seer (Good), Psychic (exact role), Gargoyle (exact role)
 * - WolfRobot learn, PureWhite, WolfWitch (exact role)
 * - Seer checks CursedFox (Good reveal + check death)
 *
 * Covers UI assertions on reveal text.
 * Does not modify game state directly or import services/models.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Werewolf Night — Check / Reveal', () => {
  // --------------------------------------------------------------------------
  // Seer checks good player → Good
  // --------------------------------------------------------------------------
  test('seer checks villager → reveal shows 好人', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['seer'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        expect(seerIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Drive wolf kill first
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);

        // Wolf kills villager (or seer if only 2 non-wolves)
        const killTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Wait for seer's turn
        const seerTurn = await waitForRoleTurn(pages[seerIdx]!, 'seerCheck', pages);
        expect(seerTurn, 'Seer turn should be detected').toBe(true);

        // Seer checks the villager (check reveals "好人")
        const checkTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await clickSeatAndConfirm(pages[seerIdx]!, checkTarget);

        // Read reveal
        const revealText = await readAlertText(pages[seerIdx]!);
        expect(revealText).toContain(`${checkTarget + 1}号`);
        expect(revealText).toContain('好人');
        await dismissAlert(pages[seerIdx]!);

        // Finish night
        const ended = await waitForNightEnd(pages, 90_000);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Psychic checks → exact role name
  // --------------------------------------------------------------------------
  test('psychic checks player → reveal shows exact role', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['psychic'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const psychicIdx = findRolePageIndex(roleMap, '通灵师');
        expect(psychicIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Drive wolf kill
        const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName !== '狼人');
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Wait for psychic's turn
        const psychicTurn = await waitForRoleTurn(pages[psychicIdx]!, 'psychicCheck', pages);
        expect(psychicTurn, 'Psychic turn should be detected').toBe(true);

        // Check wolf
        const checkSeat = roleMap.get(wolfIdx)!.seat;
        await clickSeatAndConfirm(pages[psychicIdx]!, checkSeat);

        // Read reveal — "通灵结果：X号是狼人"
        const revealText = await readAlertText(pages[psychicIdx]!);
        expect(revealText).toContain(formatSeat(checkSeat));
        expect(revealText).toContain('狼人');
        await dismissAlert(pages[psychicIdx]!);

        // Finish night
        const ended = await waitForNightEnd(pages, 90_000);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Gargoyle checks → exact role name
  // --------------------------------------------------------------------------
  test('gargoyle checks seer → reveal shows 预言家', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['seer'],
            wolfRoles: ['gargoyle'],
          }),
      },
      async ({ pages, roleMap }) => {
        const gargoyleIdx = findRolePageIndex(roleMap, '石像鬼');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        expect(gargoyleIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);

        const seerSeat = roleMap.get(seerIdx)!.seat;

        // Drive wolf kill (gargoyle does NOT participate in wolf vote)
        const wolfIndices = findAllRolePageIndices(roleMap, '狼人');

        const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName === '平民');

        const wolfTurn = await waitForRoleTurn(pages[wolfIndices[0]!]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, wolfIndices, killTarget ? killTarget[1].seat : 0);

        // Wait for gargoyle check step
        const gargTurn = await waitForRoleTurn(pages[gargoyleIdx]!, 'gargoyleCheck', pages);
        expect(gargTurn, 'Gargoyle turn should be detected').toBe(true);

        // Check the seer
        await clickSeatAndConfirm(pages[gargoyleIdx]!, seerSeat);

        // Read reveal — "石像鬼探查：X号是预言家"
        const revealText = await readAlertText(pages[gargoyleIdx]!);
        expect(revealText).toContain(formatSeat(seerSeat));
        expect(revealText).toContain('预言家');
        await dismissAlert(pages[gargoyleIdx]!);

        // Skip seer's turn and finish
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Wolf Robot learns a role
  // --------------------------------------------------------------------------
  test('wolfRobot learns villager → reveal shows 普通村民', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            wolfRoles: ['wolfRobot'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wrIdx = findRolePageIndex(roleMap, '机械狼人');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        expect(wrIdx !== -1 || wolfIdx !== -1, 'Need wolf faction').toBe(true);

        // wolfRobot does NOT participate in wolf vote
        const allWolfIndices = findAllRolePageIndices(roleMap, '狼人');

        const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName === '平民');

        // Drive wolf kill
        const firstWolf = allWolfIndices[0]!;
        const wolfTurn = await waitForRoleTurn(pages[firstWolf]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killTarget ? killTarget[1].seat : 0);

        // Wait for wolfRobot learn step
        if (wrIdx !== -1) {
          const wrTurn = await waitForRoleTurn(pages[wrIdx]!, 'wolfRobotLearn', pages);
          expect(wrTurn, 'WolfRobot turn should be detected').toBe(true);

          // Learn the villager
          const learnSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
          await clickSeatAndConfirm(pages[wrIdx]!, learnSeat);

          // Read reveal — "学习结果：X号是普通村民"
          const revealText = await readAlertText(pages[wrIdx]!);
          expect(revealText).toContain(formatSeat(learnSeat));
          expect(revealText).toContain('平民');
          await dismissAlert(pages[wrIdx]!);
        }

        // Finish night
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // PureWhite checks villager → exact role name
  // --------------------------------------------------------------------------
  test('pureWhite checks villager → reveal shows 普通村民', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['pureWhite'],
            wolfRoles: ['wolfWitch'],
          }),
      },
      async ({ pages, roleMap }) => {
        const pureWhiteIdx = findRolePageIndex(roleMap, '纯白之女');
        const wolfWitchIdx = findRolePageIndex(roleMap, '狼巫');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(pureWhiteIdx).not.toBe(-1);
        expect(wolfWitchIdx).not.toBe(-1);

        // Wolf faction: wolf + wolfWitch both participate in wolf vote
        const wolfIndices = [...(wolfIdx !== -1 ? [wolfIdx] : []), wolfWitchIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        const killTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;

        // Drive wolf kill
        const wolfTurn = await waitForRoleTurn(pages[wolfIndices[0]!]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, wolfIndices, killTarget);

        // Wait for pureWhite's turn
        const pwTurn = await waitForRoleTurn(pages[pureWhiteIdx]!, 'pureWhiteCheck', pages);
        expect(pwTurn, 'PureWhite turn should be detected').toBe(true);

        // Check the villager
        const checkSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await clickSeatAndConfirm(pages[pureWhiteIdx]!, checkSeat);

        // Read reveal — "纯白查验：X号是普通村民"
        const revealText = await readAlertText(pages[pureWhiteIdx]!);
        expect(revealText).toContain(formatSeat(checkSeat));
        expect(revealText).toContain('平民');
        await dismissAlert(pages[pureWhiteIdx]!);

        // Finish night
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // WolfWitch checks villager → exact role name
  // --------------------------------------------------------------------------
  test('wolfWitch checks villager → reveal shows 普通村民', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['pureWhite'],
            wolfRoles: ['wolfWitch'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfWitchIdx = findRolePageIndex(roleMap, '狼巫');
        const pureWhiteIdx = findRolePageIndex(roleMap, '纯白之女');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(wolfWitchIdx).not.toBe(-1);

        // Wolf faction: wolf + wolfWitch
        const wolfIndices = [...(wolfIdx !== -1 ? [wolfIdx] : []), wolfWitchIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        const killTarget = pureWhiteIdx !== -1 ? roleMap.get(pureWhiteIdx)!.seat : 0;

        // Drive wolf kill (kill pureWhite so villager survives for wolfWitch to check)
        const wolfTurn = await waitForRoleTurn(pages[wolfIndices[0]!]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, wolfIndices, killTarget);

        // Wait for wolfWitch's turn (use '查验' only — '选择' also appears in the
        // wolfKill prompt and would match before the step actually transitions)
        const wwTurn = await waitForRoleTurn(pages[wolfWitchIdx]!, 'wolfWitchCheck', pages);
        expect(wwTurn, 'WolfWitch turn should be detected').toBe(true);

        // Check the villager (notWolfFaction constraint — can only check non-wolf)
        const checkSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await clickSeatAndConfirm(pages[wolfWitchIdx]!, checkSeat);

        // Read reveal — "狼巫查验：X号是普通村民"
        const revealText = await readAlertText(pages[wolfWitchIdx]!);
        expect(revealText).toContain(formatSeat(checkSeat));
        expect(revealText).toContain('平民');
        await dismissAlert(pages[wolfWitchIdx]!);

        // Finish night
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Seer checks cursedFox → sees Good → cursedFox dies from check
  // --------------------------------------------------------------------------
  test('seer checks cursedFox → sees 好人 → cursedFox dies', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['seer'],
            specialRoles: ['cursedFox'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const cursedFoxIdx = findRolePageIndex(roleMap, '咒狐');
        expect(wolfIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);
        expect(cursedFoxIdx).not.toBe(-1);

        const cursedFoxSeat = roleMap.get(cursedFoxIdx)!.seat;
        const villagerEntry = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '平民',
        );
        const killSeat = villagerEntry?.[1].seat ?? 0;

        // Wolf kills villager (not cursedFox or seer)
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killSeat);

        // Seer checks cursedFox → should see Good (Team.Third → Good)
        const seerTurn = await waitForRoleTurn(pages[seerIdx]!, 'seerCheck', pages);
        expect(seerTurn).toBe(true);
        await clickSeatAndConfirm(pages[seerIdx]!, cursedFoxSeat);

        const revealText = await readAlertText(pages[seerIdx]!);
        expect(revealText).toContain(formatSeat(cursedFoxSeat));
        expect(revealText).toContain('好人');
        await dismissAlert(pages[seerIdx]!);

        // Night ends — cursedFox dies from check
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);

        // Verify cursedFox is in death list
        await viewLastNightInfo(pages[0]!);
        const nightInfo = await readAlertText(pages[0]!);
        expect(nightInfo).toContain(formatSeat(cursedFoxSeat));

        // Should not be peaceful night (villager wolf-killed + cursedFox check-killed)
        const peaceful = await isTextVisible(pages[0]!, '平安夜');
        expect(peaceful, 'Should not be 平安夜 with cursedFox check death').toBe(false);
      },
    );
  });
});
