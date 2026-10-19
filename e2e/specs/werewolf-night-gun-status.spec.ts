import { expect, test } from '@playwright/test';

import {
  clickBottomButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  readAlertText,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { withSetup } from '../helpers/night-setup';

/**
 * Werewolf Night E2E — Gun status.
 *
 * Shoot-ability (canShoot) confirmation coverage:
 * - Hunter / DarkWolfKing confirm their own shoot status
 * - Witch poisons hunter → hunter sees cannot-shoot
 * - WolfRobot learns hunter → learned hunter gate (normal / poisoned)
 *
 * Covers UI assertions on status text.
 * Does not modify game state directly or import services/models.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Werewolf Night — Gun Status', () => {
  // --------------------------------------------------------------------------
  // Hunter confirms canShoot
  // --------------------------------------------------------------------------
  test('hunter confirms canShoot status', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['hunter'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const hunterIdx = findRolePageIndex(roleMap, '猎人');
        expect(hunterIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Drive wolf kill (target anyone except wolf)
        const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName !== '狼人');
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Wait for hunter's turn — "发动状态" is in prompt text
        const hunterTurn = await waitForRoleTurn(pages[hunterIdx]!, 'hunterConfirm', pages);
        expect(hunterTurn, 'Hunter turn should be detected').toBe(true);

        // Dismiss the "夜间行动" alert before interacting with bottom buttons
        await dismissAlert(pages[hunterIdx]!);

        // Click "发动状态"
        await clickBottomButton(pages[hunterIdx]!, '发动状态');

        // Read the alert — should say "猎人可以发动技能" or "猎人不能发动技能"
        const alertText = await readAlertText(pages[hunterIdx]!);
        expect(alertText).toContain('猎人');
        expect(alertText).toMatch(/可以发动技能|不能发动技能/);
        await dismissAlert(pages[hunterIdx]!);

        // Finish night
        const ended = await waitForNightEnd(pages, 90_000);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Dark Wolf King confirms status
  // --------------------------------------------------------------------------
  test('darkWolfKing confirms canShoot status', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 0,
            villagers: 2,
            wolfRoles: ['darkWolfKing'],
          }),
      },
      async ({ pages, roleMap }) => {
        const dwkIdx = findRolePageIndex(roleMap, '狼王');
        expect(dwkIdx).not.toBe(-1);

        // darkWolfKing is a wolf — drive wolf kill first
        const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName === '平民');
        const wolfTurn = await waitForRoleTurn(pages[dwkIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [dwkIdx], killTarget ? killTarget[1].seat : 0);

        // Wait for darkWolfKing confirm step — "发动状态" is in prompt text
        const dwkTurn = await waitForRoleTurn(pages[dwkIdx]!, 'darkWolfKingConfirm', pages);
        expect(dwkTurn, 'DarkWolfKing turn should be detected').toBe(true);

        // Dismiss the "夜间行动" alert before interacting with bottom buttons
        await dismissAlert(pages[dwkIdx]!);

        // Click "发动状态"
        await clickBottomButton(pages[dwkIdx]!, '发动状态');

        // Read alert — "狼王可以发动技能" or "狼王不能发动技能"
        const alertText = await readAlertText(pages[dwkIdx]!);
        expect(alertText).toContain('狼王');
        expect(alertText).toMatch(/可以发动技能|不能发动技能/);
        await dismissAlert(pages[dwkIdx]!);

        // Finish night
        const ended = await waitForNightEnd(pages, 90_000);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Witch poisons hunter → hunter cannotShoot
  // --------------------------------------------------------------------------
  test('witch poisons hunter → hunter sees 不能发动技能', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['witch', 'hunter'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        const hunterIdx = findRolePageIndex(roleMap, '猎人');
        expect(wolfIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);
        expect(hunterIdx).not.toBe(-1);

        const hunterSeat = roleMap.get(hunterIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(([, info]) => info.displayName === '平民');
        const killSeat = villagers[0]?.[1].seat ?? 0;

        // Wolf kills a villager
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killSeat);

        // Wait for witch's turn — dismiss save prompt, then poison hunter
        const witchTurn = await waitForRoleTurn(pages[witchIdx]!, 'witchAction', pages);
        expect(witchTurn).toBe(true);

        // Dismiss witch info alert, then poison hunter by clicking his seat
        await dismissAlert(pages[witchIdx]!);
        await clickSeatAndConfirm(pages[witchIdx]!, hunterSeat);

        // Hunter's turn — should see "不能发动技能" (poisoned)
        const hunterTurn = await waitForRoleTurn(pages[hunterIdx]!, 'hunterConfirm', pages);
        expect(hunterTurn).toBe(true);

        await dismissAlert(pages[hunterIdx]!);
        await clickBottomButton(pages[hunterIdx]!, '发动状态');

        const alertText = await readAlertText(pages[hunterIdx]!);
        expect(alertText).toContain('猎人');
        expect(alertText).toContain('不能发动技能');
        await dismissAlert(pages[hunterIdx]!);

        // Finish night
        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // WolfRobot learns hunter → hunter gate UI
  // --------------------------------------------------------------------------
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
        const wolfTurn = await waitForRoleTurn(pages[wolfIndices[0]!]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, wolfIndices, killSeat);

        // Wait for wolfRobot learn step
        const wrTurn = await waitForRoleTurn(pages[wrIdx]!, 'wolfRobotLearn', pages);
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
        const ended = await waitForNightEnd(pages);
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
        const wolfTurn = await waitForRoleTurn(pages[wolfIndices[0]!]!, 'wolfKill', pages);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, wolfIndices, killSeat);

        // Witch turn — witch acts before wolfRobot (NIGHT_STEP_ORDER: witchAction < wolfRobotLearn).
        // Skip save (don't click use-antidote), poison the wolfRobot via seat tap (compound step:
        // seat tap is always poison selection — see useRoomActions.ts).
        const witchTurn = await waitForRoleTurn(pages[witchIdx]!, 'witchAction', pages);
        expect(witchTurn, 'Witch turn should be detected').toBe(true);
        await dismissAlert(pages[witchIdx]!);
        await clickSeatAndConfirm(pages[witchIdx]!, wrSeat);

        // wolfRobot learns hunter
        const wrTurn = await waitForRoleTurn(pages[wrIdx]!, 'wolfRobotLearn', pages);
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

        const ended = await waitForNightEnd(pages);
        expect(ended).toBe(true);
      },
    );
  });
});
