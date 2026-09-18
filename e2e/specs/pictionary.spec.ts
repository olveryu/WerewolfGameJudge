/** Full-browser Pictionary relay from room creation through synchronized results. */

import { getPictionaryRelayStepCount } from '@game-judge/game-engine/games/pictionary/public';
import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { HomePage } from '../pages/HomePage';
import { PictionaryConfigPage } from '../pages/PictionaryConfigPage';
import { PictionaryRoomPage } from '../pages/PictionaryRoomPage';

const PLAYER_COUNT = 4;
const RELAY_STEP_COUNT = getPictionaryRelayStepCount(PLAYER_COUNT);
const TOTAL_GALLERY_ENTRIES = PLAYER_COUNT * RELAY_STEP_COUNT;
const OPENING_PROMPTS = ['月球上的猫', '云端城堡', '跳舞的花', '海上火车'] as const;
const GUESS_SUBMISSIONS = [[' 太阳\n还没写完 ', '小屋', '花朵', '帆船']] as const;

async function promptForEveryPlayer(
  rooms: readonly PictionaryRoomPage[],
  prompts: readonly string[],
): Promise<void> {
  await Promise.all(
    rooms.map((room, playerIndex) => room.completePromptEditing(prompts[playerIndex]!)),
  );
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
      await fixture.pages[1]!.setViewportSize({ width: 390, height: 844 });
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
        for (const [playerIndex, viewport] of ['desktop', 'mobile'].entries()) {
          await test.info().attach(`pictionary-drawing-${viewport}`, {
            body: await fixture.pages[playerIndex]!.screenshot(),
            contentType: 'image/png',
          });
        }
        await Promise.all(rooms.map((room) => room.completeDrawingEditing()));
      });

      for (const [guessIndex, guesses] of GUESS_SUBMISSIONS.entries()) {
        const guessStep = guessIndex * 2 + 3;
        const drawingStep = guessStep + 1;
        await test.step(`complete guess and drawing stages ${guessStep}-${drawingStep}`, async () => {
          await Promise.all(rooms.map((room) => room.expectGuessStep(guessStep, RELAY_STEP_COUNT)));
          if (guessIndex === 0) await rooms[1]!.expectFullscreenDrawingPreview();
          await hostPage.getByTestId(TESTIDS.pictionaryTextInput).fill(guesses[0]);
          await guessForEveryPlayer(rooms.slice(1), guesses.slice(1));
          await hostPage.getByRole('button', { name: '结束本棒', exact: true }).click();
          await hostPage.getByRole('dialog').getByText('结束本棒', { exact: true }).click();
          await Promise.all(
            rooms.map((room) => room.expectDrawingStep(drawingStep, RELAY_STEP_COUNT)),
          );
          for (const room of rooms.slice(0, 3)) await room.drawStroke(PLAYER_COUNT);
          const unfinishedPage = fixture.pages[3]!;
          const canvas = unfinishedPage.getByTestId(TESTIDS.pictionaryDrawingCanvas);
          await canvas.scrollIntoViewIfNeeded();
          const bounds = await canvas.boundingBox();
          if (bounds === null) throw new Error('Unfinished drawing canvas is missing');
          await unfinishedPage.mouse.move(
            bounds.x + bounds.width * 0.2,
            bounds.y + bounds.height * 0.2,
          );
          await unfinishedPage.mouse.down();
          await unfinishedPage.mouse.move(
            bounds.x + bounds.width * 0.8,
            bounds.y + bounds.height * 0.8,
            { steps: 8 },
          );
          await unfinishedPage.route('**/submissions/**', (route) => route.abort('failed'), {
            times: 1,
          });
          await hostPage.getByRole('button', { name: '结束本棒', exact: true }).click();
          await hostPage.getByRole('dialog').getByText('结束本棒', { exact: true }).click();
          await expect(unfinishedPage.getByText('发送最终内容失败', { exact: true })).toBeVisible();
          await unfinishedPage.mouse.up();
          await unfinishedPage.getByRole('dialog').getByText('确定', { exact: true }).click();
          await unfinishedPage.getByRole('button', { name: '重试发送', exact: true }).click();
        });
      }

      await Promise.all(rooms.map((room) => room.expectGallery()));

      await test.step('keep every player on the authoritative gallery cursor', async () => {
        await expectGalleryPositionForEveryPlayer(rooms, 1, 1);
        const collectedGuesses: string[] = [];

        for (
          let globalEntryIndex = 1;
          globalEntryIndex < TOTAL_GALLERY_ENTRIES;
          globalEntryIndex += 1
        ) {
          await hostRoom.advanceGallery();
          const chain = Math.floor(globalEntryIndex / RELAY_STEP_COUNT) + 1;
          const entry = (globalEntryIndex % RELAY_STEP_COUNT) + 1;
          await expectGalleryPositionForEveryPlayer(rooms, chain, entry);
          if (entry === 3) collectedGuesses.push(await hostRoom.readLatestGalleryEntryText());
          if (entry % 2 === 0) {
            const image = hostPage
              .getByTestId(TESTIDS.pictionaryGalleryEntry)
              .last()
              .locator('img');
            await expect(image).toBeVisible();
            await expect
              .poll(() =>
                image.evaluate((element: HTMLImageElement) => {
                  if (!element.complete || element.naturalWidth === 0) return false;
                  const canvas = document.createElement('canvas');
                  canvas.width = element.naturalWidth;
                  canvas.height = element.naturalHeight;
                  const context = canvas.getContext('2d');
                  if (context === null) throw new Error('Canvas pixel check unavailable');
                  context.drawImage(element, 0, 0);
                  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
                  return pixels.some((value, index) => index % 4 !== 3 && value < 240);
                }),
              )
              .toBe(true);
          }
          if (globalEntryIndex === 1) {
            await hostRoom.expectFullscreenDrawingPreview();
            for (const [playerIndex, viewport] of ['desktop', 'mobile'].entries()) {
              await test.info().attach(`pictionary-gallery-${viewport}`, {
                body: await fixture.pages[playerIndex]!.screenshot(),
                contentType: 'image/png',
              });
            }
          }
          if (globalEntryIndex === 2) {
            await hostPage.getByRole('button', { name: '上一项', exact: true }).click();
            await expectGalleryPositionForEveryPlayer(rooms, 1, 2);
            await hostRoom.advanceGallery();
            await expectGalleryPositionForEveryPlayer(rooms, 1, 3);
          }

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
        expect(collectedGuesses.some((text) => text.includes(GUESS_SUBMISSIONS[0][0]))).toBe(true);
      });
    } finally {
      await closeAll(fixture);
    }
  });
});
