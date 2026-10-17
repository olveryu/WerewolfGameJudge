/**
 * Undercover guidance matrix: every (phase × viewer) cell declared in
 * undercoverGuidanceMatrix.ts is held true against
 * createUndercoverBottomActions, with states produced by the real
 * engine (the same command flow as undercoverRoomAdapter.test.ts).
 */
import {
  type UndercoverCommand,
  undercoverEngine,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import type { UndercoverRoundControls } from '../hooks/useUndercoverRoundControls';
import { createUndercoverBottomActions } from '../undercoverActionModels';
import { UNDERCOVER_GUIDANCE_MATRIX } from '../undercoverGuidanceMatrix';

type Phase = UndercoverState['phase'];
const PHASES: readonly Phase[] = [
  'lobby',
  'preparing',
  'preparationFailed',
  'viewing',
  'ongoing',
  'aborted',
  'ended',
];

function dispatch(
  state: UndercoverState,
  command: UndercoverCommand,
  context: { kind: 'host' } | { kind: 'system' } | { kind: 'seat'; seat: number } = {
    kind: 'host',
  },
): UndercoverState {
  const execution = { nowMs: 1, commandId: 'start', randomSeed: 'test' };
  const decision = undercoverEngine.decide(
    state,
    command,
    context.kind === 'system'
      ? { ...execution, actor: { kind: 'system', effectId: 'selection' }, controlledSeat: null }
      : context.kind === 'seat'
        ? { ...execution, actor: { kind: 'user', userId: 'host' }, controlledSeat: context.seat }
        : { ...execution, actor: { kind: 'user', userId: 'host' }, controlledSeat: null },
  );
  if (decision.kind === 'reject') throw new Error(decision.reason);
  return undercoverEngine.normalize(decision.events.reduce(undercoverEngine.evolve, state));
}

function lobbyState(): UndercoverState {
  let state = undercoverEngine.createInitialState(
    { numberOfPlayers: 6, hasBlank: true, category: 'all' },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1, commandId: 'create' },
  );
  state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  state = dispatch(state, { type: 'room.seat.fillBots' });
  return state;
}

function preparingState(): UndercoverState {
  const state = dispatch(lobbyState(), {
    type: 'undercover.round.start',
    shouldAllowRepeated: false,
  });
  if (state.phase !== 'preparing') throw new Error('expected preparing');
  return state;
}

function failedState(): UndercoverState {
  const state = dispatch(
    preparingState(),
    {
      type: 'undercover.round.failPreparation',
      roundId: 'undercover-round:start',
      failureCode: 'selectionFailed',
    },
    { kind: 'system' },
  );
  if (state.phase !== 'preparationFailed') throw new Error('expected preparationFailed');
  return state;
}

function viewingState(): UndercoverState {
  const state = dispatch(
    preparingState(),
    {
      type: 'undercover.round.complete',
      roundId: 'undercover-round:start',
      wordPair: { id: 'pair', wordA: 'Milk', wordB: 'Tea', category: 'food' },
    },
    { kind: 'system' },
  );
  if (state.phase !== 'viewing') throw new Error('expected viewing');
  return state;
}

function ongoingState(): UndercoverState {
  let state = viewingState();
  if (state.round === null) throw new Error('expected round');
  const roundId = state.round.roundId;
  for (let seat = 0; seat < 6; seat += 1) {
    state = dispatch(
      state,
      { type: 'undercover.round.confirm', roundId },
      seat === 0 ? { kind: 'host' } : { kind: 'seat', seat },
    );
  }
  state = dispatch(state, { type: 'undercover.round.begin', roundId });
  if (state.phase !== 'ongoing') throw new Error('expected ongoing');
  return state;
}

function abortedState(): UndercoverState {
  const viewing = viewingState();
  if (viewing.round === null) throw new Error('expected round');
  const state = dispatch(viewing, {
    type: 'undercover.round.abort',
    roundId: viewing.round.roundId,
  });
  if (state.phase !== 'aborted') throw new Error('expected aborted');
  return state;
}

