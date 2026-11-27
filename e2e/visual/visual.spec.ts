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
import {
  avalonEndedFixture,
  avalonNominationFixture,
  drawGuessAnsweringFixture,
  type RoomFixture,
  serveRoomFixture,
  werewolfTwelveSeatNightFixture,
} from './room-fixtures';

/**
 * Visual gate (UI drift lock P2).
 *
 * The shared-component gallery block by block, then the key pages at 390×844,
 * compared pixel for pixel with `e2e/visual/__screenshots__/`. Run only through
 * `scripts/e2e-visual.mjs`, which pins the rendering environment; a visible
 * change updates its baselines in the same pull request
 * (`pnpm run e2e:visual:update`).
 *
 * Anything drawn from random data is hidden: avatars (seeded by a random
 * anonymous user id) and toasts by the screenshot stylesheet, the room title
 * (random room code) and the Home spotlight role (random pick) by masks. Screens whose
 * content is random in a real game (dealt roles, words, draws) are drawn from
 * fixed fixtures instead: the gacha result on its bench page, room screens from
 * engine-built states served over the room socket (`room-fixtures.ts`).
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

/**
 * Masks for every value drawn from random data on an app page: the room title carries the
 * code, the Home spotlight shows a randomly picked role.
 */
function randomRegions(page: Page): Locator[] {
  return [page.getByTestId(TESTIDS.roomHeaderTitle), page.getByTestId(TESTIDS.homeSpotlightRole)];
}

/** Hides what varies run to run on app pages: avatars and transient toasts (see the file). */
const APP_PAGE_SCREENSHOT_STYLE = path.join(__dirname, 'app-page-screenshot.css');

/** Home's spotlight flips its front in on a timer after mount; the capture waits for it. */
async function waitForSpotlightFlip(page: Page): Promise<void> {
  await expect(page.getByTestId(TESTIDS.homeSpotlightFront)).toHaveAttribute(
    'aria-hidden',
    'false',
  );
}

async function expectPage(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: randomRegions(page),
    stylePath: APP_PAGE_SCREENSHOT_STYLE,
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
    await waitForSpotlightFlip(page);
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
    await waitForSpotlightFlip(page);
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

/** Create a room of `gameType` through the real flow, its socket answered by `fixture`. */
/**
 * Lead the page clock is started with before a countdown fixture's capture instant: room
 * entry runs on a flowing clock (pages pace their own work by it), then the clock is paused at
 * the capture instant. Room entry takes well under this; `pauseAt` rejects an instant already
 * passed, so a slower entry fails rather than capturing a different value.
 */
const COUNTDOWN_CLOCK_LEAD_MS = 5 * 60_000;

/** Installs the page clock for a countdown fixture; a fixture without one leaves it alone. */
async function installFixtureClock(page: Page, fixture: RoomFixture): Promise<void> {
  if (fixture.countdownCaptureAtMs === null) return;
  await page.clock.install({ time: fixture.countdownCaptureAtMs - COUNTDOWN_CLOCK_LEAD_MS });
  await page.reload();
  await waitForAppReady(page);
}

async function pauseFixtureClock(page: Page, fixture: RoomFixture): Promise<void> {
  if (fixture.countdownCaptureAtMs === null) return;
  await page.clock.pauseAt(fixture.countdownCaptureAtMs);
}

async function enterFixtureRoom(
  page: Page,
  gameType: 'avalon' | 'drawguess',
  fixture: RoomFixture,
): Promise<RoomPage> {
  await installFixtureClock(page, fixture);
  await serveRoomFixture(page, fixture);
  await new HomePage(page).clickCreateRoom(gameType);
  await page.getByTestId(TESTIDS.gameConfigSubmit(gameType)).click();
  const room = new RoomPage(page);
  await room.waitForReady('host');
  await pauseFixtureClock(page, fixture);
  return room;
}

test.describe('Visual — fixed-data screens', () => {
  test('gacha ten-draw result', async ({ page }) => {
    await suppressVersionAnnouncement(page);
    await gotoWithRetry(page, '/__bench/gacha-result');
    await expect(page.getByTestId(TESTIDS.gachaResultBenchRoot)).toBeAttached();
    await expect(page).toHaveScreenshot('gacha-ten-result.png');
  });
});

appTest.describe('Visual — fixed-state rooms', () => {
  appTest('werewolf 12-seat night', async ({ app }) => {
    const { page } = app;
    const fixture = werewolfTwelveSeatNightFixture();
    await serveRoomFixture(page, fixture);
    await startRoomCreation(page, 'werewolf');
    const boardPicker = new BoardPickerPage(page);
    await boardPicker.waitForReady();
    await boardPicker.selectDefaultTemplate();
    const config = new ConfigPage(page);
    await config.waitForReady();
    await config.clickCreate();
    await waitForRoomScreenReady(page, { role: 'host' });
    // A room entered mid-game asks for the tap that resumes its audio (游戏已恢复).
    const resume = page.getByTestId(TESTIDS.alertModal);
    await expect(resume.getByTestId(TESTIDS.alertTitle)).toHaveText('游戏已恢复');
    await resume.getByTestId(TESTIDS.alertButton(0)).click();
    await expect(resume).toBeHidden();
    await new RoomPage(page).expectSeatCount(12);
    await expectPage(page, 'werewolf-night-12');
  });

  appTest('avalon room', async ({ app }) => {
    await enterFixtureRoom(app.page, 'avalon', avalonNominationFixture());
    await expectPage(app.page, 'avalon-room');
  });

  appTest('avalon review', async ({ app }) => {
    const room = await enterFixtureRoom(app.page, 'avalon', avalonEndedFixture());
    await room.clickHostManagementAction(TESTIDS.roomReviewHostAction);
    await expect(app.page.getByTestId(TESTIDS.roomReviewDialog)).toContainText('坏人获胜');
    await expectPage(app.page, 'avalon-review');
  });

  appTest('drawguess answering', async ({ app }) => {
    await enterFixtureRoom(app.page, 'drawguess', drawGuessAnsweringFixture());
    await expectPage(app.page, 'drawguess-answering');
  });
});
