import { expect, test } from '@playwright/test';

import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { getVisibleText } from '../helpers/ui';
import { waitForRoomScreenReady } from '../helpers/waits';
import { ConfigPage } from '../pages/ConfigPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Seating E2E Tests
 *
 * Regression tests for seat management:
 * 1. Single player manual seat + "我" badge
 * 2. Two player seat conflict detection
 * 3. Occupied seat rejection alert
 * 4. Host sees joiner seat update (broadcast)
 * 5. Seat switching clears old seat
 * 6. Stand up broadcasts empty seat
 */

test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// Stabilization helpers (ported from seating.basic.spec.ts)
// ---------------------------------------------------------------------------

async function settleAfterRoomReady(page: import('@playwright/test').Page) {
  await page.waitForTimeout(300);
}

async function dismissAnyConfirmAlert(page: import('@playwright/test').Page) {
  await page
    .getByText('确定', { exact: true })
    .click({ timeout: 1000 })
    .catch(() => {});
}

/**
 * Poll until host sees a seat become occupied (non-empty).
 */
async function pollSeatOccupied(
  room: RoomPage,
  displayNumber: number,
  maxPollMs = 10000,
): Promise<ReturnType<RoomPage['collectSeatState']>> {
  const pollInterval = 250;
  const startTime = Date.now();
  let state = await room.collectSeatState(displayNumber);
  while (Date.now() - startTime < maxPollMs) {
    state = await room.collectSeatState(displayNumber);
    if (!state.isEmpty && state.hasPlayerName) return state;
    await new Promise((r) => setTimeout(r, pollInterval));
  }
  return state;
}

/**
 * Poll until host sees a seat become empty.
 */
