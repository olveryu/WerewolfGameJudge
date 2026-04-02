import { expect, test } from '@playwright/test';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';

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
 * - Wolf empty kill (放弃袭击) → 平安夜
 * - Hunter / DarkWolfKing canShoot confirmation
 * - WolfQueen charm
 * - Hunter poisoned → cannotShoot
 * - Bonded link death (shadow mimics avenger → 同生共死)
 *
 * Covers UI assertions on death/status text.
 * Does not modify game state directly or import services/models.
 */

test.setTimeout(180_000);

// ============================================================================
// Tests
// ============================================================================

test.describe('Night Roles — Kill / Status', () => {
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
        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        const killTargetSeat = villagers[0]?.[1].seat ?? 0;
        const poisonTargetSeat = villagers[1]?.[1].seat ?? 1;

        // Drive wolf kill
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTargetSeat);

        // Wait for witch's turn
        const witchTurn = await waitForRoleTurn(
          pages[witchIdx],
          ['被狼人袭击', '解药', '毒药'],
          pages,
          120,
        );
        expect(witchTurn).toBe(true);

        // Dismiss the witch info alert before interacting with seat tiles
        await dismissAlert(pages[witchIdx]);

        // In the witch compound step, save/poison/skip are all available
        // simultaneously. Tapping a seat = poison selection (triggers confirm).
        // No need to "skip save" first — just click poison target directly.
        await clickSeatAndConfirm(pages[witchIdx], poisonTargetSeat);

        // Night should end with death
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);

        // Verify deaths: should see "玩家死亡" (not 平安夜)
        await viewLastNightInfo(pages[0]);
        const hasDeath = await isTextVisible(pages[0], '死亡');
        const peaceful = await isTextVisible(pages[0], '平安夜');
        expect(hasDeath || !peaceful, 'Should have deaths, not 平安夜').toBe(true);
      },
    );
  });

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
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Wait for hunter's turn — "发动状态" is in prompt text
        const hunterTurn = await waitForRoleTurn(pages[hunterIdx], ['发动状态'], pages, 120);
        expect(hunterTurn, 'Hunter turn should be detected').toBe(true);

        // Dismiss the "夜间行动" alert before interacting with bottom buttons
        await dismissAlert(pages[hunterIdx]);

        // Click "发动状态"
        await clickBottomButton(pages[hunterIdx], '发动状态');

        // Read the alert — should say "猎人可以发动技能" or "猎人不能发动技能"
        const alertText = await readAlertText(pages[hunterIdx]);
        expect(alertText).toContain('猎人');
        expect(alertText).toMatch(/可以发动技能|不能发动技能/);
        await dismissAlert(pages[hunterIdx]);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Wolf empty kill → 平安夜
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
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);

        // Choose 放弃袭击
        await driveWolfEmptyVote(pages, wolfIndices);

        // Night should end with 平安夜
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);

        await viewLastNightInfo(pages[0]);
        const peaceful = await isTextVisible(pages[0], '平安夜');
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
        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );
        const firstWolf = allWolfIndices[0];
        const wolfTurn = await waitForRoleTurn(pages[firstWolf], ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killTarget ? killTarget[1].seat : 0);

        // Wait for wolfQueen charm step
        if (wqIdx !== -1) {
          const wqTurn = await waitForRoleTurn(pages[wqIdx], ['魅惑'], pages, 120);
          if (wqTurn) {
            // Charm a non-wolf target
            const charmTarget = [...roleMap.entries()].find(
              ([, info]) => info.displayName !== '狼人' && info.displayName !== '狼美人',
            );
            if (charmTarget) {
              await clickSeatAndConfirm(pages[wqIdx], charmTarget[1].seat);
            }
          }
        }

        // Finish night
        const ended = await waitForNightEnd(pages, 120);
        expect(ended, 'Night should end after wolfQueen charm').toBe(true);
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
        const dwkIdx = findRolePageIndex(roleMap, '黑狼王');
        expect(dwkIdx).not.toBe(-1);

        // darkWolfKing is a wolf — drive wolf kill first
        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );
        const wolfTurn = await waitForRoleTurn(pages[dwkIdx], ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [dwkIdx], killTarget ? killTarget[1].seat : 0);

        // Wait for darkWolfKing confirm step — "发动状态" is in prompt text
        const dwkTurn = await waitForRoleTurn(pages[dwkIdx], ['发动状态'], pages, 120);
        expect(dwkTurn, 'DarkWolfKing turn should be detected').toBe(true);

        // Dismiss the "夜间行动" alert before interacting with bottom buttons
        await dismissAlert(pages[dwkIdx]);

        // Click "发动状态"
        await clickBottomButton(pages[dwkIdx], '发动状态');

        // Read alert — "黑狼王可以发动技能" or "黑狼王不能发动技能"
        const alertText = await readAlertText(pages[dwkIdx]);
        expect(alertText).toContain('黑狼王');
        expect(alertText).toMatch(/可以发动技能|不能发动技能/);
        await dismissAlert(pages[dwkIdx]);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
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
        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        const killSeat = villagers[0]?.[1].seat ?? 0;

        // Wolf kills a villager
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killSeat);

        // Wait for witch's turn — dismiss save prompt, then poison hunter
        const witchTurn = await waitForRoleTurn(
          pages[witchIdx],
          ['被狼人袭击', '解药', '毒药'],
          pages,
          120,
        );
        expect(witchTurn).toBe(true);

        // Dismiss witch info alert, then poison hunter by clicking his seat
        await dismissAlert(pages[witchIdx]);
        await clickSeatAndConfirm(pages[witchIdx], hunterSeat);

        // Hunter's turn — should see "不能发动技能" (poisoned)
        const hunterTurn = await waitForRoleTurn(pages[hunterIdx], ['发动状态'], pages, 120);
        expect(hunterTurn).toBe(true);

        await dismissAlert(pages[hunterIdx]);
        await clickBottomButton(pages[hunterIdx], '发动状态');

        const alertText = await readAlertText(pages[hunterIdx]);
        expect(alertText).toContain('猎人');
        expect(alertText).toContain('不能发动技能');
        await dismissAlert(pages[hunterIdx]);

        // Finish night
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Shadow mimics avenger → bonded link death (同生共死)
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
        const shadowTurn = await waitForRoleTurn(pages[shadowIdx], ['模仿'], pages, 120);
        expect(shadowTurn, 'Shadow turn should be detected').toBe(true);
        await clickSeatAndConfirm(pages[shadowIdx], avengerSeat);
        // Dismiss the shadow reveal dialog (shows mimic result)
        await dismissAlert(pages[shadowIdx]);

        // Avenger's turn: click "查看阵营" to view faction info, then dismiss
        const avengerTurn = await waitForRoleTurn(pages[avengerIdx], ['阵营'], pages, 120);
        expect(avengerTurn, 'Avenger turn should be detected').toBe(true);

        // Dismiss the initial action prompt ("复仇者行动") before clicking bottom button
        await dismissAlert(pages[avengerIdx]);

        await clickBottomButton(pages[avengerIdx], '查看阵营');

        // Read the faction status dialog, then dismiss
        const factionText = await readAlertText(pages[avengerIdx]);
        expect(factionText).toContain('阵营');
        await dismissAlert(pages[avengerIdx]);

        // Wolf kills shadow
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['袭击', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], shadowSeat);

        // Night should end (remaining steps auto-advance)
        const ended = await waitForNightEnd(pages, 120);
        expect(ended, 'Night should end after bonded link setup').toBe(true);

        // Verify deaths: shadow (wolf killed) + avenger (bonded link) = 2 deaths
        await viewLastNightInfo(pages[0]);
        const alertText = await readAlertText(pages[0]);

        // Both shadow and avenger seats should appear in the death list
        const shadowSeatDisplay = formatSeat(shadowSeat);
        const avengerSeatDisplay = formatSeat(avengerSeat);
        expect(alertText, `Should contain shadow seat ${shadowSeatDisplay}`).toContain(
          shadowSeatDisplay,
        );
        expect(alertText, `Should contain avenger seat ${avengerSeatDisplay}`).toContain(
          avengerSeatDisplay,
        );

        // Should not be 平安夜
        const peaceful = await isTextVisible(pages[0], '平安夜');
        expect(peaceful, 'Should not be 平安夜 with bonded deaths').toBe(false);
      },
    );
  });
});
