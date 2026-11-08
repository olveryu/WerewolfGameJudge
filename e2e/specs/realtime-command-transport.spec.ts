/**
 * Room commands over the WebSocket transport.
 *
 * Proves the client actually sends COMMAND frames (and receives
 * COMMAND_RESULT decisions) instead of HTTP POSTs, from observed socket
 * traffic — never from UI text. Scenarios: happy-path wolf vote, durable
 * audio-ack replay after an offline window, non-durable vote failing fast
 * while offline, server-side socket drop with recovery, and a DrawGuess
 * stroke over WS.
 *
 * Precedent: e2e/specs/resilience-reconnect.spec.ts (fault injection,
 * 300s budget) and e2e/helpers/resilience.ts (dropRoomSockets,
 * setOffline). Frame observation lives in e2e/helpers/command-frames.ts
 * and must be installed before room entry — the setups below attach it
 * when the player contexts are created.
 */
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { closeAll, createPlayerContexts } from '../fixtures/app.fixture';
import type { CommandFrameObservation } from '../helpers/command-frames';
import { observeCommandFrames } from '../helpers/command-frames';
import { enterRoomCodeViaNumPad } from '../helpers/home';
import { type GameSetupWithRolesResult, setupNPlayerGameWithRoles } from '../helpers/multi-player';
import {
  clickSeatAndConfirm,
  driveWolfVote,
  findRolePageIndex,
  waitForHostAudioAck,
  waitForNightEnd,
  waitForRoleTurn,
} from '../helpers/night-driver';
import { dropRoomSockets, setOffline } from '../helpers/resilience';
import { waitForLinkLive, waitForRoomScreenReady } from '../helpers/waits';
import { HomePage } from '../pages/HomePage';
import { RoomPage } from '../pages/RoomPage';

test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

const WOLF_ACTION_TYPE = 'werewolf.action.submit';
const AUDIO_ACK_TYPE = 'werewolf.audio.ack';
const STROKE_ADD_TYPE = 'drawguess.stroke.add';

interface NightCast {
  readonly setup: GameSetupWithRolesResult;
  readonly pages: Page[];
  readonly contexts: BrowserContext[];
  readonly guardIdx: number;
  readonly wolfIdx: number;
  readonly villagerIdx: number;
}

async function castNight(
  browser: Parameters<typeof setupNPlayerGameWithRoles>[0],
): Promise<NightCast> {
  const setup = await setupNPlayerGameWithRoles(browser, {
    playerCount: 3,
    configureTemplate: async (config) =>
      config.configureCustomTemplate({ wolves: 1, villagers: 1, goodRoles: ['guard'] }),
  });
  const { roleMap } = setup;
  const guardIdx = findRolePageIndex(roleMap, '守卫');
  const wolfIdx = findRolePageIndex(roleMap, '狼人');
  const villagerIdx = findRolePageIndex(roleMap, '平民');
  expect(guardIdx).not.toBe(-1);
  expect(wolfIdx).not.toBe(-1);
  expect(villagerIdx).not.toBe(-1);
  return {
    setup,
    pages: setup.fixture.pages,
    contexts: setup.fixture.contexts,
    guardIdx,
    wolfIdx,
    villagerIdx,
  };
}

/** Guard protects the villager; the wolf's kill is driven by the caller. */
async function guardProtectsVillager(cast: NightCast): Promise<void> {
  const { pages, guardIdx, setup } = cast;
  const villagerSeat = setup.roleMap.get(cast.villagerIdx)!.seat;
  expect(await waitForRoleTurn(pages[guardIdx]!, 'guardProtect', pages, 180_000)).toBe(true);
  await clickSeatAndConfirm(pages[guardIdx]!, villagerSeat);
}

function commandTypeOf(command: unknown): string | null {
  if (typeof command !== 'object' || command === null || !('type' in command)) return null;
  return typeof command.type === 'string' ? command.type : null;
}

function countCommands(observation: CommandFrameObservation, type: string): number {
  return observation.commands().filter((frame) => commandTypeOf(frame.command) === type).length;
}

async function expectDecided(
  observation: CommandFrameObservation,
  commandId: string,
): Promise<void> {
  const result = await observation.waitForResult(commandId, 30_000);
  expect(result.outcome).toBe('decided');
  const decision: unknown = result.result;
  expect(decision).toMatchObject({ kind: 'committed' });
}

