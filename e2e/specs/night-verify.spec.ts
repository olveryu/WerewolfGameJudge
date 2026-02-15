import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
import {
  clickSeatAndConfirm,
  dismissAlert,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  getActionMsg,
  isNightEnded,
  readAlertText,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';

/**
 * Night Verification E2E
 *
 * Unlike the smoke tests (night-2p / night-6p) which only check "night ended",
 * these tests verify SPECIFIC outcomes:
 * - 2p: wolf targets villager → verify death message shows correct seat
 * - 6p: seer checks a known wolf → verify reveal dialog says "狼人"
 *
 * Uses setupNPlayerGameWithRoles() to capture role assignments, then drives
 * night actions with role awareness.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Night Verification', () => {
  // -------------------------------------------------------------------------
  // 1. 2-player death verification
  // -------------------------------------------------------------------------
  test('2p: wolf kills villager → death message shows correct seat', async ({
    browser,
  }, testInfo) => {
    let setup: GameSetupWithRolesResult | undefined;
    try {
      setup = await setupNPlayerGameWithRoles(browser, {
        playerCount: 2,
        configureTemplate: async (config) => config.configure2Player(),
      });

      const { fixture, roleMap, roomNumber } = setup;
      const pages = fixture.pages;

      // Identify wolf and villager
      const wolfIdx = findRolePageIndex(roleMap, '狼人');
      const villagerIdx = findRolePageIndex(roleMap, '普通村民');
      expect(wolfIdx, 'Wolf page should be identified').not.toBe(-1);
      expect(villagerIdx, 'Villager page should be identified').not.toBe(-1);

      const wolfPage = pages[wolfIdx];
      const villagerSeat = roleMap.get(villagerIdx)!.seat;
      const hostPage = pages[0];

      console.log(
        `[NightVerify] Room ${roomNumber}: wolf=page${wolfIdx}(seat${roleMap.get(wolfIdx)!.seat}), ` +
          `villager=page${villagerIdx}(seat${villagerSeat})`,
      );

      // Wait for wolf's action message to appear
      const wolfAction = wolfPage.locator('[data-testid="action-message"]');
      await wolfAction.waitFor({ state: 'visible', timeout: 30_000 });
      const actionText = await wolfAction.textContent();
      expect(actionText).toContain('猎杀');

      // Wolf clicks the villager's seat
      const confirmed = await clickSeatAndConfirm(wolfPage, villagerSeat);
      expect(confirmed, 'Wolf vote should be confirmed').toBe(true);

      // Wait for night to end
      const nightDone = await waitForNightEnd(pages, 80);
      expect(nightDone, 'Night should have ended').toBe(true);

      // Verify the death message mentions the correct seat number (1-based display)
      const expectedSeatDisplay = villagerSeat + 1; // 0-based → 1-based

      // Navigate through speak order dialog → view last night info
      await viewLastNightInfo(hostPage);
      const infoText = await readAlertText(hostPage);
      const deathVisible = infoText.includes(`${expectedSeatDisplay}号`);

      // Attach diagnostic info
      await testInfo.attach('2p-death-verify.txt', {
        body: [
          `Room: ${roomNumber}`,
          `Wolf: page${wolfIdx} seat${roleMap.get(wolfIdx)!.seat}`,
          `Villager: page${villagerIdx} seat${villagerSeat}`,
          `Expected death: ${expectedSeatDisplay}号`,
          `Death visible: ${deathVisible}`,
          `Info text: ${infoText}`,
        ].join('\n'),
        contentType: 'text/plain',
      });

      expect(deathVisible, `Death message should mention ${expectedSeatDisplay}号`).toBe(true);

      await hostPage
        .screenshot()
        .then((buf) =>
          testInfo.attach('2p-death-result.png', { body: buf, contentType: 'image/png' }),
        );
    } finally {
      if (setup) await closeAll(setup.fixture);
    }
  });

  // -------------------------------------------------------------------------
  // 2. 6-player seer check verification
  // -------------------------------------------------------------------------
  test('6p: seer checks wolf → reveal shows 狼人', async ({ browser }, testInfo) => {
    let setup: GameSetupWithRolesResult | undefined;
    try {
      setup = await setupNPlayerGameWithRoles(browser, {
        playerCount: 6,
        configureTemplate: async (config) => config.configure6Player(),
        quietConsole: true,
      });

      const { fixture, roleMap, roomNumber } = setup;
      const pages = fixture.pages;

      // Identify roles
      const wolfIndices = findAllRolePageIndices(roleMap, '狼人');
      const seerIdx = findRolePageIndex(roleMap, '预言家');
      expect(wolfIndices.length, 'Should have wolf pages').toBeGreaterThan(0);
      expect(seerIdx, 'Seer page should be identified').not.toBe(-1);

      const seerPage = pages[seerIdx];
      const seerSeat = roleMap.get(seerIdx)!.seat;
      // Pick a wolf to check — use the first wolf's seat
      const targetWolfIdx = wolfIndices[0];
      const targetWolfSeat = roleMap.get(targetWolfIdx)!.seat;

      console.log(
        `[NightVerify] Room ${roomNumber}: ` +
          `wolves=[${wolfIndices.map((i) => `p${i}(seat${roleMap.get(i)!.seat})`).join(',')}], ` +
          `seer=p${seerIdx}(seat${seerSeat}), targetWolf=seat${targetWolfSeat}`,
      );

      // --- Phase 1: Drive wolf vote ---
      const firstWolfPage = pages[wolfIndices[0]];
      await firstWolfPage
        .locator('[data-testid="action-message"]')
        .waitFor({ state: 'visible', timeout: 30_000 });

      // Pick a non-wolf target for the kill
      const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName !== '狼人');
      const killTargetSeat = killTarget ? killTarget[1].seat : 0;

      // All wolves vote on the same target
      await driveWolfVote(pages, wolfIndices, killTargetSeat);

      // --- Phase 2: Wait for seer's turn ---
      const seerTurnDetected = await waitForRoleTurn(seerPage, ['查验', '选择'], pages, 120);

      expect(seerTurnDetected, 'Seer turn should appear during night').toBe(true);

      // --- Phase 3: Seer checks a known wolf ---
      const seerConfirmed = await clickSeatAndConfirm(seerPage, targetWolfSeat);
      expect(seerConfirmed, 'Seer check should be confirmed').toBe(true);

      // Wait for the reveal dialog
      const revealText = await readAlertText(seerPage);
      console.log(`[NightVerify] Seer reveal text: ${revealText}`);

      // The reveal should mention the checked seat number and "狼人"
      const expectedRevealSeat = targetWolfSeat + 1; // 0-based → 1-based
      expect(revealText, 'Reveal should contain seat number').toContain(`${expectedRevealSeat}号`);
      expect(revealText, 'Reveal should say 狼人').toContain('狼人');

      // Dismiss the reveal
      await dismissAlert(seerPage);

      // --- Phase 4: Wait for night to complete ---
      const nightDone = await waitForNightEnd(pages, 80);
      expect(nightDone, 'Night should have ended').toBe(true);

      // Attach diagnostic report
      await testInfo.attach('6p-seer-verify.txt', {
        body: [
          `Room: ${roomNumber}`,
          `Roles: ${[...roleMap.entries()].map(([i, r]) => `p${i}=${r.displayName}(seat${r.seat})`).join(', ')}`,
          `Seer checked: seat${targetWolfSeat} (wolf)`,
          `Reveal text: ${revealText}`,
        ].join('\n'),
        contentType: 'text/plain',
      });

      await pages[0]
        .screenshot()
        .then((buf) =>
          testInfo.attach('6p-seer-result.png', { body: buf, contentType: 'image/png' }),
        );
    } finally {
      if (setup) await closeAll(setup.fixture);
    }
  });
});
