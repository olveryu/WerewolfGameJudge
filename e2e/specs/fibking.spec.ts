import {
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_DEFINITION_FIELD_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
} from '@game-judge/game-engine/games/fibking/public';
import { expect, test } from '@playwright/test';

import {
  closeAll,
  type ColdRoomFixture,
  createColdRoomContext,
  createPlayerContexts,
} from '../fixtures/app.fixture';
import { FibConfigPage } from '../pages/FibConfigPage';
import { type FibIdentity, FibRoomPage, type FibWordDetails } from '../pages/FibRoomPage';
import { HomePage } from '../pages/HomePage';

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const PURE_HAN_WORD_PATTERN = /^\p{Script=Han}+$/u;
const LATIN_LETTER_PATTERN = /[A-Za-z]/;

function expectWordDetails(details: FibWordDetails, shouldShowDefinition: boolean): void {
  expect(details.word.length).toBeGreaterThanOrEqual(FIB_WORD_MIN_LENGTH);
  expect(details.word.length).toBeLessThanOrEqual(FIB_WORD_MAX_LENGTH);
  expect(details.word).toMatch(PURE_HAN_WORD_PATTERN);
  if (shouldShowDefinition) {
    expect(details.definition).not.toBeNull();
    if (details.definition === null) {
      throw new Error('The Fib word details did not include the definition');
    }
    for (const field of [details.definition.coreMeaning, details.definition.usageNote]) {
      expect(field.length).toBeGreaterThanOrEqual(FIB_DEFINITION_FIELD_MIN_LENGTH);
      expect(field.length).toBeLessThanOrEqual(FIB_DEFINITION_FIELD_MAX_LENGTH);
      expect(field).not.toMatch(LATIN_LETTER_PATTERN);
    }
    return;
  }
  expect(details.definition).toBeNull();
}

function expectIdentityVisibility(identity: FibIdentity): void {
  expectWordDetails(identity, identity.role === '老实人');
}

test.describe('FibKing', () => {
  test('large player count stays compact and has no arbitrary UI maximum', async ({ browser }) => {
    const fixture = await createPlayerContexts(browser, 1);
    const [page] = fixture.pages;

    try {
      await new HomePage(page).clickCreateRoom('fibking');
      const config = new FibConfigPage(page);
      await config.waitForCreateMode();
      await config.setPlayerCount(1_000_000);
      await config.increment();
      await config.expectPlayerCount(1_000_001);
      await config.createRoom();

      const room = new FibRoomPage(page);
      await room.waitForReady('host');
      await room.expectNoWerewolfOverlay();
      await room.expectPlayerCountHeading(1_000_001);
      await room.expectPaginationVisible();
      expect(await room.getSeatCount()).toBeLessThan(100);
    } finally {
      await closeAll(fixture);
    }
  });

  test('shared room shell drives real players, bots, identities, reveal, and next round', async ({
    browser,
  }, testInfo) => {
    const fixture = await createPlayerContexts(browser, 3);
    const [hostPage] = fixture.pages;
    let coldRoom: ColdRoomFixture | null = null;

    try {
      await new HomePage(hostPage).clickCreateRoom('fibking');
      const config = new FibConfigPage(hostPage);
      await config.waitForCreateMode();
      await config.createRoom();

      const hostRoom = new FibRoomPage(hostPage);
      await hostRoom.waitForReady('host');
      await hostRoom.expectNoWerewolfOverlay();
      const roomCode = await hostRoom.getRoomCode();
      await hostRoom.seatAt(0);

      const preauthenticatedJoinerPages = fixture.pages.slice(1);
      const preauthenticatedRooms = preauthenticatedJoinerPages.map(
        (page) => new FibRoomPage(page),
      );
      for (const room of preauthenticatedRooms) await room.joinViaCode(roomCode);
      coldRoom = await createColdRoomContext(browser, roomCode);
      const joinerPages = [...preauthenticatedJoinerPages, coldRoom.page];
      const joinerRooms = joinerPages.map((page) => new FibRoomPage(page));
      await joinerRooms[0]!.seatAt(1);
      await joinerRooms[1]!.seatAt(2);
      await joinerRooms[2]!.seatAt(7);

      await hostRoom.openRules();
      await hostRoom.returnFromRules();

      await hostRoom.openShare();
      await hostRoom.expectShareRoomCode(roomCode);
      await hostRoom.closeShare();

      await hostRoom.openConfig();
      const editConfig = new FibConfigPage(hostPage);
      await editConfig.setPlayerCount(4);
      await editConfig.saveExpectingRejectedShrink();
      for (let playerCount = 5; playerCount <= 8; playerCount += 1) {
        await editConfig.increment();
        await editConfig.expectPlayerCount(playerCount);
      }
      await editConfig.save();
      await hostRoom.waitForReady('host');
      await joinerRooms[2]!.moveToSeat(3);

      await hostRoom.openUserSettings();
      await hostRoom.returnFromUserSettings();

      await joinerRooms[1]!.standUp(2);
      await joinerRooms[1]!.seatAt(2);

      await hostRoom.kickPlayer(1);
      await joinerRooms[0]!.expectNotSeated();
      await joinerRooms[0]!.seatAt(1);

      await hostRoom.fillEmptySeatsWithBots(8);
      await hostRoom.kickPlayer(4);
      expect((await hostRoom.collectSeatState(5)).isEmpty, 'Kicked bot seat should be empty').toBe(
        true,
      );
      expect(
        (await hostRoom.collectSeatState(6)).isEmpty,
        'Kicking one bot must not remove other bots',
      ).toBe(false);
      await hostRoom.fillEmptySeatsWithBots(8);
      await hostRoom.screenshot(testInfo, 'fibking-lobby-eight-player.png');
      await hostRoom.startRound();

      const identities: FibIdentity[] = [];
      const realRooms = [hostRoom, ...joinerRooms];
      for (const room of realRooms) {
        const identity = await room.viewIdentity();
        identities.push(identity);
        expectIdentityVisibility(identity);
        await room.closeIdentity();
      }

      for (let seat = 4; seat < 8; seat += 1) {
        await hostRoom.takeOverBot(seat);
        const identity = await hostRoom.viewIdentity();
        identities.push(identity);
        expectIdentityVisibility(identity);
        await hostRoom.closeIdentity();
        await hostRoom.releaseBot();
      }

      expect(new Set(identities.map((identity) => identity.word)).size).toBe(1);
      expect(identities.filter((identity) => identity.role === '大聪明')).toHaveLength(1);
      expect(identities.filter((identity) => identity.role === '老实人')).toHaveLength(1);
      expect(identities.filter((identity) => identity.role === '瞎掰王')).toHaveLength(6);

      await hostRoom.screenshot(testInfo, 'fibking-ongoing.png');
      await hostRoom.revealRound();
      const result = await hostRoom.viewResult();
      expectWordDetails(result, true);
      await hostRoom.closeIdentity();

      await hostRoom.startNextRound();
      for (let seat = 0; seat < 8; seat += 1) {
        expect((await hostRoom.collectSeatState(seat + 1)).isEmpty).toBe(false);
      }
      await hostRoom.expectOngoing();

      await hostRoom.revealRound();
      await hostRoom.endGame();
      for (let seat = 0; seat < 8; seat += 1) {
        expect((await hostRoom.collectSeatState(seat + 1)).isEmpty).toBe(false);
      }
      await hostRoom.expectLobbySeatOperations();
    } finally {
      await coldRoom?.context.close();
      await closeAll(fixture);
    }
  });
});
