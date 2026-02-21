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
  // 1. Join a non-existent room → fatal error → redirect to Home
  // -------------------------------------------------------------------------
  test('joining a non-existent room shows error and redirects home', async ({ browser }) => {
    const fixture = await createPlayerContexts(browser, 1);
    const [page] = fixture.pages;

    try {
      const home = new HomePage(page);
      await home.clickJoinRoom();
      await expect(page.getByText('加入房间')).toBeVisible({ timeout: 5000 });

      // Enter a room code that almost certainly doesn't exist
      await enterRoomCodeViaNumPad(page, '9999');
      await page.getByText('加入', { exact: true }).click();

      // The app navigates to RoomScreen, which discovers the room doesn't exist.
      // Fatal error triggers showAlert('房间异常', '房间不存在') + auto-redirect to Home.
      // Wait for the alert modal to appear (global AlertModal persists across screens)
      const alertModal = page.locator('[data-testid="alert-modal"]');
      const alertAppeared = await alertModal
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => true)
        .catch(() => false);

      if (alertAppeared) {
        const alertText = (await alertModal.textContent()) ?? '';
        expect(alertText).toContain('房间不存在');

        // Dismiss alert and wait for it to close
        const okBtn = alertModal.getByText('确定', { exact: true });
        await okBtn.click({ force: true });
        await alertModal.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
      }

      // After alert dismiss, page should return to Home.
      // navigation.navigate('Home') may push a new Home instance on the stack,
      // leaving the original hidden. Use .last() to target the topmost one.
      await expect(page.locator('[data-testid="home-screen-root"]').last()).toBeVisible({
        timeout: 10_000,
      });
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

      // Verify redirected to home
      await expect(hostPage.locator('[data-testid="home-screen-root"]').last()).toBeVisible({
        timeout: 10_000,
      });
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
    const joinerPage = joinerPages[0];

    try {
      // Click back button
      await joinerPage.locator('[data-testid="room-back-button"]').click();

      // Confirm leave
      await expect(joinerPage.getByText('离开房间？')).toBeVisible({ timeout: 5000 });
      await joinerPage.getByText('确定', { exact: true }).click();

      // Verify redirected to home
      await expect(joinerPage.locator('[data-testid="home-screen-root"]').last()).toBeVisible({
        timeout: 10_000,
      });
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
      await home.clickCreateRoom();

      const { ConfigPage } = await import('../pages/ConfigPage');
      const config = new ConfigPage(page);
      await config.waitForCreateMode();

      // Default 预女猎白: 4w + seer + witch + hunter + idiot + 4v = 12
      // Deselect all special roles
      await config.deselectRoles(['seer', 'witch', 'hunter', 'idiot']);
      // Decrease villager count 4 → 0
      await config.decreaseStepper('villager', 4);
      // Switch to wolf tab, decrease wolf count 4 → 0
      await config.switchToFactionTab('wolf');
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
