/** Browser acceptance for plain-text Story Relay, using only production room and writing controls. */

import { expect, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createColdRoomContext, createPlayerContexts } from '../fixtures/app.fixture';
import { confirmAlert } from '../helpers/alerts';
import { observeCommandFrames } from '../helpers/command-frames';
import {
  closeReviewDialog,
  downloadReviewImage,
  expectWeChatImageShare,
  readPngSize,
  REVIEW_CAPTURE_TIMEOUT_MS,
} from '../helpers/image-sharing';
import { setOffline } from '../helpers/resilience';
import { linkStatusBanner, waitForLinkLive, waitForRoomScreenReady } from '../helpers/waits';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

test.setTimeout(180_000);
test.use({ actionTimeout: 15_000 });

/** The editor stays usable only if it keeps at least this share of the
 *  viewport height (measured healthy minimum is ~14%, across phases) —
 *  a relative floor, so it holds at any viewport size. */
const MIN_EDITOR_VIEWPORT_FRACTION = 0.1;

/**
 * Phase-expiry discipline (D3, 2026-11-05): the server's scheduled settle
 * is the only expiry path — no client sends expire, ever. The public
 * `phase.expire` command is deleted; the countdown is display-only.
 *
 * The tests below prove that discipline from observed COMMAND frames,
 * never from UI text: every page gets a passive frame observer that logs
 * expire sends without touching delivery. The observer still watches for
 * the deleted command type, so any send — by any client, at any time —
 * fails the zero assertions below. Only host/seated contexts are driven
 * here, per the 2026-11-04 ruling on E2E scope; the remaining
 * eligibility cases stay covered at hook/contract level, not in E2E.
 *
 * Story Relay identity note: the server settle pin is
 * roundId + phaseRevision + stepIndex + deadlineAt. A deadline
 * crossing here can span two identities — the writing phase and the
 * zero-second transition that follows it — and the zero-expire
 * assertion covers both: no send is legitimate for either identity.
 *
 * Honest boundary of this file:
 * - Zero-client settlement is NOT claimed here: E2E always has foreground
 *   clients. The offline test proves advancement without any acceleration
 *   command being sent; zero-client settlement is proven at Worker
 *   DO-test level.
 */
const EXPIRE_COMMAND_TYPE = 'storyrelay.phase.expire';

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
 * Log every storyrelay.phase.expire send on one page, timestamped, without
 * touching delivery: the shared frame observer only records.
 */
async function observeExpireCommands(page: Page): Promise<ExpireObservation> {
  const observation = observeCommandFrames(page);
  return {
    expires: () =>
      observation.commands().flatMap((frame) => {
        const body = { command: frame.command };
        // -1 means an expire send whose command carried no readable
        // phaseRevision; it still counts as a send and stays visible
        // in the attached observation log.
        if (!isExpireCommand(body)) return [];
        return [{ phaseRevision: expirePhaseRevision(body) ?? -1, atMs: frame.atMs }];
      }),
    stop: () => observation.stop(),
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

async function createRoom(page: Page, writingDurationSeconds = 'unlimited'): Promise<RoomPage> {
  await new HomePage(page).clickCreateRoom('storyrelay');
  await expect(page.getByTestId(TESTIDS.gameConfigScreenRoot('storyrelay'))).toBeVisible();
  const decrementPlayers = page.getByTestId(
    TESTIDS.gameConfigFieldDecrement('storyrelay', 'numberOfPlayers'),
  );
  await expect(decrementPlayers).toHaveAccessibleName('减少人数');
  await decrementPlayers.click();
  await decrementPlayers.click();
  await page
    .getByTestId(
      TESTIDS.gameConfigFieldOption('storyrelay', 'writingDurationSeconds', writingDurationSeconds),
    )
    .click();
  await page
    .getByTestId(TESTIDS.gameConfigFieldOption('storyrelay', 'transitionDurationSeconds', '0'))
    .click();
  await page.getByTestId(TESTIDS.gameConfigSubmit('storyrelay')).click();
  const room = new RoomPage(page);
  await room.waitForReady();
  return room;
}

async function joinRoom(page: Page, roomCode: string, seat: number): Promise<void> {
  const room = new RoomPage(page);
  await room.joinViaCode(roomCode);
  await room.seatAt(seat);
}

async function expectFixedTask(page: Page): Promise<void> {
  await expect(page.getByTestId(TESTIDS.storyRelayEditor)).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId(TESTIDS.storyRelayReady)).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      page
        .getByTestId(TESTIDS.storyRelayTask)
        .evaluate((element) => element.scrollHeight - element.clientHeight),
    )
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() =>
      page
        .getByTestId(TESTIDS.storyRelayEditor)
        .evaluate((element) => element.clientHeight / window.innerHeight),
    )
    .toBeGreaterThan(MIN_EDITOR_VIEWPORT_FRACTION);
  await expect
    .poll(() =>
      page
        .getByTestId(TESTIDS.storyRelayReady)
        .evaluate(
          (element) =>
            element.getBoundingClientRect().bottom -
            (window.visualViewport?.height ?? window.innerHeight),
        ),
    )
    .toBeLessThanOrEqual(1);
}

