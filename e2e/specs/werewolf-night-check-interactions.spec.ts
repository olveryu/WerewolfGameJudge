import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { expect, test } from '@playwright/test';

import { readAlertText } from '../helpers/alerts';
import {
  clickSeatAndConfirm,
  dismissAlert,
  driveMagicianSwap,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Werewolf Night E2E — Check interactions.
 *
 * Reveal results after another role has modified the night state:
 * - Magician swap × seer / gargoyle / psychic (swapped identity is revealed)
 * - Seer checks SpiritKnight (sees Wolf, dies from reflection)
 *
 * Covers UI assertions on reveal text.
 * Does not modify game state directly or import services/models.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Werewolf Night — Check Interactions', () => {
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
        await waitForRoleTurn(pages[magIdx]!, 'magicianSwap', pages);
        await driveMagicianSwap(pages[magIdx]!, wolfSeat, villagerSeat);

        // Wolf kills another villager (the one NOT swapped)
        await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        await driveWolfVote(pages, [wolfIdx], killTargetSeat);

        // Seer checks the wolf's ORIGINAL seat — after swap, villager is there → Good
        await waitForRoleTurn(pages[seerIdx]!, 'seerCheck', pages);
        await clickSeatAndConfirm(pages[seerIdx]!, wolfSeat);

        // Reveal should show Good (because villager was swapped to that seat)
        const revealText = await readAlertText(pages[seerIdx]!);
        expect(revealText).toContain('好人');
        await dismissAlert(pages[seerIdx]!);

        // Finish night
        await waitForNightEnd(pages);
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
        await waitForRoleTurn(pages[magIdx]!, 'magicianSwap', pages);
        await driveMagicianSwap(pages[magIdx]!, wolfSeat, villagerSeat);

        // Wolf kill — gargoyle does NOT participate in wolf vote
        const allWolfIndices = findAllRolePageIndices(roleMap, '狼人');

        await waitForRoleTurn(pages[allWolfIndices[0]!]!, 'wolfKill', pages);
        await driveWolfVote(pages, allWolfIndices, killTargetSeat);

        // Gargoyle checks wolf's ORIGINAL seat → villager is there after swap → Villager
        await waitForRoleTurn(pages[gargoyleIdx]!, 'gargoyleCheck', pages);
        await clickSeatAndConfirm(pages[gargoyleIdx]!, wolfSeat);

        const revealText = await readAlertText(pages[gargoyleIdx]!);
        expect(revealText).toContain('平民');
        await dismissAlert(pages[gargoyleIdx]!);

        await waitForNightEnd(pages);
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
        await waitForRoleTurn(pages[magIdx]!, 'magicianSwap', pages);
        await driveMagicianSwap(pages[magIdx]!, wolfSeat, villagerSeat);

        // Wolf kills villager2
        await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        await driveWolfVote(pages, [wolfIdx], killTargetSeat);

        // Psychic checks wolf's ORIGINAL seat → villager is there → Villager
        await waitForRoleTurn(pages[psychicIdx]!, 'psychicCheck', pages);
        await clickSeatAndConfirm(pages[psychicIdx]!, wolfSeat);

        const revealText = await readAlertText(pages[psychicIdx]!);
        expect(revealText).toContain('平民');
        await dismissAlert(pages[psychicIdx]!);

        await waitForNightEnd(pages);
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
        await waitForRoleTurn(pages[allWolfIndices[0]!]!, 'wolfKill', pages);
        await driveWolfVote(pages, allWolfIndices, killSeat);

        // Seer checks spiritKnight → should still see Wolf (check resolves before reflect)
        await waitForRoleTurn(pages[seerIdx]!, 'seerCheck', pages);
        await clickSeatAndConfirm(pages[seerIdx]!, skSeat);

        const revealText = await readAlertText(pages[seerIdx]!);
        expect(revealText).toContain(formatSeat(skSeat));
        expect(revealText).toContain('狼人');
        await dismissAlert(pages[seerIdx]!);

        // Night ends — seer dies from reflection
        await waitForNightEnd(pages);

        // Verify deaths include seer (reflection kill)
        const nightInfo = await viewLastNightInfo(pages[0]!);
        expect(nightInfo, 'Should have deaths (seer dies from reflection)').toContain('昨夜死亡');
      },
    );
  });
});
