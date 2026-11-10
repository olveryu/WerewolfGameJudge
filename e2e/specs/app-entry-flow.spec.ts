import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createPlayerContexts, type MultiPlayerFixture } from '../fixtures/app.fixture';
import {
  ensureAnonLogin,
  enterRoomCodeViaNumPad,
  openJoinRoomDialog,
  startRoomCreation,
  submitJoinRoom,
  suppressVersionAnnouncement,
  waitForAppReady,
} from '../helpers/home';
import { gotoWithRetry } from '../helpers/ui';
import { waitForRoomScreenReady } from '../helpers/waits';
import { BoardPickerPage } from '../pages/BoardPickerPage';
import { ConfigPage } from '../pages/ConfigPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Entry Flow E2E Tests
 *
 * Verifies app entry scenarios:
 * 1. First-time open (no session) -> login button visible, can login
 * 2. Return with existing session -> home ready without re-login
 * 3. Enter room from home via join flow
 * 4. Direct room URL with session -> room screen loads
 * 5. Direct room URL without session -> AuthGateOverlay -> login -> room loads
 */

test.setTimeout(60_000);

// ---------------------------------------------------------------------------
// 1. First-time open (fresh context, no session)
// ---------------------------------------------------------------------------

test.describe('App — Entry Flow: First-time open (no session)', () => {
  test('shows login button, no user name', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await suppressVersionAnnouncement(page);

    try {
      await gotoWithRetry(page, '/');
      await waitForAppReady(page);

      // Should NOT see user name (not logged in)
      const userName = page.getByTestId(TESTIDS.homeUserName);
      await expect(userName).not.toBeVisible({ timeout: 2_000 });

      // Action buttons should still be visible (home screen ready)
      await expect(page.getByTestId(TESTIDS.homeEnterRoomButton)).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.getByTestId(TESTIDS.homeCreateRoomButton)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('can complete anonymous login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await suppressVersionAnnouncement(page);

    try {
      await gotoWithRetry(page, '/');
      await waitForAppReady(page);

      // Trigger login
      await ensureAnonLogin(page);

      // After login, user name should be visible
      const userName = page.getByTestId(TESTIDS.homeUserName);
      await expect(userName).toBeVisible({ timeout: 15_000 });
    } finally {
      await ctx.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Return with existing session
// ---------------------------------------------------------------------------

test.describe('App — Entry Flow: Return with existing session', () => {
  test('reload preserves session, home ready without re-login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await suppressVersionAnnouncement(page);

    try {
      // First visit: login
      await gotoWithRetry(page, '/');
      await waitForAppReady(page);
      await ensureAnonLogin(page);

      const userName = page.getByTestId(TESTIDS.homeUserName);
      await expect(userName).toBeVisible({ timeout: 15_000 });

      // Reload page (simulates closing and reopening the browser tab)
      await page.reload();
      await waitForAppReady(page);

      // Session should persist - user name visible without re-login
      await expect(userName).toBeVisible({ timeout: 15_000 });

      // Home screen action buttons should be ready
      await expect(page.getByTestId(TESTIDS.homeEnterRoomButton)).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.getByTestId(TESTIDS.homeCreateRoomButton)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Enter room from home via join flow
// ---------------------------------------------------------------------------

test.describe('App — Entry Flow: Enter room via join flow', () => {
  let fixture: MultiPlayerFixture;
  let roomCode: string;

  test.afterEach(async () => {
    if (fixture) await closeAll(fixture);
  });

  test('joiner enters room via room code from home', async ({ browser }) => {
    // Step 1: Host creates a room
    fixture = await createPlayerContexts(browser, 2);
    const [hostPage] = fixture.pages;
    const joinerPage = fixture.pages[1]!;

    await startRoomCreation(hostPage, 'werewolf');
    const boardPicker = new BoardPickerPage(hostPage);
    await boardPicker.waitForReady();
    await boardPicker.selectDefaultTemplate();
    const config = new ConfigPage(hostPage);
    await config.waitForReady();
    await config.clickCreate();
    await waitForRoomScreenReady(hostPage, { role: 'host' });

    const hostRoom = new RoomPage(hostPage);
    roomCode = await hostRoom.getRoomCode();

    // Step 2: Joiner enters room via join flow
    await openJoinRoomDialog(joinerPage);
    await enterRoomCodeViaNumPad(joinerPage, roomCode);
    await submitJoinRoom(joinerPage);

    // Step 3: Verify joiner is on room screen
    await waitForRoomScreenReady(joinerPage, { role: 'joiner' });
    await expect(joinerPage.getByTestId(TESTIDS.roomScreenRoot)).toBeVisible({
      timeout: 5_000,
    });

    // Room header should contain the room number
    const header = joinerPage.getByTestId(TESTIDS.roomHeader);
    await expect(header).toContainText(roomCode);
  });
});

// ---------------------------------------------------------------------------
// 4. Direct room URL (with session)
// ---------------------------------------------------------------------------

test.describe('App — Entry Flow: Direct room URL', () => {
  let fixture: MultiPlayerFixture;

  test.afterEach(async () => {
    if (fixture) await closeAll(fixture);
  });

  test('with session -> room screen loads directly', async ({ browser }) => {
    // Step 1: Host creates a room
    fixture = await createPlayerContexts(browser, 1);
    const [hostPage] = fixture.pages;

    await startRoomCreation(hostPage, 'werewolf');
    const boardPicker1 = new BoardPickerPage(hostPage);
    await boardPicker1.waitForReady();
    await boardPicker1.selectDefaultTemplate();
    const config = new ConfigPage(hostPage);
    await config.waitForReady();
    await config.clickCreate();
    await waitForRoomScreenReady(hostPage, { role: 'host' });

    const hostRoom = new RoomPage(hostPage);
    const roomCode = await hostRoom.getRoomCode();

    // Step 2: New context with session - login first, then go to direct URL
    const directCtx = await browser.newContext();
    const directPage = await directCtx.newPage();
    await suppressVersionAnnouncement(directPage);
    fixture.contexts.push(directCtx);
    fixture.pages.push(directPage);

    await gotoWithRetry(directPage, '/');
    await waitForAppReady(directPage);
    await ensureAnonLogin(directPage);

    // Step 3: Navigate directly to room URL
    await gotoWithRetry(directPage, `/room/${roomCode}`);
    await waitForRoomScreenReady(directPage, { role: 'joiner' });

    // Verify room screen is visible with correct room number
    await expect(directPage.getByTestId(TESTIDS.roomScreenRoot)).toBeVisible({
      timeout: 5_000,
    });
    const header = directPage.getByTestId(TESTIDS.roomHeader);
    await expect(header).toContainText(roomCode);
  });

  test('without session -> AuthGateOverlay -> login -> room loads', async ({ browser }) => {
    // Step 1: Host creates a room (needs a logged-in context)
    fixture = await createPlayerContexts(browser, 1);
    const [hostPage] = fixture.pages;

    await startRoomCreation(hostPage, 'werewolf');
    const boardPicker2 = new BoardPickerPage(hostPage);
    await boardPicker2.waitForReady();
    await boardPicker2.selectDefaultTemplate();
    const config = new ConfigPage(hostPage);
    await config.waitForReady();
    await config.clickCreate();
    await waitForRoomScreenReady(hostPage, { role: 'host' });

    const hostRoom = new RoomPage(hostPage);
    const roomCode = await hostRoom.getRoomCode();

    // Step 2: Fresh context with NO session - direct URL to room
    const freshCtx = await browser.newContext();
    const freshPage = await freshCtx.newPage();
    await suppressVersionAnnouncement(freshPage);
    fixture.contexts.push(freshCtx);
    fixture.pages.push(freshPage);

    await gotoWithRetry(freshPage, `/room/${roomCode}`);

    // Step 3: the room's login gate appears
    const loginDialog = freshPage.getByTestId(TESTIDS.loginDialog);
    await expect(loginDialog).toHaveAccessibleName('登录', { timeout: 15_000 });
    await expect(loginDialog).toHaveAccessibleDescription('选择登录方式以加入房间');

    // Step 4: Click anonymous login
    const anonBtn = freshPage.getByTestId(TESTIDS.homeAnonLoginButton);
    await expect(anonBtn).toContainText('匿名登录');
    await anonBtn.click();

    // Step 5: After login, room screen should load
    await waitForRoomScreenReady(freshPage, { role: 'joiner' });
    await expect(freshPage.getByTestId(TESTIDS.roomScreenRoot)).toBeVisible({
      timeout: 10_000,
    });
    const header = freshPage.getByTestId(TESTIDS.roomHeader);
    await expect(header).toContainText(roomCode);
  });
});
