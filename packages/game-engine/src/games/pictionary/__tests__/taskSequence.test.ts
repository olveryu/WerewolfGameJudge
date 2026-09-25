/** Pictionary prompt-first sequence contracts through the public engine transition path. */

import type { CommandContext, CreateGameContext, Decision } from '../../../platform/engine';
import {
  createPictionaryCommand,
  type PictionaryCommandInput,
  type PictionaryInternalCommand,
} from '../commands/types';
import type { PictionaryEvent } from '../domain/events';
import { REASON_PICTIONARY_PHASE_INVALID } from '../domain/reasons';
import type { PictionaryEffect } from '../effects/types';
import {
  decidePictionaryCommand as decideBoundPictionaryCommand,
  pictionaryEngine,
} from '../engine';
import { parsePictionaryState } from '../state/parseState';
import {
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryExpectedKind,
  getPictionaryRelayStepCount,
  getPictionaryTaskForSeat,
  PICTIONARY_MAX_PLAYERS,
  PICTIONARY_MIN_PLAYERS,
  type PictionaryState,
} from '../state/types';

const CREATE_CONTEXT: CreateGameContext = {
  roomCode: '2468',
  hostUserId: 'user-0',
  nowMs: 1_000,
  commandId: 'create-room',
};

function userContext(userId: string, nowMs = 2_000): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs,
    commandId: `${userId}:${nowMs}`,
    randomSeed: 'pictionary-sequence-seed',
  };
}

function applyDecision(
  state: PictionaryState,
  decision: Decision<PictionaryEvent, PictionaryEffect>,
): PictionaryState {
  if (decision.kind !== 'commit') {
    throw new Error(`Expected committed Pictionary decision, received ${decision.reason}`);
  }
  let nextState = state;
  for (const event of decision.events) {
    nextState = pictionaryEngine.evolve(nextState, event);
  }
  const normalized = pictionaryEngine.normalize(nextState);
  expect(JSON.stringify(parsePictionaryState(normalized))).toBe(JSON.stringify(normalized));
  return normalized;
}

function dispatch(
  state: PictionaryState,
  command: PictionaryCommandInput | PictionaryInternalCommand,
  context: CommandContext,
): PictionaryState {
  return applyDecision(state, decidePictionaryCommand(state, command, context));
}

function decidePictionaryCommand(
  state: PictionaryState,
  command: PictionaryCommandInput | PictionaryInternalCommand,
  context: CommandContext,
) {
  const seat =
    context.controlledSeat ??
    Object.values(state.realSeats).find(
      (occupant) => context.actor.kind === 'user' && occupant?.userId === context.actor.userId,
    )?.seat ??
    0;
  return decideBoundPictionaryCommand(
    state,
    command.type === 'pictionary.drawing.commit'
      ? command
      : createPictionaryCommand(state, command, seat),
    context,
  );
}

function createFullLobby(numberOfPlayers = 4): PictionaryState {
  let state = pictionaryEngine.createInitialState(
    {
      ...DEFAULT_PICTIONARY_CONFIG,
      numberOfPlayers,
      drawingDurationSeconds: 90,
    },
    CREATE_CONTEXT,
  );
  for (let seat = 0; seat < numberOfPlayers; seat += 1) {
    state = dispatch(
      state,
      { type: 'room.seat.take', seat, profile: { displayName: `玩家 ${seat + 1}` } },
      userContext(`user-${seat}`, 2_000 + seat),
    );
  }
  return state;
}

function expireCurrentPhase(state: PictionaryState): PictionaryState {
  if (state.deadlineAt === null) {
    throw new Error(`Expected ${state.phase} to have a deadline`);
  }
  return dispatch(
    state,
    { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
    userContext('user-0', state.deadlineAt),
  );
}

function advancePastAnsweringStep(state: PictionaryState): PictionaryState {
  const settlingState = expireCurrentPhase(state);
  expect(settlingState.phase).toBe('settling');
  let transitionState = settlingState;
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    transitionState = dispatch(
      transitionState,
      { type: 'pictionary.task.empty.submit' },
      userContext(`user-${seat}`, state.deadlineAt! + seat + 1),
    );
  }
  expect(transitionState.phase).toBe('transition');
  return expireCurrentPhase(transitionState);
}

