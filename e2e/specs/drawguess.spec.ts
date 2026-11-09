/** Browser acceptance for DrawGuess setup, guessing, host abort and return to the same lobby. */

import { expect, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { setOffline } from '../helpers/resilience';
import { waitForRoomScreenReady } from '../helpers/waits';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

test.setTimeout(180_000);
test.use({ actionTimeout: 15_000 });

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
 * DrawGuess identity note: the server settle pin is
 * gameSequence + phaseRevision + turnIndex + deadlineAt. Both tests
 * cross only the 15-second wordSelect deadline (drawing is 90 seconds,
 * roundEnd 8 seconds); the wordSelect-timeout auto-assign shares
 * beginDrawing with manual word choice, so the advance is visible as
 * the drawing canvas. Guess compression is deliberately out of scope
 * here: no guess is submitted during the wordSelect crossing, so no
 * submitGuess re-arm (which fires only when the deadlineAt changes)
 * can occur.
 *
 * Honest boundary of this file:
 * - Zero-client settlement is NOT claimed here: E2E always has foreground
 *   clients. The offline test proves advancement without any acceleration
 *   command being sent; zero-client settlement is proven at Worker
 *   DO-test level.
 */
const EXPIRE_COMMAND_TYPE = 'drawguess.phase.expire';

interface ObservedExpire {
  readonly phaseRevision: number;
  readonly turnIndex: number;
  readonly atMs: number;
}

interface ExpireObservation {
  readonly expires: () => readonly ObservedExpire[];
  readonly stop: () => Promise<void>;
}

/** The phaseRevision and turnIndex carried by an expire command body, or null when the body is not one. */
function expireIdentity(body: unknown): { phaseRevision: number; turnIndex: number } | null {
  if (typeof body !== 'object' || body === null || !('command' in body)) return null;
  const command: unknown = body.command;
  if (typeof command !== 'object' || command === null || !('type' in command)) return null;
  if (command.type !== EXPIRE_COMMAND_TYPE) return null;
  if (!('phaseRevision' in command) || !('turnIndex' in command)) return null;
  const phaseRevision: unknown = command.phaseRevision;
  const turnIndex: unknown = command.turnIndex;
  if (typeof phaseRevision !== 'number' || typeof turnIndex !== 'number') return null;
  return { phaseRevision, turnIndex };
}

/**
 * Log every drawguess.phase.expire send on one page, timestamped, without
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
      // A send whose body carries no readable identity still counts
      // as a send (phaseRevision/turnIndex -1) and stays visible in
      // the attached observation log.
      const identity = expireIdentity(body);
      if (identity !== null) {
        seen.push({ ...identity, atMs: Date.now() });
      } else if (isExpireCommand(body)) {
        seen.push({ phaseRevision: -1, turnIndex: -1, atMs: Date.now() });
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

async function createDrawGuessRoom(page: Page): Promise<RoomPage> {
  await new HomePage(page).clickCreateRoom('drawguess');
  await expect(page.getByTestId(TESTIDS.gameConfigScreenRoot('drawguess'))).toBeVisible();
  // Default 6 players; shrink to 4 for a compact room.
  await page.getByRole('button', { name: '减少人数' }).click();
  await page.getByRole('button', { name: '减少人数' }).click();
  await expect(page.getByTestId(TESTIDS.gameConfigScreenRoot('drawguess'))).toContainText(
    '共 8 轮',
  );
  await page.getByTestId(TESTIDS.gameConfigSubmit('drawguess')).click();
  const room = new RoomPage(page);
  await room.waitForReady();
  return room;
}

async function joinRoom(page: Page, roomCode: string, seat: number): Promise<void> {
  await page.getByTestId(TESTIDS.homeEnterRoomButton).click();
  await enterRoomCodeViaNumPad(page, roomCode);
  await page.getByText('加入', { exact: true }).click();
  await waitForRoomScreenReady(page, { role: 'joiner' });
  await new RoomPage(page).seatAt(seat);
}

test('create, guess, cancel or confirm host abort, and restart without losing seats', async ({
  browser,
}) => {
  const fixture = await createPlayerContexts(browser, 4);
  const hostPage = fixture.pages[0];
  const joinerPage = fixture.pages[1];
  if (joinerPage === undefined) throw new Error('joiner page missing');
  const secondJoinerPage = fixture.pages[2];
  if (secondJoinerPage === undefined) throw new Error('second joiner page missing');
  const thirdJoinerPage = fixture.pages[3];
  if (thirdJoinerPage === undefined) throw new Error('third joiner page missing');
  try {
    const room = await createDrawGuessRoom(hostPage);

    await test.step('guide opens from the room', async () => {
      await hostPage.getByRole('button', { name: '查看你画我猜玩法' }).click();
      await expect(hostPage.getByRole('heading', { name: '一人作画，其余人猜' })).toBeVisible();
      await hostPage.getByRole('button', { name: '返回', exact: true }).click();
      await room.waitForReady();
    });

    const code = await room.getRoomCode();
    await room.seatAt(0);
    await joinRoom(joinerPage, code, 1);

    await test.step('start is gated until the room is full', async () => {
      // The gate reason renders once, on the console primary in the bottom
      // bar — asserted before the management panel opens.
      const gateReason = hostPage
        .getByTestId(TESTIDS.bottomActionPanel)
        .getByText('座位尚未坐满（还差 2 人）', { exact: true });
      await expect(gateReason).toHaveCount(1);
      await expect(gateReason).toBeVisible();
      const panel = await room.openHostManagement();
      // The panel row for the primary action carries no caption: its reason
      // stays on the console only, so it appears zero times in the panel.
      await expect(panel.getByText('座位尚未坐满（还差 2 人）', { exact: true })).toHaveCount(0);
      const startButton = panel.getByTestId('start-game-button');
      await expect(startButton).toBeDisabled();
      // Force the press attempt: a plain click() waits forever for the
      // button to become enabled, which is exactly what must not happen.
      await startButton.click({ force: true });
      // Pressing the disabled action fires nothing: no popup, still gated.
      await expect(hostPage.getByText('暂时不能开始', { exact: true })).toHaveCount(0);
      await expect(panel.getByTestId('start-game-button')).toBeDisabled();
      await room.closeHostManagement();
    });

    await test.step('real players join to reach a full room', async () => {
      await joinRoom(secondJoinerPage, code, 2);
      await joinRoom(thirdJoinerPage, code, 3);
      // The full room shows through the console primary in the lobby.
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
        '开始游戏',
      );
    });

    await test.step('start the game and reach wordSelect', async () => {
      await room.clickHostManagementActionAndConfirm('start-game-button', '开始游戏？');
      // Host (seat 0) is the first drawer.
      await expect(hostPage.getByText('请选择本轮题目')).toBeVisible();
      // E2E seeds 20 drawguess words, so 3 choices should arrive (not "preparing").
      // Words are dealt randomly; don't assert a specific word.
      await expect(hostPage.getByText('请选择本轮题目（3 选 1）')).toBeVisible({
        timeout: 30000,
      });
      await expect(joinerPage.getByText(/正在选词…/)).toBeVisible();
    });

    await test.step('drawer selects a word and drawing begins', async () => {
      const word = await hostPage.getByTestId('drawguess-word-choice-0').innerText();
      // Click the first word choice button (words are dealt randomly).
      // Use testID for reliable targeting (getByRole was flaky with RNW Pressable).
      await hostPage.getByTestId('drawguess-word-choice-0').click();
      // After word selection, drawer should see the drawing canvas.
      // (Exact drawing-phase assertions depend on the phase transition;
      // at minimum the word choices should disappear.)
      await expect(hostPage.getByText('请选择本轮题目')).not.toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByTestId('drawguess-drawing-canvas')).toBeVisible();
      for (const page of fixture.pages)
        await expect(page.getByRole('button', { name: '放弃本轮', exact: true })).toHaveCount(0);
      await expect(joinerPage.getByTestId(TESTIDS.roomHostManagementButton)).toHaveCount(0);
      await joinerPage.getByLabel('猜词输入框', { exact: true }).fill(word);
      await joinerPage.getByRole('button', { name: '发送猜词', exact: true }).click();
      await expect(joinerPage.getByLabel('已猜中，等待本轮结束', { exact: true })).toBeVisible();
    });

    await test.step('cancel keeps the current game and confirmation returns everyone to the lobby', async () => {
      await room.clickHostManagementAction(TESTIDS.abortGameButton);
      const dialog = hostPage.getByTestId(TESTIDS.alertModal);
      await expect(dialog.getByText('中止本局？', { exact: true })).toBeVisible();
      await expect(dialog).toContainText('本局不发完成奖励');
      await dialog.getByText('取消', { exact: true }).click();
      await expect(hostPage.getByTestId('drawguess-drawing-canvas')).toBeVisible();
      await expect(joinerPage.getByLabel('已猜中，等待本轮结束', { exact: true })).toBeVisible();

      await room.clickHostManagementActionAndConfirm(TESTIDS.abortGameButton, '中止本局？');
      for (const page of fixture.pages) {
        await expect(page.getByText('你画我猜 · 4人局', { exact: true })).toBeVisible();
        await expect(page.getByTestId('drawguess-drawing-canvas')).toHaveCount(0);
        await expect(page.getByLabel('猜词消息', { exact: true })).toHaveCount(0);
        await expect(page.getByTestId(TESTIDS.mySeatBadge)).toBeVisible();
      }
      expect(await room.getRoomCode()).toBe(code);
      expect(await room.getSeatCount()).toBe(4);
      await expect(hostPage.getByTestId(TESTIDS.roomNextStepButton)).toHaveAccessibleName(
        '开始游戏',
      );
      await joinerPage.reload();
      await waitForRoomScreenReady(joinerPage, { role: 'joiner' });
      await expect(joinerPage.getByText('你画我猜 · 4人局', { exact: true })).toBeVisible();
      await expect(joinerPage.getByTestId(TESTIDS.mySeatBadge)).toBeVisible();
    });

    await test.step('the preserved room starts again and can also abort during word selection', async () => {
      await room.clickHostManagementActionAndConfirm(TESTIDS.startGameButton, '开始游戏？');
      await expect(hostPage.getByText('请选择本轮题目（3 选 1）')).toBeVisible({
        timeout: 30_000,
      });
      await room.clickHostManagementActionAndConfirm(TESTIDS.abortGameButton, '中止本局？');
      for (const page of fixture.pages)
        await expect(page.getByText('你画我猜 · 4人局', { exact: true })).toBeVisible();
    });
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

    await test.step('create a four-player room and reach wordSelect', async () => {
      const room = await createDrawGuessRoom(hostPage);
      const code = await room.getRoomCode();
      await room.seatAt(0);
      for (let seat = 1; seat < 4; seat += 1) await joinRoom(fixture.pages[seat]!, code, seat);
      await room.clickHostManagementActionAndConfirm('start-game-button', '开始游戏？');
      // Host (seat 0) is the first drawer.
      await expect(hostPage.getByText('请选择本轮题目（3 选 1）')).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step('cross the wordSelect deadline with no word chosen', async () => {
      // Nobody chooses a word: the 15-second wordSelect deadline must
      // pass with zero input, so the crossing is decided by the
      // deadline alone and every client observes the whole crossing.
      // The timeout auto-assign shares beginDrawing with manual word
      // choice, so the advance is visible as the drawing canvas.
      await expect(hostPage.getByTestId('drawguess-drawing-canvas')).toBeVisible({
        timeout: 60_000,
      });
    });

    await test.step('assert no expire was sent by any client', async () => {
      const byPage = observations.map((observation) => observation.expires());
      await testInfo.attach('drawguess-expire-observation', {
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

    await test.step('create a four-player room and reach wordSelect', async () => {
      const room = await createDrawGuessRoom(hostPage);
      const code = await room.getRoomCode();
      await room.seatAt(0);
      for (let seat = 1; seat < 4; seat += 1) await joinRoom(fixture.pages[seat]!, code, seat);
      await room.clickHostManagementActionAndConfirm('start-game-button', '开始游戏？');
      await expect(hostPage.getByText('请选择本轮题目（3 选 1）')).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step('start the round, then hold every client offline across the deadline', async () => {
      // Offline, the link is not live, so no client's expiry gate can
      // fire; the 15-second deadline still passes on the server clock.
      // The hold is measured from the word choices being visible,
      // which trails the server's words-dealt decision by a second or
      // two, so 22 seconds clears the deadline plus settle latency.
      const startedAt = Date.now();
      for (const context of fixture.contexts) await setOffline(context, true);
      await expect
        .poll(async () => Date.now() - startedAt, { timeout: 30_000, intervals: [300] })
        .toBeGreaterThan(22_000);
    });

    await test.step('reconnect and observe the server-driven advance with no acceleration', async () => {
      for (const context of fixture.contexts) await setOffline(context, false);
      // The wordSelect-deadline crossing itself (wordSelect -> drawing
      // via the timeout auto-assign) happened server-side while every
      // client was offline. Under D3 no expire can ever be sent, so
      // the zero claim is NOT scoped to the advance: the full observed
      // list must be empty.
      const advanced = expect.poll(
        async () => (await hostPage.getByTestId('drawguess-drawing-canvas').count()) > 0,
        { timeout: 60_000, intervals: [300] },
      );
      await advanced.toBe(true);
      const byPage = observations.map((observation) => observation.expires());
      await testInfo.attach('drawguess-offline-expire-observation', {
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