test('wolf vote goes out as a COMMAND frame and the night continues', async ({ browser }) => {
  const cast = await castNight(browser);
  const { pages, wolfIdx, setup } = cast;
  const wolfCommands = setup.commands[wolfIdx]!;
  try {
    await test.step('guard protects, wolf votes', async () => {
      await guardProtectsVillager(cast);
      const vote = wolfCommands.waitForCommand(WOLF_ACTION_TYPE);
      await driveWolfVote(pages, [wolfIdx], setup.roleMap.get(cast.villagerIdx)!.seat);
      const frame = await vote;
      await expectDecided(wolfCommands, frame.commandId);
    });

    await test.step('night ends and the result is shown', async () => {
      expect(await waitForNightEnd(pages)).toBe(true);
    });
  } finally {
    await closeAll(cast.setup.fixture);
  }
});

test('durable audio ack sent during an offline window replays once', async ({ browser }) => {
  const cast = await castNight(browser);
  const { pages, setup } = cast;
  const hostCommands = setup.hostCommands;
  try {
    await test.step('night completes, announcement batch is playing', async () => {
      await guardProtectsVillager(cast);
      await driveWolfVote(pages, [cast.wolfIdx], setup.roleMap.get(cast.villagerIdx)!.seat);
      expect(await waitForNightEnd(pages)).toBe(true);
    });

    await test.step('host goes offline while the batch plays', async () => {
      // The ack is dispatched when the batch ends (~7.6s). While the
      // socket is dead the attempt fails fast with no frame on the wire;
      // the durable outbox replays after reconnect with the same
      // commandId, so exactly one ack frame and one decision appear.
      await setOffline(cast.contexts[0]!, true);
      await pages[0]!.waitForTimeout(10_000);
      await setOffline(cast.contexts[0]!, false);
      await waitForLinkLive(pages[0]!);
    });

    await test.step('the replayed ack commits exactly once', async () => {
      await waitForHostAudioAck(hostCommands, 60_000);
      const acks = hostCommands
        .commands()
        .filter((frame) => commandTypeOf(frame.command) === AUDIO_ACK_TYPE);
      expect(acks).toHaveLength(1);
      const results = hostCommands
        .results()
        .filter((frame) => frame.commandId === acks[0]!.commandId);
      expect(results).toHaveLength(1);
      expect(results[0]!.outcome).toBe('decided');
    });
  } finally {
    await closeAll(cast.setup.fixture);
  }
});

test('non-durable vote in an offline window fails fast, then succeeds on retry', async ({
  browser,
}) => {
  const cast = await castNight(browser);
  const { pages, wolfIdx, setup } = cast;
  const wolfPage = pages[wolfIdx]!;
  const wolfCommands = setup.commands[wolfIdx]!;
  const targetSeat = setup.roleMap.get(cast.villagerIdx)!.seat;
  try {
    await test.step('guard protects, wolf goes offline on its turn', async () => {
      await guardProtectsVillager(cast);
      expect(await waitForRoleTurn(wolfPage, 'wolfKill', pages, 180_000)).toBe(true);
      await setOffline(cast.contexts[wolfIdx]!, true);
    });

    await test.step('vote fails fast with a prompt and sends no frame', async () => {
      const before = countCommands(wolfCommands, WOLF_ACTION_TYPE);
      await clickSeatAndConfirm(wolfPage, targetSeat);
      const modal = wolfPage.getByTestId(TESTIDS.alertModal);
      await expect(modal).toBeVisible({ timeout: 5_000 });
      await wolfPage.getByTestId(TESTIDS.alertButton(0)).click();
      await expect(modal).toHaveCount(0);
      expect(countCommands(wolfCommands, WOLF_ACTION_TYPE)).toBe(before);
    });

    await test.step('reconnect, vote again, night ends', async () => {
      await setOffline(cast.contexts[wolfIdx]!, false);
      await waitForLinkLive(wolfPage);
      const vote = wolfCommands.waitForCommand(WOLF_ACTION_TYPE);
      await driveWolfVote(pages, [wolfIdx], targetSeat);
      const frame = await vote;
      await expectDecided(wolfCommands, frame.commandId);
      expect(await waitForNightEnd(pages)).toBe(true);
    });
  } finally {
    await closeAll(cast.setup.fixture);
  }
});

