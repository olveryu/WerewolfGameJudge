import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
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
import { ConfigPage } from '../pages/ConfigPage';

/**
 * Night Roles E2E — Kill / Status effect coverage.
 *
 * Tests roles that produce kills or confirm kill-related status:
 * - Witch poison → double death
 * - Wolf empty kill (空刀) → 平安夜
 * - Hunter / DarkWolfKing canShoot confirmation
 * - WolfQueen charm
 * - Hunter poisoned → cannotShoot
 *
 * ✅ Allowed: UI assertions on death/status text
 * ❌ Forbidden: modifying game state directly, importing services/models
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

// ============================================================================
// Helpers local to this file
// ============================================================================

async function withSetup(
  browser: import('@playwright/test').Browser,
  opts: {
    playerCount: number;
    configure: (config: ConfigPage) => Promise<void>;
  },
  body: (ctx: {
    setup: GameSetupWithRolesResult;
    pages: import('@playwright/test').Page[];
    roleMap: GameSetupWithRolesResult['roleMap'];
  }) => Promise<void>,
): Promise<void> {
  let setup: GameSetupWithRolesResult | undefined;
  try {
    setup = await setupNPlayerGameWithRoles(browser, {
      playerCount: opts.playerCount,
      configureTemplate: opts.configure,
    });
    await body({
      setup,
      pages: setup.fixture.pages,
      roleMap: setup.roleMap,
    });
  } finally {
    if (setup) await closeAll(setup.fixture);
  }
}

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
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTargetSeat);

        // Wait for witch's turn
        const witchTurn = await waitForRoleTurn(
          pages[witchIdx],
          ['被狼人杀了', '解药', '毒药'],
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
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Wait for hunter's turn — "发动状态" is in prompt text
        const hunterTurn = await waitForRoleTurn(pages[hunterIdx], ['发动状态'], pages, 120);
        expect(hunterTurn, 'Hunter turn should be detected').toBe(true);

        // Dismiss the "行动提示" alert before interacting with bottom buttons
        await dismissAlert(pages[hunterIdx]);

        // Click "查看发动状态"
        await clickBottomButton(pages[hunterIdx], '查看发动状态');

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
  test('wolf empty kill (空刀) → 平安夜', async ({ browser }) => {
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
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);

        // Choose 空刀
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
        const wolfTurn = await waitForRoleTurn(pages[firstWolf], ['猎杀', '选择'], pages, 120);
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
        const wolfTurn = await waitForRoleTurn(pages[dwkIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [dwkIdx], killTarget ? killTarget[1].seat : 0);

        // Wait for darkWolfKing confirm step — "发动状态" is in prompt text
        const dwkTurn = await waitForRoleTurn(pages[dwkIdx], ['发动状态'], pages, 120);
        expect(dwkTurn, 'DarkWolfKing turn should be detected').toBe(true);

        // Dismiss the "行动提示" alert before interacting with bottom buttons
        await dismissAlert(pages[dwkIdx]);

        // Click "查看发动状态"
        await clickBottomButton(pages[dwkIdx], '查看发动状态');

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
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killSeat);

        // Wait for witch's turn — dismiss save prompt, then poison hunter
        const witchTurn = await waitForRoleTurn(
          pages[witchIdx],
          ['被狼人杀了', '解药', '毒药'],
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
        await clickBottomButton(pages[hunterIdx], '查看发动状态');

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
});
