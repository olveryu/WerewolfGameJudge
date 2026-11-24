/**
 * Werewolf Worker settle effect: scheduled settlement of an armed
 * deadline through the shared settle.due delivery chain.
 *
 * The per-game residue under test: the effect schema, the outbox
 * business key / delivery time derived from the pin, the staleness
 * gate (`readArmedDeadline` compared field by field against the pin),
 * and the superseded-rejection set. The internal decide is the real
 * engine, so a current delivery settles for real.
 */

import {
  type GameState,
  GameStatus,
  readArmedDeadline,
  REASON_DEADLINE_NOT_REACHED,
  REASON_PHASE_NOT_EXPIRABLE,
  type WerewolfEffect,
  type WerewolfInternalCommand,
  type WerewolfPublicCommand,
  type WerewolfSettleDueEffect,
} from '@game-judge/game-engine/games/werewolf/public';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { STEP_SKIP_ACTION_KEY } from '@game-judge/game-engine/platform/steps';
import { env, evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { WorkerEffectContext } from '../../../platform/gameModules/workerModule';
import type { GameRoomRuntime } from '../../../platform/room/GameRoomRuntime';
import { handleWerewolfEffect, werewolfEffectSchema } from '../effects';
import { werewolfWorkerModule } from '../module';

const DEADLINE_AT = 6000;
afterEach(deleteCurrentRoomAlarms);

function baseState(): GameState {
  const created = werewolfWorkerModule.createInitialState(
    { templateRoles: ['wolf', 'wolf', 'seer', 'hunter', 'villager'] },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1, commandId: 'create' },
  );
  if (created.kind !== 'created') throw new Error(created.reason);
  return {
    ...created.state,
    players: {
      0: { seat: 0, role: 'wolf' },
      1: { seat: 1, role: 'wolf' },
      2: { seat: 2, role: 'seer' },
      3: { seat: 3, role: 'hunter' },
      4: { seat: 4, role: 'villager' },
    },
    roster: {
      0: { seat: 0, userId: 'host', profile: { displayName: 'Host' } },
      1: { seat: 1, userId: 'u1', profile: { displayName: 'U1' } },
      2: { seat: 2, userId: 'u2', profile: { displayName: 'U2' } },
      3: { seat: 3, userId: 'u3', profile: { displayName: 'U3' } },
      4: { seat: 4, userId: 'u4', profile: { displayName: 'U4' } },
    },
    roleViewedSeats: [0, 1, 2, 3, 4],
    gameSequence: 2,
  };
}

function dispatchPublicFixture(
  state: GameState,
  command: WerewolfPublicCommand,
  userId: string,
  nowMs: number,
): GameState {
  const decision = werewolfWorkerModule.decidePublic(state, command, {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs,
    commandId: `fixture:${command.type}:${userId}`,
    randomSeed: 'settle-effect-fixture',
  });
  if (decision.kind === 'reject') throw new Error(`Fixture command rejected: ${decision.reason}`);
  if (decision.outcome.kind === 'domainRejected') {
    throw new Error(`Fixture command rejected: ${decision.outcome.reason}`);
  }
  return decision.state;
}

function acknowledgeFixtureAudio(state: GameState, nowMs: number): GameState {
  return dispatchPublicFixture(
    state,
    { type: 'werewolf.audio.ack', audioBatchId: state.audioBatchId },
    'host',
    nowMs,
  );
}

/** Use the current commands to arm the real shared wolf-vote deadline. */
function armedWolfVoteState(): GameState {
  let state = dispatchPublicFixture(
    { ...baseState(), status: GameStatus.Ready },
    { type: 'werewolf.game.begin' },
    'host',
    1000,
  );
  state = acknowledgeFixtureAudio(state, 1000);
  const current = state.nightState?.slice.current;
  if (current?.stepId !== 'wolfKill') throw new Error('Expected the wolf-vote step');
  for (const userId of ['host', 'u1']) {
    state = dispatchPublicFixture(
      state,
      {
        type: 'werewolf.step.submit',
        gameSequence: state.gameSequence,
        submission: { ...current, actionKey: 'wolfKill', seats: [4] },
      },
      userId,
      1000,
    );
  }
  if (state.nightState?.slice.deadlineMs !== DEADLINE_AT) {
    throw new Error('Expected an armed wolf-vote deadline');
  }
  return state;
}

