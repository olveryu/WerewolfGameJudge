import {
  parseToolboxState,
  parseToolboxView,
  TOOLBOX_VIEW_CODEC,
  type ToolboxCommand,
  type ToolboxConfig,
  type ToolboxState,
  type ToolboxView,
} from '@game-judge/game-engine/games/toolbox/public';
import {
  createSyncFrame,
  parseServerFrame,
} from '@game-judge/game-engine/platform/realtime/protocol';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { GameRoomRuntime } from '../../../platform/room/GameRoomRuntime';
import { toolboxCreateConfigSchema } from '../schemas';

afterEach(deleteCurrentRoomAlarms);

const CONFIG: ToolboxConfig = {
  tools: ['dice', 'identity'],
  identity: {
    identities: [
      { name: '平民', description: '', count: 2 },
      { name: '卧底', description: '', count: 1 },
    ],
    cardsPerPlayer: 1,
  },
};

function active(state: ToolboxState) {
  if (state.phase.kind !== 'active') throw new Error('Toolbox session not active');
  return state.phase;
}

function ownPrivate(state: ToolboxState, userId: string) {
  const phase = active(state);
  return {
    kind: 'participant',
    dice: phase.dice!.find((entry) => entry.userId === userId)!.cup,
    hand: phase.identity!.hands.find((entry) => entry.userId === userId)!.identityIndexes,
  };
}

it('projects HTTP receipts, SYNC_RESULT and STATE_UPDATE to the viewer only', async () => {
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
  const identity = { roomId: stub.id.toString(), roomCode: '6731', creationId: 'toolbox-private' };
  await env.DB.prepare(
    "INSERT INTO users (id) VALUES ('tb-host'), ('tb-player'), ('tb-watcher')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at) VALUES (?, ?, 'toolbox', 'tb-host', ?, '{}', 'active', '2026-11-17', '2026-11-17')",
  )
    .bind(identity.roomId, identity.roomCode, identity.creationId)
    .run();
  await stub.initializeRoom({
    ...identity,
    gameType: 'toolbox',
    hostUserId: 'tb-host',
    config: CONFIG,
  });
  let serial = 0;
  const dispatch = async (command: ToolboxCommand, actorUserId = 'tb-host') => {
    const result = await stub.dispatchUserCommand({
      ...identity,
      commandId: `toolbox:${serial++}`,
      actorUserId,
      controlledSeat: null,
      command,
    });
    if (result.kind !== 'decided' || result.result.kind !== 'committed') {
      throw new Error(`Command ${command.type} did not commit`);
    }
    expect(result.result.outcome.kind).toBe('success');
    return parseToolboxView(result.result.snapshot.state);
  };
  const authority = async () => {
    const snapshot = await stub.getSnapshot(identity);
    if (snapshot === null) throw new Error('No authority');
    return parseToolboxState(snapshot.state);
  };

  await dispatch({ type: 'toolbox.member.join' }, 'tb-player');
  await dispatch({ type: 'toolbox.member.join' }, 'tb-watcher');
  await dispatch({ type: 'toolbox.seat.take' });
  await dispatch({ type: 'toolbox.seat.take' }, 'tb-player');
  await dispatch({ type: 'toolbox.session.begin', configVersion: 0 });
  const { sessionId } = active(await authority());
  await dispatch({ type: 'toolbox.dice.roll', cupVersion: 0 });
  const hostReceipt = await dispatch({ type: 'toolbox.identity.draw', sessionId });

  const state = await authority();
  expect(hostReceipt.viewerUserId).toBe('tb-host');
  if (hostReceipt.phase.kind !== 'active') throw new Error('Receipt not active');
  expect(hostReceipt.phase.participation).toEqual(ownPrivate(state, 'tb-host'));
  expect(ownPrivate(state, 'tb-host').hand).toHaveLength(1);
  expect(ownPrivate(state, 'tb-host').dice.stage).toBe('rolled');

  const assertPlayerView = (view: ToolboxView) => {
    expect(view.viewerUserId).toBe('tb-player');
    if (view.phase.kind !== 'active') throw new Error('View not active');
    expect(view.phase.participation).toEqual(ownPrivate(state, 'tb-player'));
    expect(view.phase.participation).toMatchObject({ dice: { stage: 'unrolled' }, hand: [] });
    // 视图 codec 严格解析；权威 codec 必须拒绝它，证明输出不是权威状态。
    expect(() => parseToolboxState(view)).toThrow();
  };

  await runInDurableObject(stub, async (instance: GameRoomRuntime, storage) => {
    const playerSocket = new WebSocketPair();
    const watcherSocket = new WebSocketPair();
    storage.acceptWebSocket(playerSocket[1], ['user:tb-player']);
    storage.acceptWebSocket(watcherSocket[1], ['user:tb-watcher']);
    playerSocket[1].serializeAttachment({ userId: 'tb-player', connectedAtMs: Date.now() });
    watcherSocket[1].serializeAttachment({ userId: 'tb-watcher', connectedAtMs: Date.now() });
    const playerMessages: unknown[] = [];
    const watcherMessages: unknown[] = [];
    playerSocket[0].addEventListener('message', (event) => {
      if (typeof event.data === 'string') playerMessages.push(JSON.parse(event.data));
    });
    watcherSocket[0].addEventListener('message', (event) => {
      if (typeof event.data === 'string') watcherMessages.push(JSON.parse(event.data));
    });
    playerSocket[0].accept();
    watcherSocket[0].accept();
    try {
      await instance.webSocketMessage(
        playerSocket[1],
        JSON.stringify(createSyncFrame('player-sync', null)),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      const synced = parseServerFrame(playerMessages.at(-1), TOOLBOX_VIEW_CODEC);
      if (synced.type !== 'SYNC_RESULT' || synced.outcome !== 'snapshot') {
        throw new Error('No sync snapshot');
      }
      assertPlayerView(synced.snapshot.state);

      await instance.dispatchUserCommand({
        ...identity,
        commandId: `toolbox:${serial++}`,
        actorUserId: 'tb-host',
        controlledSeat: null,
        command: { type: 'toolbox.dice.reveal', cupVersion: 1 },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const update = parseServerFrame(playerMessages.at(-1), TOOLBOX_VIEW_CODEC);
      if (update.type !== 'STATE_UPDATE') throw new Error('No player broadcast');
      assertPlayerView(update.snapshot.state);
      const watcherUpdate = parseServerFrame(watcherMessages.at(-1), TOOLBOX_VIEW_CODEC);
      if (watcherUpdate.type !== 'STATE_UPDATE') throw new Error('No watcher broadcast');
      expect(watcherUpdate.snapshot.state.phase).toMatchObject({
        kind: 'active',
        participantCount: 2,
        participation: { kind: 'spectator' },
      });
    } finally {
      playerSocket[0].close();
      watcherSocket[0].close();
    }
  });
});

it('rejects create configs the engine could not start from', () => {
  expect(toolboxCreateConfigSchema.safeParse(CONFIG).success).toBe(true);
  for (const config of [
    { ...CONFIG, tools: [] },
    { ...CONFIG, tools: ['identity', 'dice'] },
    { ...CONFIG, tools: ['dice', 'dice'] },
    { ...CONFIG, identity: { identities: [], cardsPerPlayer: 1 } },
    {
      ...CONFIG,
      identity: {
        ...CONFIG.identity,
        identities: [CONFIG.identity.identities[0], CONFIG.identity.identities[0]],
      },
    },
    { ...CONFIG, extra: true },
  ]) {
    expect(toolboxCreateConfigSchema.safeParse(config).success).toBe(false);
  }
});
