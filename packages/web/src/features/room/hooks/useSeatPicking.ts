/**
 * useSeatPicking - Shared seat-board picking hook.
 *
 * The stateful half of the picking mechanism (the pure half is
 * resolveSeatPickTap in ../model/seatPicking): mode activation, tap
 * consumption, anchor-based invalidation, and selection storage.
 *
 * Callers must consult handleSeatTap BEFORE their default seat-tap
 * resolution (resolveRoomInGameSeatTap): true means the tap was a pick
 * and the default behavior must not run.
 *
 * Storage is injected, following useStageDeadline's shape:
 * - 'local': the selection lives in this hook (undercover revelation,
 *   fibking guess, avalon one-shot triggers via onPick).
 * - 'room': the selection lives outside (the avalon nomination draft
 *   lives on the server); the hook reads the projected selection and
 *   reports the next one through onSelectionChange. Taps land on an
 *   optimistic mirror first, so the picker sees their own pick at once
 *   instead of after the server echo; the mirror reconciles against
 *   the projection (see the reconciliation effect) and the projection
 *   stays authoritative.
 *
 * Changing anchorKey resets a local selection (a new round must not
 * inherit the previous round's pick). The room mirror drops on anchor
 * changes and whenever picking goes inactive: it must never outlive
 * the context that produced it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  resolveSeatPickTap,
  type SeatPickIneligibleTap,
  type SeatPickMode,
} from '../model/seatPicking';

export type SeatPickingStorage =
  | { readonly kind: 'local' }
  | {
      readonly kind: 'room';
      /** The authoritative selection, projected by the caller. */
      readonly selection: readonly number[];
      /**
       * Called with the whole next selection (whole-set replacement).
       * May return the dispatch outcome: resolving false (or rejecting)
       * means the authoritative side refused the set, and the optimistic
       * mirror rolls back to the projection.
       */
      readonly onSelectionChange: (nextSelection: readonly number[]) => void | Promise<boolean>;
      /**
       * Mirror observer for consumers that render the selection from a
       * separate derivation: called synchronously when a tap sets the
       * optimistic mirror, and with null whenever it clears (echo caught
       * up, external change, rejection, invalidation).
       */
      readonly onMirrorChange?: (mirror: readonly number[] | null) => void;
    };

export interface UseSeatPickingParams {
  /** Whether this picking mode currently owns seat taps. */
  readonly active: boolean;
  readonly mode: SeatPickMode;
  /** Seats that may be picked right now (produced by the game's policy). */
  readonly eligibleSeats: readonly number[];
  /** Toggle cap; tapping an unselected seat at the cap is silently ignored. */
  readonly maxSize?: number;
  /** Ineligible-tap behavior; defaults to 'fallthrough'. */
  readonly ineligibleTap?: SeatPickIneligibleTap;
  /** Identity of the picking context (e.g. round id); a change resets local storage. */
  readonly anchorKey?: string | null;
  readonly storage: SeatPickingStorage;
  /** Trigger mode: called with the picked seat. */
  readonly onPick?: (seat: number) => void;
}

export interface SeatPicking {
  readonly selection: readonly number[];
  /** True when the tap was consumed by picking; false falls through to default seat behavior. */
  readonly handleSeatTap: (seat: number) => boolean;
  /** Clears a local selection (room storage is the owner's to clear). */
  readonly reset: () => void;
}

const EMPTY_SELECTION: readonly number[] = [];

/** Whole-set equality (order-sensitive: a reordered echo is a new set). */
function sameSeatSet(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((seat, index) => seat === b[index]);
}