function completedNightState(): GameState {
  let state = armedWolfVoteState();
  const settled = werewolfWorkerModule.decideInternal(
    state,
    { type: 'werewolf.phase.settleExpired' },
    {
      actor: { kind: 'system', effectId: 'fixture-settle' },
      controlledSeat: null,
      nowMs: DEADLINE_AT,
      commandId: 'fixture:settle',
      randomSeed: 'settle-effect-fixture',
    },
  );
  if (settled.kind === 'reject') throw new Error(`Fixture settle rejected: ${settled.reason}`);
  state = settled.state;
  for (let transition = 0; transition < 10; transition += 1) {
    if (state.isAudioPlaying) {
      state = acknowledgeFixtureAudio(state, DEADLINE_AT);
      continue;
    }
    if (state.status === GameStatus.Day) return state;
    const current = state.nightState?.slice.current;
    if (current?.stepId !== 'hunterConfirm' && current?.stepId !== 'seerCheck') {
      throw new Error(`Unexpected fixture step: ${String(current?.stepId)}`);
    }
    state = dispatchPublicFixture(
      state,
      {
        type: 'werewolf.step.submit',
        gameSequence: state.gameSequence,
        submission: {
          ...current,
          actionKey: current.stepId === 'hunterConfirm' ? 'hunterConfirm' : STEP_SKIP_ACTION_KEY,
        },
      },
      current.stepId === 'hunterConfirm' ? 'u3' : 'u2',
      DEADLINE_AT,
    );
  }
  throw new Error('Fixture night did not reach the sheriff election');
}

/** Day sheriff first vote, every eligible ballot in, settle countdown armed. */
function armedSheriffVoteState(): GameState {
  return {
    ...completedNightState(),
    sheriffElection: {
      phase: 'firstVote',
      registeredSeats: [0, 1],
      withdrawnSeats: [],
      completedRounds: [],
      candidateSeats: [0, 1],
      eligibleVoterSeats: [2, 3, 4],
      ballots: { 2: 0, 3: 0, 4: 1 },
      deadline: DEADLINE_AT,
    },
  };
}

function settleEffectFor(
  state: GameState,
  overrides: Partial<WerewolfSettleDueEffect['payload']> = {},
): WerewolfEffect {
  const phase =
    state.nightStep?.kind === 'inStep'
      ? state.nightStep.stepId
      : state.sheriffElection?.phase === 'firstVote' ||
          state.sheriffElection?.phase === 'runoffVote'
        ? state.sheriffElection.phase
        : null;
  if (phase === null) throw new Error('Expected an armed deadline carrier');
  return werewolfEffectSchema.parse({
    type: 'werewolf.settle.due',
    payload: { gameSequence: state.gameSequence, phase, deadlineAt: DEADLINE_AT, ...overrides },
  });
}

/** Effect context whose dispatchInternal runs the real engine internal decide. */
function settleContext(state: GameState, nowMs = DEADLINE_AT) {
  const box: { current: GameState; commands: WerewolfInternalCommand[] } = {
    current: state,
    commands: [],
  };
  const context: WorkerEffectContext<GameState, WerewolfInternalCommand> = {
    bindings: env,
    effectId: 'settle-effect',
    state,
    roomIdentity: { roomId: 'werewolf-room', roomCode: '1234', creationId: 'werewolf-creation' },
    createdRevision: 10,
    deliveryAttemptCount: 1,
    publishUserEvent: vi.fn(async () => undefined),
    dispatchInternal: (commandId, command) => {
      box.commands.push(command);
      const decision = werewolfWorkerModule.decideInternal(box.current, command, {
        actor: { kind: 'system', effectId: 'settle-effect' },
        controlledSeat: null,
        nowMs,
        commandId,
        randomSeed: commandId,
      });
      if (decision.kind === 'reject') {
        return Promise.resolve({ kind: 'rejected', commandId, reason: decision.reason });
      }
      box.current = decision.state;
      return Promise.resolve(
        createRoomCommandResult({
          kind: 'committed',
          commandId,
          state: decision.state,
          revision: 11,
          outcome: { kind: 'success' },
        }),
      );
    },
  };
  return { context, box };
}

