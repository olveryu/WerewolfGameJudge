/** RoomGateway COMMAND dispatch: result routing, backpressure, and failure mapping. */

import {
  type GameTemplate,
  WEREWOLF_STATE_CODEC,
  werewolfEngine,
} from '@game-judge/game-engine/games/werewolf/public';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { REASON_NO_STATE } from '@game-judge/game-engine/platform/protocol/reasons';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';
import {
  createCommandFrame,
  createSyncFrame,
  parseServerFrame,
} from '@game-judge/game-engine/platform/realtime/protocol';
import { describe, expect, it } from 'vitest';

import type { Env } from '../../../env';
import type { CommandDispatch } from '../../commands/CommandPipeline';
import type { DispatchRoomCommand, RoomInstanceIdentity } from '../../room/types';
import { MAX_PENDING_COMMANDS_PER_SOCKET, RoomGateway, type RoomGatewayDeps } from '../RoomGateway';

const TEMPLATE: GameTemplate = {
  name: 'Room gateway',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'villager', 'villager'],
};

const IDENTITY: RoomInstanceIdentity = {
  roomCode: '1234',
  roomId: 'room-1234',
  creationId: 'creation-1',
};

function createState() {
  return werewolfEngine.createInitialState(
    { templateRoles: TEMPLATE.roles },
    { roomCode: '1234', hostUserId: 'HOST', nowMs: 1, commandId: 'create-gateway-test' },
  );
}

function createCommittedDispatch(commandId: string): CommandDispatch {
  return {
    kind: 'decided',
    result: createRoomCommandResult({
      kind: 'committed',
      commandId,
      state: createState(),
      revision: 4,
      outcome: { kind: 'success' },
    }),
    isReplay: false,
    shouldBroadcast: true,
    commandType: 'room.seat.take',
  };
}

interface CollectedSocket {
  readonly client: WebSocket;
  readonly server: WebSocket;
  readonly messages: string[];
  readonly closes: Array<{ code: number; reason: string }>;
}

function createSocketPair(): CollectedSocket {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  const messages: string[] = [];
  const closes: Array<{ code: number; reason: string }> = [];
  client.addEventListener('message', (event) => {
    messages.push(String(event.data));
  });
  client.addEventListener('close', (event) => {
    closes.push({ code: event.code, reason: event.reason });
  });
  client.accept();
  return { client, server, messages, closes };
}

function createCtx(sockets: WebSocket[]): DurableObjectState {
  return {
    setWebSocketAutoResponse: () => {},
    acceptWebSocket: (socket: WebSocket) => {
      socket.accept();
    },
    getWebSockets: () => sockets.filter((socket) => socket.readyState === WebSocket.OPEN),
    getWebSocketAutoResponseTimestamp: () => null,
    storage: {
      getAlarm: async () => null,
      setAlarm: async () => {},
      deleteAlarm: async () => {},
    },
  } as unknown as DurableObjectState;
}

function createGateway(
  sockets: WebSocket[],
  depsOverrides: Partial<RoomGatewayDeps> = {},
): {
  gateway: RoomGateway;
  traffic: Array<unknown>;
  calls: Array<DispatchRoomCommand>;
} {
  const traffic: Array<unknown> = [];
  const calls: Array<DispatchRoomCommand> = [];
  const env = {
    REQUEST_TRAFFIC: {
      writeDataPoint: (point: unknown) => {
        traffic.push(point);
      },
    },
    CF_VERSION_METADATA: { id: 'test-deployment' },
  } as unknown as Env;
  const deps: RoomGatewayDeps = {
    readSnapshot: () => null,
    readRoomIdentity: () => IDENTITY,
    dispatchCommand: async (request) => {
      calls.push(request);
      return createCommittedDispatch(request.commandId);
    },
    ...depsOverrides,
  };
  return { gateway: new RoomGateway(createCtx(sockets), env, deps), traffic, calls };
}

