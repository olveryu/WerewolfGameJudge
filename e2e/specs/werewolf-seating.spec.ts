import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { startRoomCreation } from '../helpers/home';
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
// Tests
// ---------------------------------------------------------------------------

test.describe('Werewolf — Seating', () => {
  test('single player manual seat shows green seat badge', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 1);
    const [page] = fixture.pages;

    try {
      const home = page;
      await startRoomCreation(home, 'werewolf');
      const bp = new BoardPickerPage(page);
      await bp.waitForReady();
      await bp.selectDefaultTemplate();
      const config = new ConfigPage(page);
      await config.waitForReady();
      await config.clickCreate();

      const room = new RoomPage(page);
      await room.waitForReady('host');

      // Host manually takes seat 0 (display 1)
      await room.seatAt(0);

      await room.expectSeatOccupied(0);

      // "我" badge should be visible
      await room.expectMyBadgeVisible();

      await room.standUp(0);
      await room.expectSeatEmpty(0);
      await room.seatAt(0);

      await room.screenshot(testInfo, 'single-player-seated.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('two player seat conflict detection', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA] = fixture.pages;
    const pageB = fixture.pages[1]!;

    try {
      // Host creates room
      await startRoomCreation(pageA, 'werewolf');
      const bp1 = new BoardPickerPage(pageA);
      await bp1.waitForReady();
      await bp1.selectDefaultTemplate();
      const config = new ConfigPage(pageA);
      await config.waitForReady();
      await config.clickCreate();

      const roomA = new RoomPage(pageA);
      await roomA.waitForReady('host');
      await roomA.seatAt(0);
      const roomCode = await roomA.getRoomCode();

      // Joiner joins
      const roomB = new RoomPage(pageB);
      await roomB.joinViaCode(roomCode);

      // Joiner taps host's occupied seat (index 0) - shows player profile card
      await roomB.getSeatTile(0).click();
      await expect(pageB.getByTestId(TESTIDS.playerProfileCard)).toBeVisible({ timeout: 5000 });
      // No seat dialog should appear (profile card, not "入座")
      await expect(pageB.getByTestId(TESTIDS.seatConfirmModal)).not.toBeVisible({ timeout: 1000 });

      // Dismiss profile card by clicking the overlay backdrop (outside the card)
      await pageB.mouse.click(5, 5);
      await expect(pageB.getByTestId(TESTIDS.playerProfileCard)).not.toBeVisible({ timeout: 3000 });

      // Joiner takes seat 2 instead
      await roomB.seatAt(1);
      await expect(pageB.getByTestId(TESTIDS.mySeatBadge)).toBeVisible({ timeout: 3000 });

      // Host should see seat 2 occupied
      await roomA.expectSeatOccupied(1);

      await roomA.screenshot(testInfo, 'two-player-conflict.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('host kicks seated player', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA] = fixture.pages;
    const pageB = fixture.pages[1]!;

    try {
      // Host creates room
      await startRoomCreation(pageA, 'werewolf');
      const bp2 = new BoardPickerPage(pageA);
      await bp2.waitForReady();
      await bp2.selectDefaultTemplate();
      const config = new ConfigPage(pageA);
      await config.waitForReady();
      await config.clickCreate();

      const roomA = new RoomPage(pageA);
      await roomA.waitForReady('host');
      await roomA.seatAt(0);
      const roomCode = await roomA.getRoomCode();

      // Joiner joins and takes seat 2
      const roomB = new RoomPage(pageB);
      await roomB.joinViaCode(roomCode);
      await roomB.seatAt(1);

      // Host sees seat 2 occupied
      await roomA.expectSeatOccupied(1);

      // Host kicks from the profile card; the seat empties without a confirm dialog
      await roomA.kickPlayer(1);

      // Joiner sees their seat badge disappear (kicked)
      await expect(pageB.getByTestId(TESTIDS.mySeatBadge)).not.toBeVisible({
        timeout: 10_000,
      });

      await roomA.screenshot(testInfo, 'host-kick.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('host sees joiner seat update via broadcast', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA] = fixture.pages;
    const pageB = fixture.pages[1]!;

    try {
      // Host creates room
      await startRoomCreation(pageA, 'werewolf');
      const bp3 = new BoardPickerPage(pageA);
      await bp3.waitForReady();
      await bp3.selectDefaultTemplate();
      const config = new ConfigPage(pageA);
      await config.waitForReady();
      await config.clickCreate();

      const roomA = new RoomPage(pageA);
      await roomA.waitForReady('host');
      await roomA.seatAt(0);
      const roomCode = await roomA.getRoomCode();

      // Host sees seat 2 empty before joiner
      await roomA.expectSeatEmpty(1);

      // Joiner joins
      const roomB = new RoomPage(pageB);
      await roomB.joinViaCode(roomCode);

      // Joiner takes seat 2
      await roomB.seatAt(1);
      await roomB.expectSeatOccupied(1);

      // Host receives the seat 2 update
      await roomA.expectSeatOccupied(1);

      await roomA.screenshot(testInfo, 'host-sees-joiner.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('seat switching clears old seat', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA] = fixture.pages;
    const pageB = fixture.pages[1]!;

    try {
      // Host creates room
      await startRoomCreation(pageA, 'werewolf');
      const bp4 = new BoardPickerPage(pageA);
      await bp4.waitForReady();
      await bp4.selectDefaultTemplate();
      const config = new ConfigPage(pageA);
      await config.waitForReady();
      await config.clickCreate();

      const roomA = new RoomPage(pageA);
      await roomA.waitForReady('host');
      await roomA.seatAt(0);
      const roomCode = await roomA.getRoomCode();

      // Joiner joins and takes seat 2
      const roomB = new RoomPage(pageB);
      await roomB.joinViaCode(roomCode);
      await roomB.seatAt(1);

      await roomB.expectSeatOccupied(1);

      // Switch to seat 5
      await roomB.moveToSeat(4);

      // The switch propagates: seat 5 taken, old seat 2 cleared, on both clients
      await roomB.expectSeatOccupied(4);
      await roomB.expectSeatEmpty(1);
      await roomA.expectSeatOccupied(4);
      await roomA.expectSeatEmpty(1);

      await roomA.screenshot(testInfo, 'seat-switch.png');
    } finally {
      await closeAll(fixture);
    }
  });

  test('stand up broadcasts empty seat to all', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 2);
    const [pageA] = fixture.pages;
    const pageB = fixture.pages[1]!;

    try {
      // Host creates room
      await startRoomCreation(pageA, 'werewolf');
      const bp5 = new BoardPickerPage(pageA);
      await bp5.waitForReady();
      await bp5.selectDefaultTemplate();
      const config = new ConfigPage(pageA);
      await config.waitForReady();
      await config.clickCreate();

      const roomA = new RoomPage(pageA);
      await roomA.waitForReady('host');
      await roomA.seatAt(0);
      const roomCode = await roomA.getRoomCode();

      // Joiner joins and takes seat 2
      const roomB = new RoomPage(pageB);
      await roomB.joinViaCode(roomCode);
      await roomB.seatAt(1);

      // Wait for host to see seat 2 occupied
      await roomA.expectSeatOccupied(1);

      // Joiner stands up; both clients see seat 2 empty
      await roomB.standUp(1);
      await roomB.expectSeatEmpty(1);
      await roomA.expectSeatEmpty(1);

      await roomA.screenshot(testInfo, 'stand-up.png');
    } finally {
      await closeAll(fixture);
    }
  });
});
