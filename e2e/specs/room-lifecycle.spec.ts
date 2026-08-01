import { expect, test } from '@playwright/test';

import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { setupNPlayerGame } from '../helpers/multi-player';
import { HomePage } from '../pages/HomePage';

/**
 * Room Lifecycle E2E
 *
 * Tests room creation, join, and leave flows that are NOT covered
 * by the existing seating / night specs.
 */

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

test.describe('Room Lifecycle', () => {
  // -------------------------------------------------------------------------
  // 1. Reject a malformed room code before canonical resolution
  // -------------------------------------------------------------------------
  test('joining with a malformed room code stays in the join modal', async ({ browser }) => {
    const fixture = await createPlayerContexts(browser, 1);
    const [page] = fixture.pages;

    try {
      const home = new HomePage(page);
      await home.clickJoinRoom();
      await expect(page.getByText('加入房间')).toBeVisible({ timeout: 5000 });

      // 0000 is outside the canonical public-room namespace and must fail before lookup.
      await enterRoomCodeViaNumPad(page, '0000');
      await page.getByText('加入', { exact: true }).click();

      await expect(page.getByText('请输入4位数字房间号')).toBeVisible();
      await expect(page.getByText('加入房间')).toBeVisible();
      await expect(page).toHaveURL(/^(?!.*\/room\/)/);
    } finally {
      await closeAll(fixture);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Host leaves room → back at Home
  // -------------------------------------------------------------------------
  test('host can leave room via back button', async ({ browser }) => {
    const { fixture, hostPage } = await setupNPlayerGame(browser, {
      playerCount: 2,
      startGame: false,
    });

    try {
      // Click the back button on room header
      await hostPage.locator('[data-testid="room-back-button"]').click();

      // Confirm leave dialog: "离开房间？" → "确定"
      await expect(hostPage.getByText('离开房间？')).toBeVisible({ timeout: 5000 });
      await hostPage.getByText('确定', { exact: true }).click();

      // Verify redirected to home via URL (web-first assertion auto-retries)
      await expect(hostPage).toHaveURL(/^(?!.*\/room\/)/, { timeout: 15_000 });
    } finally {
      await closeAll(fixture);
    }
  });

  // -------------------------------------------------------------------------
  // 3. Player (joiner) leaves room → back at Home
  // -------------------------------------------------------------------------
  test('player can leave room via back button', async ({ browser }) => {
    const { fixture, joinerPages } = await setupNPlayerGame(browser, {
      playerCount: 2,
      startGame: false,
    });
    const joinerPage = joinerPages[0]!;

    try {
      // Click back button
      await joinerPage.locator('[data-testid="room-back-button"]').click();

      // Confirm leave
      await expect(joinerPage.getByText('离开房间？')).toBeVisible({ timeout: 5000 });
      await joinerPage.getByText('确定', { exact: true }).click();

      // Verify redirected to home via URL (web-first assertion auto-retries)
      await expect(joinerPage).toHaveURL(/^(?!.*\/room\/)/, { timeout: 15_000 });
    } finally {
      await closeAll(fixture);
    }
  });

  // -------------------------------------------------------------------------
  // 4. Config boundary: creating room with zero roles → validation error
  // -------------------------------------------------------------------------
  test('cannot create room with zero roles selected', async ({ browser }) => {
    const fixture = await createPlayerContexts(browser, 1);
    const [page] = fixture.pages;

    try {
      const home = new HomePage(page);
      await home.clickCreateRoom('werewolf');

      const { BoardPickerPage } = await import('../pages/BoardPickerPage');
      const bp = new BoardPickerPage(page);
      await bp.waitForReady();
      await bp.selectDefaultTemplate();

      const { ConfigPage } = await import('../pages/ConfigPage');
      const config = new ConfigPage(page);
      await config.waitForCreateMode();

      // Default Seer-Witch-Hunter-Villager board: 4w + seer + witch + hunter + idiot + 4v = 12
      // Deselect all special roles
      await config.deselectRoles(['seer', 'witch', 'hunter', 'idiot']);
      // Decrease villager count 4 → 0
      await config.decreaseStepper('villager', 4);
      // Switch to wolf tab, decrease wolf count 4 → 0
      await config.switchToFactionTab('Wolf');
      await config.decreaseStepper('wolf', 4);

      // Try to create — should fail validation
      await config.clickCreate();

      // Expect validation error: "请至少选择一个角色"
      await expect(page.getByText('请至少选择一个角色')).toBeVisible({ timeout: 5000 });
    } finally {
      await closeAll(fixture);
    }
  });
});