function endedState(): UndercoverState {
  let state = ongoingState();
  // Reveal every non-civilian seat; the game ends when the last one falls.
  for (let guard = 0; guard < 6 && state.phase !== 'ended'; guard += 1) {
    if (state.round === null) throw new Error('expected round');
    const revealed = state.round.revelations.map((revelation) => revelation.seat);
    const seat = state.round.roles.findIndex(
      (role, index) => role !== 'civilian' && !revealed.includes(index),
    );
    if (seat < 0) throw new Error('no live non-civilian seat');
    state = dispatch(state, {
      type: 'undercover.round.reveal',
      roundId: state.round.roundId,
      seat,
    });
  }
  if (state.phase !== 'ended') throw new Error('expected ended');
  return state;
}

function stateFor(phase: Phase): UndercoverState {
  switch (phase) {
    case 'lobby':
      return lobbyState();
    case 'preparing':
      return preparingState();
    case 'preparationFailed':
      return failedState();
    case 'viewing':
      return viewingState();
    case 'ongoing':
      return ongoingState();
    case 'aborted':
      return abortedState();
    case 'ended':
      return endedState();
  }
}

function controlsFor(state: UndercoverState, viewerSeat: number | null): UndercoverRoundControls {
  // Entry state: nobody is mid-selection; in the viewing phase a seated
  // viewer who has not confirmed yet is the one the self hint addresses
  // (mirrors the hook's shouldConfirm derivation).
  const shouldConfirm =
    state.phase === 'viewing' &&
    viewerSeat !== null &&
    state.round !== null &&
    !state.round.confirmedSeats.includes(viewerSeat);
  return {
    isSubmitting: false,
    controlledSeat: null,
    card: null,
    canViewCard: shouldConfirm,
    shouldConfirm,
    openCard: jest.fn(),
    closeCard: jest.fn(),
    confirmCard: jest.fn(),
    markAllBotsViewed: jest.fn(),
    begin: jest.fn(),
    isSelecting: false,
    selectedSeat: null,
    reveal: jest.fn(),
    selectSeat: jest.fn(),
    beginSelection: jest.fn(),
    cancelRevelation: jest.fn(),
    cancelSelection: jest.fn(),
    start: jest.fn(),
    retry: jest.fn(),
    abort: jest.fn(),
    restart: jest.fn(),
    returnToLobby: jest.fn(),
    allowRepeated: jest.fn(),
  };
}

type Viewer = 'host' | 'seated' | 'spectator';

function bottomMessage(state: UndercoverState, viewer: Viewer): string | null {
  const mySeat = viewer === 'host' ? 0 : viewer === 'seated' ? 2 : null;
  return createUndercoverBottomActions(controlsFor(state, mySeat), state, {
    isHost: viewer === 'host',
    mySeat,
  }).message;
}

describe('UNDERCOVER_GUIDANCE_MATRIX', () => {
  it('covers exactly the phase union, each exempt cell with a reason', () => {
    expect(Object.keys(UNDERCOVER_GUIDANCE_MATRIX).sort()).toEqual([...PHASES].sort());
    for (const row of Object.values(UNDERCOVER_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(PHASES)('holds every viewer cell in phase %s', (phase) => {
    const state = stateFor(phase);
    for (const viewer of ['host', 'seated', 'spectator'] as const) {
      const cell = UNDERCOVER_GUIDANCE_MATRIX[phase][viewer];
      const message = bottomMessage(state, viewer);
      if (cell.kind === 'message') {
        if (typeof message !== 'string' || message === '') {
          throw new Error(
            `${phase} x ${viewer}: declared a message cell, got ${JSON.stringify(message)}`,
          );
        }
      } else if (message !== null) {
        throw new Error(
          `${phase} x ${viewer}: declared exempt (${cell.reason}), got ${JSON.stringify(message)}`,
        );
      }
    }
  });
});