async function waitFor(label: string, check: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  for (;;) {
    if (check()) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

function trafficIndexes(traffic: Array<unknown>): string[] {
  return traffic.flatMap((point) => {
    if (typeof point !== 'object' || point === null || !('indexes' in point)) return [];
    const indexes: unknown = point.indexes;
    return Array.isArray(indexes)
      ? indexes.filter((index): index is string => typeof index === 'string')
      : [];
  });
}

describe('RoomGateway COMMAND', () => {
  it('answers a decided COMMAND_RESULT only to the sending socket', async () => {
    const sender = createSocketPair();
    const bystander = createSocketPair();
    const { gateway, traffic, calls } = createGateway([sender.server, bystander.server]);
    await gateway.accept(sender.server, 'user-a', 1000);
    await gateway.accept(bystander.server, 'user-b', 1000);

    await gateway.handleMessage(
      sender.server,
      JSON.stringify(createCommandFrame('cmd-1', '1234', { type: 'room.seat.take', seat: 2 }, 2)),
    );

    await waitFor('COMMAND_RESULT', () => sender.messages.length === 1);
    expect(parseServerFrame(JSON.parse(sender.messages[0]), WEREWOLF_STATE_CODEC)).toMatchObject({
      type: 'COMMAND_RESULT',
      commandId: 'cmd-1',
      outcome: 'decided',
    });
    expect(calls).toEqual([
      {
        roomCode: '1234',
        commandId: 'cmd-1',
        actor: { kind: 'user', userId: 'user-a' },
        controlledSeat: 2,
        command: { type: 'room.seat.take', seat: 2 },
      },
    ]);
    await tick();
    expect(bystander.messages).toEqual([]);
    expect(bystander.closes).toEqual([]);
    expect(trafficIndexes(traffic)).toContain('websocket:COMMAND');
    expect(trafficIndexes(traffic)).toContain('websocket:COMMAND_RESULT');
  });

  it('answers unavailable when the pipeline has no room', async () => {
    const socket = createSocketPair();
    const { gateway } = createGateway([socket.server], {
      dispatchCommand: async () => ({ kind: 'unavailable', reason: REASON_NO_STATE }),
    });
    await gateway.accept(socket.server, 'user-a', 1000);

    await gateway.handleMessage(
      socket.server,
      JSON.stringify(createCommandFrame('cmd-1', '1234', { type: 'room.seat.take', seat: 2 }, 2)),
    );

    await waitFor('COMMAND_RESULT', () => socket.messages.length === 1);
    expect(parseServerFrame(JSON.parse(socket.messages[0]), WEREWOLF_STATE_CODEC)).toEqual({
      type: 'COMMAND_RESULT',
      commandId: 'cmd-1',
      outcome: 'unavailable',
    });
    expect(socket.closes).toEqual([]);
    expect(socket.server.readyState).toBe(WebSocket.OPEN);
  });

  it('answers unavailable without dispatching when the room identity is missing', async () => {
    const socket = createSocketPair();
    const { gateway, calls } = createGateway([socket.server], {
      readRoomIdentity: () => null,
    });
    await gateway.accept(socket.server, 'user-a', 1000);

    await gateway.handleMessage(
      socket.server,
      JSON.stringify(createCommandFrame('cmd-1', '1234', { type: 'room.seat.take', seat: 2 }, 2)),
    );

    await waitFor('COMMAND_RESULT', () => socket.messages.length === 1);
    expect(parseServerFrame(JSON.parse(socket.messages[0]), WEREWOLF_STATE_CODEC)).toEqual({
      type: 'COMMAND_RESULT',
      commandId: 'cmd-1',
      outcome: 'unavailable',
    });
    expect(calls).toEqual([]);
  });

  it('closes 1002 when the frame room code does not match the room', async () => {
    const socket = createSocketPair();
    const { gateway, calls } = createGateway([socket.server]);
    await gateway.accept(socket.server, 'user-a', 1000);

    await gateway.handleMessage(
      socket.server,
      JSON.stringify(createCommandFrame('cmd-1', '9999', { type: 'room.seat.take', seat: 2 }, 2)),
    );

    await waitFor('close', () => socket.closes.length === 1);
    expect(socket.closes[0]).toEqual({
      code: REALTIME_CLOSE_CODE.PROTOCOL_ERROR,
      reason: 'protocol_error',
    });
    expect(calls).toEqual([]);
  });

  it('closes 1002 when the command object fails the WS schema', async () => {
    const noType = createSocketPair();
    const negativeSeat = createSocketPair();
    const { gateway, calls } = createGateway([noType.server, negativeSeat.server]);
    await gateway.accept(noType.server, 'user-a', 1000);
    await gateway.accept(negativeSeat.server, 'user-a', 1000);

    await gateway.handleMessage(
      noType.server,
      JSON.stringify(createCommandFrame('cmd-1', '1234', { seat: 2 }, 2)),
    );
    await gateway.handleMessage(
      negativeSeat.server,
      JSON.stringify(createCommandFrame('cmd-2', '1234', { type: 'room.seat.take' }, -1)),
    );

    await waitFor('closes', () => noType.closes.length === 1 && negativeSeat.closes.length === 1);
    expect(noType.closes[0]?.code).toBe(REALTIME_CLOSE_CODE.PROTOCOL_ERROR);
    expect(negativeSeat.closes[0]?.code).toBe(REALTIME_CLOSE_CODE.PROTOCOL_ERROR);
    expect(calls).toEqual([]);
  });

  it('closes 1002 for a malformed frame', async () => {
    const socket = createSocketPair();
    const { gateway } = createGateway([socket.server]);
    await gateway.accept(socket.server, 'user-a', 1000);

    await gateway.handleMessage(socket.server, 'not-json');

    await waitFor('close', () => socket.closes.length === 1);
    expect(socket.closes[0]?.code).toBe(REALTIME_CLOSE_CODE.PROTOCOL_ERROR);
  });

  it('throttles past the per-socket pending cap without closing the socket', async () => {
    const socket = createSocketPair();
    const dispatched: Array<DispatchRoomCommand> = [];
    const { gateway } = createGateway([socket.server], {
      dispatchCommand: (request) => {
        dispatched.push(request);
        return new Promise<CommandDispatch>(() => {});
      },
    });
    await gateway.accept(socket.server, 'user-a', 1000);

    for (let i = 1; i <= MAX_PENDING_COMMANDS_PER_SOCKET; i += 1) {
      void gateway.handleMessage(
        socket.server,
        JSON.stringify(
          createCommandFrame(`cmd-${i}`, '1234', { type: 'room.seat.take', seat: 2 }, 2),
        ),
      );
    }
    await gateway.handleMessage(
      socket.server,
      JSON.stringify(
        createCommandFrame(
          `cmd-${MAX_PENDING_COMMANDS_PER_SOCKET + 1}`,
          '1234',
          { type: 'room.seat.take', seat: 2 },
          2,
        ),
      ),
    );

    await waitFor('throttled result', () => socket.messages.length === 1);
    expect(parseServerFrame(JSON.parse(socket.messages[0]), WEREWOLF_STATE_CODEC)).toEqual({
      type: 'COMMAND_RESULT',
      commandId: `cmd-${MAX_PENDING_COMMANDS_PER_SOCKET + 1}`,
      outcome: 'throttled',
    });
    expect(dispatched).toHaveLength(MAX_PENDING_COMMANDS_PER_SOCKET);
    expect(socket.closes).toEqual([]);
    expect(socket.server.readyState).toBe(WebSocket.OPEN);
  });
});

describe('RoomGateway SYNC regression', () => {
  it('still closes 4003 on SYNC when the room has no snapshot', async () => {
    const socket = createSocketPair();
    const { gateway } = createGateway([socket.server]);
    await gateway.accept(socket.server, 'user-a', 1000);

    await gateway.handleMessage(socket.server, JSON.stringify(createSyncFrame('sync-1', null)));

    await waitFor('close', () => socket.closes.length === 1);
    expect(socket.closes[0]).toEqual({
      code: REALTIME_CLOSE_CODE.STATE_UNAVAILABLE,
      reason: 'state_unavailable',
    });
  });

  it('does not close 4003 on COMMAND when the room has no snapshot', async () => {
    const socket = createSocketPair();
    const { gateway } = createGateway([socket.server], {
      readRoomIdentity: () => null,
    });
    await gateway.accept(socket.server, 'user-a', 1000);

    await gateway.handleMessage(
      socket.server,
      JSON.stringify(createCommandFrame('cmd-1', '1234', { type: 'room.seat.take', seat: 2 }, 2)),
    );

    await waitFor('COMMAND_RESULT', () => socket.messages.length === 1);
    expect(socket.closes).toEqual([]);
    expect(parseServerFrame(JSON.parse(socket.messages[0]), WEREWOLF_STATE_CODEC)).toMatchObject({
      type: 'COMMAND_RESULT',
      outcome: 'unavailable',
    });
  });

  it('still answers SYNC with a snapshot or a current marker', async () => {
    const socket = createSocketPair();
    const { gateway } = createGateway([socket.server], {
      readSnapshot: () => createRoomSnapshot(createState(), 4),
    });
    await gateway.accept(socket.server, 'user-a', 1000);

    await gateway.handleMessage(socket.server, JSON.stringify(createSyncFrame('sync-1', null)));
    await gateway.handleMessage(socket.server, JSON.stringify(createSyncFrame('sync-2', 4)));

    await waitFor('SYNC_RESULTs', () => socket.messages.length === 2);
    expect(parseServerFrame(JSON.parse(socket.messages[0]), WEREWOLF_STATE_CODEC)).toMatchObject({
      type: 'SYNC_RESULT',
      requestId: 'sync-1',
      outcome: 'snapshot',
      snapshot: { revision: 4 },
    });
    expect(parseServerFrame(JSON.parse(socket.messages[1]), WEREWOLF_STATE_CODEC)).toEqual({
      type: 'SYNC_RESULT',
      requestId: 'sync-2',
      outcome: 'current',
      revision: 4,
    });
  });
});
