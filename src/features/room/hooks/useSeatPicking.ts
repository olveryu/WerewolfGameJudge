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
 *   reports the next one through onSelectionChange. No optimistic
 *   local copy is kept — the caller's projection is the only echo.
 *
 * Changing anchorKey resets a local selection (a new round must not
 * inherit the previous round's pick). Room storage needs no reset:
 * the server clears its own state on phase changes.
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
      /** Called with the whole next selection (whole-set replacement). */
      readonly onSelectionChange: (nextSelection: readonly number[]) => void;
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

export function useSeatPicking(params: UseSeatPickingParams): SeatPicking {
  const [localSelection, setLocalSelection] = useState<readonly number[]>(EMPTY_SELECTION);
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
  // Anchor invalidation: a new anchor (new round / new nomination
  // context) starts from an empty local selection.
  const anchorKey = params.anchorKey;
  const anchorRef = useRef(anchorKey);
  useEffect(() => {
    if (anchorRef.current !== anchorKey) {
      anchorRef.current = anchorKey;
      applyLocalSelection(EMPTY_SELECTION);
    }
  }, [anchorKey, applyLocalSelection]);

  const handleSeatTap = useCallback(
    (seat: number): boolean => {
      const current = paramsRef.current;
      if (!current.active) return false;
      const selection =
        current.storage.kind === 'room' ? current.storage.selection : localSelectionRef.current;
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
            current.storage.onSelectionChange(result.nextSelection);
          } else {
            applyLocalSelection(result.nextSelection);
          }
          return true;
      }
    },
    [applyLocalSelection],
  );

  const reset = useCallback(() => {
    if (paramsRef.current.storage.kind === 'local') applyLocalSelection(EMPTY_SELECTION);
  }, [applyLocalSelection]);

  return {
    selection: params.storage.kind === 'room' ? params.storage.selection : localSelection,
    handleSeatTap,
    reset,
  };
}
