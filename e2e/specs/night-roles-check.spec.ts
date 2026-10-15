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
