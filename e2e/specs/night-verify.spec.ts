import { expect, Page, test } from '@playwright/test';

import { closeAll } from '../fixtures/app.fixture';
import {
  type CapturedRole,
  type GameSetupWithRolesResult,
  setupNPlayerGameWithRoles,
} from '../helpers/multi-player';

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
// Role-aware helpers
// ---------------------------------------------------------------------------

/** Find the page index for a given role displayName. Returns -1 if not found. */
function findRolePageIndex(roleMap: Map<number, CapturedRole>, roleName: string): number {
  for (const [idx, info] of roleMap) {
    if (info.displayName === roleName) return idx;
  }
  return -1;
}

/** Find ALL page indices for a given role displayName. */
function findAllRolePageIndices(roleMap: Map<number, CapturedRole>, roleName: string): number[] {
  const indices: number[] = [];
  for (const [idx, info] of roleMap) {
    if (info.displayName === roleName) indices.push(idx);
  }
  return indices;
}

/** Read the action-message testID text content, empty string if not visible. */
async function getActionMsg(page: Page): Promise<string> {
  const loc = page.locator('[data-testid="action-message"]');
  return (await loc.textContent({ timeout: 200 }).catch(() => '')) ?? '';
}

/** Check if any night-end keyword is visible on the page. */
async function isNightEnded(page: Page): Promise<boolean> {
  for (const kw of ['平安夜', '玩家死亡', '查看昨晚信息']) {
    const visible = await page
      .getByText(kw)
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) return true;
  }
  return false;
}

