/**
 * Relay Chain Machine — shared contract (E1).
 *
 * These propositions are the machine's contract for every relay
 * game: the rotation visits every chain exactly once per seat, the
 * task projection exposes only the immediately previous entry, the
 * gallery reveal never retreats and its timers freeze and restore
 * exactly, and only phase-bearing landings advance the revision.
 * Games pin their own assembly against the same machine in their
 * per-game contract files (storyrelay: relayChain.contract.test.ts).
 */

import { commit, type Decision, type GameCompletionPayload } from '../../../engine';
import { createRelayAssignment } from '../assignment';
import {
  applyRelayPhaseChanged,
  applyRelayRoundStarted,
  applyRelayTaskReady,
  clearRelayRound,
} from '../evolve';
import { controlRelayGallery, moveRelayGallery } from '../gallery';
import { getRelayTaskForSeat } from '../tasks';
import type {
  RelayEventKit,
  RelayGalleryState,
  RelayPhase,
  RelayRoundSlice,
  RelayShape,
} from '../types';

interface TestEntry {
  readonly id: string;
  readonly authorSeat: number;
  readonly text: string;
}

type TestEvent =
  | {
      readonly type: 'phase.changed';
      readonly phase: RelayPhase;
      readonly stepIndex: number;
      readonly deadlineAt: number | null;
      readonly gallery: RelayGalleryState | null;
    }
  | { readonly type: 'task.ready'; readonly seat: number; readonly isReady: boolean }
  | { readonly type: 'entries.appended'; readonly chainId: string; readonly entry: TestEntry }
  | { readonly type: 'round.completed'; readonly completedAt: number };

interface TestEffect {
  readonly type: 'game.completed';
  readonly payload: GameCompletionPayload;
}

const REASONS = {
  phase: 'test_phase_invalid',
  task: 'test_task_changed',
  submitted: 'test_already_submitted',
  text: 'test_text_invalid',
  deadline: 'test_deadline_not_reached',
  manual: 'test_manual_paging',
} as const;

function testKit(shape: RelayShape): RelayEventKit<TestEntry, TestEvent, TestEffect> {
  return {
    reasons: REASONS,
    shape,
    commit: (events, effects = []) => commit({ events, effects }),
    phaseChanged: (phase, deadlineAt, stepIndex, gallery) => ({
      type: 'phase.changed',
      phase,
      stepIndex,
      deadlineAt,
      gallery,
    }),
    taskReady: (seat, isReady) => ({ type: 'task.ready', seat, isReady }),
    entryAppended: (chainId, entry) => ({ type: 'entries.appended', chainId, entry }),
    roundCompleted: (completedAt) => ({ type: 'round.completed', completedAt }),
    completionEffect: (payload) => ({ type: 'game.completed', payload }),
  };
}

describe('relay rotation contract', () => {
  const options = {
    seedSuffix: ':contract',
    minPlayers: 4,
    maxPlayers: 20,
    rangeError: 'contract range',
  } as const;

  it.each([4, 5, 6, 9, 20])(
    'offsets are a permutation starting at 0 and every seat visits every chain once (N=%i)',
    (numberOfPlayers) => {
      const { seatOrder, stepOffsets } = createRelayAssignment(numberOfPlayers, 'seed', options);
      expect(new Set(seatOrder).size).toBe(numberOfPlayers);
      expect(stepOffsets).toHaveLength(numberOfPlayers);
      expect(stepOffsets[0]).toBe(0);
      expect(new Set(stepOffsets).size).toBe(numberOfPlayers);
      for (const offset of stepOffsets) {
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThan(numberOfPlayers);
      }
      for (let chainIndex = 0; chainIndex < numberOfPlayers; chainIndex += 1) {
        const authors = stepOffsets.map(
          (offset) => seatOrder[(chainIndex + offset) % numberOfPlayers],
        );
        expect(authors[0]).toBe(seatOrder[chainIndex]);
        expect(new Set(authors).size).toBe(numberOfPlayers);
      }
    },
  );
});

describe('relay task projection contract', () => {
  const entries: TestEntry[] = [0, 1, 2, 3].map((index) => ({
    id: `entry-${index}`,
    authorSeat: index,
    text: `secret-${index}`,
  }));
  const state: RelayRoundSlice<TestEntry> = {
    phase: 'settling',
    phaseRevision: 0,
    roundId: 'round-1',
    roundNumber: 1,
    participants: [],
    seatOrder: [0, 1, 2, 3],
    stepOffsets: [0, 1, 3, 2],
    stepIndex: 2,
    deadlineAt: null,
    readySeats: [],
    chains: [0, 1, 2, 3].map((chainIndex) => ({
      id: `chain-${chainIndex}`,
      originSeat: chainIndex,
      entries: chainIndex === 3 ? entries : [],
    })),
    gallery: null,
  };

  it('exposes only the immediately previous entry of the seat chain', () => {
    const seen: TestEntry[] = [];
    const task = getRelayTaskForSeat(state, 2, 4, (entry) => {
      seen.push(entry);
      return { text: entry.text };
    });
    if (task === null) throw new Error('Expected a task');
    expect(seen).toEqual([entries[1]]);
    expect(task.previousEntry).toEqual({ text: 'secret-1' });
    expect(task.chainId).toBe('chain-3');
    expect(task.isSubmitted).toBe(true);
  });

  it('exposes nothing at the first step', () => {
    const task = getRelayTaskForSeat({ ...state, stepIndex: 0 }, 2, 4, (entry) => ({
      text: entry.text,
    }));
    if (task === null) throw new Error('Expected a task');
    expect(task.previousEntry).toBeNull();
  });
});

