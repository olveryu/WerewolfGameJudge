/** Full-browser Pictionary relay from room creation through synchronized results. */

import { getPictionaryRelayStepCount } from '@game-judge/game-engine/games/pictionary/public';
import { expect, test } from '@playwright/test';

import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { HomePage } from '../pages/HomePage';
import { PictionaryConfigPage } from '../pages/PictionaryConfigPage';
import { PictionaryRoomPage } from '../pages/PictionaryRoomPage';

const PLAYER_COUNT = 4;
const RELAY_STEP_COUNT = getPictionaryRelayStepCount(PLAYER_COUNT);
const TOTAL_GALLERY_ENTRIES = PLAYER_COUNT * RELAY_STEP_COUNT;
const OPENING_PROMPTS = ['月球上的猫', '云端城堡', '跳舞的花', '海上火车'] as const;
const GUESS_SUBMISSIONS = [
  ['太阳', '小屋', '花朵', '帆船'],
  ['发光的球', '山顶房子', '旋转花园', '海边列车'],
  ['金色月亮', '漂浮村庄', '风中的花', '远航列车'],
] as const;

async function promptForEveryPlayer(
  rooms: readonly PictionaryRoomPage[],
  prompts: readonly string[],
): Promise<void> {
  await Promise.all(
    rooms.map((room, playerIndex) => room.completePromptEditing(prompts[playerIndex]!)),
  );
}

async function drawForEveryPlayer(
  rooms: readonly PictionaryRoomPage[],
  strokeOffset: number,
): Promise<void> {
  for (const [playerIndex, room] of rooms.entries()) {
    await room.drawStroke(strokeOffset + playerIndex);
  }
  await Promise.all(rooms.map((room) => room.completeDrawingEditing()));
}

async function guessForEveryPlayer(
  rooms: readonly PictionaryRoomPage[],
  guesses: readonly string[],
): Promise<void> {
  await Promise.all(
    rooms.map((room, playerIndex) => room.completeGuessEditing(guesses[playerIndex]!)),
  );
}

async function expectGalleryPositionForEveryPlayer(
  rooms: readonly PictionaryRoomPage[],
  chain: number,
  entry: number,
): Promise<void> {
  await Promise.all(
    rooms.map((room) => room.expectGalleryPosition(chain, entry, PLAYER_COUNT, RELAY_STEP_COUNT)),
  );
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
        await Promise.all(rooms.map((room) => room.expectPromptStep(1, RELAY_STEP_COUNT)));
        await hostRoom.expectPhoneSizedStage();
        await hostRoom.reviseReadyPrompt('月球上的狗', OPENING_PROMPTS[0]);
        await promptForEveryPlayer(rooms.slice(1), OPENING_PROMPTS.slice(1));
        await Promise.all(rooms.map((room) => room.expectDrawingStep(2, RELAY_STEP_COUNT)));
      });

      await test.step('exercise all tools and upload every first drawing', async () => {
        await hostRoom.exerciseDrawingTools();
        for (let playerIndex = 1; playerIndex < PLAYER_COUNT; playerIndex += 1) {
          await rooms[playerIndex]!.drawStroke(playerIndex);
        }
        await Promise.all(rooms.map((room) => room.completeDrawingEditing()));
      });

      for (const [guessIndex, guesses] of GUESS_SUBMISSIONS.entries()) {
        const guessStep = guessIndex * 2 + 3;
        const drawingStep = guessStep + 1;
        await test.step(`complete guess and drawing stages ${guessStep}-${drawingStep}`, async () => {
          await Promise.all(rooms.map((room) => room.expectGuessStep(guessStep, RELAY_STEP_COUNT)));
          if (guessIndex === 0) await rooms[1]!.expectFullscreenDrawingPreview();
          await guessForEveryPlayer(rooms, guesses);
          await Promise.all(
            rooms.map((room) => room.expectDrawingStep(drawingStep, RELAY_STEP_COUNT)),
          );
          await drawForEveryPlayer(rooms, PLAYER_COUNT * (guessIndex + 1));
        });
      }

      await Promise.all(rooms.map((room) => room.expectGallery()));

      await test.step('keep every player on the authoritative gallery cursor', async () => {
        await expectGalleryPositionForEveryPlayer(rooms, 1, 1);

        for (
          let globalEntryIndex = 1;
          globalEntryIndex < TOTAL_GALLERY_ENTRIES;
          globalEntryIndex += 1
        ) {
          await hostRoom.advanceGallery();
          const chain = Math.floor(globalEntryIndex / RELAY_STEP_COUNT) + 1;
          const entry = (globalEntryIndex % RELAY_STEP_COUNT) + 1;
          await expectGalleryPositionForEveryPlayer(rooms, chain, entry);
          if (globalEntryIndex === 1) await hostRoom.expectFullscreenDrawingPreview();

          await expect
            .poll(async () => {
              const entryTexts = await Promise.all(
                rooms.map((room) => room.readLatestGalleryEntryText()),
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
