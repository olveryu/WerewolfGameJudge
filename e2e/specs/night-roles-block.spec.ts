import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
import {
  clickBottomButton,
  clickSeatAndConfirm,
  dismissAlert,
  driveMagicianSwap,
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
 * Night Roles E2E — Block / Skip effect coverage.
 *
 * Tests roles that block, disable, or skip actions:
 * - Nightmare blocks guard / seer / witch / wolf / dreamcatcher
 * - Magician swap (basic flow)
 * - Slacker idol choice
 * - Seer & guard voluntary skip (不用技能)
 *
 * Covers UI assertions on blocked prompts, 平安夜 / death outcomes.
 * Does not modify game state directly or import services/models.
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

test.describe('Night Roles — Block / Skip', () => {
  // --------------------------------------------------------------------------
  // Magician swaps two players → night completes
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
  // Nightmare blocks guard → wolf kill succeeds
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
  // Slacker chooses idol → night completes
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

  // --------------------------------------------------------------------------
  // Nightmare blocks seer → seer sees blocked prompt
  // --------------------------------------------------------------------------
  test('nightmare blocks seer → seer sees blocked prompt', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['seer'],
            wolfRoles: ['nightmare'],
          }),
      },
      async ({ pages, roleMap }) => {
        const nightmareIdx = findRolePageIndex(roleMap, '梦魇');
        const seerIdx = findRolePageIndex(roleMap, '预言家');
        expect(nightmareIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);

        const seerSeat = roleMap.get(seerIdx)!.seat;

        // Nightmare blocks seer
        const nmTurn = await waitForRoleTurn(pages[nightmareIdx], ['封锁', '选择'], pages, 120);
        expect(nmTurn).toBe(true);
        await clickSeatAndConfirm(pages[nightmareIdx], seerSeat);

        // Wolf kill — nightmare + generic wolf are both wolf faction
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), nightmareIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );
        const wolfTurn = await waitForRoleTurn(
          pages[allWolfIndices[0]],
          ['猎杀', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killTarget ? killTarget[1].seat : 0);

        // Wait for seer's blocked turn — alert or action message contains "封锁"
        const seerBlocked = await waitForRoleTurn(pages[seerIdx], ['封锁'], pages, 120);
        expect(seerBlocked, 'Seer should see blocked prompt').toBe(true);

        // Verify blocked text
        const blockedText = await readAlertText(pages[seerIdx]);
        expect(blockedText).toContain('封锁');
        await dismissAlert(pages[seerIdx]);

        // Finish night
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Nightmare blocks witch → witch sees blocked prompt
  // --------------------------------------------------------------------------
  test('nightmare blocks witch → witch sees blocked prompt', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['witch'],
            wolfRoles: ['nightmare'],
          }),
      },
      async ({ pages, roleMap }) => {
        const nightmareIdx = findRolePageIndex(roleMap, '梦魇');
        const witchIdx = findRolePageIndex(roleMap, '女巫');
        expect(nightmareIdx).not.toBe(-1);
        expect(witchIdx).not.toBe(-1);

        const witchSeat = roleMap.get(witchIdx)!.seat;

        // Nightmare blocks witch
        const nmTurn = await waitForRoleTurn(pages[nightmareIdx], ['封锁', '选择'], pages, 120);
        expect(nmTurn).toBe(true);
        await clickSeatAndConfirm(pages[nightmareIdx], witchSeat);

        // Wolf kill
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), nightmareIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );
        const wolfTurn = await waitForRoleTurn(
          pages[allWolfIndices[0]],
          ['猎杀', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killTarget ? killTarget[1].seat : 0);

        // Wait for witch's blocked turn
        const witchBlocked = await waitForRoleTurn(pages[witchIdx], ['封锁'], pages, 120);
        expect(witchBlocked, 'Witch should see blocked prompt').toBe(true);

        // Verify blocked text
        const blockedText = await readAlertText(pages[witchIdx]);
        expect(blockedText).toContain('封锁');
        await dismissAlert(pages[witchIdx]);

        // Finish night — villager dies (witch couldn't save)
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Nightmare blocks wolf → 平安夜 (wolfKillDisabled)
  // --------------------------------------------------------------------------
  test('nightmare blocks wolf → 平安夜 (wolfKillDisabled)', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 3,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            wolfRoles: ['nightmare'],
          }),
      },
      async ({ pages, roleMap }) => {
        const nightmareIdx = findRolePageIndex(roleMap, '梦魇');
        const wolfIdx = findRolePageIndex(roleMap, '狼人');
        expect(nightmareIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        const wolfSeat = roleMap.get(wolfIdx)!.seat;

        // Nightmare blocks the generic wolf → wolfKillDisabled
        const nmTurn = await waitForRoleTurn(pages[nightmareIdx], ['封锁', '选择'], pages, 120);
        expect(nmTurn).toBe(true);
        await clickSeatAndConfirm(pages[nightmareIdx], wolfSeat);

        // Wolf vote step — all wolves should see blocked / disabled prompt
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), nightmareIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        // Wait for wolf step on any wolf page — detect "无法刀人" or "封锁"
        const wolfBlocked = await waitForRoleTurn(
          pages[allWolfIndices[0]],
          ['无法刀人', '封锁'],
          pages,
          120,
        );
        expect(wolfBlocked, 'Wolves should see kill-disabled prompt').toBe(true);

        // When wolfKillDisabled, the button label is the blocked message
        // (not "空刀"). Each wolf must click it to submit empty vote.
        for (const wIdx of allWolfIndices) {
          const wPage = pages[wIdx];
          await dismissAlert(wPage);

          // Wait for the blocked button to appear in the bottom panel
          const panel = wPage.locator('[data-testid="bottom-action-panel"]');
          const blockedBtn = panel.getByText('无法行动').first();
          await blockedBtn.waitFor({ state: 'visible', timeout: 5000 });
          await blockedBtn.click({ force: true });

          // Confirm the wolf vote alert if it appears
          const alertModal = wPage.locator('[data-testid="alert-modal"]');
          const appeared = await alertModal
            .waitFor({ state: 'visible', timeout: 3000 })
            .then(() => true)
            .catch(() => false);
          if (appeared) {
            await dismissAlert(wPage);
          }
        }

        // Night should end with 平安夜
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);

        await viewLastNightInfo(pages[0]);
        const peaceful = await isTextVisible(pages[0], '平安夜');
        expect(peaceful, 'Should be 平安夜 (wolf kill disabled)').toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Seer skips action → night completes
  // --------------------------------------------------------------------------
  test('seer skips action (不用技能) → night completes', async ({ browser }) => {
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
        expect(wolfIdx).not.toBe(-1);
        expect(seerIdx).not.toBe(-1);

        // Drive wolf kill
        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Seer's turn — skip via "不用技能"
        const seerTurn = await waitForRoleTurn(pages[seerIdx], ['查验', '选择'], pages, 120);
        expect(seerTurn).toBe(true);
        await dismissAlert(pages[seerIdx]);
        await clickBottomButton(pages[seerIdx], '不用技能');

        // Confirm skip if alert appears
        await dismissAlert(pages[seerIdx]);

        // Night should end
        const ended = await waitForNightEnd(pages, 80);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Nightmare blocks dreamcatcher → DC sees blocked prompt
  // --------------------------------------------------------------------------
  test('nightmare blocks dreamcatcher → dreamcatcher sees blocked prompt', async ({ browser }) => {
    await withSetup(
      browser,
      {
        playerCount: 4,
        configure: async (c) =>
          c.configureCustomTemplate({
            wolves: 1,
            villagers: 1,
            goodRoles: ['dreamcatcher'],
            wolfRoles: ['nightmare'],
          }),
      },
      async ({ pages, roleMap }) => {
        const nightmareIdx = findRolePageIndex(roleMap, '梦魇');
        const dcIdx = findRolePageIndex(roleMap, '摄梦人');
        expect(nightmareIdx).not.toBe(-1);
        expect(dcIdx).not.toBe(-1);

        const dcSeat = roleMap.get(dcIdx)!.seat;

        // Nightmare blocks dreamcatcher
        const nmTurn = await waitForRoleTurn(pages[nightmareIdx], ['封锁', '选择'], pages, 120);
        expect(nmTurn).toBe(true);
        await clickSeatAndConfirm(pages[nightmareIdx], dcSeat);

        // Dreamcatcher's step comes BEFORE wolf vote in night order.
        // Wait for DC to see blocked prompt before advancing wolf vote.
        const dcBlocked = await waitForRoleTurn(pages[dcIdx], ['封锁'], pages, 120);
        expect(dcBlocked, 'Dreamcatcher should see blocked prompt').toBe(true);

        const blockedText = await readAlertText(pages[dcIdx]);
        expect(blockedText).toContain('封锁');
        await dismissAlert(pages[dcIdx]);

        // Skip the blocked step on DC's page (click "跳过" button if visible)
        const skipBtn = pages[dcIdx]
          .locator('[data-testid="bottom-action-panel"]')
          .getByText('跳过', { exact: false })
          .first();
        if (await skipBtn.isVisible().catch(() => false)) {
          await skipBtn.click({ force: true });
        }

        // Wolf kill — nightmare is wolf faction
        const allWolfIndices = [...findAllRolePageIndices(roleMap, '狼人'), nightmareIdx].filter(
          (v, i, a) => a.indexOf(v) === i,
        );

        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );
        const wolfTurn = await waitForRoleTurn(
          pages[allWolfIndices[0]],
          ['猎杀', '选择'],
          pages,
          120,
        );
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, allWolfIndices, killTarget ? killTarget[1].seat : 0);

        // Finish night — villager dies (no dream protection)
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });

  // --------------------------------------------------------------------------
  // Guard skips action → night completes
  // --------------------------------------------------------------------------
  test('guard skips action (不用技能) → night completes', async ({ browser }) => {
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
        expect(guardIdx).not.toBe(-1);
        expect(wolfIdx).not.toBe(-1);

        // Guard's turn — skip via "不用技能"
        const guardTurn = await waitForRoleTurn(pages[guardIdx], ['守护', '选择'], pages, 120);
        expect(guardTurn).toBe(true);
        await dismissAlert(pages[guardIdx]);
        await clickBottomButton(pages[guardIdx], '不用技能');
        await dismissAlert(pages[guardIdx]);

        // Drive wolf kill
        const killTarget = [...roleMap.entries()].find(
          ([, info]) => info.displayName === '普通村民',
        );
        const wolfTurn = await waitForRoleTurn(pages[wolfIdx], ['猎杀', '选择'], pages, 120);
        expect(wolfTurn).toBe(true);
        await driveWolfVote(pages, [wolfIdx], killTarget ? killTarget[1].seat : 0);

        // Night should end
        const ended = await waitForNightEnd(pages, 120);
        expect(ended).toBe(true);
      },
    );
  });
});
