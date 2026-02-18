import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
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
import { ConfigPage } from '../pages/ConfigPage';

/**
 * Night Roles E2E — Check / Reveal effect coverage.
 *
 * Tests all roles that produce a reveal result during Night-1:
 * - Seer (好人/狼人), Psychic (exact role), Gargoyle (exact role)
 * - WolfRobot learn + hunter gate
 * - Magician swap × check role interactions
 * - SpiritKnight seer reflection
 *
 * Covers UI assertions on reveal text.
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

// ============================================================================
// Tests
// ============================================================================

test.describe('Night Roles — Check / Reveal', () => {
  // --------------------------------------------------------------------------
  // Seer checks good player → 好人
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
        const villagerIdx = findRolePageIndex(roleMap, '普通村民');
        expect(seerIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Drive wolf kill first
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);

        // Wolf kills villager (or seer if only 2 non-wolves)
        const killTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Wait for seer's turn
        const seerTurn = await waitForRoleTurn(pages[seerIdx], ['查验', '选择'], pages, 120);
        expect(seerTurn, 'Seer turn should be detected').toBe(true);

        // Seer checks the villager (check reveals "好人")
        const checkTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await clickSeatAndConfirm(pages[seerIdx], checkTarget);

        // Read reveal
        const revealText = await readAlertText(pages[seerIdx]);
        expect(revealText).toContain(`${checkTarget + 1}号`);
        expect(revealText).toContain('好人');
        await dismissAlert(pages[seerIdx]);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
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
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Wait for psychic's turn
        const psychicTurn = await waitForRoleTurn(pages[psychicIdx], ['通灵', '选择'], pages, 120);
        expect(psychicTurn, 'Psychic turn should be detected').toBe(true);

        // Check wolf
        const checkSeat = roleMap.get(wolfIdx)!.seat;
        await clickSeatAndConfirm(pages[psychicIdx], checkSeat);

        // Read reveal — "通灵结果：X号是狼人"
        const revealText = await readAlertText(pages[psychicIdx]);
        expect(revealText).toContain(`${checkSeat + 1}号`);
        expect(revealText).toContain('狼人');
        await dismissAlert(pages[psychicIdx]);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
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

        // Drive wolf kill first (gargoyle participates in wolf vote)
        const wolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), gargoyleIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );

        const wolfTurn = await waitForRoleTurn(pages[wolfIndices[0]], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, wolfIndices, killTarget ? killTarget[1].seat : 0);

        // Wait for gargoyle check step
        const gargTurn = await waitForRoleTurn(pages[gargoyleIdx], ['查验'], pages, 120);
        expect(gargTurn, 'Gargoyle turn should be detected').toBe(true);

        // Check the seer
        await clickSeatAndConfirm(pages[gargoyleIdx], seerSeat);

        // Read reveal — "石像鬼探查：X号是预言家"
        const revealText = await readAlertText(pages[gargoyleIdx]);
        expect(revealText).toContain(`${seerSeat + 1}号`);
        expect(revealText).toContain('预言家');
        await dismissAlert(pages[gargoyleIdx]);

        // Skip seer's turn and finish
        const ended = await waitForNightEnd(pages, 120);
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
        const wrIdx = findRolePageIndex(roleMap, '机械狼');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const villagerIdx = findRolePageIndex(roleMap, '普通村民');
        expect(wrIdx !== -1 || wolfIdx !== -1, 'Need wolf faction').toBe(true);

        // All wolf faction indices (wolfRobot is also a wolf)
        const allWolfIndices = [
          ...findAllRolePageIndices(roleMap, '狼人'),
          ...(wrIdx !== -1 ? [wrIdx] : []),
        ].filter((v, i, a) => a.indexOf(v) === i);

        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );

        // Drive wolf kill
        const firstWolf = allWolfIndices[0];
        const wolfTurn = await waitForRoleTurn(pages[firstWolf], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killTarget ? killTarget[1].seat : 0);

        // Wait for wolfRobot learn step
        if (wrIdx !== -1) {
          const wrTurn = await waitForRoleTurn(pages[wrIdx], ['学习'], pages, 120);
          expect(wrTurn, 'WolfRobot turn should be detected').toBe(true);

          // Learn the villager
          const learnSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
          await clickSeatAndConfirm(pages[wrIdx], learnSeat);

          // Read reveal — "学习结果：X号是普通村民"
          const revealText = await readAlertText(pages[wrIdx]);
          expect(revealText).toContain(`${learnSeat + 1}号`);
          expect(revealText).toContain('普通村民');
          await dismissAlert(pages[wrIdx]);
        }

        // Finish night
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

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
        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        const villagerSeat = villagers[0]?.[1].seat ?? 0;
        const killTargetSeat = villagers[1]?.[1].seat ?? villagerSeat;

        // Magician swaps wolf and villager1
        const magTurn = await waitForRoleTurn(pages[magIdx], ['交换', '选择'], pages, 120);
        expect(magTurn).toBe(true);
        await driveMagicianSwap(pages[magIdx], wolfSeat, villagerSeat);

        // Wolf kills another villager (the one NOT swapped)
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTargetSeat);

        // Seer checks the wolf's ORIGINAL seat — after swap, villager is there → 好人
        const seerTurn = await waitForRoleTurn(pages[seerIdx], ['查验', '选择'], pages, 120);
        expect(seerTurn).toBe(true);
        await clickSeatAndConfirm(pages[seerIdx], wolfSeat);

        // Reveal should show 好人 (because villager was swapped to that seat)
        const revealText = await readAlertText(pages[seerIdx]);
        expect(revealText).toContain('好人');
        await dismissAlert(pages[seerIdx]);

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
        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        const villagerSeat = villagers[0]?.[1].seat ?? 0;
        const killTargetSeat = villagers[1]?.[1].seat ?? villagerSeat;

        // Magician swaps wolf and villager1
        const magTurn = await waitForRoleTurn(pages[magIdx], ['交换', '选择'], pages, 120);
        expect(magTurn).toBe(true);
        await driveMagicianSwap(pages[magIdx], wolfSeat, villagerSeat);

        // Wolf kill — gargoyle is wolf faction, participates in wolf vote
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), gargoyleIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        const wolfTurn = await waitForRoleTurn(
          pages[allWolfIndices[0]],
          ['猎杀', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killTargetSeat);

        // Gargoyle checks wolf's ORIGINAL seat → villager is there after swap → 普通村民
        const gargTurn = await waitForRoleTurn(pages[gargoyleIdx], ['查验'], pages, 120);
        expect(gargTurn).toBe(true);
        await clickSeatAndConfirm(pages[gargoyleIdx], wolfSeat);

        const revealText = await readAlertText(pages[gargoyleIdx]);
        expect(revealText).toContain('普通村民');
        await dismissAlert(pages[gargoyleIdx]);

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
        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        const villagerSeat = villagers[0]?.[1].seat ?? 0;
        const killTargetSeat = villagers[1]?.[1].seat ?? villagerSeat;

        // Magician swaps wolf and villager1
        const magTurn = await waitForRoleTurn(pages[magIdx], ['交换', '选择'], pages, 120);
        expect(magTurn).toBe(true);
        await driveMagicianSwap(pages[magIdx], wolfSeat, villagerSeat);

        // Wolf kills villager2
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTargetSeat);

        // Psychic checks wolf's ORIGINAL seat → villager is there → 普通村民
        const psychicTurn = await waitForRoleTurn(pages[psychicIdx], ['通灵', '选择'], pages, 120);
        expect(psychicTurn).toBe(true);
        await clickSeatAndConfirm(pages[psychicIdx], wolfSeat);

        const revealText = await readAlertText(pages[psychicIdx]);
        expect(revealText).toContain('普通村民');
        await dismissAlert(pages[psychicIdx]);

        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // SpiritKnight — seer check reflects → seer dies, still sees 狼人
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
        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        const killSeat = villagers[0]?.[1].seat ?? 0;

        // Both spiritKnight and wolf are wolf faction
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), skIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        // Wolf kills a villager
        const wolfTurn = await waitForRoleTurn(
          pages[allWolfIndices[0]],
          ['猎杀', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killSeat);

        // Seer checks spiritKnight → should still see 狼人 (check resolves before reflect)
        const seerTurn = await waitForRoleTurn(pages[seerIdx], ['查验', '选择'], pages, 120);
        expect(seerTurn).toBe(true);
        await clickSeatAndConfirm(pages[seerIdx], skSeat);

        const revealText = await readAlertText(pages[seerIdx]);
        expect(revealText).toContain(`${skSeat + 1}号`);
        expect(revealText).toContain('狼人');
        await dismissAlert(pages[seerIdx]);

        // Night ends — seer dies from reflection
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);

        // Verify deaths include seer (reflection kill)
        await viewLastNightInfo(pages[0]);
        const hasDeath = await isTextVisible(pages[0], '死亡');
        expect(hasDeath, 'Should have deaths (seer dies from reflection)').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // WolfRobot learns hunter → hunter gate UI
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
        const wrIdx = findRolePageIndex(roleMap, '机械狼');
        const hunterIdx = findRolePageIndex(roleMap, '猎人');
        expect(wrIdx).not.toBe(-1);
        expect(hunterIdx).not.toBe(-1);

        const hunterSeat = roleMap.get(hunterIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        const killSeat = villagers[0]?.[1].seat ?? 0;

        // wolfRobot does NOT participate in wolf vote
        // Drive wolf kill with only generic wolves
        const wolfIndices = findAllRolePageIndices(roleMap, '狼人');
        const wolfTurn = await waitForRoleTurn(pages[wolfIndices[0]], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, wolfIndices, killSeat);

        // Wait for wolfRobot learn step
        const wrTurn = await waitForRoleTurn(pages[wrIdx], ['学习'], pages, 120);
        expect(wrTurn).toBe(true);

        // Learn the hunter
        await clickSeatAndConfirm(pages[wrIdx], hunterSeat);

        // Read learn reveal — should contain 猎人
        const revealText = await readAlertText(pages[wrIdx]);
        expect(revealText).toContain('猎人');
        await dismissAlert(pages[wrIdx]);

        // Hunter gate prompt — "查看技能状态" button should appear
        await clickBottomButton(pages[wrIdx], '查看技能状态');

        // Gate dialog shows hunter shoot status — "可发动技能" (not poisoned)
        const gateText = await readAlertText(pages[wrIdx]);
        expect(gateText).toContain('可发动技能');
        await dismissAlert(pages[wrIdx]);

        // Night should complete after gate is acknowledged
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });
});
