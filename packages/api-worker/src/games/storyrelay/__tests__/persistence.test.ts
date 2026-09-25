/** Verifies maximum Story Relay state through real DO commands and preserves existing D1 rooms. */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayTaskForSeat,
  STORY_RELAY_MAX_PLAYERS,
  STORY_RELAY_STATE_CODEC,
  STORY_RELAY_TEXT_MAX_LENGTH,
  type StoryRelayCommand,
} from '@game-judge/game-engine/games/storyrelay/public';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { GameRoomRuntime } from '../../../platform/room/GameRoomRuntime';

afterEach(deleteCurrentRoomAlarms);

it('persists 400 maximum-length paragraphs and replays the final receipt without duplicating entries', async () => {
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
  const identity = { roomId: stub.id.toString(), roomCode: '9876', creationId: 'capacity-round' };
  const config = {
    ...DEFAULT_STORY_RELAY_CONFIG,
    numberOfPlayers: STORY_RELAY_MAX_PLAYERS,
    writingDurationSeconds: null,
    transitionDurationSeconds: 0 as const,
  };
  await env.DB.prepare("INSERT INTO users (id) VALUES ('storyrelay-capacity-host')").run();
  await env.DB.prepare(
    "INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at) VALUES (?, ?, 'storyrelay', 'storyrelay-capacity-host', ?, ?, 'active', '2026-09-25', '2026-09-25')",
  )
    .bind(identity.roomId, identity.roomCode, identity.creationId, JSON.stringify(config))
    .run();
  const initialized = await stub.initializeRoom({
    ...identity,
    gameType: 'storyrelay',
    hostUserId: 'storyrelay-capacity-host',
    config,
  });
  if (!initialized.success) throw new Error(initialized.reason);
  let state = STORY_RELAY_STATE_CODEC.parse(initialized.snapshot.state);
  let commandNumber = 0;
  const send = async (command: StoryRelayCommand, controlledSeat: number | null = null) => {
    const input = {
      ...identity,
      actorUserId: 'storyrelay-capacity-host',
      commandId: `capacity:${commandNumber++}`,
      controlledSeat,
      command,
    };
    const result = await stub.dispatchUserCommand(input);
    if (result.kind !== 'decided') throw new Error(result.reason);
    if (result.result.kind !== 'committed') throw new Error(result.result.reason);
    state = STORY_RELAY_STATE_CODEC.parse(result.result.snapshot.state);
    return { input, result };
  };
  await send({ type: 'room.seat.fillBots' });
  await send({ type: 'storyrelay.round.start' });
  const text = '\u0001'.repeat(STORY_RELAY_TEXT_MAX_LENGTH);
  for (let stepIndex = 0; stepIndex < STORY_RELAY_MAX_PLAYERS; stepIndex += 1) {
    await send({ type: 'storyrelay.phase.finish', phaseRevision: state.phaseRevision });
    for (let seat = 0; seat < STORY_RELAY_MAX_PLAYERS; seat += 1) {
      const task = getStoryRelayTaskForSeat(state, seat);
      if (task === null) throw new Error('Expected current writing task');
      await send(
        {
          type: 'storyrelay.text.submit',
          roundId: task.roundId,
          chainId: task.chainId,
          stepIndex: task.stepIndex,
          text,
        },
        seat,
      );
    }
    await send({ type: 'storyrelay.phase.expire', phaseRevision: state.phaseRevision });
  }
  const completed = await send({
    type: 'storyrelay.gallery.finish',
    phaseRevision: state.phaseRevision,
  });
  const replay = await stub.dispatchUserCommand(completed.input);
  expect(replay).toEqual({ ...completed.result, isReplay: true });
  const restored = await stub.getSnapshot(identity);
  if (restored === null) throw new Error('Persisted room snapshot missing');
  expect(STORY_RELAY_STATE_CODEC.parse(restored.state)).toEqual(state);
  expect(state.chains.flatMap((chain) => chain.entries)).toHaveLength(400);
  const sqliteRowLimitBytes = 2 * 1024 * 1024;
  expect(new TextEncoder().encode(JSON.stringify(completed.result)).byteLength).toBeLessThan(
    sqliteRowLimitBytes,
  );
  await runInDurableObject(stub, (_instance: GameRoomRuntime, durableState) => {
    const stored = durableState.storage.sql
      .exec<{ bytes: number }>('SELECT length(CAST(game_state AS BLOB)) AS bytes FROM room_state')
      .one();
    expect(stored.bytes).toBeGreaterThan(1_200_000);
    expect(stored.bytes).toBeLessThan(sqliteRowLimitBytes);
    const receipt = durableState.storage.sql
      .exec<{
        bytes: number;
      }>('SELECT MAX(length(CAST(result_json AS BLOB))) AS bytes FROM command_receipts')
      .one();
    expect(receipt.bytes).toBeLessThan(sqliteRowLimitBytes);
  });
}, 60_000);

