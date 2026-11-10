import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import {
  clickNightButton,
  dismissAlert,
  driveGroupConfirmAck,
  driveMultiSelect,
  driveWolfVote,
  findRolePageIndex,
  viewLastNightInfo,
  waitForGroupConfirmStep,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Night Roles E2E — Piper coverage.
 *
 * Tests multiChooseSeat hypnotize and groupConfirm reveal:
 * - Piper hypnotizes 1 target → all players confirm → night ends with death
 * - Piper hypnotizes 2 targets → verify reveal text for both hypnotized and non-hypnotized
 * - Piper skips → night ends normally
 *
 * Covers the first multiChooseSeat schema in E2E (no single-confirm alert;
 * seats toggle selection, then bottom-panel "确认催眠（N人）" submits).
 * Does not modify game state directly or import services/models.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Werewolf Night — Piper (吹笛者)', () => {
  // --------------------------------------------------------------------------
  // Piper hypnotizes 1 target → all ack → night ends with death
  // --------------------------------------------------------------------------
  test('piper hypnotizes 1 target → groupConfirm reveals → night ends', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            specialRoles: ['piper'],
          }),
      },
      async ({ pages, roleMap }) => {
        const piperIdx = findRolePageIndex(roleMap, '吹笛者');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        expect(piperIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const villagerSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;

        // === Wolf kills villager ===
        await test.step('wolf kills villager', async () => {
          const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
          expect(wolfTurn, 'Wolf turn should be detected').toBe(true);
          await driveWolfVote(pages, [wolfIdx], villagerSeat);
        });

        // === Piper hypnotizes wolf ===
        const wolfSeat = roleMap.get(wolfIdx)!.seat;
        await test.step('piper hypnotizes wolf', async () => {
          const piperTurn = await waitForRoleTurn(pages[piperIdx]!, 'piperHypnotize', pages);
          expect(piperTurn, 'Piper turn should be detected').toBe(true);
          await driveMultiSelect(pages[piperIdx]!, [wolfSeat], '确认催眠（1人）');
        });

        // === GroupConfirm: all players ack ===
        await test.step('all players ack groupConfirm', async () => {
          const groupReady = await waitForGroupConfirmStep(pages, '催眠状态', 60);
          expect(groupReady, 'GroupConfirm step should become active').toBe(true);

          // Each player acks — check personal messages
          for (let i = 0; i < pages.length; i++) {
            const page = pages[i]!;
            const role = roleMap.get(i);
            if (!role) continue;

            const msg = await driveGroupConfirmAck(page, '催眠状态', '知道了');
            const seat = role.seat;

            if (seat === wolfSeat) {
              // Wolf was hypnotized → should see hypnotized message
              expect(msg).toContain('催眠');
            } else if (seat === roleMap.get(piperIdx)!.seat) {
              // Piper itself — not hypnotized (NotSelf constraint)
              expect(msg).toContain('未被催眠');
            }
          }
        });

        // === Night ends ===
        await test.step('night ends with death', async () => {
          const ended = await waitForNightEnd(pages);
          expect(ended, 'Night should have ended').toBe(true);

          const nightInfo = await viewLastNightInfo(pages[0]!);
          expect(nightInfo, 'Villager should have died').toContain('昨夜死亡');
        });
      },
    );
  });

  // --------------------------------------------------------------------------
  // Piper hypnotizes 2 targets → verify hypnotized & non-hypnotized text
  // --------------------------------------------------------------------------
  test('piper hypnotizes 2 targets → correct reveal messages', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            specialRoles: ['piper'],
          }),
      },
      async ({ pages, roleMap }) => {
        const piperIdx = findRolePageIndex(roleMap, '吹笛者');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(piperIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Find two non-piper targets to hypnotize
        const nonPiperEntries = [...roleMap.entries()].filter(([idx]) => idx !== piperIdx);
        const target1Seat = nonPiperEntries[0]![1].seat;
        const target2Seat = nonPiperEntries[1]![1].seat;

        // Pick a villager for wolf to kill
        const villagerEntry = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '平民',
        );
        const killTarget = villagerEntry ? villagerEntry[1].seat : 0;

        // === Wolf kills ===
        await test.step('wolf kills villager', async () => {
          const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
          expect(wolfTurn).toBe(true);
          await driveWolfVote(pages, [wolfIdx], killTarget);
        });

        // === Piper hypnotizes 2 targets ===
        await test.step('piper hypnotizes 2 targets', async () => {
          const piperTurn = await waitForRoleTurn(pages[piperIdx]!, 'piperHypnotize', pages);
          expect(piperTurn).toBe(true);
          await driveMultiSelect(pages[piperIdx]!, [target1Seat, target2Seat], '确认催眠（2人）');
        });

        // === GroupConfirm: verify messages ===
        await test.step('groupConfirm reveals correct messages', async () => {
          const groupReady = await waitForGroupConfirmStep(pages, '催眠状态', 60);
          expect(groupReady).toBe(true);

          const hypnotizedSeats = [target1Seat, target2Seat];

          for (let i = 0; i < pages.length; i++) {
            const role = roleMap.get(i);
            if (!role) continue;

            const msg = await driveGroupConfirmAck(pages[i]!, '催眠状态', '知道了');

            if (hypnotizedSeats.includes(role.seat)) {
              // Hypnotized player sees seat list
              expect(msg).toContain('催眠');
              expect(msg).toContain(formatSeat(target1Seat));
              expect(msg).toContain(formatSeat(target2Seat));
            } else {
              // Non-hypnotized (piper or other players)
              expect(msg).toContain('未被催眠');
            }
          }
        });

        // === Night ends ===
        await test.step('night ends', async () => {
          const ended = await waitForNightEnd(pages);
          expect(ended).toBe(true);
        });
      },
    );
  });

  // --------------------------------------------------------------------------
  // Piper skips (skip ability) → night ends normally
  // --------------------------------------------------------------------------
  test('piper skips → night ends normally', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            specialRoles: ['piper'],
          }),
      },
      async ({ pages, roleMap }) => {
        const piperIdx = findRolePageIndex(roleMap, '吹笛者');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        expect(piperIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const villagerSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;

        // === Wolf kills villager ===
        await test.step('wolf kills villager', async () => {
          const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
          expect(wolfTurn).toBe(true);
          await driveWolfVote(pages, [wolfIdx], villagerSeat);
        });

        // === Piper skips ===
        await test.step('piper skips with 不用技能', async () => {
          const piperTurn = await waitForRoleTurn(pages[piperIdx]!, 'piperHypnotize', pages);
          expect(piperTurn).toBe(true);
          // Dismiss action prompt alert first
          await dismissAlert(pages[piperIdx]!);
          // Click "不用技能" skip button
          await clickNightButton(pages[piperIdx]!, 'skip', '不用技能');

          // Confirm skip alert ("确认跳过" dialog with "确定" button)
          await expect(pages[piperIdx]!.getByTestId(TESTIDS.alertModal)).toBeVisible({
            timeout: 5000,
          });
          await dismissAlert(pages[piperIdx]!);
        });

        // === GroupConfirm: even when skipped, all ack (0 hypnotized) ===
        await test.step('all players ack groupConfirm (no one hypnotized)', async () => {
          const groupReady = await waitForGroupConfirmStep(pages, '催眠状态', 60);
          expect(groupReady).toBe(true);

          for (let i = 0; i < pages.length; i++) {
            const msg = await driveGroupConfirmAck(pages[i]!, '催眠状态', '知道了');
            // Everyone should see "未被催眠" since piper skipped
            expect(msg).toContain('未被催眠');
          }
        });

        // === Night ends with death ===
        await test.step('night ends with death', async () => {
          const ended = await waitForNightEnd(pages);
          expect(ended).toBe(true);

          const nightInfo = await viewLastNightInfo(pages[0]!);
          expect(nightInfo, 'Villager should have died').toContain('昨夜死亡');
        });
      },
    );
  });
});
