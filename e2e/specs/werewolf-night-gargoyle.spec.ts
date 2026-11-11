import { expect, test } from '@playwright/test';

import {
  clickSeatAndConfirm,
  driveGroupConfirmAck,
  driveWolfVote,
  findRolePageIndex,
  viewLastNightInfo,
  waitForGroupConfirmStep,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Night Roles E2E — Awakened Gargoyle coverage.
 *
 * Tests chooseSeat convert and groupConfirm reveal:
 * - Gargoyle converts adjacent non-wolf -> all players ack -> night ends
 * - Verify personal messages: converted player sees "转化为狼人阵营", others see "未被转化"
 *
 * The awakened gargoyle is a wolf role with mandatory convert (canSkip: false).
 * Night step order: wolfKill -> awakenedGargoyleConvert -> awakenedGargoyleConvertReveal -> ...
 * Does not modify game state directly or import services/models.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Werewolf Night — Awakened Gargoyle (觉醒石像鬼)', () => {
  // --------------------------------------------------------------------------
  // Gargoyle converts adjacent villager → all ack → night ends with death
  // --------------------------------------------------------------------------
  test('gargoyle converts villager → groupConfirm reveals → night ends', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 0,
            villagers: 2,
            wolfRoles: ['awakenedGargoyle'],
          }),
      },
      async ({ pages, roleMap }) => {
        const gargoyleIdx = findRolePageIndex(roleMap, '觉醒石像鬼');
        expect(gargoyleIdx).not.toBe(-1);

        // Find villager seats (non-gargoyle players)
        const villagerEntries = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '平民',
        );
        expect(villagerEntries.length).toBe(2);

        const killTargetSeat = villagerEntries[0]![1].seat;
        const convertTargetSeat = villagerEntries[1]![1].seat;

        // === Wolf (gargoyle) kills villager ===
        await test.step('gargoyle kills villager via wolf vote', async () => {
          await test.step('Wolf turn should be detected', () =>
            waitForRoleTurn(pages[gargoyleIdx]!, 'wolfKill', pages));
          await driveWolfVote(pages, [gargoyleIdx], killTargetSeat);
        });

        // === Gargoyle converts adjacent non-wolf villager ===
        await test.step('gargoyle converts villager', async () => {
          await test.step('Gargoyle convert turn should be detected', () =>
            waitForRoleTurn(pages[gargoyleIdx]!, 'awakenedGargoyleConvert', pages));
          await test.step('Gargoyle should have confirmed convert', () =>
            clickSeatAndConfirm(pages[gargoyleIdx]!, convertTargetSeat));
        });

        // === GroupConfirm: all players ack convert reveal ===
        await test.step('all players ack convert reveal', async () => {
          await test.step('ConvertReveal step should become active', () =>
            waitForGroupConfirmStep(pages, '转化状态'));

          for (let i = 0; i < pages.length; i++) {
            const role = roleMap.get(i);
            if (!role) continue;

            const msg = await driveGroupConfirmAck(pages[i]!, '转化状态', '知道了');

            if (role.seat === convertTargetSeat) {
              // Converted player sees conversion message
              expect(msg).toContain('转化为狼人阵营');
            } else {
              // Everyone else (including gargoyle) sees "未被转化"
              expect(msg).toContain('未被转化');
            }
          }
        });

        // === Night ends ===
        await test.step('night ends with death', async () => {
          await test.step('Night should have ended', () => waitForNightEnd(pages));

          const nightInfo = await viewLastNightInfo(pages[0]!);
          expect(nightInfo, 'Killed villager should have died').toContain('昨夜死亡');
        });
      },
    );
  });

  // --------------------------------------------------------------------------
  // Verify correct personal messages for all players
  // --------------------------------------------------------------------------
  test('converted player sees 转化 message, others see 未被转化', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            wolfRoles: ['awakenedGargoyle'],
          }),
      },
      async ({ pages, roleMap }) => {
        const gargoyleIdx = findRolePageIndex(roleMap, '觉醒石像鬼');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(gargoyleIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Find villager entries
        const villagerEntries = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '平民',
        );
        expect(villagerEntries.length).toBe(2);

        const killTargetSeat = villagerEntries[0]![1].seat;
        // Pick the other villager for conversion — must be adjacent to wolf faction
        // With circular seating, in a 4-player game all seats are within 2 hops,
        // but AdjacentToWolfFaction requires direct adjacency. Pick a villager
        // adjacent to gargoyle or wolf.
        const gargoyleSeat = roleMap.get(gargoyleIdx)!.seat;
        const wolfSeat = roleMap.get(wolfIdx)!.seat;

        // Find a villager adjacent to any wolf-faction player
        const convertCandidate = villagerEntries.find(([, info]) => {
          const seat = info.seat;
          const totalPlayers = 4;
          for (const wolfFactionSeat of [gargoyleSeat, wolfSeat]) {
            const diff = Math.abs(seat - wolfFactionSeat);
            if (diff === 1 || diff === totalPlayers - 1) return true;
          }
          return false;
        });
        expect(convertCandidate, 'Should find an adjacent villager to convert').toBeDefined();
        const convertTargetSeat = convertCandidate![1].seat;

        // === Wolves kill villager ===
        await test.step('wolves kill villager', async () => {
          await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
          // Both wolf-faction players participate in wolf meeting
          await driveWolfVote(pages, [wolfIdx, gargoyleIdx], killTargetSeat);
        });

        // === Gargoyle converts ===
        await test.step('gargoyle converts adjacent villager', async () => {
          await waitForRoleTurn(pages[gargoyleIdx]!, 'awakenedGargoyleConvert', pages);
          await clickSeatAndConfirm(pages[gargoyleIdx]!, convertTargetSeat);
        });

        // === GroupConfirm: verify exact messages ===
        await test.step('verify personal messages for all players', async () => {
          await waitForGroupConfirmStep(pages, '转化状态');

          const messages: string[] = [];
          for (let i = 0; i < pages.length; i++) {
            const msg = await driveGroupConfirmAck(pages[i]!, '转化状态', '知道了');
            messages.push(msg);

            const role = roleMap.get(i);
            if (!role) continue;

            if (role.seat === convertTargetSeat) {
              expect(msg).toContain('转化为狼人阵营');
              expect(msg).not.toContain('未被转化');
            } else {
              expect(msg).toContain('未被转化');
              expect(msg).not.toContain('转化为狼人阵营');
            }
          }
        });

        // === Night ends ===
        await test.step('night ends', async () => {
          await waitForNightEnd(pages);
        });
      },
    );
  });
});
