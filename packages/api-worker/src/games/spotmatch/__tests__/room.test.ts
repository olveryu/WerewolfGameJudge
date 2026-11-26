import {
  DEFAULT_SPOTMATCH_CONFIG,
  parseSpotmatchPublicStats,
  parseSpotmatchState,
  SPOTMATCH_STATE_CODEC,
  type SpotmatchCommand,
  spotmatchEngine,
  type SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import {
  createSyncFrame,
  parseServerFrame,
} from '@game-judge/game-engine/platform/realtime/protocol';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import {
  defineWorkerGameModule,
  registerWorkerGameModule,
} from '../../../platform/gameModules/workerModule';
import type { GameRoomRuntime } from '../../../platform/room/GameRoomRuntime';
import { handleSpotmatchEffect, spotmatchEffectSchema } from '../effects';
import { getSpotmatchPublicUserStats } from '../publicUserStats';
import {
  spotmatchCreateConfigSchema,
  spotmatchInternalCommandSchema,
  spotmatchPublicCommandSchema,
} from '../schemas';

afterEach(deleteCurrentRoomAlarms);

it('allows a strictly validated viewer shape distinct from authoritative state', () => {
  const viewSchema = z.strictObject({
    gameType: z.literal('spotmatch'),
    roomCode: z.string(),
    hostUserId: z.string(),
    viewer: z.string(),
  });
  const viewCodec = {
    gameType: 'spotmatch' as const,
    parse: (value: unknown) => viewSchema.parse(value),
  };
  const initial = spotmatchEngine.createInitialState(DEFAULT_SPOTMATCH_CONFIG, {
    roomCode: '6721',
    hostUserId: 'host',
    nowMs: 1,
    commandId: 'create',
  });
  const createModule = (
    projectStateForUser: (state: SpotmatchState, userId: string) => BaseGameState<'spotmatch'>,
  ) =>
    registerWorkerGameModule(
      defineWorkerGameModule({
        gameType: 'spotmatch' as const,
        engine: spotmatchEngine,
        stateCodec: SPOTMATCH_STATE_CODEC,
        viewCodec,
        projectStateForUser,
        createConfigSchema: spotmatchCreateConfigSchema,
        publicCommandSchema: spotmatchPublicCommandSchema,
        internalCommandSchema: spotmatchInternalCommandSchema,
        effectSchema: spotmatchEffectSchema,
        parsePublicUserStats: parseSpotmatchPublicStats,
        getPublicUserStats: getSpotmatchPublicUserStats,
        httpRoutes: [],
        handleEffect: handleSpotmatchEffect,
      }),
    );
  const module = createModule((state, userId) => ({
    gameType: state.gameType,
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
    viewer: userId,
  }));
  expect(module.projectStateForUser?.(initial, 'player')).toEqual({
    gameType: 'spotmatch',
    roomCode: '6721',
    hostUserId: 'host',
    viewer: 'player',
  });
  expect(module.parseState(initial)).toEqual(initial);
  expect(() => module.parseState(module.projectStateForUser?.(initial, 'player'))).toThrow();

  const invalid = createModule((state) => ({
    gameType: state.gameType,
    roomCode: 'other-room',
    hostUserId: state.hostUserId,
    viewer: 'player',
  }));
  expect(() => invalid.projectStateForUser?.(initial, 'player')).toThrow('mismatched view');

  const malformed = createModule((state) => ({
    gameType: state.gameType,
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
  }));
  expect(() => malformed.projectStateForUser?.(initial, 'player')).toThrow();
});

it('projects HTTP receipts and WS sync/broadcast separately; retries wrong commands exactly once', async () => {
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
  const identity = {
    roomId: stub.id.toString(),
    roomCode: '6721',
    creationId: 'spotmatch-private',
  };
  await env.DB.prepare("INSERT INTO users (id) VALUES ('spot-host'), ('spot-player')").run();
  await env.DB.prepare(
    "INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at) VALUES (?, ?, 'spotmatch', 'spot-host', ?, '{}', 'active', '2026-11-17', '2026-11-17')",
  )
    .bind(identity.roomId, identity.roomCode, identity.creationId)
    .run();
  await stub.initializeRoom({
    ...identity,
    gameType: 'spotmatch',
    hostUserId: 'spot-host',
    config: { ...DEFAULT_SPOTMATCH_CONFIG, numberOfPlayers: 2 },
  });
  let serial = 0;
  const input = (command: SpotmatchCommand, actorUserId = 'spot-host') => ({
    ...identity,
    commandId: `room:${serial++}`,
    actorUserId,
    controlledSeat: null,
    command,
  });
  await stub.dispatchUserCommand(
    input({ type: 'room.seat.take', seat: 0, profile: { displayName: 'H' } }),
  );
  await stub.dispatchUserCommand(
    input({ type: 'room.seat.take', seat: 1, profile: { displayName: 'P' } }, 'spot-player'),
  );
  const start = await stub.dispatchUserCommand(input({ type: 'spotmatch.game.begin' }));
  if (start.kind !== 'decided' || start.result.kind !== 'committed')
    throw new Error('Start failed');
  const projected = parseSpotmatchState(start.result.snapshot.state);
  expect(projected.round!.players[0].top).not.toBeNull();
  expect(projected.round!.players[1].top).toBeNull();
  const original = await stub.getSnapshot(identity);
  if (original === null) throw new Error('No authority');
  const authoritative = parseSpotmatchState(original.state);
  const top = authoritative.round!.players[0].top!;
  const wrongSymbol = top.symbols.find(
    (symbol) => !authoritative.round!.central.symbols.includes(symbol),
  )!;
  const wrong = input({
    type: 'spotmatch.card.claim',
    roundId: authoritative.round!.roundId,
    centralInstanceId: authoritative.round!.central.instanceId,
    topInstanceId: top.instanceId,
    symbolId: wrongSymbol,
  });
  const first = await stub.dispatchUserCommand(wrong);
  const replay = await stub.dispatchUserCommand(wrong);
  expect(replay).toEqual({ ...first, isReplay: true });
  if (first.kind !== 'decided' || first.result.kind !== 'committed')
    throw new Error('Wrong did not commit');
  expect(first.result.outcome.kind).toBe('domainRejected');
  expect(parseSpotmatchState(first.result.snapshot.state).round!.players[0].mistakes).toBe(1);

  await runInDurableObject(stub, async (instance: GameRoomRuntime, storage) => {
    const sockets = new WebSocketPair();
    storage.acceptWebSocket(sockets[1], ['user:spot-player']);
    sockets[1].serializeAttachment({ userId: 'spot-player', connectedAtMs: Date.now() });
    const messages: unknown[] = [];
    sockets[0].addEventListener('message', (event) => {
      if (typeof event.data === 'string') messages.push(JSON.parse(event.data));
    });
    sockets[0].accept();
    const assertPrivate = (state: SpotmatchState) => {
      expect(state.round!.players[0].top).toBeNull();
      expect(state.round!.players[1].top).not.toBeNull();
    };
    try {
      await instance.webSocketMessage(
        sockets[1],
        JSON.stringify(createSyncFrame('private-sync', null)),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      const synced = parseServerFrame(messages.at(-1), SPOTMATCH_STATE_CODEC);
      if (synced.type !== 'SYNC_RESULT' || synced.outcome !== 'snapshot')
        throw new Error('No sync snapshot');
      assertPrivate(synced.snapshot.state);
      const player = authoritative.round!.players[1].top!;
      const symbolId = player.symbols.find((symbol) =>
        authoritative.round!.central.symbols.includes(symbol),
      )!;
      const result = await instance.dispatchUserCommand(
        input(
          {
            type: 'spotmatch.card.claim',
            roundId: authoritative.round!.roundId,
            centralInstanceId: authoritative.round!.central.instanceId,
            topInstanceId: player.instanceId,
            symbolId,
          },
          'spot-player',
        ),
      );
      expect(result.kind).toBe('decided');
      await new Promise((resolve) => setTimeout(resolve, 0));
      const update = parseServerFrame(messages.at(-1), SPOTMATCH_STATE_CODEC);
      if (update.type !== 'STATE_UPDATE') throw new Error('No broadcast');
      assertPrivate(update.snapshot.state);
    } finally {
      sockets[0].close();
    }
  });
});
