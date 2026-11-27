/**
 * Fixed room states for the visual gate (UI drift lock P2).
 *
 * Dealing, word choice and night order are random in a real room, so a room screen is not
 * reproducible from the UI flow. Each fixture here plays a game through the real engine with
 * fixed seeds (the same builders the client unit tests use), and `serveRoomFixture` hands that
 * state to the page in place of the server's snapshot, over the room's own socket protocol
 * (Playwright `routeWebSocket`, the network-mocking route Playwright documents for this). The
 * room itself is created through the real flow, so the directory record, the signed-in user and
 * every other request stay real; only the room socket is answered from the fixture.
 */
import type { Page, WebSocketRoute } from '@playwright/test';
import { z } from 'zod';

import type { AvalonState } from '../../packages/game-engine/src/games/avalon/public';
import {
  DEFAULT_DRAWGUESS_CONFIG,
  type DrawGuessCommand,
  drawGuessEngine,
  type DrawGuessState,
} from '../../packages/game-engine/src/games/drawguess/public';
import type { BaseGameState } from '../../packages/game-engine/src/platform/protocol/roomSnapshot';
import {
  createRoomSnapshot,
  type RoomSnapshot,
} from '../../packages/game-engine/src/platform/protocol/roomSnapshot';
import { createSeededRng } from '../../packages/game-engine/src/platform/random';
import {
  createCommandUnavailableFrame,
  createSyncFrame,
  createSyncSnapshotFrame,
  parseClientFrame,
} from '../../packages/game-engine/src/platform/realtime/protocol';
import { createEngineGame } from '../../packages/web/src/games/werewolf/room/__tests__/harness/engineGame';
import { playAvalonTestGame } from '../../packages/web/src/test-utils/avalonState';

/** The room identity a fixture was built for, rebound to the real room on the page. */
interface FixtureIdentity {
  readonly roomCode: string;
  readonly hostUserId: string;
}

export interface RoomFixture {
  readonly state: BaseGameState<string>;
  /** The room code and host user id the builder used (see each builder's source). */
  readonly identity: FixtureIdentity;
  /**
   * For a phase with a running countdown, the page clock at the capture (25 seconds before its
   * deadline, so the countdown shows a mid-count value); null for a phase without one, whose
   * screen does not read the clock.
   */
  readonly countdownCaptureAtMs: number | null;
}

/** Time left on a running countdown at the capture. */
const CAPTURE_REMAINING_MS = 25_000;

/** The room code and host user id `playAvalonTestGame` uses (see its source). */
const AVALON_IDENTITY: FixtureIdentity = { roomCode: 'ABCD', hostUserId: 'host-1' };

/**
 * Runs `play` with `crypto.getRandomValues` answered from a seeded generator. The Avalon engine
 * deals roles and picks the first leader from Web Crypto (`secureRng`), not from the command's
 * `randomSeed`, so `playAvalonTestGame` alone deals a different table every run.
 */
function withSeededCrypto<T>(seed: string, play: () => T): T {
  const rng = createSeededRng(seed);
  const seeded = <A extends ArrayBufferView | null>(array: A): A => {
    if (!(array instanceof Uint32Array)) {
      throw new Error('[FAIL-FAST] Seeded crypto only answers Uint32Array (secureRng)');
    }
    for (let index = 0; index < array.length; index += 1) {
      array[index] = Math.floor(rng() * 0x100000000);
    }
    return array;
  };
  // An own property shadows `Crypto.prototype.getRandomValues`; deleting it restores the original.
  Object.defineProperty(globalThis.crypto, 'getRandomValues', {
    value: seeded,
    configurable: true,
  });
  try {
    return play();
  } finally {
    Reflect.deleteProperty(globalThis.crypto, 'getRandomValues');
  }
}

/** An Avalon state from `playAvalonTestGame`; the states used here have no countdown. */
function avalonFixture(failedQuests: 1 | 3): RoomFixture {
  const state: AvalonState = withSeededCrypto(`visual:avalon:${failedQuests}`, () =>
    playAvalonTestGame(failedQuests),
  );
  if ('deadlineAt' in state.phase && state.phase.deadlineAt !== null) {
    throw new Error(`[FAIL-FAST] Avalon fixture ${state.phase.kind} has a countdown`);
  }
  return { state, identity: AVALON_IDENTITY, countdownCaptureAtMs: null };
}

/** Avalon, five seats, one quest failed: the next leader is nominating (the host's view). */
export function avalonNominationFixture(): RoomFixture {
  return avalonFixture(1);
}

