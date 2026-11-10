/** Full-browser Pictionary relay from room creation through synchronized results. */

import { getPictionaryRelayStepCount } from '@game-judge/game-engine/games/pictionary/public';
import { expect, type Page, test } from '@playwright/test';

import { FETCH_RETRY_COUNT } from '../../packages/web/src/config/networkRetry';
import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import {
  closeReviewDialog,
  downloadReviewImage,
  expectWeChatImageShare,
  readPngSize,
} from '../helpers/image-sharing';
import { setOffline } from '../helpers/resilience';
import { HomePage } from '../pages/HomePage';
import { PictionaryConfigPage } from '../pages/PictionaryConfigPage';
import { PictionaryRoomPage } from '../pages/PictionaryRoomPage';

const PLAYER_COUNT = 4;
const RELAY_STEP_COUNT = getPictionaryRelayStepCount(PLAYER_COUNT);
const TOTAL_GALLERY_ENTRIES = PLAYER_COUNT * RELAY_STEP_COUNT;
const OPENING_PROMPTS = ['月球上的猫', '云端城堡', '跳舞的花', '海上火车'] as const;
const GUESS_SUBMISSIONS = [[' 太阳 还没写完 ', '小屋', '花朵', '帆船']] as const;

/**
 * Phase-expiry discipline (D3, 2026-11-05): the server's scheduled settle
 * is the only expiry path — no client sends expire, ever. The public
 * `phase.expire` command is deleted; the countdown is display-only.
 *
 * The tests below prove that discipline from observed /room/command
 * traffic, never from UI text: every page gets a passive route handler
 * that logs expire sends and always calls route.continue(), so delivery
 * is never altered or swallowed. The observer still watches for the
 * deleted command type, so any send — by any client, at any time —
 * fails the zero assertions below. Only host/seated contexts are driven
 * here, per the 2026-11-04 ruling on E2E scope; the remaining
 * eligibility cases stay covered at hook/contract level, not in E2E.
 *
 * Honest boundary of this file:
 * - Zero-client settlement is NOT claimed here: E2E always has foreground
 *   clients. The offline test proves advancement without any acceleration
 *   command being sent; zero-client settlement is proven at Worker
 *   DO-test level.
 */
const EXPIRE_COMMAND_TYPE = 'pictionary.phase.expire';

interface ObservedExpire {
  readonly phaseRevision: number;
  readonly atMs: number;
}

interface ExpireObservation {
  readonly expires: () => readonly ObservedExpire[];
  readonly stop: () => Promise<void>;
}

/** The phaseRevision carried by an expire command body, or null when the body is not one. */
function expirePhaseRevision(body: unknown): number | null {
  if (typeof body !== 'object' || body === null || !('command' in body)) return null;
  const command: unknown = body.command;
  if (typeof command !== 'object' || command === null || !('type' in command)) return null;
  if (command.type !== EXPIRE_COMMAND_TYPE) return null;
  if (!('phaseRevision' in command)) return null;
  const revision: unknown = command.phaseRevision;
  return typeof revision === 'number' ? revision : null;
}

/**
 * Log every pictionary.phase.expire send on one page, timestamped, without
 * touching delivery: the handler always continues the request, matching
 * the room-narration precedent.
 */
async function observeExpireCommands(page: Page): Promise<ExpireObservation> {
  const seen: ObservedExpire[] = [];
  await page.route('**/room/command', async (route, request) => {
    if (request.method() === 'POST') {
      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = null;
      }
      // -1 means an expire send whose body carried no readable
      // phaseRevision; it still counts as a send and stays visible
      // in the attached observation log.
      if (isExpireCommand(body)) {
        seen.push({ phaseRevision: expirePhaseRevision(body) ?? -1, atMs: Date.now() });
      }
    }
    await route.continue();
  });
  return {
    expires: () => seen,
    stop: () => page.unroute('**/room/command'),
  };
}

