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
  REASON_DEADLINE_NOT_REACHED,
  REASON_PHASE_NOT_EXPIRABLE,
  type WerewolfEffect,
  type WerewolfInternalCommand,
  type WerewolfSettleDueEffect,
} from '@game-judge/game-engine/games/werewolf/public';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import type { WorkerEffectContext } from '../../../platform/gameModules/workerModule';
import { handleWerewolfEffect, werewolfEffectSchema } from '../effects';
import { werewolfWorkerModule } from '../module';

const DEADLINE_AT = 6000;

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

/** Ongoing wolfKill step, both wolves voted, settle countdown armed. */
function armedWolfVoteState(): GameState {
  return {
    ...baseState(),
    status: GameStatus.Ongoing,
    nightStep: { kind: 'inStep', stepId: 'wolfKill', stepDeadline: DEADLINE_AT },
    currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4 } },
    actions: [
      { schemaId: 'wolfKill', actorSeat: 0, targetSeat: 4, timestamp: 1000 },
      { schemaId: 'wolfKill', actorSeat: 1, targetSeat: 4, timestamp: 1000 },
    ],
  };
}

/** Day sheriff first vote, every eligible ballot in, settle countdown armed. */
function armedSheriffVoteState(): GameState {
  return {
    ...baseState(),
    status: GameStatus.Day,
    nightStep: null,
    currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4 } },
    lastNightDeaths: [4],
    rules: { isSheriffElectionEnabled: true },
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
    expect(box.current.sheriffElection?.phase).not.toBe('firstVote');
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
    const cleared: GameState = {
      ...state,
      nightStep: { kind: 'inStep', stepId: 'wolfKill' },
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
