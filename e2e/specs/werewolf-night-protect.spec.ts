import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { readAlertText } from '../helpers/alerts';
import {
  clickNightButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Night Roles E2E — Protection / Immunity effect coverage.
 *
 * Tests all roles that prevent or modify night deaths:
 * - Guard protect -> peaceful night
 * - Witch save -> peaceful night, Witch self-save rejection
 * - Dreamcatcher hit/miss/link death
 * - SpiritKnight wolf-kill immunity, poison reflection
 *
 * Covers UI assertions on death/survival text.
 * Does not modify game state directly or import services/models.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Werewolf Night — Protection / Immunity', () => {
  // --------------------------------------------------------------------------
  // Guard protects -> peaceful night
  // --------------------------------------------------------------------------
  test('guard protects wolf target → 平安夜', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['guard'],
          }),
      },
      async ({ pages, roleMap }) => {
        const guardIdx = findRolePageIndex(roleMap, '守卫');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        expect(guardIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Pick the villager as target for both guard and wolf
        const targetSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;

        // Wait for guard's turn
        const guardTurn = await waitForRoleTurn(pages[guardIdx]!, 'guardProtect', pages);
        expect(guardTurn, 'Guard turn should be detected').toBe(true);

        // Guard protects the target
        await clickSeatAndConfirm(pages[guardIdx]!, targetSeat);

        // Wait for wolf's turn, wolf kills same target
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn, 'Wolf turn should be detected').toBe(true);
        await driveWolfVote(pages, [wolfIdx], targetSeat);

        // Night should end with peaceful night
        const ended = await waitForNightEnd(pages);
        expect(ended, 'Night should have ended').toBe(true);

        const nightInfo = await viewLastNightInfo(pages[0]!);
        expect(nightInfo, 'Should be 平安夜 (guard protected)').toContain('平安夜');
      },
    );
  });

  // --------------------------------------------------------------------------
  // Witch saves -> peaceful night
  // --------------------------------------------------------------------------
  test('witch saves wolf-killed player → 平安夜', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['witch'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        expect(wolfIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);

        const killTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;

        // Wait for wolf's turn
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Wait for witch's turn — she sees "被狼人袭击" + save button
        const witchTurn = await waitForRoleTurn(pages[witchIdx]!, 'witchAction', pages);
        expect(witchTurn, 'Witch turn should be detected').toBe(true);

        // Dismiss the witch info alert (shows kill info)
        await dismissAlert(pages[witchIdx]!);

        await clickNightButton(pages[witchIdx]!, 'save', `对${formatSeat(killTarget)}用解药`);

        // Confirm the save
        await expect(pages[witchIdx]!.getByTestId(TESTIDS.alertModal)).toBeVisible({
          timeout: 5000,
        });
        await dismissAlert(pages[witchIdx]!);

        // Night should end with peaceful night
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);

        const nightInfo = await viewLastNightInfo(pages[0]!);
        expect(nightInfo, 'Should be 平安夜 (witch saved)').toContain('平安夜');
      },
    );
  });

  // --------------------------------------------------------------------------
  // Dreamcatcher dreams wolf target -> immune (peaceful night)
  // --------------------------------------------------------------------------
  test('dreamcatcher dreams wolf target → 平安夜', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['dreamcatcher'],
          }),
      },
      async ({ pages, roleMap }) => {
        const dcIdx = findRolePageIndex(roleMap, '摄梦人');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(dcIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Pick a villager as target
        const villagerEntry = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '平民',
        );
        const targetSeat = villagerEntry ? villagerEntry[1].seat : roleMap.get(dcIdx)!.seat;

        // Wait for dreamcatcher's turn
        const dcTurn = await waitForRoleTurn(pages[dcIdx]!, 'dreamcatcherDream', pages);
        expect(dcTurn, 'Dreamcatcher turn should be detected').toBe(true);

        // Dream the target
        await clickSeatAndConfirm(pages[dcIdx]!, targetSeat);

        // Wolf kills same target
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], targetSeat);

        // Night should end with peaceful night (dreamcatcher immunity)
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);

        const nightInfo = await viewLastNightInfo(pages[0]!);
        expect(nightInfo, 'Should be 平安夜 (dreamcatcher protected)').toContain('平安夜');
      },
    );
  });

  // --------------------------------------------------------------------------
  // Dreamcatcher dreams wrong target -> death occurs
  // --------------------------------------------------------------------------
  test('dreamcatcher dreams wrong target → death occurs', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['dreamcatcher'],
          }),
      },
      async ({ pages, roleMap }) => {
        const dcIdx = findRolePageIndex(roleMap, '摄梦人');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(dcIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        expect(villagers.length).toBeGreaterThanOrEqual(2);

        const dreamSeat = villagers[0]![1].seat; // dream this one
        const killSeat = villagers[1]![1].seat; // wolf kills a different one

        // Dreamcatcher dreams villager1
        const dcTurn = await waitForRoleTurn(pages[dcIdx]!, 'dreamcatcherDream', pages);
        expect(dcTurn).toBe(true);
        await clickSeatAndConfirm(pages[dcIdx]!, dreamSeat);

        // Wolf kills villager2 (different target -> no protection)
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killSeat);

        // Night ends with death (not peaceful night)
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);

        const nightInfo = await viewLastNightInfo(pages[0]!);
        expect(nightInfo, 'Should NOT be 平安夜 (dreamcatcher missed)').not.toContain('平安夜');
      },
    );
  });

  // --------------------------------------------------------------------------
  // Witch self-save rejection (notSelf constraint)
  // --------------------------------------------------------------------------
  test('witch targeted by wolf → cannot self-save', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['witch'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        expect(wolfIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);

        const witchSeat = roleMap.get(witchIdx)!.seat;

        // Wolf kills the witch
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], witchSeat);

        // Wait for witch's turn — she was targeted, should see self-save rejection
        const witchTurn = await waitForRoleTurn(pages[witchIdx]!, 'witchAction', pages);
        expect(witchTurn).toBe(true);

        // Read the prompt — should mention "无法自救"
        const alertText = await readAlertText(pages[witchIdx]!);
        expect(alertText).toContain('无法自救');
        await dismissAlert(pages[witchIdx]!);

        // Witch skips (no save, no poison)
        await clickNightButton(pages[witchIdx]!, 'skip', '不用技能');
        await dismissAlert(pages[witchIdx]!);

        // Night ends — witch dies
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // SpiritKnight — wolf cannot self-knife (immuneToWolfKill rejection)
  // --------------------------------------------------------------------------
  test('spiritKnight is immune to wolf kill → rejection → re-vote', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            wolfRoles: ['spiritKnight'],
          }),
      },
      async ({ pages, roleMap }) => {
        const skIdx = findRolePageIndex(roleMap, '恶灵骑士');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(skIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const skSeat = roleMap.get(skIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        const validTarget = villagers[0]?.[1].seat ?? 0;

        // Both spiritKnight and wolf are wolf faction
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), skIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        // Wait for wolf kill step
        const wolfTurn = await waitForRoleTurn(pages[allWolfIndices[0]!]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);

        // First wolf tries to vote spiritKnight -> confirm -> rejection
        await clickSeatAndConfirm(pages[allWolfIndices[0]!]!, skSeat);

        // Should see rejection alert (server rejects -> actionRejected shows '操作失败')
        const rejectionText = await readAlertText(pages[allWolfIndices[0]!]!);
        expect(rejectionText).toContain('操作失败');
        await dismissAlert(pages[allWolfIndices[0]!]!);

        // Re-vote on valid target
        await driveWolfVote(pages, allWolfIndices, validTarget);

        // Night should complete normally
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // SpiritKnight — witch poison reflects -> witch dies, SK survives
  // --------------------------------------------------------------------------
  test('witch poisons spiritKnight → poison reflects → witch dies', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['witch'],
            wolfRoles: ['spiritKnight'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        const skIdx = findRolePageIndex(roleMap, '恶灵骑士');
        expect(wolfIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);
        expect(skIdx).not.toBe(-1);

        const skSeat = roleMap.get(skIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        const killSeat = villagers[0]?.[1].seat ?? 0;

        // Both spiritKnight and wolf are wolf faction
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), skIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        // Wolf kills a villager
        const wolfTurn = await waitForRoleTurn(pages[allWolfIndices[0]!]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killSeat);

        // Witch's turn — dismiss save info, then poison spiritKnight
        const witchTurn = await waitForRoleTurn(pages[witchIdx]!, 'witchAction', pages);
        expect(witchTurn).toBe(true);
        await dismissAlert(pages[witchIdx]!);
        await clickSeatAndConfirm(pages[witchIdx]!, skSeat);

        // Night ends
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);

        // Verify: witch should be dead (reflection), SK should survive
        const nightInfo = await viewLastNightInfo(pages[0]!);
        expect(nightInfo, 'Should have deaths (witch dies from reflection)').toContain('昨夜死亡');
      },
    );
  });

  // --------------------------------------------------------------------------
  // Dreamcatcher link death — DC dies -> dream target dies too
  // --------------------------------------------------------------------------
  test('dreamcatcher dies → dream target link-dies', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['witch', 'dreamcatcher'],
          }),
      },
      async ({ pages, roleMap }) => {
        const dcIdx = findRolePageIndex(roleMap, '摄梦人');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(dcIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const dcSeat = roleMap.get(dcIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        const villagerSeat = villagers[0]?.[1].seat ?? 0;

        // Dreamcatcher dreams the villager
        const dcTurn = await waitForRoleTurn(pages[dcIdx]!, 'dreamcatcherDream', pages);
        expect(dcTurn).toBe(true);
        await clickSeatAndConfirm(pages[dcIdx]!, villagerSeat);

        // Wolf kills the dreamcatcher
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], dcSeat);

        // Witch skips (don't save DC)
        const witchTurn = await waitForRoleTurn(pages[witchIdx]!, 'witchAction', pages);
        expect(witchTurn).toBe(true);
        await dismissAlert(pages[witchIdx]!);
        await clickNightButton(pages[witchIdx]!, 'skip', '不用技能');
        await dismissAlert(pages[witchIdx]!);

        // Night ends — both DC and dream target should be dead (link death)
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);

        const nightInfo = await viewLastNightInfo(pages[0]!);
        expect(nightInfo, 'Should NOT be 平安夜 (DC + dream target both die)').not.toContain(
          '平安夜',
        );
      },
    );
  });
});
