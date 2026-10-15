import { expect, test } from '@playwright/test';

import {
  clickBottomButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveMagicianSwap,
  driveWolfVote,
  findRolePageIndex,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Werewolf Night E2E — Completion.
 *
 * Night-completion smoke coverage: the night runs to its end when roles
 * finish, swap, choose, or voluntarily skip their action:
 * - Magician swap (basic flow), Slacker idol choice
 * - Seer & guard voluntary skip (skip ability)
 *
 * Covers night-end outcomes only; blocked-action coverage lives in
 * werewolf-night-block.spec.ts.
 * Does not modify game state directly or import services/models.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Werewolf Night — Completion', () => {
  // --------------------------------------------------------------------------
  // Magician swaps two players → night completes
  // --------------------------------------------------------------------------
  test('magician swaps two players → night completes', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['magician'],
          }),
      },
      async ({ pages, roleMap }) => {
        const magicianIdx = findRolePageIndex(roleMap, '魔术师');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(magicianIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Magician is the first step — wait for turn
        const magTurn = await waitForRoleTurn(pages[magicianIdx]!, ['交换', '选择'], pages, 120);
        expect(magTurn, 'Magician turn should be detected').toBe(true);

        // Swap the other two players
        const otherSeats = [...roleMap.entries()]
          .filter(([idx]) => idx !== magicianIdx)
          .map(([, info]) => info.seat);
        expect(otherSeats.length).toBeGreaterThanOrEqual(2);
        await driveMagicianSwap(pages[magicianIdx]!, otherSeats[0]!, otherSeats[1]!);

        // Drive wolf kill after magician
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        // Wolf kills any non-wolf target
        const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName !== '狼人');
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Finish night
        const ended = await waitForNightEnd(pages, 120);
        expect(ended, 'Night should end after magician swap').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Slacker chooses idol → night completes
  // --------------------------------------------------------------------------
  test('slacker chooses idol → night completes', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            specialRoles: ['slacker'],
          }),
      },
      async ({ pages, roleMap }) => {
        const slackerIdx = findRolePageIndex(roleMap, '混血儿');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(slackerIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Wait for slacker's turn (early in step order)
        const slackerTurn = await waitForRoleTurn(pages[slackerIdx]!, ['榜样', '选择'], pages, 120);
        expect(slackerTurn, 'Slacker turn should be detected').toBe(true);

        // Choose wolf as idol (any seat except self)
        const idolSeat = roleMap.get(wolfIdx)!.seat;
        await clickSeatAndConfirm(pages[slackerIdx]!, idolSeat);

        // Drive wolf kill
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        const villagerEntry = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '平民',
        );
        await driveWolfVote(pages, [wolfIdx], villagerEntry ? villagerEntry[1].seat : 0);

        // Finish night
        const ended = await waitForNightEnd(pages, 120);
        expect(ended, 'Night should end after slacker picks idol').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Seer skips action → night completes
  // --------------------------------------------------------------------------
  test('seer skips action (不用技能) → night completes', async ({ browser }) => {
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
        expect(wolfIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);

        // Drive wolf kill
        const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName === '平民');
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Seer's turn — skip via "不用技能"
        const seerTurn = await waitForRoleTurn(pages[seerIdx]!, ['查验', '选择'], pages, 120);
        expect(seerTurn).toBe(true);
        await dismissAlert(pages[seerIdx]!);
        await clickBottomButton(pages[seerIdx]!, '不用技能');

        // Confirm skip if alert appears
        await dismissAlert(pages[seerIdx]!);

        // Night should end
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Guard skips action → night completes
  // --------------------------------------------------------------------------
  test('guard skips action (不用技能) → night completes', async ({ browser }) => {
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
        expect(guardIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Guard's turn — skip via "不用技能"
        const guardTurn = await waitForRoleTurn(pages[guardIdx]!, ['守护', '选择'], pages, 120);
        expect(guardTurn).toBe(true);
        await dismissAlert(pages[guardIdx]!);
        await clickBottomButton(pages[guardIdx]!, '不用技能');
        await dismissAlert(pages[guardIdx]!);

        // Drive wolf kill
        const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName === '平民');
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Night should end
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });
});