export function useSeatPicking(params: UseSeatPickingParams): SeatPicking {
  const [localSelection, setLocalSelection] = useState<readonly number[]>(EMPTY_SELECTION);
  // Room-storage optimistic mirror: the latest whole set this client
  // sent that the projection has not caught up with yet. Tap arithmetic
  // and the exposed selection read it ahead of the projection so the
  // picker is never gated on the server round trip (and rapid taps
  // compound on it instead of overwriting each other); reconciliation
  // below keeps the projection authoritative.
  const [roomMirror, setRoomMirror] = useState<readonly number[] | null>(null);
  const roomMirrorRef = useRef<readonly number[] | null>(null);
  // Whole sets sent since the mirror engaged, in send order. Echoes of
  // earlier sets arrive while a newer mirror stands and must not roll
  // it back.
  const sentSetsRef = useRef<readonly (readonly number[])[]>([]);
  // The tap handler is stable and reads the latest params through a ref:
  // callers register it once (e.g. avalon's seat-pick handler bridge)
  // while eligibility and activity change with every snapshot.
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);
  const localSelectionRef = useRef(localSelection);
  const applyLocalSelection = useCallback((next: readonly number[]) => {
    localSelectionRef.current = next;
    setLocalSelection(next);
  }, []);
  const applyRoomMirror = useCallback((next: readonly number[] | null) => {
    if (roomMirrorRef.current === next) return;
    roomMirrorRef.current = next;
    setRoomMirror(next);
    const storage = paramsRef.current.storage;
    if (storage.kind === 'room') storage.onMirrorChange?.(next);
  }, []);
  const clearRoomMirror = useCallback(() => {
    sentSetsRef.current = [];
    applyRoomMirror(null);
  }, [applyRoomMirror]);
  // Anchor invalidation: a new anchor (new round / new nomination
  // context) starts from an empty local selection and no mirror.
  const anchorKey = params.anchorKey;
  const anchorRef = useRef(anchorKey);
  useEffect(() => {
    if (anchorRef.current !== anchorKey) {
      anchorRef.current = anchorKey;
      applyLocalSelection(EMPTY_SELECTION);
      clearRoomMirror();
    }
  }, [anchorKey, applyLocalSelection, clearRoomMirror]);
  // The mirror only means something while this picking owns taps;
  // going inactive drops it rather than letting it linger on screen.
  const pickingActive = params.active;
  useEffect(() => {
    if (!pickingActive) clearRoomMirror();
  }, [pickingActive, clearRoomMirror]);
  // Room mirror reconciliation, run whenever the projection moves.
  // Comparisons are by value, not identity: a caller may hand back an
  // equal set under a fresh array reference without anything having
  // moved, and only a value change is a server event.
  // - projection equals the mirror: the echo caught up, mirror retires.
  // - projection value unchanged: identity churn only; nothing to do.
  // - projection equals an earlier sent set: a stale echo; prune the
  //   sets it covers and keep the mirror.
  // - projection matches nothing sent: an external change (the phase
  //   advanced and cleared the draft, another actor rewrote it); the
  //   server wins and the mirror drops.
  const roomProjection = params.storage.kind === 'room' ? params.storage.selection : null;
  const lastProjectionRef = useRef<readonly number[] | null>(null);
  useEffect(() => {
    if (roomProjection === null) {
      lastProjectionRef.current = null;
      return;
    }
    const previousProjection = lastProjectionRef.current;
    lastProjectionRef.current = roomProjection;
    if (roomMirrorRef.current === null) return;
    if (sameSeatSet(roomProjection, roomMirrorRef.current)) {
      clearRoomMirror();
      return;
    }
    if (previousProjection !== null && sameSeatSet(roomProjection, previousProjection)) return;
    const echoedIndex = sentSetsRef.current.findIndex((sent) => sameSeatSet(sent, roomProjection));
    if (echoedIndex >= 0) {
      sentSetsRef.current = sentSetsRef.current.slice(echoedIndex + 1);
      return;
    }
    clearRoomMirror();
  }, [roomProjection, clearRoomMirror]);

  const handleSeatTap = useCallback(
    (seat: number): boolean => {
      const current = paramsRef.current;
      if (!current.active) return false;
      const selection =
        current.storage.kind === 'room'
          ? (roomMirrorRef.current ?? current.storage.selection)
          : localSelectionRef.current;
      const result = resolveSeatPickTap({
        seat,
        eligibleSeats: current.eligibleSeats,
        mode: current.mode,
        selection,
        maxSize: current.maxSize,
        ineligibleTap: current.ineligibleTap ?? 'fallthrough',
      });
      switch (result.kind) {
        case 'fallthrough':
          return false;
        case 'ignored':
          return true;
        case 'pick':
          current.onPick?.(result.seat);
          return true;
        case 'consumed':
          if (current.storage.kind === 'room') {
            sentSetsRef.current = [...sentSetsRef.current, result.nextSelection];
            const outcome = current.storage.onSelectionChange(result.nextSelection);
            applyRoomMirror(result.nextSelection);
            if (outcome !== undefined) {
              void outcome.then(
                (accepted) => {
                  if (!accepted) clearRoomMirror();
                },
                () => clearRoomMirror(),
              );
            }
          } else {
            applyLocalSelection(result.nextSelection);
          }
          return true;
      }
    },
    [applyLocalSelection, applyRoomMirror, clearRoomMirror],
  );

  const reset = useCallback(() => {
    if (paramsRef.current.storage.kind === 'local') applyLocalSelection(EMPTY_SELECTION);
  }, [applyLocalSelection]);

  return {
    selection:
      params.storage.kind === 'room' ? (roomMirror ?? params.storage.selection) : localSelection,
    handleSeatTap,
    reset,
  };
}
