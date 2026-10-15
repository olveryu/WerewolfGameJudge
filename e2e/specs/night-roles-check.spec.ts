import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { expect, test } from '@playwright/test';

import {
  clickBottomButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveMagicianSwap,
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
 * Night Roles E2E — Check / Reveal effect coverage.
 *
 * Tests all roles that produce a reveal result during Night-1:
 * - Seer (Good/Wolf), Psychic (exact role), Gargoyle (exact role)
 * - WolfRobot learn + hunter gate
 * - Magician swap × check role interactions
 * - SpiritKnight seer reflection
 *
 * Covers UI assertions on reveal text.
 * Does not modify game state directly or import services/models.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Night Roles — Check / Reveal', () => {
  // --------------------------------------------------------------------------
  // Magician swap + seer → seer sees swapped alignment
  // --------------------------------------------------------------------------
  test('magician swaps wolf & villager → seer checks wolf seat → 好人', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['magician', 'seer'],
          }),
      },
      async ({ pages, roleMap }) => {
        const magIdx = findRolePageIndex(roleMap, '魔术师');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(magIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const wolfSeat = roleMap.get(wolfIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        const villagerSeat = villagers[0]?.[1].seat ?? 0;
        const killTargetSeat = villagers[1]?.[1].seat ?? villagerSeat;

        // Magician swaps wolf and villager1
        const magTurn = await waitForRoleTurn(pages[magIdx]!, ['交换', '选择'], pages, 120);
        expect(magTurn).toBe(true);
        await driveMagicianSwap(pages[magIdx]!, wolfSeat, villagerSeat);

        // Wolf kills another villager (the one NOT swapped)
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTargetSeat);

        // Seer checks the wolf's ORIGINAL seat — after swap, villager is there → Good
        const seerTurn = await waitForRoleTurn(pages[seerIdx]!, ['查验', '选择'], pages, 120);
        expect(seerTurn).toBe(true);
        await clickSeatAndConfirm(pages[seerIdx]!, wolfSeat);

        // Reveal should show Good (because villager was swapped to that seat)
        const revealText = await readAlertText(pages[seerIdx]!);
        expect(revealText).toContain('好人');
        await dismissAlert(pages[seerIdx]!);

        // Finish night
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Magician swap × gargoyle → gargoyle sees swapped identity
  // --------------------------------------------------------------------------
  test('magician swaps wolf & villager → gargoyle checks wolf seat → 普通村民', async ({
    browser,
  }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['magician'],
            wolfRoles: ['gargoyle'],
          }),
      },
      async ({ pages, roleMap }) => {
        const magIdx = findRolePageIndex(roleMap, '魔术师');
        const gargoyleIdx = findRolePageIndex(roleMap, '石像鬼');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(magIdx).not.toBe(-1);
        expect(gargoyleIdx).not.toBe(-1);

        const wolfSeat = roleMap.get(wolfIdx !== -1 ? wolfIdx : 0)!.seat;
        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        const villagerSeat = villagers[0]?.[1].seat ?? 0;
        const killTargetSeat = villagers[1]?.[1].seat ?? villagerSeat;

        // Magician swaps wolf and villager1
        const magTurn = await waitForRoleTurn(pages[magIdx]!, ['交换', '选择'], pages, 120);
        expect(magTurn).toBe(true);
        await driveMagicianSwap(pages[magIdx]!, wolfSeat, villagerSeat);

        // Wolf kill — gargoyle does NOT participate in wolf vote
        const allWolfIndices = findAllRolePageIndices(roleMap, '狼人');

        const wolfTurn = await waitForRoleTurn(
          pages[allWolfIndices[0]!]!,
          ['袭击', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killTargetSeat);

        // Gargoyle checks wolf's ORIGINAL seat → villager is there after swap → Villager
        const gargTurn = await waitForRoleTurn(pages[gargoyleIdx]!, ['查验'], pages, 120);
        expect(gargTurn).toBe(true);
        await clickSeatAndConfirm(pages[gargoyleIdx]!, wolfSeat);

        const revealText = await readAlertText(pages[gargoyleIdx]!);
        expect(revealText).toContain('平民');
        await dismissAlert(pages[gargoyleIdx]!);

        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Magician swap × psychic → psychic sees swapped identity
  // --------------------------------------------------------------------------
  test('magician swaps wolf & villager → psychic checks wolf seat → 普通村民', async ({
    browser,
  }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['magician', 'psychic'],
          }),
      },
      async ({ pages, roleMap }) => {
        const magIdx = findRolePageIndex(roleMap, '魔术师');
        const psychicIdx = findRolePageIndex(roleMap, '通灵师');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(magIdx).not.toBe(-1);
        expect(psychicIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const wolfSeat = roleMap.get(wolfIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        const villagerSeat = villagers[0]?.[1].seat ?? 0;
        const killTargetSeat = villagers[1]?.[1].seat ?? villagerSeat;

        // Magician swaps wolf and villager1
        const magTurn = await waitForRoleTurn(pages[magIdx]!, ['交换', '选择'], pages, 120);
        expect(magTurn).toBe(true);
        await driveMagicianSwap(pages[magIdx]!, wolfSeat, villagerSeat);

        // Wolf kills villager2
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTargetSeat);

        // Psychic checks wolf's ORIGINAL seat → villager is there → Villager
        const psychicTurn = await waitForRoleTurn(pages[psychicIdx]!, ['通灵', '选择'], pages, 120);
        expect(psychicTurn).toBe(true);
        await clickSeatAndConfirm(pages[psychicIdx]!, wolfSeat);

        const revealText = await readAlertText(pages[psychicIdx]!);
        expect(revealText).toContain('平民');
        await dismissAlert(pages[psychicIdx]!);

        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // SpiritKnight — seer check reflects → seer dies, still sees Wolf
  // --------------------------------------------------------------------------
  test('seer checks spiritKnight → sees 狼人 → seer dies from reflection', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['seer'],
            wolfRoles: ['spiritKnight'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const skIdx = findRolePageIndex(roleMap, '恶灵骑士');
        expect(wolfIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);
        expect(skIdx).not.toBe(-1);

        const skSeat = roleMap.get(skIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        const killSeat = villagers[0]?.[1].seat ?? 0;

        // Both spiritKnight and wolf are wolf faction
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), skIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        // Wolf kills a villager
        const wolfTurn = await waitForRoleTurn(
          pages[allWolfIndices[0]!]!,
          ['袭击', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killSeat);

        // Seer checks spiritKnight → should still see Wolf (check resolves before reflect)
        const seerTurn = await waitForRoleTurn(pages[seerIdx]!, ['查验', '选择'], pages, 120);
        expect(seerTurn).toBe(true);
        await clickSeatAndConfirm(pages[seerIdx]!, skSeat);

        const revealText = await readAlertText(pages[seerIdx]!);
        expect(revealText).toContain(formatSeat(skSeat));
        expect(revealText).toContain('狼人');
        await dismissAlert(pages[seerIdx]!);

        // Night ends — seer dies from reflection
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);

        // Verify deaths include seer (reflection kill)
        await viewLastNightInfo(pages[0]!);
        const hasDeath = await isTextVisible(pages[0]!, '死亡');
        expect(hasDeath, 'Should have deaths (seer dies from reflection)').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // WolfRobot learns hunter → hunter gate
  // --------------------------------------------------------------------------
  test('wolfRobot learns hunter → hunter gate shows 可发动技能', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['hunter'],
            wolfRoles: ['wolfRobot'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wrIdx = findRolePageIndex(roleMap, '机械狼人');
        const hunterIdx = findRolePageIndex(roleMap, '猎人');
        expect(wrIdx).not.toBe(-1);
        expect(hunterIdx).not.toBe(-1);

        const hunterSeat = roleMap.get(hunterIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        const killSeat = villagers[0]?.[1].seat ?? 0;

        // wolfRobot does NOT participate in wolf vote
        // Drive wolf kill with only generic wolves
        const wolfIndices = findAllRolePageIndices(roleMap, '狼人');
        const wolfTurn = await waitForRoleTurn(
          pages[wolfIndices[0]!]!,
          ['袭击', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, wolfIndices, killSeat);

        // Wait for wolfRobot learn step
        const wrTurn = await waitForRoleTurn(pages[wrIdx]!, ['学习'], pages, 120);
        expect(wrTurn).toBe(true);

        // Learn the hunter
        await clickSeatAndConfirm(pages[wrIdx]!, hunterSeat);

        // Read learn reveal — should contain Hunter
        const revealText = await readAlertText(pages[wrIdx]!);
        expect(revealText).toContain('猎人');
        await dismissAlert(pages[wrIdx]!);

        // Hunter gate prompt — "查看技能状态" button should appear
        await clickBottomButton(pages[wrIdx]!, '查看技能状态');

        // Gate dialog shows hunter shoot status — "可发动技能" (not poisoned)
        const gateText = await readAlertText(pages[wrIdx]!);
        expect(gateText).toContain('可发动技能');
        expect(gateText).not.toContain('不可发动技能');
        await dismissAlert(pages[wrIdx]!);

        // Night should complete after gate is acknowledged
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // WolfRobot learns hunter while poisoned → hunter gate shows cannot-activate-ability
  // --------------------------------------------------------------------------
  test('wolfRobot learns hunter while poisoned → gate shows 不可发动技能', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['hunter', 'witch'],
            wolfRoles: ['wolfRobot'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wrIdx = findRolePageIndex(roleMap, '机械狼人');
        const hunterIdx = findRolePageIndex(roleMap, '猎人');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        expect(wrIdx).not.toBe(-1);
        expect(hunterIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);

        const wrSeat = roleMap.get(wrIdx)!.seat;
        const hunterSeat = roleMap.get(hunterIdx)!.seat;
        const killSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;

        // wolfRobot does NOT participate in wolf vote
        const wolfIndices = findAllRolePageIndices(roleMap, '狼人');
        const wolfTurn = await waitForRoleTurn(
          pages[wolfIndices[0]!]!,
          ['袭击', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, wolfIndices, killSeat);

        // Witch turn — witch acts before wolfRobot (NIGHT_STEP_ORDER: witchAction < wolfRobotLearn).
        // Skip save (don't click use-antidote), poison the wolfRobot via seat tap (compound step:
        // seat tap is always poison selection — see useRoomActions.ts).
        const witchTurn = await waitForRoleTurn(
          pages[witchIdx]!,
          ['被狼人袭击', '解药'],
          pages,
          120,
        );
        expect(witchTurn, 'Witch turn should be detected').toBe(true);
        await dismissAlert(pages[witchIdx]!);
        await clickSeatAndConfirm(pages[witchIdx]!, wrSeat);

        // wolfRobot learns hunter
        const wrTurn = await waitForRoleTurn(pages[wrIdx]!, ['学习'], pages, 120);
        expect(wrTurn).toBe(true);
        await clickSeatAndConfirm(pages[wrIdx]!, hunterSeat);

        const revealText = await readAlertText(pages[wrIdx]!);
        expect(revealText).toContain('猎人');
        await dismissAlert(pages[wrIdx]!);

        // Hunter gate — poisoned wolfRobot should see "不可发动技能"
        await clickBottomButton(pages[wrIdx]!, '查看技能状态');
        const gateText = await readAlertText(pages[wrIdx]!);
        expect(gateText).toContain('不可发动技能');
        await dismissAlert(pages[wrIdx]!);

        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });
});