/**
 * Opens one story's page of the shared review from the gallery's 「分享本篇故事」 and exports
 * only that page: one PNG named after the story's page, its passages reaching the bottom.
 */
async function expectStoryImageExport(page: Page, roomCode: string, storyIndex: number) {
  const nextStory = page.getByTestId(TESTIDS.galleryPagerNextButton(TESTIDS.storyRelayGallery));
  for (let skipped = 0; skipped < storyIndex; skipped += 1) {
    await expect(nextStory).toHaveAccessibleName('下一篇故事');
    await nextStory.click();
  }
  await expect(
    page.getByTestId(TESTIDS.galleryPagerPosition(TESTIDS.storyRelayGallery)),
  ).toHaveText(`${storyIndex + 1} / 4`);
  const shareStory = page.getByTestId(TESTIDS.storyRelayGalleryShareButton);
  await expect(shareStory).toHaveText('分享本篇故事');
  await shareStory.click();
  const review = page.getByTestId(TESTIDS.roomReviewDialog);
  await expect(review).toContainText(`第 ${storyIndex + 1} 篇故事`);
  await expect(review).toContainText('第 4 棒 · ');
  await expect(review).toContainText('第4棒的故事');
  // 「仅分享本页」 appears once the background capture of the pages is ready.
  const sharePage = page.getByTestId(TESTIDS.roomReviewSharePageButton);
  await expect(sharePage).toHaveText('仅分享本页', { timeout: REVIEW_CAPTURE_TIMEOUT_MS });
  const png = await downloadReviewImage(
    sharePage,
    `storyrelay-${roomCode}-1-p${storyIndex + 1}.png`,
  );
  const { width, height } = readPngSize(png);
  expect(height).toBeGreaterThan(width);
  const hasTextAtBottom = await page.evaluate(
    async (dataUrl) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('Image pixel check unavailable');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(
        0,
        Math.floor(image.height * 0.75),
        image.width,
        Math.floor(image.height * 0.25),
      ).data;
      const background = pixels.slice(0, 3);
      return pixels.some(
        (value, offset) => offset % 4 < 3 && Math.abs(value - background[offset % 4]!) > 50,
      );
    },
    `data:image/png;base64,${png.toString('base64')}`,
  );
  expect(hasTextAtBottom).toBe(true);
  await closeReviewDialog(page);
}

