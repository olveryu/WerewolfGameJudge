import { expect, test } from '@playwright/test';

import { closeAll, createPlayerContexts, MultiPlayerFixture } from '../fixtures/app.fixture';
import { ensureAnonLogin, enterRoomCodeViaNumPad, waitForAppReady } from '../helpers/home';
import { gotoWithRetry } from '../helpers/ui';
import { waitForRoomScreenReady } from '../helpers/waits';
import { ConfigPage } from '../pages/ConfigPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Entry Flow E2E Tests
 *
 * Verifies app entry scenarios:
 * 1. First-time open (no session) → login button visible, can login
 * 2. Return with existing session → home ready without re-login
 * 3. Enter room from home via join flow
 * 4. Direct room URL with session → room screen loads
 * 5. Direct room URL without session → AuthGateOverlay → login → room loads
 */

test.setTimeout(60_000);

// ---------------------------------------------------------------------------
// 1. First-time open (fresh context, no session)
// ---------------------------------------------------------------------------

test.describe('First-time open (no session)', () => {
  test('shows login button, no user name', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoWithRetry(page, '/');
      await waitForAppReady(page);

      // Should see the login button (user is not logged in)
      const loginBtn = page.locator('[data-testid="home-login-button"]');
      await expect(loginBtn).toBeVisible({ timeout: 10_000 });

      // Should NOT see user name
      const userName = page.locator('[data-testid="home-user-name"]');
      await expect(userName).not.toBeVisible({ timeout: 2_000 });
    } finally {
      await ctx.close();
    }
  });

  test('can complete anonymous login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoWithRetry(page, '/');
      await waitForAppReady(page);

      // Trigger login
      await ensureAnonLogin(page);

      // After login, user name should be visible
      const userName = page.locator('[data-testid="home-user-name"]');
      await expect(userName).toBeVisible({ timeout: 15_000 });
    } finally {
      await ctx.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Return with existing session
// ---------------------------------------------------------------------------

test.describe('Return with existing session', () => {
  test('reload preserves session, home ready without re-login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      // First visit: login
      await gotoWithRetry(page, '/');
      await waitForAppReady(page);
      await ensureAnonLogin(page);

      const userName = page.locator('[data-testid="home-user-name"]');
      await expect(userName).toBeVisible({ timeout: 15_000 });

      // Reload page (simulates closing and reopening the browser tab)
      await page.reload();
      await waitForAppReady(page);

      // Session should persist — user name visible without re-login
      await expect(userName).toBeVisible({ timeout: 15_000 });

      // Login button should NOT be visible (already logged in)
      const loginBtn = page.locator('[data-testid="home-login-button"]');
      await expect(loginBtn).not.toBeVisible({ timeout: 2_000 });

      // Home screen action buttons should be ready
      await expect(page.locator('[data-testid="home-enter-room-button"]')).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.locator('[data-testid="home-create-room-button"]')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Enter room from home via join flow
// ---------------------------------------------------------------------------

test.describe('Enter room via join flow', () => {
  let fixture: MultiPlayerFixture;
  let roomNumber: string;

  test.afterEach(async () => {
    if (fixture) await closeAll(fixture);
  });

  test('joiner enters room via room code from home', async ({ browser }) => {
    // Step 1: Host creates a room
    fixture = await createPlayerContexts(browser, 2);
    const [hostPage, joinerPage] = fixture.pages;

    await hostPage.getByText('创建房间').click();
    const config = new ConfigPage(hostPage);
    await config.waitForCreateMode();
    await config.clickCreate();
    await waitForRoomScreenReady(hostPage, { role: 'host' });

    const hostRoom = new RoomPage(hostPage);
    roomNumber = await hostRoom.getRoomNumber();

    // Step 2: Joiner enters room via join flow
    await joinerPage.locator('[data-testid="home-enter-room-button"]').click();
    await expect(joinerPage.getByText('加入房间')).toBeVisible({ timeout: 5_000 });

    await enterRoomCodeViaNumPad(joinerPage, roomNumber);
    await joinerPage.getByText('加入', { exact: true }).click();

    // Step 3: Verify joiner is on room screen
    await waitForRoomScreenReady(joinerPage, { role: 'joiner' });
    await expect(joinerPage.locator('[data-testid="room-screen-root"]')).toBeVisible({
      timeout: 5_000,
    });

    // Room header should contain the room number
    const header = joinerPage.locator('[data-testid="room-header"]');
    await expect(header).toContainText(roomNumber);
  });
});

// ---------------------------------------------------------------------------
// 4. Direct room URL (with session)
// ---------------------------------------------------------------------------

test.describe('Direct room URL', () => {
  let fixture: MultiPlayerFixture;

  test.afterEach(async () => {
    if (fixture) await closeAll(fixture);
  });

  test('with session → room screen loads directly', async ({ browser }) => {
    // Step 1: Host creates a room
    fixture = await createPlayerContexts(browser, 1);
    const [hostPage] = fixture.pages;

    await hostPage.getByText('创建房间').click();
    const config = new ConfigPage(hostPage);
    await config.waitForCreateMode();
    await config.clickCreate();
    await waitForRoomScreenReady(hostPage, { role: 'host' });

    const hostRoom = new RoomPage(hostPage);
    const roomNumber = await hostRoom.getRoomNumber();

    // Step 2: New context with session — login first, then go to direct URL
    const directCtx = await browser.newContext();
    const directPage = await directCtx.newPage();
    fixture.contexts.push(directCtx);
    fixture.pages.push(directPage);

    await gotoWithRetry(directPage, '/');
    await waitForAppReady(directPage);
    await ensureAnonLogin(directPage);

    // Step 3: Navigate directly to room URL
    await gotoWithRetry(directPage, `/room/${roomNumber}`);
    await waitForRoomScreenReady(directPage, { role: 'joiner' });

    // Verify room screen is visible with correct room number
    await expect(directPage.locator('[data-testid="room-screen-root"]')).toBeVisible({
      timeout: 5_000,
    });
    const header = directPage.locator('[data-testid="room-header"]');
    await expect(header).toContainText(roomNumber);
  });

  test('without session → AuthGateOverlay → login → room loads', async ({ browser }) => {
    // Step 1: Host creates a room (needs a logged-in context)
    fixture = await createPlayerContexts(browser, 1);
    const [hostPage] = fixture.pages;

    await hostPage.getByText('创建房间').click();
    const config = new ConfigPage(hostPage);
    await config.waitForCreateMode();
    await config.clickCreate();
    await waitForRoomScreenReady(hostPage, { role: 'host' });

    const hostRoom = new RoomPage(hostPage);
    const roomNumber = await hostRoom.getRoomNumber();

    // Step 2: Fresh context with NO session — direct URL to room
    const freshCtx = await browser.newContext();
    const freshPage = await freshCtx.newPage();
    fixture.contexts.push(freshCtx);
    fixture.pages.push(freshPage);

    await gotoWithRetry(freshPage, `/room/${roomNumber}`);

    // Step 3: AuthGateOverlay should appear ("需要登录")
    await expect(freshPage.getByText('需要登录')).toBeVisible({ timeout: 15_000 });
    await expect(freshPage.getByText('请选择登录方式以加入房间')).toBeVisible({ timeout: 5_000 });

    // Step 4: Click anonymous login
    const anonBtn = freshPage.locator('[data-testid="home-anon-login-button"]');
    // AuthGateOverlay reuses LoginOptions which uses homeAnonLoginButton testID
    // If testID not present, fallback to text match
    const hasTestId = await anonBtn
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    if (hasTestId) {
      await anonBtn.click();
    } else {
      await freshPage.getByText('匿名登录').click();
    }

    // Step 5: After login, room screen should load
    await waitForRoomScreenReady(freshPage, { role: 'joiner' });
    await expect(freshPage.locator('[data-testid="room-screen-root"]')).toBeVisible({
      timeout: 10_000,
    });
    const header = freshPage.locator('[data-testid="room-header"]');
    await expect(header).toContainText(roomNumber);
  });
});
