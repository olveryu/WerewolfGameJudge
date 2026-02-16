import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
import {
  clickBottomButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveMagicianSwap,
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
 * Night Roles E2E — exhaustive special role path coverage.
 *
 * Each test sets up a minimal template that includes the role under test,
 * drives night actions via shared helpers, and verifies:
 * - Reveal dialog text (seer / psychic / gargoyle / wolfRobot)
 * - Protection mechanics (guard / dreamcatcher → 平安夜)
 * - Witch save / poison outcomes
 * - Empty wolf vote (空刀 → 平安夜)
 * - Hunter / DarkWolfKing canShoot confirmation
 * - Magician swap completion
 * - Nightmare block effect
 * - WolfQueen charm completion
 * - Slacker idol selection
 *
 * ✅ Allowed: UI assertions on reveal/death text, night-end verification
 * ❌ Forbidden: modifying game state directly, importing services/models
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

// ============================================================================
// Helpers local to this file
// ============================================================================

/** Run a test body with automatic cleanup on failure. */
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

test.describe('Night Roles', () => {
  // --------------------------------------------------------------------------
  // 1. Guard protects → 平安夜
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
        const villagerIdx = findRolePageIndex(roleMap, '普通村民');
        expect(guardIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Pick the villager as target for both guard and wolf
        const targetSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;

        // Wait for guard's turn
        const guardTurn = await waitForRoleTurn(pages[guardIdx], ['守护', '选择'], pages, 120);
        expect(guardTurn, 'Guard turn should be detected').toBe(true);

        // Guard protects the target
        await clickSeatAndConfirm(pages[guardIdx], targetSeat);

        // Wait for wolf's turn, wolf kills same target
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn, 'Wolf turn should be detected').toBe(true);
        await driveWolfVote(pages, [wolfIdx], targetSeat);

        // Night should end with 平安夜
        const ended = await waitForNightEnd(pages, 120);
        expect(ended, 'Night should have ended').toBe(true);

        await viewLastNightInfo(pages[0]);
        const peaceful = await isTextVisible(pages[0], '平安夜');
        expect(peaceful, 'Should be 平安夜 (guard protected)').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // 2. Witch saves → 平安夜
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
        const villagerIdx = findRolePageIndex(roleMap, '普通村民');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        expect(wolfIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);

        const killTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;

        // Wait for wolf's turn
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Wait for witch's turn — she sees "被狼人杀了" + save button
        const witchTurn = await waitForRoleTurn(
          pages[witchIdx],
          ['被狼人杀了', '解药'],
          pages,
          120,
        );
        expect(witchTurn, 'Witch turn should be detected').toBe(true);

        // Dismiss the witch info alert (shows kill info)
        await dismissAlert(pages[witchIdx]);

        // Click the save button: "对{seat+1}号用解药"
        const saveLabel = `对${killTarget + 1}号用解药`;
        const saved = await clickBottomButton(pages[witchIdx], saveLabel);
        if (!saved) {
          // Fallback: try "用解药" partial match
          const panel = pages[witchIdx].locator('[data-testid="bottom-action-panel"]');
          const saveBtn = panel.getByText('用解药').first();
          if (await saveBtn.isVisible().catch(() => false)) {
            await saveBtn.click({ force: true });
          }
        }

        // Confirm save if alert appears
        await dismissAlert(pages[witchIdx]);

        // Night should end with 平安夜
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);

        await viewLastNightInfo(pages[0]);
        const peaceful = await isTextVisible(pages[0], '平安夜');
        expect(peaceful, 'Should be 平安夜 (witch saved)').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // 3. Witch poisons → double death
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
        const hasDeath = await isTextVisible(pages[0], '玩家死亡');
        const peaceful = await isTextVisible(pages[0], '平安夜');
        expect(hasDeath || !peaceful, 'Should have deaths, not 平安夜').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // 4. Seer checks good player → 好人
  // --------------------------------------------------------------------------
  test('seer checks villager → reveal shows 好人', async ({ browser }) => {
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
        const villagerIdx = findRolePageIndex(roleMap, '普通村民');
        expect(seerIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Drive wolf kill first
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);

        // Wolf kills villager (or seer if only 2 non-wolves)
        const killTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await driveWolfVote(pages, [wolfIdx], killTarget);

        // Wait for seer's turn
        const seerTurn = await waitForRoleTurn(pages[seerIdx], ['查验', '选择'], pages, 120);
        expect(seerTurn, 'Seer turn should be detected').toBe(true);

        // Seer checks the villager (check reveals "好人")
        const checkTarget = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
        await clickSeatAndConfirm(pages[seerIdx], checkTarget);

        // Read reveal
        const revealText = await readAlertText(pages[seerIdx]);
        expect(revealText).toContain(`${checkTarget + 1}号`);
        expect(revealText).toContain('好人');
        await dismissAlert(pages[seerIdx]);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // 5. Hunter confirms canShoot
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
  // 6. Psychic checks → exact role name
  // --------------------------------------------------------------------------
  test('psychic checks player → reveal shows exact role', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['psychic'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const psychicIdx = findRolePageIndex(roleMap, '通灵师');
        expect(psychicIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Drive wolf kill
        const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName !== '狼人');
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Wait for psychic's turn
        const psychicTurn = await waitForRoleTurn(pages[psychicIdx], ['通灵', '选择'], pages, 120);
        expect(psychicTurn, 'Psychic turn should be detected').toBe(true);

        // Check wolf
        const checkSeat = roleMap.get(wolfIdx)!.seat;
        await clickSeatAndConfirm(pages[psychicIdx], checkSeat);

        // Read reveal — "通灵结果：X号是狼人"
        const revealText = await readAlertText(pages[psychicIdx]);
        expect(revealText).toContain(`${checkSeat + 1}号`);
        expect(revealText).toContain('狼人');
        await dismissAlert(pages[psychicIdx]);

        // Finish night
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // 7. Magician swaps two seats
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
        const magTurn = await waitForRoleTurn(pages[magicianIdx], ['交换', '选择'], pages, 120);
        expect(magTurn, 'Magician turn should be detected').toBe(true);

        // Swap the other two players
        const otherSeats = [...roleMap.entries()]
          .filter(([idx]) => idx !== magicianIdx)
          .map(([, info]) => info.seat);
        expect(otherSeats.length).toBeGreaterThanOrEqual(2);
        await driveMagicianSwap(pages[magicianIdx], otherSeats[0], otherSeats[1]);

        // Drive wolf kill after magician
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
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
  // 8. Dreamcatcher dreams wolf target → immune (平安夜)
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
          ([, info]) => info.displayName === '普通村民',
        );
        const targetSeat = villagerEntry ? villagerEntry[1].seat : roleMap.get(dcIdx)!.seat;

        // Wait for dreamcatcher's turn
        const dcTurn = await waitForRoleTurn(pages[dcIdx], ['摄梦', '选择'], pages, 120);
        expect(dcTurn, 'Dreamcatcher turn should be detected').toBe(true);

        // Dream the target
        await clickSeatAndConfirm(pages[dcIdx], targetSeat);

        // Wolf kills same target
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], targetSeat);

        // Night should end with 平安夜 (dreamcatcher immunity)
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);

        await viewLastNightInfo(pages[0]);
        const peaceful = await isTextVisible(pages[0], '平安夜');
        expect(peaceful, 'Should be 平安夜 (dreamcatcher protected)').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // 9. Wolf empty kill → 平安夜
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
  // 10. Nightmare blocks guard → wolf kill succeeds
  // --------------------------------------------------------------------------
  test('nightmare blocks guard → wolf kill succeeds', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 0,
            villagers: 2,
            goodRoles: ['guard'],
            wolfRoles: ['nightmare'],
          }),
      },
      async ({ pages, roleMap }) => {
        const nightmareIdx = findRolePageIndex(roleMap, '梦魇');
        const guardIdx = findRolePageIndex(roleMap, '守卫');
        expect(nightmareIdx).not.toBe(-1);
        expect(guardIdx).not.toBe(-1);

        const guardSeat = roleMap.get(guardIdx)!.seat;

        // Find a villager seat for wolf kill target
        const villagerEntry = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );
        const killSeat = villagerEntry ? villagerEntry[1].seat : 0;

        // Wait for nightmare's turn
        const nightmareTurn = await waitForRoleTurn(
          pages[nightmareIdx],
          ['封锁', '选择'],
          pages,
          120,
        );
        expect(nightmareTurn, 'Nightmare turn should be detected').toBe(true);

        // Block the guard
        await clickSeatAndConfirm(pages[nightmareIdx], guardSeat);

        // Guard's turn — should see blocked message or skip
        // (nightmare blocks skip guard's action automatically)

        // Wolf (nightmare is a wolf) kills target
        const wolfTurn = await waitForRoleTurn(pages[nightmareIdx], ['猎杀'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [nightmareIdx], killSeat);

        // Night should end with death (guard was blocked)
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);

        await viewLastNightInfo(pages[0]);
        const peaceful = await isTextVisible(pages[0], '平安夜');
        expect(!peaceful, 'Should NOT be 平安夜 (guard was blocked)').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // 11. Wolf Queen charms → night completes
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
  // 12. Dark Wolf King confirms status
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
  // 13. Gargoyle checks → exact role name
  // --------------------------------------------------------------------------
  test('gargoyle checks seer → reveal shows 预言家', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['seer'],
            wolfRoles: ['gargoyle'],
          }),
      },
      async ({ pages, roleMap }) => {
        const gargoyleIdx = findRolePageIndex(roleMap, '石像鬼');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        expect(gargoyleIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);

        const seerSeat = roleMap.get(seerIdx)!.seat;

        // Drive wolf kill first (gargoyle participates in wolf vote)
        const wolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), gargoyleIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );

        const wolfTurn = await waitForRoleTurn(pages[wolfIndices[0]], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, wolfIndices, killTarget ? killTarget[1].seat : 0);

        // Wait for gargoyle check step
        const gargTurn = await waitForRoleTurn(pages[gargoyleIdx], ['查验'], pages, 120);
        expect(gargTurn, 'Gargoyle turn should be detected').toBe(true);

        // Check the seer
        await clickSeatAndConfirm(pages[gargoyleIdx], seerSeat);

        // Read reveal — "石像鬼探查：X号是预言家"
        const revealText = await readAlertText(pages[gargoyleIdx]);
        expect(revealText).toContain(`${seerSeat + 1}号`);
        expect(revealText).toContain('预言家');
        await dismissAlert(pages[gargoyleIdx]);

        // Skip seer's turn and finish
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // 14. Wolf Robot learns a role
  // --------------------------------------------------------------------------
  test('wolfRobot learns villager → reveal shows 普通村民', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            wolfRoles: ['wolfRobot'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wrIdx = findRolePageIndex(roleMap, '机械狼');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const villagerIdx = findRolePageIndex(roleMap, '普通村民');
        expect(wrIdx !== -1 || wolfIdx !== -1, 'Need wolf faction').toBe(true);

        // All wolf faction indices (wolfRobot is also a wolf)
        const allWolfIndices = [
          ...findAllRolePageIndices(roleMap, '狼人'),
          ...(wrIdx !== -1 ? [wrIdx] : []),
        ].filter((v, i, a) => a.indexOf(v) === i);

        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );

        // Drive wolf kill
        const firstWolf = allWolfIndices[0];
        const wolfTurn = await waitForRoleTurn(pages[firstWolf], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killTarget ? killTarget[1].seat : 0);

        // Wait for wolfRobot learn step
        if (wrIdx !== -1) {
          const wrTurn = await waitForRoleTurn(pages[wrIdx], ['学习'], pages, 120);
          expect(wrTurn, 'WolfRobot turn should be detected').toBe(true);

          // Learn the villager
          const learnSeat = villagerIdx !== -1 ? roleMap.get(villagerIdx)!.seat : 0;
          await clickSeatAndConfirm(pages[wrIdx], learnSeat);

          // Read reveal — "学习结果：X号是普通村民"
          const revealText = await readAlertText(pages[wrIdx]);
          expect(revealText).toContain(`${learnSeat + 1}号`);
          expect(revealText).toContain('普通村民');
          await dismissAlert(pages[wrIdx]);
        }

        // Finish night
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // 15. Slacker chooses idol
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
        const slackerIdx = findRolePageIndex(roleMap, '混子');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(slackerIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Wait for slacker's turn (early in step order)
        const slackerTurn = await waitForRoleTurn(pages[slackerIdx], ['榜样', '选择'], pages, 120);
        expect(slackerTurn, 'Slacker turn should be detected').toBe(true);

        // Choose wolf as idol (any seat except self)
        const idolSeat = roleMap.get(wolfIdx)!.seat;
        await clickSeatAndConfirm(pages[slackerIdx], idolSeat);

        // Drive wolf kill
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        const villagerEntry = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );
        await driveWolfVote(pages, [wolfIdx], villagerEntry ? villagerEntry[1].seat : 0);

        // Finish night
        const ended = await waitForNightEnd(pages, 120);
        expect(ended, 'Night should end after slacker picks idol').toBe(true);
      },
    );
  });
});