test('four humans write four turns without restoring unsubmitted input and reveal synchronized stories', async ({
  browser,
}) => {
  const fixture = await createPlayerContexts(browser, 4);
  const hostPage = fixture.pages[0];
  try {
    const room = await createRoom(hostPage);
    const code = await room.getRoomCode();
    await room.seatAt(0);
    for (let seat = 1; seat < 4; seat += 1) await joinRoom(fixture.pages[seat]!, code, seat);
    const spectator = await createColdRoomContext(browser, code);
    try {
      await fixture.pages[1]!.setViewportSize({ width: 390, height: 844 });
      await fixture.pages[2]!.setViewportSize({ width: 320, height: 640 });
      await room.clickHostManagementActionAndConfirm(TESTIDS.startGameButton, '开始游戏？');
      for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
        await test.step(`write and collect turn ${stepIndex + 1}`, async () => {
          for (const page of fixture.pages) {
            await expect(page.getByTestId(TESTIDS.storyRelayEditor)).toBeEditable();
            await expect(page.getByTestId(TESTIDS.storyRelayEditor)).toHaveValue('');
            if (stepIndex === 0)
              await expect(page.getByTestId(TESTIDS.storyRelayPreviousEntry)).toHaveCount(0);
            else
              await expect(page.getByTestId(TESTIDS.storyRelayPreviousEntry)).toContainText(
                `第${stepIndex}棒的故事`,
              );
          }
          await expect(spectator.page.getByTestId(TESTIDS.storyRelayEditor)).toHaveCount(0);
          await expect(spectator.page.getByTestId(TESTIDS.storyRelayPreviousEntry)).toHaveCount(0);
          for (const [seat, page] of fixture.pages.entries())
            await page
              .getByTestId(TESTIDS.storyRelayEditor)
              .fill(` 第${stepIndex + 1}棒的故事，作者${seat}\n原始换行 ${'长正文'.repeat(100)}`);
          await Promise.all(fixture.pages.map(expectFixedTask));
          if (stepIndex === 0) {
            await hostPage.getByTestId(TESTIDS.storyRelayReady).click();
            await expect(hostPage.getByTestId(TESTIDS.storyRelayEditor)).not.toBeEditable();
            await hostPage.getByTestId(TESTIDS.storyRelayReady).click();
            for (const [index, viewport] of ['desktop', 'mobile', 'small'].entries())
              await test.info().attach(`storyrelay-writing-${viewport}`, {
                body: await fixture.pages[index]!.screenshot(),
                contentType: 'image/png',
              });
          }
          if (stepIndex === 1) {
            const mobilePage = fixture.pages[1]!;
            await mobilePage.getByTestId(TESTIDS.storyRelayEditor).focus();
            await mobilePage.evaluate(() => {
              const viewport = window.visualViewport;
              if (viewport === null) throw new Error('Visual viewport missing');
              Object.defineProperty(viewport, 'height', { configurable: true, value: 480 });
              viewport.dispatchEvent(new Event('resize'));
            });
            await expectFixedTask(mobilePage);
            await mobilePage.screenshot({
              path: test.info().outputPath('storyrelay-keyboard.png'),
            });
            await mobilePage.evaluate(() => {
              const viewport = window.visualViewport;
              if (viewport === null) throw new Error('Visual viewport missing');
              Reflect.deleteProperty(viewport, 'height');
              viewport.dispatchEvent(new Event('resize'));
            });
            await fixture.pages[1]!.reload();
            await waitForRoomScreenReady(fixture.pages[1]!, { role: 'joiner' });
            await expect(fixture.pages[1]!.getByTestId(TESTIDS.storyRelayEditor)).toHaveValue('');
            await fixture.pages[1]!.getByTestId(TESTIDS.storyRelayEditor).fill(
              ` 第2棒的故事，作者1\n原始换行 `,
            );
          }
          await Promise.all(
            fixture.pages.map((page) => page.getByTestId(TESTIDS.storyRelayReady).click()),
          );
          if (stepIndex < 3)
            await expect(hostPage.getByTestId(TESTIDS.storyRelayPreviousEntry)).toContainText(
              `第${stepIndex + 1}棒的故事`,
              { timeout: 20_000 },
            );
        });
      }
      for (const page of [...fixture.pages, spectator.page]) {
        await expect(page.getByTestId(TESTIDS.storyRelayGallery)).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId(TESTIDS.storyRelayEntry(0))).toBeVisible();
        await expect(page.getByTestId(TESTIDS.storyRelayEntry(1))).toHaveCount(0);
      }
      // PR-B G-2: while the host drives playback, everyone else is
      // told so in place of the host-only controls (same form as
      // Pictionary's spectator notice).
      for (const viewerPage of [fixture.pages[1]!, spectator.page]) {
        await expect(viewerPage.getByTestId(TESTIDS.galleryAlbumDescription)).toHaveText(
          '由房主控制播放进度。',
        );
      }
      const advance = hostPage.getByTestId(TESTIDS.galleryAdvanceButton);
      await expect(advance).toHaveAccessibleName('下一项');
      await advance.click();
      await expect(spectator.page.getByTestId(TESTIDS.storyRelayEntry(1))).toBeVisible();
      const rewind = hostPage.getByTestId(TESTIDS.galleryRewindButton);
      await expect(rewind).toHaveAccessibleName('上一项');
      await rewind.click();
      await expect(hostPage.getByTestId(TESTIDS.storyRelayEntry(1))).toBeVisible();
      const finish = hostPage.getByTestId(TESTIDS.galleryFinishButton);
      await expect(finish).toHaveText('全部揭晓');
      await finish.click();
      await confirmAlert(hostPage, '全部揭晓');
      await expect(spectator.page.getByTestId(TESTIDS.storyRelayGalleryShareButton)).toHaveText(
        '分享本篇故事',
      );
      await expect(hostPage.getByTestId(TESTIDS.storyRelayEntry(3))).toBeVisible();
      // The ended gallery offers sharing only: no button is named for copying.
      const galleryButtonNames = await hostPage
        .getByTestId(TESTIDS.storyRelayGallery)
        .evaluate((gallery) =>
          [...gallery.querySelectorAll('button')].map(
            (button) => button.getAttribute('aria-label') ?? button.textContent ?? '',
          ),
        );
      expect(galleryButtonNames.filter((name) => name.includes('复制'))).toEqual([]);
      await expectStoryImageExport(hostPage, code, 0);
      await expectStoryImageExport(fixture.pages[1]!, code, 1);
      await test.step('upload every story PNG for WeChat despite an unrelated pending image', async () => {
        await expectWeChatImageShare(
          hostPage,
          { testId: TESTIDS.storyRelayGalleryShareButton, label: '分享本篇故事' },
          4,
        );
      });
      await room.clickHostManagementActionAndConfirm(TESTIDS.nextRoundButton, '再来一局');
      await expect(hostPage.getByTestId(TESTIDS.storyRelayEditor)).toHaveValue('');
      await expect(hostPage.getByTestId(TESTIDS.storyRelayPreviousEntry)).toHaveCount(0);
    } finally {
      await spectator.context.close();
    }
  } finally {
    await closeAll(fixture);
  }
});

