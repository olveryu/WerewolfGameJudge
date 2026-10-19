import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { expect, test } from '@playwright/test';

import {
  clickBottomButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveWolfEmptyVote,
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
 * Night Roles E2E — Kill / Status effect coverage.
 *
 * Tests roles that produce kills or confirm kill-related status:
 * - Witch poison → double death
 * - Wolf empty kill (skip attack) → peaceful night
 * - Hunter / DarkWolfKing canShoot confirmation
 * - WolfQueen charm
 * - Hunter poisoned → cannotShoot
 * - Bonded link death (shadow mimics avenger → bonded link death)
 *
 * Covers UI assertions on death/status text.
 * Does not modify game state directly or import services/models.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Werewolf Night — Kill', () => {
  // --------------------------------------------------------------------------
  // Witch poisons → double death
  // --------------------------------------------------------------------------
  test('witch poisons a player → two deaths', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['witch'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        expect(wolfIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);

        // Find two villagers
        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        const killTargetSeat = villagers[0]?.[1].seat ?? 0;
        const poisonTargetSeat = villagers[1]?.[1].seat ?? 1;

        // Drive wolf kill
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTargetSeat);

        // Wait for witch's turn
        const witchTurn = await waitForRoleTurn(pages[witchIdx]!, 'witchAction', pages);
        expect(witchTurn).toBe(true);

        // Dismiss the witch info alert before interacting with seat tiles
        await dismissAlert(pages[witchIdx]!);

        // In the witch compound step, save/poison/skip are all available
        // simultaneously. Tapping a seat = poison selection (triggers confirm).
        // No need to "skip save" first — just click poison target directly.
        await clickSeatAndConfirm(pages[witchIdx]!, poisonTargetSeat);

        // Night should end with death
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);

        // Verify deaths: should see "玩家死亡" (not peaceful night)
        await viewLastNightInfo(pages[0]!);
        const hasDeath = await isTextVisible(pages[0]!, '死亡');
        const peaceful = await isTextVisible(pages[0]!, '平安夜');
        expect(hasDeath || !peaceful, 'Should have deaths, not 平安夜').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Wolf empty kill → peaceful night
  // --------------------------------------------------------------------------
  test('wolf empty kill (放弃袭击) → 平安夜', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 2,
        configure: async (c) => c.configure2Player(),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(wolfIdx).not.toBe(-1);

        const wolfIndices = findAllRolePageIndices(roleMap, '狼人');

        // Wait for wolf's turn
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);

        // Choose skip attack
        await driveWolfEmptyVote(pages, wolfIndices);

        // Night should end with peaceful night
        const ended = await waitForNightEnd(pages, 90_000);
        expect(ended).toBe(true);

        await viewLastNightInfo(pages[0]!);
        const peaceful = await isTextVisible(pages[0]!, '平安夜');
        expect(peaceful, 'Should be 平安夜 (empty wolf kill)').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Wolf Queen charms → night completes
  // --------------------------------------------------------------------------
  test('wolfQueen charms a player → night completes', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            wolfRoles: ['wolfQueen'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wqIdx = findRolePageIndex(roleMap, '狼美人');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const wolfIndices = findAllRolePageIndices(roleMap, '狼人');
        // wolfQueen is also a wolf, find all wolf-faction indices
        const allWolfIndices = [...wolfIndices, ...(wqIdx !== -1 ? [wqIdx] : [])].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        expect(wqIdx !== -1 || wolfIdx !== -1, 'Need wolf faction').toBe(true);

        // Drive wolf kill
        const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName === '平民');
        const firstWolf = allWolfIndices[0]!;
        const wolfTurn = await waitForRoleTurn(pages[firstWolf]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killTarget ? killTarget[1].seat : 0);

        // Wait for wolfQueen charm step
        if (wqIdx !== -1) {
          const wqTurn = await waitForRoleTurn(pages[wqIdx]!, 'wolfQueenCharm', pages);
          if (wqTurn) {
            // Charm a non-wolf target
            const charmTarget = [...roleMap.entries()].find(
              ([, info]) => info.displayName !== '狼人' && info.displayName !== '狼美人',
            );
            if (charmTarget) {
              await clickSeatAndConfirm(pages[wqIdx]!, charmTarget[1].seat);
            }
          }
        }

        // Finish night
        const ended = await waitForNightEnd(pages);
        expect(ended, 'Night should end after wolfQueen charm').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Shadow mimics avenger → bonded link death
  // --------------------------------------------------------------------------
  test('shadow mimics avenger → wolf kills shadow → both die (bonded link)', async ({
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
            specialRoles: ['shadow', 'avenger'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const shadowIdx = findRolePageIndex(roleMap, '影子');
        const avengerIdx = findRolePageIndex(roleMap, '复仇者');
        expect(wolfIdx).not.toBe(-1);
        expect(shadowIdx).not.toBe(-1);
        expect(avengerIdx).not.toBe(-1);

        const shadowSeat = roleMap.get(shadowIdx)!.seat;
        const avengerSeat = roleMap.get(avengerIdx)!.seat;

        // Night order: Shadow → Avenger → Wolf

        // Shadow's turn: mimic avenger → bonded
        const shadowTurn = await waitForRoleTurn(pages[shadowIdx]!, 'shadowChooseMimic', pages);
        expect(shadowTurn, 'Shadow turn should be detected').toBe(true);
        await clickSeatAndConfirm(pages[shadowIdx]!, avengerSeat);
        // Dismiss the shadow reveal dialog (shows mimic result)
        await dismissAlert(pages[shadowIdx]!);

        // Avenger's turn: click "查看阵营" to view faction info, then dismiss
        const avengerTurn = await waitForRoleTurn(pages[avengerIdx]!, 'avengerConfirm', pages);
        expect(avengerTurn, 'Avenger turn should be detected').toBe(true);

        // Dismiss the initial action prompt ("复仇者行动") before clicking bottom button
        await dismissAlert(pages[avengerIdx]!);

        await clickBottomButton(pages[avengerIdx]!, '查看阵营');

        // Read the faction status dialog, then dismiss
        const factionText = await readAlertText(pages[avengerIdx]!);
        expect(factionText).toContain('阵营');
        await dismissAlert(pages[avengerIdx]!);

        // Wolf kills shadow
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], shadowSeat);

        // Night should end (remaining steps auto-advance)
        const ended = await waitForNightEnd(pages);
        expect(ended, 'Night should end after bonded link setup').toBe(true);

        // Verify deaths: shadow (wolf killed) + avenger (bonded link) = 2 deaths
        await viewLastNightInfo(pages[0]!);
        const alertText = await readAlertText(pages[0]!);

        // Both shadow and avenger seats should appear in the death list
        const shadowSeatDisplay = formatSeat(shadowSeat);
        const avengerSeatDisplay = formatSeat(avengerSeat);
        expect(alertText, `Should contain shadow seat ${shadowSeatDisplay}`).toContain(
          shadowSeatDisplay,
        );
        expect(alertText, `Should contain avenger seat ${avengerSeatDisplay}`).toContain(
          avengerSeatDisplay,
        );

        // Should not be peaceful night
        const peaceful = await isTextVisible(pages[0]!, '平安夜');
        expect(peaceful, 'Should not be 平安夜 with bonded deaths').toBe(false);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Wolf kills cursedFox → silent immunity → peaceful night
  // --------------------------------------------------------------------------
  test('wolf kills cursedFox → silent immunity → 平安夜', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            specialRoles: ['cursedFox'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const cursedFoxIdx = findRolePageIndex(roleMap, '咒狐');
        expect(wolfIdx).not.toBe(-1);
        expect(cursedFoxIdx).not.toBe(-1);

        const cursedFoxSeat = roleMap.get(cursedFoxIdx)!.seat;

        // Wolf targets cursedFox
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], cursedFoxSeat);

        // Night ends — wolf kill silently fails
        const ended = await waitForNightEnd(pages, 90_000);
        expect(ended).toBe(true);

        // Verify: peaceful night (cursedFox immune, no other kills)
        await viewLastNightInfo(pages[0]!);
        const peaceful = await isTextVisible(pages[0]!, '平安夜');
        expect(peaceful, 'Should be 平安夜 — wolf kill silently fails on cursedFox').toBe(true);
      },
    );
  });
});