async function pollSeatEmpty(
  room: RoomPage,
  displayNumber: number,
  maxPollMs = 10000,
): Promise<ReturnType<RoomPage['collectSeatState']>> {
  const pollInterval = 250;
  const startTime = Date.now();
  let state = await room.collectSeatState(displayNumber);
  while (Date.now() - startTime < maxPollMs) {
    state = await room.collectSeatState(displayNumber);
    if (state.isEmpty) return state;
    await new Promise((r) => setTimeout(r, pollInterval));
  }
  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Seating', () => {
  test('single player manual seat shows "我" badge', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 1);
    const [page] = fixture.pages;

    try {
      const home = page;
      await home.getByText('创建房间').click();
      const config = new ConfigPage(page);
      await config.waitForCreateMode();
      await config.clickCreate();

      const room = new RoomPage(page);
      await room.waitForReady('host');

      // Host manually takes seat 0 (display 1)
      await room.seatAt(0);

      const seat1 = await room.collectSeatState(1);
      expect(seat1.hasPlayerName, 'Seat 1 should be occupied').toBe(true);

      // "我" badge should be visible
      await room.expectMyBadgeVisible();

      // Click own seat → should show "站起" modal (not "入座")
      await room.getSeatTile(0).click();
      await expect(page.getByText('站起', { exact: true })).toBeVisible({ timeout: 5000 });

      // Dismiss
      await page
        .getByText('取消')
        .click()
        .catch(() => {});

      await room.screenshot(testInfo, 'single-player-seated.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('two player seat conflict detection', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA, pageB] = fixture.pages;

    try {
      // Host creates room
      await pageA.getByText('创建房间').click();
      const config = new ConfigPage(pageA);
      await config.waitForCreateMode();
      await config.clickCreate();

      const roomA = new RoomPage(pageA);
      await roomA.waitForReady('host');
      await roomA.seatAt(0);
      const roomNumber = await roomA.getRoomNumber();

      // Joiner joins
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      await enterRoomCodeViaNumPad(pageB, roomNumber);
      await pageB.getByText('加入', { exact: true }).click();
      await waitForRoomScreenReady(pageB, { role: 'joiner' });

      const roomB = new RoomPage(pageB);

      // Joiner tries to click host's seat (index 0)
      await roomB.getSeatTile(0).click();

      // Should show "入座" confirm dialog → confirm → rejection alert
      const hasRuZuo = await pageB
        .getByText('入座', { exact: true })
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (hasRuZuo) {
        await pageB.getByText('确定', { exact: true }).click();
      }

      // Wait for and dismiss the "入座失败" rejection alert
      const hasRejection = await pageB
        .getByText('入座失败')
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (hasRejection) {
        await dismissAnyConfirmAlert(pageB);
        await pageB
          .getByText('入座失败')
          .waitFor({ state: 'hidden', timeout: 3000 })
          .catch(() => {});
      }

      // Joiner takes seat 2 instead
      await roomB.seatAt(1);
      await expect(pageB.getByText('我')).toBeVisible({ timeout: 3000 });

      // Host should see seat 2 occupied
      const hostSeat2 = await pollSeatOccupied(roomA, 2);
      expect(hostSeat2.hasPlayerName, 'Host sees seat 2 occupied').toBe(true);

      await roomA.screenshot(testInfo, 'two-player-conflict.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('joiner gets rejection alert for occupied seat', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA, pageB] = fixture.pages;

    try {
      // Host creates room
      await pageA.getByText('创建房间').click();
      const config = new ConfigPage(pageA);
      await config.waitForCreateMode();
      await config.clickCreate();

      const roomA = new RoomPage(pageA);
      await roomA.waitForReady('host');
      await roomA.seatAt(0);
      await settleAfterRoomReady(pageA);
      const roomNumber = await roomA.getRoomNumber();

      // Joiner joins
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      await enterRoomCodeViaNumPad(pageB, roomNumber);
      await pageB.getByText('加入', { exact: true }).click();
      await waitForRoomScreenReady(pageB, { role: 'joiner' });
      await settleAfterRoomReady(pageB);

      const roomB = new RoomPage(pageB);

      // Click occupied seat 0
      await roomB.getSeatTile(0).click();

      // If "入座" modal shows, confirm it
      const hasRuZuo = await pageB
        .getByText('入座', { exact: true })
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (hasRuZuo) {
        await pageB.getByText('确定', { exact: true }).click();
      }

      // Should see rejection alert
      const hasRejection = await pageB
        .getByText('入座失败')
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      const hasSeatTaken = await pageB
        .getByText('座位已被占用')
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false);

      expect(hasRejection, 'Should see rejection alert').toBe(true);
      expect(hasSeatTaken, 'Should mention seat is taken').toBe(true);

      // Dismiss
      await dismissAnyConfirmAlert(pageB);

      await roomB.screenshot(testInfo, 'rejection-alert.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('host sees joiner seat update via broadcast', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA, pageB] = fixture.pages;

    try {
      // Host creates room
      await pageA.getByText('创建房间').click();
      const config = new ConfigPage(pageA);
      await config.waitForCreateMode();
      await config.clickCreate();

      const roomA = new RoomPage(pageA);
      await roomA.waitForReady('host');
      await roomA.seatAt(0);
      await settleAfterRoomReady(pageA);
      const roomNumber = await roomA.getRoomNumber();

      // Host sees seat 2 empty before joiner
      const hostSeat2Before = await roomA.collectSeatState(2);
      expect(hostSeat2Before.isEmpty, 'Seat 2 should start empty').toBe(true);

      // Joiner joins
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      await enterRoomCodeViaNumPad(pageB, roomNumber);
      await pageB.getByText('加入', { exact: true }).click();
      await waitForRoomScreenReady(pageB, { role: 'joiner' });
      await settleAfterRoomReady(pageB);

      // Joiner takes seat 2
      const roomB = new RoomPage(pageB);
      await roomB.seatAt(1);
      const joinerSeat2 = await pollSeatOccupied(roomB, 2);
      expect(joinerSeat2.hasPlayerName, 'Joiner should be seated at seat 2').toBe(true);

      // Host polls for seat 2 update
      const hostSeat2After = await pollSeatOccupied(roomA, 2);
      expect(hostSeat2After.hasPlayerName, 'Host should see joiner at seat 2').toBe(true);

      await roomA.screenshot(testInfo, 'host-sees-joiner.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('seat switching clears old seat', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA, pageB] = fixture.pages;

    try {
      // Host creates room
      await pageA.getByText('创建房间').click();
      const config = new ConfigPage(pageA);
      await config.waitForCreateMode();
      await config.clickCreate();

      const roomA = new RoomPage(pageA);
      await roomA.waitForReady('host');
      await roomA.seatAt(0);
      await settleAfterRoomReady(pageA);
      const roomNumber = await roomA.getRoomNumber();

      // Joiner joins and takes seat 2
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      await enterRoomCodeViaNumPad(pageB, roomNumber);
      await pageB.getByText('加入', { exact: true }).click();
      await waitForRoomScreenReady(pageB, { role: 'joiner' });
      await settleAfterRoomReady(pageB);

      const roomB = new RoomPage(pageB);
      await roomB.seatAt(1);

      const joinerSeat2 = await pollSeatOccupied(roomB, 2);
      expect(joinerSeat2.hasPlayerName, 'Joiner seated at seat 2').toBe(true);

      // Switch to seat 5
      await roomB.seatAt(4);
      await dismissAnyConfirmAlert(pageB);

      // Poll for seat switch to propagate (broadcast round-trip)
      const joinerSeat5 = await pollSeatOccupied(roomB, 5);
      const joinerSeat2After = await pollSeatEmpty(roomB, 2);

      expect(joinerSeat5.hasPlayerName, 'Joiner now at seat 5').toBe(true);
      expect(joinerSeat2After.isEmpty, 'Old seat 2 should be empty').toBe(true);

      // Host should see the switch
      const hostSeat5 = await pollSeatOccupied(roomA, 5);
      const hostSeat2 = await roomA.collectSeatState(2);

      expect(hostSeat5.hasPlayerName, 'Host sees seat 5 occupied').toBe(true);
      expect(hostSeat2.isEmpty, 'Host sees old seat 2 empty').toBe(true);

      await roomA.screenshot(testInfo, 'seat-switch.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('stand up broadcasts empty seat to all', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA, pageB] = fixture.pages;

    try {
      // Host creates room
      await pageA.getByText('创建房间').click();
      const config = new ConfigPage(pageA);
      await config.waitForCreateMode();
      await config.clickCreate();

      const roomA = new RoomPage(pageA);
      await roomA.waitForReady('host');
      await roomA.seatAt(0);
      await settleAfterRoomReady(pageA);
      const roomNumber = await roomA.getRoomNumber();

      // Joiner joins and takes seat 2
      await getVisibleText(pageB, '进入房间').first().click();
      await expect(pageB.getByText('加入房间')).toBeVisible({ timeout: 5000 });
      await enterRoomCodeViaNumPad(pageB, roomNumber);
      await pageB.getByText('加入', { exact: true }).click();
      await waitForRoomScreenReady(pageB, { role: 'joiner' });
      await settleAfterRoomReady(pageB);

      const roomB = new RoomPage(pageB);
      await roomB.seatAt(1);

      // Wait for host to see seat 2 occupied
      const hostSeat2Before = await pollSeatOccupied(roomA, 2);
      expect(hostSeat2Before.hasPlayerName, 'Host sees seat 2 occupied').toBe(true);

      // Joiner stands up
      await roomB.standUp(1);

      // Joiner sees seat empty
      const joinerSeat2After = await roomB.collectSeatState(2);
      expect(joinerSeat2After.isEmpty, 'Joiner sees seat 2 empty after stand up').toBe(true);

      // Host polls for empty
      const hostSeat2After = await pollSeatEmpty(roomA, 2);
      expect(hostSeat2After.isEmpty, 'Host sees seat 2 empty after joiner stands up').toBe(true);

      await roomA.screenshot(testInfo, 'stand-up.png');
    } finally {
      await closeAll(fixture);
    }
  });
});
