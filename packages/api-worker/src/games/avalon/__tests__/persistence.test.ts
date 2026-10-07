/**
 * Avalon restart recovery: the Durable Object reloads persisted state through
 * `module.parseState(JSON.parse(game_state))` (roomRepository). A literal DO
 * instance restart is not simulatable in the Vitest pool, so these tests drive
 * the module to real phases, persist the exact JSON the DO would store, and
 * recover through that same load path.
 */

import type { AvalonPublicCommand, AvalonState } from '@game-judge/game-engine/games/avalon/public';
import { describe, expect, it } from 'vitest';

import { avalonWorkerModule } from '../module';

const HOST = 'host-1';

function applyCommand(
  state: AvalonState,
  command: AvalonPublicCommand,
  commandId: string,
): AvalonState {
  const decision = avalonWorkerModule.decidePublic(state, command, {
    actor: { kind: 'user', userId: HOST },
    controlledSeat: null,
    nowMs: 1000,
    commandId,
    randomSeed: commandId,
  });
  if (decision.kind !== 'commit') throw new Error(`Expected commit: ${decision.reason}`);
  return decision.state;
}

/** Persist exactly like the DO SQLite row, then recover through the restart load path. */
function restartRecover(state: AvalonState): AvalonState {
  const persistedJson = JSON.stringify(state);
  return avalonWorkerModule.parseState(JSON.parse(persistedJson) as unknown);
}

describe('Avalon restart recovery', () => {
  it('recovers the lobby state after a simulated restart', () => {
    const created = avalonWorkerModule.createInitialState(
      { numberOfPlayers: 5, voteMode: 'public', vetoLimit: 5 },
      { roomCode: '1234', hostUserId: HOST, nowMs: 1, commandId: 'create' },
    );
    if (created.kind !== 'created') throw new Error(created.reason);
    const seated = applyCommand(
      applyCommand(created.state, { type: 'room.seat.fillBots' }, 'fill'),
      { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } },
      'seat',
    );
    expect(restartRecover(seated)).toEqual(seated);
  });

  it('recovers the night state after a simulated restart', () => {
    const created = avalonWorkerModule.createInitialState(
      { numberOfPlayers: 5, voteMode: 'public', vetoLimit: 5 },
      { roomCode: '1234', hostUserId: HOST, nowMs: 1, commandId: 'create' },
    );
    if (created.kind !== 'created') throw new Error(created.reason);
    let state = applyCommand(created.state, { type: 'room.seat.fillBots' }, 'fill');
    state = applyCommand(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } },
      'seat',
    );
    state = applyCommand(state, { type: 'avalon.game.start' }, 'start');
    if (state.phase.kind !== 'night') throw new Error('Expected night phase');
    const recovered = restartRecover(state);
    expect(recovered).toEqual(state);
    expect(recovered.phase).toEqual(state.phase);
    expect(recovered.roles).toEqual(state.roles);
  });

  it('fails fast on corrupted persisted state instead of guessing a repair', () => {
    const created = avalonWorkerModule.createInitialState(
      { numberOfPlayers: 5, voteMode: 'public', vetoLimit: 5 },
      { roomCode: '1234', hostUserId: HOST, nowMs: 1, commandId: 'create' },
    );
    if (created.kind !== 'created') throw new Error(created.reason);
    const raw = JSON.parse(JSON.stringify(created.state)) as Record<string, unknown>;
    raw.phase = { kind: 'bogus' };
    expect(() => avalonWorkerModule.parseState(raw)).toThrow();
  });
});