describe('relay gallery contract', () => {
  const shape: RelayShape = {
    numberOfPlayers: 4,
    transitionDurationSeconds: 0,
    galleryItemDurationSeconds: 10,
  };

  function galleryState(gallery: RelayGalleryState, deadlineAt: number | null) {
    return {
      phase: 'gallery',
      phaseRevision: 0,
      roundId: 'round-1',
      roundNumber: 1,
      participants: [],
      seatOrder: [0, 1, 2, 3],
      stepOffsets: [0, 1, 3, 2],
      stepIndex: 3,
      deadlineAt,
      readySeats: [],
      chains: [],
      gallery,
    } satisfies RelayRoundSlice<TestEntry>;
  }

  function phaseEvent(decision: Decision<TestEvent, TestEffect>) {
    if (decision.kind !== 'commit') throw new Error('Expected a commit');
    const event = decision.events[0];
    if (event === undefined || event.type !== 'phase.changed')
      throw new Error('Expected a phase event');
    return event;
  }

  it('keeps the reveal monotonic across advance and rewind', () => {
    const kit = testKit(shape);
    const start = galleryState(
      { position: 0, revealedPosition: 0, isPlaying: true, remainingMs: null },
      10_000,
    );
    const advanced = phaseEvent(moveRelayGallery(kit, start, 1, 0));
    expect(advanced.gallery).toMatchObject({ position: 1, revealedPosition: 1 });
    const rewound = phaseEvent(
      moveRelayGallery(
        kit,
        { ...start, gallery: advanced.gallery, deadlineAt: advanced.deadlineAt },
        -1,
        0,
      ),
    );
    expect(rewound.gallery).toMatchObject({ position: 0, revealedPosition: 1 });
  });

  it('freezes the remaining time on pause and restores it on resume', () => {
    const kit = testKit(shape);
    const playing = galleryState(
      { position: 1, revealedPosition: 1, isPlaying: true, remainingMs: null },
      14_000,
    );
    const paused = phaseEvent(controlRelayGallery(kit, playing, 'pause', 10_000));
    expect(paused.gallery).toMatchObject({ isPlaying: false, remainingMs: 4_000 });
    expect(paused.deadlineAt).toBeNull();
    const resumed = phaseEvent(
      controlRelayGallery(
        kit,
        { ...playing, gallery: paused.gallery, deadlineAt: null },
        'resume',
        90_000,
      ),
    );
    expect(resumed.gallery).toMatchObject({ isPlaying: true, remainingMs: null });
    expect(resumed.deadlineAt).toBe(94_000);
  });

  it('rejects resume in manual paging mode', () => {
    const kit = testKit({ ...shape, galleryItemDurationSeconds: null });
    const manual = galleryState(
      { position: 1, revealedPosition: 1, isPlaying: false, remainingMs: null },
      null,
    );
    expect(controlRelayGallery(kit, manual, 'resume', 0)).toEqual({
      kind: 'reject',
      reason: REASONS.manual,
    });
  });

  it('finishes at the final cell in the ended phase', () => {
    const kit = testKit(shape);
    const start = galleryState(
      { position: 3, revealedPosition: 3, isPlaying: true, remainingMs: null },
      10_000,
    );
    const finished = phaseEvent(controlRelayGallery(kit, start, 'finish', 0));
    expect(finished.phase).toBe('ended');
    expect(finished.gallery).toMatchObject({ position: 15, revealedPosition: 15 });
  });
});

describe('relay revision contract', () => {
  it('advances the revision exactly on phase, start and clear landings', () => {
    const slice = { phaseRevision: 7, roundNumber: 2 };
    expect(
      applyRelayPhaseChanged(slice, {
        phase: 'settling',
        stepIndex: 0,
        deadlineAt: null,
        gallery: null,
      }).phaseRevision,
    ).toBe(8);
    expect(clearRelayRound(slice).phaseRevision).toBe(8);
    const started = applyRelayRoundStarted(slice, {
      roundId: 'round-2',
      participants: [],
      seatOrder: [0, 1, 2, 3],
      stepOffsets: [0, 1, 3, 2],
      chains: [],
      deadlineAt: null,
    });
    expect(started.phaseRevision).toBe(8);
    expect(started.roundNumber).toBe(3);
    expect(applyRelayTaskReady([0], 1, true)).toEqual({ readySeats: [0, 1] });
  });
});