/** Click a seat tile with confirmation alert. Returns true if confirmed. */
async function clickSeatAndConfirm(page: Page, seatIdx: number): Promise<boolean> {
  const tile = page.locator(`[data-testid="seat-tile-pressable-${seatIdx}"]`);
  await tile.waitFor({ state: 'visible', timeout: 5000 });
  await tile.click({ force: true });

  // Wait for confirmation alert
  const alertModal = page.locator('[data-testid="alert-modal"]');
  const appeared = await alertModal
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;

  const confirmBtn = alertModal.getByText('确定', { exact: true }).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click({ force: true });
    await alertModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Try to click any advance button (知道了, 不使用技能, etc.) on a page.
 * Returns true if a button was clicked.
 */
async function tryClickAdvanceButton(page: Page): Promise<boolean> {
  const ADVANCE_BUTTONS = ['知道了', '不使用技能', '确定', '查看发动状态', '查看技能状态'];

  // Check alert modal first
  const alertModal = page.locator('[data-testid="alert-modal"]');
  if (await alertModal.isVisible().catch(() => false)) {
    for (const text of ADVANCE_BUTTONS) {
      const btn = alertModal.getByText(text, { exact: true }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        await alertModal.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
        return true;
      }
    }
  }

  // Check bottom action panel
  const panel = page.locator('[data-testid="bottom-action-panel"]');
  for (const text of ADVANCE_BUTTONS) {
    const btn = panel.getByText(text, { exact: true }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(300);
      return true;
    }
  }

  return false;
}

/**
 * Generic poll loop: advance night on any page until condition is met or maxIter reached.
 * Uses simple skip-all strategy (clicks advance buttons, no seat selection).
 */
async function pollUntil(
  pages: Page[],
  condition: () => Promise<boolean>,
  maxIter = 60,
): Promise<void> {
  for (let i = 0; i < maxIter; i++) {
    if (await condition()) return;
    for (const page of pages) {
      await tryClickAdvanceButton(page);
    }
    await pages[0].waitForTimeout(500);
  }
}

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

      // Wait for night to end (wolf vote countdown + server processing)
      // Poll all pages for night-end indicators
      await pollUntil(
        pages,
        async () => {
          for (const p of pages) {
            if (await isNightEnded(p)) return true;
          }
          return false;
        },
        80,
      );

      // Verify night ended on host page
      const nightDone = await isNightEnded(hostPage);
      expect(nightDone, 'Night should have ended').toBe(true);

      // Verify the death message mentions the correct seat number (1-based display)
      const expectedSeatDisplay = villagerSeat + 1; // 0-based → 1-based
      const deathLocator = hostPage.locator(`text=/${expectedSeatDisplay}号/`);
      const deathVisible = await deathLocator
        .first()
        .isVisible()
        .catch(() => false);

      // Attach diagnostic info
      await testInfo.attach('2p-death-verify.txt', {
        body: [
          `Room: ${roomNumber}`,
          `Wolf: page${wolfIdx} seat${roleMap.get(wolfIdx)!.seat}`,
          `Villager: page${villagerIdx} seat${villagerSeat}`,
          `Expected death: ${expectedSeatDisplay}号`,
          `Death visible: ${deathVisible}`,
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
      // Wait for wolf action message on any wolf page
      const firstWolfPage = pages[wolfIndices[0]];
      await firstWolfPage
        .locator('[data-testid="action-message"]')
        .waitFor({ state: 'visible', timeout: 30_000 });

      // Pick a non-wolf target for the kill
      const killTarget = [...roleMap.entries()].find(([, info]) => info.displayName !== '狼人');
      const killTargetSeat = killTarget ? killTarget[1].seat : 0;

      // All wolves vote on the same target
      for (const wIdx of wolfIndices) {
        const wPage = pages[wIdx];
        // Wait for the wolf to see the action message
        await wPage
          .locator('[data-testid="action-message"]')
          .waitFor({ state: 'visible', timeout: 10_000 })
          .catch(() => {});
        await clickSeatAndConfirm(wPage, killTargetSeat);
      }

      // --- Phase 2: Skip through witch + hunter steps ---
      // Poll and click advance buttons until seer's action message appears
      let seerTurnDetected = false;
      for (let iter = 0; iter < 120; iter++) {
        // Check if seer's turn has arrived
        const seerMsg = await getActionMsg(seerPage);
        if (seerMsg.includes('查验') || seerMsg.includes('选择')) {
          seerTurnDetected = true;
          break;
        }

        // Check if night ended prematurely
        if (await isNightEnded(pages[0])) break;

        // Try to advance on any page (skip witch/hunter actions)
        for (const p of pages) {
          await tryClickAdvanceButton(p);
        }
        await pages[0].waitForTimeout(500);
      }

      expect(seerTurnDetected, 'Seer turn should appear during night').toBe(true);

      // --- Phase 3: Seer checks a known wolf ---
      const seerConfirmed = await clickSeatAndConfirm(seerPage, targetWolfSeat);
      expect(seerConfirmed, 'Seer check should be confirmed').toBe(true);

      // Wait for the reveal dialog — should contain "查验结果" and "狼人"
      // The reveal appears as an alert modal with the result text
      const revealModal = seerPage.locator('[data-testid="alert-modal"]');
      await revealModal.waitFor({ state: 'visible', timeout: 10_000 });

      const revealText = (await revealModal.textContent().catch(() => '')) ?? '';
      console.log(`[NightVerify] Seer reveal text: ${revealText}`);

      // The reveal should mention the checked seat number and "狼人"
      const expectedRevealSeat = targetWolfSeat + 1; // 0-based → 1-based
      expect(revealText, 'Reveal should contain seat number').toContain(`${expectedRevealSeat}号`);
      expect(revealText, 'Reveal should say 狼人').toContain('狼人');

      // Dismiss the reveal
      const knowBtn = revealModal.getByText('知道了', { exact: true }).first();
      if (await knowBtn.isVisible().catch(() => false)) {
        await knowBtn.click();
      } else {
        const okBtn = revealModal.getByText('确定', { exact: true }).first();
        if (await okBtn.isVisible().catch(() => false)) await okBtn.click();
      }

      // --- Phase 4: Wait for night to complete ---
      await pollUntil(
        pages,
        async () => {
          for (const p of pages) {
            if (await isNightEnded(p)) return true;
          }
          return false;
        },
        80,
      );

      const nightDone = await isNightEnded(pages[0]);
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
