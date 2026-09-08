/** Full-browser Pictionary relay from room creation through synchronized results. */

import { expect, test } from '@playwright/test';

import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { HomePage } from '../pages/HomePage';
import { PictionaryConfigPage } from '../pages/PictionaryConfigPage';
import { PictionaryRoomPage } from '../pages/PictionaryRoomPage';

const PLAYER_COUNT = 4;
const OPENING_PROMPTS = ['月球上的猫', '云端城堡', '跳舞的花', '海上火车'] as const;
const FIRST_GUESSES = ['太阳', '小屋', '花朵', '帆船'] as const;

async function promptForEveryPlayer(
  rooms: readonly PictionaryRoomPage[],
  prompts: readonly string[],
): Promise<void> {
  await Promise.all(rooms.map((room, playerIndex) => room.submitPrompt(prompts[playerIndex]!)));
}

async function drawForEveryPlayer(
  rooms: readonly PictionaryRoomPage[],
  strokeOffset: number,
): Promise<void> {
  for (const [playerIndex, room] of rooms.entries()) {
    await room.drawStroke(strokeOffset + playerIndex);
  }
  await Promise.all(rooms.map((room) => room.submitDrawing()));
}

async function guessForEveryPlayer(
  rooms: readonly PictionaryRoomPage[],
  guesses: readonly string[],
): Promise<void> {
  await Promise.all(rooms.map((room, playerIndex) => room.submitGuess(guesses[playerIndex]!)));
}

async function expectGalleryPositionForEveryPlayer(
  rooms: readonly PictionaryRoomPage[],
  chain: number,
  entry: number,
): Promise<void> {
  await Promise.all(rooms.map((room) => room.expectGalleryPosition(chain, entry, PLAYER_COUNT)));
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

test.describe('Pictionary', () => {
  test('four real players complete a prompt-first relay and synchronized gallery', async ({
    browser,
  }) => {
    const fixture = await createPlayerContexts(browser, PLAYER_COUNT);
    const rooms = fixture.pages.map((page) => new PictionaryRoomPage(page));
    const hostPage = fixture.pages[0];
    const hostRoom = rooms[0]!;

    try {
      await test.step('create a deterministic four-player room', async () => {
        await new HomePage(hostPage).clickCreateRoom('pictionary');
        const config = new PictionaryConfigPage(hostPage);
        await config.waitForCreateMode();
        await config.configureFourPlayerManualGame();
        await config.createRoom();
        await hostRoom.waitForReady('host');

        const roomCode = await hostRoom.getRoomCode();
        await hostRoom.seatAt(0);
        for (let playerIndex = 1; playerIndex < PLAYER_COUNT; playerIndex += 1) {
          const room = rooms[playerIndex]!;
          await room.joinViaCode(roomCode);
          await room.seatAt(playerIndex);
        }
      });

      await test.step('start with a private prompt from every player', async () => {
        await hostRoom.startRound();
        await Promise.all(rooms.map((room) => room.expectPromptStep(1, PLAYER_COUNT)));
        await hostRoom.expectPhoneSizedStage();
        await promptForEveryPlayer(rooms, OPENING_PROMPTS);
        await Promise.all(rooms.map((room) => room.expectDrawingStep(2, PLAYER_COUNT)));
      });

      await test.step('exercise all tools and upload every first drawing', async () => {
        await hostRoom.exerciseDrawingTools();
        for (let playerIndex = 1; playerIndex < PLAYER_COUNT; playerIndex += 1) {
          await rooms[playerIndex]!.drawStroke(playerIndex);
        }
        await Promise.all(rooms.map((room) => room.submitDrawing()));
        await Promise.all(rooms.map((room) => room.expectGuessStep(3, PLAYER_COUNT)));
      });

      await test.step('inspect the received image and submit every guess', async () => {
        await rooms[1]!.expectFullscreenDrawingPreview();
        await guessForEveryPlayer(rooms, FIRST_GUESSES);
        await Promise.all(rooms.map((room) => room.expectDrawingStep(4, PLAYER_COUNT)));
      });

      await test.step('complete the final drawing stage', async () => {
        await drawForEveryPlayer(rooms, PLAYER_COUNT);
        await Promise.all(rooms.map((room) => room.expectGallery()));
      });

      await test.step('keep every player on the authoritative gallery cursor', async () => {
        await expectGalleryPositionForEveryPlayer(rooms, 1, 1);

        for (
          let globalEntryIndex = 1;
          globalEntryIndex < PLAYER_COUNT ** 2;
          globalEntryIndex += 1
        ) {
          await hostRoom.advanceGallery();
          const chain = Math.floor(globalEntryIndex / PLAYER_COUNT) + 1;
          const entry = (globalEntryIndex % PLAYER_COUNT) + 1;
          await expectGalleryPositionForEveryPlayer(rooms, chain, entry);
          if (globalEntryIndex === 1) await hostRoom.expectFullscreenDrawingPreview();

          await expect
            .poll(async () => {
              const entryTexts = await Promise.all(
                rooms.map((room) => room.readGalleryEntryText()),
              );
              return new Set(entryTexts).size;
            })
            .toBe(1);
        }

        await hostRoom.advanceGallery();
        await Promise.all(rooms.map((room) => room.expectEnded()));
      });
    } finally {
      await closeAll(fixture);
    }
  });
});