describe('Werewolf settle effect', () => {
  it('validates the settle payload strictly', () => {
    expect(settleEffectFor(armedWolfVoteState()).type).toBe('werewolf.settle.due');
    expect(settleEffectFor(armedSheriffVoteState()).type).toBe('werewolf.settle.due');
    const invalid = [
      { gameSequence: 2, phase: 'notAStep', deadlineAt: DEADLINE_AT },
      { gameSequence: -1, phase: 'wolfKill', deadlineAt: DEADLINE_AT },
      { gameSequence: 2, phase: 'wolfKill', deadlineAt: DEADLINE_AT, extra: 1 },
      { gameSequence: 2, phase: 'wolfKill' },
    ];
    for (const payload of invalid) {
      expect(werewolfEffectSchema.safeParse({ type: 'werewolf.settle.due', payload }).success).toBe(
        false,
      );
    }
  });

  it('keys settle effects by arming identity and delivers them at the deadline', () => {
    const state = armedWolfVoteState();
    const effect = settleEffectFor(state);
    const businessContext = { originCommandId: 'vote-1', createdRevision: 10 };
    expect(werewolfWorkerModule.getEffectBusinessKey(effect, businessContext)).toBe(
      `werewolf:settle:2:wolfKill:${DEADLINE_AT}`,
    );
    expect(werewolfWorkerModule.getEffectDeliveryAt?.(effect, businessContext)).toBe(DEADLINE_AT);
    const ended: WerewolfEffect = {
      type: 'werewolf.game.ended',
      payload: { roomCode: '1234', participants: [] },
    };
    expect(werewolfWorkerModule.getEffectDeliveryAt?.(ended, businessContext)).toBeNull();
  });

  it('settles the armed wolf vote through the internal system command', async () => {
    const state = armedWolfVoteState();
    const { context, box } = settleContext(state);
    await handleWerewolfEffect(settleEffectFor(state), context);
    expect(box.commands).toEqual([{ type: 'werewolf.phase.settleExpired' }]);
    expect(box.current.nightStep).not.toEqual(state.nightStep);
  });

  it('settles the armed sheriff vote through the internal system command', async () => {
    const state = armedSheriffVoteState();
    const { context, box } = settleContext(state);
    await handleWerewolfEffect(settleEffectFor(state), context);
    expect(box.commands).toEqual([{ type: 'werewolf.phase.settleExpired' }]);
    expect(box.current.sheriffElection).toMatchObject({ phase: 'result', deadline: 11000 });
    const result = box.current;
    const resultEffect = werewolfEffectSchema.parse({
      type: 'werewolf.settle.due',
      payload: { gameSequence: result.gameSequence, phase: 'sheriffResult', deadlineAt: 11000 },
    });
    const stale = settleContext(result, 11000);
    await handleWerewolfEffect(settleEffectFor(state), stale.context);
    expect(stale.box.commands).toEqual([]);
    const next = settleContext(result, 11000);
    await handleWerewolfEffect(resultEffect, next.context);
    expect(next.box.current.status).toBe(GameStatus.Ended);
    expect(next.box.current.sheriffElectionResult).toEqual({ kind: 'elected', sheriffSeat: 0 });
  });

  it('resumes the timed sheriff result after durable object eviction', async () => {
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
    const identity = {
      roomCode: '9301',
      roomId: stub.id.toString(),
      creationId: 'sheriff-result-test',
    };
    await env.DB.prepare(
      "INSERT OR IGNORE INTO users (id) VALUES ('host'), ('u1'), ('u2'), ('u3'), ('u4')",
    ).run();
    await env.DB.prepare(
      `INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at, games_started)
         VALUES (?, ?, 'werewolf', 'host', ?, '{}', 'active', ?, ?, 0)`,
    )
      .bind(
        identity.roomId,
        identity.roomCode,
        identity.creationId,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
    await stub.initializeRoom({
      ...identity,
      gameType: 'werewolf',
      hostUserId: 'host',
      config: { templateRoles: ['wolf', 'wolf', 'seer', 'hunter', 'villager'] },
    });
    const initial = { ...armedSheriffVoteState(), roomCode: identity.roomCode };
    await runInDurableObject(stub, async (_instance: GameRoomRuntime, state) => {
      state.storage.sql.exec(
        'UPDATE room_state SET game_state = ? WHERE id = 1',
        JSON.stringify(initial),
      );
    });
    const cast = await stub.dispatchUserCommand({
      ...identity,
      commandId: 'refresh-vote',
      actorUserId: 'u2',
      controlledSeat: null,
      command: { type: 'werewolf.sheriff.vote', targetSeat: 0 },
    });
    if (cast.kind !== 'decided' || cast.result.kind !== 'committed')
      throw new Error('Expected vote commit');
    await runInDurableObject(stub, async (instance: GameRoomRuntime, state) => {
      const row = state.storage.sql
        .exec<{ game_state: string }>('SELECT game_state FROM room_state WHERE id = 1')
        .one();
      const game = JSON.parse(row.game_state) as { sheriffElection: { deadline: number } };
      const deadline = Date.now() - 1000;
      game.sheriffElection.deadline = deadline;
      const effect = state.storage.sql
        .exec<{ payload_json: string }>(
          "SELECT payload_json FROM effect_outbox WHERE effect_type = 'werewolf.settle.due'",
        )
        .one();
      const payload = JSON.parse(effect.payload_json) as {
        payload: { deadlineAt: number; phase: string; gameSequence: number };
      };
      payload.payload.deadlineAt = deadline;
      state.storage.sql.exec(
        'UPDATE room_state SET game_state = ? WHERE id = 1',
        JSON.stringify(game),
      );
      state.storage.sql.exec(
        "UPDATE effect_outbox SET available_at = ?, payload_json = ? WHERE effect_type = 'werewolf.settle.due'",
        deadline,
        JSON.stringify(payload),
      );
      expect(readArmedDeadline(werewolfWorkerModule.parseState(game))).toEqual({
        phase: payload.payload.phase,
        deadlineAt: payload.payload.deadlineAt,
      });
      expect(werewolfWorkerModule.parseState(game).isAudioPlaying).toBe(false);
      expect(werewolfWorkerModule.parseState(game).gameSequence).toBe(payload.payload.gameSequence);
      await instance.alarm();
      const remaining = state.storage.sql
        .exec<{ status: string; last_error: string | null }>(
          "SELECT status, last_error FROM effect_outbox WHERE effect_type = 'werewolf.settle.due'",
        )
        .toArray();
      if (remaining.some((item) => item.last_error !== null))
        throw new Error(`Settlement not delivered: ${JSON.stringify(remaining)}`);
    });
    const revealed = await stub.getSnapshot(identity);
    if (revealed === null) throw new Error('Expected snapshot');
    const result = werewolfWorkerModule.parseState(revealed.state);
    if (result.sheriffElection?.phase !== 'result')
      throw new Error(`Expected timed result: ${JSON.stringify(result.sheriffElection)}`);
    const deadline = result.sheriffElection.deadline;
    await evictDurableObject(stub);
    const reconnected = await stub.getSnapshot(identity);
    if (reconnected === null) throw new Error('Expected reconnected snapshot');
    expect(werewolfWorkerModule.parseState(reconnected.state).sheriffElection).toMatchObject({
      phase: 'result',
      deadline,
    });
    await runInDurableObject(stub, async (instance: GameRoomRuntime, state) => {
      const row = state.storage.sql
        .exec<{ game_state: string }>('SELECT game_state FROM room_state WHERE id = 1')
        .one();
      const game = JSON.parse(row.game_state) as { sheriffElection: { deadline: number } };
      const past = Date.now() - 1000;
      game.sheriffElection.deadline = past;
      const effect = state.storage.sql
        .exec<{ payload_json: string }>(
          "SELECT payload_json FROM effect_outbox WHERE effect_type = 'werewolf.settle.due'",
        )
        .one();
      const payload = JSON.parse(effect.payload_json) as { payload: { deadlineAt: number } };
      payload.payload.deadlineAt = past;
      state.storage.sql.exec(
        'UPDATE room_state SET game_state = ? WHERE id = 1',
        JSON.stringify(game),
      );
      state.storage.sql.exec(
        "UPDATE effect_outbox SET available_at = ?, payload_json = ? WHERE effect_type = 'werewolf.settle.due'",
        past,
        JSON.stringify(payload),
      );
      await instance.alarm();
    });
    const completed = await stub.getSnapshot(identity);
    if (completed === null) throw new Error('Expected completed snapshot');
    expect(werewolfWorkerModule.parseState(completed.state)).toMatchObject({
      status: GameStatus.Ended,
      sheriffElectionResult: { kind: 'elected', sheriffSeat: 0 },
    });
  });

  it('no-ops deliveries whose pinned arming no longer matches the room', async () => {
    const state = armedWolfVoteState();
    const stalePayloads: Partial<WerewolfSettleDueEffect['payload']>[] = [
      { gameSequence: state.gameSequence + 1 },
      { phase: 'seerCheck' },
      { deadlineAt: DEADLINE_AT + 1 },
    ];
    for (const overrides of stalePayloads) {
      const { context, box } = settleContext(state);
      await handleWerewolfEffect(settleEffectFor(state, overrides), context);
      expect(box.commands).toEqual([]);
      expect(box.current).toBe(state);
    }
    // A deadline that was cleared (vote retracted) is stale too.
    const nightState = state.nightState;
    if (nightState === null) throw new Error('Expected the active night state');
    const cleared: GameState = {
      ...state,
      nightState: {
        ...nightState,
        slice: { ...nightState.slice, deadlineMs: null },
      },
    };
    const { context, box } = settleContext(cleared);
    await handleWerewolfEffect(settleEffectFor(state), context);
    expect(box.commands).toEqual([]);
  });

  it('treats a superseded settle rejection as delivered, other rejections as failures', async () => {
    const state = armedWolfVoteState();
    const effect = settleEffectFor(state);
    const base = settleContext(state).context;
    const rejectedWith = (reason: string) => ({
      ...base,
      dispatchInternal: (commandId: string) =>
        Promise.resolve({ kind: 'rejected' as const, commandId, reason }),
    });
    await expect(
      handleWerewolfEffect(effect, rejectedWith(REASON_PHASE_NOT_EXPIRABLE)),
    ).resolves.toBeUndefined();
    await expect(
      handleWerewolfEffect(effect, rejectedWith(REASON_DEADLINE_NOT_REACHED)),
    ).resolves.toBeUndefined();
    await expect(handleWerewolfEffect(effect, rejectedWith('not_host'))).rejects.toThrow(
      'was rejected: not_host',
    );
  });
});