/** Avalon, five seats, three quests failed: the game has ended, its review is available. */
export function avalonEndedFixture(): RoomFixture {
  return avalonFixture(3);
}

/** Werewolf 预女猎白, twelve seats, first night after the opening narration (the host's view). */
export function werewolfTwelveSeatNightFixture(): RoomFixture {
  const state = createEngineGame('预女猎白').getGameState();
  if (state.nightState?.slice.deadlineMs != null) {
    throw new Error('[FAIL-FAST] Werewolf fixture night step has a countdown');
  }
  return {
    state,
    identity: { roomCode: '1234', hostUserId: 'host-uid' },
    countdownCaptureAtMs: null,
  };
}

function drawingCaptureAt(deadlineAt: number | null): number {
  if (deadlineAt === null) throw new Error('[FAIL-FAST] DrawGuess drawing has no countdown');
  return deadlineAt - CAPTURE_REMAINING_MS;
}

const DRAWGUESS_HOST = 'host-1';
const DRAWGUESS_SECOND_PLAYER = 'u1';
const DRAWGUESS_WORDS = [
  { word: '大熊猫', pinyinInitials: 'd x m' },
  { word: '火锅', pinyinInitials: 'h g' },
  { word: '风筝', pinyinInitials: 'f z' },
] as const;

/**
 * DrawGuess, four seats (the host, 小雨 and two bots): the first turn someone other than the
 * host draws, parked in its drawing phase, so the host is answering.
 */
export function drawGuessAnsweringFixture(): RoomFixture {
  // A fixed instant in the app's own era, since the page clock is set to the fixture's time.
  let nowMs = Date.UTC(2026, 0, 1);
  let commandNumber = 0;
  let state: DrawGuessState = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
    { roomCode: 'ABCD', hostUserId: DRAWGUESS_HOST, nowMs, commandId: 'create' },
  );
  const apply = (
    command: DrawGuessCommand,
    actor: Parameters<typeof drawGuessEngine.decide>[2],
  ) => {
    const decision = drawGuessEngine.decide(state, command, actor);
    if (decision.kind === 'reject') {
      throw new Error(`[FAIL-FAST] ${command.type} rejected: ${decision.reason}`);
    }
    state = drawGuessEngine.normalize(decision.events.reduce(drawGuessEngine.evolve, state));
  };
  const execution = () => {
    commandNumber += 1;
    return { nowMs, commandId: `command:${commandNumber}`, randomSeed: `seed:${commandNumber}` };
  };
  // Read through a function: a command changes the phase, which TypeScript cannot see.
  const readPhase = (): DrawGuessState['phase'] => state.phase;
  const asSeat = (command: DrawGuessCommand, seat: number) =>
    apply(command, {
      actor: { kind: 'user', userId: seat === 1 ? DRAWGUESS_SECOND_PLAYER : DRAWGUESS_HOST },
      controlledSeat: seat <= 1 ? null : seat,
      ...execution(),
    });
  const asSystem = (command: DrawGuessCommand) =>
    apply(command, {
      actor: { kind: 'system', effectId: 'effect:visual' },
      controlledSeat: null,
      ...execution(),
    });

  asSeat({ type: 'room.seat.take', seat: 0, profile: { displayName: '阿杰' } }, 0);
  asSeat({ type: 'room.seat.take', seat: 1, profile: { displayName: '小雨' } }, 1);
  asSeat({ type: 'room.seat.fillBots' }, 0);
  asSeat({ type: 'drawguess.game.begin' }, 0);
  for (let turnIndex = 0; readPhase().kind === 'wordSelect'; turnIndex += 1) {
    asSystem({
      type: 'drawguess.words.dealt',
      gameSequence: state.gameSequence,
      turnIndex,
      choices: [...DRAWGUESS_WORDS],
    });
    const dealt = readPhase();
    if (dealt.kind !== 'wordSelect') {
      throw new Error(`[FAIL-FAST] DrawGuess turn ${turnIndex} dealt no words`);
    }
    asSeat(
      {
        type: 'drawguess.word.choose',
        word: DRAWGUESS_WORDS[0].word,
        phaseRevision: state.phaseRevision,
        turnIndex,
      },
      dealt.drawerSeat,
    );
    if (dealt.drawerSeat !== 0) {
      const drawing = readPhase();
      if (drawing.kind !== 'drawing') {
        throw new Error(`[FAIL-FAST] DrawGuess expected drawing, got ${drawing.kind}`);
      }
      return {
        state,
        identity: { roomCode: 'ABCD', hostUserId: DRAWGUESS_HOST },
        countdownCaptureAtMs: drawingCaptureAt(drawing.deadlineAt),
      };
    }
    // The host drew this turn: let it and its round end expire, then deal the next turn.
    for (const kind of ['drawing', 'roundEnd'] as const) {
      const phase = readPhase();
      if (phase.kind !== kind || phase.deadlineAt === null) {
        throw new Error(`[FAIL-FAST] DrawGuess expected a timed ${kind}, got ${phase.kind}`);
      }
      nowMs = phase.deadlineAt;
      asSystem({ type: 'drawguess.phase.settleExpired' });
    }
  }
  throw new Error(`[FAIL-FAST] DrawGuess reached ${state.phase.kind} before a guessing turn`);
}

