import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { expect, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import {
  type GameSetupWithRolesResult,
  setupNPlayerGame,
  setupNPlayerGameWithRoles,
} from '../helpers/multi-player';
import {
  clickSeatAndConfirm,
  dismissAlert,
  driveWolfVote,
  findAllRolePageIndices,
  findRolePageIndex,
  readAlertText,
  viewLastNightInfo,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { runNightFlowLoop } from '../pages/NightFlowPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Werewolf Night E2E — Flow.
 *
 * Minimal-player night flows and settlement display verification:
 * - 2-player and 6-player smoke flows run to completion
 * - Verification: 2p death message shows the correct seat;
 *   6p seer reveal shows the checked wolf
 *
 * Formerly night-2p.spec.ts, night-6p.spec.ts and night-verify.spec.ts.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);
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

test.describe('Werewolf Night — Flow Verification', () => {
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

      const { fixture, roleMap, roomCode } = setup;
      const pages = fixture.pages;

      // Identify wolf and villager
      const wolfIdx = findRolePageIndex(roleMap, '狼人');
      const villagerIdx = findRolePageIndex(roleMap, '平民');
      expect(wolfIdx, 'Wolf page should be identified').not.toBe(-1);
      expect(villagerIdx, 'Villager page should be identified').not.toBe(-1);

      const wolfPage = pages[wolfIdx]!;
      const villagerSeat = roleMap.get(villagerIdx)!.seat;
      const hostPage = pages[0];

      // Wait for the wolf's action prompt itself: the action-message
      // element is already visible before the start carrying the
      // ready/waiting text, so visibility alone would read too early —
      // poll until the prompt is the wolf's.
      const wolfAction = wolfPage.locator('[data-testid="action-message"]');
      await expect
        .poll(async () => (await wolfAction.textContent()) ?? '', { timeout: 30_000 })
        .toContain('袭击');

      // PR-B G-4: while the wolf acts, the non-actioner's bottom
      // panel names the step it is waiting on (same derived progress
      // as the progress line, so the two can never disagree).
      await expect(
        pages[villagerIdx]!.getByText('正在等待 狼人 行动', { exact: true }),
      ).toBeVisible({ timeout: 10_000 });

      // Wolf clicks the villager's seat
      const confirmed = await clickSeatAndConfirm(wolfPage, villagerSeat);
      expect(confirmed, 'Wolf vote should be confirmed').toBe(true);

      // Wait for night to end
      const nightDone = await waitForNightEnd(pages, 80);
      expect(nightDone, 'Night should have ended').toBe(true);

      // Verify the death message mentions the correct seat number (1-based display)
      const expectedSeatDisplay = formatSeat(villagerSeat);

      // View last night info
      await viewLastNightInfo(hostPage);
      const infoText = await readAlertText(hostPage);
      const deathVisible = infoText.includes(expectedSeatDisplay);

      // Attach diagnostic info
      await testInfo.attach('2p-death-verify.txt', {
        body: [
          `Room: ${roomCode}`,
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
      });

      const { fixture, roleMap, roomCode } = setup;
      const pages = fixture.pages;

      // Identify roles
      const wolfIndices = findAllRolePageIndices(roleMap, '狼人');
      const seerIdx = findRolePageIndex(roleMap, '预言家');
      expect(wolfIndices.length, 'Should have wolf pages').toBeGreaterThan(0);
      expect(seerIdx, 'Seer page should be identified').not.toBe(-1);

      const seerPage = pages[seerIdx]!;
      // Pick a wolf to check — use the first wolf's seat
      const targetWolfIdx = wolfIndices[0]!;
      const targetWolfSeat = roleMap.get(targetWolfIdx)!.seat;

      // --- Phase 1: Drive wolf vote ---
      const firstWolfPage = pages[wolfIndices[0]!]!;
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

      // The reveal should mention the checked seat number and "狼人"
      const expectedRevealSeat = formatSeat(targetWolfSeat);
      expect(revealText, 'Reveal should contain seat number').toContain(expectedRevealSeat);
      expect(revealText, 'Reveal should say 狼人').toContain('狼人');

      // Dismiss the reveal
      await dismissAlert(seerPage);

      // --- Phase 4: Wait for night to complete ---
      const nightDone = await waitForNightEnd(pages, 80);
      expect(nightDone, 'Night should have ended').toBe(true);
      // NB: no day-phase assertion here — with sheriff election off
      // (helper default), the engine moves straight to Ended when
      // the night resolves (handleEndNight): the day is hosted in
      // person, and GameStatus.Day exists only for the election.

      // Attach diagnostic report
      await testInfo.attach('6p-seer-verify.txt', {
        body: [
          `Room: ${roomCode}`,
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

/**
 * 2-Player Night Smoke E2E
 *
 * Verifies the simplest night flow (1 wolf + 1 villager) runs to completion.
 * Does NOT assert exact death results — that's covered by Jest integration tests.
 */

test.describe('Werewolf Night — Flow 2-Player', () => {
  test('first night runs to completion', async ({ browser }, testInfo) => {
    const { fixture, roomCode, hostPage } = await setupNPlayerGame(browser, {
      playerCount: 2,
      configureTemplate: async (config) => config.configure2Player(),
    });

    try {
      const nightResult = await runNightFlowLoop(fixture.pages, testInfo, {
        maxIterations: 80,
        screenshotInterval: 10,
      });

      // Verify night ended
      const room = new RoomPage(hostPage);
      const hasLastNightBtn = await room.isLastNightInfoVisible();

      const nightEnded =
        hasLastNightBtn ||
        nightResult.resultText.includes('平安夜') ||
        nightResult.resultText.includes('死亡');

      expect(nightEnded, 'Night should complete').toBe(true);

      await room.screenshot(testInfo, 'night-2p-ended.png');

      // Attach diagnostic report
      await testInfo.attach('night-2p.txt', {
        body: [
          `Room: ${roomCode}`,
          `Result: ${nightResult.resultText}`,
          `Turns: ${nightResult.turnLog.join(' → ')}`,
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      await closeAll(fixture);
    }
  });
});

/**
 * 6-Player Night Smoke E2E
 *
 * Template: 2 wolves + seer + witch + hunter + 1 villager = 6
 * Validates multi-wolf voting and full role flow.
 * Does NOT assert exact death results.
 */

test.describe('Werewolf Night — Flow 6-Player', () => {
  test('6-player night flow with 2 wolves', async ({ browser }, testInfo) => {
    const { fixture, roomCode, hostPage } = await setupNPlayerGame(browser, {
      playerCount: 6,
      configureTemplate: async (config) => config.configure6Player(),
    });

    try {
      const nightResult = await runNightFlowLoop(fixture.pages, testInfo, {
        maxIterations: 200,
        screenshotInterval: 20,
      });

      const room = new RoomPage(hostPage);
      const hasLastNightBtn = await room.isLastNightInfoVisible();

      const nightEnded =
        hasLastNightBtn ||
        nightResult.resultText.includes('平安夜') ||
        nightResult.resultText.includes('死亡');

      expect(nightEnded, '6-player night should complete').toBe(true);

      await room.screenshot(testInfo, 'night-6p-ended.png');

      await testInfo.attach('night-6p.txt', {
        body: [
          `Room: ${roomCode}`,
          `Template: 2狼 + 预言家 + 女巫 + 猎人 + 1村民`,
          `Result: ${nightResult.resultText}`,
          `Turns: ${nightResult.turnLog.join(' → ')}`,
        ].join('\n'),
        contentType: 'text/plain',
      });
    } finally {
      await closeAll(fixture);
    }
  });
});