test('server drops every socket, then commands work again after reconnect', async ({ browser }) => {
  const cast = await castNight(browser);
  const { pages, wolfIdx, setup } = cast;
  const wolfCommands = setup.commands[wolfIdx]!;
  try {
    await test.step('guard protects, server drops all sockets', async () => {
      await guardProtectsVillager(cast);
      const closed = await dropRoomSockets(pages[0]!, setup.roomCode, {
        code: 1012,
        reason: 'service_restart',
      });
      expect(closed).toBe(pages.length);
      await Promise.all(pages.map((page) => waitForLinkLive(page)));
    });

    await test.step('wolf vote succeeds on the reconnected link', async () => {
      const vote = wolfCommands.waitForCommand(WOLF_ACTION_TYPE);
      await driveWolfVote(pages, [wolfIdx], setup.roleMap.get(cast.villagerIdx)!.seat);
      const frame = await vote;
      await expectDecided(wolfCommands, frame.commandId);
      expect(await waitForNightEnd(pages)).toBe(true);
    });
  } finally {
    await closeAll(cast.setup.fixture);
  }
});

async function createDrawGuessRoom(page: Page): Promise<RoomPage> {
  await new HomePage(page).clickCreateRoom('drawguess');
  await expect(page.getByTestId(TESTIDS.gameConfigScreenRoot('drawguess'))).toBeVisible();
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

async function joinDrawGuessRoom(page: Page, roomCode: string, seat: number): Promise<void> {
  await page.getByTestId(TESTIDS.homeEnterRoomButton).click();
  await enterRoomCodeViaNumPad(page, roomCode);
  await page.getByText('加入', { exact: true }).click();
  await waitForRoomScreenReady(page, { role: 'joiner' });
  await new RoomPage(page).seatAt(seat);
}

test('drawguess stroke goes out as a COMMAND frame and reaches the guesser', async ({
  browser,
}) => {
  const fixture = await createPlayerContexts(browser, 2);
  const hostPage = fixture.pages[0];
  const guesserPage = fixture.pages[1]!;
  const drawerCommands = observeCommandFrames(hostPage);
  try {
    await test.step('reach the drawing canvas', async () => {
      const room = await createDrawGuessRoom(hostPage);
      const code = await room.getRoomCode();
      await room.seatAt(0);
      await joinDrawGuessRoom(guesserPage, code, 1);
      await room.clickHostManagementActionAndConfirm('start-game-button', '开始游戏？');
      await expect(hostPage.getByText('请选择本轮题目（3 选 1）')).toBeVisible({
        timeout: 30_000,
      });
      await hostPage.getByTestId('drawguess-word-choice-0').click();
      await expect(hostPage.getByTestId('drawguess-drawing-canvas')).toBeVisible();
      await expect(guesserPage.getByTestId('drawguess-drawing-canvas')).toBeVisible();
    });

    await test.step('drawer draws one stroke', async () => {
      const drawerCanvas = hostPage.getByTestId('drawguess-drawing-canvas');
      const guesserCanvas = guesserPage.getByTestId('drawguess-drawing-canvas');
      const before = await guesserCanvas.screenshot();
      const stroke = drawerCommands.waitForCommand(STROKE_ADD_TYPE);
      const box = await drawerCanvas.boundingBox();
      if (box === null) throw new Error('Drawer canvas has no browser layout box');
      await hostPage.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
      await hostPage.mouse.down();
      for (let step = 1; step <= 10; step += 1) {
        await hostPage.mouse.move(
          box.x + box.width * (0.2 + (0.6 * step) / 10),
          box.y + box.height * (0.2 + (0.6 * step) / 10),
        );
      }
      await hostPage.mouse.up();
      const frame = await stroke;
      await expectDecided(drawerCommands, frame.commandId);
      await expect(async () => {
        const after = await guesserCanvas.screenshot();
        expect(after.equals(before)).toBe(false);
      }).toPass({ timeout: 10_000 });
    });
  } finally {
    await closeAll(fixture);
  }
});