/** Replace every string (value or key) equal to a fixture id by the real room's id. */
function rebind(value: unknown, ids: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => rebind(item, ids));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [ids.get(key) ?? key, rebind(item, ids)]),
    );
  }
  return value;
}

/** The identity part of the server's snapshot answer to a SYNC (the state is not read here). */
const serverSnapshotFrameSchema = z.object({
  type: z.literal('SYNC_RESULT'),
  outcome: z.literal('snapshot'),
  snapshot: z.object({
    revision: z.int().nonnegative(),
    state: z.object({ roomCode: z.string(), hostUserId: z.string() }),
  }),
});

/**
 * Reads the server's snapshot answer to the forwarded SYNC: the real room code, host and
 * revision. Any other frame (a push before it) is skipped; a snapshot of another shape throws.
 */
function readServerSnapshot(message: string | Buffer): {
  readonly roomCode: string;
  readonly hostUserId: string;
  readonly revision: number;
} | null {
  if (typeof message !== 'string') throw new Error('[FAIL-FAST] Binary room frame');
  const frame: unknown = JSON.parse(message);
  const isSnapshot = z
    .object({ type: z.literal('SYNC_RESULT'), outcome: z.literal('snapshot') })
    .safeParse(frame).success;
  if (!isSnapshot) return null;
  const { snapshot } = serverSnapshotFrameSchema.parse(frame);
  return {
    roomCode: snapshot.state.roomCode,
    hostUserId: snapshot.state.hostUserId,
    revision: snapshot.revision,
  };
}

/**
 * Answer the page's room socket with `fixture` instead of the server's room state. Install before
 * the page enters the room (Playwright routes only sockets opened after the route exists).
 *
 * The first SYNC goes to the real server; its snapshot supplies the real room code and host user
 * id, which replace the fixture's ids, and the fixture is sent as that SYNC's snapshot. From then
 * on the page talks to the fixture alone: every SYNC gets the same snapshot and every COMMAND is
 * answered `unavailable` (the screen is a still picture; nothing it sends may change it).
 */
export async function serveRoomFixture(page: Page, fixture: RoomFixture): Promise<void> {
  await page.routeWebSocket('**/ws*', (ws: WebSocketRoute) => {
    const server = ws.connectToServer();
    let snapshot: RoomSnapshot<BaseGameState<string>> | null = null;
    let firstRequestId: string | null = null;
    const sendSnapshot = (requestId: string) => {
      if (snapshot === null) throw new Error('[FAIL-FAST] Fixture snapshot not built yet');
      ws.send(JSON.stringify(createSyncSnapshotFrame(requestId, snapshot)));
    };
    server.onMessage((message) => {
      if (snapshot !== null) return;
      const real = readServerSnapshot(message);
      if (real === null || firstRequestId === null) return;
      const ids = new Map([
        [fixture.identity.roomCode, real.roomCode],
        [fixture.identity.hostUserId, real.hostUserId],
      ]);
      const state = rebind(fixture.state, ids) as BaseGameState<string>;
      snapshot = createRoomSnapshot(state, real.revision + 1);
      sendSnapshot(firstRequestId);
    });
    ws.onMessage((message) => {
      // Keepalive stays with the page: the real socket carries only the first SYNC.
      if (message === 'ping') {
        ws.send('pong');
        return;
      }
      if (typeof message !== 'string') throw new Error('[FAIL-FAST] Binary room frame');
      const frame = parseClientFrame(JSON.parse(message));
      if (frame.type === 'COMMAND') {
        ws.send(JSON.stringify(createCommandUnavailableFrame(frame.commandId)));
        return;
      }
      if (snapshot !== null) {
        sendSnapshot(frame.requestId);
        return;
      }
      // Ask the real room for its snapshot whatever revision the page already holds (the
      // server answers `current` for a known revision, which carries no identity).
      firstRequestId = frame.requestId;
      server.send(JSON.stringify(createSyncFrame(frame.requestId, null)));
    });
  });
}
