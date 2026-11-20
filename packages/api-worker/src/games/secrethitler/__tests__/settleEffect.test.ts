import {
  getSecrethitlerNightParticipants,
  type SecrethitlerInternalCommand,
  type SecrethitlerPublicCommand,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import type { WorkerEffectContext } from '../../../platform/gameModules/workerModule';
import { handleSecrethitlerEffect, secrethitlerEffectSchema } from '../effects';
import { secrethitlerWorkerModule } from '../module';

function armedVote(): SecrethitlerState {
  const created = secrethitlerWorkerModule.createInitialState(
    { numberOfPlayers: 5, voteMode: 'public' },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1, commandId: 'create' },
  );
  if (created.kind !== 'created') throw new Error(created.reason);
  let state = created.state;
  let serial = 0;
  const send = (command: SecrethitlerPublicCommand, controlledSeat: number | null = null) => {
    const commandId = `setup-${serial++}`;
    const decision = secrethitlerWorkerModule.decidePublic(state, command, {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat,
      commandId,
      nowMs: 1000,
      randomSeed: commandId,
    });
    if (decision.kind !== 'commit') throw new Error(`Setup rejected: ${decision.reason}`);
    state = decision.state;
  };
  send({ type: 'room.seat.fillBots' });
  send({ type: 'secrethitler.roles.assign' });
  for (const seat of state.livingSeats) send({ type: 'secrethitler.role.viewed' }, seat);
  send({ type: 'secrethitler.game.begin' });
  for (const seat of getSecrethitlerNightParticipants(state))
    send({ type: 'secrethitler.night.confirm', step: 1 }, seat);
  while (state.isAudioPlaying)
    send({ type: 'secrethitler.audio.ack', audioBatchId: state.audioBatchId });
  const election = state.phase;
  if (election.kind !== 'election') throw new Error('Expected election');
  const target = state.livingSeats.find((seat) => seat !== election.presidentSeat);
  if (target === undefined) throw new Error('Expected candidate');
  send(
    { type: 'secrethitler.government.nominate', chancellorSeatId: target },
    election.presidentSeat,
  );
  for (const seat of state.livingSeats)
    send({ type: 'secrethitler.government.castVote', vote: 'ja' }, seat);
  if (state.phase.kind !== 'voting' || state.phase.deadlineAt !== 6000)
    throw new Error('Expected armed vote');
  return state;
}

function settleContext(state: SecrethitlerState, nowMs: number) {
  const box = { state, commands: [] as SecrethitlerInternalCommand[] };
  const context: WorkerEffectContext<SecrethitlerState, SecrethitlerInternalCommand> = {
    bindings: env,
    effectId: 'settle-effect',
    state,
    roomIdentity: { roomId: 'room', roomCode: '1234', creationId: 'creation' },
    createdRevision: 10,
    deliveryAttemptCount: 1,
    publishUserEvent: vi.fn(async () => undefined),
    dispatchInternal: (commandId, command) => {
      box.commands.push(command);
      const decision = secrethitlerWorkerModule.decideInternal(box.state, command, {
        actor: { kind: 'system', effectId: 'settle-effect' },
        controlledSeat: null,
        commandId,
        nowMs,
        randomSeed: commandId,
      });
      if (decision.kind === 'reject')
        return Promise.resolve({ kind: 'rejected', commandId, reason: decision.reason });
      box.state = decision.state;
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

describe('Secret Hitler scheduled vote settlement', () => {
  it('pins delivery to the active countdown and ignores stale effects', async () => {
    const state = armedVote();
    const effect = secrethitlerEffectSchema.parse({
      type: 'secrethitler.settle.due',
      payload: {
        gameSequence: state.gameSequence,
        phase: 'voting',
        round: state.history.governments.length,
        deadlineAt: 6000,
      },
    });
    if (effect.type !== 'secrethitler.settle.due') throw new Error('Expected settle effect');
    const businessContext = { originCommandId: 'last-vote', createdRevision: 10 };
    expect(secrethitlerWorkerModule.getEffectBusinessKey(effect, businessContext)).toBe(
      `secrethitler:settle:${state.gameSequence}:voting:1:6000`,
    );
    expect(secrethitlerWorkerModule.getEffectDeliveryAt?.(effect, businessContext)).toBe(6000);
    for (const payload of [
      { ...effect.payload, gameSequence: state.gameSequence + 1 },
      { ...effect.payload, round: 2 },
      { ...effect.payload, deadlineAt: 6001 },
    ]) {
      const { context, box } = settleContext(state, 6000);
      await handleSecrethitlerEffect({ type: 'secrethitler.settle.due', payload }, context);
      expect(box.commands).toEqual([]);
    }
    const { context, box } = settleContext(state, 6000);
    await handleSecrethitlerEffect(effect, context);
    expect(box.commands).toEqual([{ type: 'secrethitler.phase.settleExpired' }]);
    expect(box.state.phase.kind).toBe('publicResult');
    const result = box.state.phase;
    if (result.kind !== 'publicResult') throw new Error('Expected public result');
    const resultEffect = secrethitlerEffectSchema.parse({
      type: 'secrethitler.settle.due',
      payload: {
        gameSequence: state.gameSequence,
        phase: 'resultVoting',
        round: state.history.governments.length,
        deadlineAt: result.deadlineAt,
      },
    });
    if (resultEffect.type !== 'secrethitler.settle.due') throw new Error('Expected result effect');
    const stale = settleContext(box.state, result.deadlineAt);
    await handleSecrethitlerEffect(
      { ...resultEffect, payload: { ...resultEffect.payload, phase: 'resultVeto' } },
      stale.context,
    );
    expect(stale.box.commands).toEqual([]);
    const due = settleContext(box.state, result.deadlineAt);
    await handleSecrethitlerEffect(resultEffect, due.context);
    expect(due.box.commands).toEqual([{ type: 'secrethitler.phase.settleExpired' }]);
    expect(due.box.state.phase.kind).not.toBe('publicResult');
  });
});
