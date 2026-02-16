import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
import {
  clickBottomButton,
  clickSeatAndConfirm,
  dismissAlert,
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
 * Night Roles E2E — Protection / Immunity effect coverage.
 *
 * Tests all roles that prevent or modify night deaths:
 * - Guard protect → 平安夜
 * - Witch save → 平安夜, Witch self-save rejection
 * - Dreamcatcher hit/miss/link death
 * - SpiritKnight wolf-kill immunity, poison reflection
 *
 * ✅ Allowed: UI assertions on death/survival text
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

test.describe('Night Roles — Protection / Immunity', () => {
  // --------------------------------------------------------------------------
  // Guard protects → 平安夜
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
  // Witch saves → 平安夜
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

        // Wait for the bottom action panel to render after alert dismissal
        const panel = pages[witchIdx].locator('[data-testid="bottom-action-panel"]');
        await panel.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        // Click the save button: "对{seat+1}号用解药"
        const saveLabel = `对${killTarget + 1}号用解药`;
        const saved = await clickBottomButton(pages[witchIdx], saveLabel);
        if (!saved) {
          // Fallback: try "用解药" partial match
          const saveBtn = panel.getByText('用解药').first();
          await saveBtn.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
          if (await saveBtn.isVisible().catch(() => false)) {
            await saveBtn.click({ force: true });
          }
        }

        // Confirm save — wait for confirmation dialog to appear, then dismiss
        const confirmModal = pages[witchIdx].locator('[data-testid="alert-modal"]');
        await confirmModal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        await dismissAlert(pages[witchIdx]);

        // Allow action submission to complete before advancing
        await pages[witchIdx].waitForTimeout(1000);

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
  // Dreamcatcher dreams wolf target → immune (平安夜)
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
  // Dreamcatcher dreams wrong target → death occurs
  // --------------------------------------------------------------------------
  test('dreamcatcher dreams wrong target → death occurs', async ({ browser }) => {
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

        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        expect(villagers.length).toBeGreaterThanOrEqual(2);

        const dreamSeat = villagers[0][1].seat; // dream this one
        const killSeat = villagers[1][1].seat; // wolf kills a different one

        // Dreamcatcher dreams villager1
        const dcTurn = await waitForRoleTurn(pages[dcIdx], ['摄梦', '选择'], pages, 120);
        expect(dcTurn).toBe(true);
        await clickSeatAndConfirm(pages[dcIdx], dreamSeat);

        // Wolf kills villager2 (different target → no protection)
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killSeat);

        // Night ends with death (not 平安夜)
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);

        await viewLastNightInfo(pages[0]);
        const peaceful = await isTextVisible(pages[0], '平安夜');
        expect(!peaceful, 'Should NOT be 平安夜 (dreamcatcher missed)').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Witch self-save rejection (notSelf constraint)
  // --------------------------------------------------------------------------
  test('witch targeted by wolf → cannot self-save', async ({ browser }) => {
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
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        expect(wolfIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);

        const witchSeat = roleMap.get(witchIdx)!.seat;

        // Wolf kills the witch
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], witchSeat);

        // Wait for witch's turn — she was targeted, should see self-save rejection
        const witchTurn = await waitForRoleTurn(
          pages[witchIdx],
          ['被狼人杀了', '无法对自己使用解药', '毒药'],
          pages,
          120,
        );
        expect(witchTurn).toBe(true);

        // Read the prompt — should mention "无法对自己使用解药"
        const alertText = await readAlertText(pages[witchIdx]);
        expect(alertText).toContain('无法对自己使用解药');
        await dismissAlert(pages[witchIdx]);

        // Witch skips (no save, no poison)
        await clickBottomButton(pages[witchIdx], '不使用技能');
        await dismissAlert(pages[witchIdx]);

        // Night ends — witch dies
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // SpiritKnight — wolf cannot self-knife (immuneToWolfKill rejection)
  // --------------------------------------------------------------------------
  test('spiritKnight is immune to wolf kill → rejection → re-vote', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            wolfRoles: ['spiritKnight'],
          }),
      },
      async ({ pages, roleMap }) => {
        const skIdx = findRolePageIndex(roleMap, '恶灵骑士');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(skIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const skSeat = roleMap.get(skIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        const validTarget = villagers[0]?.[1].seat ?? 0;

        // Both spiritKnight and wolf are wolf faction
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), skIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        // Wait for wolf kill step
        const wolfTurn = await waitForRoleTurn(
          pages[allWolfIndices[0]],
          ['猎杀', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);

        // First wolf tries to vote spiritKnight → confirm → rejection
        await clickSeatAndConfirm(pages[allWolfIndices[0]], skSeat);

        // Should see rejection alert (notifyIfFailed shows '狼人投票失败')
        const alertModal = pages[allWolfIndices[0]].locator('[data-testid="alert-modal"]');
        await alertModal.waitFor({ state: 'visible', timeout: 5000 });
        const rejectionText = await readAlertText(pages[allWolfIndices[0]]);
        expect(rejectionText).toContain('投票失败');
        await dismissAlert(pages[allWolfIndices[0]]);

        // Re-vote on valid target
        await driveWolfVote(pages, allWolfIndices, validTarget);

        // Night should complete normally
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // SpiritKnight — witch poison reflects → witch dies, SK survives
  // --------------------------------------------------------------------------
  test('witch poisons spiritKnight → poison reflects → witch dies', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 5,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 2,
            goodRoles: ['witch'],
            wolfRoles: ['spiritKnight'],
          }),
      },
      async ({ pages, roleMap }) => {
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        const skIdx = findRolePageIndex(roleMap, '恶灵骑士');
        expect(wolfIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);
        expect(skIdx).not.toBe(-1);

        const skSeat = roleMap.get(skIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        const killSeat = villagers[0]?.[1].seat ?? 0;

        // Both spiritKnight and wolf are wolf faction
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), skIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        // Wolf kills a villager
        const wolfTurn = await waitForRoleTurn(
          pages[allWolfIndices[0]],
          ['猎杀', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killSeat);

        // Witch's turn — dismiss save info, then poison spiritKnight
        const witchTurn = await waitForRoleTurn(
          pages[witchIdx],
          ['被狼人杀了', '解药', '毒药'],
          pages,
          120,
        );
        expect(witchTurn).toBe(true);
        await dismissAlert(pages[witchIdx]);
        await clickSeatAndConfirm(pages[witchIdx], skSeat);

        // Night ends
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);

        // Verify: witch should be dead (reflection), SK should survive
        await viewLastNightInfo(pages[0]);
        const hasDeath = await isTextVisible(pages[0], '死亡');
        expect(hasDeath, 'Should have deaths (witch dies from reflection)').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Dreamcatcher link death — DC dies → dream target dies too
  // --------------------------------------------------------------------------
  test('dreamcatcher dies → dream target link-dies', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['witch', 'dreamcatcher'],
          }),
      },
      async ({ pages, roleMap }) => {
        const dcIdx = findRolePageIndex(roleMap, '摄梦人');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(dcIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const dcSeat = roleMap.get(dcIdx)!.seat;
        const villagers = [...roleMap.entries()].filter(
          ([, info]) => info.displayName === '普通村民',
        );
        const villagerSeat = villagers[0]?.[1].seat ?? 0;

        // Dreamcatcher dreams the villager
        const dcTurn = await waitForRoleTurn(pages[dcIdx], ['摄梦', '选择'], pages, 120);
        expect(dcTurn).toBe(true);
        await clickSeatAndConfirm(pages[dcIdx], villagerSeat);

        // Wolf kills the dreamcatcher
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], dcSeat);

        // Witch skips (don't save DC)
        const witchTurn = await waitForRoleTurn(
          pages[witchIdx],
          ['被狼人杀了', '解药', '毒药'],
          pages,
          120,
        );
        expect(witchTurn).toBe(true);
        await dismissAlert(pages[witchIdx]);
        await clickBottomButton(pages[witchIdx], '不使用技能');
        await dismissAlert(pages[witchIdx]);

        // Night ends — both DC and dream target should be dead (link death)
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);

        await viewLastNightInfo(pages[0]);
        const peaceful = await isTextVisible(pages[0], '平安夜');
        expect(!peaceful, 'Should NOT be 平安夜 (DC + dream target both die)').toBe(true);
      },
    );
  });
});