it('keeps all four existing game directories and their child records when applying migration 0059', async () => {
  await env.DB.prepare("INSERT INTO users (id) VALUES ('storyrelay-migration-user')").run();
  for (const [index, gameType] of ['werewolf', 'pictionary', 'fibking', 'undercover'].entries()) {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at, games_started, last_started_at) VALUES (?, ?, ?, 'storyrelay-migration-user', ?, '{\"retained\":true}', 'active', '2026-09-01', '2026-09-02', 7, '2026-09-02')",
      ).bind(gameType, String(8100 + index), gameType, `creation-${gameType}`),
      env.DB.prepare(
        "INSERT INTO room_participants (room_id, user_id, joined_at) VALUES (?, 'storyrelay-migration-user', '2026-09-01')",
      ).bind(gameType),
      env.DB.prepare(
        "INSERT INTO room_game_starts (effect_id, room_id, started_revision, started_at) VALUES (?, ?, 42, '2026-09-02')",
      ).bind(`effect-${gameType}`, gameType),
    ]);
  }
  await env.DB.prepare(
    "INSERT INTO fib_round_word_selections (room_id, room_creation_id, effect_id, round_id, request_fingerprint, word_id, word, core_meaning, usage_note, source, selection_tier, selected_at, sequence_number, participant_user_ids) VALUES ('fibking', 'creation-fibking', 'selection-effect', 'round-1', 'fingerprint', NULL, '旧词', '原含义', '原说明', 'local', 'local_fallback', '2026-09-01', 123, '[\"storyrelay-migration-user\"]')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json) VALUES ('retained-pair', 'apple', 'pear', 'food', 'active', '2026-09-01', '2026-09-01', '{}')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO undercover_round_word_selections (room_id, room_creation_id, round_id, request_fingerprint, word_pair_id, word_a, word_b, category, selected_at) VALUES ('undercover', 'creation-undercover', 'old-round', 'old-fingerprint', 'retained-pair', 'apple', 'pear', 'food', '2026-09-01')",
  ).run();
  const tables = [
    'rooms',
    'room_participants',
    'room_game_starts',
    'fib_round_word_selections',
    'undercover_round_word_selections',
  ] as const;
  const read = () =>
    Promise.all(
      tables.map(
        async (table) => (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results,
      ),
    );
  const before = await read();
  const migration = env.TEST_MIGRATIONS.find(({ name }) => name === '0059_storyrelay.sql');
  if (migration === undefined) throw new Error('Story Relay migration is missing');
  await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
  expect(await read()).toEqual(before);
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  await env.DB.prepare("DELETE FROM rooms WHERE id IN ('fibking', 'undercover')").run();
  for (const table of ['fib_round_word_selections', 'undercover_round_word_selections'])
    expect(await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first()).toEqual({
      count: 0,
    });
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM room_participants').first()).toEqual({
    count: 2,
  });
});
