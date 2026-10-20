/** Demo Worker effect execution: scheduled stage-deadline settlement in the #162 form. */

import {
  DEMO_REASONS,
  type DemoEffect,
  type DemoInternalCommand,
  type DemoPublicCommand,
  type DemoState,
} from '@game-judge/game-engine/games/demo/public';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import type { WorkerEffectContext } from '../../../platform/gameModules/workerModule';
import { demoEffectSchema, handleDemoEffect } from '../effects';
import { demoWorkerModule } from '../module';

const HOST = 'demo-host';
const BEGIN_AT = 1000;
const DEADLINE_AT = 61_000;
const seatUser = (seat: number) => (seat === 0 ? HOST : `u${seat}`);

function applyPublic(
  state: DemoState,
  command: DemoPublicCommand,
  userId: string,
  commandId: string,
  nowMs = 1,
): DemoState {
  const decision = demoWorkerModule.decidePublic(state, command, {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs,
    commandId,
    randomSeed: commandId,
  });
  if (decision.kind !== 'commit') throw new Error(`Expected commit: ${decision.reason}`);
  return decision.state;
}

/** Four seated humans driven into the armed playing stage (deadline 61000). */
function armedPlayingState(): DemoState {
  const created = demoWorkerModule.createInitialState(
    { numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: HOST, nowMs: 1, commandId: 'create' },
  );
  if (created.kind !== 'created') throw new Error(created.reason);
  let state = created.state;
  for (let seat = 0; seat < 4; seat += 1) {
    state = applyPublic(
      state,
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      seatUser(seat),
      `seat-${seat}`,
    );
  }
  state = applyPublic(state, { type: 'demo.roles.assign' }, HOST, 'start');
  for (let seat = 0; seat < 4; seat += 1) {
    state = applyPublic(state, { type: 'demo.role.viewed' }, seatUser(seat), `view-${seat}`);
  }
  state = applyPublic(state, { type: 'demo.game.begin' }, HOST, 'begin', BEGIN_AT);
  if (state.phase.kind !== 'playing' || state.phase.deadlineAt !== DEADLINE_AT) {
    throw new Error('Expected an armed playing stage with deadline 61000');
  }
  return state;
}

function settleEffectFor(
  state: DemoState,
  overrides: Partial<Extract<DemoEffect, { type: 'demo.settle.due' }>['payload']> = {},
): DemoEffect {
  if (state.phase.kind !== 'playing') throw new Error('Expected a playing phase');
  return demoEffectSchema.parse({
    type: 'demo.settle.due',
    payload: {
      gameSequence: state.gameSequence,
      deadlineAt: state.phase.deadlineAt,
      ...overrides,
    },
  });
}

function completedEffect(): DemoEffect {
  return demoEffectSchema.parse({
    type: 'demo.game.completed',
    payload: { roundId: 'demo:game:1', completedAt: 1000, participantUserIds: [HOST] },
  });
}

/**
 * Effect context whose dispatchInternal runs the real engine internal
 * decide, so a settle delivery settles (or rejects) for real.
 */
function settleContext(state: DemoState, nowMs = DEADLINE_AT) {
  const box: { current: DemoState; commands: DemoInternalCommand[] } = {
    current: state,
    commands: [],
  };
  const context: WorkerEffectContext<DemoState, DemoInternalCommand> = {
    bindings: env,
    effectId: 'settle-effect',
    state,
    roomIdentity: { roomId: 'demo-room', roomCode: '1234', creationId: 'demo-creation' },
    createdRevision: 10,
    deliveryAttemptCount: 1,
    publishUserEvent: vi.fn(async () => undefined),
    dispatchInternal: (commandId, command) => {
      box.commands.push(command);
      const decision = demoWorkerModule.decideInternal(box.current, command, {
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

describe('Demo settle effect', () => {
  it('validates the settle payload strictly', () => {
    const state = armedPlayingState();
    expect(settleEffectFor(state).type).toBe('demo.settle.due');
    expect(
      demoEffectSchema.safeParse({
        type: 'demo.settle.due',
        payload: { gameSequence: -1, deadlineAt: DEADLINE_AT },
      }).success,
    ).toBe(false);
    expect(
      demoEffectSchema.safeParse({
        type: 'demo.settle.due',
        payload: { gameSequence: 1, deadlineAt: DEADLINE_AT, extra: 1 },
      }).success,
    ).toBe(false);
  });

  it('keys settle effects by arming identity and delivers them at the deadline', () => {
    const state = armedPlayingState();
    const effect = settleEffectFor(state);
    const businessContext = { originCommandId: 'begin-1', createdRevision: 10 };
    expect(demoWorkerModule.getEffectBusinessKey(effect, businessContext)).toBe(
      `demo:settle:${state.gameSequence}:${DEADLINE_AT}`,
    );
    expect(demoWorkerModule.getEffectDeliveryAt?.(effect, businessContext)).toBe(DEADLINE_AT);
    expect(demoWorkerModule.getEffectDeliveryAt?.(completedEffect(), businessContext)).toBeNull();
  });

  it('settles the armed stage through the internal system command', async () => {
    const state = armedPlayingState();
    const { context, box } = settleContext(state);
    await handleDemoEffect(settleEffectFor(state), context);
    expect(box.commands).toEqual([{ type: 'demo.phase.settleExpired' }]);
    expect(box.current.phase.kind).toBe('ended');
    expect(box.current.xpSettled).toBe(true);
  });

  it('no-ops deliveries whose pinned arming no longer matches the room', async () => {
    const state = armedPlayingState();
    const stalePayloads = [{ gameSequence: state.gameSequence + 1 }, { deadlineAt: 61_001 }];
    for (const overrides of stalePayloads) {
      const { context, box } = settleContext(state);
      await handleDemoEffect(settleEffectFor(state, overrides), context);
      expect(box.commands).toEqual([]);
      expect(box.current).toBe(state);
    }
  });

  it('treats a superseded settle rejection as delivered, other rejections as failures', async () => {
    const state = armedPlayingState();
    const effect = settleEffectFor(state);
    const base = settleContext(state).context;
    const rejectedWith = (reason: string) => ({
      ...base,
      dispatchInternal: (commandId: string) =>
        Promise.resolve({ kind: 'rejected' as const, commandId, reason }),
    });
    await expect(
      handleDemoEffect(effect, rejectedWith(DEMO_REASONS.phase)),
    ).resolves.toBeUndefined();
    await expect(
      handleDemoEffect(effect, rejectedWith(DEMO_REASONS.deadline)),
    ).resolves.toBeUndefined();
    await expect(handleDemoEffect(effect, rejectedWith('demo_not_host_begin'))).rejects.toThrow(
      'was rejected: demo_not_host_begin',
    );
  });
});
