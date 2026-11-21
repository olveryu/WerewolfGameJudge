/**
 * Relay event application: the shared landing shapes for round
 * events.
 *
 * Each applier returns the round-slice fields an event changes; the
 * game spreads them into its own state and lands its game-owned
 * fields (timestamps, roster, config) itself. Phase changes are the
 * only round-slice writers of phaseRevision besides round start,
 * abort and return-to-lobby, which is what keeps the revision
 * contract: exactly those events advance the revision.
 */

import type { RelayChain, RelayParticipant, RelayPhase } from './types';

/** The round fields a round-started event carries into the slice. */
export interface RelayRoundStartFields<TEntry> {
  readonly participants: readonly RelayParticipant[];
  readonly seatOrder: readonly number[];
  readonly stepOffsets: readonly number[];
  readonly chains: readonly RelayChain<TEntry>[];
  readonly deadlineAt: number | null;
}

/** Clears every round-owned field back to the lobby shape, advancing the revision. */
export function clearRelayRound<TEntry>(slice: { readonly phaseRevision: number }): {
  readonly phase: RelayPhase;
  readonly phaseRevision: number;
  readonly roundId: null;
  readonly participants: readonly [];
  readonly seatOrder: readonly number[];
  readonly stepOffsets: readonly number[];
  readonly stepIndex: number;
  readonly deadlineAt: null;
  readonly readySeats: readonly number[];
  readonly chains: readonly RelayChain<TEntry>[];
  readonly gallery: null;
} {
  return {
    phase: 'lobby',
    phaseRevision: slice.phaseRevision + 1,
    roundId: null,
    participants: [],
    seatOrder: [],
    stepOffsets: [],
    stepIndex: -1,
    deadlineAt: null,
    readySeats: [],
    chains: [],
    gallery: null,
  };
}

/** Lands a round start on top of a cleared round, entering the first answering step. */
export function applyRelayRoundStarted<TEntry, TRound extends RelayRoundStartFields<TEntry>>(
  slice: { readonly phaseRevision: number; readonly roundNumber: number },
  round: TRound,
): TRound & {
  readonly phase: RelayPhase;
  readonly phaseRevision: number;
  readonly stepIndex: number;
  readonly roundNumber: number;
  readonly readySeats: readonly number[];
  readonly gallery: null;
} {
  const cleared = clearRelayRound<TEntry>(slice);
  return {
    ...round,
    phase: 'answering',
    phaseRevision: cleared.phaseRevision,
    stepIndex: 0,
    roundNumber: slice.roundNumber + 1,
    readySeats: [],
    gallery: null,
  };
}

/**
 * Lands one seat's readiness change.
 *
 * readySeats has exactly one canonical persisted order platform-wide:
 * strictly ascending by seat. A ready seat is inserted at its sorted
 * position (the input is already ascending), never appended in
 * arrival order — games' state invariants rely on this order, and no
 * consumer reads readySeats in arrival order.
 */
export function applyRelayTaskReady(
  readySeats: readonly number[],
  seat: number,
  isReady: boolean,
): { readonly readySeats: readonly number[] } {
  if (!isReady) {
    return { readySeats: readySeats.filter((ready) => ready !== seat) };
  }
  const index = readySeats.findIndex((ready) => ready > seat);
  return {
    readySeats:
      index === -1
        ? [...readySeats, seat]
        : [...readySeats.slice(0, index), seat, ...readySeats.slice(index)],
  };
}

/** Appends one entry to its chain, leaving every other chain untouched. */
export function applyRelayEntryAppended<TEntry>(
  chains: readonly RelayChain<TEntry>[],
  chainId: string,
  entry: TEntry,
): { readonly chains: readonly RelayChain<TEntry>[] } {
  return {
    chains: chains.map((chain) =>
      chain.id === chainId ? { ...chain, entries: [...chain.entries, entry] } : chain,
    ),
  };
}

/**
 * Lands a phase change: new phase fields, revision advanced, readiness
 * cleared. The gallery is opaque cargo for this applier — it is carried
 * from the event into the slice untouched, so each game passes (and
 * persists) its own gallery shape.
 */
export function applyRelayPhaseChanged<TGallery>(
  slice: { readonly phaseRevision: number },
  event: {
    readonly phase: RelayPhase;
    readonly stepIndex: number;
    readonly deadlineAt: number | null;
    readonly gallery: TGallery;
  },
): {
  readonly phase: RelayPhase;
  readonly phaseRevision: number;
  readonly stepIndex: number;
  readonly deadlineAt: number | null;
  readonly gallery: TGallery;
  readonly readySeats: readonly number[];
} {
  return {
    phase: event.phase,
    phaseRevision: slice.phaseRevision + 1,
    stepIndex: event.stepIndex,
    deadlineAt: event.deadlineAt,
    gallery: event.gallery,
    readySeats: [],
  };
}
