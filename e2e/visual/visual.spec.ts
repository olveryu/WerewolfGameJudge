import path from 'node:path';

import { expect, type Locator, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { test as appTest } from '../fixtures/app.fixture';
import {
  openJoinRoomDialog,
  startRoomCreation,
  suppressVersionAnnouncement,
  waitForAppReady,
} from '../helpers/home';
import { gotoWithRetry } from '../helpers/ui';
import { waitForRoomScreenReady } from '../helpers/waits';
import { BoardPickerPage } from '../pages/BoardPickerPage';
import { ConfigPage } from '../pages/ConfigPage';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Visual gate (UI drift lock P2).
 *
 * The shared-component gallery block by block, then the key pages at 390×844,
 * compared pixel for pixel with `e2e/visual/__screenshots__/`. Run only through
 * `scripts/e2e-visual.mjs`, which pins the rendering environment; a visible
 * change updates its baselines in the same pull request
 * (`pnpm run e2e:visual:update`).
 *
 * Anything drawn from random data is masked: avatars (seeded by a random
 * anonymous user id) and the room title (random room code).
 */

const GALLERY_BLOCKS = [
  'screen-header',
  'button',
  'interaction',
  'icon-button',
  'switch',
  'choice-card',
  'faction-chip',
  'seat-dot',
  'avatar',
  'progress',
  'num-pad',
] as const;

/** Masks for every value drawn from random data on an app page: the room title carries the code. */
function randomRegions(page: Page): Locator[] {
  return [page.getByTestId(TESTIDS.roomHeaderTitle)];
}

/** Hides the avatars on app pages, drawn from the random user id of the run (see the file). */
const HIDE_RANDOM_AVATARS = path.join(__dirname, 'hide-random-avatars.css');

async function expectPage(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: randomRegions(page),
    stylePath: HIDE_RANDOM_AVATARS,
  });
}

test.describe('Visual — UI gallery', () => {
  test.beforeEach(async ({ page }) => {
    await suppressVersionAnnouncement(page);
    await gotoWithRetry(page, '/__bench/ui');
    await expect(page.getByTestId(TESTIDS.uiGalleryRoot)).toBeVisible();
  });

  for (const block of GALLERY_BLOCKS) {
    test(`gallery block ${block}`, async ({ page }) => {
      await expect(page.getByTestId(TESTIDS.uiGalleryBlock(block))).toHaveScreenshot(
        `gallery-${block}.png`,
      );
    });
  }

  for (const target of ['button-primary', 'button-secondary', 'icon-button'] as const) {
    test(`gallery ${target} hover and keyboard focus`, async ({ page }) => {
      const block = page.getByTestId(TESTIDS.uiGalleryBlock('interaction'));
      const control = page.getByTestId(TESTIDS.uiGalleryTarget(target));
      await control.hover();
      await expect(block).toHaveScreenshot(`gallery-${target}-hover.png`);
      await page.mouse.move(0, 0);
      // focus-visible comes only from the keyboard: focus the control before it, then Tab.
      await control.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(control).toBeFocused();
      await expect(block).toHaveScreenshot(`gallery-${target}-focus.png`);
    });
  }
});

test.describe('Visual — signed-out entry', () => {
  test('home and login dialog', async ({ page }) => {
    await suppressVersionAnnouncement(page);
    await gotoWithRetry(page, '/');
    await waitForAppReady(page);
    await expectPage(page, 'home-signed-out');
    await page.getByTestId(TESTIDS.homeEnterRoomButton).click();
    await expect(page.getByTestId(TESTIDS.loginDialog)).toHaveAccessibleName('登录');
    await expectPage(page, 'login-dialog');
  });

  test('admin first screen', async ({ page }) => {
    await suppressVersionAnnouncement(page);
    await gotoWithRetry(page, '/admin');
    await expect(page.getByTestId(TESTIDS.adminLoginScreen)).toBeVisible();
    await expectPage(page, 'admin-login');
  });
});

appTest.describe('Visual — signed-in pages', () => {
  appTest('home, join dialog and settings', async ({ app }) => {
    const { page } = app;
    await expectPage(page, 'home');
    await openJoinRoomDialog(page);
    await expectPage(page, 'join-room-dialog');
    await page.getByTestId(TESTIDS.joinRoomCancelButton).click();
    await expect(page.getByTestId(TESTIDS.joinRoomDialog)).toBeHidden();
    await new HomePage(page).clickSettings();
    await expect(page.getByTestId(TESTIDS.screenHeaderTitle)).toHaveText('设置');
    await expectPage(page, 'settings');
  });

  appTest('appearance', async ({ app }) => {
    await gotoWithRetry(app.page, '/appearance');
    await expect(app.page.getByTestId(TESTIDS.appearanceScreen)).toBeVisible();
    await expectPage(app.page, 'appearance');
  });

  appTest('gacha', async ({ app }) => {
    await gotoWithRetry(app.page, '/gacha');
    await expect(app.page.getByTestId(TESTIDS.screenHeaderTitle)).toHaveText('扭蛋抽奖');
    await expectPage(app.page, 'gacha');
  });

  appTest('werewolf encyclopedia', async ({ app }) => {
    await gotoWithRetry(app.page, '/game/werewolf/guide');
    await expect(app.page.getByTestId(TESTIDS.encyclopediaScreenRoot)).toBeVisible();
    await expectPage(app.page, 'werewolf-encyclopedia');
  });

  appTest('werewolf board picker, config and 12-seat lobby', async ({ app }) => {
    appTest.setTimeout(120_000);
    const { page } = app;
    await startRoomCreation(page, 'werewolf');
    const boardPicker = new BoardPickerPage(page);
    await boardPicker.waitForReady();
    await expectPage(page, 'werewolf-board-picker');
    await boardPicker.selectDefaultTemplate();
    const config = new ConfigPage(page);
    await config.waitForReady();
    await expectPage(page, 'werewolf-config');
    await config.clickCreate();
    await waitForRoomScreenReady(page, { role: 'host' });
    const room = new RoomPage(page);
    await room.seatAt(0);
    // Werewolf is the one game whose specs fill seats with bots (e2e rules).
    await room.clickHostManagementActionAndConfirm(TESTIDS.roomFillBotsButton, '填充机器人？');
    await room.expectSeatCount(12);
    await room.expectSeatOccupied(11);
    await expectPage(page, 'werewolf-room-lobby-12');
  });
});
