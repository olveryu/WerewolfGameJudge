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
 * Night Roles E2E — HiddenWolf + Crow coverage.
 *
 * NIGHT_STEPS order: crowCurse -> wolfKill -> hiddenWolfReveal -> seerCheck
 *
 * Tests:
 * - Seer checks hiddenWolf -> reveals good (core mechanic)
 * - Crow curse action completes successfully
 * - Crow skips curse via "skip skill"
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Night Roles — HiddenWolf + Crow', () => {
  // --------------------------------------------------------------------------
  // Seer checks hiddenWolf -> good
  // Night order for this config: wolfKill -> hiddenWolfReveal -> seerCheck
  // --------------------------------------------------------------------------
  test('seer checks hiddenWolf → reveal shows 好人', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['seer'],
            wolfRoles: ['hiddenWolf'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        const hiddenWolfIdx = findRolePageIndex(roleMap, '隐狼');
        expect(wolfIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);
        expect(hiddenWolfIdx).not.toBe(-1);

        // Step 1: Wolf kill (wolfKill step)
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        const killTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Step 2: HiddenWolf confirm (hiddenWolfReveal step)
        // Confirm steps show an initial prompt alert → dismiss → then bottom button appears
        const hwTurn = await waitForRoleTurn(pages[hiddenWolfIdx]!, ['查看', '同伴'], pages, 120);
        expect(hwTurn, 'HiddenWolf turn should be detected').toBe(true);

        // Dismiss the initial "隐狼行动" prompt alert
        await dismissAlert(pages[hiddenWolfIdx]!);

        // Click "查看同伴" bottom button
        const clicked = await clickBottomButton(pages[hiddenWolfIdx]!, '查看同伴');
        expect(clicked).toBe(true);

        // Read the reveal — should show wolf teammate seat numbers (1-indexed display)
        const hwReveal = await readAlertText(pages[hiddenWolfIdx]!);
        const wolfSeat = roleMap.get(wolfIdx)!.seat;
        expect(hwReveal).toContain(`${wolfSeat + 1}号`);
        await dismissAlert(pages[hiddenWolfIdx]!);

        // Step 3: Seer check (seerCheck step)
        const seerTurn = await waitForRoleTurn(pages[seerIdx]!, ['查验', '选择'], pages, 120);
        expect(seerTurn, 'Seer turn should be detected').toBe(true);

        // Seer checks the hiddenWolf → should reveal Good
        const checkSeat = roleMap.get(hiddenWolfIdx)!.seat;
        await clickSeatAndConfirm(pages[seerIdx]!, checkSeat);

        // Read reveal — hiddenWolf should show as Good
        const revealText = await readAlertText(pages[seerIdx]!);
        expect(revealText).toContain(`${checkSeat + 1}号`);
        expect(revealText).toContain('好人');
        await dismissAlert(pages[seerIdx]!);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Crow curses a player successfully
  // Night order: crowCurse -> wolfKill (crow acts BEFORE wolf)
  // --------------------------------------------------------------------------
  test('crow curses a target -> action completes', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['crow'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const crowIdx = findRolePageIndex(roleMap, '乌鸦');
        expect(wolfIdx).not.toBe(-1);
        expect(crowIdx).not.toBe(-1);

        const villagerIndices = findAllRolePageIndices(roleMap, '平民');

        // Step 1: Crow curse (crowCurse step — BEFORE wolfKill)
        const crowTurn = await waitForRoleTurn(pages[crowIdx]!, ['诅咒', '选择'], pages, 120);
        expect(crowTurn, 'Crow turn should be detected').toBe(true);

        // Crow curses a villager
        const curseTarget = roleMap.get(villagerIndices[0]!)!.seat;
        await clickSeatAndConfirm(pages[crowIdx]!, curseTarget);

        // Step 2: Wolf kill (wolfKill step)
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        const killTarget = roleMap.get(villagerIndices[1]!)!.seat;
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Crow skips curse -> night completes normally
  // Night order: crowCurse -> wolfKill (crow acts BEFORE wolf)
  // --------------------------------------------------------------------------
  test('crow skips curse via 不用技能 → night completes', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['crow'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const crowIdx = findRolePageIndex(roleMap, '乌鸦');
        expect(wolfIdx).not.toBe(-1);
        expect(crowIdx).not.toBe(-1);

        // Step 1: Crow skip (crowCurse step — BEFORE wolfKill)
        const crowTurn = await waitForRoleTurn(pages[crowIdx]!, ['诅咒', '选择'], pages, 120);
        expect(crowTurn, 'Crow turn should be detected').toBe(true);

        // Dismiss initial prompt alert, then skip
        await dismissAlert(pages[crowIdx]!);
        const skipped = await clickBottomButton(pages[crowIdx]!, '不用技能');
        expect(skipped).toBe(true);

        // Confirm skip if alert appears
        await dismissAlert(pages[crowIdx]!);

        // Step 2: Wolf kill (wolfKill step)
        const villagerIdx = findRolePageIndex(roleMap, '平民');
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx]!, ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        const killTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });
});