describe('Pictionary task sequence', () => {
  it('rejects delayed task commands after an empty submission and later steps', () => {
    let state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0'),
    );
    const delayed = createPictionaryCommand(
      state,
      { type: 'pictionary.text.submit', text: 'old input' },
      0,
    );
    state = expireCurrentPhase(state);
    state = dispatch(state, { type: 'pictionary.task.empty.submit' }, userContext('user-0'));
    expect(state.chains.flatMap((chain) => chain.entries)).toContainEqual(
      expect.objectContaining({ kind: 'missed', authorSeat: 0 }),
    );
    for (let seat = 1; seat < 4; seat++)
      state = dispatch(
        state,
        { type: 'pictionary.task.empty.submit' },
        userContext(`user-${seat}`),
      );
    state = advancePastAnsweringStep(expireCurrentPhase(state));
    state = expireCurrentPhase(state);
    expect(state.stepIndex).toBe(2);
    expect(decideBoundPictionaryCommand(state, delayed, userContext('user-0')).kind).toBe('reject');
  });

  it('aborts incomplete rounds without rewards and keeps accepted works and author names', () => {
    let state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0'),
    );
    state = expireCurrentPhase(state);
    state = dispatch(
      state,
      { type: 'pictionary.text.submit', text: 'retained' },
      userContext('user-0'),
    );
    state = dispatch(
      state,
      { type: 'room.profile.update', profile: { displayName: 'new name' } },
      userContext('user-0'),
    );
    const decision = decidePictionaryCommand(
      state,
      { type: 'pictionary.round.abort' },
      userContext('user-0'),
    );
    expect(decision.kind).toBe('commit');
    if (decision.kind !== 'commit') throw new Error(decision.reason);
    expect(decision.effects).toEqual([]);
    state = applyDecision(state, decision);
    expect(state.phase).toBe('aborted');
    expect(state.participants.find((participant) => participant.seat === 0)?.displayName).toBe(
      '玩家 1',
    );
    expect(state.chains.flatMap((chain) => chain.entries)).toContainEqual(
      expect.objectContaining({ text: 'retained' }),
    );
    expect(parsePictionaryState(state)).toEqual(state);
    state = dispatch(state, { type: 'pictionary.game.returnToLobby' }, userContext('user-0'));
    expect(state.participants).toEqual([]);
  });

  it('preserves paused time and revealed entries and can finish the entire gallery', () => {
    let state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0'),
    );
    for (let step = 0; step < 4; step++) state = advancePastAnsweringStep(state);
    const pauseAt = state.deadlineAt! - 3000;
    state = dispatch(state, { type: 'pictionary.gallery.pause' }, userContext('user-0', pauseAt));
    state = dispatch(
      state,
      { type: 'pictionary.gallery.resume' },
      userContext('user-0', pauseAt + 1000),
    );
    expect(state.deadlineAt).toBe(pauseAt + 4000);
    state = dispatch(state, { type: 'pictionary.gallery.advance' }, userContext('user-0'));
    state = dispatch(state, { type: 'pictionary.gallery.rewind' }, userContext('user-0'));
    expect(state.gallery).toMatchObject({ entryIndex: 0, revealedPosition: 1 });
    state = dispatch(state, { type: 'pictionary.gallery.finish' }, userContext('user-0'));
    expect(state.phase).toBe('ended');
    expect(state.gallery?.revealedPosition).toBe(15);
  });
  it.each(
    Array.from(
      { length: PICTIONARY_MAX_PLAYERS - PICTIONARY_MIN_PLAYERS + 1 },
      (_, index) => index + PICTIONARY_MIN_PLAYERS,
    ),
  )('varies handoff recipients in a %s-player round', (numberOfPlayers) => {
    let state = dispatch(
      createFullLobby(numberOfPlayers),
      { type: 'pictionary.round.start' },
      userContext('user-0'),
    );
    for (let stepIndex = 0; stepIndex < numberOfPlayers; stepIndex += 1) {
      const restored = parsePictionaryState(JSON.parse(JSON.stringify(state)));
      const tasks = Array.from({ length: numberOfPlayers }, (_, seat) => {
        const task = getPictionaryTaskForSeat(state, seat);
        expect(task).not.toBeNull();
        expect(getPictionaryTaskForSeat(restored, seat)).toEqual(task);
        return task!.chain.id;
      });
      expect(new Set(tasks).size).toBe(numberOfPlayers);
      state = advancePastAnsweringStep(state);
    }
    const recipients = Array.from({ length: numberOfPlayers }, () => new Map<number, number>());
    for (const chain of state.chains) {
      expect(new Set(chain.entries.map((entry) => entry.authorSeat)).size).toBe(numberOfPlayers);
      for (let entryIndex = 1; entryIndex < chain.entries.length; entryIndex += 1) {
        const previousEntry = chain.entries[entryIndex - 1]!;
        const entry = chain.entries[entryIndex]!;
        const handoffRecipients = recipients[previousEntry.authorSeat]!;
        handoffRecipients.set(entry.authorSeat, (handoffRecipients.get(entry.authorSeat) ?? 0) + 1);
      }
    }
    for (const handoffRecipients of recipients) {
      expect(handoffRecipients.size).toBeGreaterThan(1);
      const maximumHandoffs = numberOfPlayers % 2 === 0 ? 1 : 2;
      expect(Math.max(...handoffRecipients.values())).toBeLessThanOrEqual(maximumHandoffs);
    }
  });

  it('preserves current rounds and pending drawings through persistence', () => {
    let state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0'),
    );
    state = expireCurrentPhase(state);
    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      state = dispatch(
        state,
        { type: 'pictionary.text.submit', text: `prompt-${seat}` },
        userContext(`user-${seat}`),
      );
    }
    state = expireCurrentPhase(expireCurrentPhase(state));
    state = dispatch(state, { type: 'pictionary.drawing.reserve' }, userContext('user-0'));
    const restored = parsePictionaryState(JSON.parse(JSON.stringify(state)));
    expect(restored).toEqual(state);
    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      expect(getPictionaryTaskForSeat(restored, seat)).toEqual(
        getPictionaryTaskForSeat(state, seat),
      );
    }
  });

  it.each([true, false])(
    'settles at gallery entry and excludes blank-only players (hasContent=%s)',
    (hasContent) => {
      let state = dispatch(
        createFullLobby(),
        { type: 'pictionary.round.start' },
        userContext('user-0'),
      );
      for (let step = 0; step < 4; step += 1) {
        state = expireCurrentPhase(state);
        for (let seat = 0; seat < 4; seat += 1) {
          state = dispatch(
            state,
            hasContent && step === 0 && seat === 0
              ? { type: 'pictionary.text.submit', text: '画一座山' }
              : { type: 'pictionary.task.empty.submit' },
            userContext(`user-${seat}`, 10_000 + step * 1000 + seat),
          );
        }
        const context = userContext('user-0', state.deadlineAt!);
        const decision = decidePictionaryCommand(
          state,
          { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
          context,
        );
        if (decision.kind === 'reject') throw new Error(decision.reason);
        expect(decision.effects).toEqual(
          step === 3
            ? [
                {
                  type: 'pictionary.round.completed',
                  payload: {
                    roundId: state.roundId,
                    completedAt: context.nowMs,
                    participantUserIds: hasContent ? ['user-0'] : [],
                  },
                },
              ]
            : [],
        );
        state = applyDecision(state, decision);
      }
      expect(state.phase).toBe('gallery');
      const decision = decidePictionaryCommand(
        state,
        { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
        userContext('user-0', state.deadlineAt!),
      );
      if (decision.kind === 'reject') throw new Error(decision.reason);
      expect(decision.effects).toEqual([]);
    },
  );

  it('pauses at each album end until the host advances, including the final album', () => {
    let state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0'),
    );
    for (let step = 0; step < 4; step += 1) state = advancePastAnsweringStep(state);
    for (let chainIndex = 0; chainIndex < 4; chainIndex += 1) {
      expect(state.gallery).toEqual({
        chainIndex,
        entryIndex: 0,
        isPlaying: true,
        revealedPosition: chainIndex * 4,
        remainingMs: null,
      });
      for (let entryIndex = 1; entryIndex < 4; entryIndex += 1) state = expireCurrentPhase(state);
      expect(state.gallery).toEqual({
        chainIndex,
        entryIndex: 3,
        isPlaying: false,
        revealedPosition: chainIndex * 4 + 3,
        remainingMs: null,
      });
      expect(state.deadlineAt).toBeNull();
      expect(
        decidePictionaryCommand(
          state,
          { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
          userContext('user-1', 9_000_000),
        ).kind,
      ).toBe('reject');
      expect(
        decidePictionaryCommand(
          state,
          { type: 'pictionary.gallery.advance' },
          userContext('user-1'),
        ).kind,
      ).toBe('reject');
      state = dispatch(
        state,
        { type: 'pictionary.gallery.advance' },
        userContext('user-0', 10_000_000 + chainIndex),
      );
    }
    expect(state.phase).toBe('ended');
  });

  it('keeps collection open until clients deliver their drafts', () => {
    const state = expireCurrentPhase(
      dispatch(
        createFullLobby(),
        { type: 'pictionary.round.start' },
        userContext('user-0', 10_000),
      ),
    );
    expect(state.phase).toBe('settling');
    expect(state.deadlineAt).toBeNull();
    const collected = dispatch(
      state,
      { type: 'pictionary.text.submit', text: ' 还没有写完\n' },
      userContext('user-0', 120_000),
    );
    expect(collected.chains.flatMap((chain) => chain.entries)).toEqual([
      expect.objectContaining({ kind: 'text', text: ' 还没有写完\n' }),
    ]);
  });

  it('alternates text and drawing for one total stage per player', () => {
    expect(
      Array.from({ length: getPictionaryRelayStepCount(4) }, (_, stepIndex) =>
        getPictionaryExpectedKind(stepIndex),
      ),
    ).toEqual(['text', 'drawing', 'text', 'drawing']);
  });

  it('starts every player with a prompt task and the text deadline', () => {
    const startTime = 10_000;
    const state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0', startTime),
    );

    expect(state.phase).toBe('answering');
    expect(state.stepIndex).toBe(0);
    expect(state.deadlineAt).toBe(startTime + 45_000);
    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      expect(getPictionaryTaskForSeat(state, seat)).toMatchObject({
        expectedKind: 'text',
        previousEntry: null,
      });
    }
  });

  it('keeps final content out of the relay during the editable answering phase', () => {
    const state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0', 10_000),
    );

    expect(
      decidePictionaryCommand(
        state,
        { type: 'pictionary.text.submit', text: '仍可修改的草稿' },
        userContext('user-0', 11_000),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_PICTIONARY_PHASE_INVALID });
  });

  it('collects final content only after every player marks the local draft ready', () => {
    let state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0', 10_000),
    );

    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      state = dispatch(
        state,
        { type: 'pictionary.task.ready.set', isReady: true },
        userContext(`user-${seat}`, 11_000 + seat),
      );
      expect(state.chains.every((chain) => chain.entries.length === 0)).toBe(true);
    }
    expect(state.phase).toBe('settling');
    expect(state.readySeats).toEqual([]);

    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      state = dispatch(
        state,
        { type: 'pictionary.text.submit', text: `最终题目 ${seat + 1}` },
        userContext(`user-${seat}`, 12_000 + seat),
      );
    }
    expect(state.phase).toBe('transition');
    expect(state.chains.every((chain) => chain.entries.length === 1)).toBe(true);
  });

  it('lets a player resume editing before collection starts', () => {
    let state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0', 10_000),
    );

    state = dispatch(
      state,
      { type: 'pictionary.task.ready.set', isReady: true },
      userContext('user-0', 11_000),
    );
    expect(state.readySeats).toEqual([0]);

    state = dispatch(
      state,
      { type: 'pictionary.task.ready.set', isReady: false },
      userContext('user-0', 12_000),
    );
    expect(state).toMatchObject({ phase: 'answering', readySeats: [] });
    expect(state.chains.every((chain) => chain.entries.length === 0)).toBe(true);
  });

  it.each([4, 5, 8])(
    'gives every album %i distinct participants before the gallery',
    (numberOfPlayers) => {
      let state = dispatch(
        createFullLobby(numberOfPlayers),
        { type: 'pictionary.round.start' },
        userContext('user-0', 10_000),
      );
      const relayStepCount = getPictionaryRelayStepCount(state.config.numberOfPlayers);
      const visitedChains = new Set<string>();

      for (let stepIndex = 0; stepIndex < relayStepCount; stepIndex += 1) {
        expect(state).toMatchObject({ phase: 'answering', stepIndex });
        const task = getPictionaryTaskForSeat(state, 0);
        expect(task?.expectedKind).toBe(getPictionaryExpectedKind(stepIndex));
        expect(task).not.toBeNull();
        expect(visitedChains.has(task!.chain.id)).toBe(false);
        visitedChains.add(task!.chain.id);
        state = advancePastAnsweringStep(state);
      }

      expect(state.phase).toBe('gallery');
      expect(state.chains).toHaveLength(numberOfPlayers);
      expect(state.chains.every((chain) => chain.entries.length === relayStepCount)).toBe(true);
      expect(
        state.chains.every(
          (chain) =>
            new Set(chain.entries.map((entry) => entry.authorSeat)).size === numberOfPlayers,
        ),
      ).toBe(true);
      expect(state.gallery).toMatchObject({ chainIndex: 0, entryIndex: 0 });

      const galleryEntryCount = state.config.numberOfPlayers * relayStepCount;
      for (let position = 1; position < galleryEntryCount; position += 1) {
        state = dispatch(
          state,
          { type: 'pictionary.gallery.advance' },
          userContext('user-0', 20_000 + position),
        );
        expect(state.gallery).toMatchObject({
          chainIndex: Math.floor(position / relayStepCount),
          entryIndex: position % relayStepCount,
        });
      }

      state = dispatch(
        state,
        { type: 'pictionary.gallery.advance' },
        userContext('user-0', 20_000 + galleryEntryCount),
      );
      expect(state.phase).toBe('ended');
    },
  );
});
