/** Shared fixtures for RoomLink tests: test codec, identity, environment and a wired link. */
import type {
  BaseGameState,
  GameStateCodec,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { parseClientFrame } from '@game-judge/game-engine/platform/realtime/protocol';

import {
  createPlatformEnvironment,
  type EnvironmentSource,
  type PlatformEnvironment,
} from '@/platform/env/PlatformEnvironment';
import { createOutboxStorage, type OutboxStorage } from '@/platform/realtime/outboxStorage';
import { createRoomLease, RoomLinkImpl } from '@/platform/realtime/RoomLink';
import type { InboxWakeReason, RoomIdentity } from '@/platform/realtime/types';
import { createSocketFactory } from '@/test-utils/fakeWebSocket';
import {
  createMemoryTokenStorage,
  createTestApiClient,
  createUnsignedAccessToken,
} from '@/test-utils/httpClient';

export interface TestState extends BaseGameState<'werewolf'> {
  readonly counter: number;
}

export interface TestCommand {
  readonly type: 'test.increment';
  readonly amount: number;
}

export const TEST_CODEC: GameStateCodec<TestState> = {
  gameType: 'werewolf',
  stateVersion: 1,
  parse(value: unknown): TestState {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Test state must be an object');
    }
    const fields: Partial<Record<keyof TestState, unknown>> = { ...value };
    if (
      fields.gameType !== 'werewolf' ||
      fields.stateVersion !== 1 ||
      typeof fields.roomCode !== 'string' ||
      typeof fields.hostUserId !== 'string' ||
      typeof fields.counter !== 'number'
    ) {
      throw new Error('Test state has invalid fields');
    }
    return {
      gameType: 'werewolf',
      stateVersion: 1,
      roomCode: fields.roomCode,
      hostUserId: fields.hostUserId,
      counter: fields.counter,
    };
  },
};

export const IDENTITY: RoomIdentity<'werewolf'> = {
  room: {
    roomCode: '1234',
    roomId: 'room-id-1234',
    gameType: 'werewolf',
    hostUserId: 'host-user',
    createdAt: new Date('2026-07-11T12:00:00.000Z'),
  },
  userId: 'host-user',
};

export function testState(counter = 0, hostUserId = 'host-user'): TestState {
  return { gameType: 'werewolf', stateVersion: 1, roomCode: '1234', hostUserId, counter };
}

export function snapshotAt(revision: number, counter = revision): RoomSnapshot<TestState> {
  return createRoomSnapshot(testState(counter), revision);
}

export interface FakeEnvironment {
  readonly environment: PlatformEnvironment;
  set(next: { online?: boolean; visible?: boolean }): void;
}

export function createFakeEnvironment(initial = { online: true, visible: true }): FakeEnvironment {
  let online = initial.online;
  let visible = initial.visible;
  let notify: (() => void) | null = null;
  const source: EnvironmentSource = {
    readVisible: () => visible,
    readOnline: () => online,
    listen: (onChange) => {
      notify = onChange;
      return () => {
        notify = null;
      };
    },
  };
  return {
    environment: createPlatformEnvironment({ source, now: Date.now }),
    set: (next) => {
      online = next.online ?? online;
      visible = next.visible ?? visible;
      notify?.();
    },
  };
}

export interface LinkHarness {
  readonly link: RoomLinkImpl<TestState, TestCommand>;
  readonly sockets: ReturnType<typeof createSocketFactory>;
  readonly network: ReturnType<typeof createTestApiClient>['network'];
  readonly env: FakeEnvironment;
  readonly outboxStorage: OutboxStorage;
  readonly protocolErrors: Error[];
  readonly inboxWakes: InboxWakeReason[];
  /** Drive connect() through socket open + sync so the link is live at `revision`. */
  goLive(revision?: number): Promise<void>;
}

const openLinks = new Set<RoomLinkImpl<TestState, TestCommand>>();

/** Close every link created by `createLinkHarness`; call from afterEach so timers do not outlive tests. */
export function closeAllLinks(): void {
  for (const link of openLinks) link.close();
  openLinks.clear();
}

export function createLinkHarness(options?: {
  readonly outboxStorage?: OutboxStorage;
  readonly environment?: FakeEnvironment;
}): LinkHarness {
  const env = options?.environment ?? createFakeEnvironment();
  const sockets = createSocketFactory();
  const { client, tokens, network } = createTestApiClient();
  tokens.saveTokens(
    createUnsignedAccessToken('host-user', Math.floor(Date.now() / 1000) + 3600),
    'r',
  );
  tokens.setSession({ userId: 'host-user', initialUser: null });
  const outboxStorage =
    options?.outboxStorage ?? createOutboxStorage(createMemoryTokenStorage(), Date.now);
  const protocolErrors: Error[] = [];
  const inboxWakes: InboxWakeReason[] = [];
  let commandCounter = 0;
  const link = new RoomLinkImpl<TestState, TestCommand>({
    codec: TEST_CODEC,
    api: client,
    lease: createRoomLease(),
    socketBaseUrl: 'wss://api.test',
    environment: env.environment,
    outboxStorage,
    newCommandId: () => `cmd-${++commandCounter}`,
    createSocket: sockets.create,
    now: Date.now,
    random: () => 0.5,
    setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimeout: (handle) => clearTimeout(handle),
    onProtocolError: (error) => protocolErrors.push(error),
    onInboxWake: (reason) => {
      inboxWakes.push(reason);
    },
  });
  openLinks.add(link);

  return {
    link,
    sockets,
    network,
    env,
    outboxStorage,
    protocolErrors,
    inboxWakes,
    goLive: async (revision = 1) => {
      const connected = link.connect(IDENTITY, new AbortController().signal);
      await flush();
      const socket = sockets.latest();
      socket.serverOpen();
      const sync = parseClientFrame(JSON.parse(socket.sent[0] ?? '{}'));
      socket.serverSend({
        type: 'SYNC_RESULT',
        requestId: sync.requestId,
        outcome: 'snapshot',
        snapshot: snapshotAt(revision),
      });
      await connected;
    },
  };
}

/** Let pending microtasks (token lookup, fetch doubles) settle. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

/** Real-timer tests: wait one macrotask so Response body reads complete. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
