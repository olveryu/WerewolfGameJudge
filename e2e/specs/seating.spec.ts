import { expect, test } from '@playwright/test';

import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { getVisibleText } from '../helpers/ui';
import { waitForRoomScreenReady } from '../helpers/waits';
import { BoardPickerPage } from '../pages/BoardPickerPage';
import { ConfigPage } from '../pages/ConfigPage';
import { RoomPage } from '../pages/RoomPage';

/**
 * Seating E2E Tests
 *
 * Regression tests for seat management:
 * 1. Single player manual seat + green seat badge
 * 2. Two player seating (non-host occupied seat noop)
 * 3. Host kicks seated player
 * 4. Host sees joiner seat update (broadcast)
 * 5. Seat switching clears old seat
 * 6. Stand up broadcasts empty seat
 */

test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// Stabilization helpers (ported from seating.basic.spec.ts)
// ---------------------------------------------------------------------------

async function settleAfterRoomReady(page: import('@playwright/test').Page) {
  // Wait for room screen to be fully rendered
  await page
    .locator('[data-testid="room-screen-root"]')
    .waitFor({ state: 'visible', timeout: 3000 })
    .catch(() => {});
}

/**
 * Wait until host sees a seat become occupied (non-empty).
 * Uses Playwright's `expect.poll()` for built-in retry, timeout, and error reporting.
 */
async function pollSeatOccupied(
  room: RoomPage,
  displayNumber: number,
  maxPollMs = 10000,
): Promise<Awaited<ReturnType<RoomPage['collectSeatState']>>> {
  let state = await room.collectSeatState(displayNumber);
  await expect
    .poll(
      () =>
        room
          .collectSeatState(displayNumber)
          .then((s) => (state = s) && !s.isEmpty && s.hasPlayerName),
      {
        timeout: maxPollMs,
        intervals: [250],
        message: `Seat ${displayNumber} did not become occupied within ${maxPollMs}ms`,
      },
    )
    .toBeTruthy();
  return state;
}

/**
 * Wait until host sees a seat become empty.
 * Uses Playwright's `expect.poll()` for built-in retry, timeout, and error reporting.
 */
async function pollSeatEmpty(
  room: RoomPage,
  displayNumber: number,
  maxPollMs = 10000,
): Promise<Awaited<ReturnType<RoomPage['collectSeatState']>>> {
  let state = await room.collectSeatState(displayNumber);
  await expect
    .poll(() => room.collectSeatState(displayNumber).then((s) => (state = s) && s.isEmpty), {
      timeout: maxPollMs,
      intervals: [250],
      message: `Seat ${displayNumber} did not become empty within ${maxPollMs}ms`,
    })
    .toBeTruthy();
  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Seating', () => {
  test('single player manual seat shows green seat badge', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 1);
    const [page] = fixture.pages;

    try {
      const home = page;
      await home.getByText('创建房间').click();
      const bp = new BoardPickerPage(page);
      await bp.waitForReady();
      await bp.selectDefaultTemplate();
      const config = new ConfigPage(page);
      await config.waitForCreateMode();
      await config.clickCreate();

      const room = new RoomPage(page);
      await room.waitForReady('host');
      await settleAfterRoomReady(page);

      // Host manually takes seat 0 (display 1)
      await room.seatAt(0);

      const seat1 = await room.collectSeatState(1);
      expect(seat1.hasPlayerName, 'Seat 1 should be occupied').toBe(true);

      // "我" badge should be visible
      await room.expectMyBadgeVisible();

      // Click own seat → should show "离座" modal (not "入座")
      await room.getSeatTile(0).click();
      await expect(page.getByText('离座', { exact: true })).toBeVisible({ timeout: 5000 });

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
      const bp1 = new BoardPickerPage(pageA);
      await bp1.waitForReady();
      await bp1.selectDefaultTemplate();
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

      // Joiner taps host's occupied seat (index 0) — should be silent noop
      await roomB.getSeatTile(0).click();
      // No dialog should appear (non-host tapping occupied seat = noop)
      await expect(pageB.getByText('入座', { exact: true })).not.toBeVisible({ timeout: 1000 });

      // Joiner takes seat 2 instead
      await roomB.seatAt(1);
      await expect(pageB.locator('[data-testid="my-seat-badge"]')).toBeVisible({ timeout: 3000 });

      // Host should see seat 2 occupied
      const hostSeat2 = await pollSeatOccupied(roomA, 2);
      expect(hostSeat2.hasPlayerName, 'Host sees seat 2 occupied').toBe(true);

      await roomA.screenshot(testInfo, 'two-player-conflict.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('host kicks seated player', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA, pageB] = fixture.pages;

    try {
      // Host creates room
      await pageA.getByText('创建房间').click();
      const bp2 = new BoardPickerPage(pageA);
      await bp2.waitForReady();
      await bp2.selectDefaultTemplate();
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

      // Host sees seat 2 occupied
      await pollSeatOccupied(roomA, 2);

      // Host taps joiner's seat → kick confirmation dialog
      await roomA.getSeatTile(1).click();
      await expect(pageA.getByTestId('alert-title')).toHaveText('移出座位', { timeout: 5000 });
      await expect(pageA.getByText(/确定要将.*移出座位吗/)).toBeVisible({ timeout: 3000 });

      // Confirm kick
      await pageA.getByText('移出', { exact: true }).click();

      // Host sees seat 2 become empty
      const hostSeat2After = await pollSeatEmpty(roomA, 2);
      expect(hostSeat2After.isEmpty, 'Kicked seat should be empty').toBe(true);

      // Joiner sees their seat badge disappear (kicked)
      await expect(pageB.locator('[data-testid="my-seat-badge"]')).not.toBeVisible({
        timeout: 10_000,
      });

      await roomA.screenshot(testInfo, 'host-kick.png');
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
      const bp3 = new BoardPickerPage(pageA);
      await bp3.waitForReady();
      await bp3.selectDefaultTemplate();
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
      const bp4 = new BoardPickerPage(pageA);
      await bp4.waitForReady();
      await bp4.selectDefaultTemplate();
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
      const bp5 = new BoardPickerPage(pageA);
      await bp5.waitForReady();
      await bp5.selectDefaultTemplate();
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