test('no client sends expire across a deadline', async ({ browser }, testInfo) => {
  const fixture = await createPlayerContexts(browser, 4);
  const hostPage = fixture.pages[0];
  const observations: ExpireObservation[] = [];
  try {
    for (const page of fixture.pages) observations.push(await observeExpireCommands(page));

    await test.step('create a four-player room with a 45-second writing deadline', async () => {
      const room = await createRoom(hostPage, '45');
      const code = await room.getRoomCode();
      await room.seatAt(0);
      for (let seat = 1; seat < 4; seat += 1) await joinRoom(fixture.pages[seat]!, code, seat);
      await room.clickHostManagementActionAndConfirm(TESTIDS.startGameButton, '开始游戏？');
    });

    await test.step('cross the writing deadline with every client idle', async () => {
      for (const page of fixture.pages)
        await expect(page.getByTestId(TESTIDS.storyRelayEditor)).toBeEditable();
      // Nobody writes anything: the 45-second writing deadline must pass
      // with zero input, so the crossing is decided by the deadline
      // alone and every client observes the whole crossing. The advance
      // is visible when the previous entry appears: with empty
      // submissions it reads '上一段留白'.
      await expect(hostPage.getByTestId(TESTIDS.storyRelayPreviousEntry)).toContainText(
        '上一段留白',
        {
          timeout: 120_000,
        },
      );
    });

    await test.step('assert no expire was sent by any client', async () => {
      const byPage = observations.map((observation) => observation.expires());
      await testInfo.attach('storyrelay-expire-observation', {
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
  const fixture = await createPlayerContexts(browser, 4);
  const hostPage = fixture.pages[0];
  const observations: ExpireObservation[] = [];
  try {
    for (const page of fixture.pages) observations.push(await observeExpireCommands(page));

    await test.step('create a four-player room with a 45-second writing deadline', async () => {
      const room = await createRoom(hostPage, '45');
      const code = await room.getRoomCode();
      await room.seatAt(0);
      for (let seat = 1; seat < 4; seat += 1) await joinRoom(fixture.pages[seat]!, code, seat);
      await room.clickHostManagementActionAndConfirm(TESTIDS.startGameButton, '开始游戏？');
    });

    await test.step('start the round, then hold every client offline across the deadline', async () => {
      for (const page of fixture.pages)
        await expect(page.getByTestId(TESTIDS.storyRelayEditor)).toBeEditable();
      // Offline, the link is not live, so no client's expiry gate can
      // fire; the 45-second deadline still passes on the server clock.
      // The hold is measured from the editor being editable, which
      // trails the server's round-start decision by a second or two,
      // so 52 seconds clears the deadline plus settle latency.
      const startedAt = Date.now();
      for (const context of fixture.contexts) await setOffline(context, true);
      await Promise.all(
        fixture.pages.map((page) => linkStatusBanner(page).waitFor({ state: 'visible' })),
      );
      await expect
        .poll(async () => Date.now() - startedAt, { timeout: 60_000, intervals: [300] })
        .toBeGreaterThan(52_000);
    });

    await test.step('reconnect and observe the server-driven advance with no acceleration', async () => {
      for (const context of fixture.contexts) await setOffline(context, false);
      const reconnectedMs = Date.now();
      // The writing-deadline crossing itself (answering -> settling)
      // happened server-side while every client was offline. Under D3
      // no expire can ever be sent, so the zero claim is NOT scoped to
      // the reconnect moment: the full observed list must be empty.
      // Collection after reconnect is expected — clients submit their
      // (empty) inputs — and is not acceleration.
      await Promise.all(fixture.pages.map((page) => waitForLinkLive(page, 60_000)));
      await expect(hostPage.getByTestId(TESTIDS.storyRelayPreviousEntry)).toContainText(
        '上一段留白',
        {
          timeout: 60_000,
        },
      );
      const byPage = observations.map((observation) => observation.expires());
      await testInfo.attach('storyrelay-offline-expire-observation', {
        body: JSON.stringify({ reconnectedMs, byPage }),
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