/** True when a /room/command POST body carries the expire command type. */
function isExpireCommand(body: unknown): boolean {
  if (typeof body !== 'object' || body === null || !('command' in body)) return false;
  const command: unknown = body.command;
  return (
    typeof command === 'object' &&
    command !== null &&
    'type' in command &&
    command.type === EXPIRE_COMMAND_TYPE
  );
}

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
      await fixture.pages[2]!.setViewportSize({ width: 320, height: 740 });
      await test.step('create a deterministic four-player room', async () => {
        await new HomePage(hostPage).clickCreateRoom('pictionary');
        const config = new PictionaryConfigPage(hostPage);
        await config.waitForCreateMode();
        await config.configureFourPlayerManualGame();
        await hostPage
          .getByTestId(TESTIDS.gameConfigFieldOption('pictionary', 'drawingDurationSeconds', '90'))
          .click();
        await config.createRoom();
        await hostRoom.waitForReady('host');

        await hostPage.getByTestId(TESTIDS.roomGuideButton('pictionary')).click();
        const guide = hostPage.getByTestId(TESTIDS.gameGuideScreenRoot('pictionary'));
        await expect(guide.getByTestId(TESTIDS.gameGuideHeading)).toHaveText(
          '画得像不像不重要，传得离谱才有趣',
        );
        await expect(guide).toContainText('接龙流程');
        await hostPage.screenshot({ path: test.info().outputPath('pictionary-guide.png') });
        await hostPage.getByTestId(TESTIDS.gameGuideBackButton).click();
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
        await expect(hostPage.getByTestId(TESTIDS.roomScreenRoot)).not.toContainText('结束本棒');
        await Promise.all(rooms.map((room) => room.expectPromptStep(1, RELAY_STEP_COUNT)));
        await expect(hostPage.getByTestId(TESTIDS.roomGuideButton('pictionary'))).toHaveCount(0);
        await hostRoom.expectPhoneSizedStage();
        await Promise.all(rooms.map((room) => room.expectTaskFitsViewport('prompt')));
        await hostRoom.reviseReadyPrompt('月球上的狗', OPENING_PROMPTS[0]);
        await promptForEveryPlayer(rooms.slice(1), OPENING_PROMPTS.slice(1));
        await Promise.all(rooms.map((room) => room.expectDrawingStep(2, RELAY_STEP_COUNT)));
      });

      await test.step('exercise all tools and upload every first drawing', async () => {
        await Promise.all(rooms.map((room) => room.expectTaskFitsViewport('drawing')));
        await hostRoom.exerciseDrawingTools(2, RELAY_STEP_COUNT);
        for (let playerIndex = 1; playerIndex < PLAYER_COUNT; playerIndex += 1) {
          await rooms[playerIndex]!.drawStroke(playerIndex);
        }
        for (const [playerIndex, viewport] of ['desktop', 'mobile', 'small'].entries()) {
          await rooms[playerIndex]!.exerciseColorPicker();
          await test.info().attach(`pictionary-drawing-${viewport}`, {
            body: await fixture.pages[playerIndex]!.screenshot(),
            contentType: 'image/png',
          });
          const playerPage = fixture.pages[playerIndex]!;
          await playerPage.getByTestId(TESTIDS.drawingToolbarColorButton).click();
          await test.info().attach(`pictionary-presets-${viewport}`, {
            body: await playerPage.screenshot(),
            contentType: 'image/png',
          });
          await playerPage.getByTestId(TESTIDS.drawingToolbarCustomColorButton).click();
          await test.info().attach(`pictionary-colors-${viewport}`, {
            body: await playerPage.screenshot(),
            contentType: 'image/png',
          });
          await playerPage.getByTestId(TESTIDS.drawingToolbarPanelCloseButton).click();
        }
        let hasAbortedUpload = false;
        let hasLostResponse = false;
        await fixture.pages[1]!.route(
          '**/submissions/**',
          async (route) => {
            hasAbortedUpload = true;
            await route.abort('failed');
          },
          { times: 1 },
        );
        await fixture.pages[2]!.route(
          '**/submissions/**',
          async (route) => {
            const response = await route.fetch();
            expect(response.status()).toBe(200);
            hasLostResponse = true;
            await route.abort('failed');
          },
          { times: 1 },
        );
        await Promise.all(rooms.map((room) => room.completeDrawingEditing()));
        await Promise.all(rooms.map((room) => room.expectGuessStep(3, RELAY_STEP_COUNT)));
        expect(hasAbortedUpload).toBe(true);
        expect(hasLostResponse).toBe(true);
      });

      for (const [guessIndex, guesses] of GUESS_SUBMISSIONS.entries()) {
        const guessStep = guessIndex * 2 + 3;
        const drawingStep = guessStep + 1;
        await test.step(`complete guess and drawing stages ${guessStep}-${drawingStep}`, async () => {
          await Promise.all(rooms.map((room) => room.expectGuessStep(guessStep, RELAY_STEP_COUNT)));
          await Promise.all(rooms.map((room) => room.expectTaskFitsViewport('guess')));
          await fixture.pages[1]!.setViewportSize({ width: 390, height: 480 });
          await fixture.pages[1]!.getByTestId(TESTIDS.pictionaryTextInput).focus();
          await rooms[1]!.expectTaskFitsViewport('guess');
          await test.info().attach('pictionary-guess-reduced-viewport', {
            body: await fixture.pages[1]!.screenshot(),
            contentType: 'image/png',
          });
          await fixture.pages[1]!.setViewportSize({ width: 390, height: 844 });
          if (guessIndex === 0) await rooms[1]!.expectFullscreenDrawingPreview();
          await hostPage.getByTestId(TESTIDS.pictionaryTextInput).fill(guesses[0]);
          await guessForEveryPlayer(rooms.slice(1, 3), guesses.slice(1, 3));
          const offlinePage = fixture.pages[3]!;
          await offlinePage.getByTestId(TESTIDS.pictionaryTextInput).fill(guesses[3]);
          await offlinePage.context().setOffline(true);
          const countdown = hostPage.getByTestId(TESTIDS.roomStageTimer);
          await expect(countdown).toHaveText('0:05', { timeout: 50_000 });
          await expect(countdown).toHaveText('0:04');
          await expect(hostPage.getByTestId(TESTIDS.pictionaryTaskTitle)).toHaveText(
            '正在收取最终内容',
            { timeout: 60_000 },
          );
          await expect(hostPage.getByTestId(TESTIDS.pictionaryTaskDescription)).toHaveText(
            '你的内容已处理，正在等待其他玩家。',
          );
          await expect(hostPage.getByTestId(TESTIDS.pictionaryGalleryAlbum)).toHaveCount(0);
          await offlinePage.context().setOffline(false);
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
          let failedUploads = 0;
          await unfinishedPage.route('**/submissions/**', async (route) => {
            failedUploads += 1;
            await route.abort('failed');
          });
          await expect(unfinishedPage.getByTestId(TESTIDS.pictionaryTaskDescription)).toHaveText(
            '发送暂未成功，正在自动重试。',
            { timeout: 120_000 },
          );
          expect(failedUploads).toBeGreaterThanOrEqual(FETCH_RETRY_COUNT + 1);
          await expect(hostPage.getByTestId(TESTIDS.pictionaryTaskTitle)).toHaveText(
            '正在收取最终内容',
          );
          await expect(hostPage.getByTestId(TESTIDS.pictionaryGalleryAlbum)).toHaveCount(0);
          await unfinishedPage.mouse.up();
          await unfinishedPage.unroute('**/submissions/**');
        });
      }

      await Promise.all(rooms.map((room) => room.expectGallery()));

      await test.step('keep every player on the authoritative gallery cursor', async () => {
        await expectGalleryPositionForEveryPlayer(rooms, 1, 1);
        const collectedGuesses: string[] = [];
        const playbackToggle = hostPage.getByTestId(TESTIDS.galleryTogglePlayButton);

        for (
          let globalEntryIndex = 1;
          globalEntryIndex < TOTAL_GALLERY_ENTRIES;
          globalEntryIndex += 1
        ) {
          const chain = Math.floor(globalEntryIndex / RELAY_STEP_COUNT) + 1;
          const entry = (globalEntryIndex % RELAY_STEP_COUNT) + 1;
          if (entry === 1) await hostRoom.advanceGallery();
          if (entry < RELAY_STEP_COUNT) {
            await expect(hostPage.getByTestId(TESTIDS.pictionaryGalleryEntry)).toHaveCount(entry, {
              timeout: 10_000,
            });
            await expect(playbackToggle).toHaveText('暂停', { timeout: 5_000 });
            await playbackToggle.click();
          }
          await expectGalleryPositionForEveryPlayer(rooms, chain, entry);
          if (entry === RELAY_STEP_COUNT) {
            await expect(
              hostPage.getByTestId(TESTIDS.pictionaryGalleryAdvanceButton),
            ).toHaveAccessibleName(chain === PLAYER_COUNT ? '结束揭晓' : '下一本');
            await expect(
              fixture.pages[1]!.getByTestId(TESTIDS.pictionaryGalleryViewerNotice),
            ).toHaveText('本册已揭晓，等待房主继续');
            if (chain === 1) {
              const started = Date.now();
              await expect
                .poll(
                  async () => {
                    await expectGalleryPositionForEveryPlayer(rooms, chain, entry);
                    return Date.now() - started;
                  },
                  { timeout: 9_000 },
                )
                .toBeGreaterThan(6_000);
            }
          }
          if (entry === 3) collectedGuesses.push(await hostRoom.readLatestGalleryEntryText());
          if (entry % 2 === 0) {
            const image = hostPage
              .getByTestId(TESTIDS.pictionaryGalleryEntry)
              .last()
              .getByTestId(TESTIDS.pictionaryDrawingImage);
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
            const rewindButton = hostPage.getByTestId(TESTIDS.galleryRewindButton);
            await expect(rewindButton).toHaveAccessibleName('上一项');
            await rewindButton.click();
            await expectGalleryPositionForEveryPlayer(rooms, 1, 3);
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
          if (entry < RELAY_STEP_COUNT) {
            await expect(playbackToggle).toHaveText('播放');
            await playbackToggle.click();
          }
        }

        await hostRoom.advanceGallery();
        await Promise.all(rooms.map((room) => room.expectEnded()));
        expect(collectedGuesses.some((text) => text.includes(GUESS_SUBMISSIONS[0][0]))).toBe(true);
      });
      await test.step('export albums with rendered drawings on desktop and mobile', async () => {
        const roomCode = await hostRoom.getRoomCode();
        for (const [albumIndex, page] of fixture.pages.slice(0, 2).entries()) {
          // Each player browses to an album; its 「分享本篇画册」 opens the shared review at that album's page.
          const nextAlbumButton = page.getByTestId(
            TESTIDS.galleryPagerNextButton(TESTIDS.pictionaryStageFrame),
          );
          for (let skipped = 0; skipped < albumIndex; skipped += 1) {
            await nextAlbumButton.click();
          }
          await expect(page.getByTestId(TESTIDS.galleryAlbumEyebrow)).toHaveText(
            `第 ${albumIndex + 1} / ${PLAYER_COUNT} 本画册`,
          );
          const shareButton = page.getByTestId(TESTIDS.pictionaryGalleryShareButton);
          await expect(shareButton).toHaveText('分享本篇画册');
          await shareButton.click();
          const review = page.getByTestId(TESTIDS.roomReviewDialog);
          await expect(review).toContainText(`第 ${albumIndex + 1} 篇 · `);
          await expect(review).toContainText('第 4 棒');
          const drawings = review.getByTestId(TESTIDS.roomReviewImage);
          await expect(drawings).toHaveCount(2);
          await expect
            .poll(() =>
              drawings.evaluateAll((images) =>
                images.every(
                  (image) =>
                    image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
                ),
              ),
            )
            .toBe(true);
          // 「仅分享本页」 appears once the background capture of the pages is ready.
          const png = await downloadReviewImage(
            page.getByTestId(TESTIDS.roomReviewSharePageButton),
            `pictionary-${roomCode}-1-p${albumIndex + 1}.png`,
          );
          const { width, height } = readPngSize(png);
          expect(height).toBeGreaterThan(width);
          await closeReviewDialog(page);
        }
      });
      await test.step('upload every album PNG for WeChat despite an unrelated pending image', async () => {
        await expectWeChatImageShare(
          hostPage,
          { testId: TESTIDS.pictionaryGalleryShareButton, label: '分享本篇画册' },
          PLAYER_COUNT,
        );
      });
    } finally {
      await closeAll(fixture);
    }
  });

  test('empty inputs are collected automatically and abort preserves only submitted works', async ({
    browser,
  }) => {
    const fixture = await createPlayerContexts(browser, 2);
    const hostPage = fixture.pages[0];
    const guestPage = fixture.pages[1]!;
    const hostRoom = new PictionaryRoomPage(hostPage);
    const guestRoom = new PictionaryRoomPage(guestPage);
    try {
      await guestPage.setViewportSize({ width: 390, height: 844 });
      await new HomePage(hostPage).clickCreateRoom('pictionary');
      const config = new PictionaryConfigPage(hostPage);
      await config.waitForCreateMode();
      await config.configureFourPlayerManualGame();
      await config.createRoom();
      await hostRoom.waitForReady('host');
      await hostRoom.seatAt(0);
      await guestRoom.joinViaCode(await hostRoom.getRoomCode());
      await guestRoom.seatAt(1);
      await hostRoom.clickHostManagementActionAndConfirm(
        TESTIDS.roomFillBotsButton,
        '填充机器人？',
      );
      await hostRoom.startRound();
      await hostPage.getByTestId(TESTIDS.pictionaryTextInput).fill('保留的原始题目');
      // Step 2 never hands a seat its own chain, and every other prompt was empty.
      await expect(hostPage.getByTestId(TESTIDS.pictionaryDrawingPrompt)).toContainText(
        '上一棒未完成',
        { timeout: 60_000 },
      );
      await Promise.all([
        hostRoom.expectDrawingStep(2, RELAY_STEP_COUNT),
        guestRoom.expectDrawingStep(2, RELAY_STEP_COUNT),
      ]);
      await hostRoom.drawStroke(1);
      await hostRoom.clickHostManagementActionAndConfirm(TESTIDS.abortGameButton, '中止本局？');
      for (const page of fixture.pages) {
        await expect(page.getByTestId(TESTIDS.galleryAlbumDescription)).toHaveText(
          '第 1 轮未完成，房主已中止。',
        );
        await expect(page.getByTestId(TESTIDS.nextRoundButton)).toHaveCount(0);
        await expect(page.getByTestId(`${TESTIDS.roomHostTaskCard}-next-round`)).toHaveCount(0);
      }
      await expect(hostPage.getByTestId(TESTIDS.roomScreenRoot)).not.toContainText(/草稿|跳过/);
      await expect(hostPage.getByTestId(TESTIDS.pictionaryDrawingCanvas)).toHaveCount(0);
      // The aborted round keeps what was handed in: its review opens for every player, marked unfinished.
      await guestPage.getByTestId(TESTIDS.roomReviewOpenButton).click();
      const review = guestPage.getByTestId(TESTIDS.roomReviewDialog);
      await expect(review).toContainText('🖼️ 第 1 轮 · 画册');
      await expect(review).toContainText('未完成');
      await closeReviewDialog(guestPage);
      await expect(review).toHaveCount(0);
      const albums: string[] = [];
      const nextAlbumButton = hostPage.getByTestId(
        TESTIDS.galleryPagerNextButton(TESTIDS.pictionaryStageFrame),
      );
      for (let index = 0; index < PLAYER_COUNT; index += 1) {
        albums.push(await hostRoom.readLatestGalleryEntryText());
        if (index < PLAYER_COUNT - 1) await nextAlbumButton.click();
      }
      expect(albums.some((text) => text.includes('保留的原始题目'))).toBe(true);
      expect(albums.filter((text) => text.includes('这一棒交了空白'))).toHaveLength(3);
    } finally {
      await closeAll(fixture);
    }
  });

  test('no client sends expire across a deadline', async ({ browser }, testInfo) => {
    const fixture = await createPlayerContexts(browser, PLAYER_COUNT);
    const rooms = fixture.pages.map((page) => new PictionaryRoomPage(page));
    const hostPage = fixture.pages[0];
    const hostRoom = rooms[0]!;
    const observations: ExpireObservation[] = [];
    try {
      for (const page of fixture.pages) observations.push(await observeExpireCommands(page));

      await test.step('create a four-player room with a 15-second text deadline', async () => {
        await new HomePage(hostPage).clickCreateRoom('pictionary');
        const config = new PictionaryConfigPage(hostPage);
        await config.waitForCreateMode();
        await config.configureFourPlayerManualGame();
        const guess15 = hostPage.getByTestId(
          TESTIDS.gameConfigFieldOption('pictionary', 'guessDurationSeconds', '15'),
        );
        await guess15.click();
        await expect(guess15).toHaveAttribute('aria-checked', 'true');
        await config.createRoom();
        await hostRoom.waitForReady('host');

        const roomCode = await hostRoom.getRoomCode();
        await hostRoom.seatAt(0);
        for (let playerIndex = 1; playerIndex < PLAYER_COUNT; playerIndex += 1) {
          await rooms[playerIndex]!.joinViaCode(roomCode);
          await rooms[playerIndex]!.seatAt(playerIndex);
        }
      });

      await test.step('cross the prompt deadline with every client idle', async () => {
        await hostRoom.startRound();
        await Promise.all(rooms.map((room) => room.expectPromptStep(1, RELAY_STEP_COUNT)));
        // Nobody submits anything: the 15-second text deadline must pass
        // with zero input, so the crossing is decided by the deadline
        // alone and every client observes the whole crossing.
        await Promise.all(rooms.map((room) => room.expectDrawingStep(2, RELAY_STEP_COUNT)));
      });

      await test.step('assert no expire was sent by any client', async () => {
        const byPage = observations.map((observation) => observation.expires());
        await testInfo.attach('pictionary-expire-observation', {
          body: JSON.stringify({ byPage }),
          contentType: 'application/json',
        });
        for (const expires of byPage) {
          expect(expires).toHaveLength(0);
        }
      });
    } finally {
      await Promise.allSettled(observations.map((observation) => observation.stop()));
      await closeAll(fixture);
    }
  });

  test('phase advances past the deadline with zero expire commands while every client is offline', async ({
    browser,
  }, testInfo) => {
    const fixture = await createPlayerContexts(browser, PLAYER_COUNT);
    const rooms = fixture.pages.map((page) => new PictionaryRoomPage(page));
    const hostPage = fixture.pages[0];
    const hostRoom = rooms[0]!;
    const observations: ExpireObservation[] = [];
    try {
      for (const page of fixture.pages) observations.push(await observeExpireCommands(page));

      await test.step('create a four-player room with a 15-second text deadline', async () => {
        await new HomePage(hostPage).clickCreateRoom('pictionary');
        const config = new PictionaryConfigPage(hostPage);
        await config.waitForCreateMode();
        await config.configureFourPlayerManualGame();
        const guess15 = hostPage.getByTestId(
          TESTIDS.gameConfigFieldOption('pictionary', 'guessDurationSeconds', '15'),
        );
        await guess15.click();
        await expect(guess15).toHaveAttribute('aria-checked', 'true');
        await config.createRoom();
        await hostRoom.waitForReady('host');

        const roomCode = await hostRoom.getRoomCode();
        await hostRoom.seatAt(0);
        for (let playerIndex = 1; playerIndex < PLAYER_COUNT; playerIndex += 1) {
          await rooms[playerIndex]!.joinViaCode(roomCode);
          await rooms[playerIndex]!.seatAt(playerIndex);
        }
      });

      await test.step('start the round, then hold every client offline across the deadline', async () => {
        await hostRoom.startRound();
        await Promise.all(rooms.map((room) => room.expectPromptStep(1, RELAY_STEP_COUNT)));
        // Offline, the link is not live, so no client's expiry gate can
        // fire; the 15-second deadline still passes on the server clock.
        // The hold is measured from the prompt step being visible, which
        // trails the server's round-start decision by a second or two,
        // so 22 seconds clears the deadline plus settle latency.
        const startedAt = Date.now();
        for (const context of fixture.contexts) await setOffline(context, true);
        await expect
          .poll(async () => Date.now() - startedAt, { timeout: 30_000, intervals: [300] })
          .toBeGreaterThan(22_000);
      });

      await test.step('reconnect and observe the server-driven advance with no acceleration', async () => {
        for (const context of fixture.contexts) await setOffline(context, false);
        // The deadline crossing itself (answering -> settling) happened
        // server-side while every client was offline. Under D3 no expire
        // can ever be sent, so the zero claim is NOT scoped to the
        // advance: the full observed list must be empty. Collection
        // after reconnect is expected — clients submit their (empty)
        // inputs — and is not acceleration.
        const advanced = expect.poll(
          async () => {
            const settlingTitles = await hostPage
              .getByTestId(TESTIDS.pictionaryTaskTitle)
              .allTextContents();
            const settling = settlingTitles.includes('正在收取最终内容');
            const drawing = await hostPage.getByTestId(TESTIDS.pictionaryDrawingCanvas).count();
            return settling || drawing > 0;
          },
          { timeout: 30_000, intervals: [300] },
        );
        await advanced.toBe(true);
        const byPage = observations.map((observation) => observation.expires());
        await testInfo.attach('pictionary-offline-expire-observation', {
          body: JSON.stringify({ byPage }),
          contentType: 'application/json',
        });
        for (const expires of byPage) {
          expect(expires).toHaveLength(0);
        }
      });
    } finally {
      await Promise.allSettled(fixture.contexts.map((context) => setOffline(context, false)));
      await Promise.allSettled(observations.map((observation) => observation.stop()));
      await closeAll(fixture);
    }
  });
});
